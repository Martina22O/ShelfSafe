-- ==============================================================================
-- ShelfSafe Schema Migration: Add Tables to supabase_realtime Publication
-- ==============================================================================
-- Idempotent migration to publish: products, batches, sales_scans, store_settings.
-- Excludes: deductions, inventory_edits, categories, and auth tables.
-- Does not modify RLS policies, table grants, replica identity, or functions.

DO $$
DECLARE
    v_pub_exists BOOLEAN;
    v_pub_alltables BOOLEAN;
    v_table TEXT;
    v_target_tables TEXT[] := ARRAY['products', 'batches', 'sales_scans', 'store_settings'];
BEGIN
    -- 1. Check if supabase_realtime publication exists and whether it publishes all tables
    SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) INTO v_pub_exists;

    IF NOT v_pub_exists THEN
        -- Create publication with no tables
        CREATE PUBLICATION supabase_realtime;
    ELSE
        SELECT puballtables INTO v_pub_alltables
        FROM pg_publication
        WHERE pubname = 'supabase_realtime';

        IF v_pub_alltables THEN
            RAISE EXCEPTION 'supabase_realtime publishes ALL TABLES; adjust it manually before applying this migration';
        END IF;
    END IF;

    -- 2. Idempotently add only the required tables if not already listed
    FOREACH v_table IN ARRAY v_target_tables LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = v_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
        END IF;
    END LOOP;
END;
$$;

