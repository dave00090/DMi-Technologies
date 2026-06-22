-- ====================================================================
-- DMi-POS central master / tenant database schema scripts
-- Run this directly in your Supabase SQL Editor or Cloud SQL shell.
-- ====================================================================

-- ====================================================================
-- SECTION 1: Master Admin Central Tables (governing licenses, alerts)
-- ====================================================================

-- Create Licenses Table
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'LOCKED')),
    machine_id VARCHAR(255),
    authorized_domain VARCHAR(255),
    system_name VARCHAR(255) DEFAULT 'RetailMaster',
    plan_type VARCHAR(100) DEFAULT 'Bronze Standard',
    license_fee NUMERIC(15, 2) DEFAULT 0.00,
    penalty_amount NUMERIC(15, 2) DEFAULT 0.00,
    grace_period_days INT DEFAULT 7,
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_status VARCHAR(50) DEFAULT 'PENDING',
    payment_phone VARCHAR(50),
    mpesa_reference VARCHAR(100),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Drop existing indexes if any, then create indexes for search speed
DROP INDEX IF EXISTS idx_licenses_key;
DROP INDEX IF EXISTS idx_licenses_status;
CREATE INDEX idx_licenses_key ON public.licenses(license_key);
CREATE INDEX idx_licenses_status ON public.licenses(status);

-- Create select policy allows public matching checks
DROP POLICY IF EXISTS "Allow public select for active checks" ON public.licenses;
CREATE POLICY "Allow public select for active checks" ON public.licenses 
    FOR SELECT USING (true);

-- Allow Master Admin full control
DROP POLICY IF EXISTS "Allow write operations for authorized masters" ON public.licenses;
CREATE POLICY "Allow write operations for authorized masters" ON public.licenses 
    FOR ALL USING (true) WITH CHECK (true);


-- Create Sales Central Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id VARCHAR(255) NOT NULL,
    shop_id VARCHAR(255),
    items JSONB NOT NULL,
    total NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    cashier_id VARCHAR(255) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    customer_name VARCHAR(255),
    loyalty_points_earned INT DEFAULT 0,
    discount JSONB,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) DEFAULT 16.00,
    cash_received NUMERIC(15, 2),
    change NUMERIC(15, 2),
    status VARCHAR(50) DEFAULT 'COMPLETED',
    mpesa_reference VARCHAR(100),
    etims_control_number VARCHAR(120),
    etims_qr_code TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_sales_business;
DROP INDEX IF EXISTS idx_sales_timestamp;
CREATE INDEX idx_sales_business ON public.sales(business_id);
CREATE INDEX idx_sales_timestamp ON public.sales(timestamp);

DROP POLICY IF EXISTS "Allow anonymous sales upload" ON public.sales;
CREATE POLICY "Allow anonymous sales upload" ON public.sales 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Master reading of metrics" ON public.sales;
CREATE POLICY "Allow Master reading of metrics" ON public.sales 
    FOR SELECT USING (true);


-- Create Piracy / Security Alerts Table
CREATE TABLE IF NOT EXISTS public.piracy_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id VARCHAR(255),
    license_key VARCHAR(255),
    alert_type VARCHAR(100), -- 'CASH_DRAWER_KICK', 'TAMPER', 'HARDWARE_CLONE'
    message TEXT,
    triggered_by VARCHAR(255),
    machine_id VARCHAR(255),
    resolved BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist dynamically for pre-existing piracy_alerts tables
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS business_id VARCHAR(255);
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS license_key VARCHAR(255);
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(100);
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(255);
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS machine_id VARCHAR(255);
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS license_id VARCHAR(255);

-- Ensure public.sales is fully complete as well
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS business_id VARCHAR(255);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255);

-- Enable RLS
ALTER TABLE public.piracy_alerts ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_piracy_alerts_key;
CREATE INDEX idx_piracy_alerts_key ON public.piracy_alerts(license_key);

