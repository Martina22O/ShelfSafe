-- ==============================================================================
-- ShelfSafe Schema Migration: Sales History Free vs. Premium Entitlement Guards
-- ==============================================================================
-- 1. Free plan restriction:
--    - Access to the most recent 7 days of sales history (created_at >= now() - interval '7 days')
-- 2. Premium / Active 14-day trial users:
--    - Access to complete sales history (unrestricted)
-- 3. Non-destructive safety:
--    - Zero historical sales records or deductions are deleted or modified.
--    - Historical records are permanently preserved and instantly unlocked upon upgrading.
-- 4. Server-enforced defenses:
--    - Updates get_sale_history RPC with server-side is_user_premium check.
--    - Updates RLS SELECT policy on public.sales_scans to block direct REST API bypass.
--    - Configures get_sales_metrics(), get_most_sold_products(), and get_least_sold_products()
--      as SECURITY DEFINER to preserve dashboard analytics accuracy for operational metrics.
--    - Preserves FEFO deduction and undo_sale operations.
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- 1. ENHANCED GET_SALE_HISTORY RPC WITH 7-DAY ENTITLEMENT RESTRICTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_sale_history(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    sales_scan_id UUID,
    created_at TIMESTAMPTZ,
    is_undone BOOLEAN,
    product_id UUID,
    product_name TEXT,
    product_barcode TEXT,
    product_price NUMERIC,
    total_quantity INTEGER,
    batch_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_premium BOOLEAN;
    v_effective_limit INTEGER := LEAST(COALESCE(p_limit, 50), 500);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Check server-side subscription entitlement
    v_is_premium := public.is_user_premium(v_user_id);

    RETURN QUERY
    SELECT
        ss.id AS sales_scan_id,
        ss.created_at,
        ss.is_undone,
        p.id AS product_id,
        p.name AS product_name,
        p.barcode AS product_barcode,
        p.price AS product_price,
        COALESCE(SUM(d.quantity), 0)::INTEGER AS total_quantity,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'batch_id', b.id,
                    'quantity', d.quantity,
                    'purchase_date', b.purchase_date,
                    'expiration_date', b.expiration_date
                ) ORDER BY b.expiration_date ASC, b.id ASC
            ) FILTER (WHERE d.id IS NOT NULL),
            '[]'::jsonb
        ) AS batch_breakdown
    FROM public.sales_scans ss
    LEFT JOIN public.deductions d ON d.sales_scan_id = ss.id
    LEFT JOIN public.batches b ON b.id = d.batch_id
    LEFT JOIN public.products p ON p.id = b.product_id
    WHERE ss.owner_id = v_user_id
      AND (
          v_is_premium = TRUE
          OR ss.created_at >= (clock_timestamp() - INTERVAL '7 days')
      )
    GROUP BY ss.id, ss.created_at, ss.is_undone, p.id, p.name, p.barcode, p.price
    ORDER BY ss.created_at DESC
    LIMIT v_effective_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sale_history(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_history(INTEGER) TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. DIRECT API RLS ENFORCEMENT ON public.sales_scans
-- ------------------------------------------------------------------------------
-- Replaces existing SELECT policy with entitlement-aware filter.
-- Free users querying public.sales_scans directly through PostgREST can only
-- retrieve records created within the last 7 days.
DROP POLICY IF EXISTS "Users can view their own sales scans" ON public.sales_scans;

CREATE POLICY "Users can view their own sales scans"
    ON public.sales_scans FOR SELECT
    TO authenticated
    USING (
        auth.uid() = owner_id
        AND (
            public.is_user_premium(auth.uid())
            OR created_at >= (clock_timestamp() - INTERVAL '7 days')
        )
    );


-- ------------------------------------------------------------------------------
-- 3. PRESERVE OPERATIONAL SALES METRICS & DASHBOARD ACCURACY
-- ------------------------------------------------------------------------------
-- Operational metrics (sold today, this week, this month, top sellers) must accurately
-- reflect store operational quantities without being truncated by history display RLS.
-- Configured as SECURITY DEFINER with fixed search_path to run safely and consistently.

CREATE OR REPLACE FUNCTION public.get_sales_metrics()
RETURNS TABLE (
    sold_today BIGINT,
    sold_this_week BIGINT,
    sold_this_month BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE
            WHEN (ss.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
            THEN d.quantity ELSE 0 END), 0)::BIGINT AS sold_today,

        COALESCE(SUM(CASE
            WHEN (ss.created_at AT TIME ZONE 'Asia/Manila') >= date_trunc('week', now() AT TIME ZONE 'Asia/Manila')
            THEN d.quantity ELSE 0 END), 0)::BIGINT AS sold_this_week,

        COALESCE(SUM(CASE
            WHEN (ss.created_at AT TIME ZONE 'Asia/Manila') >= date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
            THEN d.quantity ELSE 0 END), 0)::BIGINT AS sold_this_month
    FROM public.sales_scans ss
    JOIN public.deductions d ON d.sales_scan_id = ss.id
    WHERE ss.owner_id = v_user_id
      AND ss.is_undone = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_metrics() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_most_sold_products(
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    barcode TEXT,
    total_sold BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_limit INTEGER := LEAST(COALESCE(p_limit, 5), 50);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        COALESCE(SUM(d.quantity), 0) AS total_sold
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    JOIN public.batches b ON b.product_id = p.id
    JOIN public.deductions d ON d.batch_id = b.id
    JOIN public.sales_scans ss ON ss.id = d.sales_scan_id
    WHERE p.owner_id = v_user_id
      AND ss.owner_id = v_user_id
      AND ss.is_undone = FALSE
      AND p.is_archived = FALSE
    GROUP BY p.id, p.name, c.name, p.barcode
    ORDER BY total_sold DESC, p.name ASC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_most_sold_products(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_most_sold_products(INTEGER) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_least_sold_products(
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    barcode TEXT,
    total_sold BIGINT,
    total_stock BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_limit INTEGER := LEAST(COALESCE(p_limit, 5), 50);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        COALESCE(sales.total_sold, 0) AS total_sold,
        COALESCE(stock.total_stock, 0) AS total_stock
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
        SELECT
            b2.product_id,
            SUM(d.quantity)::BIGINT AS total_sold
        FROM public.deductions d
        JOIN public.batches b2 ON b2.id = d.batch_id
        JOIN public.sales_scans ss ON ss.id = d.sales_scan_id
        WHERE ss.owner_id = v_user_id
          AND ss.is_undone = FALSE
        GROUP BY b2.product_id
    ) sales ON sales.product_id = p.id
    LEFT JOIN (
        SELECT
            b3.product_id,
            SUM(b3.quantity_left)::BIGINT AS total_stock
        FROM public.batches b3
        WHERE b3.is_archived = FALSE
          AND b3.quantity_left > 0
          AND b3.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
        GROUP BY b3.product_id
    ) stock ON stock.product_id = p.id
    WHERE p.owner_id = v_user_id
      AND p.is_archived = FALSE
    ORDER BY total_sold ASC, total_stock DESC, p.name ASC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_least_sold_products(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_least_sold_products(INTEGER) TO authenticated;
