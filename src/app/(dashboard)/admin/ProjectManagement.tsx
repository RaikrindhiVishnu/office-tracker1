"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  addDoc, collection, serverTimestamp, deleteDoc, doc,
  updateDoc, onSnapshot, query, where, orderBy, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

import { KanbanBoard, TaskModal } from "./KanbanBoard";
import type { KanbanColumn, Task } from "./KanbanBoard";
import { QuickFilter, QuickFilterState, EMPTY_FILTER, applyQuickFilter, countActiveFilters } from "./QuickFilter";

// ─── All sprint-related imports now come from sprint.tsx ───
import {
  SprintFormModal,
  TaskActivityTimeline,
  ProjectActivityTimeline,
  TaskImages,
  TaskLinks,
  TaskDependencies,
  MoveToSprintModal,
  SprintReports,
} from "./sprint";
import type { Sprint as SprintFull } from "./sprint";

/* ─── TYPES ─── */
interface Project {
  id: string; name: string; clientName?: string; description?: string;
  projectType: "Billing" | "Non-Billing"; billingType?: "Hourly" | "Fixed Cost" | "Internal";
  startDate?: string; endDate?: string;
  projectManagers: string[];
  projectManager?: string;
  members: string[]; budget?: number; priority: "Low" | "Medium" | "High" | "Critical";
  status: "Not Started" | "Planning" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
  progress: number; createdBy: string; createdAt: any; color?: string;
  columns?: KanbanColumn[];
}
interface Sprint {
  id: string; name: string; projectId: string; startDate?: string; endDate?: string;
  status: string; createdAt: any;
}
interface WorkLog {
  id: string; userId: string; userName: string; projectId: string; projectName: string;
  taskId?: string; taskName?: string; description: string; hoursWorked: number;
  workStatus: "Completed" | "In Progress" | "Blocked"; date: string; createdAt: any;
  status?: "done" | "progress" | "blocked";
  hours?: number;
}
interface Milestone { id: string; projectId: string; title: string; dueDate?: string; status: "pending" | "completed"; createdAt: any; }
interface DailyTask { id: string; projectId: string; projectName: string; taskTitle: string; description: string; hoursWorked: number; workStatus: "Completed" | "In Progress" | "Blocked" | "Review"; category: string; }
interface DailyEntry { id: string; userId: string; userName: string; userEmail: string; date: string; month: string; tasks: DailyTask[]; totalHours: number; status: "submitted" | "draft"; submittedAt?: any; createdAt: any; }
interface WorkloadItem {
  user: any;
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  autoHours?: number; // ✅ NEW
}
interface UserSummaryItem { user: any; totalH: number; days: number; byProject: Record<string, number>; byStatus: Record<string, number>; }

/* ─── CONSTANTS ─── */
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "new_discussions", label: "New Discussions" },
  { id: "dev_in_progress", label: "Dev In Progress" },
  { id: "unit_testing", label: "Unit Testing" },
  { id: "ready_for_qa", label: "Ready for QA" },
  { id: "testing_in_progress", label: "Testing In Progress" },
  { id: "done", label: "Done" },
  { id: "reopened", label: "Reopened" },
];

