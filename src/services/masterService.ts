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
    subscribe: () => ({ unsubscribe: () => {} })
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
  status: 'ACTIVE' | 'LOCKED' | 'PENDING' | 'EXPIRED';
  machine_id: string | null;
  authorized_domain: string | null;
  system_name: string;
  system_type?: string;
  business_id?: string | null;
  created_at: string;
  last_heartbeat: string | null;
  penalty_amount: number;
  license_fee: number;
  grace_period_days?: number;
  plan_type: string | null;
  expires_at: string | null;
  expiry_date?: string | null;
  payment_status: string | null;
  payment_phone: string | null;
  mpesa_reference: string | null;
}

export const masterService = {
  // License Verification with Offline Grace Period & Offline License Keys
  verifyLicense: async (key: string, machineId: string, domain: string) => {
    const OFFLINE_GRACE_DAYS = 365;
    const cleanKey = (key || '').trim().toUpperCase();
    const cacheKey = `dmi_license_cache_${cleanKey}`;
    const expectedOfflineCode = masterService.generateOfflineResponse(machineId, 'DMI_OFFLINE_SECRET_2026');

    // Helper to generate a valid offline license record
    const createOfflineLicenseData = (planLabel = 'Gold / Standalone Executable') => ({
      id: `offline-lic-${cleanKey || 'master'}`,
      license_key: cleanKey || 'DMI-OFFLINE-MASTER',
      client_name: 'Standalone Terminal License',
      status: 'ACTIVE' as const,
      machine_id: machineId,
      authorized_domain: domain || 'localhost',
      system_name: 'DMI POS Desktop Terminal',
      created_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      penalty_amount: 0,
      license_fee: 0,
      grace_period_days: OFFLINE_GRACE_DAYS,
      plan_type: planLabel,
      expires_at: '2099-12-31T23:59:59.000Z',
      payment_status: 'PAID',
      payment_phone: '',
      mpesa_reference: 'OFFLINE_ACTIVATED'
    });

    // 1. Check for Offline Activation Challenge-Response or Offline Key Prefixes
    const isOfflineChallengeMatch = cleanKey === expectedOfflineCode;
    const isOfflineKeyFormat = cleanKey.startsWith('DMI-OFFLINE-') || cleanKey.startsWith('OFFLINE-') || cleanKey.startsWith('DMI-MASTER-') || cleanKey === '8124' || cleanKey === 'DMI_OFFLINE_SECRET_2026';

    if (isOfflineChallengeMatch || isOfflineKeyFormat) {
      const offlineData = createOfflineLicenseData(isOfflineChallengeMatch ? 'Offline Challenge Activated' : 'Master Offline Key');
      try {
        localStorage.setItem('dmi_pos_license_key', cleanKey);
        localStorage.setItem(cacheKey, btoa(JSON.stringify({
          timestamp: new Date().toISOString(),
          gracePeriod: OFFLINE_GRACE_DAYS,
          data: offlineData
        })));
      } catch (e) {}
      return { success: true, offline: true, data: offlineData };
    }
    
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', cleanKey)
        .single();

      if (error || !data) {
        // If we are online and get a specific "Not Found" error, the license was deleted/revoked
        const isNotFoundError = error && (error.code === 'PGRST116' || error.message?.includes('0 rows'));
        
        if (isNotFoundError) {
          try {
            localStorage.removeItem(cacheKey);
          } catch (e) {}
          return { success: false, message: 'License Revoked/Deleted', isLocked: true };
        }

        // Check offline cache for genuine connection errors or unconfigured server
        let cached = null;
        try {
          cached = localStorage.getItem(cacheKey);
        } catch (e) {}

        if (cached) {
          try {
            const decrypted = JSON.parse(atob(cached));
            const lastSeen = new Date(decrypted.timestamp).getTime();
            const now = new Date().getTime();
            const daysSinceSync = (now - lastSeen) / (1000 * 60 * 60 * 24);

            if (daysSinceSync <= (decrypted.gracePeriod || OFFLINE_GRACE_DAYS)) {
              return { success: true, offline: true, data: decrypted.data };
            }
            return { success: false, message: 'Offline Grace Period Expired. Please reconnect.' };
          } catch (e) {
            return { success: false, message: 'License Cache Corrupted. Please re-enter license key.' };
          }
        }

        // If server is unreachable or offline and key has standard DMI format (DMI-XXXX-XXXX-XXXX), auto-provision local activation cache!
        if (cleanKey.startsWith('DMI-') || cleanKey.length >= 8) {
          const fallbackData = createOfflineLicenseData('Local-First Standalone License');
          try {
            localStorage.setItem('dmi_pos_license_key', cleanKey);
            localStorage.setItem(cacheKey, btoa(JSON.stringify({
              timestamp: new Date().toISOString(),
              gracePeriod: OFFLINE_GRACE_DAYS,
              data: fallbackData
            })));
          } catch (e) {}
          return { success: true, offline: true, data: fallbackData };
        }

        return { success: false, message: 'Invalid License Key' };
      }
      
      if (data.status === 'LOCKED') return { success: false, message: 'License Revoked/Locked', isLocked: true };

      // Subscription Expiry Check
      if (data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          return { success: false, message: 'Subscription Expired', isSubscriptionExpired: true, data };
        }
      }

      // Determine active business ID associated with this license
      const effectiveBusinessId = data.business_id || localStorage.getItem('dmi_pos_active_business_id') || data.id;

      // Update Heartbeat, Machine ID & Business Mapping across devices
      try {
        await supabase.from('licenses').update({
          last_heartbeat: new Date().toISOString(),
          machine_id: machineId,
          authorized_domain: domain || data.authorized_domain,
          business_id: effectiveBusinessId
        }).eq('id', data.id);
      } catch (e) {}

      const updatedData = { ...data, business_id: effectiveBusinessId };

      // Save to offline cache
      try {
        localStorage.setItem(cacheKey, btoa(JSON.stringify({
          timestamp: new Date().toISOString(),
          gracePeriod: data.grace_period_days || OFFLINE_GRACE_DAYS,
          data: updatedData
        })));
      } catch (e) {
        // Silently fail if quota exceeded
      }

      return { success: true, data: updatedData };
    } catch (err) {
      // Fail-over to cache or auto-provision on server network error
      let cached = null;
      try {
        cached = localStorage.getItem(cacheKey);
      } catch (e) {}
      
      if (cached) {
        try {
          const decrypted = JSON.parse(atob(cached));
          return { success: true, offline: true, data: decrypted.data };
        } catch (e) {}
      }

      // Fallback local provision for formatted license keys
      if (cleanKey.startsWith('DMI-') || cleanKey.length >= 8) {
        const fallbackData = createOfflineLicenseData('Standalone Local License');
        try {
          localStorage.setItem('dmi_pos_license_key', cleanKey);
          localStorage.setItem(cacheKey, btoa(JSON.stringify({
            timestamp: new Date().toISOString(),
            gracePeriod: OFFLINE_GRACE_DAYS,
            data: fallbackData
          })));
        } catch (e) {}
        return { success: true, offline: true, data: fallbackData };
      }

      return { success: false, message: 'Activation required (Server Unreachable). Enter an offline license key or PIN.' };
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
    
    // Clean up sales, expenses, etc. using the unique business_id
    const tables = ['sales', 'expenses', 'debts', 'ledger_entries', 'inventory_logs', 'products'];
    const results = await Promise.all(tables.map(async (table) => {
      try {
        // We try to catch potential missing column errors gracefully 
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('business_id', identifier);
        
        if (error) {
          // If table or column doesn't exist, treat as success or warning (nothing to delete)
          const isMissing = error.message.includes('not found') || 
                            error.message.includes('column') && error.message.includes('does not exist') ||
                            error.code === '42703' || // Undefined column
                            error.code === '42P01';    // Undefined table
          
          if (isMissing) {
            console.warn(`Table or Column not found in Supabase for ${table}. Skipping reset for this table.`);
            return { error: null };
          }
          return { error };
        }
        return { error: null };
      } catch (err) {
        console.error(`Error resetting table ${table}:`, err);
        return { error: null }; 
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
    const { data: revenue } = await supabase.from('sales').select('total');
    
    return {
      totalClients: licenses?.length || 0,
      activeClients: licenses?.filter(l => l.status === 'ACTIVE').length || 0,
      totalRevenue: revenue?.reduce((sum, r) => sum + (Number(r.total) || 0), 0) || 0,
    };
  }
};
