-- ==============================================================================
-- ShelfSafe Schema Migration: Store Settings Table, Triggers, RLS & Functions
-- ==============================================================================

-- 1. STORE SETTINGS TABLE
-- Stores custom per-owner settings (store name, contact number, near-expiry threshold).
-- Account identity (name, email, password) remains in Supabase Auth (auth.users).
CREATE TABLE IF NOT EXISTS public.store_settings (
    owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    store_name TEXT CHECK (store_name IS NULL OR (char_length(trim(store_name)) > 0 AND char_length(store_name) <= 100)),
    contact_number TEXT CHECK (contact_number IS NULL OR (char_length(trim(contact_number)) > 0 AND char_length(contact_number) <= 30)),
    near_expiry_days INTEGER NOT NULL DEFAULT 7 CHECK (near_expiry_days BETWEEN 1 AND 60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance index for owner lookups
CREATE INDEX IF NOT EXISTS idx_store_settings_owner_id ON public.store_settings (owner_id);


-- ==============================================================================
-- 2. NORMALIZATION & UPDATED_AT TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.normalize_store_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.store_name := NULLIF(trim(NEW.store_name), '');
    NEW.contact_number := NULLIF(trim(NEW.contact_number), '');
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_store_settings ON public.store_settings;
CREATE TRIGGER trg_normalize_store_settings
    BEFORE INSERT OR UPDATE ON public.store_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_store_settings();


-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Authenticated users can view only their own store settings
CREATE POLICY "Users can view their own store settings"
    ON public.store_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

-- INSERT policy: Authenticated users can insert only their own row
CREATE POLICY "Users can insert their own store settings"
    ON public.store_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

-- UPDATE policy: Authenticated users can update only their own row and cannot change owner_id
CREATE POLICY "Users can update their own store settings"
    ON public.store_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Note: No DELETE policy is provided.


-- ==============================================================================
-- 4. TABLE PERMISSIONS & GRANTS
-- ==============================================================================

REVOKE ALL ON TABLE public.store_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.store_settings TO authenticated;


-- ==============================================================================
-- 5. FUNCTIONS: GET & SAVE STORE SETTINGS
-- ==============================================================================

-- 5a. GET STORE SETTINGS
-- Returns signed-in user's settings. If user has no row yet, returns default settings
-- (store_name NULL, contact_number NULL, near_expiry_days 7) without inserting anything.
CREATE OR REPLACE FUNCTION public.get_store_settings()
RETURNS TABLE (
    out_owner_id UUID,
    out_store_name TEXT,
    out_contact_number TEXT,
    out_near_expiry_days INTEGER,
    out_created_at TIMESTAMPTZ,
    out_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    SELECT
        s.owner_id,
        s.store_name,
        s.contact_number,
        s.near_expiry_days,
        s.created_at,
        s.updated_at
    INTO
        out_owner_id,
        out_store_name,
        out_contact_number,
        out_near_expiry_days,
        out_created_at,
        out_updated_at
    FROM public.store_settings s
    WHERE s.owner_id = v_user_id;

    IF FOUND THEN
        RETURN NEXT;
    ELSE
        out_owner_id := v_user_id;
        out_store_name := NULL;
        out_contact_number := NULL;
        out_near_expiry_days := 7;
        out_created_at := NULL;
        out_updated_at := NULL;
        RETURN NEXT;
    END IF;
END;
$$;


-- 5b. SAVE STORE DETAILS
-- Upserts store_name and contact_number without altering near_expiry_days.
-- If user has no row yet, initializes near_expiry_days to 7.
CREATE OR REPLACE FUNCTION public.save_store_details(
    p_store_name TEXT,
    p_contact_number TEXT
)
RETURNS TABLE (
    out_owner_id UUID,
    out_store_name TEXT,
    out_contact_number TEXT,
    out_near_expiry_days INTEGER,
    out_created_at TIMESTAMPTZ,
    out_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_store_name TEXT;
    v_contact_number TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    v_store_name := NULLIF(trim(p_store_name), '');
    v_contact_number := NULLIF(trim(p_contact_number), '');

    IF v_store_name IS NOT NULL AND char_length(v_store_name) > 100 THEN
        RAISE EXCEPTION 'Store name cannot exceed 100 characters';
    END IF;

    IF v_contact_number IS NOT NULL AND char_length(v_contact_number) > 30 THEN
        RAISE EXCEPTION 'Contact number cannot exceed 30 characters';
    END IF;

    INSERT INTO public.store_settings (
        owner_id,
        store_name,
        contact_number,
        near_expiry_days,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_store_name,
        v_contact_number,
        7,
        clock_timestamp(),
        clock_timestamp()
    )
    ON CONFLICT (owner_id) DO UPDATE
    SET
        store_name = EXCLUDED.store_name,
        contact_number = EXCLUDED.contact_number,
        updated_at = clock_timestamp()
    RETURNING
        store_settings.owner_id,
        store_settings.store_name,
        store_settings.contact_number,
        store_settings.near_expiry_days,
        store_settings.created_at,
        store_settings.updated_at
    INTO
        out_owner_id,
        out_store_name,
        out_contact_number,
        out_near_expiry_days,
        out_created_at,
        out_updated_at;

    RETURN NEXT;
END;
$$;


-- 5c. SAVE NEAR-EXPIRY DAYS
-- Upserts near_expiry_days threshold without altering store_name or contact_number.
-- If user has no row yet, initializes store_name and contact_number to NULL.
CREATE OR REPLACE FUNCTION public.save_near_expiry_days(
    p_near_expiry_days INTEGER
)
RETURNS TABLE (
    out_owner_id UUID,
    out_store_name TEXT,
    out_contact_number TEXT,
    out_near_expiry_days INTEGER,
    out_created_at TIMESTAMPTZ,
    out_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    IF p_near_expiry_days IS NULL THEN
        RAISE EXCEPTION 'Near-expiry threshold cannot be null';
    END IF;

    IF p_near_expiry_days < 1 OR p_near_expiry_days > 60 THEN
        RAISE EXCEPTION 'Near-expiry threshold must be a whole number between 1 and 60 days';
    END IF;

    INSERT INTO public.store_settings (
        owner_id,
        store_name,
        contact_number,
        near_expiry_days,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        NULL,
        NULL,
        p_near_expiry_days,
        clock_timestamp(),
        clock_timestamp()
    )
    ON CONFLICT (owner_id) DO UPDATE
    SET
        near_expiry_days = EXCLUDED.near_expiry_days,
        updated_at = clock_timestamp()
    RETURNING
        store_settings.owner_id,
        store_settings.store_name,
        store_settings.contact_number,
        store_settings.near_expiry_days,
        store_settings.created_at,
        store_settings.updated_at
    INTO
        out_owner_id,
        out_store_name,
        out_contact_number,
        out_near_expiry_days,
        out_created_at,
        out_updated_at;

    RETURN NEXT;
END;
$$;


-- ==============================================================================
-- 6. FUNCTION PERMISSIONS & GRANTS
-- ==============================================================================

REVOKE ALL ON FUNCTION public.normalize_store_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_store_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.get_store_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.save_store_details(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_store_details(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.save_near_expiry_days(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_near_expiry_days(INTEGER) TO authenticated;
