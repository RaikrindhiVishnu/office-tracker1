"use client";

import { useState, useMemo, useEffect } from "react";
import { getDoc, doc } from "firebase/firestore";
import type { AttendanceType } from "@/types/attendance";
// ── NEW: real break helpers ────────────────────────────────────────────────────
import {
  calcTotalBreakMinutes,
  BREAK_LIMIT_MINUTES,
  type Break,
} from "@/lib/breakTracking";

// ─ Types ────────────────────────────────────────────────────────────────────
interface User {
  uid: string;
  name: string;
  designation?: string;
  department?: string;
  salary?: number;
  profilePhoto?: string;
}

export interface LateThreshold {
  hour: number;
  minute: number;
}

interface AttendanceDashboardProps {
  db: any;
  users: User[];
  monthlyDate: Date;
  setMonthlyDate: (date: Date | ((prev: Date) => Date)) => void;
  monthlyAttendance: Record<string, Record<string, AttendanceType>>;
  setMonthlyAttendance: React.Dispatch<React.SetStateAction<Record<string, Record<string, AttendanceType>>>>;
  sessionsByDate: Record<string, any>;
  isHoliday: (dateStr: string) => any;
  saveMonthlyAttendance: (uid: string, dateStr: string, status: AttendanceType) => void;
  getAutoStatus: (params: { uid: string; dateStr: string; sessionsByDate: Record<string, any>; isHolidayDay: boolean }) => AttendanceType;
  isSunday: (year: number, month: number, day: number) => boolean;
  isSecondSaturday: (year: number, month: number, day: number) => boolean;
  isFourthSaturday: (year: number, month: number, day: number) => boolean;
  isFifthSaturday: (year: number, month: number, day: number) => boolean;
  lateThreshold?: LateThreshold;
  onSaveLateThreshold?: (threshold: LateThreshold) => void;
}

// ─ Constants ────────────────────────────────────────────────────────────────
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);
const DEFAULT_LATE_THRESHOLD: LateThreshold = { hour: 10, minute: 15 };

const BREAK_ICONS: Record<string, string> = { MORNING: "☕", LUNCH: "🍽️", EVENING: "🌇" };

