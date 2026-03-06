"use client";

import { useState, useEffect, useRef } from "react";
import {
  addDoc, collection, serverTimestamp, updateDoc, doc,
  onSnapshot, query, where, orderBy, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

/* ─── TYPES ─── */
interface Task { id: string; title: string; description?: string; projectId: string; sprintId?: string; assignedTo?: string; assignedToName?: string; assignedDate?: string; dueDate?: string; priority: string; status: string; estimatedHours?: number; actualHours?: number; storyPoints?: number; tags?: string[]; }
interface WorkLog { id?: string; userId: string; userName: string; projectId: string; projectName: string; taskId?: string; taskName?: string; description: string; hoursWorked: number; workStatus: "Completed" | "In Progress" | "Blocked"; date: string; createdAt?: any; }
interface Notification { id: string; userId: string; type: string; title: string; message: string; projectId?: string; taskId?: string; read: boolean; createdAt: any; }
interface DailyEntry { id: string; userId: string; userName: string; userEmail: string; date: string; month: string; tasks: DailyTask[]; totalHours: number; status: "submitted" | "draft"; submittedAt?: any; createdAt: any; }
interface DailyTask { id: string; projectId: string; projectName: string; taskTitle: string; description: string; hoursWorked: number; workStatus: "Completed" | "In Progress" | "Blocked" | "Review"; category: string; }

/* ─── CONSTANTS ─── */
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Low:      { color: "#16a34a", bg: "#f0fdf4", icon: "▼" },
  Medium:   { color: "#d97706", bg: "#fffbeb", icon: "●" },
  High:     { color: "#ea580c", bg: "#fff7ed", icon: "▲" },
  Critical: { color: "#dc2626", bg: "#fef2f2", icon: "⚡" },
};
const COL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; headerBg: string }> = {
  todo:       { label: "To Do",       color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9" },
  inprogress: { label: "In Progress", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe" },
  review:     { label: "Review",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe" },
  done:       { label: "Done",        color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7" },
  blocked:    { label: "Blocked",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2" },
};
const COLS = ["todo","inprogress","review","done","blocked"] as const;
type ColId = typeof COLS[number];
const DAILY_CATEGORIES = ["Development","Design","Testing","Meeting","Documentation","Review","DevOps","Research","Support","Other"];
const WORK_STATUSES = ["Completed","In Progress","Blocked","Review"] as const;

/* ─── HELPERS ─── */
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const nanoid = () => Math.random().toString(36).slice(2, 10);

const Avatar = ({ name, size="sm", highlight=false }: { name?:string; size?:"xs"|"sm"|"md"|"lg"; highlight?:boolean }) => {
  const s = { xs:"w-6 h-6 text-[10px]", sm:"w-8 h-8 text-xs", md:"w-10 h-10 text-sm", lg:"w-12 h-12 text-base" };
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
  const bg = colors[(name?.charCodeAt(0)||0) % colors.length];
  return <div className={`${s[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${highlight?"ring-2 ring-indigo-400 ring-offset-1":""}`} style={{background:bg}}>{name?.[0]?.toUpperCase()||"?"}</div>;
};

const ProgressRing = ({ pct, size=44, stroke=4, color="#6366f1" }: { pct:number; size?:number; stroke?:number; color?:string }) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r, offset=circ-(pct/100)*circ;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.6s ease"}} />
    </svg>
  );
};

/* ═══════════════════════════════════════════
   NATIVE DRAG KANBAN BOARD (Employee)
═══════════════════════════════════════════ */
function KanbanBoard({ tasks, projectColor, currentUserId, onTaskClick, onStatusChange }: {
  tasks: Task[]; projectColor: string; currentUserId: string;
  onTaskClick: (t: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string|null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColId|null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const dragTaskRef = useRef<Task|null>(null);

  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const isMyTask = (task: Task) => task.assignedTo === currentUserId;
  const colTasks = (colId: ColId) => localTasks.filter(t => t.status === colId);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!isMyTask(task)) { e.preventDefault(); return; }
    dragTaskRef.current = task;
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => { if (el) el.style.opacity = "0.4"; }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el) el.style.opacity = "1";
    setDraggingId(null); setDragOverCol(null); dragTaskRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, colId: ColId) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: ColId) => {
    e.preventDefault();
    const task = dragTaskRef.current;
    if (!task || task.status === colId) { setDraggingId(null); setDragOverCol(null); return; }
    setLocalTasks(prev => prev.map(t => t.id === task.id ? {...t, status: colId} : t));
    setDraggingId(null); setDragOverCol(null); dragTaskRef.current = null;
    onStatusChange(task.id, colId);
  };

  return (
    <div className="flex h-full gap-0 overflow-x-auto">
      {COLS.map(colId => {
        const cfg = COL_CONFIG[colId];
        const col = colTasks(colId);
        const isOver = dragOverCol === colId;
        return (
          <div key={colId}
            className="flex flex-col flex-shrink-0 w-[260px] border-r last:border-r-0 transition-colors duration-150"
            style={{ borderColor: isOver ? cfg.color+"50" : "#e5e7eb", background: isOver ? cfg.bg : "white" }}
            onDragOver={e => handleDragOver(e, colId)}
            onDrop={e => handleDrop(e, colId)}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}>

            {/* Column header */}
            <div className="flex-shrink-0 border-b" style={{ background: cfg.headerBg, borderColor: cfg.border }}>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{background: cfg.color}} />
                  <span className="text-xs font-black uppercase tracking-widest" style={{color: cfg.color}}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded border bg-white tabular-nums" style={{color: cfg.color, borderColor: cfg.border}}>{col.length}</span>
                  <span className="text-[10px] text-gray-400">{col.filter(t=>isMyTask(t)).length} yours</span>
                </div>
              </div>
              <div className="grid px-4 py-1 border-t text-[10px] font-bold text-gray-400 uppercase tracking-wider gap-2" style={{gridTemplateColumns:"1fr auto auto auto", borderColor: cfg.border+"60"}}>
                <span>Task</span><span>Pri</span><span>Due</span><span>Who</span>
              </div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
              {col.length === 0 && !isOver && (
                <div className="flex flex-col items-center justify-center h-24 mt-4 text-gray-200">
                  <div className="w-8 h-8 rounded-lg border-2 border-dashed flex items-center justify-center mb-1" style={{borderColor: cfg.color+"30"}}>
                    <span className="text-sm" style={{color: cfg.color+"40"}}>+</span>
                  </div>
                  <p className="text-[10px] text-gray-300">Drop here</p>
                </div>
              )}
              {isOver && col.length === 0 && <div className="mx-3 mt-3 h-1 rounded-full" style={{background: cfg.color}} />}

              {col.map(task => {
                const mine = isMyTask(task);
                const pc = PRIORITY_CONFIG[task.priority];
                const isDragging = draggingId === task.id;
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
                return (
                  <div key={task.id}
                    draggable={mine}
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task)}
                    className={`group border-b transition-all cursor-pointer select-none ${isDragging ? "opacity-40" : "hover:bg-gray-50/70"} ${mine ? "active:cursor-grabbing" : ""}`}
                    style={{
                      borderColor: "#f3f4f6",
                      borderLeftWidth: "3px",
                      borderLeftColor: mine ? projectColor : "transparent",
                      opacity: isDragging ? 0.4 : mine ? 1 : 0.55,
                    }}>
                    <div className="grid px-3 py-2.5 items-center gap-2" style={{gridTemplateColumns:"1fr auto auto auto"}}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-xs font-semibold text-gray-800 leading-tight truncate group-hover:text-indigo-700 transition-colors">{task.title}</p>
                          {mine && <span className="flex-shrink-0 text-[9px] font-black px-1 rounded" style={{background:projectColor+"20",color:projectColor}}>You</span>}
                        </div>
                        {task.estimatedHours ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 max-w-[56px] h-0.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${Math.min(((task.actualHours||0)/task.estimatedHours)*100,100)}%`, background: projectColor}} />
                            </div>
                            <span className="text-[9px] text-gray-400 tabular-nums">{task.actualHours||0}/{task.estimatedHours}h</span>
                          </div>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{background:pc?.bg||"#f1f5f9",color:pc?.color||"#64748b"}}>{pc?.icon||"•"}</span>
                      <span className="text-[10px] font-medium tabular-nums flex-shrink-0 whitespace-nowrap" style={{color:isOverdue?"#dc2626":"#94a3b8"}}>
                        {task.dueDate ? task.dueDate.slice(5) : "—"}{isOverdue&&"⚠"}
                      </span>
                      <div className="flex-shrink-0">
                        {task.assignedToName ? <Avatar name={task.assignedToName} size="xs" highlight={mine} /> : <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-200" />}
                      </div>
                    </div>
                    {mine && <p className="text-[9px] text-gray-300 px-3 pb-1.5">↕ drag to move</p>}
                  </div>
                );
              })}
              {isOver && col.length > 0 && <div className="mx-3 h-0.5 rounded-full mt-1" style={{background: cfg.color}} />}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t px-4 py-1.5" style={{borderColor: cfg.border, background: cfg.headerBg+"80"}}>
              <span className="text-[10px] font-semibold" style={{color: cfg.color+"99"}}>
                {col.filter(t=>isMyTask(t)).reduce((s,t)=>s+(t.actualHours||0),0)}h / {col.filter(t=>isMyTask(t)).reduce((s,t)=>s+(t.estimatedHours||0),0)}h est (yours)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   EMPLOYEE DAILY SHEET
═══════════════════════════════════════════ */
function EmployeeDailySheet({ user, projects }: { user: any; projects: any[] }) {
  const currentMonth = new Date().toISOString().slice(0,7);
  // ALL hooks at top — no hooks after any return statement
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [mode, setMode] = useState<"calendar"|"fill"|"summary">("calendar");
  const [currentEntry, setCurrentEntry] = useState<DailyEntry|null>(null);
  const [taskList, setTaskList] = useState<DailyTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [popupDate, setPopupDate] = useState<string|null>(null);
  const [tf, setTf] = useState({ projectId:"", taskTitle:"", description:"", hoursWorked:1, workStatus:"Completed" as DailyTask["workStatus"], category:"Development" });

  const userName = user?.email?.split("@")[0] || "";
  const myProjects = projects?.filter(p => p.members?.includes(user?.uid)) || [];

  // Fix: build month string without toISOString (avoids UTC timezone skew)
  const buildMonthStr = (y: number, m0: number) =>
    `${y}-${String(m0 + 1).padStart(2, "0")}`;

  const parsedYear  = parseInt(viewMonth.split("-")[0], 10);
  const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1; // 0-based

  const daysInMonth = getDaysInMonth(parsedYear, parsedMonth);
  const firstDay    = getFirstDayOfMonth(parsedYear, parsedMonth);
  const monthName   = new Date(parsedYear, parsedMonth, 1).toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => {
    const d = new Date(parsedYear, parsedMonth - 1, 1);
    setViewMonth(buildMonthStr(d.getFullYear(), d.getMonth()));
  };
  const nextMonth = () => {
    const d = new Date(parsedYear, parsedMonth + 1, 1);
    setViewMonth(buildMonthStr(d.getFullYear(), d.getMonth()));
  };

  useEffect(() => {
    if (!user?.uid) return;
    const start = `${viewMonth}-01`;
    const end   = `${viewMonth}-${String(getDaysInMonth(parsedYear, parsedMonth)).padStart(2, "0")}`;
    const q = query(
      collection(db, "dailyEntries"),
      where("userId", "==", user.uid),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc")
    );
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyEntry))));
  }, [user?.uid, viewMonth]);

  const getEntry = (dateStr: string) => entries.find(e => e.date === dateStr) || null;

  const openFill = (dateStr: string) => {
    const entry = getEntry(dateStr);
    setSelectedDate(dateStr);
    setCurrentEntry(entry);
    setTaskList(entry ? [...entry.tasks] : []);
    setPopupDate(null);
    setMode("fill");
  };

  const addTask = () => {
    if (!tf.projectId || !tf.taskTitle.trim()) return;
    const proj = myProjects.find(p => p.id === tf.projectId);
    setTaskList(prev => [...prev, {
      id: nanoid(),
      projectId: tf.projectId,
      projectName: proj?.name || "",
      taskTitle: tf.taskTitle,
      description: tf.description,
      hoursWorked: tf.hoursWorked,
      workStatus: tf.workStatus,
      category: tf.category,
    }]);
    setTf(t => ({ ...t, taskTitle: "", description: "", hoursWorked: 1 }));
  };

  const removeTask = (id: string) => setTaskList(prev => prev.filter(t => t.id !== id));

  const saveEntry = async (status: "submitted" | "draft") => {
    if (!selectedDate || !user?.uid) return;
    setSaving(true);
    const totalHours = taskList.reduce((s, t) => s + t.hoursWorked, 0);
    const data = {
      userId: user.uid, userName, userEmail: user.email || "",
      date: selectedDate, month: viewMonth,
      tasks: taskList, totalHours, status,
      ...(status === "submitted" ? { submittedAt: serverTimestamp() } : {}),
    };
    try {
      if (currentEntry?.id) {
        await updateDoc(doc(db, "dailyEntries", currentEntry.id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "dailyEntries"), { ...data, createdAt: serverTimestamp() });
      }
      setMode("calendar");
      setSelectedDate(null);
      setCurrentEntry(null);
      setTaskList([]);
    } catch (err: any) { alert("Save failed: " + err.message); }
    finally { setSaving(false); }
  };

  const totalMonthHours = entries.reduce((s, e) => s + e.totalHours, 0);
  const submittedDays   = entries.filter(e => e.status === "submitted").length;
  const todayStr        = new Date().toISOString().split("T")[0];
  const popupEntry      = popupDate ? getEntry(popupDate) : null;

  /* ── FILL FORM ── */
  if (mode === "fill" && selectedDate) {
    const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const totalH = taskList.reduce((s, t) => s + t.hoursWorked, 0);
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("calendar")} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition shadow-sm">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">{dateLabel}</h2>
            <p className="text-sm text-gray-400">{currentEntry ? (currentEntry.status === "submitted" ? "Submitted ✅" : "Draft 📝") : "New entry"} · {totalH}h logged</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveEntry("draft")} disabled={saving || taskList.length === 0} className="px-4 py-2 text-sm font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Save Draft</button>
            <button onClick={() => saveEntry("submitted")} disabled={saving || taskList.length === 0} className="px-5 py-2 text-sm font-bold rounded-xl text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {saving ? "Saving..." : "Submit Day ✓"}
            </button>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-700 mb-4">Add Task Entry</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Project *</label>
              <select value={tf.projectId} onChange={e => setTf(t => ({ ...t, projectId: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">Select project...</option>
                {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Task Title *</label>
              <input value={tf.taskTitle} onChange={e => setTf(t => ({ ...t, taskTitle: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="What did you work on?" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Description</label>
              <input value={tf.description} onChange={e => setTf(t => ({ ...t, description: e.target.value }))} placeholder="Brief description (optional)" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Category</label>
              <select value={tf.category} onChange={e => setTf(t => ({ ...t, category: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {DAILY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Status</label>
              <select value={tf.workStatus} onChange={e => setTf(t => ({ ...t, workStatus: e.target.value as any }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {WORK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Hours *</label>
              <input type="number" value={tf.hoursWorked} onChange={e => setTf(t => ({ ...t, hoursWorked: parseFloat(e.target.value) || 0 }))} min={0.5} step={0.5} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <button onClick={addTask} disabled={!tf.projectId || !tf.taskTitle.trim()} className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            + Add to Day
          </button>
        </div>
        {taskList.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <h3 className="font-black text-gray-800">Today's Entries</h3>
              <span className="text-2xl font-black text-indigo-600">{totalH}h total</span>
            </div>
            <div className="divide-y divide-gray-50">
              {taskList.map(task => (
                <div key={task.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background: myProjects.find(p => p.id === task.projectId)?.color || "#6366f1" }}>
                    {task.projectName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-indigo-600">{task.projectName}</span>
                      <span className="text-[10px] text-gray-400">· {task.category}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{task.taskTitle}</p>
                    {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${task.workStatus === "Completed" ? "bg-green-100 text-green-700" : task.workStatus === "Blocked" ? "bg-red-100 text-red-700" : task.workStatus === "Review" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{task.workStatus}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-indigo-600">{task.hoursWorked}h</span>
                    <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl text-gray-300 shadow-sm">
            <div className="text-5xl mb-3">📝</div>
            <p className="text-base font-bold text-gray-400">Add your first task above</p>
          </div>
        )}
      </div>
    );
  }

  /* ── SUMMARY ── */
  if (mode === "summary") {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("calendar")} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 transition shadow-sm">←</button>
          <h2 className="text-lg font-black text-gray-900">Month Summary — {monthName}</h2>
          <div className="ml-auto flex gap-4">
            <div className="text-center"><p className="text-2xl font-black text-indigo-600">{totalMonthHours}h</p><p className="text-xs text-gray-400">Total Hours</p></div>
            <div className="text-center"><p className="text-2xl font-black text-green-600">{submittedDays}</p><p className="text-xs text-gray-400">Days Submitted</p></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Date","Project","Task","Category","Status","Hours"].map(h => <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody>
              {entries.flatMap(entry => entry.tasks.map((task, ti) => {
                const d = new Date(entry.date + "T12:00:00");
                return (
                  <tr key={`${entry.id}-${ti}`} className="border-b border-gray-50 hover:bg-indigo-50/20 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${entry.status === "submitted" ? "bg-green-400" : "bg-yellow-400"}`} />
                        <span className="text-sm font-semibold text-gray-700">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">{task.projectName}</span></td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">{task.taskTitle}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{task.category}</td>
                    <td className="px-5 py-3.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${task.workStatus === "Completed" ? "bg-green-100 text-green-700" : task.workStatus === "Blocked" ? "bg-red-100 text-red-700" : task.workStatus === "Review" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{task.workStatus}</span></td>
                    <td className="px-5 py-3.5 text-xl font-black text-indigo-600">{task.hoursWorked}h</td>
                  </tr>
                );
              }))}
              {entries.length === 0 && <tr><td colSpan={6} className="py-16 text-center text-gray-300"><div className="text-4xl mb-2">📋</div><p className="text-sm">No entries this month</p></td></tr>}
            </tbody>
            {entries.length > 0 && <tfoot><tr className="border-t border-gray-200 bg-gray-50"><td colSpan={5} className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">Month Total</td><td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{totalMonthHours}h</td></tr></tfoot>}
          </table>
        </div>
      </div>
    );
  }

  /* ── CALENDAR ── */
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Day detail popup — full task data, no truncation */}
      {popupDate && popupEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPopupDate(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="font-black text-gray-900 text-base">
                  {new Date(popupDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${popupEntry.status === "submitted" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {popupEntry.status === "submitted" ? "✅ Submitted" : "📝 Draft"}
                  </span>
                  <span className="text-sm font-black text-indigo-600">{popupEntry.totalHours}h total</span>
                  <span className="text-xs text-gray-400">{popupEntry.tasks.length} task{popupEntry.tasks.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setPopupDate(null); openFill(popupDate); }} className="px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition">✏️ Edit</button>
                <button onClick={() => setPopupDate(null)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {popupEntry.tasks.map((task, ti) => (
                <div key={ti} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-600">{task.projectName}</span>
                        <span className="text-[10px] text-gray-400">· {task.category}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-800 leading-snug">{task.taskTitle}</p>
                      {task.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{task.description}</p>}
                      <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${task.workStatus === "Completed" ? "bg-green-100 text-green-700" : task.workStatus === "Blocked" ? "bg-red-100 text-red-700" : task.workStatus === "Review" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{task.workStatus}</span>
                    </div>
                    <span className="text-2xl font-black text-indigo-600 flex-shrink-0">{task.hoursWorked}h</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{popupEntry.tasks.length} tasks</span>
              <span className="text-xl font-black text-indigo-600">{popupEntry.totalHours}h</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">←</button>
          <span className="px-3 text-sm font-bold text-gray-800">{monthName}</span>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">→</button>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-center"><p className="text-2xl font-black text-indigo-600">{totalMonthHours}h</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Month Hrs</p></div>
          <div className="text-center"><p className="text-2xl font-black text-green-600">{submittedDays}</p><p className="text-[10px] text-gray-400 uppercase tracking-wider">Submitted</p></div>
          <button onClick={() => setMode("summary")} className="px-4 py-2 text-xs font-bold rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition">📊 Summary</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400" /><span className="text-xs text-gray-500 font-semibold">Submitted</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="text-xs text-gray-500 font-semibold">Draft</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200" /><span className="text-xs text-gray-500 font-semibold">Empty — click to log</span></div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {WEEKDAYS.map(d => <div key={d} className="py-3 text-center text-xs font-black text-gray-400 uppercase tracking-widest border-r border-gray-100 last:border-r-0">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="h-28 border-r border-b border-gray-50 bg-gray-50/50" />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewMonth}-${String(day).padStart(2, "0")}`;
            const entry = getEntry(dateStr);
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const dayHours = entry?.totalHours || 0;
            return (
              <div key={dateStr}
                onClick={() => {
                  if (isFuture) return;
                  if (entry) setPopupDate(dateStr);
                  else openFill(dateStr);
                }}
                className={`h-28 border-r border-b border-gray-50 p-2 flex flex-col transition-all ${isFuture ? "opacity-35 cursor-not-allowed" : isToday ? "bg-indigo-50/60 cursor-pointer hover:bg-indigo-100/50" : "cursor-pointer hover:bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isToday ? "bg-indigo-600 text-white" : "text-gray-400"}`}>{day}</div>
                  {entry && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-indigo-500">{dayHours}h</span>
                      <span className={`w-2 h-2 rounded-full ${entry.status === "submitted" ? "bg-green-400" : "bg-yellow-400"}`} />
                    </div>
                  )}
                </div>
                {entry ? (
                  <div className="flex-1 overflow-hidden space-y-0.5">
                    {entry.tasks.slice(0, 3).map((t, ti) => (
                      <div key={ti} className="flex items-center gap-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.workStatus === "Completed" ? "#22c55e" : t.workStatus === "Blocked" ? "#ef4444" : t.workStatus === "Review" ? "#8b5cf6" : "#3b82f6" }} />
                        <p className="text-[9px] text-gray-600 truncate font-medium">{t.taskTitle}</p>
                      </div>
                    ))}
                    {entry.tasks.length > 3 && <p className="text-[9px] font-bold text-indigo-400">+{entry.tasks.length - 3} more</p>}
                  </div>
                ) : !isFuture ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[10px] text-gray-300 font-semibold">{isToday ? "Log today" : "+ Add"}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function parseYYYYMM(s: string) { const [y,m] = s.split("-").map(Number); return {year:y, month:m-1}; }

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function EmployeeProjectManagement({ user, projects, users }: any) {
  const [activeProject, setActiveProject] = useState<any>(null);
  const [activeTask, setActiveTask] = useState<Task|null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [myWorkLogs, setMyWorkLogs] = useState<WorkLog[]>([]);
  const [allWorkLogs, setAllWorkLogs] = useState<WorkLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"kanban"|"list"|"timeline"|"logs">("kanban");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard"|"projects"|"dailysheet"|"notifications">("dashboard");
  const [taskTab, setTaskTab] = useState<"details"|"subtasks"|"files"|"comments">("details");
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showWorkLogForm, setShowWorkLogForm] = useState(false);
  const [wl, setWl] = useState({ taskId:"", taskName:"", description:"", hoursWorked:"", workStatus:"In Progress" as WorkLog["workStatus"], date:new Date().toISOString().split("T")[0] });

  const myProjects = projects?.filter((p:any) => p.members?.includes(user?.uid)) || [];
  const userName = user?.email?.split("@")[0];
  const projectColor = activeProject?.color || "#6366f1";

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db,"notifications"), where("userId","==",user.uid), orderBy("createdAt","desc"));
    return onSnapshot(q, s => setNotifications(s.docs.map(d => ({id:d.id,...d.data()} as Notification))));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db,"workLogs"), where("userId","==",user.uid), orderBy("createdAt","desc"));
    return onSnapshot(q, s => setMyWorkLogs(s.docs.map(d => ({id:d.id,...d.data()} as WorkLog))));
  }, [user?.uid]);

  useEffect(() => {
    if (!activeProject) return;
    const tq = activeSprint
      ? query(collection(db,"projectTasks"), where("projectId","==",activeProject.id), where("sprintId","==",activeSprint.id))
      : query(collection(db,"projectTasks"), where("projectId","==",activeProject.id));
    const u1=onSnapshot(tq, s=>setTasks(s.docs.map(d=>({id:d.id,...d.data()} as Task))));
    const u2=onSnapshot(query(collection(db,"sprints"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setSprints(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(query(collection(db,"projectActivities"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setActivities(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(query(collection(db,"workLogs"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setAllWorkLogs(s.docs.map(d=>({id:d.id,...d.data()} as WorkLog))));
    const u5=onSnapshot(query(collection(db,"milestones"),where("projectId","==",activeProject.id)),s=>setMilestones(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{ u1(); u2(); u3(); u4(); u5(); };
  },[activeProject,activeSprint]);

  useEffect(() => {
    if (!activeTask) return;
    const u1=onSnapshot(query(collection(db,"taskComments"),where("taskId","==",activeTask.id),orderBy("createdAt","asc")),s=>setComments(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(query(collection(db,"taskFiles"),where("taskId","==",activeTask.id),orderBy("createdAt","desc")),s=>setTaskFiles(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(query(collection(db,"subtasks"),where("taskId","==",activeTask.id)),s=>setSubtasks(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{ u1(); u2(); u3(); };
  },[activeTask]);

  const isMyTask=(task:Task)=>task.assignedTo===user?.uid;
  const unreadCount=notifications.filter(n=>!n.read).length;

  const logActivity=async(projectId:string,action:string,description:string,taskId?:string)=>{
    await addDoc(collection(db,"projectActivities"),{projectId,userId:user.uid,userName:userName??"",action,description,taskId:taskId??null,createdAt:serverTimestamp()});
  };
  const markAllRead=async()=>{ for (const n of notifications.filter(n=>!n.read)) await updateDoc(doc(db,"notifications",n.id),{read:true}); };
  const markRead=async(nid:string)=>{ await updateDoc(doc(db,"notifications",nid),{read:true}); };

  const handleStatusChange=async(taskId:string,newStatus:string)=>{
    const task=tasks.find(t=>t.id===taskId);
    if (!task||!isMyTask(task)) return;
    await updateDoc(doc(db,"projectTasks",taskId),{status:newStatus,...(newStatus==="inprogress"?{startedAt:serverTimestamp()}:{}),...(newStatus==="done"?{completedAt:serverTimestamp()}:{})});
    await logActivity(activeProject.id,"moved task",`"${task.title}" → ${COL_CONFIG[newStatus]?.label}`,taskId);
    const snap=await getDocs(query(collection(db,"projectTasks"),where("projectId","==",activeProject.id)));
    const all=snap.docs.map(d=>d.data());
    if (all.length) await updateDoc(doc(db,"projects",activeProject.id),{progress:Math.round((all.filter(t=>t.status==="done").length/all.length)*100)});
    if (activeTask?.id===taskId) setActiveTask({...activeTask,status:newStatus as any});
  };

  const handleAddComment=async()=>{
    if (!commentText.trim()) return;
    await addDoc(collection(db,"taskComments"),{taskId:activeTask!.id,projectId:activeProject.id,userId:user.uid,userName:userName??"",text:commentText,createdAt:serverTimestamp()});
    setCommentText("");
  };

  const handleFileUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];
    if (!file||!activeTask||!activeProject) return;
    if (file.size>10*1024*1024) { alert("Max 10MB"); return; }
    try {
      setUploading(true);
      const sr=ref(storage,`projectFiles/${activeProject.id}/${activeTask.id}/${Date.now()}_${file.name}`);
      const snap=await uploadBytes(sr,file);
      const url=await getDownloadURL(snap.ref);
      await addDoc(collection(db,"taskFiles"),{taskId:activeTask.id,projectId:activeProject.id,fileName:file.name,fileUrl:url,uploadedBy:user.uid,uploadedByName:userName,createdAt:serverTimestamp()});
    } catch(err:any) { alert(`Upload failed: ${err.message}`); } finally { setUploading(false); }
  };

  const handleSubmitWorkLog=async()=>{
    if (!wl.description.trim()||!wl.hoursWorked||!activeProject) return;
    const taskObj=tasks.find(t=>t.id===wl.taskId);
    await addDoc(collection(db,"workLogs"),{userId:user.uid,userName:userName??"",projectId:activeProject.id,projectName:activeProject.name,taskId:wl.taskId||null,taskName:wl.taskName||taskObj?.title||null,description:wl.description,hoursWorked:Number(wl.hoursWorked),workStatus:wl.workStatus,date:wl.date,createdAt:serverTimestamp()});
    if (wl.taskId) {
      const snap=await getDocs(query(collection(db,"projectTasks"),where("projectId","==",activeProject.id)));
      const td=snap.docs.find(d=>d.id===wl.taskId);
      if (td) await updateDoc(doc(db,"projectTasks",wl.taskId),{actualHours:(td.data().actualHours||0)+Number(wl.hoursWorked)});
    }
    await logActivity(activeProject.id,"logged work",`${wl.hoursWorked}h: ${wl.description}`,wl.taskId);
    setWl({taskId:"",taskName:"",description:"",hoursWorked:"",workStatus:"In Progress",date:new Date().toISOString().split("T")[0]});
    setShowWorkLogForm(false);
  };

  const myTasks=tasks.filter(t=>isMyTask(t));
  const myDone=myTasks.filter(t=>t.status==="done").length;
  const myProgress=myTasks.length>0?Math.round((myDone/myTasks.length)*100):0;
  const filteredTasks=tasks.filter(t=>(filterPriority==="all"||t.priority===filterPriority)&&(!search||t.title.toLowerCase().includes(search.toLowerCase())));
  const overdueTasks=myTasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="done");
  const todayStr=new Date().toISOString().split("T")[0];
  const todayLogs=myWorkLogs.filter(l=>l.date===todayStr);
  const todayHours=todayLogs.reduce((s,l)=>s+l.hoursWorked,0);
  const totalHoursAll=myWorkLogs.reduce((s,l)=>s+l.hoursWorked,0);

  /* ── TASK DETAIL ── */
  if (activeTask) {
    const canEdit=isMyTask(activeTask);
    const pc=PRIORITY_CONFIG[activeTask.priority];
    const subtasksDone=subtasks.filter(s=>s.done).length;
    return (
      <div className="fixed inset-0 z-50 flex items-stretch" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setActiveTask(null)} />
        <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
          <div style={{background:`linear-gradient(135deg,${projectColor} 0%,${projectColor}cc 100%)`}}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/70">{activeProject?.name}</span>
                  {canEdit&&<span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">✏️ Your Task</span>}
                  {!canEdit&&<span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded-full">👁 View Only</span>}
                </div>
                <button onClick={()=>setActiveTask(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">✕</button>
              </div>
              <h2 className="text-xl font-bold text-white leading-snug mb-3">{activeTask.title}</h2>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{background:pc?.bg,color:pc?.color}}>{pc?.icon} {activeTask.priority}</span>
                {activeTask.tags?.map(t=><span key={t} className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white">#{t}</span>)}
              </div>
            </div>
            <div className="flex border-t border-white/20">
              {([["details","📋"],["subtasks","✅"],["files","📎"],["comments","💬"]] as const).map(([t,icon])=>(
                <button key={t} onClick={()=>setTaskTab(t)} className={`flex-1 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1 ${taskTab===t?"bg-white/20 text-white border-b-2 border-white":"text-white/60 hover:text-white/80"}`}>
                  {icon} {t.charAt(0).toUpperCase()+t.slice(1)}
                  {t==="comments"&&comments.length>0&&<span className="bg-white/30 text-white text-[10px] rounded-full px-1.5 py-0.5">{comments.length}</span>}
                  {t==="subtasks"&&subtasks.length>0&&<span className="bg-white/30 text-white text-[10px] rounded-full px-1.5 py-0.5">{subtasksDone}/{subtasks.length}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
            {taskTab==="details"&&(
              <div className="space-y-4">
                {activeTask.description&&<div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3><p className="text-sm text-gray-700 leading-relaxed">{activeTask.description}</p></div>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Status</p>
                    {canEdit
                      ? <select value={activeTask.status} onChange={e=>handleStatusChange(activeTask.id,e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">{COLS.map(c=><option key={c} value={c}>{COL_CONFIG[c].label}</option>)}</select>
                      : <span className="text-xs font-semibold" style={{color:COL_CONFIG[activeTask.status]?.color||"#64748b"}}>{COL_CONFIG[activeTask.status]?.label||activeTask.status}</span>}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Assignee</p>
                    <div className="flex items-center gap-2"><Avatar name={activeTask.assignedToName} size="xs" highlight={canEdit} /><span className="text-sm font-semibold text-gray-700">{activeTask.assignedToName||"Unassigned"}{canEdit&&" (You)"}</span></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Due Date</p>
                    <p className={`text-sm font-semibold ${activeTask.dueDate&&new Date(activeTask.dueDate)<new Date()&&activeTask.status!=="done"?"text-red-600":"text-gray-700"}`}>{activeTask.dueDate||"No date set"}{activeTask.dueDate&&new Date(activeTask.dueDate)<new Date()&&activeTask.status!=="done"&&" ⚠️"}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Story Points</p>
                    <p className="text-2xl font-black" style={{color:projectColor}}>{activeTask.storyPoints||0}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Time</h3>
                  <div className="flex items-center gap-4">
                    <ProgressRing pct={activeTask.estimatedHours?Math.min(((activeTask.actualHours||0)/activeTask.estimatedHours)*100,100):0} color={projectColor} />
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div><p className="text-2xl font-black text-gray-900">{activeTask.estimatedHours||0}h</p><p className="text-xs text-gray-400">Estimated</p></div>
                      <div><p className="text-2xl font-black" style={{color:projectColor}}>{activeTask.actualHours||0}h</p><p className="text-xs text-gray-400">Logged</p></div>
                    </div>
                  </div>
                </div>
                {canEdit&&(
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Log Work</h3><button onClick={()=>setShowWorkLogForm(!showWorkLogForm)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:projectColor}}>⏱ Log Hours</button></div>
                    {showWorkLogForm&&(
                      <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                        <textarea value={wl.description} onChange={e=>setWl({...wl,description:e.target.value,taskId:activeTask.id,taskName:activeTask.title})} placeholder="What did you work on?" rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="number" value={wl.hoursWorked} onChange={e=>setWl({...wl,hoursWorked:e.target.value,taskId:activeTask.id,taskName:activeTask.title})} placeholder="Hours" min="0.5" step="0.5" className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
                          <select value={wl.workStatus} onChange={e=>setWl({...wl,workStatus:e.target.value as any})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"><option>In Progress</option><option>Completed</option><option>Blocked</option></select>
                          <input type="date" value={wl.date} onChange={e=>setWl({...wl,date:e.target.value})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
                        </div>
                        <button onClick={handleSubmitWorkLog} disabled={!wl.description.trim()||!wl.hoursWorked} className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40" style={{background:projectColor}}>Submit Work Log</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {taskTab==="subtasks"&&(
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-700">Subtasks</h3><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{subtasksDone}/{subtasks.length}</span></div>
                {subtasks.map(st=>(
                  <div key={st.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${st.done?"opacity-60":"hover:bg-gray-50"} transition`}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0" style={{background:st.done?projectColor:"transparent",borderColor:st.done?projectColor:"#d1d5db"}}>{st.done&&<span className="text-white text-xs font-bold">✓</span>}</div>
                    <span className={`text-sm ${st.done?"line-through text-gray-400":"text-gray-700"}`}>{st.text}</span>
                  </div>
                ))}
                {subtasks.length===0&&<p className="text-xs text-gray-400 text-center py-4">No subtasks</p>}
              </div>
            )}
            {taskTab==="files"&&(
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-700">Files ({taskFiles.length})</h3><label className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer ${uploading?"opacity-50":""}`} style={{background:projectColor}}>{uploading?"Uploading...":"📤 Upload"}<input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} /></label></div>
                {taskFiles.length===0?<div className="text-center py-8 text-gray-300"><div className="text-4xl mb-2">📁</div><p className="text-sm">No files</p></div>:<div className="space-y-2">{taskFiles.map(f=><a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition"><div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{f.fileName.match(/\.(png|jpg|jpeg|gif)$/i)?"🖼️":f.fileName.match(/\.pdf$/i)?"📕":"📄"}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{f.fileName}</p><p className="text-xs text-gray-400">{f.uploadedByName}</p></div><span className="text-gray-300">↗</span></a>)}</div>}
              </div>
            )}
            {taskTab==="comments"&&(
              <div className="space-y-3">
                {comments.map(c=>(
                  <div key={c.id} className={`flex gap-3 ${c.userId===user?.uid?"flex-row-reverse":""}`}>
                    <Avatar name={c.userName} size="sm" />
                    <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${c.userId===user?.uid?"rounded-tr-sm text-white":"rounded-tl-sm bg-white border border-gray-100"}`} style={c.userId===user?.uid?{background:projectColor}:{}}>
                      <p className={`text-[10px] font-semibold mb-1 ${c.userId===user?.uid?"text-white/70":"text-gray-400"}`}>{c.userName} · {c.createdAt?.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>
                      <p className={`text-sm leading-relaxed ${c.userId===user?.uid?"text-white":"text-gray-700"}`}>{c.text}</p>
                    </div>
                  </div>
                ))}
                {comments.length===0&&<div className="text-center py-12 text-gray-300"><div className="text-5xl mb-3">💬</div><p className="text-sm">No comments yet</p></div>}
              </div>
            )}
          </div>
          {taskTab==="comments"&&(
            <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2">
                <Avatar name={userName} size="sm" />
                <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment..." onKeyDown={e=>e.key==="Enter"&&handleAddComment()} className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={handleAddComment} disabled={!commentText.trim()} className="px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-40" style={{background:projectColor}}>Send</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── PROJECT VIEW ── */
  if (activeProject) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>
        <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-3 flex items-center gap-4">
            <button onClick={()=>{setActiveProject(null);setActiveSprint(null);setViewMode("kanban");}} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition flex items-center gap-1">← Projects</button>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{background:projectColor}} /><h1 className="font-bold text-gray-900 text-sm">{activeProject.name}</h1></div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2"><ProgressRing pct={myProgress} size={32} stroke={3} color={projectColor} /><div><p className="text-xs font-bold text-gray-700">{myProgress}%</p><p className="text-[10px] text-gray-400">My tasks</p></div></div>
              {overdueTasks.length>0&&<span className="text-xs font-semibold bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">⚠️ {overdueTasks.length} overdue</span>}
            </div>
          </div>
          <div className="px-6 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100 flex-wrap">
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {[["kanban","⊞ Board"],["list","☰ List"],["timeline","📅 Activity"],["logs","⏱ Logs"]].map(([m,l])=>(
                <button key={m} onClick={()=>setViewMode(m as any)} className={`px-3 py-1.5 text-xs font-semibold transition ${viewMode===m?"text-white":"text-gray-500 hover:bg-gray-50"}`} style={viewMode===m?{background:projectColor}:{}}>{l}</button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <select value={activeSprint?.id||""} onChange={e=>setActiveSprint(sprints.find(s=>s.id===e.target.value)||null)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"><option value="">All Sprints</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"><option value="all">All Priorities</option>{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none w-36" />
            <div className="flex-1" />
            <button onClick={()=>setShowWorkLogForm(!showWorkLogForm)} className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg text-white shadow-sm" style={{background:projectColor}}>⏱ Log Work</button>
          </div>
          {milestones.length>0&&(
            <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto bg-white">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Milestones</span>
              {milestones.map(m=><span key={m.id} className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${m.status==="completed"?"border-green-200 bg-green-50 text-green-700":"border-gray-200 bg-gray-50 text-gray-600"}`}>{m.status==="completed"?"✅":"🎯"} {m.title}</span>)}
            </div>
          )}
        </div>

        {showWorkLogForm&&(
          <div className="flex-shrink-0 px-6 py-3 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-start gap-4 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider pt-2 flex-shrink-0" style={{color:projectColor}}>⏱ Log Work</span>
              <div className="flex-1 min-w-64"><textarea value={wl.description} onChange={e=>setWl({...wl,description:e.target.value})} placeholder="What did you work on? *" rows={1} className="w-full text-sm border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" /></div>
              <select value={wl.taskId} onChange={e=>{const t=tasks.find(t=>t.id===e.target.value);setWl({...wl,taskId:e.target.value,taskName:t?.title||""});}} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white"><option value="">Task (optional)</option>{myTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
              <input type="number" value={wl.hoursWorked} onChange={e=>setWl({...wl,hoursWorked:e.target.value})} placeholder="Hours *" min="0.5" step="0.5" className="w-24 text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
              <select value={wl.workStatus} onChange={e=>setWl({...wl,workStatus:e.target.value as any})} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white"><option>In Progress</option><option>Completed</option><option>Blocked</option></select>
              <input type="date" value={wl.date} onChange={e=>setWl({...wl,date:e.target.value})} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
              <button onClick={handleSubmitWorkLog} disabled={!wl.description.trim()||!wl.hoursWorked} className="text-xs font-bold px-4 py-2 text-white rounded-xl disabled:opacity-40 shadow-sm" style={{background:projectColor}}>Submit</button>
              <button onClick={()=>setShowWorkLogForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}

        {/* My stats bar */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-b border-gray-100 flex items-center gap-6">
          {[{label:"My Tasks",val:myTasks.length,color:"#64748b"},{label:"Done",val:myDone,color:"#16a34a"},{label:"In Progress",val:myTasks.filter(t=>t.status==="inprogress").length,color:"#2563eb"},{label:"Overdue",val:overdueTasks.length,color:"#dc2626"}].map(s=>(
            <div key={s.label} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:s.color}} /><span className="text-sm font-black" style={{color:s.color}}>{s.val}</span><span className="text-xs text-gray-400">{s.label}</span></div>
          ))}
          <div className="ml-auto text-xs text-gray-400">Showing {filteredTasks.length} tasks · {filteredTasks.filter(t=>isMyTask(t)).length} yours</div>
        </div>

        <div className="flex-1 overflow-auto">
          {viewMode==="kanban"&&(
            <div className="h-full border border-gray-200 rounded-xl m-4 overflow-hidden bg-white shadow-sm">
              <KanbanBoard tasks={filteredTasks} projectColor={projectColor} currentUserId={user?.uid} onTaskClick={setActiveTask} onStatusChange={handleStatusChange} />
            </div>
          )}
          {viewMode==="list"&&(
            <div className="p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-100">{["","Title","Status","Priority","Assignee","Due","Est."].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredTasks.map(task=>{
                    const mine=isMyTask(task); const pc=PRIORITY_CONFIG[task.priority]; const cc=COL_CONFIG[task.status];
                    return (<tr key={task.id} onClick={()=>setActiveTask(task)} className={`border-b border-gray-50 cursor-pointer transition group ${mine?"hover:bg-indigo-50/40":"hover:bg-gray-50 opacity-60"}`}>
                      <td className="px-4 py-3">{mine&&<div className="w-1.5 h-1.5 rounded-full" style={{background:projectColor}} />}</td>
                      <td className="px-4 py-3"><p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">{task.title}</p>{mine&&<p className="text-[10px] font-bold mt-0.5" style={{color:projectColor}}>Your Task</p>}</td>
                      <td className="px-4 py-3"><span className="text-xs font-semibold flex items-center gap-1 w-fit" style={{color:cc?.color}}><div className="w-1.5 h-1.5 rounded-full" style={{background:cc?.color}} />{cc?.label}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:pc?.bg,color:pc?.color}}>{pc?.icon} {task.priority}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={task.assignedToName} size="xs" /><span className="text-xs text-gray-600">{task.assignedToName||"—"}{mine&&" (you)"}</span></div></td>
                      <td className="px-4 py-3"><span className={`text-xs ${task.dueDate&&new Date(task.dueDate)<new Date()&&task.status!=="done"?"text-red-600 font-semibold":"text-gray-500"}`}>{task.dueDate||"—"}</span></td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600">{task.estimatedHours||0}h</td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div></div>
          )}
          {viewMode==="timeline"&&(
            <div className="p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-5">Activity</h3>
              <div className="space-y-0">
                {activities.slice(0,40).map((a,i)=>(
                  <div key={a.id} className="flex gap-4 relative">
                    {i<activities.length-1&&<div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5" style={a.userId===user?.uid?{background:projectColor}:{background:"#cbd5e1"}}>{a.userName?.[0]?.toUpperCase()}</div>
                    <div className={`flex-1 pb-4 rounded-xl p-3 border ${a.userId===user?.uid?"bg-indigo-50/40 border-indigo-100":"bg-gray-50 border-gray-100"}`}>
                      <div className="flex items-center justify-between mb-1"><p className="text-sm"><span className="font-semibold text-gray-800">{a.userName}</span>{a.userId===user?.uid&&<span className="text-xs text-indigo-500 ml-1">(you)</span>} <span className="text-gray-400">{a.action}</span></p><span className="text-xs text-gray-400">{a.createdAt?.toDate().toLocaleString()}</span></div>
                      <p className="text-xs text-gray-600">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div></div>
          )}
          {viewMode==="logs"&&(
            <div className="p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between"><h3 className="font-bold text-gray-800">My Work Logs — {activeProject.name}</h3><span className="text-sm font-bold" style={{color:projectColor}}>{allWorkLogs.filter(l=>l.userId===user?.uid).reduce((s,l)=>s+l.hoursWorked,0)}h total</span></div>
              <div className="divide-y divide-gray-50">
                {allWorkLogs.filter(l=>l.userId===user?.uid).map(log=>(
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                    <Avatar name={log.userName} size="sm" />
                    <div className="flex-1"><div className="flex items-start justify-between gap-3"><div>{log.taskName&&<p className="text-xs font-semibold text-gray-500 mb-0.5">{log.taskName}</p>}<p className="text-sm text-gray-700">{log.description}</p><div className="flex items-center gap-2 mt-1"><span className="text-xs text-gray-400">{log.date}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.workStatus==="Completed"?"bg-green-100 text-green-700":log.workStatus==="Blocked"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{log.workStatus}</span></div></div><span className="text-2xl font-black flex-shrink-0" style={{color:projectColor}}>{log.hoursWorked}h</span></div></div>
                  </div>
                ))}
                {allWorkLogs.filter(l=>l.userId===user?.uid).length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">⏱</div><p className="text-sm">No work logged yet</p></div>}
              </div>
            </div></div>
          )}
        </div>
      </div>
    );
  }

  /* ── MAIN DASHBOARD ── */
  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={userName} size="md" highlight />
            <div><p className="font-bold text-sm text-gray-900">Hey, {userName} 👋</p><p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p></div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {([["dashboard","🏠 Dashboard"],["projects","📁 Projects"],["dailysheet","📋 Daily Sheet"],["notifications","🔔 Inbox"]] as const).map(([t,label])=>(
              <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab===t?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700"}`}>
                {label}
                {t==="notifications"&&unreadCount>0&&<span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* DAILY SHEET */}
        {activeTab==="dailysheet"&&<EmployeeDailySheet user={user} projects={myProjects} />}

        {/* DASHBOARD */}
        {activeTab==="dashboard"&&(
          <div className="space-y-5">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {[
    { icon: "📁", label: "My Projects", val: myProjects.length, bg: "#e8f1ff" },
    { icon: "⏱", label: "Today's Hours", val: `${todayHours}h`, bg: "#e7f8ee" },
    { icon: "📊", label: "Total Hours", val: `${totalHoursAll}h`, bg: "#eef2ff" },
    { icon: "⚠️", label: "Overdue Tasks", val: overdueTasks.length, bg: "#fff4e5" },
  ].map((s) => (
    <div
      key={s.label}
      className="rounded-2xl p-5 shadow-sm"
      style={{ background: s.bg }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {s.label}
          </p>

          <p className="text-4xl font-black text-gray-800">{s.val}</p>
        </div>

        <span className="text-3xl">{s.icon}</span>
      </div>
    </div>
  ))}
</div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between"><div><h3 className="font-bold text-gray-800">Today's Work</h3><p className="text-xs text-gray-400 mt-0.5">{todayStr}</p></div><span className="text-2xl font-black text-indigo-600">{todayHours}h</span></div>
                {todayLogs.length===0?<div className="text-center py-10 text-gray-300"><div className="text-4xl mb-2">📝</div><p className="text-sm font-medium">No work logged today</p></div>:
                <div className="divide-y divide-gray-50">{todayLogs.map(log=>(
                  <div key={log.id} className="flex items-start gap-3 p-4"><div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-indigo-400" /><div className="flex-1"><p className="text-xs font-bold text-indigo-600 mb-0.5">{log.projectName}</p>{log.taskName&&<p className="text-xs text-gray-400">{log.taskName}</p>}<p className="text-sm text-gray-700 mt-0.5">{log.description}</p></div><div className="text-right flex-shrink-0"><p className="font-black text-lg text-indigo-600">{log.hoursWorked}h</p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.workStatus==="Completed"?"bg-green-100 text-green-700":log.workStatus==="Blocked"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{log.workStatus}</span></div></div>
                ))}</div>}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between"><h3 className="font-bold text-gray-800">My Projects</h3><button onClick={()=>setActiveTab("projects")} className="text-xs font-semibold text-indigo-600">View all →</button></div>
                <div className="divide-y divide-gray-50">{myProjects.slice(0,4).map((p:any)=>(
                  <div key={p.id} onClick={()=>{setActiveProject(p);setActiveTab("projects");}} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{background:p.color||"#6366f1"}}>{p.name[0]}</div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-gray-800 truncate group-hover:text-indigo-700">{p.name}</p><div className="flex items-center gap-2 mt-1"><div className="flex-1 bg-gray-100 rounded-full h-1"><div className="h-1 rounded-full" style={{width:`${p.progress||0}%`,background:p.color||"#6366f1"}} /></div><span className="text-[10px] font-bold" style={{color:p.color||"#6366f1"}}>{p.progress||0}%</span></div></div>
                    <span className="text-gray-300 group-hover:text-indigo-400">→</span>
                  </div>
                ))}{myProjects.length===0&&<div className="text-center py-10 text-gray-300"><div className="text-4xl mb-2">📭</div><p className="text-sm">No projects yet</p></div>}</div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50"><h3 className="font-bold text-gray-800">Work History</h3></div>
              <div className="divide-y divide-gray-50">
                {myWorkLogs.slice(0,8).map(log=>(
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>{log.projectName[0]}</div>
                    <div className="flex-1"><div className="flex items-center justify-between mb-0.5"><span className="text-xs font-bold text-indigo-600">{log.projectName}</span><span className="text-xs text-gray-400">{log.date}</span></div>{log.taskName&&<p className="text-xs text-gray-400 mb-0.5">{log.taskName}</p>}<p className="text-sm text-gray-700">{log.description}</p></div>
                    <div className="text-right flex-shrink-0"><p className="font-black text-xl text-indigo-600">{log.hoursWorked}h</p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.workStatus==="Completed"?"bg-green-100 text-green-700":log.workStatus==="Blocked"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{log.workStatus}</span></div>
                  </div>
                ))}
                {myWorkLogs.length===0&&<div className="text-center py-12 text-gray-300"><div className="text-4xl mb-2">⏱</div><p className="text-sm">No work logged yet</p></div>}
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS */}
        {activeTab==="projects"&&(
          <div className="space-y-5">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-black text-gray-900">My Projects</h2><p className="text-sm text-gray-400">{myProjects.length} project{myProjects.length!==1?"s":""}</p></div></div>
            {myProjects.length===0?<div className="text-center py-24 bg-white rounded-2xl border border-gray-100 text-gray-300"><div className="text-6xl mb-4">📭</div><p className="text-xl font-bold text-gray-400">No projects yet</p></div>:
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {myProjects.map((project:any)=>(
                <div key={project.id} onClick={()=>setActiveProject(project)} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden">
                  <div className="h-1.5" style={{background:project.color||"#6366f1"}} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{background:project.color||"#6366f1"}}>{project.name[0]}</div><div><h3 className="font-bold text-sm text-gray-900 group-hover:text-indigo-700">{project.name}</h3>{project.clientName&&<p className="text-xs text-gray-400">{project.clientName}</p>}</div></div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${project.status==="Completed"?"bg-green-100 text-green-700":project.status==="In Progress"?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-500"}`}>{project.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">{project.description||"No description"}</p>
                    <div><div className="flex justify-between mb-1.5"><span className="text-xs text-gray-400">Progress</span><span className="text-xs font-bold" style={{color:project.color||"#6366f1"}}>{project.progress||0}%</span></div><div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${project.progress||0}%`,background:project.color||"#6366f1"}} /></div></div>
                    <div className="mt-3 flex items-center justify-between">{project.endDate&&<span className="text-xs text-gray-400">📅 {project.endDate}</span>}<span className="text-xs font-semibold text-indigo-600 group-hover:underline ml-auto">Open →</span></div>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab==="notifications"&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-black text-gray-900">Inbox</h2><p className="text-sm text-gray-400">{unreadCount} unread</p></div>{unreadCount>0&&<button onClick={markAllRead} className="text-xs font-bold px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50">Mark all read ✓</button>}</div>
            {notifications.length===0?<div className="text-center py-24 bg-white rounded-2xl border border-gray-100 text-gray-300"><div className="text-6xl mb-4">🔔</div><p className="text-xl font-bold text-gray-400">All clear!</p></div>:
            <div className="space-y-2">{notifications.map(n=>(
              <div key={n.id} onClick={()=>markRead(n.id)} className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all ${!n.read?"border-indigo-100 shadow-sm":"border-gray-100"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${n.type==="project_added"?"bg-indigo-100":n.type==="task_assigned"?"bg-amber-100":"bg-gray-100"}`}>{n.type==="project_added"?"📁":n.type==="task_assigned"?"📋":"🔔"}</div>
                  <div className="flex-1"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-sm text-gray-800">{n.title}</p><p className="text-sm text-gray-500 mt-0.5">{n.message}</p></div>{!n.read&&<div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}</div>
                  <div className="flex items-center gap-3 mt-2"><span className="text-xs text-gray-400">{n.createdAt?.toDate().toLocaleString()}</span>{n.projectId&&<button onClick={e=>{e.stopPropagation();const p=myProjects.find((proj:any)=>proj.id===n.projectId);if(p){setActiveProject(p);setActiveTab("projects");}markRead(n.id);}} className="text-xs font-semibold text-indigo-600">Open Project →</button>}</div></div>
                </div>
              </div>
            ))}</div>}
          </div>
        )}
      </div>
    </div>
  );
}