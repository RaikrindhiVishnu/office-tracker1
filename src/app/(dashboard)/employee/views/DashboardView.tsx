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
  bg: "#F5F7FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  text: "#111827",
  textMid: "#374151",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  accent: "#4F46E5",
  accentLight: "#EEF2FF",
  accentMid: "#C7D2FE",
  success: "#059669",
  successLight: "#D1FAE5",
  warning: "#D97706",
  warningLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  radius: "12px",
  radiusSm: "8px",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
  font: "'DM Sans', 'Inter', system-ui, sans-serif",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return (name ?? "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
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
  if (photo) return (
    <img src={photo} alt={name} style={{
      width: size, height: size, borderRadius: size * 0.3,
      objectFit: "cover", flexShrink: 0,
    }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      letterSpacing: "-0.02em",
    }}>
      {getInitials(name)}
    </div>
  );
}

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  National: { bg: T.accentLight, color: T.accent },
  Festival: { bg: T.warningLight, color: T.warning },
  Optional: { bg: T.successLight, color: T.success },
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const CARD_STYLE: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  padding: "20px",
  boxShadow: T.shadow,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: T.textFaint,
  textTransform: "uppercase", letterSpacing: "0.08em",
  marginBottom: 0, display: "block",
};

const INP_STYLE: React.CSSProperties = {
  width: "100%", border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, padding: "9px 12px",
  fontSize: 13, color: T.textMid, outline: "none",
  background: "#FAFAFA", fontFamily: T.font, boxSizing: "border-box",
  transition: "border-color 0.15s",
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
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        width: "100%", maxWidth: wide ? 600 : 440,
        borderRadius: "16px 16px 0 0", background: T.card,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        overflow: "hidden", margin: "0 auto",
      }}>
        <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalHeader({ emoji, title, subtitle, onClose }: { emoji: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div style={{
      padding: "18px 20px 14px", borderBottom: `1px solid ${T.borderLight}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: T.radiusSm,
          background: T.accentLight, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
        }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <button onClick={onClose} style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `1px solid ${T.border}`, background: "#FAFAFA",
        cursor: "pointer", fontSize: 16, color: T.textMuted,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>×</button>
    </div>
  );
}

// ─── WORK UPDATE MODAL ────────────────────────────────────────────────────────
function WorkUpdateModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [task, setTask] = useState(""); const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("In Progress"); const [priority, setPri] = useState("Medium");
  const [saving, setSaving] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  const STATUSES = [{ label: "In Progress", color: T.accent, icon: "🔄" }, { label: "Completed", color: T.success, icon: "✅" }, { label: "In Review", color: T.warning, icon: "👀" }];
  const PRIORITIES = [{ label: "Low", color: T.success }, { label: "Medium", color: T.warning }, { label: "High", color: T.danger }];
  useEffect(() => { if (done) { const t = setTimeout(onClose, 1200); return () => clearTimeout(t); } }, [done, onClose]);
  const handleSave = async () => {
    if (!task.trim() && !notes.trim()) { setError("Please enter a task or notes."); return; }
    if (!user) return;
    try {
      setSaving(true); setError("");
      await addDoc(collection(db, "workUpdates"), { uid: user.uid, userEmail: user.email ?? "", userName: user.email?.split("@")[0] ?? "Unknown", task: task.trim(), notes: notes.trim(), status, priority, createdAt: serverTimestamp() });
      setDone(true);
    } catch { setError("Failed to save. Please try again."); } finally { setSaving(false); }
  };
  return (
    <>
      <ModalHeader emoji="✏️" title="Work Update" subtitle="Log what you're working on today" onClose={onClose} />
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.successLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Update Saved!</p>
          </div>
        ) : (
          <>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Task *</label>
              <input style={INP_STYLE} placeholder="e.g. Fixing login bug…" value={task} onChange={e => setTask(e.target.value)} />
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Status</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {STATUSES.map(s => (
                  <button key={s.label} onClick={() => setStatus(s.label)} style={{
                    padding: "9px 6px", borderRadius: T.radiusSm,
                    border: `1.5px solid ${status === s.label ? s.color : T.border}`,
                    background: status === s.label ? s.color + "12" : "#FAFAFA",
                    color: status === s.label ? s.color : T.textMuted,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "all 0.15s",
                  }}>{s.icon} {s.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORITIES.map(p => (
                  <button key={p.label} onClick={() => setPri(p.label)} style={{
                    flex: 1, padding: "9px 0", borderRadius: T.radiusSm,
                    border: `1.5px solid ${priority === p.label ? p.color : T.border}`,
                    background: priority === p.label ? p.color + "12" : "#FAFAFA",
                    color: priority === p.label ? p.color : T.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font,
                    transition: "all 0.15s",
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Notes</label>
              <textarea style={{ ...INP_STYLE, resize: "vertical" as const }} rows={3} placeholder="Progress, blockers…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {error && <p style={{ fontSize: 12, color: T.danger }}>{error}</p>}
            <button onClick={handleSave} disabled={saving} style={{
              padding: "11px", borderRadius: T.radiusSm,
              background: saving ? T.accentMid : T.accent, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: T.font,
              transition: "background 0.15s",
            }}>{saving ? "Saving…" : "Save Update"}</button>
          </>
        )}
      </div>
    </>
  );
}

// ─── APPLY LEAVE MODAL ────────────────────────────────────────────────────────
function ApplyLeaveModal({ leaveType, setLeaveType, fromDate, setFromDate, toDate, setToDate, leaveReason, setLeaveReason, handleSubmitLeave, submitting, leaveMsg, onClose, leaveData }: any) {
  const [success, setSuccess] = useState(false);
  useEffect(() => { if (leaveMsg === "✅ Request submitted") { setSuccess(true); const t = setTimeout(onClose, 1500); return () => clearTimeout(t); } }, [leaveMsg, onClose]);
  const TYPES_RAW = [
    { key: "casual", label: "Casual", icon: "🌴", color: T.accent, unlimited: false },
    { key: "sick", label: "Sick", icon: "🤒", color: T.danger, unlimited: false },
    { key: "lop", label: "LOP", icon: "💸", color: "#DC2626", unlimited: true },
    { key: "wfh", label: "WFH", icon: "🏠", color: T.success, unlimited: true },
  ];
  const TYPES = TYPES_RAW.filter(t => { if (t.unlimited) return true; return (leaveData?.[t.key]?.used ?? 0) < (leaveData?.[t.key]?.quota ?? 12); });
  const active = TYPES.find(t => t.label === leaveType) || TYPES[0];
  const days = fromDate && toDate ? Math.max(0, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1) : 0;
  return (
    <>
      <ModalHeader emoji="📋" title="Apply for Leave" subtitle="Submit a new leave request" onClose={onClose} />
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {success ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.successLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📩</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Request Submitted!</p>
            <p style={{ fontSize: 12, color: T.textMuted }}>Awaiting manager approval</p>
          </div>
        ) : (
          <>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Leave Type</label>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${TYPES.length}, 1fr)`, gap: 8 }}>
                {TYPES.map(t => (
                  <button key={t.label} onClick={() => setLeaveType(t.label)} style={{
                    padding: "10px 6px", borderRadius: T.radiusSm,
                    border: `1.5px solid ${leaveType === t.label ? t.color : T.border}`,
                    background: leaveType === t.label ? t.color + "10" : "#FAFAFA",
                    color: leaveType === t.label ? t.color : T.textMuted,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: "all 0.15s",
                  }}><span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={{ ...LABEL_STYLE, marginBottom: 6 }}>From *</label><input type="date" style={INP_STYLE} value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
              <div><label style={{ ...LABEL_STYLE, marginBottom: 6 }}>To *</label><input type="date" style={INP_STYLE} value={toDate} onChange={e => setToDate(e.target.value)} /></div>
            </div>
            {days > 0 && active && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: T.radiusSm,
                background: active.color + "08", border: `1px solid ${active.color}20`,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: active.color }}>{active.icon} {leaveType} Leave</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: active.color }}>{days} day{days !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div><label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Reason *</label><textarea style={{ ...INP_STYLE, resize: "vertical" as const }} rows={3} placeholder="Brief reason…" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} /></div>
            {leaveMsg && leaveMsg !== "✅ Request submitted" && <p style={{ fontSize: 12, color: T.danger }}>{leaveMsg}</p>}
            <button onClick={handleSubmitLeave} disabled={submitting} style={{
              padding: "11px", borderRadius: T.radiusSm,
              background: submitting ? "#6EE7B7" : T.success, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", fontFamily: T.font, opacity: submitting ? 0.7 : 1,
            }}>{submitting ? "Submitting…" : "Submit Request"}</button>
          </>
        )}
      </div>
    </>
  );
}

