-- ==============================================================================
-- ShelfSafe Schema Migration: Free vs. Premium Feature Entitlement Guards
-- ==============================================================================
-- 1. Free plan quotas:
--    - Maximum 20 active products (is_archived = FALSE)
--    - Maximum 5 products with uploaded photos (image_url IS NOT NULL)
-- 2. Premium / Active 14-day trial users are exempt from these quotas
-- 3. Enforces defense-in-depth:
--    - A. Database Trigger (trg_check_product_entitlement_limits) on public.products:
--         Prevents bypass via direct REST API inserts, updates, or alternative paths.
--         Uses FOR UPDATE serialization on user_subscriptions to block concurrency races.
--    - B. Explicit Fast-Path RPC Guards:
--         create_product_with_batch, set_product_image, and restore_product.
-- 4. Downgrade & Soft-Limit Safety:
--    - Zero data deletion upon trial expiration or plan downgrade.
--    - Existing products remain active, sellable, viewable, and editable.
--    - Users can always archive products or remove photos to get under quota.
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- 1. DATABASE TRIGGER ON public.products (UNIVERSAL ENFORCEMENT)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_product_entitlement_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := NEW.owner_id;
    v_active_count INTEGER;
    v_photo_count INTEGER;
    v_is_premium BOOLEAN;
BEGIN
    -- 1. If owner_id is missing, default to auth.uid()
    IF v_user_id IS NULL THEN
        v_user_id := auth.uid();
        NEW.owner_id := v_user_id;
    END IF;

    -- If still null (e.g. system migrations), allow operation
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Check real-time subscription entitlement using trusted server clock
    v_is_premium := public.is_user_premium(v_user_id);
    IF v_is_premium THEN
        RETURN NEW;
    END IF;

    -- 3. Concurrency Protection: Lock user's subscription row to serialize concurrent writes
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (v_user_id, 'free', TRUE, FALSE)
    ON CONFLICT (owner_id) DO NOTHING;

    PERFORM 1
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    -- 4. Enforce Active Product Quota (Max 20 for Free Plan)
    -- Triggers on new active product insertion or un-archiving an existing product.
    IF (TG_OP = 'INSERT' AND NEW.is_archived = FALSE)
       OR (TG_OP = 'UPDATE' AND OLD.is_archived = TRUE AND NEW.is_archived = FALSE) THEN

        SELECT COUNT(*) INTO v_active_count
        FROM public.products
        WHERE owner_id = v_user_id
          AND is_archived = FALSE
          AND (TG_OP = 'INSERT' OR id <> NEW.id);

        IF v_active_count >= 20 THEN
            RAISE EXCEPTION 'Free plan limit reached: up to 20 active products allowed. Upgrade to Premium for unlimited products.';
        END IF;
    END IF;

    -- 5. Enforce Product Photo Quota (Max 5 for Free Plan)
    -- Triggers when:
    -- - Inserting a new active product with a photo
    -- - Adding a photo to an existing active product that previously had no photo (OLD.image_url IS NULL)
    -- - Restoring an archived product that has a photo
    -- Note: Replacing an existing photo or removing a photo is NEVER blocked!
    IF (TG_OP = 'INSERT' AND NEW.is_archived = FALSE AND NEW.image_url IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.is_archived = FALSE AND NEW.image_url IS NOT NULL AND (OLD.image_url IS NULL OR OLD.is_archived = TRUE)) THEN

        SELECT COUNT(*) INTO v_photo_count
        FROM public.products
        WHERE owner_id = v_user_id
          AND is_archived = FALSE
          AND image_url IS NOT NULL
          AND (TG_OP = 'INSERT' OR id <> NEW.id);

        IF v_photo_count >= 5 THEN
            RAISE EXCEPTION 'Free plan limit reached: up to 5 product photos allowed. Upgrade to Premium for unlimited photos.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_product_entitlement_limits ON public.products;
CREATE TRIGGER trg_check_product_entitlement_limits
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.check_product_entitlement_limits();


-- ------------------------------------------------------------------------------
-- 2. UPDATE CREATE_PRODUCT_WITH_BATCH RPC (FAST-PATH ENFORCEMENT)
-- ------------------------------------------------------------------------------

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
    v_is_premium BOOLEAN;
    v_active_count INTEGER;
    v_photo_count INTEGER;
