-- ==============================================================================
-- ShelfSafe Backend Test Suite: Realtime Publication
-- ==============================================================================
-- Verifies the supabase_realtime publication configuration and RLS state.
-- READ-ONLY: Never modifies, adds, or removes any table from any publication.
--
-- HOW TO RUN THIS TEST SUITE IN SUPABASE SQL EDITOR:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your ShelfSafe project.
-- 3. Click "SQL Editor" in the left-hand navigation sidebar.
-- 4. Click "+ New query".
-- 5. Copy and paste the ENTIRE contents of this file into the editor.
-- 6. Click "Run" (or press Ctrl + Enter / Cmd + Enter).
-- 7. View the "Results" tab to see test results and summary.
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
    v_in_pub BOOLEAN;
    v_rls_enabled BOOLEAN;
    v_missing_count INTEGER;
    v_extra_tables TEXT;
    v_all_tables TEXT[];
    v_expected_tables TEXT[] := ARRAY['batches', 'products', 'sales_scans', 'store_settings'];
    v_target_tables TEXT[] := ARRAY['products', 'batches', 'sales_scans', 'store_settings'];
    v_table TEXT;
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
    v_pub_exists BOOLEAN;
    v_pub_alltables BOOLEAN;
BEGIN
    -- Check if publication exists
    SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) INTO v_pub_exists;

    IF NOT v_pub_exists THEN
        INSERT INTO test_results VALUES (1, 'PUB-00', 'Publication Existence', 'FAIL', 'Publication supabase_realtime does not exist');
    ELSE
        SELECT puballtables INTO v_pub_alltables
        FROM pg_publication
        WHERE pubname = 'supabase_realtime';

        IF v_pub_alltables THEN
            INSERT INTO test_results VALUES (1, 'PUB-00', 'Publication Mode', 'FAIL', 'supabase_realtime publishes ALL TABLES instead of specific tables');
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- 1-4. Target Tables Present in Publication
    -- --------------------------------------------------------------------------
    -- Test 1: products in publication
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        1, 'PUB-01', 'products in supabase_realtime',
        CASE WHEN v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_in_pub THEN 'Table products is published' ELSE 'Table products is NOT in supabase_realtime' END
    );

    -- Test 2: batches in publication
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'batches'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        2, 'PUB-02', 'batches in supabase_realtime',
        CASE WHEN v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_in_pub THEN 'Table batches is published' ELSE 'Table batches is NOT in supabase_realtime' END
    );

    -- Test 3: sales_scans in publication
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sales_scans'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        3, 'PUB-03', 'sales_scans in supabase_realtime',
        CASE WHEN v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_in_pub THEN 'Table sales_scans is published' ELSE 'Table sales_scans is NOT in supabase_realtime' END
    );

    -- Test 4: store_settings in publication
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'store_settings'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        4, 'PUB-04', 'store_settings in supabase_realtime',
        CASE WHEN v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_in_pub THEN 'Table store_settings is published' ELSE 'Table store_settings is NOT in supabase_realtime' END
    );

    -- --------------------------------------------------------------------------
    -- 5-7. Excluded Tables NOT in Publication
    -- --------------------------------------------------------------------------
    -- Test 5: deductions not published
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deductions'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        5, 'PUB-05', 'deductions not published',
        CASE WHEN NOT v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN NOT v_in_pub THEN 'Table deductions is properly excluded' ELSE 'Table deductions is unexpectedly published' END
    );

    -- Test 6: inventory_edits not published
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_edits'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        6, 'PUB-06', 'inventory_edits not published',
        CASE WHEN NOT v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN NOT v_in_pub THEN 'Table inventory_edits is properly excluded' ELSE 'Table inventory_edits is unexpectedly published' END
    );

    -- Test 7: categories not published
    SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories'
    ) INTO v_in_pub;
    INSERT INTO test_results VALUES (
        7, 'PUB-07', 'categories not published',
        CASE WHEN NOT v_in_pub THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN NOT v_in_pub THEN 'Table categories is properly excluded' ELSE 'Table categories is unexpectedly published' END
    );

    -- --------------------------------------------------------------------------
    -- 8. Row Level Security (RLS) Still Enabled on All Four Tables
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) = 4 INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('products', 'batches', 'sales_scans', 'store_settings')
      AND c.relrowsecurity = TRUE;

    INSERT INTO test_results VALUES (
        8, 'PUB-08', 'RLS enabled on published tables',
        CASE WHEN v_rls_enabled THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_rls_enabled THEN 'All 4 published tables have RLS enabled (relrowsecurity = true)' ELSE 'One or more published tables do NOT have RLS enabled' END
    );

    -- --------------------------------------------------------------------------
    -- 9. Idempotency Check: Migration Logic Finds Nothing Left to Add
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_missing_count
    FROM unnest(v_target_tables) AS t(tbl)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t.tbl
    );

    INSERT INTO test_results VALUES (
        9, 'PUB-09', 'Idempotency check (nothing left to add)',
        CASE WHEN v_missing_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_missing_count = 0 THEN 'Zero target tables missing; repeated migration would be a no-op'
             ELSE format('%s target table(s) missing from publication', v_missing_count) END
    );

    -- --------------------------------------------------------------------------
    -- 10. Publication Exact Match Check
    -- --------------------------------------------------------------------------
    SELECT string_agg(tablename, ', ' ORDER BY tablename)
    INTO v_extra_tables
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename NOT IN ('products', 'batches', 'sales_scans', 'store_settings');

    INSERT INTO test_results VALUES (
        10, 'PUB-10', 'Exact tables check in publication',
        CASE WHEN v_extra_tables IS NULL THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN v_extra_tables IS NULL
             THEN 'supabase_realtime contains exactly products, batches, sales_scans, store_settings'
             ELSE format('Unexpected table(s) in supabase_realtime: %s', v_extra_tables) END
    );

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

