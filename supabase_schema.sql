-- =========================================================================
--                     SUPABASE / POSTGRES DATABASE SCHEMA
--            Designed for DMi POS Retail Hybrid Sync
-- =========================================================================
-- This script configures the exact database tables, structural constraints,
-- composite JSONB types, indexes, row-level security policies (RLS),
-- and auto-inventory triggers for DMi POS.
--
-- Instructions:
-- 1. Log in to your Supabase Console (https://supabase.com).
-- 2. Select your Project -> Click on "SQL Editor" on the left sidebar.
-- 3. Paste this entire query in a new query window and click "Run".
-- =========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =========================================================================
--             0. DYNAMIC DUAL-SUPPORT MIGRATE: DROP ALL CONSTRAINTS & CONVERT UUIDs TO TEXT
-- =========================================================================
-- We dynamically find and drop all foreign key constraints in the public schema
-- pointing to or from our tables. This allows us to convert existing uuid/int ID 
-- and foreign key columns to text, accommodating hybrid client-generated keys.
-- After modifying types to text, we safely re-connect the foreign keys.
-- =========================================================================
do $$
declare
    r record;
begin
    -- 1. Create a temporary table to track relationships that need to be drop-converted-rebound
    create temp table if not exists temp_fkeys (
        constraint_name text,
        source_table text,
        source_column text,
        referenced_table text,
        referenced_column text
    ) on commit drop;
    
    truncate temp_fkeys;

    -- 2. Find any foreign keys pointing to or from DMi POS tables in the public schema
    insert into temp_fkeys
    select distinct
        tc.constraint_name,
        kcu.table_name as source_table,
        kcu.column_name as source_column,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
    from 
        information_schema.table_constraints as tc 
        join information_schema.key_column_usage as kcu
          on tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
        join information_schema.constraint_column_usage as ccu
          on ccu.constraint_name = tc.constraint_name
          and ccu.table_schema = tc.table_schema
    where 
        tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and (
            tc.table_name in ('businesses', 'shops', 'products', 'sales', 'customers', 'suppliers', 'expenses', 'employees', 'attendance', 'payroll', 'debts', 'ledger', 'guest_requests', 'sale_items', 'licenses', 'login_history', 'piracy_alerts')
            or ccu.table_name in ('businesses', 'shops', 'products', 'sales', 'customers', 'suppliers', 'expenses', 'employees', 'attendance', 'payroll', 'debts', 'ledger', 'guest_requests', 'sale_items', 'licenses', 'login_history', 'piracy_alerts')
        );

    -- 3. Safely drop all discovered foreign key constraints
    for r in (select * from temp_fkeys) loop
        execute format('alter table public.%I drop constraint if exists %I', r.source_table, r.constraint_name);
    end loop;

    -- 4. Convert all columns involved in those foreign keys to text (both source and referenced)
    for r in (select distinct source_table, source_column from temp_fkeys) loop
        execute format('alter table public.%I alter column %I type text using %I::text', r.source_table, r.source_column, r.source_column);
    end loop;
    
    for r in (select distinct referenced_table, referenced_column from temp_fkeys) loop
        execute format('alter table public.%I alter column %I type text using %I::text', r.referenced_table, r.referenced_column, r.referenced_column);
    end loop;

    -- 5. Force-convert our specific schemas columns to text (even if they have no active foreign key relationships yet)
    declare
        t text;
        c text;
        tables_cols text[][] := array[
            array['businesses', 'id'],
            array['shops', 'id'],
            array['shops', 'business_id'],
            array['products', 'id'],
            array['products', 'business_id'],
            array['products', 'shop_id'],
            array['sales', 'id'],
            array['sales', 'business_id'],
            array['sales', 'shop_id'],
            array['sales', 'customer_id'],
            array['customers', 'id'],
            array['customers', 'business_id'],
            array['suppliers', 'id'],
            array['suppliers', 'business_id'],
            array['expenses', 'id'],
            array['expenses', 'business_id'],
            array['expenses', 'shop_id'],
            array['employees', 'id'],
            array['employees', 'business_id'],
            array['employees', 'shop_id'],
            array['attendance', 'id'],
            array['attendance', 'employee_id'],
            array['payroll', 'id'],
            array['payroll', 'employee_id'],
            array['debts', 'id'],
            array['debts', 'business_id'],
            array['debts', 'shop_id'],
            array['debts', 'customer_id'],
            array['debts', 'sale_id'],
            array['ledger', 'id'],
            array['ledger', 'business_id'],
            array['ledger', 'shop_id'],
            array['guest_requests', 'id'],
            array['guest_requests', 'business_id'],
            array['guest_requests', 'shop_id'],
            array['sale_items', 'id'],
            array['sale_items', 'sale_id'],
            array['sale_items', 'product_id'],
            array['licenses', 'id'],
            array['login_history', 'id'],
            array['piracy_alerts', 'id'],
            array['piracy_alerts', 'license_id']
        ];
    begin
        for i in 1 .. array_upper(tables_cols, 1) loop
            t := tables_cols[i][1];
            c := tables_cols[i][2];
            if exists (
                select 1 
                from information_schema.columns 
                where table_schema = 'public' 
                  and table_name = t 
                  and column_name = c
            ) then
                execute format('alter table public.%I alter column %I type text using %I::text', t, c, c);
            end if;
        end loop;
    end;

    -- 6. Safely re-establish the foreign key constraints with matching "text" types
    for r in (select * from temp_fkeys) loop
        begin
            execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete cascade', 
                r.source_table, r.constraint_name, r.source_column, r.referenced_table, r.referenced_column);
        exception when others then
            -- Fallback or log if constraint cannot be rebound immediately
            raise notice 'Could not automatically restore foreign key % on %.%: %', r.constraint_name, r.source_table, r.source_column, SQLERRM;
        end;
    end loop;
