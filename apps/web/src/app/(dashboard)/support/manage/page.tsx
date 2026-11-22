'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Search,
  ShieldAlert,
  User,
  Headphones,
  Lock,
  Send,
  X,
} from 'lucide-react';
import {
  isCurrentUserSupportStaff,
  getAllTicketsForStaff,
  getTicketDetails,
  getTicketMessages,
  sendTicketMessage,
  updateTicketByStaff,
  SupportTicket,
  SupportTicketMessage,
  SupportStatus,
  SupportPriority,
  SUPPORT_CATEGORIES,
} from '../../../../lib/support';

export default function StaffSupportManagementPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Selected ticket management state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Status/Priority update state
  const [newStatus, setNewStatus] = useState<SupportStatus>('Open');
  const [newPriority, setNewPriority] = useState<SupportPriority>('Medium');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Check staff authorization on mount
  useEffect(() => {
    async function checkRole() {
      const allowed = await isCurrentUserSupportStaff();
      setIsStaff(allowed);
      setCheckingAuth(false);
    }
    checkRole();
  }, []);

  const loadTickets = useCallback(async () => {
    if (!isStaff) return;
    setLoadingTickets(true);
    const res = await getAllTicketsForStaff({
      status: statusFilter,
      priority: priorityFilter,
      category: categoryFilter,
      search: searchQuery,
    });
    setLoadingTickets(false);
    if (res.success && res.data) {
      setTickets(res.data);
    }
  }, [isStaff, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (isStaff) {
      const timer = setTimeout(() => {
        loadTickets();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isStaff, loadTickets]);

  const loadTicketDetail = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setNewPriority(ticket.priority);
    setResolutionNotes(ticket.resolution_notes || '');

    setLoadingMessages(true);
    const [detailRes, msgRes] = await Promise.all([
      getTicketDetails(ticket.id),
      getTicketMessages(ticket.id),
    ]);
    setLoadingMessages(false);

    if (detailRes.success && detailRes.data) {
      setSelectedTicket(detailRes.data);
      setNewStatus(detailRes.data.status);
      setNewPriority(detailRes.data.priority);
      setResolutionNotes(detailRes.data.resolution_notes || '');
    }
    if (msgRes.success && msgRes.data) {
      setMessages(msgRes.data);
    }
  };

  const handleUpdateTicketProperties = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSavingStatus(true);

    const res = await updateTicketByStaff({
      ticketId: selectedTicket.id,
      status: newStatus,
      priority: newPriority,
      resolutionNotes: resolutionNotes.trim() || undefined,
    });

    setSavingStatus(false);

    if (res.success && res.data) {
      setSelectedTicket(res.data);
      await loadTickets();
      alert('Ticket updated successfully');
    } else {
      alert(res.error || 'Failed to update ticket');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setSendingReply(true);
    const res = await sendTicketMessage({
      ticketId: selectedTicket.id,
      message: replyText.trim(),
      isInternalNote,
    });

    setSendingReply(false);

    if (res.success) {
      setReplyText('');
      setIsInternalNote(false);
      const msgRes = await getTicketMessages(selectedTicket.id);
      if (msgRes.success && msgRes.data) {
        setMessages(msgRes.data);
      }
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } else {
      alert(res.error || 'Failed to send reply');
    }
  };

  if (checkingAuth) {
    return (
      <div className="py-24 text-center text-xs text-[#7a7469]">
        <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Verifying staff authorization...
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-[#ece3d2] rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-base font-extrabold text-[#181413]">Access Restricted</h2>
        <p className="text-xs text-[#7a7469] leading-relaxed">
          The Support Management Desk is accessible only to authorized ShelfSafe technical support personnel and administrators.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const openCount = tickets.filter((t) => t.status === 'Open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'In Progress').length;
  const criticalCount = tickets.filter((t) => t.priority === 'Critical' || t.priority === 'High').length;

  return (
    <div className="space-y-6 w-full max-w-7xl pb-16">
      {/* Staff Management Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
              Authorized Staff Interface
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#181413] tracking-tight">
            Support Desk &amp; Defect Management
          </h1>
          <p className="text-xs text-[#7a7469] mt-0.5">
            Manage submitted customer tickets, assign support agents, classify issue severities, and record resolutions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTickets}
          disabled={loadingTickets}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#ece3d2] text-xs font-bold text-[#181413] hover:bg-[#faf8f5] shadow-2xs self-start sm:self-auto"
        >
          {loadingTickets ? 'Refreshing...' : 'Refresh Desk'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#ece3d2] rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#7a7469]">Total Tickets</span>
          <p className="text-xl font-black text-[#181413] mt-0.5">{tickets.length}</p>
        </div>
        <div className="bg-white border border-[#ece3d2] rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#B45309]">Open Requests</span>
          <p className="text-xl font-black text-[#B45309] mt-0.5">{openCount}</p>
        </div>
        <div className="bg-white border border-[#ece3d2] rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#0369A1]">In Progress</span>
          <p className="text-xl font-black text-[#0369A1] mt-0.5">{inProgressCount}</p>
        </div>
        <div className="bg-white border border-[#ece3d2] rounded-xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#DC2626]">Critical / High</span>
          <p className="text-xl font-black text-[#DC2626] mt-0.5">{criticalCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#7a7469] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ticket #, subject, or assigned agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-[#faf8f5] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 text-xs font-semibold bg-white border border-[#ece3d2] rounded-xl text-[#181413]"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 px-3 text-xs font-semibold bg-white border border-[#ece3d2] rounded-xl text-[#181413]"
        >
          <option value="All">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 text-xs font-semibold bg-white border border-[#ece3d2] rounded-xl text-[#181413] max-w-[180px]"
        >
          <option value="All">All Categories</option>
          {SUPPORT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Main Staff Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Ticket List Column (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#ece3d2] rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-[#ece3d2]/80 bg-[#faf8f5] flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#181413]">
              Queue ({tickets.length})
            </span>
          </div>

          <div className="divide-y divide-[#ece3d2]/60 max-h-[700px] overflow-y-auto">
            {loadingTickets ? (
              <div className="py-12 text-center text-xs text-[#7a7469]">Loading queue...</div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#7a7469]">No tickets match filters</div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetail(t)}
                    className={`p-3.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#f4ffe1] border-l-4 border-l-[#207429]' : 'hover:bg-[#faf8f5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-extrabold text-xs text-[#207429]">{t.ticket_number}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.priority === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : t.priority === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FAF8F5] border border-[#ece3d2] text-[#7a7469]">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-[#181413] truncate">{t.subject}</h4>
                    <p className="text-[11px] text-[#7a7469] truncate mt-0.5">{t.description}</p>

                    <div className="flex items-center justify-between mt-2 text-[10px] text-[#7a7469]">
                      <span>{t.category}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Ticket Action Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {selectedTicket ? (
            <>
              {/* Management & Status Control Card */}
              <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#ece3d2]/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#207429]">{selectedTicket.ticket_number}</span>
                      <span className="text-xs text-[#7a7469]">Submitted by owner: {selectedTicket.owner_id.slice(0, 8)}...</span>
                    </div>
                    <h3 className="text-base font-black text-[#181413] mt-0.5">{selectedTicket.subject}</h3>
                  </div>

                  <span className="text-xs text-[#7a7469]">
                    Created: {new Date(selectedTicket.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Problem Description */}
                <div className="bg-[#FAF8F5] border border-[#ece3d2] rounded-xl p-3.5 space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#7a7469] block">
                    Reported Issue Description
                  </span>
                  <p className="text-xs text-[#181413] whitespace-pre-line leading-relaxed">
                    {selectedTicket.description}
                  </p>
                  {selectedTicket.attachment_url && (
                    <div className="mt-2 pt-2 border-t border-[#ece3d2]/60">
                      <span className="text-[11px] font-semibold text-[#7a7469] block mb-1">
                        Screenshot Attachment:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(selectedTicket.attachment_url)}
                        className="border border-[#ece3d2] rounded-lg overflow-hidden"
                      >
                        <img
                          src={selectedTicket.attachment_url}
                          alt="Ticket Attachment"
                          className="max-h-28 object-cover rounded-lg"
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Staff Control Form (Status, Priority, Resolution) */}
                <form onSubmit={handleUpdateTicketProperties} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#524c40] mb-1">
                        Ticket Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as SupportStatus)}
                        className="w-full h-9 px-3 text-xs font-bold bg-white border border-[#ece3d2] rounded-xl text-[#181413]"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#524c40] mb-1">
                        Severity / Priority
                      </label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as SupportPriority)}
                        className="w-full h-9 px-3 text-xs font-bold bg-white border border-[#ece3d2] rounded-xl text-[#181413]"
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-[#524c40] mb-1">
                      Resolution Actions &amp; Troubleshooting Notes (Section 3.5.2)
                    </label>
                    <textarea
                      rows={2}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Document root-cause analysis, corrective actions taken, or instructions provided..."
                      className="w-full p-2.5 text-xs bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingStatus}
                      className="px-4 py-2 bg-[#181413] text-white text-xs font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                    >
                      {savingStatus ? 'Saving Changes...' : 'Save Ticket Status & Notes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Message Thread with Internal Notes */}
              <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#ece3d2]/80">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#181413]">
                    Communication Thread &amp; Internal Notes
                  </h4>
                  <span className="text-[11px] text-[#7a7469] flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#B45309]" /> Internal notes visible only to staff
                  </span>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {loadingMessages ? (
                    <div className="py-8 text-center text-xs text-[#7a7469]">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#7a7469]">No responses recorded yet</div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border text-xs ${
                          m.is_internal_note
                            ? 'bg-[#FEF9C3] border-[#FDE047] text-[#854D0E]'
                            : m.sender_role === 'user'
                            ? 'bg-[#FAF8F5] border-[#ECE3D2] text-[#181413]'
                            : 'bg-[#F0FDF4] border-[#DCFCE7] text-[#166534]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold flex items-center gap-1.5">
                            {m.is_internal_note ? (
                              <>
                                <Lock className="w-3 h-3 text-[#B45309]" />
                                Internal Staff Note ({m.sender_name || 'Staff'})
                              </>
                            ) : m.sender_role === 'user' ? (
                              <>
                                <User className="w-3 h-3 text-[#7a7469]" />
                                Customer ({m.sender_name || 'User'})
                              </>
                            ) : (
                              <>
                                <Headphones className="w-3 h-3 text-[#207429]" />
                                Staff Public Reply ({m.sender_name || 'Support'})
                              </>
                            )}
                          </span>
                          <span className="text-[10px] opacity-75">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-line leading-relaxed">{m.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="pt-3 border-t border-[#ece3d2]/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#181413] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-[#ece3d2] text-[#207429] focus:ring-[#207429]"
                      />
                      <span>Make Internal Staff Note (Invisible to customer)</span>
                    </label>
                  </div>

                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isInternalNote
                        ? 'Type private notes, root-cause findings, or dev escalation info...'
                        : 'Type public reply to deliver to customer...'
                    }
                    className={`w-full p-3 text-xs rounded-xl border focus:outline-none focus:ring-2 ${
                      isInternalNote
                        ? 'bg-[#FEFCE8] border-[#FDE047] text-[#854D0E] focus:ring-amber-500'
                        : 'bg-white border-[#ece3d2] text-[#181413] focus:ring-[#207429]'
                    }`}
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sendingReply}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white shadow-2xs transition-colors disabled:opacity-50 ${
                        isInternalNote ? 'bg-[#B45309] hover:bg-[#92400E]' : 'bg-[#207429] hover:bg-[#185e21]'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingReply
                        ? 'Sending...'
                        : isInternalNote
                        ? 'Post Internal Note'
                        : 'Send Reply to Customer'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-12 text-center text-xs text-[#7a7469] shadow-2xs">
              <LifeBuoy className="w-10 h-10 mx-auto text-[#7a7469]/50 mb-2" />
              <p className="font-bold text-[#181413] text-sm">No Ticket Selected</p>
              <p className="mt-1">Select a ticket from the queue on the left to inspect and manage.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white p-1 hover:opacity-80"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
