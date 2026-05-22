-- Supabase Migration Script v3 - Comprehensive Schema Fix
-- This script safely ensures all tables and columns exist for DMi POS.
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

-- 3. SCHEMA HARDENING (Adding missing columns to existing tables)
DO $$
BEGIN
    -- LEDGER_ENTRIES: The critical table for the current bug
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
        -- Ensure columns exist in ledger_entries
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='business_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='shop_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN shop_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='entity_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN entity_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='entity_type') THEN
            ALTER TABLE ledger_entries ADD COLUMN entity_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='balance_after') THEN
            ALTER TABLE ledger_entries ADD COLUMN balance_after DECIMAL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='reference_id') THEN
            ALTER TABLE ledger_entries ADD COLUMN reference_id UUID;
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
        -- Ensure business_id exists in sales
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='business_id') THEN
            ALTER TABLE sales ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='client_name') THEN
            ALTER TABLE sales ADD COLUMN client_name TEXT;
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

    -- DEBTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='debts') THEN
        CREATE TABLE debts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            customer_id UUID,
            amount DECIMAL NOT NULL,
            remaining_amount DECIMAL NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='business_id') THEN
            ALTER TABLE debts ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- CUSTOMERS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
        CREATE TABLE customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
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

    -- INVENTORY_LOGS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='inventory_logs') THEN
        CREATE TABLE inventory_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
            product_id UUID,
            type TEXT NOT NULL,
            quantity DECIMAL NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_logs' AND column_name='business_id') THEN
            ALTER TABLE inventory_logs ADD COLUMN business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- LOGIN_HISTORY
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='login_history') THEN
        CREATE TABLE login_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            user_name TEXT,
            role TEXT,
            status TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;

    -- PIRACY_ALERTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='piracy_alerts') THEN
        CREATE TABLE piracy_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
            message TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;

END $$;

-- 4. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ledger_business_id ON ledger_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entity_id ON ledger_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_debts_business_id ON debts(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
