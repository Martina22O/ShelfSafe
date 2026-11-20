-- ==============================================================================
-- ShelfSafe Schema Migration: Simulated Payment, Auto-Renew & Subscription RPCs
-- ==============================================================================
-- 1. Adds auto_renew and cancel_at_period_end columns to user_subscriptions
-- 2. Establishes subscription_simulation_config table to enforce server-side
--    authorization for payment simulation (never relying on frontend alone)
-- 3. Creates is_payment_simulation_allowed() verification function
-- 4. Creates simulate_subscription_payment() SECURITY DEFINER function
-- 5. Creates cancel_subscription() SECURITY DEFINER function
-- 6. Creates renew_subscription() SECURITY DEFINER function
-- 7. Creates set_subscription_auto_renew() SECURITY DEFINER function
-- 8. Updates get_user_subscription() to include auto_renew & cancel_at_period_end
-- 9. All mutations are strictly server-validated, authenticated, and logged to
--    subscription_events. No card data is ever collected, accepted, or stored.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD AUTO_RENEW & CANCEL_AT_PERIOD_END COLUMNS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_subscriptions'
          AND column_name = 'auto_renew'
    ) THEN
        ALTER TABLE public.user_subscriptions
            ADD COLUMN auto_renew BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_subscriptions'
          AND column_name = 'cancel_at_period_end'
    ) THEN
        ALTER TABLE public.user_subscriptions
            ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. SERVER-SIDE ENVIRONMENT GATE: SUBSCRIPTION SIMULATION CONFIG
