"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  limit, addDoc, serverTimestamp, getDocs, updateDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import LeaveRequestView from "./LeaveRequestView";
import HolidaysView from "./HolidaysView";
import LeaveHistoryView from "./LeaveHistoryView";
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

  // ✅ Work update — passed from EmployeePage (same ones used by sidebar)
  task: string;
  setTask: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  handleSaveUpdate: () => void;
  saving: boolean;
  msg: string;

  // ✅ Leave — passed from EmployeePage
  leaveType: string;
  setLeaveType: (v: any) => void;
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  leaveReason: string;
  setLeaveReason: (v: string) => void;
  handleSubmitLeave: () => void;
  submitting: boolean;
  leaveMsg: string;
};

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ onClose, children, wide = false }: {
  onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden`}
        style={{ background: "#fff", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", maxHeight: "92vh" }}
      >
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal Header ─────────────────────────────────────────────────────────────
function ModalHeader({ emoji, title, subtitle, color, onClose }: {
  emoji: string; title: string; subtitle: string; color: string; onClose: () => void;
}) {
  return (
    <div className="relative px-6 pt-6 pb-5 flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, borderBottom: `1px solid ${color}20` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${color}25, ${color}10)`, border: `1px solid ${color}30` }}>
            {emoji}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/80 transition-colors flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234567]/30 bg-gray-50 focus:bg-white transition";
const lbl = "block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest";

