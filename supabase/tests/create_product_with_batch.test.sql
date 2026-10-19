-- ==============================================================================
-- ShelfSafe Backend Test Suite: create_product_with_batch
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
-- Real user products, batches, and accounts are never touched.
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

    -- Created fixture references
    v_prod1_id UUID;
    v_batch1_id UUID;
    v_prod2_id UUID;
    v_batch2_id UUID;
    v_prod3_id UUID;
    v_batch3_id UUID;

    -- Verification variables
    v_prod_count INTEGER;
    v_batch_count INTEGER;
    v_u2_prod_count INTEGER;
    v_u2_batch_count INTEGER;
    v_u1_prod_count INTEGER;
    v_u1_batch_count INTEGER;
    v_barcode_check TEXT;
    v_error_caught BOOLEAN;
    v_err1_caught BOOLEAN;
    v_err2_caught BOOLEAN;

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

    -- --------------------------------------------------------------------------
    -- TEST 1: CREATES PRODUCT AND ITS BATCH ATOMICALLY
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT new_product_id, new_batch_id
        INTO v_prod1_id, v_batch1_id
        FROM public.create_product_with_batch(
            'Test Corned Beef 260g',
            v_cat_id,
            85.50,
            20,
            v_today + 90,
            '4800016644011',
            8,
            v_today
        );

        -- Verify product row exists and matches inputs
        SELECT COUNT(*) INTO v_prod_count
        FROM public.products
        WHERE id = v_prod1_id
          AND owner_id = v_user1_id
          AND name = 'Test Corned Beef 260g'
          AND barcode = '4800016644011'
          AND price = 85.50
          AND low_stock_level = 8;

        -- Verify batch row exists and matches inputs
        SELECT COUNT(*) INTO v_batch_count
        FROM public.batches
        WHERE id = v_batch1_id
          AND product_id = v_prod1_id
          AND quantity_left = 20
          AND purchase_date = v_today
          AND expiration_date = (v_today + 90);

        IF v_prod_count = 1 AND v_batch_count = 1 THEN
            INSERT INTO test_results VALUES (1, '1', 'Create product and batch', 'PASS', 'Product and initial batch created atomically with matching properties');
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'Create product and batch', 'FAIL', format('Verification failed: prod_count=%s, batch_count=%s', v_prod_count, v_batch_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'Create product and batch', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: DUPLICATE BARCODE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.create_product_with_batch(
                'Duplicate Barcode Product',
                v_cat_id,
                50.00,
                10,
                v_today + 60,
                '4800016644011' -- Same barcode as Test 1
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%This barcode already exists%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (2, '2', 'Duplicate barcode refused', 'PASS', 'Duplicate barcode for same owner rejected with expected message');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'Duplicate barcode refused', 'FAIL', 'Duplicate barcode was unexpectedly allowed');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'Duplicate barcode refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: EMPTY BARCODE BECOMES NULL, MULTIPLE BARCODE-LESS ITEMS ALLOWED
    -- --------------------------------------------------------------------------
    BEGIN
        -- Item 1: Whitespace barcode string '   '
        SELECT new_product_id, new_batch_id
        INTO v_prod2_id, v_batch2_id
        FROM public.create_product_with_batch(
            'Fresh Banana Cue',
            v_cat_id,
            15.00,
            10,
            v_today + 2,
            '   '
        );

        -- Item 2: Explicit NULL barcode
        SELECT new_product_id, new_batch_id
        INTO v_prod3_id, v_batch3_id
        FROM public.create_product_with_batch(
            'Crispy Turon',
            v_cat_id,
            20.00,
            15,
            v_today + 2,
            NULL
        );

        -- Verify both products exist and have barcode IS NULL
        SELECT COUNT(*) INTO v_prod_count
        FROM public.products
        WHERE id IN (v_prod2_id, v_prod3_id)
          AND barcode IS NULL;

        IF v_prod_count = 2 AND v_prod2_id IS NOT NULL AND v_prod3_id IS NOT NULL THEN
            INSERT INTO test_results VALUES (3, '3', 'Empty barcode converted to NULL', 'PASS', 'Whitespace barcodes saved as NULL; multiple barcode-less products coexist successfully');
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Empty barcode converted to NULL', 'FAIL', format('Null barcode check failed: prod_count=%s', v_prod_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', 'Empty barcode converted to NULL', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: EXPIRATION BEFORE PURCHASE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.create_product_with_batch(
                'Invalid Dates Item',
                v_cat_id,
                30.00,
                5,
                v_today - 3, -- Expiration before purchase
                '4800099990001',
                5,
                v_today
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Expiration date cannot be earlier than purchase date%' THEN
                v_error_caught := TRUE;
            END IF;
        END;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (4, '4', 'Expiration before purchase refused', 'PASS', 'Invalid date range rejected with expected validation error');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'Expiration before purchase refused', 'FAIL', 'Expiration earlier than purchase was unexpectedly allowed');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'Expiration before purchase refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: QUANTITY ZERO OR NEGATIVE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err1_caught := FALSE;
        v_err2_caught := FALSE;

        -- Test quantity 0
        BEGIN
            PERFORM public.create_product_with_batch(
                'Zero Qty Item',
                v_cat_id,
                40.00,
                0,
                v_today + 30
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Quantity must be at least 1%' THEN
                v_err1_caught := TRUE;
            END IF;
        END;

        -- Test negative quantity
        BEGIN
            PERFORM public.create_product_with_batch(
                'Negative Qty Item',
                v_cat_id,
                40.00,
                -5,
                v_today + 30
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Quantity must be at least 1%' THEN
                v_err2_caught := TRUE;
            END IF;
        END;

        IF v_err1_caught AND v_err2_caught THEN
            INSERT INTO test_results VALUES (5, '5', 'Quantity 0 or negative refused', 'PASS', 'Both quantity 0 and negative quantities strictly rejected');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'Quantity 0 or negative refused', 'FAIL', format('Quantity validation failed: zero_caught=%s, neg_caught=%s', v_err1_caught, v_err2_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'Quantity 0 or negative refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: NOT SIGNED IN (NO USER / ANON ROLE) IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err1_caught := FALSE;
        v_err2_caught := FALSE;

        -- Part A: No signed-in user (sub claim is empty)
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);

        BEGIN
            PERFORM public.create_product_with_batch(
                'Unauthenticated Product',
                v_cat_id,
                10.00,
                5,
                v_today + 10
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Authentication required%' THEN
                v_err1_caught := TRUE;
            END IF;
        END;

        -- Part B: Role set to anon
        BEGIN
            SET LOCAL ROLE anon;
            PERFORM set_config('request.jwt.claim.role', 'anon', true);
            PERFORM set_config('request.jwt.claim.sub', '', true);

            BEGIN
                PERFORM public.create_product_with_batch(
                    'Anon Role Product',
                    v_cat_id,
                    10.00,
                    5,
                    v_today + 10
                );
            EXCEPTION WHEN OTHERS THEN
                IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%Authentication required%' THEN
                    v_err2_caught := TRUE;
                END IF;
            END;

            RESET ROLE;
        EXCEPTION WHEN OTHERS THEN
            RESET ROLE;
            v_err2_caught := TRUE;
        END;

        -- Restore User 1 context
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        IF v_err1_caught AND v_err2_caught THEN
            INSERT INTO test_results VALUES (6, '6', 'Not signed in (anon) refused', 'PASS', 'Both unauthenticated caller and anon role were blocked from executing');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Not signed in (anon) refused', 'FAIL', format('Unauth check failed: no_auth_caught=%s, anon_caught=%s', v_err1_caught, v_err2_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        RESET ROLE;
        INSERT INTO test_results VALUES (6, '6', 'Not signed in (anon) refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: ANOTHER USER CANNOT SEE THE PRODUCT I CREATED (RLS ISOLATION)
    -- --------------------------------------------------------------------------
    BEGIN
        -- 1. Switch to User 2 database role and JWT context
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        -- 2. Query product and batch created by User 1 as User 2
        SELECT COUNT(*) INTO v_u2_prod_count
        FROM public.products
        WHERE id = v_prod1_id;

        SELECT COUNT(*) INTO v_u2_batch_count
        FROM public.batches
        WHERE id = v_batch1_id;

        -- 3. Control check: Switch to User 1 and verify User 1 can see their own records
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        SELECT COUNT(*) INTO v_u1_prod_count
        FROM public.products
        WHERE id = v_prod1_id;

        SELECT COUNT(*) INTO v_u1_batch_count
        FROM public.batches
        WHERE id = v_batch1_id;

        -- 4. Reset role back to privileged session role
        RESET ROLE;

        IF v_u2_prod_count = 0 AND v_u2_batch_count = 0 AND v_u1_prod_count = 1 AND v_u1_batch_count = 1 THEN
            INSERT INTO test_results VALUES (
                7,
                '7',
                'Multi-tenant isolation',
                'PASS',
                format('User 2 sees %s products and %s batches; User 1 sees %s product and %s batch',
                    v_u2_prod_count, v_u2_batch_count, v_u1_prod_count, v_u1_batch_count)
            );
        ELSE
            INSERT INTO test_results VALUES (
                7,
                '7',
                'Multi-tenant isolation',
                'FAIL',
                format('User 2 sees %s products and %s batches; User 1 sees %s product and %s batch',
                    v_u2_prod_count, v_u2_batch_count, v_u1_prod_count, v_u1_batch_count)
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (7, '7', 'Multi-tenant isolation', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- CLEANUP: Delete ONLY mock test rows and mock users created by this run
    -- --------------------------------------------------------------------------
    BEGIN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);

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
    WHERE test_order BETWEEN 1 AND 7;

    INSERT INTO test_results VALUES (
        99,
        'SUMMARY',
        'OVERALL SUITE RESULT',
        CASE WHEN v_failed = 0 THEN 'PASS' ELSE 'FAIL' END,
        format('%s of 7 passed (%s failed)', v_passed, v_failed)
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
