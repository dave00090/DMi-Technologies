-- ====================================================================
-- Supabase / PostgreSQL Migration Script v6
-- Universal Barcode Lookup, Item Brand, Description & Catalog Metadata
-- Run this directly in your Supabase SQL Editor or PostgreSQL Database
-- ====================================================================

DO $$
BEGIN
    -- 1. Ensure public.products table has all details fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
        ALTER TABLE public.products ADD COLUMN brand VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description') THEN
        ALTER TABLE public.products ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
        ALTER TABLE public.products ADD COLUMN image_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode_source') THEN
        ALTER TABLE public.products ADD COLUMN barcode_source VARCHAR(100) DEFAULT 'manual';
    END IF;

    -- 2. Ensure public.product_variants table has barcode & sku index
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='barcode') THEN
        ALTER TABLE public.product_variants ADD COLUMN barcode VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='sku') THEN
        ALTER TABLE public.product_variants ADD COLUMN sku VARCHAR(100);
    END IF;

END $$;

-- 3. Create Barcode Catalog Cache Table (Optional speedup table for offline/cached barcode lookups)
CREATE TABLE IF NOT EXISTS public.barcode_catalog_cache (
    barcode VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    image_url TEXT,
    matches_list JSONB,
    source VARCHAR(100) DEFAULT 'barcode-list.com',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.barcode_catalog_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access to cached barcode lookups
DROP POLICY IF EXISTS "Allow public read of barcode catalog cache" ON public.barcode_catalog_cache;
CREATE POLICY "Allow public read of barcode catalog cache" ON public.barcode_catalog_cache 
    FOR SELECT USING (true);

-- Allow authenticated users or app backend to upsert cached barcodes
DROP POLICY IF EXISTS "Allow write of barcode catalog cache" ON public.barcode_catalog_cache;
CREATE POLICY "Allow write of barcode catalog cache" ON public.barcode_catalog_cache 
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Create Indexes for High-Speed Universal Barcode Scanning
DROP INDEX IF EXISTS idx_product_variants_barcode;
DROP INDEX IF EXISTS idx_product_variants_sku;
DROP INDEX IF EXISTS idx_barcode_catalog_cache_barcode;

CREATE INDEX idx_product_variants_barcode ON public.product_variants(barcode);
CREATE INDEX idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX idx_barcode_catalog_cache_barcode ON public.barcode_catalog_cache(barcode);

-- ====================================================================
-- End of Migration Script v6
-- ====================================================================
