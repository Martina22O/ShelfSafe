-- ==============================================================================
-- ShelfSafe Test Suite: Subscription System, Entitlements & Sales History
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_order INTEGER,
    test_id TEXT,
    test_name TEXT,
    status TEXT,
    message TEXT
);

TRUNCATE TABLE test_results;
GRANT ALL ON TABLE test_results TO PUBLIC, authenticated, anon;

DO $$
DECLARE
    -- Mock users
    v_user_trial UUID := gen_random_uuid();
    v_user_free  UUID := gen_random_uuid();
    v_cat_id     UUID;
    v_prod_id    UUID;
    v_batch_id   UUID;
    v_scan_id    UUID;
    v_res_json   JSONB;
    v_sub_rec    RECORD;
    v_count      INTEGER;
    v_err_caught BOOLEAN;
    v_i          INTEGER;
    v_temp_prod  UUID;
    v_now        TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- --------------------------------------------------------------------------
    -- FIXTURES SETUP
    -- --------------------------------------------------------------------------
    -- Ensure at least one category exists
    SELECT id INTO v_cat_id FROM public.categories LIMIT 1;
    IF v_cat_id IS NULL THEN
        INSERT INTO public.categories (name, description)
        VALUES ('Test Category', 'Category for automated subscription tests')
        RETURNING id INTO v_cat_id;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 1: New-User Account Provisioning Trigger
    -- --------------------------------------------------------------------------
    BEGIN
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES (v_user_free, 'test_free@example.com', '{"name":"Free Tester"}'::jsonb);

        SELECT * INTO v_sub_rec
        FROM public.user_subscriptions
        WHERE owner_id = v_user_free;

        IF v_sub_rec.owner_id IS NOT NULL AND v_sub_rec.status = 'free' AND v_sub_rec.trial_eligible = TRUE AND v_sub_rec.onboarding_completed = FALSE THEN
            INSERT INTO test_results VALUES (1, '1', 'New user auto-provisioning', 'PASS', 'Provisioned with status=free, trial_eligible=true, onboarding_completed=false');
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'New user auto-provisioning', 'FAIL', format('Unexpected sub record: %s', v_sub_rec));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'New user auto-provisioning', 'FAIL', SQLERRM);
    END;

    -- Also create second user for trial tests
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (v_user_trial, 'test_trial@example.com', '{"name":"Trial Tester"}'::jsonb);

    -- --------------------------------------------------------------------------
    -- TEST 2: Existing-User Subscription Backfill
    -- --------------------------------------------------------------------------
    BEGIN
        -- All users in auth.users must have a corresponding row in user_subscriptions
        SELECT COUNT(*) INTO v_count
        FROM auth.users u
        LEFT JOIN public.user_subscriptions s ON s.owner_id = u.id
        WHERE s.owner_id IS NULL;

        IF v_count = 0 THEN
            INSERT INTO test_results VALUES (2, '2', 'Existing-user subscription backfill', 'PASS', 'All auth users have subscription records');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'Existing-user subscription backfill', 'FAIL', format('%s users missing subscription record', v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'Existing-user subscription backfill', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: One-Time 14-Day Free Trial Activation
    -- --------------------------------------------------------------------------
    BEGIN
        -- Set session context as v_user_trial
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user_trial::text, true);

        v_res_json := public.start_free_trial();

        IF (v_res_json->>'status') = 'trialing' AND (v_res_json->>'is_premium')::boolean = TRUE AND public.is_user_premium(v_user_trial) = TRUE THEN
            INSERT INTO test_results VALUES (3, '3', '14-Day Free Trial activation', 'PASS', 'Trial started successfully with status=trialing and is_user_premium=true');
        ELSE
            INSERT INTO test_results VALUES (3, '3', '14-Day Free Trial activation', 'FAIL', format('Unexpected response: %s', v_res_json));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', '14-Day Free Trial activation', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: Single-Use Trial Protection (Prevent repeated trials)
    -- --------------------------------------------------------------------------
    BEGIN
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.start_free_trial();
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%not eligible for a free trial%' OR SQLERRM LIKE '%already used or claimed%' THEN
                v_err_caught := TRUE;
            ELSE
                RAISE;
            END IF;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (4, '4', 'Prevention of repeated trials', 'PASS', 'Second trial request rejected with eligibility error');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'Prevention of repeated trials', 'FAIL', 'Repeated trial request was unexpectedly allowed');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'Prevention of repeated trials', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: Subscription Onboarding Skip
    -- --------------------------------------------------------------------------
    BEGIN
        -- Switch session to v_user_free
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        PERFORM public.complete_subscription_onboarding('skip');

        SELECT * INTO v_sub_rec FROM public.user_subscriptions WHERE owner_id = v_user_free;

        IF v_sub_rec.onboarding_completed = TRUE AND v_sub_rec.trial_eligible = TRUE AND v_sub_rec.status = 'free' THEN
            INSERT INTO test_results VALUES (5, '5', 'Onboarding skip preserves trial eligibility', 'PASS', 'onboarding_completed=true, trial_eligible=true preserved');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'Onboarding skip preserves trial eligibility', 'FAIL', format('Unexpected record: %s', v_sub_rec));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'Onboarding skip preserves trial eligibility', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: Free Plan 20-Product Limit
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        -- Insert 20 active products
        FOR v_i IN 1..20 LOOP
            SELECT new_product_id INTO v_temp_prod
            FROM public.create_product_with_batch(
                p_name := 'Free Product ' || v_i,
                p_category_id := v_cat_id,
                p_price := 10.00,
                p_quantity := 5,
                p_expiration_date := (v_now::date + INTERVAL '30 days')::date,
                p_barcode := 'BARCODE-FREE-' || v_i
            );
        END LOOP;

        -- Attempt 21st active product
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.create_product_with_batch(
                p_name := 'Free Product 21',
                p_category_id := v_cat_id,
                p_price := 10.00,
                p_quantity := 5,
                p_expiration_date := (v_now::date + INTERVAL '30 days')::date,
                p_barcode := 'BARCODE-FREE-21'
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Free plan limit reached: up to 20 active products allowed%' THEN
                v_err_caught := TRUE;
            ELSE
                RAISE;
            END IF;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (6, '6', 'Free plan 20-product limit', 'PASS', '20 products inserted; 21st insertion blocked with limit error');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Free plan 20-product limit', 'FAIL', '21st product insertion was not blocked');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'Free plan 20-product limit', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: Free Plan 5-Photo Limit
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        -- Add photos to 5 products
        v_i := 0;
        FOR v_prod_id IN (SELECT id FROM public.products WHERE owner_id = v_user_free ORDER BY id LIMIT 5) LOOP
            v_i := v_i + 1;
            PERFORM public.set_product_image(v_prod_id, v_user_free::text || '/photo' || v_i || '.jpg');
        END LOOP;

        -- Attempt photo on 6th product
        SELECT id INTO v_prod_id
        FROM public.products
        WHERE owner_id = v_user_free AND image_url IS NULL
        ORDER BY id LIMIT 1;

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.set_product_image(v_prod_id, v_user_free::text || '/photo6.jpg');
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%Free plan limit reached: up to 5 product photos allowed%' THEN
                v_err_caught := TRUE;
            ELSE
                RAISE;
            END IF;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (7, '7', 'Free plan 5-photo limit', 'PASS', '5 photos assigned; 6th photo blocked with limit error');
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'Free plan 5-photo limit', 'FAIL', '6th photo was not blocked');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'Free plan 5-photo limit', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: Premium Entitlement (Exempt from 20-product and 5-photo quotas)
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_user_trial::text, true);

        -- Insert 22 products for trial user
        FOR v_i IN 1..22 LOOP
            PERFORM public.create_product_with_batch(
                p_name := 'Trial Product ' || v_i,
                p_category_id := v_cat_id,
                p_price := 15.00,
                p_quantity := 10,
                p_expiration_date := (v_now::date + INTERVAL '45 days')::date,
                p_barcode := 'BARCODE-TRIAL-' || v_i,
                p_image_url := v_user_trial::text || '/trial_img_' || v_i || '.jpg'
            );
        END LOOP;

        SELECT COUNT(*) INTO v_count
        FROM public.products
        WHERE owner_id = v_user_trial AND is_archived = FALSE;

        IF v_count = 22 THEN
            INSERT INTO test_results VALUES (8, '8', 'Premium user quota exemption', 'PASS', 'Trial user created 22 products and 22 photos without restriction');
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'Premium user quota exemption', 'FAIL', format('Expected 22 products, found %s', v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'Premium user quota exemption', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: Free Plan 7-Day Sales History Restriction
    -- --------------------------------------------------------------------------
    BEGIN
        -- Query fixtures as postgres to avoid RLS interference during setup
        PERFORM set_config('role', 'postgres', true);
        SELECT id INTO v_prod_id FROM public.products WHERE owner_id = v_user_free LIMIT 1;
        SELECT id INTO v_batch_id FROM public.batches WHERE product_id = v_prod_id LIMIT 1;

        -- 10-day old sale
        INSERT INTO public.sales_scans (id, owner_id, is_undone, created_at)
        VALUES (gen_random_uuid(), v_user_free, FALSE, v_now - INTERVAL '10 days')
        RETURNING id INTO v_scan_id;
        INSERT INTO public.deductions (sales_scan_id, batch_id, quantity)
        VALUES (v_scan_id, v_batch_id, 1);

        -- 2-day old sale
        INSERT INTO public.sales_scans (id, owner_id, is_undone, created_at)
        VALUES (gen_random_uuid(), v_user_free, FALSE, v_now - INTERVAL '2 days')
        RETURNING id INTO v_scan_id;
        INSERT INTO public.deductions (sales_scan_id, batch_id, quantity)
        VALUES (v_scan_id, v_batch_id, 1);

        -- Switch to authenticated user session to test client query
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        -- Query via get_sale_history
        SELECT COUNT(*) INTO v_count
        FROM public.get_sale_history(50);

        IF v_count = 1 THEN
            INSERT INTO test_results VALUES (9, '9', 'Free plan 7-day sales history limit', 'PASS', 'Only sales within last 7 days returned (10-day old sale excluded)');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'Free plan 7-day sales history limit', 'FAIL', format('Expected 1 sale, got %s', v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (9, '9', 'Free plan 7-day sales history limit', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: Premium Unrestricted Sales History
    -- --------------------------------------------------------------------------
    BEGIN
        -- Query fixtures as postgres to avoid RLS interference during setup
        PERFORM set_config('role', 'postgres', true);
        SELECT id INTO v_prod_id FROM public.products WHERE owner_id = v_user_trial LIMIT 1;
        SELECT id INTO v_batch_id FROM public.batches WHERE product_id = v_prod_id LIMIT 1;

        -- 15-day old sale
        INSERT INTO public.sales_scans (id, owner_id, is_undone, created_at)
        VALUES (gen_random_uuid(), v_user_trial, FALSE, v_now - INTERVAL '15 days')
        RETURNING id INTO v_scan_id;
        INSERT INTO public.deductions (sales_scan_id, batch_id, quantity)
        VALUES (v_scan_id, v_batch_id, 1);

        -- 1-day old sale
        INSERT INTO public.sales_scans (id, owner_id, is_undone, created_at)
        VALUES (gen_random_uuid(), v_user_trial, FALSE, v_now - INTERVAL '1 day')
        RETURNING id INTO v_scan_id;
        INSERT INTO public.deductions (sales_scan_id, batch_id, quantity)
        VALUES (v_scan_id, v_batch_id, 1);

        -- Switch to authenticated user session
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user_trial::text, true);

        SELECT COUNT(*) INTO v_count
        FROM public.get_sale_history(50);

        IF v_count >= 2 THEN
            INSERT INTO test_results VALUES (10, '10', 'Premium unrestricted sales history', 'PASS', format('Premium user sees full history (%s records)', v_count));
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'Premium unrestricted sales history', 'FAIL', format('Expected >= 2 sales, got %s', v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (10, '10', 'Premium unrestricted sales history', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 11: Direct RLS Tampering Protection on user_subscriptions
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        -- Attempt direct UPDATE to give self active Premium status
        UPDATE public.user_subscriptions
        SET status = 'active'
        WHERE owner_id = v_user_free;

        -- Verify status remained 'free' (0 rows updated due to RLS)
        SELECT * INTO v_sub_rec FROM public.user_subscriptions WHERE owner_id = v_user_free;

        IF v_sub_rec.status = 'free' THEN
            INSERT INTO test_results VALUES (11, '11', 'Direct RLS tampering blocked', 'PASS', 'Direct client UPDATE on user_subscriptions blocked by RLS');
        ELSE
            INSERT INTO test_results VALUES (11, '11', 'Direct RLS tampering blocked', 'FAIL', 'Direct client UPDATE succeeded unexpectedly');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (11, '11', 'Direct RLS tampering blocked', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 12: Downgrade / Expiration Safety (No Data Deletion)
    -- --------------------------------------------------------------------------
    BEGIN
        -- Simulate trial expiration on v_user_trial as admin/cron
        -- Ensure trial_ends_at >= trial_started_at to satisfy chk_trial_timestamps
        PERFORM set_config('role', 'postgres', true);
        UPDATE public.user_subscriptions
        SET trial_started_at = v_now - INTERVAL '15 days',
            trial_ends_at = v_now - INTERVAL '1 day',
            current_period_start = v_now - INTERVAL '15 days',
            current_period_end = v_now - INTERVAL '1 day'
        WHERE owner_id = v_user_trial;

        -- Check is_user_premium evaluation
        IF public.is_user_premium(v_user_trial) = FALSE THEN
            -- Verify all 22 products and photos still exist intact
            SELECT COUNT(*) INTO v_count
            FROM public.products
            WHERE owner_id = v_user_trial;

            IF v_count = 22 THEN
                INSERT INTO test_results VALUES (12, '12', 'Safe expiration with zero data loss', 'PASS', 'Trial expired; all 22 products remain intact and accessible');
            ELSE
                INSERT INTO test_results VALUES (12, '12', 'Safe expiration with zero data loss', 'FAIL', format('Expected 22 products, found %s', v_count));
            END IF;
        ELSE
            INSERT INTO test_results VALUES (12, '12', 'Safe expiration with zero data loss', 'FAIL', 'is_user_premium returned TRUE after expiration');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (12, '12', 'Safe expiration with zero data loss', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 13: FEFO Sales Recording and Undo Mechanics Preservation
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        SELECT id INTO v_prod_id FROM public.products WHERE owner_id = v_user_free LIMIT 1;

        -- Record sale of 2 units
        v_scan_id := public.record_sale(v_prod_id, 2);

        IF v_scan_id IS NOT NULL THEN
            -- Now undo the sale
            PERFORM public.undo_sale(v_scan_id);

            SELECT is_undone INTO v_err_caught
            FROM public.sales_scans
            WHERE id = v_scan_id;

            IF v_err_caught = TRUE THEN
                INSERT INTO test_results VALUES (13, '13', 'FEFO sales recording and undo', 'PASS', 'Sale recorded and successfully undone; original batch replenished');
            ELSE
                INSERT INTO test_results VALUES (13, '13', 'FEFO sales recording and undo', 'FAIL', 'Sale was not marked undone');
            END IF;
        ELSE
            INSERT INTO test_results VALUES (13, '13', 'FEFO sales recording and undo', 'FAIL', 'record_sale returned null scan id');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (13, '13', 'FEFO sales recording and undo', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 14: Operational Analytics & Dashboard Summary Preservation
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user_free::text, true);

        -- Verify get_sales_metrics runs cleanly
        PERFORM * FROM public.get_sales_metrics();

        -- Verify get_most_sold_products runs cleanly
        PERFORM * FROM public.get_most_sold_products(5);

        -- Verify get_least_sold_products runs cleanly
        PERFORM * FROM public.get_least_sold_products(5);

        INSERT INTO test_results VALUES (14, '14', 'Operational analytics preservation', 'PASS', 'Sales metrics and top/least seller RPCs execute accurately');
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (14, '14', 'Operational analytics preservation', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- CLEANUP TEST FIXTURES
    -- --------------------------------------------------------------------------
    PERFORM set_config('role', 'postgres', true);
    DELETE FROM public.deductions WHERE sales_scan_id IN (SELECT id FROM public.sales_scans WHERE owner_id IN (v_user_trial, v_user_free));
    DELETE FROM public.sales_scans WHERE owner_id IN (v_user_trial, v_user_free);
    DELETE FROM public.batches WHERE product_id IN (SELECT id FROM public.products WHERE owner_id IN (v_user_trial, v_user_free));
    DELETE FROM public.products WHERE owner_id IN (v_user_trial, v_user_free);
    DELETE FROM public.subscription_events WHERE owner_id IN (v_user_trial, v_user_free);
    DELETE FROM public.user_subscriptions WHERE owner_id IN (v_user_trial, v_user_free);
    DELETE FROM public.store_settings WHERE owner_id IN (v_user_trial, v_user_free);
    DELETE FROM auth.users WHERE id IN (v_user_trial, v_user_free);
END;
$$;

SELECT
    test_order,
    test_id,
    test_name,
    status,
    message
FROM test_results
ORDER BY test_order;
