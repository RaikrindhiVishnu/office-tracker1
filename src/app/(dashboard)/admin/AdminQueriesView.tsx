/**
 * AdminQueriesView.tsx  — fully typed TypeScript version
 *
 * SETUP:
 * 1. npm install firebase lucide-react
 * 2. Create src/lib/firebase.ts with your Firebase config
 * 3. Firestore collection: "employeeQueries"
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Clock, CheckCircle, Bell } from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reply {
  author:      string;
  text:        string;
  time:        number;
  assignedTo?: string;
}

interface EmployeeQuery {
  id:             string;
  employeeName:   string;
  employeeEmail:  string;
  department:     string;
  subject:        string;
  message:        string;
  status:         string;
  priority:       string;
  category:       string;
  adminUnread:    boolean;
  employeeUnread: boolean;
  createdAt:      { seconds: number; nanoseconds: number } | string | number | null;
  replies?:       Reply[];
  adminReply?:    string;
  repliedAt?:     { seconds: number; nanoseconds: number } | null;
  assignedTo?:    string | null;
}

interface PriorityConfig {
  label:  string;
  bg:     string;
  color:  string;
  dot:    string;
  border: string;
}

interface CategoryConfig {
  bg:    string;
  color: string;
}

interface AvatarColor {
  bg:    string;
  color: string;
}

interface ChipProps {
  label:   string;
  bg:      string;
  color:   string;
  border?: string;
  dot?:    string;
}

interface AvatarProps {
  name:   string;
  size?:  number;
}

interface StatusChipProps {
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  low:    { label: "Low",    bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", border: "#bbf7d0" },
  medium: { label: "Medium", bg: "#fffbeb", color: "#d97706", dot: "#f59e0b", border: "#fde68a" },
  high:   { label: "High",   bg: "#fff1f2", color: "#e11d48", dot: "#f43f5e", border: "#fecdd3" },
  urgent: { label: "Urgent", bg: "#fdf4ff", color: "#9333ea", dot: "#a855f7", border: "#e9d5ff" },
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  "IT Support": { bg: "#eff6ff", color: "#3b82f6" },
  "Payroll":    { bg: "#f0fdf4", color: "#15803d" },
  "HR Policy":  { bg: "#fdf4ff", color: "#9333ea" },
  "Software":   { bg: "#fff7ed", color: "#ea580c" },
  "Facilities": { bg: "#f0f9ff", color: "#0284c7" },
  "Finance":    { bg: "#fffbeb", color: "#d97706" },
};

const AVATAR_COLORS: AvatarColor[] = [
  { bg: "#eff0ff", color: "#6366f1" },
  { bg: "#fce7f3", color: "#db2777" },
  { bg: "#d1fae5", color: "#059669" },
  { bg: "#fffbeb", color: "#d97706" },
  { bg: "#ede9fe", color: "#7c3aed" },
  { bg: "#e0f2fe", color: "#0284c7" },
  { bg: "#fef9c3", color: "#ca8a04" },
  { bg: "#fee2e2", color: "#dc2626" },
];

const ADMIN_AGENTS: string[] = [
  "Unassigned",
  "Admin — madhuri.",
  "Admin — phani.",
  "Project manager — pradeep.",
  "IT — team leads.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarStyle(name: string): AvatarColor {
  const idx = ((name ?? "").charCodeAt(0) || 65) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name: string): string {
  return (name ?? "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function timeAgo(ts: EmployeeQuery["createdAt"] | number): string {
  if (ts === null || ts === undefined) return "—";
  let d: Date;
  if (typeof ts === "object" && "seconds" in ts) {
    d = new Date(ts.seconds * 1000);
  } else if (typeof ts === "string") {
    d = new Date(ts);
  } else {
    d = new Date(ts as number);
  }
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: AvatarProps) {
  const { bg, color } = getAvatarStyle(name);
  const initials = getInitials(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, border: `1.5px solid ${color}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
      letterSpacing: "-0.3px",
    }}>
      {initials || "?"}
    </div>
  );
}

function Chip({ label, bg, color, border, dot }: ChipProps) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 20, background: bg, color,
      border: border ? `1px solid ${border}` : "none",
      whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot }} />}
      {label}
    </span>
  );
}

function StatusChip({ status }: StatusChipProps) {
  return status === "resolved"
    ? <Chip label="✓ Resolved" bg="#f0fdf4" color="#15803d" />
    : <Chip label="⏳ Pending"  bg="#fffbeb" color="#d97706" />;
}

function LoadingSpinner() {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 12,
      color: "#94a3b8",
    }}>
      <div style={{
        width: 32, height: 32, border: "3px solid #e2e8f0",
        borderTopColor: "#6366f1", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>Loading queries…</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminQueriesView() {
  const [queries,   setQueries]   = useState<EmployeeQuery[]>([]);
  const [loading,   setLoading]   = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filter,    setFilter]    = useState<string>("all");
  const [search,    setSearch]    = useState<string>("");
  const [selected,  setSelected]  = useState<EmployeeQuery | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [assignTo,  setAssignTo]  = useState<string>("");
  const [sending,   setSending]   = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore real-time listener ────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "employeeQueries"),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data: EmployeeQuery[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<EmployeeQuery, "id">),
        }));
        setQueries(data);
        setLoading(false);
        setSelected((prev) =>
          prev ? data.find((item) => item.id === prev.id) ?? prev : null,
        );
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("Failed to load queries. Check your Firestore rules.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Auto-scroll chat to bottom when replies update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.replies?.length]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleSelectQuery = async (item: EmployeeQuery): Promise<void> => {
    setSelected(item);
    setReplyText("");
    if (item.adminUnread) {
      try {
        await updateDoc(doc(db, "employeeQueries", item.id), {
          adminUnread: false,
        });
      } catch (e) {
        console.error("markRead error:", e);
      }
    }
  };

  const handleSendReply = async (): Promise<void> => {
    if (!replyText.trim() || !selected || sending) return;
    setSending(true);
    try {
      const newReply: Reply = {
        author:     "Admin",
        text:       replyText.trim(),
        time:       Date.now(),
        assignedTo: assignTo || "Unassigned",
      };
      const updatedReplies: Reply[] = [...(selected.replies ?? []), newReply];
      await updateDoc(doc(db, "employeeQueries", selected.id), {
        replies:        updatedReplies,
        adminReply:     replyText.trim(),
        status:         "resolved",
        adminUnread:    false,
        employeeUnread: true,
        repliedAt:      serverTimestamp(),
        assignedTo:     assignTo || null,
      });
      setReplyText("");
    } catch (e) {
      console.error("Reply error:", e);
      alert("Failed to send reply. Check Firestore permissions.");
    } finally {
      setSending(false);
    }
  };

  const handleChangePriority = async (priority: string): Promise<void> => {
    if (!selected) return;
    try {
      await updateDoc(doc(db, "employeeQueries", selected.id), { priority });
    } catch (e) {
      console.error("Priority update error:", e);
    }
  };

  const handleReopenQuery = async (): Promise<void> => {
    if (!selected) return;
    try {
      await updateDoc(doc(db, "employeeQueries", selected.id), {
        status: "pending",
      });
    } catch (e) {
      console.error("Reopen error:", e);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const total    = queries.length;
  const pending  = queries.filter((q) => q.status !== "resolved").length;
  const resolved = queries.filter((q) => q.status === "resolved").length;
  const unread   = queries.filter((q) => q.adminUnread).length;

  const filtered = queries.filter((q) => {
    const matchFilter =
      filter === "all" ||
      (filter === "pending"  && q.status !== "resolved") ||
      (filter === "resolved" && q.status === "resolved");
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      (q.employeeName  || "").toLowerCase().includes(s) ||
      (q.subject       || "").toLowerCase().includes(s) ||
      (q.message       || "").toLowerCase().includes(s) ||
      (q.department    || "").toLowerCase().includes(s);
    return matchFilter && matchSearch;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; }
        .adq-root { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f6fb; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .adq-slide  { animation: slideIn 0.2s ease; }
        .adq-fadeup { animation: fadeUp  0.18s ease; }
        .adq-topbar { background: #fff; border-bottom: 1px solid #e8ecf3; padding: 0 24px; height: 54px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .adq-logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; flex-shrink: 0; }
        .adq-topbar-title { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px; }
        .adq-topbar-sep { width: 1px; height: 18px; background: #e2e8f0; }
        .adq-topbar-sub { font-size: 13px; color: #64748b; font-weight: 500; }
        .adq-unread-badge { background: #ef4444; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 20px; margin-left: auto; }
        .adq-admin-av { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
        .adq-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; padding: 16px 24px 0; flex-shrink: 0; }
        .adq-stat-card { background: #fff; border: 1px solid #e8ecf3; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; min-width: 0; }
        .adq-stat-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .adq-stat-val { font-size: 28px; font-weight: 700; color: #0f172a; line-height: 1; letter-spacing: -1px; }
        .adq-stat-lbl { font-size: 12px; color: #64748b; font-weight: 400; margin-top: 4px; }
        .adq-main { display: flex; gap: 0; flex: 1; min-height: 0; margin: 16px 24px 24px; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8ecf3; }
        .adq-left { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #f1f5f9; }
        .adq-left-head { padding: 14px 14px 10px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
        .adq-search-wrap { position: relative; margin-bottom: 10px; }
        .adq-search { width: 100%; padding: 8px 12px 8px 34px; border: 1.5px solid #e8ecf3; border-radius: 10px; font-size: 12px; font-family: inherit; font-weight: 500; color: #1e293b; background: #f8fafc; outline: none; transition: border-color 0.15s; }
        .adq-search:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,0.09); }
        .adq-search::placeholder { color: #cbd5e1; }
        .adq-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px; pointer-events: none; }
        .adq-filters { display: flex; gap: 3px; background: #f1f5f9; padding: 3px; border-radius: 9px; }
        .adq-filter-btn { flex: 1; font-size: 11px; font-weight: 700; padding: 5px 8px; border-radius: 7px; border: none; cursor: pointer; background: transparent; color: #64748b; font-family: inherit; transition: all 0.13s; white-space: nowrap; }
        .adq-filter-btn.on { background: #0f172a; color: #fff; }
        .adq-filter-btn:not(.on):hover { background: #e2e8f0; color: #334155; }
        .adq-qlist { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .adq-qlist::-webkit-scrollbar { width: 4px; }
        .adq-qlist::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 6px; }
        .adq-qcard { padding: 12px; border-radius: 10px; border: 1px solid #e8ecf3; cursor: pointer; transition: all 0.13s; position: relative; background: #fff; }
        .adq-qcard:hover { background: #f8faff; border-color: #dde6f7; }
        .adq-qcard.active { background: #eff0ff; border-color: #a5b4fc; box-shadow: 0 0 0 1px #a5b4fc; }
        .adq-unread-bar { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 55%; background: #6366f1; border-radius: 0 3px 3px 0; }
        .adq-qcard-row { display: flex; gap: 10px; align-items: flex-start; }
        .adq-qcard-body { flex: 1; min-width: 0; }
        .adq-qcard-nameline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1px; }
        .adq-qcard-name { font-size: 12px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 5px; }
        .adq-qcard-time { font-size: 10px; color: #94a3b8; font-weight: 500; flex-shrink: 0; }
        .adq-qcard-email { font-size: 11px; color: #94a3b8; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .adq-qcard-subj { font-size: 12px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
        .adq-qcard-msg { font-size: 11px; color: #64748b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }
        .adq-qcard-chips { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
        .adq-unread-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
        .adq-right { flex: 1; display: flex; flex-direction: column; background: #fff; min-width: 0; }
        .adq-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #94a3b8; }
        .adq-empty-icon { font-size: 44px; }
        .adq-det-head { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
        .adq-det-top { display: flex; align-items: flex-start; gap: 12px; }
        .adq-det-meta { flex: 1; min-width: 0; }
        .adq-det-subj { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; margin-bottom: 3px; }
        .adq-det-info { font-size: 12px; color: #64748b; }
        .adq-det-chips { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
        .adq-close-btn { font-size: 12px; font-weight: 600; padding: 6px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; background: transparent; cursor: pointer; color: #64748b; font-family: inherit; flex-shrink: 0; transition: all 0.13s; }
        .adq-close-btn:hover { background: #f1f5f9; }
        .adq-chat { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
        .adq-chat::-webkit-scrollbar { width: 4px; }
        .adq-chat::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 6px; }
        .adq-msg-row { display: flex; gap: 10px; align-items: flex-start; }
        .adq-msg-row.admin-row { flex-direction: row-reverse; }
        .adq-msg-av { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .adq-msg-content { max-width: 72%; }
        .adq-msg-sender { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
        .adq-msg-row.admin-row .adq-msg-sender { text-align: right; }
        .adq-bubble { padding: 12px 14px; font-size: 13px; line-height: 1.7; font-weight: 400; word-break: break-word; }
        .adq-bubble.emp { background: #f8fafc; border: 1.5px solid #e8ecf3; border-radius: 4px 14px 14px 14px; color: #334155; }
        .adq-bubble.adm { background: #6366f1; border-radius: 14px 4px 14px 14px; color: #fff; }
        .adq-reply-footer { border-top: 1px solid #f1f5f9; padding: 14px 20px; background: #fafbfc; flex-shrink: 0; }
        .adq-reply-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
        .adq-mini-label { font-size: 11px; color: #64748b; font-weight: 600; }
        .adq-mini-select { font-size: 12px; font-weight: 500; padding: 5px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px; background: #fff; color: #475569; cursor: pointer; outline: none; font-family: inherit; }
        .adq-mini-select:focus { border-color: #6366f1; }
        .adq-textarea { width: 100%; padding: 11px 14px; font-size: 13px; font-family: inherit; font-weight: 400; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #fff; color: #1e293b; resize: none; outline: none; line-height: 1.6; transition: border-color 0.15s; }
        .adq-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.09); }
        .adq-textarea::placeholder { color: #cbd5e1; }
        .adq-reply-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .adq-send-btn { font-size: 13px; font-weight: 700; padding: 8px 20px; background: #6366f1; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; transition: background 0.13s; }
        .adq-send-btn:hover:not(:disabled) { background: #4f46e5; }
        .adq-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .adq-cancel-btn { font-size: 12px; font-weight: 600; padding: 7px 14px; border: 1.5px solid #e2e8f0; border-radius: 9px; background: transparent; cursor: pointer; color: #64748b; font-family: inherit; transition: all 0.13s; }
        .adq-cancel-btn:hover { background: #f1f5f9; }
        .adq-reopen-btn { font-size: 11px; font-weight: 700; padding: 6px 13px; border: 1.5px solid #e2e8f0; border-radius: 8px; background: #f8fafc; cursor: pointer; color: #64748b; font-family: inherit; }
        .adq-reopen-btn:hover { background: #f1f5f9; }
        .adq-resolved-bar { padding: 12px 20px; background: #f0fdf4; border-top: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .adq-resolved-text { font-size: 12px; color: #15803d; font-weight: 600; }
        .adq-error { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: #ef4444; padding: 20px; text-align: center; }
      `}</style>

      <div className="adq-root">

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div className="adq-topbar">
          <div className="adq-logo">💬</div>
          <span className="adq-topbar-title">HelpDesk</span>
          <div className="adq-topbar-sep" />
          <span className="adq-topbar-sub">Admin Console</span>
          {unread > 0 && (
            <div className="adq-unread-badge">{unread} unread</div>
          )}
          <div className="adq-admin-av" style={{ marginLeft: unread > 0 ? 0 : "auto" }}>A</div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="adq-stats">
          {([
            { icon: <FileText    size={22} color="#534ab7" />, bg: "#eeedfe", label: "Total Queries", value: total    },
            { icon: <Clock       size={22} color="#854f0b" />, bg: "#faeeda", label: "Pending",        value: pending  },
            { icon: <CheckCircle size={22} color="#3b6d11" />, bg: "#eaf3de", label: "Resolved",       value: resolved },
            { icon: <Bell        size={22} color="#854f0b" />, bg: "#faeeda", label: "Unread",         value: unread   },
          ] as const).map(({ icon, label, value, bg }) => (
            <div className="adq-stat-card" key={label}>
              <div className="adq-stat-icon" style={{ background: bg }}>{icon}</div>
              <div>
                <div className="adq-stat-val">{value}</div>
                <div className="adq-stat-lbl">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN SPLIT PANEL ────────────────────────────────────────────── */}
        <div className="adq-main">

          {/* ── LEFT: QUERY LIST ──────────────────────────────────────────── */}
          <div className="adq-left">
            <div className="adq-left-head">
              <div className="adq-search-wrap">
                <span className="adq-search-icon">🔍</span>
                <input
                  className="adq-search"
                  placeholder="Search name, subject, department…"
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
              </div>
              <div className="adq-filters">
                {([
                  ["all",      `All (${total})`],
                  ["pending",  `Pending (${pending})`],
                  ["resolved", `Resolved (${resolved})`],
                ] as [string, string][]).map(([f, label]) => (
                  <button
                    key={f}
                    className={`adq-filter-btn${filter === f ? " on" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="adq-qlist">
              {loading ? (
                <LoadingSpinner />
              ) : error ? (
                <div className="adq-error">
                  <span style={{ fontSize: 28 }}>⚠️</span>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 16px", color: "#94a3b8" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 4 }}>No queries found</div>
                  <div style={{ fontSize: 12 }}>
                    {search ? "Try a different search term" : "Nothing here yet"}
                  </div>
                </div>
              ) : (
                filtered.map((q) => {
                  const pc       = PRIORITY_CONFIG[q.priority] ?? PRIORITY_CONFIG["medium"];
                  const cc       = CATEGORY_CONFIG[q.category] ?? { bg: "#f1f5f9", color: "#64748b" };
                  const isActive = selected?.id === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`adq-qcard${isActive ? " active" : ""}`}
                      style={{ borderLeft: q.adminUnread ? "3px solid #6366f1" : "3px solid transparent" }}
                      onClick={() => handleSelectQuery(q)}
                    >
                      {q.adminUnread && <div className="adq-unread-bar" />}
                      <div className="adq-qcard-row">
                        <Avatar name={q.employeeName || ""} size={34} />
                        <div className="adq-qcard-body">
                          <div className="adq-qcard-nameline">
                            <div className="adq-qcard-name">
                              {q.employeeName || "Unknown"}
                              {q.adminUnread && <span className="adq-unread-dot" />}
                            </div>
                            <span className="adq-qcard-time">{timeAgo(q.createdAt)}</span>
                          </div>
                          <div className="adq-qcard-email">
                            {q.employeeEmail} · {q.department}
                          </div>
                          <div className="adq-qcard-subj">{q.subject || "—"}</div>
                          <div className="adq-qcard-msg">{q.message}</div>
                          <div className="adq-qcard-chips">
                            <Chip label={q.category || "General"} bg={cc.bg} color={cc.color} />
                            <Chip label={pc.label} bg={pc.bg} color={pc.color} dot={pc.dot} border={pc.border} />
                            <StatusChip status={q.status} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: DETAIL / CHAT ──────────────────────────────────────── */}
          <div className="adq-right">
            {!selected ? (
              <div className="adq-empty">
                <div className="adq-empty-icon">💬</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>
                  Select a query
                </div>
                <div style={{ fontSize: 13 }}>
                  Click any query on the left to view and reply
                </div>
              </div>
            ) : (
              <div className="adq-slide" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

                {/* Detail header */}
                <div className="adq-det-head">
                  <div className="adq-det-top">
                    <Avatar name={selected.employeeName || ""} size={44} />
                    <div className="adq-det-meta">
                      <div className="adq-det-subj">{selected.subject}</div>
                      <div className="adq-det-info">
                        <strong style={{ color: "#1e293b" }}>{selected.employeeName}</strong>
                        {" · "}{selected.employeeEmail}{" · "}{selected.department}
                      </div>
                      <div className="adq-det-chips">
                        {(() => {
                          const pc = PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG["medium"];
                          const cc = CATEGORY_CONFIG[selected.category] ?? { bg: "#f1f5f9", color: "#64748b" };
                          return (
                            <>
                              <Chip label={selected.category || "General"} bg={cc.bg} color={cc.color} />
                              <Chip label={pc.label} bg={pc.bg} color={pc.color} dot={pc.dot} border={pc.border} />
                              <StatusChip status={selected.status} />
                              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                                🕐 {timeAgo(selected.createdAt)}
                              </span>
                              {selected.assignedTo && selected.assignedTo !== "Unassigned" && (
                                <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                                  👤 {selected.assignedTo}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <button className="adq-close-btn" onClick={() => setSelected(null)}>
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Chat thread */}
                <div className="adq-chat">
                  {/* Original message */}
                  <div className="adq-msg-row">
                    <div
                      className="adq-msg-av"
                      style={{
                        background: getAvatarStyle(selected.employeeName || "").bg,
                        color:      getAvatarStyle(selected.employeeName || "").color,
                      }}
                    >
                      {getInitials(selected.employeeName || "")}
                    </div>
                    <div className="adq-msg-content">
                      <div className="adq-msg-sender">
                        {selected.employeeName} · {timeAgo(selected.createdAt)}
                      </div>
                      <div className="adq-bubble emp">{selected.message}</div>
                    </div>
                  </div>

                  {/* All replies */}
                  {(selected.replies ?? []).map((r, i) => (
                    <div
                      key={i}
                      className={`adq-msg-row adq-fadeup${r.author === "Admin" ? " admin-row" : ""}`}
                    >
                      <div
                        className="adq-msg-av"
                        style={{
                          background: r.author === "Admin" ? "#6366f1" : getAvatarStyle(r.author || "").bg,
                          color:      r.author === "Admin" ? "#fff"     : getAvatarStyle(r.author || "").color,
                        }}
                      >
                        {r.author === "Admin" ? "A" : getInitials(r.author || "")}
                      </div>
                      <div className="adq-msg-content">
                        <div className="adq-msg-sender">
                          {r.author === "Admin" ? "You (Admin)" : r.author}
                          {r.assignedTo && r.assignedTo !== "Unassigned" && (
                            <span style={{ color: "#6366f1", marginLeft: 6 }}>via {r.assignedTo}</span>
                          )}
                          {" · "}{timeAgo(r.time)}
                        </div>
                        <div className={`adq-bubble ${r.author === "Admin" ? "adm" : "emp"}`}>
                          {r.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div ref={chatEndRef} />
                </div>

                {/* Reply footer or resolved bar */}
                {selected.status === "resolved" && (selected.replies ?? []).length > 0 ? (
                  <div className="adq-resolved-bar">
                    <span className="adq-resolved-text">✓ This query is resolved</span>
                    <button className="adq-reopen-btn" onClick={handleReopenQuery}>
                      Reopen
                    </button>
                  </div>
                ) : (
                  <div className="adq-reply-footer">
                    <div className="adq-reply-controls">
                      <span className="adq-mini-label">Assign to:</span>
                      <select
                        className="adq-mini-select"
                        value={assignTo}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignTo(e.target.value)}
                      >
                        {ADMIN_AGENTS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <span className="adq-mini-label" style={{ marginLeft: 6 }}>Priority:</span>
                      <select
                        className="adq-mini-select"
                        value={selected.priority || "medium"}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChangePriority(e.target.value)}
                      >
                        {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="adq-textarea"
                      rows={3}
                      placeholder="Write a reply… (Enter to send, Shift+Enter for new line)"
                      value={replyText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendReply();
                        }
                      }}
                    />
                    <div className="adq-reply-actions">
                      <button
                        className="adq-cancel-btn"
                        onClick={() => { setSelected(null); setReplyText(""); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="adq-send-btn"
                        disabled={!replyText.trim() || sending}
                        onClick={() => void handleSendReply()}
                      >
                        {sending ? "Sending…" : "Send Reply ↗"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}