"use client";

import React, { useState, useEffect } from "react";
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
  orderBy,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import type { DailySheetEntry } from "@/types/dailySheet";
import * as XLSX from "xlsx";
import { getTodayDateStr } from "@/lib/breakTracking";

const CATEGORIES = ["Development", "Testing", "Meeting", "Design", "Support", "Other"];
const STATUSES = ["Completed", "In Progress", "Blocked", "Pending"];

export default function DailySheetView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailySheetEntry[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Date selection
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());

  // Form state
  const [project, setProject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState(STATUSES[0]);
  const [hours, setHours] = useState<number | "">("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDaySubmitted, setIsDaySubmitted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [monthAttendance, setMonthAttendance] = useState<Record<string, { in: string, out: string, sys: string }>>({});
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [userFullName, setUserFullName] = useState("");

  // Month wise history
  const historyMonth = selectedDate.substring(0, 7); // YYYY-MM
  const [historyEntries, setHistoryEntries] = useState<DailySheetEntry[]>([]);

  useEffect(() => {
    // Fetch Projects
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubProjects();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Fetch user full name from the users collection
    const q = query(collection(db, "users"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const profile = snap.docs[0].data();
        const fullName = profile.name ?? profile.displayName ?? user.displayName ?? user.email?.split("@")[0] ?? "Unknown";
        setUserFullName(fullName);
      } else {
        setUserFullName(user.displayName ?? user.email?.split("@")[0] ?? "Unknown");
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Fetch today's entries
    const q = query(
      collection(db, "dailySheets"),
      where("uid", "==", user.uid),
      where("dateStr", "==", selectedDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailySheetEntry));
      setEntries(data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      // Day is never locked — always allow adding/editing entries
      setIsDaySubmitted(false);
    });
    return () => unsub();
  }, [user, selectedDate]);



  useEffect(() => {
    if (!user) return;

    // Fetch month history
    const qHistory = query(
      collection(db, "dailySheets"),
      where("uid", "==", user.uid),
      where("monthStr", "==", historyMonth)
    );

    const unsubHist = onSnapshot(qHistory, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailySheetEntry));
      setHistoryEntries(data.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
    });

    // Fetch month attendance
    const start = `${historyMonth}-01`;
    const end = `${historyMonth}-31`;
    const qAttMonth = query(
      collection(db, "attendance"),
      where("userId", "==", user.uid),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const unsubAtt = onSnapshot(qAttMonth, (snap) => {
      const attMap: Record<string, { in: string, out: string, sys: string }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const sessions = data.sessions || [];
        if (sessions.length > 0) {
          const first = sessions[0];
          const last = sessions[sessions.length - 1];
          const formatTime = (ts: any) => {
            if (!ts) return "--:--";
            return ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          };

          let addedMins = 0;
          if (!last.checkOut) {
            if (data.date === getTodayDateStr()) {
              addedMins = Math.floor((Date.now() - last.checkIn.toMillis()) / 60000);
            } else {
              addedMins = Math.max(0, 9 * 60 - data.totalMinutes);
            }
          }
          const finalMins = data.totalMinutes + addedMins;

          attMap[data.date] = {
            in: formatTime(first.checkIn),
            out: formatTime(last.checkOut),
            sys: (finalMins / 60).toFixed(1) + "h"
          };
        }
      });
      setMonthAttendance(attMap);
    });

    return () => {
      unsubHist();
      unsubAtt();
    };
  }, [user, historyMonth]);

  const isHolidayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const dateNum = d.getDate();
    // Sunday
    if (day === 0) return true;
    // 2nd and 4th Saturday
    if (day === 6) {
      const weekOfMonth = Math.ceil(dateNum / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) return true;
    }
    return false;
  };

  const handleSaveEntry = async (isDraft: boolean) => {
    if (!user) return;
    // For drafts, hours are optional. For submitted entries, all fields required.
    if (!project || !taskTitle) {
      alert("Project and Task Title are required.");
      return;
    }
    if (!isDraft && hours === "") {
      alert("Hours are required to submit an entry.");
      return;
    }

    setIsSubmitting(true);
    try {
      const monthStr = selectedDate.substring(0, 7);

      const payload = {
        uid: user.uid,
        userName: userFullName || user.email?.split("@")[0] || "Unknown",
        dateStr: selectedDate,
        monthStr,
        project,
        taskTitle,
        description,
        category,
        status,
        hours: hours === "" ? 0 : Number(hours),
        isDraft,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "dailySheets", editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "dailySheets"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      // If submitting (not draft): close modal and reset form
      // If saving draft: keep modal open so user can continue editing
      if (!isDraft) {
        setProject("");
        setProjectSearch("");
        setShowProjectDropdown(false);
        setTaskTitle("");
        setDescription("");
        setHours("");
        setStatus(STATUSES[0]);
        setEditingId(null);
        setIsModalOpen(false);
      }
      // For draft: stay in modal, let user continue editing
    } catch (error) {
      console.error(error);
      alert("Failed to save entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (entry: DailySheetEntry) => {
    setEditingId(entry.id!);
    setProject(entry.project);
    setProjectSearch("");
    setShowProjectDropdown(false);
    setTaskTitle(entry.taskTitle);
    setDescription(entry.description || "");
    setCategory(entry.category || CATEGORIES[0]);
    setStatus(entry.status || STATUSES[0]);
    setHours(entry.hours);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, "dailySheets", id));
      if (editingId === id) setEditingId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAsHoliday = async () => {
    if (!user) return;
    if (entries.length > 0) {
      alert("Please delete existing entries for this day before marking it as a holiday.");
      return;
    }

    try {
      await addDoc(collection(db, "dailySheets"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        dateStr: selectedDate,
        monthStr: selectedDate.substring(0, 7),
        project: "Holiday",
        taskTitle: "Holiday",
        description: "",
        category: "Other",
        status: "Completed",
        hours: 0,
        isDraft: false,
        isHoliday: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmitDay = async () => {
    if (!confirm("Submit all entries for this day? You cannot edit them after submitting.")) return;
    try {
      const promises = entries.map(entry =>
        updateDoc(doc(db, "dailySheets", entry.id!), { isDraft: false, updatedAt: serverTimestamp() })
      );
      await Promise.all(promises);
      setIsDaySubmitted(true);
      alert("Day submitted successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to submit day.");
    }
  };

  const exportToExcel = async () => {
    if (historyEntries.length === 0) {
      alert("No data to export for this month.");
      return;
    }

    // Group entries by date
    const entriesByDate = historyEntries.reduce((acc, curr) => {
      if (!acc[curr.dateStr]) acc[curr.dateStr] = [];
      acc[curr.dateStr].push(curr);
      return acc;
    }, {} as Record<string, DailySheetEntry[]>);

    const formatTime = (ts: any) => {
      if (!ts) return "--:--";
      return ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const finalData = [];

    for (const dateStr of Object.keys(entriesByDate).sort()) {
      const dayEntries = entriesByDate[dateStr];

      // Fetch attendance for this date
      let checkInStr = "--:--:--";
      let checkOutStr = "--:--:--";
      let totalSysHours = 0;

      if (user) {
        const attRef = doc(db, "attendance", `${user.uid}_${dateStr}`);
        const snap = await getDoc(attRef);
        if (snap.exists()) {
          const data = snap.data();
          const sessions = data.sessions || [];
          if (sessions.length > 0) {
            const first = sessions[0];
            const last = sessions[sessions.length - 1];
            checkInStr = formatTime(first.checkIn);
            checkOutStr = formatTime(last.checkOut);

            let addedMins = 0;
            if (!last.checkOut) {
              if (data.date === getTodayDateStr()) {
                addedMins = Math.floor((Date.now() - last.checkIn.toMillis()) / 60000);
              } else {
                addedMins = Math.max(0, 9 * 60 - data.totalMinutes);
              }
            }
            const finalMins = data.totalMinutes + addedMins;
            totalSysHours = Number((finalMins / 60).toFixed(2));
          }
        }
      }

      const availableHours = 8;
      const breakHours = 1;

      let assignedTaskStr = "";
      dayEntries.forEach((e, idx) => {
        assignedTaskStr += `Task ${idx + 1}: ${e.taskTitle}${e.description ? " - " + e.description : ""}\n`;
      });

      const isHoliday = dayEntries.some(e => e.isHoliday);

      finalData.push({
        "Date": dateStr,
        "Check-In": isHoliday ? "Holiday" : checkInStr,
        "Check-Out": isHoliday ? "Holiday" : checkOutStr,
        "Available Hours": isHoliday ? 0 : availableHours,
        "Break Hours": isHoliday ? 0 : breakHours,
        "Total Hours": isHoliday ? 0 : totalSysHours,
        "Assigned Task": isHoliday ? "Holiday" : assignedTaskStr.trim(),
        "Status": dayEntries.some(e => e.isDraft) ? "Draft" : "Submitted"
      });
    }

    const ws = XLSX.utils.json_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
    XLSX.writeFile(wb, `TechGy_Employee_Timesheet_${historyMonth}.xlsx`);
  };

  const isAutoHoliday = isHolidayDate(selectedDate);
  const totalHoursToday = entries.reduce((acc, curr) => acc + curr.hours, 0);

  return (
    <div className="p-4 lg:p-6 pb-24 h-full overflow-y-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-1.5 px-3 border-none rounded-md text-sm font-medium bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
          />
          {isAutoHoliday && (
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold">
              Weekend/Holiday
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition shadow-sm border-none"
          >
            Export
          </button>
        </div>
      </div>

      {/* Main Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? "Edit Task Entry" : "Add Task Entry"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveEntry(true)}
                  disabled={isSubmitting || isDaySubmitted}
                  className="px-4 py-1.5 text-slate-500 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => { setIsModalOpen(false); setEditingId(null); setProject(""); setProjectSearch(""); setShowProjectDropdown(false); setTaskTitle(""); setDescription(""); setHours(""); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full font-bold text-lg transition"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Project *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowProjectDropdown(v => !v); setProjectSearch(""); }}
                    disabled={isDaySubmitted}
                    className="w-full p-3 border border-slate-200 rounded-xl text-left text-slate-700 placeholder-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition bg-white flex items-center justify-between disabled:opacity-50"
                  >
                    <span className={project ? "text-slate-800" : "text-slate-400"}>{project || "Select project..."}</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProjectDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showProjectDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" /></svg>
                          <input
                            autoFocus
                            type="text"
                            value={projectSearch}
                            onChange={e => setProjectSearch(e.target.value)}
                            placeholder="Search projects..."
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                          />
                        </div>
                      </div>
                      <ul className="max-h-44 overflow-y-auto py-1">
                        {projects
                          .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                          .map(p => (
                            <li
                              key={p.id}
                              onClick={() => { setProject(p.name); setShowProjectDropdown(false); }}
                              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-violet-50 hover:text-violet-700 transition ${project === p.name ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-700"
                                }`}
                            >
                              {p.name}
                            </li>
                          ))}
                        {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                          <li className="px-4 py-3 text-sm text-slate-400 text-center">No projects found</li>
                        )}
                      </ul>
                      {projectSearch && (
                        <div className="border-t border-slate-100 p-2">
                          <button
                            onClick={() => { setProject(projectSearch); setShowProjectDropdown(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-violet-600 font-semibold hover:bg-violet-50 rounded-lg transition"
                          >
                            + Use "{projectSearch}" as custom project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Task Title *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What did you work on?"
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition"
                  disabled={isDaySubmitted}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition resize-none"
                  rows={2}
                  disabled={isDaySubmitted}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-700 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition appearance-none bg-white"
                  disabled={isDaySubmitted}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-slate-700 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition appearance-none bg-white"
                    disabled={isDaySubmitted}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Hours *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value ? Number(e.target.value) : "")}
                    placeholder="1"
                    className="w-full p-3 border border-slate-200 rounded-xl text-slate-700 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 outline-none transition"
                    disabled={isDaySubmitted}
                  />
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => handleSaveEntry(false)}
                disabled={isSubmitting || isDaySubmitted}
                className="w-full py-3.5 bg-[#1a2e45] text-white text-base font-bold rounded-xl hover:bg-[#0f1b29] transition shadow-md disabled:opacity-50"
              >
                {editingId ? "Update Entry" : "+ Add to Day"}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Daily Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-4">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            📅 Entries for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={isDaySubmitted}
              className="px-4 py-2 bg-[#1a2e45] text-white text-sm font-bold rounded-lg hover:bg-[#0f1b29] transition disabled:opacity-50 shadow-sm"
            >
              + Add Entry
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Total Hours</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Task Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Task Hrs</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">No entries for {selectedDate}</td>
                </tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50" title={e.description || e.taskTitle}>
                    <td className="px-4 py-3 font-medium">{e.dateStr}</td>
                    <td className="px-4 py-3 text-slate-500">{monthAttendance[e.dateStr]?.in || "--:--"}</td>
                    <td className="px-4 py-3 text-slate-500">{monthAttendance[e.dateStr]?.out || "--:--"}</td>
                    <td className="px-4 py-3 text-slate-500">{monthAttendance[e.dateStr]?.sys || "0.0h"}</td>
                    <td className="px-4 py-3">{e.project}</td>
                    <td className="px-4 py-3">{e.taskTitle}</td>
                    <td className="px-4 py-3">{e.status}</td>
                    <td className="px-4 py-3">{e.hours}h</td>
                    <td className="px-4 py-3">
                      {e.isHoliday ? (
                        <span className="text-amber-600 text-xs font-bold">Holiday</span>
                      ) : e.isDraft ? (
                        <span className="text-slate-500 text-xs">Draft</span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-bold">Submitted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!e.isHoliday && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(e.id!)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
