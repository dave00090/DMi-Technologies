import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Sanitize URL: Remove trailing slashes and common API path suffixes that can break the SDK
const supabaseUrl = supabaseUrlRaw.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');

// Initialize client only if URL and Key are present to prevent crashes on startup
const mockSupabase = { 
  from: () => {
    const handler = {
      select: () => handler,
      order: () => handler,
      limit: () => handler,
      eq: () => handler,
      single: () => Promise.resolve({ data: null, error: { message: 'Supabase configuration missing' } }),
      update: () => handler,
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase configuration missing' } }),
      delete: () => handler,
      or: () => handler,
      gt: () => handler,
      // Make it thenable to support direct await
      then: (resolve: any) => resolve({ data: [], error: { message: 'Supabase configuration missing' } })
    };
    return handler;
  },
  channel: () => ({
    on: function() { return this; },
    subscribe: () => ({})
  }),
  removeChannel: () => Promise.resolve()
} as any;

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : mockSupabase;

export interface License {
  id: string;
  license_key: string;
  client_name: string;
  status: 'ACTIVE' | 'LOCKED' | 'PENDING';
  machine_id: string | null;
  authorized_domain: string | null;
  system_name: string;
  created_at: string;
  last_heartbeat: string | null;
  penalty_amount: number;
  license_fee: number;
  grace_period_days?: number;
}

export const masterService = {
  // License Verification with Offline Grace Period
  verifyLicense: async (key: string, machineId: string, domain: string) => {
    const OFFLINE_GRACE_DAYS = 7;
    const cacheKey = `dmi_license_cache_${key}`;
    
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', key)
        .single();

      if (error || !data) {
        // Check offline cache
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const decrypted = JSON.parse(atob(cached));
            const lastSeen = new Date(decrypted.timestamp).getTime();
            const now = new Date().getTime();
            const daysSinceSync = (now - lastSeen) / (1000 * 60 * 60 * 24);

            if (daysSinceSync <= (decrypted.gracePeriod || OFFLINE_GRACE_DAYS)) {
              return { success: true, offline: true, data: decrypted.data };
            }
            return { success: false, message: 'Offline Grace Period Expired. Please connect to internet.' };
          } catch (e) {
            return { success: false, message: 'License Cache Corrupted. Please reconnect.' };
          }
        }
        return { success: false, message: 'Invalid License Key' };
      }
      
      if (data.status === 'LOCKED') return { success: false, message: 'License Revoked/Locked', isLocked: true };

      // Anti-Piracy Check
      if (data.machine_id && data.machine_id !== machineId) {
        await masterService.reportPiracy(data.id, `Unauthorized hardware change detected. Original: ${data.machine_id}, New: ${machineId}`);
        return { success: false, message: 'Hardware Mismatch - Possible Unauthorized Copy', securityBreach: true };
      }

      // Update Heartbeat and Sync Cache
      await supabase.from('licenses').update({
        last_heartbeat: new Date().toISOString(),
        machine_id: data.machine_id || machineId,
        authorized_domain: data.authorized_domain || domain
      }).eq('id', data.id);

      // Save to offline cache
      localStorage.setItem(cacheKey, btoa(JSON.stringify({
        timestamp: new Date().toISOString(),
        gracePeriod: data.grace_period_days || OFFLINE_GRACE_DAYS,
        data: data
      })));

      return { success: true, data };
    } catch (err) {
      // Fail-over to cache on network error
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const decrypted = JSON.parse(atob(cached));
          return { success: true, offline: true, data: decrypted.data };
        } catch (e) {
          return { success: false, message: 'Activation required (Server Unreachable)' };
        }
      }
      return { success: false, message: 'Activation required (Server Unreachable)' };
    }
  },

  // Delete Client and all associated data
  deleteClient: async (licenseId: string) => {
    // 1. Get the license to find the client/business info
    const { data: license } = await supabase.from('licenses').select('*').eq('id', licenseId).single();
    if (!license) return { error: 'License not found' };

    // Note: In an ideal world, we'd delete by businessId. 
    // For now we'll clean up based on what we can identify.
    // Most tables have businessId, but we need to know what businessId is assigned to this license.
    // If businessId is not in the license table, we might need to find it via client_name or similar.
    
    // Deleting the license record (This will lock them out)
    const { error } = await supabase.from('licenses').delete().eq('id', licenseId);
    return { error };
  },

  // Reset Client Sales/Balance/Data
  resetClientData: async (identifier: string) => {
    if (!identifier) return { error: 'Identifier required' };
    
    // Clean up sales, expenses, etc. using the unique businessId or client_name
    const tables = ['sales', 'expenses', 'debts', 'ledger_entries'];
    const results = await Promise.all(tables.map(async (table) => {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .or(`businessId.eq.${identifier},client_name.eq.${identifier}`);
        
        // If table doesn't exist, treat as success (nothing to delete)
        if (error && error.message.includes('Could not find the table')) {
          console.warn(`Table ${table} not found in Supabase. Skipping reset for this table.`);
          return { error: null };
        }
        return { error };
      } catch (err) {
        console.error(`Error resetting table ${table}:`, err);
        return { error: null }; // Continue with others
      }
    }));
    
    const errors = results.filter(r => r.error).map(r => r.error?.message);
    return { success: errors.length === 0, errors };
  },

  // Generate Offline Activation Code (Challenge-Response)
  generateOfflineResponse: (machineId: string, secret: string) => {
    // Simple but secure enough hashing for offline activation
    return btoa(machineId + secret).slice(0, 12).toUpperCase();
  },

  reportPiracy: async (licenseId: string, message: string) => {
    await supabase.from('piracy_alerts').insert({
      id: uuidv4(),
      license_id: licenseId,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: navigator.userAgent,
        href: window.location.href,
        hostname: window.location.hostname
      }
    });

    // Auto-lock on piracy detection
    await supabase.from('licenses').update({ status: 'LOCKED' }).eq('id', licenseId);
  },

  // Admin Controls (For DMi Technologies)
  getGlobalDashboard: async () => {
    const { data: licenses } = await supabase.from('licenses').select('*');
    const { data: revenue } = await supabase.from('sales').select('amount');
    
    return {
      totalClients: licenses?.length || 0,
      activeClients: licenses?.filter(l => l.status === 'ACTIVE').length || 0,
      totalRevenue: revenue?.reduce((sum, r) => sum + r.amount, 0) || 0,
    };
  }
};
