-- ==============================================================================
-- ShelfSafe Test Suite: Simulated Subscription Payment, Auto-Renew & Cancellation
-- ==============================================================================
BEGIN;

DO $$
DECLARE
    v_test_user UUID := '11111111-2222-3333-4444-555555555555'::UUID;
    v_res JSONB;
    v_sub RECORD;
    v_event RECORD;
BEGIN
    RAISE NOTICE '--- Starting Simulated Payment Test Suite ---';

    -- 0. Setup test user in auth.users if not present
    INSERT INTO auth.users (id, email)
    VALUES (v_test_user, 'simulation_tester@shelfsafe.local')
    ON CONFLICT (id) DO NOTHING;

    -- Ensure base subscription row in 'free' state
    INSERT INTO public.user_subscriptions (owner_id, status, trial_eligible, onboarding_completed)
    VALUES (v_test_user, 'free', TRUE, TRUE)
    ON CONFLICT (owner_id) DO UPDATE
    SET status = 'free', trial_eligible = TRUE, plan_id = NULL, current_period_start = NULL, current_period_end = NULL;

    -- Ensure simulation is enabled
    UPDATE public.subscription_simulation_config
    SET simulation_enabled = TRUE
    WHERE id = 'default';

    -- Mock session as v_test_user
    PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- --------------------------------------------------------------------------
    -- TEST 1: Simulate Payment for Monthly Premium (₱99)
    -- --------------------------------------------------------------------------
    v_res := public.simulate_subscription_payment('premium_monthly', 'simulated_card');
    IF (v_res->>'success')::BOOLEAN <> TRUE OR (v_res->>'status') <> 'active' OR (v_res->>'is_premium')::BOOLEAN <> TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: simulate_subscription_payment monthly returned unexpected payload: %', v_res;
    END IF;
    IF (v_res->>'plan_price')::NUMERIC <> 99.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: expected plan_price 99.00, got %', (v_res->>'plan_price');
    END IF;
    RAISE NOTICE 'TEST 1 PASSED: Monthly simulation activated successfully (₱99)';

    -- Verify user_subscriptions record
    SELECT * INTO v_sub FROM public.user_subscriptions WHERE owner_id = v_test_user;
    IF v_sub.status <> 'active' OR v_sub.plan_id <> 'premium_monthly' OR v_sub.auto_renew <> TRUE OR v_sub.cancel_at_period_end <> FALSE THEN
        RAISE EXCEPTION 'TEST 1 DB VERIFY FAILED: %', row_to_json(v_sub);
    END IF;

    -- Verify audit log
    SELECT * INTO v_event FROM public.subscription_events
    WHERE owner_id = v_test_user AND event_type = 'plan_purchased'
    ORDER BY created_at DESC LIMIT 1;
    IF v_event.details->>'simulated' <> 'true' OR v_event.details->>'plan_id' <> 'premium_monthly' THEN
        RAISE EXCEPTION 'TEST 1 EVENT AUDIT FAILED: %', row_to_json(v_event);
    END IF;
    RAISE NOTICE 'TEST 1 PASSED: Database state and audit event verified';

    -- --------------------------------------------------------------------------
    -- TEST 2: Invalid Plan ID must be rejected
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM public.simulate_subscription_payment('non_existent_plan_xyz');
        RAISE EXCEPTION 'TEST 2 FAILED: Expected exception for invalid plan, but succeeded';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Invalid or inactive subscription plan%' THEN
            RAISE NOTICE 'TEST 2 PASSED: Invalid plan correctly rejected';
        ELSE
            RAISE EXCEPTION 'TEST 2 FAILED with unexpected error: %', SQLERRM;
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: Environment Gate: Server-side rejection when simulation is disabled
    -- --------------------------------------------------------------------------
    UPDATE public.subscription_simulation_config
    SET simulation_enabled = FALSE
    WHERE id = 'default';

    BEGIN
        PERFORM public.simulate_subscription_payment('premium_monthly', 'simulated_card');
        RAISE EXCEPTION 'TEST 3 FAILED: Expected simulation to be blocked when disabled, but succeeded';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Payment simulation is disabled in this environment%' THEN
            RAISE NOTICE 'TEST 3 PASSED: Server-side environment gate strictly blocked payment simulation';
        ELSE
            RAISE EXCEPTION 'TEST 3 FAILED with unexpected error: %', SQLERRM;
        END IF;
    END;

    -- Restore simulation to enabled
    UPDATE public.subscription_simulation_config
    SET simulation_enabled = TRUE
    WHERE id = 'default';

    -- --------------------------------------------------------------------------
    -- TEST 4: Invalid payment method token rejected
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM public.simulate_subscription_payment('premium_monthly', 'unauthorized_live_card');
        RAISE EXCEPTION 'TEST 4 FAILED: Expected invalid payment method token to be rejected, but succeeded';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Invalid payment method for simulation%' THEN
            RAISE NOTICE 'TEST 4 PASSED: Non-simulation payment token correctly rejected';
        ELSE
            RAISE EXCEPTION 'TEST 4 FAILED with unexpected error: %', SQLERRM;
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: Cancel Subscription
    -- --------------------------------------------------------------------------
    v_res := public.cancel_subscription();
    IF (v_res->>'success')::BOOLEAN <> TRUE OR (v_res->>'auto_renew')::BOOLEAN <> FALSE OR (v_res->>'cancel_at_period_end')::BOOLEAN <> TRUE THEN
        RAISE EXCEPTION 'TEST 5 FAILED: cancel_subscription returned unexpected payload: %', v_res;
    END IF;

    -- Entitlement check: User should STILL be premium until period end
    IF NOT public.is_user_premium(v_test_user) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: User should remain premium until current_period_end after cancellation';
    END IF;
    RAISE NOTICE 'TEST 5 PASSED: Subscription cancelled with auto_renew=FALSE, cancel_at_period_end=TRUE; access preserved';

    -- --------------------------------------------------------------------------
    -- TEST 6: Toggle Auto-Renew
    -- --------------------------------------------------------------------------
    v_res := public.set_subscription_auto_renew(TRUE);
    IF (v_res->>'auto_renew')::BOOLEAN <> TRUE OR (v_res->>'cancel_at_period_end')::BOOLEAN <> FALSE THEN
        RAISE EXCEPTION 'TEST 6 FAILED: set_subscription_auto_renew returned unexpected payload: %', v_res;
    END IF;
    RAISE NOTICE 'TEST 6 PASSED: Auto-renew toggled back to TRUE';

    -- --------------------------------------------------------------------------
    -- TEST 7: Renew Subscription (Simulated Renewal)
    -- --------------------------------------------------------------------------
    v_res := public.renew_subscription();
    IF (v_res->>'success')::BOOLEAN <> TRUE OR (v_res->>'status') <> 'active' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: renew_subscription failed: %', v_res;
    END IF;
    IF (v_res->>'days_remaining')::INTEGER < 50 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Expected renewal to extend days_remaining (> 50), got %', (v_res->>'days_remaining');
    END IF;
    RAISE NOTICE 'TEST 7 PASSED: Subscription renewed and period extended';

    -- --------------------------------------------------------------------------
    -- TEST 8: get_user_subscription RPC verification
    -- --------------------------------------------------------------------------
    v_res := public.get_user_subscription();
    IF (v_res->>'status') <> 'active' OR (v_res->>'is_premium')::BOOLEAN <> TRUE OR (v_res->>'auto_renew')::BOOLEAN <> TRUE THEN
        RAISE EXCEPTION 'TEST 8 FAILED: get_user_subscription returned: %', v_res;
    END IF;
    RAISE NOTICE 'TEST 8 PASSED: get_user_subscription returned correct active state, auto_renew, and period metadata';

    -- --------------------------------------------------------------------------
    -- TEST 9: Upgrade to Annual Premium (₱499)
    -- --------------------------------------------------------------------------
    v_res := public.simulate_subscription_payment('premium_annual', 'simulated_card');
    IF (v_res->>'plan_id') <> 'premium_annual' OR (v_res->>'plan_price')::NUMERIC <> 499.00 THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Annual upgrade failed: %', v_res;
    END IF;
    RAISE NOTICE 'TEST 9 PASSED: Annual Premium simulation activated successfully (₱499)';

    RAISE NOTICE '--- ALL 9 SIMULATION TESTS PASSED SUCCESSFULLY ---';
END $$;

ROLLBACK;