DROP POLICY IF EXISTS "Allow public alerts reporting" ON public.piracy_alerts;
CREATE POLICY "Allow public alerts reporting" ON public.piracy_alerts 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Master alerts monitoring" ON public.piracy_alerts;
CREATE POLICY "Allow Master alerts monitoring" ON public.piracy_alerts 
    FOR SELECT USING (true);


-- Create Login History Audit Table
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED'
    ip_address VARCHAR(100),
    device TEXT,
    browser VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow login tracking recording" ON public.login_history;
CREATE POLICY "Allow login tracking recording" ON public.login_history 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow audit inspection" ON public.login_history;
CREATE POLICY "Allow audit inspection" ON public.login_history 
    FOR SELECT USING (true);


-- Create Cloud Sync State Backup table
CREATE TABLE IF NOT EXISTS public.cloud_sync_state (
    id VARCHAR(255) PRIMARY KEY, -- 'central_db' or unique client license ID
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cloud_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow backup syncing" ON public.cloud_sync_state;
CREATE POLICY "Allow backup syncing" ON public.cloud_sync_state 
    FOR ALL USING (true) WITH CHECK (true);


-- ====================================================================
-- SECTION 2: POS Tenant Database Tables (Local schemas or tenant nodes)
-- ====================================================================

-- 1. Business Profiles
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'retail', 'restaurant', 'hotel', 'hardware'
    currency VARCHAR(20) DEFAULT 'KSh',
    tax_rate NUMERIC(5, 2) DEFAULT 16.00,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo TEXT, -- Base64 Data URI or Image URL
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Shop/Store Outlets
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    phone VARCHAR(50),
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    image_url TEXT,
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Product Variants (Prices & Stocks per SKU)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    barcode VARCHAR(100),
    name VARCHAR(100) DEFAULT 'Default',
    buying_price NUMERIC(15, 2) DEFAULT 0.00,
    price NUMERIC(15, 2) NOT NULL,
    stock INT DEFAULT 0,
    min_stock_alert INT DEFAULT 5,
    expiry_date DATE
);

-- 5. Customers (CRM & Loyalty Programs)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    loyalty_points INT DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'BRONZE',
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Direct Sales Item Breakdown
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    buying_price NUMERIC(15, 2) DEFAULT 0.00,
    price NUMERIC(15, 2) NOT NULL
);

-- 7. Expenses (Daily Petty Cash Outflows)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- 'Rent', 'Wages', 'Transport', 'Marketing'
    amount NUMERIC(15, 2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    outstanding_balance NUMERIC(15, 2) DEFAULT 0.00,
    synced BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Employees (HRM Module)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL, -- 'ADMIN', 'CASHIER', 'MANAGER'
    salary NUMERIC(15, 2) DEFAULT 0.00,
    hire_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE'
);

-- 10. Employee Attendance Tracker
CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in VARCHAR(30) NOT NULL,
    check_out VARCHAR(30),
    status VARCHAR(50) DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'LATE'
    notes TEXT
);

-- 11. Customer Credit & Debt Tracker
CREATE TABLE IF NOT EXISTS public.customer_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    remaining_amount NUMERIC(15, 2) NOT NULL,
    due_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' -- 'PENDING', 'PAID', 'OVERDUE'
);

-- 12. Airbnb or Hotel Guest Requests
CREATE TABLE IF NOT EXISTS public.guest_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    request_type VARCHAR(100) NOT NULL, -- 'bill', 'service', 'taxi', 'food'
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'COMPLETED'
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Trails & Ledger Entries
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL, -- References Customer ID or Supplier ID
    entity_type VARCHAR(50) NOT NULL, -- 'CUSTOMER' | 'SUPPLIER'
    type VARCHAR(50) NOT NULL, -- 'DEBIT' | 'CREDIT'
    amount NUMERIC(15, 2) NOT NULL,
    balance_after NUMERIC(15, 2) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
