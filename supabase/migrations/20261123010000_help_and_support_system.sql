-- ==============================================================================
-- ShelfSafe Schema Migration: Help & Support Ticketing System
-- ==============================================================================
-- Provides a complete, secure customer support and issue-tracking infrastructure.
-- Features:
-- 1. Support staff roles and permission checks (is_support_staff)
-- 2. Unique, sequential human-readable ticket numbers (SS-10001, SS-10002...)
-- 3. Support tickets with category, status, priority, assignment, and resolution notes
-- 4. Threaded ticket messages with internal staff notes protection
-- 5. Full activity audit logs for tracking actions, assignments, and state transitions
-- 6. Private storage bucket for screenshots and error image attachments
-- 7. Comprehensive Row Level Security (RLS) policies and SECURITY DEFINER RPCs

-- ==============================================================================
-- 1. AUTHORIZED SUPPORT STAFF ROLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_staff_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('support_agent', 'support_lead', 'admin')),
    full_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_staff_roles_active ON public.support_staff_roles (user_id) WHERE is_active = TRUE;

ALTER TABLE public.support_staff_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if a user is authorized support staff.
-- Ordinary users can only verify their own staff status.
-- Only active staff members are permitted to check arbitrary user IDs.
CREATE OR REPLACE FUNCTION public.is_support_staff(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_target UUID := COALESCE(p_user_id, v_caller);
BEGIN
    IF v_caller IS NULL THEN
        RETURN FALSE;
    END IF;

    -- An ordinary user can only check their own staff status.
    -- Prevent probing arbitrary accounts unless caller is active staff.
    IF v_target <> v_caller THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.support_staff_roles
            WHERE user_id = v_caller AND is_active = TRUE
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.support_staff_roles
        WHERE user_id = v_target AND is_active = TRUE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_support_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_staff(UUID) TO authenticated;

-- Staff roles RLS policies
DROP POLICY IF EXISTS "Staff can read all staff roles" ON public.support_staff_roles;
CREATE POLICY "Staff can read all staff roles"
    ON public.support_staff_roles FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR public.is_support_staff(auth.uid())
    );

-- ==============================================================================
-- 2. TICKET NUMBER SEQUENCE
-- ==============================================================================

CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START WITH 10001;

-- ==============================================================================
-- 3. SUPPORT TICKETS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    category TEXT NOT NULL CHECK (category IN (
        'Account Access',
        'Inventory Management',
        'Barcode Scanning',
        'Batch Recording',
        'Expiration Alerts',
        'Inventory Adjustments',
        'Notifications',
        'Subscription and Billing',
        'System Errors',
        'Other Concerns'
    )),
    subject TEXT NOT NULL CHECK (char_length(trim(subject)) BETWEEN 3 AND 150),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_name TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_owner_id ON public.support_tickets (owner_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets (priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Support tickets RLS:
-- Users see their own tickets; staff see all tickets.
DROP POLICY IF EXISTS "Users can view own tickets or staff can view all" ON public.support_tickets;
CREATE POLICY "Users can view own tickets or staff can view all"
    ON public.support_tickets FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid() OR public.is_support_staff(auth.uid())
    );

-- Integrity & Audit protection:
-- Direct client-side INSERT, UPDATE, and DELETE policies on public.support_tickets are disallowed.
-- All ticket creation and mutations must occur strictly through trusted SECURITY DEFINER RPCs
-- (create_support_ticket, update_ticket_by_staff, close_own_ticket) to guarantee immutable audit logs
-- and prevent forging of ticket numbers, status, priority, or staff assignments.
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff can update tickets" ON public.support_tickets;

-- ==============================================================================
-- 4. SUPPORT TICKET MESSAGES TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    sender_name TEXT,
    sender_role TEXT NOT NULL DEFAULT 'user' CHECK (sender_role IN ('user', 'support_agent', 'support_lead', 'admin')),
    message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
    attachment_url TEXT,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages (ticket_id, created_at ASC);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Messages RLS:
-- Users can see public messages on their tickets. Staff can see all messages including internal notes.
DROP POLICY IF EXISTS "Users view public messages; staff view all" ON public.support_ticket_messages;
CREATE POLICY "Users view public messages; staff view all"
    ON public.support_ticket_messages FOR SELECT
    TO authenticated
    USING (
        public.is_support_staff(auth.uid())
        OR (
            is_internal_note = FALSE
            AND EXISTS (
                SELECT 1 FROM public.support_tickets t
                WHERE t.id = support_ticket_messages.ticket_id
                AND t.owner_id = auth.uid()
            )
        )
    );

-- Messages Integrity & Audit protection:
-- Direct client-side INSERT policies on public.support_ticket_messages are disallowed.
-- All message creation must occur strictly through the trusted SECURITY DEFINER RPC
-- (add_support_ticket_message) to prevent forging sender role, identity, or internal notes,
-- and to ensure all replies generate audit activity entries and update ticket timestamps.
DROP POLICY IF EXISTS "Users insert to own tickets; staff insert to any" ON public.support_ticket_messages;

-- ==============================================================================
-- 5. SUPPORT TICKET ACTIVITIES TABLE (AUDIT LOG)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_ticket_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    actor_name TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'created',
        'status_changed',
        'priority_changed',
        'assigned',
        'user_reply',
        'staff_reply',
        'internal_note',
        'resolved',
        'closed',
        'reopened'
    )),
    old_value TEXT,
    new_value TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_activities_ticket_id ON public.support_ticket_activities (ticket_id, created_at ASC);