end;
$$;

-- ==========================================
-- 1. BUSINESSES TABLE
-- ==========================================
create table if not exists public.businesses (
    id text primary key, -- Direct terminal UUID/Id mapping
    name text not null,
    type text default 'RETAIL', -- RETAIL, HARDWARE, PHARMACY, etc.
    address text,
    phone text,
    email text,
    logo text,
    currency text default 'KES',
    tax_rate numeric(5,2) default 16.00,
    mpesa_config jsonb, -- Safe flexible key store for M-Pesa client credentials
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 2. SHOPS TABLE
-- ==========================================
create table if not exists public.shops (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    name text not null,
    location text,
    phone text,
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 3. PRODUCTS TABLE
-- ==========================================
create table if not exists public.products (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    name text not null,
    category text default 'General',
    buying_price numeric(12,2) default 0.00,
    selling_price numeric(12,2) default 0.00,
    base_price numeric(12,2) default 0.00,
    variants jsonb default '[]'::jsonb, -- Array of Variant objects: {id, size, color, stock, sku, lowStockThreshold, price}
    low_stock_threshold integer default 5,
    description text,
    image_url text,
    type text default 'PRODUCT', -- PRODUCT or SERVICE
    
    -- Retail & Industry specific nullable properties
    expiry_date date,
    batch_number text,
    part_number text,
    model_compatibility text,
    alcohol_percentage numeric(5,2),
    volume text,
    brand text,
    warranty text,
    unit text default 'pcs', -- kg, pcs, litres, etc.
    
    -- Hospitality / Service specific properties
    duration integer, -- in minutes
    room_type text,
    fuel_type text, -- PETROL, DIESEL, etc.
    material text,
    ingredients jsonb,
    
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 4. SALES TABLE
-- ==========================================
create table if not exists public.sales (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    items jsonb not null default '[]'::jsonb, -- Array of SaleItem objects: {productId, variantId, name, quantity, price, originalPrice, buyingPrice}
    total numeric(12,2) not null,
    timestamp timestamp with time zone not null,
    cashier_id text not null,
    cashier_name text not null,
    customer_id text,
    customer_name text,
    loyalty_points_earned integer default 0,
    discount jsonb, -- {type: 'percentage'|'fixed', value, amount, code}
    payment_method text not null, -- CASH, MPESA, CARD, DEBT
    status text default 'COMPLETED', -- COMPLETED, PENDING_PAYMENT, CANCELLED
    mpesa_reference text,
    etims_control_number text,
    etims_qr_code text,
    tax_amount numeric(12,2),
    tax_rate numeric(5,2),
    cash_received numeric(12,2),
    change numeric(12,2),
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 5. CUSTOMERS TABLE
-- ==========================================
create table if not exists public.customers (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    name text not null,
    email text,
    phone text not null,
    loyalty_points integer default 0,
    total_spent numeric(12,2) default 0.00,
    last_purchase_date timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 6. SUPPLIERS TABLE
-- ==========================================
create table if not exists public.suppliers (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    name text not null,
    contact_person text,
    email text,
    phone text not null,
    address text,
    category text,
    total_supplied numeric(12,2) default 0.00,
    total_paid numeric(12,2) default 0.00,
    balance numeric(12,2) default 0.00,
    supplied_products jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 7. EXPENSES TABLE
-- ==========================================
create table if not exists public.expenses (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    category text not null,
    amount numeric(12,2) not null,
    description text,
    date date not null,
    payment_method text not null,
    recorded_by text not null,
    receipt_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 8. EMPLOYEES TABLE
-- ==========================================
create table if not exists public.employees (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    name text not null,
    email text,
    phone text not null,
    role text not null, -- admin, staff, manager, hr
    salary numeric(12,2) not null,
    hire_date date not null,
    status text default 'ACTIVE', -- ACTIVE, INACTIVE, ON_LEAVE
    national_id text,
    emergency_contact text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 9. ATTENDANCE TABLE
-- ==========================================
create table if not exists public.attendance (
    id text primary key,
    employee_id text references public.employees(id) on delete cascade,
    date date not null,
    check_in text not null,
    check_out text,
    status text default 'PRESENT', -- PRESENT, ABSENT, LATE, LEAVE
    notes text,
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 10. PAYROLL TABLE
-- ==========================================
create table if not exists public.payroll (
    id text primary key,
    employee_id text references public.employees(id) on delete cascade,
    period text not null, -- "YYYY-MM"
    base_salary numeric(12,2) not null,
    allowances numeric(12,2) default 0.00,
    deductions numeric(12,2) default 0.00,
    net_salary numeric(12,2) not null,
    payment_date date not null,
    status text default 'PENDING', -- PENDING, PAID
    method text not null,
    reference text,
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 11. DEBTS TABLE
-- ==========================================
create table if not exists public.debts (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    customer_id text references public.customers(id) on delete cascade,
    amount numeric(12,2) not null,
    remaining_amount numeric(12,2) not null,
    due_date date not null,
    status text default 'PENDING', -- PENDING, PARTIAL, PAID, OVERDUE
    sale_id text references public.sales(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 12. LEDGER TABLE
-- ==========================================
create table if not exists public.ledger (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    entity_id text not null, -- Customer or Supplier terminal ID
    entity_type text not null, -- CUSTOMER or SUPPLIER
    type text not null, -- DEBIT or CREDIT
    amount numeric(12,2) not null,
    balance_after numeric(12,2) not null,
    description text,
    timestamp timestamp with time zone not null,
    reference_id text, -- ID of sale or purchase log
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 13. GUEST SUPPORT REQUESTS TABLE
-- ==========================================
create table if not exists public.guest_requests (
    id text primary key,
    business_id text references public.businesses(id) on delete cascade,
    shop_id text references public.shops(id) on delete cascade,
    room_no text not null,
    guest_name text not null,
    type text not null, -- REPAIR, FEEDBACK, SERVICE, HOUSEKEEPING
    title text not null,
    description text,
    rating integer, -- 1 to 5 stars if feedback
    priority text default 'MEDIUM', -- LOW, MEDIUM, HIGH
    status text default 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, RESOLVED
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 14. SALE LINE ITEMS TABLE
-- ==========================================
create table if not exists public.sale_items (
    id text primary key,
    sale_id text references public.sales(id) on delete cascade,
    product_id text references public.products(id) on delete cascade,
    variant_id text,
    name text not null,
    category text,
    variant_name text,
    quantity integer not null,
    price numeric(12,2) not null,
    original_price numeric(12,2) not null,
    buying_price numeric(12,2),
    unit text,
    last_updated timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 15. LICENSES TABLE (MASTER ADMIN)
-- ==========================================
create table if not exists public.licenses (
    id text primary key,
    license_key text unique not null,
    client_name text not null,
    status text default 'PENDING',
    machine_id text,
    authorized_domain text,
    system_name text default 'DMi POS',
    last_heartbeat timestamp with time zone,
    penalty_amount numeric(12,2) default 0.00,
    license_fee numeric(12,2) default 0.00,
    grace_period_days integer default 7,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 16. LOGIN HISTORY TABLE (MASTER ADMIN / AUDIT)
-- ==========================================
create table if not exists public.login_history (
    id text primary key,
    user_id text,
    user_name text,
    role text,
    status text,
    timestamp timestamp with time zone default timezone('utc'::text, now()),
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 17. PIRACY ALERTS TABLE (MASTER ADMIN / AUDIT)
-- ==========================================
create table if not exists public.piracy_alerts (
    id text primary key,
    license_id text references public.licenses(id) on delete cascade,
    message text,
    timestamp timestamp with time zone default timezone('utc'::text, now()),
    metadata jsonb,
    last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================
--             UPGRADE PRE-EXISTING TABLES WITH SYNC & ID COLUMNS
-- =========================================================================
-- If any of the tables already existed in your Supabase schema, they might
-- lack the sync-crucial "last_updated", "created_at", "business_id", or "shop_id" columns. 
-- These statements ensure those columns exist before we build triggers or indexes.
-- =========================================================================

-- Businesses & Shops patch
alter table public.businesses add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.businesses add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

alter table public.shops add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.shops add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.shops add column if not exists business_id text;

-- Products patch
alter table public.products add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.products add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.products add column if not exists business_id text;
alter table public.products add column if not exists shop_id text;

-- Sales patch
alter table public.sales add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.sales add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.sales add column if not exists business_id text;
alter table public.sales add column if not exists shop_id text;

-- Customers & Suppliers patch
alter table public.customers add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.customers add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.customers add column if not exists business_id text;

alter table public.suppliers add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.suppliers add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.suppliers add column if not exists business_id text;

-- Expenses patch
alter table public.expenses add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.expenses add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.expenses add column if not exists business_id text;
alter table public.expenses add column if not exists shop_id text;

-- Employees & Attendance & Payroll patch
alter table public.employees add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.employees add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.employees add column if not exists business_id text;
alter table public.employees add column if not exists shop_id text;

alter table public.attendance add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.attendance add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.attendance add column if not exists employee_id text;

alter table public.payroll add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.payroll add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.payroll add column if not exists employee_id text;

-- Debts & Ledger patch
alter table public.debts add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.debts add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.debts add column if not exists business_id text;
alter table public.debts add column if not exists shop_id text;
alter table public.debts add column if not exists customer_id text;
alter table public.debts add column if not exists sale_id text;

alter table public.ledger add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.ledger add column if not exists business_id text;
alter table public.ledger add column if not exists shop_id text;

-- Guest requests & Sale items patch
alter table public.guest_requests add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.guest_requests add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.guest_requests add column if not exists business_id text;
alter table public.guest_requests add column if not exists shop_id text;

alter table public.sale_items add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.sale_items add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.sale_items add column if not exists sale_id text;
alter table public.sale_items add column if not exists product_id text;

-- Licenses & piracy alerts patch
alter table public.licenses add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.licenses add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

alter table public.login_history add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());

alter table public.piracy_alerts add column if not exists last_updated timestamp with time zone default timezone('utc'::text, now());
alter table public.piracy_alerts add column if not exists timestamp timestamp with time zone default timezone('utc'::text, now());
alter table public.piracy_alerts add column if not exists license_id text;


-- =========================================================================
--            RE-ESTABLISH SAFE, CASCADE FOREIGN KEY RELATIONSHIPS
-- =========================================================================
-- Now that all tables exist and all primary/foreign ID columns have been
-- aligned to type "text", we recompile and bind all cascade foreign keys.
-- This guarantees perfect referential integrity regardless of table state.
-- =========================================================================

-- Shops
alter table public.shops drop constraint if exists shops_business_id_fkey;
alter table public.shops add constraint shops_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

-- Piracy Alerts fkey
alter table public.piracy_alerts drop constraint if exists piracy_alerts_license_id_fkey;
alter table public.piracy_alerts add constraint piracy_alerts_license_id_fkey foreign key (license_id) references public.licenses(id) on delete cascade;

-- Products
alter table public.products drop constraint if exists products_business_id_fkey;
alter table public.products add constraint products_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.products drop constraint if exists products_shop_id_fkey;
alter table public.products add constraint products_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Sales
alter table public.sales drop constraint if exists sales_business_id_fkey;
alter table public.sales add constraint sales_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.sales drop constraint if exists sales_shop_id_fkey;
alter table public.sales add constraint sales_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Customers
alter table public.customers drop constraint if exists customers_business_id_fkey;
alter table public.customers add constraint customers_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

-- Suppliers
alter table public.suppliers drop constraint if exists suppliers_business_id_fkey;
alter table public.suppliers add constraint suppliers_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

-- Expenses
alter table public.expenses drop constraint if exists expenses_business_id_fkey;
alter table public.expenses add constraint expenses_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.expenses drop constraint if exists expenses_shop_id_fkey;
alter table public.expenses add constraint expenses_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Employees
alter table public.employees drop constraint if exists employees_business_id_fkey;
alter table public.employees add constraint employees_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.employees drop constraint if exists employees_shop_id_fkey;
alter table public.employees add constraint employees_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Attendance
alter table public.attendance drop constraint if exists attendance_employee_id_fkey;
alter table public.attendance add constraint attendance_employee_id_fkey foreign key (employee_id) references public.employees(id) on delete cascade;

-- Payroll
alter table public.payroll drop constraint if exists payroll_employee_id_fkey;
alter table public.payroll add constraint payroll_employee_id_fkey foreign key (employee_id) references public.employees(id) on delete cascade;

-- Debts
alter table public.debts drop constraint if exists debts_business_id_fkey;
alter table public.debts add constraint debts_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.debts drop constraint if exists debts_shop_id_fkey;
alter table public.debts add constraint debts_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;
alter table public.debts drop constraint if exists debts_customer_id_fkey;
alter table public.debts add constraint debts_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;
alter table public.debts drop constraint if exists debts_sale_id_fkey;
alter table public.debts add constraint debts_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete cascade;

-- Ledger
alter table public.ledger drop constraint if exists ledger_business_id_fkey;
alter table public.ledger add constraint ledger_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.ledger drop constraint if exists ledger_shop_id_fkey;
alter table public.ledger add constraint ledger_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Guest requests Constraints
alter table public.guest_requests drop constraint if exists guest_requests_business_id_fkey;
alter table public.guest_requests add constraint guest_requests_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.guest_requests drop constraint if exists guest_requests_shop_id_fkey;
alter table public.guest_requests add constraint guest_requests_shop_id_fkey foreign key (shop_id) references public.shops(id) on delete cascade;

-- Sale Items Constraints
alter table public.sale_items drop constraint if exists sale_items_sale_id_fkey;
alter table public.sale_items add constraint sale_items_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete cascade;
alter table public.sale_items drop constraint if exists sale_items_product_id_fkey;
alter table public.sale_items add constraint sale_items_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade;

-- =========================================================================
--                     INDEXING FOR SYNCHRONIZATION SPEED
-- =========================================================================
-- These indexes accelerate incremental synchronization filters (which
-- filter queries by updated timetamps and tenant/business ids).
-- =========================================================================

create index if not exists idx_businesses_last_updated on public.businesses(last_updated);
create index if not exists idx_shops_business_id on public.shops(business_id);
create index if not exists idx_shops_last_updated on public.shops(last_updated);

create index if not exists idx_products_business_shop on public.products(business_id, shop_id);
create index if not exists idx_products_last_updated on public.products(last_updated);

create index if not exists idx_sales_business_shop on public.sales(business_id, shop_id);
create index if not exists idx_sales_timestamp on public.sales(timestamp);
create index if not exists idx_sales_last_updated on public.sales(last_updated);

create index if not exists idx_customers_business on public.customers(business_id);
create index if not exists idx_customers_last_updated on public.customers(last_updated);

create index if not exists idx_suppliers_business on public.suppliers(business_id);
create index if not exists idx_suppliers_last_updated on public.suppliers(last_updated);

create index if not exists idx_expenses_business_shop on public.expenses(business_id, shop_id);
create index if not exists idx_expenses_last_updated on public.expenses(last_updated);

create index if not exists idx_employees_business_shop on public.employees(business_id, shop_id);
create index if not exists idx_employees_last_updated on public.employees(last_updated);

create index if not exists idx_attendance_employee on public.attendance(employee_id);
create index if not exists idx_attendance_last_updated on public.attendance(last_updated);

create index if not exists idx_payroll_employee on public.payroll(employee_id);
create index if not exists idx_payroll_last_updated on public.payroll(last_updated);

create index if not exists idx_debts_business_shop on public.debts(business_id, shop_id);
create index if not exists idx_debts_customer on public.debts(customer_id);
create index if not exists idx_debts_last_updated on public.debts(last_updated);

create index if not exists idx_ledger_business_shop on public.ledger(business_id, shop_id);
create index if not exists idx_ledger_entity on public.ledger(entity_id);
create index if not exists idx_ledger_last_updated on public.ledger(last_updated);

-- Guest Requests & Sale Items Indexes
create index if not exists idx_guest_requests_business_shop on public.guest_requests(business_id, shop_id);
create index if not exists idx_guest_requests_last_updated on public.guest_requests(last_updated);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);
create index if not exists idx_sale_items_last_updated on public.sale_items(last_updated);


-- =========================================================================
--             AUTOMATIC CLOUD INVENTORY STOCK-DEDUCTION TRIGGER
-- =========================================================================
-- This Postgres dynamic trigger intercepts high-frequency local sales as they
-- sync with the cloud. It iterates over the "items" JSONB array inside the
-- sale, detects the corresponding productId & variantId, and deducts the quantity.
-- =========================================================================

create or replace function public.fn_auto_deduct_inventory_stock()
returns trigger as $$
declare
    sale_item jsonb;
    item_prod_id text;
    item_var_id text;
    item_qty int;
    product_rec record;
    updated_variants jsonb;
    var_rec jsonb;
    new_variants_arr jsonb;
begin
    -- Check if items list exists and is an array
    if NEW.items is not null and jsonb_typeof(NEW.items) = 'array' then
        for sale_item in select * from jsonb_array_elements(NEW.items) loop
            item_prod_id := sale_item->>'productId';
            item_var_id := sale_item->>'variantId';
            item_qty := (sale_item->>'quantity')::int;

            -- Find product matching the id
            select * into product_rec from public.products where id = item_prod_id;
            
            if found and product_rec.variants is not null and jsonb_typeof(product_rec.variants) = 'array' then
                new_variants_arr := '[]'::jsonb;
                
                -- Iterate variants list to modify the matching variantId's stock
                for var_rec in select * from jsonb_array_elements(product_rec.variants) loop
                    if var_rec->>'id' = item_var_id then
                        -- Deduct inventory stock (ensure stock is kept >= 0)
                        var_rec := jsonb_set(
                            var_rec, 
                            '{stock}', 
                            to_jsonb(greatest(0, (var_rec->>'stock')::int - item_qty))
                        );
                    end if;
                    new_variants_arr := new_variants_arr || var_rec;
                end loop;

                -- Update the database product record with updated variants and refresh update timestamp
                update public.products 
                set variants = new_variants_arr,
                    last_updated = timezone('utc'::text, now())
                where id = item_prod_id;
            end if;
        end loop;
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

-- Bind trigger to run automatically on insert to the sales table
drop trigger if exists trg_auto_deduct_stock on public.sales;
create trigger trg_auto_deduct_stock
after insert on public.sales
for each row
execute function public.fn_auto_deduct_inventory_stock();


-- =========================================================================
--                      MUTUAL CONFLICT CONFLICT UPSERT / SYNC PROCEDURES
-- =========================================================================
-- Utility function for fast synchronization queries. Clients can invoke
-- upsert routines with standard SQL protocols.
-- =========================================================================

-- Trigger to auto-increment or set default last_updated timestamp on row change
create or replace function public.set_last_updated_timestamp()
returns trigger as $$
begin
    NEW.last_updated = timezone('utc'::text, now());
    return NEW;
end;
$$ language plpgsql;

-- Bind last-updated triggers for important structural tables
do $$
declare
    tbl text;
    tables_list text[] := array['businesses', 'shops', 'products', 'customers', 'suppliers', 'expenses', 'employees', 'attendance', 'payroll', 'debts', 'ledger', 'guest_requests', 'sale_items', 'licenses', 'login_history', 'piracy_alerts'];
begin
    foreach tbl in array tables_list loop
        execute format('
            drop trigger if exists trg_update_timestamp_%1$I on public.%1$I;
            create trigger trg_update_timestamp_%1$I
            before update on public.%1$I
            for each row
            execute function public.set_last_updated_timestamp();
        ', tbl);
    end loop;
end;
$$;


-- =========================================================================
--                  ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ISOLATION
-- =========================================================================
-- Row Level Security divides rows securely by the user's tenant businessId,
-- ensuring that staff from Business A cannot query or edit Business B's transactions.
-- Replace with custom policies depending on your auth claims setup.
-- =========================================================================

-- Enable RLS on all tables
alter table public.businesses enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.payroll enable row level security;
alter table public.debts enable row level security;
alter table public.ledger enable row level security;
alter table public.guest_requests enable row level security;
alter table public.sale_items enable row level security;
alter table public.licenses enable row level security;
alter table public.login_history enable row level security;
alter table public.piracy_alerts enable row level security;

-- Basic policy: Allow authenticated queries (You can modify these to capture standard corporate sub-user business metadata)
drop policy if exists "Allow all actions for authenticated users" on public.businesses;
create policy "Allow all actions for authenticated users" 
on public.businesses for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.shops;
create policy "Allow all actions for authenticated users" 
on public.shops for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.products;
create policy "Allow all actions for authenticated users" 
on public.products for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.sales;
create policy "Allow all actions for authenticated users" 
on public.sales for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.customers;
create policy "Allow all actions for authenticated users" 
on public.customers for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.suppliers;
create policy "Allow all actions for authenticated users" 
on public.suppliers for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.expenses;
create policy "Allow all actions for authenticated users" 
on public.expenses for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.employees;
create policy "Allow all actions for authenticated users" 
on public.employees for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.attendance;
create policy "Allow all actions for authenticated users" 
on public.attendance for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.payroll;
create policy "Allow all actions for authenticated users" 
on public.payroll for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.debts;
create policy "Allow all actions for authenticated users" 
on public.debts for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.ledger;
create policy "Allow all actions for authenticated users" 
on public.ledger for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.guest_requests;
create policy "Allow all actions for authenticated users" 
on public.guest_requests for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.sale_items;
create policy "Allow all actions for authenticated users" 
on public.sale_items for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.licenses;
create policy "Allow all actions for authenticated users" 
on public.licenses for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.login_history;
create policy "Allow all actions for authenticated users" 
on public.login_history for all to authenticated using (true) with check (true);

drop policy if exists "Allow all actions for authenticated users" on public.piracy_alerts;
create policy "Allow all actions for authenticated users" 
on public.piracy_alerts for all to authenticated using (true) with check (true);


-- =========================================================================
--                  ENABLE SUPABASE REAL-TIME REPLICATION
-- =========================================================================
-- In case you wish to subscribe to live updates on terminals instantly!
-- =========================================================================

begin;
  -- drop the publication if it already exists to purge old tables list
  drop publication if exists supabase_realtime;
  
  -- create publishing publication
  create publication supabase_realtime for table 
    public.businesses, 
    public.shops, 
    public.products, 
    public.sales,
    public.debts,
    public.customers,
    public.guest_requests,
    public.sale_items,
    public.licenses,
    public.piracy_alerts;
commit;
