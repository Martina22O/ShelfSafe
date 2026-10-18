-- ==============================================================================
-- ShelfSafe Local Development Seed Data
-- ==============================================================================
--
-- HOW TO CREATE A TEST USER IN SUPABASE:
-- Option 1 (Local CLI / Studio):
--   Navigate to http://127.0.0.1:54323 -> Authentication -> Users -> Add User.
-- Option 2 (Sign Up via App):
--   Register a new user through the ShelfSafe Sign In / Sign Up screen.
-- Option 3 (SQL):
--   Insert into auth.users directly in the SQL Editor.
--
-- NOTE: If no user exists in auth.users, this script safely skips product and
-- batch inserts and finishes without error. Re-run after creating a user.
-- ==============================================================================

-- 1. Ensure Standard Categories are Seeded
INSERT INTO public.categories (name) VALUES
    ('Beverages'),
    ('Canned Goods'),
    ('Biscuits and Snacks'),
    ('Noodles'),
    ('Condiments'),
    ('Dairy Products'),
    ('Over-the-Counter Medicines')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Products & Batches for the First Available User
DO $$
DECLARE
    target_owner_id UUID;
    cat_beverages_id UUID;
    cat_canned_id UUID;
    cat_noodles_id UUID;
    cat_snacks_id UUID;
    cat_meds_id UUID;

    prod_coke_id UUID;
    prod_tuna_id UUID;
    prod_noodles_id UUID;
    prod_banana_id UUID;
    prod_paracetamol_id UUID;
BEGIN
    -- Look for the first existing user in auth.users
    SELECT id INTO target_owner_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF target_owner_id IS NULL THEN
        RAISE NOTICE '===========================================================================';
        RAISE NOTICE 'NOTICE: No user found in auth.users. Skipping product and batch seeding.';
        RAISE NOTICE 'To seed sample inventory:';
        RAISE NOTICE '  1. Create a user via Supabase Studio (http://127.0.0.1:54323) or the app.';
        RAISE NOTICE '  2. Re-run this seed script: npx supabase db reset (or execute seed.sql).';
        RAISE NOTICE '===========================================================================';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding inventory for owner_id: %', target_owner_id;

    -- Retrieve category IDs
    SELECT id INTO cat_beverages_id FROM public.categories WHERE name = 'Beverages' LIMIT 1;
    SELECT id INTO cat_canned_id FROM public.categories WHERE name = 'Canned Goods' LIMIT 1;
    SELECT id INTO cat_noodles_id FROM public.categories WHERE name = 'Noodles' LIMIT 1;
    SELECT id INTO cat_snacks_id FROM public.categories WHERE name = 'Biscuits and Snacks' LIMIT 1;
    SELECT id INTO cat_meds_id FROM public.categories WHERE name = 'Over-the-Counter Medicines' LIMIT 1;

    -- PRODUCT 1: Coca-Cola 330ml (Beverages)
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (target_owner_id, cat_beverages_id, 'Coca-Cola 330ml Can', '5449000000996', 35.00, 10)
    ON CONFLICT (owner_id, barcode) WHERE barcode IS NOT NULL AND barcode <> ''
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO prod_coke_id;

    -- PRODUCT 2: Century Tuna Flakes in Oil 155g (Canned Goods)
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (target_owner_id, cat_canned_id, 'Century Tuna Flakes 155g', '4800016644805', 42.50, 8)
    ON CONFLICT (owner_id, barcode) WHERE barcode IS NOT NULL AND barcode <> ''
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO prod_tuna_id;

    -- PRODUCT 3: Lucky Me! Instant Pancit Canton (Noodles)
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (target_owner_id, cat_noodles_id, 'Lucky Me! Pancit Canton 80g', '4800016054116', 18.00, 15)
    ON CONFLICT (owner_id, barcode) WHERE barcode IS NOT NULL AND barcode <> ''
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO prod_noodles_id;

    -- PRODUCT 4: Biogesic Paracetamol 500mg (OTC Medicines)
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (target_owner_id, cat_meds_id, 'Biogesic Paracetamol 500mg', '4800092111000', 8.50, 20)
    ON CONFLICT (owner_id, barcode) WHERE barcode IS NOT NULL AND barcode <> ''
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO prod_paracetamol_id;

    -- PRODUCT 5: Fresh Local Bananas (No barcode manual entry item)
    -- Check if already inserted to avoid duplicate entries on re-run
    SELECT id INTO prod_banana_id 
    FROM public.products 
    WHERE owner_id = target_owner_id 
      AND name = 'Fresh Local Cavendish Bananas (1kg)' 
      AND (barcode IS NULL OR barcode = '')
    LIMIT 1;

    IF prod_banana_id IS NULL THEN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (target_owner_id, cat_snacks_id, 'Fresh Local Cavendish Bananas (1kg)', NULL, 65.00, 5)
        RETURNING id INTO prod_banana_id;
    END IF;

    -- --------------------------------------------------------------------------
    -- BATCH SEEDING (2 batches per product for FEFO testing)
    -- --------------------------------------------------------------------------

    -- Batches for Coca-Cola
    IF NOT EXISTS (SELECT 1 FROM public.batches WHERE product_id = prod_coke_id) THEN
        -- Batch 1: Near expiry (expires in 10 days)
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_coke_id, 8, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days');
        -- Batch 2: Fresh delivery (expires in 120 days)
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_coke_id, 24, CURRENT_DATE, CURRENT_DATE + INTERVAL '120 days');
    END IF;

    -- Batches for Century Tuna
    IF NOT EXISTS (SELECT 1 FROM public.batches WHERE product_id = prod_tuna_id) THEN
        -- Batch 1: Expires in 45 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_tuna_id, 12, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '45 days');
        -- Batch 2: Expires in 365 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_tuna_id, 30, CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days');
    END IF;

    -- Batches for Lucky Me! Pancit Canton
    IF NOT EXISTS (SELECT 1 FROM public.batches WHERE product_id = prod_noodles_id) THEN
        -- Batch 1: Low stock / near expiry (expires in 14 days)
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_noodles_id, 5, CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE + INTERVAL '14 days');
        -- Batch 2: Expires in 180 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_noodles_id, 50, CURRENT_DATE, CURRENT_DATE + INTERVAL '180 days');
    END IF;

    -- Batches for Biogesic Paracetamol
    IF NOT EXISTS (SELECT 1 FROM public.batches WHERE product_id = prod_paracetamol_id) THEN
        -- Batch 1: Expires in 90 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_paracetamol_id, 40, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '90 days');
        -- Batch 2: Expires in 720 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_paracetamol_id, 100, CURRENT_DATE, CURRENT_DATE + INTERVAL '720 days');
    END IF;

    -- Batches for Fresh Bananas (Perishable produce, short expiry)
    IF NOT EXISTS (SELECT 1 FROM public.batches WHERE product_id = prod_banana_id) THEN
        -- Batch 1: Expires in 2 days (urgent expiry)
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_banana_id, 4, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '2 days');
        -- Batch 2: Expires in 6 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (prod_banana_id, 15, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days');
    END IF;

    RAISE NOTICE 'Successfully seeded products and batches for FEFO testing.';
END $$;
