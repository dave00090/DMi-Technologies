-- ====================================================================
-- DMi TECHNOLOGIES KENYA - MASTER DATABASE SCHEMA (IDEMPOTENT & SAFE)
-- ====================================================================

-- 1. MASTER LICENSES TABLE
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'LOCKED', 'EXPIRED')),
    machine_id VARCHAR(255),
    authorized_domain VARCHAR(255),
    system_name VARCHAR(255) DEFAULT 'RetailMaster',
    plan_type VARCHAR(100) DEFAULT 'Bronze Standard',
    license_fee NUMERIC(15, 2) DEFAULT 0.00,
    penalty_amount NUMERIC(15, 2) DEFAULT 0.00,
    grace_period_days INT DEFAULT 7,
    expires_at TIMESTAMP WITH TIME ZONE,
    expiry_date DATE,
    payment_status VARCHAR(50) DEFAULT 'PENDING',
    payment_phone VARCHAR(50),
    mpesa_reference VARCHAR(100),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure backwards-compatible columns exist
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS & Indexes
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

-- Idempotent RLS Policies (Safe re-runs)
DROP POLICY IF EXISTS "Allow public select for active checks" ON public.licenses;
CREATE POLICY "Allow public select for active checks" ON public.licenses 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write operations for authorized masters" ON public.licenses;
CREATE POLICY "Allow write operations for authorized masters" ON public.licenses 
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime Safely (Prevents "already member" error)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'licenses'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.licenses;
    END IF;
  END IF;
END $$;


-- 2. CENTRAL SALES METRICS TABLE
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id VARCHAR(255) NOT NULL,
    shop_id VARCHAR(255),
    items JSONB NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    cashier_id VARCHAR(255) DEFAULT 'SYSTEM',
    cashier_name VARCHAR(255) DEFAULT 'Staff',
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

-- Ensure both 'total' and 'total_amount' exist and are kept in sync
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) DEFAULT 0.00;
UPDATE public.sales 
SET total = COALESCE(total, total_amount, 0), 
    total_amount = COALESCE(total_amount, total, 0) 
WHERE total IS NULL OR total_amount IS NULL;

-- Enable RLS & Indexes
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sales_business ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp);

DROP POLICY IF EXISTS "Allow anonymous sales upload" ON public.sales;
CREATE POLICY "Allow anonymous sales upload" ON public.sales 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Master reading of metrics" ON public.sales;
CREATE POLICY "Allow Master reading of metrics" ON public.sales 
    FOR SELECT USING (true);


-- 3. PIRACY & SECURITY AUDIT ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.piracy_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id VARCHAR(255),
    license_key VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) DEFAULT 'PIRACY',
    reason TEXT,
    message TEXT,
    triggered_by VARCHAR(255),
    machine_id VARCHAR(255),
    resolved BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all message/reason columns exist
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.piracy_alerts ADD COLUMN IF NOT EXISTS message TEXT;

-- Enable RLS & Indexes
ALTER TABLE public.piracy_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_piracy_alerts_key ON public.piracy_alerts(license_key);

DROP POLICY IF EXISTS "Allow public alerts reporting" ON public.piracy_alerts;
CREATE POLICY "Allow public alerts reporting" ON public.piracy_alerts 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Master alerts monitoring" ON public.piracy_alerts;
CREATE POLICY "Allow Master alerts monitoring" ON public.piracy_alerts 
    FOR SELECT USING (true);

-- Enable Supabase Realtime Safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'piracy_alerts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.piracy_alerts;
    END IF;
  END IF;
END $$;


-- 4. LOGIN HISTORY AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    ip_address VARCHAR(100),
    device TEXT,
    browser VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow login tracking recording" ON public.login_history;
CREATE POLICY "Allow login tracking recording" ON public.login_history 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow audit inspection" ON public.login_history;
CREATE POLICY "Allow audit inspection" ON public.login_history 
    FOR SELECT USING (true);


-- 5. CLOUD BACKUP SYNC SNAPSHOT TABLE
CREATE TABLE IF NOT EXISTS public.cloud_sync_state (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cloud_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow backup syncing" ON public.cloud_sync_state;
CREATE POLICY "Allow backup syncing" ON public.cloud_sync_state 
    FOR ALL USING (true) WITH CHECK (true);