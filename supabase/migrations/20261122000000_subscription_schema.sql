-- ==============================================================================
-- ShelfSafe Schema Migration: Subscription System & 14-Day Free Trial Architecture
-- ==============================================================================
-- 1. Creates subscription_plans with 4 standard tiers (Monthly, Quarterly, Semiannual, Annual)
-- 2. Creates user_subscriptions tracking status, 14-day trial eligibility, period timestamps
-- 3. Creates subscription_events as an immutable audit log
-- 4. Establishes server-enforced RLS policies (read-only for clients, zero direct price/status tampering)
-- 5. Defines atomic SECURITY DEFINER functions for trial activation, onboarding, and entitlement
-- 6. Integrates new-user trigger & backfills existing accounts safely
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_php NUMERIC(10, 2) NOT NULL CHECK (price_php >= 0),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard ShelfSafe Premium plans
INSERT INTO public.subscription_plans (id, name, price_php, duration_days, billing_cycle)
VALUES
    ('premium_monthly', 'Monthly Premium', 99.00, 30, 'monthly'),
    ('premium_quarterly', 'Quarterly Premium', 189.00, 90, 'quarterly'),
    ('premium_semiannual', 'Semi-Annual Premium', 289.00, 180, 'semiannual'),
    ('premium_annual', 'Annual Premium', 499.00, 365, 'annual')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_php = EXCLUDED.price_php,
    duration_days = EXCLUDED.duration_days,
    billing_cycle = EXCLUDED.billing_cycle,
    is_active = EXCLUDED.is_active;

-- RLS: Read-only access for authenticated and anonymous users; no client modifications
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read active subscription plans" ON public.subscription_plans;
CREATE POLICY "Allow users to read active subscription plans"
    ON public.subscription_plans FOR SELECT
    TO authenticated, anon
    USING (is_active = TRUE);


-- ------------------------------------------------------------------------------
-- 2. USER SUBSCRIPTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'trialing', 'active', 'expired')),
    plan_id TEXT REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    trial_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    trial_started_at TIMESTAMPTZ DEFAULT NULL,
    trial_ends_at TIMESTAMPTZ DEFAULT NULL,
    current_period_start TIMESTAMPTZ DEFAULT NULL,
    current_period_end TIMESTAMPTZ DEFAULT NULL,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_trial_timestamps CHECK (
        (trial_started_at IS NULL AND trial_ends_at IS NULL) OR
        (trial_started_at IS NOT NULL AND trial_ends_at IS NOT NULL AND trial_ends_at >= trial_started_at)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_owner_id ON public.user_subscriptions (owner_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions (status);

-- Touch updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_user_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_user_subscriptions_updated_at();

-- RLS: Authenticated users can only VIEW their own subscription row.
-- No client-side INSERT, UPDATE, or DELETE policies exist.
-- All mutations occur strictly through trusted SECURITY DEFINER functions.
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscription"
    ON public.user_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);


-- ------------------------------------------------------------------------------
-- 3. SUBSCRIPTION EVENTS (IMMUTABLE AUDIT LOG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'trial_started',
        'onboarding_completed',
        'plan_purchased',
        'plan_renewed',
        'plan_cancelled',
        'trial_expired',
        'downgraded'
    )),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_owner_id ON public.subscription_events (owner_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events (created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription events" ON public.subscription_events;
CREATE POLICY "Users can view their own subscription events"
    ON public.subscription_events FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);


-- ------------------------------------------------------------------------------
-- 4. SECURE SUBSCRIPTION FUNCTIONS
-- ------------------------------------------------------------------------------

-- A. IS_USER_PREMIUM
-- Evaluates real-time entitlement against the trusted server clock (clock_timestamp()).
-- An expired trial or expired subscription immediately evaluates to FALSE.
CREATE OR REPLACE FUNCTION public.is_user_premium(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_now TIMESTAMPTZ := clock_timestamp();
    v_is_premium BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Authorization boundary: Regular authenticated users can only query their own status.
    -- Service role / administrative callers can query any user.
    IF auth.role() = 'authenticated' AND p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: cannot query subscription status of another user';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE owner_id = v_user_id
          AND (
              -- 1. Active paid subscription within valid billing period
              (status = 'active' AND (current_period_end IS NULL OR current_period_end > v_now))
              OR
              -- 2. Active 14-day trial within valid trial period (server clock enforced)
              (status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at > v_now)
          )
    ) INTO v_is_premium;

    RETURN COALESCE(v_is_premium, FALSE);
END;
$$;


-- B. START_FREE_TRIAL
-- Atomically starts the 14-day Premium trial for the signed-in user.
-- Uses row-level lock (FOR UPDATE) to prevent concurrent / duplicate activations.
-- Enforces single-use eligibility strictly; sets trial_eligible = FALSE.
CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_ends_at TIMESTAMPTZ := v_now + INTERVAL '14 days';
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

    -- Activate the 14-day trial
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
            'duration_days', 14
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'trialing',
        'is_premium', TRUE,
        'trial_started_at', v_now,
        'trial_ends_at', v_ends_at,
        'days_remaining', 14
    );
