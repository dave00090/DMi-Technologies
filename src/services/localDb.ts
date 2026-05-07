import { 
  Product, 
  Sale, 
  Customer, 
  Alert, 
  UserProfile, 
  LoginHistory,
  BusinessProfile,
  Expense,
  Supplier,
  Employee,
  Attendance,
  Payroll,
  Debt,
  LedgerEntry,
  Variant,
  Shop
} from '../types';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, createStore } from 'idb-keyval';

// Create a custom store with a fresh name to avoid "object store not found" errors from previous versions
const customStore = createStore('dmi-pos-v3', 'keyval');

const STORAGE_KEYS = {
  PRODUCTS: 'dmi_pos_products',
  SALES: 'dmi_pos_sales',
  CUSTOMERS: 'dmi_pos_customers',
  ALERTS: 'dmi_pos_alerts',
  USERS: 'dmi_pos_users',
  LOGIN_HISTORY: 'dmi_pos_login_history',
  SETTINGS: 'dmi_pos_settings',
  AUTH: 'dmi_pos_auth_user',
  BUSINESSES: 'dmi_pos_businesses',
  SHOPS: 'dmi_pos_shops',
  ACTIVE_BUSINESS_ID: 'dmi_pos_active_business_id',
  ACTIVE_SHOP_ID: 'dmi_pos_active_shop_id',
  EXPENSES: 'dmi_pos_expenses',
  SUPPLIERS: 'dmi_pos_suppliers',
  EMPLOYEES: 'dmi_pos_employees',
  ATTENDANCE: 'dmi_pos_attendance',
  PAYROLL: 'dmi_pos_payroll',
  DEBTS: 'dmi_pos_debts',
  LEDGER: 'dmi_pos_ledger',
  IS_ACTIVATED: 'dmi_pos_is_activated'
};

const ACTIVATION_PIN = '8124'; // Master activation PIN for the developer to sell the app

// In-memory cache for synchronous access
const dbCache: Record<string, any> = {};

// Initialize cache from localStorage and IndexedDB
export async function initDb() {
  // Load all keys from IndexedDB first (source of truth)
  try {
    const allKeys = await idbKeys(customStore);
    for (const key of allKeys) {
      if (typeof key === 'string' && (key.startsWith('dmi_pos_') || key.startsWith('pos_cart_'))) {
        dbCache[key] = await idbGet(key, customStore);
      }
    }
  } catch (e) {
    console.error('Failed to load from IndexedDB during init:', e);
  }

  // Then check localStorage for anything that might be there but not in IDB (unlikely but safe)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('dmi_pos_') || key.startsWith('pos_cart_'))) {
      if (dbCache[key] === undefined) {
        const localData = localStorage.getItem(key);
        if (localData && localData !== '__idb_ref__') {
          try {
            dbCache[key] = JSON.parse(localData);
          } catch (e) {
            dbCache[key] = null;
          }
        }
      }
    }
  }
};

// Sync cache across tabs
window.addEventListener('storage', async (event) => {
  if (event.key && (event.key.startsWith('dmi_pos_') || event.key.startsWith('pos_cart_'))) {
    try {
      if (event.newValue === '__idb_ref__') {
        dbCache[event.key] = await idbGet(event.key, customStore);
      } else if (event.newValue) {
        try {
          dbCache[event.key] = JSON.parse(event.newValue);
        } catch (e) {
          dbCache[event.key] = null;
        }
      } else {
        delete dbCache[event.key];
      }
      window.dispatchEvent(new CustomEvent('storage-sync', { detail: { key: event.key } }));
    } catch (e) {
      console.error('Failed to sync from IndexedDB on storage event:', e);
    }
  }
});

// Helper to get data from localStorage
export function getLocal<Value>(key: string, defaultValue: Value): Value {
  if (dbCache[key] !== undefined && dbCache[key] !== null) {
    return dbCache[key] as Value;
  }
  const data = localStorage.getItem(key);
  if (data === '__idb_ref__') return defaultValue; // Should have been loaded by initDb
  return data ? JSON.parse(data) : defaultValue;
}

