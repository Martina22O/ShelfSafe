-- ==============================================================================
-- ShelfSafe Backend Test Suite: Help & Support System, RLS & RPCs
-- ==============================================================================
-- Tests:
-- 1. Create support ticket (ticket number generation, defaults)
-- 2. User ticket isolation (users only see own tickets)
-- 3. Staff access (staff sees all tickets)
-- 4. User follow-up message creation
-- 5. User cannot create internal notes
-- 6. Staff internal note creation and visibility protection
-- 7. Staff update status and priority
-- 8. User closes own ticket
-- 9. Anon role execution is refused
-- 10. Reject assignment to non-staff users
-- 11. Direct client UPDATE on support_tickets blocked
-- 12. is_support_staff probe authorization
-- 13. Unauthorized caller calling update_ticket_by_staff is rejected
-- 14. Anon callers blocked from messages and closing tickets
-- 15. Direct client INSERT on support_tickets blocked
-- 16. Direct client INSERT on support_ticket_messages blocked
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_order INTEGER,
    test_id TEXT,
    test_name TEXT,
    status TEXT,
    message TEXT
);

TRUNCATE TABLE test_results;
GRANT ALL ON TABLE test_results TO PUBLIC, authenticated, anon;

DO $$
DECLARE
    v_user1_id UUID := gen_random_uuid();
    v_user2_id UUID := gen_random_uuid();
    v_staff_id UUID := gen_random_uuid();

    v_ticket1 JSONB;
    v_ticket1_id UUID;
    v_ticket_num TEXT;
    v_msg1 JSONB;
    v_msg2 JSONB;

    v_count INTEGER;
    v_err_caught BOOLEAN;
    v_bool_res BOOLEAN;