// ─── MY LEAVES MODAL ──────────────────────────────────────────────────────────
function MyLeavesModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [leaves, setLeaves] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "leaveRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc")), s => { setLeaves(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }); }, [user]);
  const S: Record<string, { bg: string; color: string; icon: string }> = {
    Approved: { bg: T.successLight, color: T.success, icon: "✓" },
    Rejected: { bg: T.dangerLight, color: T.danger, icon: "✗" },
    Pending: { bg: T.warningLight, color: T.warning, icon: "⏳" },
  };
  const counts = { Approved: leaves.filter(l => l.status === "Approved").length, Pending: leaves.filter(l => l.status === "Pending").length, Rejected: leaves.filter(l => l.status === "Rejected").length };
  return (
    <>
      <ModalHeader emoji="📜" title="My Leave History" subtitle="All your leave requests" onClose={onClose} />
      <div style={{ padding: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {(["Approved", "Pending", "Rejected"] as const).map(k => (
            <div key={k} style={{ textAlign: "center", padding: "12px 8px", borderRadius: T.radiusSm, background: S[k].bg, border: `1px solid ${S[k].color}20` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: S[k].color }}>{counts[k]}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: S[k].color, opacity: 0.85, marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>
        {loading ? <p style={{ textAlign: "center", color: T.textMuted, padding: "24px 0", fontSize: 13 }}>Loading…</p>
          : leaves.length === 0
            ? <div style={{ textAlign: "center", padding: "32px 0" }}><p style={{ fontSize: 32, marginBottom: 8 }}>🏖️</p><p style={{ fontSize: 13, color: T.textMuted }}>No leave requests yet</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaves.map(l => {
                const s = S[l.status] || S["Pending"]; return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: T.radiusSm, background: "#FAFAFA", border: `1px solid ${T.borderLight}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.leaveType} Leave</div>
                      <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{l.fromDate} → {l.toDate}</div>
                      {l.reason && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, fontStyle: "italic" }}>"{l.reason}"</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.color, flexShrink: 0 }}>{s.icon} {l.status}</span>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </>
  );
}

// ─── HOLIDAYS MODAL ───────────────────────────────────────────────────────────
function HolidaysModal({ onClose }: { onClose: () => void }) {
  const [holidays, setHolidays] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { getDocs(query(collection(db, "holidays"), orderBy("date", "asc"))).then(snap => { setHolidays(snap.empty ? CANONICAL_HOLIDAYS : snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }).catch(() => { setHolidays(CANONICAL_HOLIDAYS); setLoading(false); }); }, []);
  const now = new Date(); const upcoming = holidays.filter(h => new Date(h.date + "T00:00:00") >= now); const past = holidays.filter(h => new Date(h.date + "T00:00:00") < now);
  const Row = ({ h, dim }: { h: any; dim?: boolean }) => {
    const d = new Date(h.date + "T00:00:00"); const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000); const ts = TYPE_BADGE[h.type] || TYPE_BADGE.National;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderBottom: `1px solid ${T.borderLight}`, opacity: dim ? 0.45 : 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, minWidth: 52 }}>{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span style={{ fontSize: 13, color: T.textMid, fontWeight: 500, flex: 1 }}>{h.title}</span>
        {!dim && daysLeft >= 0 && daysLeft <= 30 && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.success }}>{daysLeft === 0 ? "Today 🎉" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 5, background: ts.bg, color: ts.color, flexShrink: 0 }}>{h.type}</span>
      </div>
    );
  };
  return (
    <>
      <ModalHeader emoji="🎉" title={`Holidays ${new Date().getFullYear()}`} subtitle={`${upcoming.length} upcoming`} onClose={onClose} />
      <div style={{ padding: "18px 20px" }}>
        {loading ? <p style={{ textAlign: "center", color: T.textMuted, padding: "24px 0" }}>Loading…</p> : <>
          {upcoming.length > 0 && <><p style={{ ...LABEL_STYLE, marginBottom: 12 }}>Upcoming</p>{upcoming.map((h, i) => <Row key={i} h={h} />)}</>}
          {past.length > 0 && <><p style={{ ...LABEL_STYLE, marginBottom: 12, marginTop: 20 }}>Past</p>{past.map((h, i) => <Row key={i} h={h} dim />)}</>}
        </>}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT COLUMN CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeDetailsCard({ user }: { user: any }) {
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "users"), where("uid", "==", user.uid)), snap => { if (!snap.empty) setProfile(snap.docs[0].data()); }); }, [user]);
  const name = profile?.name ?? profile?.displayName ?? user?.displayName ?? "Employee";
  const role = profile?.designation ?? profile?.role ?? "Employee";
  const dept = profile?.department ?? "";
  const empId = profile?.employeeId ?? profile?.empId ?? "";
  const details = [
    { icon: "📞", label: "Mobile", value: profile?.phone ?? profile?.mobile ?? "—" },
    { icon: "✉️", label: "Email", value: profile?.email ?? user?.email ?? "—" },
    { icon: "📍", label: "Location", value: profile?.address ?? profile?.workLocation ?? "—" },
    { icon: "🗓️", label: "Joined", value: profile?.dateOfJoining ?? profile?.joinDate ?? "—" },
  ];
  return (
    <div style={CARD_STYLE}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: `1px solid ${T.borderLight}`, marginBottom: 16 }}>
        <Avatar name={name} size={48} photo={profile?.profilePhoto} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, marginTop: 3 }}>{role}</div>
          {(dept || empId) && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              {dept && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, background: T.bg, border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 5 }}>{dept}</span>}
              {empId && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, background: T.bg, border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 5 }}>{empId}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <p style={{ ...LABEL_STYLE, marginBottom: 12 }}>Employee Information</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {details.map(({ icon, label, value }) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "20px 60px 1fr", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.borderLight}` }}>
            <span style={{ fontSize: 13, textAlign: "center" }}>{icon}</span>
            <span style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 12.5, color: T.textMid, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveStatusCard({ user, onApplyLeave }: { user: any; onApplyLeave: () => void }) {
  const [leaveData, setLeaveData] = useState<any>(null);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "leaveBalances"), where("uid", "==", user.uid)), snap => { if (!snap.empty) setLeaveData(snap.docs[0].data()); }); }, [user]);
  const rows = [
    { type: "Sick Leave", used: leaveData?.sick?.used ?? 0, total: leaveData?.sick?.quota ?? 12, color: T.accent },
    { type: "Casual Leave", used: leaveData?.casual?.used ?? 0, total: leaveData?.casual?.quota ?? 12, color: "#0EA5E9" },
  ];
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={LABEL_STYLE}>Leave Balance</p>
        <button onClick={onApplyLeave} style={{
          fontSize: 11.5, fontWeight: 700, padding: "5px 12px",
          borderRadius: T.radiusSm, background: T.accent, color: "#fff",
          border: "none", cursor: "pointer", fontFamily: T.font,
          transition: "opacity 0.15s",
        }}>Apply Leave</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map(({ type, used, total, color }) => {
          const left = total - used; const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
          const leftColor = left <= 0 ? T.danger : left <= 3 ? T.warning : T.success;
          return (
            <div key={type}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{type}</span>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: T.textFaint }}>Used <strong style={{ color: T.textMid, fontWeight: 700 }}>{used}</strong></span>
                  <span style={{ fontSize: 11.5, color: T.textFaint }}>Total <strong style={{ color: T.textMid, fontWeight: 700 }}>{total}</strong></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: leftColor }}>Left {left}</span>
                </div>
              </div>
              <div style={{ height: 3, borderRadius: 99, background: T.borderLight, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 100 ? T.danger : color, transition: "width 1s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
          snap => { if (!unsubscribed) { setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); } },
          () => { }
        );
      } catch { return undefined; }
    };
    let unsub = tryListen("assignedTo", user.uid);
    const timeout = setTimeout(async () => {
      if (!unsubscribed && loading) {
        for (const [field, val] of [["members", user.uid], ["assignedTo", user.email], ["uid", user.uid], ["assignedToEmail", user.email]] as [string, string][]) {
          try { const snap = await getDocs(query(collection(db, "projects"), where(field, "array-contains", val))); if (!snap.empty && !unsubscribed) { setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); return; } } catch { }
          try { const snap = await getDocs(query(collection(db, "projects"), where(field, "==", val))); if (!snap.empty && !unsubscribed) { setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); return; } } catch { }
        }
        if (!unsubscribed) setLoading(false);
      }
    }, 2000);
    return () => { unsubscribed = true; unsub?.(); clearTimeout(timeout); };
  }, [user]);

  const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
    "In Progress": { color: T.accent, bg: T.accentLight },
    "Completed": { color: T.success, bg: T.successLight },
    "On Track": { color: T.success, bg: T.successLight },
    "Review": { color: T.warning, bg: T.warningLight },
    "In Review": { color: T.warning, bg: T.warningLight },
    "Blocked": { color: T.danger, bg: T.dangerLight },
    "Overdue": { color: T.danger, bg: T.dangerLight },
    "Planning": { color: T.textMuted, bg: T.borderLight },
    "Not Started": { color: T.textMuted, bg: T.borderLight },
  };

  const fmtDue = (raw: any) => {
    if (!raw) return null;
    if (raw?.toDate) return raw.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    try { return new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return String(raw); }
  };

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={LABEL_STYLE}>My Projects</p>
        {projects.length > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, background: T.accentLight, padding: "2px 9px", borderRadius: 5 }}>{projects.length} active</span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 72, borderRadius: T.radiusSm, background: T.borderLight, animation: "shimmer 1.5s infinite" }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📁</p>
          <p style={{ fontSize: 13, color: T.textMuted }}>No projects assigned yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map(p => {
            const id = p.id;
            const title = p.name ?? p.title ?? p.projectName ?? "Untitled";
            const progress = Math.min(Number(p.progress ?? p.completion ?? p.percent ?? 0), 100);
            const status = p.status ?? p.projectStatus ?? "In Progress";
            const cfg = STATUS_CONFIG[status] ?? { color: T.accent, bg: T.accentLight };
            const due = fmtDue(p.dueDate ?? p.due ?? p.deadline ?? p.endDate);
            const barColor = progress >= 100 ? T.success : T.accent;
            const isHov = hovered === id;
            return (
              <div key={id}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: "12px 14px", borderRadius: T.radiusSm,
                  background: isHov ? "#FAFAFA" : "#FAFAFA",
                  borderTop: `1px solid ${isHov ? T.border : T.borderLight}`,
                  borderRight: `1px solid ${isHov ? T.border : T.borderLight}`,
                  borderBottom: `1px solid ${isHov ? T.border : T.borderLight}`,
                  borderLeft: `3px solid ${cfg.color}`,
                  transition: "all 0.2s ease", cursor: "default",
                  transform: isHov ? "translateX(2px)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1, lineHeight: 1.3 }}>{title}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "2px 8px",
                    borderRadius: 5, background: cfg.bg, color: cfg.color, flexShrink: 0, whiteSpace: "nowrap",
                  }}>{status}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 99, background: T.borderLight, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${progress}%`, background: barColor, transition: "width 1s ease" }} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textMuted, minWidth: 30, textAlign: "right" }}>{progress}%</span>
                </div>
                {due && <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginTop: 6 }}>Due {due}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionsCard({ sessions, formatTime, formatTotal, totalWorked }: { sessions: any[]; formatTime: (ts: any) => string; formatTotal: (min?: number) => string; totalWorked: number }) {
  const safe = sessions ?? [];
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={LABEL_STYLE}>Today's Sessions</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.textMid }}>{formatTotal(totalWorked)}</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: T.accent, background: T.accentLight, padding: "2px 9px", borderRadius: 5 }}>{safe.length} session{safe.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {safe.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 26, marginBottom: 6 }}>⏱️</p>
          <p style={{ fontSize: 12.5, color: T.textMuted }}>No sessions yet — check in to start!</p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{ position: "absolute", left: 19, top: 12, bottom: 12, width: 1, background: T.borderLight }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {safe.map((s: any, i: number) => {
              const ciMs = s.checkIn?.toDate?.()?.getTime?.(); const coMs = s.checkOut?.toDate?.()?.getTime?.();
              const durMin = ciMs && coMs ? Math.floor((coMs - ciMs) / 60000) : null;
              const durStr = durMin !== null ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : null;
              const isActive = !s.checkOut;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 0 }}>
                  {/* Dot */}
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", flexShrink: 0, zIndex: 1,
                    background: isActive ? T.success : T.accent,
                    border: `2px solid ${isActive ? T.successLight : T.accentLight}`,
                    boxShadow: isActive ? `0 0 0 3px ${T.successLight}` : "none",
                    marginLeft: 13,
                  }} />
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center",
                    padding: "8px 12px", borderRadius: T.radiusSm,
                    background: "#FAFAFA", border: `1px solid ${T.borderLight}`,
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMid }}>
                      {s.checkIn ? formatTime(s.checkIn) : "--"}
                    </span>
                    {s.checkOut ? (
                      <>
                        <span style={{ fontSize: 10.5, color: T.textFaint }}>→</span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMid }}>{formatTime(s.checkOut)}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.success, background: T.successLight, padding: "2px 8px", borderRadius: 4 }}>Active</span>
                    )}
                    {durStr && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: "auto" }}>{durStr}</span>}
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: isActive ? T.successLight : T.accentLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: isActive ? T.success : T.accent,
                  }}>{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIGHT COLUMN CARDS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── HOLIDAYS CARD ─────────────────────────────────────────────────────────────
function HolidaysCard({ onViewAll }: { onViewAll: () => void }) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getDocs(query(collection(db, "holidays"), orderBy("date", "asc")))
      .then(snap => { setHolidays(snap.empty ? CANONICAL_HOLIDAYS : snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => { setHolidays(CANONICAL_HOLIDAYS); setLoading(false); });
  }, []);
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const upcoming = holidays.filter(h => new Date(h.date + "T00:00:00").getTime() >= todayMs);

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={LABEL_STYLE}>Upcoming Holidays</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.warning, background: T.warningLight, padding: "2px 9px", borderRadius: 5 }}>{upcoming.length} remaining</span>
          <button onClick={onViewAll} style={{ fontSize: 11.5, fontWeight: 600, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: T.font, padding: 0, transition: "opacity 0.15s" }}>View all →</button>
        </div>
      </div>
      {loading ? <p style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Loading…</p> : (
        <div>
          {upcoming.map((h, i) => {
            const d = new Date(h.date + "T00:00:00");
            const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const ts = TYPE_BADGE[h.type] || TYPE_BADGE.National;
            const isLast = i === upcoming.length - 1;
            const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            return (
              <div key={h.id ?? i} style={{
                display: "flex", alignItems: "center",
                padding: "9px 0", borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`,
                gap: 12,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, minWidth: 54, flexShrink: 0 }}>{dateLabel}</span>
                <span style={{ fontSize: 13, color: T.textMid, fontWeight: 500, flex: 1 }}>{h.title}</span>
                {daysLeft >= 0 && daysLeft <= 14 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.success, flexShrink: 0 }}>
                    {daysLeft === 0 ? "Today 🎉" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                  </span>
                )}
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: ts.bg, color: ts.color, flexShrink: 0 }}>
                  {h.type ?? "Holiday"}
                </span>
              </div>
            );
          })}
          {upcoming.length === 0 && <p style={{ textAlign: "center", color: T.textMuted, fontSize: 12.5, padding: "16px 0" }}>No upcoming holidays</p>}
        </div>
      )}
    </div>
  );
}