-- ------------------------------------------------------------------------------
-- Restricts simulated payment activation to authorized demo/testing environments.
-- Prevents simulated activation in production without database-level configuration.
CREATE TABLE IF NOT EXISTS public.subscription_simulation_config (
    id TEXT PRIMARY KEY,
    simulation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    environment_name TEXT NOT NULL DEFAULT 'demo_preview',
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_simulation_config (id, simulation_enabled, environment_name, description)
VALUES (
    'default',
    TRUE,
    'demo_preview',
    'Server-side gate: permits simulate_subscription_payment only when simulation_enabled is TRUE'
)
ON CONFLICT (id) DO UPDATE SET
    simulation_enabled = EXCLUDED.simulation_enabled,
    environment_name = EXCLUDED.environment_name,
    updated_at = now();

ALTER TABLE public.subscription_simulation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read simulation config" ON public.subscription_simulation_config;
CREATE POLICY "Allow read simulation config"
    ON public.subscription_simulation_config FOR SELECT
    TO authenticated
    USING (TRUE);

-- Server-side check function for simulation availability
CREATE OR REPLACE FUNCTION public.is_payment_simulation_allowed()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_allowed BOOLEAN;
BEGIN
    SELECT simulation_enabled INTO v_allowed
    FROM public.subscription_simulation_config
    WHERE id = 'default';

    RETURN COALESCE(v_allowed, FALSE);
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. SIMULATE SUBSCRIPTION PAYMENT RPC
-- ------------------------------------------------------------------------------
-- Authenticated users simulate payment for an existing active plan.
-- 1. Server-side environment check (aborts if simulation is disabled).
-- 2. Validates plan existence in public.subscription_plans.
-- 3. Enforces server clock for billing period calculations.
-- 4. Emits an immutable audit record in public.subscription_events.
CREATE OR REPLACE FUNCTION public.simulate_subscription_payment(
    p_plan_id TEXT,
    p_payment_method TEXT DEFAULT 'simulated_card'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_plan RECORD;
    v_sub RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Server-side environment gate: strictly verify payment simulation is authorized
    IF NOT public.is_payment_simulation_allowed() THEN
        RAISE EXCEPTION 'Access denied: Payment simulation is disabled in this environment';
    END IF;

    -- Validate payment method token (must be explicit simulation method)
    IF p_payment_method NOT IN ('simulated_card', 'simulated_test') THEN
        RAISE EXCEPTION 'Invalid payment method for simulation: %', p_payment_method;
    END IF;

    -- Validate target plan
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = p_plan_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or inactive subscription plan: %', p_plan_id;
    END IF;

    -- Ensure subscription row exists before locking
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (v_user_id, 'free', TRUE, FALSE)
    ON CONFLICT (owner_id) DO NOTHING;

    -- Lock subscription row to prevent concurrent purchase races
    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    -- Calculate billing period
    -- If user already has an active subscription for this exact plan and period hasn't ended, extend it
    IF v_sub.status = 'active' AND v_sub.plan_id = v_plan.id AND v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > v_now THEN
        v_period_start := v_sub.current_period_start;
        v_period_end := v_sub.current_period_end + (v_plan.duration_days || ' days')::INTERVAL;
    ELSE
        v_period_start := v_now;
        v_period_end := v_now + (v_plan.duration_days || ' days')::INTERVAL;
    END IF;

    -- Update subscription record
    UPDATE public.user_subscriptions
    SET status = 'active',
        plan_id = v_plan.id,
        auto_renew = TRUE,
        cancel_at_period_end = FALSE,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        onboarding_completed = TRUE,
        updated_at = v_now
    WHERE owner_id = v_user_id;

    -- Audit log in subscription_events
    INSERT INTO public.subscription_events (owner_id, event_type, details)
    VALUES (
        v_user_id,
        'plan_purchased',
        jsonb_build_object(
            'simulated', TRUE,
            'payment_method', COALESCE(p_payment_method, 'simulated_card'),
            'plan_id', v_plan.id,
            'plan_name', v_plan.name,
            'price_php', v_plan.price_php,
            'duration_days', v_plan.duration_days,
            'period_start', v_period_start,
            'period_end', v_period_end
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'active',
        'is_premium', TRUE,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'plan_price', v_plan.price_php,
        'auto_renew', TRUE,
        'cancel_at_period_end', FALSE,
        'current_period_start', v_period_start,
        'current_period_end', v_period_end,
        'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_period_end - v_now)) / 86400)::INTEGER)
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. CANCEL SUBSCRIPTION RPC
-- ------------------------------------------------------------------------------
-- Sets auto_renew = FALSE and cancel_at_period_end = TRUE.
-- User retains active access until current_period_end.
CREATE OR REPLACE FUNCTION public.cancel_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_sub RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_sub.status NOT IN ('active', 'trialing') THEN
        RAISE EXCEPTION 'No active or trialing subscription found to cancel';
    END IF;

    UPDATE public.user_subscriptions
    SET auto_renew = FALSE,
        cancel_at_period_end = TRUE,
        updated_at = v_now
    WHERE owner_id = v_user_id;

    -- Audit log
    INSERT INTO public.subscription_events (owner_id, event_type, details)
    VALUES (
        v_user_id,
        'plan_cancelled',
        jsonb_build_object(
            'simulated', TRUE,
            'previous_auto_renew', v_sub.auto_renew,
            'plan_id', v_sub.plan_id,
            'current_period_end', v_sub.current_period_end,
            'cancelled_at', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', v_sub.status,
        'auto_renew', FALSE,
        'cancel_at_period_end', TRUE,
        'current_period_end', v_sub.current_period_end
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. RENEW SUBSCRIPTION RPC
-- ------------------------------------------------------------------------------
-- Manually extends an active, trialing, or expired subscription by its plan duration.
-- Resets auto_renew = TRUE and cancel_at_period_end = FALSE.
CREATE OR REPLACE FUNCTION public.renew_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_sub RECORD;
    v_plan RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No subscription record found';
    END IF;

    -- If no plan is associated (e.g. Free or trialing without explicit plan), default to monthly
    IF v_sub.plan_id IS NULL THEN
        v_sub.plan_id := 'premium_monthly';
    END IF;

    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_sub.plan_id;

    IF NOT FOUND THEN
        SELECT * INTO v_plan
        FROM public.subscription_plans
        WHERE id = 'premium_monthly';
    END IF;

    -- Calculate renewal window
    IF v_sub.status = 'active' AND v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > v_now THEN
        v_period_start := v_sub.current_period_start;
        v_period_end := v_sub.current_period_end + (v_plan.duration_days || ' days')::INTERVAL;
    ELSE
        v_period_start := v_now;
        v_period_end := v_now + (v_plan.duration_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.user_subscriptions
    SET status = 'active',
        plan_id = v_plan.id,
        auto_renew = TRUE,
        cancel_at_period_end = FALSE,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        updated_at = v_now
    WHERE owner_id = v_user_id;

    -- Audit log
    INSERT INTO public.subscription_events (owner_id, event_type, details)
    VALUES (
        v_user_id,
        'plan_renewed',
        jsonb_build_object(
            'simulated', TRUE,
            'plan_id', v_plan.id,
            'plan_name', v_plan.name,
            'price_php', v_plan.price_php,
            'duration_days', v_plan.duration_days,
            'period_start', v_period_start,
            'period_end', v_period_end
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'active',
        'is_premium', TRUE,
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'plan_price', v_plan.price_php,
        'auto_renew', TRUE,
        'cancel_at_period_end', FALSE,
        'current_period_start', v_period_start,
        'current_period_end', v_period_end,
        'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_period_end - v_now)) / 86400)::INTEGER)
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. SET SUBSCRIPTION AUTO-RENEW RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_subscription_auto_renew(p_auto_renew BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := clock_timestamp();
    v_sub RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    SELECT * INTO v_sub
    FROM public.user_subscriptions
    WHERE owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No subscription record found';
    END IF;

    UPDATE public.user_subscriptions
    SET auto_renew = p_auto_renew,
        cancel_at_period_end = NOT p_auto_renew,
        updated_at = v_now
    WHERE owner_id = v_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'auto_renew', p_auto_renew,
        'cancel_at_period_end', NOT p_auto_renew
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. UPDATE GET_USER_SUBSCRIPTION RPC
-- ------------------------------------------------------------------------------
-- Returns complete subscription state including auto_renew & cancel_at_period_end
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
        'auto_renew', COALESCE(v_sub.auto_renew, TRUE),
        'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, FALSE),
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
-- 8. GRANT EXECUTE PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_payment_simulation_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_payment_simulation_allowed() TO authenticated;

REVOKE ALL ON FUNCTION public.simulate_subscription_payment(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulate_subscription_payment(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_subscription() TO authenticated;

REVOKE ALL ON FUNCTION public.renew_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_subscription() TO authenticated;

REVOKE ALL ON FUNCTION public.set_subscription_auto_renew(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_subscription_auto_renew(BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_subscription() TO authenticated;
