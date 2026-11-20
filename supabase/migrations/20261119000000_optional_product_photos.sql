-- ==============================================================================
-- ShelfSafe Schema Migration: Optional Product Photos & Private Storage
-- ==============================================================================

-- 1. ADD IMAGE_URL COLUMN TO PRODUCTS TABLE
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 2. CREATE PRIVATE STORAGE BUCKET FOR PRODUCT PHOTOS
-- Bucket is private (public = false). Images require authenticated signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-photos',
    'product-photos',
    false,
    2097152, -- 2 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. STORAGE ROW-LEVEL SECURITY POLICIES
-- Folder isolation: users can only read, insert, update, and delete files in <owner_id>/*
DROP POLICY IF EXISTS "Store owners can read their own product photos" ON storage.objects;
CREATE POLICY "Store owners can read their own product photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'product-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Store owners can upload photos to their own directory" ON storage.objects;
CREATE POLICY "Store owners can upload photos to their own directory"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Store owners can update their own product photos" ON storage.objects;
CREATE POLICY "Store owners can update their own product photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Store owners can delete their own product photos" ON storage.objects;
CREATE POLICY "Store owners can delete their own product photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4. DEDICATED RPC FOR PHOTO UPDATES & REMOVALS
-- Enables safe, isolated image updates without modifying the existing update_product RPC
CREATE OR REPLACE FUNCTION public.set_product_image(
    p_product_id UUID,
    p_image_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_product RECORD;
    v_trimmed_image_url TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Verify product exists, belongs to user, and is not archived
    SELECT id, owner_id, is_archived
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or access denied', p_product_id;
    END IF;

    IF v_product.is_archived THEN
        RAISE EXCEPTION 'Product % is archived and cannot be edited', p_product_id;
    END IF;

    -- Validate path security: if image_url is provided, it must be inside the user's own storage directory
    v_trimmed_image_url := NULLIF(trim(p_image_url), '');
    IF v_trimmed_image_url IS NOT NULL THEN
        IF NOT (v_trimmed_image_url LIKE v_user_id::text || '/%') THEN
            RAISE EXCEPTION 'Access denied: photo path does not belong to owner';
        END IF;
    END IF;

    UPDATE public.products
    SET image_url = v_trimmed_image_url
    WHERE id = p_product_id;

    RETURN jsonb_build_object(
        'id', p_product_id,
        'image_url', v_trimmed_image_url,
        'updated', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_image(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_image(UUID, TEXT) TO authenticated;

-- 5. UPDATE CREATE_PRODUCT_WITH_BATCH TO ACCEPT OPTIONAL P_IMAGE_URL
DROP FUNCTION IF EXISTS public.create_product_with_batch(
    TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE
);

CREATE OR REPLACE FUNCTION public.create_product_with_batch(
    p_name TEXT,
    p_category_id UUID,
    p_price NUMERIC,
    p_quantity INTEGER,
    p_expiration_date DATE,
    p_barcode TEXT DEFAULT NULL,
    p_low_stock_level INTEGER DEFAULT 5,
    p_purchase_date DATE DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL
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
    v_trimmed_image_url TEXT;
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

    -- 9. Image path validation
    v_trimmed_image_url := NULLIF(trim(p_image_url), '');
    IF v_trimmed_image_url IS NOT NULL THEN
        IF NOT (v_trimmed_image_url LIKE v_user_id::text || '/%') THEN
            RAISE EXCEPTION 'Access denied: photo path does not belong to owner';
        END IF;
    END IF;

    -- 10. Insert product record (catch unique constraint on owner_id + barcode for concurrent saves)
    BEGIN
        INSERT INTO public.products (
            owner_id,
            category_id,
            name,
            barcode,
            price,
            low_stock_level,
            image_url
        ) VALUES (
            v_user_id,
            p_category_id,
            v_trimmed_name,
            v_trimmed_barcode,
            p_price,
            p_low_stock_level,
            v_trimmed_image_url
        )
        RETURNING id INTO v_product_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'This barcode already exists';
    END;

    -- 11. Insert initial delivery batch
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

    -- 12. Return newly created IDs
    RETURN QUERY
    SELECT v_product_id, v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_with_batch(
    TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_product_with_batch(
    TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE, TEXT
) TO authenticated;
