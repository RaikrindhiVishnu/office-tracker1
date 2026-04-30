"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getDoc, doc, collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import type { View } from "@/types/View";
import type { EmployeeRow } from "@/types/EmployeeRow";
import {
  autoSaveTodaySnapshot,
  fetchSnapshotDates,
  fetchSnapshotByDate,
  formatDateLabel,
  type DailySnapshot,
} from "@/lib/dailySnapshot";
import { db } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";

// ── CHANGE 1: Import EmployeeTodayPanel ────────────────────────────────────
import EmployeeTodayPanel from "@/components/EmployeeTodayPanel";

// Types
interface Break {
  type: "MORNING" | "LUNCH" | "EVENING";
  startTime: Timestamp;
  endTime?: Timestamp;
}

// ── WorkUpdate type ────────────────────────────────────────────────────────
interface WorkUpdate {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  task: string;
  notes: string;
  status: string;
  priority: string;
  createdAt: Timestamp;
}

//Helpers
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Returns total break seconds for an array of Break objects */
function calcTotalBreakSeconds(breaks: Break[]): number {
  return breaks.reduce((acc, b) => {
    if (!b.startTime) return acc;
    const start = b.startTime.toDate().getTime();
    const end   = b.endTime ? b.endTime.toDate().getTime() : start;
    return acc + Math.max(0, Math.floor((end - start) / 1000));
  }, 0);
}