// ─── MEET CHAT CARD ───────────────────────────────────────────────────────────
function MeetChatCard({
  onGoToChat,
  onOpenMeetChat,
  user,
}: {
  onGoToChat?: (chatId: string) => void;
  onOpenMeetChat?: () => void;
  user: any;
}) {
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Open the MeetChat overlay — always use onOpenMeetChat, never window.open
  const openChat = useCallback((chatId?: string) => {
    if (onOpenMeetChat) {
      onOpenMeetChat();
    }
    // After overlay opens, navigate to specific chat if provided
    if (chatId && onGoToChat) {
      setTimeout(() => onGoToChat(chatId), 80);
    }
  }, [onOpenMeetChat, onGoToChat]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc"),
      limit(5),
    );
    return onSnapshot(q, snap => {
      setRecentChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(
      query(collection(db, "notifications"), where("toUid", "==", user.uid), where("read", "==", false)),
      s => setUnreadCount(s.size),
    );
  }, [user]);

  const getOtherName = (chat: any) => {
    const me = user?.displayName ?? user?.email ?? "";
    const others = (chat.participantNames ?? []).filter((n: string) => n !== me);
    return others[0] ?? chat.name ?? "Chat";
  };

  const truncate = (str: string, n = 38) => str.length > n ? str.slice(0, n) + "…" : str;

  const fmtTime = (ts: any) => {
    try {
      const d = ts?.toDate?.();
      if (!d) return "";
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return "now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
      if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString([], { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  const MEET_ORANGE = "#E8512A";
  const MEET_LIGHT = "#FFF3EF";
  const MEET_BORDER = "#FDDDD4";

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      boxShadow: T.shadow,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Header banner ── */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: `1px solid ${MEET_BORDER}`,
        background: MEET_LIGHT,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {/* MeetChat icon */}
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: MEET_ORANGE,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1 }}>
              Meet<span style={{ color: MEET_ORANGE }}>Chat</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, fontWeight: 500 }}>Messaging & calls</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: "#fff",
              background: MEET_ORANGE, padding: "2px 8px", borderRadius: 99,
              letterSpacing: "0.01em",
            }}>{unreadCount}</span>
          )}
          {/* Open MeetChat full button */}
          {/* <button
            onClick={() => openChat()}
            title="Open MeetChat"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: T.radiusSm,
              border: `1.5px solid ${MEET_BORDER}`,
              background: T.card, color: MEET_ORANGE,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              fontFamily: T.font, transition: "all 0.15s",
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = MEET_ORANGE; b.style.color = "#fff"; b.style.borderColor = MEET_ORANGE; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = T.card; b.style.color = MEET_ORANGE; b.style.borderColor = MEET_BORDER; }}
          >
            Open
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M13 5H19V11M19 5L5 19"/>
            </svg>
          </button> */}
        </div>
      </div>

      {/* ── Quick actions ── */}
      {/* <div style={{ padding: "12px 14px 10px" }}>
  <button
    onClick={() => openChat()}
    style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid #E5E7EB",
      background: "#FAFAFA",
      color: "#374151",
      fontSize: 12.5,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: T.font,
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "#E8512A";
      e.currentTarget.style.background = "#FFF3EF";
      e.currentTarget.style.color = "#E8512A";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = "#E5E7EB";
      e.currentTarget.style.background = "#FAFAFA";
      e.currentTarget.style.color = "#374151";
    }}
  >
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M12 4v16M4 12h16" />
    </svg>
    Start Chat
  </button>
</div> */}

      {/* ── Divider + label ── */}
      {/* <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...LABEL_STYLE }}>Recent</span>
        <div style={{ flex: 1, height: 1, background: T.borderLight }} />
      </div> */}

      {/* ── Conversation list ── */}
      <div style={{ flex: 1, padding: "0 6px 10px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 46, borderRadius: T.radiusSm, background: T.borderLight, animation: "shimmer 1.5s infinite" }} />
            ))}
          </div>
        ) : recentChats.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#FFF3EF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
              fontSize: 18,
            }}>
              💬
            </div>

            <p style={{
              fontSize: 12.5,
              color: "#6B7280",
              marginBottom: 12,
              fontWeight: 500
            }}>
              No conversations yet
            </p>

            <button
              onClick={() => openChat()}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                padding: "7px 20px",
                borderRadius: "8px",
                background: "#E8512A",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontFamily: T.font,
                transition: "opacity 0.2s ease",
              }}
            >
              Start Chat
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentChats.map(chat => {
              const name = getOtherName(chat);
              const lastMsg = truncate(chat.lastMessage ?? "No messages yet");
              const time = fmtTime(chat.lastMessageAt);
              const unread = (chat.unreadCounts?.[user?.uid] ?? 0) > 0;
              return (
                <div
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: T.radiusSm,
                    cursor: "pointer", transition: "background 0.12s",
                    background: unread ? MEET_LIGHT : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (!unread) (e.currentTarget as HTMLDivElement).style.background = "#F9FAFB";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = unread ? MEET_LIGHT : "transparent";
                  }}
                >
                  {/* Avatar with online dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar name={name} size={34} photo={chat.participantPhotos?.[0]} />
                    {chat.isOnline && (
                      <div style={{
                        position: "absolute", bottom: -1, right: -1,
                        width: 9, height: 9, borderRadius: "50%",
                        background: T.success, border: "2px solid #fff",
                      }} />
                    )}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: unread ? 700 : 600,
                      color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{name}</div>
                    <div style={{
                      fontSize: 11.5, color: unread ? T.textMid : T.textMuted,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: 1, fontWeight: unread ? 500 : 400,
                    }}>{lastMsg}</div>
                  </div>
                  {/* Meta */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: unread ? MEET_ORANGE : T.textFaint, fontWeight: unread ? 600 : 400 }}>{time}</span>
                    {unread && (
                      <div style={{
                        minWidth: 16, height: 16, borderRadius: 99, padding: "0 4px",
                        background: MEET_ORANGE, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff",
                      }}>
                        {chat.unreadCounts?.[user?.uid] > 9 ? "9+" : chat.unreadCounts?.[user?.uid]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPLOYEE DIRECTORY CARD ──────────────────────────────────────────────────
function EmployeeDirectoryCard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => { return onSnapshot(collection(db, "users"), snap => { setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }); }, []);
  const filtered = employees.filter(e => { const q = search.toLowerCase(); return (e.name ?? "").toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q) || (e.designation ?? "").toLowerCase().includes(q); });
  const onlineCount = employees.filter(e => e.status === "ONLINE").length;

  return (
    <div style={{ ...CARD_STYLE, padding: 0 }}>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={LABEL_STYLE}>Employee Directory</p>
          <div style={{ display: "flex", gap: 8 }}>
            {onlineCount > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: T.success, background: T.successLight, padding: "2px 9px", borderRadius: 5 }}>● {onlineCount} online</span>}
            <span style={{ fontSize: 10.5, fontWeight: 600, color: T.accent, background: T.accentLight, padding: "2px 9px", borderRadius: 5 }}>{employees.length} people</span>
          </div>
        </div>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: T.textFaint, pointerEvents: "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or role…" style={{ ...INP_STYLE, paddingLeft: 30 }} />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${T.borderLight}`, maxHeight: 380, overflowY: "auto" }}>
        {loading
          ? <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "28px", color: T.textMuted, fontSize: 12 }}>Loading…</div>
          : filtered.map((emp, i) => (
            <div
              key={emp.id}
              onClick={() => setSelected(emp)}
              onMouseEnter={() => setHovered(emp.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 16px",
                borderBottom: `1px solid ${T.borderLight}`,
                borderRight: i % 2 === 0 ? `1px solid ${T.borderLight}` : "none",
                cursor: "pointer",
                background: hovered === emp.id ? "#FAFAFA" : "transparent",
                transition: "background 0.15s, transform 0.15s",
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={emp.name ?? "?"} size={34} photo={emp.profilePhoto} />
                <div style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%", background: emp.status === "ONLINE" ? T.success : T.borderLight, border: "2px solid #fff" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name ?? "Unnamed"}</div>
                <div style={{ fontSize: 11, color: T.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{emp.designation ?? emp.email ?? "—"}</div>
              </div>
            </div>
          ))
        }
        {!loading && filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "28px", color: T.textMuted, fontSize: 12 }}>No employees found</div>}
      </div>

      {/* Profile modal */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
          onClick={() => setSelected(null)}
        >
          <div style={{ background: T.card, borderRadius: 16, width: 320, maxWidth: "94vw", overflow: "hidden", boxShadow: T.shadowMd, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            {/* Modal header — clean, no gradient */}
            <div style={{ background: T.accentLight, padding: "20px", position: "relative", borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 12, right: 14, background: T.card, border: `1px solid ${T.border}`, color: T.textMuted, width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={selected.name ?? "?"} size={50} photo={selected.profilePhoto} />
                <div>
                  <div style={{ fontWeight: 800, color: T.text, fontSize: 15, letterSpacing: "-0.02em" }}>{selected.name ?? "Unnamed"}</div>
                  <div style={{ fontSize: 12, color: T.accent, marginTop: 2, fontWeight: 600 }}>{selected.designation ?? "Employee"}</div>
                  {selected.department && <span style={{ fontSize: 10, fontWeight: 700, background: T.card, color: T.textMuted, padding: "2px 8px", borderRadius: 4, display: "inline-block", marginTop: 4, border: `1px solid ${T.border}` }}>{selected.department}</span>}
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
              ].map(r => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.borderLight}` }}>
                  <span style={{ fontSize: 13, flexShrink: 0, width: 20, textAlign: "center" }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>{r.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.textMid }}>{r.value}</div>
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
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardView({
  user, isCheckedIn, sessions,
  formatTotal = (min = 0) => { const m = min < 0 ? 0 : min; return `${Math.floor(m / 60)}h ${m % 60}m`; },
  formatTime = (ts: any) => { try { return ts?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "--"; } catch { return "--"; } },
  leaveType, setLeaveType, fromDate, setFromDate, toDate, setToDate,
  leaveReason, setLeaveReason, handleSubmitLeave, submitting, leaveMsg,
  totalSeconds = 0, onGoToChat, onOpenMeetChat,
}: Props) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [leaveNotifications, setLeaveNotifs] = useState<any[]>([]);
  const [queryNotifications, setQueryNotifs] = useState<any[]>([]);
  const [chatNotifCount, setChatNotifCount] = useState(0);
  const [employeeLeaveData, setEmployeeLeaveData] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const [profile, setProfile] = useState<any>(null);

  const close = useCallback(() => setActiveModal(null), []);

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "users"), where("uid", "==", user.uid)), snap => { if (!snap.empty) setProfile(snap.docs[0].data()); }); }, [user]);
  useEffect(() => { if (!user?.uid) return; return onSnapshot(query(collection(db, "leaveBalances"), where("uid", "==", user.uid)), snap => { if (!snap.empty) setEmployeeLeaveData(snap.docs[0].data()); }); }, [user]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "leaveRequests"), where("uid", "==", user.uid), where("status", "in", ["Approved", "Rejected"]), where("notificationRead", "==", false)), s => setLeaveNotifs(s.docs.map(d => ({ id: d.id, ...d.data() })))); }, [user]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "employeeQueries"), where("employeeId", "==", user.uid), where("employeeUnread", "==", true)), s => setQueryNotifs(s.docs.map(d => ({ id: d.id, ...d.data() })))); }, [user]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "notifications"), where("toUid", "==", user.uid), where("read", "==", false)), s => setChatNotifCount(s.size)); }, [user]);

  const markLeaveNotifRead = (id: string) => updateDoc(doc(db, "leaveRequests", id), { notificationRead: true });
  const markQueryNotifRead = (id: string) => updateDoc(doc(db, "employeeQueries", id), { employeeUnread: false });

  const totalWorked = Math.max(0, Math.floor(totalSeconds / 60));
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetEmoji = hour < 12 ? "🌤️" : hour < 17 ? "☀️" : "🌙";
  const userName = profile?.name ?? profile?.displayName ?? user?.displayName ?? "Employee";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", padding: "28px 24px 56px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: #9CA3AF; }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── MODALS ── */}
      {activeModal === "workUpdate" && <Modal onClose={close}><WorkUpdateModal onClose={close} /></Modal>}
      {activeModal === "applyLeave" && <Modal onClose={close} wide><ApplyLeaveModal leaveType={leaveType} setLeaveType={setLeaveType} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} leaveReason={leaveReason} setLeaveReason={setLeaveReason} handleSubmitLeave={handleSubmitLeave} submitting={submitting} leaveMsg={leaveMsg} onClose={close} leaveData={employeeLeaveData} /></Modal>}
      {activeModal === "holidays" && <Modal onClose={close}><HolidaysModal onClose={close} /></Modal>}
      {activeModal === "myLeaves" && <Modal onClose={close} wide><MyLeavesModal user={user} onClose={close} /></Modal>}
      {activeModal === "notifications" && <Modal onClose={close} wide><ModalHeader emoji="🔔" title="Notifications" subtitle="Stay up to date" onClose={close} /><NotificationsView leaveNotifications={leaveNotifications} markNotificationAsRead={markLeaveNotifRead} queryNotifications={queryNotifications} markQueryNotificationAsRead={markQueryNotifRead} onClose={close} hideHeader={true} onGoToChat={(chatId) => { close(); onGoToChat?.(chatId); }} /></Modal>}
      {activeModal === "help" && <Modal onClose={close} wide><ModalHeader emoji="💬" title="Help & Support" subtitle="Raise a ticket or browse FAQs" onClose={close} /><HelpView /></Modal>}

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.2 }}>
          {greetEmoji} {greeting}, {userName.split(" ")[0]}
        </h1>
        <p style={{ fontSize: 13, color: T.textFaint, marginTop: 5, fontWeight: 500, margin: "5px 0 0", letterSpacing: "0.01em" }}>{dateStr}</p>
      </div>

      {/* ── 2-COLUMN GRID ── */}
      <div
        className="dashboard-grid"
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 400px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <EmployeeDetailsCard user={user} />
          <LeaveStatusCard user={user} onApplyLeave={() => setActiveModal("applyLeave")} />
          <MyProjectsCard user={user} />
          <SessionsCard sessions={sessions} formatTime={formatTime} formatTotal={formatTotal} totalWorked={totalWorked} />
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* TOP ROW: Holidays + MeetChat side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <HolidaysCard onViewAll={() => setActiveModal("holidays")} />
            <MeetChatCard onGoToChat={onGoToChat} onOpenMeetChat={onOpenMeetChat} user={user} />
          </div>
          <EmployeeDirectoryCard />
        </div>
      </div>
    </div>
  );
}