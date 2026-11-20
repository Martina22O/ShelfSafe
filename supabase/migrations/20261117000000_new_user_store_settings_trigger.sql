-- ==============================================================================
-- ShelfSafe Schema Migration: Auto-provision Store Settings on New User Signup
-- ==============================================================================
-- Ensures every new user registered via Supabase Auth (auth.users) has a default
-- row in public.store_settings without requiring manual database intervention.
-- Uses SECURITY DEFINER with fixed search_path = public.
-- Preserves RLS and only inserts on behalf of the newly created user (NEW.id).
-- Safe and idempotent with IF NOT EXISTS / ON CONFLICT.

CREATE OR REPLACE FUNCTION public.handle_new_user_store_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.store_settings (owner_id, store_name, contact_number, near_expiry_days)
    VALUES (NEW.id, NULL, NULL, 7)
    ON CONFLICT (owner_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_store_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_store_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_store_settings();
