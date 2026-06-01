-- =========================================================================
--  SUPABASE / POSTGRES COMPREHENSIVE SCHEMA & RESOLVED QUERIES
-- =========================================================================
-- This script provides the complete SQL definitions for all the new tables
-- (employees, attendance, payroll, debts, and guest_requests) and provides
-- fully-resolved queries that eliminate type conversion and missing column errors.
--
-- Choose either OPTION A (Text ID columns - Recommended for Hybrid Offline Sync)
-- or OPTION B (Strict UUID columns). Both are detailed below.
-- =========================================================================


-- =========================================================================
--  OPTION A: HYBRID CLOUD SYNC SCHEMA (RECOMMENDED)
--  (Uses TEXT types for IDs to match client-side offline storage UUIDs)
-- =========================================================================

-- 1. Create Employees Table (Option A)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'staff', 'manager', 'hr'
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'ON_LEAVE'
    national_id TEXT,
    emergency_contact TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Attendance Register (Option A)
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TEXT NOT NULL,
    check_out TEXT,
    status TEXT NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'LATE', 'LEAVE'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Payroll Ledger (Option A)
CREATE TABLE IF NOT EXISTS public.payroll (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- 'YYYY-MM' (e.g., '2026-05')
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12,2) DEFAULT 0.00,
    deductions NUMERIC(12,2) DEFAULT 0.00,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    method TEXT NOT NULL, -- 'Cash', 'M-Pesa', 'Bank Transfer'
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Debts / Credit Registry (Option A)
CREATE TABLE IF NOT EXISTS public.debts (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    remaining_amount NUMERIC(12,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE'
    sale_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Guest Requests Desk (Option A)
CREATE TABLE IF NOT EXISTS public.guest_requests (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    room_no TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'REPAIR', 'FEEDBACK', 'HOUSEKEEPING'
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH'
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'RESOLVED'
    rating INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- =========================================================================
--  OPTION A: CORRECTED & OPTIMIZED SQL QUERIES (No operator mismatch!)
-- =========================================================================

-- Query 1: Filter Attendances by Employee ID safely (No text-uuid conversion mismatch)
SELECT * 
FROM public.attendance
WHERE employee_id = '00000000-0000-0000-0000-000000000000'; -- Treated purely as a text sequence match


-- Query 2: Filter Employees by Business ID safely
SELECT * 
FROM public.employees
WHERE business_id = '11111111-1111-1111-1111-111111111111'; -- Treated purely as a text sequence match


-- Query 3: Calculate Salaries Sum from PAYROLL table (validates column base_salary)
-- (In the PAYROLL table, the column name is indeed "base_salary")
SELECT 
    period,
    SUM(base_salary) as total_base_salaries,
    SUM(allowances) as total_allowances,
    SUM(net_salary) as total_net_payout
FROM public.payroll
GROUP BY period;


-- Query 4: Calculate Salaries Sum from EMPLOYEES table (validates column base_salary rename)
-- (Important: Employees table column is named "salary", NOT "base_salary")
SELECT 
    role,
    SUM(salary) as total_base_salaries,
    COUNT(id) as total_staff_count
FROM public.employees
GROUP BY role;




-- =========================================================================
--  OPTION B: NATIVE POSTGRES UUID SCHEMA
--  (For databases using native UUID types for keys and relations)
-- =========================================================================

-- 1. Create Employees Table (Option B)
CREATE TABLE IF NOT EXISTS public.employees_uuid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    shop_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'admin', 'staff', 'manager', 'hr'
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'ON_LEAVE'
    national_id VARCHAR(50),
    emergency_contact VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Attendance Register (Option B)
CREATE TABLE IF NOT EXISTS public.attendance_uuid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees_uuid(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in VARCHAR(50) NOT NULL,
    check_out VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'LATE', 'LEAVE'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Payroll Ledger (Option B)
CREATE TABLE IF NOT EXISTS public.payroll_uuid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees_uuid(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL, -- 'YYYY-MM'
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12,2) DEFAULT 0.00,
    deductions NUMERIC(12,2) DEFAULT 0.00,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- =========================================================================
--  OPTION B: CORRECTED UUID QUERIES (With explicit casting parameter)
-- =========================================================================

-- Query 1: Filter Attendances on strict UUID schema
SELECT * 
FROM public.attendance_uuid
WHERE employee_id = '00000000-0000-0000-0000-000000000000'::UUID; -- Safe comparison on matched UUID columns


-- Query 2: Filter Employees on strict UUID schema
SELECT * 
FROM public.employees_uuid
WHERE business_id = '11111111-1111-1111-1111-111111111111'::UUID; -- Safe comparison on matched UUID columns


-- Query 3: Calculate Salaries Sum from PAYROLL on strict UUID schema
SELECT 
    period,
    SUM(base_salary) as total_base_salaries,
    SUM(allowances) as total_allowances,
    SUM(net_salary) as total_net_payout
FROM public.payroll_uuid
GROUP BY period;
