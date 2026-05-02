"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  limit, getDocs, updateDoc, doc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import NotificationsView from "./NotificationsView";
import HelpView from "./HelpView";

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  user: any;
  isCheckedIn: boolean;
  onlineMinutes: number | null;
  attendance: any;
  sessions: any[];
  formatTotal: (min?: number) => string;
  formatTime: (ts: any) => string;
  task?: string;
  setTask?: (v: string) => void;
  notes?: string;
  setNotes?: (v: string) => void;
  handleSaveUpdate?: () => void | Promise<void>;
  saving?: boolean;
  msg?: string;
  leaveType: string;
  setLeaveType: (v: any) => void;
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  leaveReason: string;
  setLeaveReason: (v: string) => void;
  handleSubmitLeave: () => void | Promise<void>;
  submitting: boolean;
  leaveMsg: string;
  totalSeconds?: number;
  onGoToChat?: (chatId: string) => void;
  onOpenMeetChat?: () => void;
  announcements?: { id: string; text: string }[];
};

// ─── Holiday Fallback ─────────────────────────────────────────────────────────
const CANONICAL_HOLIDAYS = [
  { title: "New Year", date: "2026-01-01", type: "National" },
  { title: "Bhogi", date: "2026-01-13", type: "Festival" },
  { title: "Pongal", date: "2026-01-14", type: "Festival" },
  { title: "Holi", date: "2026-03-04", type: "Festival" },
  { title: "Ugadi", date: "2026-03-19", type: "Festival" },
  { title: "Independence Day", date: "2026-08-15", type: "National" },
  { title: "Raksha Bandhan", date: "2026-08-28", type: "Festival" },
  { title: "Ganesh Chaturthi", date: "2026-09-14", type: "Festival" },
  { title: "Gandhi Jayanthi", date: "2026-10-02", type: "National" },
  { title: "Dussehra", date: "2026-10-20", type: "Festival" },
  { title: "Diwali", date: "2026-11-08", type: "Festival" },
  { title: "Christmas", date: "2026-12-25", type: "National" },
];

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.07)",
  borderLight: "rgba(0,0,0,0.04)",
  text: "#1D1D1F",
  text2: "#6E6E73",
  text3: "#AEAEB2",
  accent: "#0071E3",
  accentLight: "#E8F0FB",
  green: "#34C759",
  greenLight: "#E8F9ED",
  orange: "#FF9F0A",
  orangeLight: "#FFF4E0",
  red: "#FF3B30",
  redLight: "#FFECEB",
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  radius: "18px",
  radiusSm: "10px",
  shadow: "0 1px 2px rgba(0,0,0,0.04)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return (name ?? "").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_PALETTES: [string, string][] = [
  ["#EEF2FF", "#4338CA"], ["#D1FAE5", "#065F46"], ["#FEF3C7", "#92400E"],
  ["#FCE7F3", "#9D174D"], ["#EDE9FE", "#5B21B6"], ["#DBEAFE", "#1D4ED8"],
  ["#CFFAFE", "#0E7490"], ["#FEE2E2", "#991B1B"],
];
function avatarColors(name: string): [string, string] {
  return AVATAR_PALETTES[((name ?? "A").charCodeAt(0) - 65 + 26) % AVATAR_PALETTES.length];
}

function Avatar({ name, size = 36, photo }: { name: string; size?: number; photo?: string }) {
  const [bg, fg] = avatarColors(name);
  if (photo)
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: "cover", flexShrink: 0 }}
      />
    );
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 800, flexShrink: 0,
        letterSpacing: "-0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  padding: "20px",
  boxShadow: T.shadow,
  position: "relative",
  overflow: "hidden",
};

const CARD_LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
  textTransform: "none", color: T.text2,
  marginBottom: 12, display: "block",
};

