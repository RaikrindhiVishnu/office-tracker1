"use client";

/**
 * AdminQueriesView.tsx — Refined Helpdesk UI
 * - Light font weights throughout
 * - Delete option on rows + drawer
 * - Wider drawer (680px)
 * - Cleaner, more polished aesthetics
 * - All Firebase logic preserved
 */

import { useState, useEffect, useRef } from "react";
import {
  Search, ChevronLeft, ChevronRight,
  X, Send, RotateCcw, CheckCircle2, MessageSquare, Trash2,
} from "lucide-react";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reply {
  author: string;
  text: string;
  time: number;
  assignedTo?: string;
}

interface EmployeeQuery {
  id: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  adminUnread: boolean;
  employeeUnread: boolean;
  createdAt: { seconds: number; nanoseconds: number } | string | number | null;
  replies?: Reply[];
  adminReply?: string;
  repliedAt?: { seconds: number; nanoseconds: number } | null;
  assignedTo?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  low: { label: "Low", bg: "#f0fdf4", color: "#16a34a", dot: "#4ade80" },
  medium: { label: "Medium", bg: "#fffbeb", color: "#d97706", dot: "#fbbf24" },
  high: { label: "High", bg: "#fff1f2", color: "#e11d48", dot: "#fb7185" },
  urgent: { label: "Urgent", bg: "#faf5ff", color: "#9333ea", dot: "#c084fc" },
};

const CATEGORY_CONFIG: Record<string, { bg: string; color: string }> = {
  "IT Support": { bg: "#eff6ff", color: "#2563eb" },
  "Payroll": { bg: "#f0fdf4", color: "#16a34a" },
  "HR Policy": { bg: "#faf5ff", color: "#9333ea" },
  "Software": { bg: "#fff7ed", color: "#ea580c" },
  "Facilities": { bg: "#f0f9ff", color: "#0284c7" },
  "Finance": { bg: "#fefce8", color: "#ca8a04" },
  "General": { bg: "#f8fafc", color: "#64748b" },
};

const ADMIN_AGENTS = [
  "Unassigned",
  "Admin — madhuri.",
  "Admin — phani.",
  "Project manager — pradeep.",
  "IT — team leads.",
];

const PAGE_SIZES = [10, 20, 50];

