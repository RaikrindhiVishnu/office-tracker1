"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { View } from "@/types/View";
import { EmployeeRow } from "@/types/EmployeeRow";
import {
  autoSaveTodaySnapshot,
  fetchSnapshotDates,
  fetchSnapshotByDate,
  formatDateLabel,
  DailySnapshot,
} from "@/lib/dailySnapshot";

// ── Mini Calendar Component ───────────────────────────────────────────────────
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
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Don't allow navigating to future months
  const isNextDisabled = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  const toKey = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${viewYear}-${m}-${d}`;
  };

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-slate-900 text-sm">{monthNames[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} disabled={isNextDisabled}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isNextDisabled ? "text-slate-300 cursor-not-allowed" : "hover:bg-slate-100 text-slate-600"}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const key = toKey(day);
          const hasData = availableDates.has(key);
          const isSelected = selectedDate === key;
          const isToday = key === todayKey;
          const isFuture = key > todayKey;

          return (
            <button
              key={idx}
              disabled={!hasData || isFuture}
              onClick={() => hasData && onSelectDate(key)}
              className={`
                relative mx-auto w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center transition-all
                ${isSelected ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md scale-105" : ""}
                ${!isSelected && hasData ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:scale-105 cursor-pointer font-semibold" : ""}
                ${!isSelected && !hasData && !isFuture ? "text-slate-400 cursor-default" : ""}
                ${isFuture ? "text-slate-300 cursor-not-allowed" : ""}
                ${isToday && !isSelected ? "ring-2 ring-indigo-400 ring-offset-1" : ""}
              `}
            >
              {day}
              {hasData && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block" />
          Has data
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 inline-block" />
          Selected
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-3 rounded ring-2 ring-indigo-400 inline-block" />
          Today
        </div>
      </div>
    </div>
  );
}

interface DashboardProps {
  totalEmployees: number;
  onlineEmployees: number;
  offlineEmployees: number;
  avgWorkTime: number;
  rows: EmployeeRow[];
  busy: boolean;
  formatTime: (minutes: number) => string;
  formatTotal: (minutes: number) => string;
  setView: React.Dispatch<React.SetStateAction<View>>;
  setSelectedEmployee: React.Dispatch<React.SetStateAction<EmployeeRow | null>>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

function StatCard({ title, value, icon, gradient }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mb-2">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

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
  // ── Live dashboard state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ONLINE" | "OFFLINE">("ONLINE");
  const [currentPage, setCurrentPage] = useState(1);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const saveAttempted = useRef(false);
  const itemsPerPage = 10;

  // ── History state ─────────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [availableDatesSet, setAvailableDatesSet] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [historySnapshot, setHistorySnapshot] = useState<DailySnapshot | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [historyPage, setHistoryPage] = useState(1);

  // ── Auto-save today's snapshot ────────────────────────────────────────────
  useEffect(() => {
    if (busy || rows.length === 0 || saveAttempted.current) return;
    saveAttempted.current = true;
    autoSaveTodaySnapshot(rows, avgWorkTime)
      .then(() => setSnapshotSaved(true))
      .catch((err) => console.error("Snapshot save failed:", err));
  }, [busy, rows, avgWorkTime]);

  // ── Load dates when history panel opens ──────────────────────────────────
  useEffect(() => {
    if (!showHistory || historyDates.length > 0) return;
    setLoadingDates(true);
    fetchSnapshotDates()
      .then((dates) => {
        setHistoryDates(dates);
        setAvailableDatesSet(new Set(dates));
        if (dates.length > 0) setSelectedDate(dates[0]);
      })
      .finally(() => setLoadingDates(false));
  }, [showHistory]);

  // ── Load snapshot when date changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSnapshot(true);
    setHistorySnapshot(null);
    setHistoryPage(1);
    setHistorySearch("");
    setHistoryFilter("ALL");
    fetchSnapshotByDate(selectedDate)
      .then(setHistorySnapshot)
      .finally(() => setLoadingSnapshot(false));
  }, [selectedDate]);

  // ── Live filter + paginate ────────────────────────────────────────────────
const filteredRows = rows.filter((r) => {
  const search = searchQuery.toLowerCase();

  const matchesSearch =
    (r.name ?? "").toLowerCase().includes(search) ||
    (r.email ?? "").toLowerCase().includes(search);

  const matchesStatus =
    filterStatus === "ALL" || r.status === filterStatus;

  return matchesSearch && matchesStatus;
});


  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + itemsPerPage);

  // ── History filter + paginate ─────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (!historySnapshot) return [];
    return historySnapshot.employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(historySearch.toLowerCase()) ||
        e.email.toLowerCase().includes(historySearch.toLowerCase());
      const matchesStatus = historyFilter === "ALL" || e.status === historyFilter;
      return matchesSearch && matchesStatus;
    });
  }, [historySnapshot, historySearch, historyFilter]);

  const historyTotalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  );

  const handleFilterChange = (s: "ALL" | "ONLINE" | "OFFLINE") => {
    setFilterStatus(s);
    setCurrentPage(1);
  };

  const getPageNumbers = (current: number, total: number) => {
    const pages: (number | string)[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else if (current <= 3) {
      pages.push(1, 2, 3, 4, "...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...", total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
    return pages;
  };

  const attendanceRate = historySnapshot
    ? Math.round((historySnapshot.onlineCount / Math.max(historySnapshot.totalEmployees, 1)) * 100)
    : 0;

  return (
    <>
      {/* Auto-save badge */}
      {/* {snapshotSaved && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Today's data saved to history
        </div>
      )} */}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Total Employees" value={totalEmployees} gradient="from-blue-500 to-cyan-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard title="Online Now" value={onlineEmployees} gradient="from-emerald-500 to-green-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard title="Offline" value={offlineEmployees} gradient="from-slate-500 to-slate-600"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
        />
        <StatCard title="Avg Work Time" value={formatTotal(avgWorkTime)} gradient="from-violet-500 to-purple-500"
          icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Live Employee Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search employees..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(["ALL", "ONLINE", "OFFLINE"] as const).map((s) => (
              <button key={s} onClick={() => handleFilterChange(s)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  filterStatus === s
                    ? s === "ALL" ? "bg-[#4245ca38] text-black shadow-lg"
                      : s === "ONLINE" ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                      : "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s === "ALL" ? `All (${totalEmployees})` : s === "ONLINE" ? `Online (${onlineEmployees})` : `Offline (${offlineEmployees})`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Showing {filteredRows.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredRows.length)} of {filteredRows.length} employees
        </p>

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {!busy && paginatedRows.map((r) => (
            <div key={r.uid} className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg">
                    {r.profilePhoto ? <img src={r.profilePhoto} alt={r.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[#7788ac] flex items-center justify-center text-white font-bold">{r.name?.[0]?.toUpperCase() || "U"}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{r.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{r.email}</p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ml-2 ${r.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{r.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><p className="text-xs text-blue-600 font-medium mb-1">Check-in</p><p className="font-bold text-blue-900">{formatTime(r.morningCheckIn)}</p></div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100"><p className="text-xs text-purple-600 font-medium mb-1">Worked</p><p className="font-bold text-purple-900">{formatTotal(r.totalMinutes)}</p></div>
              </div>
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Current Task</p>
                <p className="text-sm font-medium text-slate-800 line-clamp-2">{r.task}</p>
              </div>
              <button onClick={() => { setSelectedEmployee(r); setView("profile"); }} className="w-full px-4 py-2.5 bg-[#5e8076] text-white rounded-xl font-semibold hover:bg-[#152b5c] transition-all shadow-md">View Profile</button>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
              <tr>
                {["Employee", "Status", "Check-in", "Total", "Current Task", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {!busy && paginatedRows.length > 0 ? paginatedRows.map((r) => (
                <tr key={r.uid} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
                        {r.profilePhoto ? <img src={r.profilePhoto} alt={r.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold">{r.name?.[0]?.toUpperCase() || "U"}</div>}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="text-sm text-slate-500">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${r.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      <span className={`w-2 h-2 rounded-full ${r.status === "ONLINE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />{r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">{formatTime(r.morningCheckIn)}</td>
                  <td className="px-6 py-4 text-slate-900 font-bold">{formatTotal(r.totalMinutes)}</td>
                  <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{r.task}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setSelectedEmployee(r); setView("profile"); }} className="p-1 rounded-md hover:bg-slate-200 transition group">
                      <img src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png" alt="View" draggable="false" className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">{busy ? "Loading employees..." : "No employees found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — Live */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-600">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg transition-all ${currentPage === 1 ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              {getPageNumbers(currentPage, totalPages).map((page, i) => (
                <button key={i} onClick={() => typeof page === "number" && setCurrentPage(page)} disabled={page === "..."}
                  className={`min-w-[40px] px-3 py-2 rounded-lg font-medium transition-all ${page === currentPage ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg" : page === "..." ? "text-slate-400 cursor-default" : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg transition-all ${currentPage === totalPages ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="text-sm text-slate-600">{itemsPerPage} per page</div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HISTORY SECTION — collapsible, right below live table
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

        {/* Toggle header */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Daily History</p>
              <p className="text-xs text-slate-500">Browse past employee logs by date</p>
            </div>
            {historyDates.length > 0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {historyDates.length} days
              </span>
            )}
          </div>
          <div className={`w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center transition-transform duration-300 ${showHistory ? "rotate-180" : ""}`}>
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Collapsible body */}
        {showHistory && (
          <div className="border-t border-slate-200 p-4 lg:p-6 space-y-5">

            {/* Loading dates */}
            {loadingDates && (
              <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                Loading available dates...
              </div>
            )}

            {/* Empty state */}
            {!loadingDates && historyDates.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📭</div>
                <p className="font-semibold text-slate-600">No history yet</p>
                <p className="text-sm text-slate-400 mt-1">Snapshots are saved automatically each day you open the dashboard.</p>
              </div>
            )}

            {/* Calendar + snapshot panel */}
            {!loadingDates && historyDates.length > 0 && (
              <>
                <div className="flex flex-col lg:flex-row gap-5">
                  {/* Calendar */}
                  <div className="flex-shrink-0">
                    <MiniCalendar
                      availableDates={availableDatesSet}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                    />
                    {selectedDate && (
                      <p className="mt-2 text-xs text-center text-slate-500">
                        Viewing: <span className="font-semibold text-indigo-600">{formatDateLabel(selectedDate)}</span>
                      </p>
                    )}
                  </div>

                {/* Loading snapshot */}
                {loadingSnapshot && (
                  <div className="flex-1 flex items-center justify-center py-10 gap-3 text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                    Loading {selectedDate ? formatDateLabel(selectedDate) : ""}...
                  </div>
                )}

                {/* Snapshot data */}
                {!loadingSnapshot && historySnapshot && (
                  <div className="flex-1 space-y-4">

                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                        <p className="text-2xl font-bold text-slate-900">{historySnapshot.totalEmployees}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Total</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-700">{historySnapshot.onlineCount}</p>
                        <p className="text-xs text-emerald-500 mt-0.5">Online</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
                        <p className="text-2xl font-bold text-slate-600">{historySnapshot.offlineCount}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Offline</p>
                      </div>
                      <div className="bg-violet-50 rounded-xl border border-violet-100 p-3 text-center">
                        <p className="text-2xl font-bold text-violet-700">{formatTotal(historySnapshot.avgWorkTime)}</p>
                        <p className="text-xs text-violet-400 mt-0.5">Avg Work</p>
                      </div>
                    </div>

                    {/* Attendance bar */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                        <span>Attendance Rate</span>
                        <span>{attendanceRate}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700" style={{ width: `${attendanceRate}%` }} />
                      </div>
                    </div>

                    {/* Search + Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative w-full sm:w-72">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" placeholder="Search employees..." value={historySearch}
                          onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                          className="w-full pl-9 pr-4 py-2 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        {(["ALL", "ONLINE", "OFFLINE"] as const).map((s) => (
                          <button key={s} onClick={() => { setHistoryFilter(s); setHistoryPage(1); }}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              historyFilter === s
                                ? s === "ALL" ? "bg-indigo-600 text-white shadow"
                                  : s === "ONLINE" ? "bg-emerald-600 text-white shadow"
                                  : "bg-slate-600 text-white shadow"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {s === "ALL" ? `All (${historySnapshot.employees.length})`
                              : s === "ONLINE" ? `Online (${historySnapshot.onlineCount})`
                              : `Offline (${historySnapshot.offlineCount})`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                          <tr>
                            {["Employee", "Status", "Check-in", "Total Work", "Task"].map((h) => (
                              <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {paginatedHistory.length > 0 ? paginatedHistory.map((e) => (
                            <tr key={e.uid} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl overflow-hidden shadow flex-shrink-0">
                                    {e.profilePhoto ? <img src={e.profilePhoto} alt={e.name} className="w-full h-full object-cover" />
                                      : <div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold text-sm">{e.name[0]?.toUpperCase()}</div>}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900 text-sm">{e.name}</p>
                                    <p className="text-xs text-slate-400">{e.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${e.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${e.status === "ONLINE" ? "bg-emerald-500" : "bg-slate-400"}`} />{e.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-700 font-medium text-sm">{formatTime(e.morningCheckIn)}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">{formatTotal(e.totalMinutes)}</td>
                              <td className="px-5 py-3.5 text-slate-600 text-sm max-w-xs truncate" title={e.task}>
                                {e.task || <span className="italic text-slate-400">—</span>}
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic text-sm">No employees match your search</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="grid grid-cols-1 gap-3 lg:hidden">
                      {paginatedHistory.map((e) => (
                        <div key={e.uid} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-xl overflow-hidden shadow">
                                {e.profilePhoto ? <img src={e.profilePhoto} alt={e.name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full bg-[#7788ac] flex items-center justify-center text-white font-bold text-sm">{e.name[0]?.toUpperCase()}</div>}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-slate-900">{e.name}</p>
                                <p className="text-xs text-slate-400">{e.email}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${e.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{e.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-white rounded-lg p-2 border border-blue-100"><p className="text-xs text-blue-500">Check-in</p><p className="font-bold text-sm text-blue-900">{formatTime(e.morningCheckIn)}</p></div>
                            <div className="bg-white rounded-lg p-2 border border-purple-100"><p className="text-xs text-purple-500">Worked</p><p className="font-bold text-sm text-purple-900">{formatTotal(e.totalMinutes)}</p></div>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-slate-100">
                            <p className="text-xs text-slate-400 mb-0.5">Task</p>
                            <p className="text-sm text-slate-700">{e.task || <span className="italic text-slate-400">—</span>}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination — History */}
                    {historyTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button onClick={() => setHistoryPage(p => Math.max(p - 1, 1))} disabled={historyPage === 1}
                          className={`p-2 rounded-lg border-2 transition-all ${historyPage === 1 ? "border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        {getPageNumbers(historyPage, historyTotalPages).map((p, i) => (
                          <button key={i} onClick={() => typeof p === "number" && setHistoryPage(p)} disabled={p === "..."}
                            className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${p === historyPage ? "bg-indigo-600 text-white shadow" : p === "..." ? "text-slate-400 cursor-default" : "border-2 border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                            {p}
                          </button>
                        ))}
                        <button onClick={() => setHistoryPage(p => Math.min(p + 1, historyTotalPages))} disabled={historyPage === historyTotalPages}
                          className={`p-2 rounded-lg border-2 transition-all ${historyPage === historyTotalPages ? "border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div> {/* end flex row: calendar + snapshot */}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}