"use client";

import { useState, useMemo, useEffect } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  calcTotalBreakMinutes,
  BREAK_LIMIT_MINUTES,
  type Break,
} from "@/lib/breakTracking";

// ─ Types ────────────────────────────────────────────────────────────────────
type AttendanceType = "P" | "A" | "H" | "L" | "LOP" | "SL";

type DaySessionNode = {
  checkIn: string | null;
  checkOut: string | null;
  totalMins: number;
  breakMins: number;
  breaks: Break[];
  hasData: boolean;
  sessionCount: number;
};

// ─ Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

const BREAK_ICONS: Record<string, string> = {
  MORNING: "☕",
  LUNCH: "🍽️",
  EVENING: "🌇",
};

const STATUS_CFG = {
  P:   { label: "Present",    color: "#15803d", bg: "#dcfce7", border: "#bbf7d0", dot: "#16a34a" },
  A:   { label: "Absent",     color: "#b91c1c", bg: "#fee2e2", border: "#fecaca", dot: "#ef4444" },
  H:   { label: "Holiday",    color: "#4338ca", bg: "#e0e7ff", border: "#c7d2fe", dot: "#6366f1" },
  L:   { label: "Leave",      color: "#075985", bg: "#e0f2fe", border: "#bae6fd", dot: "#0ea5e9" },
  LOP: { label: "LOP",        color: "#6d28d9", bg: "#ede9fe", border: "#ddd6fe", dot: "#8b5cf6" },
  SL:  { label: "Sick Leave", color: "#075985", bg: "#e0f2fe", border: "#bae6fd", dot: "#0ea5e9" },
};

const holidays = [
  { date: "2026-01-01", title: "New Year" },
  { date: "2026-01-13", title: "Bhogi" },
  { date: "2026-01-14", title: "Pongal" },
  { date: "2026-03-04", title: "Holi" },
  { date: "2026-03-19", title: "Ugadi" },
  { date: "2026-08-15", title: "Independence Day" },
  { date: "2026-08-28", title: "Raksha Bandhan" },
  { date: "2026-09-14", title: "Ganesh Chaturthi" },
  { date: "2026-10-02", title: "Gandhi Jayanthi" },
  { date: "2026-10-20", title: "Dussehra" },
  { date: "2026-11-08", title: "Diwali" },
  { date: "2026-12-25", title: "Christmas" },
];

// ─ Helpers ──────────────────────────────────────────────────────────────────
const isSunday         = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;
const isSecondSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 8  && d <= 14;
const isFourthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 22 && d <= 28;
const isFifthSaturday  = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 29;
const isHoliday        = (dateStr: string) => holidays.find(h => h.date === dateStr) || null;

const TODAY_KEY = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
})();