const INP: React.CSSProperties = {
  width: "100%", border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, padding: "9px 12px",
  fontSize: 13, color: T.text2, outline: "none",
  background: "#FAFAFA", fontFamily: T.font, boxSizing: "border-box",
};

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ onClose, children, wide = false }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: wide ? 600 : 440,
          borderRadius: "16px 16px 0 0", background: T.card,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          maxHeight: "92vh", display: "flex", flexDirection: "column",
          overflow: "hidden", margin: "0 auto",
        }}
      >
        <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalHeader({ emoji, title, subtitle, onClose }: { emoji: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: "18px 20px 14px", borderBottom: `1px solid ${T.borderLight}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: T.radiusSm,
            background: T.accentLight, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
          }}
        >
          {emoji}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          width: 28, height: 28, borderRadius: "50%",
          border: `1px solid ${T.border}`, background: "#FAFAFA",
          cursor: "pointer", fontSize: 16, color: T.text2,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── WORK UPDATE MODAL ────────────────────────────────────────────────────────
function WorkUpdateModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [task, setTask] = useState(""); const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("In Progress"); const [priority, setPri] = useState("Medium");
  const [saving, setSaving] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  const STATUSES = [
    { label: "In Progress", color: T.accent, icon: "🔄" },
    { label: "Completed", color: T.green, icon: "✅" },
    { label: "In Review", color: T.orange, icon: "👀" },
  ];
  const PRIORITIES = [
    { label: "Low", color: T.green },
    { label: "Medium", color: T.orange },
    { label: "High", color: T.red },
  ];
  useEffect(() => { if (done) { const t = setTimeout(onClose, 1200); return () => clearTimeout(t); } }, [done, onClose]);
  const handleSave = async () => {
    if (!task.trim() && !notes.trim()) { setError("Please enter a task or notes."); return; }
    if (!user) return;
    try {
      setSaving(true); setError("");
      await addDoc(collection(db, "workUpdates"), {
        uid: user.uid, userEmail: user.email ?? "",
        userName: user.email?.split("@")[0] ?? "Unknown",
        task: task.trim(), notes: notes.trim(), status, priority,
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch { setError("Failed to save. Please try again."); } finally { setSaving(false); }
  };
  return (
    <>
      <ModalHeader emoji="✏️" title="Work Update" subtitle="Log what you're working on today" onClose={onClose} />
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Update Saved!</p>
          </div>
        ) : (
          <>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Task *</label>
              <input style={INP} placeholder="e.g. Fixing login bug…" value={task} onChange={(e) => setTask(e.target.value)} />
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Status</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {STATUSES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setStatus(s.label)}
                    style={{
                      padding: "9px 6px", borderRadius: T.radiusSm,
                      border: `1.5px solid ${status === s.label ? s.color : T.border}`,
                      background: status === s.label ? s.color + "12" : "#FAFAFA",
                      color: status === s.label ? s.color : T.text2,
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPri(p.label)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: T.radiusSm,
                      border: `1.5px solid ${priority === p.label ? p.color : T.border}`,
                      background: priority === p.label ? p.color + "12" : "#FAFAFA",
                      color: priority === p.label ? p.color : T.text2,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Notes</label>
              <textarea style={{ ...INP, resize: "vertical" }} rows={3} placeholder="Progress, blockers…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && <p style={{ fontSize: 12, color: T.red }}>{error}</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "11px", borderRadius: T.radiusSm,
                background: saving ? "#93C5FD" : T.accent, color: "#fff",
                border: "none", fontSize: 13, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", fontFamily: T.font,
              }}
            >
              {saving ? "Saving…" : "Save Update"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── APPLY LEAVE MODAL ────────────────────────────────────────────────────────
function ApplyLeaveModal({ leaveType, setLeaveType, fromDate, setFromDate, toDate, setToDate, leaveReason, setLeaveReason, handleSubmitLeave, submitting, leaveMsg, onClose, leaveData }: any) {
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (leaveMsg === "✅ Request submitted") { setSuccess(true); const t = setTimeout(onClose, 1500); return () => clearTimeout(t); }
  }, [leaveMsg, onClose]);
  const TYPES_RAW = [
    { key: "casual", label: "Casual", icon: "🌴", color: T.accent, unlimited: false },
    { key: "sick", label: "Sick", icon: "🤒", color: T.red, unlimited: false },
    { key: "lop", label: "LOP", icon: "💸", color: "#DC2626", unlimited: true },
    { key: "wfh", label: "WFH", icon: "🏠", color: T.green, unlimited: true },
  ];
  const TYPES = TYPES_RAW.filter((t) => {
    if (t.unlimited) return true;
    return (leaveData?.[t.key]?.used ?? 0) < (leaveData?.[t.key]?.quota ?? 12);
  });
  const active = TYPES.find((t) => t.label === leaveType) || TYPES[0];
  const days = fromDate && toDate ? Math.max(0, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1) : 0;
  return (
    <>
      <ModalHeader emoji="📋" title="Apply for Leave" subtitle="Submit a new leave request" onClose={onClose} />
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {success ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📩</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Request Submitted!</p>
            <p style={{ fontSize: 12, color: T.text2 }}>Awaiting manager approval</p>
          </div>
        ) : (
          <>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Leave Type</label>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${TYPES.length}, 1fr)`, gap: 8 }}>
                {TYPES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setLeaveType(t.label)}
                    style={{
                      padding: "10px 6px", borderRadius: T.radiusSm,
                      border: `1.5px solid ${leaveType === t.label ? t.color : T.border}`,
                      background: leaveType === t.label ? t.color + "10" : "#FAFAFA",
                      color: leaveType === t.label ? t.color : T.text2,
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ ...CARD_LABEL, marginBottom: 6 }}>From *</label>
                <input type="date" style={INP} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label style={{ ...CARD_LABEL, marginBottom: 6 }}>To *</label>
                <input type="date" style={INP} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            {days > 0 && active && (
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: T.radiusSm,
                  background: active.color + "08", border: `1px solid ${active.color}20`,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: active.color }}>{active.icon} {leaveType} Leave</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: active.color }}>{days} day{days !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Reason *</label>
              <textarea style={{ ...INP, resize: "vertical" }} rows={3} placeholder="Brief reason…" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
            </div>
            {leaveMsg && leaveMsg !== "✅ Request submitted" && <p style={{ fontSize: 12, color: T.red }}>{leaveMsg}</p>}
            <button
              onClick={handleSubmitLeave}
              disabled={submitting}
              style={{
                padding: "12px", borderRadius: 10,
                background: submitting ? "#f0fdf4" : "#ecfdf5", color: "#065f46",
                border: "1px solid #10b98120", fontSize: 13, fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer", fontFamily: T.font,
                opacity: submitting ? 0.7 : 1, shadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── MY LEAVES MODAL ──────────────────────────────────────────────────────────
function MyLeavesModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [leaves, setLeaves] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "leaveRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc")),
      (s) => { setLeaves(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
  }, [user]);
  const S: Record<string, { bg: string; color: string; icon: string }> = {
    Approved: { bg: T.greenLight, color: T.green, icon: "✓" },
    Rejected: { bg: T.redLight, color: T.red, icon: "✗" },
    Pending: { bg: T.orangeLight, color: T.orange, icon: "⏳" },
  };
  const counts = {
    Approved: leaves.filter((l) => l.status === "Approved").length,
    Pending: leaves.filter((l) => l.status === "Pending").length,
    Rejected: leaves.filter((l) => l.status === "Rejected").length,
  };
  return (
    <>
      <ModalHeader emoji="📜" title="My Leave History" subtitle="All your leave requests" onClose={onClose} />
      <div style={{ padding: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {(["Approved", "Pending", "Rejected"] as const).map((k) => (
            <div key={k} style={{ textAlign: "center", padding: "12px 8px", borderRadius: T.radiusSm, background: S[k].bg, border: `1px solid ${S[k].color}20` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: S[k].color }}>{counts[k]}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: S[k].color, opacity: 0.85, marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>
        {loading ? (
          <p style={{ textAlign: "center", color: T.text2, padding: "24px 0", fontSize: 13 }}>Loading…</p>
        ) : leaves.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🏖️</p>
            <p style={{ fontSize: 13, color: T.text2 }}>No leave requests yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaves.map((l) => {
              const s = S[l.status] || S["Pending"];
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: T.radiusSm, background: "#FAFAFA", border: `1px solid ${T.borderLight}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.leaveType} Leave</div>
                    <div style={{ fontSize: 11.5, color: T.text2, marginTop: 2 }}>{l.fromDate} → {l.toDate}</div>
                    {l.reason && <div style={{ fontSize: 11.5, color: T.text2, marginTop: 2, fontStyle: "italic" }}>"{l.reason}"</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.color, flexShrink: 0 }}>{s.icon} {l.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── HOLIDAYS MODAL ───────────────────────────────────────────────────────────
function HolidaysModal({ onClose }: { onClose: () => void }) {
  const [holidays, setHolidays] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    getDocs(query(collection(db, "holidays"), orderBy("date", "asc")))
      .then((snap) => { setHolidays(snap.empty ? CANONICAL_HOLIDAYS : snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => { setHolidays(CANONICAL_HOLIDAYS); setLoading(false); });
  }, []);
  const now = new Date();
  const upcoming = holidays.filter((h) => new Date(h.date + "T00:00:00") >= now);
  const past = holidays.filter((h) => new Date(h.date + "T00:00:00") < now);
  const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
    National: { bg: T.accentLight, color: T.accent },
    Festival: { bg: T.orangeLight, color: T.orange },
    Optional: { bg: T.greenLight, color: T.green },
  };
  const Row = ({ h, dim }: { h: any; dim?: boolean }) => {
    const d = new Date(h.date + "T00:00:00");
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
    const ts = TYPE_BADGE[h.type] || TYPE_BADGE.National;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderBottom: `1px solid ${T.borderLight}`, opacity: dim ? 0.45 : 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, minWidth: 52 }}>{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span style={{ fontSize: 13, color: T.text2, fontWeight: 500, flex: 1 }}>{h.title}</span>
        {!dim && daysLeft >= 0 && daysLeft <= 30 && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.green }}>{daysLeft === 0 ? "Today 🎉" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 5, background: ts.bg, color: ts.color, flexShrink: 0 }}>{h.type}</span>
      </div>
    );
  };
  return (
    <>
      <ModalHeader emoji="🎉" title={`Holidays ${new Date().getFullYear()}`} subtitle={`${upcoming.length} upcoming`} onClose={onClose} />
      <div style={{ padding: "18px 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: T.text2, padding: "24px 0" }}>Loading…</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <><p style={{ ...CARD_LABEL, marginBottom: 12 }}>Upcoming</p>{upcoming.map((h, i) => <Row key={i} h={h} />)}</>
            )}
            {past.length > 0 && (
              <><p style={{ ...CARD_LABEL, marginBottom: 12, marginTop: 20 }}>Past</p>{past.map((h, i) => <Row key={i} h={h} dim />)}</>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 1 — Employee Details + Status Strip
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeDetailsCard({ user, isCheckedIn, totalSeconds, formatTotal }: { user: any; isCheckedIn: boolean; totalSeconds: number; formatTotal: (min?: number) => string }) {
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(
      query(collection(db, "users"), where("uid", "==", user.uid)),
      (snap) => { if (!snap.empty) setProfile(snap.docs[0].data()); }
    );
  }, [user]);

  const name = profile?.name ?? profile?.displayName ?? user?.displayName ?? "Employee";
  const role = profile?.designation ?? profile?.role ?? "Employee";
  const dept = profile?.department ?? "";
  const empId = profile?.employeeId ?? profile?.empId ?? "";
  const totalWorked = Math.max(0, Math.floor(totalSeconds / 60));

  const details = [
    { icon: "📞", label: "Mobile", value: profile?.phone ?? profile?.mobile ?? "—" },
    { icon: "✉️", label: "Email", value: profile?.email ?? user?.email ?? "—" },
    { icon: "📍", label: "Location", value: profile?.address ?? profile?.workLocation ?? "—" },
    { icon: "🗓️", label: "Joined", value: profile?.dateOfJoining ?? profile?.joinDate ?? "—" },
    { icon: "🏷️", label: "Reports to", value: profile?.reportsTo ?? "—" },
  ];

  return (
    <div style={{ ...CARD, padding: 0, display: "flex", flexDirection: "column" }}>
      {/* Profile header */}
      <div style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fb 100%)", padding: "24px 20px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 8px 16px -4px rgba(0,113,227,0.3)", border: "2px solid #fff" }}>
          {getInitials(name) || "?"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px", color: T.text }}>{name}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.accent, marginTop: 3 }}>{role}</div>
          {(dept || empId) && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {dept && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", color: T.text2 }}>{dept}</span>}
              {empId && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", color: T.text2 }}>{empId}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
        <span style={{ ...CARD_LABEL, marginBottom: 10 }}>Employee Info</span>
        {details.map(({ icon, label, value }) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "20px 72px 1fr", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.borderLight}` }}>
            <span style={{ fontSize: 13, textAlign: "center" }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text3 }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Status strip */}
      <div style={{ margin: "0 16px 16px", background: T.greenLight, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: isCheckedIn ? T.green : T.text3, flexShrink: 0, boxShadow: isCheckedIn ? "0 0 0 3px rgba(52,199,89,0.2)" : "none" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{isCheckedIn ? "Checked In" : "Checked Out"}</div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 1 }}>{isCheckedIn ? `${formatTotal(totalWorked)} online today` : "Not checked in"}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: T.green }}>{formatTotal(totalWorked)}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 2 — Leave Balance
// ═══════════════════════════════════════════════════════════════════════════════
function LeaveBalanceCard({ user, onApplyLeave, onMyLeaves }: { user: any; onApplyLeave: () => void; onMyLeaves: () => void }) {
  const [leaveData, setLeaveData] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(query(collection(db, "leaveBalances"), where("uid", "==", user.uid)), (snap) => {
      if (!snap.empty) setLeaveData(snap.docs[0].data());
    });
  }, [user]);
  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(query(collection(db, "leaveRequests"), where("uid", "==", user.uid)), (snap) => {
      setLeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const rows = [
    { type: "Sick Leave", used: leaveData?.sick?.used ?? 0, total: leaveData?.sick?.quota ?? 12, color: T.accent },
    { type: "Casual Leave", used: leaveData?.casual?.used ?? 0, total: leaveData?.casual?.quota ?? 12, color: "#0EA5E9" },
  ];
  const counts = {
    Pending: leaves.filter((l) => l.status === "Pending").length,
    Approved: leaves.filter((l) => l.status === "Approved").length,
    Rejected: leaves.filter((l) => l.status === "Rejected").length,
  };

  return (
    <div style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={CARD_LABEL}>Leave Balance</span>
        <button
          onClick={onApplyLeave}
          style={{ fontSize: 11.5, fontWeight: 800, padding: "6px 14px", borderRadius: 10, background: T.accentLight, color: T.accent, border: "none", cursor: "pointer", fontFamily: T.font, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
        >
          Apply Leave
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map(({ type, used, total, color }) => {
          const left = total - used;
          const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
          const leftColor = left <= 0 ? T.red : left <= 3 ? T.orange : T.green;
          return (
            <div key={type}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{type}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: T.text3 }}>Used <strong style={{ color: T.text, fontWeight: 700 }}>{used}</strong></span>
                  <span style={{ fontSize: 11, color: T.text3 }}>Total <strong style={{ color: T.text, fontWeight: 700 }}>{total}</strong></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: leftColor }}>Left {left}</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 100 ? T.red : color, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary counts */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(0,0,0,0.05)`, display: "flex", gap: 8 }}>
        {([
          { label: "Pending", value: counts.Pending, color: T.text, icon: "⏳" },
          { label: "Approved", value: counts.Approved, color: T.green, icon: "✅" },
          { label: "Rejected", value: counts.Rejected, color: T.red, icon: "❌" },
        ] as const).map((s) => (
          <div key={s.label} onClick={onMyLeaves} style={{ flex: 1, background: "#FAFAFA", borderRadius: 12, padding: "12px", border: `1px solid rgba(0,0,0,0.05)`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 3 — Holidays
// ═══════════════════════════════════════════════════════════════════════════════
function HolidaysCard({ onViewAll }: { onViewAll: () => void }) {
  const [holidays, setHolidays] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    getDocs(query(collection(db, "holidays"), orderBy("date", "asc")))
      .then((snap) => { setHolidays(snap.empty ? CANONICAL_HOLIDAYS : snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => { setHolidays(CANONICAL_HOLIDAYS); setLoading(false); });
  }, []);

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const upcoming = holidays.filter((h) => new Date(h.date + "T00:00:00").getTime() >= todayMs).slice(0, 5);
  const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
    National: { bg: T.accentLight, color: T.accent },
    Festival: { bg: T.orangeLight, color: T.orange },
    Optional: { bg: T.greenLight, color: T.green },
  };

  return (
    <div style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>Upcoming Holidays</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: T.orangeLight, color: T.orange }}>{upcoming.length} remaining</span>
          <button onClick={onViewAll} style={{ fontSize: 11.5, fontWeight: 600, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: T.font, padding: 0 }}>View all →</button>
        </div>
      </div>
      {loading ? (
        <p style={{ color: T.text2, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Loading…</p>
      ) : (
        <div>
          {upcoming.map((h, i) => {
            const d = new Date(h.date + "T00:00:00");
            const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const ts = TYPE_BADGE[h.type] || TYPE_BADGE.National;
            const isLast = i === upcoming.length - 1;
            return (
              <div key={h.id ?? i} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`, gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, minWidth: 48, flexShrink: 0 }}>{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 12.5, color: T.text, fontWeight: 500, flex: 1 }}>{h.title}</span>
                {daysLeft >= 0 && daysLeft <= 14 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.green, flexShrink: 0 }}>
                    {daysLeft === 0 ? "Today 🎉" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                  </span>
                )}
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ts.bg, color: ts.color, flexShrink: 0 }}>{h.type ?? "Holiday"}</span>
              </div>
            );
          })}
          {upcoming.length === 0 && <p style={{ textAlign: "center", color: T.text2, fontSize: 12.5, padding: "16px 0" }}>No upcoming holidays</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 4 — Sessions  (col 1, row 3)
// ═══════════════════════════════════════════════════════════════════════════════
function SessionsCard({ sessions, formatTime, formatTotal, totalWorked }: { sessions: any[]; formatTime: (ts: any) => string; formatTotal: (min?: number) => string; totalWorked: number }) {
  const safe = sessions ?? [];
  const WEEK = [
    { day: "M", h: 7, active: false }, { day: "T", h: 8, active: false },
    { day: "W", h: 6, active: false }, { day: "Th", h: 7, active: false },
    { day: "F", h: Math.floor(totalWorked / 60) || 3, active: true },
  ];
  const maxH = Math.max(...WEEK.map((w) => w.h));

  return (
    <div style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>Today's Sessions</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{formatTotal(totalWorked)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: T.accentLight, color: T.accent }}>{safe.length} session{safe.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {safe.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <p style={{ fontSize: 26, marginBottom: 6 }}>⏱️</p>
          <p style={{ fontSize: 12.5, color: T.text2 }}>No sessions yet — check in to start!</p>
        </div>
      ) : (
        <div style={{ position: "relative", marginBottom: 4 }}>
          <div style={{ position: "absolute", left: 19, top: 12, bottom: 12, width: 1, background: T.borderLight }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {safe.map((s: any, i: number) => {
              const ciMs = s.checkIn?.toDate?.()?.getTime?.();
              const coMs = s.checkOut?.toDate?.()?.getTime?.();
              const durMin = ciMs && coMs ? Math.floor((coMs - ciMs) / 60000) : null;
              const durStr = durMin !== null ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : null;
              const isActive = !s.checkOut;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, zIndex: 1, background: isActive ? T.green : T.accent, border: `2px solid ${isActive ? T.greenLight : T.accentLight}`, boxShadow: isActive ? `0 0 0 3px ${T.greenLight}` : "none", marginLeft: 13 }} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: T.radiusSm, background: "#FAFAFA", border: `1px solid ${T.borderLight}`, gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text }}>{s.checkIn ? formatTime(s.checkIn) : "--"}</span>
                    {s.checkOut ? (
                      <>
                        <span style={{ fontSize: 10.5, color: T.text3 }}>→</span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text }}>{formatTime(s.checkOut)}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.green, background: T.greenLight, padding: "2px 8px", borderRadius: 4 }}>Active</span>
                    )}
                    {durStr && <span style={{ fontSize: 11, color: T.text3, marginLeft: "auto" }}>{durStr}</span>}
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: isActive ? T.greenLight : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: isActive ? T.green : T.accent }}>{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly bar chart */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid rgba(0,0,0,0.05)` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 8 }}>This Week</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          {WEEK.map(({ day, h, active }) => {
            const heightPx = Math.round((h / maxH) * 40);
            return (
              <div key={day} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: heightPx, background: active ? T.accent : T.accentLight, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: active ? "#fff" : T.accent }}>{h}h</div>
                <div style={{ fontSize: 9, color: T.text3, marginTop: 3 }}>{day}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 5 — Employee Directory (col 2-3, row 2)
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeDirectoryCard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const q = query(collection(db, "attendance"), where("date", "==", todayStr));
    return onSnapshot(q, (snap) => {
      const onlineSet = new Set<string>();
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const sessions = data.sessions || [];
        const last = sessions[sessions.length - 1];
        if (last && last.checkOut === null) {
          onlineSet.add(data.userId);
        }
      });
      setOnlineUserIds(onlineSet);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (e.name ?? "").toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q) || (e.designation ?? "").toLowerCase().includes(q);
  });
  const onlineCount = onlineUserIds.size;
  

  return (
    <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid rgba(0,0,0,0.05)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ ...CARD_LABEL, margin: 0 }}>Employee Directory</span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, background: "rgba(0,0,0,0.04)", padding: "2px 9px", borderRadius: 6 }}>{employees.length} Total</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenLight, padding: "2px 9px", borderRadius: 6 }}>● {onlineCount} Online</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.red, background: T.redLight, padding: "2px 9px", borderRadius: 6 }}>● {employees.length - onlineCount} Offline</span>
          </div>
        </div>
        {/* Search */}
        <div style={{ position: "relative", width: 220 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: T.text3, pointerEvents: "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            style={{ width: "100%", height: 32, border: `1px solid rgba(0,0,0,0.1)`, borderRadius: 8, padding: "0 10px 0 28px", fontSize: 12, fontFamily: T.font, color: T.text, background: "#FAFAFA", outline: "none" }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, maxHeight: 300, overflowY: "auto", padding: "4px" }}>
        {loading ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "28px", color: T.text2, fontSize: 12 }}>Loading…</div>
        ) : (
          filtered.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelected(emp)}
              onMouseEnter={() => setHovered(emp.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 20px",
                borderRadius: 16,
                cursor: "pointer",
                background: "#FAFAFA",
                border: hovered === emp.id ? `1px solid ${T.accent}30` : `1px solid ${T.borderLight}`,
                boxShadow: hovered === emp.id ? "0 4px 15px rgba(0,0,0,0.05)" : "none",
                transform: hovered === emp.id ? "translateY(-1px)" : "none",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={emp.name ?? "?"} size={38} photo={emp.profilePhoto} />
                <div style={{
                  position: "absolute", bottom: -1, right: -1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: onlineUserIds.has(emp.uid) ? T.green : T.red,
                  border: "2px solid #fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name ?? "Unnamed"}</div>
                <div style={{ fontSize: 10.5, color: T.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{emp.designation ?? emp.email ?? "—"}</div>
              </div>
            </div>
          ))
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "28px", color: T.text2, fontSize: 12 }}>No employees found</div>
        )}
      </div>

      {/* Profile modal */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={() => setSelected(null)}
        >
          <div style={{ background: T.card, borderRadius: 16, width: 320, maxWidth: "94vw", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: T.accentLight, padding: "20px", position: "relative", borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 12, right: 14, background: T.card, border: `1px solid ${T.border}`, color: T.text2, width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={selected.name ?? "?"} size={50} photo={selected.profilePhoto} />
                <div>
                  <div style={{ fontWeight: 800, color: T.text, fontSize: 15, letterSpacing: "-0.02em" }}>{selected.name ?? "Unnamed"}</div>
                  <div style={{ fontSize: 12, color: T.accent, marginTop: 2, fontWeight: 600 }}>{selected.designation ?? "Employee"}</div>
                  {selected.department && <span style={{ fontSize: 10, fontWeight: 700, background: T.card, color: T.text2, padding: "2px 8px", borderRadius: 4, display: "inline-block", marginTop: 4, border: `1px solid ${T.border}` }}>{selected.department}</span>}
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 20px 20px" }}>
              {[
                { icon: "✉️", label: "Email", value: selected.email ?? "—" },
                { icon: "📞", label: "Phone", value: selected.phone ?? "—" },
                { icon: "🏷️", label: "Role", value: selected.accountType ?? "Employee" },
                { icon: "📅", label: "Joined", value: selected.dateOfJoining ?? selected.joinDate ?? "—" },
                { icon: "📍", label: "Location", value: selected.workLocation ?? "—" },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                  <span style={{ fontSize: 13, flexShrink: 0, width: 20, textAlign: "center" }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.text3, textTransform: "uppercase" as const, letterSpacing: ".5px" }}>{r.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{r.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 6 — My Projects (col 2-3, row 3)
// ═══════════════════════════════════════════════════════════════════════════════
function MyProjectsCard({ user }: { user: any }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    let unsubscribed = false;
    const tryListen = (fieldName: string, value: any) => {
      try {
        return onSnapshot(
          query(collection(db, "projects"), where(fieldName, "array-contains", value)),
          (snap) => { if (!unsubscribed) { setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); } },
          () => {}
        );
      } catch { return undefined; }
    };
    let unsub = tryListen("assignedTo", user.uid);
    const timeout = setTimeout(async () => {
      if (!unsubscribed && loading) {
        for (const [field, val] of [["members", user.uid], ["assignedTo", user.email], ["uid", user.uid], ["assignedToEmail", user.email]] as [string, string][]) {
          try { const snap = await getDocs(query(collection(db, "projects"), where(field, "array-contains", val))); if (!snap.empty && !unsubscribed) { setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); return; } } catch {}
          try { const snap = await getDocs(query(collection(db, "projects"), where(field, "==", val))); if (!snap.empty && !unsubscribed) { setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); return; } } catch {}
        }
        if (!unsubscribed) setLoading(false);
      }
    }, 2000);
    return () => { unsubscribed = true; unsub?.(); clearTimeout(timeout); };
  }, [user]);

  const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
    "In Progress": { color: T.accent, bg: T.accentLight },
    "Completed":   { color: T.green, bg: T.greenLight },
    "On Track":    { color: T.green, bg: T.greenLight },
    "Review":      { color: T.orange, bg: T.orangeLight },
    "In Review":   { color: T.orange, bg: T.orangeLight },
    "Blocked":     { color: T.red, bg: T.redLight },
    "Overdue":     { color: T.red, bg: T.redLight },
    "Planning":    { color: T.text2, bg: "rgba(0,0,0,0.05)" },
    "Not Started": { color: T.text2, bg: "rgba(0,0,0,0.05)" },
  };

  const fmtDue = (raw: any) => {
    if (!raw) return null;
    if (raw?.toDate) return raw.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    try { return new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return String(raw); }
  };

  return (
    <div style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>My Projects</span>
        {projects.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: T.accentLight, color: T.accent }}>{projects.length} active</span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 52, borderRadius: T.radiusSm, background: "rgba(0,0,0,0.04)" }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📁</p>
          <p style={{ fontSize: 13, color: T.text2 }}>No projects assigned yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((p) => {
            const id = p.id;
            const title = p.name ?? p.title ?? p.projectName ?? "Untitled";
            const progress = Math.min(Number(p.progress ?? p.completion ?? p.percent ?? 0), 100);
            const status = p.status ?? p.projectStatus ?? "In Progress";
            const cfg = STATUS_CONFIG[status] ?? { color: T.accent, bg: T.accentLight };
            const due = fmtDue(p.dueDate ?? p.due ?? p.deadline ?? p.endDate);
            const isHov = hovered === id;
            return (
              <div
                key={id}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  borderLeft: `3px solid ${cfg.color}`,
                  borderTop: `1px solid rgba(0,0,0,0.04)`,
                  borderRight: `1px solid rgba(0,0,0,0.04)`,
                  borderBottom: `1px solid rgba(0,0,0,0.04)`,
                  background: isHov ? "#F5F5F7" : "#FAFAFA",
                  transform: isHov ? "translateX(2px)" : "none",
                  transition: "all 0.15s", cursor: "default",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
                  {due && <div style={{ fontSize: 11, color: T.text3, fontWeight: 500, marginTop: 2 }}>Due {due}</div>}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: cfg.bg, color: cfg.color, flexShrink: 0, whiteSpace: "nowrap" }}>{status}</span>
                <div style={{ width: 80, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${progress}%`, background: progress >= 100 ? T.green : cfg.color, transition: "width 1s ease" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, minWidth: 28, textAlign: "right" }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── Small Notice Ticker ────────────────────────────────────────────────────────
