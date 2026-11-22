-- ==============================================================================
-- ShelfSafe Schema Migration: Extend Premium Free Trial from 14 to 30 Days
-- ==============================================================================
-- This forward-only migration updates public.start_free_trial() to grant a
-- 30-day trial period instead of 14 days for newly activated trials.
-- Existing subscriptions, expiration records, and eligibility rules remain intact.

CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_ends_at TIMESTAMPTZ := v_now + INTERVAL '30 days';
    v_sub RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Self-heal: ensure subscription row exists before locking
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (v_user_id, 'free', TRUE, FALSE)
    ON CONFLICT (owner_id) DO NOTHING;

    -- Lock subscription row to serialize concurrent trial requests
    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    -- Eligibility check: must never have started or claimed a trial before
    IF NOT v_sub.trial_eligible OR v_sub.trial_started_at IS NOT NULL THEN
        RAISE EXCEPTION 'Account is not eligible for a free trial: trial already used or claimed';
    END IF;

    IF v_sub.status = 'active' THEN
        RAISE EXCEPTION 'Account already has an active paid subscription';
    END IF;

    -- Activate the 30-day trial
    UPDATE public.user_subscriptions
    SET status = 'trialing',
        trial_eligible = FALSE,
        trial_started_at = v_now,
        trial_ends_at = v_ends_at,
        current_period_start = v_now,
        current_period_end = v_ends_at,
        onboarding_completed = TRUE,
        updated_at = v_now
    WHERE owner_id = v_user_id;

    -- Audit log
    INSERT INTO public.subscription_events (owner_id, event_type, details)
    VALUES (
        v_user_id,
        'trial_started',
        jsonb_build_object(
            'trial_started_at', v_now,
            'trial_ends_at', v_ends_at,
            'duration_days', 30
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'trialing',
        'is_premium', TRUE,
        'trial_started_at', v_now,
        'trial_ends_at', v_ends_at,
        'days_remaining', 30
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated;
