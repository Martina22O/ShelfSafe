-- ==============================================================================
-- ShelfSafe Migration: Create Product With Initial Batch Function
-- ==============================================================================

-- Atomic function to create a new product and its initial inventory batch.
-- Ensures a product is never left with zero stock on initial creation.
CREATE OR REPLACE FUNCTION public.create_product_with_batch(
    p_name TEXT,
    p_category_id UUID,
    p_price NUMERIC,
    p_quantity INTEGER,
    p_expiration_date DATE,
    p_barcode TEXT DEFAULT NULL,
    p_low_stock_level INTEGER DEFAULT 5,
    p_purchase_date DATE DEFAULT NULL
)
RETURNS TABLE (
    new_product_id UUID,
    new_batch_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_user_id UUID := auth.uid();
    v_trimmed_name TEXT;
    v_trimmed_barcode TEXT;
    v_purchase_date DATE;
    v_product_id UUID;
    v_batch_id UUID;
BEGIN
    -- 1. Authentication validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- 2. Validate product name (cannot be empty or whitespace only)
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Product name cannot be empty';
    END IF;
    v_trimmed_name := trim(p_name);

    -- 3. Validate category exists
    IF p_category_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.categories WHERE id = p_category_id
    ) THEN
        RAISE EXCEPTION 'Category does not exist';
    END IF;

    -- 4. Validate price
    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'Price must be greater than or equal to zero';
    END IF;

    -- 5. Validate low stock level threshold
    IF p_low_stock_level IS NULL OR p_low_stock_level < 0 THEN
        RAISE EXCEPTION 'Low stock level must be greater than or equal to zero';
    END IF;

    -- 6. Validate initial batch quantity
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    -- 7. Dates calculation & validation
    v_purchase_date := COALESCE(p_purchase_date, (now() AT TIME ZONE 'Asia/Manila')::date);

    IF p_expiration_date IS NULL THEN
        RAISE EXCEPTION 'Expiration date is required';
    END IF;

    IF p_expiration_date < v_purchase_date THEN
        RAISE EXCEPTION 'Expiration date cannot be earlier than purchase date';
    END IF;

    -- 8. Barcode trimming: whitespace becomes NULL (products with no barcode are allowed)
    v_trimmed_barcode := NULLIF(trim(p_barcode), '');

    -- Check if duplicate barcode already exists for this owner
    IF v_trimmed_barcode IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.products
            WHERE owner_id = v_user_id
              AND barcode = v_trimmed_barcode
        ) THEN
            RAISE EXCEPTION 'This barcode already exists';
        END IF;
    END IF;

    -- 9. Insert product record (catch unique constraint on owner_id + barcode for concurrent saves)
    BEGIN
        INSERT INTO public.products (
            owner_id,
            category_id,
            name,
            barcode,
            price,
            low_stock_level
        ) VALUES (
            v_user_id,
            p_category_id,
            v_trimmed_name,
            v_trimmed_barcode,
            p_price,
            p_low_stock_level
        )
        RETURNING id INTO v_product_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'This barcode already exists';
    END;

    -- 10. Insert initial delivery batch
    INSERT INTO public.batches (
        product_id,
        quantity_left,
        purchase_date,
        expiration_date
    ) VALUES (
        v_product_id,
        p_quantity,
        v_purchase_date,
        p_expiration_date
    )
    RETURNING id INTO v_batch_id;

    -- 11. Return newly created IDs
    RETURN QUERY
    SELECT v_product_id, v_batch_id;
END;
$$;


-- ==============================================================================
-- PERMISSIONS & GRANTS
-- Revoke from public & anon, grant execute to authenticated only.
-- ==============================================================================

REVOKE ALL ON FUNCTION public.create_product_with_batch(
    TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_product_with_batch(
    TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE
) TO authenticated;