function fmtMins(m: number): string {
  if (!m || m <= 0) return "—";
  const h = Math.floor(m / 60), min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

function isLateCheckIn(checkIn: string | null, threshold = { hour: 10, minute: 15 }): boolean {
  if (!checkIn) return false;
  const [h, m] = checkIn.split(":").map(Number);
  return h > threshold.hour || (h === threshold.hour && m > threshold.minute);
}

function parseSessionTimes(
  sessionData: Record<string, DaySessionNode>,
  dateStr: string
) {
  const node = sessionData?.[dateStr] ?? null;
  if (!node || !node.hasData) return { checkIn: null, checkOut: null, breakMins: 0, breaks: [] as Break[], totalMins: 0 };
  return {
    checkIn:   node.checkIn   || null,
    checkOut:  node.checkOut  || null,
    totalMins: node.totalMins || 0,
    breakMins: node.breakMins || 0,
    breaks:    node.breaks    || [],
  };
}

function buildDayStatuses(
  uid: string,
  year: number,
  month: number,
  manualAttendance: Record<string, AttendanceType>,
  sessionData: Record<string, DaySessionNode>,
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day     = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow     = new Date(year, month, day).getDay();
    const isFuture    = dateStr > TODAY_KEY;
    const isToday     = dateStr === TODAY_KEY;
    const holiday     = isHoliday(dateStr);
    const isHolidayDay =
      isSunday(year, month, day) ||
      isSecondSaturday(year, month, day) ||
      isFourthSaturday(year, month, day) ||
      isFifthSaturday(year, month, day) ||
      !!holiday;
    const isPublicHol = !!holiday && !isSunday(year, month, day);
    const holidayTitle = holiday?.title || null;

    let status: AttendanceType | null;
    if (isHolidayDay) status = "H";
    else if (isFuture) status = null;
    else {
      const manual = manualAttendance?.[dateStr];
      if (manual) status = manual;
      else status = sessionData?.[dateStr]?.hasData === true ? "P" : "A";
    }

    const { checkIn, checkOut, breakMins, breaks, totalMins } =
      parseSessionTimes(sessionData, dateStr);
    const late = isLateCheckIn(checkIn);

    return {
      day, dateStr, status, isHolidayDay, isPublicHol, isFuture, isToday,
      dow, checkIn, checkOut, breakMins, breaks, totalMins, isLate: late,
      holidayTitle,
    };
  });
}

// ─ Break Tooltip ────────────────────────────────────────────────────────────
function BreakTooltip({ breaks, breakMins }: { breaks: Break[]; breakMins: number }) {
  const isOver = breakMins > BREAK_LIMIT_MINUTES;
  const fmtTs = (ts: any) => {
    if (!ts) return "--";
    try {
      return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return "--"; }
  };
  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, width: 210, background: "#1e293b", color: "white", borderRadius: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)", padding: "12px 14px", pointerEvents: "none",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, paddingBottom:7, borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ fontWeight:600, fontSize:12 }}>Break Details</span>
        <span style={{
          fontWeight:700, fontSize:11, padding:"2px 8px", borderRadius:5,
          background: isOver ? "#ef4444" : "#f97316",
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
                  <span style={{ fontWeight:600, color:"#fbbf24", fontSize:11 }}>
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
          Over limit by {fmtMins(breakMins - BREAK_LIMIT_MINUTES)}
        </div>
      )}
      <div style={{
        position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)",
        width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent",
        borderTop:"5px solid #1e293b",
      }} />
    </div>
  );
}

