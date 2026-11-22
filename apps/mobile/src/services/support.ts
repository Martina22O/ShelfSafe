/**
 * Service: support.ts (Mobile)
 * Manages ShelfSafe Help & Support ticket creation, communication threads,
 * status tracking, and screenshot attachment uploads for mobile users.
 */
import { supabase } from './supabase';

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
 * Fetch all tickets submitted by the authenticated user.
 */
export async function getMyTickets(): Promise<{ success: boolean; data?: SupportTicket[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: (data as SupportTicket[]) || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch tickets' };
  }
}

/**
 * Fetch a single ticket's details by ID.
 */
export async function getTicketDetails(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch ticket details' };
  }
}

/**
 * Fetch messages/replies for a specific ticket.
 */
export async function getTicketMessages(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicketMessage[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: (data as SupportTicketMessage[]) || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch messages' };
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
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit support request' };
  }
}

/**
 * Send a follow-up reply message on an existing ticket.
 */
export async function sendTicketMessage(params: {
  ticketId: string;
  message: string;
  attachmentUrl?: string | null;
}): Promise<{ success: boolean; data?: SupportTicketMessage; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('add_support_ticket_message', {
      p_ticket_id: params.ticketId,
      p_message: params.message.trim(),
      p_attachment_url: params.attachmentUrl || null,
      p_is_internal_note: false,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicketMessage };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send message' };
  }
}

/**
 * User closes their own ticket.
 */
export async function closeOwnTicket(
  ticketId: string
): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('close_own_ticket', {
      p_ticket_id: ticketId,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: data as SupportTicket };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to close ticket' };
  }
}

/**
 * Upload an optional screenshot or photo to private support-attachments bucket.
 */
export async function uploadSupportAttachment(
  fileUri: string,
  fileName?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User session not found' };
    }

    const ext = fileName?.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Handle data URI (base64) or remote file URI
    let bodyData: any;
    if (fileUri.startsWith('data:')) {
      const base64Data = fileUri.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      bodyData = bytes.buffer;
    } else {
      const response = await fetch(fileUri);
      bodyData = await response.blob();
    }

    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('support-attachments')
      .upload(filePath, bodyData, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Since support-attachments is private, create a signed URL with 30-day validity
    const { data: signedData, error: signedError } = await supabase.storage
      .from('support-attachments')
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);

    if (signedError || !signedData?.signedUrl) {
      return { success: true, url: filePath };
    }

    return { success: true, url: signedData.signedUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload attachment' };
  }
}
