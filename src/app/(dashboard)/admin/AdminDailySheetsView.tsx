"use client";
import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc, where, getDocs } from "firebase/firestore";
import type { DailySheetEntry } from "@/types/dailySheet";
import { getTodayDateStr } from "@/lib/breakTracking";
import * as XLSX from "xlsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const todayStr = new Date().toISOString().slice(0, 10);

function getMondayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}
function addDays(ds: string, n: number) {
  const d = new Date(ds + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [py, setPy] = useState(() => parseInt(value.split("-")[0]));
  const ref = useRef<HTMLDivElement>(null);
  const sy = parseInt(value.split("-")[0]);
  const sm = parseInt(value.split("-")[1]) - 1;

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(v => !v); setPy(sy); }}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition font-semibold">
        <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        {MONTHS[sm]} {sy}
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setPy(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-bold text-slate-800 text-sm">{py}</span>
            <button onClick={() => setPy(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const sel = py === sy && i === sm;
              const cur = py === new Date().getFullYear() && i === new Date().getMonth();
              return (
                <button key={m} onClick={() => { onChange(`${py}-${String(i+1).padStart(2,"0")}`); setOpen(false); }}
                  className={`py-2 rounded-xl text-sm font-semibold transition ${sel ? "bg-violet-600 text-white shadow" : cur ? "bg-violet-50 text-violet-600 border border-violet-200" : "hover:bg-slate-100 text-slate-700"}`}>
                  {m}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button onClick={() => { const n = new Date(); onChange(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`); setOpen(false); }}
              className="w-full py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-lg transition">This Month</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Picker ───────────────────────────────────────────────────────────────
function DayPicker({ selectedMonth, value, onChange }: { selectedMonth: string; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sy = parseInt(selectedMonth.split("-")[0]);
  const sm = parseInt(selectedMonth.split("-")[1]) - 1;
  const daysInMonth = new Date(sy, sm + 1, 0).getDate();
  const firstDow = new Date(sy, sm, 1).getDay();
  const label = value ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "All Days";

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm shadow-sm transition font-semibold outline-none
          ${value ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        {label}
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-700">{MONTHS[sm]} {sy}</span>
            {value && <button onClick={() => { onChange(null); setOpen(false); }} className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition">Clear</button>}
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDow }).map((_, i) => <div key={i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${sy}-${String(sm+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel = value === ds;
              const isToday = ds === todayStr;
              const dow = (firstDow + i) % 7;
              const isWknd = dow === 0 || dow === 6;
              return (
                <button key={day} onClick={() => { onChange(ds); setOpen(false); }}
                  className={`w-full aspect-square flex items-center justify-center rounded-lg text-xs font-semibold transition
                    ${isSel ? "bg-violet-600 text-white shadow-md" : isToday ? "bg-violet-50 text-violet-600 border border-violet-300" : isWknd ? "text-rose-400 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button onClick={() => { onChange(null); setOpen(false); }} className="w-full py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-lg transition">Show All Days</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Range Picker (dropdown) ──────────────────────────────────────────────────
type RangeMode = "week" | "month" | "custom";
function RangePicker({
  mode, onModeChange, selectedMonth, onMonthChange, customFrom, customTo, onCustomFromChange, onCustomToChange, rangeFrom, rangeTo
}: {
  mode: RangeMode; onModeChange: (m: RangeMode) => void;
  selectedMonth: string; onMonthChange: (v: string) => void;
  customFrom: string; customTo: string;
  onCustomFromChange: (v: string) => void; onCustomToChange: (v: string) => void;
  rangeFrom: string; rangeTo: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const modeLabel = mode === "week" ? "This Week" : mode === "month" ? "This Month" : "Custom Range";
  const rangeLabel = `${new Date(rangeFrom + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(rangeTo + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const sy = parseInt(selectedMonth.split("-")[0]);
  const sm = parseInt(selectedMonth.split("-")[1]) - 1;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 border border-violet-300 bg-violet-50 text-violet-700 rounded-xl text-sm shadow-sm transition font-semibold outline-none hover:bg-violet-100">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span>{modeLabel}</span>
        <span className="text-violet-400 font-normal text-xs">· {rangeLabel}</span>
        <svg className={`w-3.5 h-3.5 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl w-80 overflow-hidden">
          {/* Mode options */}
          <div className="p-2 border-b border-slate-100">
            {(["week", "month", "custom"] as const).map(m => {
              const labels = { week: "This Week", month: "This Month", custom: "Custom Range" };
              const icons = { week: "📆", month: "🗓️", custom: "✏️" };
              return (
                <button key={m} onClick={() => onModeChange(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left
                    ${mode === m ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className="text-base">{icons[m]}</span>
                  <span>{labels[m]}</span>
                  {mode === m && <svg className="w-4 h-4 ml-auto text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                </button>
              );
            })}
          </div>

          {/* Month picker for "month" mode */}
          {mode === "month" && (
            <div className="p-3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Select Month</p>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => { const d = new Date(`${selectedMonth}-01`); d.setMonth(d.getMonth()-1); onMonthChange(d.toISOString().slice(0,7)); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-bold text-slate-700 text-sm">{MONTHS[sm]} {sy}</span>
                <button onClick={() => { const d = new Date(`${selectedMonth}-01`); d.setMonth(d.getMonth()+1); onMonthChange(d.toISOString().slice(0,7)); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* Custom date inputs */}
          {mode === "custom" && (
            <div className="p-3 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Date Range</p>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <label className="text-xs font-bold text-slate-400 w-8">From</label>
                <input type="date" value={customFrom} onChange={e => onCustomFromChange(e.target.value)}
                  className="flex-1 text-sm text-slate-700 bg-transparent outline-none" />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <label className="text-xs font-bold text-slate-400 w-8">To</label>
                <input type="date" value={customTo} onChange={e => onCustomToChange(e.target.value)}
                  className="flex-1 text-sm text-slate-700 bg-transparent outline-none" />
              </div>
            </div>
          )}

          {/* Apply */}
          <div className="p-3 border-t border-slate-100">
            <button onClick={() => setOpen(false)}
              className="w-full py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDailySheetsView() {
  const [entries, setEntries] = useState<DailySheetEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getTodayDateStr().substring(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [employees, setEmployees] = useState<{ uid: string; name: string }[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { in: string; out: string; sys: string }>>({});

  // All-employees filters
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);

  // Single-employee range mode
  const [rangeMode, setRangeMode] = useState<"week" | "month" | "custom">("week");
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [showCustom, setShowCustom] = useState(false);

  const sy = parseInt(selectedMonth.split("-")[0]);
  const sm = parseInt(selectedMonth.split("-")[1]) - 1;
  const daysInMonth = new Date(sy, sm + 1, 0).getDate();
  const monthTo = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;

  const weekStart = getMondayOfWeek();
  const weekEnd = addDays(weekStart, 6);
  const rangeFrom = rangeMode === "week" ? weekStart : rangeMode === "month" ? `${selectedMonth}-01` : customFrom;
  const rangeTo   = rangeMode === "week" ? weekEnd   : rangeMode === "month" ? monthTo              : customTo;

  const empName = (uid: string) => employees.find(e => e.uid === uid)?.name ?? uid;

  // ── Fetch employees + entries ──
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "dailySheets"), orderBy("createdAt", "desc")), async (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailySheetEntry));
      setEntries(data);
      const uniqueUids = Array.from(new Set(data.map(e => e.uid)));
      const list: { uid: string; name: string }[] = [];
      for (const uid of uniqueUids) {
        const us = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
        if (!us.empty) {
          const p = us.docs[0].data();
          list.push({ uid, name: p.name ?? p.displayName ?? p.email?.split("@")[0] ?? "Unknown" });
        } else {
          list.push({ uid, name: data.find(e => e.uid === uid)?.userName ?? uid });
        }
      }
      setEmployees(list);
    });
    return () => unsub();
  }, []);

  // ── Fetch attendance ──
  useEffect(() => {
    if (!selectedMonth) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "dailySheets"), where("monthStr", "==", selectedMonth)));
      const pairs = Array.from(new Set(snap.docs.map(d => `${d.data().uid}_${d.data().dateStr}`)));
      const fmt = (ts: any) => ts ? ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const map: Record<string, { in: string; out: string; sys: string }> = {};
      await Promise.all(pairs.map(async key => {
        const as = await getDoc(doc(db, "attendance", key));
        if (as.exists()) {
          const att = as.data(); const sessions = att.sessions || [];
          if (sessions.length > 0) {
            const first = sessions[0]; const last = sessions[sessions.length - 1];
            let add = 0;
            if (!last.checkOut) {
              const ds = key.split("_").slice(1).join("_");
              add = ds === getTodayDateStr() ? Math.floor((Date.now() - last.checkIn.toMillis()) / 60000) : Math.max(0, 9*60-(att.totalMinutes||0));
            }
            map[key] = { in: fmt(first.checkIn), out: last.checkOut ? fmt(last.checkOut) : "--:--", sys: `${Number(((att.totalMinutes||0)+add)/60).toFixed(1)}h` };
          }
        }
      }));
      setAttendanceMap(map);
    })();
  }, [selectedMonth]);

  // ── Filtered entries ──
  const filteredEntries = entries.filter(e => {
    if (selectedEmployee === "ALL") {
      return e.monthStr === selectedMonth && (!selectedDay || e.dateStr === selectedDay);
    } else {
      return e.uid === selectedEmployee && e.dateStr >= rangeFrom && e.dateStr <= rangeTo;
    }
  });

  // ── Export ──
  const exportToExcel = async () => {
    if (!filteredEntries.length) { alert("No data to export."); return; }
    const rows = filteredEntries.map(e => ({
      "Employee": empName(e.uid), "Date": e.dateStr,
      "In": attendanceMap[`${e.uid}_${e.dateStr}`]?.in ?? "--",
      "Out": attendanceMap[`${e.uid}_${e.dateStr}`]?.out ?? "--",
      "Sys Hrs": attendanceMap[`${e.uid}_${e.dateStr}`]?.sys ?? "--",
      "Project": e.project, "Task": e.taskTitle, "Task Hrs": `${e.hours}h`,
      "State": e.isHoliday ? "Holiday" : e.isDraft ? "Draft" : "Submitted"
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Timesheets");
    XLSX.writeFile(wb, `Timesheets_${selectedMonth}.xlsx`);
  };

  return (
    <div className="-mx-4 lg:-mx-8 -mt-2 lg:-mt-4 w-[calc(100%+2rem)] lg:w-[calc(100%+4rem)] pb-24">

      {/* ── Filter Bar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">

        {/* Title */}
        <h2 className="text-base font-bold text-slate-800 mr-2">📅 Team Time Sheets</h2>

        <div className="w-px h-6 bg-slate-200" />

        {/* Employee Selector */}
        <select value={selectedEmployee}
          onChange={e => { setSelectedEmployee(e.target.value); setSelectedDay(null); setRangeMode("week"); setShowCustom(false); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-violet-200 font-medium">
          <option value="ALL">All Employees</option>
          {employees.map(emp => <option key={emp.uid} value={emp.uid}>{emp.name}</option>)}
        </select>

        {/* ── ALL EMPLOYEES: Date picker ── */}
        {selectedEmployee === "ALL" && (
          <input
            type="date"
            value={selectedDay || ""}
            onChange={e => {
              const val = e.target.value;
              if (val) {
                setSelectedDay(val);
                setSelectedMonth(val.substring(0, 7));
              } else {
                setSelectedDay(null);
              }
            }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-violet-200 font-medium cursor-pointer"
          />
        )}

        {/* ── SINGLE EMPLOYEE: Range Picker dropdown ── */}
        {selectedEmployee !== "ALL" && (
          <RangePicker
            mode={rangeMode}
            onModeChange={setRangeMode}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
          />
        )}

        {/* Spacer + Export */}
        <div className="ml-auto">
          <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition shadow-sm">
            Export
          </button>
        </div>
      </div>

      {/* ── Results count strip ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {selectedEmployee === "ALL"
            ? `${selectedDay ? `Tasks on ${new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : `All tasks in ${MONTHS[sm]} ${sy}`} · ${filteredEntries.length} entr${filteredEntries.length === 1 ? "y" : "ies"}`
            : `${empName(selectedEmployee)} · ${filteredEntries.length} entr${filteredEntries.length === 1 ? "y" : "ies"}`}
        </span>
        {selectedEmployee !== "ALL" && (
          <span className="font-semibold text-violet-600">
            Total: {filteredEntries.reduce((s, e) => s + e.hours, 0)}h logged
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
              <tr>
                {selectedEmployee === "ALL" && <th className="px-4 py-3">Employee</th>}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Sys Hrs</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Task Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Task Hrs</th>
                <th className="px-4 py-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={selectedEmployee === "ALL" ? 10 : 9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <span className="text-3xl">📋</span>
                      <span className="text-sm font-medium">No entries found for the selected filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map(e => {
                  const att = attendanceMap[`${e.uid}_${e.dateStr}`];
                  return (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      {selectedEmployee === "ALL" && (
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {empName(e.uid).split(" ").map((w:string) => w[0]).slice(0,2).join("").toUpperCase()}
                            </div>
                            {empName(e.uid)}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-600">{e.dateStr}</td>
                      <td className="px-4 py-3 text-indigo-600 font-medium">{att?.in ?? "--:--"}</td>
                      <td className="px-4 py-3 text-slate-500">{att?.out ?? "--:--"}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{att?.sys ?? "--"}</td>
                      <td className="px-4 py-3 text-slate-700">{e.project}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{e.taskTitle}</td>
                      <td className="px-4 py-3 text-slate-500">{e.status}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{e.hours}h</td>
                      <td className="px-4 py-3">
                        {e.isHoliday ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Holiday</span>
                        ) : e.isDraft ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">Draft</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Submitted</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
