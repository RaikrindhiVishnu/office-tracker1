"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import type { DailySheetEntry } from "@/types/dailySheet";
import * as XLSX from "xlsx";
import { getTodayDateStr } from "@/lib/breakTracking";

const CATEGORIES = ["Development", "Testing", "Meeting", "Design", "Support", "Other"];
const STATUSES = ["Completed", "In Progress", "Blocked", "Pending"];

export default function DailySheetView() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [userFullName, setUserFullName] = useState("");

  // Month navigation (YYYY-MM)
  const todayStr = getTodayDateStr();
  const [selectedMonth, setSelectedMonth] = useState(todayStr.substring(0, 7));

  // All entries for selected month
  const [monthEntries, setMonthEntries] = useState<DailySheetEntry[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<Record<string, { in: string; out: string; sys: string }>>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: "", project: "", hours: "" });
  // The date used when adding a new entry (defaults to today if in current month, else 1st)
  const [entryDate, setEntryDate] = useState(todayStr);

  // Form fields
  const [project, setProject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState(STATUSES[0]);
  const [hours, setHours] = useState<number | "">("");

  // Project search dropdown
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch projects ─────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // ── Fetch user name ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const profile = snap.docs[0].data();
        setUserFullName(profile.name ?? profile.displayName ?? user.displayName ?? user.email?.split("@")[0] ?? "Unknown");
      } else {
        setUserFullName(user.displayName ?? user.email?.split("@")[0] ?? "Unknown");
      }
    });
  }, [user]);

  // ── Fetch all month entries ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "dailySheets"),
      where("uid", "==", user.uid),
      where("monthStr", "==", selectedMonth)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailySheetEntry));
      // Sort by date asc, then createdAt desc within same date
      data.sort((a, b) => {
        const dateCmp = a.dateStr.localeCompare(b.dateStr);
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });
      setMonthEntries(data);
    });
  }, [user, selectedMonth]);

  // ── Fetch month attendance ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const start = `${selectedMonth}-01`;
    const end = `${selectedMonth}-31`;
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", user.uid),
      where("date", ">=", start),
      where("date", "<=", end)
    );
    return onSnapshot(q, (snap) => {
      const attMap: Record<string, { in: string; out: string; sys: string }> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const sessions = data.sessions || [];
        if (sessions.length > 0) {
          const fmt = (ts: any) =>
            ts ? ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--:--";
          const first = sessions[0];
          const last = sessions[sessions.length - 1];
          let addedMins = 0;
          if (!last.checkOut) {
            if (data.date === getTodayDateStr()) addedMins = Math.floor((Date.now() - last.checkIn.toMillis()) / 60000);
            else addedMins = Math.max(0, 9 * 60 - data.totalMinutes);
          }
          attMap[data.date] = {
            in: fmt(first.checkIn),
            out: fmt(last.checkOut),
            sys: ((data.totalMinutes + addedMins) / 60).toFixed(1) + "h",
          };
        }
      });
      setMonthAttendance(attMap);
    });
  }, [user, selectedMonth]);

  // ── Close dropdown on outside click ───────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node))
        setShowProjectDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Helpers ────────────────────────────────────────────────
  const isWeekendOrHoliday = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    const dateNum = d.getDate();
    if (day === 0) return true;
    if (day === 6) {
      const week = Math.ceil(dateNum / 7);
      return week === 2 || week === 4;
    }
    return false;
  };

  const formatDate = (str: string) => {
    const d = new Date(str + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const resetForm = () => {
    setProject(""); setProjectSearch(""); setShowProjectDropdown(false);
    setTaskTitle(""); setDescription(""); setCategory(CATEGORIES[0]);
    setStatus(STATUSES[0]); setHours(""); setEditingId(null);
  };

  // ── Group entries by date ──────────────────────────────────
  const entriesByDate = monthEntries.reduce((acc, e) => {
    if (!acc[e.dateStr]) acc[e.dateStr] = [];
    acc[e.dateStr].push(e);
    return acc;
  }, {} as Record<string, DailySheetEntry[]>);

  const sortedDates = Object.keys(entriesByDate).sort();
  const allEntryIds = monthEntries.map((e) => e.id!);
  const totalMonthHrs = monthEntries.reduce((acc, e) => acc + (e.hours || 0), 0);

  // ── Analytics (Charts) ─────────────────────────────────────
  const projectHrs = React.useMemo(() => {
    const map: Record<string, number> = {};
    monthEntries.forEach((e) => { if(e.project) map[e.project] = (map[e.project] || 0) + (e.hours || 0); });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxVal = sorted[0]?.[1] || 1;
    const colors = ["bg-emerald-500", "bg-indigo-500", "bg-amber-400", "bg-rose-400"];
    return sorted.map(([proj, hrs], i) => ({
      label: proj, value: hrs, pct: Math.round((hrs / maxVal) * 100), color: colors[i] || "bg-slate-400",
    }));
  }, [monthEntries]);

  const summaryStats = React.useMemo(() => {
    const projects = new Set(monthEntries.filter(e => e.project).map(e => e.project));
    const tasksCount = monthEntries.length;
    const hoursCount = monthEntries.reduce((acc, e) => acc + (e.hours || 0), 0);
    
    // Normalize heights but ensure they are visible
    const maxVal = Math.max(1, projects.size, tasksCount, hoursCount);
    
    return [
      { label: "Projects", value: projects.size, suffix: "", color: "bg-fuchsia-500", pct: Math.max(8, Math.round((projects.size / maxVal) * 100)) },
      { label: "Tasks", value: tasksCount, suffix: "", color: "bg-indigo-500", pct: Math.max(8, Math.round((tasksCount / maxVal) * 100)) },
      { label: "Hours", value: hoursCount, suffix: "h", color: "bg-emerald-500", pct: Math.max(8, Math.round((hoursCount / maxVal) * 100)) }
    ];
  }, [monthEntries]);

  // ── CRUD ───────────────────────────────────────────────────
  const handleSaveEntry = async (isDraft: boolean) => {
    if (!user) return;
    if (!project || !taskTitle) { alert("Project and Task Title are required."); return; }
    if (!isDraft && hours === "") { alert("Hours are required to submit an entry."); return; }
    setIsSubmitting(true);
    try {
      const monthStr = entryDate.substring(0, 7);
      const payload = {
        uid: user.uid,
        userName: userFullName || user.email?.split("@")[0] || "Unknown",
        dateStr: entryDate, monthStr, project, taskTitle, description,
        category, status, hours: hours === "" ? 0 : Number(hours), isDraft,
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, "dailySheets", editingId), payload);
      } else {
        await addDoc(collection(db, "dailySheets"), { ...payload, createdAt: serverTimestamp() });
      }
      if (!isDraft) {
        setSuccessInfo({
          title: taskTitle,
          project,
          hours: hours === "" ? "0" : String(hours),
        });
        resetForm();
        setIsModalOpen(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
      }
    } catch (err) { console.error(err); alert("Failed to save entry."); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = (entry: DailySheetEntry) => {
    setEditingId(entry.id!);
    setEntryDate(entry.dateStr);
    setProject(entry.project); setProjectSearch("");
    setTaskTitle(entry.taskTitle); setDescription(entry.description || "");
    setCategory(entry.category || CATEGORIES[0]); setStatus(entry.status || STATUSES[0]);
    setHours(entry.hours); setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try { await deleteDoc(doc(db, "dailySheets", id)); if (editingId === id) setEditingId(null); }
    catch (err) { console.error(err); }
  };

  // ── Export ─────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (monthEntries.length === 0) { alert("No data to export for this month."); return; }
    const fmt = (ts: any) =>
      ts ? ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
    const finalData = [];
    for (const dateStr of sortedDates) {
      const dayEntries = entriesByDate[dateStr];
      let checkInStr = "--:--:--", checkOutStr = "--:--:--", totalSysHours = 0;
      if (user) {
        const snap = await getDoc(doc(db, "attendance", `${user.uid}_${dateStr}`));
        if (snap.exists()) {
          const data = snap.data();
          const sessions = data.sessions || [];
          if (sessions.length > 0) {
            checkInStr = fmt(sessions[0].checkIn);
            checkOutStr = fmt(sessions[sessions.length - 1].checkOut);
            let addedMins = 0;
            if (!sessions[sessions.length - 1].checkOut) {
              if (data.date === getTodayDateStr()) addedMins = Math.floor((Date.now() - sessions[sessions.length - 1].checkIn.toMillis()) / 60000);
              else addedMins = Math.max(0, 9 * 60 - data.totalMinutes);
            }
            totalSysHours = Number(((data.totalMinutes + addedMins) / 60).toFixed(2));
          }
        }
      }
      const isHoliday = dayEntries.some((e) => e.isHoliday);
      const taskStr = dayEntries.map((e, i) => `Task ${i + 1}: ${e.taskTitle}${e.description ? " - " + e.description : ""}`).join("\n");
      finalData.push({
        Date: dateStr,
        "Check-In": isHoliday ? "Holiday" : checkInStr,
        "Check-Out": isHoliday ? "Holiday" : checkOutStr,
        "Available Hours": isHoliday ? 0 : 8,
        "Break Hours": isHoliday ? 0 : 1,
        "Total Hours": isHoliday ? 0 : totalSysHours,
        "Assigned Task": isHoliday ? "Holiday" : taskStr,
        Status: dayEntries.some((e) => e.isDraft) ? "Draft" : "Submitted",
      });
    }
    const ws = XLSX.utils.json_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
    XLSX.writeFile(wb, `Employee_Timesheet_${selectedMonth}.xlsx`);
  };

  // ── Checkbox logic ─────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === allEntryIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(allEntryIds));
  };

  // ── Month navigation ───────────────────────────────────────
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedIds(new Set());
  };

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f9] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

      {/* ══ BANNER ══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ height: "160px" }}>
        <img src="/timesheet_banner.png" alt="banner" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1f3c]/90 via-[#0d1f3c]/65 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-center px-8 max-w-lg">
          <h2 className="text-white text-xl font-extrabold leading-tight tracking-tight drop-shadow-lg">My Time Sheets</h2>
          <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">Log your tasks, track your hours, and review your personal performance.</p>
          <div className="mt-4 flex items-center gap-2">
             <div className="px-3 py-1 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-white text-xs font-semibold">
               {monthLabel}
             </div>
             <div className="px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm">
               {monthEntries.length} tasks logged
             </div>
          </div>
        </div>
      </div>

      {/* ══ COMPACT STATS ════════════════════════════════════════════════════ */}
      <div className="px-6 mt-5 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">📋</span>
          <span className="text-slate-500 font-medium">Total Entries:</span>
          <span className="font-bold text-slate-800">{monthEntries.length}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">✅</span>
          <span className="text-slate-500 font-medium">Submitted:</span>
          <span className="font-bold text-emerald-600">{monthEntries.filter(e => !e.isDraft).length}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">📝</span>
          <span className="text-slate-500 font-medium">Drafts:</span>
          <span className="font-bold text-amber-600">{monthEntries.filter(e => e.isDraft).length}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
          <span className="opacity-70">⏱️</span>
          <span className="text-slate-500 font-medium">Total Hours:</span>
          <span className="font-bold text-violet-600">{totalMonthHrs}h</span>
        </div>
      </div>

      {/* ══ CHARTS ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 mt-4">
        {/* Monthly Summary (Bar Chart) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800">Monthly Summary</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-4">Your total projects, tasks, and hours at a glance</p>
          <div className="flex items-end justify-center gap-12 h-36 px-4">
            {summaryStats.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2 w-20 group cursor-pointer" title={`${d.value}${d.suffix} Total ${d.label}`}>
                <span className="text-xs font-bold text-slate-700">{d.value}{d.suffix}</span>
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  <div className={`w-full rounded-t-lg ${d.color} group-hover:opacity-80 transition`} style={{ height: `${d.pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Project Breakdown (Horizontal Bar) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Time by Project</h3>
          <p className="text-[11px] text-slate-400 mb-4">Your top projects this month</p>
          {projectHrs.length > 0 ? (
            <div className="space-y-3">
              {projectHrs.map((d, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 font-medium truncate max-w-[120px]" title={d.label}>{d.label}</span>
                    <span className="text-xs font-bold text-slate-700">{d.value}h</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%`, transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-300 text-sm">No projects logged</div>
          )}
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="mx-6 mt-5 bg-white rounded-t-xl border border-slate-200 border-b-0 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded transition text-slate-500 hover:text-slate-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedIds(new Set()); }} className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer px-1"/>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded transition text-slate-500 hover:text-slate-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {selectedIds.size > 0 && <span className="text-indigo-600 font-semibold">{selectedIds.size} selected</span>}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Delete ${selectedIds.size} selected entries?`)) return;
                await Promise.all([...selectedIds].map((id) => deleteDoc(doc(db, "dailySheets", id))));
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 text-sm font-semibold border border-rose-200 rounded-lg hover:bg-rose-100 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete ({selectedIds.size})
            </button>
          )}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#1a8a5a] text-white text-sm font-bold rounded-lg hover:bg-[#157a50] transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button
              onClick={() => {
                resetForm();
                const todayMonth = todayStr.substring(0, 7);
                setEntryDate(todayMonth === selectedMonth ? todayStr : `${selectedMonth}-01`);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#1a2e45] text-white text-sm font-bold rounded-lg hover:bg-[#0f1b29] transition shadow-sm"
            >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Entry
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="mx-6 mb-6 bg-white rounded-b-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f0f2f5] border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allEntryIds.length > 0 && selectedIds.size === allEntryIds.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                  />
                </th>
                {[
                  ["DATE", "w-32"],
                  ["IN", "w-24"],
                  ["OUT", "w-24"],
                  ["TOTAL HOURS", "w-28"],
                  ["PROJECT", "w-44"],
                  ["TASK TITLE", ""],
                  ["TASK HRS", "w-24"],
                  ["STATE", "w-24"],
                  ["ACTIONS", "w-20"],
                ].map(([label, cls], i) => (
                  <th
                    key={i}
                    className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${cls}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm font-medium">No entries for {monthLabel}</p>
                      <p className="text-xs">Click &ldquo;Add Entry&rdquo; to log your first task.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedDates.map((dateStr) => {
                  const dayEntries = entriesByDate[dateStr];
                  const att = monthAttendance[dateStr];

                  return (
                    <React.Fragment key={dateStr}>
                      {dayEntries.map((e, idx) => {
                        const isSelected = selectedIds.has(e.id!);
                        return (
                          <tr
                            key={e.id}
                            className={`border-b border-slate-100 transition-colors ${
                              isSelected
                                ? "bg-indigo-50"
                                : idx % 2 === 0
                                ? "bg-white hover:bg-slate-50"
                                : "bg-[#fafbfc] hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(e.id!)}
                                className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-600 whitespace-nowrap text-xs">
                              {formatDate(e.dateStr)}
                            </td>
                            <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                              {att?.in || "—"}
                            </td>
                            <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                              {att?.out || "—"}
                            </td>
                            <td className="px-3 py-3 text-slate-600 font-semibold text-xs">
                              {att?.sys || "—"}
                            </td>
                            <td className="px-3 py-3 text-slate-700 max-w-[160px]">
                              <span className="truncate block text-xs" title={e.project}>
                                {e.project.length > 22 ? e.project.slice(0, 20) + "…" : e.project}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-600 max-w-[200px]">
                              <span className="truncate block text-xs" title={e.taskTitle}>
                                {e.taskTitle}
                              </span>
                              {e.description && (
                                <span className="block text-[10px] text-slate-400 truncate" title={e.description}>
                                  {e.description}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-600 whitespace-nowrap text-xs">
                              {e.hours ? `${e.hours}h` : "—"}
                            </td>
                            <td className="px-3 py-3">
                              {e.isHoliday ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Holiday</span>
                              ) : e.isDraft ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Draft</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Submitted</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {!e.isHoliday && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleEdit(e)}
                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                                    title="Edit"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(e.id!)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Delete"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingId ? "Edit Entry" : "Add New Entry"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(entryDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveEntry(true)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-slate-500 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => { resetForm(); setIsModalOpen(false); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Entry Date */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  min={`${selectedMonth}-01`}
                  max={`${selectedMonth}-31`}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition w-full"
                />
              </div>

              {/* Project */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project *</label>
                <div className="relative" ref={projectDropdownRef}>
                  <button
                    type="button"
                    onClick={() => { setShowProjectDropdown((v) => !v); setProjectSearch(""); }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-left text-sm bg-white flex items-center justify-between hover:border-indigo-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition"
                  >
                    <span className={project ? "text-slate-800" : "text-slate-400"}>
                      {project || "Select project…"}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProjectDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showProjectDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                          </svg>
                          <input
                            autoFocus
                            type="text"
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            placeholder="Search projects…"
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                          />
                        </div>
                      </div>
                      <ul className="max-h-44 overflow-y-auto py-1">
                        {projects
                          .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                          .map((p) => (
                            <li
                              key={p.id}
                              onClick={() => { setProject(p.name); setShowProjectDropdown(false); }}
                              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition ${project === p.name ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700"}`}
                            >
                              {p.name}
                            </li>
                          ))}
                        {projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                          <li className="px-4 py-3 text-sm text-slate-400 text-center">No projects found</li>
                        )}
                      </ul>
                      {projectSearch && (
                        <div className="border-t border-slate-100 p-2">
                          <button
                            onClick={() => { setProject(projectSearch); setShowProjectDropdown(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg transition"
                          >
                            + Use &ldquo;{projectSearch}&rdquo; as custom project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Task Title *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What did you work on?"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition resize-none"
                  rows={2}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition appearance-none bg-white"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Status + Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition appearance-none bg-white"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hours *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => handleSaveEntry(false)}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#1a2e45] text-white text-sm font-bold rounded-xl hover:bg-[#0f1b29] transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving…
                  </>
                ) : editingId ? "Update Entry" : "+ Add to Day"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center text-center relative"
            style={{ animation: "successPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* Close */}
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition text-lg leading-none"
            >
              ×
            </button>

            {/* Checkmark circle */}
            <div className="relative mb-5">
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#2ea84f] flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              {/* Ripple rings */}
              <span className="absolute inset-0 rounded-full border-2 border-green-300 opacity-0" style={{ animation: "ripple 1.2s ease-out 0.2s infinite" }} />
              <span className="absolute inset-0 rounded-full border-2 border-green-200 opacity-0" style={{ animation: "ripple 1.2s ease-out 0.6s infinite" }} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-slate-800 mb-2">Task Added Successfully!</h3>

            {/* Details */}
            <p className="text-sm text-slate-500 leading-relaxed mb-1">
              <span className="font-semibold text-slate-700">{successInfo.title}</span> has been logged
              {successInfo.project && (
                <> under <span className="font-semibold text-indigo-600">{successInfo.project}</span></>
              )}.
            </p>
            {successInfo.hours && Number(successInfo.hours) > 0 && (
              <p className="text-xs text-slate-400 mb-5">
                <span className="font-semibold text-slate-600">{successInfo.hours}h</span> recorded · Status: <span className="text-emerald-600 font-semibold">Submitted</span>
              </p>
            )}
          </div>

          <style>{`
            @keyframes successPop {
              0%   { opacity: 0; transform: scale(0.7); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes ripple {
              0%   { transform: scale(1);   opacity: 0.6; }
              100% { transform: scale(1.7); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
