"use client";

// ════════════════════════════════════════════════════════════════
//  KanbanBoard is now in a separate file: ./employeekanban.tsx
//  All kanban card UI, drag-drop logic, story/task card rendering,
//  column management, and shared type/util exports live there.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  SprintFormModal,
  MoveToSprintModal,
  SprintReports,
  TaskImages,
} from "../../admin/sprint";

// ── Import KanbanBoard + shared types/utils from the extracted file ──
import {
  KanbanBoard,
} from "./employeekanban";
import { Task, KanbanColumn, TicketType, TICKET_TYPES, LABEL_COLORS, TaskLabel, getPermissions, getColStyle, getLabelStyle } from "@/lib/kanbanUtils";
import { TaskActivityTimeline } from "../../admin/ActivityTimeline";

/* ─── LOCAL TYPES (not needed in kanban file) ─── */
type ViewMode = "kanban" | "list" | "timeline" | "logs" | "reports";
type AppTab = "dashboard" | "projects" | "dailysheet" | "notifications";

interface WorkLog {
  id?: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskName?: string;
  description: string;
  hoursWorked: number;
  workStatus: "Completed" | "In Progress" | "Blocked";
  date: string;
  createdAt?: any;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  read: boolean;
  createdAt: any;
}

interface DailyEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  month: string;
  tasks: DailyTask[];
  totalHours: number;
  status: "submitted" | "draft";
  submittedAt?: any;
  createdAt: any;
}

interface DailyTask {
  id: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  description: string;
  hoursWorked: number;
  workStatus: "Completed" | "In Progress" | "Blocked" | "Review";
  category: string;
}

/* ─── CONSTANTS ─── */
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "new", label: "New" },
  { id: "dev_in_progress", label: "dev in progress" },
  { id: "unit_testing", label: "Unit testing" },
  { id: "ready_for_qa", label: "Ready for QA" },
  { id: "testing_in_progress", label: "Testing In Progress" },
  { id: "reopened", label: "Reopened" },
  { id: "done", label: "Done" },
];

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Low: { color: "#16a34a", bg: "#f0fdf4", icon: "▼" },
  Medium: { color: "#d97706", bg: "#fffbeb", icon: "●" },
  High: { color: "#ea580c", bg: "#fff7ed", icon: "▲" },
  Critical: { color: "#dc2626", bg: "#fef2f2", icon: "⚡" },
};

const DAILY_CATEGORIES = ["Development", "Design", "Testing", "Meeting", "Documentation", "Review", "DevOps", "Research", "Support", "Other"];
const WORK_STATUSES = ["Completed", "In Progress", "Blocked", "Review"] as const;

/* ─── HELPERS ─── */
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const nanoid = () => Math.random().toString(36).slice(2, 10);

async function generateUniqueTaskCode(projectId: string, type: TicketType): Promise<string> {
  const prefixMap: Record<TicketType, string> = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };
  const snap = await getDocs(
    query(collection(db, "projectTasks"),
      where("projectId", "==", projectId),
      where("ticketType", "==", type)
    )
  );
  const count = snap.size + 1;
  return `${prefixMap[type]}-${String(count).padStart(3, "0")}`;
}