// Helper to offload large fields (images) to IndexedDB
const offloadLargeFields = async (obj: any, key: string): Promise<any> => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item, index) => offloadLargeFields(item, key)));
  }

  const newObj = { ...obj };
  const largeFields = ['logo', 'imageUrl', 'receiptUrl'];
  
  for (const field of largeFields) {
    if (typeof newObj[field] === 'string' && newObj[field].startsWith('data:image')) {
      const idbKey = `img_${key}_${newObj.id || Math.random().toString(36).slice(2)}_${field}`;
      try {
        await idbSet(idbKey, newObj[field], customStore);
        newObj[field] = `idb://${idbKey}`;
      } catch (e) {
        console.error(`Failed to offload field ${field} to IndexedDB:`, e);
        // Keep original if offload fails
      }
    }
  }

  // Recursively handle nested objects (like variants or mpesaConfig)
  for (const k in newObj) {
    if (k !== 'logo' && k !== 'imageUrl' && k !== 'receiptUrl' && typeof newObj[k] === 'object') {
      newObj[k] = await offloadLargeFields(newObj[k], key);
    }
  }

  return newObj;
};

// Helper to set data to localStorage with automatic IndexedDB offloading for large fields
export async function setLocal<Value>(key: string, data: Value): Promise<void> {
  // Update cache immediately
  dbCache[key] = data;
  
  // Always save to IndexedDB as the primary persistent store
  try {
    await idbSet(key, data, customStore);
  } catch (e) {
    console.error(`Failed to save ${key} to IndexedDB:`, e);
  }

  try {
    const processedData = await offloadLargeFields(data, key);
    const stringified = JSON.stringify(processedData);
    
    // Only save to localStorage if it's reasonably small (under 100KB)
    if (stringified.length < 100000) {
      localStorage.setItem(key, stringified);
    } else {
      localStorage.setItem(key, '__idb_ref__');
    }
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn('Storage quota exceeded. Using IndexedDB reference for:', key);
      localStorage.setItem(key, '__idb_ref__');
      
      // Aggressive cleanup of other keys if needed
      const usage: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) usage[k] = (localStorage.getItem(k) || '').length;
      }
      console.table(usage);

      const keysToClear = [
        STORAGE_KEYS.ALERTS,
        STORAGE_KEYS.LOGIN_HISTORY,
        STORAGE_KEYS.LEDGER,
        STORAGE_KEYS.ATTENDANCE,
        STORAGE_KEYS.EXPENSES
      ];

      keysToClear.forEach(k => {
        if (k !== key) {
          localStorage.setItem(k, '__idb_ref__');
        }
      });
    } else {
      localStorage.setItem(key, '__idb_ref__');
    }
  }

  // Dispatch global sync event for in-tab listeners
  window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key } }));
}

// Helper to remove data from both localStorage and IndexedDB
export async function removeLocal(key: string): Promise<void> {
  delete dbCache[key];
  localStorage.removeItem(key);
  try {
    await idbDel(key, customStore);
  } catch (e) {
    console.error(`Failed to delete ${key} from IndexedDB:`, e);
  }
  // Dispatch global sync event for in-tab listeners
  window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key } }));
}