const AVATAR_PALETTE = [
  { bg: "#e0e7ff", color: "#4338ca" },
  { bg: "#fce7f3", color: "#be185d" },
  { bg: "#d1fae5", color: "#065f46" },
  { bg: "#fef3c7", color: "#92400e" },
  { bg: "#ede9fe", color: "#6d28d9" },
  { bg: "#dbeafe", color: "#1d4ed8" },
  { bg: "#fee2e2", color: "#b91c1c" },
  { bg: "#ccfbf1", color: "#0f766e" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarStyle(name: string) {
  const idx = ((name ?? "").charCodeAt(0) || 65) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function getInitials(name: string): string {
  return (name ?? "").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(ts: EmployeeQuery["createdAt"] | number): string {
  if (ts === null || ts === undefined) return "—";
  let d: Date;
  if (typeof ts === "object" && "seconds" in ts) d = new Date(ts.seconds * 1000);
  else if (typeof ts === "string") d = new Date(ts);
  else d = new Date(ts as number);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { bg, color } = getAvatarStyle(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 600,
      flexShrink: 0, letterSpacing: "0px",
    }}>
      {getInitials(name) || "?"}
    </div>
  );
}

function Badge({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: "3px 9px", borderRadius: 100,
      background: bg, color, whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "resolved"
    ? <Badge label="Resolved" bg="#f0fdf4" color="#16a34a" dot="#4ade80" />
    : <Badge label="Pending" bg="#fffbeb" color="#d97706" dot="#fbbf24" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminQueriesView() {
  const [queries, setQueries] = useState<EmployeeQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawer, setDrawer] = useState<EmployeeQuery | null>(null);
  const [replyText, setReplyText] = useState("");
  const [assignTo, setAssignTo] = useState("Unassigned");
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "employeeQueries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: EmployeeQuery[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<EmployeeQuery, "id">),
        }));
        setQueries(data);
        setLoading(false);
        setDrawer((prev) => prev ? (data.find((x) => x.id === prev.id) ?? prev) : null);
      },
      (err) => {
        console.error(err);
        setError("Failed to load queries. Check Firestore rules.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [drawer?.replies?.length]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openDrawer = async (item: EmployeeQuery) => {
    setDrawer(item);
    setReplyText("");
    setDeleteConfirm(null);
    setAssignTo(item.assignedTo || "Unassigned");
    if (item.adminUnread) {
      await updateDoc(doc(db, "employeeQueries", item.id), { adminUnread: false }).catch(console.error);
    }
  };

  const closeDrawer = () => { setDrawer(null); setReplyText(""); setDeleteConfirm(null); };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    try {
      await deleteDoc(doc(db, "employeeQueries", id));
      if (drawer?.id === id) closeDrawer();
      setDeleteConfirm(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete query.");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !drawer || sending) return;
    setSending(true);
    try {
      const newReply: Reply = { author: "Admin", text: replyText.trim(), time: Date.now(), assignedTo: assignTo };
      const updatedReplies = [...(drawer.replies ?? []), newReply];
      await updateDoc(doc(db, "employeeQueries", drawer.id), {
        replies: updatedReplies,
        adminReply: replyText.trim(),
        status: "resolved",
        adminUnread: false,
        employeeUnread: true,
        repliedAt: serverTimestamp(),
        assignedTo: assignTo || null,
      });
      setReplyText("");
    } catch (e) {
      console.error(e);
      alert("Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  const handleChangePriority = async (priority: string) => {
    if (!drawer) return;
    await updateDoc(doc(db, "employeeQueries", drawer.id), { priority }).catch(console.error);
  };

  const handleReopen = async () => {
    if (!drawer) return;
    await updateDoc(doc(db, "employeeQueries", drawer.id), { status: "pending" }).catch(console.error);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const total = queries.length;
  const pending = queries.filter((q) => q.status !== "resolved").length;
  const resolved = queries.filter((q) => q.status === "resolved").length;
  const unread = queries.filter((q) => q.adminUnread).length;
  const categories = Array.from(new Set(queries.map((q) => q.category).filter(Boolean)));

  const filtered = queries.filter((q) => {
    if (statusFilter === "pending" && q.status === "resolved") return false;
    if (statusFilter === "resolved" && q.status !== "resolved") return false;
    if (priorityFilter !== "all" && q.priority !== priorityFilter) return false;
    if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
    const s = search.toLowerCase();
    if (s && ![q.employeeName, q.subject, q.message, q.department, q.employeeEmail]
      .some((f) => (f || "").toLowerCase().includes(s))) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const resetPage = () => setPage(1);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        .q-wrap *, .q-wrap *::before, .q-wrap *::after {
          box-sizing: border-box;
        }

        .q-wrap {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          width: 100%;
          color: #1a202c;
          padding: 0;
        }

        /* ── TITLE ROW ── */
        .q-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .q-title {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
          letter-spacing: -0.2px;
          line-height: 1;
        }
        .q-counts {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .q-chip {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        /* ── FILTER ROW ── */
        .q-filters {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0px;
        }
        .q-search-wrap {
          position: relative;
          flex: 1;
          min-width: 160px;
          max-width: 260px;
        }
        .q-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #a0aec0;
          pointer-events: none;
        }
        .q-search {
          width: 100%;
          padding: 8px 12px 8px 33px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: #2d3748;
          background: #fff;
          outline: none;
          transition: border-color 0.13s;
        }
        .q-search:focus { border-color: #3182ce; }
        .q-search::placeholder { color: #a0aec0; }

        /* Status pill buttons — exactly like screenshot */
        .q-tabs {
          display: flex;
          gap: 4px;
        }
        .q-tab {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid #e2e8f0;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          color: #718096;
          background: #fff;
          transition: all 0.13s;
          white-space: nowrap;
        }
        .q-tab.on {
          background: #2d3748;
          color: #fff;
          border-color: #2d3748;
          font-weight: 500;
        }
        .q-tab:not(.on):hover { border-color: #cbd5e0; color: #4a5568; }

        .q-sel {
          padding: 7px 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: #4a5568;
          background: #fff;
          outline: none;
          cursor: pointer;
          transition: border-color 0.13s;
        }
        .q-sel:focus { border-color: #3182ce; }

        /* ── TABLE CARD ── */
        .q-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 16px;
        }
        .q-tscroll { overflow-x: auto; }
        .q-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 780px;
        }
        .q-thead { background: #fff; border-bottom: 1.5px solid #edf2f7; }
        .q-th {
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #a0aec0;
          text-align: left;
          white-space: nowrap;
          letter-spacing: 0px;
        }
        .q-th:first-child { padding-left: 20px; }

        .q-tr {
          border-bottom: 1px solid #f7fafc;
          cursor: pointer;
          transition: background 0.1s;
        }
        .q-tr:last-child { border-bottom: none; }
        .q-tr:hover { background: #f7fafc; }
        .q-tr.unread { border-left: 3px solid #4299e1; background: #ebf8ff; }
        .q-tr.active { background: #ebf8ff; }

        .q-td {
          padding: 14px 16px;
          vertical-align: middle;
        }
        .q-td:first-child { padding-left: 20px; }

        .q-emp-cell { display: flex; align-items: center; gap: 10px; }
        .q-emp-name {
          font-size: 13.5px;
          font-weight: 500;
          color: #2d3748;
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1.3;
        }
        .q-emp-dept {
          font-size: 12px;
          font-weight: 400;
          color: #a0aec0;
          margin-top: 1px;
        }
        .q-unread-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4299e1;
          flex-shrink: 0;
        }
        .q-subj {
          font-size: 13.5px;
          font-weight: 500;
          color: #2d3748;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }
        .q-preview {
          font-size: 12px;
          font-weight: 400;
          color: #a0aec0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
          margin-top: 2px;
        }
        .q-reply-count {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          font-weight: 400;
          color: #a0aec0;
        }
        .q-time-txt {
          font-size: 13px;
          font-weight: 400;
          color: #a0aec0;
          white-space: nowrap;
        }
        .q-assigned-txt {
          font-size: 13px;
          font-weight: 400;
          color: #4a5568;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        /* Delete button in table row */
        .q-del-btn {
          width: 28px; height: 28px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #cbd5e0;
          transition: all 0.13s;
          flex-shrink: 0;
        }
        .q-del-btn:hover { color: #e53e3e; border-color: #fed7d7; background: #fff5f5; }
        .q-del-btn.confirm { color: #e53e3e; border-color: #fc8181; background: #fff5f5; }

        /* ── EMPTY / LOADING ── */
        .q-empty {
          text-align: center;
          padding: 60px 20px;
          color: #a0aec0;
        }
        .q-empty-title {
          font-size: 14px;
          font-weight: 500;
          color: #718096;
          margin-bottom: 5px;
        }
        .q-empty-sub { font-size: 13px; font-weight: 400; color: #a0aec0; }
        .q-spinner {
          width: 26px; height: 26px;
          border: 2px solid #e2e8f0;
          border-top-color: #4299e1;
          border-radius: 50%;
          animation: qspin 0.8s linear infinite;
          margin: 60px auto;
        }
        @keyframes qspin { to { transform: rotate(360deg); } }

        /* ── PAGINATION ── */
        .q-pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-top: 1px solid #edf2f7;
          flex-wrap: wrap;
          gap: 10px;
        }
        .q-pager-info {
          font-size: 13px;
          font-weight: 400;
          color: #a0aec0;
        }
        .q-pager-right { display: flex; align-items: center; gap: 6px; }
        .q-pager-sel {
          font-size: 13px;
          padding: 5px 8px;
          border: 1.5px solid #e2e8f0;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: #4a5568;
          background: #fff;
          outline: none;
          cursor: pointer;
        }
        .q-pager-num {
          font-size: 13px;
          font-weight: 400;
          color: #718096;
          padding: 0 8px;
        }
        .q-pager-btn {
          width: 30px; height: 30px;
          border-radius: 6px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #a0aec0;
          transition: all 0.12s;
        }
        .q-pager-btn:hover:not(:disabled) { border-color: #4299e1; color: #4299e1; }
        .q-pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── DRAWER OVERLAY ── */
        .q-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.18);
          z-index: 9998;
          animation: qfade 0.16s ease;
        }
        @keyframes qfade { from { opacity: 0; } to { opacity: 1; } }

        /* ── DRAWER ── */
        .q-drawer {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: min(680px, 96vw);
          background: #fff;
          box-shadow: -4px 0 24px rgba(0,0,0,0.08);
          display: flex; flex-direction: column;
          z-index: 9999;
          animation: qdraw 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          overflow: hidden;
        }
        @keyframes qdraw { from { transform: translateX(100%); } to { transform: translateX(0); } }

        /* Drawer header */
        .q-dhead {
          padding: 20px 22px 16px;
          border-bottom: 1px solid #edf2f7;
          flex-shrink: 0;
        }
        .q-dhead-top {
          display: flex; align-items: flex-start; gap: 12px;
          margin-bottom: 10px;
        }
        .q-dhead-meta { flex: 1; min-width: 0; }
        .q-dhead-subj {
          font-size: 15px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 3px;
          line-height: 1.3;
        }
        .q-dhead-info {
          font-size: 12.5px;
          font-weight: 400;
          color: #a0aec0;
          line-height: 1.5;
        }
        .q-dhead-info strong { font-weight: 500; color: #718096; }
        .q-dhead-badges {
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
        }
        .q-dclose {
          width: 30px; height: 30px;
          border-radius: 6px;
          border: 1.5px solid #e2e8f0;
          background: transparent;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #a0aec0; flex-shrink: 0;
          transition: all 0.12s;
        }
        .q-dclose:hover { border-color: #cbd5e0; color: #718096; }

        /* Delete in drawer header */
        .q-ddel-btn {
          width: 30px; height: 30px;
          border-radius: 6px;
          border: 1.5px solid #fed7d7;
          background: #fff5f5;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #fc8181; flex-shrink: 0;
          transition: all 0.12s;
        }
        .q-ddel-btn:hover { background: #fed7d7; color: #e53e3e; }

        /* Delete confirm banner */
        .q-del-confirm {
          margin: 0 22px 12px;
          padding: 10px 14px;
          background: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px;
        }
        .q-del-confirm-txt {
          font-size: 13px;
          font-weight: 400;
          color: #c53030;
        }
        .q-del-confirm-btns { display: flex; gap: 6px; }
        .q-del-yes {
          padding: 5px 12px;
          background: #e53e3e; color: #fff;
          border: none; border-radius: 6px;
          font-size: 12.5px; font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer; transition: background 0.12s;
        }
        .q-del-yes:hover { background: #c53030; }
        .q-del-no {
          padding: 5px 12px;
          background: transparent; color: #718096;
          border: 1.5px solid #e2e8f0; border-radius: 6px;
          font-size: 12.5px; font-weight: 400;
          font-family: 'Inter', sans-serif;
          cursor: pointer; transition: all 0.12s;
        }
        .q-del-no:hover { border-color: #cbd5e0; color: #4a5568; }

        /* Chat */
        .q-chat {
          flex: 1; overflow-y: auto;
          padding: 20px 22px;
          display: flex; flex-direction: column; gap: 18px;
        }
        .q-chat::-webkit-scrollbar { width: 4px; }
        .q-chat::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 6px; }
        .q-msg { display: flex; gap: 10px; align-items: flex-start; }
        .q-msg.adm { flex-direction: row-reverse; }
        .q-msg-av {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; flex-shrink: 0;
        }
        .q-msg-body { max-width: 78%; }
        .q-msg-who {
          font-size: 11.5px; font-weight: 400; color: #a0aec0;
          margin-bottom: 5px;
        }
        .q-msg.adm .q-msg-who { text-align: right; }
        .q-bubble {
          padding: 10px 14px; font-size: 13.5px;
          font-weight: 400; line-height: 1.65;
          word-break: break-word;
          font-family: 'Inter', sans-serif;
        }
        .q-bubble.emp {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px 12px 12px 12px;
          color: #4a5568;
        }
        .q-bubble.adm {
          background: #2d3748;
          border-radius: 12px 4px 12px 12px;
          color: #e2e8f0;
        }

        /* Drawer footer */
        .q-dfooter {
          border-top: 1px solid #edf2f7;
          padding: 14px 22px;
          flex-shrink: 0;
          background: #f7fafc;
        }
        .q-dfooter-controls {
          display: flex; gap: 8px; align-items: center;
          flex-wrap: wrap; margin-bottom: 10px;
        }
        .q-flabel {
          font-size: 11px; font-weight: 500; color: #a0aec0;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .q-fsel {
          padding: 5px 10px;
          border: 1.5px solid #e2e8f0; border-radius: 6px;
          font-size: 12.5px; font-family: 'Inter', sans-serif;
          font-weight: 400; color: #4a5568; background: #fff;
          outline: none; cursor: pointer;
        }
        .q-fsel:focus { border-color: #4299e1; }
        .q-textarea {
          width: 100%; padding: 10px 13px;
          font-size: 13.5px; font-family: 'Inter', sans-serif;
          font-weight: 400; border: 1.5px solid #e2e8f0;
          border-radius: 8px; background: #fff; color: #2d3748;
          resize: none; outline: none; line-height: 1.6;
          transition: border-color 0.13s;
        }
        .q-textarea:focus { border-color: #4299e1; }
        .q-textarea::placeholder { color: #cbd5e0; }
        .q-footer-row {
          display: flex; justify-content: space-between;
          align-items: center; margin-top: 10px;
        }
        .q-send-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 18px; background: #2d3748; color: #fff;
          border: none; border-radius: 8px;
          font-size: 13px; font-weight: 500;
          font-family: 'Inter', sans-serif; cursor: pointer;
          transition: background 0.12s;
        }
        .q-send-btn:hover:not(:disabled) { background: #1a202c; }
        .q-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .q-ghost-btn {
          padding: 7px 14px;
          border: 1.5px solid #e2e8f0; border-radius: 8px;
          background: transparent; font-size: 13px; font-weight: 400;
          font-family: 'Inter', sans-serif; color: #a0aec0;
          cursor: pointer; transition: all 0.12s;
          display: flex; align-items: center; gap: 5px;
        }
        .q-ghost-btn:hover { background: #f7fafc; border-color: #cbd5e0; color: #4a5568; }

        /* Resolved bar */
        .q-resolved-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 22px; background: #f0fff4;
          border-top: 1px solid #9ae6b4; flex-shrink: 0;
        }
        .q-resolved-txt {
          font-size: 13px; font-weight: 500; color: #276749;
          display: flex; align-items: center; gap: 6px;
        }

        /* View full message area in drawer */
        .q-orig-msg {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13.5px;
          font-weight: 400;
          color: #4a5568;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>

      <div className="q-wrap">

        {/* ── TITLE ROW ── */}
        {/* <div className="q-title-row">
          <span className="q-title">Employee Queries</span>
          <div className="q-counts">
            <span className="q-chip" style={{ background: "#edf2f7", color: "#4a5568", borderColor: "#e2e8f0" }}>
              {total} Total
            </span>
            <span className="q-chip" style={{ background: "#fefcbf", color: "#975a16", borderColor: "#f6e05e" }}>
              {pending} Pending
            </span>
            <span className="q-chip" style={{ background: "#c6f6d5", color: "#276749", borderColor: "#9ae6b4" }}>
              {resolved} Resolved
            </span>
            {unread > 0 && (
              <span className="q-chip" style={{ background: "#bee3f8", color: "#2c5282", borderColor: "#90cdf4" }}>
                {unread} Unread
              </span>
            )}
          </div>
        </div> */}

        {/* ── FILTERS ── */}
        <div className="q-filters">
          <div className="q-search-wrap">
            <Search size={13} className="q-search-icon" />
            <input
              className="q-search"
              placeholder="Search queries…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>

          <div className="q-tabs">
            {([
              ["all", `All (${total})`],
              ["pending", `Pending (${pending})`],
              ["resolved", `Resolved (${resolved})`],
            ] as [string, string][]).map(([f, label]) => (
              <button
                key={f}
                className={`q-tab${statusFilter === f ? " on" : ""}`}
                onClick={() => { setStatusFilter(f); resetPage(); }}
              >
                {label}
              </button>
            ))}
          </div>

          <select className="q-sel" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); resetPage(); }}>
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select className="q-sel" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); resetPage(); }}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* ── TABLE ── */}
        <div className="q-card">
          <div className="q-tscroll">
            <table className="q-table">
              <thead className="q-thead">
                <tr>
                  <th className="q-th">Employee</th>
                  <th className="q-th">Subject / Preview</th>
                  <th className="q-th">Category</th>
                  <th className="q-th">Priority</th>
                  <th className="q-th">Status</th>
                  <th className="q-th">Assigned To</th>
                  <th className="q-th">Replies</th>
                  <th className="q-th">Time</th>
                  <th className="q-th"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><div className="q-spinner" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={9}>
                    <div className="q-empty">
                      <div className="q-empty-title">⚠️ Error loading data</div>
                      <div className="q-empty-sub">{error}</div>
                    </div>
                  </td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="q-empty">
                      <div className="q-empty-title">No queries found</div>
                      <div className="q-empty-sub">{search ? "Try a different search term" : "Nothing here yet"}</div>
                    </div>
                  </td></tr>
                ) : paginated.map((q) => {
                  const pc = PRIORITY_CONFIG[q.priority] ?? PRIORITY_CONFIG["medium"];
                  const cc = CATEGORY_CONFIG[q.category] ?? CATEGORY_CONFIG["General"];
                  const isConfirming = deleteConfirm === q.id;
                  return (
                    <tr
                      key={q.id}
                      className={`q-tr${q.adminUnread ? " unread" : ""}${drawer?.id === q.id ? " active" : ""}`}
                      onClick={() => openDrawer(q)}
                    >
                      <td className="q-td">
                        <div className="q-emp-cell">
                          <Avatar name={q.employeeName || ""} size={34} />
                          <div>
                            <div className="q-emp-name">
                              {q.employeeName || "Unknown"}
                              {q.adminUnread && <span className="q-unread-dot" />}
                            </div>
                            <div className="q-emp-dept">{q.department}</div>
                          </div>
                        </div>
                      </td>
                      <td className="q-td">
                        <div className="q-subj">{q.subject || "—"}</div>
                        <div className="q-preview">{q.message}</div>
                      </td>
                      <td className="q-td">
                        <Badge label={q.category || "General"} bg={cc.bg} color={cc.color} />
                      </td>
                      <td className="q-td">
                        <Badge label={pc.label} bg={pc.bg} color={pc.color} dot={pc.dot} />
                      </td>
                      <td className="q-td">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="q-td">
                        <div className="q-assigned-txt">{q.assignedTo || "Unassigned"}</div>
                      </td>
                      <td className="q-td">
                        <div className="q-reply-count">
                          <MessageSquare size={12} />
                          {(q.replies ?? []).length}
                        </div>
                      </td>
                      <td className="q-td">
                        <div className="q-time-txt">{timeAgo(q.createdAt)}</div>
                      </td>
                      <td className="q-td" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`q-del-btn${isConfirming ? " confirm" : ""}`}
                          title={isConfirming ? "Click again to confirm delete" : "Delete query"}
                          onClick={(e) => { e.stopPropagation(); void handleDelete(q.id); }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && !error && filtered.length > 0 && (
            <div className="q-pager">
              <span className="q-pager-info">
                {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} queries
              </span>
              <div className="q-pager-right">
                <select
                  className="q-pager-sel"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
                </select>
                <button className="q-pager-btn" disabled={page === 1} onClick={() => setPage(1)}>
                  <ChevronLeft size={12} style={{ marginRight: -4 }} /><ChevronLeft size={12} />
                </button>
                <button className="q-pager-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className="q-pager-num">Page {page} / {totalPages}</span>
                <button className="q-pager-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight size={14} />
                </button>
                <button className="q-pager-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                  <ChevronRight size={12} style={{ marginLeft: -4 }} /><ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── DRAWER ── */}
        {drawer && (
          <>
            <div className="q-overlay" onClick={closeDrawer} />
            <div className="q-drawer">

              {/* Header */}
              <div className="q-dhead">
                <div className="q-dhead-top">
                  <Avatar name={drawer.employeeName || ""} size={42} />
                  <div className="q-dhead-meta">
                    <div className="q-dhead-subj">{drawer.subject}</div>
                    <div className="q-dhead-info">
                      <strong>{drawer.employeeName}</strong>
                      {" · "}{drawer.employeeEmail}
                      {" · "}{drawer.department}
                    </div>
                  </div>
                  <button
                    className="q-ddel-btn"
                    title="Delete this query"
                    onClick={() => setDeleteConfirm(drawer.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                  <button className="q-dclose" onClick={closeDrawer}><X size={13} /></button>
                </div>
                <div className="q-dhead-badges">
                  {(() => {
                    const pc = PRIORITY_CONFIG[drawer.priority] ?? PRIORITY_CONFIG["medium"];
                    const cc = CATEGORY_CONFIG[drawer.category] ?? CATEGORY_CONFIG["General"];
                    return (
                      <>
                        <Badge label={drawer.category || "General"} bg={cc.bg} color={cc.color} />
                        <Badge label={pc.label} bg={pc.bg} color={pc.color} dot={pc.dot} />
                        <StatusBadge status={drawer.status} />
                        <span style={{ fontSize: 11, color: "#c4c9d4", fontWeight: 400 }}>
                          {timeAgo(drawer.createdAt)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Delete confirmation banner */}
              {deleteConfirm === drawer.id && (
                <div className="q-del-confirm">
                  <span className="q-del-confirm-txt">Permanently delete this query? This cannot be undone.</span>
                  <div className="q-del-confirm-btns">
                    <button className="q-del-no" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    <button className="q-del-yes" onClick={() => void handleDelete(drawer.id)}>Delete</button>
                  </div>
                </div>
              )}

              {/* Chat */}
              <div className="q-chat">
                <div className="q-msg">
                  <div className="q-msg-av" style={{
                    background: getAvatarStyle(drawer.employeeName || "").bg,
                    color: getAvatarStyle(drawer.employeeName || "").color,
                  }}>
                    {getInitials(drawer.employeeName || "")}
                  </div>
                  <div className="q-msg-body">
                    <div className="q-msg-who">{drawer.employeeName} · {timeAgo(drawer.createdAt)}</div>
                    <div className="q-bubble emp">{drawer.message}</div>
                  </div>
                </div>

                {(drawer.replies ?? []).map((r, i) => (
                  <div key={i} className={`q-msg${r.author === "Admin" ? " adm" : ""}`}>
                    <div className="q-msg-av" style={{
                      background: r.author === "Admin" ? "#2d3748" : getAvatarStyle(r.author || "").bg,
                      color: r.author === "Admin" ? "#e2e8f0" : getAvatarStyle(r.author || "").color,
                    }}>
                      {r.author === "Admin" ? "A" : getInitials(r.author || "")}
                    </div>
                    <div className="q-msg-body">
                      <div className="q-msg-who">
                        {r.author === "Admin" ? "You (Admin)" : r.author}
                        {r.assignedTo && r.assignedTo !== "Unassigned" && (
                          <span style={{ color: "#6366f1", marginLeft: 5 }}>via {r.assignedTo}</span>
                        )}
                        {" · "}{timeAgo(r.time)}
                      </div>
                      <div className={`q-bubble ${r.author === "Admin" ? "adm" : "emp"}`}>{r.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Footer */}
              {drawer.status === "resolved" && (drawer.replies ?? []).length > 0 ? (
                <div className="q-resolved-bar">
                  <span className="q-resolved-txt"><CheckCircle2 size={14} /> Query resolved</span>
                  <button className="q-ghost-btn" onClick={handleReopen}>
                    <RotateCcw size={12} /> Reopen
                  </button>
                </div>
              ) : (
                <div className="q-dfooter">
                  <div className="q-dfooter-controls">
                    <span className="q-flabel">Assign</span>
                    <select className="q-fsel" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                      {ADMIN_AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <span className="q-flabel" style={{ marginLeft: 4 }}>Priority</span>
                    <select
                      className="q-fsel"
                      value={drawer.priority || "medium"}
                      onChange={(e) => handleChangePriority(e.target.value)}
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="q-textarea"
                    rows={3}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for newline)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendReply(); }
                    }}
                  />
                  <div className="q-footer-row">
                    <button className="q-ghost-btn" onClick={closeDrawer}>Cancel</button>
                    <button
                      className="q-send-btn"
                      disabled={!replyText.trim() || sending}
                      onClick={() => void handleSendReply()}
                    >
                      <Send size={13} />
                      {sending ? "Sending…" : "Send Reply"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}