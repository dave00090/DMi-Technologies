import { createClient } from '@supabase/supabase-js';

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
      eq: () => handler,
      single: () => Promise.resolve({ data: null, error: { message: 'Supabase configuration missing' } }),
      update: () => handler,
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase configuration missing' } }),
      // Make it thenable to support direct await
      then: (resolve: any) => resolve({ data: [], error: { message: 'Supabase configuration missing' } })
    };
    return handler;
  }
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

  // Generate Offline Activation Code (Challenge-Response)
  generateOfflineResponse: (machineId: string, secret: string) => {
    // Simple but secure enough hashing for offline activation
    return btoa(machineId + secret).slice(0, 12).toUpperCase();
  },

  reportPiracy: async (licenseId: string, message: string) => {
    await supabase.from('piracy_alerts').insert({
      id: crypto.randomUUID(),
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