BEGIN
    -- Setup mock users in auth.users
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES
        (v_user1_id, 'user1@shelfsafe.test', '{"name": "Alice Store"}'::jsonb),
        (v_user2_id, 'user2@shelfsafe.test', '{"name": "Bob Store"}'::jsonb),
        (v_staff_id, 'staff@shelfsafe.test', '{"name": "Support Sarah"}'::jsonb);

    -- Setup staff role
    INSERT INTO public.support_staff_roles (user_id, role, full_name, is_active)
    VALUES (v_staff_id, 'support_agent', 'Support Sarah', TRUE);

    -- --------------------------------------------------------------------------
    -- TEST 1: User 1 creates support ticket
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        v_ticket1 := public.create_support_ticket(
            'Barcode Scanning',
            'Cannot scan faded label on item',
            'When trying to scan item barcode 12345678, the camera viewfinder is blurry.'
        );

        v_ticket1_id := (v_ticket1->>'id')::UUID;
        v_ticket_num := v_ticket1->>'ticket_number';

        IF v_ticket_num LIKE 'SS-%' AND (v_ticket1->>'status') = 'Open' AND (v_ticket1->>'priority') = 'Medium' THEN
            INSERT INTO test_results VALUES (1, '1', 'Create support ticket', 'PASS', format('Created ticket %s with status Open', v_ticket_num));
        ELSE
            INSERT INTO test_results VALUES (1, '1', 'Create support ticket', 'FAIL', format('Unexpected ticket: %s', v_ticket1));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (1, '1', 'Create support ticket', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 2: User Isolation (User 2 cannot see User 1 ticket)
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);

        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE id = v_ticket1_id;

        IF v_count = 0 THEN
            INSERT INTO test_results VALUES (2, '2', 'User ticket isolation', 'PASS', 'User 2 cannot see User 1 ticket via RLS');
        ELSE
            INSERT INTO test_results VALUES (2, '2', 'User ticket isolation', 'FAIL', 'User 2 was able to view User 1 ticket');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (2, '2', 'User ticket isolation', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 3: Staff visibility (Staff can see all tickets)
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);

        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE id = v_ticket1_id;

        IF v_count = 1 THEN
            INSERT INTO test_results VALUES (3, '3', 'Staff ticket visibility', 'PASS', 'Support staff successfully viewed user ticket');
        ELSE
            INSERT INTO test_results VALUES (3, '3', 'Staff ticket visibility', 'FAIL', 'Staff was unable to view user ticket');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (3, '3', 'Staff ticket visibility', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 4: User 1 sends follow-up message
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        v_msg1 := public.add_support_ticket_message(
            v_ticket1_id,
            'I tried cleaning the camera lens but still cannot scan.',
            NULL,
            FALSE
        );

        IF (v_msg1->>'sender_role') = 'user' AND (v_msg1->>'is_internal_note')::boolean = FALSE THEN
            INSERT INTO test_results VALUES (4, '4', 'User follow-up message', 'PASS', 'User successfully added public message');
        ELSE
            INSERT INTO test_results VALUES (4, '4', 'User follow-up message', 'FAIL', format('Unexpected msg: %s', v_msg1));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (4, '4', 'User follow-up message', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 5: User cannot create internal notes
    -- --------------------------------------------------------------------------
    BEGIN
        v_err_caught := FALSE;
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        BEGIN
            PERFORM public.add_support_ticket_message(
                v_ticket1_id,
                'Attempted internal note by user',
                NULL,
                TRUE
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (5, '5', 'Prevent user internal note', 'PASS', 'User was blocked from creating internal notes');
        ELSE
            INSERT INTO test_results VALUES (5, '5', 'Prevent user internal note', 'FAIL', 'User was improperly allowed to create internal note');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 6: Staff creates internal note (hidden from user)
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);

        v_msg2 := public.add_support_ticket_message(
            v_ticket1_id,
            'Investigating ZXing camera resolution config',
            NULL,
            TRUE
        );

        -- Check visibility by user 1:
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
        SELECT COUNT(*) INTO v_count
        FROM public.support_ticket_messages
        WHERE id = (v_msg2->>'id')::UUID;

        IF v_count = 0 THEN
            INSERT INTO test_results VALUES (6, '6', 'Internal note privacy', 'PASS', 'Internal note created by staff is invisible to user via RLS');
        ELSE
            INSERT INTO test_results VALUES (6, '6', 'Internal note privacy', 'FAIL', 'Internal note was leaked to user via RLS');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (6, '6', 'Internal note privacy', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 7: Staff updates ticket status & priority
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);

        -- A. Assign to Sarah
        PERFORM public.update_ticket_by_staff(
            v_ticket1_id,
            'In Progress',
            'High',
            v_staff_id,
            'Assigned to Sarah for camera testing'
        );

        -- B. Status-only update (p_assigned_to is NULL): must NOT log a false assignment change
        PERFORM public.update_ticket_by_staff(
            v_ticket1_id,
            'In Progress',
            'Medium',
            NULL,
            'Adjusting severity only'
        );

        -- Verify status/priority and verify exactly 1 assignment activity was logged (not 2)
        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE id = v_ticket1_id AND status = 'In Progress' AND priority = 'Medium' AND assigned_to = v_staff_id;

        IF v_count = 1 THEN
            SELECT COUNT(*) INTO v_count
            FROM public.support_ticket_activities
            WHERE ticket_id = v_ticket1_id AND action_type = 'assigned';

            IF v_count = 1 THEN
                INSERT INTO test_results VALUES (7, '7', 'Staff update status/priority', 'PASS', 'Status/priority updated cleanly without false assignment logs');
            ELSE
                INSERT INTO test_results VALUES (7, '7', 'Staff update status/priority', 'FAIL', 'False assignment activity was improperly generated');
            END IF;
        ELSE
            INSERT INTO test_results VALUES (7, '7', 'Staff update status/priority', 'FAIL', 'Update failed to persist');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (7, '7', 'Staff update status/priority', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 8: User closes own ticket
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        PERFORM public.close_own_ticket(v_ticket1_id);

        -- Verify ticket status is Closed AND activity log captured previous status ('In Progress')
        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE id = v_ticket1_id AND status = 'Closed';

        IF v_count = 1 THEN
            SELECT COUNT(*) INTO v_count
            FROM public.support_ticket_activities
            WHERE ticket_id = v_ticket1_id
              AND action_type = 'closed'
              AND old_value = 'In Progress'
              AND new_value = 'Closed';

            IF v_count = 1 THEN
                INSERT INTO test_results VALUES (8, '8', 'User closes own ticket', 'PASS', 'User marked ticket Closed and preserved previous status in activity log');
            ELSE
                INSERT INTO test_results VALUES (8, '8', 'User closes own ticket', 'FAIL', 'Activity log failed to capture prior status');
            END IF;
        ELSE
            INSERT INTO test_results VALUES (8, '8', 'User closes own ticket', 'FAIL', 'Close operation failed');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (8, '8', 'User closes own ticket', 'FAIL', SQLERRM);
    END;

    -- --------------------------------------------------------------------------
    -- TEST 9: Anon execution refused
    -- --------------------------------------------------------------------------
    BEGIN
        v_err_caught := FALSE;
        PERFORM set_config('role', 'anon', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);

        BEGIN
            PERFORM public.create_support_ticket('Other Concerns', 'Anon subject', 'Anon description text');
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (9, '9', 'Anon execution blocked', 'PASS', 'Unauthenticated caller blocked from creating tickets');
        ELSE
            INSERT INTO test_results VALUES (9, '9', 'Anon execution blocked', 'FAIL', 'Anon was improperly allowed to create ticket');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 10: Reject assignment to non-staff users
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.update_ticket_by_staff(
                v_ticket1_id,
                NULL,
                NULL,
                v_user2_id,
                NULL
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (10, '10', 'Reject non-staff assignment', 'PASS', 'Assigning non-staff account was strictly rejected');
        ELSE
            INSERT INTO test_results VALUES (10, '10', 'Reject non-staff assignment', 'FAIL', 'Non-staff user was improperly assigned');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 11: Direct client UPDATE on support_tickets blocked
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        -- Attempt direct UPDATE bypassing RPC and activity log
        UPDATE public.support_tickets
        SET status = 'Open'
        WHERE id = v_ticket1_id;

        -- Verify status was NOT changed (remains Closed)
        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE id = v_ticket1_id AND status = 'Closed';

        IF v_count = 1 THEN
            INSERT INTO test_results VALUES (11, '11', 'Block direct ticket UPDATE', 'PASS', 'Direct client UPDATE was blocked by RLS');
        ELSE
            INSERT INTO test_results VALUES (11, '11', 'Block direct ticket UPDATE', 'FAIL', 'Direct client UPDATE bypassed audit RPCs');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 12: is_support_staff probe authorization
    -- --------------------------------------------------------------------------
    BEGIN
        -- User 1 (regular user) checks own status -> FALSE
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        SELECT public.is_support_staff() INTO v_bool_res;
        IF v_bool_res = FALSE THEN
            -- User 1 probes Sarah (staff) -> must return FALSE (probing non-self forbidden for non-staff)
            SELECT public.is_support_staff(v_staff_id) INTO v_bool_res;
            IF v_bool_res = FALSE THEN
                -- Sarah (staff) checks own status -> TRUE
                PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
                SELECT public.is_support_staff() INTO v_bool_res;
                IF v_bool_res = TRUE THEN
                    -- Sarah (staff) inspects User 1 -> returns FALSE (staff inspection permitted)
                    SELECT public.is_support_staff(v_user1_id) INTO v_bool_res;
                    IF v_bool_res = FALSE THEN
                        INSERT INTO test_results VALUES (12, '12', 'Staff status probing protection', 'PASS', 'Probing other users blocked for non-staff; staff self/target checks accurate');
                    ELSE
                        INSERT INTO test_results VALUES (12, '12', 'Staff status probing protection', 'FAIL', 'Staff check returned true for non-staff target');
                    END IF;
                ELSE
                    INSERT INTO test_results VALUES (12, '12', 'Staff status probing protection', 'FAIL', 'Staff self-check failed');
                END IF;
            ELSE
                INSERT INTO test_results VALUES (12, '12', 'Staff status probing protection', 'FAIL', 'Non-staff was able to probe staff identity');
            END IF;
        ELSE
            INSERT INTO test_results VALUES (12, '12', 'Staff status probing protection', 'FAIL', 'Regular user returned true for staff check');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 13: Unauthorized caller calling update_ticket_by_staff is rejected
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.update_ticket_by_staff(
                v_ticket1_id,
                'In Progress',
                NULL,
                NULL,
                'Attempted malicious status update'
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            INSERT INTO test_results VALUES (13, '13', 'Reject non-staff ticket update', 'PASS', 'Unauthorized staff RPC call was strictly rejected');
        ELSE
            INSERT INTO test_results VALUES (13, '13', 'Reject non-staff ticket update', 'FAIL', 'Non-staff user was allowed to call update_ticket_by_staff');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 14: Anon callers blocked from messages and closing tickets
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'anon', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);

        v_err_caught := FALSE;
        BEGIN
            PERFORM public.add_support_ticket_message(
                v_ticket1_id,
                'Anon spam message'
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        IF v_err_caught THEN
            v_err_caught := FALSE;
            BEGIN
                PERFORM public.close_own_ticket(v_ticket1_id);
            EXCEPTION WHEN OTHERS THEN
                v_err_caught := TRUE;
            END;

            IF v_err_caught THEN
                SELECT public.is_support_staff() INTO v_bool_res;
                IF v_bool_res = FALSE THEN
                    INSERT INTO test_results VALUES (14, '14', 'Anon support RPCs blocked', 'PASS', 'Anon execution blocked across messages, closure, and staff checks');
                ELSE
                    INSERT INTO test_results VALUES (14, '14', 'Anon support RPCs blocked', 'FAIL', 'Anon is_support_staff returned true');
                END IF;
            ELSE
                INSERT INTO test_results VALUES (14, '14', 'Anon support RPCs blocked', 'FAIL', 'Anon was able to call close_own_ticket');
            END IF;
        ELSE
            INSERT INTO test_results VALUES (14, '14', 'Anon support RPCs blocked', 'FAIL', 'Anon was able to call add_support_ticket_message');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 15: Direct client INSERT on support_tickets blocked
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        v_err_caught := FALSE;
        BEGIN
            INSERT INTO public.support_tickets (
                owner_id, category, subject, description, status, priority, ticket_number, assigned_to, assigned_name
            ) VALUES (
                v_user1_id, 'Account & Login', 'Forged ticket', 'Direct insert bypassing RPC', 'Resolved', 'Urgent', 'SS-999999', v_staff_id, 'Support Sarah'
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        SELECT COUNT(*) INTO v_count
        FROM public.support_tickets
        WHERE ticket_number = 'SS-999999';

        IF v_err_caught AND v_count = 0 THEN
            INSERT INTO test_results VALUES (15, '15', 'Block direct ticket INSERT', 'PASS', 'Direct client INSERT blocked; users cannot forge ticket status, priority, or number');
        ELSE
            INSERT INTO test_results VALUES (15, '15', 'Block direct ticket INSERT', 'FAIL', 'Direct client INSERT succeeded or created forged ticket row');
        END IF;
    END;

    -- --------------------------------------------------------------------------
    -- TEST 16: Direct client INSERT on support_ticket_messages blocked
    -- --------------------------------------------------------------------------
    BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);

        v_err_caught := FALSE;
        BEGIN
            INSERT INTO public.support_ticket_messages (
                ticket_id, sender_id, sender_role, sender_name, message, is_internal_note
            ) VALUES (
                v_ticket1_id, v_user1_id, 'support_agent', 'Forged Sarah', 'Forged internal staff note', TRUE
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := TRUE;
        END;

        SELECT COUNT(*) INTO v_count
        FROM public.support_ticket_messages
        WHERE message = 'Forged internal staff note';

        IF v_err_caught AND v_count = 0 THEN
            INSERT INTO test_results VALUES (16, '16', 'Block direct message INSERT', 'PASS', 'Direct message INSERT blocked; sender role and internal note forgery prevented');
        ELSE
            INSERT INTO test_results VALUES (16, '16', 'Block direct message INSERT', 'FAIL', 'Direct message INSERT succeeded or created forged message row');
        END IF;
    END;

    -- Cleanup test fixtures
    DELETE FROM public.support_ticket_activities WHERE ticket_id = v_ticket1_id;
    DELETE FROM public.support_ticket_messages WHERE ticket_id = v_ticket1_id;
    DELETE FROM public.support_tickets WHERE id = v_ticket1_id;
    DELETE FROM public.support_staff_roles WHERE user_id = v_staff_id;
    DELETE FROM auth.users WHERE id IN (v_user1_id, v_user2_id, v_staff_id);
END $$;

SELECT test_order, test_name, status, message FROM test_results ORDER BY test_order;