// Local Database Service
export const localDb = {
  // Event Emitter
  emit: (event: string, detail?: any) => {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  },

  // Products
  getProducts: async (businessId: string, shopId: string): Promise<Product[]> => {
    const all = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    return all.filter(p => p.businessId === businessId && p.shopId === shopId);
  },
  addProduct: async (product: Omit<Product, 'id'>) => {
    const all = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const newProduct = { ...product, id: crypto.randomUUID() } as Product;
    await setLocal(STORAGE_KEYS.PRODUCTS, [...all, newProduct]);
    return newProduct;
  },
  updateProduct: async (id: string, updates: Partial<Product>) => {
    const all = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const updated = all.map(p => p.id === id ? { ...p, ...updates } : p);
    await setLocal(STORAGE_KEYS.PRODUCTS, updated);
  },
  deleteProduct: async (id: string) => {
    const all = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    await setLocal(STORAGE_KEYS.PRODUCTS, all.filter(p => p.id !== id));
  },

  // Sales
  getSales: async (businessId: string, shopId?: string): Promise<Sale[]> => {
    const all = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    return all
      .filter(s => s.businessId === businessId && (!shopId || s.shopId === shopId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  addSale: async (sale: Omit<Sale, 'id'>) => {
    const all = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    const business = localDb.getBusinessById(sale.businessId);
    const taxRate = business?.taxRate || 0;
    const taxAmount = (sale.total * taxRate) / (100 + taxRate); 
    
    const etimsControlNumber = `KRA-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const etimsQrCode = `https://etims.kra.go.ke/verify?cu=${etimsControlNumber}&amt=${sale.total}`;

    const newSale = { 
      ...sale, 
      id: crypto.randomUUID(),
      etimsControlNumber,
      etimsQrCode,
      taxAmount,
      taxRate
    } as Sale;
    await setLocal(STORAGE_KEYS.SALES, [newSale, ...all]);
    return newSale;
  },
  deleteSale: async (id: string) => {
    const all = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    await setLocal(STORAGE_KEYS.SALES, all.filter(s => s.id !== id));
  },

  // Customers
  getCustomers: async (businessId: string): Promise<Customer[]> => {
    const all = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    return all.filter(c => c.businessId === businessId);
  },
  addCustomer: async (customer: Omit<Customer, 'id'>) => {
    const all = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const newCustomer = { ...customer, id: crypto.randomUUID() } as Customer;
    await setLocal(STORAGE_KEYS.CUSTOMERS, [...all, newCustomer]);
    return newCustomer;
  },
  updateCustomer: async (id: string, updates: Partial<Customer>) => {
    const all = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    const updated = all.map(c => c.id === id ? { ...c, ...updates } : c);
    await setLocal(STORAGE_KEYS.CUSTOMERS, updated);
  },
  deleteCustomer: async (id: string) => {
    const all = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    await setLocal(STORAGE_KEYS.CUSTOMERS, all.filter(c => c.id !== id));
  },

  // Alerts
  getAlerts: (businessId: string, shopId: string): Alert[] => {
    const all = getLocal<Alert[]>(STORAGE_KEYS.ALERTS, []);
    return all.filter(a => a.businessId === businessId && a.shopId === shopId);
  },
  addAlert: async (alert: Omit<Alert, 'id'>) => {
    const all = getLocal<Alert[]>(STORAGE_KEYS.ALERTS, []);
    const newAlert = { ...alert, id: crypto.randomUUID() } as Alert;
    await setLocal(STORAGE_KEYS.ALERTS, [newAlert, ...all]);
    return newAlert;
  },
  updateAlert: async (id: string, updates: Partial<Alert>) => {
    const all = getLocal<Alert[]>(STORAGE_KEYS.ALERTS, []);
    const updated = all.map(a => a.id === id ? { ...a, ...updates } : a);
    await setLocal(STORAGE_KEYS.ALERTS, updated);
  },
  deleteAlert: async (id: string) => {
    const all = getLocal<Alert[]>(STORAGE_KEYS.ALERTS, []);
    await setLocal(STORAGE_KEYS.ALERTS, all.filter(a => a.id !== id));
  },

  // Users
  getUsers: (): UserProfile[] => getLocal<UserProfile[]>(STORAGE_KEYS.USERS, []),
  addUser: async (user: Omit<UserProfile, 'uid'>) => {
    const users = localDb.getUsers();
    const newUser = { ...user, uid: crypto.randomUUID() };
    await setLocal(STORAGE_KEYS.USERS, [...users, newUser]);
    return newUser;
  },
  updateUser: async (uid: string, updates: Partial<UserProfile>) => {
    const users = localDb.getUsers();
    const updated = users.map(u => u.uid === uid ? { ...u, ...updates } : u);
    await setLocal(STORAGE_KEYS.USERS, updated);
  },

  // Login History
  getLoginHistory: (): LoginHistory[] => getLocal<LoginHistory[]>(STORAGE_KEYS.LOGIN_HISTORY, []),
  addLoginHistory: async (history: Omit<LoginHistory, 'id'>) => {
    const all = localDb.getLoginHistory();
    const newHistory = { ...history, id: crypto.randomUUID() };
    await setLocal(STORAGE_KEYS.LOGIN_HISTORY, [newHistory, ...all].slice(0, 100)); 
    return newHistory;
  },

  // Business Profiles
  getBusinesses: (): BusinessProfile[] => getLocal<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []),
  addBusiness: async (business: Omit<BusinessProfile, 'id'>) => {
    const businesses = localDb.getBusinesses();
    const newBusiness = { ...business, id: crypto.randomUUID() };
    await setLocal(STORAGE_KEYS.BUSINESSES, [...businesses, newBusiness]);
    return newBusiness;
  },
  updateBusiness: async (id: string, updates: Partial<BusinessProfile>) => {
    const businesses = localDb.getBusinesses();
    const updated = businesses.map(b => b.id === id ? { ...b, ...updates } : b);
    await setLocal(STORAGE_KEYS.BUSINESSES, updated);
    localDb.emit('business-update', { id, updates });
  },
  getBusinessById: (id: string): BusinessProfile | undefined => {
    return localDb.getBusinesses().find(b => b.id === id);
  },
  deleteBusiness: async (id: string) => {
    const businesses = localDb.getBusinesses();
    await setLocal(STORAGE_KEYS.BUSINESSES, businesses.filter(b => b.id !== id));

    const shops = getLocal<Shop[]>(STORAGE_KEYS.SHOPS, []);
    await setLocal(STORAGE_KEYS.SHOPS, shops.filter(s => s.businessId !== id));

    const products = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    await setLocal(STORAGE_KEYS.PRODUCTS, products.filter(p => p.businessId !== id));

    const sales = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    await setLocal(STORAGE_KEYS.SALES, sales.filter(s => s.businessId !== id));

    const customers = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    await setLocal(STORAGE_KEYS.CUSTOMERS, customers.filter(c => c.businessId !== id));

    const alerts = getLocal<Alert[]>(STORAGE_KEYS.ALERTS, []);
    await setLocal(STORAGE_KEYS.ALERTS, alerts.filter(a => a.businessId !== id));

    if (localDb.getActiveBusinessId() === id) {
      localDb.setActiveBusinessId(null);
      localDb.setActiveShopId(null);
    }
  },

  // Shops
  getShops: (businessId: string): Shop[] => {
    const all = getLocal<Shop[]>(STORAGE_KEYS.SHOPS, []);
    return all.filter(s => s.businessId === businessId);
  },
  addShop: async (shop: Omit<Shop, 'id'>) => {
    const all = getLocal<Shop[]>(STORAGE_KEYS.SHOPS, []);
    const newShop = { ...shop, id: crypto.randomUUID() };
    await setLocal(STORAGE_KEYS.SHOPS, [...all, newShop]);
    return newShop;
  },
  updateShop: async (id: string, updates: Partial<Shop>) => {
    const all = getLocal<Shop[]>(STORAGE_KEYS.SHOPS, []);
    const updated = all.map(s => s.id === id ? { ...s, ...updates } : s);
    await setLocal(STORAGE_KEYS.SHOPS, updated);
  },
  getShopById: (id: string): Shop | undefined => {
    const all = getLocal<Shop[]>(STORAGE_KEYS.SHOPS, []);
    return all.find(s => s.id === id);
  },

  // Expenses
  getExpenses: (businessId: string, shopId?: string): Expense[] => {
    const all = getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    return all.filter(e => e.businessId === businessId && (!shopId || e.shopId === shopId));
  },
  addExpense: async (expense: Omit<Expense, 'id'>) => {
    const all = getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    const newExpense = { ...expense, id: crypto.randomUUID() } as Expense;
    await setLocal(STORAGE_KEYS.EXPENSES, [newExpense, ...all]);
    return newExpense;
  },
  deleteExpense: async (id: string) => {
    const all = getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    await setLocal(STORAGE_KEYS.EXPENSES, all.filter(e => e.id !== id));
  },

  // Suppliers
  getSuppliers: (businessId: string): Supplier[] => {
    const all = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    return all.filter(s => s.businessId === businessId);
  },
  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
    const all = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    const newSupplier = { ...supplier, id: crypto.randomUUID() } as Supplier;
    await setLocal(STORAGE_KEYS.SUPPLIERS, [...all, newSupplier]);
    return newSupplier;
  },
  updateSupplier: async (id: string, updates: Partial<Supplier>) => {
    const all = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    const updated = all.map(s => s.id === id ? { ...s, ...updates } : s);
    await setLocal(STORAGE_KEYS.SUPPLIERS, updated);
  },
  deleteSupplier: async (id: string) => {
    const all = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    await setLocal(STORAGE_KEYS.SUPPLIERS, all.filter(s => s.id !== id));
  },

  // Employees
  getEmployees: (businessId: string, shopId?: string): Employee[] => {
    const all = getLocal<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    return all.filter(e => e.businessId === businessId && (!shopId || e.shopId === shopId));
  },
  addEmployee: async (employee: Omit<Employee, 'id'>) => {
    const all = getLocal<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const newEmployee = { ...employee, id: crypto.randomUUID() } as Employee;
    await setLocal(STORAGE_KEYS.EMPLOYEES, [...all, newEmployee]);
    return newEmployee;
  },
  updateEmployee: async (id: string, updates: Partial<Employee>) => {
    const all = getLocal<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const updated = all.map(e => e.id === id ? { ...e, ...updates } : e);
    await setLocal(STORAGE_KEYS.EMPLOYEES, updated);
  },
  deleteEmployee: async (id: string) => {
    const all = getLocal<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    await setLocal(STORAGE_KEYS.EMPLOYEES, all.filter(e => e.id !== id));
  },

  // Attendance
  getAttendance: (employeeId: string): Attendance[] => {
    const all = getLocal<Attendance[]>(STORAGE_KEYS.ATTENDANCE, []);
    return all.filter(a => a.employeeId === employeeId);
  },
  getAllAttendance: (): Attendance[] => {
    return getLocal<Attendance[]>(STORAGE_KEYS.ATTENDANCE, []);
  },
  addAttendance: async (attendance: Omit<Attendance, 'id'>) => {
    const all = getLocal<Attendance[]>(STORAGE_KEYS.ATTENDANCE, []);
    const newAttendance = { ...attendance, id: crypto.randomUUID() } as Attendance;
    await setLocal(STORAGE_KEYS.ATTENDANCE, [newAttendance, ...all]);
    return newAttendance;
  },
  deleteAttendance: async (id: string) => {
    const all = getLocal<Attendance[]>(STORAGE_KEYS.ATTENDANCE, []);
    await setLocal(STORAGE_KEYS.ATTENDANCE, all.filter(a => a.id !== id));
  },

  // Payroll
  getPayroll: (employeeId: string): Payroll[] => {
    const all = getLocal<Payroll[]>(STORAGE_KEYS.PAYROLL, []);
    return all.filter(p => p.employeeId === employeeId);
  },
  addPayroll: async (payroll: Omit<Payroll, 'id'>) => {
    const all = getLocal<Payroll[]>(STORAGE_KEYS.PAYROLL, []);
    const newPayroll = { ...payroll, id: crypto.randomUUID() } as Payroll;
    await setLocal(STORAGE_KEYS.PAYROLL, [newPayroll, ...all]);
    return newPayroll;
  },
  getPayrollReport: (businessId: string, startDate: Date, endDate: Date, shopId?: string) => {
    const allPayroll = getLocal<Payroll[]>(STORAGE_KEYS.PAYROLL, []);
    const employees = localDb.getEmployees(businessId, shopId);
    const employeeIds = new Set(employees.map(e => e.id));

    return allPayroll.filter(p => {
      if (!employeeIds.has(p.employeeId)) return false;
      const date = new Date(p.paymentDate);
      return date >= startDate && date <= endDate;
    });
  },
  deletePayroll: async (id: string) => {
    const all = getLocal<Payroll[]>(STORAGE_KEYS.PAYROLL, []);
    await setLocal(STORAGE_KEYS.PAYROLL, all.filter(p => p.id !== id));
  },

  // Debts
  getDebts: (customerId: string): Debt[] => {
    const all = getLocal<Debt[]>(STORAGE_KEYS.DEBTS, []);
    return all.filter(d => d.customerId === customerId);
  },
  getAllDebts: (businessId: string, shopId?: string): Debt[] => {
    const all = getLocal<Debt[]>(STORAGE_KEYS.DEBTS, []);
    return all.filter(d => d.businessId === businessId && (!shopId || d.shopId === shopId));
  },
  addDebt: async (debt: Omit<Debt, 'id'>) => {
    const all = getLocal<Debt[]>(STORAGE_KEYS.DEBTS, []);
    const newDebt = { ...debt, id: crypto.randomUUID() } as Debt;
    await setLocal(STORAGE_KEYS.DEBTS, [newDebt, ...all]);
    return newDebt;
  },
  updateDebt: async (id: string, updates: Partial<Debt>) => {
    const all = getLocal<Debt[]>(STORAGE_KEYS.DEBTS, []);
    const updated = all.map(d => d.id === id ? { ...d, ...updates } : d);
    await setLocal(STORAGE_KEYS.DEBTS, updated);
  },
  payDebt: async (debtId: string, amount: number, cashierId: string, cashierName: string) => {
    const allDebts = getLocal<Debt[]>(STORAGE_KEYS.DEBTS, []);
    const debt = allDebts.find(d => d.id === debtId);
    if (!debt) throw new Error('Debt not found');

    const customer = (await localDb.getCustomers(debt.businessId)).find(c => c.id === debt.customerId);
    if (!customer) throw new Error('Customer not found');

    // 1. Update debt
    const updatedDebts = allDebts.map(d => d.id === debtId ? { ...d, remainingAmount: 0, status: 'PAID' as const } : d);
    await setLocal(STORAGE_KEYS.DEBTS, updatedDebts);

    // 2. Create a generic Sale for the payment representation (so it shows in recent transactions)
    // IMPORTANT: We use a special category "DEBT_PAYMENT" to distinguish it if needed
    const sale: Omit<Sale, 'id'> = {
      businessId: debt.businessId,
      shopId: debt.shopId,
      items: [{
        productId: 'DEBT_PAYMENT',
        variantId: 'DEBT_PAYMENT',
        name: 'Debt Payment',
        variantName: `For Order #${debt.saleId.slice(-8).toUpperCase()}`,
        quantity: 1,
        price: amount,
        originalPrice: amount,
        buyingPrice: 0,
        unit: 'payment'
      }],
      total: amount,
      timestamp: new Date().toISOString(),
      cashierId,
      cashierName,
      customerId: debt.customerId,
      customerName: customer.name,
      paymentMethod: 'CASH', // Payment received in cash
    };
    const newSale = await localDb.addSale(sale);

    // 3. Add Ledger Entry (CREDIT)
    const currentLedger = localDb.getLedger(debt.customerId, 'CUSTOMER');
    const lastBalance = currentLedger.length > 0 ? currentLedger[currentLedger.length - 1].balanceAfter : 0;
    
    await localDb.addLedgerEntry({
      businessId: debt.businessId,
      shopId: debt.shopId,
      entityId: debt.customerId,
      entityType: 'CUSTOMER',
      type: 'CREDIT',
      amount: amount,
      balanceAfter: lastBalance - amount,
      description: `Debt settlement for order #${debt.saleId.slice(-8).toUpperCase()}`,
      referenceId: newSale.id,
      timestamp: new Date().toISOString()
    });

    return newSale;
  },

  // Ledger
  getLedger: (entityId: string, entityType: 'CUSTOMER' | 'SUPPLIER'): LedgerEntry[] => {
    const all = getLocal<LedgerEntry[]>(STORAGE_KEYS.LEDGER, []);
    return all.filter(l => l.entityId === entityId && l.entityType === entityType);
  },
  addLedgerEntry: async (entry: Omit<LedgerEntry, 'id'>) => {
    const all = getLocal<LedgerEntry[]>(STORAGE_KEYS.LEDGER, []);
    const newEntry = { ...entry, id: crypto.randomUUID() } as LedgerEntry;
    await setLocal(STORAGE_KEYS.LEDGER, [newEntry, ...all]);
    return newEntry;
  },
  deleteLedgerEntry: async (id: string) => {
    const all = getLocal<LedgerEntry[]>(STORAGE_KEYS.LEDGER, []);
    await setLocal(STORAGE_KEYS.LEDGER, all.filter(l => l.id !== id));
  },

  // Active State
  getActiveBusinessId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID),
  setActiveBusinessId: (id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID);
  },
  getActiveShopId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_SHOP_ID),
  setActiveShopId: (id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_SHOP_ID, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHOP_ID);
  },

  // Reporting Helpers
  getSalesReport: (businessId: string, startDate: Date, endDate: Date, shopId?: string) => {
    const sales = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    const filtered = sales.filter(s => s.businessId === businessId && (!shopId || s.shopId === shopId));
    return filtered
      .filter(s => {
        const date = new Date(s.timestamp);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getSalesByCustomer: (customerId: string): Sale[] => {
    const all = getLocal<Sale[]>(STORAGE_KEYS.SALES, []);
    return all.filter(s => s.customerId === customerId);
  },

  getStaffPerformance: (businessId: string, startDate: Date, endDate: Date, shopId?: string) => {
    const sales = localDb.getSalesReport(businessId, startDate, endDate, shopId);
    const users = localDb.getUsers();
    const performance: Record<string, { 
      name: string, 
      role: string,
      totalSales: number, 
      transactionCount: number, 
      avgTransactionValue: number 
    }> = {};

    sales.forEach(sale => {
      if (!performance[sale.cashierId]) {
        const user = users.find(u => u.uid === sale.cashierId);
        performance[sale.cashierId] = {
          name: sale.cashierName,
          role: user?.role || 'staff',
          totalSales: 0,
          transactionCount: 0,
          avgTransactionValue: 0
        };
      }
      performance[sale.cashierId].totalSales += sale.total;
      performance[sale.cashierId].transactionCount += 1;
    });

    Object.values(performance).forEach(p => {
      p.avgTransactionValue = p.totalSales / p.transactionCount;
    });

    return Object.values(performance);
  },

  getProfitLossReport: (businessId: string, startDate: Date, endDate: Date, shopId?: string) => {
    const sales = localDb.getSalesReport(businessId, startDate, endDate, shopId);
    const expenses = localDb.getExpenses(businessId, shopId).filter(e => {
      const date = new Date(e.date);
      return date >= startDate && date <= endDate;
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    sales.forEach(sale => {
      totalRevenue += sale.total;
      sale.items.forEach(item => {
        totalCost += (item.buyingPrice || 0) * item.quantity;
      });
    });

    return {
      totalRevenue,
      totalCost,
      totalExpenses,
      grossProfit: totalRevenue - totalCost,
      netProfit: totalRevenue - totalCost - totalExpenses
    };
  },

  // Activation
  isActivated: (): boolean => {
    return getLocal<boolean>(STORAGE_KEYS.IS_ACTIVATED, false);
  },
  activate: async (pin: string): Promise<boolean> => {
    if (pin === ACTIVATION_PIN) {
      await setLocal(STORAGE_KEYS.IS_ACTIVATED, true);
      return true;
    }
    return false;
  },
  deactivate: async () => {
    await setLocal(STORAGE_KEYS.IS_ACTIVATED, false);
    localStorage.removeItem('dmi_pos_license_key');
  },

  // Storage Maintenance
  vacuum: async () => {
    console.log('Running storage maintenance...');
    const businesses = localDb.getBusinesses();
    const products = getLocal<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    
    // Check for large images and compress if needed
    const { compressImage } = await import('../lib/imageUtils');
    
    let changed = false;
    
    // Compress business logos
    for (const b of businesses) {
      if (b.logo && b.logo.length > 50000 && !b.logo.startsWith('idb://')) { // > 50KB and not already offloaded
        try {
          const compressed = await compressImage(b.logo, 300, 300, 0.5);
          b.logo = compressed;
          changed = true;
        } catch (e) {
          console.error('Failed to compress business logo', e);
        }
      }
    }
    if (changed) await setLocal(STORAGE_KEYS.BUSINESSES, businesses);
    
    changed = false;
    // Compress product images
    for (const p of products) {
      if (p.imageUrl && p.imageUrl.length > 50000 && !p.imageUrl.startsWith('idb://')) { // > 50KB and not already offloaded
        try {
          const compressed = await compressImage(p.imageUrl, 300, 300, 0.5);
          p.imageUrl = compressed;
          changed = true;
        } catch (e) {
          console.error('Failed to compress product image', e);
        }
      }
    }
    if (changed) await setLocal(STORAGE_KEYS.PRODUCTS, products);

    // IndexedDB Cleanup: Remove orphaned images
    try {
      const allKeys = await idbKeys(customStore);
      const imageKeys = allKeys.filter((k: any) => typeof k === 'string' && k.startsWith('img_'));
      
      // Collect all referenced idb:// keys from localStorage
      const referencedKeys = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          const val = localStorage.getItem(k);
          if (val) {
            const matches = val.match(/idb:\/\/img_[a-zA-Z0-9_.-]+/g);
            if (matches) {
              matches.forEach(m => referencedKeys.add(m.replace('idb://', '')));
            }
          }
        }
      }

      // Delete orphaned keys
      for (const key of imageKeys) {
        if (!referencedKeys.has(key as string)) {
          console.log(`Deleting orphaned image from IndexedDB: ${key}`);
          await idbDel(key as string, customStore);
        }
      }
    } catch (e) {
      console.error('Failed to cleanup IndexedDB', e);
    }
    
    console.log('Storage maintenance complete.');
  },

  // Image Helper
  getImage: async (url: string): Promise<string> => {
    if (url.startsWith('idb://')) {
      const key = url.replace('idb://', '');
      return await idbGet(key, customStore) || '';
    }
    return url;
  }
};
