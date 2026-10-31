-- ==============================================================================
-- ShelfSafe Schema Migration: Product and Batch Corrections & Audit Log
-- ==============================================================================

-- 1. AUDIT TABLE: inventory_edits
-- Tracks corrections, updates, archiving, restoring, and deletions.
-- entity_id has no foreign key constraint so audit records survive table deletes.
CREATE TABLE IF NOT EXISTS public.inventory_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'batch')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('quantity_correction', 'dates_edit', 'product_edit', 'archive', 'restore', 'delete')),
    old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes for inventory_edits
CREATE INDEX IF NOT EXISTS idx_inventory_edits_owner_id ON public.inventory_edits (owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_edits_entity ON public.inventory_edits (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_edits_action ON public.inventory_edits (action);

-- Enable RLS on inventory_edits
ALTER TABLE public.inventory_edits ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can SELECT and INSERT only their own rows.
-- No UPDATE or DELETE policies are provided to ensure immutability.
CREATE POLICY "Users can view their own inventory edits"
    ON public.inventory_edits FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own inventory edits"
    ON public.inventory_edits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

REVOKE ALL ON TABLE public.inventory_edits FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.inventory_edits TO authenticated;


-- ==============================================================================
-- 2. CORRECTION & MANAGEMENT FUNCTIONS
-- ==============================================================================

-- 2a. CORRECT BATCH QUANTITY
-- Adjusts stock quantity on an active batch and logs the change.
CREATE OR REPLACE FUNCTION public.correct_batch_quantity(
    p_batch_id UUID,
    p_new_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_batch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
        RAISE EXCEPTION 'New quantity must be greater than or equal to zero';
    END IF;

    -- Lock batch row and verify ownership via parent product
    SELECT b.id, b.product_id, b.quantity_left, b.purchase_date, b.expiration_date, b.is_archived
    INTO v_batch
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = p_batch_id
      AND p.owner_id = v_user_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % not found or access denied', p_batch_id;
    END IF;

    IF v_batch.is_archived THEN
        RAISE EXCEPTION 'Batch % is archived and cannot be edited', p_batch_id;
    END IF;

    -- Update batch quantity
    UPDATE public.batches
    SET quantity_left = p_new_quantity
    WHERE id = p_batch_id;

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
        'batch',
        p_batch_id,
        'quantity_correction',
        jsonb_build_object('quantity_left', v_batch.quantity_left),
        jsonb_build_object('quantity_left', p_new_quantity)
    );

    RETURN jsonb_build_object(
        'id', p_batch_id,
        'product_id', v_batch.product_id,
        'quantity_left', p_new_quantity,
        'purchase_date', v_batch.purchase_date,
        'expiration_date', v_batch.expiration_date,
        'is_archived', v_batch.is_archived
    );
END;
$$;


-- 2b. UPDATE BATCH DATES
-- Updates purchase and expiration dates with validation.
CREATE OR REPLACE FUNCTION public.update_batch_dates(
    p_batch_id UUID,
    p_purchase_date DATE,
    p_expiration_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_batch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    IF p_purchase_date IS NULL THEN
        RAISE EXCEPTION 'Purchase date is required';
    END IF;

    IF p_expiration_date IS NULL THEN
        RAISE EXCEPTION 'Expiration date is required';
    END IF;

    IF p_expiration_date < p_purchase_date THEN
        RAISE EXCEPTION 'Expiration date cannot be earlier than purchase date';
    END IF;

    -- Lock batch row and verify ownership
    SELECT b.id, b.product_id, b.quantity_left, b.purchase_date, b.expiration_date, b.is_archived
    INTO v_batch
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = p_batch_id
      AND p.owner_id = v_user_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % not found or access denied', p_batch_id;
    END IF;

    IF v_batch.is_archived THEN
        RAISE EXCEPTION 'Batch % is archived and cannot be edited', p_batch_id;
    END IF;

    -- Update batch dates
    UPDATE public.batches
    SET purchase_date = p_purchase_date,
        expiration_date = p_expiration_date
    WHERE id = p_batch_id;

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
        'batch',
        p_batch_id,
        'dates_edit',
        jsonb_build_object('purchase_date', v_batch.purchase_date, 'expiration_date', v_batch.expiration_date),
        jsonb_build_object('purchase_date', p_purchase_date, 'expiration_date', p_expiration_date)
    );

    RETURN jsonb_build_object(
        'id', p_batch_id,
        'product_id', v_batch.product_id,
        'quantity_left', v_batch.quantity_left,
        'purchase_date', p_purchase_date,
        'expiration_date', p_expiration_date,
        'is_archived', v_batch.is_archived
    );
END;
$$;


-- 2c. UPDATE PRODUCT
-- Updates product fields matching validation of create_product_with_batch.
CREATE OR REPLACE FUNCTION public.update_product(
    p_product_id UUID,
    p_name TEXT,
    p_barcode TEXT,
    p_category_id UUID,
    p_price NUMERIC,
    p_low_stock_level INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_product RECORD;
    v_trimmed_name TEXT;
    v_trimmed_barcode TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock product row and verify ownership
    SELECT id, owner_id, category_id, name, barcode, price, low_stock_level, is_archived
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

    -- Validate product name
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Product name cannot be empty';
    END IF;
    v_trimmed_name := trim(p_name);

    -- Validate category
    IF p_category_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.categories WHERE id = p_category_id
    ) THEN
        RAISE EXCEPTION 'Category does not exist';
    END IF;

    -- Validate price
    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'Price must be greater than or equal to zero';
    END IF;

    -- Validate low stock level
    IF p_low_stock_level IS NULL OR p_low_stock_level < 0 THEN
        RAISE EXCEPTION 'Low stock level must be greater than or equal to zero';
    END IF;

    -- Barcode trimming: whitespace becomes NULL
    v_trimmed_barcode := NULLIF(trim(p_barcode), '');

    -- Check duplicate barcode for the same owner
    IF v_trimmed_barcode IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.products
            WHERE owner_id = v_user_id
              AND barcode = v_trimmed_barcode
              AND id <> p_product_id
        ) THEN
            RAISE EXCEPTION 'This barcode already exists';
        END IF;
    END IF;

    -- Perform update and catch concurrent unique constraint violation
    BEGIN
        UPDATE public.products
        SET name = v_trimmed_name,
            barcode = v_trimmed_barcode,
            category_id = p_category_id,
            price = p_price,
            low_stock_level = p_low_stock_level
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
        'product_edit',
        jsonb_build_object(
            'name', v_product.name,
            'barcode', v_product.barcode,
            'category_id', v_product.category_id,
            'price', v_product.price,
            'low_stock_level', v_product.low_stock_level
        ),
        jsonb_build_object(
            'name', v_trimmed_name,
            'barcode', v_trimmed_barcode,
            'category_id', p_category_id,
            'price', p_price,
            'low_stock_level', p_low_stock_level
        )
    );

    RETURN jsonb_build_object(
        'id', p_product_id,
        'name', v_trimmed_name,
        'barcode', v_trimmed_barcode,
        'category_id', p_category_id,
        'price', p_price,
        'low_stock_level', p_low_stock_level,
        'is_archived', v_product.is_archived
    );