function BreakCell({ breakMins, breaks }: { breakMins: number; breaks: Break[] }) {
  const [hover, setHover] = useState(false);
  if (!breakMins || breakMins <= 0) return <span style={{ color:"#94a3b8", fontSize:13 }}>—</span>;
  const isOver = breakMins > BREAK_LIMIT_MINUTES;
  return (
    <div style={{ position:"relative", display:"inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        fontSize:13,
        fontWeight: isOver ? 600 : 400,
        color: isOver ? "#ea580c" : "#64748b",
        cursor:"help",
      }}>
        {fmtMins(breakMins)}
      </span>
      {hover && <BreakTooltip breaks={breaks} breakMins={breakMins} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EmployeeAttendanceView() {
  const { user } = useAuth();

  const [viewDate, setViewDate] = useState(new Date());
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const [sessionData,      setSessionData]      = useState<Record<string, DaySessionNode>>({});
  const [manualAttendance, setManualAttendance] = useState<Record<string, AttendanceType>>({});
  const [loading,          setLoading]          = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const newSession: Record<string, DaySessionNode> = {};
      const newManual:  Record<string, AttendanceType> = {};
      const promises: Promise<void>[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const docId   = `${user.uid}_${dateStr}`;
        promises.push(
          getDoc(doc(db, "attendance", docId)).then((snap) => {
            if (!snap.exists()) return;
            const data       = snap.data();
            const sessions: any[] = data.sessions || [];
            const rawBreaks: Break[] = data.breaks || [];
            const breakMins          = calcTotalBreakMinutes(rawBreaks);

            if (data.manualStatus) newManual[dateStr] = data.manualStatus;

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
              const end   = s.checkOut
                ? (s.checkOut?.toDate ? s.checkOut.toDate().getTime() : new Date(s.checkOut).getTime())
                : Date.now();
              const diff  = end - start;
              if (diff > 0) totalMins += Math.floor(diff / 60000);
            }
            totalMins = Math.min(totalMins, 540);

            const fmt = (d: Date) =>
              `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

            newSession[dateStr] = {
              checkIn:      checkInTs  ? fmt(checkInTs)  : null,
              checkOut:     checkOutTs ? fmt(checkOutTs) : null,
              totalMins,
              breakMins,
              breaks:    rawBreaks,
              hasData:   true,
              sessionCount: sorted.length,
            };
          }).catch(() => {})
        );
      }
      await Promise.all(promises);
      setSessionData(newSession);
      setManualAttendance(newManual);
      setLoading(false);
    };
    fetchData();
  }, [user, year, month]);

  const days = useMemo(() =>
    user ? buildDayStatuses(user.uid, year, month, manualAttendance, sessionData) : [],
    [user, year, month, manualAttendance, sessionData]
  );

  const stats = useMemo(() => {
    let present=0, absent=0, lop=0, late=0, leave=0, totalMins=0, totalBreakMins=0;
    days.forEach((d) => {
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
    const avgMins  = present > 0 ? Math.round(totalMins / present) : 0;
    return { present, absent, lop, late, leave, totalMins, totalBreakMins, workDays, pct, avgMins };
  }, [days]);

  if (!user) return null;

  const monthLabel = `${MONTHS[month]} ${year}`;

  return (
    <div className="ea-root">
      <style>{STYLES}</style>

      {/* Loading overlay */}
      {loading && (
        <div className="ea-loading-overlay">
          <div className="ea-spinner" />
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="ea-header">
        <div className="ea-header-left">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
            <rect x="3" y="4" width="18" height="18" rx="3" stroke="#6366f1" strokeWidth="2"/>
            <path d="M8 2v4M16 2v4M3 10h18" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="ea-eyebrow">MY ATTENDANCE</div>
            <div className="ea-month-title">{monthLabel}</div>
          </div>
        </div>

        <div className="ea-header-right">
          <div className="ea-month-nav">
            <button className="ea-nav-btn" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="ea-nav-label">{monthLabel}</span>
            <button className="ea-nav-btn" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <select className="ea-year-select" value={year} onChange={e => setViewDate(new Date(+e.target.value, month, 1))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button className="ea-export-btn" onClick={() => window.print()}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/>
              <path d="M14 2v6h6M8 13h8M8 17h5"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* ── ATTENDANCE RATE ── */}
      <div className="ea-rate-card">
        <div className="ea-rate-row">
          <span className="ea-rate-label">ATTENDANCE RATE</span>
          <span className="ea-rate-value" style={{
            color: stats.pct >= 90 ? "#16a34a" : stats.pct >= 75 ? "#ea580c" : "#dc2626"
          }}>{stats.pct}%</span>
        </div>
        <div className="ea-rate-track">
          <div className="ea-rate-fill" style={{
            width: `${stats.pct}%`,
            background: stats.pct >= 90 ? "#16a34a" : stats.pct >= 75 ? "#ea580c" : "#dc2626",
          }} />
        </div>
        <div className="ea-rate-footer">
          <span>{stats.present} present of {stats.workDays} working days</span>
          <span style={{ color: stats.pct >= 90 ? "#16a34a" : stats.pct >= 75 ? "#ea580c" : "#dc2626", fontWeight:500 }}>
            {stats.pct >= 90 ? "Excellent" : stats.pct >= 75 ? "Satisfactory" : "Below target"}
          </span>
        </div>
      </div>

      {/* ── DAILY LOG TABLE ── */}
      <div className="ea-table-card">
        {/* Table header bar */}
        <div className="ea-table-header">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span className="ea-table-title">Daily log</span>
            <span className="ea-pill">{monthLabel}</span>
          </div>
          <div className="ea-legend">
            <span className="ea-legend-dot" style={{ background:"#ef4444" }} />
            <span className="ea-legend-text">Late after 10:15</span>
            <span className="ea-legend-dot" style={{ background:"#ea580c" }} />
            <span className="ea-legend-text">Break exceeded</span>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="ea-table-scroll">
          <table className="ea-table">
            <thead>
              <tr>
                {["DATE","DAY","CHECK IN","CHECK OUT","WORK","BREAK","NET","STATUS"].map(h => (
                  <th key={h} className="ea-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(({
                day, dateStr, status, isHolidayDay, isPublicHol, isFuture, isToday,
                dow, checkIn, checkOut, breakMins, breaks, totalMins, isLate, holidayTitle,
              }) => {
                const isWeekend = dow === 0 || dow === 6;
                const cfg = status ? STATUS_CFG[status as keyof typeof STATUS_CFG] : null;
                const netMins = Math.max(0, totalMins - breakMins);
                const isBreakOver = breakMins > BREAK_LIMIT_MINUTES;

                const holidayReason = isPublicHol
                  ? (holidayTitle || "Public Holiday")
                  : dow === 0
                  ? "Sunday"
                  : isSecondSaturday(year, month, day) ? "2nd Saturday"
                  : isFourthSaturday(year, month, day) ? "4th Saturday"
                  : isFifthSaturday(year, month, day) ? "5th Saturday"
                  : null;

                let rowBg = "transparent";
                if (isToday) rowBg = "#eff6ff";
                else if (isHolidayDay) rowBg = "#f5f3ff";
                else if (isFuture) rowBg = "transparent";

                return (
                  <tr key={day} style={{ background: rowBg }} className="ea-tr">
                    {/* DATE */}
                    <td className="ea-td">
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:500, color: isHolidayDay ? "#6366f1" : "#1e293b" }}>
                          {String(day).padStart(2,"0")} {MONTH_SHORT[month]}
                        </span>
                        {isToday && (
                          <span className="ea-today-badge">Today</span>
                        )}
                      </div>
                    </td>

                    {/* DAY */}
                    <td className="ea-td">
                      <span style={{
                        fontSize:13,
                        color: isWeekend ? "#6366f1" : "#64748b",
                        fontWeight: isWeekend ? 500 : 400,
                      }}>
                        {DOW_SHORT[dow]}
                      </span>
                    </td>

                    {/* CHECK IN */}
                    <td className="ea-td">
                      {checkIn ? (
                        <span style={{ fontSize:13, color: isLate ? "#dc2626" : "#1e293b", fontWeight: isLate ? 500 : 400 }}>
                          {checkIn}
                        </span>
                      ) : <span className="ea-dash">—</span>}
                    </td>

                    {/* CHECK OUT */}
                    <td className="ea-td">
                      {checkOut
                        ? <span style={{ fontSize:13, color:"#1e293b" }}>{checkOut}</span>
                        : <span className="ea-dash">—</span>}
                    </td>

                    {/* WORK */}
                    <td className="ea-td">
                      {totalMins > 0 ? (
                        <span style={{
                          fontSize:13, fontWeight:500,
                          color: totalMins >= 480 ? "#16a34a" : "#ea580c"
                        }}>
                          {fmtMins(totalMins)}
                        </span>
                      ) : holidayReason ? (
                        <span style={{ fontSize:12, color:"#a5b4fc" }}>{holidayReason}</span>
                      ) : <span className="ea-dash">—</span>}
                    </td>

                    {/* BREAK */}
                    <td className="ea-td">
                      <BreakCell breakMins={breakMins} breaks={breaks || []} />
                    </td>

                    {/* NET */}
                    <td className="ea-td">
                      {netMins > 0
                        ? <span style={{ fontSize:13, color:"#475569" }}>{fmtMins(netMins)}</span>
                        : <span className="ea-dash">—</span>}
                    </td>

                    {/* STATUS */}
                    <td className="ea-td">
                      {isFuture ? (
                        <span className="ea-dash">—</span>
                      ) : cfg ? (
                        <span className="ea-status-chip" style={{
                          background: cfg.bg,
                          color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                        }}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot, display:"inline-block", flexShrink:0 }} />
                          {cfg.label}
                        </span>
                      ) : <span className="ea-dash">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="ea-tfoot-row">
                <td colSpan={4} className="ea-tfoot-td" style={{ textAlign:"left", color:"#64748b", fontSize:12, fontWeight:600 }}>
                  Monthly Totals
                </td>
                <td className="ea-tfoot-td" style={{ color:"#0369a1", fontWeight:600, fontSize:13 }}>
                  {fmtMins(stats.totalMins)}
                </td>
                <td className="ea-tfoot-td" style={{ color:"#ea580c", fontWeight:600, fontSize:13 }}>
                  {fmtMins(stats.totalBreakMins) || "—"}
                </td>
                <td className="ea-tfoot-td" style={{ color:"#4f46e5", fontWeight:600, fontSize:13 }}>
                  {fmtMins(Math.max(0, stats.totalMins - stats.totalBreakMins))}
                </td>
                <td className="ea-tfoot-td" style={{ color:"#64748b", fontSize:12, fontWeight:500 }}>
                  {stats.present}d present
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Print-only summary */}
      <div className="ea-print-only">
        <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>My Attendance Report — {monthLabel}</div>
        <div style={{ fontSize:11, color:"#64748b" }}>
          Present: {stats.present} | Absent: {stats.absent} | LOP: {stats.lop} | Leave: {stats.leave} | Late: {stats.late} | Attendance: {stats.pct}%
        </div>
        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
          Total Work: {fmtMins(stats.totalMins)} | Break: {fmtMins(stats.totalBreakMins)||"—"} | Net: {fmtMins(Math.max(0,stats.totalMins-stats.totalBreakMins))} | Avg/Day: {fmtMins(stats.avgMins)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES — matches screenshot: clean, minimal, white cards
// ═══════════════════════════════════════════════════════════════════════════════
const STYLES = `
  .ea-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 40px;
  }

  /* ── Loading ── */
  .ea-loading-overlay {
    position: fixed; inset: 0;
    background: rgba(255,255,255,0.75);
    z-index: 999;
    display: flex; align-items: center; justify-content: center;
  }
  .ea-spinner {
    width: 32px; height: 32px;
    border: 3px solid #e0e7ff;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: ea-spin 0.7s linear infinite;
  }

  /* ── Header ── */
  .ea-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 18px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-bottom: 12px;
  }
  .ea-header-left {
    display: flex; align-items: center; gap: 10px;
  }
  .ea-eyebrow {
    font-size: 10px; font-weight: 600; color: #94a3b8;
    letter-spacing: 0.08em; margin-bottom: 1px;
  }
  .ea-month-title {
    font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;
  }
  .ea-header-right {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .ea-month-nav {
    display: flex; align-items: center; gap: 0;
    border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
    background: white;
  }
  .ea-nav-btn {
    width: 30px; height: 30px; border: none; background: transparent;
    color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.1s;
  }
  .ea-nav-btn:hover { background: #f8fafc; color: #1e293b; }
  .ea-nav-label {
    font-size: 13px; font-weight: 600; color: #1e293b;
    padding: 0 12px; min-width: 110px; text-align: center;
    border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;
    line-height: 30px;
  }
  .ea-year-select {
    height: 32px; padding: 0 10px;
    border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 13px; color: #1e293b;
    background: white; outline: none; cursor: pointer;
  }
  .ea-export-btn {
    display: flex; align-items: center; gap: 6px;
    height: 32px; padding: 0 14px;
    border: 1px solid #e2e8f0; border-radius: 8px;
    background: white; color: #475569;
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.12s;
  }
  .ea-export-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #1e293b; }

  /* ── Rate card ── */
  .ea-rate-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 12px;
  }
  .ea-rate-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .ea-rate-label {
    font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: 0.08em;
  }
  .ea-rate-value {
    font-size: 24px; font-weight: 700; letter-spacing: -0.03em;
  }
  .ea-rate-track {
    height: 6px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 8px;
  }
  .ea-rate-fill {
    height: 100%; border-radius: 4px; transition: width 0.6s ease;
  }
  .ea-rate-footer {
    display: flex; justify-content: space-between;
    font-size: 12px; color: #94a3b8;
  }

  /* ── Table card ── */
  .ea-table-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  .ea-table-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 10px;
    padding: 14px 18px 12px;
    border-bottom: 1px solid #f1f5f9;
  }
  .ea-table-title {
    font-size: 14px; font-weight: 600; color: #0f172a;
  }
  .ea-pill {
    display: inline-block;
    padding: 2px 10px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    font-size: 11px; font-weight: 500; color: #64748b;
  }
  .ea-legend {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .ea-legend-dot {
    width: 7px; height: 7px; border-radius: 50%;
    display: inline-block; flex-shrink: 0;
  }
  .ea-legend-text {
    font-size: 11px; color: #94a3b8; margin-right: 4px;
  }
  .ea-table-scroll { overflow-x: auto; }
  .ea-table {
    width: 100%; border-collapse: collapse; min-width: 640px;
  }
  .ea-th {
    padding: 9px 14px;
    font-size: 10px; font-weight: 600; color: #94a3b8;
    letter-spacing: 0.07em;
    text-align: left;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .ea-tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.1s;
  }
  .ea-tr:last-child { border-bottom: none; }
  .ea-tr:hover { background: #fafbff !important; }
  .ea-td {
    padding: 10px 14px;
    vertical-align: middle;
  }
  .ea-dash { font-size: 13px; color: #cbd5e1; }

  /* Status chip */
  .ea-status-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 6px;
    font-size: 12px; font-weight: 500;
    white-space: nowrap;
  }

  /* Today badge */
  .ea-today-badge {
    font-size: 10px; font-weight: 600; color: #1d4ed8;
    background: #eff6ff; border: 1px solid #bfdbfe;
    padding: 1px 6px; border-radius: 4px;
  }

  /* Footer row */
  .ea-tfoot-row {
    border-top: 2px solid #e2e8f0;
    background: #f8fafc;
  }
  .ea-tfoot-td {
    padding: 10px 14px;
  }

  /* Print only */
  .ea-print-only { display: none; }

  /* Scrollbar */
  .ea-table-scroll::-webkit-scrollbar { height: 4px; }
  .ea-table-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
  .ea-table-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

  /* Animation */
  @keyframes ea-spin { to { transform: rotate(360deg); } }

  /* Responsive */
  @media (max-width: 640px) {
    .ea-header { flex-direction: column; align-items: flex-start; }
    .ea-nav-label { min-width: 90px; }
    .ea-table-header { flex-direction: column; align-items: flex-start; }
  }

  /* Print */
  @media print {
    * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    @page { size: A4 portrait; margin: 12mm; }
    .ea-export-btn { display: none !important; }
    .ea-table-scroll { overflow: visible !important; }
    .ea-table { min-width: unset !important; font-size: 10px !important; }
    .ea-th { padding: 6px 10px !important; font-size: 9px !important; }
    .ea-td { padding: 5px 10px !important; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tr { break-inside: avoid !important; }
    .ea-print-only { display: block !important; margin-bottom: 10px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; }
  }
`;