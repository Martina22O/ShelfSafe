-- ==============================================================================
-- ShelfSafe Backend Test Suite: Store Settings Table, RLS & Functions
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

    -- Verification variables
    v_res RECORD;
    v_get_res RECORD;
    v_count INTEGER;
    v_affected_rows INTEGER;
    v_t1 TIMESTAMPTZ;
    v_t2 TIMESTAMPTZ;

    v_err_caught BOOLEAN;
    v_err1_caught BOOLEAN;
    v_err2_caught BOOLEAN;
    v_err3_caught BOOLEAN;
    v_err4_caught BOOLEAN;

    -- Summary counters
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP: Mock Users in auth.users
    -- --------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
    (
        v_user1_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('mock_store_user1_%s@shelfsafe.local', v_user1_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
        v_user2_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', format('mock_store_user2_%s@shelfsafe.local', v_user2_id),
        '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );

    -- Simulate User 1 authentication context initially
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- --------------------------------------------------------------------------
    -- TEST 1: DEFAULTS RETURNED WHEN NO ROW EXISTS (AND NOTHING WRITTEN)
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT * INTO v_res FROM public.get_store_settings();

        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user1_id;

        IF v_res.out_owner_id = v_user1_id
           AND v_res.out_store_name IS NULL
           AND v_res.out_contact_number IS NULL
           AND v_res.out_near_expiry_days = 7
           AND v_res.out_created_at IS NULL
           AND v_res.out_updated_at IS NULL
           AND v_count = 0 THEN
            INSERT INTO test_results VALUES (1, '1', 'Defaults when no row exists', 'PASS', 'Default values returned (near_expiry_days=7, name=NULL, contact=NULL) and 0 rows written');
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'Defaults when no row exists', 'FAIL', format('Unexpected result: name=%s, contact=%s, days=%s, row_count=%s', v_res.out_store_name, v_res.out_contact_number, v_res.out_near_expiry_days, v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'Defaults when no row exists', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: SAVE THEN GET RETURNS SAVED VALUES (INITIALIZES DAYS TO 7)
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT * INTO v_res
        FROM public.save_store_details('Aling Nena Sari-Sari Store', '09171234567');

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user1_id;

        IF v_res.out_store_name = 'Aling Nena Sari-Sari Store'
           AND v_res.out_contact_number = '09171234567'
           AND v_res.out_near_expiry_days = 7
           AND v_get_res.out_store_name = 'Aling Nena Sari-Sari Store'
           AND v_get_res.out_contact_number = '09171234567'
           AND v_get_res.out_near_expiry_days = 7
           AND v_count = 1 THEN
            INSERT INTO test_results VALUES (2, '2', 'Save store details then get', 'PASS', 'Saved details returned and matched by get_store_settings with default near_expiry_days=7');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'Save store details then get', 'FAIL', format('Mismatch: name=%s, contact=%s, days=%s, count=%s', v_get_res.out_store_name, v_get_res.out_contact_number, v_get_res.out_near_expiry_days, v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'Save store details then get', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: SAVE_NEAR_EXPIRY_DAYS INITIALIZES ROW WITH NULL DETAILS IF NONE EXISTS
    -- --------------------------------------------------------------------------
    BEGIN
        -- Switch to User 2 who currently has no row
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        SELECT * INTO v_res
        FROM public.save_near_expiry_days(14);

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user2_id;

        IF v_res.out_store_name IS NULL
           AND v_res.out_contact_number IS NULL
           AND v_res.out_near_expiry_days = 14
           AND v_get_res.out_store_name IS NULL
           AND v_get_res.out_contact_number IS NULL
           AND v_get_res.out_near_expiry_days = 14
           AND v_count = 1 THEN
            INSERT INTO test_results VALUES (3, '3', 'Save near_expiry_days initializes row', 'PASS', 'Row created for new user with near_expiry_days=14 and store_name/contact_number=NULL');
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Save near_expiry_days initializes row', 'FAIL', format('Mismatch: name=%s, contact=%s, days=%s, count=%s', v_get_res.out_store_name, v_get_res.out_contact_number, v_get_res.out_near_expiry_days, v_count));
        END IF;

        -- Switch back to User 1
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXCEPTION WHEN OTHERS THEN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (3, '3', 'Save near_expiry_days initializes row', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: SECOND SAVE UPDATES THE SAME ROW (ROW COUNT REMAINS 1)
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT * INTO v_res
        FROM public.save_store_details('Updated Corner Store', '09189991122');

        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user1_id;

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        IF v_count = 1
           AND v_get_res.out_store_name = 'Updated Corner Store'
           AND v_get_res.out_contact_number = '09189991122' THEN
            INSERT INTO test_results VALUES (4, '4', 'Second save updates same row', 'PASS', 'Row count remained 1 and store details updated successfully');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'Second save updates same row', 'FAIL', format('Expected 1 row with updated name; got count=%s, name=%s', v_count, v_get_res.out_store_name));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'Second save updates same row', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: SAVE_STORE_DETAILS DOES NOT CHANGE NEAR_EXPIRY_DAYS
    -- --------------------------------------------------------------------------
    BEGIN
        -- First set near_expiry_days to 25
        PERFORM public.save_near_expiry_days(25);

        -- Then update store details
        SELECT * INTO v_res
        FROM public.save_store_details('Martina Grocery', '09223334444');

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        IF v_res.out_store_name = 'Martina Grocery'
           AND v_res.out_near_expiry_days = 25
           AND v_get_res.out_near_expiry_days = 25 THEN
            INSERT INTO test_results VALUES (5, '5', 'save_store_details preserves near_expiry_days', 'PASS', 'near_expiry_days remained 25 after updating store details');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'save_store_details preserves near_expiry_days', 'FAIL', format('near_expiry_days altered: expected 25, got res=%s, get=%s', v_res.out_near_expiry_days, v_get_res.out_near_expiry_days));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (5, '5', 'save_store_details preserves near_expiry_days', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: SAVE_NEAR_EXPIRY_DAYS DOES NOT CHANGE STORE_NAME OR CONTACT_NUMBER
    -- --------------------------------------------------------------------------
    BEGIN
        -- Store details are currently 'Martina Grocery' and '09223334444'
        SELECT * INTO v_res
        FROM public.save_near_expiry_days(10);

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        IF v_res.out_near_expiry_days = 10
           AND v_res.out_store_name = 'Martina Grocery'
           AND v_res.out_contact_number = '09223334444'
           AND v_get_res.out_store_name = 'Martina Grocery'
           AND v_get_res.out_contact_number = '09223334444' THEN
            INSERT INTO test_results VALUES (6, '6', 'save_near_expiry_days preserves details', 'PASS', 'store_name and contact_number remained unchanged after updating near_expiry_days');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'save_near_expiry_days preserves details', 'FAIL', format('Store details altered: expected Martina Grocery/09223334444, got %s/%s', v_get_res.out_store_name, v_get_res.out_contact_number));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'save_near_expiry_days preserves details', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: UPDATED_AT IS REFRESHED ON A SECOND SAVE
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT out_updated_at INTO v_t1
        FROM public.get_store_settings();

        -- Brief sleep so clock_timestamp() advances
        PERFORM pg_sleep(0.02);

        SELECT * INTO v_res
        FROM public.save_store_details('Martina Supermarket', '09223334444');

        v_t2 := v_res.out_updated_at;

        IF v_t2 > v_t1 THEN
            INSERT INTO test_results VALUES (7, '7', 'updated_at refreshed on second save', 'PASS', format('updated_at advanced: t1=%s, t2=%s', v_t1, v_t2));
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'updated_at refreshed on second save', 'FAIL', format('updated_at did not advance: t1=%s, t2=%s', v_t1, v_t2));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'updated_at refreshed on second save', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: EMPTY NAME AND CONTACT (INCLUDING WHITESPACE) BECOME NULL
    -- --------------------------------------------------------------------------
    BEGIN
        SELECT * INTO v_res
        FROM public.save_store_details('    ', '');

        SELECT * INTO v_get_res
        FROM public.get_store_settings();

        IF v_res.out_store_name IS NULL
           AND v_res.out_contact_number IS NULL
           AND v_get_res.out_store_name IS NULL
           AND v_get_res.out_contact_number IS NULL THEN
            INSERT INTO test_results VALUES (8, '8', 'Empty strings become NULL', 'PASS', 'Whitespace-only name and empty contact converted to NULL');
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'Empty strings become NULL', 'FAIL', format('Expected NULLs, got name=%s, contact=%s', v_get_res.out_store_name, v_get_res.out_contact_number));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'Empty strings become NULL', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: SAVE_NEAR_EXPIRY_DAYS WITH NULL IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err_caught := FALSE;
        BEGIN
            PERFORM public.save_near_expiry_days(NULL);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (9, '9', 'NULL near_expiry_days refused', 'PASS', 'save_near_expiry_days(NULL) rejected with exception');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'NULL near_expiry_days refused', 'FAIL', 'save_near_expiry_days(NULL) did not raise an exception');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (9, '9', 'NULL near_expiry_days refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: NEAR_EXPIRY_DAYS 0 AND 61 ARE REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err1_caught := FALSE;
        v_err2_caught := FALSE;

        -- Sub-test A: 0 days
        BEGIN
            PERFORM public.save_near_expiry_days(0);
        EXCEPTION WHEN OTHERS THEN
            v_err1_caught := TRUE;
        END;

        -- Sub-test B: 61 days
        BEGIN
            PERFORM public.save_near_expiry_days(61);
        EXCEPTION WHEN OTHERS THEN
            v_err2_caught := TRUE;
        END;

        IF v_err1_caught AND v_err2_caught THEN
            INSERT INTO test_results VALUES (10, '10', 'near_expiry_days out of bounds refused', 'PASS', 'Both 0 and 61 rejected with validation errors');
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'near_expiry_days out of bounds refused', 'FAIL', format('Bounds check failed: err_0=%s, err_61=%s', v_err1_caught, v_err2_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (10, '10', 'near_expiry_days out of bounds refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 11: NAME OVER 100 CHARACTERS AND CONTACT OVER 30 CHARACTERS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err1_caught := FALSE;
        v_err2_caught := FALSE;

        -- Sub-test A: Name 101 characters
        BEGIN
            PERFORM public.save_store_details(repeat('A', 101), '09171234567');
        EXCEPTION WHEN OTHERS THEN
            v_err1_caught := TRUE;
        END;

        -- Sub-test B: Contact 31 characters
        BEGIN
            PERFORM public.save_store_details('Valid Name', repeat('9', 31));
        EXCEPTION WHEN OTHERS THEN
            v_err2_caught := TRUE;
        END;

        IF v_err1_caught AND v_err2_caught THEN
            INSERT INTO test_results VALUES (11, '11', 'Length limits enforced', 'PASS', 'Name > 100 chars and contact > 30 chars rejected with validation errors');
        ELSE
            INSERT INTO test_results VALUES (11, '11', 'Length limits enforced', 'FAIL', format('Length check failed: name_101_err=%s, contact_31_err=%s', v_err1_caught, v_err2_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (11, '11', 'Length limits enforced', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 12: MULTI-TENANT ISOLATION (USER 2 CANNOT READ OR CHANGE USER 1 ROW)
    -- --------------------------------------------------------------------------
    BEGIN
        -- Control: User 1 can view their own row under authenticated role
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user1_id;

        IF v_count <> 1 THEN
            INSERT INTO test_results VALUES (12, '12', 'Multi-tenant RLS isolation', 'FAIL', 'Control failed: User 1 cannot view their own store_settings');
        ELSE
            -- Switch to User 2
            SET LOCAL ROLE authenticated;
            PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
            PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

            -- User 2 attempts direct SELECT on User 1's row (should see 0 rows due to RLS)
            SELECT COUNT(*) INTO v_count
            FROM public.store_settings
            WHERE owner_id = v_user1_id;

            -- User 2 attempts direct UPDATE on User 1's row (should affect 0 rows due to RLS)
            UPDATE public.store_settings
            SET store_name = 'Hacked Name'
            WHERE owner_id = v_user1_id;
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

            -- User 2 calls get_store_settings (must return User 2's data, never User 1's)
            SELECT * INTO v_res FROM public.get_store_settings();

            IF v_count = 0 AND v_affected_rows = 0 AND v_res.out_owner_id = v_user2_id THEN
                INSERT INTO test_results VALUES (12, '12', 'Multi-tenant RLS isolation', 'PASS', 'User 2 cannot read or update User 1 row; get_store_settings isolated to current user');
            ELSE
                INSERT INTO test_results VALUES (12, '12', 'Multi-tenant RLS isolation', 'FAIL', format('RLS breach: visible_count=%s, updated_rows=%s, out_owner=%s', v_count, v_affected_rows, v_res.out_owner_id));
            END IF;
        END IF;

        -- Reset back to User 1
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    EXCEPTION WHEN OTHERS THEN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (12, '12', 'Multi-tenant RLS isolation', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 13: DIRECT UPDATE CHANGING OWNER_ID IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        v_err_caught := FALSE;
        BEGIN
            -- Attempt to reassign owner_id to User 2
            UPDATE public.store_settings
            SET owner_id = v_user2_id
            WHERE owner_id = v_user1_id;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        -- Verify row owner is still User 1
        SELECT COUNT(*) INTO v_count
        FROM public.store_settings
        WHERE owner_id = v_user1_id;

        IF v_err_caught AND v_count = 1 THEN
            INSERT INTO test_results VALUES (13, '13', 'Update changing owner_id refused', 'PASS', 'UPDATE with new owner_id was blocked by RLS WITH CHECK policy');
        ELSE
            INSERT INTO test_results VALUES (13, '13', 'Update changing owner_id refused', 'FAIL', format('owner_id change was not blocked: err_caught=%s, u1_count=%s', v_err_caught, v_count));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (13, '13', 'Update changing owner_id refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- TEST 14: ANON ROLE IS REFUSED
    -- --------------------------------------------------------------------------
    BEGIN
        v_err1_caught := FALSE;
        v_err2_caught := FALSE;
        v_err3_caught := FALSE;
        v_err4_caught := FALSE;

        SET LOCAL ROLE anon;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', 'anon', true);

        -- Sub-test A: get_store_settings execution blocked
        BEGIN
            PERFORM public.get_store_settings();
        EXCEPTION WHEN OTHERS THEN
            v_err1_caught := TRUE;
        END;

        -- Sub-test B: save_store_details execution blocked
        BEGIN
            PERFORM public.save_store_details('Anon Store', '12345');
        EXCEPTION WHEN OTHERS THEN
            v_err2_caught := TRUE;
        END;

        -- Sub-test C: save_near_expiry_days execution blocked
        BEGIN
            PERFORM public.save_near_expiry_days(7);
        EXCEPTION WHEN OTHERS THEN
            v_err3_caught := TRUE;
        END;

        -- Sub-test D: direct table select blocked
        BEGIN
            PERFORM 1 FROM public.store_settings;
        EXCEPTION WHEN OTHERS THEN
            v_err4_caught := TRUE;
        END;

        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

        IF v_err1_caught AND v_err2_caught AND v_err3_caught AND v_err4_caught THEN
            INSERT INTO test_results VALUES (14, '14', 'Anon role refused', 'PASS', 'Anon was blocked from executing all functions and querying store_settings table');
        ELSE
            INSERT INTO test_results VALUES (14, '14', 'Anon role refused', 'FAIL', format('Anon was not fully blocked: get=%s, details=%s, days=%s, table=%s', v_err1_caught, v_err2_caught, v_err3_caught, v_err4_caught));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        INSERT INTO test_results VALUES (14, '14', 'Anon role refused', 'FAIL', format('Exception: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- FIXTURE CLEANUP (Runs even if previous tests encountered failures)
    -- --------------------------------------------------------------------------
    BEGIN
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM set_config('request.jwt.claim.role', '', true);

        DELETE FROM public.store_settings
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
    WHERE test_order BETWEEN 1 AND 14;

    INSERT INTO test_results VALUES (
        99,
        'SUMMARY',
        'OVERALL SUITE RESULT',
        CASE WHEN v_failed = 0 THEN 'PASS' ELSE 'FAIL' END,
        format('%s of 14 passed (%s failed)', v_passed, v_failed)
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
