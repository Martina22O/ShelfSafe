-- ==============================================================================
-- ShelfSafe Migration: Inventory Functions, FEFO Sale Deduction, Alerts & Metrics
-- ==============================================================================

-- 1. RECORD SALE (FEFO ATOMIC DEDUCTION)
-- Deducts from earliest-expiring non-expired batches first.
-- Skips expired batches (< today in Asia/Manila) and archived batches.
-- Serializes concurrent deductions with row-level locks (FOR UPDATE).
CREATE OR REPLACE FUNCTION public.record_sale(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
    v_prod_id UUID;
    v_total_stock INTEGER;
    v_sales_scan_id UUID;
    v_remaining_qty INTEGER;
    v_deduct_qty INTEGER;
    r_batch RECORD;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- 2. Input validation
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- 3. Verify product belongs to signed-in user and is active
    SELECT id INTO v_prod_id
    FROM public.products
    WHERE id = p_product_id
      AND owner_id = v_user_id
      AND is_archived = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found, archived, or access denied', p_product_id;
    END IF;

    -- 4. Lock eligible non-expired, non-archived batches in strict FEFO order
    -- Ordered by expiration_date, created_at, id
    PERFORM id
    FROM public.batches
    WHERE product_id = p_product_id
      AND is_archived = FALSE
      AND quantity_left > 0
      AND expiration_date >= v_today
    ORDER BY expiration_date ASC, created_at ASC, id ASC
    FOR UPDATE;

    -- 5. Calculate total available non-expired stock
    SELECT COALESCE(SUM(quantity_left), 0) INTO v_total_stock
    FROM public.batches
    WHERE product_id = p_product_id
      AND is_archived = FALSE
      AND quantity_left > 0
      AND expiration_date >= v_today;

    IF v_total_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock: requested %, but only % non-expired units available',
            p_quantity, v_total_stock;
    END IF;

    -- 6. Create the sales scan entry
    INSERT INTO public.sales_scans (owner_id, is_undone)
    VALUES (v_user_id, FALSE)
    RETURNING id INTO v_sales_scan_id;

    -- 7. Deduct from batches using FEFO
    v_remaining_qty := p_quantity;

    FOR r_batch IN (
        SELECT id, quantity_left
        FROM public.batches
        WHERE product_id = p_product_id
          AND is_archived = FALSE
          AND quantity_left > 0
          AND expiration_date >= v_today
        ORDER BY expiration_date ASC, created_at ASC, id ASC
        FOR UPDATE
    ) LOOP
        EXIT WHEN v_remaining_qty <= 0;

        v_deduct_qty := LEAST(r_batch.quantity_left, v_remaining_qty);

        UPDATE public.batches
        SET quantity_left = quantity_left - v_deduct_qty
        WHERE id = r_batch.id;

        INSERT INTO public.deductions (sales_scan_id, batch_id, quantity)
        VALUES (v_sales_scan_id, r_batch.id, v_deduct_qty);

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    IF v_remaining_qty > 0 THEN
        RAISE EXCEPTION 'Insufficient stock: deduction could not be satisfied';
    END IF;

    RETURN v_sales_scan_id;
END;
$$;


-- 2. PREVIEW SALE (DRY-RUN FEFO CALCULATION)
-- Returns batch breakdown of proposed deduction without mutating database.
CREATE OR REPLACE FUNCTION public.preview_sale(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS TABLE (
    batch_id UUID,
    expiration_date DATE,
    quantity_to_deduct INTEGER,
    batch_quantity_left INTEGER,
    batch_quantity_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
    v_total_stock INTEGER;
    v_remaining_qty INTEGER;
    v_deduct_qty INTEGER;
    r_batch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = p_product_id AND owner_id = v_user_id AND is_archived = FALSE
    ) THEN
        RAISE EXCEPTION 'Product % not found, archived, or access denied', p_product_id;
    END IF;

    SELECT COALESCE(SUM(b.quantity_left), 0) INTO v_total_stock
    FROM public.batches b
    WHERE b.product_id = p_product_id
      AND b.is_archived = FALSE
      AND b.quantity_left > 0
      AND b.expiration_date >= v_today;

    IF v_total_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock: requested %, but only % non-expired units available',
            p_quantity, v_total_stock;
    END IF;

    v_remaining_qty := p_quantity;

    FOR r_batch IN (
        SELECT b.id, b.quantity_left, b.expiration_date
        FROM public.batches b
        WHERE b.product_id = p_product_id
          AND b.is_archived = FALSE
          AND b.quantity_left > 0
          AND b.expiration_date >= v_today
        ORDER BY b.expiration_date ASC, b.created_at ASC, b.id ASC
    ) LOOP
        EXIT WHEN v_remaining_qty <= 0;

        v_deduct_qty := LEAST(r_batch.quantity_left, v_remaining_qty);

        batch_id := r_batch.id;
        expiration_date := r_batch.expiration_date;
        quantity_to_deduct := v_deduct_qty;
        batch_quantity_left := r_batch.quantity_left;
        batch_quantity_remaining := r_batch.quantity_left - v_deduct_qty;

        RETURN NEXT;

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;
END;
$$;


-- 3. UNDO SALE
-- Restores units into the EXACT batches recorded in the deductions table.
-- Can only be undone once.
CREATE OR REPLACE FUNCTION public.undo_sale(
    p_sales_scan_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_scan_is_undone BOOLEAN;
    r_deduction RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock sales scan row to prevent race conditions during undo
    SELECT is_undone INTO v_scan_is_undone
    FROM public.sales_scans
    WHERE id = p_sales_scan_id
      AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale scan % not found or access denied', p_sales_scan_id;
    END IF;

    IF v_scan_is_undone THEN
        RAISE EXCEPTION 'Sale scan % has already been undone', p_sales_scan_id;
    END IF;

    -- Restore units back into their respective batches
    FOR r_deduction IN (
        SELECT batch_id, quantity
        FROM public.deductions
        WHERE sales_scan_id = p_sales_scan_id
    ) LOOP
        UPDATE public.batches
        SET quantity_left = quantity_left + r_deduction.quantity
        WHERE id = r_deduction.batch_id;
    END LOOP;

    -- Mark sales scan as undone
    UPDATE public.sales_scans
    SET is_undone = TRUE
    WHERE id = p_sales_scan_id;

    RETURN TRUE;
END;
$$;


-- 4. ADD STOCK
-- Always creates a new batch (each delivery = its own batch).
CREATE OR REPLACE FUNCTION public.add_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_purchase_date DATE DEFAULT NULL,
    p_expiration_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_purchase_date DATE;
    v_batch_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    IF p_expiration_date IS NULL THEN
        RAISE EXCEPTION 'Expiration date is required';
    END IF;

    v_purchase_date := COALESCE(p_purchase_date, (now() AT TIME ZONE 'Asia/Manila')::date);

    IF p_expiration_date < v_purchase_date THEN
        RAISE EXCEPTION 'Expiration date (%) cannot be earlier than purchase date (%)',
            p_expiration_date, v_purchase_date;
    END IF;

    -- Verify product belongs to user and is not archived
    IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = p_product_id AND owner_id = v_user_id AND is_archived = FALSE
    ) THEN
        RAISE EXCEPTION 'Product % not found, archived, or access denied', p_product_id;
    END IF;

    INSERT INTO public.batches (
        product_id,
        quantity_left,
        purchase_date,
        expiration_date
    )
    VALUES (
        p_product_id,
        p_quantity,
        v_purchase_date,
        p_expiration_date
    )
    RETURNING id INTO v_batch_id;

    RETURN v_batch_id;
END;
$$;


-- 5. SALE HISTORY
-- Lists the user's sales scans with product info and batch breakdown for History and Undo.
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
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
    WHERE ss.owner_id = auth.uid()
    GROUP BY ss.id, ss.created_at, ss.is_undone, p.id, p.name, p.barcode, p.price
    ORDER BY ss.created_at DESC
    LIMIT LEAST(p_limit, 200);
$$;


-- 6. ALERTS VIEW
-- Low-stock, near-expiry (7 days by default), and expired alerts.
-- Respects RLS and Asia/Manila current date.
-- Low-stock counts only non-expired, non-archived stock.
CREATE OR REPLACE VIEW public.inventory_alerts
WITH (security_invoker = true)
AS
    -- 1. Low-stock alerts
    SELECT
        'low_stock'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        COALESCE(s.non_expired_stock, 0)::INTEGER AS current_stock,
        NULL::UUID AS batch_id,
        NULL::DATE AS expiration_date,
        NULL::INTEGER AS batch_quantity_left,
        NULL::INTEGER AS days_until_expiration
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
        SELECT
            b.product_id,
            SUM(b.quantity_left)::INTEGER AS non_expired_stock
        FROM public.batches b
        WHERE b.is_archived = FALSE
          AND b.quantity_left > 0
          AND b.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
        GROUP BY b.product_id
    ) s ON s.product_id = p.id
    WHERE p.is_archived = FALSE
      AND COALESCE(s.non_expired_stock, 0) <= p.low_stock_level

    UNION ALL

    -- 2. Near-expiry alerts (expiring within 7 days, but not yet expired)
    SELECT
        'near_expiry'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        NULL::INTEGER AS current_stock,
        b.id AS batch_id,
        b.expiration_date,
        b.quantity_left AS batch_quantity_left,
        (b.expiration_date - (now() AT TIME ZONE 'Asia/Manila')::date)::INTEGER AS days_until_expiration
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE b.is_archived = FALSE
      AND p.is_archived = FALSE
      AND b.quantity_left > 0
      AND b.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
      AND b.expiration_date <= ((now() AT TIME ZONE 'Asia/Manila')::date + 7)

    UNION ALL

    -- 3. Expired alerts (batches with stock left whose expiration_date < today)
    SELECT
        'expired'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        NULL::INTEGER AS current_stock,
        b.id AS batch_id,
        b.expiration_date,
        b.quantity_left AS batch_quantity_left,
        (b.expiration_date - (now() AT TIME ZONE 'Asia/Manila')::date)::INTEGER AS days_until_expiration
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE b.is_archived = FALSE
      AND p.is_archived = FALSE
      AND b.quantity_left > 0
      AND b.expiration_date < (now() AT TIME ZONE 'Asia/Manila')::date;


-- 7. PARAMETERIZED ALERTS FUNCTION
-- Allows querying alerts with a customizable near-expiry threshold (default 7 days).
CREATE OR REPLACE FUNCTION public.get_inventory_alerts(
    p_days_threshold INTEGER DEFAULT 7
)
RETURNS TABLE (
    alert_type TEXT,
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    barcode TEXT,
    low_stock_level INTEGER,
    current_stock INTEGER,
    batch_id UUID,
    expiration_date DATE,
    batch_quantity_left INTEGER,
    days_until_expiration INTEGER
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
    -- 1. Low-stock alerts
    SELECT
        'low_stock'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        COALESCE(s.non_expired_stock, 0)::INTEGER AS current_stock,
        NULL::UUID AS batch_id,
        NULL::DATE AS expiration_date,
        NULL::INTEGER AS batch_quantity_left,
        NULL::INTEGER AS days_until_expiration
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
        SELECT
            b.product_id,
            SUM(b.quantity_left)::INTEGER AS non_expired_stock
        FROM public.batches b
        WHERE b.is_archived = FALSE
          AND b.quantity_left > 0
          AND b.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
        GROUP BY b.product_id
    ) s ON s.product_id = p.id
    WHERE p.is_archived = FALSE
      AND p.owner_id = auth.uid()
      AND COALESCE(s.non_expired_stock, 0) <= p.low_stock_level

    UNION ALL

    -- 2. Near-expiry alerts
    SELECT
        'near_expiry'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        NULL::INTEGER AS current_stock,
        b.id AS batch_id,
        b.expiration_date,
        b.quantity_left AS batch_quantity_left,
        (b.expiration_date - (now() AT TIME ZONE 'Asia/Manila')::date)::INTEGER AS days_until_expiration
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE b.is_archived = FALSE
      AND p.is_archived = FALSE
      AND p.owner_id = auth.uid()
      AND b.quantity_left > 0
      AND b.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
      AND b.expiration_date <= ((now() AT TIME ZONE 'Asia/Manila')::date + GREATEST(p_days_threshold, 0))

    UNION ALL

    -- 3. Expired alerts
    SELECT
        'expired'::TEXT AS alert_type,
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        p.low_stock_level,
        NULL::INTEGER AS current_stock,
        b.id AS batch_id,
        b.expiration_date,
        b.quantity_left AS batch_quantity_left,
        (b.expiration_date - (now() AT TIME ZONE 'Asia/Manila')::date)::INTEGER AS days_until_expiration
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE b.is_archived = FALSE
      AND p.is_archived = FALSE
      AND p.owner_id = auth.uid()
      AND b.quantity_left > 0
      AND b.expiration_date < (now() AT TIME ZONE 'Asia/Manila')::date;
$$;


-- 8. HOME SUMMARY QUERIES
-- 8a. Most-stocked products (by non-expired active units)
CREATE OR REPLACE FUNCTION public.get_most_stocked_products(
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    barcode TEXT,
    total_stock BIGINT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        p.barcode,
        COALESCE(SUM(b.quantity_left), 0) AS total_stock
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.batches b ON b.product_id = p.id
        AND b.is_archived = FALSE
        AND b.quantity_left > 0
        AND b.expiration_date >= (now() AT TIME ZONE 'Asia/Manila')::date
    WHERE p.owner_id = auth.uid()
      AND p.is_archived = FALSE
    GROUP BY p.id, p.name, c.name, p.barcode
    ORDER BY total_stock DESC, p.name ASC
    LIMIT LEAST(p_limit, 50);
$$;


-- 8b. Most-sold products (sum of deductions from non-undone sales)
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
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
    WHERE p.owner_id = auth.uid()
      AND ss.owner_id = auth.uid()
      AND ss.is_undone = FALSE
      AND p.is_archived = FALSE
    GROUP BY p.id, p.name, c.name, p.barcode
    ORDER BY total_sold DESC, p.name ASC
    LIMIT LEAST(p_limit, 50);
$$;


-- 8c. Least-sold products (including 0 sold)
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
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
        WHERE ss.owner_id = auth.uid()
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
    WHERE p.owner_id = auth.uid()
      AND p.is_archived = FALSE
    ORDER BY total_sold ASC, total_stock DESC, p.name ASC
    LIMIT LEAST(p_limit, 50);
$$;


-- 8d. Sales metrics (sold today, this week, this month in Asia/Manila)
CREATE OR REPLACE FUNCTION public.get_sales_metrics()
RETURNS TABLE (
    sold_today BIGINT,
    sold_this_week BIGINT,
    sold_this_month BIGINT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
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
    WHERE ss.owner_id = auth.uid()
      AND ss.is_undone = FALSE;
$$;


-- 8e. Consolidated Home Summary RPC
CREATE OR REPLACE FUNCTION public.get_home_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
DECLARE
    v_metrics RECORD;
    v_most_stocked JSONB;
    v_most_sold JSONB;
    v_least_sold JSONB;
    v_low_stock_count INTEGER;
    v_near_expiry_count INTEGER;
    v_expired_count INTEGER;
BEGIN
    SELECT * INTO v_metrics FROM public.get_sales_metrics();

    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_most_stocked
    FROM (SELECT * FROM public.get_most_stocked_products(5)) t;

    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_most_sold
    FROM (SELECT * FROM public.get_most_sold_products(5)) t;

    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_least_sold
    FROM (SELECT * FROM public.get_least_sold_products(5)) t;

    SELECT
        COUNT(*) FILTER (WHERE alert_type = 'low_stock'),
        COUNT(*) FILTER (WHERE alert_type = 'near_expiry'),
        COUNT(*) FILTER (WHERE alert_type = 'expired')
    INTO v_low_stock_count, v_near_expiry_count, v_expired_count
    FROM public.get_inventory_alerts(7);

    RETURN jsonb_build_object(
        'metrics', jsonb_build_object(
            'sold_today', COALESCE(v_metrics.sold_today, 0),
            'sold_this_week', COALESCE(v_metrics.sold_this_week, 0),
            'sold_this_month', COALESCE(v_metrics.sold_this_month, 0)
        ),
        'most_stocked', v_most_stocked,
        'most_sold', v_most_sold,
        'least_sold', v_least_sold,
        'alert_counts', jsonb_build_object(
            'low_stock', COALESCE(v_low_stock_count, 0),
            'near_expiry', COALESCE(v_near_expiry_count, 0),
            'expired', COALESCE(v_expired_count, 0)
        )
    );
END;
$$;


-- ==============================================================================
-- 9. PERMISSIONS & GRANTS
-- Revoke from public & anon, grant execute to authenticated only.
-- ==============================================================================

REVOKE ALL ON FUNCTION public.record_sale(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_sale(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_sale(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.undo_sale(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_sale(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.add_stock(UUID, INTEGER, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_stock(UUID, INTEGER, DATE, DATE) TO authenticated;

REVOKE ALL ON FUNCTION public.get_sale_history(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_history(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_inventory_alerts(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_alerts(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_most_stocked_products(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_most_stocked_products(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_most_sold_products(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_most_sold_products(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_least_sold_products(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_least_sold_products(INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_sales_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_metrics() TO authenticated;

REVOKE ALL ON FUNCTION public.get_home_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_home_summary() TO authenticated;

REVOKE ALL ON TABLE public.inventory_alerts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.inventory_alerts TO authenticated;