END;
$$;


-- 2d. REMOVE BATCH
-- Deletes batch if unused (no deductions and no quantity_correction edits).
-- Otherwise archives the batch (is_archived = true).
CREATE OR REPLACE FUNCTION public.remove_batch(
    p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_batch RECORD;
    v_is_used BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock batch row and verify ownership
    SELECT b.id, b.product_id, b.quantity_left, b.purchase_date, b.expiration_date, b.is_archived
    INTO v_batch
    FROM public.batches b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = p_batch_id
      AND p.owner_id = v_user_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % not found or access denied', p_batch_id;
    END IF;

    -- Determine if the batch was ever used
    v_is_used := EXISTS (
        SELECT 1 FROM public.deductions WHERE batch_id = p_batch_id
    ) OR EXISTS (
        SELECT 1 FROM public.inventory_edits
        WHERE entity_type = 'batch'
          AND entity_id = p_batch_id
          AND action = 'quantity_correction'
    );

    IF NOT v_is_used THEN
        -- Delete unused batch
        INSERT INTO public.inventory_edits (
            owner_id,
            entity_type,
            entity_id,
            action,
            old_values,
            new_values
        ) VALUES (
            v_user_id,
            'batch',
            p_batch_id,
            'delete',
            jsonb_build_object(
                'product_id', v_batch.product_id,
                'quantity_left', v_batch.quantity_left,
                'purchase_date', v_batch.purchase_date,
                'expiration_date', v_batch.expiration_date,
                'is_archived', v_batch.is_archived
            ),
            '{}'::jsonb
        );

        DELETE FROM public.batches WHERE id = p_batch_id;

        RETURN jsonb_build_object(
            'id', p_batch_id,
            'product_id', v_batch.product_id,
            'status', 'deleted',
            'action', 'deleted'
        );
    ELSE
        -- Archive used batch
        UPDATE public.batches
        SET is_archived = TRUE
        WHERE id = p_batch_id;

        INSERT INTO public.inventory_edits (
            owner_id,
            entity_type,
            entity_id,
            action,
            old_values,
            new_values
        ) VALUES (
            v_user_id,
            'batch',
            p_batch_id,
            'archive',
            jsonb_build_object('is_archived', v_batch.is_archived),
            jsonb_build_object('is_archived', true)
        );

        RETURN jsonb_build_object(
            'id', p_batch_id,
            'product_id', v_batch.product_id,
            'quantity_left', v_batch.quantity_left,
            'purchase_date', v_batch.purchase_date,
            'expiration_date', v_batch.expiration_date,
            'status', 'archived',
            'action', 'archived',
            'is_archived', true
        );
    END IF;
END;
$$;


-- 2e. REMOVE PRODUCT
-- If no batch of the product was ever used, deletes its batches and the product in one transaction.
-- Otherwise archives the product (its batches stay as they are).
CREATE OR REPLACE FUNCTION public.remove_product(
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
    v_is_used BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock product row
    SELECT id, owner_id, category_id, name, barcode, price, low_stock_level, is_archived
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or access denied', p_product_id;
    END IF;

    -- Lock all batches belonging to this product
    PERFORM id FROM public.batches WHERE product_id = p_product_id FOR UPDATE;

    -- Determine if any batch of this product was ever used
    v_is_used := EXISTS (
        SELECT 1 FROM public.deductions d
        JOIN public.batches b ON b.id = d.batch_id
        WHERE b.product_id = p_product_id
    ) OR EXISTS (
        SELECT 1 FROM public.inventory_edits ie
        JOIN public.batches b ON b.id = ie.entity_id
        WHERE b.product_id = p_product_id
          AND ie.entity_type = 'batch'
          AND ie.action = 'quantity_correction'
    );

    IF NOT v_is_used THEN
        -- Delete unused product and its batches atomically
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
            'delete',
            jsonb_build_object(
                'name', v_product.name,
                'barcode', v_product.barcode,
                'category_id', v_product.category_id,
                'price', v_product.price,
                'low_stock_level', v_product.low_stock_level,
                'is_archived', v_product.is_archived
            ),
            '{}'::jsonb
        );

        DELETE FROM public.batches WHERE product_id = p_product_id;
        DELETE FROM public.products WHERE id = p_product_id;

        RETURN jsonb_build_object(
            'id', p_product_id,
            'status', 'deleted',
            'action', 'deleted'
        );
    ELSE
        -- Archive used product (batches remain as they are)
        UPDATE public.products
        SET is_archived = TRUE
        WHERE id = p_product_id;

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
            'archive',
            jsonb_build_object('is_archived', v_product.is_archived),
            jsonb_build_object('is_archived', true)
        );

        RETURN jsonb_build_object(
            'id', p_product_id,
            'status', 'archived',
            'action', 'archived',
            'is_archived', true
        );
    END IF;
