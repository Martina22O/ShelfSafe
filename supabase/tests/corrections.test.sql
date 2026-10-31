-- ==============================================================================
-- ShelfSafe Backend Test Suite: Product and Batch Corrections & Audit Log
-- ==============================================================================
--
-- HOW TO RUN THIS TEST SUITE IN SUPABASE SQL EDITOR:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your ShelfSafe project.
-- 3. Click "SQL Editor" in the left-hand navigation sidebar.
-- 4. Click "+ New query".
-- 5. Copy and paste the ENTIRE contents of this file into the editor.
-- 6. Click "Run" (or press Ctrl + Enter / Cmd + Enter).
-- 7. View the "Results" tab to see test results and summary.
--
-- NOTE:
-- This script logs every result into a temporary table and displays it as
-- a formatted table in the Results panel. It always runs cleanup at the end
-- to remove only the mock fixtures created by this run, even if a test fails.
-- ==============================================================================

-- 1. Temporary table to hold test results
CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_order INTEGER,
    test_id TEXT,
    test_name TEXT,
    status TEXT,
    message TEXT
);

TRUNCATE TABLE test_results;
GRANT ALL ON TABLE test_results TO PUBLIC, authenticated, anon;

-- 2. Execute test suite
DO $$
DECLARE
    -- Mock user UUIDs
    v_user1_id UUID := gen_random_uuid();
    v_user2_id UUID := gen_random_uuid();
    v_cat_id UUID;

    -- Time reference (Asia/Manila)
    v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;

    -- Test Fixtures
    v_p1_id UUID;
    v_b1_id UUID;
    v_p2_id UUID;
    v_p3_id UUID;
    v_b3_id UUID;
    v_p4_id UUID;
    v_b4_id UUID;
    v_p5_id UUID;
    v_b5_id UUID;
    v_p6_id UUID;
    v_b6_id UUID;
    v_p7_id UUID;
    v_b7_id UUID;
    v_p_unused_id UUID;
    v_b_unused_id UUID;
    v_p_used_id UUID;
    v_b_used_id UUID;

    v_scan4_id UUID;
    v_scan_used_id UUID;
    v_scan13_id UUID;
    v_scan14_id UUID;
    v_scan16_id UUID;

    -- Verification variables
    v_res JSONB;
    v_qty INTEGER;
    v_count INTEGER;
    v_p_date DATE;
    v_e_date DATE;
    v_is_archived BOOLEAN;
    v_prod_archived BOOLEAN;
    v_p_name TEXT;
    v_p_barcode TEXT;
    v_p_price NUMERIC;
    v_p_low_stock INTEGER;
    v_error_caught BOOLEAN;
    v_err1_caught BOOLEAN;
    v_err2_caught BOOLEAN;
    v_edit_count INTEGER;

    -- Summary counters
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP: Mock Users & Category
    -- --------------------------------------------------------------------------
    SELECT id INTO v_cat_id FROM public.categories LIMIT 1;
    IF v_cat_id IS NULL THEN
        INSERT INTO public.categories (name) VALUES ('Test Category')
        RETURNING id INTO v_cat_id;
    END IF;

    -- Create isolated mock users in auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
    (
        v_user1_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('mock_user1_%s@shelfsafe.local', v_user1_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
        v_user2_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('mock_user2_%s@shelfsafe.local', v_user2_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );

    -- Simulate User 1 authentication context
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- Create Base Product P1 & Batch B1 for User 1
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (v_user1_id, v_cat_id, 'Base Test Product', '111100001', 50.00, 5)
    RETURNING id INTO v_p1_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_p1_id, 10, v_today - 5, v_today + 30)
    RETURNING id INTO v_b1_id;

    -- --------------------------------------------------------------------------
    -- TEST 1: QUANTITY CORRECTION WORKS AND IS LOGGED
    -- --------------------------------------------------------------------------
    BEGIN
        v_res := public.correct_batch_quantity(v_b1_id, 25);

        SELECT quantity_left INTO v_qty
        FROM public.batches
        WHERE id = v_b1_id;

        SELECT COUNT(*) INTO v_edit_count
        FROM public.inventory_edits
        WHERE owner_id = v_user1_id
          AND entity_type = 'batch'
          AND entity_id = v_b1_id
          AND action = 'quantity_correction'
          AND (old_values->>'quantity_left')::int = 10
          AND (new_values->>'quantity_left')::int = 25;

        IF v_qty = 25 AND v_edit_count = 1 AND (v_res->>'quantity_left')::int = 25 THEN
            INSERT INTO test_results VALUES (1, '1', 'Quantity correction works and logged', 'PASS', 'Batch quantity updated from 10 to 25 and recorded in inventory_edits');
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'Quantity correction works and logged', 'FAIL', format('Verification failed: qty=%s, edit_count=%s', v_qty, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'Quantity correction works and logged', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: NEGATIVE QUANTITY REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.correct_batch_quantity(v_b1_id, -5);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%greater than or equal to zero%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (2, '2', 'Negative quantity refused', 'PASS', 'Validation prevented negative batch quantity');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'Negative quantity refused', 'FAIL', 'Negative quantity was not rejected');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'Negative quantity refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: DATE EDIT WORKS AND IS LOGGED
    -- --------------------------------------------------------------------------
    BEGIN
        v_res := public.update_batch_dates(v_b1_id, v_today - 10, v_today + 60);

        SELECT purchase_date, expiration_date INTO v_p_date, v_e_date
        FROM public.batches
        WHERE id = v_b1_id;

        SELECT COUNT(*) INTO v_edit_count
        FROM public.inventory_edits
        WHERE owner_id = v_user1_id
          AND entity_type = 'batch'
          AND entity_id = v_b1_id
          AND action = 'dates_edit';

        IF v_p_date = (v_today - 10) AND v_e_date = (v_today + 60) AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (3, '3', 'Batch dates edit works and logged', 'PASS', 'Purchase and expiration dates updated and recorded in inventory_edits');
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Batch dates edit works and logged', 'FAIL', format('Verification failed: p_date=%s, e_date=%s, edit_count=%s', v_p_date, v_e_date, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', 'Batch dates edit works and logged', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: BAD DATE RANGE REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.update_batch_dates(v_b1_id, v_today + 20, v_today + 5);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%cannot be earlier than purchase date%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (4, '4', 'Bad date range refused', 'PASS', 'Expiration earlier than purchase date was rejected');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'Bad date range refused', 'FAIL', 'Invalid date range was not rejected');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'Bad date range refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: PRODUCT EDIT WORKS AND IS LOGGED
    -- --------------------------------------------------------------------------
    BEGIN
        v_res := public.update_product(v_p1_id, 'Updated Base Product', '111100001_EDITED', v_cat_id, 79.99, 12);

        SELECT name, barcode, price, low_stock_level
        INTO v_p_name, v_p_barcode, v_p_price, v_p_low_stock
        FROM public.products
        WHERE id = v_p1_id;

        SELECT COUNT(*) INTO v_edit_count
        FROM public.inventory_edits
        WHERE owner_id = v_user1_id
          AND entity_type = 'product'
          AND entity_id = v_p1_id
          AND action = 'product_edit';

        IF v_p_name = 'Updated Base Product' AND v_p_barcode = '111100001_EDITED' AND v_p_price = 79.99 AND v_p_low_stock = 12 AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (5, '5', 'Product edit works and logged', 'PASS', 'Product properties updated and recorded in inventory_edits');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'Product edit works and logged', 'FAIL', format('Verification failed: name=%s, barcode=%s, price=%s, low_stock=%s', v_p_name, v_p_barcode, v_p_price, v_p_low_stock));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'Product edit works and logged', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: DUPLICATE BARCODE ON EDIT REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        -- Create a second product for User 1
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Second Product', '222200002', 30.00, 5)
        RETURNING id INTO v_p2_id;

        v_error_caught := FALSE;
        BEGIN
            -- Try to edit P1 to have P2's barcode
            PERFORM public.update_product(v_p1_id, 'Updated Name', '222200002', v_cat_id, 80.00, 10);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%This barcode already exists%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (6, '6', 'Duplicate barcode on edit refused', 'PASS', 'Updating product to an existing barcode was rejected');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Duplicate barcode on edit refused', 'FAIL', 'Duplicate barcode on update was not rejected');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'Duplicate barcode on edit refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: REMOVE_BATCH DELETES AN UNUSED BATCH
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'P3 Unused Batch Holder', '333300003', 20.00, 5)
        RETURNING id INTO v_p3_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p3_id, 15, v_today, v_today + 45)
        RETURNING id INTO v_b3_id;

        v_res := public.remove_batch(v_b3_id);

        SELECT COUNT(*) INTO v_count FROM public.batches WHERE id = v_b3_id;
        SELECT COUNT(*) INTO v_edit_count FROM public.inventory_edits
        WHERE owner_id = v_user1_id AND entity_type = 'batch' AND entity_id = v_b3_id AND action = 'delete';

        IF (v_res->>'status') = 'deleted' AND v_count = 0 AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (7, '7', 'remove_batch deletes unused batch', 'PASS', 'Unused batch was deleted from table and logged as delete');
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'remove_batch deletes unused batch', 'FAIL', format('Verification failed: status=%s, count=%s, edit_count=%s', v_res->>'status', v_count, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'remove_batch deletes unused batch', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: REMOVE_BATCH ARCHIVES A BATCH THAT HAS SALES
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'P4 Used Batch Holder', '444400004', 40.00, 5)
        RETURNING id INTO v_p4_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p4_id, 20, v_today - 5, v_today + 90)
        RETURNING id INTO v_b4_id;

        -- Record sale against P4 to create deductions
        v_scan4_id := public.record_sale(v_p4_id, 5);

        v_res := public.remove_batch(v_b4_id);

        SELECT COUNT(*), COALESCE(bool_and(is_archived), false) INTO v_count, v_is_archived
        FROM public.batches WHERE id = v_b4_id;

        SELECT COUNT(*) INTO v_edit_count FROM public.inventory_edits
        WHERE owner_id = v_user1_id AND entity_type = 'batch' AND entity_id = v_b4_id AND action = 'archive';

        IF (v_res->>'status') = 'archived' AND v_count = 1 AND v_is_archived = TRUE AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (8, '8', 'remove_batch archives batch with sales', 'PASS', 'Batch with sales history was archived instead of deleted');
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'remove_batch archives batch with sales', 'FAIL', format('Verification failed: status=%s, count=%s, is_archived=%s, edit_count=%s', v_res->>'status', v_count, v_is_archived, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'remove_batch archives batch with sales', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: REMOVE_PRODUCT DELETES UNUSED PRODUCT AND ARCHIVES USED ONE
    -- --------------------------------------------------------------------------
    BEGIN
        -- Part A: Unused product deletion
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Unused Product', '999900010', 10.00, 2)
        RETURNING id INTO v_p_unused_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p_unused_id, 5, v_today, v_today + 10)
        RETURNING id INTO v_b_unused_id;

        v_res := public.remove_product(v_p_unused_id);

        SELECT COUNT(*) INTO v_count FROM public.products WHERE id = v_p_unused_id;

        -- Part B: Used product archiving
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Used Product', '999900020', 25.00, 2)
        RETURNING id INTO v_p_used_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p_used_id, 10, v_today, v_today + 60)
        RETURNING id INTO v_b_used_id;

        v_scan_used_id := public.record_sale(v_p_used_id, 2);

        v_res := public.remove_product(v_p_used_id);

        SELECT is_archived INTO v_is_archived FROM public.products WHERE id = v_p_used_id;

        IF v_count = 0 AND (v_res->>'status') = 'archived' AND v_is_archived = TRUE THEN
            INSERT INTO test_results VALUES (9, '9', 'remove_product deletes unused and archives used', 'PASS', 'Unused product and batches deleted; used product archived with batches intact');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'remove_product deletes unused and archives used', 'FAIL', format('Part A count=%s, Part B archived=%s', v_count, v_is_archived));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (9, '9', 'remove_product deletes unused and archives used', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: RESTORE_PRODUCT WORKS
    -- --------------------------------------------------------------------------
    BEGIN
        v_res := public.restore_product(v_p_used_id);

        SELECT is_archived INTO v_is_archived FROM public.products WHERE id = v_p_used_id;
        SELECT COUNT(*) INTO v_edit_count FROM public.inventory_edits
        WHERE owner_id = v_user1_id AND entity_type = 'product' AND entity_id = v_p_used_id AND action = 'restore';

        IF (v_res->>'status') = 'restored' AND v_is_archived = FALSE AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (10, '10', 'restore_product restores archived product', 'PASS', 'Archived product restored to active status and logged');
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'restore_product restores archived product', 'FAIL', format('Verification failed: status=%s, is_archived=%s, edit_count=%s', v_res->>'status', v_is_archived, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (10, '10', 'restore_product restores archived product', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 11: ANOTHER USER CANNOT CHANGE MY ROWS (RLS / MULTI-TENANT ISOLATION)
    -- --------------------------------------------------------------------------
    BEGIN
        -- Switch to User 2 database role and JWT context
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err1_caught := FALSE;
        BEGIN
            PERFORM public.correct_batch_quantity(v_b1_id, 99);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%not found or access denied%' THEN
                v_err1_caught := TRUE;
            END IF;
        END;

        v_err2_caught := FALSE;
        BEGIN
            PERFORM public.update_product(v_p1_id, 'Hacked Name', '999999999', v_cat_id, 1.00, 1);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%not found or access denied%' THEN
                v_err2_caught := TRUE;
            END IF;
        END;

        -- Control check: Switch to User 1 and verify User 1 can update their own row
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_res := public.correct_batch_quantity(v_b1_id, 20);

        RESET ROLE;

        IF v_err1_caught AND v_err2_caught AND (v_res->>'quantity_left')::int = 20 THEN
            INSERT INTO test_results VALUES (11, '11', 'Multi-tenant isolation on corrections', 'PASS', 'User 2 blocked from editing User 1 inventory; User 1 confirmed control');
        ELSE
            INSERT INTO test_results VALUES (11, '11', 'Multi-tenant isolation on corrections', 'FAIL', format('Isolation check failed: err1=%s, err2=%s, control_qty=%s', v_err1_caught, v_err2_caught, v_res->>'quantity_left'));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (11, '11', 'Multi-tenant isolation on corrections', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 12: ANON IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM set_config('request.jwt.claim.role', 'anon', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);

        v_error_caught := FALSE;
        BEGIN
            PERFORM public.correct_batch_quantity(v_b1_id, 50);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%Authentication required%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (12, '12', 'Anon role refused', 'PASS', 'Anon / unauthenticated caller was blocked from executing correction function');
        ELSE
            INSERT INTO test_results VALUES (12, '12', 'Anon role refused', 'FAIL', 'Anon role was not blocked');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (12, '12', 'Anon role refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 13: UNDO_SALE AFTER BATCH ARCHIVED RESTORES BATCH AND UNITS
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Product for Undo Batch Test', '555500005', 45.00, 5)
        RETURNING id INTO v_p5_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p5_id, 20, v_today - 3, v_today + 60)
        RETURNING id INTO v_b5_id;

        -- Record sale of 8 units
        v_scan13_id := public.record_sale(v_p5_id, 8);

        -- Archive batch B5
        UPDATE public.batches SET is_archived = TRUE WHERE id = v_b5_id;

        -- Undo sale
        PERFORM public.undo_sale(v_scan13_id);

        SELECT quantity_left, is_archived INTO v_qty, v_is_archived
        FROM public.batches WHERE id = v_b5_id;

        SELECT COUNT(*) INTO v_edit_count
        FROM public.inventory_edits
        WHERE owner_id = v_user1_id
          AND entity_type = 'batch'
          AND entity_id = v_b5_id
          AND action = 'restore';

        IF v_qty = 20 AND v_is_archived = FALSE AND v_edit_count = 1 THEN
            INSERT INTO test_results VALUES (13, '13', 'undo_sale restores archived batch and units', 'PASS', 'Archived batch was unarchived, units restored to 20, and restore logged');
        ELSE
            INSERT INTO test_results VALUES (13, '13', 'undo_sale restores archived batch and units', 'FAIL', format('Verification failed: qty=%s, is_archived=%s, edit_count=%s', v_qty, v_is_archived, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (13, '13', 'undo_sale restores archived batch and units', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 14: UNDO_SALE AFTER PRODUCT ARCHIVED RESTORES PRODUCT AND UNITS
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Product for Undo Product Test', '666600006', 60.00, 5)
        RETURNING id INTO v_p6_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p6_id, 15, v_today - 2, v_today + 90)
        RETURNING id INTO v_b6_id;

        -- Record sale of 5 units
        v_scan14_id := public.record_sale(v_p6_id, 5);

        -- Archive both batch and parent product
        UPDATE public.batches SET is_archived = TRUE WHERE id = v_b6_id;
        UPDATE public.products SET is_archived = TRUE WHERE id = v_p6_id;

        -- Undo sale
        PERFORM public.undo_sale(v_scan14_id);

        SELECT quantity_left, is_archived INTO v_qty, v_is_archived
        FROM public.batches WHERE id = v_b6_id;

        SELECT is_archived INTO v_prod_archived
        FROM public.products WHERE id = v_p6_id;

        SELECT COUNT(*) INTO v_edit_count
        FROM public.inventory_edits
        WHERE owner_id = v_user1_id
          AND action = 'restore'
          AND entity_id IN (v_p6_id, v_b6_id);

        IF v_qty = 15 AND v_is_archived = FALSE AND v_prod_archived = FALSE AND v_edit_count = 2 THEN
            INSERT INTO test_results VALUES (14, '14', 'undo_sale restores archived product and units', 'PASS', 'Archived product and batch both restored, units restored to 15, and logged');
        ELSE
            INSERT INTO test_results VALUES (14, '14', 'undo_sale restores archived product and units', 'FAIL', format('Verification failed: qty=%s, batch_archived=%s, prod_archived=%s, edit_count=%s', v_qty, v_is_archived, v_prod_archived, v_edit_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (14, '14', 'undo_sale restores archived product and units', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 15: SECOND UNDO IS STILL REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.undo_sale(v_scan14_id);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%already been undone%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (15, '15', 'Second undo is refused', 'PASS', 'Attempting a second undo on the same sale scan was blocked');
        ELSE
            INSERT INTO test_results VALUES (15, '15', 'Second undo is refused', 'FAIL', 'Second undo was not rejected');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (15, '15', 'Second undo is refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 16: SALE-THEN-REMOVE_BATCH ON BATCH WITH SALES ARCHIVES AND NEVER DELETES
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'P7 Sale Then Remove', '777700007', 35.00, 3)
        RETURNING id INTO v_p7_id;

        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_p7_id, 30, v_today - 1, v_today + 120)
        RETURNING id INTO v_b7_id;

        v_scan16_id := public.record_sale(v_p7_id, 4);

        v_res := public.remove_batch(v_b7_id);

        SELECT COUNT(*), COALESCE(bool_and(is_archived), false) INTO v_count, v_is_archived
        FROM public.batches WHERE id = v_b7_id;

        IF (v_res->>'status') = 'archived' AND v_count = 1 AND v_is_archived = TRUE THEN
            INSERT INTO test_results VALUES (16, '16', 'Sale-then-remove_batch archives never deletes', 'PASS', 'Batch with sales was archived; row persists with is_archived = true');
        ELSE
            INSERT INTO test_results VALUES (16, '16', 'Sale-then-remove_batch archives never deletes', 'FAIL', format('Verification failed: status=%s, count=%s, is_archived=%s', v_res->>'status', v_count, v_is_archived));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (16, '16', 'Sale-then-remove_batch archives never deletes', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- CLEANUP: Delete ONLY mock test rows and mock users created by this run
    -- --------------------------------------------------------------------------
    BEGIN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);

        DELETE FROM public.inventory_edits
        WHERE owner_id IN (v_user1_id, v_user2_id);

        DELETE FROM public.deductions
        WHERE sales_scan_id IN (
            SELECT id FROM public.sales_scans WHERE owner_id IN (v_user1_id, v_user2_id)
        );

        DELETE FROM public.deductions
        WHERE batch_id IN (
            SELECT id FROM public.batches WHERE product_id IN (
                SELECT id FROM public.products WHERE owner_id IN (v_user1_id, v_user2_id)
            )
        );

        DELETE FROM public.sales_scans
        WHERE owner_id IN (v_user1_id, v_user2_id);

        DELETE FROM public.batches
        WHERE product_id IN (
            SELECT id FROM public.products WHERE owner_id IN (v_user1_id, v_user2_id)
        );

        DELETE FROM public.products
        WHERE owner_id IN (v_user1_id, v_user2_id);

        DELETE FROM auth.users
        WHERE id IN (v_user1_id, v_user2_id);
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        INSERT INTO test_results VALUES (98, 'CLEANUP', 'Cleanup fixtures', 'FAIL', format('Cleanup error: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- SUMMARY ROW
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) FILTER (WHERE status = 'PASS'), COUNT(*) FILTER (WHERE status = 'FAIL')
    INTO v_passed, v_failed
    FROM test_results
    WHERE test_order BETWEEN 1 AND 16;

    INSERT INTO test_results VALUES (
        99,
        'SUMMARY',
        'OVERALL SUITE RESULT',
        CASE WHEN v_failed = 0 THEN 'PASS' ELSE 'FAIL' END,
        format('%s of 16 passed (%s failed)', v_passed, v_failed)
    );
END;
$$;

-- 3. Display formatted results in the Supabase Results grid
SELECT
    test_id AS "#",
    test_name AS "Test Name",
    status AS "Status",
    message AS "Details"
FROM test_results
ORDER BY test_order;
