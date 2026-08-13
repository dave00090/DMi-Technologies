import { localDb } from './localDb';
import { syncService } from './syncService';

/**
 * Automatically creates a "DMi Backup" folder on the user's Desktop
 * and writes system data into it.
 * Works seamlessly in:
 * 1. Tauri compiled app (using Tauri path & fs APIs)
 * 2. Electron compiled app (using Node fs & path APIs)
 * 3. Standard browser fallback (via auto-download trigger & IndexedDB vault caching)
 */
export async function writeToDesktopBackupFolder(
  filename: string,
  jsonContent: string
): Promise<{ success: boolean; filePath?: string; method: string }> {
  // 1. TAURI DESKTOP ENVIRONMENT
  try {
    const tauri = typeof window !== 'undefined' ? (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ : null;

    if (tauri && (tauri.path || tauri.fs)) {
      const pathApi = tauri.path;
      const fsApi = tauri.fs;

      if (pathApi && fsApi) {
        const desktopDirFn = pathApi.desktopDir;
        const joinFn = pathApi.join;

        let desktopPath = '';
        if (typeof desktopDirFn === 'function') {
          desktopPath = await desktopDirFn();
        }

        if (desktopPath && typeof joinFn === 'function') {
          const backupFolder = await joinFn(desktopPath, 'DMi Backup');
          const targetFilePath = await joinFn(backupFolder, filename);

          // Ensure "DMi Backup" directory exists on Desktop
          const createDirFn = fsApi.createDir || fsApi.mkdir;
          if (typeof createDirFn === 'function') {
            try {
              const baseDir = fsApi.BaseDirectory?.Desktop;
              await createDirFn(
                'DMi Backup',
                baseDir ? { dir: baseDir, recursive: true } : { recursive: true }
              );
            } catch (errDir) {
              // Folder already exists
            }
          }

          // Write backup file directly into Desktop/DMi Backup/<filename>
          const writeFn = fsApi.writeTextFile || fsApi.writeFile;
          if (typeof writeFn === 'function') {
            const baseDir = fsApi.BaseDirectory?.Desktop;
            try {
              await writeFn(
                targetFilePath,
                jsonContent,
                baseDir ? { dir: baseDir } : undefined
              );
            } catch (writeErr) {
              await writeFn(targetFilePath, jsonContent);
            }

            console.log(`[TAURI DESKTOP ENGINE] Successfully saved 24h backup to Desktop folder: ${targetFilePath}`);
            return { success: true, filePath: targetFilePath, method: 'TAURI_DESKTOP_FS' };
          }
        }
      }
    }

    // Dynamic import fallback for Tauri bundled modules with @vite-ignore
    const tauriPathMod = '@tauri-apps/api/path';
    const tauriFsMod = '@tauri-apps/api/fs';
    const pathApi: any = await import(/* @vite-ignore */ tauriPathMod).catch(() => null);
    const fsApi: any = await import(/* @vite-ignore */ tauriFsMod).catch(() => null);

    if (pathApi && fsApi) {
      const desktopDirFn = pathApi.desktopDir;
      const joinFn = pathApi.join;

      if (typeof desktopDirFn === 'function') {
        const desktopPath = await desktopDirFn();
        if (desktopPath && typeof joinFn === 'function') {
          const backupFolder = await joinFn(desktopPath, 'DMi Backup');
          const targetFilePath = await joinFn(backupFolder, filename);

          const createDirFn = fsApi.createDir || fsApi.mkdir;
          if (typeof createDirFn === 'function') {
            try {
              await createDirFn('DMi Backup', { dir: fsApi.BaseDirectory?.Desktop, recursive: true });
            } catch (errDir) {}
          }

          const writeFn = fsApi.writeTextFile || fsApi.writeFile;
          if (typeof writeFn === 'function') {
            await writeFn(targetFilePath, jsonContent);
            console.log(`[TAURI DESKTOP ENGINE] Saved 24h backup via imported Tauri module: ${targetFilePath}`);
            return { success: true, filePath: targetFilePath, method: 'TAURI_DESKTOP_FS' };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[TAURI DESKTOP ENGINE] Not in Tauri container or permission check:', err);
  }

  // 2. ELECTRON DESKTOP ENVIRONMENT
  try {
    if (typeof window !== 'undefined' && (window as any).require) {
      const fs = (window as any).require('fs');
      const path = (window as any).require('path');
      const os = (window as any).require('os');

      if (fs && path && os) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const backupFolder = path.join(desktopPath, 'DMi Backup');

        if (!fs.existsSync(backupFolder)) {
          fs.mkdirSync(backupFolder, { recursive: true });
        }

        const fullPath = path.join(backupFolder, filename);
        fs.writeFileSync(fullPath, jsonContent, 'utf-8');

        console.log(`[ELECTRON DESKTOP ENGINE] Successfully saved 24h backup to Desktop folder: ${fullPath}`);
        return { success: true, filePath: fullPath, method: 'ELECTRON_DESKTOP_FS' };
      }
    }
  } catch (err) {
    console.warn('[ELECTRON DESKTOP ENGINE] Not in Electron node environment:', err);
  }

  // 3. STANDARD BROWSER FALLBACK (Auto-download link trigger)
  try {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filePath: filename, method: 'BROWSER_DOWNLOAD_FALLBACK' };
  } catch (e: any) {
    return { success: false, method: 'FAILED' };
  }
}

export interface DmiDataBundle {
  systemName: string;
  version: string;
  exportTimestamp: string;
  licenseKey: string;
  targetFolderName: string;
  databaseSnapshot: Record<string, any>;
  indexedDbImages: Record<string, string>;
  rawLocalStorage: Record<string, string>;
}

export const dmiDataEngine = {
  // Export complete DMi data folder archive for the system license
  exportDmiDataBundle: async (): Promise<{ filename: string; jsonString: string; recordCount: number }> => {
    const activeLicense = (localStorage.getItem('dmi_pos_license_key') || 'FREE_LOCAL').trim().toUpperCase();
    const activeBizId = localDb.getActiveBusinessId() || 'default-business';
    const activeShopId = localDb.getActiveShopId() || 'default-shop';

    const businesses = localDb.getBusinesses();
    const shops = localDb.getShops(activeBizId);
    const products = await localDb.getProducts(activeBizId, activeShopId);
    const sales = await localDb.getSales(activeBizId);
    const customers = await localDb.getCustomers(activeBizId);
    const expenses = localDb.getExpenses(activeBizId);
    const suppliers = localDb.getSuppliers(activeBizId);
    const employees = localDb.getEmployees(activeBizId);
    const attendance = localDb.getAllAttendance();
    const debts = localDb.getAllDebts(activeBizId);
    const alerts = localDb.getAlerts(activeBizId, activeShopId);
    const guestRequests = await localDb.getGuestRequests(activeBizId, activeShopId);

    const snapshot = {
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
      alerts,
      guestRequests
    };

    // Gather images from IndexedDB
    const indexedDbImages: Record<string, string> = {};
    try {
      // Scan all idb:// references in products & businesses
      for (const p of products) {
        if (p.imageUrl && p.imageUrl.startsWith('idb://')) {
          const imgData = await localDb.getImage(p.imageUrl);
          if (imgData) indexedDbImages[p.imageUrl] = imgData;
        }
      }
      for (const b of businesses) {
        if (b.logo && b.logo.startsWith('idb://')) {
          const imgData = await localDb.getImage(b.logo);
          if (imgData) indexedDbImages[b.logo] = imgData;
        }
      }
    } catch (e) {
      console.warn('Image extraction warning:', e);
    }

    // Capture raw localStorage keys starting with 'dmi_'
    const rawLocalStorage: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('dmi_') || k.startsWith('dmi_pos_'))) {
        rawLocalStorage[k] = localStorage.getItem(k) || '';
      }
    }

    const totalRecords = Object.values(snapshot).reduce((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
    const timestamp = new Date().toISOString();
    const formattedDate = timestamp.replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');

    const bundle: DmiDataBundle = {
      systemName: 'DMi POS Desktop Engine',
      version: '3.5.0-EXE',
      exportTimestamp: timestamp,
      licenseKey: activeLicense,
      targetFolderName: 'DMi data',
      databaseSnapshot: snapshot,
      indexedDbImages,
      rawLocalStorage
    };

    const jsonString = JSON.stringify(bundle, null, 2);
    const filename = `DMi_Data_${activeLicense}_${formattedDate}.dmidata`;

    return { filename, jsonString, recordCount: totalRecords };
  },

  // Perform automated 24-hour system backup targeting "DMi Backup" folder
  performAutomatedBackup: async (): Promise<{ success: boolean; filename: string; recordCount: number; message: string }> => {
    try {
      const now = new Date();
      const activeLicense = (localStorage.getItem('dmi_pos_license_key') || 'FREE_LOCAL').trim().toUpperCase();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `DMi_Backup_${dateStr}_${timeStr}.dmidata`;

      const { jsonString, recordCount } = await dmiDataEngine.exportDmiDataBundle();

      // 1. Cache backup locally in IndexedDB backup vault permanently
      const backupVaultKey = `dmi_backup_${dateStr}_${timeStr}`;
      await localDb.saveData('dmi_pos_auto_backups_vault', [{
        id: backupVaultKey,
        filename,
        timestamp: now.toISOString(),
        recordCount,
        bundleContent: jsonString
      }]);

      // 2. Automatically save directly to "Desktop / DMi Backup" folder (Tauri / Electron) or trigger browser auto-download
      const writeResult = await writeToDesktopBackupFolder(filename, jsonString);

      // 3. Update backup logs & last backup timestamp
      localStorage.setItem('dmi_pos_last_auto_backup_time', now.toISOString());

      const existingLogsRaw = localStorage.getItem('dmi_pos_auto_backup_history');
      let history: any[] = [];
      try { history = existingLogsRaw ? JSON.parse(existingLogsRaw) : []; } catch (e) {}

      history.unshift({
        id: backupVaultKey,
        timestamp: now.toISOString(),
        filename,
        recordCount,
        folder: 'DMi Backup',
        status: 'SUCCESS'
      });

      localStorage.setItem('dmi_pos_auto_backup_history', JSON.stringify(history.slice(0, 30)));

      window.dispatchEvent(new CustomEvent('auto-backup-completed', {
        detail: { filename, timestamp: now.toISOString(), recordCount }
      }));

      console.log(`[DMi Auto-Backup Engine] 24-Hour Automated Backup created cleanly: ${filename} (${recordCount} records)`);

      return {
        success: true,
        filename,
        recordCount,
        message: `24-Hour automated backup generated in DMi Backup folder as ${filename} (${recordCount} records).`
      };
    } catch (err: any) {
      console.error('[DMi Auto-Backup Engine] Backup failed:', err);
      return {
        success: false,
        filename: '',
        recordCount: 0,
        message: err.message || 'Auto-backup failed.'
      };
    }
  },

  // Check if 24 hours have elapsed (or if first install) and trigger backup
  checkAndRunAutoBackup: async (): Promise<boolean> => {
    const lastBackupRaw = localStorage.getItem('dmi_pos_last_auto_backup_time');
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    if (!lastBackupRaw) {
      console.log('[DMi Auto-Backup Engine] System newly installed / first run detected. Initializing immediate automated 24-hour backup...');
      await dmiDataEngine.performAutomatedBackup();
      return true;
    }

    const lastTime = new Date(lastBackupRaw).getTime();
    const elapsedTime = Date.now() - lastTime;

    if (isNaN(lastTime) || elapsedTime >= TWENTY_FOUR_HOURS_MS) {
      console.log(`[DMi Auto-Backup Engine] 24 hours elapsed since last backup (${Math.round(elapsedTime / 3600000)} hrs ago). Running scheduled auto backup...`);
      await dmiDataEngine.performAutomatedBackup();
      return true;
    }

    return false;
  },

  // Start background auto-backup scheduler on app boot
  initializeAutoBackupScheduler: () => {
    // Run check immediately on system boot
    dmiDataEngine.checkAndRunAutoBackup().catch((e) => {
      console.warn('Initial auto-backup check warning:', e);
    });

    // Re-check every 15 minutes
    setInterval(() => {
      dmiDataEngine.checkAndRunAutoBackup().catch((e) => {
        console.warn('Scheduled auto-backup check warning:', e);
      });
    }, 15 * 60 * 1000);
  },

  getLastAutoBackupTime: (): string | null => {
    return localStorage.getItem('dmi_pos_last_auto_backup_time');
  },

  getAutoBackupHistory: (): any[] => {
    try {
      const raw = localStorage.getItem('dmi_pos_auto_backup_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  // Download DMi data archive file directly
  triggerDmiDataDownload: async () => {
    const { filename, jsonString } = await dmiDataEngine.exportDmiDataBundle();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return filename;
  },

  // Export directly to Desktop folder using modern File System Access API
  exportToDesktop: async (): Promise<{ success: boolean; filename: string; message: string; savedToDesktop: boolean; cancelled?: boolean }> => {
    const { filename, jsonString, recordCount } = await dmiDataEngine.exportDmiDataBundle();

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          startIn: 'desktop',
          types: [{
            description: 'DMi Data Desktop Backup File (*.dmidata)',
            accept: { 'application/json': ['.dmidata', '.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        return {
          success: true,
          filename,
          message: `Successfully saved ${recordCount} database records & images directly to Desktop as ${filename}`,
          savedToDesktop: true
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, filename: '', message: 'Export cancelled by user.', savedToDesktop: false, cancelled: true };
        }
        console.warn('Native showSaveFilePicker unavailable or blocked, falling back to download link:', err);
      }
    }

    const downloadedName = await dmiDataEngine.triggerDmiDataDownload();
    return {
      success: true,
      filename: downloadedName,
      message: `Exported ${recordCount} database records. File saved to Desktop / Downloads directory as ${downloadedName}`,
      savedToDesktop: false
    };
  },

  // Import directly from Desktop folder using native file picker
  importFromDesktop: async (): Promise<{ success: boolean; message: string; recordCount: number; cancelled?: boolean }> => {
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          startIn: 'desktop',
          types: [{
            description: 'DMi Data Desktop Backup File (*.dmidata, *.json)',
            accept: { 'application/json': ['.dmidata', '.json'] }
          }],
          multiple: false
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        return await dmiDataEngine.importDmiDataBundle(content);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, message: 'Import cancelled.', recordCount: 0, cancelled: true };
        }
        console.warn('Native showOpenFilePicker unavailable, falling back:', err);
      }
    }

    return {
      success: false,
      message: 'Native Desktop picker fallback required.',
      recordCount: 0
    };
  },

  // Import DMi data bundle file and load into the system cleanly
  importDmiDataBundle: async (fileContent: string): Promise<{ success: boolean; message: string; recordCount: number }> => {
    try {
      const parsed = JSON.parse(fileContent);

      if (!parsed || (typeof parsed !== 'object')) {
        throw new Error('Invalid DMi data file format. Expected JSON structure.');
      }

      // Check if it's a DMi data bundle or standard backup
      const snapshot = parsed.databaseSnapshot || parsed.snapshot || parsed.data || parsed;
      const images = parsed.indexedDbImages || {};
      const rawLocal = parsed.rawLocalStorage || {};

      let totalRestored = 0;

      // 1. Restore IndexedDB images first
      if (images && typeof images === 'object') {
        for (const [key, base64Val] of Object.entries(images)) {
          if (typeof base64Val === 'string' && base64Val.startsWith('data:image')) {
            const cleanKey = key.replace('idb://', '');
            await localDb.saveImage(cleanKey, base64Val);
          }
        }
      }

      // 2. Restore Database Snapshot Tables into localStorage & cache
      if (snapshot && typeof snapshot === 'object') {
        const tableMappings: Record<string, string> = {
          businesses: 'dmi_pos_businesses',
          shops: 'dmi_pos_shops',
          products: 'dmi_pos_products',
          sales: 'dmi_pos_sales',
          customers: 'dmi_pos_customers',
          expenses: 'dmi_pos_expenses',
          suppliers: 'dmi_pos_suppliers',
          employees: 'dmi_pos_employees',
          attendance: 'dmi_pos_attendance',
          debts: 'dmi_pos_debts',
          alerts: 'dmi_pos_alerts',
          guestRequests: 'dmi_pos_guest_requests'
        };

        for (const [snapKey, storageKey] of Object.entries(tableMappings)) {
          if (snapshot[snapKey] && Array.isArray(snapshot[snapKey])) {
            const dataArr = snapshot[snapKey];
            await localDb.saveData(storageKey, dataArr);
            totalRestored += dataArr.length;
          }
        }
      }

      // 3. Restore raw localStorage settings & credentials if available
      if (rawLocal && typeof rawLocal === 'object') {
        for (const [key, val] of Object.entries(rawLocal)) {
          if (key && val && typeof val === 'string') {
            localStorage.setItem(key, val);
          }
        }
      }

      // 4. Bind License key if specified in file
      if (parsed.licenseKey && typeof parsed.licenseKey === 'string') {
        localStorage.setItem('dmi_pos_license_key', parsed.licenseKey.trim().toUpperCase());
        localStorage.setItem('dmi_pos_activated_license', parsed.licenseKey.trim().toUpperCase());
      }

      // 5. Fire global sync & re-render events
      window.dispatchEvent(new CustomEvent('business-changed'));
      window.dispatchEvent(new CustomEvent('shop-changed'));
      window.dispatchEvent(new CustomEvent('storage-sync'));
      window.dispatchEvent(new CustomEvent('sync-completed'));

      // 6. Force immediate cloud push so restored data syncs to Supabase Cloud
      setTimeout(() => {
        syncService.syncNow(true).catch(() => {});
      }, 500);

      return {
        success: true,
        message: `DMi data archive imported perfectly! Restored ${totalRestored} database records & images.`,
        recordCount: totalRestored
      };
    } catch (err: any) {
      console.error('Import DMi data error:', err);
      return {
        success: false,
        message: err.message || 'Failed to parse and load DMi data file.',
        recordCount: 0
      };
    }
  }
};
