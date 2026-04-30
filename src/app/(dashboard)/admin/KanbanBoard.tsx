"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

/* ─── TYPES ─── */
export type TicketType = "story" | "task" | "bug" | "defect";
export type ViewMode = "board" | "swimlane";
export type GroupBy = "assignee" | "priority" | "type";

export interface KanbanColumn {
  id: string;
  label: string;
  color?: string;
  bg?: string;
  border?: string;
  wipLimit?: number;
}

export interface Task {
  id: string; title: string; description?: string; projectId: string;
  sprintId?: string | null; assignedTo?: string | null; assignedToName?: string | null;
  assignedDate?: string; dueDate?: string; priority: string; status: string;
  estimatedHours?: number; actualHours?: number; storyPoints?: number;
  tags?: string[];
  ticketType?: TicketType;
  parentStoryId?: string | null;
  parentStoryTitle?: string;
  taskCode?: string;
  completedAt?: string;
  createdBy: string; createdAt: any;
}

/* ─── TICKET TYPE CONFIG ─── */
export const TICKET_TYPES: Record<TicketType, { label: string; icon: string; color: string; bg: string; border: string; description: string }> = {
  story:  { label: "Story",  icon: "📖", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", description: "A user story" },
  task:   { label: "Task",   icon: "✅", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", description: "A unit of work" },
  bug:    { label: "Bug",    icon: "🐞", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", description: "Something broken" },
  defect: { label: "Defect", icon: "⚠️", color: "#d97706", bg: "#fffbeb", border: "#fde68a", description: "A quality issue" },
};

const TYPE_META = TICKET_TYPES;

/* ─── CONSTANTS ─── */
const STATIC_COL_CONFIG: Record<string, { color: string; bg: string; border: string; headerBg: string; dot: string }> = {
  todo:       { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#94a3b8" },
  inprogress: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  review:     { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  done:       { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
  blocked:    { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
};

const DYNAMIC_PALETTE = [
  // Slate / Gray
  { color: "#475569", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#64748b" },
  // Blue
  { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  // Cyan
  { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", headerBg: "#cffafe", dot: "#06b6d4" },
  // Teal
  { color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4", headerBg: "#ccfbf1", dot: "#14b8a6" },
  
  // Green
  { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
  // Lime
  { color: "#65a30d", bg: "#f7fee7", border: "#d9f99d", headerBg: "#ecfccb", dot: "#84cc16" },
  // Yellow
  { color: "#ca8a04", bg: "#fefce8", border: "#fef08a", headerBg: "#fef9c3", dot: "#eab308" },
  // Amber
  { color: "#d97706", bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7", dot: "#f59e0b" },

  // Orange
  { color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", headerBg: "#ffedd5", dot: "#f97316" },
  // Red
  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
  // Rose
  { color: "#e11d48", bg: "#fff1f2", border: "#fecdd3", headerBg: "#ffe4e6", dot: "#f43f5e" },
  // Pink
  { color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", headerBg: "#fce7f3", dot: "#ec4899" },

  // Fuchsia
  { color: "#c026d3", bg: "#fdf4ff", border: "#fae8ff", headerBg: "#f5d0fe", dot: "#d946ef" },
  // Purple
  { color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff", headerBg: "#f3e8ff", dot: "#a855f7" },
  // Violet
  { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  // Indigo
  { color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe", headerBg: "#e0e7ff", dot: "#6366f1" },
];

const PRI_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Low:      { dot: "#22c55e", bg: "#f0fdf4", text: "#16a34a", label: "Low" },
  Medium:   { dot: "#f59e0b", bg: "#fffbeb", text: "#d97706", label: "Medium" },
  High:     { dot: "#f97316", bg: "#fff7ed", text: "#ea580c", label: "High" },
  Critical: { dot: "#ef4444", bg: "#fef2f2", text: "#dc2626", label: "Critical" },
};

const TYPE_PREFIX: Record<string, string> = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };

const AVATAR_COLORS = ["#6366f1","#7c3aed","#db2777","#d97706","#059669","#0891b2","#e11d48","#0284c7"];
const avatarColor   = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const avatarInitial = (name: string): string => (!name || name.includes("@")) ? "U" : name.trim()[0].toUpperCase();
const cleanDisplayName = (name: string | null | undefined): string => (!name || name.includes("@")) ? "User" : name;

const SWIMLANE_LABEL_WIDTH = 160;
const SWIMLANE_COL_WIDTH   = 260;

function generateThemeFromColor(hex: string) {
  return {
    color: hex,
    bg: `${hex}10`,
    border: `${hex}30`,
    headerBg: `${hex}15`,
    dot: hex
  };
}

export function getColStyle(colId: string, index: number) {
  return STATIC_COL_CONFIG[colId] ?? DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length];
}

export function generateTaskCode(ticketType: string, existingTasks: Task[]): string {
  const prefix = TYPE_PREFIX[ticketType] || "TSK";
  const max = existingTasks
    .filter(t => t.taskCode?.startsWith(prefix + "-"))
    .map(t => parseInt(t.taskCode!.split("-")[1] || "0", 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/* ─── PERMISSIONS ─── */
export function canDragTask(user: any, task: Task, project: any): boolean {
  if (!user) return false;
  const isAdmin   = user?.accountType === "ADMIN";
  const isPM      = project?.projectManager === user?.uid || (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user?.uid));
  const isAssignee = task.assignedTo === user?.uid;
  return isAdmin || isPM || isAssignee;
}

/* ─── INTERFACES ─── */
interface KanbanBoardProps {
  tasks: Task[];
  columns: KanbanColumn[];
  setColumns: (c: KanbanColumn[]) => void;
  projectColor?: string;
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, status: string) => void;
  canManage: boolean;
  onSaveColumns: (c: KanbanColumn[]) => void;
  onCreateTask?: (storyId: string, ticketType: string) => void;
  currentUser?: any;
  activeProject?: any;
}

interface FilterState {
  search: string; mine: boolean; overdue: boolean;
  priority: string; type: string; assignee: string;
}

/* ─── COLOR PICKER PORTAL ─── */
function ColorPickerPortal({ dotColor, onSelect, onClose }: {
  dotColor: string;
  onSelect: (pal: typeof DYNAMIC_PALETTE[0]) => void;
  onClose: () => void;
}) {
  return createPortal(
    <>
      {/* backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 10000 }}
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      {/* palette */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 10001, background: "#fff",
          border: "1px solid #f1f5f9", borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          padding: "20px", width: "240px",
        }}

        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#6366f1" }} />
          Standard Themes
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "20px" }}>
          {DYNAMIC_PALETTE.map((pal, pi) => (
            <span
              key={pi}
              title={pal.color}
              style={{
                display: "inline-block", width: "40px", height: "40px",
                borderRadius: "12px", background: pal.dot, cursor: "pointer",
                border: `3px solid ${dotColor === pal.dot ? "#1e293b" : "#fff"}`,
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.1) translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1)"; }}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); onSelect(pal); }}
            />
          ))}
        </div>

        <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#ec4899" }} />
          Custom Spectrum
        </p>
        <div style={{ padding: "3px", border: "1px solid #f1f5f9", borderRadius: "14px", background: "#f8fafc", boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.05)" }}>
          <input
            type="color"
            value={dotColor}
            onChange={(e) => onSelect(generateThemeFromColor(e.target.value))}
            style={{
              width: "100%", height: "40px", cursor: "pointer",
              border: "none", borderRadius: "10px", background: "none",
              display: "block", padding: 0
            }}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── COLOR DOT ─── */
function ColorDot({ dotColor, pickerKey, activeKey, setActiveKey, onSelect }: {
  dotColor: string;
  pickerKey: string;
  activeKey: string | null;
  setActiveKey: (k: string | null) => void;
  onSelect: (pal: typeof DYNAMIC_PALETTE[0]) => void;
}) {
  const isOpen = activeKey === pickerKey;
  return (
    <>
      <span
        title="Change column color"
        style={{
          display: "inline-block",
          width: "8px", height: "8px",
          borderRadius: "50%",
          background: dotColor,
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${dotColor}88`,
        }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setActiveKey(isOpen ? null : pickerKey);
        }}
      />
      {isOpen && (
        <ColorPickerPortal
          dotColor={dotColor}
          onSelect={(pal) => { onSelect(pal); setActiveKey(null); }}
          onClose={() => setActiveKey(null)}
        />
      )}
    </>
  );
}

/* ─── CONFIRM DIALOG ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-sm text-gray-700 mb-5 font-medium">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">Confirm</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ─── FLOATING CHILD MENU ─── */
const FloatingMenu = ({ position, onClose, onCreate }: {
  position: { top: number; left: number }; onClose: () => void; onCreate: (t: string) => void;
}) => createPortal(
  <>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000 }} />
    <div style={{ position: "fixed", top: position.top, left: position.left, zIndex: 10001 }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl w-44 py-1.5 overflow-hidden">

      <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">Add to Story</div>
      {(["task","bug","defect"] as const).map(t => {
        const tm = TYPE_META[t];
        return (
          <button key={t} onClick={() => onCreate(t)}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2.5 text-sm font-medium transition"
            style={{ color: tm.color }}>
            <span>{tm.icon}</span> {tm.label}
          </button>
        );
      })}
    </div>
  </>,
  document.body
);

/* ─── BULK ACTION BAR ─── */
function BulkActionBar({ count, columns, projectColor, onDelete, onMove, onClear }: {
  count: number; columns: KanbanColumn[]; projectColor: string;
  onDelete: () => void; onMove: (colId: string) => void; onClear: () => void;
}) {
  const [showMove, setShowMove] = useState(false);
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border border-white/20"
      style={{ background: projectColor }}>
      <span className="text-white text-xs font-bold mr-2 bg-white/20 px-2 py-0.5 rounded-full">{count} selected</span>
      <div className="relative">
        <button onClick={() => setShowMove(!showMove)}
          className="flex items-center gap-1 text-white text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition">
          ↗ Move
        </button>
        {showMove && (
          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 z-10">
            {columns.map(c => (
              <button key={c.id} onClick={() => { onMove(c.id); setShowMove(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">{c.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-white/30" />
      <button onClick={onDelete}
        className="flex items-center gap-1 text-white text-xs font-semibold bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg transition">
        🗑 Delete
      </button>
      <button onClick={onClear} className="text-white/70 hover:text-white ml-1 text-sm">✕</button>
    </div>
  );
}

/* ─── TASK MODAL ─── */
export function TaskModal({
  open, onClose, onSubmit, users, columns, projectColor,
  stories, defaultStoryId, defaultTicketType, existingTasks = [], editingTask,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (f: any, editingTask?: Task | null) => void;
  users: any[]; columns: KanbanColumn[]; projectColor: string;
  stories?: Task[]; defaultStoryId?: string; defaultTicketType?: string;
  existingTasks?: Task[]; editingTask?: Task | null;
}) {
  const getAutoCode = (ticketType: string) => generateTaskCode(ticketType, existingTasks);
  const [f, setF] = useState({
    title: "", description: "", assignedTo: "", dueDate: "", priority: "Medium",
    status: columns[0]?.id || "todo", estimatedHours: "", storyPoints: "3", tags: "",
    ticketType: defaultTicketType || "task",
    parentStoryId: defaultStoryId || "",
    taskCode: getAutoCode(defaultTicketType || "task"),
  });
  const [taskCodeManual, setTaskCodeManual] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setF({
        title: editingTask.title || "", description: editingTask.description || "",
        assignedTo: editingTask.assignedTo || "", dueDate: editingTask.dueDate || "",
        priority: editingTask.priority || "Medium", status: editingTask.status || columns[0]?.id,
        estimatedHours: editingTask.estimatedHours?.toString() || "",
        storyPoints: editingTask.storyPoints?.toString() || "3",
        tags: editingTask.tags?.join(",") || "", ticketType: editingTask.ticketType || "task",
        parentStoryId: editingTask.parentStoryId || "", taskCode: editingTask.taskCode || "",
      });
    }
  }, [editingTask]);

  useEffect(() => {
    if (editingTask) return;
    const t = defaultTicketType || "task";
    setF(prev => ({
      ...prev, ticketType: t, parentStoryId: defaultStoryId || "",
      status: columns[0]?.id || "todo",
      taskCode: taskCodeManual ? prev.taskCode : getAutoCode(t),
    }));
  }, [open, defaultTicketType, defaultStoryId, columns, editingTask]);

  const handleTypeChange = (t: string) => {
    setF(prev => ({
      ...prev, ticketType: t,
      parentStoryId: t === "story" ? "" : prev.parentStoryId,
      taskCode: taskCodeManual ? prev.taskCode : getAutoCode(t),
    }));
  };

  if (!open) return null;
  const isStory = f.ticketType === "story";

  const resolveDisplayName = (u: any): string => {
    if (!u) return "";
    if (u.displayName?.trim()) return u.displayName.trim();
    if (u.name?.trim()) return u.name.trim();
    return "User";
  };

  const submit = () => {
    if (!f.title.trim()) return;
    const assignedUser = f.assignedTo ? users.find((u: any) => u.uid === f.assignedTo) : null;
    const data = {
      ...f,
      assignedTo: f.assignedTo || null,
      assignedToName: assignedUser ? resolveDisplayName(assignedUser) : null,
      estimatedHours: f.estimatedHours ? Number(f.estimatedHours) : undefined,
      storyPoints: f.storyPoints ? Number(f.storyPoints) : undefined,
      tags: f.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
    };
    editingTask ? onSubmit(data, editingTask) : onSubmit(data);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${projectColor}, ${projectColor}dd)` }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{TYPE_META[f.ticketType as TicketType]?.icon || "🧩"}</span>
            <h3 className="font-bold text-white text-sm">{editingTask ? "Edit Task" : `Create ${TYPE_META[f.ticketType as TicketType]?.label || "Task"}`}</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">
          <div className="flex gap-2">
            {(["story","task","bug","defect"] as const).map(t => {
              const tm = TYPE_META[t]; const sel = f.ticketType === t;
              return (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className="flex-1 flex flex-col items-center py-2.5 rounded-xl border-2 transition-all text-xs font-semibold gap-1"
                  style={sel ? { borderColor: tm.color, background: tm.bg, color: tm.color } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                  <span className="text-base">{tm.icon}</span>{tm.label}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold pointer-events-none"
              style={{ color: TYPE_META[f.ticketType as TicketType]?.color || "#64748b" }}>
              {TYPE_PREFIX[f.ticketType] || "TSK"}-
            </span>
            <input value={f.taskCode?.replace(/^[A-Z]+-/, "") || ""}
              onChange={e => {
                const num = e.target.value.replace(/\D/g,"").slice(0,6);
                const prefix = TYPE_PREFIX[f.ticketType] || "TSK";
                setF(prev => ({ ...prev, taskCode: num ? `${prefix}-${num.padStart(3,"0")}` : `${prefix}-` }));
                setTaskCodeManual(true);
              }}
              placeholder="001"
              className="w-full border border-gray-200 rounded-lg pl-12 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          {!isStory && stories && stories.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Parent Story <span className="text-gray-300">(optional)</span></label>
              <select value={f.parentStoryId} onChange={e => setF({ ...f, parentStoryId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">None</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.taskCode ? `[${s.taskCode}] ` : ""}{s.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Title <span className="text-red-400">*</span></label>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus
              placeholder={`${TYPE_META[f.ticketType as TicketType]?.label || "Task"} title...`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2}
            placeholder="Description..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Assignee</label>
              <select value={f.assignedTo} onChange={e => setF({ ...f, assignedTo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.uid} value={u.uid}>{u.displayName || u.name || "Unknown"}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Priority</label>
              <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Low","Medium","High","Critical"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {!isStory && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Initial Column</label>
                <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Due Date</label>
              <input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            {!isStory && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Est. Hours</label>
                <input type="number" value={f.estimatedHours || ""} onChange={e => setF({ ...f, estimatedHours: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Story Points</label>
              <input type="number" value={f.storyPoints || ""} onChange={e => setF({ ...f, storyPoints: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Tags <span className="text-gray-300">(comma-separated)</span></label>
            <input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="design, frontend, api"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={!f.title.trim()}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${projectColor}, ${projectColor}cc)` }}>
            {editingTask ? "Update Task" : `Create ${TYPE_META[f.ticketType as TicketType]?.label || "Task"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ══════════════════════════════════════════════
   MAIN KANBAN BOARD
══════════════════════════════════════════════ */
export function KanbanBoard({
  tasks, columns, setColumns, projectColor = "#6366f1",
  onTaskClick, onStatusChange, canManage, onSaveColumns, onCreateTask,
  currentUser, activeProject,
}: KanbanBoardProps) {

  /* ── state ── */
  const [dragTask,       setDragTask]       = useState<Task | null>(null);
  const [dragOver,       setDragOver]       = useState<string | null>(null);
  const [dragColId,      setDragColId]      = useState<string | null>(null);
  const [dragColOverId,  setDragColOverId]  = useState<string | null>(null);
  const [draggingColIdx, setDraggingColIdx] = useState<number | null>(null);

  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  const [collapsedCols,    setCollapsedCols]    = useState<Set<string>>(new Set());
  const [collapsedGroups,  setCollapsedGroups]  = useState<Set<string>>(new Set());
  const [selectedTasks,    setSelectedTasks]    = useState<Set<string>>(new Set());

  const [confirmDelete,    setConfirmDelete]  = useState<{ type: "bulk" } | null>(null);
  const [floatingMenu,     setFloatingMenu]   = useState<{ storyId: string; top: number; left: number } | null>(null);
  const [addingCol,        setAddingCol]      = useState(false);
  const [newColLabel,      setNewColLabel]    = useState("");

  const [isFullscreen,     setIsFullscreen]   = useState(false);
  const [viewMode,         setViewMode]       = useState<ViewMode>("board");
  const [groupBy,          setGroupBy]        = useState<GroupBy>("assignee");

  const [editingColId,     setEditingColId]   = useState<string | null>(null);
  const [editingLabelVal,  setEditingLabelVal] = useState("");

  /* Single shared state for which dot's color picker is open.
     Board dots use key "b__<colId>", swimlane use "s__<colId>" */
  const [activeColorKey,   setActiveColorKey] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: "", mine: false, overdue: false, priority: "", type: "", assignee: "",
  });

  const [isMounted, setIsMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  /* close color picker on Escape */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        if (activeColorKey) { setActiveColorKey(null); return; }
        if (isFullscreen)   { setIsFullscreen(false); return; }
        setFilters({ search: "", mine: false, overdue: false, priority: "", type: "", assignee: "" });
      }
      if (e.key.toLowerCase() === "f") { e.preventDefault(); setIsFullscreen(p => !p); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, activeColorKey]);

  /* ── helpers ── */
  const isOverdue = (dueDate?: string, status?: string) =>
    !!dueDate && new Date(dueDate) < new Date() && status !== "done";

  const formatDate = (d?: string) => {
    if (!d) return null;
    const dt = new Date(d + "T12:00:00");
    return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`;
  };

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (filters.mine     && t.assignedTo !== currentUser?.uid) return false;
    if (filters.overdue  && !isOverdue(t.dueDate, t.status))   return false;
    if (filters.priority && t.priority !== filters.priority)    return false;
    if (filters.type     && t.ticketType !== filters.type)      return false;
    if (filters.assignee && t.assignedTo !== filters.assignee)  return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return t.title.toLowerCase().includes(s) || (t.description||"").toLowerCase().includes(s) || (t.taskCode||"").toLowerCase().includes(s);
    }
    return true;
  }), [tasks, filters, currentUser]);

  const stories = filteredTasks.filter(t => t.ticketType === "story");
  const orphans  = filteredTasks.filter(t => t.ticketType !== "story" && !t.parentStoryId);

  const toggleStory  = (id: string) => setCollapsedStories(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleCol    = (id: string) => setCollapsedCols(p    => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleGroup  = (key: string) => setCollapsedGroups(p => { const s = new Set(p); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTasks(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const clearSelection = () => setSelectedTasks(new Set());

  /* ── column actions ── */
  const handleRenameColumn = (id: string) => {
    if (!editingLabelVal.trim()) { setEditingColId(null); return; }
    onSaveColumns(columns.map(c => c.id === id ? { ...c, label: editingLabelVal.trim() } : c));
    setEditingColId(null);
  };

  const handleDeleteColumn = (id: string) => {
    const col = columns.find(c => c.id === id);
    const cnt = tasks.filter(t => t.status === id).length;
    if (cnt > 0) { alert(`Cannot delete "${col?.label}" — it has ${cnt} tasks.`); return; }
    if (confirm(`Delete column "${col?.label}"?`)) onSaveColumns(columns.filter(c => c.id !== id));
  };

  const handleUpdateColColor = (id: string, pal: typeof DYNAMIC_PALETTE[0]) => {
    onSaveColumns(columns.map(c => c.id === id ? { ...c, ...pal } : c));
  };

  /* ── drag column ── */
  const handleDragColumnStart = (e: React.DragEvent, index: number) => {
    if (!canManage) return;
    setDraggingColIdx(index);
    e.dataTransfer.setData("colIndex", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };
  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!canManage || draggingColIdx === null) return;
    const nc = [...columns];
    const [moved] = nc.splice(draggingColIdx, 1);
    nc.splice(targetIndex, 0, moved);
    onSaveColumns(nc);
    setDraggingColIdx(null);
  };

  /* ── drag task ── */
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDragTask(task);
    e.dataTransfer.effectAllowed = "move";
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => { if (target) target.style.opacity = "0.4"; }, 0);
  };
  const handleTaskDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragTask(null); setDragOver(null);
  };
  const handleTaskDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragTask && dragTask.status !== colId && dragTask.ticketType !== "story") {
      if (canDragTask(currentUser, dragTask, activeProject)) onStatusChange(dragTask.id, colId);
    }
    setDragTask(null); setDragOver(null);
  };

  /* ── bulk ── */
  const handleBulkMove   = (colId: string) => { selectedTasks.forEach(id => onStatusChange(id, colId)); clearSelection(); };
  const handleBulkDelete = () => { selectedTasks.forEach(id => onStatusChange(id, "__DELETE__")); clearSelection(); setConfirmDelete(null); };

  /* ══ STORY CARD ══ */
  const StoryCard = ({ story, colIdx }: { story: Task; colIdx: number }) => {
    const isCollapsed = collapsedStories.has(story.id);
    const allChildren = filteredTasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story");
    const colChildren = allChildren.filter(t => t.status === columns[colIdx]?.id);
    const doneCount   = allChildren.filter(t => t.status === "done").length;
    const pct         = allChildren.length ? Math.round((doneCount / allChildren.length) * 100) : 0;
    const pri         = PRI_CONFIG[story.priority];
    const isSelected  = selectedTasks.has(story.id);
    const overdue     = isOverdue(story.dueDate, story.status);

    return (
      <div className="mx-2 my-2 rounded-xl overflow-hidden transition-all duration-200"
        style={{ background: isSelected ? "#eef2ff" : "#f5f3ff", border: `2px solid ${isSelected ? "#6366f1" : "#c4b5fd"}`, boxShadow: "0 2px 8px rgba(99,102,241,0.10)" }}>
        <div
          draggable={canDragTask(currentUser, story, activeProject)}
          onDragStart={e => { if (!canDragTask(currentUser, story, activeProject)) { e.preventDefault(); return; } handleTaskDragStart(e, story); }}
          onDragEnd={handleTaskDragEnd}
          className="p-3" onClick={() => onTaskClick(story)}
          style={{ cursor: canDragTask(currentUser, story, activeProject) ? "grab" : "default" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div onClick={e => toggleSelect(story.id, e)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition cursor-pointer ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-indigo-300 bg-white"}`}>
              {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#ddd6fe", color: "#5b21b6" }}>{story.taskCode || "STR-001"}</span>
            <span className="text-xs">📘</span>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">Story</span>
            <div className="flex-1" />
            {pri && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: pri.bg, color: pri.text }}>{pri.label}</span>}
          </div>
          <p className="text-sm font-bold text-indigo-900 leading-snug mb-2 line-clamp-2">{story.title}</p>
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {story.tags.slice(0,3).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">#{tag}</span>)}
            </div>
          )}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-indigo-400 font-medium">{doneCount}/{allChildren.length} tasks</span>
              <span className="text-[10px] font-bold text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct===100 ? "#22c55e" : "#6366f1" }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {story.assignedToName ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: avatarColor(cleanDisplayName(story.assignedToName)) }}>
                    {avatarInitial(cleanDisplayName(story.assignedToName))}
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700 truncate" style={{ maxWidth: "90px" }}>{cleanDisplayName(story.assignedToName)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-300 text-[9px]">?</div>
                  <span className="text-[10px] text-indigo-300">Unassigned</span>
                </div>
              )}
              {story.dueDate && <span className={`text-[10px] font-medium shrink-0 ${overdue ? "text-red-500" : "text-indigo-400"}`}>{overdue ? "⚠️ " : ""}{formatDate(story.dueDate)}</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={e => { e.stopPropagation(); toggleStory(story.id); }}
                className="w-6 h-6 rounded-md bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-600 transition text-[10px]">
                {isCollapsed ? "▶" : "▼"}
              </button>
              {canManage && onCreateTask && (
                <button onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setFloatingMenu({ storyId: story.id, top: r.bottom+6, left: r.left }); }}
                  className="w-6 h-6 rounded-md bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition text-sm font-bold">+</button>
              )}
            </div>
          </div>
        </div>
        {!isCollapsed && (
          <div style={{ borderTop: "1px solid #ddd6fe", background: "#faf5ff" }}>
            {colChildren.map(child => <TaskCard key={child.id} task={child} colIdx={colIdx} isChild />)}
          </div>
        )}
      </div>
    );
  };

  /* ══ TASK CARD ══ */
  const TaskCard = ({ task, colIdx, isChild }: { task: Task; colIdx: number; isChild?: boolean }) => {
    const tm         = TICKET_TYPES[task.ticketType || "task"] || TICKET_TYPES.task;
    const pri        = PRI_CONFIG[task.priority];
    const isSelected = selectedTasks.has(task.id);
    const isDragging = dragTask?.id === task.id;
    const overdue    = isOverdue(task.dueDate, task.status);

    return (
      <div
        draggable={canDragTask(currentUser, task, activeProject)}
        onDragStart={e => { if (!canDragTask(currentUser, task, activeProject)) { e.preventDefault(); return; } handleTaskDragStart(e, task); }}
        onDragEnd={handleTaskDragEnd}
        onClick={() => onTaskClick(task)}
        className={`rounded-xl border cursor-pointer group/card transition-all duration-150 ${isChild ? "mx-2 my-1.5" : "mx-2 my-2"}`}
        style={{
          background: isSelected ? "#eff6ff" : "#fff",
          borderColor: isSelected ? "#6366f1" : overdue ? "#fca5a5" : "#e5e7eb",
          borderWidth: isSelected ? "2px" : "1px",
          boxShadow: isDragging ? "0 16px 40px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.06)",
          transform: isDragging ? "scale(1.04) rotate(1deg)" : "scale(1)",
          borderLeft: `3px solid ${tm.color}`,
          opacity: isDragging ? 0.5 : 1,
          cursor: canDragTask(currentUser, task, activeProject) ? "grab" : "default",
        }}
      >
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <div onClick={e => toggleSelect(task.id, e)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition cursor-pointer ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>
              {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
            </div>
            <span className="text-xs shrink-0">{tm.icon}</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: tm.bg, color: tm.color }}>{task.taskCode || "TSK-001"}</span>
            <div className="flex-1" />
            {pri && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: pri.bg, color: pri.text }}>{pri.label}</span>}
          </div>
          <p className="text-sm font-semibold text-gray-800 group-hover/card:text-indigo-700 transition leading-snug mb-2 line-clamp-2">{task.title}</p>
          {task.description && <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{task.description}</p>}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.slice(0,2).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">#{tag}</span>)}
              {task.tags.length > 2 && <span className="text-[10px] text-gray-400">+{task.tags.length-2}</span>}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {task.assignedToName ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: avatarColor(cleanDisplayName(task.assignedToName)) }}>
                    {avatarInitial(cleanDisplayName(task.assignedToName))}
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 truncate" style={{ maxWidth: "80px" }}>{cleanDisplayName(task.assignedToName)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[9px]">?</div>
                  <span className="text-[10px] text-gray-400">Unassigned</span>
                </div>
              )}
              {formatDate(task.dueDate) && (
                <span className={`text-[10px] font-medium shrink-0 ${overdue ? "text-red-500 font-bold" : "text-gray-400"}`}>
                  {overdue ? "⚡ " : ""}{formatDate(task.dueDate)}
                </span>
              )}
            </div>
            {task.estimatedHours && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 ml-2 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                <span>⏱</span>{task.estimatedHours}h
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ══ TOOLBAR ══ */
  const renderToolbar = () => (
    <div className="sticky top-0 z-30 flex items-center gap-2 p-2 bg-white border-b border-gray-200 shrink-0 w-full overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 bg-gray-50 p-1 rounded-xl border border-gray-100">
        <button onClick={() => setFilters(f => ({ ...f, mine: !f.mine }))}
          className={`h-8 px-2.5 rounded-lg text-[10px] font-bold transition-all border ${filters.mine ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          My Tasks
        </button>
        <button onClick={() => setFilters(f => ({ ...f, overdue: !f.overdue }))}
          className={`h-8 px-2.5 rounded-lg text-[10px] font-bold transition-all border ${filters.overdue ? "bg-red-500 border-red-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          Overdue
        </button>
      </div>
      <div className="h-6 w-px bg-gray-200 mx-1 shrink-0" />
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0">
        <button onClick={() => setViewMode("board")}
          className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all ${viewMode==="board" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Board</button>
        <button onClick={() => setViewMode("swimlane")}
          className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all ${viewMode==="swimlane" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Swimlanes</button>
      </div>
      {viewMode === "swimlane" && (
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
          className="h-8 pl-2 pr-1 text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg outline-none shrink-0">
          <option value="assignee">Group: Assignee</option>
          <option value="priority">Group: Priority</option>
          <option value="type">Group: Type</option>
        </select>
      )}
      <div className="flex-1" />
      <button onClick={() => setIsFullscreen(p => !p)}
        className="h-8 px-3 flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-100 text-[10px] font-bold">
        {isFullscreen ? "↙ Exit" : "↗ Fullscreen"} <span className="opacity-50 font-normal">(F)</span>
      </button>
    </div>
  );

  /* ══ SWIMLANE VIEW ══ */
  const renderSwimlaneView = () => {
    const totalWidth = SWIMLANE_LABEL_WIDTH + columns.length * SWIMLANE_COL_WIDTH;

    let groups: { key: string; label: string; color?: string; tasks: Task[] }[] = [];
    if (groupBy === "assignee") {
      const map = new Map<string, { label: string; tasks: Task[] }>();
      filteredTasks.forEach(t => {
        const key = t.assignedTo || "unassigned";
        if (!map.has(key)) map.set(key, { label: cleanDisplayName(t.assignedToName) || "Unassigned", tasks: [] });
        map.get(key)!.tasks.push(t);
      });
      groups = Array.from(map.entries()).map(([key, g]) => ({ key, ...g }));
    } else if (groupBy === "priority") {
      groups = ["Critical","High","Medium","Low"].map(p => ({
        key: p, label: p, color: PRI_CONFIG[p].dot, tasks: filteredTasks.filter(t => t.priority === p),
      })).filter(g => g.tasks.length > 0);
    } else {
      groups = (["story","task","bug","defect"] as TicketType[]).map(tp => ({
        key: tp, label: TICKET_TYPES[tp].label, color: TICKET_TYPES[tp].color, tasks: filteredTasks.filter(t => t.ticketType === tp),
      })).filter(g => g.tasks.length > 0);
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 relative overflow-auto bg-gray-50/50"
        style={{ scrollbarWidth: "thin" }}>
        <div style={{ minWidth: totalWidth + "px" }}>

          {/* Sticky header */}
          <div className="flex sticky top-0 z-30 bg-white border-b-2 border-gray-100" style={{ minWidth: totalWidth + "px" }}>
            <div style={{ width: SWIMLANE_LABEL_WIDTH }}
              className="shrink-0 sticky left-0 z-40 bg-white border-r border-gray-100 px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              {groupBy === "assignee" ? "Assignee" : groupBy === "priority" ? "Priority" : "Type"}
            </div>

            {columns.map((col, i) => {
              const cfg   = getColStyle(col.id, i);
              const count = filteredTasks.filter(t => t.status === col.id).length;
              const dotKey = `s__${col.id}`;

              return (
                <div key={col.id}
                  style={{ width: SWIMLANE_COL_WIDTH, borderTop: `3px solid ${cfg.dot}`, background: cfg.headerBg }}
                  className="shrink-0 px-4 py-3 flex items-center justify-between border-r border-gray-100">

                  <div className="flex items-center gap-2">
                    {/* ── SWIMLANE COLOR DOT ── */}
                    <ColorDot
                      dotColor={cfg.dot}
                      pickerKey={dotKey}
                      activeKey={activeColorKey}
                      setActiveKey={setActiveColorKey}
                      onSelect={(pal) => handleUpdateColColor(col.id, pal)}
                    />
                    <span className="text-[10px] font-extrabold" style={{ color: cfg.color, whiteSpace: "nowrap" }}>
                      {col.label}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border"
                    style={{ color: cfg.color, borderColor: cfg.border }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Groups */}
          {groups.map(group => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key} className="border-b border-gray-100">
                <div onClick={() => toggleGroup(group.key)}
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer bg-gray-50/80 hover:bg-gray-100 sticky top-11.25 z-20 border-b border-gray-100"
                  style={{ minWidth: totalWidth + "px" }}>
                  {groupBy === "assignee" && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ background: avatarColor(group.label) }}>{avatarInitial(group.label)}</div>
                  )}
                  {group.color && <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />}
                  <span className="text-xs font-bold text-gray-700">{group.label}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{group.tasks.length} items</span>
                  <span className="ml-auto text-gray-400 text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
                </div>
                {!isCollapsed && (
                  <div className="flex" style={{ minWidth: totalWidth + "px" }}>
                    <div style={{ width: SWIMLANE_LABEL_WIDTH }} className="shrink-0 sticky left-0 z-10 bg-gray-50/30 border-r border-gray-100" />
                    {columns.map((col, i) => {
                      const colTasks = group.tasks.filter(t => t.status === col.id);
                      return (
                        <div key={col.id} style={{ width: SWIMLANE_COL_WIDTH }}
                          className="shrink-0 p-2 border-r border-gray-50 min-h-25 flex flex-col gap-2">
                          {colTasks.map(t => (
                            <div key={t.id} onClick={() => onTaskClick(t)}
                              className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group/card">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded"
                                  style={{ background: TICKET_TYPES[t.ticketType||"task"].bg, color: TICKET_TYPES[t.ticketType||"task"].color }}>
                                  {t.taskCode || "TSK"}
                                </span>
                                <div className="flex-1" />
                                {PRI_CONFIG[t.priority] && <div className="w-1.5 h-1.5 rounded-full" style={{ background: PRI_CONFIG[t.priority].dot }} />}
                              </div>
                              <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-snug group-hover/card:text-indigo-600 transition-colors">{t.title}</p>
                              <div className="mt-2 flex items-center justify-between">
                                {t.assignedToName && (
                                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold"
                                    style={{ background: avatarColor(cleanDisplayName(t.assignedToName)) }}>
                                    {avatarInitial(cleanDisplayName(t.assignedToName))}
                                  </div>
                                )}
                                {t.dueDate && <span className={`text-[9px] font-bold ${isOverdue(t.dueDate,t.status) ? "text-red-500" : "text-gray-400"}`}>{formatDate(t.dueDate)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ══ BOARD VIEW ══ */
  const renderBoardView = () => (
    <>
      {columns.map((col, i) => {
        const style      = getColStyle(col.id, i);
        const isCollapsed = collapsedCols.has(col.id);
        const colTasks   = filteredTasks.filter(t => t.status === col.id);
        const taskCount  = colTasks.filter(t => t.ticketType !== "story").length;
        const isOver     = dragOver === col.id;
        const dotKey     = `b__${col.id}`;

        const visibleStories = stories.filter(story => {
          const childrenInCol = filteredTasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story" && t.status === col.id);
          return childrenInCol.length > 0 || story.status === col.id;
        });
        const colOrphans = orphans.filter(t => t.status === col.id);

        return (
          <div key={col.id}
            draggable={canManage && !isCollapsed}
            onDragStart={e => handleDragColumnStart(e, i)}
            onDragOver={e => {
              e.preventDefault();
              if (canManage && draggingColIdx !== null) {
                e.currentTarget.style.borderLeft  = draggingColIdx > i ? "4px solid #6366f1" : "1px solid #e5e7eb";
                e.currentTarget.style.borderRight = draggingColIdx < i ? "4px solid #6366f1" : "1px solid #e5e7eb";
              } else {
                setDragOver(col.id);
              }
            }}
            onDragLeave={e => {
              e.currentTarget.style.borderLeft  = "1px solid #e5e7eb";
              e.currentTarget.style.borderRight = "1px solid #e5e7eb";
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
            }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderLeft  = "1px solid #e5e7eb";
              e.currentTarget.style.borderRight = "1px solid #e5e7eb";
              if (draggingColIdx !== null) handleColumnDrop(e, i);
              else handleTaskDrop(e, col.id);
            }}
            className={`flex flex-col h-full shrink-0 transition-all duration-200 border-r border-gray-100 ${canManage && !isCollapsed ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ width: isCollapsed ? "48px" : "280px", background: isCollapsed ? "#f8fafc" : "#fff" }}
          >
            {/* Column Header */}
            <div className="shrink-0 border-b"
              style={{ background: style.headerBg, borderTopWidth: "3px", borderTopStyle: "solid", borderTopColor: style.dot, borderBottomColor: style.border }}>

              {isCollapsed ? (
                <div className="flex flex-col items-center py-3 gap-2 cursor-pointer" onClick={() => toggleCol(col.id)}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: style.dot }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: style.color }}>{col.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 border"
                    style={{ color: style.color, borderColor: style.border }}>{taskCount}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {/* ── BOARD COLOR DOT ── */}
                  <ColorDot
                    dotColor={style.dot}
                    pickerKey={dotKey}
                    activeKey={activeColorKey}
                    setActiveKey={setActiveColorKey}
                    onSelect={(pal) => handleUpdateColColor(col.id, pal)}
                  />

                  {editingColId === col.id ? (
                    <input autoFocus value={editingLabelVal}
                      onChange={e => setEditingLabelVal(e.target.value)}
                      onBlur={() => handleRenameColumn(col.id)}
                      onKeyDown={e => { if (e.key === "Enter") handleRenameColumn(col.id); if (e.key === "Escape") setEditingColId(null); }}
                      className="flex-1 text-[11px] font-extrabold uppercase tracking-widest bg-white/50 border border-indigo-200 rounded px-1 outline-none"
                      style={{ color: style.color }}
                    />
                  ) : (
                    <span
                      className={`text-[11px] font-extrabold uppercase tracking-widest flex-1 truncate ${canManage ? "cursor-pointer hover:opacity-70" : ""}`}
                      style={{ color: style.color }}
                      onClick={e => { e.stopPropagation(); if (canManage) { setEditingColId(col.id); setEditingLabelVal(col.label); } }}>
                      {col.label}
                    </span>
                  )}

                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border shrink-0"
                    style={{ color: style.color, borderColor: style.border }}>{taskCount}</span>

                  {canManage && (
                    <button onClick={e => { e.stopPropagation(); handleDeleteColumn(col.id); }}
                      className="flex w-5 h-5 items-center justify-center rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition text-[10px] font-bold" title="Delete">✕</button>
                  )}

                  <button onClick={e => { e.stopPropagation(); toggleCol(col.id); }} className="text-gray-400 hover:text-gray-600 transition text-xs">◀</button>
                </div>
              )}
            </div>

            {/* Column Body */}
            {!isCollapsed && (
              <div className="flex-1 overflow-y-auto py-1.5 transition-colors duration-150"
                style={{ background: isOver ? `${style.color}08` : "#f9fafb", minHeight: "200px"  }}>
                {visibleStories.map(story => <StoryCard key={story.id} story={story} colIdx={i} />)}
                {colOrphans.map(task => <TaskCard key={task.id} task={task} colIdx={i} />)}
                {visibleStories.length === 0 && colOrphans.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
                    <div className="w-12 h-12 rounded-2xl border-2 border-dashed flex items-center justify-center text-xl"
                      style={{ borderColor: isOver ? style.color : "#e2e8f0", color: isOver ? style.color : "#d1d5db", background: isOver ? `${style.color}08` : "transparent" }}>+</div>
                    <span className="text-[11px]">Drop here</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Column */}
      {canManage && (
        <div className="shrink-0 w-60 p-4 bg-gray-50/30">
          {addingCol ? (
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xl">
              <input autoFocus value={newColLabel} onChange={e => setNewColLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newColLabel.trim()) {
                    onSaveColumns([...columns, { id: "col_" + Date.now(), label: newColLabel.trim() }]);
                    setNewColLabel(""); setAddingCol(false);
                  }
                  if (e.key === "Escape") { setAddingCol(false); setNewColLabel(""); }
                }}
                placeholder="Column name..."
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-indigo-100 outline-none mb-2" />
              <div className="flex gap-2">
                <button onClick={() => { if (newColLabel.trim()) { onSaveColumns([...columns, { id: "col_"+Date.now(), label: newColLabel.trim() }]); setNewColLabel(""); setAddingCol(false); } }}
                  className="flex-1 py-1.5 text-xs font-bold text-white rounded-lg bg-indigo-600">Add</button>
                <button onClick={() => setAddingCol(false)} className="flex-1 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg">✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCol(true)}
              className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-white transition-all text-xs font-bold">
              <span>+</span> Add Column
            </button>
          )}
        </div>
      )}
    </>
  );

  /* ══ ROOT ══ */
  if (!isMounted) return null;

  const content = (
    <div className={isFullscreen ? "fixed inset-0 z-[9998] bg-white flex flex-col" : "relative h-full w-full flex flex-col"}>

      <style>{`
        .kb-scroll-x { overflow-x: auto; overflow-y: hidden; }
        .kb-scroll-y { overflow-y: auto; overflow-x: hidden; }
        .kb-scroll-x::-webkit-scrollbar, .kb-scroll-y::-webkit-scrollbar { width:6px; height:6px; }
        .kb-scroll-x::-webkit-scrollbar-thumb, .kb-scroll-y::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:10px; }
      `}</style>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete ${selectedTasks.size} selected items?`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {floatingMenu && (
        <FloatingMenu
          position={{ top: floatingMenu.top, left: floatingMenu.left }}
          onClose={() => setFloatingMenu(null)}
          onCreate={ticketType => { if (onCreateTask) onCreateTask(floatingMenu.storyId, ticketType); setFloatingMenu(null); }}
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-white w-full overflow-hidden">
        {renderToolbar()}
        <div className="flex-1 kb-scroll-x relative bg-white">
          <div className="flex h-full min-w-max border-t border-gray-100">
            {viewMode === "board" ? renderBoardView() : (
              <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
                {renderSwimlaneView()}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTasks.size > 0 && (
        <BulkActionBar
          count={selectedTasks.size} columns={columns}
          projectColor={activeProject?.color || "#6366f1"}
          onDelete={() => setConfirmDelete({ type: "bulk" })}
          onMove={handleBulkMove} onClear={clearSelection}
        />
      )}
    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
}