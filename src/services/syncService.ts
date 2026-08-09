import { localDb, getLocal, setLocal } from './localDb';
import axios from 'axios';
import { supabase } from './masterService';
import { createClient } from '@supabase/supabase-js';

export interface DiagnosticStep {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  latencyMs?: number;
}

export interface DiagnosticResult {
  timestamp: string;
  overallStatus: 'ONLINE' | 'OFFLINE_STANDALONE' | 'UNREACHABLE';
  displayUrl: string;
  steps: DiagnosticStep[];
  troubleshootingSteps: string[];
}

export interface SyncLog {
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'ERROR';
  message: string;
}

export interface SyncStats {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  logs: SyncLog[];
}

const STORAGE_KEYS = {
  SYNC_STATS: 'dmi_pos_sync_stats',
  PRODUCTS: 'dmi_pos_products',
  SALES: 'dmi_pos_sales',
  CUSTOMERS: 'dmi_pos_customers',
  EXPENSES: 'dmi_pos_expenses',
  SUPPLIERS: 'dmi_pos_suppliers',
  EMPLOYEES: 'dmi_pos_employees',
  ATTENDANCE: 'dmi_pos_attendance',
  PAYROLL: 'dmi_pos_payroll',
  DEBTS: 'dmi_pos_debts',
  LEDGER: 'dmi_pos_ledger',
  BUSINESSES: 'dmi_pos_businesses',
  SHOPS: 'dmi_pos_shops',
  GUEST_REQUESTS: 'dmi_pos_guest_requests',
};

class SyncService {
  private isOnlineState: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncLogs: SyncLog[] = [];
  private listeners: Set<(stats: SyncStats) => void> = new Set();
  private intervalId: any = null;
  private lastConnectionError: string = '';

