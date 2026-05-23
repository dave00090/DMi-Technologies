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
};

class SyncService {
  private isOnlineState: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncLogs: SyncLog[] = [];
  private listeners: Set<(stats: SyncStats) => void> = new Set();
  private intervalId: any = null;

  public getBaseUrl(): string {
    const saved = localStorage.getItem('dmi_pos_sync_server_url');
    if (saved) return saved;
    
    // Auto fallback for packaged Electron apps loaded on file:// protocol
    if (window.location.protocol === 'file:') {
      return 'https://ais-pre-kayb6z7vprmlkln2iwpxb5-430844239449.europe-west2.run.app';
    }
    
    // Normal browser or local dev fallback
    return window.location.origin;
  }

  public setBaseUrl(url: string) {
    let sanitized = url.trim();
    if (sanitized && !sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
      sanitized = 'http://' + sanitized;
    }
    sanitized = sanitized.replace(/\/+$/, ''); // Remove trailing slashes
    
    if (sanitized) {
      localStorage.setItem('dmi_pos_sync_server_url', sanitized);
    } else {
      localStorage.removeItem('dmi_pos_sync_server_url');
    }
    this.addLog('INFO', `Sync backend server gateway set to: ${sanitized || this.getBaseUrl()}`);
    this.checkConnectivity();
  }

  private getApiClient() {
    return axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 10000
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

    // Start background syncing loop (every 30 seconds)
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
    if (!navigator.onLine) {
      this.updateOnlineStatus(false);
      return false;
    }

    try {
      const response = await this.getApiClient().get('/api/health', { timeout: 4000 });
      const online = response.status === 200;
      this.updateOnlineStatus(online);
      return online;
    } catch (e) {
      this.updateOnlineStatus(false);
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
      const online = await this.checkConnectivity();
      if (online && this.getPendingCount() > 0 && !this.isSyncing) {
        this.addLog('INFO', 'Background auto-sync triggered...');
        this.syncNow();
      }
    }, intervalMs);
  }

  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) return false;
    
    const online = await this.checkConnectivity();
    if (!online) {
      this.addLog('ERROR', 'Sync failed: Server is unreachable. Check your internet connection.');
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
