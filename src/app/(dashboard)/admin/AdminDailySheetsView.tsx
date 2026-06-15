"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, orderBy, doc, getDoc, where, getDocs,
} from "firebase/firestore";
import type { DailySheetEntry } from "@/types/dailySheet";
import { getTodayDateStr } from "@/lib/breakTracking";
import * as XLSX from "xlsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = getTodayDateStr();

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  const colors = ["bg-violet-500","bg-indigo-500","bg-sky-500","bg-emerald-500","bg-rose-500","bg-amber-500","bg-pink-500"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

type SortKey = "name" | "date" | "in" | "out" | "sys" | "task" | "status" | "hours" | "state";
type SortDir = "asc" | "desc";

// ── Bar Chart ────────────────────────────────────────────────────────────────
function TeamPerformanceChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-3 h-36 px-2">
      {data.map((d, i) => {
        const pct = Math.round((d.value / max) * 100);
        const isMax = d.value === max;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0 group cursor-pointer"
            title={`${d.label}: ${d.value}h`}>
            <span className={`text-[10px] font-bold ${isMax ? "text-emerald-600" : "text-slate-400"}`}>
              {isMax ? "100%" : `${pct}%`}
            </span>
            <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
              <div
                className={`w-full rounded-t-md transition-all group-hover:opacity-80 ${isMax ? "bg-[#2ea84f]" : "bg-[#c5e8d0]"}`}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
function EmployeePerformanceChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-600 font-medium truncate max-w-[120px]" title={d.label}>{d.label}</span>
            <span className="text-xs font-bold text-slate-700">{d.pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%`, transition: "width 1.2s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sort Icon ────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="flex flex-col gap-px ml-0.5">
      <svg className={`w-2 h-2 ${active && dir === "asc" ? "text-indigo-600" : "opacity-30"}`} viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5-5 5 5H7z"/></svg>
      <svg className={`w-2 h-2 ${active && dir === "desc" ? "text-indigo-600" : "opacity-30"}`} viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5 5 5-5H7z"/></svg>
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDailySheetsView() {
  const [allEntries, setAllEntries] = useState<DailySheetEntry[]>([]);
  const [employees, setEmployees] = useState<{ uid: string; name: string }[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { in: string; out: string; sys: string }>>({});
  const [bannerSlide, setBannerSlide] = useState(0);
  const [chartView, setChartView] = useState<"raw" | "centers">("raw");

  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState(todayStr.substring(0, 7));
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Refs for scrolling and search focus
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Banner auto-slide ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setBannerSlide((s) => (s + 1) % 5), 3000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "dailySheets"), orderBy("createdAt", "desc")),
      async (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailySheetEntry));
        setAllEntries(data);
        const uniqueUids = Array.from(new Set(data.map((e) => e.uid)));
        const list: { uid: string; name: string }[] = [];
        for (const uid of uniqueUids) {
          const us = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
          if (!us.empty) {
            const p = us.docs[0].data();
            list.push({ uid, name: p.name ?? p.displayName ?? p.email?.split("@")[0] ?? "Unknown" });
          } else {
            list.push({ uid, name: data.find((e) => e.uid === uid)?.userName ?? uid });
          }
        }
        setEmployees(list);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "dailySheets"), where("monthStr", "==", selectedMonth)));
      const pairs = Array.from(new Set(snap.docs.map((d) => `${d.data().uid}_${d.data().dateStr}`)));
      const fmt = (ts: any) => ts ? ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const map: Record<string, { in: string; out: string; sys: string }> = {};
      await Promise.all(pairs.map(async (key) => {
        const as = await getDoc(doc(db, "attendance", key));
        if (as.exists()) {
          const att = as.data(); const sessions = att.sessions || [];
          if (sessions.length > 0) {
            const first = sessions[0]; const last = sessions[sessions.length - 1];
            let add = 0;
            if (!last.checkOut) {
              const ds = key.split("_").slice(1).join("_");
              add = ds === todayStr ? Math.floor((Date.now() - last.checkIn.toMillis()) / 60000) : Math.max(0, 9*60-(att.totalMinutes||0));
            }
            map[key] = { in: fmt(first.checkIn), out: last.checkOut ? fmt(last.checkOut) : "--:--", sys: `${Number(((att.totalMinutes||0)+add)/60).toFixed(1)}h` };
          }
        }
      }));
      setAttendanceMap(map);
    })();
  }, [selectedMonth]);

  const empName = useCallback((uid: string) => employees.find((e) => e.uid === uid)?.name ?? uid, [employees]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  const monthEntries = useMemo(() => allEntries.filter((e) => e.monthStr === selectedMonth), [allEntries, selectedMonth]);
  const totalMonthHrs = useMemo(() => monthEntries.reduce((s, e) => s + (e.hours || 0), 0), [monthEntries]);
  const submittedCount = useMemo(() => monthEntries.filter((e) => !e.isDraft && !e.isHoliday).length, [monthEntries]);
  const draftCount = useMemo(() => monthEntries.filter((e) => e.isDraft).length, [monthEntries]);

  const teamPerf = useMemo(() => {
    const map: Record<string, number> = {};
    monthEntries.forEach((e) => { map[e.uid] = (map[e.uid] || 0) + (e.hours || 0); });
    return Object.entries(map)
      .map(([uid, hrs]) => ({ label: empName(uid).split(" ")[0], value: hrs }))
      .sort((a, b) => b.value - a.value).slice(0, 7);
  }, [monthEntries, empName]);

  const empPerfData = useMemo(() => {
    if (!employees.length) return [];
    const map: Record<string, number> = {};
    monthEntries.forEach((e) => { map[e.uid] = (map[e.uid] || 0) + (e.hours || 0); });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxVal = sorted[0]?.[1] || 1;
    const colors = ["bg-emerald-500", "bg-indigo-500", "bg-amber-400", "bg-rose-400"];
    return sorted.map(([uid, hrs], i) => ({
      label: empName(uid), pct: Math.round((hrs / maxVal) * 100), color: colors[i] || "bg-slate-400",
    }));
  }, [monthEntries, empName, employees.length]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => allEntries.filter((e) => {
    if (selectedEmployee !== "ALL" && e.uid !== selectedEmployee) return false;
    if (selectedMonth && e.monthStr !== selectedMonth) return false;
    if (selectedDate && e.dateStr !== selectedDate) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!empName(e.uid).toLowerCase().includes(q) && !e.taskTitle.toLowerCase().includes(q) && !e.project.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allEntries, selectedEmployee, selectedMonth, selectedDate, search, empName]);

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const attA = attendanceMap[`${a.uid}_${a.dateStr}`];
      const attB = attendanceMap[`${b.uid}_${b.dateStr}`];
      switch (sortKey) {
        case "name": return dir * empName(a.uid).localeCompare(empName(b.uid));
        case "date": return dir * a.dateStr.localeCompare(b.dateStr);
        case "in":   return dir * (attA?.in ?? "").localeCompare(attB?.in ?? "");
        case "out":  return dir * (attA?.out ?? "").localeCompare(attB?.out ?? "");
        case "sys":  return dir * parseFloat(attA?.sys ?? "0") - dir * parseFloat(attB?.sys ?? "0");
        case "task": return dir * a.taskTitle.localeCompare(b.taskTitle);
        case "status": return dir * (a.status ?? "").localeCompare(b.status ?? "");
        case "hours": return dir * ((a.hours || 0) - (b.hours || 0));
        case "state": {
          const st = (e: DailySheetEntry) => e.isHoliday ? "Holiday" : e.isDraft ? "Draft" : "Submitted";
          return dir * st(a).localeCompare(st(b));
        }
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, attendanceMap, empName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [selectedEmployee, selectedMonth, selectedDate, search, pageSize, sortKey, sortDir]);

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    if (!sorted.length) { alert("No data to export."); return; }
    const rows = sorted.map((e) => ({
      Employee: empName(e.uid), Date: e.dateStr,
      In: attendanceMap[`${e.uid}_${e.dateStr}`]?.in ?? "--",
      Out: attendanceMap[`${e.uid}_${e.dateStr}`]?.out ?? "--",
      "Sys Hrs": attendanceMap[`${e.uid}_${e.dateStr}`]?.sys ?? "--",
      Project: e.project, "Task Title": e.taskTitle, Status: e.status,
      "Task Hrs": `${e.hours}h`,
      State: e.isHoliday ? "Holiday" : e.isDraft ? "Draft" : "Submitted",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Timesheets");
    XLSX.writeFile(wb, `Timesheets_${selectedMonth}.xlsx`);
  };

  // ── View More → scroll to table ───────────────────────────────────────────
  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Column definitions ────────────────────────────────────────────────────
  const cols: { label: string; key: SortKey; cls: string }[] = [
    { label: "NAME",     key: "name",   cls: "min-w-[160px]" },
    { label: "IN",       key: "in",     cls: "w-20" },
    { label: "OUT",      key: "out",    cls: "w-20" },
    { label: "SYS HRS",  key: "sys",    cls: "w-24" },
    { label: "TASK TITLE", key: "task", cls: "min-w-[160px]" },
    { label: "STATUS",   key: "status", cls: "w-24" },
    { label: "TASK HRS", key: "hours",  cls: "w-20" },
    { label: "STATE",    key: "state",  cls: "w-24" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f9] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

      {/* ══ BANNER ══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ height: "160px" }}>
        <img src="/timesheet_banner.png" alt="banner" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1f3c]/90 via-[#0d1f3c]/65 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-center px-8 max-w-lg">
          <h2 className="text-white text-xl font-extrabold leading-tight tracking-tight drop-shadow-lg">Task Sheet Performance</h2>
          <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">Smart tracking &amp; seamless management for your entire team&apos;s time sheets.</p>
          <button
            onClick={scrollToTable}
            className="mt-4 self-start px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-lg"
          >
            View More
          </button>
        </div>
      </div>

      {/* ══ COMPACT STATS ════════════════════════════════════════════════════ */}
      <div className="px-6 mt-5 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs cursor-pointer hover:bg-slate-50 transition" onClick={() => { setSelectedEmployee("ALL"); setSelectedDate(""); scrollToTable(); }}>
          <span className="opacity-70">📋</span>
          <span className="text-slate-500 font-medium">Total Entries:</span>
          <span className="font-bold text-slate-800">{monthEntries.length}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">✅</span>
          <span className="text-slate-500 font-medium">Submitted:</span>
          <span className="font-bold text-emerald-600">{submittedCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">📝</span>
          <span className="text-slate-500 font-medium">Drafts:</span>
          <span className="font-bold text-amber-600">{draftCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">⏱️</span>
          <span className="text-slate-500 font-medium">Total Hours:</span>
          <span className="font-bold text-violet-600">{totalMonthHrs}h</span>
        </div>
      </div>

      {/* ══ CHARTS ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 mt-4">
        {/* Team Performance */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Team Performance</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Hours logged per employee · {monthLabel}</p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setChartView("raw")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${chartView === "raw" ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:bg-slate-200"}`}
              >
                Raw Sheets
              </button>
              <button
                onClick={() => setChartView("centers")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${chartView === "centers" ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:bg-slate-200"}`}
              >
                Centers
              </button>
            </div>
          </div>

          {chartView === "raw" ? (
            teamPerf.length > 0 ? (
              <TeamPerformanceChart data={teamPerf} />
            ) : (
              <div className="h-36 flex items-center justify-center text-slate-300 text-sm">No data for {monthLabel}</div>
            )
          ) : (
            /* Centers view: task count per employee */
            <div className="h-36 flex items-end gap-3 px-2">
              {(() => {
                const centersData = teamPerf.map(d => {
                  const uidMatch = allEntries.find((ae) => empName(ae.uid).split(" ")[0] === d.label)?.uid;
                  const total = monthEntries.filter((e) => e.uid === uidMatch).length;
                  return { label: d.label, total };
                });
                const maxTotal = Math.max(1, ...centersData.map(d => d.total));
                return centersData.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0 group cursor-pointer" title={`${d.label}: ${d.total} tasks`}>
                    <span className="text-[10px] font-bold text-indigo-400">{d.total}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                      <div className="w-full rounded-t-md bg-indigo-400 group-hover:opacity-80 transition" style={{ height: `${Math.max(Math.round((d.total / maxTotal) * 100), 4)}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
                  </div>
                ));
              })()}
              {teamPerf.length === 0 && <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No data</div>}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#2ea84f] inline-block" />{chartView === "raw" ? "Highest performer" : "Most tasks"}</span>
            <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${chartView === "raw" ? "bg-[#c5e8d0]" : "bg-indigo-200"} inline-block`} />Others</span>
          </div>
        </div>

        {/* Employee Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Employee Performance</h3>
          <p className="text-[11px] text-slate-400 mb-4">Relative hours logged this month</p>
          {empPerfData.length > 0 ? (
            <>
              <EmployeePerformanceChart data={empPerfData} />
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                {empPerfData.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const emp = employees.find((e) => e.name === d.label);
                      if (emp) { setSelectedEmployee(emp.uid); scrollToTable(); }
                    }}
                    className="flex items-center gap-1.5 w-full hover:bg-slate-50 rounded-lg px-1 py-0.5 transition"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${d.color}`} />
                    <span className="text-[10px] text-slate-500 truncate">{d.label.split(" ")[0]}</span>
                    <span className="text-[10px] font-bold text-slate-700 ml-auto">{d.pct}%</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-300 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* ══ FILTER BAR ══════════════════════════════════════════════════════ */}
      <div ref={tableRef} className="mx-6 mt-5 bg-white rounded-t-xl border border-slate-200 border-b-0 px-5 py-3 flex flex-wrap items-center gap-3 scroll-mt-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Options &rsaquo; Time Sheets
        </div>
        <div className="w-px h-4 bg-slate-200" />

        <select
          value={selectedEmployee}
          onChange={(e) => { setSelectedEmployee(e.target.value); setSelectedDate(""); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none font-medium focus:ring-2 focus:ring-indigo-200"
        >
          <option value="ALL">All Employees</option>
          {employees.map((emp) => <option key={emp.uid} value={emp.uid}>{emp.name}</option>)}
        </select>

        <input
          type="month" value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(""); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-200"
        />

        <input
          type="date" value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) setSelectedMonth(e.target.value.substring(0, 7)); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none cursor-pointer focus:ring-2 focus:ring-indigo-200"
        />

        {selectedDate && (
          <button onClick={() => setSelectedDate("")}
            className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1 hover:bg-rose-50 rounded-lg transition flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="bg-slate-100 text-xs text-slate-600 px-3 py-1.5 rounded-full font-medium">
            <span className="font-bold text-slate-800">{sorted.length}</span> entries
          </span>
          <span className="bg-indigo-50 text-indigo-600 text-xs px-3 py-1.5 rounded-full font-semibold">
            {sorted.reduce((s, e) => s + (e.hours || 0), 0)}h total
          </span>
          <button onClick={exportToExcel}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1a8a5a] text-white text-xs font-bold rounded-lg hover:bg-[#157a50] active:bg-[#0f5c3a] transition shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Search + rows */}
      <div className="mx-6 bg-white border border-slate-200 border-b-0 px-5 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-white w-52 focus-within:ring-2 focus-within:ring-indigo-200 transition">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/>
          </svg>
          <input
            ref={searchRef}
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="flex-1 text-xs text-slate-700 placeholder-slate-400 outline-none bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-300 hover:text-slate-500 transition">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Pager line:</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white outline-none w-16">
            {[10,25,50,100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-slate-400">
            {sorted.length === 0 ? "0" : `${(page-1)*pageSize+1}–${Math.min(page*pageSize, sorted.length)}`} of {sorted.length}
          </span>
          {/* Search focus button */}
          <button onClick={() => searchRef.current?.focus()}
            className="p-1.5 hover:bg-indigo-50 rounded-lg transition text-slate-400 hover:text-indigo-500" title="Focus search">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/></svg>
          </button>
        </div>
      </div>

      {/* ══ TABLE ═══════════════════════════════════════════════════════════ */}
      <div className="mx-6 mb-8 bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f0f2f5] border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-indigo-600" />
                </th>
                {cols.map((col) => (
                  <th key={col.key}
                    className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${col.cls} cursor-pointer select-none hover:bg-slate-100 transition`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                      <p className="text-sm font-medium">No entries found</p>
                      <p className="text-xs">Try adjusting the filters above.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((e, idx) => {
                  const name = empName(e.uid);
                  const att = attendanceMap[`${e.uid}_${e.dateStr}`];
                  return (
                    <tr key={e.id}
                      className={`border-b border-slate-100 transition-colors ${idx%2===0?"bg-white hover:bg-slate-50":"bg-[#fafbfc] hover:bg-slate-50"}`}>
                      <td className="px-4 py-2.5">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"/>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${avatarColor(name)} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                            {initials(name)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 leading-tight">{name}</p>
                            <p className="text-[10px] text-slate-400">{e.dateStr}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-indigo-600 font-medium text-xs whitespace-nowrap">{att?.in ?? "—"}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{att?.out ?? "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700 font-semibold text-xs whitespace-nowrap">{att?.sys ?? "—"}</td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <p className="text-xs font-medium text-slate-700 truncate" title={e.taskTitle}>{e.taskTitle}</p>
                        {e.project && <p className="text-[10px] text-slate-400 truncate">{e.project}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{e.status || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.hours ? `${e.hours}h` : "—"}</td>
                      <td className="px-3 py-2.5">
                        {e.isHoliday ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Holiday</span>
                        ) : e.isDraft ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Draft</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Submitted</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 bg-[#f8f9fb] border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page <span className="font-bold text-slate-700">{page}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              {[
                { icon: "M11 19l-7-7 7-7m8 14l-7-7 7-7", fn: () => setPage(1), dis: page===1 },
                { icon: "M15 19l-7-7 7-7", fn: () => setPage((p) => Math.max(1,p-1)), dis: page===1 },
              ].map((b, i) => (
                <button key={i} onClick={b.fn} disabled={b.dis}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon}/></svg>
                </button>
              ))}
              {Array.from({length: Math.min(5,totalPages)}, (_, i) => {
                const pg = Math.max(1, Math.min(page-2+i, totalPages-Math.min(4,totalPages-1)+i));
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${pg===page?"bg-[#1a2e45] text-white":"text-slate-500 hover:bg-slate-200"}`}>
                    {pg}
                  </button>
                );
              })}
              {[
                { icon: "M9 5l7 7-7 7", fn: () => setPage((p) => Math.min(totalPages,p+1)), dis: page===totalPages },
                { icon: "M13 5l7 7-7 7M5 5l7 7-7 7", fn: () => setPage(totalPages), dis: page===totalPages },
              ].map((b, i) => (
                <button key={i} onClick={b.fn} disabled={b.dis}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon}/></svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