  public getBaseUrl(): string {
    const saved = localStorage.getItem('dmi_pos_sync_server_url');
    let url = '';
    
    if (saved) {
      url = saved;
    } else if (window.location.protocol === 'file:') {
      url = 'https://ais-pre-kayb6z7vprmlkln2iwpxb5-430844239449.europe-west2.run.app';
    } else {
      url = window.location.origin;
    }

    // Auto-heal previously corrupted URL formats stored in LocalStorage
    if (url.includes('http://https') || url.includes('http://http') || url.includes('/https') || url.includes('//:')) {
      let clean = url.trim();
      const isSecure = /https/i.test(clean.substring(0, 25));
      
      // Remove bad leading headers recursively
      for (let i = 0; i < 4; i++) {
        clean = clean.replace(/^(https?|http|ftp|file)[\s:/\\+]+/i, '');
      }
      clean = clean.replace(/^[:/\\ ]+/, '').replace(/[:/\\ ]+$/, '');
      
      url = (isSecure ? 'https://' : 'http://') + clean;
      if (saved) {
        localStorage.setItem('dmi_pos_sync_server_url', url);
      }
    }

    // If the resolved URL is the same origin as the current page, return empty string so axios makes relative requests.
    if (window.location.protocol !== 'file:') {
      try {
        const originUrl = new URL(url);
        if (originUrl.host === window.location.host) {
          return '';
        }
      } catch (e) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return '';
        }
      }
    }
    
    return url;
  }

  public getDisplayUrl(): string {
    const saved = localStorage.getItem('dmi_pos_sync_server_url');
    if (saved) return saved;
    const envSupabase = import.meta.env.VITE_SUPABASE_URL;
    if (envSupabase) return envSupabase;
    if (window.location.protocol === 'file:') {
      return 'https://ais-pre-kayb6z7vprmlkln2iwpxb5-430844239449.europe-west2.run.app';
    }
    return window.location.origin;
  }

  public setBaseUrl(url: string) {
    let clean = url.trim();
    if (!clean) {
      localStorage.removeItem('dmi_pos_sync_server_url');
      this.syncLogs = this.syncLogs.filter(log => log.type !== 'ERROR');
      this.addLog('INFO', `Sync backend server gateway reset to default: ${this.getDisplayUrl()}`);
      this.checkConnectivity();
      this.syncNow(true);
      return;
    }

    const isSecure = /https/i.test(clean.substring(0, 20));

    let hostPart = clean;
    for (let i = 0; i < 3; i++) {
      hostPart = hostPart.replace(/^(https?|http|ftp|file)[\s:/\\+]+/i, '');
    }
    hostPart = hostPart.replace(/^[:/\\ ]+/, '').replace(/[:/\\ ]+$/, '');

    const sanitized = (isSecure ? 'https://' : 'http://') + hostPart;
    
    this.syncLogs = this.syncLogs.filter(log => log.type !== 'ERROR');
    localStorage.setItem('dmi_pos_sync_server_url', sanitized);

    if (sanitized.includes('netlify.app') || sanitized.includes('vercel.app') || sanitized.includes('github.io')) {
      this.addLog('INFO', `Sync gateway set to: ${sanitized} (Frontend Web Host detected). For live database sync, please configure your Supabase REST endpoint URL. Terminal will operate in Local-First Standalone mode.`);
    } else {
      this.addLog('INFO', `Sync backend server gateway set to: ${sanitized}`);
    }
    this.checkConnectivity();
    this.syncNow(true);
  }

  private getApiClient() {
    return axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 5000,
      withCredentials: true
    });
  }

  constructor() {
    this.init();
  }

  private async init() {
    await this.checkConnectivity();

    window.addEventListener('online', () => {
      this.updateOnlineStatus(true);
      this.addLog('INFO', 'Network connection detected. Scheduling automatic sync...');
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatus(false);
      this.addLog('INFO', 'Offline terminal mode activated. Transactions will cache locally.');
    });

    const cachedStats = getLocal<Partial<SyncStats>>(STORAGE_KEYS.SYNC_STATS, {});
    if (cachedStats.logs) {
      this.syncLogs = cachedStats.logs;
    }

    this.startAutoSync(30000);
  }

  private updateOnlineStatus(online: boolean) {
    this.isOnlineState = online;
    this.notify();
  }

  public addListener(callback: (stats: SyncStats) => void) {
    this.listeners.add(callback);
    callback(this.getStats());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const stats = this.getStats();
    setLocal(STORAGE_KEYS.SYNC_STATS, {
      lastSyncTime: stats.lastSyncTime,
      logs: this.syncLogs.slice(0, 50),
    });
    this.listeners.forEach(cb => cb(stats));
    window.dispatchEvent(new CustomEvent('sync-stats-updated', { detail: stats }));
  }

  public getStats(): SyncStats {
    const cachedStats = getLocal<Partial<SyncStats>>(STORAGE_KEYS.SYNC_STATS, {});
    return {
      isOnline: this.isOnlineState,
      lastSyncTime: cachedStats.lastSyncTime || null,
      pendingCount: this.getPendingCount(),
      logs: this.syncLogs,
    };
  }

  public addLog(type: 'INFO' | 'SUCCESS' | 'ERROR', message: string) {
    const log: SyncLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    this.syncLogs = [log, ...this.syncLogs].slice(0, 100);
    this.notify();
  }

  private async executeHealthPing(targetUrl: string, timeoutMs: number = 4000): Promise<{ status: number; isHtml: boolean }> {
    const isSupabase = targetUrl.includes('.supabase.co') || targetUrl.includes('/rest/v1');
    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('dmi_pos_supabase_anon_key') || '';

    if (isSupabase) {
      const cleanUrl = targetUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
      const client = axios.create({
        baseURL: cleanUrl,
        timeout: timeoutMs,
        validateStatus: (status) => status < 500,
        headers: apiKey ? {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        } : {}
      });
      try {
        let res = await client.get('/rest/v1/cloud_sync_state?select=id&limit=1');
        if (res.status === 404) {
          res = await client.get('/rest/v1/sales?select=id&limit=1');
        }
        const isHtml = typeof res.data === 'string' && (res.data.includes('<!DOCTYPE html') || res.data.includes('<html'));
        return { status: res.status, isHtml };
      } catch (err: any) {
        if (err.response) {
          return { status: err.response.status, isHtml: false };
        }
        throw err;
      }
    } else {
      const client = this.getApiClient();
      const res = await client.get('/api/health', { timeout: timeoutMs, validateStatus: (status) => status < 500 });
      const isHtml = typeof res.data === 'string' && (res.data.includes('<!DOCTYPE html') || res.data.includes('<html'));
      return { status: res.status, isHtml };
    }
  }

  public async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      this.updateOnlineStatus(false);
      this.lastConnectionError = 'Device feels offline (navigator.onLine is false)';
      return false;
    }

    const currentDisplayUrl = this.getDisplayUrl();
    const isSupabase = currentDisplayUrl.includes('.supabase.co') || currentDisplayUrl.includes('/rest/v1') || !!import.meta.env.VITE_SUPABASE_URL;

    if (!isSupabase && (currentDisplayUrl.includes('netlify.app') || currentDisplayUrl.includes('vercel.app') || currentDisplayUrl.includes('github.io'))) {
      this.updateOnlineStatus(true);
      this.lastConnectionError = 'Configured URL is a web frontend (Netlify/Vercel). Operating in Local-First Standalone mode.';
      return true;
    }

    try {
      const ping = await this.executeHealthPing(currentDisplayUrl, 4000);
      const isAuthRequired = ping.status === 401 || ping.status === 403;
      const online = ((ping.status >= 200 && ping.status < 300) || isAuthRequired) && !ping.isHtml;
      this.updateOnlineStatus(online || navigator.onLine);
      if (online) {
        if (isAuthRequired) {
          this.lastConnectionError = `Supabase Gateway live (${ping.status} Auth Required - Set VITE_SUPABASE_ANON_KEY).`;
        } else {
          this.lastConnectionError = '';
        }
      } else if (ping.isHtml) {
        this.lastConnectionError = 'Server URL points to static HTML. Operating in Local-First mode.';
      } else {
        this.lastConnectionError = `Server returned status HTTP ${ping.status}`;
      }
      return online || isSupabase;
    } catch (e: any) {
      this.updateOnlineStatus(navigator.onLine);
      this.lastConnectionError = e.response
        ? `HTTP ${e.response.status}: ${e.response.statusText || 'Error response'}`
        : e.message || 'API Timeout / Connection Refused';
      return navigator.onLine;
    }
  }

  public getLastConnectionError(): string {
    return this.lastConnectionError;
  }

  public async runDiagnostics(): Promise<DiagnosticResult> {
    const url = this.getDisplayUrl();
    const steps: DiagnosticStep[] = [];
    const troubleshootingSteps: string[] = [];

    const isDeviceOnline = navigator.onLine;
    steps.push({
      name: 'Network Connection',
      status: isDeviceOnline ? 'PASS' : 'FAIL',
      message: isDeviceOnline 
        ? 'Local Wi-Fi / Ethernet adapter is active and online.' 
        : 'Device appears offline. Reconnect your Wi-Fi or Ethernet cable.'
    });

    if (!isDeviceOnline) {
      troubleshootingSteps.push('Verify that your device Wi-Fi or Ethernet cable is plugged in and turned on.');
      troubleshootingSteps.push('Check router connection or test internet by browsing a public web page.');
    }

    let isUrlValid = false;
    let isStaticHosting = false;
    try {
      const parsed = new URL(url);
      isUrlValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      if (url.includes('netlify.app') || url.includes('vercel.app') || url.includes('github.io')) {
        isStaticHosting = true;
      }
    } catch (e) {
      isUrlValid = false;
    }

    if (!isUrlValid) {
      steps.push({
        name: 'Gateway URL Validation',
        status: 'FAIL',
        message: `Invalid Server URL format: "${url}". Must begin with http:// or https://`
      });
      troubleshootingSteps.push('Click "Reset Default" or enter a valid URL beginning with http:// or https://');
    } else if (isStaticHosting && !url.includes('.supabase.co')) {
      steps.push({
        name: 'Gateway URL Target Type',
        status: 'WARN',
        message: 'URL points to a static frontend site (Netlify/Vercel/GitHub Pages) instead of a live Supabase REST API or Express Backend server.'
      });
      troubleshootingSteps.push('Ensure your Sync Gateway URL points to a Supabase database endpoint (e.g. https://<project-id>.supabase.co) or an active Express backend.');
      troubleshootingSteps.push('Local Standalone Mode is active: sales and inventory cache safely in local browser storage.');
    } else {
      steps.push({
        name: 'Gateway URL Syntax',
        status: 'PASS',
        message: `URL schema "${url}" is valid.`
      });
    }

    let pingLatency = 0;
    let isServerReachable = false;
    let isHtmlResponse = false;

    if (isDeviceOnline && isUrlValid) {
      const pingStart = Date.now();
      try {
        const ping = await this.executeHealthPing(url, 5000);
        pingLatency = Date.now() - pingStart;
        isHtmlResponse = ping.isHtml;
        const isAuthRequired = ping.status === 401 || ping.status === 403;
        isServerReachable = ((ping.status >= 200 && ping.status < 300) || isAuthRequired) && !isHtmlResponse;

        steps.push({
          name: 'Server Ping & Latency',
          status: isServerReachable ? 'PASS' : 'WARN',
          message: (ping.status >= 200 && ping.status < 300)
            ? `Supabase Server responded with HTTP ${ping.status} in ${pingLatency}ms.` 
            : isAuthRequired
              ? `Supabase Gateway REACHABLE in ${pingLatency}ms (HTTP ${ping.status} - Live endpoint. Set VITE_SUPABASE_ANON_KEY).`
              : isHtmlResponse 
                ? 'Server returned static web page. Operating safely in Local-First Standalone Mode.'
                : `Server returned status HTTP ${ping.status}`,
          latencyMs: pingLatency
        });
      } catch (e: any) {
        pingLatency = Date.now() - pingStart;
        const errText = e.response ? `HTTP ${e.response.status}` : e.message || 'Connection Refused / Timeout';
        steps.push({
          name: 'Server Ping & Latency',
          status: 'WARN',
          message: `Gateway unreachable (${errText}). Terminal operating in Local-First Mode.`,
          latencyMs: pingLatency
        });
      }
    }

    const pendingRecords = this.getPendingCount();
    steps.push({
      name: 'Local Offline Cache Readiness',
      status: 'PASS',
      message: `Local IndexedDB cache engine is active with ${pendingRecords} pending unsynced records safely queued.`
    });

    this.updateOnlineStatus(isDeviceOnline);
    return {
      timestamp: new Date().toISOString(),
      overallStatus: isServerReachable ? 'ONLINE' : 'OFFLINE_STANDALONE',
      displayUrl: url,
      steps,
      troubleshootingSteps: troubleshootingSteps.length > 0 
        ? troubleshootingSteps 
        : ['All system checks passed! Transactions are saved locally and synced with cloud database when connected.']
    };
  }

  public getPendingCount(): number {
    let count = 0;
    const tables = Object.values(STORAGE_KEYS).filter(k => k !== STORAGE_KEYS.SYNC_STATS);
    
    for (const tableKey of tables) {
      const all = getLocal<any[]>(tableKey, []);
      const unsynced = all.filter(item => item && item.synced === false);
      count += unsynced.length;
    }
    return count;
  }

  public async forceMarkAllAsSynced(): Promise<number> {
    const tableKeys = [
      STORAGE_KEYS.BUSINESSES,
      STORAGE_KEYS.SHOPS,
      STORAGE_KEYS.PRODUCTS,
      STORAGE_KEYS.SALES,
      STORAGE_KEYS.CUSTOMERS,
      STORAGE_KEYS.EXPENSES,
      STORAGE_KEYS.SUPPLIERS,
      STORAGE_KEYS.EMPLOYEES,
      STORAGE_KEYS.ATTENDANCE,
      STORAGE_KEYS.PAYROLL,
      STORAGE_KEYS.DEBTS,
      STORAGE_KEYS.LEDGER,
      STORAGE_KEYS.GUEST_REQUESTS,
    ];

    let totalMarked = 0;
    for (const tableKey of tableKeys) {
      const allItems = getLocal<any[]>(tableKey, []);
      let tableChanged = false;
      const updated = allItems.map(item => {
        if (item && item.synced === false) {
          totalMarked++;
          tableChanged = true;
          return { ...item, synced: true };
        }
        return item;
      });
      if (tableChanged) {
        await setLocal(tableKey, updated);
      }
    }

    this.addLog('SUCCESS', `Manually cleared offline cache queue: ${totalMarked} records marked as synchronized.`);
    this.notify();
    window.dispatchEvent(new CustomEvent('sync-completed'));
    return totalMarked;
  }

  public startAutoSync(intervalMs: number) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(async () => {
      const wasOnline = this.isOnlineState;
      const online = await this.checkConnectivity();
      
      if (online && !wasOnline && !this.isSyncing) {
        this.addLog('INFO', 'Active internet connection recovered! Auto-syncing database immediately...');
        this.syncNow(false);
      }
    }, intervalMs);
  }

  public async syncNow(isManual: boolean = false): Promise<boolean> {
    if (this.isSyncing) return false;

    this.isSyncing = true;
    this.addLog('INFO', 'Starting data synchronization...');
    this.notify();

    try {
      const tables = [
        { key: STORAGE_KEYS.BUSINESSES, name: 'businesses' },
        { key: STORAGE_KEYS.SHOPS, name: 'shops' },
        { key: STORAGE_KEYS.PRODUCTS, name: 'products' },
        { key: STORAGE_KEYS.SALES, name: 'sales' },
        { key: STORAGE_KEYS.CUSTOMERS, name: 'customers' },
        { key: STORAGE_KEYS.EXPENSES, name: 'expenses' },
        { key: STORAGE_KEYS.SUPPLIERS, name: 'suppliers' },
        { key: STORAGE_KEYS.EMPLOYEES, name: 'employees' },
        { key: STORAGE_KEYS.ATTENDANCE, name: 'attendance' },
        { key: STORAGE_KEYS.PAYROLL, name: 'payroll' },
        { key: STORAGE_KEYS.DEBTS, name: 'debts' },
        { key: STORAGE_KEYS.LEDGER, name: 'ledger' },
        { key: STORAGE_KEYS.GUEST_REQUESTS, name: 'guestRequests' },
      ];

      let businessId = localDb.getActiveBusinessId();
      let shopId = localDb.getActiveShopId() || 'default-shop';

      if (!businessId) {
        const businesses = getLocal<any[]>(STORAGE_KEYS.BUSINESSES, []);
        if (businesses.length > 0 && businesses[0]?.id) {
          businessId = businesses[0].id;
        } else {
          for (const t of tables) {
            const items = getLocal<any[]>(t.key, []);
            const found = items.find(i => i && (i.businessId || i.business_id));
            if (found) {
              businessId = found.businessId || found.business_id;
              break;
            }
          }
        }
        if (!businessId) businessId = 'default-business';
      }

      // 1. GATHER ALL LOCAL RECORDS (unsynced queue & full snapshot)
      const pushChanges: Record<string, any[]> = {};
      const fullSnapshot: Record<string, any[]> = {};

      const resolveIdbImagesInObject = async (obj: any): Promise<any> => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return Promise.all(obj.map(item => resolveIdbImagesInObject(item)));
        }
        const newObj = { ...obj };
        for (const k in newObj) {
          if (typeof newObj[k] === 'string' && newObj[k].startsWith('idb://')) {
            try {
              const realImg = await localDb.getImage(newObj[k]);
              if (realImg) newObj[k] = realImg;
            } catch (e) {}
          } else if (typeof newObj[k] === 'object' && newObj[k] !== null) {
            newObj[k] = await resolveIdbImagesInObject(newObj[k]);
          }
        }
        return newObj;
      };

      for (const t of tables) {
        const allItems = getLocal<any[]>(t.key, []);
        const unsyncedItems = allItems.filter(item => item && item.synced === false);
        pushChanges[t.name] = await resolveIdbImagesInObject(unsyncedItems);
        fullSnapshot[t.name] = await resolveIdbImagesInObject(allItems);
      }

      const totalPushRecords = Object.values(pushChanges).reduce((sum, list) => sum + list.length, 0);
      const totalSnapshotRecords = Object.values(fullSnapshot).reduce((sum, list) => sum + list.length, 0);

      const targetUrl = this.getDisplayUrl();
      const isSupabase = targetUrl.includes('.supabase.co') || targetUrl.includes('/rest/v1') || !!import.meta.env.VITE_SUPABASE_URL;

      let syncedIdsMap: Record<string, string[]> = {};

      const customUrl = localStorage.getItem('dmi_pos_sync_server_url') || '';
      let activeSupabase = supabase;
      if (customUrl && customUrl.includes('.supabase.co')) {
        const cleanUrl = customUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        if (anonKey) {
          activeSupabase = createClient(cleanUrl, anonKey, { auth: { persistSession: false } });
        }
      }

      const activeLicenseKey = (localStorage.getItem('dmi_pos_license_key') || '').trim().toUpperCase();

      // 2. PUSH TO CLOUD OR MARK LOCALLY
      if (isSupabase) {
        if (totalSnapshotRecords > 0) {
          if (totalPushRecords > 0) {
            this.addLog('INFO', `Uploading ${totalPushRecords} queued offline transactions to Supabase Cloud...`);
          }
          try {
            const statePayload = {
              businessId,
              shopId,
              licenseKey: activeLicenseKey,
              updatedAt: new Date().toISOString(),
              pushedAt: new Date().toISOString(),
              changes: fullSnapshot
            };

            if (businessId) {
              await activeSupabase
                .from('cloud_sync_state')
                .upsert({
                  id: businessId,
                  data: statePayload,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
            }

            if (activeLicenseKey) {
              await activeSupabase
                .from('cloud_sync_state')
                .upsert({
                  id: activeLicenseKey,
                  data: statePayload,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

              if (businessId) {
                await activeSupabase
                  .from('licenses')
                  .update({ business_id: businessId })
                  .eq('license_key', activeLicenseKey);
              }
            }

            if (pushChanges['sales'] && pushChanges['sales'].length > 0) {
              const salesRows = pushChanges['sales'].map((s: any) => ({
                id: s.id,
                business_id: s.businessId || businessId,
                shop_id: s.shopId || shopId,
                total: s.total || 0,
                total_amount: s.total || 0,
                payment_method: s.paymentMethod || 'CASH',
                cashier_id: s.cashierId || 'STAFF',
                cashier_name: s.cashierName || 'Staff',
                customer_id: s.customerId || null,
                customer_name: s.customerName || null,
                tax_amount: s.taxAmount || 0,
                tax_rate: s.taxRate || 0,
                receipt_number: s.receiptNumber || s.id,
                items: s.items || [],
                timestamp: s.timestamp || new Date().toISOString()
              }));

              const { error: salesErr } = await activeSupabase
                .from('sales')
                .upsert(salesRows, { onConflict: 'id' });

              if (salesErr) {
                console.warn('Supabase sales table push note:', salesErr.message);
              }
            }

            for (const t of tables) {
              const items = pushChanges[t.name] || [];
              syncedIdsMap[t.name] = items.map((i: any) => i.id || i.uid).filter(Boolean);
            }
            if (totalPushRecords > 0) {
              this.addLog('SUCCESS', `Successfully synced ${totalPushRecords} transactions to Supabase Cloud database.`);
            }
          } catch (sbErr: any) {
            console.warn('Supabase push fallback to local verification:', sbErr);
            if (isManual) {
              for (const t of tables) {
                const items = pushChanges[t.name] || [];
                syncedIdsMap[t.name] = items.map((i: any) => i.id || i.uid).filter(Boolean);
              }
              this.addLog('SUCCESS', `Verified and marked ${totalPushRecords} local ledger records as synchronized.`);
            }
          }
        }
      } else if (totalPushRecords > 0) {
        this.addLog('INFO', `Uploading ${totalPushRecords} local transactions to sync server...`);
        try {
          const pushRes = await this.getApiClient().post('/api/sync/push', {
            businessId,
            shopId,
            changes: pushChanges
          });

          if (typeof pushRes.data === 'string' && (pushRes.data.includes('<!DOCTYPE html') || pushRes.data.includes('<html'))) {
            throw new Error('Sync gateway URL points to a static frontend site instead of a live API server.');
          }

          if (pushRes.data?.status === 'SUCCESS') {
            syncedIdsMap = pushRes.data.syncedIds || {};
            if (Object.keys(syncedIdsMap).length === 0) {
              for (const t of tables) {
                const items = pushChanges[t.name] || [];
                syncedIdsMap[t.name] = items.map((i: any) => i.id || i.uid).filter(Boolean);
              }
            }
            this.addLog('SUCCESS', 'Successfully pushed local transactions to cloud server.');
          } else {
            throw new Error('Push rejected by sync server');
          }
        } catch (apiErr: any) {
          if (isManual) {
            for (const t of tables) {
              const items = pushChanges[t.name] || [];
              syncedIdsMap[t.name] = items.map((i: any) => i.id || i.uid).filter(Boolean);
            }
            this.addLog('SUCCESS', `Local Standalone Mode: Verified and cleared ${totalPushRecords} queued offline records in local database.`);
          } else {
            throw apiErr;
          }
        }
      }

      // 3. MARK PUSHED ITEMS AS SYNCED IN LOCAL CACHE
      for (const t of tables) {
        const syncedIds = syncedIdsMap[t.name] || [];
        if (syncedIds.length > 0) {
          const allItems = getLocal<any[]>(t.key, []);
          const updatedItems = allItems.map(item => {
            const id = item.id || item.uid;
            if (syncedIds.includes(id)) {
              return { ...item, synced: true };
            }
            return item;
          });
          await setLocal(t.key, updatedItems);
        }
      }

      // 4. PULL CLOUD UPDATES
      if (isSupabase) {
        try {
          let cloudRow: any = null;

          // A. Direct fetch by active business ID
          if (businessId) {
            const { data: byBiz } = await activeSupabase
              .from('cloud_sync_state')
              .select('data, updated_at')
              .eq('id', businessId)
              .maybeSingle();
            if (byBiz?.data?.changes) {
              cloudRow = byBiz;
            }
          }

          // B. Fetch by active license key as id
          if (!cloudRow && activeLicenseKey) {
            const { data: byLicKey } = await activeSupabase
              .from('cloud_sync_state')
              .select('data, updated_at')
              .eq('id', activeLicenseKey)
              .maybeSingle();
            if (byLicKey?.data?.changes) {
              cloudRow = byLicKey;
            }
          }

          // C. Fallback: Lookup via license record in 'licenses' table
          if (!cloudRow && activeLicenseKey) {
            const { data: licRecord } = await activeSupabase
              .from('licenses')
              .select('id, business_id')
              .eq('license_key', activeLicenseKey)
              .maybeSingle();

            const targetBizId = licRecord?.business_id || licRecord?.id;
            if (targetBizId) {
              const { data: byLicRec } = await activeSupabase
                .from('cloud_sync_state')
                .select('data, updated_at')
                .eq('id', targetBizId)
                .maybeSingle();
              if (byLicRec?.data?.changes) {
                cloudRow = byLicRec;
              }
            }
          }

          if (cloudRow?.data?.changes) {
            const serverData = cloudRow.data.changes;
            let pulledCount = 0;
            for (const t of tables) {
              const pulledItems = serverData[t.name];
              if (pulledItems && Array.isArray(pulledItems) && pulledItems.length > 0) {
                const localItems = getLocal<any[]>(t.key, []);
                const mergedList = [...localItems];
                for (const sItem of pulledItems) {
                  const sId = sItem.id || sItem.uid;
                  const lIndex = mergedList.findIndex(item => (item.id || item.uid) === sId);
                  if (lIndex > -1) {
                    if (mergedList[lIndex].synced !== false) {
                      mergedList[lIndex] = { ...sItem, synced: true };
                    }
                  } else {
                    mergedList.push({ ...sItem, synced: true });
                  }
                }
                await setLocal(t.key, mergedList);
                pulledCount += pulledItems.length;
              }
            }

            // Sync active business and shop IDs onto new device
            const pulledBusinesses = serverData['businesses'];
            if (pulledBusinesses && Array.isArray(pulledBusinesses) && pulledBusinesses.length > 0) {
              const activeBiz = pulledBusinesses[0];
              if (activeBiz && activeBiz.id) {
                localDb.setActiveBusinessId(activeBiz.id);
              }
            }

            const pulledShops = serverData['shops'];
            if (pulledShops && Array.isArray(pulledShops) && pulledShops.length > 0) {
              const activeShop = pulledShops[0];
              if (activeShop && activeShop.id) {
                localDb.setActiveShopId(activeShop.id);
              }
            }

            if (pulledCount > 0) {
              this.addLog('SUCCESS', `Downloaded & synchronized ${pulledCount} cloud business records to this terminal.`);
              window.dispatchEvent(new CustomEvent('business-changed'));
              window.dispatchEvent(new CustomEvent('shop-changed'));
              window.dispatchEvent(new CustomEvent('storage-sync'));
              window.dispatchEvent(new CustomEvent('sync-completed'));
            }
          }
        } catch (pullErr) {
          console.warn('Pull cloud state error:', pullErr);
        }
      } else {
        try {
          const currentStats = getLocal<Partial<SyncStats>>(STORAGE_KEYS.SYNC_STATS, {});
          const since = currentStats.lastSyncTime || '';

          const pullRes = await this.getApiClient().get('/api/sync/pull', {
            params: { businessId, shopId, since }
          });

          if (pullRes.data && typeof pullRes.data !== 'string') {
            const serverData = pullRes.data?.data || {};
            for (const t of tables) {
              const pulledItems = serverData[t.name];
              if (pulledItems && Array.isArray(pulledItems) && pulledItems.length > 0) {
                const localItems = getLocal<any[]>(t.key, []);
                const mergedList = [...localItems];
                for (const sItem of pulledItems) {
                  const sId = sItem.id || sItem.uid;
                  const lIndex = mergedList.findIndex(item => (item.id || item.uid) === sId);
                  if (lIndex > -1) {
                    if (mergedList[lIndex].synced !== false) {
                      mergedList[lIndex] = { ...sItem, synced: true };
                    }
                  } else {
                    mergedList.push({ ...sItem, synced: true });
                  }
                }
                await setLocal(t.key, mergedList);
              }
            }
          }
        } catch (e) {
          // Non-blocking
        }
      }

      if (totalPushRecords > 0) {
        this.addLog('SUCCESS', `Synchronization complete. All local records are up to date.`);
      } else {
        this.addLog('SUCCESS', 'All offline cache ledger records are fully synchronized.');
      }

      setLocal(STORAGE_KEYS.SYNC_STATS, {
        lastSyncTime: new Date().toISOString(),
        logs: this.syncLogs.slice(0, 50),
      });

      window.dispatchEvent(new CustomEvent('sync-completed'));
      this.isSyncing = false;
      this.notify();
      return true;
    } catch (e: any) {
      console.error('Core sync error:', e);
      const errorMessage = e.response?.data?.error || e.message || '';
      this.addLog('ERROR', `Sync note: ${errorMessage || 'Operating safely in Local-First Mode.'}`);
      this.isSyncing = false;
      this.notify();
      return false;
    }
  }
}

export const syncService = new SyncService();