const STATUS_CFG = {
  P:   { label: "Present",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e" },
  A:   { label: "Absent",    color: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", dot: "#ef4444" },
  H:   { label: "Holiday",   color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3", dot: "#6366f1" },
  L:   { label: "Leave",     color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", text: "#075985", dot: "#0ea5e9" },
  LOP: { label: "LOP",       color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9", dot: "#8b5cf6" },
  SL:  { label: "Sick Leave",color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", text: "#075985", dot: "#0ea5e9" },
};

const AVATAR_PALETTES = [
  ["#6366f1","#8b5cf6"],["#0ea5e9","#06b6d4"],["#16a34a","#059669"],
  ["#f97316","#eab308"],["#ec4899","#f43f5e"],["#8b5cf6","#a855f7"],
  ["#14b8a6","#0d9488"],["#f59e0b","#d97706"],
];

// ─ Helpers ───────────────────────────────────────────────────────────────────
const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

function fmtMins(m: number): string {
  if (!m || m <= 0) return "—";
  const h = Math.floor(m / 60), min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

function fmtThreshold({ hour, minute }: LateThreshold) {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${period}`;
}

function isLateCheckIn(checkIn: string | null, threshold: LateThreshold): boolean {
  if (!checkIn) return false;
  const [h, m] = checkIn.split(":").map(Number);
  return h > threshold.hour || (h === threshold.hour && m > threshold.minute);
}

const TODAY_KEY = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
})();

// ─ DaySessionNode — now includes real breaks array ───────────────────────────
type DaySessionNode = {
  checkIn:   string | null;
  checkOut:  string | null;
  totalMins: number;
  breakMins: number;       // ← real break minutes from Firestore
  breaks:    Break[];      // ← raw break entries for tooltip
  hasData:   boolean;
  sessionCount: number;
};

function parseSessionTimes(monthlySessionData: Record<string, Record<string, DaySessionNode>>, uid: string, dateStr: string) {
  const node = monthlySessionData?.[uid]?.[dateStr] ?? null;
  if (!node || !node.hasData) return { checkIn: null, checkOut: null, breakMins: 0, breaks: [] as Break[], totalMins: 0 };
  return {
    checkIn:   node.checkIn   || null,
    checkOut:  node.checkOut  || null,
    totalMins: node.totalMins || 0,
    breakMins: node.breakMins || 0,   // ← real
    breaks:    node.breaks    || [],
  };
}

// ─ Build day statuses ────────────────────────────────────────────────────────
function buildDayStatuses(
  uid: string, year: number, month: number,
  monthlyAttendance: Record<string, Record<string, AttendanceType>>,
  monthlySessionData: Record<string, Record<string, DaySessionNode>>,
  isHoliday: any, isSunday: any, isSecondSaturday: any,
  isFourthSaturday: any, isFifthSaturday: any,
  lateThreshold: LateThreshold,
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day     = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow     = new Date(year, month, day).getDay();
    const isFuture    = dateStr > TODAY_KEY;
    const isToday     = dateStr === TODAY_KEY;
    const isHolidayDay = isSunday(year, month, day) || isSecondSaturday(year, month, day) ||
                         isFourthSaturday(year, month, day) || isFifthSaturday(year, month, day) || !!isHoliday(dateStr);
    const isPublicHol  = !!isHoliday(dateStr) && !isSunday(year, month, day);

    let status: AttendanceType | null;
    if (isHolidayDay) status = "H";
    else if (isFuture) status = null;
    else {
      const manualOverride = monthlyAttendance[uid]?.[dateStr];
      if (manualOverride) status = manualOverride;
      else status = monthlySessionData?.[uid]?.[dateStr]?.hasData === true ? "P" : "A";
    }

    const { checkIn, checkOut, breakMins, breaks, totalMins } = parseSessionTimes(monthlySessionData, uid, dateStr);
    const isLate = isLateCheckIn(checkIn, lateThreshold);
    return { day, dateStr, status, isHolidayDay, isPublicHol, isFuture, isToday, dow, checkIn, checkOut, breakMins, breaks, totalMins, isLate };
  });
}

// ─ CSV export ────────────────────────────────────────────────────────────────
function exportCSV(rows: any[], filename: string) {
  const headers = Object.keys(rows[0]).join(",");
  const body    = rows.map(r => Object.values(r).map(v => `"${v}"`).join(",")).join("\n");
  const blob    = new Blob([headers + "\n" + body], { type: "text/csv" });
  const url     = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─ Break tooltip ─────────────────────────────────────────────────────────────
function BreakTooltip({ breaks, breakMins }: { breaks: Break[]; breakMins: number }) {
  const isOver = breakMins > BREAK_LIMIT_MINUTES;
  const fmtTs  = (ts: any) => {
    if (!ts) return "--";
    try { return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return "--"; }
  };
  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, width: 210, background: "#0f172a", color: "white", borderRadius: 12,
      boxShadow: "0 12px 40px rgba(0,0,0,0.3)", padding: "12px 14px", pointerEvents: "none",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, paddingBottom:7, borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
        <span style={{ fontWeight:700, fontSize:12 }}>Break Details</span>
        <span style={{
          fontWeight:800, fontSize:11, padding:"2px 8px", borderRadius:6,
          background: isOver ? "#ef4444" : "#f97316",
          fontFamily: "'IBM Plex Mono', monospace",
        }}>{fmtMins(breakMins)}</span>
      </div>
      {breaks.length === 0 ? (
        <p style={{ color:"#94a3b8", fontSize:12, margin:0, textAlign:"center" }}>No breaks recorded</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {breaks.map((b, i) => {
            const start = fmtTs(b.startTime);
            const end   = b.endTime ? fmtTs(b.endTime) : "ongoing…";
            const dur   = b.startTime && b.endTime
              ? Math.floor(((b.endTime as any)?.toDate?.()?.getTime() - (b.startTime as any)?.toDate?.()?.getTime()) / 60000)
              : null;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:13 }}>{BREAK_ICONS[b.type] || "⏸️"}</span>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{start} → {end}</span>
                </div>
                {dur !== null && (
                  <span style={{ fontWeight:700, color:"#fbbf24", fontSize:11, fontFamily:"'IBM Plex Mono', monospace" }}>
                    {fmtMins(dur)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isOver && (
        <div style={{ marginTop:8, paddingTop:7, borderTop:"1px solid rgba(255,255,255,0.1)", color:"#fca5a5", fontSize:11 }}>
          ⚠️ Over limit by {fmtMins(breakMins - BREAK_LIMIT_MINUTES)}
        </div>
      )}
      {/* Arrow */}
      <div style={{
        position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)",
        width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent",
        borderTop:"6px solid #0f172a",
      }} />
    </div>
  );
}

// ─ Break cell ────────────────────────────────────────────────────────────────
function BreakCell({ breakMins, breaks }: { breakMins: number; breaks: Break[] }) {
  const [hover, setHover] = useState(false);
  if (!breakMins || breakMins <= 0) return <span style={{ color:"#cbd5e1" }}>—</span>;
  const isOver = breakMins > BREAK_LIMIT_MINUTES;
  const types  = [...new Set(breaks.map(b => b.type))];

  return (
    <div style={{ position:"relative", display:"inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        display:"inline-flex", alignItems:"center", gap:4,
        padding:"3px 9px", borderRadius:7, cursor:"help",
        background: isOver ? "#fee2e2" : "#fff7ed",
        border: `1px solid ${isOver ? "#fecaca" : "#fed7aa"}`,
        color: isOver ? "#b91c1c" : "#9a3412",
        fontSize:12, fontWeight:700,
        fontFamily:"'IBM Plex Mono', monospace",
        transition:"all 0.15s",
      }}>
        {isOver && <span style={{ fontSize:9 }}>⚠️</span>}
        {types.slice(0, 2).map(t => (
          <span key={t} style={{ fontSize:10 }}>{BREAK_ICONS[t] || ""}</span>
        ))}
        {fmtMins(breakMins)}
      </span>
      {hover && <BreakTooltip breaks={breaks} breakMins={breakMins} />}
    </div>
  );
}

// ─ Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ current, onSave, onClose }: { current: LateThreshold; onSave: (t: LateThreshold) => void; onClose: () => void }) {
  const [hour, setHour]     = useState(current.hour);
  const [minute, setMinute] = useState(current.minute);
  const preview = fmtThreshold({ hour, minute });
  const hourOptions   = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title-row">
            <div className="settings-icon">
              <svg width="16" height="16" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </div>
            <div>
              <div className="settings-eyebrow">Configuration</div>
              <h2 className="settings-title">Attendance Settings</h2>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="settings-body">
          <div className="settings-section-label">Late Check-In Threshold</div>
          <p className="settings-desc">
            Employees who check in after this time are flagged as <strong style={{ color:"#c2410c" }}>Late</strong>.
          </p>
          <div className="settings-time-row">
            <div className="settings-field">
              <label className="settings-label">Hour</label>
              <select className="settings-select" value={hour} onChange={e => setHour(Number(e.target.value))}>
                {hourOptions.map(h => {
                  const period = h < 12 ? "AM" : "PM";
                  const display = h % 12 === 0 ? 12 : h % 12;
                  return <option key={h} value={h}>{String(display).padStart(2,"0")} {period}</option>;
                })}
              </select>
            </div>
            <div className="settings-field">
              <label className="settings-label">Minute</label>
              <select className="settings-select" value={minute} onChange={e => setMinute(Number(e.target.value))}>
                {minuteOptions.map(m => <option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
              </select>
            </div>
            <div className="settings-preview">
              <div className="settings-preview-label">Preview</div>
              <div className="settings-preview-time">{preview}</div>
            </div>
          </div>
          <div className="settings-info-box">
            <svg width="13" height="13" fill="none" stroke="#0369a1" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>Currently set to <strong>{fmtThreshold(current)}</strong>. Changing this recalculates late flags for all employees immediately.</span>
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="settings-save-btn" onClick={() => { onSave({ hour, minute }); onClose(); }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AttendanceDashboard({
  db, users, monthlyDate, setMonthlyDate, monthlyAttendance, setMonthlyAttendance,
  isHoliday, saveMonthlyAttendance,
  isSunday, isSecondSaturday, isFourthSaturday, isFifthSaturday,
  lateThreshold: lateThresholdProp,
  onSaveLateThreshold,
}: AttendanceDashboardProps) {

  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState<string>("name");
  const [sortDir,      setSortDir]      = useState<"asc"|"desc">("asc");
  const [selectedEmp,  setSelectedEmp]  = useState<(User & { idx: number }) | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [highlightOver,setHighlightOver]= useState(false);

  const [lateThreshold, setLateThreshold] = useState<LateThreshold>(lateThresholdProp ?? DEFAULT_LATE_THRESHOLD);
  useEffect(() => { if (lateThresholdProp) setLateThreshold(lateThresholdProp); }, [lateThresholdProp]);

  function handleSaveThreshold(t: LateThreshold) { setLateThreshold(t); onSaveLateThreshold?.(t); }

  // ── Session data (now also fetches breaks) ────────────────────────────────
  const [monthlySessionData, setMonthlySessionData] = useState<Record<string, Record<string, DaySessionNode>>>({});
  const [loadingData,        setLoadingData]         = useState(false);

  const year  = monthlyDate.getFullYear();
  const month = monthlyDate.getMonth();

  useEffect(() => {
    if (!db || users.length === 0) return;
    const fetchMonthData = async () => {
      setLoadingData(true);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const newData: Record<string, Record<string, DaySessionNode>> = {};
      const promises: Promise<void>[] = [];

      for (const emp of users) {
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const docId   = `${emp.uid}_${dateStr}`;

          promises.push(
            getDoc(doc(db, "attendance", docId)).then((snap) => {
              if (!snap.exists()) return;
              const data     = snap.data();
              const sessions: any[] = data.sessions || [];
              // ── NEW: read real breaks array ────────────────────────────
              const rawBreaks: Break[] = data.breaks || [];
              const breakMins          = calcTotalBreakMinutes(rawBreaks);

              const sorted = [...sessions].sort((a, b) => {
                const aT = a.checkIn?.toDate ? a.checkIn.toDate().getTime() : new Date(a.checkIn).getTime();
                const bT = b.checkIn?.toDate ? b.checkIn.toDate().getTime() : new Date(b.checkIn).getTime();
                return aT - bT;
              });

              const first = sorted[0];
              const last  = sorted[sorted.length - 1];
              const checkInTs  = first?.checkIn?.toDate ? first.checkIn.toDate() : first?.checkIn ? new Date(first.checkIn) : null;
              const checkOutTs = last?.checkOut?.toDate ? last.checkOut.toDate() : last?.checkOut ? new Date(last.checkOut) : null;

              let totalMins = 0;
              for (const s of sorted) {
                if (!s.checkIn) continue;
                const start = s.checkIn?.toDate ? s.checkIn.toDate().getTime() : new Date(s.checkIn).getTime();
                const end   = s.checkOut ? (s.checkOut?.toDate ? s.checkOut.toDate().getTime() : new Date(s.checkOut).getTime()) : Date.now();
                const diff  = end - start;
                if (diff > 0) totalMins += Math.floor(diff / 60000);
              }
              totalMins = Math.min(totalMins, 540);

              const fmt = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
              if (!newData[emp.uid]) newData[emp.uid] = {};
              newData[emp.uid][dateStr] = {
                checkIn:      checkInTs  ? fmt(checkInTs)  : null,
                checkOut:     checkOutTs ? fmt(checkOutTs) : null,
                totalMins,
                breakMins,         // ← real break minutes
                breaks:    rawBreaks,  // ← raw breaks for tooltip
                hasData:   true,
                sessionCount: sorted.length,
              };
            }).catch(() => {})
          );
        }
      }

      await Promise.all(promises);
      setMonthlySessionData(newData);
      setLoadingData(false);
    };
    fetchMonthData();
  }, [db, users, year, month]);

  // ── Per-employee summaries ─────────────────────────────────────────────────
  const summaries = useMemo(() => users.map((emp, idx) => {
    const days = buildDayStatuses(emp.uid, year, month, monthlyAttendance, monthlySessionData,
      isHoliday, isSunday, isSecondSaturday, isFourthSaturday, isFifthSaturday, lateThreshold);

    let present=0, absent=0, lop=0, late=0, leave=0, totalMins=0, totalBreakMins=0;
    days.forEach((d: any) => {
      if (d.isFuture || d.status === null) return;
      if (d.status === "P")             present++;
      if (d.status === "A")             absent++;
      if (d.status === "LOP")           lop++;
      if (d.status === "L")             leave++;
      if (d.totalMins)                  totalMins      += d.totalMins;
      if (d.breakMins)                  totalBreakMins += d.breakMins;  // ← real
      if (d.isLate && d.status !== "H") late++;
    });
    const workDays = present + absent + lop + leave;
    const pct      = workDays > 0 ? Math.round((present / workDays) * 100) : 0;
    const avgMins  = present  > 0 ? Math.round(totalMins / present)        : 0;
    return { ...emp, idx, present, absent, lop, late, leave, totalMins, workDays, pct, avgMins, totalBreakMins };
  }), [users, year, month, monthlyAttendance, monthlySessionData, lateThreshold]);

  // ── Filter + Sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...summaries
      .filter(e => e.name.toLowerCase().includes(q) || (e.designation||"").toLowerCase().includes(q) || (e.department||"").toLowerCase().includes(q))
      .sort((a, b) => {
        const av = (a as any)[sortBy], bv = (b as any)[sortBy];
        const cmp = typeof av === "string" ? av.localeCompare(bv) : (av ?? 0) - (bv ?? 0);
        return sortDir === "asc" ? cmp : -cmp;
      })];
  }, [summaries, search, sortBy, sortDir]);

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  function handleExport() {
    const rows = filtered.map(e => ({
      Name: e.name, Designation: e.designation || "", Department: e.department || "",
      Present: e.present, Absent: e.absent,
      "Total Work":  fmtMins(e.totalMins),
      "Avg/Day":     fmtMins(e.avgMins),
      "Total Break": fmtMins(e.totalBreakMins),
      "Net Work":    fmtMins(Math.max(0, e.totalMins - e.totalBreakMins)),
      "Attendance %":`${e.pct}%`,
    }));
    exportCSV(rows, `attendance_${MONTHS[month]}_${year}.csv`);
  }

  // ── Team stats for header ──────────────────────────────────────────────────
  const teamTotalBreak  = summaries.reduce((s, e) => s + e.totalBreakMins, 0);
  const overLimitCount  = summaries.filter(e => Object.entries(monthlySessionData[e.uid] || {}).some(([, d]) => d.breakMins > BREAK_LIMIT_MINUTES)).length;

  if (selectedEmp) {
    return (
      <DetailView
        emp={selectedEmp} year={year} month={month}
        monthlyAttendance={monthlyAttendance} setMonthlyAttendance={setMonthlyAttendance}
        monthlySessionData={monthlySessionData} isHoliday={isHoliday}
        saveMonthlyAttendance={saveMonthlyAttendance}
        isSunday={isSunday} isSecondSaturday={isSecondSaturday}
        isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday}
        lateThreshold={lateThreshold} onBack={() => setSelectedEmp(null)}
      />
    );
  }

  return (
    <div className="adash-root">
      <style>{STYLES}</style>

      {showSettings && (
        <SettingsPanel current={lateThreshold} onSave={handleSaveThreshold} onClose={() => setShowSettings(false)} />
      )}

      {loadingData && (
        <div style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.75)", zIndex:999,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
          <div style={{ width:40, height:40, border:"4px solid #e0e7ff", borderTop:"4px solid #4f46e5",
                        borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
          <p style={{ fontSize:14, fontWeight:600, color:"#4f46e5" }}>Loading attendance & breaks…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <header className="adash-topbar">
        <div className="adash-topbar-left">
          <div className="adash-logo">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="#4f46e5" strokeWidth="2"/>
              <path d="M8 2v4M16 2v4M3 10h18" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="8" cy="16" r="1.5" fill="#22c55e"/>
              <circle cx="12" cy="16" r="1.5" fill="#ef4444"/>
              <circle cx="16" cy="16" r="1.5" fill="#f97316"/>
            </svg>
          </div>
          <div>
            <div className="adash-eyebrow">Admin Panel</div>
            <h1 className="adash-title">Attendance Management</h1>
          </div>
        </div>
        <div className="adash-topbar-right">
          <button className="adash-settings-trigger" onClick={() => setShowSettings(true)} title="Configure attendance settings">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <span className="adash-settings-label">Late after</span>
            <span className="adash-settings-value">{fmtThreshold(lateThreshold)}</span>
          </button>
          <div className="adash-month-nav">
            <button className="adash-nav-btn" onClick={() => setMonthlyDate((d: Date) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="adash-month-label">{MONTHS[month]} {year}</span>
            <button className="adash-nav-btn" onClick={() => setMonthlyDate((d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <select className="adash-select" value={year} onChange={e => setMonthlyDate(new Date(+e.target.value, month, 1))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="adash-export-btn" onClick={handleExport}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      <div className="adash-body">
        {/* ── Team break stats bar ─────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(170px, 1fr))", gap:14, marginBottom:20 }}>
          {[
            { label:"Total Employees",  value:String(summaries.length),             icon:"👥", color:"#4f46e5", bg:"#eef2ff" },
            { label:"Team Work Time",   value:fmtMins(summaries.reduce((s,e) => s + e.totalMins, 0)),       icon:"💼", color:"#16a34a", bg:"#f0fdf4" },
            { label:"Team Break Time",  value:fmtMins(teamTotalBreak) || "—",        icon:"☕", color:"#c2410c", bg:"#fff7ed" },
            // { label:"Over-Limit Days",  value:String(overLimitCount),                icon:"⚠️", color: overLimitCount > 0 ? "#dc2626" : "#64748b", bg: overLimitCount > 0 ? "#fef2f2" : "#f8fafc" },
          ].map((s, i) => (
            <div key={i} style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:14, padding:"14px 18px", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize:18, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono', monospace", margin:0, lineHeight:1 }}>{s.value}</p>
                <p style={{ fontSize:11, color:"#64748b", fontWeight:600, margin:"3px 0 0" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="adash-section">
          <div className="adash-section-header">
            <div className="adash-section-title">
              Monthly Summary
              <span className="adash-count-badge">{filtered.length} employees</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              {/* Over-limit highlight toggle */}
              {/* <button
                onClick={() => setHighlightOver(v => !v)}
                style={{
                  display:"flex", alignItems:"center", gap:6, padding:"7px 12px",
                  borderRadius:9, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600,
                  fontFamily:"'Plus Jakarta Sans', sans-serif", transition:"all 0.15s",
                  background: highlightOver ? "#fef2f2" : "#f8fafc",
                  borderColor: highlightOver ? "#fecaca" : "#e2e8f0",
                  color: highlightOver ? "#b91c1c" : "#64748b",
                }}>
                ⚠️ {highlightOver ? "Showing Over-Limit" : "Highlight Over-Limit"}
              </button> */}
              <div className="adash-search-wrap">
                <svg width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"
                     style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input className="adash-search" placeholder="Search name, role, department…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="adash-legend">
            {Object.entries(STATUS_CFG).filter(([k]) => ["P","A","H","L","LOP"].includes(k)).map(([k, v]) => (
              <span key={k} className="adash-legend-item" style={{ color:v.text, background:v.bg, borderColor:v.border }}>
                <span className="adash-legend-dot" style={{ background:v.dot }} />{v.label}
              </span>
            ))}
            <span className="adash-legend-item" style={{ color:"#9a3412", background:"#fff7ed", borderColor:"#fed7aa" }}>
              <span className="adash-legend-dot" style={{ background:"#f97316" }} />☕ Break
            </span>
          </div>

          <div className="adash-table-wrap">
            <table className="adash-table">
              <thead>
                <tr>
                  {[
                    { key:"name",           label:"Employee"      },
                    { key:"present",        label:"Present"       },
                    { key:"absent",         label:"Absent"        },
                    { key:"pct",            label:"Attendance %"  },
                    { key:"totalMins",      label:"Total Work"    },
                    { key:"avgMins",        label:"Avg/Day"       },
                    { key:"totalBreakMins", label:"Total Break ☕" },
                    { key:null,             label:"Details"       },
                  ].map(({ key, label }) => (
                    <th key={label} className={`adash-th${key ? " adash-th-sort" : ""}`} onClick={() => key && toggleSort(key)}>
                      {label}
                      {key && sortBy === key && (
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginLeft:4 }}>
                          <path d={sortDir === "asc" ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/>
                        </svg>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, ri) => {
                  const [g1, g2] = AVATAR_PALETTES[emp.idx % AVATAR_PALETTES.length];
                  const hasOverLimitDay = Object.entries(monthlySessionData[emp.uid] || {}).some(([, d]) => d.breakMins > BREAK_LIMIT_MINUTES);
                  const rowBg = highlightOver && hasOverLimitDay ? "#fff5f5" : undefined;

                  return (
                    <tr key={emp.uid} className="adash-tr" style={{ animationDelay:`${ri * 30}ms`, background:rowBg }}>
                      <td className="adash-td adash-td-emp">
                        <div className="adash-emp-cell">
                          {emp.profilePhoto ? (
                            <img src={emp.profilePhoto} alt="" className="adash-avatar adash-avatar-img" />
                          ) : (
                            <div className="adash-avatar" style={{ background:`linear-gradient(135deg,${g1},${g2})` }}>{initials(emp.name)}</div>
                          )}
                          <div>
                            <div className="adash-emp-name">{emp.name}</div>
                            <div className="adash-emp-role">{emp.designation || "—"}</div>
                            {emp.department && <div className="adash-emp-dept">{emp.department}</div>}
                          </div>
                          {highlightOver && hasOverLimitDay && (
                            <span style={{ marginLeft:6, fontSize:10, background:"#fee2e2", border:"1px solid #fecaca", color:"#b91c1c", padding:"2px 6px", borderRadius:5, fontWeight:700 }}>⚠️ Over</span>
                          )}
                        </div>
                      </td>
                      <td className="adash-td">
                        <span className="adash-stat-badge" style={{ color:STATUS_CFG.P.text, background:STATUS_CFG.P.bg, borderColor:STATUS_CFG.P.border }}>{emp.present}</span>
                      </td>
                      <td className="adash-td">
                        <span className="adash-stat-badge" style={{ color:STATUS_CFG.A.text, background:STATUS_CFG.A.bg, borderColor:STATUS_CFG.A.border }}>{emp.absent}</span>
                      </td>
                      <td className="adash-td">
                        <div className="adash-pct-row">
                          <div className="adash-pct-track">
                            <div className="adash-pct-fill" style={{ width:`${emp.pct}%`, background:emp.pct>=90?"#22c55e":emp.pct>=75?"#f97316":"#ef4444" }}/>
                          </div>
                          <span className="adash-pct-num" style={{ color:emp.pct>=90?"#16a34a":emp.pct>=75?"#c2410c":"#dc2626" }}>{emp.pct}%</span>
                        </div>
                      </td>
                      <td className="adash-td adash-mono">{fmtMins(emp.totalMins)}</td>
                      <td className="adash-td adash-mono">{fmtMins(emp.avgMins)}</td>

                      {/* ── Monthly total break ── */}
                      <td className="adash-td">
                        {emp.totalBreakMins > 0 ? (
                          <span style={{
                            display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
                            borderRadius:7, background:"#fff7ed", border:"1px solid #fed7aa",
                            color:"#9a3412", fontSize:12, fontWeight:700,
                            fontFamily:"'IBM Plex Mono', monospace", whiteSpace:"nowrap",
                          }}>
                            ☕ {fmtMins(emp.totalBreakMins)}
                          </span>
                        ) : <span style={{ color:"#cbd5e1" }}>—</span>}
                      </td>

                      <td className="adash-td">
                        <button className="adash-view-btn" onClick={() => setSelectedEmp({ ...emp })}>
                          View
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="adash-empty">
                <svg width="44" height="44" fill="none" stroke="#cbd5e1" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"/>
                </svg>
                <p>No employees found for "{search}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL VIEW  (day-wise with real break column + tooltips)
// ═══════════════════════════════════════════════════════════════════════════════
function DetailView({
  emp, year, month,
  monthlyAttendance, setMonthlyAttendance,
  monthlySessionData, isHoliday,
  saveMonthlyAttendance,
  isSunday, isSecondSaturday, isFourthSaturday, isFifthSaturday,
  lateThreshold, onBack,
}: any) {

  const [g1, g2] = AVATAR_PALETTES[emp.idx % AVATAR_PALETTES.length];

  const days = useMemo(() => buildDayStatuses(
    emp.uid, year, month, monthlyAttendance, monthlySessionData,
    isHoliday, isSunday, isSecondSaturday, isFourthSaturday, isFifthSaturday, lateThreshold,
  ), [emp.uid, year, month, monthlyAttendance, monthlySessionData, lateThreshold]);

  const stats = useMemo(() => {
    let present=0, absent=0, lop=0, late=0, leave=0, totalMins=0, totalBreakMins=0;
    days.forEach((d: any) => {
      if (d.isFuture || d.status === null) return;
      if (d.status === "P")              present++;
      if (d.status === "A")              absent++;
      if (d.status === "LOP")            lop++;
      if (d.status === "L")              leave++;
      if (d.isLate && d.status !== "H") late++;
      if (d.totalMins)                   totalMins      += d.totalMins;
      if (d.breakMins)                   totalBreakMins += d.breakMins;
    });
    const workDays = present + absent + lop + leave;
    const pct      = workDays > 0 ? Math.round((present / workDays) * 100) : 0;
    return { present, absent, lop, late, leave, totalMins, totalBreakMins, workDays, pct,
             avgMins: present > 0 ? Math.round(totalMins / present) : 0 };
  }, [days]);

  function nextStatus(cur: AttendanceType): AttendanceType {
    if (cur === "H") return "H";
    if (cur === "P") return "A";
    if (cur === "A") return "LOP";
    return "P";
  }

  function toggleDay(dateStr: string, cur: AttendanceType) {
    const ns = nextStatus(cur);
    setMonthlyAttendance((prev: any) => ({ ...prev, [emp.uid]: { ...(prev[emp.uid] || {}), [dateStr]: ns } }));
    saveMonthlyAttendance(emp.uid, dateStr, ns);
  }

  function handleExportDetail() {
    const rows = days.map((d: any) => ({
      Date: d.dateStr, Day: DOW_SHORT[d.dow],
      "Check In": d.checkIn  || "—",
      "Check Out": d.checkOut || "—",
      "Work Time": fmtMins(d.totalMins),
      "Break Time": fmtMins(d.breakMins),
      "Net Work":  fmtMins(Math.max(0, d.totalMins - d.breakMins)),
      Status: STATUS_CFG[d.status as keyof typeof STATUS_CFG]?.label || d.status || "—",
    }));
    exportCSV(rows, `${emp.name.replace(/\s+/g,"_")}_${MONTHS[month]}_${year}.csv`);
  }

  return (
    <div className="adash-root">
      <style>{STYLES}</style>

      <header className="adash-topbar">
        <div className="adash-topbar-left">
          <button className="adash-back-btn" onClick={onBack}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            All Employees
          </button>
          {emp.profilePhoto ? (
            <img src={emp.profilePhoto} alt="" className="adash-avatar adash-avatar-img" style={{ width:40, height:40 }} />
          ) : (
            <div className="adash-avatar" style={{ background:`linear-gradient(135deg,${g1},${g2})`, width:40, height:40, fontSize:14, borderRadius:10 }}>{initials(emp.name)}</div>
          )}
          <div>
            <div className="adash-eyebrow">{emp.department || emp.designation || "Employee"}</div>
            <h1 className="adash-title" style={{ fontSize:18 }}>{emp.name}</h1>
          </div>
        </div>
        <div className="adash-topbar-right">
          <span className="adash-threshold-badge">
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Late after {fmtThreshold(lateThreshold)}
          </span>
          <span className="adash-month-label">{MONTHS[month]} {year}</span>
          <button className="adash-export-btn" onClick={handleExportDetail}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export CSV
          </button>
        </div>
      </header>

      <div className="adash-body">
        {/* KPI Cards */}
        <div className="adash-kpi-grid">
          {[
            { label:"Present Days",  value:stats.present,               color:"#16a34a", bg:"#f0fdf4", icon:"✓"  },
            { label:"Absent Days",   value:stats.absent,                color:"#dc2626", bg:"#fef2f2", icon:"✗"  },
            { label:"Total Work",    value:fmtMins(stats.totalMins),    color:"#0369a1", bg:"#f0f9ff", icon:"⏱" },
            // ── Monthly total break KPI card ──
            { label:"Total Break",   value:fmtMins(stats.totalBreakMins) || "—", color: stats.totalBreakMins > BREAK_LIMIT_MINUTES * 5 ? "#dc2626" : "#c2410c", bg:"#fff7ed", icon:"☕" },
            { label:"Net Work",      value:fmtMins(Math.max(0, stats.totalMins - stats.totalBreakMins)), color:"#4f46e5", bg:"#eef2ff", icon:"💼" },
            {
              label:"Login Status",
              value:(
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:18, height:40 }}>
                  <div style={{ textAlign:"center", lineHeight:1 }}>
                    <div style={{ fontSize:28, fontWeight:800, fontFamily:"'IBM Plex Mono', monospace", color:"#dc2626" }}>{stats.late}</div>
                    <div style={{ fontSize:10, color:"#9a3412", fontWeight:600, marginTop:2 }}>Late</div>
                  </div>
                  <div style={{ textAlign:"center", lineHeight:1 }}>
                    <div style={{ fontSize:28, fontWeight:800, fontFamily:"'IBM Plex Mono', monospace", color:"#16a34a" }}>{stats.present - stats.late}</div>
                    <div style={{ fontSize:10, color:"#166534", fontWeight:600, marginTop:2 }}>On-Time</div>
                  </div>
                </div>
              ),
              color:"#ea580c", bg:"#fff7ed", icon:"⏰"
            },
          ].map((k, i) => (
            <div key={i} className="adash-kpi-card" style={{ animationDelay:`${i*50}ms` }}>
              <div className="adash-kpi-icon" style={{ color:k.color, background:k.bg }}><span style={{ fontSize:15 }}>{k.icon}</span></div>
              <div className="adash-kpi-val" style={{ color:k.color }}>{k.value}</div>
              <div className="adash-kpi-label">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Attendance % bar */}
        <div className="adash-pct-section">
          <div className="adash-pct-header">
            <span className="adash-pct-title">Monthly Attendance Rate</span>
            <span className="adash-pct-big" style={{ color:stats.pct>=90?"#16a34a":stats.pct>=75?"#c2410c":"#dc2626" }}>{stats.pct}%</span>
          </div>
          <div className="adash-pct-track-lg">
            <div className="adash-pct-fill-lg" style={{ width:`${stats.pct}%`, background:stats.pct>=90?"linear-gradient(90deg,#16a34a,#22c55e)":stats.pct>=75?"linear-gradient(90deg,#ea580c,#f97316)":"linear-gradient(90deg,#dc2626,#ef4444)" }}/>
          </div>
          <div className="adash-pct-footer">
            <span>{stats.present} present of {stats.workDays} working days</span>
            <span style={{ fontWeight:600, color:stats.pct>=90?"#16a34a":stats.pct>=75?"#c2410c":"#dc2626" }}>
              {stats.pct>=90?"Excellent ✓":stats.pct>=75?"Satisfactory":"Below Target ⚠"}
            </span>
          </div>
        </div>

        {/* Day table */}
        <div className="adash-section">
          <div className="adash-section-header">
            <div className="adash-section-title">
              Day-wise Attendance
              <span className="adash-count-badge">{days.length} days</span>
            </div>
            <div className="adash-detail-legend">
              <span className="adash-dl-item adash-dl-weekend">Weekend</span>
              <span className="adash-dl-item adash-dl-holiday">Public Holiday</span>
              <span className="adash-dl-item adash-dl-late">Late after {fmtThreshold(lateThreshold)}</span>
              <span className="adash-dl-item" style={{ color:"#9a3412", background:"#fff7ed", borderColor:"#fed7aa" }}>☕ Break (hover for details)</span>
            </div>
          </div>
          <div className="adash-table-wrap">
            <table className="adash-table">
              <thead>
                <tr>
                  {/* ── NEW: Break + Net Work columns added ── */}
                  {["Date","Day","Check In","Check Out","Work","Break ☕","Net Work","Status"].map(h => (
                    <th key={h} className="adash-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(({ day, dateStr, status, isHolidayDay, isPublicHol, isFuture, isToday,
                             dow, checkIn, checkOut, breakMins, breaks, totalMins, isLate }: any) => {
                  const isWeekend = dow === 0 || dow === 6;
                  const cfg = status
                    ? (STATUS_CFG[status as keyof typeof STATUS_CFG] || STATUS_CFG.A)
                    : { label:"—", color:"#94a3b8", bg:"#f8fafc", border:"#e2e8f0", text:"#94a3b8", dot:"#cbd5e1" };
                  const netMins  = Math.max(0, totalMins - breakMins);
                  const isOver   = breakMins > BREAK_LIMIT_MINUTES;

                  let rowClass = "adash-tr";
                  if (isPublicHol)       rowClass += " adash-tr-pubhol";
                  else if (isHolidayDay) rowClass += " adash-tr-holiday";
                  else if (isFuture)     rowClass += " adash-tr-future";
                  else if (isOver)       rowClass += " adash-tr-break-over";

                  const holidayReason = isPublicHol ? "Public Holiday" : isWeekend ? (dow === 0 ? "Sunday" : "Saturday") : null;

                  return (
                    <tr key={day} className={rowClass}>
                      <td className="adash-td">
                        <span className="adash-mono" style={{ fontWeight:600, color:isHolidayDay?"#6366f1":"#1e293b" }}>
                          {String(day).padStart(2,"0")} {MONTH_SHORT[month]}
                        </span>
                        {isPublicHol && <span className="adash-pubhol-badge">Holiday</span>}
                        {isToday     && <span className="adash-today-badge">Today</span>}
                      </td>
                      <td className="adash-td" style={{ color:isWeekend?"#6366f1":"#64748b", fontWeight:isWeekend?600:400, fontSize:12 }}>
                        {DOW_SHORT[dow]}
                      </td>
                      <td className="adash-td adash-mono" style={{ color:isLate?"#c2410c":"#475569", fontWeight:isLate?600:400 }}>
                        {checkIn ? <>{checkIn}{isLate && <span className="adash-late-flag">Late</span>}</> : <span className="adash-dash">—</span>}
                      </td>
                      <td className="adash-td adash-mono" style={{ color:"#475569" }}>
                        {checkOut || <span className="adash-dash">—</span>}
                      </td>
                      {/* Work time */}
                      <td className="adash-td adash-mono">
                        {totalMins > 0 ? (
                          <span style={{ color:totalMins>=480?"#16a34a":"#c2410c", fontWeight:600 }}>{fmtMins(totalMins)}</span>
                        ) : (
                          holidayReason
                            ? <span style={{ fontSize:11, color:"#a5b4fc", fontStyle:"italic", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{holidayReason}</span>
                            : <span className="adash-dash">—</span>
                        )}
                      </td>
                      {/* ── Break cell with tooltip ── */}
                      <td className="adash-td">
                        <BreakCell breakMins={breakMins} breaks={breaks || []} />
                      </td>
                      {/* Net work */}
                      <td className="adash-td adash-mono">
                        {netMins > 0 ? (
                          <span style={{ fontWeight:600, color:"#475569" }}>{fmtMins(netMins)}</span>
                        ) : <span className="adash-dash">—</span>}
                      </td>
                      {/* Status toggle */}
                      <td className="adash-td">
                        {isFuture ? (
                          <span className="adash-status-chip" style={{ color:"#94a3b8", background:"#f8fafc", borderColor:"#e2e8f0", cursor:"default", opacity:0.7, fontStyle:"italic" }}>
                            <span className="adash-status-dot" style={{ background:"#cbd5e1" }}/>—
                          </span>
                        ) : (
                          <button
                            className="adash-status-chip"
                            style={{ color:cfg.text, background:cfg.bg, borderColor:cfg.border, cursor:isHolidayDay?"default":"pointer", opacity:isHolidayDay?0.85:1 }}
                            onClick={() => !isHolidayDay && status && toggleDay(dateStr, status as AttendanceType)}
                            title={isHolidayDay ? cfg.label : `Click to toggle — ${cfg.label}`}
                          >
                            <span className="adash-status-dot" style={{ background:cfg.dot }}/>
                            {cfg.label}
                            {!isHolidayDay && (
                              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft:2, opacity:0.4 }}>
                                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* ── Footer totals row ── */}
              <tfoot>
                <tr style={{ borderTop:"2px solid #e2e8f0", background:"#f8fafc" }}>
                  <td colSpan={4} style={{ padding:"10px 16px", fontSize:12, fontWeight:700, color:"#64748b" }}>Monthly Totals</td>
                  <td style={{ padding:"10px 16px", textAlign:"center", fontFamily:"'IBM Plex Mono', monospace", fontSize:13, fontWeight:700, color:"#0369a1" }}>{fmtMins(stats.totalMins)}</td>
                  <td style={{ padding:"10px 16px", textAlign:"center", fontFamily:"'IBM Plex Mono', monospace", fontSize:13, fontWeight:700, color:"#c2410c" }}>{fmtMins(stats.totalBreakMins) || "—"}</td>
                  <td style={{ padding:"10px 16px", textAlign:"center", fontFamily:"'IBM Plex Mono', monospace", fontSize:13, fontWeight:700, color:"#4f46e5" }}>{fmtMins(Math.max(0, stats.totalMins - stats.totalBreakMins))}</td>
                  <td style={{ padding:"10px 16px", textAlign:"center", fontSize:12, fontWeight:600, color:"#64748b" }}>{stats.present}d</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  .adash-root { min-height:100vh; background:#f8fafc; font-family:'Plus Jakarta Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; color:#1e293b; }
  .adash-topbar { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:12px 28px; background:rgba(255,255,255,0.9); backdrop-filter:blur(20px); border-bottom:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .adash-topbar-left { display:flex; align-items:center; gap:12px; }
  .adash-topbar-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .adash-logo { width:38px; height:38px; border-radius:10px; background:#eef2ff; border:1px solid #c7d2fe; display:flex; align-items:center; justify-content:center; }
  .adash-eyebrow { font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:1px; }
  .adash-title { font-size:19px; font-weight:800; color:#0f172a; letter-spacing:-0.03em; margin:0; }

  .adash-settings-trigger { display:flex; align-items:center; gap:6px; padding:6px 12px; background:#fff7ed; border:1px solid #fed7aa; border-radius:9px; color:#9a3412; font-size:12px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .adash-settings-trigger:hover { background:#ffedd5; border-color:#fdba74; box-shadow:0 2px 8px rgba(251,146,60,0.2); }
  .adash-settings-label { color:#c2410c; opacity:0.75; }
  .adash-settings-value { font-weight:800; color:#9a3412; font-family:'IBM Plex Mono',monospace; font-size:12px; }
  .adash-threshold-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:7px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:11px; font-weight:600; }
  .adash-month-nav { display:flex; align-items:center; gap:2px; background:#f1f5f9; border-radius:10px; padding:3px; }
  .adash-nav-btn { width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:#64748b; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s; }
  .adash-nav-btn:hover { background:white; color:#1e293b; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  .adash-month-label { font-size:13px; font-weight:700; color:#1e293b; padding:0 8px; min-width:130px; text-align:center; }
  .adash-select { padding:7px 12px; background:white; border:1px solid #e2e8f0; border-radius:9px; color:#1e293b; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; outline:none; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
  .adash-export-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; background:#0f172a; border:none; border-radius:9px; color:white; font-size:12px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.15); }
  .adash-export-btn:hover { background:#1e293b; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.15); }
  .adash-back-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; background:white; border:1px solid #e2e8f0; border-radius:9px; color:#64748b; font-size:13px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; }
  .adash-back-btn:hover { background:#f8fafc; color:#1e293b; border-color:#cbd5e1; }

  .adash-body { max-width:1600px; margin:0 auto; padding:28px 28px 60px; }
  .adash-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(155px,1fr)); gap:14px; margin-bottom:20px; }
  .adash-kpi-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:18px 18px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.05); animation:adashFadeUp 0.4s ease both; transition:box-shadow 0.2s,transform 0.2s; }
  .adash-kpi-card:hover { box-shadow:0 6px 20px rgba(0,0,0,0.07); transform:translateY(-1px); }
  .adash-kpi-icon { width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; }
  .adash-kpi-val { font-size:26px; font-weight:800; letter-spacing:-0.04em; margin-bottom:3px; font-family:'IBM Plex Mono',monospace; }
  .adash-kpi-label { font-size:11px; font-weight:700; color:#64748b; }

  .adash-section { background:white; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:20px; }
  .adash-section-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:18px 22px 14px; border-bottom:1px solid #f1f5f9; }
  .adash-section-title { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:800; color:#0f172a; }
  .adash-count-badge { padding:2px 10px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:20px; font-size:11px; font-weight:600; color:#64748b; }
  .adash-legend { display:flex; flex-wrap:wrap; gap:6px; padding:10px 22px; border-bottom:1px solid #f8fafc; }
  .adash-legend-item { display:flex; align-items:center; gap:5px; padding:3px 10px; border-radius:6px; border:1px solid; font-size:11px; font-weight:600; }
  .adash-legend-dot { width:6px; height:6px; border-radius:50%; }

  .adash-search-wrap { position:relative; }
  .adash-search { padding:8px 14px 8px 32px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; color:#1e293b; outline:none; width:230px; transition:all 0.15s; }
  .adash-search:focus { border-color:#6366f1; background:white; box-shadow:0 0 0 3px rgba(99,102,241,0.08); }

  .adash-table-wrap { overflow-x:auto; }
  .adash-table { width:100%; border-collapse:collapse; min-width:820px; }
  .adash-th { padding:11px 16px; font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.07em; text-transform:uppercase; text-align:left; background:#f8fafc; border-bottom:1px solid #e2e8f0; white-space:nowrap; user-select:none; }
  .adash-th-sort { cursor:pointer; }
  .adash-th-sort:hover { color:#1e293b; background:#f1f5f9; }
  .adash-tr { border-bottom:1px solid #f1f5f9; transition:background 0.12s; animation:adashFadeIn 0.3s ease both; }
  .adash-tr:hover { background:#fafbff !important; }
  .adash-tr:last-child { border-bottom:none; }
  .adash-tr-holiday { background:#f5f3ff !important; }
  .adash-tr-pubhol  { background:#fff7ed !important; }
  .adash-tr-future  { background:#fafafa !important; opacity:0.55; }
  /* ── NEW: over-limit row highlight ── */
  .adash-tr-break-over { background:#fff8f8 !important; }
  .adash-td { padding:13px 16px; vertical-align:middle; }
  .adash-td-emp { min-width:220px; }
  .adash-emp-cell { display:flex; align-items:center; gap:12px; }
  .adash-avatar { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:800; }
  .adash-avatar-img { object-fit:cover; }
  .adash-emp-name { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:1px; }
  .adash-emp-role { font-size:11px; color:#64748b; }
  .adash-emp-dept { font-size:10px; color:#94a3b8; margin-top:1px; }
  .adash-stat-badge { display:inline-flex; align-items:center; justify-content:center; padding:3px 12px; border-radius:6px; border:1px solid; font-size:13px; font-weight:700; min-width:36px; font-family:'IBM Plex Mono',monospace; }
  .adash-status-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:7px; border:1px solid; font-size:12px; font-weight:600; white-space:nowrap; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.12s; }
  .adash-status-dot { width:6px; height:6px; border-radius:50%; }
  .adash-pct-row { display:flex; align-items:center; gap:8px; min-width:120px; }
  .adash-pct-track { flex:1; height:6px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
  .adash-pct-fill { height:100%; border-radius:4px; transition:width 0.6s ease; }
  .adash-pct-num { font-size:12px; font-weight:700; min-width:38px; text-align:right; font-family:'IBM Plex Mono',monospace; }

  .adash-pct-section { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px 24px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  .adash-pct-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .adash-pct-title { font-size:13px; font-weight:700; color:#64748b; letter-spacing:0.05em; text-transform:uppercase; }
  .adash-pct-big { font-size:28px; font-weight:800; letter-spacing:-0.04em; font-family:'IBM Plex Mono',monospace; }
  .adash-pct-track-lg { height:10px; background:#f1f5f9; border-radius:8px; overflow:hidden; margin-bottom:8px; }
  .adash-pct-fill-lg { height:100%; border-radius:8px; transition:width 0.8s ease; }
  .adash-pct-footer { display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; }

  .adash-detail-legend { display:flex; gap:10px; flex-wrap:wrap; }
  .adash-dl-item { font-size:11px; font-weight:600; padding:3px 10px; border-radius:5px; border:1px solid; }
  .adash-dl-weekend { color:#4338ca; background:#eef2ff; border-color:#c7d2fe; }
  .adash-dl-holiday { color:#9a3412; background:#fff7ed; border-color:#fed7aa; }
  .adash-dl-late    { color:#9a3412; background:#fff7ed; border-color:#fed7aa; }

  .adash-mono { font-family:'IBM Plex Mono',monospace; font-size:13px; }
  .adash-dash { color:#cbd5e1; }
  .adash-late-flag { margin-left:6px; padding:1px 6px; border-radius:4px; background:#fff7ed; border:1px solid #fed7aa; color:#c2410c; font-size:9px; font-weight:700; letter-spacing:0.05em; }
  .adash-pubhol-badge { margin-left:7px; padding:1px 6px; border-radius:4px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:9px; font-weight:700; letter-spacing:0.04em; }
  .adash-today-badge { margin-left:7px; padding:1px 6px; border-radius:4px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:9px; font-weight:700; letter-spacing:0.04em; }
  .adash-view-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; color:#475569; font-size:12px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .adash-view-btn:hover { background:#eff6ff; border-color:#bfdbfe; color:#2563eb; }
  .adash-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; font-size:14px; }

  /* Settings */
  .settings-overlay { position:fixed; inset:0; z-index:200; background:rgba(15,23,42,0.45); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px; animation:adashFadeIn 0.15s ease; }
  .settings-panel { background:white; border-radius:20px; width:100%; max-width:480px; box-shadow:0 20px 60px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.06); animation:adashFadeUp 0.2s ease; overflow:hidden; }
  .settings-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; border-bottom:1px solid #f1f5f9; }
  .settings-title-row { display:flex; align-items:center; gap:12px; }
  .settings-icon { width:38px; height:38px; border-radius:10px; background:#eef2ff; border:1px solid #c7d2fe; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .settings-eyebrow { font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:2px; }
  .settings-title { font-size:17px; font-weight:800; color:#0f172a; margin:0; letter-spacing:-0.02em; }
  .settings-close-btn { width:30px; height:30px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#94a3b8; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s; flex-shrink:0; }
  .settings-close-btn:hover { background:#fee2e2; border-color:#fecaca; color:#dc2626; }
  .settings-body { padding:20px 24px; }
  .settings-section-label { font-size:11px; font-weight:800; color:#64748b; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px; }
  .settings-desc { font-size:13px; color:#64748b; line-height:1.55; margin-bottom:18px; margin-top:0; }
  .settings-time-row { display:flex; align-items:flex-end; gap:14px; margin-bottom:18px; }
  .settings-field { display:flex; flex-direction:column; gap:6px; }
  .settings-label { font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.06em; text-transform:uppercase; }
  .settings-select { padding:9px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:14px; font-weight:600; color:#1e293b; font-family:'IBM Plex Mono',monospace; outline:none; cursor:pointer; min-width:110px; transition:all 0.15s; }
  .settings-select:focus { border-color:#6366f1; background:white; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
  .settings-preview { display:flex; flex-direction:column; gap:6px; padding:9px 16px; background:#fafafa; border:1.5px dashed #e2e8f0; border-radius:10px; min-width:90px; text-align:center; }
  .settings-preview-label { font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:0.1em; text-transform:uppercase; }
  .settings-preview-time { font-size:18px; font-weight:800; color:#c2410c; font-family:'IBM Plex Mono',monospace; letter-spacing:-0.03em; }
  .settings-info-box { display:flex; align-items:flex-start; gap:8px; padding:12px 14px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; font-size:12px; color:#075985; line-height:1.5; }
  .settings-footer { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f1f5f9; background:#fafafa; }
  .settings-cancel-btn { padding:8px 18px; background:white; border:1px solid #e2e8f0; border-radius:9px; color:#64748b; font-size:13px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; }
  .settings-cancel-btn:hover { background:#f8fafc; color:#1e293b; }
  .settings-save-btn { display:flex; align-items:center; gap:7px; padding:8px 20px; background:#4f46e5; border:none; border-radius:9px; color:white; font-size:13px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 8px rgba(79,70,229,0.3); }
  .settings-save-btn:hover { background:#4338ca; transform:translateY(-1px); box-shadow:0 4px 14px rgba(79,70,229,0.35); }

  @keyframes adashFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes adashFadeIn { from { opacity:0; } to { opacity:1; } }
  .adash-table-wrap::-webkit-scrollbar { height:5px; }
  .adash-table-wrap::-webkit-scrollbar-track { background:#f1f5f9; }
  .adash-table-wrap::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }

  @media (max-width:768px) {
    .adash-body { padding:16px 14px 40px; }
    .adash-topbar { padding:12px 16px; }
    .adash-kpi-grid { grid-template-columns:repeat(2,1fr); }
    .adash-month-label { min-width:0; font-size:12px; }
    .adash-search { width:160px; }
    .settings-time-row { flex-wrap:wrap; }
  }
  @media (max-width:480px) { .adash-kpi-grid { grid-template-columns:1fr 1fr; } }
`;