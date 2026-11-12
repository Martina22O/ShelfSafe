-- ==============================================================================
-- ShelfSafe Backend Test Suite: Manual Sale Override (record_sale_override)
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

    -- Product and batch fixture IDs
    v_prod1_id UUID;
    v_prod2_id UUID;
    v_prod_u2_id UUID;

    v_b1_id UUID;
    v_b2_id UUID;
    v_b3_id UUID;
    v_b_exp_id UUID;
    v_b_arch_id UUID;
    v_b_prod2_id UUID;
    v_b_u2_id UUID;

    v_scan_id UUID;
    v_scan_undo_id UUID;

    -- Verification variables
    v_qty1 INTEGER;
    v_qty2 INTEGER;
    v_qty3 INTEGER;
    v_count INTEGER;
    v_err_caught BOOLEAN;
    v_err_msg TEXT;
    v_history_total INTEGER;
    v_history_breakdown JSONB;

    -- Counters
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP: Category & Mock Users
    -- --------------------------------------------------------------------------
    SELECT id INTO v_cat_id FROM public.categories LIMIT 1;
    IF v_cat_id IS NULL THEN
        INSERT INTO public.categories (name) VALUES ('Test Category')
        RETURNING id INTO v_cat_id;
    END IF;

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
    (
        v_user1_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('test_override_u1_%s@shelfsafe.local', v_user1_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
        v_user2_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('test_override_u2_%s@shelfsafe.local', v_user2_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );

    -- Setup fixtures as authenticated User 1
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- Product 1 for User 1
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (v_user1_id, v_cat_id, 'Override Test Product 1', '7770001', 120.00, 5)
    RETURNING id INTO v_prod1_id;

    -- Batches for Product 1:
    -- Batch 1: 10 units, expires in 5 days (earliest)
    -- Batch 2: 10 units, expires in 15 days (middle)
    -- Batch 3: 10 units, expires in 30 days (latest)
    -- Expired Batch: 10 units, expired 2 days ago
    -- Archived Batch: 10 units, expires in 20 days, is_archived = true
    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 10, v_today - 10, v_today + 5)
    RETURNING id INTO v_b1_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 10, v_today - 5, v_today + 15)
    RETURNING id INTO v_b2_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 10, v_today, v_today + 30)
    RETURNING id INTO v_b3_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 10, v_today - 20, v_today - 2)
    RETURNING id INTO v_b_exp_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date, is_archived)
    VALUES (v_prod1_id, 10, v_today - 5, v_today + 20, TRUE)
    RETURNING id INTO v_b_arch_id;

    -- Product 2 for User 1 (used to test cross-product batch allocation)
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (v_user1_id, v_cat_id, 'Override Test Product 2', '7770002', 80.00, 5)
    RETURNING id INTO v_prod2_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod2_id, 10, v_today - 2, v_today + 25)
    RETURNING id INTO v_b_prod2_id;

    -- Switch to User 2 to create User 2 fixtures
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (v_user2_id, v_cat_id, 'User 2 Product', '7770003', 50.00, 5)
    RETURNING id INTO v_prod_u2_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod_u2_id, 15, v_today - 1, v_today + 40)
    RETURNING id INTO v_b_u2_id;

    -- Reset to User 1 for core suite
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- --------------------------------------------------------------------------
    -- TEST 1: Selling from non-earliest batch deducts only that batch (bypasses FEFO)
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Choose Batch 2 (expires in 15 days) instead of Batch 1 (expires in 5 days)
        v_scan_id := public.record_sale_override(
            v_prod1_id,
            jsonb_build_array(jsonb_build_object('batch_id', v_b2_id, 'quantity', 4))
        );

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_b2_id;

        IF v_qty1 = 10 AND v_qty2 = 6 AND v_scan_id IS NOT NULL THEN
            INSERT INTO test_results VALUES (1, '1', 'Non-earliest batch deduction (bypasses FEFO)', 'PASS',
                format('Batch 1 remained untouched at %s, Batch 2 deducted to %s', v_qty1, v_qty2));
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'Non-earliest batch deduction (bypasses FEFO)', 'FAIL',
                format('Expected Batch 1=10, Batch 2=6; got Batch 1=%s, Batch 2=%s', v_qty1, v_qty2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'Non-earliest batch deduction (bypasses FEFO)', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: Splitting across two chosen batches
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Deduct 3 from Batch 1 and 2 from Batch 3 (Batch 2 should not change)
        v_scan_id := public.record_sale_override(
            v_prod1_id,
            jsonb_build_array(
                jsonb_build_object('batch_id', v_b1_id, 'quantity', 3),
                jsonb_build_object('batch_id', v_b3_id, 'quantity', 2)
            )
        );

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_b2_id;
        SELECT quantity_left INTO v_qty3 FROM public.batches WHERE id = v_b3_id;

        IF v_qty1 = 7 AND v_qty2 = 6 AND v_qty3 = 8 THEN
            INSERT INTO test_results VALUES (2, '2', 'Split sale across two chosen batches', 'PASS',
                format('Batch 1=%s, Batch 2=%s (untouched), Batch 3=%s', v_qty1, v_qty2, v_qty3));
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'Split sale across two chosen batches', 'FAIL',
                format('Expected B1=7, B2=6, B3=8; got B1=%s, B2=%s, B3=%s', v_qty1, v_qty2, v_qty3));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'Split sale across two chosen batches', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: Choosing earliest batch on purpose gives same result as record_sale
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Batch 1 is currently the earliest eligible batch (7 units remaining)
        -- Explicitly allocating 2 from Batch 1 mirrors FEFO deduction of 2 units
        v_scan_id := public.record_sale_override(
            v_prod1_id,
            jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', 2))
        );

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b1_id;

        IF v_qty1 = 5 THEN
            INSERT INTO test_results VALUES (3, '3', 'Choosing earliest batch explicitly matches FEFO', 'PASS',
                format('Batch 1 deducted to %s as expected', v_qty1));
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Choosing earliest batch explicitly matches FEFO', 'FAIL',
                format('Expected Batch 1=5; got %s', v_qty1));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', 'Choosing earliest batch explicitly matches FEFO', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: More than a batch has is refused and nothing changes
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Batch 1 has 5 units left. Request 6.
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', 6))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b1_id;

        IF v_err_caught AND v_qty1 = 5 AND v_err_msg ILIKE '%Insufficient stock%' THEN
            INSERT INTO test_results VALUES (4, '4', 'Exceeding batch quantity refused (atomic)', 'PASS',
                format('Correctly refused: %s (quantity unchanged: %s)', v_err_msg, v_qty1));
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'Exceeding batch quantity refused (atomic)', 'FAIL',
                format('Error caught: %s, message: %s, qty: %s', v_err_caught, v_err_msg, v_qty1));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'Exceeding batch quantity refused (atomic)', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: An expired batch is refused with clear error message
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b_exp_id, 'quantity', 1))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b_exp_id;

        IF v_err_caught AND v_qty1 = 10 AND v_err_msg ILIKE '%expired%' THEN
            INSERT INTO test_results VALUES (5, '5', 'Expired batch allocation refused', 'PASS',
                format('Correctly refused: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'Expired batch allocation refused', 'FAIL',
                format('Error caught: %s, message: %s', v_err_caught, v_err_msg));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'Expired batch allocation refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: An archived batch is refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b_arch_id, 'quantity', 1))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b_arch_id;

        IF v_err_caught AND v_qty1 = 10 AND v_err_msg ILIKE '%archived%' THEN
            INSERT INTO test_results VALUES (6, '6', 'Archived batch allocation refused', 'PASS',
                format('Correctly refused: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Archived batch allocation refused', 'FAIL',
                format('Error caught: %s, message: %s', v_err_caught, v_err_msg));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'Archived batch allocation refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: A batch of another product is refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Try allocating v_b_prod2_id (belongs to Product 2) under Product 1
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b_prod2_id, 'quantity', 1))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b_prod2_id;

        IF v_err_caught AND v_qty1 = 10 AND v_err_msg ILIKE '%does not belong to product%' THEN
            INSERT INTO test_results VALUES (7, '7', 'Batch of another product refused', 'PASS',
                format('Correctly refused: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'Batch of another product refused', 'FAIL',
                format('Error caught: %s, message: %s', v_err_caught, v_err_msg));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'Batch of another product refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: Duplicate batch IDs are refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(
                    jsonb_build_object('batch_id', v_b1_id, 'quantity', 1),
                    jsonb_build_object('batch_id', v_b1_id, 'quantity', 2)
                )
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        IF v_err_caught AND v_err_msg ILIKE '%Duplicate batch_id%' THEN
            INSERT INTO test_results VALUES (8, '8', 'Duplicate batch IDs refused', 'PASS',
                format('Correctly refused: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'Duplicate batch IDs refused', 'FAIL',
                format('Error caught: %s, message: %s', v_err_caught, v_err_msg));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'Duplicate batch IDs refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: Empty or invalid array payloads refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Test 9a: Empty array []
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(v_prod1_id, '[]'::jsonb);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        -- Test 9b: Non-array object {}
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(v_prod1_id, '{}'::jsonb);
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := TRUE;
            END;
        END IF;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (9, '9', 'Empty or non-array payload refused', 'PASS',
                'Both empty array and non-array object correctly refused');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'Empty or non-array payload refused', 'FAIL',
                'Invalid array was not refused');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (9, '9', 'Empty or non-array payload refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: Invalid UUID string format refused with clear error
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', 'not-a-valid-uuid', 'quantity', 1))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        IF v_err_caught AND v_err_msg ILIKE '%Invalid UUID format for batch_id%' THEN
            INSERT INTO test_results VALUES (10, '10', 'Invalid UUID string format refused', 'PASS',
                format('Clear error returned: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'Invalid UUID string format refused', 'FAIL',
                format('Expected invalid UUID error, got: %s', v_err_msg));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (10, '10', 'Invalid UUID string format refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 11: Invalid quantities refused (null, string, boolean, decimal, 0, negative)
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- 11a: Quantity is null
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', null))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := (SQLERRM ILIKE '%cannot be null%');
        END;

        -- 11b: Quantity is string
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', '3'))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%JSON number%');
            END;
        END IF;

        -- 11c: Quantity is boolean
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', true))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%JSON number%');
            END;
        END IF;

        -- 11d: Quantity is decimal
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', 2.5))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%whole number%');
            END;
        END IF;

        -- 11e: Quantity is 0
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', 0))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%at least 1%');
            END;
        END IF;

        -- 11f: Quantity is negative
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', -5))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%at least 1%');
            END;
        END IF;

        -- 11g: Quantity exceeds 100000
        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.record_sale_override(
                    v_prod1_id,
                    jsonb_build_array(jsonb_build_object('batch_id', v_b1_id, 'quantity', 100001))
                );
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := (SQLERRM ILIKE '%cannot exceed 100000%');
            END;
        END IF;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (11, '11', 'Invalid quantities refused with clear messages', 'PASS',
                'All invalid quantity forms (null, string, bool, decimal, 0, negative, >100k) refused');
        ELSE
            INSERT INTO test_results VALUES (11, '11', 'Invalid quantities refused with clear messages', 'FAIL',
                'One or more invalid quantity checks did not fail with expected message');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (11, '11', 'Invalid quantities refused with clear messages', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 12: undo_sale restores exactly chosen batches & second undo refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Record sale with Batch 2 (1 unit) and Batch 3 (2 units)
        -- Batch 2 is currently 6, Batch 3 is currently 8
        v_scan_undo_id := public.record_sale_override(
            v_prod1_id,
            jsonb_build_array(
                jsonb_build_object('batch_id', v_b2_id, 'quantity', 1),
                jsonb_build_object('batch_id', v_b3_id, 'quantity', 2)
            )
        );

        -- Verify deduction happened
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_b2_id;
        SELECT quantity_left INTO v_qty3 FROM public.batches WHERE id = v_b3_id;

        -- Execute undo_sale
        PERFORM public.undo_sale(v_scan_undo_id);

        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_b2_id;
        SELECT quantity_left INTO v_qty3 FROM public.batches WHERE id = v_b3_id;

        -- Attempt second undo (should fail)
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.undo_sale(v_scan_undo_id);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := (SQLERRM ILIKE '%already been undone%');
        END;

        IF v_qty2 = 6 AND v_qty3 = 8 AND v_err_caught THEN
            INSERT INTO test_results VALUES (12, '12', 'undo_sale restores chosen batches and blocks 2nd undo', 'PASS',
                format('Batches accurately restored (B2=%s, B3=%s) and repeat undo refused', v_qty2, v_qty3));
        ELSE
            INSERT INTO test_results VALUES (12, '12', 'undo_sale restores chosen batches and blocks 2nd undo', 'FAIL',
                format('B2=%s, B3=%s, repeat undo caught=%s', v_qty2, v_qty3, v_err_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (12, '12', 'undo_sale restores chosen batches and blocks 2nd undo', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 13: Normal record_sale (FEFO) still works afterwards
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Current non-expired stock: Batch 1 has 5, Batch 2 has 6, Batch 3 has 8.
        -- Standard record_sale of 4 units must deduct from earliest batch (Batch 1).
        v_scan_id := public.record_sale(v_prod1_id, 4);

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_b1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_b2_id;

        IF v_qty1 = 1 AND v_qty2 = 6 THEN
            INSERT INTO test_results VALUES (13, '13', 'FEFO record_sale continues working correctly', 'PASS',
                format('record_sale deducted 4 from earliest Batch 1 (remains %s), Batch 2 untouched (%s)', v_qty1, v_qty2));
        ELSE
            INSERT INTO test_results VALUES (13, '13', 'FEFO record_sale continues working correctly', 'FAIL',
                format('Expected B1=1, B2=6; got B1=%s, B2=%s', v_qty1, v_qty2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (13, '13', 'FEFO record_sale continues working correctly', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 14: get_sale_history reflects override sale breakdown and quantity
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Record a fresh override sale: 1 from Batch 2, 2 from Batch 3 (total 3 units)
        v_scan_id := public.record_sale_override(
            v_prod1_id,
            jsonb_build_array(
                jsonb_build_object('batch_id', v_b2_id, 'quantity', 1),
                jsonb_build_object('batch_id', v_b3_id, 'quantity', 2)
            )
        );

        SELECT total_quantity, batch_breakdown
        INTO v_history_total, v_history_breakdown
        FROM public.get_sale_history(10)
        WHERE sales_scan_id = v_scan_id;

        IF v_history_total = 3 AND jsonb_array_length(v_history_breakdown) = 2 THEN
            INSERT INTO test_results VALUES (14, '14', 'get_sale_history lists override sale accurately', 'PASS',
                format('Total quantity: %s, breakdown entries: %s', v_history_total, jsonb_array_length(v_history_breakdown)));
        ELSE
            INSERT INTO test_results VALUES (14, '14', 'get_sale_history lists override sale accurately', 'FAIL',
                format('Expected total=3, items=2; got total=%s, items=%s', v_history_total, jsonb_array_length(v_history_breakdown)));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (14, '14', 'get_sale_history lists override sale accurately', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 15: Cross-tenant isolation (other user cannot use my product/batches)
    -- --------------------------------------------------------------------------
    DECLARE
        v_attack1_err TEXT := NULL;
        v_attack2_err TEXT := NULL;
        v_attack1_refused BOOLEAN := FALSE;
        v_attack2_refused BOOLEAN := FALSE;
        v_control_succeeded BOOLEAN := FALSE;
        v_b3_initial_qty INTEGER;
        v_b3_final_qty INTEGER;
        v_u2_scans_count INTEGER;
        v_u2_deductions_count INTEGER;
        v_u2_batch_count_before INTEGER;
        v_u2_batch_qty_before INTEGER;
        v_u2_batch_count_after INTEGER;
        v_u2_batch_qty_after INTEGER;
        v_check_b3 BOOLEAN := FALSE;
        v_check_u2_scans_deductions BOOLEAN := FALSE;
        v_check_u2_batches BOOLEAN := FALSE;
    BEGIN
        RESET ROLE;

        -- Snapshot initial state before control and attacks
        SELECT quantity_left INTO v_b3_initial_qty FROM public.batches WHERE id = v_b3_id;
        SELECT COUNT(*), COALESCE(SUM(quantity_left), 0)
        INTO v_u2_batch_count_before, v_u2_batch_qty_before
        FROM public.batches
        WHERE product_id = v_prod_u2_id;

        -- Control: User 1 can sell from User 1's product and batch
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        BEGIN
            v_scan_id := public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b3_id, 'quantity', 1))
            );
            v_control_succeeded := (v_scan_id IS NOT NULL);
        EXCEPTION WHEN OTHERS THEN
            v_control_succeeded := FALSE;
        END;

        -- User 2 attempts:
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- Attack 1: User 2 calls override on User 1's product
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b3_id, 'quantity', 1))
            );
            v_attack1_refused := FALSE;
            v_attack1_err := 'No error raised';
        EXCEPTION WHEN OTHERS THEN
            v_attack1_err := SQLERRM;
            v_attack1_refused := (
                v_attack1_err ILIKE '%Product % not found, archived, or access denied%'
                OR v_attack1_err ILIKE '%access denied%'
            );
        END;

        -- Attack 2: User 2 calls override on User 2's product but with User 1's batch
        BEGIN
            PERFORM public.record_sale_override(
                v_prod_u2_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b3_id, 'quantity', 1))
            );
            v_attack2_refused := FALSE;
            v_attack2_err := 'No error raised';
        EXCEPTION WHEN OTHERS THEN
            v_attack2_err := SQLERRM;
            v_attack2_refused := (
                v_attack2_err ILIKE '%does not belong to product%'
                OR v_attack2_err ILIKE '%access denied%'
                OR v_attack2_err ILIKE '%Batch % not found%'
            );
        END;

        -- RESET ROLE and verify real database state
        RESET ROLE;

        -- (a) v_b3_id has quantity_left reduced by exactly the 1 unit sold by control (initial - 1)
        SELECT quantity_left INTO v_b3_final_qty FROM public.batches WHERE id = v_b3_id;
        v_check_b3 := (v_b3_final_qty = v_b3_initial_qty - 1);

        -- (b) no sales_scans and no deductions exist for v_user2_id
        SELECT COUNT(*) INTO v_u2_scans_count FROM public.sales_scans WHERE owner_id = v_user2_id;
        SELECT COUNT(*) INTO v_u2_deductions_count FROM public.deductions
        WHERE sales_scan_id IN (SELECT id FROM public.sales_scans WHERE owner_id = v_user2_id)
           OR batch_id IN (
               SELECT b.id FROM public.batches b
               JOIN public.products p ON p.id = b.product_id
               WHERE p.owner_id = v_user2_id
           );
        v_check_u2_scans_deductions := (v_u2_scans_count = 0 AND v_u2_deductions_count = 0);

        -- (c) product v_prod_u2_id batches are unchanged
        SELECT COUNT(*), COALESCE(SUM(quantity_left), 0)
        INTO v_u2_batch_count_after, v_u2_batch_qty_after
        FROM public.batches
        WHERE product_id = v_prod_u2_id;
        v_check_u2_batches := (
            v_u2_batch_count_after IS NOT DISTINCT FROM v_u2_batch_count_before
            AND v_u2_batch_qty_after IS NOT DISTINCT FROM v_u2_batch_qty_before
        );

        IF v_control_succeeded
           AND v_attack1_refused
           AND v_attack2_refused
           AND v_check_b3
           AND v_check_u2_scans_deductions
           AND v_check_u2_batches THEN
            INSERT INTO test_results VALUES (15, '15', 'Multi-tenant isolation on product and batches', 'PASS',
                'Control succeeded; both attacks refused; real state verified (b3 quantity reduced by 1, 0 scans/deductions for user2, user2 batches unchanged)');
        ELSE
            INSERT INTO test_results VALUES (15, '15', 'Multi-tenant isolation on product and batches', 'FAIL',
                format('Isolation failed: control_ok=%s, attack1_refused=%s (SQLERRM: %s), attack2_refused=%s (SQLERRM: %s), b3_reduced=%s (before: %s, after: %s), u2_scans=%s, u2_deductions=%s, u2_batches_unchanged=%s (count before: %s, qty before: %s, count after: %s, qty after: %s)',
                    v_control_succeeded,
                    v_attack1_refused,
                    COALESCE(v_attack1_err, 'none'),
                    v_attack2_refused,
                    COALESCE(v_attack2_err, 'none'),
                    v_check_b3,
                    v_b3_initial_qty,
                    v_b3_final_qty,
                    v_u2_scans_count,
                    v_u2_deductions_count,
                    v_check_u2_batches,
                    v_u2_batch_count_before,
                    v_u2_batch_qty_before,
                    v_u2_batch_count_after,
                    v_u2_batch_qty_after
                )
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        INSERT INTO test_results VALUES (15, '15', 'Multi-tenant isolation on product and batches', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 16: Anon role execution is refused
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', 'anon', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.record_sale_override(
                v_prod1_id,
                jsonb_build_array(jsonb_build_object('batch_id', v_b3_id, 'quantity', 1))
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
            v_err_msg := SQLERRM;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (16, '16', 'Anon role execution is refused', 'PASS',
                format('Anon correctly rejected: %s', v_err_msg));
        ELSE
            INSERT INTO test_results VALUES (16, '16', 'Anon role execution is refused', 'FAIL',
                'Anon execution was not blocked');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (16, '16', 'Anon role execution is refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- CLEANUP FIXTURES
    -- --------------------------------------------------------------------------
    BEGIN
        RESET ROLE;

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