END;
$$;


-- 2f. RESTORE PRODUCT
-- Unarchives a product so a scanned archived barcode is not a dead end.
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Lock product row
    SELECT id, owner_id, category_id, name, barcode, price, low_stock_level, is_archived
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
        'status', 'restored',
        'action', 'restore',
        'is_archived', false
    );
END;
$$;


-- ==============================================================================
-- 3. REPLACED FUNCTION: undo_sale (Option A with Restore & Missing Batch Guard)
-- ==============================================================================
-- Keeps exact signature, return type, security settings and grants.
-- Restores units to batches.
-- If a batch is archived, sets is_archived = false and logs 'restore' in inventory_edits.
-- If the parent product is archived, restores it too and logs it.
-- If a batch row is missing, raises a clear error.
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
    v_batch_info RECORD;
    v_curr_prod_archived BOOLEAN;
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

    -- Iterate deductions and restore batches and products
    FOR r_deduction IN (
        SELECT batch_id, quantity
        FROM public.deductions
        WHERE sales_scan_id = p_sales_scan_id
    ) LOOP
        -- Lock and verify batch and parent product existence
        SELECT b.id, b.product_id, b.quantity_left, b.is_archived AS batch_archived,
               p.id AS prod_id, p.is_archived AS prod_archived
        INTO v_batch_info
        FROM public.batches b
        JOIN public.products p ON p.id = b.product_id
        WHERE b.id = r_deduction.batch_id
        FOR UPDATE OF b, p;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot undo sale: Batch % not found', r_deduction.batch_id;
        END IF;

        -- If parent product is archived, restore the product too and log it
        SELECT is_archived INTO v_curr_prod_archived
        FROM public.products
        WHERE id = v_batch_info.prod_id;

        IF v_curr_prod_archived THEN
            UPDATE public.products
            SET is_archived = FALSE
            WHERE id = v_batch_info.prod_id;

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
                v_batch_info.prod_id,
                'restore',
                jsonb_build_object('is_archived', true),
                jsonb_build_object('is_archived', false)
            );
        END IF;

        -- If batch is archived, unarchive it, restore units, and log it
        IF v_batch_info.batch_archived THEN
            UPDATE public.batches
            SET is_archived = FALSE,
                quantity_left = quantity_left + r_deduction.quantity
            WHERE id = r_deduction.batch_id;

            INSERT INTO public.inventory_edits (
                owner_id,
                entity_type,
                entity_id,
                action,
                old_values,
                new_values
            ) VALUES (
                v_user_id,
                'batch',
                r_deduction.batch_id,
                'restore',
                jsonb_build_object('is_archived', true),
                jsonb_build_object('is_archived', false)
            );
        ELSE
            UPDATE public.batches
            SET quantity_left = quantity_left + r_deduction.quantity
            WHERE id = r_deduction.batch_id;
        END IF;
    END LOOP;

    -- Mark sales scan as undone
    UPDATE public.sales_scans
    SET is_undone = TRUE
    WHERE id = p_sales_scan_id;

    RETURN TRUE;
END;
$$;


-- ==============================================================================
-- 4. PERMISSIONS & GRANTS
-- ==============================================================================

REVOKE ALL ON FUNCTION public.correct_batch_quantity(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_batch_quantity(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.update_batch_dates(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_batch_dates(UUID, DATE, DATE) TO authenticated;

REVOKE ALL ON FUNCTION public.update_product(UUID, TEXT, TEXT, UUID, NUMERIC, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product(UUID, TEXT, TEXT, UUID, NUMERIC, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_batch(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_product(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_product(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_product(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_product(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.undo_sale(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_sale(UUID) TO authenticated;
