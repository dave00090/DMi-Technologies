-- =========================================================================
--  SUPABASE / POSTGRES SCHEMA REPAIR & COMPATIBILITY SQL PATCH
-- =========================================================================
-- This script safely repairs your existing database schema by verifying and 
-- adding any missing columns (such as "base_salary", "allowances", "net_salary" etc.)
-- to your tables without wiping or disrupting any existing data.
--
-- Run this script directly in your Supabase SQL Editor (https://supabase.com).
-- =========================================================================

DO $$
BEGIN
    -- 1. Ensure public.employees table columns are fully up to date
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='employees') THEN
        -- Add salary column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='salary') THEN
            ALTER TABLE public.employees ADD COLUMN salary NUMERIC(12,2) DEFAULT 0.00;
        END IF;

        -- Add status column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='status') THEN
            ALTER TABLE public.employees ADD COLUMN status TEXT DEFAULT 'ACTIVE';
        END IF;
    END IF;

    -- 2. Ensure public.payroll table columns are fully up to date (Fixes "base_salary" column error)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payroll') THEN
        -- Add base_salary column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='base_salary') THEN
            ALTER TABLE public.payroll ADD COLUMN base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00;
        END IF;

        -- Add net_salary column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='net_salary') THEN
            ALTER TABLE public.payroll ADD COLUMN net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00;
        END IF;

        -- Add allowances column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='allowances') THEN
            ALTER TABLE public.payroll ADD COLUMN allowances NUMERIC(12,2) DEFAULT 0.00;
        END IF;

        -- Add deductions column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='deductions') THEN
            ALTER TABLE public.payroll ADD COLUMN deductions NUMERIC(12,2) DEFAULT 0.00;
        END IF;

        -- Add payment_date column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_date') THEN
            ALTER TABLE public.payroll ADD COLUMN payment_date DATE DEFAULT CURRENT_DATE;
        END IF;

        -- Add method column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='method') THEN
            -- Fill with standard 'Cash' method as a default
            ALTER TABLE public.payroll ADD COLUMN method TEXT DEFAULT 'Cash';
        END IF;
    END IF;

    -- 3. Ensure public.attendance table columns are fully up to date
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='attendance') THEN
        -- Add status column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='status') THEN
            ALTER TABLE public.attendance ADD COLUMN status TEXT DEFAULT 'PRESENT';
        END IF;
    END IF;

    -- 4. Ensure public.debts table columns are fully up to date
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='debts') THEN
        -- Add remaining_amount column if it is missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='remaining_amount') THEN
            ALTER TABLE public.debts ADD COLUMN remaining_amount NUMERIC(12,2) DEFAULT 0.00;
        END IF;
    END IF;

END $$;


-- =========================================================================
--  FULLY RESOLVED QUERY DEMONSTRATION
-- =========================================================================

-- Test Query A: (Safely runs once the script above has been executed)
SELECT 
    period,
    SUM(base_salary) as total_base_salaries,
    SUM(net_salary) as total_net_payout
FROM public.payroll
GROUP BY period;

-- Test Query B: Show active employees with salary details
SELECT 
    id,
    name,
    role,
    salary as monthly_salary,
    status
FROM public.employees
WHERE status = 'ACTIVE';
