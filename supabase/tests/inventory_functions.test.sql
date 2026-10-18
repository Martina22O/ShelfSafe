-- ==============================================================================
-- ShelfSafe Backend Test Suite: Inventory Functions, FEFO, Undo, Alerts & Security
-- ==============================================================================
--
-- HOW TO RUN THIS TEST SUITE IN SUPABASE SQL EDITOR:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your ShelfSafe project.
-- 3. Click "SQL Editor" in the left-hand navigation sidebar.
-- 4. Click "+ New query".
-- 5. Copy and paste the ENTIRE contents of this file into the editor.
-- 6. Click "Run" (or press Ctrl + Enter / Cmd + Enter).
-- 7. View the "Results" tab to see the table of all test results and summary.
--
-- NOTE:
-- This script logs every result into a temporary table and displays it as
-- a formatted table in the Results panel. It always runs cleanup at the end
-- to remove any test fixtures, even if a test fails.
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
    -- Test Identifiers
    v_user1_id UUID := gen_random_uuid();
    v_user2_id UUID := gen_random_uuid();
    v_cat_id UUID;
    v_prod1_id UUID;
    v_prod2_id UUID;
    v_batch1_id UUID;
    v_batch2_id UUID;
    v_batch_exp_id UUID;
    v_batch_fresh_id UUID;
    v_scan_id UUID;

    -- Time reference (Asia/Manila)
    v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;

    -- Verification variables
    v_count INTEGER;
    v_qty1 INTEGER;
    v_qty2 INTEGER;
    v_scan_undone BOOLEAN;
    v_preview_rows INTEGER := 0;
    v_alert_found BOOLEAN;
    v_summary JSONB;
    v_error_caught BOOLEAN;

    -- Summary counters
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP: Mock Users & Products
    -- --------------------------------------------------------------------------
    SELECT id INTO v_cat_id FROM public.categories LIMIT 1;
    IF v_cat_id IS NULL THEN
        INSERT INTO public.categories (name) VALUES ('Test Category')
        RETURNING id INTO v_cat_id;
    END IF;

    -- Insert mock test users into auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
    (
        v_user1_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'test_user1@shelfsafe.local',
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
        v_user2_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'test_user2@shelfsafe.local',
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );

    -- Simulate User 1 authentication context
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

    -- Create test product for User 1
    INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
    VALUES (v_user1_id, v_cat_id, 'Test Canned Tuna', '999900001', 50.00, 10)
    RETURNING id INTO v_prod1_id;

    -- Batch 1: 5 units, expires in 10 days (earlier expiry)
    -- Batch 2: 50 units, expires in 30 days (later expiry)
    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 5, v_today - 5, v_today + 10)
    RETURNING id INTO v_batch1_id;

    INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
    VALUES (v_prod1_id, 50, v_today - 2, v_today + 30)
    RETURNING id INTO v_batch2_id;

    -- --------------------------------------------------------------------------
    -- TEST 1: PREVIEW SALE (DRY-RUN DOES NOT MUTATE STOCK)
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT COUNT(*) INTO v_preview_rows
        FROM public.preview_sale(v_prod1_id, 7);

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_batch1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch2_id;

        IF v_preview_rows = 2 AND v_qty1 = 5 AND v_qty2 = 50 THEN
            INSERT INTO test_results VALUES (1, '1', 'preview_sale (Dry-Run)', 'PASS', 'Calculated 2 batch deductions without mutating database');
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'preview_sale (Dry-Run)', 'FAIL', format('Mutated data or wrong row count (rows: %s, b1: %s, b2: %s)', v_preview_rows, v_qty1, v_qty2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'preview_sale (Dry-Run)', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: SALE ACROSS 2 BATCHES (FEFO DEDUCTION ORDER)
    -- --------------------------------------------------------------------------
    BEGIN
        v_scan_id := public.record_sale(v_prod1_id, 7);

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_batch1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch2_id;

        SELECT COUNT(*) INTO v_count
        FROM public.deductions
        WHERE sales_scan_id = v_scan_id;

        IF v_qty1 = 0 AND v_qty2 = 48 AND v_count = 2 THEN
            INSERT INTO test_results VALUES (2, '2', 'record_sale across 2 batches', 'PASS', 'Deducted 5 from Batch 1 and 2 from Batch 2 in FEFO order');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'record_sale across 2 batches', 'FAIL', format('Expected Batch1=0, Batch2=48, deductions=2; Got B1=%s, B2=%s, ded=%s', v_qty1, v_qty2, v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'record_sale across 2 batches', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: NOT ENOUGH STOCK FAILS WITH CLEAR ERROR AND CHANGES NOTHING
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.record_sale(v_prod1_id, 100);
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLERRM LIKE '%Insufficient stock%' THEN
                    v_error_caught := TRUE;
                END IF;
        END;

        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch2_id;

        IF v_error_caught AND v_qty2 = 48 THEN
            INSERT INTO test_results VALUES (3, '3', 'Insufficient stock rejection', 'PASS', 'Refused 100 units with clear error and preserved remaining 48 units');
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Insufficient stock rejection', 'FAIL', format('Error caught: %s, Batch 2 qty: %s', v_error_caught, v_qty2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', 'Insufficient stock rejection', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: UNDO SALE RESTORES UNITS TO THE SAME BATCHES
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM public.undo_sale(v_scan_id);

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_batch1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch2_id;
        SELECT is_undone INTO v_scan_undone FROM public.sales_scans WHERE id = v_scan_id;

        IF v_qty1 = 5 AND v_qty2 = 50 AND v_scan_undone = TRUE THEN
            INSERT INTO test_results VALUES (4, '4', 'undo_sale batch restoration', 'PASS', 'Restored exact units to original batches (B1=5, B2=50, is_undone=true)');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'undo_sale batch restoration', 'FAIL', format('Restoration failed: B1=%s, B2=%s, undone=%s', v_qty1, v_qty2, v_scan_undone));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'undo_sale batch restoration', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: UNDO TWICE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.undo_sale(v_scan_id);
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLERRM LIKE '%already been undone%' THEN
                    v_error_caught := TRUE;
                END IF;
        END;

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_batch1_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch2_id;

        IF v_error_caught AND v_qty1 = 5 AND v_qty2 = 50 THEN
            INSERT INTO test_results VALUES (5, '5', 'undo_sale duplicate refusal', 'PASS', 'Second undo refused with clear error; stock remained 5 and 50');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'undo_sale duplicate refusal', 'FAIL', format('Refusal failed: caught=%s, B1=%s, B2=%s', v_error_caught, v_qty1, v_qty2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'undo_sale duplicate refusal', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: EXPIRED BATCH SKIPPED BY SALE & FLAGGED IN EXPIRED ALERTS
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.products (owner_id, category_id, name, barcode, price, low_stock_level)
        VALUES (v_user1_id, v_cat_id, 'Test Fresh Milk', '999900002', 85.00, 5)
        RETURNING id INTO v_prod2_id;

        -- Expired batch: 10 units, expired 3 days ago
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_prod2_id, 10, v_today - 15, v_today - 3)
        RETURNING id INTO v_batch_exp_id;

        -- Fresh batch: 20 units, expires in 25 days
        INSERT INTO public.batches (product_id, quantity_left, purchase_date, expiration_date)
        VALUES (v_prod2_id, 20, v_today - 1, v_today + 25)
        RETURNING id INTO v_batch_fresh_id;

        -- Sale of 5 units: must skip expired batch and deduct only from fresh batch
        PERFORM public.record_sale(v_prod2_id, 5);

        SELECT quantity_left INTO v_qty1 FROM public.batches WHERE id = v_batch_exp_id;
        SELECT quantity_left INTO v_qty2 FROM public.batches WHERE id = v_batch_fresh_id;

        SELECT EXISTS (
            SELECT 1 FROM public.get_inventory_alerts(7)
            WHERE alert_type = 'expired' AND batch_id = v_batch_exp_id
        ) INTO v_alert_found;

        IF v_qty1 = 10 AND v_qty2 = 15 AND v_alert_found = TRUE THEN
            INSERT INTO test_results VALUES (6, '6', 'Expired batch handling', 'PASS', 'Skipped expired batch (still 10) and flagged in expired alerts');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Expired batch handling', 'FAIL', format('Exp batch qty=%s, Fresh qty=%s, Alert found=%s', v_qty1, v_qty2, v_alert_found));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'Expired batch handling', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: LOW-STOCK COUNTS ONLY NON-EXPIRED STOCK
    -- --------------------------------------------------------------------------
    BEGIN
        -- Milk low_stock_level = 5. Fresh batch currently has 15 units.
        -- Deduct 12 units so fresh batch has only 3 left (3 <= 5).
        -- Expired batch still has 10 units (total physical 13, non-expired 3).
        PERFORM public.record_sale(v_prod2_id, 12);

        SELECT EXISTS (
            SELECT 1 FROM public.get_inventory_alerts(7)
            WHERE alert_type = 'low_stock' AND product_id = v_prod2_id AND current_stock = 3
        ) INTO v_alert_found;

        IF v_alert_found = TRUE THEN
            INSERT INTO test_results VALUES (7, '7', 'Low-stock non-expired count', 'PASS', 'Flagged as low-stock based on 3 non-expired units (ignored 10 expired)');
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'Low-stock non-expired count', 'FAIL', 'Product was not flagged as low stock using non-expired count');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'Low-stock non-expired count', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: QUANTITY ZERO OR NEGATIVE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_error_caught := FALSE;
        BEGIN
            PERFORM public.record_sale(v_prod1_id, 0);
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLERRM LIKE '%greater than zero%' THEN
                    v_error_caught := TRUE;
                END IF;
        END;

        IF v_error_caught THEN
            v_error_caught := FALSE;
            BEGIN
                PERFORM public.record_sale(v_prod1_id, -3);
            EXCEPTION
                WHEN OTHERS THEN
                    IF SQLERRM LIKE '%greater than zero%' THEN
                        v_error_caught := TRUE;
                    END IF;
            END;
        END IF;

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (8, '8', 'Zero / negative quantity refusal', 'PASS', 'Both quantity 0 and negative values were strictly refused');
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'Zero / negative quantity refusal', 'FAIL', 'Zero or negative quantity was not rejected as expected');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'Zero / negative quantity refusal', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: CROSS-USER ACCESS CONTROL (MULTI-TENANCY)
    -- --------------------------------------------------------------------------
    BEGIN
        -- Switch to User 2 authentication context
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);

        v_error_caught := FALSE;
        BEGIN
            PERFORM public.record_sale(v_prod1_id, 1);
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLERRM LIKE '%not found, archived, or access denied%' THEN
                    v_error_caught := TRUE;
                END IF;
        END;

        IF v_error_caught THEN
            v_error_caught := FALSE;
            BEGIN
                PERFORM public.undo_sale(v_scan_id);
            EXCEPTION
                WHEN OTHERS THEN
                    IF SQLERRM LIKE '%not found or access denied%' THEN
                        v_error_caught := TRUE;
                    END IF;
            END;
        END IF;

        -- Restore User 1 context
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        IF v_error_caught THEN
            INSERT INTO test_results VALUES (9, '9', 'Multi-tenant isolation', 'PASS', 'User 2 cannot record_sale or undo_sale on User 1 inventory');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'Multi-tenant isolation', 'FAIL', 'Cross-user boundary violation was not blocked');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        INSERT INTO test_results VALUES (9, '9', 'Multi-tenant isolation', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: SALE HISTORY & HOME SUMMARY QUERIES
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT COUNT(*) INTO v_count FROM public.get_sale_history(10);
        v_summary := public.get_home_summary();

        IF v_count >= 1 AND v_summary ? 'metrics' AND v_summary ? 'most_stocked' AND v_summary ? 'alert_counts' THEN
            INSERT INTO test_results VALUES (10, '10', 'History & Home Summary RPCs', 'PASS', 'Returned structured sales history and dashboard metrics');
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'History & Home Summary RPCs', 'FAIL', format('History count=%s, Summary valid=%s', v_count, (v_summary IS NOT NULL)));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (10, '10', 'History & Home Summary RPCs', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- CLEANUP: Always executed to remove all test data created by this run
    -- --------------------------------------------------------------------------
    BEGIN
        DELETE FROM public.deductions WHERE sales_scan_id IN (
            SELECT id FROM public.sales_scans WHERE owner_id IN (v_user1_id, v_user2_id)
        );
        DELETE FROM public.deductions WHERE batch_id IN (
            SELECT id FROM public.batches WHERE product_id IN (v_prod1_id, v_prod2_id)
        );
        DELETE FROM public.sales_scans WHERE owner_id IN (v_user1_id, v_user2_id);
        DELETE FROM public.batches WHERE product_id IN (v_prod1_id, v_prod2_id);
        DELETE FROM public.products WHERE id IN (v_prod1_id, v_prod2_id) OR owner_id IN (v_user1_id, v_user2_id);
        DELETE FROM auth.users WHERE id IN (v_user1_id, v_user2_id);
        PERFORM set_config('request.jwt.claim.sub', '', true);
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (98, 'CLEANUP', 'Cleanup fixtures', 'FAIL', format('Cleanup error: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- SUMMARY ROW
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) FILTER (WHERE status = 'PASS'), COUNT(*) FILTER (WHERE status = 'FAIL')
    INTO v_passed, v_failed
    FROM test_results
    WHERE test_order BETWEEN 1 AND 10;

    INSERT INTO test_results VALUES (
        99,
        'SUMMARY',
        'OVERALL SUITE RESULT',
        CASE WHEN v_failed = 0 THEN 'PASS' ELSE 'FAIL' END,
        format('%s of 10 passed (%s failed)', v_passed, v_failed)
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