const SmallNoticeTicker = ({ announcements }: { announcements?: { id: string; text: string }[] }) => {
  if (!announcements || announcements.length === 0) return null;

  return (
    <div style={{
      flex: "1",
      minWidth: "280px",
      maxWidth: "500px",
      background: "#eff6ff",
      borderRadius: "100px",
      padding: "8px 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      overflow: "hidden",
      border: "1px solid #dbeafe",
      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>📢</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notice:</span>
      </div>
      <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
        <div
          className="ticker-content"
          style={{
            display: "inline-block",
            paddingLeft: "100%",
            animation: "ticker-scroll 12s linear infinite",
            fontSize: "12px",
            fontWeight: 600,
            color: "#1e40af",
            textTransform: "capitalize",
          }}
        >
          <div style={{ display: "flex", gap: 40 }}>
            {announcements.map((a) => (
              <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                 {a.text}
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .ticker-content:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
};

export default function DashboardView({
  user, isCheckedIn, sessions,
  formatTotal = (min = 0) => { const m = min < 0 ? 0 : min; return `${Math.floor(m / 60)}h ${m % 60}m`; },
  formatTime = (ts: any) => { try { return ts?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "--"; } catch { return "--"; } },
  leaveType, setLeaveType, fromDate, setFromDate, toDate, setToDate,
  leaveReason, setLeaveReason, handleSubmitLeave, submitting, leaveMsg,
  totalSeconds = 0, onGoToChat, onOpenMeetChat, announcements,
}: Props) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [leaveNotifications, setLeaveNotifs] = useState<any[]>([]);
  const [queryNotifications, setQueryNotifs] = useState<any[]>([]);
  const [employeeLeaveData, setEmployeeLeaveData] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const [profile, setProfile] = useState<any>(null);

  const close = useCallback(() => setActiveModal(null), []);

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "users"), where("uid", "==", user.uid)), (snap) => { if (!snap.empty) setProfile(snap.docs[0].data()); }); }, [user]);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "leaveBalances"), where("uid", "==", user.uid)), (snap) => { if (!snap.empty) setEmployeeLeaveData(snap.docs[0].data()); }); }, [user]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "leaveRequests"), where("uid", "==", user.uid), where("status", "in", ["Approved", "Rejected"]), where("notificationRead", "==", false)), (s) => setLeaveNotifs(s.docs.map((d) => ({ id: d.id, ...d.data() })))); }, [user]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "employeeQueries"), where("employeeId", "==", user.uid), where("employeeUnread", "==", true)), (s) => setQueryNotifs(s.docs.map((d) => ({ id: d.id, ...d.data() })))); }, [user]);

  const markLeaveNotifRead = (id: string) => updateDoc(doc(db, "leaveRequests", id), { notificationRead: true });
  const markQueryNotifRead = (id: string) => updateDoc(doc(db, "employeeQueries", id), { employeeUnread: false });

  const totalWorked = Math.max(0, Math.floor(totalSeconds / 60));
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetEmoji = hour < 12 ? "🌤️" : hour < 17 ? "☀️" : "🌙";
  const userName = profile?.name ?? profile?.displayName ?? user?.displayName ?? "Employee";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      style={{
        fontFamily: T.font,
        background: T.bg,
        minHeight: "100vh",
        padding: "1px 16px 56px",
        color: T.text,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: #AEAEB2; }
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── MODALS ── */}
      {activeModal === "workUpdate"    && <Modal onClose={close}><WorkUpdateModal onClose={close} /></Modal>}
      {activeModal === "applyLeave"    && <Modal onClose={close} wide><ApplyLeaveModal leaveType={leaveType} setLeaveType={setLeaveType} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} leaveReason={leaveReason} setLeaveReason={setLeaveReason} handleSubmitLeave={handleSubmitLeave} submitting={submitting} leaveMsg={leaveMsg} onClose={close} leaveData={employeeLeaveData} /></Modal>}
      {activeModal === "holidays"      && <Modal onClose={close}><HolidaysModal onClose={close} /></Modal>}
      {activeModal === "myLeaves"      && <Modal onClose={close} wide><MyLeavesModal user={user} onClose={close} /></Modal>}
      {activeModal === "notifications" && <Modal onClose={close} wide><ModalHeader emoji="🔔" title="Notifications" subtitle="Stay up to date" onClose={close} /><NotificationsView leaveNotifications={leaveNotifications} markNotificationAsRead={markLeaveNotifRead} queryNotifications={queryNotifications} markQueryNotificationAsRead={markQueryNotifRead} onClose={close} hideHeader={true} onGoToChat={(chatId) => { close(); onGoToChat?.(chatId); }} /></Modal>}
      {activeModal === "help"          && <Modal onClose={close} wide><ModalHeader emoji="💬" title="Help & Support" subtitle="Raise a ticket or browse FAQs" onClose={close} /><HelpView /></Modal>}

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 4, gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.2 }}>
            <span style={{ marginLeft: -6 }}>{greetEmoji}</span> {greeting}, {userName.split(" ")[0]}
          </h1>
          <p style={{ fontSize: 14, color: T.text2, marginTop: 6, fontWeight: 600, letterSpacing: "0.01em" }}>{dateStr}</p>
        </div>
        <SmallNoticeTicker announcements={announcements} />
      </div>

      {/* ── BENTO GRID — exact layout 1 ── */}
      {/*
        Col 1 (320px fixed) : Profile spans rows 1-2 │ Sessions row 3
        Col 2 (1fr)         : Leave Balance row 1    │ Directory spans cols 2-3 row 2 │ Projects spans cols 2-3 row 3
        Col 3 (1fr)         : Holidays row 1         │ (directory) │ (projects)
      */}
       <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EmployeeDetailsCard user={user} isCheckedIn={isCheckedIn} totalSeconds={totalSeconds} formatTotal={formatTotal} />
          <SessionsCard sessions={sessions} formatTime={formatTime} formatTotal={formatTotal} totalWorked={totalWorked} />
        </div>
        <div style={{ gridColumn: "2 / 4", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <LeaveBalanceCard user={user} onApplyLeave={() => setActiveModal("applyLeave")} onMyLeaves={() => setActiveModal("myLeaves")} />
          <HolidaysCard onViewAll={() => setActiveModal("holidays")} />
          <div style={{ gridColumn: "1 / 3" }}><EmployeeDirectoryCard /></div>
          <div style={{ gridColumn: "1 / 3" }}><MyProjectsCard user={user} /></div>
        </div>
      </div>
    </div>
  );
}