-- Supabase Migration Script v5 - License Expiry, Subscriptions & M-Pesa Approvals
-- Run this in the Supabase SQL Editor.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='expires_at') THEN
        ALTER TABLE public.licenses ADD COLUMN expires_at timestamp with time zone;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='plan_type') THEN
        ALTER TABLE public.licenses ADD COLUMN plan_type text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='payment_status') THEN
        ALTER TABLE public.licenses ADD COLUMN payment_status text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='payment_phone') THEN
        ALTER TABLE public.licenses ADD COLUMN payment_phone text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='mpesa_reference') THEN
        ALTER TABLE public.licenses ADD COLUMN mpesa_reference text;
    END IF;
END $$;