// ─── 1. WORK UPDATE MODAL — uses parent's state & handler ─────────────────────
function WorkUpdateModal({ task, setTask, notes, setNotes, saving, msg, handleSaveUpdate, onClose }: {
  task: string; setTask: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  saving: boolean; msg: string;
  handleSaveUpdate: () => void;
  onClose: () => void;
}) {
  const [status,   setStatus]   = useState("In Progress");
  const [priority, setPriority] = useState("Medium");

  // Close automatically when parent signals success
  useEffect(() => {
    if (msg === "✅ Update saved") {
      const t = setTimeout(onClose, 1000);
      return () => clearTimeout(t);
    }
  }, [msg, onClose]);

  const STATUSES = [
    { label: "In Progress", color: "#6366f1", icon: "🔄" },
    { label: "Completed",   color: "#10b981", icon: "✅" },
    { label: "Blocked",     color: "#ef4444", icon: "🚫" },
    { label: "In Review",   color: "#f59e0b", icon: "👀" },
  ];
  const PRIORITIES = [
    { label: "Low",    color: "#10b981" },
    { label: "Medium", color: "#f59e0b" },
    { label: "High",   color: "#ef4444" },
  ];

  const activeStatus   = STATUSES.find(s => s.label === status)!;
  const activePriority = PRIORITIES.find(p => p.label === priority)!;

  const isDone = msg === "✅ Update saved";

  return (
    <>
      <ModalHeader emoji="✏️" title="Work Update" subtitle="Log what you're working on today" color="#6366f1" onClose={onClose} />
      <div className="px-6 py-5 space-y-5">
        {isDone ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
            <p className="font-bold text-gray-800 text-lg">Update Saved!</p>
            <p className="text-sm text-gray-400">Your work update has been logged</p>
          </div>
        ) : (
          <>
            {/* Task */}
            <div>
              <label className={lbl}>Task / What you're working on *</label>
              <input
                className={inp}
                placeholder="e.g. Fixing login bug, Design review…"
                value={task}
                onChange={e => setTask(e.target.value)}
              />
            </div>

            {/* Status pills */}
            <div>
              <label className={lbl}>Status</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUSES.map(s => (
                  <button key={s.label} onClick={() => setStatus(s.label)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: status === s.label ? `${s.color}18` : "#f8fafc",
                      border: `2px solid ${status === s.label ? s.color : "#e2e8f0"}`,
                      color: status === s.label ? s.color : "#64748b",
                    }}>
                    <span>{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className={lbl}>Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button key={p.label} onClick={() => setPriority(p.label)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: priority === p.label ? `${p.color}18` : "#f8fafc",
                      border: `2px solid ${priority === p.label ? p.color : "#e2e8f0"}`,
                      color: priority === p.label ? p.color : "#94a3b8",
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={lbl}>Notes / Details</label>
              <textarea
                className={inp} rows={3}
                placeholder="Progress, blockers, links…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Live preview pill */}
            {task && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span className="text-sm font-semibold text-gray-600 truncate flex-1">{task}</span>
                <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ background: `${activeStatus.color}15`, color: activeStatus.color }}>
                  {activeStatus.icon} {status}
                </span>
                <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ background: `${activePriority.color}15`, color: activePriority.color }}>
                  {priority}
                </span>
              </div>
            )}

            {/* Error message */}
            {msg && msg !== "✅ Update saved" && (
              <p className="text-sm text-red-500 font-medium">{msg}</p>
            )}

            <button
              onClick={handleSaveUpdate}
              disabled={saving}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
              style={{
                background: saving ? "#c7d2fe" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                cursor: saving ? "not-allowed" : "pointer",
              }}>
              {saving ? "Saving…" : "Save Update"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── 2. APPLY LEAVE MODAL — uses parent's state & handler ────────────────────
function ApplyLeaveModal({
  leaveType, setLeaveType, fromDate, setFromDate,
  toDate, setToDate, leaveReason, setLeaveReason,
  handleSubmitLeave, submitting, leaveMsg, onClose,
}: {
  leaveType: string; setLeaveType: (v: any) => void;
  fromDate: string; setFromDate: (v: string) => void;
  toDate: string; setToDate: (v: string) => void;
  leaveReason: string; setLeaveReason: (v: string) => void;
  handleSubmitLeave: () => void; submitting: boolean; leaveMsg: string;
  onClose: () => void;
}) {
  // Auto-close on success
  useEffect(() => {
    if (leaveMsg === "✅ Request submitted") {
      const t = setTimeout(onClose, 1000);
      return () => clearTimeout(t);
    }
  }, [leaveMsg, onClose]);

  const TYPES = [
    { label: "Casual",  icon: "🏖️", color: "#6366f1" },
    { label: "Sick",    icon: "🤒", color: "#ef4444" },
    { label: "LOP",     icon: "📋", color: "#f59e0b" },
  ];

  const days = fromDate && toDate
    ? Math.max(0, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1)
    : 0;

  const active = TYPES.find(t => t.label === leaveType) || TYPES[0];
  const isDone = leaveMsg === "✅ Request submitted";

  return (
    <>
      <ModalHeader emoji="📋" title="Apply for Leave" subtitle="Submit a new leave request" color="#10b981" onClose={onClose} />
      <div className="px-6 py-5 space-y-5">
        {isDone ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">📩</div>
            <p className="font-bold text-gray-800 text-lg">Request Submitted!</p>
            <p className="text-sm text-gray-400">Awaiting manager approval</p>
          </div>
        ) : (
          <>
            {/* Leave type */}
            <div>
              <label className={lbl}>Leave Type</label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(t => (
                  <button key={t.label} onClick={() => setLeaveType(t.label)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: leaveType === t.label ? `${t.color}18` : "#f8fafc",
                      border: `2px solid ${leaveType === t.label ? t.color : "#e2e8f0"}`,
                      color: leaveType === t.label ? t.color : "#64748b",
                    }}>
                    <span className="text-xl">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>From *</label>
                <input type="date" className={inp} value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>To *</label>
                <input type="date" className={inp} value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Day count badge */}
            {days > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: `${active.color}10`, border: `1px solid ${active.color}25` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{active.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: active.color }}>{leaveType} Leave</span>
                </div>
                <span className="font-bold text-lg" style={{ color: active.color }}>
                  {days} day{days !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className={lbl}>Reason *</label>
              <textarea className={inp} rows={3} placeholder="Brief reason for your leave…"
                value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
            </div>

            {/* Error */}
            {leaveMsg && leaveMsg !== "✅ Request submitted" && (
              <p className="text-sm text-red-500 font-medium">{leaveMsg}</p>
            )}

            <button onClick={handleSubmitLeave} disabled={submitting}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
              style={{ background: submitting ? "#a7f3d0" : "linear-gradient(135deg,#10b981,#059669)", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── 3. HOLIDAYS MODAL ────────────────────────────────────────────────────────
function HolidaysModal({ onClose }: { onClose: () => void }) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "holidays"), orderBy("date", "asc"))).then(snap => {
      setHolidays(snap.empty ? [
        { title: "Republic Day",     date: "2026-01-26", type: "National" },
        { title: "Holi",             date: "2026-03-21", type: "Festival" },
        { title: "Good Friday",      date: "2026-04-03", type: "National" },
        { title: "Independence Day", date: "2026-08-15", type: "National" },
        { title: "Gandhi Jayanti",   date: "2026-10-02", type: "National" },
        { title: "Diwali",           date: "2026-10-19", type: "Festival" },
        { title: "Christmas",        date: "2026-12-25", type: "National" },
      ] : snap.docs.map(d => ({ ...d.data() })));
      setLoading(false);
    });
  }, []);

  const upcoming = holidays.filter(h => new Date(h.date) >= new Date());
  const past     = holidays.filter(h => new Date(h.date) < new Date());
  const typeColor: Record<string, string> = { National: "#6366f1", Festival: "#f59e0b", Optional: "#06b6d4" };
  const typeIcon:  Record<string, string> = { National: "🇮🇳", Festival: "🎊", Optional: "⭐" };

  const HolidayCard = ({ h, isPast }: any) => {
    const d = new Date(h.date);
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-xl transition-all hover:scale-[1.01]"
        style={{ background: isPast ? "#f8fafc" : "#fff", border: `1px solid ${isPast ? "#e2e8f0" : (typeColor[h.type]||"#6366f1")}30`, opacity: isPast ? 0.55 : 1 }}>
        <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white"
          style={{ background: isPast ? "#94a3b8" : `linear-gradient(135deg,${typeColor[h.type]||"#6366f1"},${typeColor[h.type]||"#6366f1"}cc)` }}>
          <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString("en-IN",{month:"short"})}</span>
          <span className="text-lg font-black leading-none">{d.getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{h.title}</p>
          <p className="text-xs text-gray-400">{d.toLocaleDateString("en-IN",{weekday:"long"})}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background:`${typeColor[h.type]||"#6366f1"}15`, color:typeColor[h.type]||"#6366f1" }}>
            {typeIcon[h.type]||"🎉"} {h.type||"Holiday"}
          </span>
          {!isPast && daysLeft <= 30 && <span className="text-[10px] font-bold text-emerald-600">{daysLeft}d away</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <ModalHeader emoji="🎉" title="Holidays 2026" subtitle={`${upcoming.length} upcoming holidays`} color="#f59e0b" onClose={onClose} />
      <div className="px-6 py-5 space-y-4">
        {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
          <>
            {upcoming.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming</p>
                <div className="space-y-2">{upcoming.map((h,i) => <HolidayCard key={i} h={h} isPast={false}/>)}</div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-4">Past</p>
                <div className="space-y-2">{past.map((h,i) => <HolidayCard key={i} h={h} isPast/>)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── 4. MY LEAVES MODAL ───────────────────────────────────────────────────────
function MyLeavesModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [leaves,  setLeaves]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,"leaveRequests"), where("uid","==",user.uid), orderBy("createdAt","desc")),
      s => { setLeaves(s.docs.map(d => ({id:d.id,...d.data()}))); setLoading(false); }
    );
  }, [user]);

  const approved = leaves.filter(l => l.status === "Approved").length;
  const pending  = leaves.filter(l => l.status === "Pending").length;
  const rejected = leaves.filter(l => l.status === "Rejected").length;

  const statusCfg: Record<string,{bg:string;color:string;icon:string}> = {
    Approved: { bg:"#10b98115", color:"#10b981", icon:"✓" },
    Rejected: { bg:"#ef444415", color:"#ef4444", icon:"✗" },
    Pending:  { bg:"#f59e0b15", color:"#d97706",  icon:"⏳" },
  };

  return (
    <>
      <ModalHeader emoji="📜" title="My Leave History" subtitle="All your leave requests" color="#06b6d4" onClose={onClose} />
      <div className="px-6 py-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{label:"Approved",v:approved,c:"#10b981"},{label:"Pending",v:pending,c:"#f59e0b"},{label:"Rejected",v:rejected,c:"#ef4444"}].map(s => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{background:`${s.c}08`,border:`1px solid ${s.c}20`}}>
              <p className="text-2xl font-black" style={{color:s.c}}>{s.v}</p>
              <p className="text-[11px] font-semibold text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        {loading ? <div className="text-center py-8 text-gray-400">Loading…</div>
        : leaves.length === 0 ? (
          <div className="text-center py-10"><p className="text-4xl mb-3">🏖️</p><p className="text-sm text-gray-400">No leave requests yet</p></div>
        ) : (
          <div className="space-y-2.5">
            {leaves.map(l => {
              const s = statusCfg[l.status] || statusCfg["Pending"];
              return (
                <div key={l.id} className="p-4 rounded-xl" style={{background:"#f8fafc",border:"1px solid #e2e8f0"}}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{l.leaveType} Leave</p>
                      <p className="text-xs text-gray-400 mt-0.5">{l.fromDate} → {l.toDate}</p>
                      {l.reason && <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">"{l.reason}"</p>}
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-2"
                      style={{background:s.bg,color:s.color}}>{s.icon} {l.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardView({
  user, isCheckedIn, onlineMinutes, attendance, sessions, formatTotal, formatTime,
  task, setTask, notes, setNotes, handleSaveUpdate, saving, msg,
  leaveType, setLeaveType, fromDate, setFromDate, toDate, setToDate,
  leaveReason, setLeaveReason, handleSubmitLeave, submitting, leaveMsg,
}: Props) {

  const [activeModal,        setActiveModal]    = useState<string | null>(null);
  const [leaveRequests,      setLeaveRequests]  = useState<any[]>([]);
  const [announcements,      setAnnouncements]  = useState<any[]>([]);
  const [teamOnline,         setTeamOnline]     = useState<any[]>([]);
  const [leaveNotifications, setLeaveNotifs]    = useState<any[]>([]);
  const [queryNotifications, setQueryNotifs]    = useState<any[]>([]);
  const [dismissedAnn,       setDismissedAnn]   = useState<Set<string>>(new Set());
  const [recentUpdates,      setRecentUpdates]  = useState<any[]>([]);
  const [now,                setNow]            = useState(new Date());

  const close = useCallback(() => setActiveModal(null), []);

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,"leaveRequests"), where("uid","==",user.uid), orderBy("createdAt","desc")),
      s => setLeaveRequests(s.docs.map(d => ({id:d.id,...d.data()})))
    );
  }, [user]);

  useEffect(() => {
    return onSnapshot(
      query(collection(db,"messages"), orderBy("createdAt","desc"), limit(5)),
      s => setAnnouncements(s.docs.map(d => ({id:d.id,...d.data()})))
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,"leaveRequests"), where("uid","==",user.uid), where("status","in",["Approved","Rejected"]), where("notificationRead","==",false)),
      s => setLeaveNotifs(s.docs.map(d => ({id:d.id,...d.data()})))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,"employeeQueries"), where("employeeId","==",user.uid), where("employeeUnread","==",true)),
      s => setQueryNotifs(s.docs.map(d => ({id:d.id,...d.data()})))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,"dailyUpdates"), where("uid","==",user.uid), orderBy("createdAt","desc"), limit(5)),
      s => setRecentUpdates(s.docs.map(d => ({id:d.id,...d.data()})))
    );
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"attendance"), async snap => {
      const onlineUids = new Set<string>();
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (Array.isArray(data.sessions)) {
          if (data.sessions.some((s: any) => s.checkIn && !s.checkOut)) onlineUids.add(data.uid || docSnap.id);
        } else if (data.checkIn && !data.checkOut) {
          onlineUids.add(data.uid || docSnap.id);
        }
      });
      if (onlineUids.size === 0) { setTeamOnline([]); return; }
      const usersSnap = await getDocs(collection(db,"users"));
      setTeamOnline(usersSnap.docs.map(d => ({uid:d.id,...d.data()})).filter((u:any) => onlineUids.has(u.uid)));
    });
    return unsub;
  }, []);

  const markLeaveNotifRead = async (id: string) => updateDoc(doc(db,"leaveRequests",id), {notificationRead:true});
  const markQueryNotifRead = async (id: string) => updateDoc(doc(db,"employeeQueries",id), {employeeUnread:false});
  const dismissAnnouncement = (m: string) => setDismissedAnn(prev => new Set(prev).add(m));

  const userName       = user.email?.split("@")[0] || "User";
  const hour           = now.getHours();
  const greeting       = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetEmoji     = hour < 12 ? "🌤️" : hour < 17 ? "☀️" : "🌙";
  const totalWorked    = attendance?.totalMinutes || 0;
  const progressPct    = Math.min((totalWorked / 480) * 100, 100);
  const lastSession    = sessions.at(-1);
  const approvedLeaves = leaveRequests.filter(l => l.status === "Approved").length;
  const pendingLeaves  = leaveRequests.filter(l => l.status === "Pending").length;
  const announceMsgs   = announcements.map(a => a.text || "").filter(Boolean);
  const totalNotifs    =
    leaveNotifications.length +
    queryNotifications.length +
    announceMsgs.filter(m => !dismissedAnn.has(m)).length;

  const ACTIONS = [
    { label:"Work Update",    icon:"✏️",  color:"#6366f1", modal:"workUpdate",    desc:"Log your tasks"     },
    { label:"Apply Leave",    icon:"📋",  color:"#10b981", modal:"applyLeave",    desc:"Request time off"   },
    { label:"View Holidays",  icon:"🎉",  color:"#f59e0b", modal:"holidays",      desc:"Company holidays"   },
    { label:"My Leaves",      icon:"📜",  color:"#06b6d4", modal:"myLeaves",      desc:"Leave history"      },
    { label:"Notifications",  icon:"🔔",  color:"#ef4444", modal:"notifications", desc:"Updates & alerts"   },
    { label:"Help & Support", icon:"💬",  color:"#8b5cf6", modal:"help",          desc:"Raise a ticket"     },
  ];

  const avatarGrads = [
    ["#6366f1","#8b5cf6"],["#10b981","#059669"],["#f59e0b","#d97706"],
    ["#06b6d4","#0891b2"],["#ef4444","#dc2626"],["#8b5cf6","#7c3aed"],
    ["#ec4899","#db2777"],["#14b8a6","#0d9488"],
  ];

  const statusCfg: Record<string,{bg:string;color:string;icon:string}> = {
    "In Progress": { bg:"#6366f115", color:"#6366f1", icon:"🔄" },
    "Completed":   { bg:"#10b98115", color:"#10b981", icon:"✅" },
    "Blocked":     { bg:"#ef444415", color:"#ef4444", icon:"🚫" },
    "In Review":   { bg:"#f59e0b15", color:"#f59e0b", icon:"👀" },
  };

  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif" }} className="space-y-5">
      <style>{`
        .dash-card{background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 4px rgba(0,0,0,0.05)}
        .stat-card{transition:all .2s}.stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)}
        .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:600}
        .pulse-dot{width:8px;height:8px;border-radius:50%;background:#10b981;position:relative;flex-shrink:0}
        .pulse-dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;background:#10b981;opacity:.3;animation:pulseAnim 1.5s ease-out infinite}
        @keyframes pulseAnim{0%{transform:scale(.8);opacity:.5}100%{transform:scale(2);opacity:0}}
        .session-row{display:flex;align-items:center;padding:11px 16px;border-radius:10px;background:#f8fafc;border:1px solid #f1f5f9;margin-bottom:6px;transition:all .15s}
        .session-row:hover{background:#f1f5f9}
        .qa-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.07);cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,0.05);position:relative;overflow:hidden}
        .qa-btn:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,0.12)}
        .qa-btn .qa-label{font-size:11.5px;font-weight:700;color:#374151;text-align:center;line-height:1.2}
        .qa-btn .qa-desc{font-size:10px;color:#9ca3af;font-weight:500;text-align:center}
      `}</style>

      {/* ── MODALS ── */}
      {activeModal === "workUpdate" && (
        <Modal onClose={close}>
          {/* ✅ Uses parent's task/notes/saving/msg/handleSaveUpdate — exactly same as sidebar */}
          <WorkUpdateModal
            task={task} setTask={setTask}
            notes={notes} setNotes={setNotes}
            saving={saving} msg={msg}
            handleSaveUpdate={handleSaveUpdate}
            onClose={close}
          />
        </Modal>
      )}

      {activeModal === "applyLeave" && (
        <Modal onClose={close} wide>
          {/* ✅ Uses parent's leave state & handleSubmitLeave — exactly same as sidebar */}
          <ApplyLeaveModal
            leaveType={leaveType} setLeaveType={setLeaveType}
            fromDate={fromDate}   setFromDate={setFromDate}
            toDate={toDate}       setToDate={setToDate}
            leaveReason={leaveReason} setLeaveReason={setLeaveReason}
            handleSubmitLeave={handleSubmitLeave}
            submitting={submitting} leaveMsg={leaveMsg}
            onClose={close}
          />
        </Modal>
      )}

      {activeModal === "holidays" && (
        <Modal onClose={close}><HolidaysModal onClose={close}/></Modal>
      )}

      {activeModal === "myLeaves" && (
        <Modal onClose={close} wide><MyLeavesModal user={user} onClose={close}/></Modal>
      )}

      {activeModal === "notifications" && (
        <Modal onClose={close} wide>
          <ModalHeader emoji="🔔" title="Notifications" subtitle="Stay up to date" color="#ef4444" onClose={close}/>
          <NotificationsView
            leaveNotifications={leaveNotifications}
            messages={announceMsgs}
            markNotificationAsRead={markLeaveNotifRead}
            queryNotifications={queryNotifications}
            markQueryNotificationAsRead={markQueryNotifRead}
            onClose={close}
            dismissedAnnouncements={dismissedAnn}
            onDismissAnnouncement={dismissAnnouncement}
          />
        </Modal>
      )}

      {activeModal === "help" && (
        <Modal onClose={close} wide>
          <ModalHeader emoji="💬" title="Help & Support" subtitle="Raise a ticket or browse FAQs" color="#8b5cf6" onClose={close}/>
          <HelpView />
        </Modal>
      )}

      {/* ── WELCOME BANNER — #234567 ── */}
      <div className="dash-card overflow-hidden relative" style={{ background:"#234567", border:"none" }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background:"radial-gradient(circle,rgba(255,255,255,0.06),transparent)", transform:"translate(25%,-25%)" }}/>
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
          style={{ background:"radial-gradient(circle,rgba(52,211,153,0.12),transparent)", transform:"translate(0,40%)" }}/>
        <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm font-medium">{greetEmoji} {greeting}</p>
            <h2 className="text-white text-2xl font-black mt-0.5 tracking-tight">Welcome back, {userName}</h2>
            <p className="text-white/40 text-sm mt-1">
              {now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)" }}>
              {isCheckedIn ? <div className="pulse-dot"/> : <div className="w-2 h-2 rounded-full bg-slate-400"/>}
              <span className="text-white font-semibold text-sm">{isCheckedIn ? "Online" : "Offline"}</span>
            </div>
            <div className="px-4 py-2.5 rounded-xl"
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)" }}>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Today</p>
              <p className="text-amber-300 font-mono font-black text-lg leading-tight">
                {formatTotal(totalWorked) !== "--" ? formatTotal(totalWorked) : "0h 0m"}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-4">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-white/40 text-[11px] font-medium">Daily work progress (8h target)</p>
            <p className="text-white/60 text-[11px] font-bold">{Math.round(progressPct)}%</p>
          </div>
          <div style={{height:5,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progressPct}%`,borderRadius:99,background:"linear-gradient(90deg,#34d399,#10b981)",transition:"width .8s ease"}}/>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Status", value:isCheckedIn?"Online":"Offline", sub:isCheckedIn?"Currently working":"Not checked in",
            icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={1.8}/><path strokeLinecap="round" strokeWidth={1.8} d="M12 8v4l3 2"/></svg>,
            iconBg:isCheckedIn?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#94a3b8,#64748b)", dot:isCheckedIn },
          { label:"Total Worked", value:formatTotal(totalWorked), sub:`${sessions.length} session${sessions.length!==1?"s":""} today`,
            icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
            iconBg:"linear-gradient(135deg,#6366f1,#8b5cf6)" },
          { label:"Sessions Today", value:sessions.length, sub:lastSession&&!lastSession.checkOut?"1 in progress":"All completed",
            icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
            iconBg:"linear-gradient(135deg,#f59e0b,#d97706)" },
          { label:"Leave Balance", value:`${12-approvedLeaves} days`, sub:pendingLeaves>0?`${pendingLeaves} pending`:"No pending",
            icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.8}/><path strokeLinecap="round" strokeWidth={1.8} d="M16 2v4M8 2v4M3 10h18"/></svg>,
            iconBg:"linear-gradient(135deg,#06b6d4,#0891b2)" },
        ].map((s,i) => (
          <div key={i} className="dash-card stat-card p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">{s.label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{background:s.iconBg,boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>{s.icon}</div>
            </div>
            <div className="flex items-center gap-2">
              {s.dot !== undefined && (s.dot ? <div className="pulse-dot"/> : <div className="w-2 h-2 rounded-full bg-slate-300"/>)}
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-[15px]">Quick Actions</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tap an action to get started</p>
          </div>
          {totalNotifs > 0 && (
            <span className="badge" style={{background:"#ef444415",color:"#ef4444"}}>
              {totalNotifs} alert{totalNotifs!==1?"s":""}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ACTIONS.map((a) => (
            <button key={a.label} className="qa-btn group" onClick={() => setActiveModal(a.modal)}>
              {a.modal === "notifications" && totalNotifs > 0 && (
                <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black text-white z-10"
                  style={{background:"#ef4444"}}>
                  {totalNotifs > 9 ? "9+" : totalNotifs}
                </span>
              )}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200 group-hover:scale-110 group-hover:rotate-3"
                style={{
                  background:`linear-gradient(135deg,${a.color}20,${a.color}08)`,
                  border:`1.5px solid ${a.color}30`,
                  boxShadow:`0 4px 12px ${a.color}20`,
                }}>
                {a.icon}
              </div>
              <span className="qa-label">{a.label}</span>
              <span className="qa-desc">{a.desc}</span>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200 group-hover:w-8 w-0"
                style={{background:a.color}}/>
            </button>
          ))}
        </div>
      </div>

      {/* ── MIDDLE ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Sessions */}
        <div className="dash-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-[15px]">Today's Sessions</h3>
            <span className="badge" style={{background:"#6366f110",color:"#6366f1"}}>
              {sessions.length} {sessions.length===1?"session":"sessions"}
            </span>
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-sm font-medium text-gray-400">No sessions yet — check in to start!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 px-4 mb-2">
                {["Session","Check In","Check Out"].map((h,i) => (
                  <span key={h} className={`text-[10px] font-bold text-gray-400 uppercase tracking-wider ${i===1?"text-center":i===2?"text-right":""}`}>{h}</span>
                ))}
              </div>
              {sessions.map((s:any,i:number) => (
                <div key={i} className="session-row grid grid-cols-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white"
                      style={{background:s.checkOut?"linear-gradient(135deg,#6366f1,#8b5cf6)":"linear-gradient(135deg,#10b981,#059669)"}}>
                      {i+1}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Session {i+1}</span>
                  </div>
                  <span className="text-sm text-gray-500 text-center">{formatTime(s.checkIn)}</span>
                  {s.checkOut
                    ? <span className="text-sm text-gray-500 text-right">{formatTime(s.checkOut)}</span>
                    : <span className="text-right"><span className="badge" style={{background:"#10b98115",color:"#10b981"}}>
                        <div className="pulse-dot" style={{width:6,height:6}}/> In progress
                      </span></span>
                  }
                </div>
              ))}
              <div className="mt-4 p-3 rounded-xl flex items-center justify-between"
                style={{background:"linear-gradient(135deg,#f8fafc,#f1f5f9)",border:"1px solid #e2e8f0"}}>
                <span className="text-sm font-semibold text-gray-600">Total worked today</span>
                <span className="font-black text-[#234567] text-lg">{formatTotal(totalWorked)}</span>
              </div>
            </>
          )}
        </div>

        {/* Team Online */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-[15px]">Team Online</h3>
            <span className="badge" style={{background:"#10b98115",color:"#10b981"}}>
              <div className="pulse-dot" style={{width:6,height:6}}/>{teamOnline.length} online
            </span>
          </div>
          {teamOnline.length === 0 ? (
            <div className="text-center py-8"><p className="text-3xl mb-2">👥</p><p className="text-sm text-gray-400">No one else is online</p></div>
          ) : (
            <div className="space-y-2.5">
              {teamOnline.slice(0,8).map((u:any,i) => (
                <div key={u.uid} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                    style={{background:`linear-gradient(135deg,${avatarGrads[i%avatarGrads.length][0]},${avatarGrads[i%avatarGrads.length][1]})`}}>
                    {u.profilePhoto ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover"/> : (u.displayName?.[0]||u.email?.[0]||"?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.displayName||u.email?.split("@")[0]}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"/>
                    <span className="text-[10px] text-emerald-500 font-bold">Live</span>
                  </div>
                </div>
              ))}
              {teamOnline.length > 8 && <p className="text-xs text-gray-400 text-center pt-1">+{teamOnline.length-8} more</p>}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Leave Requests */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-[15px]">Recent Leave Requests</h3>
            <button className="text-xs text-[#234567] font-bold hover:underline" onClick={() => setActiveModal("myLeaves")}>View all →</button>
          </div>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5}/><path strokeLinecap="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18"/></svg>
              <p className="text-sm text-gray-400">No leave requests yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {leaveRequests.slice(0,4).map((l:any) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{background:"#f8fafc",border:"1px solid #f1f5f9"}}>
                  <div className="min-w-0 flex-1">
                    <span className="badge text-[11px]" style={{background:"#23456715",color:"#234567",padding:"2px 8px"}}>{l.leaveType}</span>
                    <p className="text-xs text-gray-400 mt-1">{l.fromDate} → {l.toDate}</p>
                  </div>
                  <span className="badge flex-shrink-0" style={{
                    background:l.status==="Approved"?"#10b98115":l.status==="Rejected"?"#ef444415":"#f59e0b15",
                    color:l.status==="Approved"?"#10b981":l.status==="Rejected"?"#ef4444":"#d97706",
                  }}>{l.status==="Approved"?"✓":l.status==="Rejected"?"✗":"⏳"} {l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Work Updates */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-[15px]">My Recent Updates</h3>
            <button className="text-xs text-[#234567] font-bold hover:underline" onClick={() => setActiveModal("workUpdate")}>+ Add →</button>
          </div>
          {recentUpdates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm text-gray-400">No updates yet today</p>
              <button onClick={() => setActiveModal("workUpdate")}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
                Log first update
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentUpdates.slice(0,4).map((u:any) => {
                const s = statusCfg[u.status] || statusCfg["In Progress"];
                return (
                  <div key={u.id} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{background:"#f8fafc",border:"1px solid #f1f5f9"}}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{background:s.bg}}>{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{u.task}</p>
                      {u.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{u.notes}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{background:s.bg,color:s.color}}>{u.status||"In Progress"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Overview */}
        <div className="dash-card p-5">
          <h3 className="font-bold text-gray-800 text-[15px] mb-4">📊 Attendance Overview</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-500">Leave Used</span>
                <span className="text-xs font-bold text-gray-700">{approvedLeaves} / 12 days</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{width:`${Math.min((approvedLeaves/12)*100,100)}%`,background:"linear-gradient(90deg,#06b6d4,#0891b2)"}}/>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{12-approvedLeaves} days remaining this year</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-500">Today's Work</span>
                <span className="text-xs font-bold text-gray-700">{formatTotal(totalWorked)} / 8h</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{width:`${progressPct}%`,background:progressPct>=100?"linear-gradient(90deg,#10b981,#059669)":"linear-gradient(90deg,#234567,#2d5a8a)"}}/>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{progressPct>=100?"Full day completed 🎉":`${Math.round(progressPct)}% of daily target`}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                {label:"Approved",value:approvedLeaves,color:"#10b981"},
                {label:"Pending", value:pendingLeaves, color:"#f59e0b"},
                {label:"Sessions",value:sessions.length,color:"#234567"},
              ].map(s => (
                <div key={s.label} className="text-center p-2.5 rounded-xl"
                  style={{background:`${s.color}08`,border:`1px solid ${s.color}20`}}>
                  <p className="text-xl font-black" style={{color:s.color}}>{s.value}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Announcements + Team Pulse */}
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-[15px]">📣 Announcements</h3>
            <span className="badge" style={{background:"#f59e0b15",color:"#d97706"}}>{announcements.length} new</span>
          </div>
          {announcements.length === 0 ? (
            <div className="text-center py-6"><p className="text-3xl mb-2">📭</p><p className="text-sm text-gray-400">No announcements</p></div>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0,3).map((a:any,i) => (
                <div key={a.id} className="flex gap-3 p-3 rounded-xl" style={{background:"#f8fafc",border:"1px solid #f1f5f9"}}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                    style={{background:`${["#234567","#10b981","#f59e0b"][i%3]}15`}}>
                    {["📌","🔔","💡"][i%3]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 font-medium leading-snug line-clamp-2">{a.text}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{a.createdAt?.toDate?a.createdAt.toDate().toLocaleDateString():"Recent"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4" style={{borderTop:"1px solid #f1f5f9"}}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Team Pulse</p>
              <span className="badge" style={{background:"#10b98115",color:"#10b981"}}>
                <div className="pulse-dot" style={{width:5,height:5}}/>{teamOnline.length} active
              </span>
            </div>
            <div className="flex items-center mt-3 flex-wrap">
              {teamOnline.slice(0,6).map((u:any,i) => (
                <div key={u.uid} title={u.displayName||u.email?.split("@")[0]}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                  style={{background:`linear-gradient(135deg,${avatarGrads[i%avatarGrads.length][0]},${avatarGrads[i%avatarGrads.length][1]})`,border:"2px solid #fff",marginLeft:i>0?"-6px":"0"}}>
                  {u.profilePhoto ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover"/> : (u.email?.[0]||"?").toUpperCase()}
                </div>
              ))}
              {teamOnline.length > 6 && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-gray-500"
                  style={{background:"#f1f5f9",border:"2px solid #fff",marginLeft:"-6px"}}>
                  +{teamOnline.length-6}
                </div>
              )}
              {teamOnline.length === 0 && <p className="text-xs text-gray-400">No teammates online right now</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}