/**
 * Library: support.ts (Web)
 * Manages Help & Support ticket creation, communication threads,
 * status tracking, and authorized staff ticket management.
 */
import { createClient } from './supabase/client';

export type SupportCategory =
  | 'Account Access'
  | 'Inventory Management'
  | 'Barcode Scanning'
  | 'Batch Recording'
  | 'Expiration Alerts'
  | 'Inventory Adjustments'
  | 'Notifications'
  | 'Subscription and Billing'
  | 'System Errors'
  | 'Other Concerns';

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'Account Access',
  'Inventory Management',
  'Barcode Scanning',
  'Batch Recording',
  'Expiration Alerts',
  'Inventory Adjustments',
  'Notifications',
  'Subscription and Billing',
  'System Errors',
  'Other Concerns',
];

export type SupportStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type SupportPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  owner_id: string;
  category: SupportCategory;
  subject: string;
  description: string;
  attachment_url: string | null;
  status: SupportStatus;
  priority: SupportPriority;
  assigned_to: string | null;
  assigned_name: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: 'user' | 'support_agent' | 'support_lead' | 'admin';
  message: string;
  attachment_url: string | null;
  is_internal_note: boolean;
  created_at: string;
}

export interface SupportTicketActivity {
  id: string;
  ticket_id: string;
  actor_id: string;
  actor_name: string | null;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export const SUPPORT_HOURS_INFO = {
  hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
  timezone: 'Philippine Time (PHT)',
  holidays: 'Excluding official holidays',
  target: 'Initial response within 1 business day',
  disclaimer:
    'You may submit a request at any time. Our target initial response is within one business day, but complex issues may take longer to fully resolve.',
};

/**
 * Check if the currently authenticated user is an authorized support staff member.
 */
export async function isCurrentUserSupportStaff(): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase.rpc('is_support_staff', {
      p_user_id: user.id,
    });

    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Fetch tickets submitted by the authenticated user.
 */
export async function getMyTickets(): Promise<{ success: boolean; data?: SupportTicket[]; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: (data as SupportTicket[]) || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tickets';
    return { success: false, error: msg };
  }
}

/**
 * Fetch a single ticket by ID.
 */
export async function getTicketDetails(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch ticket details';
    return { success: false, error: msg };
  }
}

/**
 * Fetch all messages for a ticket.
 */
export async function getTicketMessages(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicketMessage[]; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: (data as SupportTicketMessage[]) || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch messages';
    return { success: false, error: msg };
  }
}

/**
 * Submit a new support ticket.
 */
export async function createSupportTicket(params: {
  category: SupportCategory;
  subject: string;
  description: string;
  attachmentUrl?: string | null;
}): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_support_ticket', {
      p_category: params.category,
      p_subject: params.subject.trim(),
      p_description: params.description.trim(),
      p_attachment_url: params.attachmentUrl || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit support request';
    return { success: false, error: msg };
  }
}

/**
 * Send a reply on a ticket.
 */
export async function sendTicketMessage(params: {
  ticketId: string;
  message: string;
  attachmentUrl?: string | null;
  isInternalNote?: boolean;
}): Promise<{ success: boolean; data?: SupportTicketMessage; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('add_support_ticket_message', {
      p_ticket_id: params.ticketId,
      p_message: params.message.trim(),
      p_attachment_url: params.attachmentUrl || null,
      p_is_internal_note: Boolean(params.isInternalNote),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicketMessage };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send message';
    return { success: false, error: msg };
  }
}

/**
 * User closes their own ticket.
 */
export async function closeOwnTicket(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('close_own_ticket', {
      p_ticket_id: ticketId,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to close ticket';
    return { success: false, error: msg };
  }
}

/**
 * Upload an attachment to private support-attachments bucket.
 */
export async function uploadSupportAttachment(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User session not found' };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Image file size exceeds the 5 MB limit' };
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('support-attachments')
      .upload(filePath, file, {
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Generate signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('support-attachments')
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);

    if (signedError || !signedData?.signedUrl) {
      return { success: true, url: filePath };
    }

    return { success: true, url: signedData.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to upload attachment';
    return { success: false, error: msg };
  }
}

// ==============================================================================
// STAFF / AUTHORIZED PERSONNEL FUNCTIONS
// ==============================================================================

/**
 * Staff: Fetch all tickets with optional filtering.
 */
export async function getAllTicketsForStaff(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}): Promise<{ success: boolean; data?: SupportTicket[]; error?: string }> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority && filters.priority !== 'All') {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.category && filters.category !== 'All') {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    let results = (data as SupportTicket[]) || [];
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      results = results.filter(
        (t) =>
          t.ticket_number.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.assigned_name && t.assigned_name.toLowerCase().includes(q))
      );
    }

    return { success: true, data: results };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tickets';
    return { success: false, error: msg };
  }
}

/**
 * Staff: Update ticket status, priority, assignment, or resolution notes.
 */
export async function updateTicketByStaff(params: {
  ticketId: string;
  status?: SupportStatus;
  priority?: SupportPriority;
  assignedTo?: string | null;
  resolutionNotes?: string;
  unassign?: boolean;
}): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('update_ticket_by_staff', {
      p_ticket_id: params.ticketId,
      p_status: params.status || null,
      p_priority: params.priority || null,
      p_assigned_to: params.assignedTo || null,
      p_resolution_notes: params.resolutionNotes || null,
      p_unassign: Boolean(params.unassign),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update ticket';
    return { success: false, error: msg };
  }
}