BEGIN
    -- 1. Authentication validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- 2. Entitlement Quota Check (Fast Path)
    v_is_premium := public.is_user_premium(v_user_id);
    IF NOT v_is_premium THEN
        -- Check active product count
        SELECT COUNT(*) INTO v_active_count
        FROM public.products
        WHERE owner_id = v_user_id
          AND is_archived = FALSE;

        IF v_active_count >= 20 THEN
            RAISE EXCEPTION 'Free plan limit reached: up to 20 active products allowed. Upgrade to Premium for unlimited products.';
        END IF;

        -- Check photo count if an image path was provided
        v_trimmed_image_url := NULLIF(trim(p_image_url), '');
        IF v_trimmed_image_url IS NOT NULL THEN
            SELECT COUNT(*) INTO v_photo_count
            FROM public.products
            WHERE owner_id = v_user_id
              AND is_archived = FALSE
              AND image_url IS NOT NULL;

            IF v_photo_count >= 5 THEN
                RAISE EXCEPTION 'Free plan limit reached: up to 5 product photos allowed. Upgrade to Premium for unlimited photos.';
            END IF;
        END IF;
    ELSE
        v_trimmed_image_url := NULLIF(trim(p_image_url), '');
    END IF;

    -- 3. Validate product name (cannot be empty or whitespace only)
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Product name cannot be empty';
    END IF;
    v_trimmed_name := trim(p_name);

    -- 4. Validate category exists
    IF p_category_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.categories WHERE id = p_category_id
    ) THEN
        RAISE EXCEPTION 'Category does not exist';
    END IF;

    -- 5. Validate price
    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'Price must be greater than or equal to zero';
    END IF;

    -- 6. Validate low stock level threshold
    IF p_low_stock_level IS NULL OR p_low_stock_level < 0 THEN
        RAISE EXCEPTION 'Low stock level must be greater than or equal to zero';
    END IF;

    -- 7. Validate initial batch quantity
    IF p_quantity IS NULL OR p_quantity < 1 THEN
        RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    -- 8. Dates calculation & validation
    v_purchase_date := COALESCE(p_purchase_date, (now() AT TIME ZONE 'Asia/Manila')::date);

    IF p_expiration_date IS NULL THEN
        RAISE EXCEPTION 'Expiration date is required';
    END IF;

    IF p_expiration_date < v_purchase_date THEN
        RAISE EXCEPTION 'Expiration date cannot be earlier than purchase date';
    END IF;

    -- 9. Barcode trimming: whitespace becomes NULL (products with no barcode are allowed)
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

    -- 10. Image path validation
    IF v_trimmed_image_url IS NOT NULL THEN
        IF NOT (v_trimmed_image_url LIKE v_user_id::text || '/%') THEN
            RAISE EXCEPTION 'Access denied: photo path does not belong to owner';
        END IF;
    END IF;

    -- 11. Insert product record (caught by trigger if concurrency race occurred)
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

    -- 12. Insert initial delivery batch
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

    RETURN QUERY SELECT v_product_id, v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_with_batch(TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_batch(TEXT, UUID, NUMERIC, INTEGER, DATE, TEXT, INTEGER, DATE, TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. UPDATE SET_PRODUCT_IMAGE RPC (PHOTO LIMIT ENFORCEMENT)
-- ------------------------------------------------------------------------------

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
    v_is_premium BOOLEAN;
    v_photo_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Verify product exists, belongs to user, and is not archived
    SELECT id, owner_id, is_archived, image_url
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

        -- Check photo quota ONLY when adding a photo to a product that currently has NO photo
        IF v_product.image_url IS NULL THEN
            v_is_premium := public.is_user_premium(v_user_id);
            IF NOT v_is_premium THEN
                SELECT COUNT(*) INTO v_photo_count
                FROM public.products
                WHERE owner_id = v_user_id
                  AND is_archived = FALSE
                  AND image_url IS NOT NULL;

                IF v_photo_count >= 5 THEN
                    RAISE EXCEPTION 'Free plan limit reached: up to 5 product photos allowed. Upgrade to Premium for unlimited photos.';
                END IF;
            END IF;
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


-- ------------------------------------------------------------------------------
-- 4. UPDATE RESTORE_PRODUCT RPC (RESTORE LIMIT ENFORCEMENT)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_product(
    p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_product RECORD;
    v_is_premium BOOLEAN;
    v_active_count INTEGER;
    v_photo_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock product row
    SELECT id, owner_id, category_id, name, barcode, price, low_stock_level, is_archived, image_url
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or access denied', p_product_id;
    END IF;

    IF NOT v_product.is_archived THEN
        RAISE EXCEPTION 'Product % is not archived', p_product_id;
    END IF;

    -- Entitlement validation on restore
    v_is_premium := public.is_user_premium(v_user_id);
    IF NOT v_is_premium THEN
        -- Check active products limit
        SELECT COUNT(*) INTO v_active_count
        FROM public.products
        WHERE owner_id = v_user_id
          AND is_archived = FALSE;

        IF v_active_count >= 20 THEN
            RAISE EXCEPTION 'Free plan limit reached: up to 20 active products allowed. Upgrade to Premium for unlimited products.';
        END IF;

        -- Check photo limit if the product being restored has a photo
        IF v_product.image_url IS NOT NULL THEN
            SELECT COUNT(*) INTO v_photo_count
            FROM public.products
            WHERE owner_id = v_user_id
              AND is_archived = FALSE
              AND image_url IS NOT NULL;

            IF v_photo_count >= 5 THEN
                RAISE EXCEPTION 'Free plan limit reached: up to 5 product photos allowed. Upgrade to Premium for unlimited photos.';
            END IF;
        END IF;
    END IF;

    -- Restore product status and guard against duplicate active barcodes
    BEGIN
        UPDATE public.products
        SET is_archived = FALSE
        WHERE id = p_product_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'This barcode already exists';
    END;

    -- Log audit entry
    INSERT INTO public.inventory_edits (
        owner_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        'product',
        p_product_id,
        'restore',
        jsonb_build_object('is_archived', true),
        jsonb_build_object('is_archived', false)
    );

    RETURN jsonb_build_object(
        'id', p_product_id,
        'name', v_product.name,
        'barcode', v_product.barcode,
        'restored', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_product(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_product(UUID) TO authenticated;