/** "1h 10m" or "45m" or "—" */
function fmtBreak(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

/** Active break type if any */
function getActiveBreakType(breaks: Break[]): string | null {
  const active = breaks.find((b) => b.startTime && !b.endTime);
  if (!active) return null;
  return active.type === "MORNING" ? "☕ Morning" : active.type === "LUNCH" ? "🍱 Lunch" : "🌆 Evening";
}

// ── WorkUpdate status / priority config ───────────────────────────────────
const WU_STATUS_CFG: Record<string, { icon: string; bg: string; color: string; border: string }> = {
  "In Progress": { icon: "🔄", bg: "bg-blue-50",   color: "text-blue-700",   border: "border-blue-200"   },
  "Completed":   { icon: "✅", bg: "bg-green-50",  color: "text-green-700",  border: "border-green-200"  },
  "Blocked":     { icon: "🚫", bg: "bg-red-50",    color: "text-red-700",    border: "border-red-200"    },
  "Review":      { icon: "👀", bg: "bg-purple-50", color: "text-purple-700", border: "border-purple-200" },
};

const WU_PRIORITY_CFG: Record<string, { dot: string; color: string; badge: string }> = {
  "Low":    { dot: "bg-gray-400",   color: "text-gray-600",   badge: "bg-gray-100 text-gray-600"     },
  "Medium": { dot: "bg-yellow-400", color: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  "High":   { dot: "bg-orange-500", color: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
  "Urgent": { dot: "bg-red-500",    color: "text-red-700",    badge: "bg-red-100 text-red-700"       },
};

// ── Work Update Tooltip (Portal-based) ────────────────────────────────────
function WorkUpdateTooltip({ update }: { update: WorkUpdate | null }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0, above: false });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const TOOLTIP_W  = 280;
  const TOOLTIP_H  = 180;

  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r          = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const above      = spaceBelow < TOOLTIP_H + 16 && spaceAbove > TOOLTIP_H + 16;
    let left = r.left;
    if (left + TOOLTIP_W > window.innerWidth - 8) left = window.innerWidth - TOOLTIP_W - 8;
    if (left < 8) left = 8;
    const top = above ? r.top - TOOLTIP_H - 8 : r.bottom + 8;
    setPos({ top, left, above });
  }, []);

  const handleEnter = () => { computePos(); setVisible(true); };
  const handleLeave = () => setVisible(false);

  // If no update, render a plain dash matching the original cell style
  if (!update) return <span className="text-slate-700">—</span>;

  const scfg = WU_STATUS_CFG[update.status]    ?? WU_STATUS_CFG["In Progress"];
  const pcfg = WU_PRIORITY_CFG[update.priority] ?? WU_PRIORITY_CFG["Medium"];
  const fmtTime = (ts: Timestamp | undefined | null) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const tooltip = visible ? createPortal(
    <div
      ref={tooltipRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={handleLeave}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: TOOLTIP_W, zIndex: 99999, pointerEvents: "auto" }}
      className="bg-[#1e1f3b] text-white rounded-xl shadow-2xl p-3.5 text-xs"
    >
      {/* Arrow */}
      <div style={{
        position: "absolute", left: 18,
        ...(pos.above
          ? { bottom: -6, borderTop: "6px solid #1e1f3b", borderLeft: "6px solid transparent", borderRight: "6px solid transparent" }
          : { top: -6, borderBottom: "6px solid #1e1f3b", borderLeft: "6px solid transparent", borderRight: "6px solid transparent" }
        ),
        width: 0, height: 0,
      }}/>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-300">Task Details</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pcfg.badge}`}>{update.priority}</span>
      </div>
      {/* Task */}
      <p className="font-semibold text-white text-sm leading-snug mb-2">{update.task}</p>
      {/* Status */}
      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 ${scfg.bg} ${scfg.color} ${scfg.border}`}>
        {scfg.icon} {update.status}
      </div>
      {/* Notes */}
      {update.notes && (
        <p className="text-slate-300 italic text-[11px] leading-relaxed mb-2 border-t border-slate-600 pt-2">
          "{update.notes}"
        </p>
      )}
      {/* Time */}
      <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-1 border-t border-slate-600 pt-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Submitted at {fmtTime(update.createdAt)}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="cursor-pointer max-w-xs truncate"
      >
        {/* Styled exactly like the original plain-text task cell */}
        <span className="text-slate-700 text-sm truncate block hover:text-indigo-600 transition-colors">
          {update.task || "—"}
        </span>
      </div>
      {tooltip}
    </>
  );
}

// ── Mini Calendar─────────
function MiniCalendar({
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };
  const isNextDisabled = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  const toKey = (day: number) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span className="font-bold text-slate-900 text-sm">{monthNames[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} disabled={isNextDisabled}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isNextDisabled ? "text-slate-300 cursor-not-allowed" : "hover:bg-slate-100 text-slate-600"}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx}/>;
          const key      = toKey(day);
          const hasData  = availableDates.has(key);
          const isSelected = selectedDate === key;
          const isToday  = key === todayKey;
          const isFuture = key > todayKey;
          return (
            <button key={idx} disabled={!hasData || isFuture} onClick={() => hasData && onSelectDate(key)}
              className={`relative mx-auto w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center transition-all
                ${isSelected ? "bg-linear-to-br from-indigo-600 to-purple-600 text-white shadow-md scale-105" : ""}
                ${!isSelected && hasData ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:scale-105 cursor-pointer font-semibold" : ""}
                ${!isSelected && !hasData && !isFuture ? "text-slate-400 cursor-default" : ""}
                ${isFuture ? "text-slate-300 cursor-not-allowed" : ""}
                ${isToday && !isSelected ? "ring-2 ring-indigo-400 ring-offset-1" : ""}
              `}>
              {day}
              {hasData && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"/>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block"/>Has data
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded-full bg-linear-to-br from-indigo-600 to-purple-600 inline-block"/>Selected
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded ring-2 ring-indigo-400 inline-block"/>Today
        </div>
      </div>
    </div>
  );
}

// ── Stat Card──
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}
function DashboardStatCard({ title, value, icon, gradient }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mb-2">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Break badge
function BreakBadge({ seconds, activeType }: { seconds: number; activeType: string | null }) {
  const formatted = fmtBreak(seconds);
  if (!seconds || seconds <= 0) {
    return <span className="text-slate-400 font-medium">—</span>;
  }
  return <span className="text-slate-900 font-bold">{formatted}</span>;
}

// ── Props──────
interface DashboardProps {
  totalEmployees: number;
  onlineEmployees: number;
  offlineEmployees: number;
  avgWorkTime: number;
  rows: EmployeeRow[];
  busy: boolean;
  formatTime: (ts: any) => string;
  formatTotal: (minutes: number) => string;
  setView: React.Dispatch<React.SetStateAction<View>>;
  setSelectedEmployee: React.Dispatch<React.SetStateAction<EmployeeRow | null>>;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({
  totalEmployees,
  onlineEmployees,
  offlineEmployees,
  avgWorkTime,
  rows,
  busy,
  formatTime,
  formatTotal,
  setView,
  setSelectedEmployee,
}: DashboardProps) {

  // ── State──
  const [searchQuery,  setSearchQuery]  = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL"|"ONLINE"|"OFFLINE">("ONLINE");
  const [currentPage,  setCurrentPage]  = useState(1);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const saveAttempted = useRef(false);
  const itemsPerPage = 10;

  // ── CHANGE 2: State for Today Panel ───────────────────────────────────────
  const [todayPanelEmployee, setTodayPanelEmployee] = useState<EmployeeRow | null>(null);

  // ── Break data per employee (fetched today)
  const [breakData, setBreakData] = useState<Record<string, Break[]>>({});
  const [loadingBreaks, setLoadingBreaks] = useState(false);

  // ── Live workUpdates map (uid → latest today) ─────────────────────────────
  const [workUpdatesMap, setWorkUpdatesMap] = useState<Record<string, WorkUpdate>>({});

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "workUpdates"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkUpdate));
      const todayUpdates = all.filter(u => {
        if (!u.createdAt) return false;
        const d = new Date(u.createdAt.toDate());
        d.setHours(0, 0, 0, 0);
        return d.getTime() === todayStart.getTime();
      });
      // Keep only latest per uid
      const map: Record<string, WorkUpdate> = {};
      todayUpdates.forEach(u => { if (!map[u.uid]) map[u.uid] = u; });
      setWorkUpdatesMap(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (busy || rows.length === 0) return;
    const dateStr = getTodayStr();
    setLoadingBreaks(true);
    Promise.all(
      rows.map(async (r) => {
        try {
          const snap = await getDoc(doc(db, "attendance", `${r.uid}_${dateStr}`));
          return { uid: r.uid, breaks: snap.exists() ? (snap.data().breaks ?? []) : [] };
        } catch {
          return { uid: r.uid, breaks: [] };
        }
      })
    ).then((results) => {
      const map: Record<string, Break[]> = {};
      results.forEach(({ uid, breaks }) => { map[uid] = breaks; });
      setBreakData(map);
      setLoadingBreaks(false);
    });
  }, [busy, rows.length]);

  // ── History state─────
  const [showHistory,       setShowHistory]       = useState(false);
  const [historyDates,      setHistoryDates]      = useState<string[]>([]);
  const [availableDatesSet, setAvailableDatesSet] = useState<Set<string>>(new Set());
  const [selectedDate,      setSelectedDate]      = useState<string|null>(null);
  const [historySnapshot,   setHistorySnapshot]   = useState<DailySnapshot|null>(null);
  const [loadingDates,      setLoadingDates]      = useState(false);
  const [loadingSnapshot,   setLoadingSnapshot]   = useState(false);
  const [historySearch,     setHistorySearch]     = useState("");
  const [historyFilter,     setHistoryFilter]     = useState<"ALL"|"ONLINE"|"OFFLINE">("ALL");
  const [historyPage,       setHistoryPage]       = useState(1);

  // ── Auto-save snapshot
  useEffect(() => {
    if (busy || rows.length === 0 || saveAttempted.current) return;
    saveAttempted.current = true;
    autoSaveTodaySnapshot(rows, avgWorkTime)
      .then(() => setSnapshotSaved(true))
      .catch((err) => console.error("Snapshot save failed:", err));
  }, [busy, rows, avgWorkTime]);

  // ── Load history dates
  useEffect(() => {
    if (!showHistory || historyDates.length > 0) return;
    setLoadingDates(true);
    fetchSnapshotDates().then((dates) => {
      setHistoryDates(dates);
      setAvailableDatesSet(new Set(dates));
      if (dates.length > 0) setSelectedDate(dates[0]);
    }).finally(() => setLoadingDates(false));
  }, [showHistory]);

  // ── Load snapshot─────
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSnapshot(true);
    setHistorySnapshot(null);
    setHistoryPage(1); setHistorySearch(""); setHistoryFilter("ALL");
    fetchSnapshotByDate(selectedDate).then(setHistorySnapshot).finally(() => setLoadingSnapshot(false));
  }, [selectedDate]);

  // ── Filter live rows──
  const filteredRows = rows.filter((r) => {
    const s = searchQuery.toLowerCase();
    return (
      ((r.name ?? "").toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s)) &&
      (filterStatus === "ALL" || r.status === filterStatus)
    );
  });

  const totalPages  = Math.ceil(filteredRows.length / itemsPerPage);
  const startIndex  = (currentPage - 1) * itemsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + itemsPerPage);

  // ── Filter history────
  const filteredHistory = useMemo(() => {
    if (!historySnapshot) return [];
    return historySnapshot.employees.filter((e) => {
      const s = historySearch.toLowerCase();
      return (
        (e.name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)) &&
        (historyFilter === "ALL" || e.status === historyFilter)
      );
    });
  }, [historySnapshot, historySearch, historyFilter]);

  const historyTotalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory  = filteredHistory.slice((historyPage-1)*itemsPerPage, historyPage*itemsPerPage);

  const handleFilterChange = (s: "ALL"|"ONLINE"|"OFFLINE") => { setFilterStatus(s); setCurrentPage(1); };

  const getPageNumbers = (current: number, total: number) => {
    const pages: (number|string)[] = [];
    if (total <= 5) { for (let i=1;i<=total;i++) pages.push(i); }
    else if (current <= 3) { pages.push(1,2,3,4,"...",total); }
    else if (current >= total-2) { pages.push(1,"...",total-3,total-2,total-1,total); }
    else { pages.push(1,"...",current-1,current,current+1,"...",total); }
    return pages;
  };

  const attendanceRate = historySnapshot
    ? Math.round((historySnapshot.onlineCount / Math.max(historySnapshot.totalEmployees,1)) * 100)
    : 0;

  return (
    <>
      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        <DashboardStatCard title="Total Employees" value={totalEmployees} gradient="from-blue-500 to-cyan-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
        <DashboardStatCard title="Online Now" value={onlineEmployees} gradient="from-emerald-500 to-green-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <DashboardStatCard title="Offline" value={offlineEmployees} gradient="from-slate-500 to-slate-600"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>}
        />
        <DashboardStatCard title="Avg Work Time" value={formatTotal(avgWorkTime)} gradient="from-violet-500 to-purple-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* ── Live Employee Table ── */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6">

        {/* Header: search + filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Search employees..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["ALL","ONLINE","OFFLINE"] as const).map((s) => (
              <button key={s} onClick={() => handleFilterChange(s)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  filterStatus === s
                    ? s==="ALL" ? "bg-[#4245ca38] text-black shadow-lg"
                      : s==="ONLINE" ? "bg-linear-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                      : "bg-linear-to-r from-slate-600 to-slate-700 text-white shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}>
                {s==="ALL" ? `All (${totalEmployees})` : s==="ONLINE" ? `Online (${onlineEmployees})` : `Offline (${offlineEmployees})`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Showing {filteredRows.length===0?0:startIndex+1}–{Math.min(startIndex+itemsPerPage,filteredRows.length)} of {filteredRows.length} employees
        </p>

        {/* ── Mobile Cards ── */}
        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {!busy && paginatedRows.map((r) => {
            const breaks     = breakData[r.uid] ?? [];
            const breakSecs  = calcTotalBreakSeconds(breaks);
            const activeType = getActiveBreakType(breaks);
            const wu         = workUpdatesMap[r.uid] ?? null;
            const scfg       = wu ? (WU_STATUS_CFG[wu.status] ?? WU_STATUS_CFG["In Progress"]) : null;
            return (
              <div key={r.uid} className="bg-linear-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg">
                      {r.profilePhoto
                        ? <img src={r.profilePhoto} alt={r.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full bg-[#7788ac] flex items-center justify-center text-white font-bold">{r.name?.[0]?.toUpperCase()||"U"}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate">{r.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{r.email}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ml-2 ${r.status==="ONLINE"?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{r.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">Check-in</p>
                    <p className="font-bold text-blue-900 text-sm">{formatTime(r.morningCheckIn)}</p>
                  </div>
                  <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium mb-1">Worked</p>
                    <p className="font-bold text-purple-900 text-sm">{formatTotal(r.totalMinutes)}</p>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-600 font-medium mb-1">Break</p>
                    <p className="font-bold text-amber-800 text-sm">{fmtBreak(breakSecs)}</p>
                    {activeType && <p className="text-[9px] text-amber-500 animate-pulse">{activeType}</p>}
                  </div>
                </div>
                {/* Mobile current task: show wu data if available, else r.task — same card UI as before */}
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium mb-1">Current Task</p>
                  {wu ? (
                    <div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-2">{wu.task}</p>
                      {scfg && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-1 ${scfg.bg} ${scfg.color} ${scfg.border}`}>
                          {scfg.icon} {wu.status}
                        </span>
                      )}
                      {wu.notes && <p className="text-slate-400 italic mt-0.5 text-[10px]">"{wu.notes}"</p>}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{r.task}</p>
                  )}
                </div>
                {/* ── CHANGE 3a: Mobile button opens Today Panel ── */}
                <button onClick={() => setTodayPanelEmployee(r)}
                  className="w-full px-4 py-2.5 bg-[#5e8076] text-white rounded-xl font-semibold hover:bg-[#152b5c] transition-all shadow-md">
                  View Today Activity
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-linear-to-r from-slate-50 to-slate-100">
              <tr>
                {["Employee","Status","Check-in","Total Work","Total Break","Current Task","Actions"].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {!busy && paginatedRows.length > 0 ? paginatedRows.map((r) => {
                const breaks     = breakData[r.uid] ?? [];
                const breakSecs  = calcTotalBreakSeconds(breaks);
                const activeType = getActiveBreakType(breaks);
                const wu         = workUpdatesMap[r.uid] ?? null;
                return (
                  <tr key={r.uid} className="hover:bg-slate-50 transition-colors">
                    {/* Employee */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0">
                          {r.profilePhoto
                            ? <img src={r.profilePhoto} alt={r.name} className="w-full h-full object-cover"/>
                            : <div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold">{r.name?.[0]?.toUpperCase()||"U"}</div>}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          <div className="text-sm text-slate-500">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${r.status==="ONLINE"?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>
                        <span className={`w-2 h-2 rounded-full ${r.status==="ONLINE"?"bg-emerald-500 animate-pulse":"bg-slate-400"}`}/>
                        {r.status}
                      </span>
                    </td>
                    {/* Check-in */}
                    <td className="px-5 py-4 text-slate-700 font-medium">{formatTime(r.morningCheckIn)}</td>
                    {/* Total Work */}
                    <td className="px-5 py-4 text-slate-900 font-bold">{formatTotal(r.totalMinutes)}</td>
                    {/* Total Break */}
                    <td className="px-5 py-4">
                      <BreakBadge seconds={breakSecs} activeType={activeType}/>
                    </td>
                    {/* Current Task — only functionality changed: now shows WorkUpdateTooltip on hover */}
                    <td className="px-5 py-4 text-slate-700 max-w-xs truncate">
                      <WorkUpdateTooltip update={wu} />
                    </td>
                    {/* ── CHANGE 3b: Eye button opens Today Panel ── */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setTodayPanelEmployee(r)}
                        title="View Today Activity"
                        className="p-1 rounded-md hover:bg-slate-200 transition group">
                        <img
                          src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                          alt="View Today Activity"
                          draggable="false"
                          className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition"
                        />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">{busy?"Loading employees...":"No employees found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-600">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p=>Math.max(p-1,1))} disabled={currentPage===1}
                className={`px-3 py-2 rounded-lg transition-all ${currentPage===1?"bg-slate-100 text-slate-400 cursor-not-allowed":"bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              {getPageNumbers(currentPage,totalPages).map((page,i)=>(
                <button key={i} onClick={()=>typeof page==="number"&&setCurrentPage(page)} disabled={page==="..."}
                  className={`min-w-10 px-3 py-2 rounded-lg font-medium transition-all ${page===currentPage?"bg-linear-to-r from-indigo-600 to-blue-600 text-white shadow-lg":page==="..."?"text-slate-400 cursor-default":"bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                  {page}
                </button>
              ))}
              <button onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages))} disabled={currentPage===totalPages}
                className={`px-3 py-2 rounded-lg transition-all ${currentPage===totalPages?"bg-slate-100 text-slate-400 cursor-not-allowed":"bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <div className="text-sm text-slate-600">{itemsPerPage} per page</div>
          </div>
        )}
      </div>

      {/* ── History Section ── */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <button onClick={()=>setShowHistory(v=>!v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Daily History</p>
              <p className="text-xs text-slate-500">Browse past employee logs by date</p>
            </div>
            {historyDates.length>0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{historyDates.length} days</span>
            )}
          </div>
          <div className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center transition-transform duration-300 ${showHistory?"rotate-180":""}`}>
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        {showHistory && (
          <div className="border-t border-slate-200 p-4 lg:p-6 space-y-5">
            {loadingDates && (
              <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"/>Loading available dates...
              </div>
            )}
            {!loadingDates && historyDates.length===0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📭</div>
                <p className="font-semibold text-slate-600">No history yet</p>
                <p className="text-sm text-slate-400 mt-1">Snapshots are saved automatically each day.</p>
              </div>
            )}
            {!loadingDates && historyDates.length>0 && (
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="shrink-0">
                  <MiniCalendar availableDates={availableDatesSet} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>
                  {selectedDate && <p className="mt-2 text-xs text-center text-slate-500">Viewing: <span className="font-semibold text-indigo-600">{formatDateLabel(selectedDate)}</span></p>}
                </div>
                {loadingSnapshot && (
                  <div className="flex-1 flex items-center justify-center py-10 gap-3 text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"/>Loading...
                  </div>
                )}
                {!loadingSnapshot && historySnapshot && (
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center"><p className="text-2xl font-bold text-slate-900">{historySnapshot.totalEmployees}</p><p className="text-xs text-slate-500 mt-0.5">Total</p></div>
                      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 text-center"><p className="text-2xl font-bold text-emerald-700">{historySnapshot.onlineCount}</p><p className="text-xs text-emerald-500 mt-0.5">Online</p></div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center"><p className="text-2xl font-bold text-slate-600">{historySnapshot.offlineCount}</p><p className="text-xs text-slate-400 mt-0.5">Offline</p></div>
                      <div className="bg-violet-50 rounded-xl border border-violet-100 p-3 text-center"><p className="text-2xl font-bold text-violet-700">{formatTotal(historySnapshot.avgWorkTime)}</p><p className="text-xs text-violet-400 mt-0.5">Avg Work</p></div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2"><span>Attendance Rate</span><span>{attendanceRate}%</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-linear-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700" style={{width:`${attendanceRate}%`}}/>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative w-full sm:w-72">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search employees..." value={historySearch}
                          onChange={(e)=>{setHistorySearch(e.target.value);setHistoryPage(1);}}
                          className="w-full pl-9 pr-4 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none transition-colors"/>
                      </div>
                      <div className="flex gap-2">
                        {(["ALL","ONLINE","OFFLINE"] as const).map((s)=>(
                          <button key={s} onClick={()=>{setHistoryFilter(s);setHistoryPage(1);}}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${historyFilter===s?s==="ALL"?"bg-indigo-600 text-white shadow":s==="ONLINE"?"bg-emerald-600 text-white shadow":"bg-slate-600 text-white shadow":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                            {s==="ALL"?`All (${historySnapshot.employees.length})`:s==="ONLINE"?`Online (${historySnapshot.onlineCount})`:`Offline (${historySnapshot.offlineCount})`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full">
                        <thead className="bg-linear-to-r from-slate-50 to-slate-100">
                          <tr>{["Employee","Status","Check-in","Total Work","Task"].map(h=>(
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {paginatedHistory.length>0?paginatedHistory.map(e=>(
                            <tr key={e.uid} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl overflow-hidden shadow shrink-0">
                                    {e.profilePhoto?<img src={e.profilePhoto} alt={e.name} className="w-full h-full object-cover"/>
                                      :<div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold text-sm">{e.name[0]?.toUpperCase()}</div>}
                                  </div>
                                  <div><p className="font-semibold text-slate-900 text-sm">{e.name}</p><p className="text-xs text-slate-400">{e.email}</p></div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${e.status==="ONLINE"?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${e.status==="ONLINE"?"bg-emerald-500":"bg-slate-400"}`}/>{e.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-700 font-medium text-sm">{formatTime(e.morningCheckIn)}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">{formatTotal(e.totalMinutes)}</td>
                              <td className="px-5 py-3.5 text-slate-600 text-sm max-w-xs truncate">{e.task||<span className="italic text-slate-400">—</span>}</td>
                            </tr>
                          )):(
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic text-sm">No employees match your search</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:hidden">
                      {paginatedHistory.map(e=>(
                        <div key={e.uid} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-xl overflow-hidden shadow">
                                {e.profilePhoto?<img src={e.profilePhoto} alt={e.name} className="w-full h-full object-cover"/>
                                  :<div className="w-full h-full bg-[#7788ac] flex items-center justify-center text-white font-bold text-sm">{e.name[0]?.toUpperCase()}</div>}
                              </div>
                              <div><p className="font-bold text-sm text-slate-900">{e.name}</p><p className="text-xs text-slate-400">{e.email}</p></div>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${e.status==="ONLINE"?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{e.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-white rounded-lg p-2 border border-blue-100"><p className="text-xs text-blue-500">Check-in</p><p className="font-bold text-sm text-blue-900">{formatTime(e.morningCheckIn)}</p></div>
                            <div className="bg-white rounded-lg p-2 border border-purple-100"><p className="text-xs text-purple-500">Worked</p><p className="font-bold text-sm text-purple-900">{formatTotal(e.totalMinutes)}</p></div>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-slate-100"><p className="text-xs text-slate-400 mb-0.5">Task</p><p className="text-sm text-slate-700">{e.task||<span className="italic text-slate-400">—</span>}</p></div>
                        </div>
                      ))}
                    </div>
                    {historyTotalPages>1&&(
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button onClick={()=>setHistoryPage(p=>Math.max(p-1,1))} disabled={historyPage===1}
                          className={`p-2 rounded-lg border-2 transition-all ${historyPage===1?"border-slate-100 text-slate-300 cursor-not-allowed":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        {getPageNumbers(historyPage,historyTotalPages).map((p,i)=>(
                          <button key={i} onClick={()=>typeof p==="number"&&setHistoryPage(p)} disabled={p==="..."}
                            className={`min-w-9 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${p===historyPage?"bg-indigo-600 text-white shadow":p==="..."?"text-slate-400 cursor-default":"border-2 border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                            {p}
                          </button>
                        ))}
                        <button onClick={()=>setHistoryPage(p=>Math.min(p+1,historyTotalPages))} disabled={historyPage===historyTotalPages}
                          className={`p-2 rounded-lg border-2 transition-all ${historyPage===historyTotalPages?"border-slate-100 text-slate-300 cursor-not-allowed":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHANGE 4: Render Today Panel ── */}
      {todayPanelEmployee && (
        <EmployeeTodayPanel
          employee={todayPanelEmployee}
          adminUid="admin"
          onClose={() => setTodayPanelEmployee(null)}
        />
      )}
    </>
  );
}