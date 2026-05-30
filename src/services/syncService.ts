import { localDb, getLocal, setLocal } from './localDb';
import axios from 'axios';

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
    // This allows browser cookies, auth headers, and same-origin policies to pass seamlessly without triggering 403 Forbidden on sandboxed gateways.
    if (window.location.protocol !== 'file:') {
      try {
        const originUrl = new URL(url);
        // Compare hosts
        if (originUrl.host === window.location.host) {
          return '';
        }
      } catch (e) {
        // Fallback for relative paths or invalid URL formats
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
    if (window.location.protocol === 'file:') {
      return 'https://ais-pre-kayb6z7vprmlkln2iwpxb5-430844239449.europe-west2.run.app';
    }
    return window.location.origin;
  }

  public setBaseUrl(url: string) {
    let clean = url.trim();
    if (!clean) {
      localStorage.removeItem('dmi_pos_sync_server_url');
      // Clear legacy error logs when resetting so the interface is perfectly clean
      this.syncLogs = this.syncLogs.filter(log => log.type !== 'ERROR');
      this.addLog('INFO', `Sync backend server gateway reset to default: ${this.getDisplayUrl()}`);
      this.checkConnectivity();
      return;
    }

    // Detect if they explicitly wanted https (contains 'https' in the starting part)
    const isSecure = /https/i.test(clean.substring(0, 20));

    // Clean up nested protocols, mistyped slashes and colons (e.g., "http://https//:dmipos.netlify.app")
    // Replace leading scheme/protocols recursively
    let hostPart = clean;
    for (let i = 0; i < 3; i++) {
      hostPart = hostPart.replace(/^(https?|http|ftp|file)[\s:/\\+]+/i, '');
    }
    // Remove any remaining leading/trailing colons, slashes, or whitespace
    hostPart = hostPart.replace(/^[:/\\ ]+/, '').replace(/[:/\\ ]+$/, '');

    // Reconstruct valid URL
    const sanitized = (isSecure ? 'https://' : 'http://') + hostPart;
    
    // Clear legacy error logs when switching URLs
    this.syncLogs = this.syncLogs.filter(log => log.type !== 'ERROR');
    localStorage.setItem('dmi_pos_sync_server_url', sanitized);
    this.addLog('INFO', `Sync backend server gateway set to: ${sanitized}`);
    this.checkConnectivity();
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
    // Check initial online status
    await this.checkConnectivity();

    // Listen to browser network changes
    window.addEventListener('online', () => {
      this.updateOnlineStatus(true);
      this.addLog('INFO', 'Network connection detected. Scheduling automatic sync...');
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatus(false);
      this.addLog('INFO', 'Offline terminal mode activated. Transactions will cache locally.');
    });

    // Load logs from cache if available
    const cachedStats = getLocal<Partial<SyncStats>>(STORAGE_KEYS.SYNC_STATS, {});
    if (cachedStats.logs) {
      this.syncLogs = cachedStats.logs;
    }

    // Start background syncing loop (every 30 seconds is standard and prevents infinite loop congestions)
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
    // Cache the stats (excluding listeners)
    setLocal(STORAGE_KEYS.SYNC_STATS, {
      lastSyncTime: stats.lastSyncTime,
      logs: this.syncLogs.slice(0, 50), // Limit log history
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

  public async checkConnectivity(): Promise<boolean> {
    // If browser/device states indicate offline, respect it immediately to bypass unnecessary network timeouts
    if (!navigator.onLine) {
      this.updateOnlineStatus(false);
      this.lastConnectionError = 'Device feels offline (navigator.onLine is false)';
      return false;
    }

    try {
      const response = await this.getApiClient().get('/api/health', { timeout: 4000 });
      const online = response.status === 200;
      this.updateOnlineStatus(online);
      if (online) {
        this.lastConnectionError = '';
      } else {
        this.lastConnectionError = `Server returned status ${response.status}`;
      }
      return online;
    } catch (e: any) {
      this.updateOnlineStatus(false);
      this.lastConnectionError = e.response
        ? `HTTP ${e.response.status}: ${e.response.statusText || 'Error response'}`
        : e.message || 'API Timeout / Connection Refused';
      console.warn('Connectivity healthcheck failed for URL:', this.getDisplayUrl(), this.lastConnectionError);
      return false;
    }
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

  public startAutoSync(intervalMs: number) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(async () => {
      const wasOnline = this.isOnlineState;
      const online = await this.checkConnectivity();
      
      // If we just transitioned/recovered from offline to online, immediately trigger a full database synchronization!
      if (online && !wasOnline && !this.isSyncing) {
        this.addLog('INFO', 'Active internet connection recovered! Auto-syncing database immediately...');
        this.syncNow(false);
        return;
      }

      // Standard periodic background sync if we have pending records to push
      if (online && this.getPendingCount() > 0 && !this.isSyncing) {
        this.addLog('INFO', 'Background auto-sync triggered...');
        this.syncNow(false);
      }
    }, intervalMs);
  }

  public async syncNow(isManual: boolean = false): Promise<boolean> {
    if (this.isSyncing) return false;
    
    const online = await this.checkConnectivity();
    if (!online) {
      const reason = this.lastConnectionError ? ` - ${this.lastConnectionError}` : '';
      const hasCustomUrl = !!localStorage.getItem('dmi_pos_sync_server_url');
      
      // Only log sync failures as screaming errors under manual user clicks OR when a custom URL is explicitly set.
      if (isManual || hasCustomUrl) {
        this.addLog('ERROR', `Sync failed: Server URL (${this.getDisplayUrl()}) is unreachable${reason}. Check connection or configure server url.`);
      } else {
        console.log('Background sync bypassed: Local terminal is operating offline.');
      }
      return false;
    }

    const businessId = localDb.getActiveBusinessId();
    const shopId = localDb.getActiveShopId();
    if (!businessId) {
      // Nothing to sync yet
      return false;
    }

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

      // 1. GATHER ALL LOCAL UNSYNCED REC_ARDS
      const pushChanges: Record<string, any[]> = {};
      
      for (const t of tables) {
        const allItems = getLocal<any[]>(t.key, []);
        pushChanges[t.name] = allItems.filter(item => item && item.synced === false);
      }

      const totalPushRecords = Object.values(pushChanges).reduce((sum, list) => sum + list.length, 0);

      // 2. PUSH TO SERVER
      let syncedIdsMap: Record<string, string[]> = {};
      if (totalPushRecords > 0) {
        this.addLog('INFO', `Uploading ${totalPushRecords} local transactions and edits to cloud...`);
        const pushRes = await this.getApiClient().post('/api/sync/push', {
          businessId,
          shopId,
          changes: pushChanges
        });
        
        // Check if response is HTML (which happens on static servers like Netlify)
        if (typeof pushRes.data === 'string' && (pushRes.data.includes('<!DOCTYPE html') || pushRes.data.includes('<html'))) {
          throw new Error('Sync gateway URL points to a static frontend site (like Netlify) instead of a live API server backend. Reset default or specify a real Node API URL.');
        }

        if (pushRes.data?.status === 'SUCCESS') {
          syncedIdsMap = pushRes.data.syncedIds || {};
          this.addLog('SUCCESS', 'Successfully pushed local transactions to cloud.');
        } else {
          throw new Error('Push rejected by sync server');
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

      // 4. PULL FROM SERVER (INCREMENTAL WITH SINCE TIMESTAMP)
      const currentStats = getLocal<Partial<SyncStats>>(STORAGE_KEYS.SYNC_STATS, {});
      const since = currentStats.lastSyncTime || '';
      
      this.addLog('INFO', `Pulling cloud updates since ${since || 'creation'}...`);
      const pullRes = await this.getApiClient().get('/api/sync/pull', {
        params: { businessId, shopId, since }
      });

      // Check if response is HTML (which happens on static servers like Netlify)
      if (typeof pullRes.data === 'string' && (pullRes.data.includes('<!DOCTYPE html') || pullRes.data.includes('<html'))) {
        throw new Error('Sync gateway URL points to a static frontend site (like Netlify) instead of a live API server backend. Reset default or specify a real Node API URL.');
      }

      const serverData = pullRes.data?.data || {};
      const newSyncTimestamp = pullRes.data?.timestamp || new Date().toISOString();
      let totalPullRecords = 0;

      // 5. MERGE PULLED ITEMS WITH LOCAL CACHE
      for (const t of tables) {
        const pulledItems = serverData[t.name];
        if (pulledItems && Array.isArray(pulledItems) && pulledItems.length > 0) {
          totalPullRecords += pulledItems.length;
          const localItems = getLocal<any[]>(t.key, []);
          
          const mergedList = [...localItems];

          for (const sItem of pulledItems) {
            const sId = sItem.id || sItem.uid;
            const lIndex = mergedList.findIndex(item => (item.id || item.uid) === sId);

            if (lIndex > -1) {
              const localItem = mergedList[lIndex];
              
              // Only merge if server has a newer timestamp AND local is synced
              // If local is unsynced, we don't overwrite it here (it will push on next sync run)
              const localTime = localItem.lastUpdated ? new Date(localItem.lastUpdated).getTime() : 0;
              const serverTime = sItem.lastUpdated ? new Date(sItem.lastUpdated).getTime() : 0;

              if (localItem.synced !== false && serverTime >= localTime) {
                mergedList[lIndex] = { ...sItem, synced: true };
              }
            } else {
              // Not present locally, safe to add
              mergedList.push({ ...sItem, synced: true });
            }
          }

          await setLocal(t.key, mergedList);
        }
      }

      if (totalPullRecords > 0) {
        this.addLog('SUCCESS', `Successfully synced and updated local terminal database with ${totalPullRecords} cloud records.`);
      } else {
        this.addLog('SUCCESS', 'All data is up to date with cloud server.');
      }

      // 6. RECORD SUCCESSFUL SYNC TIMESTAMP
      setLocal(STORAGE_KEYS.SYNC_STATS, {
        lastSyncTime: newSyncTimestamp,
        logs: this.syncLogs.slice(0, 50),
      });

      // Dispatch a general refresh event
      window.dispatchEvent(new CustomEvent('sync-completed'));
      
      this.isSyncing = false;
      this.notify();
      return true;
    } catch (e: any) {
      console.error('Core sync error:', e);
      this.addLog('ERROR', `Error during sync: ${e.response?.data?.error || e.message}`);
      this.isSyncing = false;
      this.notify();
      return false;
    }
  }
}

export const syncService = new SyncService();
