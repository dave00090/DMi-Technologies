import { localDb } from './localDb';

export interface BackupRecord {
  id: string;
  filename: string;
  timestamp: string;
  recordCount: number;
  dataSize: number;
}

export const backupEngine = {
  // Get all automated backups currently saved in local IndexedDB
  getBackups: (): BackupRecord[] => {
    try {
      const raw = localStorage.getItem('dmi_pos_automated_backups_list');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  // Save the list of backups
  saveBackupsList: (list: BackupRecord[]) => {
    try {
      localStorage.setItem('dmi_pos_automated_backups_list', JSON.stringify(list));
    } catch (e) {}
  },

  // Generate the unified backup payload containing all offline tables
  generateBackupPayload: async () => {
    const activeBizId = localDb.getActiveBusinessId() || 'DEFAULT_BUSINESS';
    
    // Retrieve all local store datasets
    const sales = await localDb.getSales(activeBizId);
    const products = await localDb.getProducts(activeBizId, localDb.getActiveShopId() || '');
    const customers = await localDb.getCustomers(activeBizId);
    const expenses = localDb.getExpenses(activeBizId);
    const suppliers = localDb.getSuppliers(activeBizId);
    const employees = localDb.getEmployees(activeBizId);
    const attendance = localDb.getAllAttendance();
    const debts = localDb.getAllDebts(activeBizId);
    const alerts = localDb.getAlerts(activeBizId, localDb.getActiveShopId() || '');
    const businesses = localDb.getBusinesses();
    const shops = localDb.getShops(activeBizId);

    // Calculate total item count
    const totalRecords = 
      sales.length + 
      products.length + 
      customers.length + 
      expenses.length + 
      suppliers.length + 
      employees.length + 
      attendance.length + 
      debts.length + 
      alerts.length;

    const timestamp = new Date().toISOString();
    
    const payload = {
      appName: 'DMi POS Client Backup',
      version: '3.0.0-DesktopLocal',
      timestamp,
      businessId: activeBizId,
      databaseSnapshot: {
        businesses,
        shops,
        products,
        sales,
        customers,
        expenses,
        suppliers,
        employees,
        attendance,
        debts,
        alerts
      },
      metadata: {
        totalRecords,
        deviceUserAgent: navigator.userAgent,
        backupType: 'AUTOMATIC_24H'
      }
    };

    return { payload, totalRecords, timestamp };
  },

  // Perform a local backup download file
  triggerBackupDownload: async (isManual: boolean = false) => {
    try {
      const { payload, totalRecords, timestamp } = await backupEngine.generateBackupPayload();
      
      // Formulate DMi POS clean timestamp filename
      const formattedDate = new Date(timestamp).toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      
      const filename = `DMi_POS_Backup_${formattedDate}.json`;
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // We can trigger an actual browser file download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Add to backups log
      const currentList = backupEngine.getBackups();
      const newBackup: BackupRecord = {
        id: crypto.randomUUID(),
        filename,
        timestamp,
        recordCount: totalRecords,
        dataSize: Math.round(jsonString.length / 1024) // Size in KB
      };
      
      // Keep last 30 backups in log
      const updatedList = [newBackup, ...currentList].slice(0, 30);
      backupEngine.saveBackupsList(updatedList);
      
      // Save last backup time in localStorage to compute next 24 hour window
      localStorage.setItem('dmi_pos_last_backup_time', timestamp);
      
      // Emit update event
      window.dispatchEvent(new CustomEvent('dmi-backup-completed', { detail: newBackup }));
      console.log(`[BACKUP ENGINE] Automated 24h backup completed: ${filename} with ${totalRecords} records.`);
      
      return newBackup;
    } catch (e) {
      console.error('[BACKUP ENGINE] Failed to trigger automatic backup:', e);
      return null;
    }
  },

  // Background auto-backup scheduler checker (runs on App Boot)
  checkAndRunScheduledBackup: async () => {
    try {
      const activeBizId = localDb.getActiveBusinessId();
      if (!activeBizId) return; // Only backup if business setup is activated

      const lastBackupRaw = localStorage.getItem('dmi_pos_last_backup_time');
      const now = new Date();

      if (!lastBackupRaw) {
        // First boot backup trigger setup
        console.log('[BACKUP ENGINE] First-time backup timestamp initialized.');
        localStorage.setItem('dmi_pos_last_backup_time', now.toISOString());
        return;
      }

      const lastBackupDate = new Date(lastBackupRaw);
      const timeDifference = now.getTime() - lastBackupDate.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000; // in milliseconds

      if (timeDifference >= twentyFourHours) {
        console.log('[BACKUP ENGINE] 24 Hours window exceeded! Triggering scheduled backup...');
        await backupEngine.triggerBackupDownload(false);
      } else {
        const nextBackupInHours = ((twentyFourHours - timeDifference) / (1000 * 60 * 60)).toFixed(1);
        console.log(`[BACKUP ENGINE] Next scheduled automatic backup in ${nextBackupInHours} hours.`);
      }
    } catch (e) {
      console.error('[BACKUP ENGINE] Error checking backup schedule:', e);
    }
  },

  // Automatically purges transactional logs older than 3 years
  purgeDataOlderThanThreeYears: async (): Promise<{ purgedCount: number; tablesAffected: string[] }> => {
    try {
      const activeBizId = localDb.getActiveBusinessId();
      if (!activeBizId) return { purgedCount: 0, tablesAffected: [] };

      const now = new Date();
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(now.getFullYear() - 3);

      console.log(`[RETENTION POLICY] Commencing database retention purge check. Threshold date: ${threeYearsAgo.toLocaleDateString()}`);

      let purgedCount = 0;
      const tablesAffected: string[] = [];

      // 1. Purge Sales Older Than 3 Years
      const salesRaw = localStorage.getItem('dmi_pos_sales');
      if (salesRaw && salesRaw !== '__idb_ref__') {
        try {
          const sales: any[] = JSON.parse(salesRaw);
          const initialLength = sales.length;
          const filteredSales = sales.filter(s => new Date(s.timestamp) >= threeYearsAgo);
          const diff = initialLength - filteredSales.length;
          if (diff > 0) {
            await localStorage.setItem('dmi_pos_sales', JSON.stringify(filteredSales));
            purgedCount += diff;
            tablesAffected.push('sales');
          }
        } catch (e) {}
      }

      // 2. Purge Expenses Older Than 3 Years
      const expensesRaw = localStorage.getItem('dmi_pos_expenses');
      if (expensesRaw && expensesRaw !== '__idb_ref__') {
        try {
          const expenses: any[] = JSON.parse(expensesRaw);
          const initialLength = expenses.length;
          const filteredExpenses = expenses.filter(e => new Date(e.date) >= threeYearsAgo);
          const diff = initialLength - filteredExpenses.length;
          if (diff > 0) {
            await localStorage.setItem('dmi_pos_expenses', JSON.stringify(filteredExpenses));
            purgedCount += diff;
            tablesAffected.push('expenses');
          }
        } catch (e) {}
      }

      // 3. Purge Employee Attendance Logs Older Than 3 Years
      const attendanceRaw = localStorage.getItem('dmi_pos_attendance');
      if (attendanceRaw && attendanceRaw !== '__idb_ref__') {
        try {
          const attendance: any[] = JSON.parse(attendanceRaw);
          const initialLength = attendance.length;
          const filteredAttendance = attendance.filter(a => new Date(a.date) >= threeYearsAgo);
          const diff = initialLength - filteredAttendance.length;
          if (diff > 0) {
            await localStorage.setItem('dmi_pos_attendance', JSON.stringify(filteredAttendance));
            purgedCount += diff;
            tablesAffected.push('employee_attendance');
          }
        } catch (e) {}
      }

      // 4. Purge Piracy Alerts / System Logs Older Than 3 Years
      const alertsRaw = localStorage.getItem('dmi_pos_alerts');
      if (alertsRaw && alertsRaw !== '__idb_ref__') {
        try {
          const alerts: any[] = JSON.parse(alertsRaw);
          const initialLength = alerts.length;
          const filteredAlerts = alerts.filter(a => {
            const date = a.lastUpdated ? new Date(a.lastUpdated) : now;
            return date >= threeYearsAgo;
          });
          const diff = initialLength - filteredAlerts.length;
          if (diff > 0) {
            await localStorage.setItem('dmi_pos_alerts', JSON.stringify(filteredAlerts));
            purgedCount += diff;
            tablesAffected.push('piracy_alerts');
          }
        } catch (e) {}
      }

      // 5. Purge Login History logs older than 3 years
      const loginHistoryRaw = localStorage.getItem('dmi_pos_login_history');
      if (loginHistoryRaw) {
        try {
          const logs: any[] = JSON.parse(loginHistoryRaw);
          const initialLength = logs.length;
          const filteredLogs = logs.filter(l => new Date(l.timestamp) >= threeYearsAgo);
          const diff = initialLength - filteredLogs.length;
          if (diff > 0) {
            await localStorage.setItem('dmi_pos_login_history', JSON.stringify(filteredLogs));
            purgedCount += diff;
            tablesAffected.push('login_history');
          }
        } catch (e) {}
      }

      if (purgedCount > 0) {
        console.log(`[RETENTION POLICY] Automatic data vacuum complete. Purged ${purgedCount} record(s) older than 3 years across [${tablesAffected.join(', ')}].`);
        // Dispatch event
        window.dispatchEvent(new CustomEvent('dmi-retention-purge', { detail: { purgedCount, tablesAffected } }));
      } else {
        console.log('[RETENTION POLICY] Commenced scan: No records older than 3 years found. Storage footprint healthy.');
      }

      return { purgedCount, tablesAffected };
    } catch (e) {
      console.error('[RETENTION POLICY] Purge execution failure:', e);
      return { purgedCount: 0, tablesAffected: [] };
    }
  }
};