ALTER TABLE public.support_ticket_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and staff can view ticket activities" ON public.support_ticket_activities;
CREATE POLICY "Users and staff can view ticket activities"
    ON public.support_ticket_activities FOR SELECT
    TO authenticated
    USING (
        public.is_support_staff(auth.uid())
        OR (
            action_type <> 'internal_note'
            AND EXISTS (
                SELECT 1 FROM public.support_tickets t
                WHERE t.id = support_ticket_activities.ticket_id
                AND t.owner_id = auth.uid()
            )
        )
    );

-- ==============================================================================
-- 6. PRIVATE STORAGE BUCKET FOR SUPPORT ATTACHMENTS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'support-attachments',
    'support-attachments',
    false,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS
DROP POLICY IF EXISTS "Users can read own support attachments or staff read all" ON storage.objects;
CREATE POLICY "Users can read own support attachments or staff read all"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'support-attachments'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_support_staff(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users and staff can upload support attachments" ON storage.objects;
CREATE POLICY "Users and staff can upload support attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'support-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ==============================================================================
-- 7. SECURE RPC FUNCTIONS
-- ==============================================================================

-- A. CREATE SUPPORT TICKET
CREATE OR REPLACE FUNCTION public.create_support_ticket(
    p_category TEXT,
    p_subject TEXT,
    p_description TEXT,
    p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
    v_ticket_number TEXT;
    v_ticket RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    -- Validate input
    p_subject := trim(p_subject);
    p_description := trim(p_description);

    IF char_length(p_subject) < 3 OR char_length(p_subject) > 150 THEN
        RAISE EXCEPTION 'Subject must be between 3 and 150 characters';
    END IF;

    IF char_length(p_description) < 10 THEN
        RAISE EXCEPTION 'Description must be at least 10 characters long';
    END IF;

    -- Generate sequential human-readable ticket number
    v_ticket_number := 'SS-' || nextval('public.support_ticket_seq')::text;

    -- Resolve user name from metadata
    SELECT COALESCE(raw_user_meta_data->>'name', email)
    INTO v_user_name
    FROM auth.users
    WHERE id = v_user_id;

    -- Insert ticket
    INSERT INTO public.support_tickets (
        ticket_number,
        owner_id,
        category,
        subject,
        description,
        attachment_url,
        status,
        priority
    ) VALUES (
        v_ticket_number,
        v_user_id,
        p_category,
        p_subject,
        p_description,
        NULLIF(trim(p_attachment_url), ''),
        'Open',
        'Medium'
    )
    RETURNING * INTO v_ticket;

    -- Log activity
    INSERT INTO public.support_ticket_activities (
        ticket_id,
        actor_id,
        actor_name,
        action_type,
        new_value,
        details
    ) VALUES (
        v_ticket.id,
        v_user_id,
        v_user_name,
        'created',
        'Open',
        jsonb_build_object(
            'ticket_number', v_ticket_number,
            'category', p_category,
            'subject', p_subject
        )
    );

    RETURN to_jsonb(v_ticket);
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- B. ADD TICKET MESSAGE (USER FOLLOW-UP OR STAFF REPLY)
CREATE OR REPLACE FUNCTION public.add_support_ticket_message(
    p_ticket_id UUID,
    p_message TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_is_internal_note BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_staff BOOLEAN;
    v_sender_role TEXT := 'user';
    v_staff_name TEXT;
    v_user_name TEXT;
    v_sender_name TEXT;
    v_ticket RECORD;
    v_msg RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    p_message := trim(p_message);
    IF char_length(p_message) = 0 THEN
        RAISE EXCEPTION 'Message cannot be empty';
    END IF;

    -- Fetch ticket
    SELECT * INTO v_ticket
    FROM public.support_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Support ticket not found';
    END IF;

    -- Check staff authorization
    v_is_staff := public.is_support_staff(v_user_id);

    IF v_is_staff THEN
        SELECT role, full_name INTO v_sender_role, v_staff_name
        FROM public.support_staff_roles
        WHERE user_id = v_user_id AND is_active = TRUE;

        v_sender_name := COALESCE(v_staff_name, 'Support Personnel');
    ELSE
        -- Non-staff user must be the ticket owner
        IF v_ticket.owner_id <> v_user_id THEN
            RAISE EXCEPTION 'Unauthorized: You do not have permission to reply to this ticket';
        END IF;

        IF v_ticket.status = 'Closed' THEN
            RAISE EXCEPTION 'This ticket is closed. Please submit a new support request if you need further assistance.';
        END IF;

        IF p_is_internal_note THEN
            RAISE EXCEPTION 'Unauthorized: Regular users cannot create internal staff notes';
        END IF;

        v_sender_role := 'user';

        SELECT COALESCE(raw_user_meta_data->>'name', email)
        INTO v_user_name
        FROM auth.users
        WHERE id = v_user_id;

        v_sender_name := COALESCE(v_user_name, 'Customer');
    END IF;

    -- Insert message
    INSERT INTO public.support_ticket_messages (
        ticket_id,
        sender_id,
        sender_name,
        sender_role,
        message,
        attachment_url,
        is_internal_note
    ) VALUES (
        p_ticket_id,
        v_user_id,
        v_sender_name,
        v_sender_role,
        p_message,
        NULLIF(trim(p_attachment_url), ''),
        COALESCE(p_is_internal_note, FALSE)
    )
    RETURNING * INTO v_msg;

    -- If customer replies to a resolved ticket, reopen to In Progress
    IF NOT v_is_staff AND v_ticket.status = 'Resolved' THEN
        UPDATE public.support_tickets
        SET status = 'In Progress',
            updated_at = clock_timestamp()
        WHERE id = p_ticket_id;

        INSERT INTO public.support_ticket_activities (
            ticket_id, actor_id, actor_name, action_type, old_value, new_value, details
        ) VALUES (
            p_ticket_id, v_user_id, v_sender_name, 'reopened', 'Resolved', 'In Progress',
            jsonb_build_object('reason', 'Customer posted follow-up reply')
        );
    ELSE
        -- Touch updated_at
        UPDATE public.support_tickets
        SET updated_at = clock_timestamp()
        WHERE id = p_ticket_id;
    END IF;

    -- Log activity
    INSERT INTO public.support_ticket_activities (
        ticket_id,
        actor_id,
        actor_name,
        action_type,
        details
    ) VALUES (
        p_ticket_id,
        v_user_id,
        v_sender_name,
        CASE
            WHEN p_is_internal_note THEN 'internal_note'
            WHEN v_is_staff THEN 'staff_reply'
            ELSE 'user_reply'
        END,
        jsonb_build_object(
            'message_id', v_msg.id,
            'is_internal_note', p_is_internal_note
        )
    );

    RETURN to_jsonb(v_msg);
END;
$$;

REVOKE ALL ON FUNCTION public.add_support_ticket_message(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;


-- C. STAFF UPDATE TICKET STATUS / PRIORITY / ASSIGNMENT / RESOLUTION
DROP FUNCTION IF EXISTS public.update_ticket_by_staff(UUID, TEXT, TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.update_ticket_by_staff(
    p_ticket_id UUID,
    p_status TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_assigned_to UUID DEFAULT NULL,
    p_resolution_notes TEXT DEFAULT NULL,
    p_unassign BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_staff_name TEXT;
    v_assigned_name TEXT;
    v_ticket RECORD;
    v_final_assigned_to UUID;
    v_final_assigned_name TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_support_staff(v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only authorized support personnel can manage tickets';
    END IF;

    SELECT full_name INTO v_staff_name
    FROM public.support_staff_roles
    WHERE user_id = v_user_id AND is_active = TRUE;

    SELECT * INTO v_ticket
    FROM public.support_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found';
    END IF;

    -- Validate status if supplied
    IF p_status IS NOT NULL AND p_status NOT IN ('Open', 'In Progress', 'Resolved', 'Closed') THEN
        RAISE EXCEPTION 'Invalid status. Must be Open, In Progress, Resolved, or Closed';
    END IF;

    -- Validate priority if supplied
    IF p_priority IS NOT NULL AND p_priority NOT IN ('Critical', 'High', 'Medium', 'Low') THEN
        RAISE EXCEPTION 'Invalid priority. Must be Critical, High, Medium, or Low';
    END IF;

    -- Handle Assignment / Unassignment logic cleanly without false activity logs
    IF COALESCE(p_unassign, FALSE) OR p_assigned_to = '00000000-0000-0000-0000-000000000000'::UUID THEN
        -- Explicit Unassignment requested
        IF v_ticket.assigned_to IS NOT NULL THEN
            INSERT INTO public.support_ticket_activities (
                ticket_id, actor_id, actor_name, action_type, old_value, new_value, details
            ) VALUES (
                p_ticket_id, v_user_id, v_staff_name, 'assigned',
                COALESCE(v_ticket.assigned_name, 'Unassigned'),
                'Unassigned',
                jsonb_build_object('assigned_to', NULL, 'unassigned', true)
            );
        END IF;
        v_final_assigned_to := NULL;
        v_final_assigned_name := NULL;
    ELSIF p_assigned_to IS NOT NULL THEN
        -- Explicit Assignment to a staff member: Must be an ACTIVE support staff member
        SELECT full_name INTO v_assigned_name
        FROM public.support_staff_roles
        WHERE user_id = p_assigned_to AND is_active = TRUE;

        IF v_assigned_name IS NULL THEN
            RAISE EXCEPTION 'Cannot assign ticket: assigned user is not an active support staff member';
        END IF;

        IF p_assigned_to IS DISTINCT FROM v_ticket.assigned_to THEN
            INSERT INTO public.support_ticket_activities (
                ticket_id, actor_id, actor_name, action_type, old_value, new_value, details
            ) VALUES (
                p_ticket_id, v_user_id, v_staff_name, 'assigned',
                COALESCE(v_ticket.assigned_name, 'Unassigned'),
                v_assigned_name,
                jsonb_build_object('assigned_to', p_assigned_to)
            );
        END IF;
        v_final_assigned_to := p_assigned_to;
        v_final_assigned_name := v_assigned_name;
    ELSE
        -- No assignment change supplied (status/priority/notes-only update)
        v_final_assigned_to := v_ticket.assigned_to;
        v_final_assigned_name := v_ticket.assigned_name;
    END IF;

    -- Record status change activity
    IF p_status IS NOT NULL AND p_status <> v_ticket.status THEN
        INSERT INTO public.support_ticket_activities (
            ticket_id, actor_id, actor_name, action_type, old_value, new_value
        ) VALUES (
            p_ticket_id, v_user_id, v_staff_name,
            CASE WHEN p_status = 'Resolved' THEN 'resolved'
                 WHEN p_status = 'Closed' THEN 'closed'
                 ELSE 'status_changed' END,
            v_ticket.status, p_status
        );
    END IF;

    -- Record priority change activity
    IF p_priority IS NOT NULL AND p_priority <> v_ticket.priority THEN
        INSERT INTO public.support_ticket_activities (
            ticket_id, actor_id, actor_name, action_type, old_value, new_value
        ) VALUES (
            p_ticket_id, v_user_id, v_staff_name, 'priority_changed',
            v_ticket.priority, p_priority
        );
    END IF;

    -- Apply updates
    UPDATE public.support_tickets
    SET status = COALESCE(p_status, status),
        priority = COALESCE(p_priority, priority),
        assigned_to = v_final_assigned_to,
        assigned_name = v_final_assigned_name,
        resolution_notes = CASE WHEN p_resolution_notes IS NOT NULL THEN p_resolution_notes ELSE resolution_notes END,
        resolved_at = CASE
            WHEN p_status = 'Resolved' AND v_ticket.status <> 'Resolved' THEN v_now
            WHEN p_status IN ('Open', 'In Progress') THEN NULL
            ELSE resolved_at
        END,
        updated_at = v_now
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    RETURN to_jsonb(v_ticket);
END;
$$;

REVOKE ALL ON FUNCTION public.update_ticket_by_staff(UUID, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ticket_by_staff(UUID, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;


-- D. CLOSE OWN TICKET (FOR REGULAR USERS)
CREATE OR REPLACE FUNCTION public.close_own_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
    v_old_status TEXT;
    v_ticket RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: signed-in user not detected';
    END IF;

    SELECT * INTO v_ticket
    FROM public.support_tickets
    WHERE id = p_ticket_id AND owner_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found or unauthorized';
    END IF;

    v_old_status := v_ticket.status;

    -- If already closed, avoid redundant status changes or duplicate logs
    IF v_old_status = 'Closed' THEN
        RETURN to_jsonb(v_ticket);
    END IF;

    SELECT COALESCE(raw_user_meta_data->>'name', email)
    INTO v_user_name
    FROM auth.users
    WHERE id = v_user_id;

    UPDATE public.support_tickets
    SET status = 'Closed',
        updated_at = clock_timestamp()
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    -- Log previous status before close transition
    INSERT INTO public.support_ticket_activities (
        ticket_id, actor_id, actor_name, action_type, old_value, new_value
    ) VALUES (
        p_ticket_id, v_user_id, v_user_name, 'closed', v_old_status, 'Closed'
    );

    RETURN to_jsonb(v_ticket);
END;
$$;

REVOKE ALL ON FUNCTION public.close_own_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_own_ticket(UUID) TO authenticated;

-- ==============================================================================
-- 8. TABLE, SEQUENCE & FUNCTION PERMISSION GRANTS
-- ==============================================================================
-- Explicitly revoke direct client INSERT, UPDATE, and DELETE privileges so all mutations pass through audited RPCs
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_ticket_messages FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_ticket_activities FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_staff_roles FROM authenticated, anon, PUBLIC;
REVOKE ALL ON SEQUENCE public.support_ticket_seq FROM authenticated, anon, PUBLIC;

-- Only SELECT is granted to authenticated users (with RLS policies enforcing data isolation)
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT SELECT ON public.support_ticket_activities TO authenticated;
GRANT SELECT ON public.support_staff_roles TO authenticated;

-- Explicitly revoke default PUBLIC and anon EXECUTE privileges from all support RPCs
REVOKE ALL ON FUNCTION public.is_support_staff(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_support_ticket_message(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_ticket_by_staff(UUID, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_own_ticket(UUID) FROM PUBLIC, anon;

-- Grant EXECUTE strictly to authenticated application users
GRANT EXECUTE ON FUNCTION public.is_support_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ticket_by_staff(UUID, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_own_ticket(UUID) TO authenticated;
