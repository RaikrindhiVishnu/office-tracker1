"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, addDoc, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmployeeRow } from "@/types/EmployeeRow";

// ── Types ────────────────────────────────────────────────────────────────────

interface Break {
  type: "MORNING" | "LUNCH" | "EVENING";
  startTime: Timestamp;
  endTime?: Timestamp;
}

interface Session {
  checkIn: Timestamp;
  checkOut?: Timestamp;
}

// ── FIXED: WorkUpdate now maps to the `workUpdates` collection schema ────────
interface WorkUpdate {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  task: string;
  notes: string;
  status: string;   // "In Progress" | "Completed" | "Blocked" | "Review"
  priority: string; // "Low" | "Medium" | "High" | "Urgent"
  createdAt: Timestamp;
}

interface ChatMessage {
  id: string;
  fromUid: string;
  toUid: string;
  message: string;
  timestamp: Timestamp;
  read: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const fmtTime = (ts: Timestamp | undefined | null): string => {
  if (!ts) return "—";
  return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const calcBreakSeconds = (breaks: Break[]): number =>
  breaks.reduce((acc, b) => {
    if (!b.startTime) return acc;
    const s = b.startTime.toDate().getTime();
    const e = b.endTime ? b.endTime.toDate().getTime() : s;
    return acc + Math.max(0, Math.floor((e - s) / 1000));
  }, 0);

const calcWorkSeconds = (sessions: Session[], breaks: Break[]): number => {
  const now = new Date();
  const shiftEnd = new Date(); shiftEnd.setHours(19, 0, 0, 0);
  const cap = Math.min(now.getTime(), shiftEnd.getTime());
  const totalSessionMs = sessions.reduce((acc, sess) => {
    const ci = sess.checkIn?.toDate().getTime();
    if (!ci) return acc;
    const co = sess.checkOut ? sess.checkOut.toDate().getTime() : cap;
    return acc + Math.max(0, co - ci);
  }, 0);
  const breakMs = calcBreakSeconds(breaks) * 1000;
  return Math.max(0, Math.floor((totalSessionMs - breakMs) / 1000));
};

const getActiveBreak = (breaks: Break[]): Break | null =>
  breaks.find(b => b.startTime && !b.endTime) ?? null;

const getBreakLabel = (type: string) =>
  type === "MORNING" ? "☕ Morning" : type === "LUNCH" ? "🍱 Lunch" : "🌆 Evening";

const BREAK_LIMITS: Record<string, number> = { MORNING: 15 * 60, LUNCH: 45 * 60, EVENING: 15 * 60 };

// ── Status / Priority config ──────────────────────────────────────────────────
const STATUS_CFG: Record<string, { icon: string; bg: string; color: string }> = {
  "In Progress": { icon: "🔄", bg: "bg-blue-100",   color: "text-blue-700"   },
  "Completed":   { icon: "✅", bg: "bg-green-100",  color: "text-green-700"  },
  "Blocked":     { icon: "🚫", bg: "bg-red-100",    color: "text-red-700"    },
  "Review":      { icon: "👀", bg: "bg-purple-100", color: "text-purple-700" },
};

const PRIORITY_CFG: Record<string, { dot: string; color: string }> = {
  "Low":    { dot: "bg-gray-400",   color: "text-gray-500"   },
  "Medium": { dot: "bg-yellow-400", color: "text-yellow-700" },
  "High":   { dot: "bg-orange-500", color: "text-orange-700" },
  "Urgent": { dot: "bg-red-500",    color: "text-red-700"    },
};

// ── Tab Button ────────────────────────────────────────────────────────────────
function TabBtn({ label, icon, active, onClick, badge }: {
  label: string; icon: string; active: boolean;
  onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative ${
        active
          ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-xl p-3 border ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold leading-none">{value}</p>
    </div>
  );
}

// ── Timeline Event ────────────────────────────────────────────────────────────
function TimelineEvent({ time, label, icon, color, note }: {
  time: string; label: string; icon: string; color: string; note?: string;
}) {
  return (
    <div className="flex gap-3 items-start group">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-sm shadow-sm group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="w-0.5 h-4 bg-slate-200 mt-1"/>
      </div>
      <div className="pb-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 font-mono">{time}</span>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
        {note && <p className="text-xs text-slate-500 mt-0.5 truncate">{note}</p>}
      </div>
    </div>
  );
}

// ── Productivity Ring ─────────────────────────────────────────────────────────
function ProductivityRing({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 1s ease" }}/>
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="800" fill={color}>{score}</text>
      </svg>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
    </div>
  );
}

// ── Admin Reply Box ───────────────────────────────────────────────────────────
function AdminReplyBox({ adminUid, employeeUid, employeeName }: {
  adminUid: string; employeeUid: string; employeeName: string;
}) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        fromUid: adminUid, fromName: "Admin",
        toUid: employeeUid,
        message: msg.trim(),
        chatId: `admin_${employeeUid}`,
        timestamp: serverTimestamp(),
        read: false,
      });
      setMsg(""); setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-bold text-slate-500 mb-2">📨 Send message to {employeeName}</p>
      <div className="flex gap-2">
        <input
          value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none transition-colors"
        />
        <button onClick={send} disabled={sending || !msg.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {sent ? "✓" : sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════

interface Props {
  employee: EmployeeRow;
  adminUid: string;
  onClose: () => void;
}

type Tab = "overview" | "timeline" | "tasks" | "breaks" | "activity" | "insights";

export default function EmployeeTodayPanel({ employee, adminUid, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  // Live data
  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [breaks,    setBreaks]    = useState<Break[]>([]);
  const [updates,   setUpdates]   = useState<WorkUpdate[]>([]);
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [workSecs,  setWorkSecs]  = useState(0);
  const [tick,      setTick]      = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Live attendance listener ────────────────────────────────────────────────
  useEffect(() => {
    const dateStr = getTodayStr();
    const ref = doc(db, "attendance", `${employee.uid}_${dateStr}`);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setSessions(snap.data().sessions ?? []);
        setBreaks(snap.data().breaks ?? []);
      }
    });
    return () => unsub();
  }, [employee.uid]);

  // ── FIXED: Read from `workUpdates` collection (same as WorkUpdateView saves to) ──
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "workUpdates"),
      where("uid", "==", employee.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkUpdate));
      // Filter to today only
      const todayUpdates = all.filter(u => {
        if (!u.createdAt) return false;
        const d = u.createdAt.toDate();
        d.setHours(0, 0, 0, 0);
        return d.getTime() === todayStart.getTime();
      });
      setUpdates(todayUpdates);
    });
    return () => unsub();
  }, [employee.uid]);

  // ── Live messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", employee.uid),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
    return () => unsub();
  }, [employee.uid]);

  // ── 1-second timer ────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Recalc work seconds ───────────────────────────────────────────────────
  useEffect(() => {
    setWorkSecs(calcWorkSeconds(sessions, breaks));
  }, [sessions, breaks, tick]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeBreak  = getActiveBreak(breaks);
  const breakSecs    = calcBreakSeconds(breaks);
  const lastSession  = sessions.at(-1);
  const isCheckedIn  = lastSession && !lastSession.checkOut;
  const isOnBreak    = !!activeBreak;

  const currentStatus = isOnBreak ? "On Break" : isCheckedIn ? "Working" : "Offline";
  const statusColor   = isOnBreak
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : isCheckedIn
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-slate-200 text-slate-600 border-slate-300";

  const completedUpdates   = updates.filter(u => u.status === "Completed").length;
  const inProgressUpdates  = updates.filter(u => u.status === "In Progress").length;
  const blockedUpdates     = updates.filter(u => u.status === "Blocked").length;
  const totalUpdates       = updates.length;

  const latestUpdate = updates[0] ?? null;

  // Productivity score
  const totalActive = workSecs + breakSecs;
  const rawScore    = totalActive > 0 ? Math.round((workSecs / totalActive) * 100) : 0;
  const taskBonus   = totalUpdates > 0 ? Math.round((completedUpdates / totalUpdates) * 20) : 0;
  const productivityScore = Math.min(100, rawScore * 0.8 + taskBonus);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: { type: "error"|"warn"|"ok"; text: string }[] = [];
  const firstCheckIn = sessions[0]?.checkIn?.toDate();
  if (firstCheckIn) {
    const lateThreshold = new Date(); lateThreshold.setHours(10, 15, 0, 0);
    if (firstCheckIn > lateThreshold)
      alerts.push({ type: "error", text: `Late check-in at ${fmtTime(sessions[0].checkIn)}` });
  } else {
    alerts.push({ type: "error", text: "No check-in recorded today" });
  }
  breaks.forEach(b => {
    if (!b.endTime) return;
    const dur = (b.endTime.toDate().getTime() - b.startTime.toDate().getTime()) / 1000;
    const limit = BREAK_LIMITS[b.type] ?? 30 * 60;
    if (dur > limit)
      alerts.push({ type: "warn", text: `${getBreakLabel(b.type)} break exceeded by ${fmtDuration(dur - limit)}` });
  });
  if (blockedUpdates > 0)
    alerts.push({ type: "warn", text: `${blockedUpdates} task${blockedUpdates > 1 ? "s" : ""} marked as Blocked` });
  if (totalUpdates === 0 && isCheckedIn)
    alerts.push({ type: "warn", text: "No work updates added today" });
  if (productivityScore >= 80)
    alerts.push({ type: "ok", text: "High productivity today 🚀" });

  // ── Timeline events ────────────────────────────────────────────────────────
  type TEvent = { time: number; label: string; icon: string; color: string; note?: string };
  const timelineEvents: TEvent[] = [];

  sessions.forEach(sess => {
    if (sess.checkIn)  timelineEvents.push({ time: sess.checkIn.toDate().getTime(),  label: "Checked In",  icon: "🟢", color: "bg-emerald-100" });
    if (sess.checkOut) timelineEvents.push({ time: sess.checkOut.toDate().getTime(), label: "Checked Out", icon: "🔴", color: "bg-red-100"     });
  });
  breaks.forEach(b => {
    if (b.startTime) timelineEvents.push({ time: b.startTime.toDate().getTime(), label: `${getBreakLabel(b.type)} break started`, icon: "☕", color: "bg-amber-100" });
    if (b.endTime)   timelineEvents.push({ time: b.endTime.toDate().getTime(),   label: `${getBreakLabel(b.type)} break ended`,   icon: "▶️", color: "bg-blue-100"  });
  });
  updates.forEach(u => {
    if (u.createdAt) {
      const cfg = STATUS_CFG[u.status] ?? STATUS_CFG["In Progress"];
      timelineEvents.push({
        time: u.createdAt.toDate().getTime(),
        label: u.task || "Work update",
        icon: cfg.icon,
        color: cfg.bg,
        note: u.notes ? `${u.notes}` : undefined,
      });
    }
  });
  timelineEvents.sort((a, b) => a.time - b.time);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose}/>

      {/* Panel */}
      <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl animate-slide-in overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white px-5 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg ring-2 ring-white/20">
                {employee.profilePhoto
                  ? <img src={employee.profilePhoto} alt={employee.name} className="w-full h-full object-cover"/>
                  : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center font-bold text-xl">
                      {employee.name?.[0]?.toUpperCase()}
                    </div>}
              </div>
              <div>
                <h2 className="font-bold text-lg leading-none">{employee.name}</h2>
                <p className="text-white/60 text-xs mt-0.5">{employee.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusColor}`}>
                {isOnBreak ? "⏸ " : isCheckedIn ? "🟢 " : "⚫ "}{currentStatus}
              </span>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/80 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Live counters */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Work Time</p>
              <p className="font-mono font-bold text-emerald-300 text-sm">{fmtDuration(workSecs)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Break Time</p>
              <p className="font-mono font-bold text-amber-300 text-sm">{fmtDuration(breakSecs)}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Updates</p>
              <p className="font-mono font-bold text-blue-300 text-sm">{completedUpdates}/{totalUpdates}</p>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-slate-200 px-4 py-2 flex gap-1 overflow-x-auto shrink-0 bg-slate-50">
          {([
            ["overview",  "Overview",  "📊"],
            ["timeline",  "Timeline",  "⏱"],
            ["tasks",     "Work Updates", "📋", totalUpdates],
            ["breaks",    "Breaks",    "☕"],
            ["activity",  "Activity",  "🟢"],
            ["insights",  "Insights",  "💡", alerts.filter(a => a.type !== "ok").length],
          ] as [Tab, string, string, number?][]).map(([id, label, icon, badge]) => (
            <TabBtn key={id} label={label} icon={icon} active={tab === id}
              onClick={() => setTab(id)} badge={badge}/>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ════════════ OVERVIEW ════════════ */}
          {tab === "overview" && (
            <div className="space-y-4">
              {/* Score + Stats */}
              <div className="flex gap-4 items-center">
                <ProductivityRing score={Math.round(productivityScore)}/>
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <StatPill label="Work Time"  value={fmtDuration(workSecs)}  color="border-emerald-200 bg-emerald-50 text-emerald-800"/>
                  <StatPill label="Break Time" value={fmtDuration(breakSecs)} color="border-amber-200 bg-amber-50 text-amber-800"/>
                  <StatPill label="Check In"   value={fmtTime(sessions[0]?.checkIn)}  color="border-blue-200 bg-blue-50 text-blue-800"/>
                  <StatPill label="Check Out"  value={fmtTime(lastSession?.checkOut)} color="border-purple-200 bg-purple-50 text-purple-800"/>
                </div>
              </div>

              {/* Work Update summary */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Today's Work Updates</p>
                <div className="flex gap-3">
                  {[
                    { label: "Done",       value: completedUpdates,  bg: "bg-green-100 text-green-700"  },
                    { label: "In Progress",value: inProgressUpdates, bg: "bg-blue-100 text-blue-700"    },
                    { label: "Blocked",    value: blockedUpdates,    bg: "bg-red-100 text-red-700"      },
                  ].map(s => (
                    <div key={s.label} className={`flex-1 rounded-xl p-3 text-center ${s.bg}`}>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest work update */}
              {latestUpdate && (
                <div className="bg-white rounded-2xl border-2 border-indigo-100 p-4">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Latest Update</p>
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{STATUS_CFG[latestUpdate.status]?.icon ?? "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{latestUpdate.task}</p>
                      {latestUpdate.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">"{latestUpdate.notes}"</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[latestUpdate.status]?.bg ?? ""} ${STATUS_CFG[latestUpdate.status]?.color ?? ""}`}>
                          {latestUpdate.status}
                        </span>
                        {latestUpdate.priority && (
                          <span className="flex items-center gap-1 text-[10px] font-bold">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_CFG[latestUpdate.priority]?.dot}`}/>
                            <span className={PRIORITY_CFG[latestUpdate.priority]?.color}>{latestUpdate.priority}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{fmtTime(latestUpdate.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((a, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
                      a.type === "error" ? "bg-red-50 text-red-700 border border-red-200"
                      : a.type === "warn" ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-green-50 text-green-700 border border-green-200"}`}>
                      <span>{a.type === "error" ? "🔴" : a.type === "warn" ? "🟡" : "🟢"}</span>
                      {a.text}
                    </div>
                  ))}
                </div>
              )}

              <AdminReplyBox adminUid={adminUid} employeeUid={employee.uid} employeeName={employee.name}/>
            </div>
          )}

          {/* ════════════ TIMELINE ════════════ */}
          {tab === "timeline" && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Today's Activity — {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
              </p>
              {timelineEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="font-medium">No activity recorded yet</p>
                </div>
              ) : (
                timelineEvents.map((ev, i) => (
                  <TimelineEvent key={i}
                    time={new Date(ev.time).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
                    label={ev.label} icon={ev.icon} color={ev.color} note={ev.note}/>
                ))
              )}
              {isCheckedIn && !isOnBreak && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full"/>
                  </div>
                  <div className="pt-1.5">
                    <span className="text-xs text-emerald-600 font-bold">NOW — Active</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ WORK UPDATES (was "tasks") ════════════ */}
          {tab === "tasks" && (
            <div className="space-y-4">
              {/* Stats bar */}
              {totalUpdates > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                    <span>Completion Progress</span>
                    <span>{totalUpdates > 0 ? Math.round((completedUpdates/totalUpdates)*100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                      style={{ width: `${totalUpdates > 0 ? (completedUpdates/totalUpdates)*100 : 0}%` }}/>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs flex-wrap">
                    <span className="text-green-600 font-semibold">✅ {completedUpdates} Completed</span>
                    <span className="text-blue-600 font-semibold">🔄 {inProgressUpdates} In Progress</span>
                    <span className="text-red-500 font-semibold">🚫 {blockedUpdates} Blocked</span>
                    <span className="text-purple-600 font-semibold">👀 {updates.filter(u => u.status === "Review").length} Review</span>
                  </div>
                </div>
              )}

              {updates.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="font-medium">No work updates today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map(u => {
                    const cfg = STATUS_CFG[u.status] ?? STATUS_CFG["In Progress"];
                    const pcfg = PRIORITY_CFG[u.priority] ?? PRIORITY_CFG["Medium"];
                    return (
                      <div key={u.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className={`h-1 w-full ${cfg.bg}`}/>
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-xl mt-0.5 shrink-0">{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800">{u.task}</p>
                              {u.notes && (
                                <p className="text-xs text-slate-500 mt-1 italic leading-relaxed">"{u.notes}"</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                  {u.status}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-semibold">
                                  <span className={`w-1.5 h-1.5 rounded-full ${pcfg.dot}`}/>
                                  <span className={pcfg.color}>{u.priority}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 ml-auto">{fmtTime(u.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AdminReplyBox adminUid={adminUid} employeeUid={employee.uid} employeeName={employee.name}/>
            </div>
          )}

          {/* ════════════ BREAKS ════════════ */}
          {tab === "breaks" && (
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Total Break Time</p>
                <p className="text-3xl font-bold text-amber-800">{fmtDuration(breakSecs)}</p>
              </div>

              {breaks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-4xl mb-2">☕</div>
                  <p className="font-medium">No breaks taken today</p>
                </div>
              ) : (
                breaks.map((b, i) => {
                  const dur = b.endTime
                    ? (b.endTime.toDate().getTime() - b.startTime.toDate().getTime()) / 1000
                    : (Date.now() - b.startTime.toDate().getTime()) / 1000;
                  const limit   = BREAK_LIMITS[b.type] ?? 30 * 60;
                  const exceeded = dur > limit;
                  const isActive = !b.endTime;
                  return (
                    <div key={i} className={`rounded-2xl border p-4 ${exceeded ? "bg-red-50 border-red-200" : isActive ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{b.type === "MORNING" ? "☕" : b.type === "LUNCH" ? "🍱" : "🌆"}</span>
                          <span className="font-bold text-slate-800">{getBreakLabel(b.type)} Break</span>
                          {isActive && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVE</span>}
                        </div>
                        <span className={`font-bold text-sm ${exceeded ? "text-red-600" : "text-slate-700"}`}>{fmtDuration(dur)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>🕐 Start: {fmtTime(b.startTime)}</span>
                        <span>🕑 End: {b.endTime ? fmtTime(b.endTime) : "Ongoing"}</span>
                      </div>
                      {exceeded && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                          <span>⚠️</span> Exceeded by {fmtDuration(dur - limit)}
                          <span className="text-red-400">(limit: {fmtDuration(limit)})</span>
                        </div>
                      )}
                      <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${exceeded ? "bg-red-500" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(100, (dur / limit) * 100)}%` }}/>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ════════════ ACTIVITY ════════════ */}
          {tab === "activity" && (
            <div className="space-y-4">
              <div className={`rounded-2xl border-2 p-4 ${isCheckedIn ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isCheckedIn && !isOnBreak ? "bg-emerald-500 animate-pulse" : isOnBreak ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`}/>
                  <span className="font-bold text-slate-800">
                    {isOnBreak ? `On ${getBreakLabel(activeBreak!.type)} Break` : isCheckedIn ? "Currently Active" : "Offline"}
                  </span>
                </div>
                {latestUpdate && (
                  <p className="mt-2 text-sm text-slate-600">
                    Latest: <span className="font-semibold text-indigo-700">{latestUpdate.task}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Last activity: {fmtTime(updates[0]?.createdAt ?? lastSession?.checkIn)}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sessions Today</p>
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No sessions recorded</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((sess, i) => {
                      const ci  = sess.checkIn?.toDate().getTime();
                      const co  = sess.checkOut?.toDate().getTime() ?? Date.now();
                      const dur = ci ? Math.floor((co - ci) / 1000) : 0;
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="text-sm">
                            <span className="font-semibold text-slate-700">Session {i + 1}</span>
                            <span className="text-slate-400 ml-2">
                              {fmtTime(sess.checkIn)} → {sess.checkOut ? fmtTime(sess.checkOut) : "ongoing"}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-indigo-600">{fmtDuration(dur)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Communication</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                    <p className="text-2xl font-bold text-blue-700">{messages.length}</p>
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Messages</p>
                  </div>
                  <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                    <p className="text-2xl font-bold text-purple-700">{messages.filter(m=>!m.read).length}</p>
                    <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Unread</p>
                  </div>
                </div>
              </div>

              <AdminReplyBox adminUid={adminUid} employeeUid={employee.uid} employeeName={employee.name}/>
            </div>
          )}

          {/* ════════════ INSIGHTS ════════════ */}
          {tab === "insights" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-widest">Productivity Score</p>
                    <p className="text-4xl font-black">{Math.round(productivityScore)}<span className="text-xl text-white/40">/100</span></p>
                  </div>
                  <ProductivityRing score={Math.round(productivityScore)}/>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Work Efficiency",   pct: totalActive > 0 ? Math.round((workSecs/totalActive)*100) : 0,          color: "bg-emerald-400" },
                    { label: "Update Completion", pct: totalUpdates > 0 ? Math.round((completedUpdates/totalUpdates)*100) : 0, color: "bg-blue-400"    },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs text-white/60 mb-1">
                        <span>{s.label}</span><span>{s.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%`, transition:"width 1s ease" }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alerts & Insights</p>
                {alerts.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="font-medium">No issues detected</p>
                  </div>
                )}
                {alerts.map((a, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                    a.type === "error" ? "bg-red-50 text-red-700 border-red-200"
                    : a.type === "warn" ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-green-50 text-green-700 border-green-200"}`}>
                    <span className="text-base mt-0.5">{a.type === "error" ? "🔴" : a.type === "warn" ? "🟡" : "🟢"}</span>
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Time Distribution</p>
                <div className="space-y-2">
                  {[
                    { label: "Work Time",  secs: workSecs,  color: "bg-emerald-500" },
                    { label: "Break Time", secs: breakSecs, color: "bg-amber-400"   },
                  ].map(s => {
                    const total = workSecs + breakSecs;
                    const pct   = total > 0 ? Math.round((s.secs / total) * 100) : 0;
                    return (
                      <div key={s.label}>
                        <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
                          <span>{s.label}</span>
                          <span>{fmtDuration(s.secs)} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%`, transition:"width 0.8s ease" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <AdminReplyBox adminUid={adminUid} employeeUid={employee.uid} employeeName={employee.name}/>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
    </div>
  );
}