END;
$$;


-- C. COMPLETE_SUBSCRIPTION_ONBOARDING
-- Marks onboarding as completed when the user chooses "Continue with Free / Skip for Now".
-- Crucial rule: Does NOT consume trial eligibility (trial_eligible remains TRUE).
CREATE OR REPLACE FUNCTION public.complete_subscription_onboarding(p_choice TEXT DEFAULT 'skip')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_choice TEXT := COALESCE(NULLIF(trim(p_choice), ''), 'skip');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Self-heal: ensure subscription row exists
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (v_user_id, 'free', TRUE, FALSE)
    ON CONFLICT (owner_id) DO NOTHING;

    -- Mark onboarding completed; preserve trial_eligible and status
    UPDATE public.user_subscriptions
    SET onboarding_completed = TRUE,
        updated_at = clock_timestamp()
    WHERE owner_id = v_user_id;

    -- Audit log
    INSERT INTO public.subscription_events (owner_id, event_type, details)
    VALUES (
        v_user_id,
        'onboarding_completed',
        jsonb_build_object('choice', v_choice)
    );
END;
$$;


-- D. GET_USER_SUBSCRIPTION
-- Returns complete subscription state for the authenticated user, dynamically calculating
-- whether trial/paid period is still active against server time.
CREATE OR REPLACE FUNCTION public.get_user_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sub RECORD;
    v_plan RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_is_premium BOOLEAN := FALSE;
    v_effective_status TEXT;
    v_days_remaining INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Fetch subscription record
    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id;

    -- Self-healing fallback if user record is missing
    IF NOT FOUND THEN
        INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
        VALUES (v_user_id, 'free', TRUE, FALSE)
        ON CONFLICT (owner_id) DO NOTHING;

        SELECT * INTO v_sub
        FROM public.user_subscriptions
        WHERE owner_id = v_user_id;
    END IF;

    -- Determine dynamic status & expiration
    IF v_sub.status = 'active' THEN
        IF v_sub.current_period_end IS NULL OR v_sub.current_period_end > v_now THEN
            v_is_premium := TRUE;
            v_effective_status := 'active';
            IF v_sub.current_period_end IS NOT NULL THEN
                v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.current_period_end - v_now)) / 86400)::INTEGER);
            END IF;
        ELSE
            v_is_premium := FALSE;
            v_effective_status := 'expired';
        END IF;
    ELSIF v_sub.status = 'trialing' THEN
        IF v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at > v_now THEN
            v_is_premium := TRUE;
            v_effective_status := 'trialing';
            v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.trial_ends_at - v_now)) / 86400)::INTEGER);
        ELSE
            v_is_premium := FALSE;
            v_effective_status := 'expired';
        END IF;
    ELSE
        v_is_premium := FALSE;
        v_effective_status := v_sub.status;
    END IF;

    -- Fetch optional plan metadata
    IF v_sub.plan_id IS NOT NULL THEN
        SELECT name, price_php, duration_days, billing_cycle INTO v_plan
        FROM public.subscription_plans
        WHERE id = v_sub.plan_id;
    END IF;

    RETURN jsonb_build_object(
        'owner_id', v_sub.owner_id,
        'status', v_effective_status,
        'raw_status', v_sub.status,
        'is_premium', v_is_premium,
        'plan_id', v_sub.plan_id,
        'plan_name', v_plan.name,
        'plan_price', v_plan.price_php,
        'trial_eligible', v_sub.trial_eligible,
        'trial_started_at', v_sub.trial_started_at,
        'trial_ends_at', v_sub.trial_ends_at,
        'current_period_start', v_sub.current_period_start,
        'current_period_end', v_sub.current_period_end,
        'days_remaining', v_days_remaining,
        'onboarding_completed', v_sub.onboarding_completed
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. NEW USER PROVISIONING TRIGGER & EXISTING USERS BACKFILL
-- ------------------------------------------------------------------------------

-- Dedicated subscription trigger function on auth.users signup
-- Preserves existing handle_new_user_store_settings trigger without collision
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (NEW.id, 'free', TRUE, FALSE)
    ON CONFLICT (owner_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill all existing users who do not yet have a row in user_subscriptions
-- Safe and idempotent: existing users receive Free tier, full 14-day trial eligibility,
-- with onboarding marked complete (TRUE) so they are not interrupted by onboarding popups.
INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
SELECT id, 'free', TRUE, TRUE
FROM auth.users
ON CONFLICT (owner_id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 6. GRANT EXECUTE PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_user_premium(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_premium(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.start_free_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated;

REVOKE ALL ON FUNCTION public.complete_subscription_onboarding(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_subscription_onboarding(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_subscription() TO authenticated;
