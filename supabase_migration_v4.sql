-- Supabase Migration Script v4 - Final Comprehensive Schema Fix
-- This script safely ensures all tables and all columns exist for DMi POS.
-- It handles missing tables, missing columns, and foreign keys gracefully.
-- Run this in the Supabase SQL Editor.

-- 1. EXTENSION SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CORE TABLES (Ensuring base tables exist)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo TEXT,
    currency TEXT DEFAULT 'KSh',
    tax_rate DECIMAL DEFAULT 0,
    mpesa_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. DOMAIN TABLES & SCHEMA HARDENING
DO $$
BEGIN
    -- CUSTOMERS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
        CREATE TABLE customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT NOT NULL,
            loyalty_points INTEGER DEFAULT 0,
            total_spent DECIMAL DEFAULT 0,
            last_purchase_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_id') THEN
            ALTER TABLE customers ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- SUPPLIERS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='suppliers') THEN
        CREATE TABLE suppliers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='business_id') THEN
            ALTER TABLE suppliers ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- PRODUCTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products') THEN
        CREATE TABLE products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT,
            buying_price DECIMAL DEFAULT 0,
            selling_price DECIMAL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='business_id') THEN
            ALTER TABLE products ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='shop_id') THEN
            ALTER TABLE products ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- SALES
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sales') THEN
        CREATE TABLE sales (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            items JSONB NOT NULL,
            total DECIMAL NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            cashier_id TEXT NOT NULL,
            cashier_name TEXT NOT NULL,
            customer_id TEXT,
            customer_name TEXT,
            loyalty_points_earned INTEGER DEFAULT 0,
            discount JSONB DEFAULT '{}'::jsonb,
            payment_method TEXT NOT NULL,
            mpesa_reference TEXT,
            etims_control_number TEXT,
            etims_qr_code TEXT,
            tax_amount DECIMAL DEFAULT 0,
            tax_rate DECIMAL DEFAULT 0,
            cash_received DECIMAL,
            change DECIMAL,
            client_name TEXT
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='business_id') THEN
            ALTER TABLE sales ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_id') THEN
            ALTER TABLE sales ADD COLUMN customer_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='shop_id') THEN
            ALTER TABLE sales ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- DEBTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='debts') THEN
        CREATE TABLE debts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
            amount DECIMAL NOT NULL,
            remaining_amount DECIMAL NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='business_id') THEN
            ALTER TABLE debts ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='customer_id') THEN
            ALTER TABLE debts ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='shop_id') THEN
            ALTER TABLE debts ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- EMPLOYEES
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='employees') THEN
        CREATE TABLE employees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT NOT NULL,
            role TEXT NOT NULL,
            salary DECIMAL DEFAULT 0,
            hire_date DATE,
            status TEXT DEFAULT 'ACTIVE',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;

    -- ATTENDANCE
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='attendance') THEN
        CREATE TABLE attendance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            check_in TIME NOT NULL,
            check_out TIME,
            status TEXT DEFAULT 'PRESENT',
            notes TEXT
        );
    END IF;

    -- PAYROLL
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payroll') THEN
        CREATE TABLE payroll (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
            period TEXT NOT NULL,
            base_salary DECIMAL DEFAULT 0,
            net_salary DECIMAL DEFAULT 0,
            payment_date DATE NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;

    -- ALERTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alerts') THEN
        CREATE TABLE alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            status TEXT DEFAULT 'UNREAD'
        );
    END IF;

    -- LEDGER_ENTRIES
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='ledger_entries') THEN
        CREATE TABLE ledger_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID,
            entity_id UUID NOT NULL,
            entity_type TEXT NOT NULL,
            type TEXT NOT NULL,
            amount DECIMAL NOT NULL,
            balance_after DECIMAL NOT NULL,
            description TEXT,
            reference_id UUID,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='business_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='entity_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN entity_id UUID;
        END IF;
    END IF;

    -- EXPENSES
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='expenses') THEN
        CREATE TABLE expenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            amount DECIMAL NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            payment_method TEXT NOT NULL,
            recorded_by TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='business_id') THEN
            ALTER TABLE expenses ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- LICENSES
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='licenses') THEN
        CREATE TABLE licenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_key TEXT UNIQUE NOT NULL,
            client_name TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            machine_id TEXT,
            authorized_domain TEXT,
            system_name TEXT DEFAULT 'DMI-POS',
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            penalty_amount DECIMAL DEFAULT 0,
            license_fee DECIMAL DEFAULT 0,
            grace_period_days INTEGER DEFAULT 7,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;

    -- INVENTORY_LOGS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='inventory_logs') THEN
        CREATE TABLE inventory_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            product_id UUID REFERENCES products(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            quantity DECIMAL NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_logs' AND column_name='business_id') THEN
            ALTER TABLE inventory_logs ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

END $$;

-- 4. FINAL INDEXES
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_business_id ON ledger_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entity_id ON ledger_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_debts_business_id ON debts(business_id);
CREATE INDEX IF NOT EXISTS idx_debts_customer_id ON debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
