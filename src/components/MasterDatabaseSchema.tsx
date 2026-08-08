import React, { useState } from 'react';
import { Copy, Check, Search, Database, Terminal, FileCode, CheckCircle } from 'lucide-react';

interface SchemaItem {
  name: string;
  description: string;
  sql: string;
}

export const MasterDatabaseSchema: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'master' | 'tenant' | 'queries'>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleCopy = (name: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const masterTables: SchemaItem[] = [
    {
      name: 'licenses',
      description: 'Stores master client hardware credentials, activation keys, expiration metadata, subscription levels (Bronze/Silver/Gold), and M-Pesa lock statuses.',
      sql: `CREATE TABLE IF NOT EXISTS public.licenses (
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
    business_id VARCHAR(255),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure backwards-compatible columns
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS business_id VARCHAR(255);

-- Enable RLS & Indexes
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Allow public select for active checks" ON public.licenses;
CREATE POLICY "Allow public select for active checks" ON public.licenses 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write operations for authorized masters" ON public.licenses;
CREATE POLICY "Allow write operations for authorized masters" ON public.licenses 
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime Safely
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
END $$;`
    },
    {
      name: 'sales',
      description: 'Centrally records real-time terminal checkout figures, item arrays, and mpesa references for analytical reporting.',
      sql: `CREATE TABLE IF NOT EXISTS public.sales (
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

-- Ensure backwards-compatible columns exist
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 16.00;
UPDATE public.sales SET total = COALESCE(total, total_amount, 0), total_amount = COALESCE(total_amount, total, 0) WHERE total IS NULL OR total_amount IS NULL;

-- Enable RLS & Indexes
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sales_business ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp);

DROP POLICY IF EXISTS "Allow anonymous sales upload" ON public.sales;
CREATE POLICY "Allow anonymous sales upload" ON public.sales 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Master reading of metrics" ON public.sales;
CREATE POLICY "Allow Master reading of metrics" ON public.sales 
    FOR SELECT USING (true);`
    },
    {
      name: 'piracy_alerts',
      description: 'Security audit trail log storing hardware cloning warnings, key tampering, manual cash drawer kicks, and licensing violations.',
      sql: `CREATE TABLE IF NOT EXISTS public.piracy_alerts (
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

-- Ensure columns exist
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
END $$;`
    },
    {
      name: 'login_history',
      description: 'Maintains secure audit logs of system login success and failure actions of cashiers or admins across local terminals.',
      sql: `CREATE TABLE IF NOT EXISTS public.login_history (
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
    FOR SELECT USING (true);`
    },
    {
      name: 'cloud_sync_state',
      description: 'Secure backup snapshot store containing fully synced json state packets for robust offline disaster recoveries.',
      sql: `CREATE TABLE IF NOT EXISTS public.cloud_sync_state (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cloud_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow backup syncing" ON public.cloud_sync_state;
CREATE POLICY "Allow backup syncing" ON public.cloud_sync_state 
    FOR ALL USING (true) WITH CHECK (true);`
    }
  ];

  const tenantTables: SchemaItem[] = [
    {
      name: 'businesses & shops',
      description: 'Stores profile metadata, operational configurations, and outlet branches of client local-first installations.',
      sql: `CREATE TABLE IF NOT EXISTS public.businesses (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'retail', 'restaurant', 'hotel', 'hardware'
    currency VARCHAR(20) DEFAULT 'KSh',
    tax_rate NUMERIC(5, 2) DEFAULT 16.00,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    synced BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.shops (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    phone VARCHAR(50)
);`
    },
    {
      name: 'products & variants',
      description: 'Holds stock inventory quantities, Barcode scan records, buying rates, and customized consumer pricing structures.',
      sql: `CREATE TABLE IF NOT EXISTS public.products (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id VARCHAR(255) REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    category VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) REFERENCES public.products(id) ON DELETE CASCADE,
    barcode VARCHAR(100),
    name VARCHAR(100) DEFAULT 'Default',
    buying_price NUMERIC(15, 2) DEFAULT 0.00,
    price NUMERIC(15, 2) NOT NULL,
    stock INT DEFAULT 0,
    min_stock_alert INT DEFAULT 5,
    expiry_date DATE
);`
    },
    {
      name: 'sales & items breakdown',
      description: 'Decentralized transactional logs capturing specific checkout totals, cashier identifiers, and itemised checkout quantities.',
      sql: `CREATE TABLE IF NOT EXISTS public.sale_items (
    id VARCHAR(255) PRIMARY KEY,
    sale_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    buying_price NUMERIC(15, 2) DEFAULT 0.00,
    price NUMERIC(15, 2) NOT NULL
);`
    },
    {
      name: 'employees, attendance & desk requests',
      description: 'Fulfills high-level HRMS modules, staff logins, automatic presenter checkins, and live lodge guest request triggers.',
      sql: `CREATE TABLE IF NOT EXISTS public.employees (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id VARCHAR(255) REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'ADMIN', 'CASHIER', 'MANAGER'
    salary NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id VARCHAR(255) PRIMARY KEY,
    employee_id VARCHAR(255) REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in VARCHAR(30) NOT NULL,
    check_out VARCHAR(30),
    status VARCHAR(50) DEFAULT 'PRESENT'
);

CREATE TABLE IF NOT EXISTS public.guest_requests (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id VARCHAR(255) REFERENCES public.shops(id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    request_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING'
);`
    },
    {
      name: 'customer debts & general ledgers',
      description: 'Records outstanding client credit balances, payments, interest margins, and operational audit trail logs.',
      sql: `CREATE TABLE IF NOT EXISTS public.customer_debts (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id VARCHAR(255) REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id VARCHAR(255) NOT NULL,
    sale_id VARCHAR(255) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    remaining_amount NUMERIC(15, 2) NOT NULL,
    due_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'CUSTOMER' | 'SUPPLIER'
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    balance_after NUMERIC(15, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    recorded_by VARCHAR(255),
    receipt_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.customers (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    loyalty_points INT DEFAULT 0,
    total_spent NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255) REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    category VARCHAR(100),
    total_supplied NUMERIC(15, 2) DEFAULT 0.00,
    total_paid NUMERIC(15, 2) DEFAULT 0.00,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
    }
  ];

  const queries: SchemaItem[] = [
    {
      name: 'profit_and_loss_analytics',
      description: 'Computes total profit margins automatically by auditing raw sales turnover, inventory costs (COGs), and daily petty expenses.',
      sql: `-- Ensure columns and tables exist before computing analytics
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS public.expenses (
    id VARCHAR(255) PRIMARY KEY,
    business_id VARCHAR(255),
    shop_id VARCHAR(255),
    category VARCHAR(100),
    amount NUMERIC(15, 2) DEFAULT 0.00,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    recorded_by VARCHAR(255),
    receipt_url TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

WITH revenue_summary AS (
    SELECT 
        COALESCE(SUM(total), 0) AS gross_sales_revenue,
        COALESCE(SUM(tax_amount), 0) AS gathered_sales_tax
    FROM public.sales 
    WHERE timestamp::DATE = CURRENT_DATE
),
cost_summary AS (
    SELECT 
        COALESCE(SUM((item->>'buying_price')::NUMERIC * (item->>'quantity')::INT), 0) AS inventory_cogs
    FROM public.sales,
    LATERAL jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS item
    WHERE timestamp::DATE = CURRENT_DATE
),
expense_summary AS (
    SELECT 
        COALESCE(SUM(amount), 0) AS total_daily_petty_expenses
    FROM public.expenses 
    WHERE date = CURRENT_DATE
)
SELECT 
    rev.gross_sales_revenue,
    rev.gathered_sales_tax,
    costs.inventory_cogs,
    exp.total_daily_petty_expenses,
    (rev.gross_sales_revenue - costs.inventory_cogs) AS gross_profit,
    (rev.gross_sales_revenue - costs.inventory_cogs - exp.total_daily_petty_expenses) AS net_profit
FROM revenue_summary rev
CROSS JOIN cost_summary costs
CROSS JOIN expense_summary exp;`
    },
    {
      name: 'manual_cash_drawer_kick_logs',
      description: 'Security audit selection displaying all unauthorized cash drawer open events to master supervisors.',
      sql: `SELECT 
    message AS audit_message, 
    triggered_by AS cashier_reference, 
    machine_id AS terminal_host_fingerprint, 
    timestamp AS logged_time
FROM public.piracy_alerts
WHERE alert_type = 'CASH_DRAWER_KICK'
ORDER BY timestamp DESC;`
    },
    {
      name: 'licensing_health_summaries',
      description: 'Renders central diagnostic dashboard values on expected subscription incomes, registered users, and system locks.',
      sql: `SELECT 
    COUNT(*) FILTER(WHERE status = 'ACTIVE') AS active_systems,
    SUM(license_fee) AS expected_subscriptions_mrr,
    COALESCE(SUM(penalty_amount), 0) AS historical_collected_penalties,
    (SELECT COUNT(*) FROM public.piracy_alerts WHERE resolved = false) AS pending_security_breaches
FROM public.licenses;`
    },
    {
      name: 'low_stock_automatic_triggers',
      description: 'Instantly identifies inventory variants running below preset safety stock trigger limits.',
      sql: `SELECT 
    p.name AS product_label, 
    v.Barcode AS variant_barcode_label, 
    v.stock AS remaining_stock, 
    v.min_stock_alert AS warning_limit
FROM product_variants v
JOIN products p ON v.product_id = p.id
WHERE v.stock <= v.min_stock_alert
ORDER BY v.stock ASC;`
    }
  ];

  const getActiveArray = () => {
    switch (activeTab) {
      case 'master': return masterTables;
      case 'tenant': return tenantTables;
      case 'queries': return queries;
    }
  };

  const filteredItems = getActiveArray().filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sql.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            SQL Schema & Query Library
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Standard PostgreSQL schemas and analytical queries configured for master servers and offline client tenants.
          </p>
        </div>
        <div className="relative shrink-0 w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search schemas or SQL queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-850 gap-2">
        <button
          onClick={() => { setActiveTab('master'); setSearchQuery(''); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'master' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-350'}`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Master Admin (Supabase)
        </button>
        <button
          onClick={() => { setActiveTab('tenant'); setSearchQuery(''); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'tenant' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-350'}`}
        >
          <Database className="w-3.5 h-3.5" />
          POS Tenants
        </button>
        <button
          onClick={() => { setActiveTab('queries'); setSearchQuery(''); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'queries' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-350'}`}
        >
          <FileCode className="w-3.5 h-3.5" />
          Analytical Queries
        </button>
      </div>

      {/* Tables & Code Render */}
      <div className="space-y-6">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
            No matching SQL structures or queries found for "{searchQuery}".
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.name} className="bg-slate-950/70 border border-slate-850 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-slate-900/30 border-b border-slate-850 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    {activeTab === 'queries' ? `${item.name}.sql` : `table: ${item.name}`}
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed mt-1">{item.description}</p>
                </div>
                <button
                  onClick={() => handleCopy(item.name, item.sql)}
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${copiedName === item.name ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-400'}`}
                >
                  {copiedName === item.name ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy DDL
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 bg-slate-950">
                <pre className="text-[11px] font-mono text-indigo-200/90 leading-relaxed overflow-x-auto max-h-72 p-2 scrollbar-thin scrollbar-thumb-slate-800">
                  <code>{item.sql}</code>
                </pre>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center gap-4 text-xs">
        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
          <CheckCircle className="w-4 h-4" />
        </div>
        <p className="text-slate-400">
          All central licensing matrices are mapped to the live production database. You can instantly run any of the above table definitions (DDL) directly in your main host console or database cluster shell.
        </p>
      </div>
    </div>
  );
};
