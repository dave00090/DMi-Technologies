import { localDb } from './localDb';
import { get, keys } from 'idb-keyval';

export interface IntegrityIssue {
  id: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: 'SALES_LINK' | 'IMAGE_LINK' | 'SHOP_LINK' | 'SYNC_QUEUE' | 'DATA_CORRUPTION';
  title: string;
  description: string;
  affectedItem?: string;
}

export interface IntegrityReport {
  timestamp: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
  idbStats: {
    totalImages: number;
    totalCustomStoreKeys: number;
  };
  healthScore: number; // 0 - 100
  status: 'HEALTHY' | 'WARNINGS' | 'ERRORS';
  issues: IntegrityIssue[];
}

export const integrityEngine = {
  runAudit: async (): Promise<IntegrityReport> => {
    const activeBizId = localDb.getActiveBusinessId() || 'default-business';
    const activeShopId = localDb.getActiveShopId() || 'default-shop';

    const issues: IntegrityIssue[] = [];
    const tableCounts: Record<string, number> = {};

    // 1. Fetch data from local storage
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

    tableCounts['Businesses'] = businesses.length;
    tableCounts['Shops'] = shops.length;
    tableCounts['Products'] = products.length;
    tableCounts['Sales'] = sales.length;
    tableCounts['Customers'] = customers.length;
    tableCounts['Expenses'] = expenses.length;
    tableCounts['Suppliers'] = suppliers.length;
    tableCounts['Employees'] = employees.length;
    tableCounts['Attendance'] = attendance.length;
    tableCounts['Debts'] = debts.length;
    tableCounts['Stock Alerts'] = alerts.length;
    tableCounts['Guest Requests'] = guestRequests.length;

    const totalRecords = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);

    // Build Product Lookup Map
    const productMap = new Map<string, any>();
    const productNameSet = new Set<string>();
    products.forEach(p => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productNameSet.add(p.name.trim().toLowerCase());
    });

    // 2. AUDIT SALES & INVENTORY LINKAGES
    let missingProductLinks = 0;
    let unsyncedSales = 0;

    sales.forEach(s => {
      const saleAny = s as any;
      if (saleAny.synced === false || saleAny.syncStatus === 'PENDING') unsyncedSales++;

      // Check items array in sale
      if (s.items && Array.isArray(s.items)) {
        s.items.forEach((item: any) => {
          const productId = item.productId || item.id;
          const name = (item.name || item.productName || '').trim().toLowerCase();

          // Check if product exists by ID or by Name
          if (productId && !productMap.has(productId) && name && !productNameSet.has(name)) {
            missingProductLinks++;
            const receiptId = saleAny.receiptNo || s.id.slice(0, 8);
            issues.push({
              id: `sale-item-${s.id}-${productId}`,
              severity: 'WARNING',
              category: 'SALES_LINK',
              title: 'Unlinked Sales Line Item',
              description: `Sale #${receiptId} includes item "${item.name || 'Unknown'}" (ID: ${productId}) which is missing from active inventory.`,
              affectedItem: `Receipt #${receiptId}`
            });
          }
        });
      }
    });

    if (missingProductLinks > 0) {
      issues.push({
        id: 'sales-link-summary',
        severity: 'WARNING',
        category: 'SALES_LINK',
        title: `${missingProductLinks} Disconnected Sales Line Items`,
        description: `Found ${missingProductLinks} sales line item references pointing to inventory products that were deleted or modified.`
      });
    }

    if (unsyncedSales > 0) {
      issues.push({
        id: 'sync-queue-info',
        severity: 'INFO',
        category: 'SYNC_QUEUE',
        title: `${unsyncedSales} Pending Offline Sales`,
        description: `${unsyncedSales} sales transactions are safely cached in local storage waiting to sync to cloud.`
      });
    }

    // 3. AUDIT INDEXEDDB IMAGE LINKAGES
    let idbImageKeys: string[] = [];
    let totalCustomStoreKeys = 0;
    try {
      const allKeys = await keys();
      totalCustomStoreKeys = allKeys.length;
      idbImageKeys = allKeys.filter((k: any) => typeof k === 'string' && k.startsWith('img_')) as string[];
    } catch (e) {
      console.warn('Could not read IndexedDB keys during audit:', e);
    }

    const idbStats = {
      totalImages: idbImageKeys.length,
      totalCustomStoreKeys
    };

    // Check broken product image URLs
    let brokenImageLinks = 0;
    const idbKeySet = new Set(idbImageKeys);

    for (const p of products) {
      if (p.imageUrl && p.imageUrl.startsWith('idb://')) {
        const cleanKey = p.imageUrl.replace('idb://', '');
        if (!idbKeySet.has(cleanKey)) {
          brokenImageLinks++;
          issues.push({
            id: `prod-img-${p.id}`,
            severity: 'WARNING',
            category: 'IMAGE_LINK',
            title: 'Missing Image in Local Storage',
            description: `Product "${p.name}" references image key "${cleanKey}", but the file is missing in IndexedDB.`,
            affectedItem: p.name
          });
        }
      }
    }

    // 4. CALCULATE HEALTH SCORE & OVERALL STATUS
    let healthScore = 100;
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;

    healthScore -= errorCount * 15;
    healthScore -= warningCount * 5;
    if (healthScore < 0) healthScore = 0;

    let status: IntegrityReport['status'] = 'HEALTHY';
    if (errorCount > 0) {
      status = 'ERRORS';
    } else if (warningCount > 0) {
      status = 'WARNINGS';
    }

    return {
      timestamp: new Date().toLocaleString(),
      totalRecords,
      tableCounts,
      idbStats,
      healthScore,
      status,
      issues
    };
  },

  repairBrokenImageLinks: async (): Promise<{ repairedCount: number }> => {
    const activeBizId = localDb.getActiveBusinessId() || 'default-business';
    const activeShopId = localDb.getActiveShopId() || 'default-shop';
    const products = await localDb.getProducts(activeBizId, activeShopId);

    let idbImageKeys: string[] = [];
    try {
      const allKeys = await keys();
      idbImageKeys = allKeys.filter((k: any) => typeof k === 'string' && k.startsWith('img_')) as string[];
    } catch (e) {
      console.warn('Could not read IndexedDB keys during image repair:', e);
    }

    const idbKeySet = new Set(idbImageKeys);
    let repairedCount = 0;

    for (const p of products) {
      if (p.imageUrl && p.imageUrl.startsWith('idb://')) {
        const cleanKey = p.imageUrl.replace('idb://', '');
        if (!idbKeySet.has(cleanKey)) {
          // Remove broken image pointer so product uses default placeholder cleanly
          await localDb.updateProduct(p.id, { imageUrl: '' });
          repairedCount++;
        }
      }
    }

    return { repairedCount };
  }
};