/* ─── SHARED COMPONENTS ─── */
const Avatar = ({ name, size = "sm", highlight = false }: { name?: string | null; size?: "xs" | "sm" | "md" | "lg"; highlight?: boolean }) => {
  const s = { xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${s[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${highlight ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`} style={{ background: bg }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
};

const ProgressRing = ({ pct, size = 44, stroke = 4, color = "#6366f1" }: { pct: number; size?: number; stroke?: number; color?: string }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
};

const TicketBadge = ({ type, size = "sm" }: { type?: TicketType; size?: "xs" | "sm" }) => {
  const cfg = TICKET_TYPES[type || "task"];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded font-bold ${pad}`} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span>{cfg.icon}</span>
      {size === "sm" && <span>{cfg.label}</span>}
    </span>
  );
};

const sendNotification = async (toUid: string, type: string, title: string, message: string, projectId?: string, taskId?: string) => {
  await addDoc(collection(db, "notifications"), {
    toUid,
    type,
    title,
    message,
    projectId: projectId ?? null,
    taskId: taskId ?? null,
    read: false,
    createdAt: serverTimestamp()
  });
};

function PermissionToast({ message, onHide }: { message: string; onHide: () => void }) {
  useEffect(() => { const t = setTimeout(onHide, 2500); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-6 right-6 z-9999 bg-gray-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
      🔒 {message}
    </div>
  );
}

function MemberPicker({ users, currentUid, selected, onChange, label = "Team Members", excludeUids = [] }: {
  users: any[]; currentUid: string; selected: string[]; onChange: (s: string[]) => void;
  label?: string; excludeUids?: string[];
}) {
  const [search, setSearch] = useState("");
  const eligible = (users || []).filter((u: any) => u.uid !== currentUid && !excludeUids.includes(u.uid));
  const filtered = eligible.filter((u: any) => {
    const name = (u.displayName || u.name || u.email?.split("@")[0] || "").toLowerCase();
    return name.includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase());
  });
  const toggle = (uid: string) => { onChange(selected.includes(uid) ? selected.filter(id => id !== uid) : [...selected, uid]); };
  const getName = (u: any) => u.displayName || u.name || u.email?.split("@")[0] || "Unknown";
  const colors = ["#6366f1", "#7c3aed", "#db2777", "#d97706", "#059669", "#0891b2", "#dc2626", "#16a34a"];
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
        {selected.length > 0 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selected.length} selected</span>}
      </div>
      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..."
          className="w-full border border-gray-100 bg-white rounded-xl pl-8 pr-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
      </div>
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white/50">
        <div className="max-h-24 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0
            ? <div className="py-4 text-center text-[10px] text-gray-400">No members found</div>
            : filtered.map((u: any) => {
              const name = getName(u); const checked = selected.includes(u.uid);
              const colorIdx = (name.charCodeAt(0) || 0) % colors.length;
              return (
                <div key={u.uid} onClick={() => toggle(u.uid)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-all ${checked ? "bg-indigo-50/50" : "hover:bg-white"}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm" style={{ background: colors[colorIdx] }}>{name[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-gray-800 truncate">{name}</p><p className="text-[9px] text-gray-400 truncate">{u.email}</p></div>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-200 bg-white"}`}>
                    {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   EDIT PROJECT MODAL
══════════════════════════════════════════════ */
function EditProjectModal({ open, onClose, project, users, onSaved }: {
  open: boolean;
  onClose: () => void;
  project: any;
  users: any[];
  onSaved?: (updated: any) => void;
}) {
  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#0891b2"];
  const [form, setForm] = useState({
    name: project?.name || "",
    description: project?.description || "",
    clientName: project?.clientName || "",
    status: project?.status || "Planning",
    color: project?.color || COLORS[0],
    endDate: project?.endDate || "",
    selectedManagers: (project?.projectManagers || []).filter((uid: string) => uid !== project?.createdBy) as string[],
    selectedMembers: (project?.members || []).filter((uid: string) => !project?.projectManagers?.includes(uid) && uid !== project?.createdBy) as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setForm({
        name: project.name || "",
        description: project.description || "",
        clientName: project.clientName || "",
        status: project.status || "Planning",
        color: project.color || COLORS[0],
        endDate: project.endDate || "",
        selectedManagers: (project.projectManagers || []).filter((uid: string) => uid !== project.createdBy),
        selectedMembers: (project.members || []).filter((uid: string) => !project.projectManagers?.includes(uid) && uid !== project.createdBy),
      });
    }
  }, [open, project?.id]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const creator = project.createdBy || project.projectManager || null;
      const pms = [...new Set([creator, ...form.selectedManagers])].filter(Boolean) as string[];
      const members = [...new Set([creator, ...pms, ...form.selectedMembers])].filter(Boolean) as string[];

      const updateData: any = {
        name: form.name,
        description: form.description,
        clientName: form.clientName,
        projectType: project.projectType || "Billing",
        billingType: project.billingType || "Hourly",
        status: form.status,
        color: form.color,
        endDate: form.endDate,
        projectManagers: pms,
        projectManager: pms[0] || null,
        members: members,
        updatedAt: serverTimestamp(),
      };

      Object.keys(updateData).forEach(k => {
        if (updateData[k] === undefined) delete updateData[k];
      });

      await updateDoc(doc(db, "projects", project.id), updateData);

      // Notify NEW members
      const existingMembers = project.members || [];
      const newMembers = members.filter((m: string) => !existingMembers.includes(m));
      for (const m of newMembers) {
        if (m !== project.createdBy) {
          await sendNotification(m, "project_added", "Added to Project", `You've been added to "${form.name}"`, project.id);
        }
      }

      onSaved?.({ ...project, ...form, members, projectManagers: pms });
      onClose();
    } catch (err: any) {
      alert("Failed to update project: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${form.color}15, ${form.color}05)` }}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg" style={{ background: form.color }}>{form.name?.[0]?.toUpperCase() || "P"}</div>
            <div>
              <h2 className="font-black text-gray-900 text-lg">Edit Project</h2>
              <p className="text-xs text-gray-400">Update project identity and team</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all hover:rotate-90">✕</button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Basic Information</h3>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Project Name <span className="text-red-400">*</span></label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mobile App Redesign" className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project about?" rows={3} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Client</label>
                  <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all">
                    {["Planning", "In Progress", "On Hold", "Completed"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Theme Color</label>
                  <div className="flex gap-2.5 flex-wrap pt-1">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-lg transition-all hover:scale-110 shadow-sm"
                        style={{ background: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: 2, transform: form.color === c ? "scale(1.1)" : "scale(1)" }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Team Management</h3>
              <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-4">
                <MemberPicker label="Team Leads" users={users} currentUid={project?.createdBy} selected={form.selectedManagers} onChange={(s: string[]) => setForm(f => ({ ...f, selectedManagers: s }))} />
                <div className="h-px bg-gray-100" />
                <MemberPicker label="Team Members" users={users} currentUid={project?.createdBy} selected={form.selectedMembers} onChange={(s: string[]) => setForm(f => ({ ...f, selectedMembers: s }))} excludeUids={form.selectedManagers} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim() || saving} className="px-8 py-2.5 text-sm font-black rounded-xl text-white shadow-xl shadow-indigo-200 disabled:opacity-40 transition-all hover:translate-y-[-1px] active:translate-y-[0px]" style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}>
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PROJECT MODAL (create) ─── */
function ProjectModal({ open, onClose, user, users, onCreated }: {
  open: boolean; onClose: () => void; user: any; users: any[]; onCreated?: (project: any) => void;
}) {
  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#0891b2"];
  const [form, setForm] = useState({ name: "", description: "", clientName: "", status: "Planning", color: COLORS[0], endDate: "", selectedManagers: [] as string[], selectedMembers: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setForm({ name: "", description: "", clientName: "", status: "Planning", color: COLORS[0], endDate: "", selectedManagers: [], selectedMembers: [] });
  }, [open]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const pms = [...new Set([user.uid, ...form.selectedManagers])];
      const members = [...new Set([user.uid, ...pms, ...form.selectedMembers])];

      const docRef = await addDoc(collection(db, "projects"), {
        name: form.name,
        description: form.description,
        clientName: form.clientName,
        status: form.status,
        color: form.color,
        endDate: form.endDate,
        members: members,
        projectManagers: pms,
        projectManager: pms[0] || user.uid,
        progress: 0,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notify all members except the creator
      for (const m of members) {
        if (m !== user.uid) {
          await sendNotification(m, "project_added", "Added to Project", `You've been added to "${form.name}"`, docRef.id);
        }
      }

      onCreated?.({ id: docRef.id, ...form, members: members, projectManagers: pms });
      onClose();
    } catch (err: any) {
      alert("Failed to create project: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${form.color}15, ${form.color}05)` }}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg" style={{ background: form.color }}>{form.name?.[0]?.toUpperCase() || "P"}</div>
            <div>
              <h2 className="font-black text-gray-900 text-lg">New Project</h2>
              <p className="text-xs text-gray-400">Initialize a new project and team</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all hover:rotate-90">✕</button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Project Details</h3>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Project Name <span className="text-red-400">*</span></label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mobile App Redesign" className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project about?" rows={3} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Client</label>
                  <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white transition-all">
                    {["Planning", "In Progress", "On Hold", "Completed"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full text-sm border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Theme Color</label>
                  <div className="flex gap-2.5 flex-wrap pt-1">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-lg transition-all hover:scale-110 shadow-sm"
                        style={{ background: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: 2, transform: form.color === c ? "scale(1.1)" : "scale(1)" }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Team Members</h3>
              <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 space-y-4">
                <MemberPicker label="Team Leads" users={users} currentUid={user?.uid} selected={form.selectedManagers} onChange={(s: string[]) => setForm(f => ({ ...f, selectedManagers: s }))} />
                <div className="h-px bg-gray-100" />
                <MemberPicker label="Team Members" users={users} currentUid={user?.uid} selected={form.selectedMembers} onChange={(s: string[]) => setForm(f => ({ ...f, selectedMembers: s }))} excludeUids={form.selectedManagers} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="px-8 py-2.5 text-sm font-black rounded-xl text-white shadow-xl shadow-indigo-200 disabled:opacity-40 transition-all hover:translate-y-[-1px] active:translate-y-[0px]" style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}>
            {saving ? "Initializing Project..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}




function TeamButton({ users, activeProject, user, projectColor }: { users: any[]; activeProject: any; user: any; projectColor: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const members = (users || []).filter((u: any) => activeProject?.members?.includes(u.uid));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

  return (
    <div ref={btnRef} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", background: "white", border: "0.5px solid #d1d5db", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {members.slice(0, 4).map((u, i) => {
            const name = u.displayName || u.name || u.email?.split("@")[0] || "?";
            return (
              <div key={u.uid} style={{ width: 22, height: 22, borderRadius: "50%", background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700, border: "2px solid white", marginLeft: i === 0 ? 0 : -7, zIndex: 4 - i, position: "relative" }}>
                {name[0]?.toUpperCase()}
              </div>
            );
          })}
          {members.length > 4 && (
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#6b7280", border: "2px solid white", marginLeft: -7, position: "relative", zIndex: 0 }}>
              +{members.length - 4}
            </div>
          )}
        </div>
        <span style={{ color: "#6b7280", fontSize: 11 }}>Team</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "#9ca3af" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, background: "white", border: "0.5px solid #e5e7eb", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", zIndex: 999, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px 6px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: "0.5px solid #f3f4f6" }}>
            {members.length} member{members.length !== 1 ? "s" : ""}
          </div>
          {members.map((u, i) => {
            const name = u.displayName || u.name || u.email?.split("@")[0] || "?";
            const isPM = activeProject?.projectManagers?.includes(u.uid) || activeProject?.projectManager === u.uid;
            const isMe = u.uid === user?.uid;
            const bg = colors[i % colors.length];
            return (
              <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "default", background: "white", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0, outline: isMe ? `2px solid ${bg}` : "none", outlineOffset: 2 }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    {isPM && (
                      <span style={{
                        fontSize: 10,
                        background: u.accountType === "ADMIN" ? "#e0e7ff" : "#fef9c3",
                        color: u.accountType === "ADMIN" ? "#4338ca" : "#a16207",
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 600
                      }}>
                        {u.accountType === "ADMIN" ? "Admin" : "Team Lead"}
                      </span>
                    )}
                  </div>
                  {isMe && <span style={{ fontSize: 11, color: bg, fontWeight: 600 }}>you</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SPRINT DROPDOWN
══════════════════════════════════════════════ */
function SprintDropdown({
  sprints, activeSprint, onSelectSprint, onNewSprint, onEditSprint, onDeleteSprint, fullControl,
}: {
  sprints: any[]; activeSprint: any;
  onSelectSprint: (sprint: any) => void;
  onNewSprint: () => void;
  onEditSprint: (sprint: any) => void;
  onDeleteSprint: (sprint: any) => void;
  fullControl: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeLabel = activeSprint ? activeSprint.name : "All Sprints";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {fullControl && (
        <button onClick={onNewSprint}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: "0.5px solid #534AB7", background: "white", color: "#534AB7", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3 3l1.4 1.4M9.6 9.6l1.4 1.4M3 11l1.4-1.4M9.6 4.4l1.4-1.4" />
            <circle cx="7" cy="7" r="2.5" />
          </svg>
          New Sprint
        </button>
      )}
      <div style={{ width: "0.5px", height: 20, background: "#e5e7eb" }} />
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: `0.5px solid ${activeSprint ? "#534AB7" : "#d1d5db"}`, background: activeSprint ? "#534AB7" : "white", color: activeSprint ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke={activeSprint ? "#fff" : "#534AB7"} strokeWidth="1.2" />
          <path d="M4 6.5l1.8 1.8L9 4.5" stroke={activeSprint ? "#fff" : "#534AB7"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{activeLabel}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M2 4l4 4 4-4" stroke={activeSprint ? "#fff" : "#9ca3af"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 240, background: "white", border: "0.5px solid #e5e7eb", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 999, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px 7px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "0.5px solid #f3f4f6", background: "#fafafa" }}>
            Sprints · {sprints.length}
          </div>
          <button onClick={() => { onSelectSprint(null); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", border: "none", cursor: "pointer", background: !activeSprint ? "#f0f0ff" : "white", borderBottom: "0.5px solid #f3f4f6", transition: "background 0.12s" }}
            onMouseEnter={e => { if (activeSprint) e.currentTarget.style.background = "#f8f8ff"; }}
            onMouseLeave={e => { if (activeSprint) e.currentTarget.style.background = "white"; }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: !activeSprint ? "#534AB7" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
              <span style={{ color: !activeSprint ? "white" : "#6b7280" }}>☰</span>
            </div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: !activeSprint ? 700 : 500, color: !activeSprint ? "#534AB7" : "#374151", textAlign: "left" }}>All Sprints</span>
            {!activeSprint && <span style={{ fontSize: 10, fontWeight: 700, color: "#534AB7", background: "#eef0ff", padding: "2px 8px", borderRadius: 20 }}>active</span>}
          </button>
          {sprints.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 12, color: "#9ca3af", textAlign: "center", fontStyle: "italic" }}>No sprints yet</div>
          ) : (
            sprints.map((s, i) => {
              const isActive = activeSprint?.id === s.id;
              return (
                <div key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: i < sprints.length - 1 ? "0.5px solid #f3f4f6" : "none", background: isActive ? "#f0f0ff" : "white", transition: "background 0.12s", cursor: "pointer" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8f8ff"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}>
                  <div onClick={() => { onSelectSprint(s); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? "#534AB7" : "#a5b4fc", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#534AB7" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: "#534AB7", background: "#eef0ff", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>active</span>}
                  </div>
                  {fullControl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); onEditSprint(s); setOpen(false); }} title="Edit sprint"
                        style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", transition: "all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#eef0ff"; e.currentTarget.style.color = "#534AB7"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 9l1.5-1.5L8 2 10 4l-5.5 5.5L1 11V9zM7 3l2 2" /></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); onDeleteSprint(s); }} title="Delete sprint"
                        style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", transition: "all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h8M5 3V2h2v1M3 3l.5 7h5L9 3" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {fullControl && (
            <div style={{ borderTop: "0.5px solid #f3f4f6", padding: "8px 14px" }}>
              <button onClick={() => { onNewSprint(); setOpen(false); }}
                style={{ width: "100%", padding: "7px", borderRadius: 8, border: "0.5px dashed #c7d2fe", background: "#f8f8ff", color: "#534AB7", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#eef0ff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f8f8ff"; }}>
                + Create Sprint
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   LABEL PICKER
   - Image 2 style
═══════════════════════════════════════════ */
function LabelPicker({
  selectedLabels = [],
  onChange,
  projectId,
  disabled = false,
  canManage = true,
}: {
  selectedLabels: TaskLabel[];
  onChange: (labels: TaskLabel[]) => void;
  projectId: string;
  disabled?: boolean;
  canManage?: boolean;
}) {
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("green");

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, "projectLabels"), where("projectId", "==", projectId));
    return onSnapshot(q, (snap) => {
      setLabels(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskLabel)));
    });
  }, [projectId]);

  const toggleLabel = (label: TaskLabel) => {
    const exists = selectedLabels.some(l => l.id === label.id);
    if (exists) {
      onChange(selectedLabels.filter(l => l.id !== label.id));
    } else {
      onChange([...selectedLabels, label]);
    }
  };

  const createLabel = async () => {
    if (!newTitle.trim()) return;
    await addDoc(collection(db, "projectLabels"), {
      projectId,
      title: newTitle.trim(),
      color: newColor,
      createdAt: serverTimestamp(),
    });
    setNewTitle("");
    setCreating(false);
  };

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white flex items-center gap-2 transition shadow-sm ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
      >
        🏷️ Labels {selectedLabels.length > 0 && <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">{selectedLabels.length}</span>}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[10002]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[10003] overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Labels</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
            </div>

            <div className="p-3">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labels..." className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-gray-50/50" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {labels.filter(l => l.title.toLowerCase().includes(search.toLowerCase())).map(label => {
                const isSelected = selectedLabels.some(sl => sl.id === label.id);
                const style = getLabelStyle(label.color);
                return (
                  <div key={label.id} className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-1 duration-200">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleLabel(label)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    <div
                      onClick={() => toggleLabel(label)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer transition flex items-center justify-between hover:opacity-90 active:scale-95"
                      style={{ background: style.bg, color: style.text }}
                    >
                      {label.title}
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </div>
                  </div>
                );
              })}
              {labels.length === 0 && !creating && (
                <p className="text-[10px] text-center text-gray-400 py-4 italic font-medium">No labels found. Create one below!</p>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              {creating ? (
                <div className="space-y-4 p-1">
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Label title (e.g. Frontend)..." className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none bg-white shadow-sm font-semibold" />

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Pick Color</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {Object.keys(LABEL_COLORS).map(c => (
                        <div key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-lg cursor-pointer border-2 transition-all hover:scale-110 active:scale-90 ${newColor === c ? "border-indigo-600 shadow-md scale-110" : "border-white"}`} style={{ background: LABEL_COLORS[c].bg }} />
                      ))}

                      {/* Custom Color Picker */}
                      <div className="relative group">
                        <input
                          type="color"
                          value={newColor.startsWith("#") ? newColor : "#6366f1"}
                          onChange={e => setNewColor(e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <div
                          className={`w-10 h-6 rounded-lg border-2 transition-all flex items-center justify-center text-[10px] ${newColor.startsWith("#") ? "border-indigo-600 shadow-md" : "border-gray-200"}`}
                          style={{ background: newColor.startsWith("#") ? newColor : "#f3f4f6" }}
                        >
                          {newColor.startsWith("#") ? "✨" : "🎨"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-center">
                    <div
                      className="px-3 py-1 rounded-lg text-[10px] font-black transition-all"
                      style={{ background: getLabelStyle(newColor).bg, color: getLabelStyle(newColor).text }}
                    >
                      {newTitle || "PREVIEW"}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={createLabel} disabled={!newTitle.trim()} className="flex-1 text-[10px] font-black uppercase tracking-wider py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-40 transition-all active:scale-95">Create Label</button>
                    <button onClick={() => setCreating(false)} className="px-4 text-[10px] font-black uppercase tracking-wider py-2.5 bg-white border border-gray-200 text-gray-400 rounded-xl transition-all hover:bg-gray-50 active:scale-95">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="w-full text-[10px] font-black uppercase tracking-widest py-2.5 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all active:scale-95">
                  + Create new label
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TASK MODAL
═══════════════════════════════════════════ */
function TaskModal({
  open, onClose, onSubmit, users, columns, projectColor, initialData, stories,
  currentUserId, isProjectManager, allowedTypes,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (data: Partial<Task>) => Promise<void>;
  users: any[]; columns: KanbanColumn[]; projectColor: string;
  initialData?: Partial<Task> | null;
  stories?: Task[];
  currentUserId?: string;
  isProjectManager?: boolean;
  allowedTypes?: TicketType[];
}) {
  const isEdit = !!(initialData?.id);
  const allowed = allowedTypes || ["task"];

  const [form, setForm] = useState<Partial<Task>>({
    title: "", description: "", priority: "Medium",
    status: columns[0]?.id || "todo",
    estimatedHours: 0, storyPoints: 0, tags: [],
    ticketType: allowed[0] || "task",
    parentStoryId: "", parentStoryTitle: "",
    ...initialData,
  });
  const [tagsInput, setTagsInput] = useState((initialData?.tags || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [childTickets, setChildTickets] = useState<Partial<Task>[]>([]);
  const [newChild, setNewChild] = useState({ title: "", ticketType: "task" as TicketType, priority: "Medium" });
  const [previewCode, setPreviewCode] = useState<string>("");

  useEffect(() => {
    const ticketType = initialData?.ticketType || allowed[0] || "task";
    setForm({
      title: "", description: "", priority: "Medium",
      status: columns[0]?.id || "new",
      estimatedHours: 0, storyPoints: 0, tags: [],
      ticketType,
      parentStoryId: "", parentStoryTitle: "",
      ...initialData,
    });
    setTagsInput((initialData?.tags || []).join(", "));
    setChildTickets([]);
    setNewChild({ title: "", ticketType: "task", priority: "Medium" });
    if (!isEdit) {
      const type = initialData?.ticketType || allowed[0] || "task";
      const projectId = initialData?.projectId;
      const prefixMap: Record<string, string> = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };
      if (projectId) {
        getDocs(query(collection(db, "projectTasks"), where("projectId", "==", projectId), where("ticketType", "==", type))).then(snap => {
          setPreviewCode(`${prefixMap[type]}-${String(snap.size + 1).padStart(3, "0")}`);
        });
      } else {
        setPreviewCode(`${prefixMap[type]}-???`);
      }
    }
  }, [initialData?.id, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      await onSubmit({ ...form, tags, childTickets: childTickets.length > 0 ? childTickets : undefined } as any);
    } finally { setSaving(false); }
  };

  const addChildTicket = () => {
    if (!newChild.title.trim()) return;
    setChildTickets(prev => [...prev, { ...newChild, id: nanoid() }]);
    setNewChild({ title: "", ticketType: "task", priority: "Medium" });
  };
  const removeChild = (idx: number) => setChildTickets(prev => prev.filter((_, i) => i !== idx));

  const isStory = form.ticketType === "story";
  const tc = TICKET_TYPES[form.ticketType || "task"];

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${projectColor}15, ${projectColor}05)` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: tc.bg, border: `1.5px solid ${tc.border}` }}>{tc.icon}</div>
              <div>
                <h2 className="font-black text-gray-900 text-base">{isEdit ? `Edit ${tc.label}` : `Create ${tc.label}`}</h2>
                <p className="text-xs text-gray-400">{tc.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LabelPicker
                projectId={form.projectId || ""}
                selectedLabels={form.labels || []}
                onChange={(labels) => setForm(f => ({ ...f, labels }))}
              />
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition text-sm">✕</button>
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="shrink-0 px-6 pt-4 pb-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ticket Type</p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(TICKET_TYPES) as TicketType[]).map(type => {
                const cfg = TICKET_TYPES[type];
                const selected = form.ticketType === type;
                const isAllowed = isProjectManager || allowed.includes(type);
                return (
                  <button key={type}
                    onClick={() => {
                      if (!isAllowed) return;
                      setForm(f => ({ ...f, ticketType: type }));
                      if (initialData?.projectId) {
                        const prefixMap: Record<string, string> = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };
                        getDocs(query(collection(db, "projectTasks"), where("projectId", "==", initialData.projectId), where("ticketType", "==", type))).then(snap => {
                          setPreviewCode(`${prefixMap[type]}-${String(snap.size + 1).padStart(3, "0")}`);
                        });
                      }
                    }}
                    disabled={!isAllowed}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all relative"
                    style={{ borderColor: selected ? cfg.color : "#e5e7eb", background: selected ? cfg.bg : isAllowed ? "white" : "#f9fafb", boxShadow: selected ? `0 0 0 3px ${cfg.color}20` : "none", opacity: isAllowed ? 1 : 0.45, cursor: isAllowed ? "pointer" : "not-allowed" }}>
                    {!isAllowed && <span className="absolute top-1 right-1 text-[9px]">🔒</span>}
                    <span className="text-xl">{cfg.icon}</span>
                    <span className="text-[11px] font-black" style={{ color: selected ? cfg.color : isAllowed ? "#6b7280" : "#9ca3af" }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!isStory && stories && stories.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Link to Story <span className="text-gray-300 normal-case font-normal">(optional)</span></label>
              <select value={form.parentStoryId || ""}
                onChange={e => { const story = stories.find(s => s.id === e.target.value); setForm(f => ({ ...f, parentStoryId: e.target.value, parentStoryTitle: story?.title || "" })); }}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— No parent story —</option>
                {stories.map(s => <option key={s.id} value={s.id}>📖 {s.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Task ID</label>
            <input value={isEdit ? (form.taskCode || "") : previewCode} readOnly className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 font-mono bg-gray-50 text-gray-500 cursor-default" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Title <span className="text-red-400">*</span></label>
            <input autoFocus value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={`e.g. ${form.ticketType === "story" ? "As a user, I want to..." : form.ticketType === "bug" ? "Login button not responding on mobile" : "Implement search functionality"}`}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
            <textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add details, acceptance criteria, steps to reproduce..." rows={8} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-vertical" />
          </div>

          {/* Bug Image Upload */}
          {form.ticketType === "bug" && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Bug Screenshot</label>
              <div className="flex flex-col gap-3">
                {(form.imageUrl || (form.images && form.images.length > 0)) && (
                  <div className="relative group self-start">
                    <img 
                      src={form.imageUrl || form.images?.[0]?.url} 
                      alt="Bug screenshot" 
                      className="h-32 w-auto object-cover rounded-xl border border-gray-200 shadow-sm"
                    />
                    <button
                      onClick={() => setForm(f => ({ ...f, imageUrl: "", images: [] }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = new window.Image();
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          let { width, height } = img;
                          const MAX_DIM = 800;
                          if (width > height && width > MAX_DIM) {
                            height *= MAX_DIM / width;
                            width = MAX_DIM;
                          } else if (height > MAX_DIM) {
                            width *= MAX_DIM / height;
                            height = MAX_DIM;
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext("2d");
                          ctx?.drawImage(img, 0, 0, width, height);
                          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                          setForm(f => ({
                            ...f,
                            imageUrl: compressedBase64,
                            images: [{ url: compressedBase64, name: file.name, uploadedAt: new Date().toISOString() }]
                          }));
                        };
                        img.src = ev.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Priority</label>
              <select value={form.priority || "Medium"} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">KanbanColumn</label>
              <select value={form.status || columns[0]?.id} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Due Date</label>
              <input type="datetime-local" value={form.dueDate || ""} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Assignee</label>
              <select value={form.assignedTo || ""}
                onChange={e => {
                  const u = users?.find((u: any) => u.uid === e.target.value);
                  setForm(f => ({ ...f, assignedTo: e.target.value, assignedToName: u ? (u.displayName?.trim() || u.name?.trim() || null) : null }));
                }}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">Unassigned</option>
                {!isProjectManager && currentUserId && (
                  <option value={currentUserId}>
                    {users?.find((u: any) => u.uid === currentUserId)?.displayName?.trim() || users?.find((u: any) => u.uid === currentUserId)?.name?.trim() || "Assign to me"}
                  </option>
                )}
                {users?.filter((u: any) => isProjectManager || u.uid !== currentUserId).map((u: any) => (
                  <option key={u.uid} value={u.uid}>{u.displayName?.trim() || u.name?.trim() || "Unknown"}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Est. Hours</label>
              <input type="number" value={form.estimatedHours || 0} onChange={e => setForm(f => ({ ...f, estimatedHours: parseFloat(e.target.value) || 0 }))} min={0} step={0.5} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Story Points</label>
              <input type="number" value={form.storyPoints || 0} onChange={e => setForm(f => ({ ...f, storyPoints: parseInt(e.target.value) || 0 }))} min={0} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Tags (csv)</label>
              <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="ui, backend, bug" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {isStory && !isEdit && (
            <div className="border border-purple-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📖</span>
                  <p className="text-xs font-black text-purple-700 uppercase tracking-wider">Child Tickets</p>
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">{childTickets.length}</span>
                </div>
                <p className="text-[10px] text-purple-400">Add tasks, bugs & defects under this story</p>
              </div>
              {childTickets.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {childTickets.map((c, i) => {
                    const cfg = TICKET_TYPES[c.ticketType || "task"];
                    const pc = PRIORITY_CONFIG[c.priority || "Medium"];
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition group">
                        <span className="text-base shrink-0">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: pc.bg, color: pc.color }}>{pc.icon} {c.priority}</span>
                          </div>
                        </div>
                        <button onClick={() => removeChild(i)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-xs transition">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                <div className="flex gap-2 mb-2">
                  {(["task", "bug", "defect"] as TicketType[]).map(type => {
                    const cfg = TICKET_TYPES[type];
                    const sel = newChild.ticketType === type;
                    return (
                      <button key={type} onClick={() => setNewChild(n => ({ ...n, ticketType: type }))}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border-2 transition"
                        style={{ borderColor: sel ? cfg.color : "#e5e7eb", background: sel ? cfg.bg : "white", color: sel ? cfg.color : "#9ca3af" }}>
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                  <select value={newChild.priority} onChange={e => setNewChild(n => ({ ...n, priority: e.target.value }))} className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none bg-white">
                    {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={newChild.title} onChange={e => setNewChild(n => ({ ...n, title: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addChildTicket()}
                    placeholder={`Add a ${newChild.ticketType} to this story...`}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
                  <button onClick={addChildTicket} disabled={!newChild.title.trim()} className="px-3 py-2 text-xs font-bold text-white rounded-xl disabled:opacity-40 transition" style={{ background: "#7c3aed" }}>+ Add</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tc.icon}</span>
            <span className="text-xs font-semibold text-gray-500">
              {isEdit ? "Editing" : "Creating"} <span style={{ color: tc.color }}>{tc.label}</span>
              {isStory && !isEdit && childTickets.length > 0 && <span className="ml-1 text-purple-500">+ {childTickets.length} child{childTickets.length !== 1 ? "ren" : ""}</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button onClick={handleSubmit} disabled={!form.title?.trim() || saving} className="px-5 py-2 text-sm font-bold rounded-xl text-white shadow-sm disabled:opacity-40 transition" style={{ background: `linear-gradient(135deg, ${projectColor}, ${projectColor}cc)` }}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : `Create ${tc.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ═══════════════════════════════════════════
   TASK DETAIL MODAL
═══════════════════════════════════════════ */
function TaskDetailModal({
  task, onClose, columns, projectColor, projectName, currentUserId,
  isProjectManager, canDelete, users, onStatusChange, onSave,
  db: firestoreDb, storage: firebaseStorage, user,
  sprints, onMoveToSprint, onEditTask, tasks, onAddChildToStory,
}: {
  task: Task; onClose: () => void; columns: KanbanColumn[]; projectColor: string; projectName: string;
  currentUserId: string; isProjectManager: boolean; canDelete: boolean; users: any[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onSave: (updated: Task) => Promise<void>;
  db: any; storage: any; user: any;
  sprints: any[];
  onMoveToSprint: (task: Task, sprintId: string | null) => void;
  onEditTask: (task: Task) => void;
  tasks: Task[];
  onAddChildToStory: (story: Task, ticketType: TicketType) => void;
}) {
  const [taskTab, setTaskTab] = useState<"details" | "storytasks" | "subtasks" | "images" | "files" | "comments" | "worklogs" | "empsheet" | "history">("details");
  const [comments, setComments] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [taskWorklogs, setTaskWorklogs] = useState<WorkLog[]>([]);
  const [taskEmpEntries, setTaskEmpEntries] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showWorkLogForm, setShowWorkLogForm] = useState(false);
  const [localTask, setLocalTask] = useState<Task>(task);
  const [saving, setSaving] = useState(false);
  const [wl, setWl] = useState({ description: "", hoursWorked: "", workStatus: "In Progress" as WorkLog["workStatus"], date: new Date().toISOString().split("T")[0] });
  const [workDesc, setWorkDesc] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [workStatus, setWorkStatus] = useState<"done" | "progress" | "blocked">("progress");
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [showSprintMove, setShowSprintMove] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  const toggleSubtask = async (st: any) => {
    await updateDoc(doc(firestoreDb, "subtasks", st.id), { done: !st.done });
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskText.trim()) return;
    await addDoc(collection(firestoreDb, "subtasks"), {
      taskId: task.id,
      projectId: task.projectId,
      text: newSubtaskText.trim(),
      done: false,
      createdAt: serverTimestamp(),
    });
    setNewSubtaskText("");
  };

  const handleDeleteSubtask = async (stId: string) => {
    if (confirm("Delete this subtask?")) {
      await deleteDoc(doc(firestoreDb, "subtasks", stId));
    }
  };

  const canEdit = isProjectManager || task.assignedTo === currentUserId;
  const userName = user?.displayName || user?.email?.split("@")[0] || "";
  const tc = TICKET_TYPES[task.ticketType || "task"];
  const pc = PRIORITY_CONFIG[task.priority];
  const currentSprint = sprints.find(s => s.id === task.sprintId);

  useEffect(() => { setLocalTask(task); }, [task.id]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(firestoreDb, "taskComments"), where("taskId", "==", task.id), orderBy("createdAt", "asc")), s => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(firestoreDb, "taskFiles"), where("taskId", "==", task.id), orderBy("createdAt", "desc")), s => setTaskFiles(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(firestoreDb, "subtasks"), where("taskId", "==", task.id)), s => setSubtasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(firestoreDb, "workLogs"), where("taskId", "==", task.id), orderBy("createdAt", "desc")), s => setTaskWorklogs(s.docs.map(d => ({ id: d.id, ...d.data() } as WorkLog))));
    const u5 = onSnapshot(query(collection(firestoreDb, "dailyEntries"), where("taskId", "==", task.id), orderBy("createdAt", "desc")), s => setTaskEmpEntries(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [task.id]);

  const handleAddEmpWork = async () => {
    if (!workDesc.trim() || !workHours) return;
    setEmpSubmitting(true);
    try {
      await addDoc(collection(firestoreDb, "dailyEntries"), {
        userId: currentUserId, userName, projectId: task.projectId, projectName,
        taskId: task.id, taskTitle: task.title,
        description: workDesc, hoursWorked: Number(workHours),
        workStatus: workStatus === "done" ? "Completed" : workStatus === "progress" ? "In Progress" : "Blocked",
        date: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7),
        tasks: [{ id: nanoid(), projectId: task.projectId, projectName, taskTitle: task.title, description: workDesc, hoursWorked: Number(workHours), workStatus: workStatus === "done" ? "Completed" : workStatus === "progress" ? "In Progress" : "Blocked", category: "Development" }],
        totalHours: Number(workHours), status: "submitted",
        submittedAt: serverTimestamp(), createdAt: serverTimestamp(),
      });
      setWorkDesc(""); setWorkHours(""); setWorkStatus("progress");
    } finally { setEmpSubmitting(false); }
  };

  const handleSave = async () => { setSaving(true); try { await onSave(localTask); } finally { setSaving(false); } };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(firestoreDb, "taskComments"), { taskId: task.id, projectId: task.projectId, userId: currentUserId, userName, text: commentText, createdAt: serverTimestamp() });
    setCommentText("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.size > 700 * 1024) { 
      alert("Non-image files must be under 700KB to store in the database. Please use smaller files."); 
      return; 
    }

    setUploading(true);
    try {
      const reader = new FileReader();

      if (file.type.startsWith("image/")) {
        reader.onload = (ev) => {
          const img = new window.Image();
          img.onload = async () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            const MAX_DIM = 800; // compress large images
            if (width > height && width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            } else if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
            await addDoc(collection(firestoreDb, "taskFiles"), {
              taskId: task.id,
              projectId: task.projectId,
              fileName: file.name,
              fileUrl: compressedBase64,
              uploadedBy: currentUserId,
              uploadedByName: userName,
              createdAt: serverTimestamp(),
            });
            setUploading(false);
          };
          img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          if (base64) {
            await addDoc(collection(firestoreDb, "taskFiles"), {
              taskId: task.id,
              projectId: task.projectId,
              fileName: file.name,
              fileUrl: base64,
              uploadedBy: currentUserId,
              uploadedByName: userName,
              createdAt: serverTimestamp(),
            });
          }
          setUploading(false);
        };
        reader.onerror = () => {
          alert("Failed to read file.");
          setUploading(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) { alert(`Upload failed: ${err.message}`); setUploading(false); }
  };

  const handleSubmitWorkLog = async () => {
    if (!wl.description.trim() || !wl.hoursWorked) return;
    await addDoc(collection(firestoreDb, "workLogs"), { userId: currentUserId, userName, projectId: task.projectId, projectName, taskId: task.id, taskName: task.title, description: wl.description, hoursWorked: Number(wl.hoursWorked), workStatus: wl.workStatus, date: wl.date, createdAt: serverTimestamp() });
    const td = await getDocs(query(collection(firestoreDb, "projectTasks"), where("projectId", "==", task.projectId)));
    const found = td.docs.find(d => d.id === task.id);
    if (found) await updateDoc(doc(firestoreDb, "projectTasks", task.id), { actualHours: (found.data().actualHours || 0) + Number(wl.hoursWorked) });
    setWl({ description: "", hoursWorked: "", workStatus: "In Progress", date: new Date().toISOString().split("T")[0] });
    setShowWorkLogForm(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await deleteDoc(doc(firestoreDb, "projectTasks", task.id)); onClose(); }
    catch (err) { console.error("Delete failed", err); setDeleting(false); }
  };

  const subtasksDone = subtasks.filter(s => s.done).length;
  const totalLoggedHours = taskWorklogs.reduce((s, l) => s + l.hoursWorked, 0);
  const totalEmpHours = taskEmpEntries.reduce((s, e) => s + (e.hoursWorked || 0), 0);

  const storyTasks = tasks.filter(t => t.parentStoryId === task.id);

  const TABS = [
    { id: "details", icon: "📋", label: "Details", badge: null },
    ...(task.ticketType === "story" ? [{ id: "storytasks", icon: "🎯", label: "Tasks", badge: storyTasks.length > 0 ? String(storyTasks.length) : null }] : []),
    { id: "subtasks", icon: "✅", label: "Subtasks", badge: subtasks.length > 0 ? `${subtasksDone}/${subtasks.length}` : null },
    { id: "images", icon: "🖼️", label: "Images", badge: task.images && task.images.length > 0 ? String(task.images.length) : null },
    { id: "files", icon: "📎", label: "Files", badge: taskFiles.length > 0 ? String(taskFiles.length) : null },
    { id: "comments", icon: "💬", label: "Comments", badge: comments.length > 0 ? String(comments.length) : null },
    { id: "worklogs", icon: "⏱", label: "Logs", badge: taskWorklogs.length > 0 ? `${totalLoggedHours}h` : null },
    { id: "empsheet", icon: "📝", label: "My Work", badge: taskEmpEntries.length > 0 ? `${totalEmpHours}h` : null },
    { id: "history", icon: "📜", label: "Activity", badge: null },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-stretch" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${projectColor} 0%, ${projectColor}cc 100%)` }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg bg-white/20">{tc.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-white/70">{projectName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] font-bold text-white/50 tracking-wider">
                      {tc.label} {task.taskCode && `· ${task.taskCode}`}
                    </p>
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/public/task/${task.id}`;
                        navigator.clipboard.writeText(url);
                        alert("Public Shareable Link copied to clipboard!");
                      }} 
                      className="text-white/50 hover:text-white transition-colors" 
                      title="Copy Link"
                    >
                      🔗
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-center">
                <LabelPicker
                  projectId={task.projectId}
                  selectedLabels={localTask.labels || []}
                  disabled={!canEdit && !isProjectManager}
                  canManage={true}
                  onChange={async (labels) => {
                    setLocalTask(t => ({ ...t, labels }));
                    // Immediate save for labels as per standard Kanban UX
                    if (canEdit || isProjectManager) {
                      try {
                        await updateDoc(doc(firestoreDb, "projectTasks", task.id), { labels });
                      } catch (err) {
                        console.error("Error saving labels:", err);
                      }
                    }
                  }}
                />
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-1.5">
                {isProjectManager && (
                  <button onClick={() => setShowSprintMove(true)} title="Move to sprint"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                    style={{ background: currentSprint ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
                    onMouseLeave={e => e.currentTarget.style.background = currentSprint ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)"}>
                    🏃 {currentSprint ? currentSprint.name : "Sprint"}
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => onEditTask(task)} title="Edit task"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.28)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}>
                    ✏️ Edit
                  </button>
                )}
                {canDelete && (
                  <button onClick={handleDelete} disabled={deleting} title="Delete task"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    style={{ background: "rgba(239,68,68,0.25)", color: "white", border: "1px solid rgba(239,68,68,0.4)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.4)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.25)"}>
                    🗑 {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button onClick={onClose} title="Close"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}>
                  ✕
                </button>
              </div>
            </div>



            {canEdit && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isProjectManager && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user?.accountType === "ADMIN" ? "bg-indigo-500/20 text-indigo-200" : "bg-yellow-400/20 text-yellow-200"}`}>
                      👑 {user?.accountType === "ADMIN" ? "Admin" : "Team Lead"}
                    </span>
                  )}
                  {!isProjectManager && canEdit && <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">✏️ Your Task</span>}
                </div>
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-lg transition disabled:opacity-50">
                  {saving ? "Saving..." : "💾 Save"}
                </button>
              </div>
            )}
            {!canEdit && <div className="mb-2"><span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded-full">👁 View Only</span></div>}

            <input value={localTask.title} disabled={!canEdit}
              onChange={e => setLocalTask(t => ({ ...t, title: e.target.value }))}
              className="text-xl font-bold bg-transparent text-white outline-none w-full placeholder-white/50 mb-3 disabled:cursor-default"
              placeholder="Task title..." />

            <div className="flex flex-wrap gap-2 items-center">
              <TicketBadge type={task.ticketType} />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: pc?.bg, color: pc?.color }}>{pc?.icon} {task.priority}</span>
              {currentSprint && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/20 text-white flex items-center gap-1">🏃 {currentSprint.name}</span>}
              {task.parentStoryTitle && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/20 text-white flex items-center gap-1">📖 {task.parentStoryTitle}</span>}
              {task.tags?.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white">#{t}</span>)}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-white/20 overflow-x-auto">
            {TABS.map(({ id, icon, label, badge }) => (
              <button key={id} onClick={() => setTaskTab(id as any)}
                className={`flex-1 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1 whitespace-nowrap px-2 ${taskTab === id ? "bg-white/20 text-white border-b-2 border-white" : "text-white/60 hover:text-white/80"}`}>
                {icon} {label}
                {badge && <span className="bg-white/30 text-white text-[10px] rounded-full px-1.5 py-0.5">{badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
          {taskTab === "details" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
                {!canEdit ? (
                  <div className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-700 min-h-[150px] whitespace-pre-wrap overflow-y-auto max-h-[500px]">
                    {localTask.description || "No description..."}
                  </div>
                ) : (
                  <textarea value={localTask.description || ""}
                    onChange={e => setLocalTask(t => ({ ...t, description: e.target.value }))} rows={12}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-vertical bg-white"
                    placeholder="No description..." />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Status</p>
                  {canEdit
                    ? <select value={localTask.status} onChange={e => { setLocalTask(t => ({ ...t, status: e.target.value })); onStatusChange(task.id, e.target.value); }}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    : <span className="text-xs font-semibold" style={{ color: getColStyle(task.status, columns.findIndex(c => c.id === task.status)).color }}>
                      {columns.find(c => c.id === task.status)?.label ?? task.status}
                    </span>
                  }
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Assignee</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={task.assignedToName} size="xs" highlight={task.assignedTo === currentUserId} />
                    <span className="text-sm font-semibold text-gray-700">
                      {task.assignedToName && !task.assignedToName.includes("@") ? task.assignedToName : task.assignedTo ? "Unknown" : "Unassigned"}
                      {task.assignedTo === currentUserId && " (You)"}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Due Date</p>
                  <p className={`text-sm font-semibold ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-600" : "text-gray-700"}`}>
                    {task.dueDate || "No date set"}{task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && " ⚠️"}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Created By</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={task.createdByName} size="xs" />
                    <span className="text-sm font-semibold text-gray-700">
                      {task.createdByName || "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Story Points</p>
                  <p className="text-2xl font-black" style={{ color: projectColor }}>{task.storyPoints || 0}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Time Tracking</h3>
                <div className="flex items-center gap-4">
                  <ProgressRing pct={task.estimatedHours ? Math.min(((task.actualHours || 0) / task.estimatedHours) * 100, 100) : 0} color={projectColor} />
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div><p className="text-2xl font-black text-gray-900">{task.estimatedHours || 0}h</p><p className="text-xs text-gray-400">Estimated</p></div>
                    <div><p className="text-2xl font-black" style={{ color: projectColor }}>{task.actualHours || 0}h</p><p className="text-xs text-gray-400">Logged</p></div>
                  </div>
                </div>
              </div>

              {subtasks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtask Progress</h3>
                    <span className="text-xs font-bold" style={{ color: projectColor }}>{subtasks.filter(s => s.done).length}/{subtasks.length} ({Math.round((subtasks.filter(s => s.done).length / subtasks.length) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-50">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(subtasks.filter(s => s.done).length / subtasks.length) * 100}%`, background: subtasks.filter(s => s.done).length === subtasks.length ? "#22c55e" : projectColor }} />
                  </div>
                </div>
              )}

            </div>
          )}

          {taskTab === "storytasks" && task.ticketType === "story" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Story Tasks</h3>
                  <p className="text-[10px] text-gray-400 font-bold">Associated tasks, bugs, and defects</p>
                </div>
                {isProjectManager && (
                  <button
                    onClick={() => onAddChildToStory(task, "task")}
                    className="px-3 py-1.5 text-[10px] font-black bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                  >
                    <span className="text-xs">+</span> Add Task
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {tasks.filter(t => t.parentStoryId === task.id && t.ticketType !== "story").length === 0 ? (
                  <div className="px-6 py-16 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🎯</div>
                    <h4 className="text-sm font-black text-gray-300 uppercase tracking-[0.2em]">No tasks found</h4>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-wider">Start by adding a new task to this story</p>
                  </div>
                ) : (
                  tasks.filter(t => t.parentStoryId === task.id && t.ticketType !== "story").map(child => {
                    const tc = TICKET_TYPES[child.ticketType || "task"];
                    const colIdx = columns.findIndex(c => c.id === child.status);
                    const cs = getColStyle(child.status, colIdx >= 0 ? colIdx : 0);
                    return (
                      <div key={child.id} onClick={() => onEditTask(child)}
                        className="group hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-wrap sm:flex-nowrap items-center gap-4 px-5 py-4 cursor-pointer rounded-2xl border border-transparent hover:border-gray-100 active:scale-[0.98]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                          <span className="text-lg">{tc.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-gray-50 text-gray-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-colors">{child.taskCode || "TSK"}</span>
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">{tc.label}</span>
                          </div>
                          <h4 className="text-sm font-black text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors">{child.title}</h4>
                        </div>
                        <div className="flex items-center gap-5 shrink-0 ml-auto sm:ml-0">
                          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gray-50/50 group-hover:bg-indigo-50/50 transition-colors">
                            <Avatar name={child.assignedToName} size="xs" />
                            <span className="text-[11px] font-black text-gray-600 hidden sm:inline truncate max-w-[80px]">{child.assignedToName?.split(" ")[0] || "Unassigned"}</span>
                          </div>
                          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gray-100 bg-white shadow-sm min-w-[110px] justify-center transition-all group-hover:border-indigo-100 group-hover:shadow-indigo-500/5">
                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: cs.color }} />
                            <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[80px]" style={{ color: cs.color }}>{columns.find(c => c.id === child.status)?.label || child.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {taskTab === "images" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Task Images</h3>
              <TaskImages 
                taskId={task.id} 
                projectId={task.projectId} 
                projectColor={projectColor} 
                images={task.images || []}
                canManage={canEdit || isProjectManager}
              />
            </div>
          )}

          {taskTab === "subtasks" && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{subtasksDone}/{subtasks.length}</span>
              </div>
              {subtasks.map(st => (
                <div key={st.id} onClick={() => toggleSubtask(st)} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${st.done ? "opacity-60 bg-gray-50/50" : "hover:bg-gray-50"} transition border border-transparent hover:border-gray-100`}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 transition-colors" style={{ background: st.done ? projectColor : "transparent", borderColor: st.done ? projectColor : "#d1d5db" }}>
                    {st.done && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <span className={`text-sm flex-1 ${st.done ? "line-through text-gray-400" : "text-gray-700"}`}>{st.text}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {st.done ? "COMPLETED" : "PENDING"}
                  </span>
                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSubtask(st.id); }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete Subtask"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {subtasks.length === 0 && <p className="text-xs text-gray-400 text-center py-4 italic">No subtasks assigned yet.</p>}

              {canEdit && (
                <div className="flex gap-2 pt-2 border-t border-gray-50 mt-2">
                  <input
                    value={newSubtaskText}
                    onChange={e => setNewSubtaskText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddSubtask()}
                    placeholder="Assign a new subtask..."
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button onClick={handleAddSubtask} className="px-4 py-2 text-white text-[10px] font-bold rounded-lg shadow-sm transition hover:opacity-90" style={{ background: projectColor }}>
                    ADD
                  </button>
                </div>
              )}
            </div>
          )}

          {taskTab === "files" && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Files ({taskFiles.length})</h3>
                <label className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer ${uploading ? "opacity-50" : ""}`} style={{ background: projectColor }}>
                  {uploading ? "Uploading..." : "📤 Upload"}
                  <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {taskFiles.length === 0
                ? <div className="text-center py-8 text-gray-300"><div className="text-4xl mb-2">📁</div><p className="text-sm">No files</p></div>
                : <div className="space-y-2">{taskFiles.map(f => (
                  <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xl">{f.fileName.match(/\.(png|jpg|jpeg|gif)$/i) ? "🖼️" : f.fileName.match(/\.pdf$/i) ? "📕" : "📄"}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{f.fileName}</p><p className="text-xs text-gray-400">{f.uploadedByName}</p></div>
                    <span className="text-gray-300">↗</span>
                  </a>
                ))}</div>
              }
            </div>
          )}

          {taskTab === "comments" && (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className={`flex gap-3 ${c.userId === currentUserId ? "flex-row-reverse" : ""}`}>
                  <Avatar name={c.userName} size="sm" />
                  <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${c.userId === currentUserId ? "rounded-tr-sm text-white" : "rounded-tl-sm bg-white border border-gray-100"}`}
                    style={c.userId === currentUserId ? { background: projectColor } : {}}>
                    <p className={`text-[10px] font-semibold mb-1 ${c.userId === currentUserId ? "text-white/70" : "text-gray-400"}`}>{c.userName} · {c.createdAt?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    <p className={`text-sm leading-relaxed ${c.userId === currentUserId ? "text-white" : "text-gray-700"}`}>{c.text}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <div className="text-center py-12 text-gray-300"><div className="text-5xl mb-3">💬</div><p className="text-sm">No comments yet</p></div>}
            </div>
          )}

          {taskTab === "worklogs" && (
            <div className="space-y-4">
              {canEdit && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Log Work</h3>
                    <button onClick={() => setShowWorkLogForm(!showWorkLogForm)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition" style={{ background: projectColor }}>
                      {showWorkLogForm ? "Cancel" : "⏱ Log Hours"}
                    </button>
                  </div>
                  {showWorkLogForm && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                      <textarea value={wl.description} onChange={e => setWl({ ...wl, description: e.target.value })} placeholder="What did you work on?" rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={wl.hoursWorked} onChange={e => setWl({ ...wl, hoursWorked: e.target.value })} placeholder="Hours" min="0.5" step="0.5" className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
                        <select value={wl.workStatus} onChange={e => setWl({ ...wl, workStatus: e.target.value as any })} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none">
                          <option>In Progress</option><option>Completed</option><option>Blocked</option>
                        </select>
                        <input type="date" value={wl.date} onChange={e => setWl({ ...wl, date: e.target.value })} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
                      </div>
                      <button onClick={handleSubmitWorkLog} disabled={!wl.description.trim() || !wl.hoursWorked} className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition" style={{ background: projectColor }}>Submit Work Log</button>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">All Work Logs</h3>
                  <span className="text-sm font-black" style={{ color: projectColor }}>{totalLoggedHours}h total</span>
                </div>
                {taskWorklogs.length === 0
                  ? <div className="text-center py-10 text-gray-300"><div className="text-4xl mb-2">⏱</div><p className="text-sm">No work logged yet</p></div>
                  : <div className="divide-y divide-gray-50">
                    {taskWorklogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition">
                        <Avatar name={log.userName} size="sm" highlight={log.userId === currentUserId} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-gray-700">{log.userName}</span>
                            {log.userId === currentUserId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: projectColor }}>You</span>}
                          </div>
                          <p className="text-sm text-gray-600">{log.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{log.date}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.workStatus === "Completed" ? "bg-green-100 text-green-700" : log.workStatus === "Blocked" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{log.workStatus}</span>
                          </div>
                        </div>
                        <span className="text-xl font-black shrink-0" style={{ color: projectColor }}>{log.hoursWorked}h</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          )}

          {taskTab === "empsheet" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#534AB7" strokeWidth="1.2" /><path d="M5 6h6M5 9h4" stroke="#534AB7" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  <span className="text-sm font-semibold text-gray-800">Add daily work</span>
                </div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">What did you work on?</label>
                <textarea placeholder="Describe what you completed today…" rows={3}
                  className="w-full resize-y text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  value={workDesc} onChange={e => setWorkDesc(e.target.value)} />
                <div className="flex gap-3 mt-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours</label>
                    <input type="text" placeholder="e.g. 2.5" className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors" value={workHours} onChange={e => setWorkHours(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
                      {(["done", "progress", "blocked"] as const).map((s, i) => (
                        <button key={s} onClick={() => setWorkStatus(s)}
                          className={`flex-1 py-2 px-2 font-medium transition-colors ${i < 2 ? "border-r border-gray-200" : ""} ${workStatus === s ? s === "done" ? "bg-green-50 text-green-800 font-semibold" : s === "progress" ? "bg-indigo-50 text-indigo-800 font-semibold" : "bg-red-50 text-red-800 font-semibold" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                          {s === "done" ? "Completed" : s === "progress" ? "In progress" : "Blocked"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={handleAddEmpWork} disabled={!workDesc.trim() || !workHours || empSubmitting}
                  className="mt-4 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all disabled:opacity-40 active:scale-[0.97]"
                  style={{ background: projectColor }}>
                  {empSubmitting ? "Submitting..." : "Submit work"}
                </button>
              </div>
              {taskEmpEntries.length === 0
                ? <p className="text-center text-sm text-gray-400 py-6">No entries yet — add your first work log above.</p>
                : <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Work History</h3>
                    <span className="text-sm font-black" style={{ color: projectColor }}>{totalEmpHours}h total</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {taskEmpEntries.map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition">
                        <Avatar name={entry.userName} size="sm" highlight={entry.userId === currentUserId} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-gray-800">{entry.userName}</span>
                            {entry.userId === currentUserId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: projectColor }}>You</span>}
                          </div>
                          <p className="text-sm text-gray-600">{entry.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{entry.date}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${entry.workStatus === "Completed" ? "bg-green-100 text-green-700" : entry.workStatus === "Blocked" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{entry.workStatus}</span>
                          </div>
                        </div>
                        <span className="text-xl font-black shrink-0" style={{ color: projectColor }}>{entry.hoursWorked}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            </div>
          )}

          {taskTab === "history" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <TaskActivityTimeline taskId={task.id} projectColor={projectColor} />
            </div>
          )}
        </div>

        {taskTab === "comments" && (
          <div className="shrink-0 p-4 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <Avatar name={userName} size="sm" />
              <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..."
                onKeyDown={e => e.key === "Enter" && handleAddComment()}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={handleAddComment} disabled={!commentText.trim()} className="px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-40" style={{ background: projectColor }}>Send</button>
            </div>
          </div>
        )}

        {showSprintMove && task && (
          <MoveToSprintModal
            open={showSprintMove}
            task={task}
            currentSprintId={task.sprintId}
            sprints={sprints}
            onClose={() => setShowSprintMove(false)}
            onMoved={() => setShowSprintMove(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}


/* ═══════════════════════════════════════════
   EMPLOYEE DAILY SHEET
═══════════════════════════════════════════ */
function EmployeeDailySheet({ user, projects }: { user: any; projects: any[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<"calendar" | "fill" | "summary">("calendar");
  const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
  const [taskList, setTaskList] = useState<DailyTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [tf, setTf] = useState({ projectId: "", taskTitle: "", description: "", hoursWorked: 1, workStatus: "Completed" as DailyTask["workStatus"], category: "Development" });

  const userName = user?.displayName || user?.email?.split("@")[0] || "";
  const myProjects = projects?.filter(p => user?.accountType === "ADMIN" || p.members?.includes(user?.uid)) || [];

  const parsedYear = parseInt(viewMonth.split("-")[0], 10);
  const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1;
  const daysInMonth = getDaysInMonth(parsedYear, parsedMonth);
  const firstDay = getFirstDayOfMonth(parsedYear, parsedMonth);
  const monthName = new Date(parsedYear, parsedMonth, 1).toLocaleString("default", { month: "long", year: "numeric" });

  const buildMonthStr = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
  const prevMonth = () => { const d = new Date(parsedYear, parsedMonth - 1, 1); setViewMonth(buildMonthStr(d.getFullYear(), d.getMonth())); };
  const nextMonth = () => { const d = new Date(parsedYear, parsedMonth + 1, 1); setViewMonth(buildMonthStr(d.getFullYear(), d.getMonth())); };

  useEffect(() => {
    if (!user?.uid) return;
    const start = `${viewMonth}-01`;
    const end = `${viewMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const q = query(collection(db, "dailyEntries"), where("userId", "==", user.uid), where("date", ">=", start), where("date", "<=", end), orderBy("date", "asc"));
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyEntry))));
  }, [user?.uid, viewMonth]);

  const getEntry = (dateStr: string) => entries.find(e => e.date === dateStr) || null;
  const openFill = (dateStr: string) => {
    const entry = getEntry(dateStr);
    setSelectedDate(dateStr); setCurrentEntry(entry);
    setTaskList(entry ? [...entry.tasks] : []);
    setPopupDate(null); setMode("fill");
  };

  const addTask = () => {
    if (!tf.projectId || !tf.taskTitle.trim()) return;
    const proj = myProjects.find(p => p.id === tf.projectId);
    setTaskList(prev => [...prev, { id: nanoid(), projectId: tf.projectId, projectName: proj?.name || "", taskTitle: tf.taskTitle, description: tf.description, hoursWorked: tf.hoursWorked, workStatus: tf.workStatus, category: tf.category }]);
    setTf(t => ({ ...t, taskTitle: "", description: "", hoursWorked: 1 }));
  };

  const saveEntry = async (status: "submitted" | "draft") => {
    if (!selectedDate || !user?.uid) return;
    setSaving(true);
    const totalHours = taskList.reduce((s, t) => s + t.hoursWorked, 0);
    const data = { userId: user.uid, userName, userEmail: user.email || "", date: selectedDate, month: viewMonth, tasks: taskList, totalHours, status, ...(status === "submitted" ? { submittedAt: serverTimestamp() } : {}) };
    try {
      if (currentEntry?.id) await updateDoc(doc(db, "dailyEntries", currentEntry.id), { ...data, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, "dailyEntries"), { ...data, createdAt: serverTimestamp() });
      setMode("calendar"); setSelectedDate(null); setCurrentEntry(null); setTaskList([]);
    } catch (err: any) { alert("Save failed: " + err.message); }
    finally { setSaving(false); }
  };

  const totalMonthHours = entries.reduce((s, e) => s + e.totalHours, 0);
  const submittedDays = entries.filter(e => e.status === "submitted").length;
  const todayStr = new Date().toISOString().split("T")[0];
  const popupEntry = popupDate ? getEntry(popupDate) : null;

  if (mode === "fill" && selectedDate) {
    const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const totalH = taskList.reduce((s, t) => s + t.hoursWorked, 0);
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("calendar")} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 transition shadow-sm">←</button>
          <div className="flex-1"><h2 className="text-lg font-black text-gray-900">{dateLabel}</h2><p className="text-sm text-gray-400">{currentEntry ? (currentEntry.status === "submitted" ? "Submitted ✅" : "Draft 📝") : "New entry"} · {totalH}h logged</p></div>
          <div className="flex gap-2">
            <button onClick={() => saveEntry("draft")} disabled={saving || taskList.length === 0} className="px-4 py-2 text-sm font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Save Draft</button>
            <button onClick={() => saveEntry("submitted")} disabled={saving || taskList.length === 0} className="px-5 py-2 text-sm font-bold rounded-xl text-white shadow-sm disabled:opacity-40" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>{saving ? "Saving..." : "Submit Day ✓"}</button>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-700 mb-4">Add Task Entry</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Project *</label><select value={tf.projectId} onChange={e => setTf(t => ({ ...t, projectId: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"><option value="">Select project...</option>{myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Task Title *</label><input value={tf.taskTitle} onChange={e => setTf(t => ({ ...t, taskTitle: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="What did you work on?" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div>
            <div className="col-span-2"><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Description</label><input value={tf.description} onChange={e => setTf(t => ({ ...t, description: e.target.value }))} placeholder="Brief description (optional)" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Category</label><select value={tf.category} onChange={e => setTf(t => ({ ...t, category: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{DAILY_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Status</label><select value={tf.workStatus} onChange={e => setTf(t => ({ ...t, workStatus: e.target.value as any }))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{WORK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Hours *</label><input type="number" value={tf.hoursWorked} onChange={e => setTf(t => ({ ...t, hoursWorked: parseFloat(e.target.value) || 0 }))} min={0.5} step={0.5} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div>
          </div>
          <button onClick={addTask} disabled={!tf.projectId || !tf.taskTitle.trim()} className="w-full py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>+ Add to Day</button>
        </div>
        {taskList.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50"><h3 className="font-black text-gray-800">Today's Entries</h3><span className="text-2xl font-black text-indigo-600">{totalH}h total</span></div>
            <div className="divide-y divide-gray-50">{taskList.map(task => (
              <div key={task.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-gray-50 transition">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0" style={{ background: myProjects.find(p => p.id === task.projectId)?.color || "#6366f1" }}>{task.projectName[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-bold text-indigo-600">{task.projectName}</span><span className="text-[10px] text-gray-400">· {task.category}</span></div>
                  <p className="text-sm font-semibold text-gray-800">{task.taskTitle}</p>
                  {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${task.workStatus === "Completed" ? "bg-green-100 text-green-700" : task.workStatus === "Blocked" ? "bg-red-100 text-red-700" : task.workStatus === "Review" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{task.workStatus}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-indigo-600">{task.hoursWorked}h</span>
                  <button onClick={() => setTaskList(prev => prev.filter(t => t.id !== task.id))} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition text-xs">✕</button>
                </div>
              </div>
            ))}</div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl text-gray-300 shadow-sm"><div className="text-5xl mb-3">📝</div><p className="text-base font-bold text-gray-400">Add your first task above</p></div>
        )}
      </div>
    );
  }

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
            <thead className="bg-gray-50 border-b border-gray-100"><tr>{["Date", "Project", "Task", "Category", "Status", "Hours"].map(h => <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {entries.flatMap(entry =>
                (entry.tasks || []).map((task, ti) => {
                  const d = new Date(entry.date + "T12:00:00");
                  return (
                    <tr key={`${entry.id}-${ti}`} className="border-b border-gray-50 hover:bg-indigo-50/20 transition">
                      <td className="px-5 py-3.5"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${entry.status === "submitted" ? "bg-green-400" : "bg-yellow-400"}`} /><span className="text-sm font-semibold text-gray-700">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}</span></div></td>
                      <td className="px-5 py-3.5"><span className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">{task.projectName}</span></td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">{task.taskTitle}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{task.category}</td>
                      <td className="px-5 py-3.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${task.workStatus === "Completed" ? "bg-green-100 text-green-700" : task.workStatus === "Blocked" ? "bg-red-100 text-red-700" : task.workStatus === "Review" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{task.workStatus}</span></td>
                      <td className="px-5 py-3.5 text-xl font-black text-indigo-600">{task.hoursWorked}h</td>
                    </tr>
                  );
                })
              )}
              {entries.length === 0 && <tr><td colSpan={6} className="py-16 text-center text-gray-300"><div className="text-4xl mb-2">📋</div><p className="text-sm">No entries this month</p></td></tr>}
            </tbody>
            {entries.length > 0 && <tfoot><tr className="border-t border-gray-200 bg-gray-50"><td colSpan={5} className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">Month Total</td><td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{totalMonthHours}h</td></tr></tfoot>}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {popupDate && popupEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPopupDate(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="font-black text-gray-900 text-base">{new Date(popupDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${popupEntry.status === "submitted" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{popupEntry.status === "submitted" ? "✅ Submitted" : "📝 Draft"}</span>
                  <span className="text-sm font-black text-indigo-600">{popupEntry.totalHours}h total</span>
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
                      <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-indigo-600">{task.projectName}</span><span className="text-[10px] text-gray-400">· {task.category}</span></div>
                      <p className="text-sm font-bold text-gray-800">{task.taskTitle}</p>
                      {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                    </div>
                    <span className="text-2xl font-black text-indigo-600">{task.hoursWorked}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">{WEEKDAYS.map(d => <div key={d} className="py-3 text-center text-xs font-black text-gray-400 uppercase tracking-widest border-r border-gray-100 last:border-r-0">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="h-28 border-r border-b border-gray-50 bg-gray-50/50" />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewMonth}-${String(day).padStart(2, "0")}`;
            const entry = getEntry(dateStr);
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            return (
              <div key={dateStr} onClick={() => { if (isFuture) return; if (entry) setPopupDate(dateStr); else openFill(dateStr); }}
                className={`h-28 border-r border-b border-gray-50 p-2 flex flex-col transition-all ${isFuture ? "opacity-35 cursor-not-allowed" : isToday ? "bg-indigo-50/60 cursor-pointer hover:bg-indigo-100/50" : "cursor-pointer hover:bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${isToday ? "bg-indigo-600 text-white" : "text-gray-400"}`}>{day}</div>
                  {entry && <div className="flex items-center gap-1"><span className="text-[10px] font-black text-indigo-500">{entry.totalHours}h</span><span className={`w-2 h-2 rounded-full ${entry.status === "submitted" ? "bg-green-400" : "bg-yellow-400"}`} /></div>}
                </div>
                {entry ? (
                  <div className="flex-1 overflow-hidden space-y-0.5">
                    {(entry.tasks || []).slice(0, 3).map((t, ti) => (<div key={ti} className="flex items-center gap-1 min-w-0"><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.workStatus === "Completed" ? "#22c55e" : t.workStatus === "Blocked" ? "#ef4444" : "#3b82f6" }} /><p className="text-[9px] text-gray-600 truncate font-medium">{t.taskTitle}</p></div>))}
                    {(entry.tasks || []).length > 3 && <p className="text-[9px] font-bold text-indigo-400">+{entry.tasks.length - 3} more</p>}
                  </div>
                ) : !isFuture ? (
                  <div className="flex-1 flex items-center justify-center"><p className="text-[10px] text-gray-300 font-semibold">{isToday ? "Log today" : "+ Add"}</p></div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── PROJECTS PAGE ─── */
function ProjectsPage({ user, myProjects, onOpenProject, onCreateProject, onEditProject, onDeleteProject }: {
  user: any; myProjects: any[];
  onOpenProject: (project: any) => void;
  onCreateProject: () => void;
  onEditProject: (project: any) => void;
  onDeleteProject: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-black text-gray-900">My Projects</h2><p className="text-sm text-gray-400">{myProjects.length} project{myProjects.length !== 1 ? "s" : ""}</p></div>
        <button onClick={onCreateProject} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition hover:opacity-90" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M7 1v12M1 7h12" /></svg>
          New Project
        </button>
      </div>
      {myProjects.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 text-gray-300">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-xl font-bold text-gray-400">No projects yet</p>
          <button onClick={onCreateProject} className="mt-4 px-5 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "#6366f1" }}>Create your first project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {myProjects.map((project: any) => {
            const projPerms = getPermissions(user, project);
            return (
              <div key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden relative" onClick={() => onOpenProject(project)}>
                <div className="h-1.5" style={{ background: project.color || "#6366f1" }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ background: project.color || "#6366f1" }}>{project.name[0]}</div>
                      <div><h3 className="font-bold text-sm text-gray-900 group-hover:text-indigo-700">{project.name}</h3>{project.clientName && <p className="text-xs text-gray-400">{project.clientName}</p>}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${project.status === "Completed" ? "bg-green-100 text-green-700" : project.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{project.status}</span>
                      {projPerms.isPM ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user?.accountType === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "text-white"}`}
                          style={user?.accountType !== "ADMIN" ? { background: project.color || "#6366f1" } : {}}
                        >
                          👑 {user?.accountType === "ADMIN" ? "Admin" : "Team Lead"}
                        </span>
                      ) : projPerms.isAdmin ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">⚙️ Admin</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">{project.description || "No description"}</p>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-gray-400">Progress</span>
                      <span className="text-xs font-bold" style={{ color: project.color || "#6366f1" }}>{project.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${project.progress || 0}%`, background: project.color || "#6366f1" }} /></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {project.endDate && <span className="text-xs text-gray-400">📅 {project.endDate}</span>}
                    <div className="flex items-center gap-2 ml-auto">
                      <button onClick={e => { e.stopPropagation(); onEditProject(project); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-gray-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-100" title="Edit project">✏️ Edit</button>
                      {projPerms.fullControl && (
                        <button onClick={e => { e.stopPropagation(); onDeleteProject(project.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-gray-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100" title="Delete project">🗑️ Delete</button>
                      )}
                      <span className="text-xs font-semibold text-indigo-600 group-hover:underline">Open →</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function ProjectManagement({ user, projects, users, setSidebarCollapsed }: any) {
  const [viewStack, setViewStack] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [activeProject, setActiveProject] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [myWorkLogs, setMyWorkLogs] = useState<WorkLog[]>([]);
  const [allWorkLogs, setAllWorkLogs] = useState<WorkLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [columns, setKanbanColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);

  const [filterPriority, setFilterPriority] = useState("all");
  const [filterTicketType, setFilterTicketType] = useState<"all" | TicketType>("all");
  const [search, setSearch] = useState("");
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quickAddStory, setQuickAddStory] = useState<{ story: Task; ticketType: TicketType } | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deepLinkTaskId, setDeepLinkTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get("projectId");
      const tid = params.get("taskId");
      if (pid && tid) {
        const p = projects?.find((x: any) => x.id === pid);
        if (p) {
          setActiveProject(p);
          setDeepLinkTaskId(tid);
          window.history.replaceState({}, "", window.location.pathname + "?tab=projects");
        }
      }
    }
  }, [projects]);

  useEffect(() => {
    if (setSidebarCollapsed) {
      setSidebarCollapsed(!!activeProject);
    }
  }, [activeProject, setSidebarCollapsed]);

  useEffect(() => {
    if (deepLinkTaskId && tasks.length > 0) {
      const t = tasks.find(x => x.id === deepLinkTaskId);
      if (t) {
        setViewingTask(t);
        setDeepLinkTaskId(null);
      }
    }
  }, [tasks, deepLinkTaskId]);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<any>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const [showWorkLogForm, setShowWorkLogForm] = useState(false);
  const [wl, setWl] = useState({ taskId: "", taskName: "", description: "", hoursWorked: "", workStatus: "In Progress" as WorkLog["workStatus"], date: new Date().toISOString().split("T")[0] });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => setToastMsg(msg);

  const myProjects = projects?.filter((p: any) => user?.accountType === "ADMIN" || p.members?.includes(user?.uid)) || [];
  const userName = user?.displayName || user?.email?.split("@")[0] || "";
  const projectColor = activeProject?.color || "#6366f1";
  const permissions = getPermissions(user, activeProject);
  const isProjectManager = permissions.fullControl;
  const { isPM, isAdmin } = permissions;
  const fullControl = isAdmin || isPM;
  const stories = tasks.filter(t => t.ticketType === "story");

  const handleAddChildToStory = (story: Task, ticketType: TicketType) => setQuickAddStory({ story, ticketType });

  useEffect(() => {
    if (viewingTask) {
      const updated = tasks.find(t => t.id === viewingTask.id);
      if (updated && updated !== viewingTask) {
        setViewingTask(updated);
      }
    }
  }, [tasks, viewingTask]);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc")), s => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(query(collection(db, "workLogs"), where("userId", "==", user.uid), orderBy("createdAt", "desc")), s => setMyWorkLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as WorkLog))));
  }, [user?.uid]);

  useEffect(() => {
    if (!activeProject?.id) return;
    const q = query(collection(db, "projectColumns"), where("projectId", "==", activeProject.id));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setKanbanColumns(Array.isArray(data.columns) && data.columns.length > 0 ? data.columns : DEFAULT_COLUMNS);
      } else { setKanbanColumns(DEFAULT_COLUMNS); }
    });
  }, [activeProject?.id]);

  useEffect(() => {
    if (!activeProject) return;
    const u1 = onSnapshot(query(collection(db, "projectTasks"), where("projectId", "==", activeProject.id)), s => setTasks(s.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, ticketType: (data.ticketType || "task").toLowerCase() } as Task;
    })));
    const u2 = onSnapshot(query(collection(db, "sprints"), where("projectId", "==", activeProject.id), orderBy("createdAt", "desc")), s => setSprints(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, "projectActivities"), where("projectId", "==", activeProject.id), orderBy("createdAt", "desc")), s => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, "workLogs"), where("projectId", "==", activeProject.id), orderBy("createdAt", "desc")), s => setAllWorkLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as WorkLog))));
    const u5 = onSnapshot(query(collection(db, "milestones"), where("projectId", "==", activeProject.id)), s => setMilestones(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const initCols = async () => {
      const colSnap = await getDocs(query(collection(db, "projectColumns"), where("projectId", "==", activeProject.id)));
      if (colSnap.empty) await addDoc(collection(db, "projectColumns"), { projectId: activeProject.id, columns: DEFAULT_COLUMNS, updatedAt: serverTimestamp() });
    };
    initCols();
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [activeProject]);

  const logActivity = async (projectId: string, action: string, description: string, taskId?: string) => {
    await addDoc(collection(db, "projectActivities"), { projectId, userId: user.uid, userName, action, description, taskId: taskId ?? null, createdAt: serverTimestamp() });
    await addDoc(collection(db, "activityLogs"), { projectId, taskId: taskId ?? null, userId: user.uid, userName, action: action.replace(/ /g, "_"), description, createdAt: serverTimestamp() });
  };

  const handleUpdateKanbanColumns = async (updated: KanbanColumn[]) => {
    if (!activeProject?.id || !isProjectManager) return;
    setKanbanColumns(updated);
    const q = query(collection(db, "projectColumns"), where("projectId", "==", activeProject.id));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(doc(db, "projectColumns", snap.docs[0].id), { columns: updated, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, "projectColumns"), { projectId: activeProject.id, columns: updated, updatedAt: serverTimestamp() });
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!isProjectManager && task.assignedTo !== user?.uid) { showToast("You can only move your own tasks"); return; }
    await updateDoc(doc(db, "projectTasks", taskId), {
      status: newStatus,
      ...(newStatus === "inprogress" ? { startedAt: serverTimestamp() } : {}),
      ...(newStatus === "done" ? { completedAt: serverTimestamp() } : {}),
    });

    // If it's a story, move all its tasks too
    if (task.ticketType === "story") {
      const subTasks = tasks.filter(t => t.parentStoryId === taskId);
      const batch = writeBatch(db);
      subTasks.forEach(st => {
        batch.update(doc(db, "projectTasks", st.id), { status: newStatus });
      });
      if (subTasks.length > 0) await batch.commit();
    }

    await logActivity(activeProject.id, "moved task", `"${task.title}" → ${columns.find(c => c.id === newStatus)?.label ?? newStatus}`, taskId);
    await addDoc(collection(db, "activityLogs"), {
      projectId: activeProject.id,
      taskId,
      userId: user.uid,
      userName: userName,
      action: "status_changed",
      from: { status: task.status },
      to: { status: newStatus },
      description: `Status changed to ${columns.find(c => c.id === newStatus)?.label || newStatus}`,
      createdAt: serverTimestamp()
    });

    const snap = await getDocs(query(collection(db, "projectTasks"), where("projectId", "==", activeProject.id)));
    const all = snap.docs.map(d => d.data());
    if (all.length) await updateDoc(doc(db, "projects", activeProject.id), { progress: Math.round((all.filter(t => t.status === "done").length / all.length) * 100) });
  };

  const handleCreateTask = async (data: Partial<Task> & { childTickets?: Partial<Task>[] }) => {
    const { childTickets: children, ...taskData } = data as any;
    const taskCode = await generateUniqueTaskCode(activeProject.id, taskData.ticketType || "task");
    const docRef = await addDoc(collection(db, "projectTasks"), {
      ...taskData, taskCode, projectId: activeProject.id,
      ticketType: taskData.ticketType || "task",
      parentStoryId: taskData.parentStoryId || null,
      sprintId: activeSprint?.id || null,
      createdBy: user.uid,
      createdByName: user.displayName || user.name || user.email?.split("@")[0] || "Unknown",
      createdAt: serverTimestamp(), actualHours: 0,
    });
    await logActivity(activeProject.id, "created task", `"${taskData.title}" (${taskData.ticketType || "task"})`, docRef.id);
    await addDoc(collection(db, "activityLogs"), {
      projectId: activeProject.id,
      taskId: docRef.id,
      userId: user.uid,
      userName: userName,
      action: "created",
      description: `Created ${taskData.ticketType || "task"} "${taskData.title}"`,
      createdAt: serverTimestamp()
    });

    // Notify assignee
    if (taskData.assignedTo && taskData.assignedTo !== user?.uid) {
      await sendNotification(taskData.assignedTo, "task_assigned", "Task Assigned", `You've been assigned "${taskData.title}" in ${activeProject.name}`, activeProject.id, docRef.id);
      await addDoc(collection(db, "activityLogs"), {
        projectId: activeProject.id,
        taskId: docRef.id,
        userId: user.uid,
        userName: userName,
        action: "assigned",
        to: { assignee: taskData.assignedToName || "Someone" },
        description: `Assigned to ${taskData.assignedToName || "Someone"}`,
        createdAt: serverTimestamp()
      });
    }
    if (children && children.length > 0) {
      for (const child of children) {
        const childCode = await generateUniqueTaskCode(activeProject.id, child.ticketType || "task");
        await addDoc(collection(db, "projectTasks"), {
          ...child, taskCode: childCode, projectId: activeProject.id,
          parentStoryId: docRef.id, parentStoryTitle: taskData.title,
          ticketType: child.ticketType || "task",
          status: taskData.status || columns[0]?.id || "new",
          sprintId: activeSprint?.id || null,
          createdBy: user.uid,
          createdByName: user.displayName || user.name || user.email?.split("@")[0] || "Unknown",
          createdAt: serverTimestamp(), actualHours: 0,
        });
      }
    }
    setShowCreateModal(false);
    setQuickAddStory(null);
    const snap = await getDocs(query(collection(db, "projectTasks"), where("projectId", "==", activeProject.id)));
    const all = snap.docs.map(d => d.data());
    if (all.length) await updateDoc(doc(db, "projects", activeProject.id), { progress: Math.round((all.filter(t => t.status === "done").length / all.length) * 100) });
  };

  const handleSaveTask = async (updated: Task) => {
    await updateDoc(doc(db, "projectTasks", updated.id), { ...updated });
    setViewingTask(null);
    if (viewStack.length > 0) {
      const prev = viewStack[viewStack.length - 1];
      setViewStack(s => s.slice(0, -1));
      setViewingTask(prev);
    }
  };

  const handleEditTask = (task: Task) => {
    if (viewingTask) setViewStack(prev => [...prev, viewingTask]);
    setViewingTask(null);
    setEditingTask(task);
  };

  const handleSaveEditedTask = async (data: Partial<Task> & { childTickets?: any }) => {
    if (!editingTask?.id) return;
    const assignedUser = data.assignedTo ? users?.find((u: any) => u.uid === data.assignedTo) : null;
    const assignedToName = assignedUser ? (assignedUser.displayName?.trim() || assignedUser.name?.trim() || null) : null;
    const { childTickets, ...rest } = data;
    const updatePayload: Record<string, any> = { ...rest, assignedTo: data.assignedTo || null, assignedToName: assignedToName || null };
    Object.keys(updatePayload).forEach(key => { if (updatePayload[key] === undefined) delete updatePayload[key]; });
    await updateDoc(doc(db, "projectTasks", editingTask.id), updatePayload);
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updatePayload } : t));

    // Notify assignee if changed
    if (updatePayload.assignedTo && updatePayload.assignedTo !== editingTask.assignedTo && updatePayload.assignedTo !== user?.uid) {
      await sendNotification(updatePayload.assignedTo, "task_assigned", "Task Assigned", `You've been assigned "${data.title || editingTask.title}" in ${activeProject.name}`, activeProject.id, editingTask.id);
    }

    await logActivity(activeProject.id, "edited task", `"${data.title || editingTask.title}"`, editingTask.id);
    setEditingTask(null);
  };

  const handleMoveToSprint = async (task: Task, sprintId: string | null) => {
    if (!isProjectManager) { showToast("Only Team Leads can move tasks between sprints"); return; }
    await updateDoc(doc(db, "projectTasks", task.id), { sprintId: sprintId ?? null });
    const sprint = sprints.find(s => s.id === sprintId);
    await logActivity(activeProject.id, "moved to sprint", `"${task.title}" → ${sprint ? sprint.name : "Backlog"}`, task.id);
  };

  const handleDeleteSprint = async (sprint: any) => {
    if (!confirm(`Delete sprint "${sprint.name}"? Tasks in this sprint will move to Backlog.`)) return;
    await deleteDoc(doc(db, "sprints", sprint.id));
    if (activeSprint?.id === sprint.id) setActiveSprint(null);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project? This will remove the project but keep its tasks (you can delete tasks separately).")) return;
    await deleteDoc(doc(db, "projects", id));
  };

  const handleSubmitWorkLog = async () => {
    if (!wl.description.trim() || !wl.hoursWorked || !activeProject) return;
    const taskObj = tasks.find(t => t.id === wl.taskId);
    await addDoc(collection(db, "workLogs"), {
      userId: user.uid, userName, projectId: activeProject.id, projectName: activeProject.name,
      taskId: wl.taskId || null, taskName: wl.taskName || taskObj?.title || null,
      description: wl.description, hoursWorked: Number(wl.hoursWorked),
      workStatus: wl.workStatus, date: wl.date, createdAt: serverTimestamp(),
    });
    if (wl.taskId) {
      const snap = await getDocs(query(collection(db, "projectTasks"), where("projectId", "==", activeProject.id)));
      const td = snap.docs.find(d => d.id === wl.taskId);
      if (td) await updateDoc(doc(db, "projectTasks", wl.taskId), { actualHours: (td.data().actualHours || 0) + Number(wl.hoursWorked) });
    }
    await logActivity(activeProject.id, "logged work", `${wl.hoursWorked}h: ${wl.description}`, wl.taskId);
    setWl({ taskId: "", taskName: "", description: "", hoursWorked: "", workStatus: "In Progress", date: new Date().toISOString().split("T")[0] });
    setShowWorkLogForm(false);
  };

  const markAllRead = async () => { for (const n of notifications.filter(n => !n.read)) await updateDoc(doc(db, "notifications", n.id), { read: true }); };
  const markRead = async (nid: string) => { await updateDoc(doc(db, "notifications", nid), { read: true }); };

  const unreadCount = notifications.filter(n => !n.read).length;
  const myTasks = tasks.filter(t => t.assignedTo === user?.uid);
  const myDone = myTasks.filter(t => t.status === "done").length;
  const myProgress = myTasks.length > 0 ? Math.round((myDone / myTasks.length) * 100) : 0;
  const overdueTasks = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLogs = myWorkLogs.filter(l => l.date === todayStr);
  const todayHours = todayLogs.reduce((s, l) => s + l.hoursWorked, 0);
  const totalHoursAll = myWorkLogs.reduce((s, l) => s + l.hoursWorked, 0);

  const sprintFilteredTasks = activeSprint ? tasks.filter(t => t.sprintId === activeSprint.id) : tasks;
  const filteredTasks = sprintFilteredTasks.filter(t =>
    (filterPriority === "all" || t.priority === filterPriority) &&
    (filterTicketType === "all" || t.ticketType === filterTicketType) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
    (!showMyTasksOnly || t.assignedTo === user?.uid ||
      (t.ticketType === "story" && sprintFilteredTasks.some(c => c.parentStoryId === t.id && c.assignedTo === user?.uid))
    )
  );

  /* ── PROJECT VIEW ── */
  if (activeProject) {
    const projectMembers = users.filter((u: any) => 
      activeProject.members?.includes(u.uid) || 
      activeProject.managers?.includes(u.uid) || 
      activeProject.createdBy === u.uid
    );
    return (
      <div className="fixed inset-0 sm:relative sm:inset-auto sm:h-screen flex flex-col bg-gray-50 overflow-hidden z-[45]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght=300;400;500;600;700;800&display=swap');`}</style>
        {toastMsg && <PermissionToast message={toastMsg} onHide={() => setToastMsg(null)} />}

        {/* Top bar */}
        {/* Top bar */}
        <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm transition-all duration-300 relative">
          <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <button onClick={() => { setActiveProject(null); setActiveSprint(null); setViewMode("kanban"); setKanbanColumns(DEFAULT_COLUMNS); }} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition flex items-center gap-1 shrink-0">← Projects</button>
            <div className="w-px h-5 bg-gray-200 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: projectColor }} />
              <h1 className="font-bold text-gray-900 text-sm truncate">{activeProject.name}</h1>
              {isProjectManager && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${user?.accountType === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "text-white"}`}
                  style={user?.accountType !== "ADMIN" ? { background: projectColor } : {}}
                >
                  👑 Lead
                </span>
              )}
              {permissions.isAdmin && !permissions.isPM && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">⚙️ Admin</span>}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="flex items-center gap-1.5">
                <ProgressRing pct={myProgress} size={28} stroke={2.5} color={projectColor} />
                <div className="hidden sm:block"><p className="text-xs font-bold text-gray-700">{myProgress}%</p><p className="text-[10px] text-gray-400">My tasks</p></div>
              </div>
              <TeamButton users={users} activeProject={activeProject} user={user} projectColor={projectColor} />
              
              {/* Collapse/Expand Toggle */}
              <button 
                onClick={() => setHeaderCollapsed(!headerCollapsed)}
                className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                title={headerCollapsed ? "Expand Header" : "Collapse Header"}
              >
                {headerCollapsed ? "▼" : "▲"}
              </button>
            </div>
          </div>

          {!headerCollapsed && (
            <>

          {/* Toolbar */}
          <div className="px-3 sm:px-6 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none">
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
              {([
                ["kanban", "⊞ Board"],
                ["list", "☰ List"],
                ["timeline", "📅 Activity"],
                ["logs", "⏱ Logs"],
                ["reports", "📊 Reports"],
              ] as [ViewMode, string][]).map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${viewMode === mode ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  style={viewMode === mode ? { background: projectColor } : {}}>
                  {label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200 shrink-0" />
            {viewMode !== "reports" && (
              <>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none shrink-0">
                  <option value="all">Priority</option>{["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterTicketType} onChange={e => setFilterTicketType(e.target.value as any)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none shrink-0">
                  <option value="all">Type</option>
                  {(Object.keys(TICKET_TYPES) as TicketType[]).map(t => <option key={t} value={t}>{TICKET_TYPES[t].icon} {TICKET_TYPES[t].label}</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none w-24 shrink-0" />
              </>
            )}
            <div className="hidden sm:block sm:flex-1" />
            {viewMode !== "reports" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-sm transition" style={{ background: projectColor }}>+ New Ticket</button>
                <button onClick={() => setShowWorkLogForm(!showWorkLogForm)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-sm" style={{ background: "#64748b" }}>⏱ Log Work</button>
              </div>
            )}
          </div>

          {milestones.length > 0 && (
            <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto bg-white">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Milestones</span>
              {milestones.map(m => (
                <span key={m.id} className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${m.status === "completed" ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                  {m.status === "completed" ? "✅" : "🎯"} {m.title}
                </span>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {showWorkLogForm && viewMode !== "reports" && (
          <div className="shrink-0 px-6 py-3 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-start gap-4 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider pt-2 shrink-0" style={{ color: projectColor }}>⏱ Log Work</span>
              <div className="flex-1 min-w-64"><textarea value={wl.description} onChange={e => setWl({ ...wl, description: e.target.value })} placeholder="What did you work on? *" rows={1} className="w-full text-sm border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" /></div>
              <select value={wl.taskId} onChange={e => { const t = tasks.find(t => t.id === e.target.value); setWl({ ...wl, taskId: e.target.value, taskName: t?.title || "" }); }} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white"><option value="">Task (optional)</option>{myTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
              <input type="number" value={wl.hoursWorked} onChange={e => setWl({ ...wl, hoursWorked: e.target.value })} placeholder="Hours *" min="0.5" step="0.5" className="w-24 text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
              <select value={wl.workStatus} onChange={e => setWl({ ...wl, workStatus: e.target.value as any })} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white"><option>In Progress</option><option>Completed</option><option>Blocked</option></select>
              <input type="date" value={wl.date} onChange={e => setWl({ ...wl, date: e.target.value })} className="text-xs border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
              <button onClick={handleSubmitWorkLog} disabled={!wl.description.trim() || !wl.hoursWorked} className="text-xs font-bold px-4 py-2 text-white rounded-xl disabled:opacity-40 shadow-sm" style={{ background: projectColor }}>Submit</button>
              <button onClick={() => setShowWorkLogForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}

        {viewMode !== "reports" && !headerCollapsed && (
          <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center gap-4 sm:gap-6">
            {[
              { label: "My Tasks", val: myTasks.length, color: "#64748b" },
              { label: "Done", val: myDone, color: "#16a34a" },
              { label: "In Progress", val: myTasks.filter(t => t.status === "inprogress").length, color: "#2563eb" },
              { label: "Overdue", val: overdueTasks.length, color: "#dc2626" },
              { label: "Stories", val: tasks.filter(t => t.ticketType === "story").length, color: "#7c3aed" },
              { label: "Bugs", val: tasks.filter(t => t.ticketType === "bug").length, color: "#dc2626" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-sm font-black" style={{ color: s.color }}>{s.val}</span>
                <span className="text-xs text-gray-400 hidden sm:inline">{s.label}</span>
              </div>
            ))}
            <div className="ml-auto w-full sm:w-auto mt-2 sm:mt-0"><span className="text-xs text-gray-400">Showing {filteredTasks.length} tickets · {filteredTasks.filter(t => t.assignedTo === user?.uid).length} yours</span></div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {viewMode === "kanban" && (
            <div className="flex-1 flex flex-col min-h-0 border-t border-b sm:border border-gray-200 sm:rounded-xl sm:m-4 overflow-hidden bg-white shadow-sm">
              {/* ── KanbanBoard imported from ./employeekanban ── */}
              <KanbanBoard
                tasks={filteredTasks}
                columns={columns}
                projectColor={projectColor}
                currentUserId={user?.uid}
                isProjectManager={isProjectManager}
                onTaskClick={t => setViewingTask(t)}
                onStatusChange={handleStatusChange}
                onUpdateKanbanColumns={handleUpdateKanbanColumns}
                onAddChildToStory={handleAddChildToStory}
                onToast={showToast}
                user={user}
                activeProject={activeProject}
                toolbarPrefix={
                  <>
                    <SprintDropdown
                      sprints={sprints}
                      activeSprint={activeSprint}
                      onSelectSprint={setActiveSprint}
                      onNewSprint={() => setShowSprintModal(true)}
                      onEditSprint={(s) => setEditingSprint(s)}
                      onDeleteSprint={handleDeleteSprint}
                      fullControl={fullControl}
                    />
                    <button onClick={() => setShowMyTasksOnly(o => !o)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: `0.5px solid ${showMyTasksOnly ? projectColor : "#d1d5db"}`, background: showMyTasksOnly ? projectColor : "white", color: showMyTasksOnly ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      👤 My Tasks
                    </button>
                  </>
                }
              />
            </div>
          )}

          {viewMode === "list" && (
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b border-gray-100">{["", "Type", "Title", "Status", "Priority", "Assignee", "Due", "Est."].map(h => <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                    <tbody>
                      {filteredTasks.map(task => {
                        const mine = task.assignedTo === user?.uid;
                        const pc = PRIORITY_CONFIG[task.priority];
                        const colIdx = columns.findIndex(c => c.id === task.status);
                        const cc = getColStyle(task.status, colIdx >= 0 ? colIdx : 0);
                        return (
                          <tr key={task.id} onClick={() => setViewingTask(task)}
                            className={`border-b border-gray-50 cursor-pointer transition group ${(mine || isProjectManager) ? "hover:bg-indigo-50/40" : "hover:bg-gray-50 opacity-60"}`}>
                            <td className="px-4 py-3">{(mine || isProjectManager) && <div className="w-1.5 h-1.5 rounded-full" style={{ background: projectColor }} />}</td>
                            <td className="px-4 py-3"><TicketBadge type={task.ticketType} size="xs" /></td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">{task.title}</p>
                              {task.labels && task.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {task.labels.map(l => {
                                    const lc = LABEL_COLORS[l.color] || LABEL_COLORS.green;
                                    return <span key={l.id} className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter" style={{ background: lc.bg, color: lc.text }}>{l.title}</span>
                                  })}
                                </div>
                              )}
                              {task.parentStoryTitle && <p className="text-[10px] text-purple-400 mt-0.5 font-bold">📖 {task.parentStoryTitle}</p>}
                            </td>
                            <td className="px-4 py-3"><span className="text-xs font-semibold flex items-center gap-1" style={{ color: cc?.color }}><div className="w-1.5 h-1.5 rounded-full" style={{ background: cc?.color }} />{columns.find(c => c.id === task.status)?.label ?? task.status}</span></td>
                            <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: pc?.bg, color: pc?.color }}>{pc?.icon} {task.priority}</span></td>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={task.assignedToName} size="xs" /><span className="text-xs text-gray-600">{task.assignedToName || "—"}{mine && " (you)"}</span></div></td>
                            <td className="px-4 py-3"><span className={`text-xs ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-600 font-semibold" : "text-gray-500"}`}>{task.dueDate || "—"}</span></td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-600">{task.estimatedHours || 0}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {viewMode === "timeline" && (
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                <h3 className="font-bold text-gray-800 mb-5">Activity</h3>
                <div className="space-y-0">
                  {activities.slice(0, 40).map((a, i) => (
                    <div key={a.id} className="flex gap-4 relative">
                      {i < activities.length - 1 && <div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5" style={a.userId === user?.uid ? { background: projectColor } : { background: "#cbd5e1" }}>
                        {a.userName?.[0]?.toUpperCase()}
                      </div>
                      <div className={`flex-1 pb-4 rounded-xl p-3 border ${a.userId === user?.uid ? "bg-indigo-50/40 border-indigo-100" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm"><span className="font-semibold text-gray-800">{a.userName}</span>{a.userId === user?.uid && <span className="text-xs text-indigo-500 ml-1">(you)</span>} <span className="text-gray-400">{a.action}</span></p>
                          <span className="text-xs text-gray-400">{a.createdAt?.toDate().toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-600">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === "logs" && (
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between animate-in fade-in duration-200">
                  <h3 className="font-bold text-gray-800">My Work Logs — {activeProject.name}</h3>
                  <span className="text-sm font-bold" style={{ color: projectColor }}>{allWorkLogs.filter(l => l.userId === user?.uid).reduce((s, l) => s + l.hoursWorked, 0)}h total</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {allWorkLogs.filter(l => l.userId === user?.uid).map(log => (
                    <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                      <Avatar name={log.userName} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {log.taskName && <p className="text-xs font-semibold text-gray-500 mb-0.5">{log.taskName}</p>}
                            <p className="text-sm text-gray-700">{log.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">{log.date}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.workStatus === "Completed" ? "bg-green-100 text-green-700" : log.workStatus === "Blocked" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{log.workStatus}</span>
                            </div>
                          </div>
                          <span className="text-2xl font-black shrink-0" style={{ color: projectColor }}>{log.hoursWorked}h</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {allWorkLogs.filter(l => l.userId === user?.uid).length === 0 && (
                    <div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">⏱</div><p className="text-sm">No work logged yet</p></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {viewMode === "reports" && (
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <SprintReports
                sprints={sprints}
                tasks={tasks}
                columns={columns}
                projectColor="#7c3aed"
                onTaskClick={(task) => { console.log(task); }}
                onClose={() => setViewMode("kanban")}
              />
            </div>
          )}
        </div>

        {/* Modals */}
        {showCreateModal && (
          <TaskModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateTask}
            users={projectMembers} columns={columns} projectColor={projectColor}
            initialData={{ status: columns[0]?.id || "new", projectId: activeProject.id }}
            stories={stories} currentUserId={user?.uid} isProjectManager={isProjectManager}
            allowedTypes={permissions.canCreateTypes} />
        )}
        {quickAddStory && (
          <TaskModal open={!!quickAddStory} onClose={() => setQuickAddStory(null)} onSubmit={handleCreateTask}
            users={projectMembers} columns={columns} projectColor={projectColor}
            initialData={{ ticketType: quickAddStory.ticketType, parentStoryId: quickAddStory.story.id, parentStoryTitle: quickAddStory.story.title, status: columns[0]?.id || "todo", projectId: activeProject.id }}
            stories={stories} currentUserId={user?.uid} isProjectManager={isProjectManager}
            allowedTypes={permissions.canCreateTypes} />
        )}
        {editingTask && (
          <TaskModal open={!!editingTask} onClose={() => {
            setEditingTask(null);
            if (viewStack.length > 0) {
              const prev = viewStack[viewStack.length - 1];
              setViewStack(s => s.slice(0, -1));
              setViewingTask(prev);
            }
          }} onSubmit={handleSaveEditedTask}
            users={projectMembers} columns={columns} projectColor={projectColor}
            initialData={editingTask} stories={stories} currentUserId={user?.uid}
            isProjectManager={isProjectManager} allowedTypes={permissions.canCreateTypes} />
        )}
        {viewingTask && (
          <TaskDetailModal
            task={viewingTask} onClose={() => setViewingTask(null)} columns={columns}
            projectColor={projectColor} projectName={activeProject.name}
            currentUserId={user?.uid} isProjectManager={isProjectManager}
            canDelete={permissions.canDelete} users={projectMembers}
            onStatusChange={handleStatusChange} onSave={handleSaveTask}
            db={db} storage={storage} user={user}
            sprints={sprints} onMoveToSprint={handleMoveToSprint} onEditTask={handleEditTask}
            tasks={tasks} onAddChildToStory={handleAddChildToStory}
          />
        )}
        <SprintFormModal
          open={showSprintModal || !!editingSprint}
          onClose={() => { setShowSprintModal(false); setEditingSprint(null); }}
          projectId={activeProject?.id}
          editingSprint={editingSprint}
        />
      </div>
    );
  }

  /* ── MAIN DASHBOARD ── */
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={userName} size="md" highlight />
            <div>
              <p className="font-bold text-sm text-gray-900">Hey, {userName} 👋</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
            {user?.designation && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 ml-1">{user.designation}</span>}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none">
            {([
              ["dashboard", "🏠 Dashboard"],
              ["projects", "📁 Projects"],
              ["dailysheet", "📋 Daily Sheet"],
              ["notifications", "🔔 Inbox"],
            ] as [AppTab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 sm:flex-initial whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 active:scale-95 ${activeTab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
                {t === "notifications" && unreadCount > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5">{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {activeTab === "dailysheet" && <EmployeeDailySheet user={user} projects={myProjects} />}

        {activeTab === "dashboard" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: "📁", label: "My Projects", val: myProjects.length, bg: "#e8f1ff" },
                { icon: "⏱", label: "Today's Hours", val: `${todayHours}h`, bg: "#e7f8ee" },
                { icon: "📊", label: "Total Hours", val: `${totalHoursAll}h`, bg: "#eef2ff" },
                { icon: "⚠️", label: "Overdue Tasks", val: overdueTasks.length, bg: "#fff4e5" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-5 shadow-sm" style={{ background: s.bg }}>
                  <div className="flex justify-between items-start">
                    <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{s.label}</p><p className="text-4xl font-black text-gray-800">{s.val}</p></div>
                    <span className="text-3xl">{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                  <div><h3 className="font-bold text-gray-800">Today's Work</h3><p className="text-xs text-gray-400 mt-0.5">{todayStr}</p></div>
                  <span className="text-2xl font-black text-indigo-600">{todayHours}h</span>
                </div>
                {todayLogs.length === 0
                  ? <div className="text-center py-10 text-gray-300"><div className="text-4xl mb-2">📝</div><p className="text-sm font-medium">No work logged today</p></div>
                  : <div className="divide-y divide-gray-50">{todayLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-4">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-indigo-400" />
                      <div className="flex-1"><p className="text-xs font-bold text-indigo-600 mb-0.5">{log.projectName}</p>{log.taskName && <p className="text-xs text-gray-400">{log.taskName}</p>}<p className="text-sm text-gray-700 mt-0.5">{log.description}</p></div>
                      <p className="font-black text-lg text-indigo-600">{log.hoursWorked}h</p>
                    </div>
                  ))}</div>
                }
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">My Projects</h3>
                  <button onClick={() => setActiveTab("projects")} className="text-xs font-semibold text-indigo-600">View all →</button>
                </div>
                <div className="divide-y divide-gray-50">
                  {myProjects.slice(0, 4).map((p: any) => (
                    <div key={p.id} onClick={() => { setActiveProject(p); setViewMode("kanban"); }} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition group">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ background: p.color || "#6366f1" }}>{p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate group-hover:text-indigo-700">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-100 rounded-full h-1"><div className="h-1 rounded-full" style={{ width: `${p.progress || 0}%`, background: p.color || "#6366f1" }} /></div>
                          <span className="text-[10px] font-bold" style={{ color: p.color || "#6366f1" }}>{p.progress || 0}%</span>
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-indigo-400">→</span>
                    </div>
                  ))}
                  {myProjects.length === 0 && <div className="text-center py-10 text-gray-300"><div className="text-4xl mb-2">📭</div><p className="text-sm">No projects yet</p></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <ProjectsPage user={user} myProjects={myProjects}
            onOpenProject={(project) => { setActiveProject(project); setViewMode("kanban"); }}
            onCreateProject={() => setShowProjectModal(true)}
            onEditProject={(project) => setEditingProject(project)}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === "notifications" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-2xl font-black text-gray-900">Inbox</h2><p className="text-sm text-gray-400">{unreadCount} unread</p></div>
              {unreadCount > 0 && <button onClick={markAllRead} className="text-xs font-bold px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50">Mark all read ✓</button>}
            </div>
            {notifications.length === 0
              ? <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 text-gray-300"><div className="text-6xl mb-4">🔔</div><p className="text-xl font-bold text-gray-400">All clear!</p></div>
              : <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.id} onClick={() => markRead(n.id)}
                    className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all ${!n.read ? "border-indigo-100 shadow-sm" : "border-gray-100"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${n.type === "project_added" ? "bg-indigo-100" : n.type === "task_assigned" ? "bg-amber-100" : "bg-gray-100"}`}>
                        {n.type === "project_added" ? "📁" : n.type === "task_assigned" ? "📋" : "🔔"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="font-bold text-sm text-gray-800">{n.title}</p><p className="text-sm text-gray-500 mt-0.5">{n.message}</p></div>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{n.createdAt?.toDate().toLocaleString()}</span>
                          {n.projectId && (
                            <button onClick={e => { e.stopPropagation(); const p = myProjects.find((proj: any) => proj.id === n.projectId); if (p) { setActiveProject(p); setViewMode("kanban"); } markRead(n.id); }} className="text-xs font-semibold text-indigo-600">Open Project →</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>

      <ProjectModal open={showProjectModal} onClose={() => setShowProjectModal(false)} user={user} users={users}
        onCreated={(newProject) => { setActiveProject(newProject); setViewMode("kanban"); }} />
      {editingProject && (
        <EditProjectModal open={!!editingProject} onClose={() => setEditingProject(null)}
          project={editingProject} users={users} onSaved={() => setEditingProject(null)} />
      )}
    </div>
  );
}