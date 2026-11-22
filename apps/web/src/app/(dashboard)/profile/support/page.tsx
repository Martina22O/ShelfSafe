'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusCircle,
  Ticket,
  Clock,
  ArrowLeft,
  Send,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  User,
  Headphones,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  getMyTickets,
  getTicketDetails,
  getTicketMessages,
  createSupportTicket,
  sendTicketMessage,
  closeOwnTicket,
  uploadSupportAttachment,
  SupportTicket,
  SupportTicketMessage,
  SUPPORT_CATEGORIES,
  SupportCategory,
  SUPPORT_HOURS_INFO,
} from '../../../../lib/support';

export default function ProfileSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: 'tickets' | 'new' = searchParams.get('tab') === 'new' ? 'new' : 'tickets';

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Selected Ticket Detail & Thread State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const handleSwitchTab = useCallback(
    (tab: 'tickets' | 'new') => {
      setSelectedTicket(null);
      router.push(`/profile/support?tab=${tab}`, { scroll: false });
    },
    [router]
  );

  // New Ticket Form State
  const [category, setCategory] = useState<SupportCategory>('System Errors');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketError(null);
    const res = await getMyTickets();
    setLoadingTickets(false);
    if (res.success && res.data) {
      setTickets(res.data);
    } else {
      setTicketError(res.error || 'Failed to load tickets');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTickets]);

  const loadTicketThread = useCallback(async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    const [detailRes, msgRes] = await Promise.all([
      getTicketDetails(ticket.id),
      getTicketMessages(ticket.id),
    ]);
    setLoadingMessages(false);
    if (detailRes.success && detailRes.data) {
      setSelectedTicket(detailRes.data);
    }
    if (msgRes.success && msgRes.data) {
      setMessages(msgRes.data);
    }
  }, [setSelectedTicket]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();

    if (!trimmedSubject) {
      setSubmitError('Please provide a subject for your request.');
      return;
    }
    if (trimmedSubject.length < 3 || trimmedSubject.length > 150) {
      setSubmitError('Subject must be between 3 and 150 characters.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setSubmitError('Description must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) {
        const uploadRes = await uploadSupportAttachment(selectedFile);
        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
        } else if (uploadRes.error) {
          setSubmitError(`Attachment upload failed: ${uploadRes.error}`);
          setSubmitting(false);
          return;
        }
      }

      const res = await createSupportTicket({
        category,
        subject: trimmedSubject,
        description: trimmedDesc,
        attachmentUrl,
      });

      setSubmitting(false);

      if (res.success && res.data) {
        setSubmitSuccess(`Ticket ${res.data.ticket_number} created successfully.`);
        setSubject('');
        setDescription('');
        setSelectedFile(null);
        await loadTickets();
        // Switch to ticket detail
        await loadTicketThread(res.data);
      } else {
        setSubmitError(res.error || 'Failed to create support ticket');
      }
    } catch (err: unknown) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Unexpected error submitting ticket';
      setSubmitError(msg);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setSendingReply(true);

    try {
      let attachmentUrl: string | null = null;
      if (replyFile) {
        const uploadRes = await uploadSupportAttachment(replyFile);
        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
        }
      }

      const res = await sendTicketMessage({
        ticketId: selectedTicket.id,
        message: replyText.trim(),
        attachmentUrl,
      });

      setSendingReply(false);

      if (res.success) {
        setReplyText('');
        setReplyFile(null);
        await loadTicketThread(selectedTicket);
        await loadTickets();
        setTimeout(() => {
          threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      } else {
        alert(res.error || 'Failed to send reply');
      }
    } catch (err: unknown) {
      setSendingReply(false);
      const msg = err instanceof Error ? err.message : 'Error sending reply';
      alert(msg);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm('Are you sure you want to mark this ticket as closed?')) return;

    setClosingTicket(true);
    const res = await closeOwnTicket(selectedTicket.id);
    setClosingTicket(false);

    if (res.success) {
      await loadTicketThread(selectedTicket);
      await loadTickets();
    } else {
      alert(res.error || 'Failed to close ticket');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
      case 'In Progress':
        return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
      case 'Resolved':
        return 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]';
      case 'Closed':
        return 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl pb-16">
      {/* Top Header with Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ece3d2]/80">
        <div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7a7469] hover:text-[#207429] mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Profile &amp; Settings
          </Link>
          <h1 className="text-2xl font-black text-[#181413] tracking-tight">Help &amp; Support</h1>
          <p className="text-xs text-[#7a7469] mt-0.5">
            Submit technical questions, report system defects, and communicate directly with ShelfSafe support.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-[#fef9f0] p-1 rounded-xl border border-[#ece3d2] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleSwitchTab('tickets')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tickets' && !selectedTicket
                ? 'bg-white text-[#181413] shadow-2xs border border-[#ece3d2]'
                : 'text-[#7a7469] hover:text-[#181413]'
            }`}
          >
            <Ticket className="w-3.5 h-3.5 text-[#207429]" />
            My Tickets {tickets.length > 0 ? `(${tickets.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('new')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'new'
                ? 'bg-white text-[#181413] shadow-2xs border border-[#ece3d2]'
                : 'text-[#7a7469] hover:text-[#181413]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#207429]" />
            Submit a Request
          </button>
        </div>
      </div>

      {/* Support Availability Notice Card */}
      <div className="bg-[#FAF7EE] border border-[#EFE7DA] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#EFE7DA] flex items-center justify-center text-[#207429] shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wide text-[#181413]">
                Support Hours: {SUPPORT_HOURS_INFO.hours} ({SUPPORT_HOURS_INFO.timezone})
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E8F5E9] text-[#185E21] border border-[#C8E6C9]">
                {SUPPORT_HOURS_INFO.target}
              </span>
            </div>
            <p className="text-xs text-[#7a7469] mt-1 leading-relaxed">
              {SUPPORT_HOURS_INFO.disclaimer}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] text-[#7a7469] shrink-0 self-end md:self-center">
          <Link href="/help" className="underline font-semibold hover:text-[#207429]">
            Looking for self-service FAQs &amp; User Guides?
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedTicket && activeTab === 'tickets' ? (
        /* ================= TICKET DETAIL & CONVERSATION VIEW ================= */
        <div className="space-y-5">
          <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#ece3d2]/80">
              <div>
                <button
                  type="button"
                  onClick={() => handleSwitchTab('tickets')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#7a7469] hover:text-[#207429] mb-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Tickets List
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-[#181413] tracking-tight">
                    {selectedTicket.ticket_number} — {selectedTicket.subject}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${getStatusBadge(
                      selectedTicket.status
                    )}`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              {selectedTicket.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={closingTicket}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#ece3d2] text-xs font-bold text-[#7a7469] hover:text-[#181413] hover:bg-[#faf8f5] transition-colors self-start sm:self-auto disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {closingTicket ? 'Closing...' : 'Close Ticket'}
                </button>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-b border-[#ece3d2]/60 text-xs">
              <div>
                <span className="text-[#7a7469] block mb-0.5">Category</span>
                <span className="font-bold text-[#181413]">{selectedTicket.category}</span>
              </div>
              <div>
                <span className="text-[#7a7469] block mb-0.5">Priority</span>
                <span className="font-bold text-[#181413]">{selectedTicket.priority}</span>
              </div>
              <div>
                <span className="text-[#7a7469] block mb-0.5">Assigned Agent</span>
                <span className="font-bold text-[#181413]">
                  {selectedTicket.assigned_name || 'Support Queue'}
                </span>
              </div>
              <div>
                <span className="text-[#7a7469] block mb-0.5">Submitted On</span>
                <span className="font-bold text-[#181413]">
                  {new Date(selectedTicket.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Original Problem Description */}
            <div className="pt-4 space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wide text-[#7a7469] block">
                Issue Description
              </span>
              <p className="text-xs sm:text-sm text-[#181413] whitespace-pre-line leading-relaxed">
                {selectedTicket.description}
              </p>

              {selectedTicket.attachment_url && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-[#7a7469] block mb-1">
                    Attached Screenshot:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewImageUrl(selectedTicket.attachment_url)}
                    className="border border-[#ece3d2] rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={selectedTicket.attachment_url}
                      alt="Ticket Attachment"
                      className="max-h-40 object-cover rounded-xl"
                    />
                  </button>
                </div>
              )}

              {selectedTicket.resolution_notes && (
                <div className="mt-4 p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534]">
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                    Resolution Summary:
                  </div>
                  <p className="text-xs leading-relaxed">{selectedTicket.resolution_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#181413]">
              Responses &amp; Follow-up Thread
            </h3>

            {loadingMessages ? (
              <div className="py-8 text-center text-xs text-[#7a7469]">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center bg-[#faf8f5] rounded-xl border border-[#ece3d2] p-4 text-xs text-[#7a7469]">
                <Clock className="w-5 h-5 mx-auto mb-2 text-[#7a7469]" />
                Our technical support personnel will review your ticket and reply within one business day.
              </div>
            ) : (
              <div className="space-y-3.5">
                {messages.map((msg) => {
                  const isUser = msg.sender_role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-2xl border ${
                        isUser
                          ? 'bg-[#FEF9F0] border-[#ECE3D2] ml-0 sm:ml-8'
                          : 'bg-[#F0FDF4] border-[#DCFCE7] mr-0 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#181413]">
                          {isUser ? (
                            <User className="w-3.5 h-3.5 text-[#7a7469]" />
                          ) : (
                            <Headphones className="w-3.5 h-3.5 text-[#207429]" />
                          )}
                          <span className={!isUser ? 'text-[#207429]' : ''}>
                            {isUser ? 'You' : msg.sender_name || 'ShelfSafe Support Team'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#7a7469]">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#181413] whitespace-pre-line leading-relaxed">
                        {msg.message}
                      </p>
                      {msg.attachment_url && (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(msg.attachment_url)}
                            className="border border-[#ece3d2] rounded-lg overflow-hidden"
                          >
                            <img
                              src={msg.attachment_url}
                              alt="Message Attachment"
                              className="max-h-32 object-cover rounded-lg"
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>
            )}

            {/* Reply Input Form */}
            {selectedTicket.status !== 'Closed' ? (
              <form onSubmit={handleSendReply} className="pt-4 border-t border-[#ece3d2]/80 space-y-3">
                <label htmlFor="reply-input" className="block text-xs font-bold uppercase tracking-wide text-[#524c40]">
                  Send a Follow-up Message
                </label>
                <textarea
                  id="reply-input"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Provide additional details or respond to support personnel..."
                  disabled={sendingReply}
                  className="w-full p-3 text-xs sm:text-sm bg-[#faf8f5] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all resize-y"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ece3d2] bg-white text-xs font-semibold text-[#7a7469] hover:text-[#181413] hover:bg-[#faf8f5] transition-colors">
                      <Upload className="w-3.5 h-3.5 text-[#207429]" />
                      <span>{replyFile ? replyFile.name : 'Attach Image (max 5MB)'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {replyFile && (
                      <button
                        type="button"
                        onClick={() => setReplyFile(null)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!replyText.trim() || sendingReply}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] shadow-2xs transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingReply ? 'Sending...' : 'Send Follow-up'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-[#faf8f5] border border-[#ece3d2] rounded-xl text-center text-xs text-[#7a7469]">
                This ticket is closed. If you have an additional concern, please submit a new request.
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'new' ? (
        /* ================= SUBMIT NEW REQUEST FORM ================= */
        <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 sm:p-7 shadow-2xs">
          <h2 className="text-base font-extrabold uppercase tracking-wide text-[#181413] mb-1">
            Submit a Technical Support Request
          </h2>
          <p className="text-xs text-[#7a7469] mb-6">
            Our support engineers investigate defect reports, inventory questions, and billing concerns.
          </p>

          {submitSuccess && (
            <div className="mb-4 p-3 bg-[#f4ffe1] border border-[#207429]/30 text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label htmlFor="ticket-category" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1.5">
                Issue Category
              </label>
              <select
                id="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                disabled={submitting}
                className="w-full h-10 px-3 text-xs sm:text-sm font-semibold bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ticket-subject" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1.5">
                Subject (3–150 characters)
              </label>
              <input
                id="ticket-subject"
                type="text"
                placeholder="Brief summary of the issue..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                disabled={submitting}
                className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
              />
            </div>

            <div>
              <label htmlFor="ticket-desc" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1.5">
                Detailed Issue Description (minimum 10 characters)
              </label>
              <textarea
                id="ticket-desc"
                rows={5}
                placeholder="Please describe what happened, including any steps to reproduce, product names, or error messages..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                className="w-full p-3.5 text-xs sm:text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1.5">
                Optional Screenshot or Attachment (PNG, JPG, WebP, max 5MB)
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ece3d2] bg-[#faf8f5] text-xs font-bold text-[#181413] hover:bg-[#fef9f0] transition-colors">
                  <Upload className="w-4 h-4 text-[#207429]" />
                  <span>{selectedFile ? selectedFile.name : 'Choose File'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Remove File
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#ece3d2]/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleSwitchTab('tickets')}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#7a7469] hover:text-[#181413]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] shadow-2xs transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Submitting Request...' : 'Submit Support Request'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ================= TICKETS LIST VIEW ================= */
        <div className="bg-white border border-[#ece3d2] rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#ece3d2]/80 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#181413]">
              Your Support Requests
            </h2>
            <button
              type="button"
              onClick={loadTickets}
              disabled={loadingTickets}
              className="text-xs font-bold text-[#207429] hover:underline"
            >
              {loadingTickets ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>

          {loadingTickets ? (
            <div className="py-12 text-center text-xs text-[#7a7469]">Loading your tickets...</div>
          ) : ticketError ? (
            <div className="p-6 sm:p-8 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#181413]">Unable to load support requests</h3>
              <p className="text-xs text-[#7a7469] leading-relaxed">
                We encountered an issue connecting to the support service. Please check your connection and try again.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={loadTickets}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] shadow-2xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
              <details className="text-[11px] text-[#7a7469] bg-[#faf8f5] border border-[#ece3d2] rounded-lg p-2.5 text-left mt-3">
                <summary className="cursor-pointer font-semibold text-[#524c40] hover:text-[#181413]">
                  Technical Diagnostics
                </summary>
                <pre className="mt-1.5 text-[10px] text-red-700 whitespace-pre-wrap break-all font-mono">
                  {ticketError}
                </pre>
              </details>
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#fef9f0] border border-[#ece3d2] text-[#207429] flex items-center justify-center mx-auto">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#181413]">No support requests yet</h3>
              <p className="text-xs text-[#7a7469] leading-relaxed">
                You haven&apos;t submitted any support requests. Need assistance? Submit a request and our support team will help you.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('new')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] shadow-2xs transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Submit a Request
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#ece3d2]/60">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => loadTicketThread(t)}
                  className="p-4 sm:p-5 hover:bg-[#faf8f5] transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-extrabold text-xs text-[#207429]">{t.ticket_number}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF8F5] border border-[#ece3d2] text-[#7a7469]">
                        {t.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getStatusBadge(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#181413] truncate">{t.subject}</h3>
                    <p className="text-xs text-[#7a7469] truncate mt-0.5">{t.description}</p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-[#7a7469]">
                      <span>Priority: <strong className="text-[#181413]">{t.priority}</strong></span>
                      <span>•</span>
                      <span>
                        Created: {new Date(t.created_at).toLocaleDateString()}
                      </span>
                      {t.assigned_name && (
                        <>
                          <span>•</span>
                          <span>Assigned: {t.assigned_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#7a7469] shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for viewing image preview */}
      {previewImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white p-1 hover:opacity-80"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