const PROJECT_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  "Not Started": { color: "#64748b", bg: "#f1f5f9", dot: "#94a3b8" },
  "Planning":    { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  "In Progress": { color: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
  "On Hold":     { color: "#ea580c", bg: "#fff7ed", dot: "#f97316" },
  "Completed":   { color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
  "Cancelled":   { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Low:      { color: "#16a34a", bg: "#f0fdf4", icon: "▼" },
  Medium:   { color: "#d97706", bg: "#fffbeb", icon: "●" },
  High:     { color: "#ea580c", bg: "#fff7ed", icon: "▲" },
  Critical: { color: "#dc2626", bg: "#fef2f2", icon: "⚡" },
};

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  story:  { icon: "📘", color: "#3730a3", label: "Story"  },
  task:   { icon: "🧩", color: "#0369a1", label: "Task"   },
  bug:    { icon: "🐞", color: "#b91c1c", label: "Bug"    },
  defect: { icon: "🎯", color: "#b45309", label: "Defect" },
};

function getColConfig(col: KanbanColumn, index: number) {
  const PALETTE = [
    { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
    { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { color: "#db2777", bg: "#fdf2f8", border: "#fbcfe8" },
  ];
  return PALETTE[index % PALETTE.length];
}

const DAILY_STATUS_COLORS: Record<string,{bg:string;color:string;dot:string}> = {
  Completed:    { bg:"#f0fdf4", color:"#16a34a", dot:"#22c55e" },
  "In Progress":{ bg:"#eff6ff", color:"#2563eb", dot:"#3b82f6" },
  Blocked:      { bg:"#fef2f2", color:"#dc2626", dot:"#ef4444" },
  Review:       { bg:"#f5f3ff", color:"#7c3aed", dot:"#8b5cf6" },
};

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getProjectManagers(p: Project): string[] {
  if (p.projectManagers && p.projectManagers.length > 0) return p.projectManagers;
  if (p.projectManager) return [p.projectManager];
  return [];
}

const Avatar = ({ name, size = "sm", color }: { name?: string; size?: "xs" | "sm" | "md" | "lg"; color?: string }) => {
  const s = { xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
  const bg = color || colors[(name?.charCodeAt(0)||0) % colors.length];
  return (
    <div className={`${s[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-white`} style={{background:bg}}>
      {name?.[0]?.toUpperCase()||"?"}
    </div>
  );
};

const ProgressRing = ({ pct, size=48, stroke=4, color="#6366f1" }: { pct:number; size?:number; stroke?:number; color?:string }) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r, offset=circ-(pct/100)*circ;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.6s ease"}} />
    </svg>
  );
};

/* ─── MEMBER PICKER ─── */
function MemberPicker({ users, currentUid, selected, onChange, label = "Team Members", excludeUids = [] }: {
  users: any[]; currentUid: string; selected: string[]; onChange: (s: string[]) => void;
  label?: string; excludeUids?: string[];
}) {
  const [search, setSearch] = useState("");
  const eligible = users.filter((u:any) => u.uid !== currentUid && !excludeUids.includes(u.uid));
  const filtered = eligible.filter((u:any) => {
    const name = (u.displayName || u.name || u.email?.split("@")[0] || "").toLowerCase();
    return name.includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase());
  });
  const toggle = (uid: string) => { onChange(selected.includes(uid) ? selected.filter(id => id !== uid) : [...selected, uid]); };
  const getName = (u: any) => u.displayName || u.name || u.email?.split("@")[0] || "Unknown";
  const colors = ["#6366f1","#7c3aed","#db2777","#d97706","#059669","#0891b2","#dc2626","#16a34a"];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {selected.length > 0 && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selected.length} selected</span>}
      </div>
      <div className="relative mb-2">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white transition" />
        {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs">✕</button>}
      </div>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="py-6 text-center text-xs text-gray-400">No members found</div>
            : filtered.map((u: any) => {
              const name = getName(u); const checked = selected.includes(u.uid);
              const colorIdx = (name.charCodeAt(0) || 0) % colors.length;
              return (
                <div key={u.uid} onClick={() => toggle(u.uid)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${checked ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:colors[colorIdx]}}>{name[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{name}</p><p className="text-[10px] text-gray-400 truncate">{u.email}</p></div>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>
                    {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ─── SPRINT PICKER ─── */
function SprintPicker({ sprints, activeSprint, onSelect, onDelete, onEdit }: {
  sprints: Sprint[]; activeSprint: Sprint|null;
  onSelect: (s: Sprint|null) => void;
  onDelete: (s: Sprint) => void;
  onEdit?: (s: Sprint) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const getSprintStatus = (s: Sprint) => {
    const now = new Date();
    if (s.status === "completed") return { label: "Completed", color: "#16a34a", bg: "#f0fdf4" };
    if (s.endDate && new Date(s.endDate) < now) return { label: "Overdue", color: "#dc2626", bg: "#fef2f2" };
    if (s.startDate && new Date(s.startDate) > now) return { label: "Planned", color: "#d97706", bg: "#fffbeb" };
    return { label: "Active", color: "#2563eb", bg: "#eff6ff" };
  };

  return (
    <div ref={dropRef} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 transition focus:outline-none"
        style={{ minWidth: "150px" }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activeSprint ? "#8b5cf6" : "#d1d5db" }} />
        <span className="flex-1 text-left text-gray-700 truncate">{activeSprint ? activeSprint.name : "All Sprints"}</span>
        {activeSprint && (() => { const st = getSprintStatus(activeSprint); return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>; })()}
        <span className="text-gray-400 text-[10px] shrink-0">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1" style={{ minWidth: "240px", maxWidth: "280px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div onClick={() => { onSelect(null); setOpen(false); }}
            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition text-xs ${!activeSprint ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
            <span className="flex-1">All Sprints</span>
            {!activeSprint && <span className="text-indigo-500 text-[10px]">✓</span>}
          </div>
          {sprints.length > 0 && <div className="border-t border-gray-100 my-1" />}
          {sprints.length === 0
            ? <div className="px-3 py-3 text-[11px] text-gray-400 text-center">No sprints yet</div>
            : sprints.map(s => {
              const st = getSprintStatus(s);
              return (
                <div key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition group/spr ${activeSprint?.id === s.id ? "bg-purple-50" : "hover:bg-gray-50"}`}
                  onClick={() => { onSelect(s); setOpen(false); }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.color }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${activeSprint?.id === s.id ? "text-purple-700 font-semibold" : "text-gray-700"}`}>{s.name}</p>
                    {(s.startDate || s.endDate) && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.startDate || "?"} → {s.endDate || "?"}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  {activeSprint?.id === s.id && <span className="text-purple-500 text-[10px] shrink-0">✓</span>}
                  <div className="flex gap-0.5 opacity-0 group-hover/spr:opacity-100 shrink-0">
                    {onEdit && (
                      <button onClick={e => { e.stopPropagation(); onEdit(s); setOpen(false); }}
                        className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition text-[10px]">✏️</button>
                    )}
                    <button onClick={e => { e.stopPropagation(); onDelete(s); setOpen(false); }}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition text-[11px]">✕</button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function calculateAutoHours(task: Task): number {
  if (!task.assignedDate) return task.estimatedHours || 0;

  const start = new Date(task.assignedDate).getTime();
  if (isNaN(start)) return task.estimatedHours || 0;

  // Use completedAtISO string for completed tasks, otherwise use now
  const endStr = (task as any).completedAtISO ||
    (typeof (task as any).completedAt === "string" ? (task as any).completedAt : null);
  const end = endStr ? new Date(endStr).getTime() : Date.now();

  if (isNaN(end) || end <= start) return task.estimatedHours || 0;

  const diffHours = (end - start) / (1000 * 60 * 60);

  // Safety cap: max 2x estimated hours to prevent stale data blowup
  const cap = (task.estimatedHours || 0) * 2;
  if (cap > 0 && diffHours > cap) return cap;

  return Math.round(diffHours * 10) / 10;
}

/* ═══════════════════════════════════════════
   ADMIN DAILY SHEET
═══════════════════════════════════════════ */
function AdminDailySheet({ user, users, projects }: { user:any; users:any[]; projects:any[] }) {
  const currentMonth = new Date().toISOString().slice(0,7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [sheetView, setSheetView] = useState<"table"|"byuser"|"calendar">("table");

  useEffect(() => {
    const parsedYear  = parseInt(viewMonth.split("-")[0], 10);
    const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1;
    const daysInMonth = getDaysInMonth(parsedYear, parsedMonth);
    const start = `${viewMonth}-01`;
    const end = `${viewMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const q = query(collection(db, "dailyEntries"), where("date",">=",start), where("date","<=",end), orderBy("date","asc"));
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyEntry))));
  }, [viewMonth]);

  const parsedYear  = parseInt(viewMonth.split("-")[0], 10);
  const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1;
  const monthName = new Date(parsedYear, parsedMonth, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const prevMonth = () => { const d = new Date(parsedYear, parsedMonth-1, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const nextMonth = () => { const d = new Date(parsedYear, parsedMonth+1, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

  const filtered = entries.filter(e => {
    if (selectedUser!=="all" && e.userId!==selectedUser) return false;
    if (selectedProject!=="all" && !e.tasks.some(t=>t.projectId===selectedProject)) return false;
    return true;
  });
  const allRows = filtered.flatMap(e =>
    (e.tasks || []).map(t => ({ ...t, date: e.date, userName: e.userName, userId: e.userId, entryStatus: e.status }))
  );
  const totalHours = filtered.reduce((s, e) => s + (e.totalHours || 0), 0);
  const submittedDays = entries.filter(e=>e.status==="submitted").length;
  const uniqueEmps = [...new Set(entries.map(e=>e.userId))].length;

  const userSummary: UserSummaryItem[] = users.map((u:any) => {
    const ue = entries.filter(e=>e.userId===u.uid);
    const totalH = ue.reduce((s,e)=>s+e.totalHours,0);
    const days = ue.filter(e=>e.status==="submitted").length;
    const allTasks = ue.flatMap(e => e.tasks || []);
    const byProject = allTasks.reduce((acc: Record<string, number>, t) => { const key = t?.projectName || "Unknown"; acc[key] = (acc[key] || 0) + (t?.hoursWorked || 0); return acc; }, {});
    const byStatus = allTasks.reduce((acc: Record<string, number>, t) => { const key = t?.workStatus || "Unknown"; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    return { user:u, totalH, days, byProject, byStatus };
  }).filter((x:UserSummaryItem)=>x.totalH>0||x.days>0);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">←</button>
          <span className="px-3 text-sm font-bold text-gray-800">{monthName}</span>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">→</button>
        </div>
        <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          <option value="all">All Employees</option>
          {users.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}
        </select>
        <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          <option value="all">All Projects</option>
          {projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-xl overflow-hidden ml-auto">
          {(["table","byuser","calendar"] as const).map(m=>{
            const labels: Record<string,string> = { table:"📋 Table", byuser:"👥 By User", calendar:"📅 Calendar" };
            return <button key={m} onClick={()=>setSheetView(m)} className={`px-4 py-2 text-xs font-bold transition ${sheetView===m?"bg-indigo-600 text-white":"text-gray-500 hover:text-gray-700"}`}>{labels[m]}</button>;
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:"Total Hours",val:`${totalHours}h`,color:"#6366f1"},
          {label:"Days Submitted",val:submittedDays,color:"#16a34a"},
          {label:"Active Employees",val:uniqueEmps,color:"#f59e0b"},
          {label:"Avg Hrs / Day",val:`${submittedDays?(totalHours/submittedDays).toFixed(1):0}h`,color:"#ec4899"},
        ].map(s=>(
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-3xl font-black" style={{color:s.color}}>{s.val}</p>
          </div>
        ))}
      </div>
      {sheetView==="table" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Date","Employee","Project","Task","Category","Status","Hours"].map(h=>(
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.length===0
                  ? <tr><td colSpan={7} className="py-16 text-center text-gray-300"><div className="text-4xl mb-2">📋</div><p className="text-sm">No entries for {monthName}</p></td></tr>
                  : allRows.map((row,i)=>{
                    const sc = DAILY_STATUS_COLORS[row.workStatus];
                    const d = new Date(row.date+"T12:00:00");
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 transition">
                        <td className="px-5 py-3.5"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full shrink-0 ${row.entryStatus==="submitted"?"bg-green-400":"bg-yellow-400"}`} /><p className="text-sm font-semibold text-gray-800">{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</p></div></td>
                        <td className="px-5 py-3.5"><div className="flex items-center gap-2"><Avatar name={row.userName} size="xs" /><span className="text-sm font-semibold text-gray-700">{row.userName}</span></div></td>
                        <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">{row.projectName}</span></td>
                        <td className="px-5 py-3.5"><p className="text-sm font-semibold text-gray-800">{row.taskTitle}</p>{row.description&&<p className="text-xs text-gray-400 max-w-xs truncate">{row.description}</p>}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">{row.category}</td>
                        <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{background:sc?.bg,color:sc?.color}}>{row.workStatus}</span></td>
                        <td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{row.hoursWorked}h</td>
                      </tr>
                    );
                  })}
              </tbody>
              {allRows.length>0&&(<tfoot><tr className="border-t border-gray-100 bg-gray-50"><td colSpan={6} className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">Total for {monthName}</td><td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{totalHours}h</td></tr></tfoot>)}
            </table>
          </div>
        </div>
      )}
      {sheetView==="byuser" && (
        <div className="space-y-4">
          {userSummary.length===0
            ? <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl text-gray-300"><div className="text-4xl mb-2">👥</div><p className="text-sm">No submissions this month</p></div>
            : userSummary.map(({user:u,totalH,days,byProject,byStatus}:UserSummaryItem)=>(
            <div key={u.uid} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-5 border-b border-gray-50">
                <Avatar name={u.email} size="md" />
                <div className="flex-1"><p className="font-black text-gray-900">{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                <div className="flex gap-6">
                  <div className="text-center"><p className="text-3xl font-black text-indigo-600">{totalH}h</p><p className="text-xs text-gray-400">Total Hours</p></div>
                  <div className="text-center"><p className="text-3xl font-black text-green-600">{days}</p><p className="text-xs text-gray-400">Days Logged</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-50">
                <div className="p-4"><p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">By Project</p><div className="space-y-2">{Object.entries(byProject).map(([proj,hrs])=>(<div key={proj} className="flex items-center gap-3"><span className="text-xs font-semibold text-indigo-600 flex-1 truncate">{proj}</span><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-indigo-500" style={{width:`${(hrs/totalH)*100}%`}} /></div><span className="text-xs font-black text-indigo-600 w-8 text-right">{hrs}h</span></div>))}</div></div>
                <div className="p-4"><p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">By Status</p><div className="space-y-2">{Object.entries(byStatus).map(([status,cnt])=>{ const sc=DAILY_STATUS_COLORS[status]; return <div key={status} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:sc?.dot}} /><span className="text-xs text-gray-500 flex-1">{status}</span><span className="text-sm font-black" style={{color:sc?.color}}>{cnt}</span></div>; })}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {sheetView==="calendar" && (
        <AdminCalendar entries={entries} viewMonth={viewMonth} year={parsedYear} month={parsedMonth} />
      )}
    </div>
  );
}

function AdminCalendar({ entries, viewMonth, year, month }: { entries: DailyEntry[]; viewMonth: string; year: number; month: number }) {
  const [popupDate, setPopupDate] = useState<string|null>(null);
  const todayStr = new Date().toISOString().split("T")[0];
  const popupEntries = popupDate ? entries.filter(e=>e.date===popupDate) : [];
  return (
    <>
      {popupDate&&popupEntries.length>0&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={()=>setPopupDate(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div><p className="font-black text-gray-900 text-base">{new Date(popupDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p><div className="flex items-center gap-3 mt-1"><span className="text-sm font-black text-indigo-600">{popupEntries.reduce((s,e)=>s+e.totalHours,0)}h total</span><span className="text-xs text-gray-400">{popupEntries.length} employee{popupEntries.length!==1?"s":""}</span></div></div>
              <button onClick={()=>setPopupDate(null)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">{popupEntries.map(entry=>(<div key={entry.id} className="p-5"><div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">{entry.userName[0]?.toUpperCase()}</div><div className="flex-1"><p className="font-bold text-gray-900 text-sm">{entry.userName}</p><p className="text-xs text-gray-400">{entry.userEmail}</p></div><div className="flex items-center gap-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${entry.status==="submitted"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{entry.status==="submitted"?"✅ Submitted":"📝 Draft"}</span><span className="text-xl font-black text-indigo-600">{entry.totalHours}h</span></div></div></div>))}</div>
          </div>
        </div>
      )}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-100">{WEEKDAYS.map(d=><div key={d} className="py-3 text-center text-xs font-black text-gray-400 uppercase tracking-widest border-r border-gray-50 last:border-r-0">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {Array(getFirstDayOfMonth(year,month)).fill(null).map((_,i)=><div key={`e${i}`} className="h-28 border-r border-b border-gray-50" />)}
          {Array(getDaysInMonth(year,month)).fill(null).map((_,i)=>{
            const day=i+1; const dateStr=`${viewMonth}-${day.toString().padStart(2,"0")}`;
            const dayEntries=entries.filter(e=>e.date===dateStr);
            const totalDayH=dayEntries.reduce((s,e)=>s+e.totalHours,0);
            const isToday=dateStr===todayStr; const hasData=dayEntries.length>0;
            return (
              <div key={dateStr} onClick={()=>hasData&&setPopupDate(dateStr)}
                className={`h-28 border-r border-b border-gray-50 p-2 flex flex-col transition-all ${isToday?"bg-indigo-50/40":""} ${hasData?"cursor-pointer hover:bg-gray-50":""}`}>
                <div className="flex items-center justify-between mb-1"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${isToday?"bg-indigo-600 text-white":"text-gray-400"}`}>{day}</div>{hasData&&<span className="text-[10px] font-black text-indigo-500">{totalDayH}h</span>}</div>
                {hasData&&(<div className="flex-1 overflow-hidden space-y-0.5"><div className="text-[10px] font-bold text-gray-400">{dayEntries.length} emp</div>{dayEntries.slice(0,3).map(e=>(<div key={e.id} className="flex items-center gap-1 min-w-0"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.status==="submitted"?"bg-green-400":"bg-yellow-400"}`} /><span className="text-[9px] text-gray-500 truncate font-medium">{e.userName}</span><span className="text-[9px] font-black text-indigo-400 shrink-0">{e.totalHours}h</span></div>))}{dayEntries.length>3&&<p className="text-[9px] font-bold text-indigo-400">+{dayEntries.length-3} more</p>}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function AdminProjectManagement({ user, projects, users }: { user: any; projects: any[]; users: any[] }) {
  const [activeProject, setActiveProject] = useState<Project|null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint|null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const doneColId =
  columns.find(c => c.label.toLowerCase().includes("done"))?.id || "done";
  const [allProjectTasks, setAllProjectTasks] = useState<Task[]>([]);

  useEffect(() => {
  const q = query(collection(db, "projectTasks"));
  return onSnapshot(q, snap => {
    setAllProjectTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
  });
}, []);



  // ─── View & filter state ───
  const [viewMode, setViewMode] = useState<"dashboard"|"kanban"|"list"|"timeline"|"workload"|"reports"|"gantt"|"sprint_reports">("kanban");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  // ─── Modal state ───
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project|null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [quickTaskStoryId, setQuickTaskStoryId] = useState<string|undefined>();
  const [quickTaskType, setQuickTaskType] = useState<string|undefined>();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const handleTaskClick = (t: Task) => {
  setActiveTask(t);
};

  // ─── Sprint modal state ───
  const [showSprintFormModal, setShowSprintFormModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<SprintFull | null>(null);

  // ─── Move to sprint state ───
  const [showMoveToSprint, setShowMoveToSprint] = useState(false);
  const [moveToSprintTask, setMoveToSprintTask] = useState<Task | null>(null);

  // ─── Milestone form ───
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [mf, setMf] = useState({ title:"", dueDate:"" });

  // ─── Task detail tab ───
  const [taskDetailTab, setTaskDetailTab] = useState<"details"|"subtasks"|"files"|"images"|"links"|"deps"|"comments"|"logs"|"empsheet"|"history">("details");

  // ─── Other UI state ───
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [projectsView, setProjectsView] = useState<"grid"|"list">("grid");
  const [mainTab, setMainTab] = useState<"projects"|"dailysheet">("projects");
  const [workDesc, setWorkDesc] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [workStatus, setWorkStatus] = useState<"done" | "progress" | "blocked">("done");

  const [quickFilter, setQuickFilter] = useState<QuickFilterState>(EMPTY_FILTER);

  // ─── Project form state ───
  const [pf, setPf] = useState({
    name:"", clientName:"", description:"",
    projectType:"Billing" as "Billing"|"Non-Billing",
    billingType:"Hourly" as "Hourly"|"Fixed Cost"|"Internal",
    startDate:"", endDate:"",
    selectedManagers:[] as string[],
    budget:"",
    priority:"Medium" as "Low"|"Medium"|"High"|"Critical",
    status:"Planning" as Project["status"],
    selectedMembers:[] as string[], color:PROJECT_COLORS[0]
  });

  const projectPMs = activeProject ? getProjectManagers(activeProject) : [];
  const isProjectManager = projectPMs.includes(user.uid);
  const canManage = isProjectManager || activeProject?.createdBy === user.uid;
  const stories = tasks.filter(t => t.ticketType === "story");

  /* ── Firestore listeners ── */
  useEffect(() => {
    if (!activeProject?.id) return;
    const q = query(collection(db, "projectColumns"), where("projectId", "==", activeProject.id));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setColumns(Array.isArray(data.columns) && data.columns.length > 0 ? data.columns : DEFAULT_COLUMNS);
      } else {
        setColumns(DEFAULT_COLUMNS);
      }
    });
  }, [activeProject?.id]);

  useEffect(() => {
    if (!activeProject) return;
    const tq = activeSprint
      ? query(collection(db,"projectTasks"), where("projectId","==",activeProject.id), where("sprintId","==",activeSprint.id))
      : query(collection(db,"projectTasks"), where("projectId","==",activeProject.id));
    const u1=onSnapshot(tq, s=>setTasks(s.docs.map(d=>({id:d.id,...d.data()} as Task))));
    const u2=onSnapshot(query(collection(db,"sprints"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setSprints(s.docs.map(d=>({id:d.id,...d.data()} as Sprint))));
    const u3=onSnapshot(query(collection(db,"projectActivities"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setActivities(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(query(collection(db,"workLogs"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setWorkLogs(s.docs.map(d=>({id:d.id,...d.data()} as WorkLog))));
    const u5=onSnapshot(query(collection(db,"milestones"),where("projectId","==",activeProject.id)),s=>setMilestones(s.docs.map(d=>({id:d.id,...d.data()} as Milestone))));
    const initColumns = async () => {
      const colQ = query(collection(db, "projectColumns"), where("projectId", "==", activeProject.id));
      const colSnap = await getDocs(colQ);
      if (colSnap.empty) await addDoc(collection(db, "projectColumns"), { projectId: activeProject.id, columns: DEFAULT_COLUMNS, updatedAt: serverTimestamp() });
    };
    initColumns();
    return ()=>{ u1(); u2(); u3(); u4(); u5(); };
  },[activeProject,activeSprint]);

  useEffect(() => {
    if (!activeTask) return;
    const u1=onSnapshot(query(collection(db,"taskComments"),where("taskId","==",activeTask.id),orderBy("createdAt","asc")),s=>setComments(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(query(collection(db,"taskFiles"),where("taskId","==",activeTask.id),orderBy("createdAt","desc")),s=>setTaskFiles(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(query(collection(db,"subtasks"),where("taskId","==",activeTask.id)),s=>setSubtasks(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{ u1(); u2(); u3(); };
  },[activeTask]);

  useEffect(() => {
    if (!activeTask) return;
    const q = query(collection(db,"workLogs"), where("taskId","==",activeTask.id));
    return onSnapshot(q, (snap) => setWorkLogs(snap.docs.map(doc => ({id:doc.id,...doc.data()} as WorkLog))));
  }, [activeTask]);

  /* ── Helpers ── */
  const sendNotification = async (userId:string,type:string,title:string,message:string,projectId?:string,taskId?:string) => {
    await addDoc(collection(db,"notifications"),{userId,type,title,message,projectId:projectId??null,taskId:taskId??null,read:false,createdAt:serverTimestamp()});
  };

  // Updated logActivity — writes to BOTH collections
  const logActivity = async (projectId:string,action:string,description:string,taskId?:string) => {
    await addDoc(collection(db,"projectActivities"),{projectId,userId:user.uid,userName:user.email?.split("@")[0]??"",action,description,taskId:taskId??null,createdAt:serverTimestamp()});
    await addDoc(collection(db,"activityLogs"),{projectId,taskId:taskId??null,userId:user.uid,userName:user.email?.split("@")[0]??"",action:action.replace(/ /g,"_"),description,createdAt:serverTimestamp()});
  };

  const handleSaveColumns = async (cols: KanbanColumn[]) => {
    if (!activeProject?.id) return;
    setColumns(cols);
    const q = query(collection(db,"projectColumns"), where("projectId","==",activeProject.id));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(doc(db,"projectColumns",snap.docs[0].id), { columns: cols, updatedAt: serverTimestamp() });
    else await addDoc(collection(db,"projectColumns"), { projectId: activeProject.id, columns: cols, updatedAt: serverTimestamp() });
  };

  const handleSaveProject = async () => {
    if (!pf.name.trim()) return;
    const pms = [...new Set([user.uid, ...pf.selectedManagers])];
    const members = [...new Set([user.uid, ...pms, ...pf.selectedMembers])];
    const data = { name:pf.name, clientName:pf.clientName, description:pf.description, projectType:pf.projectType, billingType:pf.billingType, startDate:pf.startDate, endDate:pf.endDate, projectManagers:pms, projectManager:pms[0]||user.uid, members, budget:pf.budget?Number(pf.budget):null, priority:pf.priority, status:pf.status, progress:0, color:pf.color };
    if (editingProject) {
      await updateDoc(doc(db,"projects",editingProject.id), data);
      const newM=members.filter((m:string)=>!editingProject.members.includes(m));
      for (const m of newM) await sendNotification(m,"project_added","Added to Project",`You've been added to "${pf.name}"`,editingProject.id);
      await logActivity(editingProject.id,"updated project",`Updated "${pf.name}"`);
    } else {
      const r=await addDoc(collection(db,"projects"),{...data,columns:DEFAULT_COLUMNS,createdBy:user.uid,createdAt:serverTimestamp()});
      for (const m of members.filter((m:string)=>m!==user.uid)) await sendNotification(m,"project_added","Added to Project",`You've been added to "${pf.name}"`,r.id);
      await logActivity(r.id,"created project",`Created "${pf.name}"`);
    }
    setShowProjectForm(false); setEditingProject(null);
    setPf({name:"",clientName:"",description:"",projectType:"Billing",billingType:"Hourly",startDate:"",endDate:"",selectedManagers:[],budget:"",priority:"Medium",status:"Planning",selectedMembers:[],color:PROJECT_COLORS[0]});
  };

  const handleDeleteProject = async (id:string) => {
    if (!confirm("Delete this project?")) return;
    await deleteDoc(doc(db,"projects",id));
  };

  const handleEditProject = (p:Project) => {
    setEditingProject(p);
    const pms = getProjectManagers(p).filter(m => m !== user.uid);
    setPf({ name:p.name, clientName:p.clientName||"", description:p.description||"", projectType:p.projectType, billingType:p.billingType||"Hourly", startDate:p.startDate||"", endDate:p.endDate||"", selectedManagers:pms, budget:p.budget?.toString()||"", priority:p.priority, status:p.status, selectedMembers:p.members.filter((m:string)=>m!==user.uid && !getProjectManagers(p).includes(m)), color:p.color||PROJECT_COLORS[0] });
    setShowProjectForm(true);
  };

  const handleKanbanCreateTask = (storyId: string, type: string) => {
    setQuickTaskStoryId(storyId); setQuickTaskType(type); setShowTaskModal(true);
  };

  const handleTaskSubmit = async (data: any) => {
    if (!activeProject) return;
   if (editingTask) {
  // Resolve assignedToName from assignedTo uid
  const assignedUser = data.assignedTo
    ? users.find((u: any) => u.uid === data.assignedTo)
    : null;
  const assignedToName = assignedUser
  ? (assignedUser.displayName?.trim() || assignedUser.name?.trim() || null)
  : null;

  const updatedData: any = {
    ...data,
    assignedTo: data.assignedTo || null,
    assignedToName: assignedToName || null,
  };

  // Remove undefined values to avoid Firestore errors
  Object.keys(updatedData).forEach(key => {
    if (updatedData[key] === undefined) {
      delete updatedData[key];
    }
  });

  await updateDoc(doc(db, "projectTasks", editingTask.id), updatedData);

  // Update local tasks list so kanban reflects immediately
  setTasks(prev =>
    prev.map(t => t.id === editingTask.id ? { ...t, ...updatedData } : t)
  );

  // If task detail panel is open for this task, update it too
  if (activeTask?.id === editingTask.id) {
    setActiveTask(prev => prev ? { ...prev, ...updatedData } : prev);
  }

  // Send notification if assignee changed
  if (
    data.assignedTo &&
    data.assignedTo !== editingTask.assignedTo &&
    activeProject
  ) {
    await sendNotification(
      data.assignedTo,
      "task_assigned",
      "Task Assigned",
      `"${data.title}" was assigned to you in ${activeProject.name}`,
      activeProject.id,
      editingTask.id
    );
  }

  await logActivity(activeProject.id, "updated task", `Updated "${data.title}"`, editingTask.id);
} else {
      const snapshot = await getDocs(query(collection(db,"projectTasks"), where("projectId","==",activeProject.id)));
      const count = snapshot.size + 1;
      const taskCode = `TSK-${count.toString().padStart(3,"0")}`;
      const cleanData: any = {
  ...data,
  taskCode,
  projectId: activeProject.id,
  sprintId: activeSprint?.id || null,
  assignedDate: data.assignedTo ? new Date().toISOString() : null,
  createdBy: user.uid,
  createdAt: serverTimestamp(),
};

// 🔥 REMOVE undefined values
Object.keys(cleanData).forEach(key => {
  if (cleanData[key] === undefined) {
    delete cleanData[key];
  }
});

const taskRef = await addDoc(collection(db,"projectTasks"), cleanData);
      if (data.assignedTo) await sendNotification(data.assignedTo,"task_assigned","Task Assigned",`"${data.title}" assigned in ${activeProject.name}`,activeProject.id,taskRef.id);
      await logActivity(activeProject.id,"created task",`Created "${data.title}"`,taskRef.id);
    }
    setShowTaskModal(false); setEditingTask(null);
    setQuickTaskStoryId(undefined); setQuickTaskType(undefined);
  };

  const handleDeleteTask = async (taskId:string) => {
    if (!confirm("Delete this task?")) return;
    await deleteDoc(doc(db,"projectTasks",taskId));
    await logActivity(activeProject!.id,"deleted task",`Deleted task`,taskId);
    setActiveTask(null);
  };

const handleAssignTask = async (taskId: string, userId: string) => {
  const au = users.find((u: any) => u.uid === userId);
  const assignedToName = au
  ? (au.displayName?.trim() || au.name?.trim() || null)
  : null;

  // ✅ Save BOTH assignedTo and assignedToName
  await updateDoc(doc(db, "projectTasks", taskId), {
    assignedTo: userId || null,
    assignedToName: assignedToName,
    assignedDate: userId ? new Date().toISOString() : null,
  });

  // ✅ Update local state immediately so UI reflects change
  setTasks(prev =>
    prev.map(t => t.id === taskId ? { ...t, assignedTo: userId || null, assignedToName } : t)
  );
  if (activeTask?.id === taskId) {
    setActiveTask(prev => prev ? { ...prev, assignedTo: userId || null, assignedToName } : prev);
  }

  if (userId && activeProject) {
    await sendNotification(userId, "task_assigned", "Task Assigned", `A task was assigned in ${activeProject.name}`, activeProject.id, taskId);
  }
  await logActivity(activeProject!.id, "assigned task", `Assigned to ${assignedToName || "user"}`, taskId);
};
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
  if (newStatus === "__DELETE__") { await deleteDoc(doc(db, "projectTasks", taskId)); return; }
  const oldTask = tasks.find(t => t.id === taskId);
  if (!oldTask) return;

  // ✅ FIXED: use oldTask not task
  const isAdmin = user?.accountType === "ADMIN";
  const isPM = activeProject ? getProjectManagers(activeProject).includes(user.uid) : false;
  const isAssignee = oldTask.assignedTo === user?.uid;
  if (!isAdmin && !isPM && !isAssignee) return;

  await updateDoc(doc(db, "projectTasks", taskId), {
    status: newStatus,
    ...(newStatus === "inprogress" ? { startedAt: serverTimestamp() } : {}),
     ...(newStatus === "done" ? {
      completedAt: serverTimestamp(),
      completedAtISO: new Date().toISOString(),
    } : {}),
  });
  await logActivity(activeProject!.id, "status_changed", `→ ${columns.find(c => c.id === newStatus)?.label || newStatus}`, taskId);
  await addDoc(collection(db, "activityLogs"), { projectId: activeProject!.id, taskId, userId: user.uid, userName: user.email?.split("@")[0] ?? "", action: "status_changed", from: { status: oldTask?.status }, to: { status: newStatus }, description: `Status changed to ${columns.find(c => c.id === newStatus)?.label || newStatus}`, createdAt: serverTimestamp() });
  const snap = await getDocs(query(collection(db, "projectTasks"), where("projectId", "==", activeProject!.id)));
  const all = snap.docs.map(d => d.data());
  const nonStory = all.filter(t => t.ticketType !== "story");
  const doneColIdLocal = columns.find(c => c.label.toLowerCase() === "done")?.id || "done";
  const progress = nonStory.length
    ? Math.round((nonStory.filter(t => t.status === doneColIdLocal).length / nonStory.length) * 100)
    : 0;
  await updateDoc(doc(db, "projects", activeProject!.id), { progress });
};  // ← closes handleTaskStatusChange

const handleDeleteSprint = async (sprint: Sprint) => {
    if (!confirm(`Delete sprint "${sprint.name}"?`)) return;
    await deleteDoc(doc(db,"sprints",sprint.id));
    if (activeSprint?.id===sprint.id) setActiveSprint(null);
    await logActivity(activeProject!.id,"deleted sprint",`Deleted sprint "${sprint.name}"`);
  };

  const handleCreateMilestone = async () => {
    if (!mf.title.trim()) return;
    await addDoc(collection(db,"milestones"),{title:mf.title,dueDate:mf.dueDate,projectId:activeProject!.id,status:"pending",createdAt:serverTimestamp()});
    setMf({title:"",dueDate:""}); setShowMilestoneForm(false);
  };

  const toggleMilestone = async (m:Milestone) => {
    await updateDoc(doc(db,"milestones",m.id),{status:m.status==="pending"?"completed":"pending"});
  };

  // ── NEW: Delete milestone ──
  const handleDeleteMilestone = async (e: React.MouseEvent, m: Milestone) => {
    e.stopPropagation(); // prevent toggling the milestone
    if (!confirm(`Delete milestone "${m.title}"?`)) return;
    await deleteDoc(doc(db,"milestones",m.id));
    await logActivity(activeProject!.id,"deleted milestone",`Deleted milestone "${m.title}"`);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db,"taskComments"),{taskId:activeTask!.id,projectId:activeProject!.id,userId:user.uid,userName:user.email?.split("@")[0],text:commentText,createdAt:serverTimestamp()});
    await logActivity(activeProject!.id,"commented",`Commented on "${activeTask!.title}"`,activeTask!.id);
    setCommentText("");
  };

  const handleFileUpload = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];
    if (!file||!activeTask||!activeProject) return;
    if (file.size>10*1024*1024) { alert("Max 10MB"); return; }
    try {
      setUploading(true);
      const sr=ref(storage,`projectFiles/${activeProject.id}/${activeTask.id}/${Date.now()}_${file.name}`);
      const snap=await uploadBytes(sr,file);
      const url=await getDownloadURL(snap.ref);
      await addDoc(collection(db,"taskFiles"),{taskId:activeTask.id,projectId:activeProject.id,fileName:file.name,fileUrl:url,uploadedBy:user.uid,uploadedByName:user.email?.split("@")[0],createdAt:serverTimestamp()});
    } catch(err:any) { alert(`Upload failed: ${err.message}`); } finally { setUploading(false); }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !canManage) return;
    await addDoc(collection(db,"subtasks"),{taskId:activeTask!.id,projectId:activeProject!.id,text:newSubtask,done:false,createdAt:serverTimestamp()});
    setNewSubtask("");
  };
  const toggleSubtask = async (st:any) => { if (!canManage) return; await updateDoc(doc(db,"subtasks",st.id),{done:!st.done}); };

  const handleAddWorkLog = async () => {
    if (!workDesc || !workHours || !activeTask || !activeProject) return;
    await addDoc(collection(db,"workLogs"),{ userId:user.uid, userName:user.displayName||user.email?.split("@")[0]||"", projectId:activeTask.projectId, projectName:activeProject.name, taskId:activeTask.id, taskName:activeTask.title, description:workDesc, hoursWorked:Number(workHours), hours:Number(workHours), workStatus:workStatus==="done"?"Completed":workStatus==="progress"?"In Progress":"Blocked", status:workStatus, date:new Date().toISOString().split("T")[0], createdAt:serverTimestamp() });
    setWorkDesc(""); setWorkHours("");
  };

  const filteredTasks = applyQuickFilter(
  tasks.filter(t => {
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterAssignee !== "all" && t.assignedTo !== filterAssignee) return false;
    if (filterType !== "all" && t.ticketType !== filterType) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.taskCode?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }),
  quickFilter,
  columns
);

  const projectMembers = activeProject ? users.filter((u:any) => activeProject.members.includes(u.uid)) : [];
  const totalHours = workLogs.reduce((s,l)=>s+(l.hoursWorked||0),0);
  const nonStoryTasks = tasks.filter(t => t.ticketType !== "story");
  const allTags = [...new Set(tasks.flatMap(t => t.tags || []))];
  const workloadData: WorkloadItem[] = projectMembers.map((u: any) => {
  const ut = nonStoryTasks.filter(t => t.assignedTo === u.uid);
  // ✅ CHANGE 3: Auto-calculate hours from assignedDate → completedAtISO (or now)
  const autoHours = Math.round(
    ut.reduce((sum, task) => sum + calculateAutoHours(task), 0) * 10
  ) / 10;

  return {
    user: u,
    total: ut.length,
    done: ut.filter(t => t.status === doneColId).length,
    inProgress: ut.filter(t => t.status !== doneColId && t.status !== "blocked").length,
    blocked: ut.filter(t => t.status === "blocked").length,
    autoHours,
  };
});
  const overdueTasks = nonStoryTasks.filter(t => t.dueDate && new Date(t.dueDate)<new Date() && t.status!==doneColId);

  /* ══════════════════════════════════════
     TASK DETAIL PANEL
  ══════════════════════════════════════ */
  const renderTaskDetailPanel = () => {
    if (!activeTask) return null;

    const moveModal = moveToSprintTask ? (
      <MoveToSprintModal
        open={showMoveToSprint}
        onClose={() => {
          setShowMoveToSprint(false);
          setMoveToSprintTask(null);
        }}
        task={moveToSprintTask}
        sprints={sprints as SprintFull[]}
        currentSprintId={moveToSprintTask.sprintId}
        onMoved={async () => {
          await logActivity(
            activeProject!.id,
            "sprint_changed",
            `Moved "${moveToSprintTask.title}" to a different sprint`,
            moveToSprintTask.id
          );
        }}
      />
    ) : null;


    const pc = PRIORITY_CONFIG[activeTask.priority];
    const tm = TYPE_META[activeTask.ticketType || "task"] || TYPE_META.task;
    const subtasksDone = subtasks.filter(s => s.done).length;
    const subtaskPct = subtasks.length ? Math.round((subtasksDone / subtasks.length) * 100) : 0;
    const parentStory = activeTask.parentStoryId ? tasks.find(t => t.id === activeTask.parentStoryId) : null;
    const col = columns.find(c => c.id === activeTask.status);
    const style = getColConfig(col || { id: activeTask.status, label: activeTask.status }, columns.findIndex(c => c.id === activeTask.status));
    const isOverdue = activeTask.dueDate && new Date(activeTask.dueDate) < new Date() && activeTask.status !== doneColId;

    const TASK_TABS: [string, string][] = [
      ["details","📋"],["subtasks","✅"],["images","🖼️"],["links","🔗"],
      ["deps","⛓️"],["files","📎"],["comments","💬"],["logs","⏱"],
      ["empsheet","📝"],["history","📜"],
    ];
    const TAB_LABELS: Record<string,string> = {
      details:"Details", subtasks:"Subtasks", images:"Images", links:"Links",
      deps:"Deps", files:"Files", comments:"Comments", logs:"Logs",
      empsheet:"My Work", history:"History",
    };

    return createPortal(
       <>
      {moveModal} 
      <div className="fixed inset-0 z-[10001] flex items-stretch" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>

        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveTask(null)} />
        <div className="relative ml-auto w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="shrink-0" style={{background:`linear-gradient(135deg,${activeProject?.color||"#6366f1"} 0%,${activeProject?.color||"#6366f1"}dd 100%)`}}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">{activeProject?.name}</span>
                  <span className="text-white/40">•</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">{tm.icon} {tm.label}</span>
                  {parentStory && (<><span className="text-white/40">→</span><button onClick={() => setActiveTask(parentStory)} className="text-xs text-white/80 hover:text-white underline underline-offset-2 transition">📘 {parentStory.title}</button></>)}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button onClick={() => { setMoveToSprintTask(activeTask); setShowMoveToSprint(true); }}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 hover:bg-purple-500/30 text-white text-xs transition">
                      🏃 Sprint
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => { setEditingTask(activeTask); setActiveTask(null); setShowTaskModal(true); }}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 hover:bg-blue-500/30 text-white text-xs transition">✏️ Edit</button>
                  )}
                  {canManage && (
                    <button onClick={() => handleDeleteTask(activeTask.id)}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-white transition text-xs">🗑️ Delete</button>
                  )}
                  <button onClick={() => setActiveTask(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">✕</button>
                </div>
              </div>
              <p className="text-xs font-bold text-white/70 tracking-wider">{activeTask?.taskCode || "—"}</p>
              <h2 className="text-xl font-bold text-white leading-snug mb-3">{activeTask.title}</h2>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverdue?"bg-red-50 text-red-600":"bg-indigo-50 text-indigo-600"}`}>{isOverdue?"⚠️ Overdue":"🕒 On Track"}</span>
                      {canManage ? (
                        <select
                          value={activeTask.status}
                          onChange={e => handleTaskStatusChange(activeTask.id, e.target.value)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          style={{ color: style.color }}
                        >
                          {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm font-semibold px-2.5 py-1 rounded-full" style={{background:style.bg,color:style.color}}>{col?.label}</span>
                      )}
                    </div>
              {activeTask.sprintId && (
                <div className="mb-2">
                  <span className="text-[10px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                    🏃 {sprints.find(s => s.id === activeTask.sprintId)?.name || "Sprint"}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {pc && <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md" style={{background:pc.bg,color:pc.color}}>{pc.icon} {activeTask.priority}</span>}
                {activeTask.tags?.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-medium">#{tag}</span>)}
                {activeTask.storyPoints && <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-medium">🎯 {activeTask.storyPoints}pt</span>}
                {(activeTask as any).blockedBy?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/80 text-white font-medium">⛔ Blocked</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-t border-white/20" style={{scrollbarWidth:"none"}}>
              {TASK_TABS.map(([t, icon]) => (
                <button key={t} onClick={() => setTaskDetailTab(t as any)}
                  className={`flex items-center gap-1 px-3 py-2.5 text-xs font-semibold transition shrink-0 ${taskDetailTab === t ? "bg-white/20 text-white border-b-2 border-white" : "text-white/60 hover:text-white/80"}`}>
                  <span>{icon}</span>
                  <span className="hidden sm:inline">{TAB_LABELS[t]}</span>
                  {t === "comments" && comments.length > 0 && <span className="ml-1 bg-white/30 text-white text-[10px] rounded-full px-1.5">{comments.length}</span>}
                  {t === "subtasks" && subtasks.length > 0 && <span className="ml-1 bg-white/30 text-white text-[10px] rounded-full px-1.5">{subtasksDone}/{subtasks.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto bg-gray-50">

            {/* ─── DETAILS ─── */}
            {taskDetailTab === "details" && (
              <div className="p-5 space-y-4">
                {activeTask.description && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{activeTask.description}</p>
                  </div>
                )}
                {activeTask.ticketType === "story" && (
                  <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Story Children</p>
                    <div className="space-y-1">
                      {tasks.filter(t => t.parentStoryId === activeTask.id).map(child => {
                        const ctm = TYPE_META[child.ticketType || "task"];
                        return (<button key={child.id} onClick={() => setActiveTask(child)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-100 transition text-left"><span>{ctm.icon}</span><span className="text-xs font-medium text-indigo-800 flex-1">{child.title}</span><span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"white",color:ctm.color}}>{child.status}</span></button>);
                      })}
                      {tasks.filter(t => t.parentStoryId === activeTask.id).length === 0 && (<p className="text-xs text-indigo-400">No children yet.</p>)}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:"Status", content:(
                      activeTask.ticketType==="story"
                        ? <div className="text-xs font-bold px-2 py-1.5 text-indigo-700 bg-indigo-50 rounded-lg">Story (auto)</div>
                        : canManage
                          ? <select value={activeTask.status} onChange={async e => { await handleTaskStatusChange(activeTask.id, e.target.value); setActiveTask({...activeTask,status:e.target.value}); }} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
                          : <div className="text-xs font-semibold text-gray-700 px-2 py-1.5">{columns.find(c=>c.id===activeTask.status)?.label||activeTask.status}</div>
                    )},
                    { label:"Assignee", content:(
                      canManage
                        ? <select value={activeTask.assignedTo||""} onChange={e=>handleAssignTask(activeTask.id,e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"><option value="">Unassigned</option>{users.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}</select>
                        : <div className="flex items-center gap-2 px-2 py-1"><Avatar name={activeTask.assignedToName||"?"} size="xs" /><span className="text-xs text-gray-700">{activeTask.assignedToName||"Unassigned"}</span></div>
                    )},
                    { label:"Priority", content:(
                      canManage
                        ? <select value={activeTask.priority} onChange={async e=>{ await updateDoc(doc(db,"projectTasks",activeTask.id),{priority:e.target.value}); setActiveTask({...activeTask,priority:e.target.value as any}); }} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select>
                        : <div className="text-xs font-semibold px-2 py-1.5" style={{color:PRIORITY_CONFIG[activeTask.priority]?.color}}>{activeTask.priority}</div>
                    )},
                    { label:"Due Date", content:(
                      canManage
                        ? <input type="date" defaultValue={activeTask.dueDate?.split("T")[0]||""} onChange={async e=>{ await updateDoc(doc(db,"projectTasks",activeTask.id),{dueDate:e.target.value}); }} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                        : <div className="text-xs text-gray-700 px-2 py-1.5">{activeTask.dueDate||"—"}</div>
                    )},
                  ].map(({label,content})=>(
                    <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">{label}</p>
                      {content}
                    </div>
                  ))}
                </div>
                {activeTask.ticketType !== "story" && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Time Tracking</h3>
                    <div className="flex items-center gap-4">
                      <ProgressRing pct={activeTask.estimatedHours ? Math.min(((activeTask.actualHours||0)/activeTask.estimatedHours)*100,100) : 0} color={activeProject?.color||"#6366f1"} />
                      <div className="flex-1">
                        <div className="grid grid-cols-3 gap-2 text-center mb-2">
                          <div><p className="text-lg font-black text-gray-900">{activeTask.estimatedHours||0}h</p><p className="text-xs text-gray-400">Estimated</p></div>
                          <div><p className="text-lg font-black text-gray-900">{activeTask.actualHours||0}h</p><p className="text-xs text-gray-400">Logged</p></div>
                          <div><p className="text-lg font-black" style={{color:activeProject?.color||"#6366f1"}}>{activeTask.storyPoints||0}</p><p className="text-xs text-gray-400">Points</p></div>
                        </div>
                        {canManage && (
                          <div className="flex gap-3">
                            <div className="flex-1"><label className="text-xs text-gray-400">Est. Hours</label><input type="number" defaultValue={activeTask.estimatedHours||""} onChange={async e=>{ await updateDoc(doc(db,"projectTasks",activeTask.id),{estimatedHours:Number(e.target.value)}); }} className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" /></div>
                            <div className="flex-1"><label className="text-xs text-gray-400">Actual Hours</label><input type="number" defaultValue={activeTask.actualHours||""} onChange={async e=>{ await updateDoc(doc(db,"projectTasks",activeTask.id),{actualHours:Number(e.target.value)}); }} className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── SUBTASKS ─── */}
            {taskDetailTab === "subtasks" && (
              <div className="p-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
                    <div className="flex items-center gap-2"><div className="w-24 bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full transition-all" style={{width:`${subtaskPct}%`,background:activeProject?.color||"#6366f1"}} /></div><span className="text-xs font-bold text-gray-500">{subtasksDone}/{subtasks.length}</span></div>
                  </div>
                  {!canManage && <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">👁️ View-only access.</div>}
                  <div className="space-y-2 mb-3">
                    {subtasks.map((st:any)=>(
                      <div key={st.id} onClick={()=>canManage&&toggleSubtask(st)} className={`flex items-center gap-3 p-2.5 rounded-lg transition hover:bg-gray-50 ${st.done?"opacity-60":""} ${canManage?"cursor-pointer":""}`}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 transition" style={{background:st.done?(activeProject?.color||"#6366f1"):"transparent",borderColor:st.done?(activeProject?.color||"#6366f1"):"#d1d5db"}}>
                          {st.done&&<span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <span className={`text-sm ${st.done?"line-through text-gray-400":"text-gray-700"}`}>{st.text}</span>
                      </div>
                    ))}
                    {subtasks.length===0&&<p className="text-xs text-gray-400 text-center py-4">No subtasks yet</p>}
                  </div>
                  {canManage&&(<div className="flex gap-2"><input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} placeholder="Add a subtask..." onKeyDown={e=>e.key==="Enter"&&handleAddSubtask()} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none" /><button onClick={handleAddSubtask} className="inline-flex items-center px-3 py-2 text-white text-xs font-semibold rounded-lg" style={{background:activeProject?.color||"#6366f1"}}>Add</button></div>)}
                </div>
              </div>
            )}

            {/* ─── IMAGES ─── */}
            {taskDetailTab === "images" && (
              <div className="p-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <TaskImages
                    taskId={activeTask.id}
                    projectId={activeProject!.id}
                    images={(activeTask as any).images || []}
                    canManage={canManage}
                    projectColor={activeProject?.color || "#6366f1"}
                  />
                </div>
              </div>
            )}

            {/* ─── LINKS ─── */}
            {taskDetailTab === "links" && (
              <div className="p-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <TaskLinks
                    taskId={activeTask.id}
                    links={(activeTask as any).links || []}
                    canManage={canManage}
                    projectColor={activeProject?.color || "#6366f1"}
                  />
                </div>
              </div>
            )}

            {/* ─── DEPENDENCIES ─── */}
            {taskDetailTab === "deps" && (
              <div className="p-5">
                <TaskDependencies
                  task={activeTask as any}
                  allTasks={tasks.filter(t => t.ticketType !== "story")}
                  canManage={canManage}
                  onTaskClick={setActiveTask}
                  projectColor={activeProject?.color || "#6366f1"}
                />
              </div>
            )}

            {/* ─── FILES ─── */}
            {taskDetailTab === "files" && (
              <div className="p-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Attachments ({taskFiles.length})</h3>
                    {canManage&&(<label className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer ${uploading?"opacity-50":""}`} style={{background:activeProject?.color||"#6366f1"}}>{uploading?"⏳ Uploading...":"📤 Upload"}<input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} /></label>)}
                  </div>
                  {taskFiles.length===0
                    ? <div className="text-center py-8 text-gray-400"><div className="text-4xl mb-2">📁</div><p className="text-sm">No files attached yet</p></div>
                    : <div className="space-y-2">{taskFiles.map((f:any)=>(<a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition"><div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">{f.fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)?"🖼️":f.fileName.match(/\.pdf$/i)?"📕":"📄"}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{f.fileName}</p><p className="text-xs text-gray-400">by {f.uploadedByName}</p></div><span className="text-gray-300 text-sm">↗</span></a>))}</div>}
                </div>
              </div>
            )}

            {/* ─── COMMENTS ─── */}
            {taskDetailTab === "comments" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                  {comments.map((c:any)=>(
                    <div key={c.id} className={`flex gap-3 ${c.userId===user.uid?"flex-row-reverse":""}`}>
                      <Avatar name={c.userName} size="sm" />
                      <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${c.userId===user.uid?"rounded-tr-sm text-white":"rounded-tl-sm bg-white border border-gray-100"}`} style={c.userId===user.uid?{background:activeProject?.color||"#6366f1"}:{}}>
                        <p className={`text-xs font-semibold mb-1 ${c.userId===user.uid?"text-white/70":"text-gray-500"}`}>{c.userName} · {c.createdAt?.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>
                        <p className={`text-sm leading-relaxed ${c.userId===user.uid?"text-white":"text-gray-700"}`}>{c.text}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length===0&&(<div className="text-center py-12 text-gray-400"><div className="text-5xl mb-3">💬</div><p className="text-sm font-medium">Start the conversation</p></div>)}
                </div>
                <div className="shrink-0 px-5 py-4 bg-white border-t border-gray-100">
                  <div className="flex gap-2">
                    <Avatar name={user?.email?.split("@")[0]} size="sm" />
                    <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Write a comment..." onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&handleAddComment()} className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
                    <button onClick={handleAddComment} disabled={!commentText.trim()} className="inline-flex items-center px-4 py-2 text-white text-xs font-semibold rounded-xl disabled:opacity-40" style={{background:activeProject?.color||"#6366f1"}}>Send</button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── LOGS ─── */}
            {taskDetailTab === "logs" && (
              <div className="p-5 space-y-3">
                {workLogs.filter(l=>l.taskId===activeTask.id).length===0
                  ? <div className="text-center py-12 text-gray-400"><div className="text-5xl mb-3">⏱</div><p className="text-sm">No work logged yet</p></div>
                  : workLogs.filter(l=>l.taskId===activeTask.id).map(log=>(
                    <div key={log.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm text-gray-800">{log.userName}</span><span className="font-black text-lg" style={{color:activeProject?.color||"#6366f1"}}>{log.hoursWorked}h</span></div>
                      <p className="text-sm text-gray-600">{log.description}</p>
                      <div className="flex items-center gap-3 mt-2"><span className="text-xs text-gray-400">{log.date}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.workStatus==="Completed"?"bg-green-100 text-green-700":log.workStatus==="Blocked"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{log.workStatus}</span></div>
                    </div>
                  ))}
              </div>
            )}

            {/* ─── MY WORK ─── */}
            {taskDetailTab === "empsheet" && (
              <div className="p-5 space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#534AB7" strokeWidth="1.2" /><path d="M5 6h6M5 9h4" stroke="#534AB7" strokeWidth="1.2" strokeLinecap="round" /></svg><span className="text-sm font-medium text-gray-800">Add daily work</span></div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">What did you work on?</label>
                  <textarea placeholder="Describe what you completed today…" className="w-full min-h-18 resize-y text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors" value={workDesc} onChange={e=>setWorkDesc(e.target.value)} />
                  <div className="flex gap-3 mt-3">
                    <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hours</label><input type="text" placeholder="e.g. 2.5" className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 focus:outline-none" value={workHours} onChange={e=>setWorkHours(e.target.value)} /></div>
                    <div className="flex flex-col gap-1.5 flex-1"><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label><div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">{(["done","progress","blocked"] as const).map((s,i)=>(<button key={s} onClick={()=>setWorkStatus(s)} className={`flex-1 py-2 px-2 font-medium transition-colors ${i<2?"border-r border-gray-200":""} ${workStatus===s?s==="done"?"bg-green-50 text-green-800":s==="progress"?"bg-indigo-50 text-indigo-800":"bg-red-50 text-red-800":"bg-white text-gray-500 hover:bg-gray-50"}`}>{s==="done"?"Completed":s==="progress"?"In progress":"Blocked"}</button>))}</div></div>
                  </div>
                  <button onClick={handleAddWorkLog} className="mt-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">Submit work</button>
                </div>
                {workLogs.length===0
                  ? <p className="text-sm text-gray-400 text-center py-6">No entries yet.</p>
                  : <div className="space-y-2"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent entries</p>{workLogs.map(log=>(<div key={`${log.id}-${log.date}`} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm"><p className="text-sm text-gray-800 leading-relaxed mb-2.5">{log.description}</p><div className="flex items-center gap-2"><span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${log.status==="done"?"bg-green-50 text-green-800 border-green-200":log.status==="progress"?"bg-indigo-50 text-indigo-800 border-indigo-200":"bg-red-50 text-red-800 border-red-200"}`}>{log.status==="done"?"Completed":log.status==="progress"?"In progress":"Blocked"}</span><span className="w-1 h-1 rounded-full bg-gray-300" /><span className="text-xs font-medium text-gray-500">{log.hours}h</span><span className="text-xs text-gray-400 ml-auto">{log.date}</span></div></div>))}</div>}
              </div>
            )}

            {/* ─── HISTORY ─── */}
            {taskDetailTab === "history" && (
              <TaskActivityTimeline
                taskId={activeTask.id}
                projectColor={activeProject?.color || "#6366f1"}
              />
            )}
          </div>
        </div>
      </div>
       </>,
       document.body
    );
  };


  /* ══════════════════════════════════════
     PROJECT VIEW
  ══════════════════════════════════════ */
  if (activeProject) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-hidden" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} .hide-sb::-webkit-scrollbar{display:none;}.hide-sb{scrollbar-width:none;}`}</style>

        {renderTaskDetailPanel()}


        {/* Task Modal */}
        <TaskModal
          open={showTaskModal}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); setQuickTaskStoryId(undefined); setQuickTaskType(undefined); }}
          onSubmit={handleTaskSubmit}
          users={users}
          columns={columns}
          projectColor={activeProject?.color || "#6366f1"}
          stories={stories}
          defaultStoryId={quickTaskStoryId}
          defaultTicketType={quickTaskType}
          existingTasks={tasks}
          editingTask={editingTask}
        />

        {/* Sprint Form Modal — from sprint.tsx */}
        <SprintFormModal
          open={showSprintFormModal}
          onClose={() => { setShowSprintFormModal(false); setEditingSprint(null); }}
          projectId={activeProject.id}
          editingSprint={editingSprint}
          onSaved={async (sprint) => {
            await logActivity(
              activeProject.id,
              editingSprint ? "updated sprint" : "created sprint",
              `${editingSprint ? "Updated" : "Created"} sprint "${sprint.name}"`
            );
          }}
        />

        {/* Top header */}
        <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 py-2 flex items-center gap-3">
            <button onClick={()=>{setActiveProject(null);setActiveSprint(null);setViewMode("kanban");}} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">← Projects</button>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{background:activeProject.color||"#6366f1"}} />
              <h1 className="font-bold text-gray-900 text-sm">{activeProject.name}</h1>
              {activeProject.clientName&&<span className="text-xs text-gray-400">· {activeProject.clientName}</span>}
            </div>
          </div>

          {/* View tabs */}
          <div className="px-4 flex items-center bg-white" style={{borderBottom:"1px solid #f3f4f6"}}>
            <div className="flex items-center overflow-x-auto hide-sb">
              {([
                ["dashboard","📊 Dashboard"],
                ["kanban","⊞ Kanban"],
                ["list","☰ List"],
                ["timeline","📅 Timeline"],
                ["workload","👥 Workload"],
                ["reports","📊 Reports"],
                ["gantt","📈 Gantt"],
                ["sprint_reports","🏃 Sprints"],
              ] as const).map(([m,label])=>(
                <button key={m} onClick={()=>setViewMode(m as typeof viewMode)}
                  className="px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0"
                  style={viewMode===m?{borderBottomColor:activeProject.color||"#4f46e5",color:activeProject.color||"#4f46e5"}:{borderBottomColor:"transparent",color:"#6b7280"}}>{label}</button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {viewMode!=="dashboard"&&viewMode!=="sprint_reports"&&(
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <SprintPicker
                  sprints={sprints}
                  activeSprint={activeSprint}
                  onSelect={setActiveSprint}
                  onDelete={handleDeleteSprint}
                  onEdit={canManage ? (s) => { setEditingSprint(s as SprintFull); setShowSprintFormModal(true); } : undefined}
                />

<QuickFilter
  projectMembers={projectMembers}
  sprints={sprints as SprintFull[]}
  columns={columns}
  allTags={allTags}
  value={quickFilter}
  onChange={setQuickFilter}
/>
                <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                  <option value="all">All Priorities</option>
                  {["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}
                </select>
                <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                  <option value="all">All Assignees</option>
                  {projectMembers.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}
                </select>
                <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                  <option value="all">All Types</option>
                  <option value="story">📘 Story</option>
                  <option value="task">🧩 Task</option>
                  <option value="bug">🐞 Bug</option>
                  <option value="defect">🎯 Defect</option>
                </select>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks, codes..." className="text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none w-40" />
                </div>
              </div>
            )}
            {(viewMode==="dashboard"||viewMode==="sprint_reports")&&<div className="flex-1" />}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {canManage&&(
                <>
                  <button onClick={()=>setShowMilestoneForm(!showMilestoneForm)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition">🏁 Milestone</button>
                  <button onClick={() => { setEditingSprint(null); setShowSprintFormModal(true); }}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition">🏃 Sprint</button>
                  {viewMode!=="dashboard"&&<button onClick={()=>setShowTaskModal(true)} className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-lg text-white transition hover:opacity-90" style={{background:activeProject.color||"#4f46e5"}}>+ Create</button>}
                  <button onClick={()=>handleEditProject(activeProject)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">✏️ Edit</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Milestones bar — now with delete button on hover ── */}
        {milestones.length>0&&(
          <div className="shrink-0 px-6 py-2 bg-white border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Milestones</span>
            {milestones.map(m=>(
              <div
                key={m.id}
                className="group/ms relative flex items-center gap-1 shrink-0"
              >
                <button
                  onClick={()=>canManage&&toggleMilestone(m)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition pr-6 ${m.status==="completed"?"border-green-200 bg-green-50 text-green-700 line-through":"border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300 hover:bg-amber-50"} ${canManage?"cursor-pointer":""}`}
                >
                  {m.status==="completed"?"✅":"🎯"} {m.title}{m.dueDate&&` · ${m.dueDate}`}
                </button>
                {/* Delete button — only visible on hover, only for PMs */}
                {canManage&&(
                  <button
                    onClick={e=>handleDeleteMilestone(e,m)}
                    title="Delete milestone"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold opacity-0 group-hover/ms:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Milestone form inline */}
        {showMilestoneForm&&canManage&&(
          <div className="shrink-0 px-6 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">New Milestone</span>
              <input value={mf.title} onChange={e=>setMf({...mf,title:e.target.value})} placeholder="Milestone title" className="text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" />
              <input type="date" value={mf.dueDate} onChange={e=>setMf({...mf,dueDate:e.target.value})} className="text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" />
              <button onClick={handleCreateMilestone} className="text-xs font-bold px-3 py-1.5 bg-amber-500 text-white rounded-lg">Create</button>
              <button onClick={()=>setShowMilestoneForm(false)} className="text-xs text-gray-400">✕</button>
            </div>
          </div>
        )}

        {!canManage&&<div className="shrink-0 px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2"><span className="text-xs text-amber-700 font-medium">👁️ You have view-only access. Only Project Managers can edit tasks, columns, and settings.</span></div>}

        {/* Main content area - removed global overflow-y-auto to allow Kanban internal scroll */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ─── DASHBOARD ─── */}
          {viewMode==="dashboard"&&(()=>{
            const avatarColors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
            const barColors = ["#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899"];
            const medals = ["🥇","🥈","🥉"];
            const statusStyle: Record<string,{bg:string;color:string}> = { Active:{bg:"#f0fdf4",color:"#16a34a"}, Blocked:{bg:"#fef2f2",color:"#dc2626"}, Done:{bg:"#eff6ff",color:"#2563eb"}, Idle:{bg:"#f1f5f9",color:"#64748b"} };
            const rankedMembers = [...projectMembers].map((u:any)=>{ const ut=nonStoryTasks.filter(t=>t.assignedTo===u.uid); const done=ut.filter(t=>t.status===doneColId).length; const hrs=workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+(l.hoursWorked||0),0); const pct=ut.length?Math.round((done/ut.length)*100):0; return {u,done,hrs,pct,total:ut.length}; }).filter(x=>x.total>0).sort((a,b)=>b.pct-a.pct||b.done-a.done);
            const membersWithHours=projectMembers.map((u:any,i:number)=>({u,i,hrs:workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+(l.hoursWorked||0),0),initials:(u.displayName||u.name||u.email?.split("@")[0]||"?").slice(0,2).toUpperCase()})).filter(x=>x.hrs>0);
            const maxHrs=Math.max(...membersWithHours.map(x=>x.hrs),1);
            return (
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{(["story","task","bug","defect"] as const).map(t=>{const tm=TYPE_META[t];const cnt=tasks.filter(x=>x.ticketType===t).length;return(<div key={t} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"><span className="text-2xl">{tm.icon}</span><div><p className="text-2xl font-black" style={{color:tm.color}}>{cnt}</p><p className="text-xs text-gray-400 capitalize">{tm.label}s</p></div></div>);})}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{[{label:"Total Items",val:tasks.length,color:"#6366f1",bg:"#eef2ff"},{label:"Completed",val:nonStoryTasks.filter(t=>t.status===doneColId).length,color:"#16a34a",bg:"#f0fdf4"},{label:"In Progress",val:nonStoryTasks.filter(t=>t.status==="inprogress").length,color:"#2563eb",bg:"#eff6ff"},{label:"Overdue",val:overdueTasks.length,color:"#dc2626",bg:"#fef2f2"},{label:"Total Hours",val:`${totalHours}h`,color:"#7c3aed",bg:"#f5f3ff"},{label:"Progress",val:`${activeProject.progress}%`,color:activeProject.color||"#6366f1",bg:"#f9fafb"}].map(s=>(<div key={s.label} className="rounded-xl p-4 border" style={{background:s.bg,borderColor:s.color+"20"}}><p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:s.color}}>{s.label}</p><p className="text-2xl font-black" style={{color:s.color}}>{s.val}</p></div>))}</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col" style={{minHeight:"320px"}}>
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0"><span>🏆</span> Top Performers<span className="ml-auto text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">{rankedMembers.length} ranked</span></h3>
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{maxHeight:"280px"}}>{rankedMembers.length===0?<p className="text-xs text-gray-400 text-center py-8">No assigned tasks yet</p>:rankedMembers.map(({u,done,hrs,pct,total},i)=>{const name=u.displayName||u.name||u.email?.split("@")[0]||"?";const initials=name.slice(0,2).toUpperCase();return(<div key={u.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:avatarColors[i%avatarColors.length]}}>{initials}</div><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{name}</p><p className="text-[10px] text-gray-400">{done}/{total} tasks · {hrs}h logged</p></div><div className="w-20 bg-gray-100 rounded-full h-1.5 shrink-0"><div className="h-1.5 rounded-full" style={{width:`${pct}%`,background:barColors[i%barColors.length]}} /></div><span className="text-[11px] font-bold w-8 text-right shrink-0" style={{color:barColors[i%barColors.length]}}>{pct}%</span>{i<3&&<span className="text-base shrink-0">{medals[i]}</span>}</div>);})}</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col" style={{minHeight:"320px"}}>
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 shrink-0"><span>👥</span> Team Members<span className="ml-auto text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">{projectMembers.length} members</span></h3>
                    <div className="grid gap-0 shrink-0" style={{gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 56px"}}>{["Member","Done","Active","Blocked","Hours","Status"].map(h=>(<div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-2 border-b border-gray-100">{h}</div>))}</div>
                    <div className="flex-1 overflow-y-auto" style={{maxHeight:"260px"}}>{projectMembers.length===0?<p className="text-xs text-gray-400 text-center py-8">No members yet</p>:projectMembers.map((u:any,i:number)=>{const name=u.displayName||u.name||u.email?.split("@")[0]||"?";const initials=name.slice(0,2).toUpperCase();const ut=nonStoryTasks.filter(t=>t.assignedTo===u.uid);const done=ut.filter(t=>t.status===doneColId).length;const inProg=ut.filter(t=>t.status==="inprogress").length;const blocked=ut.filter(t=>t.status==="blocked").length;const hrs=workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+(l.hoursWorked||0),0);const isPM=getProjectManagers(activeProject).includes(u.uid);const statusLabel=blocked>0?"Blocked":inProg>0?"Active":done>0?"Done":"Idle";const ss=statusStyle[statusLabel];return(<div key={u.uid} className="grid items-center hover:bg-gray-50 transition border-b border-gray-50 last:border-0" style={{gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 56px"}}><div className="flex items-center gap-2 px-2 py-2.5 min-w-0"><div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{background:avatarColors[i%avatarColors.length]}}>{initials}</div><div className="min-w-0"><div className="flex items-center gap-1"><p className="text-xs font-semibold text-gray-800 truncate">{name}</p>{isPM&&<span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">👑</span>}</div><p className="text-[10px] text-gray-400 truncate">{u.email}</p></div></div><div className="px-2 py-2.5 text-xs font-bold text-green-600">{done}</div><div className="px-2 py-2.5 text-xs font-bold text-blue-600">{inProg}</div><div className="px-2 py-2.5 text-xs font-bold text-red-500">{blocked}</div><div className="px-2 py-2.5 text-xs font-bold text-violet-600">{hrs}h</div><div className="px-2 py-2.5"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:ss.bg,color:ss.color}}>{statusLabel}</span></div></div>);})}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col" style={{minHeight:"260px"}}>
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 shrink-0"><span className="w-2 h-2 rounded-full" style={{background:activeProject.color||"#6366f1"}} />Story Overview</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">{stories.length===0?<p className="text-xs text-gray-400 text-center py-4">No stories yet</p>:stories.map(story=>{const children=tasks.filter(t=>t.parentStoryId===story.id);const done=children.filter(t=>t.status===doneColId).length;const pct=children.length?Math.round((done/children.length)*100):0;return(<div key={story.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={()=>setActiveTask(story)}><span>📘</span><span className="text-xs font-semibold text-gray-700 flex-1 truncate">{story.title}</span><div className="w-16 bg-gray-100 rounded-full h-1.5 shrink-0"><div className="h-1.5 rounded-full" style={{width:`${pct}%`,background:activeProject.color||"#6366f1"}} /></div><span className="text-xs font-bold text-gray-500 w-10 text-right shrink-0">{done}/{children.length}</span></div>);})}</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5" style={{minHeight:"260px"}}>
                    <h3 className="text-sm font-bold text-gray-800 mb-4">📊 Type Breakdown</h3>
                    <div className="space-y-3">{(["story","task","bug","defect"] as const).map(t=>{const tm2=TYPE_META[t];const cnt=tasks.filter(x=>x.ticketType===t).length;const pct=tasks.length?Math.round((cnt/tasks.length)*100):0;return(<div key={t} className="flex items-center gap-3"><span className="text-base">{tm2.icon}</span><span className="text-xs font-semibold text-gray-500 w-12">{tm2.label}</span><div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${pct}%`,background:tm2.color}} /></div><span className="text-xs font-bold text-gray-600 w-6 text-right">{cnt}</span></div>);})}</div>
                    <div className="mt-5 pt-4 border-t border-gray-50"><div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-400">Overall completion</span><span className="text-xs font-bold" style={{color:activeProject.color||"#6366f1"}}>{activeProject.progress}%</span></div><div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${activeProject.progress}%`,background:activeProject.color||"#6366f1"}} /></div></div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col" style={{minHeight:"260px"}}>
                    <h3 className="text-sm font-bold text-gray-800 mb-4 shrink-0">⏱ Hours per Member</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">{membersWithHours.length===0?<div className="flex flex-col items-center justify-center h-full text-gray-300"><p className="text-xs">No hours logged yet</p></div>:membersWithHours.map(({u,i,hrs,initials})=>(<div key={u.uid} className="flex items-center gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{background:avatarColors[i%avatarColors.length]}}>{initials}</div><div className="flex-1 min-w-0"><p className="text-[10px] text-gray-500 truncate mb-1">{u.displayName||u.name||u.email?.split("@")[0]||"?"}</p><div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${Math.round((hrs/maxHrs)*100)}%`,background:avatarColors[i%avatarColors.length]}} /></div></div><span className="text-xs font-bold shrink-0" style={{color:avatarColors[i%avatarColors.length]}}>{hrs}h</span></div>))}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── KANBAN ─── */}
          {viewMode==="kanban"&&(
            <div className="flex-1 flex flex-col min-h-0 m-0 gap-0">
              <div className="flex-1 border border-gray-200 overflow-hidden bg-white shadow-sm flex flex-col min-h-0">
                <KanbanBoard
  tasks={filteredTasks}
  columns={columns}
  setColumns={setColumns}
  projectColor={activeProject.color || "#6366f1"}
  onTaskClick={handleTaskClick}
  onStatusChange={handleTaskStatusChange}
  canManage={canManage}
  onSaveColumns={handleSaveColumns}
  onCreateTask={canManage ? handleKanbanCreateTask : undefined}
   currentUser={user}       
  activeProject={activeProject}
/>
              </div>
            </div>
          )}

          {/* ─── LIST ─── */}
          {viewMode==="list"&&(
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">{["Type","Code","Title","Status","Priority","Assignee","Est.","Due Date","Sprint","Tags"].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredTasks.map(task=>{
                      const pc=PRIORITY_CONFIG[task.priority];
                      const tm2=TYPE_META[task.ticketType||"task"];
                      const col=columns.find(c=>c.id===task.status);
                      const colIdx=columns.findIndex(c=>c.id===task.status);
                      const cfg=getColConfig(col||{id:task.status,label:task.status},colIdx);
                      const isOverdue=task.dueDate&&new Date(task.dueDate)<new Date()&&task.status!==doneColId;
                      const taskSprint = task.sprintId ? sprints.find(s => s.id === task.sprintId) : null;
                      return(
                        <tr key={task.id} onClick={()=>setActiveTask(task)} className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition group">
                          <td className="px-4 py-3"><span title={tm2.label} className="text-lg">{tm2.icon}</span></td>
                          <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-400">{task.taskCode||"—"}</span></td>
                          <td className="px-4 py-3"><p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">{task.title}</p></td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs font-semibold" style={{color:cfg?.color||"#64748b"}}><div className="w-1.5 h-1.5 rounded-full" style={{background:cfg?.color||"#64748b"}} />{col?.label||task.status}</span></td>
                          <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{background:pc?.bg,color:pc?.color}}>{pc?.icon} {task.priority}</span></td>
                          <td className="px-4 py-3">{task.assignedToName?<div className="flex items-center gap-2"><Avatar name={task.assignedToName} size="xs"/><span className="text-xs text-gray-600">{task.assignedToName}</span></div>:<span className="text-xs text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-600">{task.estimatedHours||0}h</td>
                          <td className="px-4 py-3"><span className={`text-xs font-semibold ${isOverdue?"text-red-600":"text-gray-500"}`}>{task.dueDate||"—"}{isOverdue&&" ⚠️"}</span></td>
                          <td className="px-4 py-3">{taskSprint?<span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-100">{taskSprint.name}</span>:<span className="text-xs text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">
  <div className="flex gap-1">
    {task.tags?.slice(0, 2).map((t: string) => (
      <span
        key={t}
        className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
      >
        #{t}
      </span>
    ))}
  </div>
</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTasks.length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">📋</div><p className="text-sm">No tasks found</p></div>}
              </div>
            </div>
          )}

          {/* ─── TIMELINE — powered by ProjectActivityTimeline from sprint.tsx ─── */}
          {viewMode==="timeline"&&(
            <ProjectActivityTimeline projectId={activeProject.id} />
          )}

          {/* ─── WORKLOAD ─── */}
          {viewMode==="workload"&&(
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {workloadData.map(({user:u,total,done,inProgress,blocked}:WorkloadItem)=>(
                  <div key={u.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4"><Avatar name={u.email} size="md" /><div><p className="font-bold text-gray-800 text-sm">{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</p><p className="text-xs text-gray-400">{total} tasks</p></div><div className="ml-auto"><ProgressRing pct={total>0?Math.round((done/total)*100):0} size={44} stroke={4} color={activeProject.color||"#6366f1"} /></div></div>
                    <div className="space-y-2">{[{label:"Done",val:done,color:"#16a34a"},{label:"In Progress",val:inProgress,color:"#2563eb"},{label:"Blocked",val:blocked,color:"#dc2626"},{label:"Todo",val:total-done-inProgress-blocked,color:"#94a3b8"}].map(s=>(<div key={s.label} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}} /><span className="text-xs text-gray-500 flex-1">{s.label}</span><div className="flex-1 bg-gray-100 rounded-full h-1"><div className="h-1 rounded-full" style={{width:total>0?`${(s.val/total)*100}%`:"0%",background:s.color}} /></div><span className="text-xs font-bold text-gray-700 w-5 text-right">{s.val}</span></div>))}</div>
                    <div className="mt-4 pt-4 border-t border-gray-50">
  <p className="text-xs text-gray-400 mb-1">Hours tracked</p>
  <div className="flex items-end gap-3">
    <div>
      <p className="text-2xl font-black" style={{color:activeProject.color||"#6366f1"}}>
        {/* ✅ CHANGE 3: Show auto-calculated hours */}
        {workloadData.find((w: WorkloadItem) => w.user.uid === u.uid)?.autoHours || 0}h
      </p>
      <p className="text-[10px] text-gray-400">auto-tracked</p>
    </div>
    {workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+l.hoursWorked,0) > 0 && (
      <div className="text-right">
        <p className="text-sm font-bold text-gray-500">
          +{workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+l.hoursWorked,0)}h
        </p>
        <p className="text-[10px] text-gray-400">manual logs</p>
      </div>
    )}
  </div>
</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── REPORTS ─── */}
          {viewMode==="reports"&&(
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[{label:"Total Tasks",val:nonStoryTasks.length,sub:"excl. stories",color:"#6366f1"},{label:"Completed",val:nonStoryTasks.filter(t=>t.status===doneColId).length,sub:`${nonStoryTasks.length?Math.round((nonStoryTasks.filter(t=>t.status===doneColId).length/nonStoryTasks.length)*100):0}%`,color:"#16a34a"},{label:"Bugs",val:tasks.filter(t=>t.ticketType==="bug").length,sub:"total bugs",color:"#dc2626"},{label:"Total Hours",val:`${totalHours}h`,sub:"all logged",color:"#7c3aed"}].map(s=>(<div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p><p className="text-3xl font-black" style={{color:s.color}}>{s.val}</p><p className="text-xs text-gray-400 mt-1">{s.sub}</p></div>))}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4">Type Breakdown</h3>
                <div className="space-y-3">{(["story","task","bug","defect"] as const).map(t=>{const tm2=TYPE_META[t];const cnt=tasks.filter(x=>x.ticketType===t).length;const pct=tasks.length?Math.round((cnt/tasks.length)*100):0;return(<div key={t} className="flex items-center gap-3"><span>{tm2.icon}</span><span className="text-xs font-semibold text-gray-600 w-16">{tm2.label}</span><div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${pct}%`,background:tm2.color}} /></div><span className="text-xs font-bold text-gray-700 w-8 text-right">{cnt}</span></div>);})}</div>
              </div>
            </div>
          )}

          {/* ─── GANTT ─── */}
          {viewMode==="gantt"&&(
            <div className="flex-1 overflow-y-auto p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50"><h3 className="font-bold text-gray-800">Task Timeline (Gantt)</h3></div>
              <div className="p-5">
                {nonStoryTasks.filter(t=>t.dueDate).sort((a,b)=>new Date(a.dueDate!).getTime()-new Date(b.dueDate!).getTime()).map(task=>{
                  const pc=PRIORITY_CONFIG[task.priority];const tm2=TYPE_META[task.ticketType||"task"];const isOverdue=new Date(task.dueDate!)<new Date()&&task.status!==doneColId;
                  return(<div key={task.id} onClick={()=>setActiveTask(task)} className="flex items-center gap-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition rounded-xl px-2 group"><div className="w-44 shrink-0"><div className="flex items-center gap-1.5"><span>{tm2.icon}</span><p className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-600">{task.title}</p></div>{task.assignedToName&&<p className="text-xs text-gray-400 pl-5">{task.assignedToName}</p>}</div><div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full flex items-center justify-end pr-2 min-w-10" style={{width:`${Math.max((task.actualHours||0)/(task.estimatedHours||1)*100,8)}%`,background:isOverdue?"#ef4444":(activeProject.color||"#6366f1"),opacity:task.status===doneColId?0.5:1}}><span className="text-[10px] font-bold text-white">{task.actualHours||0}h</span></div></div><div className="w-28 shrink-0 flex items-center justify-end gap-2"><span className={`text-xs font-semibold ${isOverdue?"text-red-600":"text-gray-500"}`}>{task.dueDate}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:pc.bg,color:pc.color}}>{pc.icon}</span></div></div>);
                })}
                {nonStoryTasks.filter(t=>t.dueDate).length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">📈</div><p className="text-sm">No tasks with due dates</p></div>}
              </div>
            </div></div>
          )}

          {/* ─── SPRINT REPORTS — from sprint.tsx ─── */}
          {viewMode==="sprint_reports"&&(
            <SprintReports
              sprints={sprints as SprintFull[]}
              tasks={filteredTasks}
              columns={columns}
              projectColor={activeProject.color || "#6366f1"}
              onTaskClick={(t: Task) => setEditingTask(t)}
            />
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     MAIN HOME (Projects List)
  ══════════════════════════════════════ */
  const totalP=projects?.length||0;
  const completedP=projects?.filter((p:any)=>p.status==="Completed").length||0;
  const inProgressP=projects?.filter((p:any)=>p.status==="In Progress").length||0;
  const billingP=projects?.filter((p:any)=>p.projectType==="Billing").length||0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f5f6fa]" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-2 pb-8">
      <style>{`
        .proj-card{transition:box-shadow 0.18s ease,transform 0.18s ease;}
        .proj-card:hover{box-shadow:0 8px 32px rgba(0,0,0,0.10)!important;transform:translateY(-2px);}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .modal-backdrop{animation:fadeIn 0.18s ease;}
        .modal-panel{animation:slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
      `}</style>

      {/* Project Form Modal */}
      {showProjectForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" style={{background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)"}}>
          <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" style={{border:"1px solid #e5e7eb"}}>
            <div className="shrink-0 px-6 py-5 flex items-center justify-between border-b border-gray-100">
              <div><h2 className="text-base font-semibold text-gray-900">{editingProject?"Edit Project":"Create New Project"}</h2><p className="text-xs text-gray-400 mt-0.5">{editingProject?"Update project details":"Fill in the details to set up your project"}</p></div>
              <button onClick={()=>{setShowProjectForm(false);setEditingProject(null);}} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div><label className="text-xs font-medium text-gray-500 block mb-2">Project Color</label><div className="flex gap-2">{PROJECT_COLORS.map(c=><button key={c} onClick={()=>setPf({...pf,color:c})} className="w-7 h-7 rounded-full transition-all hover:scale-110 shrink-0" style={{background:c,outline:pf.color===c?`2px solid ${c}`:"none",outlineOffset:"2px"}} />)}</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Project Name <span className="text-red-400">*</span></label><input value={pf.name} onChange={e=>setPf({...pf,name:e.target.value})} placeholder="e.g. Website Redesign" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition" /></div>
                <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Client Name</label><input value={pf.clientName} onChange={e=>setPf({...pf,clientName:e.target.value})} placeholder="e.g. Acme Corp" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Description</label><textarea value={pf.description} onChange={e=>setPf({...pf,description:e.target.value})} placeholder="Brief project overview..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                {[{label:"Billing Type",child:<select value={pf.projectType} onChange={e=>setPf({...pf,projectType:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition"><option value="Billing">Billing</option><option value="Non-Billing">Non-Billing</option></select>},{label:"Payment Model",child:<select value={pf.billingType} onChange={e=>setPf({...pf,billingType:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition"><option>Hourly</option><option>Fixed Cost</option><option>Internal</option></select>},{label:"Priority",child:<select value={pf.priority} onChange={e=>setPf({...pf,priority:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition">{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select>},{label:"Status",child:<select value={pf.status} onChange={e=>setPf({...pf,status:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition">{["Not Started","Planning","In Progress","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}</select>},{label:"Budget ($)",child:<input type="number" value={pf.budget} onChange={e=>setPf({...pf,budget:e.target.value})} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />},{label:"Start Date",child:<input type="date" value={pf.startDate} onChange={e=>setPf({...pf,startDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />},{label:"End Date",child:<input type="date" value={pf.endDate} onChange={e=>setPf({...pf,endDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />}].map(({label,child})=>(<div key={label}><label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>{child}</div>))}
              </div>
              <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/40">
                <div className="flex items-center gap-2 mb-3"><span className="text-base">👑</span><div><p className="text-xs font-bold text-indigo-700">Project Managers</p><p className="text-[10px] text-indigo-400">PMs can create/edit/delete tasks, manage columns, and edit the project. You (creator) are always a PM.</p></div></div>
                <MemberPicker users={users} currentUid={user.uid} selected={pf.selectedManagers} onChange={(sel:string[])=>setPf({...pf,selectedManagers:sel})} label="Additional Project Managers" />
              </div>
              <MemberPicker users={users} currentUid={user.uid} selected={pf.selectedMembers} onChange={(sel:string[])=>setPf({...pf,selectedMembers:sel})} label="Team Members (view-only)" excludeUids={pf.selectedManagers} />
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={()=>{setShowProjectForm(false);setEditingProject(null);}} className="inline-flex items-center px-4 py-2 text-sm text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSaveProject} className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition" style={{background:"#4f46e5"}}>{editingProject?"Save Changes":"Create Project"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Top header */}
      <div className="bg-white border-b border-gray-200 px-6 py-0 sticky top-0 z-30" style={{boxShadow:"0 1px 0 #e5e7eb"}}>
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-center justify-between py-2 sm:h-14 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:"#4f46e5"}}>PH</div>
            <div><h1 className="text-sm font-semibold text-gray-900">Project Hub</h1><p className="text-[10px] text-gray-400">Manage &amp; track all company projects</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <button onClick={()=>setMainTab("projects")} className="px-4 py-1.5 text-xs font-medium transition" style={mainTab==="projects"?{background:"white",color:"#4f46e5",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}:{color:"#6b7280"}}>Projects</button>
              <button onClick={()=>setMainTab("dailysheet")} className="px-4 py-1.5 text-xs font-medium transition" style={mainTab==="dailysheet"?{background:"white",color:"#4f46e5",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}:{color:"#6b7280"}}>Daily Sheets</button>
            </div>
            {mainTab==="projects"&&<>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={()=>setProjectsView("grid")} className="px-2.5 py-1.5 transition text-sm" style={projectsView==="grid"?{background:"#4f46e5",color:"white"}:{background:"white",color:"#9ca3af"}}>⊞</button>
                <button onClick={()=>setProjectsView("list")} className="px-2.5 py-1.5 transition text-sm" style={projectsView==="list"?{background:"#4f46e5",color:"white"}:{background:"white",color:"#9ca3af"}}>☰</button>
              </div>
              <button onClick={()=>{setEditingProject(null);setShowProjectForm(true);}} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition hover:opacity-90" style={{background:"#4f46e5"}}>+ New Project</button>
            </>}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-2 pb-5 space-y-5">
        {mainTab==="dailysheet"&&<AdminDailySheet user={user} users={users} projects={projects||[]} />}
        {mainTab==="projects"&&<>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[{label:"Total Projects",val:totalP,color:"#4f46e5",bg:"#eef2ff",border:"#c7d2fe"},{label:"Completed",val:completedP,color:"#059669",bg:"#ecfdf5",border:"#a7f3d0"},{label:"In Progress",val:inProgressP,color:"#d97706",bg:"#fffbeb",border:"#fde68a"},{label:"Billing Projects",val:billingP,color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe"}].map(s=>(
              <div key={s.label} className="bg-white rounded-xl p-4 flex items-center gap-4" style={{border:`1px solid ${s.border}`,boxShadow:`0 1px 4px ${s.color}12`}}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{background:s.bg}}><span className="text-xl font-black" style={{color:s.color}}>{s.val}</span></div>
                <div><p className="text-xs text-gray-400 leading-tight">{s.label}</p><p className="text-lg font-bold text-gray-800 leading-tight">{s.val}</p></div>
              </div>
            ))}
          </div>
          {projects?.length===0&&(
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-200">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4" style={{background:"#eef2ff"}}>📁</div>
              <p className="text-sm font-semibold text-gray-700">No projects yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-5">Create your first project to get started</p>
              <button onClick={()=>setShowProjectForm(true)} className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white rounded-lg" style={{background:"#4f46e5"}}>+ New Project</button>
            </div>
          )}
          {projectsView==="grid"&&projects?.length>0&&(
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects?.map((project:any)=>{
                const sc=STATUS_CONFIG[project.status];const pc=PRIORITY_CONFIG[project.priority];const accentColor=project.color||"#4f46e5";const memberList=project.members?.slice(0,5).map((uid:string)=>users.find((u:any)=>u.uid===uid)).filter(Boolean);const pms=getProjectManagers(project);const isPM=pms.includes(user.uid)||project.createdBy===user.uid;
                return(
                  <div key={project.id} className="proj-card bg-white rounded-xl overflow-hidden cursor-pointer group" style={{border:"1px solid #e5e7eb",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}} onClick={()=>{setActiveProject(project);setViewMode("kanban");}}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3"><div className="flex items-center gap-2.5 min-w-0"><div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{background:accentColor}}>{project.name[0]?.toUpperCase()}</div><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900 truncate leading-tight group-hover:text-indigo-700 transition">{project.name}</h3>{project.clientName&&<p className="text-[11px] text-gray-400 truncate mt-0.5">{project.clientName}</p>}</div></div><div className="flex items-center gap-1.5 shrink-0">{isPM&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">👑 PM</span>}<span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{background:sc?.bg,color:sc?.color}}>{project.status}</span></div></div>
                      <p className="text-xs text-gray-400 line-clamp-1 mb-3">{project.description||"No description."}</p>
                      <div className="flex flex-wrap gap-1 mb-3">{project.projectType==="Billing"&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Billing</span>}{project.billingType&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">{project.billingType}</span>}<span className="text-[10px] px-1.5 py-0.5 rounded border" style={{background:pc?.bg,color:pc?.color,borderColor:pc?.color+"30"}}>{project.priority}</span>{pms.length>1&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 border border-indigo-100">👑 {pms.length} PMs</span>}{project.endDate&&<span className="text-[10px] text-gray-400 ml-auto">Due {project.endDate}</span>}</div>
                      <>
  {/* ✅ CHANGE 2: Task / Story / Bug counts above progress bar */}
  {(() => {
    const doneColIdLocal = "done"; // or derive from columns
    const pt = allProjectTasks.filter(t => t.projectId === project.id);
    const stats = [
      { type: "story",  icon: "📘", bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe" },
      { type: "task",   icon: "🧩", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
      { type: "bug",    icon: "🐞", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
      { type: "defect", icon: "🎯", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    ].map(s => ({
      ...s,
      total: pt.filter(t => t.ticketType === s.type).length,
      done:  pt.filter(t => t.ticketType === s.type && t.status === doneColIdLocal).length,
    })).filter(s => s.total > 0);

    return stats.length > 0 ? (
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {stats.map(s => (
          <span key={s.type}
            className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
            style={{ background: s.bg, color: s.color, borderColor: s.border }}>
            {s.icon} {s.done}/{s.total}
          </span>
        ))}
      </div>
    ) : null;
  })()}

  {/* Existing progress bar — keep exactly as-is */}
  <div className="mb-2">
    <div className="flex justify-between items-center mb-1">
      <span className="text-[10px] text-gray-400">Progress</span>
      <span className="text-[10px] font-semibold" style={{color:accentColor}}>{project.progress||0}%</span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{width:`${project.progress||0}%`,background:accentColor}} />
    </div>
  </div>
</>

                      <div className="flex items-center justify-between"><div className="flex -space-x-1.5">{memberList?.map((u:any,i:number)=><div key={i} title={u?.email?.split("@")[0]} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold" style={{background:["#6366f1","#7c3aed","#db2777","#d97706","#059669"][i%5]}}>{u?.email?.[0]?.toUpperCase()}</div>)}{project.members?.length>5&&<span className="text-[10px] text-gray-400 pl-2">+{project.members.length-5}</span>}</div>{isPM&&<div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"><button onClick={e=>{e.stopPropagation();handleEditProject(project);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition text-xs">✏️</button><button onClick={e=>{e.stopPropagation();handleDeleteProject(project.id);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition text-xs">🗑️</button></div>}</div>
                    </div>
                  </div>
                );
              })}
              <div onClick={()=>setShowProjectForm(true)} className="proj-card rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all min-h-50 group">
                <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center text-gray-300 group-hover:text-indigo-500 text-xl transition">+</div>
                <div className="text-center"><p className="text-xs font-medium text-gray-400 group-hover:text-indigo-600 transition">New Project</p><p className="text-[10px] text-gray-300 mt-0.5">Click to create</p></div>
              </div>
            </div>
          )}
          {projectsView==="list"&&projects?.length>0&&(
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50/70">{["Project","Status","Priority","Type","Progress","PMs","Members","End Date",""].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>
                  {projects?.map((project:any)=>{
                    const sc=STATUS_CONFIG[project.status];const pc=PRIORITY_CONFIG[project.priority];const pms=getProjectManagers(project).map(uid=>users.find((u:any)=>u.uid===uid)).filter(Boolean);const isPM=getProjectManagers(project).includes(user.uid)||project.createdBy===user.uid;
                    return(
                      <tr key={project.id} onClick={()=>{setActiveProject(project);setViewMode("kanban");}} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition group">
                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:project.color||"#4f46e5"}}>{project.name[0]?.toUpperCase()}</div><div><p className="text-sm font-medium text-gray-800">{project.name}</p>{project.clientName&&<p className="text-[11px] text-gray-400">{project.clientName}</p>}</div></div></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{background:sc?.bg,color:sc?.color}}>{project.status}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded border" style={{background:pc?.bg,color:pc?.color,borderColor:pc?.color+"30"}}>{project.priority}</span></td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${project.projectType==="Billing"?"bg-emerald-50 text-emerald-600":"bg-gray-100 text-gray-500"}`}>{project.projectType}</span></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${project.progress||0}%`,background:project.color||"#4f46e5"}} /></div><span className="text-[11px] font-medium" style={{color:project.color||"#4f46e5"}}>{project.progress||0}%</span></div></td>
                        <td className="px-4 py-3"><div className="flex -space-x-1.5">{pms.slice(0,3).map((u:any,i:number)=><div key={i} title={u.displayName||u.name||u.email?.split("@")[0]} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold" style={{background:["#6366f1","#7c3aed","#db2777"][i%3]}}>{(u.displayName||u.name||u.email)?.[0]?.toUpperCase()}</div>)}{pms.length>3&&<span className="text-[10px] text-gray-400 pl-1">+{pms.length-3}</span>}</div></td>
                        <td className="px-4 py-3"><div className="flex -space-x-1.5">{project.members?.slice(0,4).map((uid:string,i:number)=>{const m=users.find((u:any)=>u.uid===uid);const mName=m?.displayName||m?.name||m?.email?.split("@")[0]||"?";return<div key={i} title={mName} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold" style={{background:["#6366f1","#7c3aed","#db2777","#d97706"][i%4]}}>{mName[0]?.toUpperCase()}</div>;})}</div></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{project.endDate||"—"}</td>
                        <td className="px-4 py-3">{isPM&&<div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition"><button onClick={e=>{e.stopPropagation();handleEditProject(project);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 text-xs">✏️</button><button onClick={e=>{e.stopPropagation();handleDeleteProject(project.id);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs">🗑️</button></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>}
      </div>
    </div>
    </div>
  );
}