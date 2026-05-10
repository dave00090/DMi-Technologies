export type BusinessType = 
  | 'RETAIL' 
  | 'HARDWARE' 
  | 'PHARMACY' 
  | 'BOOKSHOP' 
  | 'GROCERY' 
  | 'AUTOSPARE' 
  | 'LIQUOR'
  | 'RESTAURANT'
  | 'FAST_FOOD'
  | 'SALON_BARBER'
  | 'BOUTIQUE'
  | 'BAR_RESTAURANT'
  | 'PETROL_STATION'
  | 'HOTEL'
  | 'OTHER';

export interface MpesaConfig {
  sendMoneyNumber?: string;
  pochiNumber?: string;
  paybillNumber?: string;
  paybillAccount?: string;
  tillNumber?: string;
  // API Credentials
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
  shortCode?: string;
  isStkPushEnabled?: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  type: BusinessType;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  currency: string;
  taxRate: number;
  mpesaConfig?: MpesaConfig;
}

export interface Shop {
  id: string;
  businessId: string;
  name: string;
  location?: string;
  phone?: string;
}

export type Role = 'admin' | 'staff' | 'manager' | 'hr';
export type PaymentMethod = 'CASH' | 'MPESA' | 'CARD' | 'DEBT';
export type SaleStatus = 'COMPLETED' | 'PENDING_PAYMENT' | 'FAILED_PAYMENT' | 'CANCELLED';
export type AlertType = 'PRICE_OVERRIDE' | 'LOW_STOCK' | 'EXPIRY_WARNING' | 'DEBT_OVERDUE';
export type AlertStatus = 'UNREAD' | 'READ';

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  category?: string;
  totalSupplied: number;
  totalPaid: number;
  balance: number;
  suppliedProducts?: string[];
  createdAt: string;
}

export interface Expense {
  id: string;
  businessId: string;
  shopId: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
  recordedBy: string;
  receiptUrl?: string;
}

export interface Employee {
  id: string;
  businessId: string;
  shopId: string;
  name: string;
  email?: string;
  phone: string;
  role: string;
  salary: number;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  nationalId?: string;
  emergencyContact?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  notes?: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  period: string; // e.g., "2024-03"
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: 'PENDING' | 'PAID';
  method: string;
  reference?: string;
}

export interface LedgerEntry {
  id: string;
  businessId: string;
  shopId?: string;
  entityId: string; // Customer ID or Supplier ID
  entityType: 'CUSTOMER' | 'SUPPLIER';
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balanceAfter: number;
  description: string;
  timestamp: string;
  referenceId?: string; // Sale ID or Purchase ID
}

export interface Debt {
  id: string;
  businessId: string;
  shopId: string;
  customerId: string;
  amount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  saleId: string;
  createdAt: string;
}

export interface Variant {
  id: string;
  size: string; // Used for "Portion", "Volume", or "Duration" for services
  color: string; // Used for "Style", "Type", or "Specialist" for services
  stock: number;
  sku?: string;
  lowStockThreshold?: number;
  price?: number; // Specific price for this variant/style
}

export interface Product {
  id: string;
  businessId: string;
  shopId: string;
  name: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  basePrice: number;
  variants: Variant[];
  lowStockThreshold: number;
  description?: string;
  imageUrl?: string;
  type: 'PRODUCT' | 'SERVICE';
  // Business specific fields
  expiryDate?: string;
  batchNumber?: string;
  partNumber?: string;
  modelCompatibility?: string;
  alcoholPercentage?: number;
  volume?: string;
  brand?: string;
  warranty?: string;
  unit?: string; // e.g., kg, pcs, l
  // Service & Hospitality fields
  isService?: boolean; // Deprecated in favor of type: 'SERVICE'
  duration?: number; // in minutes
  roomType?: string;
  fuelType?: 'PETROL' | 'DIESEL' | 'KEROSENE' | 'GAS' | '';
  material?: string;
  ingredients?: string[];
}

export interface SaleItem {
  productId: string;
  variantId: string;
  name: string;
  category?: string;
  variantName: string;
  quantity: number;
  price: number;
  originalPrice: number;
  buyingPrice?: number;
  unit?: string;
}

export interface Sale {
  id: string;
  businessId: string;
  shopId: string;
  items: SaleItem[];
  total: number;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  loyaltyPointsEarned?: number;
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
    code?: string;
  };
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  mpesaReference?: string;
  etimsControlNumber?: string;
  etimsQrCode?: string;
  taxAmount?: number;
  taxRate?: number;
  cashReceived?: number;
  change?: number;
}

export interface Alert {
  id: string;
  businessId: string;
  shopId: string;
  type: AlertType;
  message: string;
  timestamp: string;
  status: AlertStatus;
  details?: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  lastLogin?: string;
  theme?: ThemeConfig;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone: string;
  loyaltyPoints: number;
  totalSpent: number;
  lastPurchaseDate?: string;
  createdAt: string;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkMode?: boolean;
}

export interface LoginHistory {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  role: Role;
  ipAddress?: string;
  device?: string;
  browser?: string;
  status: 'SUCCESS' | 'FAILED';
}
