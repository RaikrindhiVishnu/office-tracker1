"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/* ─── TYPES ─── */
export interface KanbanColumn {
  id: string;
  label: string;
  color?: string;   // e.g. "#6366f1"
  bg?: string;      // e.g. "#eef2ff"
  border?: string;  // e.g. "#c7d2fe"
}

export interface Task {
  id: string; title: string; description?: string; projectId: string;
  sprintId?: string | null; assignedTo?: string | null; assignedToName?: string | null;
  assignedDate?: string; dueDate?: string; priority: string; status: string;
  estimatedHours?: number; actualHours?: number; storyPoints?: number;
  tags?: string[];
  ticketType?: "story" | "task" | "bug" | "defect";
  parentStoryId?: string | null;
  parentStoryTitle?: string;
  taskCode?: string;
  createdBy: string; createdAt: any;
}

interface KanbanBoardProps {
  tasks: Task[];
  columns: KanbanColumn[];
  setColumns: (c: KanbanColumn[]) => void;
  projectColor: string;
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, status: string) => void;
  canManage: boolean;
  onSaveColumns: (c: KanbanColumn[]) => void;
  onCreateTask?: (storyId: string, ticketType: string) => void;
}

/* ─── PRIORITY CONFIG ─── */
const PRI: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Low:      { dot: "#22c55e", bg: "#f0fdf4", text: "#16a34a", label: "Low" },
  Medium:   { dot: "#f59e0b", bg: "#fffbeb", text: "#d97706", label: "Medium" },
  High:     { dot: "#f97316", bg: "#fff7ed", text: "#ea580c", label: "High" },
  Critical: { dot: "#ef4444", bg: "#fef2f2", text: "#dc2626", label: "Critical" },
};

const TYPE_META: Record<string, { icon: string; color: string; label: string; bg: string; border: string }> = {
  story:  { icon: "📘", color: "#3730a3", label: "Story",  bg: "#eef2ff", border: "#c7d2fe" },
  task:   { icon: "🧩", color: "#0369a1", label: "Task",   bg: "#eff6ff", border: "#bfdbfe" },
  bug:    { icon: "🐞", color: "#b91c1c", label: "Bug",    bg: "#fef2f2", border: "#fecaca" },
  defect: { icon: "🎯", color: "#b45309", label: "Defect", bg: "#fffbeb", border: "#fde68a" },
};

const TYPE_PREFIX: Record<string, string> = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };

export function generateTaskCode(ticketType: string, existingTasks: Task[]): string {
  const prefix = TYPE_PREFIX[ticketType] || "TSK";
  const max = existingTasks
    .filter(t => t.taskCode?.startsWith(prefix + "-"))
    .map(t => parseInt(t.taskCode!.split("-")[1] || "0", 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

const AVATAR_COLORS = ["#6366f1","#7c3aed","#db2777","#d97706","#059669","#0891b2","#e11d48","#0284c7"];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const DEFAULT_COL_COLORS = [
  { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
  { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { color: "#db2777", bg: "#fdf2f8", border: "#fbcfe8" },
];

function getColStyle(col: KanbanColumn, idx: number) {
  const def = DEFAULT_COL_COLORS[idx % DEFAULT_COL_COLORS.length];
  return {
    color: col.color || def.color,
    bg: col.bg || def.bg,
    border: col.border || def.border,
  };
}

/* ─── CONFIRM DIALOG ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-sm text-gray-700 mb-5 font-medium">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ─── COLOR PICKER ─── */
const PRESET_COLORS = [
  "#6366f1","#7c3aed","#db2777","#e11d48","#dc2626","#ea580c",
  "#d97706","#16a34a","#0891b2","#0369a1","#64748b","#374151",
];

function ColColorPicker({ color, onChange, onClose }: { color: string; onChange: (c: string) => void; onClose: () => void }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9997 }} />
      <div style={{ position: "fixed", zIndex: 9998, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
        className="bg-white rounded-2xl shadow-2xl p-4 w-56 border border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Column Color</p>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => { onChange(c); onClose(); }}
              className="w-7 h-7 rounded-full transition-all hover:scale-110 border-2"
              style={{ background: c, borderColor: color === c ? "#1e293b" : "transparent" }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input type="color" value={color} onChange={e => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
          <span className="text-xs text-gray-500">Custom</span>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── BULK ACTION BAR ─── */
function BulkActionBar({
  count, columns, users, projectColor,
  onDelete, onMove, onAssign, onPriority, onClear
}: {
  count: number;
  columns: KanbanColumn[];
  users: any[];
  projectColor: string;
  onDelete: () => void;
  onMove: (colId: string) => void;
  onAssign: (uid: string) => void;
  onPriority: (p: string) => void;
  onClear: () => void;
}) {
  const [showMove, setShowMove] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPriority, setShowPriority] = useState(false);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border border-white/20"
      style={{ background: projectColor, backdropFilter: "blur(8px)" }}>
      <span className="text-white text-xs font-bold mr-2 bg-white/20 px-2 py-0.5 rounded-full">{count} selected</span>

      {/* Move */}
      <div className="relative">
        <button onClick={() => { setShowMove(!showMove); setShowAssign(false); setShowPriority(false); }}
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

      {/* Assign */}
      <div className="relative">
        <button onClick={() => { setShowAssign(!showAssign); setShowMove(false); setShowPriority(false); }}
          className="flex items-center gap-1 text-white text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition">
          👤 Assign
        </button>
        {showAssign && (
          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-48 z-10 max-h-48 overflow-y-auto">
            <button onClick={() => { onAssign(""); setShowAssign(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500">Unassigned</button>
            {users.map((u: any) => (
              <button key={u.uid} onClick={() => { onAssign(u.uid); setShowAssign(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">
                {u.displayName || u.name || u.email?.split("@")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="relative">
        <button onClick={() => { setShowPriority(!showPriority); setShowMove(false); setShowAssign(false); }}
          className="flex items-center gap-1 text-white text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition">
          ⚡ Priority
        </button>
        {showPriority && (
          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-36 z-10">
            {["Low","Medium","High","Critical"].map(p => (
              <button key={p} onClick={() => { onPriority(p); setShowPriority(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                style={{ color: PRI[p]?.text }}>{PRI[p]?.dot ? "● " : ""}{p}</button>
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
  open,
  onClose,
  onSubmit,
  users,
  columns,
  projectColor,
  stories,
  defaultStoryId,
  defaultTicketType,
  existingTasks = [],
  editingTask, // ✅ ADD HERE
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (f: any, editingTask?: Task | null) => void;
  users: any[];
  columns: KanbanColumn[];
  projectColor: string;
  stories?: Task[];
  defaultStoryId?: string;
  defaultTicketType?: string;
  existingTasks?: Task[];

  editingTask?: Task | null; // ✅ ADD HERE
}) {
  const getAutoCode = (ticketType: string) => generateTaskCode(ticketType, existingTasks);

  const [f, setF] = useState({
    title: "", description: "", assignedTo: "", dueDate: "", priority: "Medium",
    status: columns[0]?.id || "todo", estimatedHours: "", storyPoints: "3", tags: "",
    ticketType: defaultTicketType || "task",
    parentStoryId: defaultStoryId || "",
    taskCode: getAutoCode(defaultTicketType || "task"),
  });

  useEffect(() => {
  if (editingTask) {
    setF({
      title: editingTask.title || "",
      description: editingTask.description || "",
      assignedTo: editingTask.assignedTo || "",
      dueDate: editingTask.dueDate || "",
      priority: editingTask.priority || "Medium",
      status: editingTask.status || columns[0]?.id,
      estimatedHours: editingTask.estimatedHours?.toString() || "",
      storyPoints: editingTask.storyPoints?.toString() || "3",
      tags: editingTask.tags?.join(",") || "",
      ticketType: editingTask.ticketType || "task",
      parentStoryId: editingTask.parentStoryId || "",
      taskCode: editingTask.taskCode || "",
    });
  }
}, [editingTask]);

  const [taskCodeManual, setTaskCodeManual] = useState(false);

useEffect(() => {
  if (editingTask) return; // ✅ IMPORTANT FIX

  const t = defaultTicketType || "task";
  setF(prev => ({
    ...prev,
    ticketType: t,
    parentStoryId: defaultStoryId || "",
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

  useEffect(() => {
  if (editingTask) {
    setF({
      title: editingTask.title || "",
      description: editingTask.description || "",
      assignedTo: editingTask.assignedTo || "",
      dueDate: editingTask.dueDate || "",
      priority: editingTask.priority || "Medium",
      status: editingTask.status || columns[0]?.id,
      estimatedHours: editingTask.estimatedHours?.toString() || "",
      storyPoints: editingTask.storyPoints?.toString() || "3",
      tags: editingTask.tags?.join(",") || "",
      ticketType: editingTask.ticketType || "task",
      parentStoryId: editingTask.parentStoryId || "",
      taskCode: editingTask.taskCode || "",
    });
  }
}, [editingTask]);

  if (!open) return null;
  const isStory = f.ticketType === "story";

 const submit = () => {
  if (!f.title.trim()) return;

const data = {
  ...f,
  estimatedHours: f.estimatedHours ? Number(f.estimatedHours) : undefined,
  storyPoints: f.storyPoints ? Number(f.storyPoints) : undefined,
  tags: f.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
};

  if (editingTask) {
    onSubmit(data, editingTask); // ✅ UPDATE MODE
  } else {
    onSubmit(data); // ✅ CREATE MODE
  }

  onClose();
};

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${projectColor}, ${projectColor}dd)` }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{TYPE_META[f.ticketType]?.icon || "🧩"}</span>
            <h3 className="font-bold text-white text-sm">
              {isStory ? "Create Story" : `Create ${TYPE_META[f.ticketType]?.label || "Task"}`}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">✕</button>
        </div>

        <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">
          {/* Type Selector */}
          <div className="flex gap-2">
            {(["story", "task", "bug", "defect"] as const).map(t => {
              const tm = TYPE_META[t];
              const sel = f.ticketType === t;
              return (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className="flex-1 flex flex-col items-center py-2.5 rounded-xl border-2 transition-all text-xs font-semibold gap-1"
                  style={sel ? { borderColor: tm.color, background: tm.bg, color: tm.color } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                  <span className="text-base">{tm.icon}</span>
                  {tm.label}
                </button>
              );
            })}
          </div>

          {/* Task ID */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold pointer-events-none"
              style={{ color: TYPE_META[f.ticketType]?.color || "#64748b" }}>
              {TYPE_PREFIX[f.ticketType] || "TSK"}-
            </span>
            <input value={f.taskCode?.replace(/^[A-Z]+-/, "") || ""}
              onChange={e => {
                const num = e.target.value.replace(/\D/g, "").slice(0, 6);
                const prefix = TYPE_PREFIX[f.ticketType] || "TSK";
                setF(prev => ({ ...prev, taskCode: num ? `${prefix}-${num.padStart(3, "0")}` : `${prefix}-` }));
                setTaskCodeManual(true);
              }}
              placeholder="001"
              className="w-full border border-gray-200 rounded-lg pl-12 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
              style={{ borderColor: taskCodeManual ? "#6366f1" : "#e5e7eb" }} />
          </div>

          {/* Parent Story */}
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

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Title <span className="text-red-400">*</span></label>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })}
              placeholder={`${TYPE_META[f.ticketType]?.label || "Task"} title...`} autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          {/* Description */}
          <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2}
            placeholder="Description..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Assignee</label>
              <select value={f.assignedTo} onChange={e => setF({ ...f, assignedTo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.uid} value={u.uid}>{u.displayName || u.name || u.email?.split("@")[0] || "Unknown"}</option>)}
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
                <input
  type="number"
  value={f.estimatedHours || ""}
  onChange={e =>
    setF({
      ...f,
      estimatedHours: e.target.value
    })
  }
  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
/>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Story Points</label>
              <input
  type="number"
  value={f.storyPoints || ""}
  onChange={e => setF({ ...f, storyPoints: e.target.value })}
/>
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
            {editingTask
  ? "Update Task"
  : `Create ${TYPE_META[f.ticketType]?.label || "Task"}`
}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FLOATING CHILD MENU ─── */
const FloatingMenu = ({ position, onClose, onCreate }: {
  position: { top: number; left: number }; onClose: () => void; onCreate: (t: string) => void;
}) => createPortal(
  <>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
    <div style={{ position: "fixed", top: position.top, left: position.left, zIndex: 9999 }}
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

/* ─── MAIN KANBAN BOARD ─── */
export function KanbanBoard({
  tasks, columns, setColumns, projectColor,
  onTaskClick, onStatusChange, canManage, onSaveColumns, onCreateTask,
}: KanbanBoardProps) {
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null); // column being dragged
  const [dragColOverId, setDragColOverId] = useState<string | null>(null);
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ type: "col"; colIdx: number } | { type: "bulk" } | null>(null);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [colorPickerColIdx, setColorPickerColIdx] = useState<number | null>(null);
  const [floatingMenu, setFloatingMenu] = useState<{ storyId: string; top: number; left: number } | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");

  const boardRef = useRef<HTMLDivElement>(null);

  /* ── Helpers ── */
  const stories = tasks.filter(t => t.ticketType === "story");
  const orphans = tasks.filter(t => t.ticketType !== "story" && !t.parentStoryId);

  const toggleStory = (id: string) => setCollapsedStories(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const toggleCol = (id: string) => setCollapsedCols(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTasks(prev => {
      const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
    });
  };

  const clearSelection = () => setSelectedTasks(new Set());

  const formatDate = (d?: string) => {
    if (!d) return null;
    const dt = new Date(d + "T12:00:00");
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  /* ── Column ops ── */
  const handleDeleteColumn = (colIdx: number) => {
    const colToDelete = columns[colIdx];
    const adjacent = columns[colIdx - 1] || columns[colIdx + 1];
    if (adjacent) tasks.forEach(t => { if (t.status === colToDelete.id) onStatusChange(t.id, adjacent.id); });
    onSaveColumns(columns.filter((_, i) => i !== colIdx));
    setConfirmDelete(null);
  };

  const handleColLabelSave = (colIdx: number) => {
    if (!editingColLabel.trim()) { setEditingColIdx(null); return; }
    const updated = columns.map((c, i) => i === colIdx ? { ...c, label: editingColLabel } : c);
    setColumns(updated); onSaveColumns(updated); setEditingColIdx(null);
  };

  const handleColColorChange = (colIdx: number, color: string) => {
    const hsl = hexToHsl(color);
    const bg = `hsl(${hsl.h},${Math.min(hsl.s, 60)}%,${Math.max(hsl.l, 90)}%)`;
    const border = `hsl(${hsl.h},${Math.min(hsl.s, 50)}%,${Math.max(hsl.l, 75)}%)`;
    const updated = columns.map((c, i) => i === colIdx ? { ...c, color, bg, border } : c);
    setColumns(updated); onSaveColumns(updated);
  };

  /* ── Bulk actions ── */
  const handleBulkMove = (colId: string) => {
    selectedTasks.forEach(id => onStatusChange(id, colId));
    clearSelection();
  };
  const handleBulkDelete = () => {
    // signal parent to delete (parent handles Firestore)
    selectedTasks.forEach(id => onStatusChange(id, "__DELETE__"));
    clearSelection(); setConfirmDelete(null);
  };
  const handleBulkAssign = (uid: string) => {
    // parent handles; we just signal via status trick — better: call onBulkAssign if provided
    clearSelection();
  };
  const handleBulkPriority = (priority: string) => {
    clearSelection();
  };

  /* ── Column drag ── */
  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    if (!canManage) { e.preventDefault(); return; }
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!dragColId || dragColId === targetColId) { setDragColId(null); setDragColOverId(null); return; }
    const from = columns.findIndex(c => c.id === dragColId);
    const to = columns.findIndex(c => c.id === targetColId);
    const reordered = [...columns];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setColumns(reordered); onSaveColumns(reordered);
    setDragColId(null); setDragColOverId(null);
  };

  /* ── Task drag ── */
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDragTask(task);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => { el.style.opacity = "0.4"; }, 0);
  };
  const handleTaskDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragTask(null); setDragOver(null);
  };
  const handleTaskDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragTask && dragTask.status !== colId && dragTask.ticketType !== "story") {
      onStatusChange(dragTask.id, colId);
    }
    setDragTask(null); setDragOver(null);
  };

  /* ── STORY CARD ── */
  const StoryCard = ({ story, colIdx }: { story: Task; colIdx: number }) => {
    const isCollapsed = collapsedStories.has(story.id);
    const allChildren = tasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story");
    const colChildren = allChildren.filter(t => t.status === columns[colIdx]?.id);
    const doneCount = allChildren.filter(t => t.status === "done").length;
    const pct = allChildren.length ? Math.round((doneCount / allChildren.length) * 100) : 0;
    const pri = PRI[story.priority];
    const isSelected = selectedTasks.has(story.id);
    const isOverdue = story.dueDate && new Date(story.dueDate) < new Date();

    return (
      <div className="mx-2 my-2 rounded-xl overflow-hidden transition-all duration-200"
        style={{
          background: isSelected ? "#eef2ff" : "#f5f3ff",
          border: `2px solid ${isSelected ? "#6366f1" : "#c4b5fd"}`,
          boxShadow: "0 2px 8px rgba(99,102,241,0.10)",
        }}>
        {/* Story Header — full card */}
        <div
          draggable={canManage}
          onDragStart={e => handleTaskDragStart(e, story)}
          onDragEnd={handleTaskDragEnd}
          className="p-3 cursor-pointer"
          onClick={() => onTaskClick(story)}
        >
          {/* Top row */}
          <div className="flex items-center gap-2 mb-2">
            {/* Checkbox */}
            <div onClick={e => toggleSelect(story.id, e)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition cursor-pointer ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-indigo-300 bg-white"}`}>
              {isSelected && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#ddd6fe", color: "#5b21b6" }}>
              {story.taskCode || "STR-001"}
            </span>
            <span className="text-xs">📘</span>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">Story</span>
            <div className="flex-1" />
            {/* Priority */}
            {pri && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: pri.bg, color: pri.text }}>
                {pri.label}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-bold text-indigo-900 leading-snug mb-2 line-clamp-2">{story.title}</p>

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {story.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">#{tag}</span>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-indigo-400 font-medium">{doneCount}/{allChildren.length} tasks</span>
              <span className="text-[10px] font-bold text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1" }} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Assignee */}
              {story.assignedToName ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: avatarColor(story.assignedToName) }} title={story.assignedToName}>
                  {story.assignedToName[0].toUpperCase()}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-300 text-[10px]">?</div>
              )}
              {story.dueDate && (
                <span className={`text-[10px] font-medium ${isOverdue ? "text-red-500" : "text-indigo-400"}`}>
                  {isOverdue ? "⚠️ " : ""}{formatDate(story.dueDate)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Collapse/Expand */}
              <button onClick={e => { e.stopPropagation(); toggleStory(story.id); }}
                className="w-6 h-6 rounded-md bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-600 transition text-[10px]">
                {isCollapsed ? "▶" : "▼"}
              </button>
              {/* Add child */}
              {canManage && onCreateTask && (
                <button onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setFloatingMenu({ storyId: story.id, top: rect.bottom + 6, left: rect.left });
                }}
                  className="w-6 h-6 rounded-md bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition text-sm font-bold">
                  +
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Children (collapsed/expanded) */}
        {!isCollapsed && (
          <div style={{ borderTop: "1px solid #ddd6fe", background: "#faf5ff" }}>
            {colChildren.map(child => (
              <TaskCard key={child.id} task={child} colIdx={colIdx} isChild />
            ))}
            {colChildren.length === 0 && (
              <div className="py-3 text-center text-[10px] text-indigo-300 italic">No items in this column</div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ── TASK CARD ── */
  const TaskCard = ({ task, colIdx, isChild }: { task: Task; colIdx: number; isChild?: boolean }) => {
    const tm = TYPE_META[task.ticketType || "task"] || TYPE_META.task;
    const pri = PRI[task.priority];
    const isSelected = selectedTasks.has(task.id);
    const isDragging = dragTask?.id === task.id;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
    const dueFmt = formatDate(task.dueDate);

    return (
      <div
        draggable={canManage}
        onDragStart={e => handleTaskDragStart(e, task)}
        onDragEnd={handleTaskDragEnd}
        onClick={() => onTaskClick(task)}
        className={`rounded-xl border cursor-pointer group/card transition-all duration-150 ${isChild ? "mx-2 my-1.5" : "mx-2 my-2"}`}
        style={{
          background: isSelected ? "#eff6ff" : "#fff",
          borderColor: isSelected ? "#6366f1" : isOverdue ? "#fca5a5" : "#e5e7eb",
          borderWidth: isSelected ? "2px" : "1px",
          boxShadow: isDragging ? "0 16px 40px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.06)",
          transform: isDragging ? "scale(1.04) rotate(1deg)" : "scale(1)",
          borderLeft: isChild ? `3px solid ${tm.color}` : `3px solid ${tm.color}`,
          opacity: isDragging ? 0.5 : 1,
          paddingLeft: isChild ? "6px" : undefined,
        }}
      >
        <div className="px-3 pt-3 pb-2">
          {/* Top row */}
          <div className="flex items-center gap-1.5 mb-2">
            {/* Checkbox */}
            <div onClick={e => toggleSelect(task.id, e)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition cursor-pointer ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>
              {isSelected && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
            </div>
            <span className="text-xs shrink-0">{tm.icon}</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: tm.bg, color: tm.color }}>
              {task.taskCode || "TSK-001"}
            </span>
            <div className="flex-1" />
            {pri && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: pri.bg, color: pri.text }}>
                {pri.label}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-gray-800 group-hover/card:text-indigo-700 transition leading-snug mb-2 line-clamp-2">{task.title}</p>

          {/* Description */}
          {task.description && (
            <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{task.description}</p>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">#{tag}</span>
              ))}
              {task.tags.length > 2 && <span className="text-[10px] text-gray-400">+{task.tags.length - 2}</span>}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {task.assignedToName ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: avatarColor(task.assignedToName) }} title={task.assignedToName}>
                  {task.assignedToName[0].toUpperCase()}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[10px]">?</div>
              )}
              {dueFmt && (
                <span className={`text-[10px] font-medium ${isOverdue ? "text-red-500 font-bold" : "text-gray-400"}`}>
                  {isOverdue ? "⚠️ " : ""}{dueFmt}
                </span>
              )}
            </div>
            {task.estimatedHours ? (
              <div className="flex items-center gap-1">
                <div className="w-12 bg-gray-100 rounded-full h-1 overflow-hidden">
                  <div className="h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(((task.actualHours || 0) / task.estimatedHours) * 100, 100)}%`, background: "#6366f1" }} />
                </div>
                <span className="text-[10px] text-gray-400">{task.actualHours || 0}h</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  /* ── COLUMN ── */
  const KanbanCol = ({ col, colIdx }: { col: KanbanColumn; colIdx: number }) => {
    const style = getColStyle(col, colIdx);
    const isOver = dragOver === col.id;
    const isColDragOver = dragColOverId === col.id;
    const isCollapsed = collapsedCols.has(col.id);
    const isEditingLabel = editingColIdx === colIdx;
    const showColorPicker = colorPickerColIdx === colIdx;

    const colTasks = tasks.filter(t => t.status === col.id);
    const colStories = stories.filter(s => s.status === col.id || tasks.some(t => t.parentStoryId === s.id && t.status === col.id));
    const colOrphans = orphans.filter(t => t.status === col.id);
    const taskCount = colTasks.filter(t => t.ticketType !== "story").length;

    // Stories visible in this column: show story if it has children here, OR if it's placed in this col
    const visibleStories = stories.filter(story => {
      const childrenInCol = tasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story" && t.status === col.id);
      return childrenInCol.length > 0 || story.status === col.id;
    });

    return (
      <div
        className="flex flex-col shrink-0 transition-all duration-200"
        style={{
          width: isCollapsed ? "56px" : "288px",
          borderRight: "1px solid #e8ecf0",
          height: "100%",
          background: isColDragOver ? `${style.color}08` : undefined,
          opacity: dragColId && dragColId !== col.id ? 0.7 : 1,
        }}
        onDragOver={e => { e.preventDefault(); if (dragColId) setDragColOverId(col.id); else setDragOver(col.id); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOver(null); setDragColOverId(null); } }}
        onDrop={e => { if (dragColId) handleColDrop(e, col.id); else handleTaskDrop(e, col.id); }}
      >
        {/* Column Header */}
        <div className="shrink-0 border-b"
          style={{ background: style.bg, borderColor: style.border }}
          draggable={canManage}
          onDragStart={e => { e.stopPropagation(); handleColDragStart(e, col.id); }}
          onDragEnd={() => { setDragColId(null); setDragColOverId(null); }}>

          {isCollapsed ? (
            <div className="flex flex-col items-center py-3 gap-2 cursor-pointer" onClick={() => toggleCol(col.id)}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: style.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: style.color }}>
                {col.label}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 border" style={{ color: style.color, borderColor: style.border }}>{taskCount}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {canManage ? (
                  <div className="w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition"
                    style={{ background: style.color }}
                    onClick={() => setColorPickerColIdx(showColorPicker ? null : colIdx)} />
                ) : (
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: style.color }} />
                )}

                {isEditingLabel ? (
                  <input value={editingColLabel} autoFocus
                    onChange={e => setEditingColLabel(e.target.value)}
                    onBlur={() => handleColLabelSave(colIdx)}
                    onKeyDown={e => { if (e.key === "Enter") handleColLabelSave(colIdx); if (e.key === "Escape") setEditingColIdx(null); }}
                    className="flex-1 text-xs font-bold bg-white border border-indigo-200 rounded px-1.5 py-0.5 outline-none"
                    style={{ color: style.color }} />
                ) : (
                  <span
                    onClick={() => { if (canManage) { setEditingColIdx(colIdx); setEditingColLabel(col.label); } }}
                    className={`text-xs font-bold uppercase tracking-wider flex-1 truncate ${canManage ? "cursor-pointer hover:opacity-70" : ""}`}
                    style={{ color: style.color }}
                    title={canManage ? "Click to rename" : col.label}>
                    {col.label}
                  </span>
                )}

                <span className="text-xs font-bold bg-white/80 rounded-full px-1.5 py-0.5 border shrink-0"
                  style={{ color: style.color, borderColor: style.border }}>{taskCount}</span>

                <button onClick={() => toggleCol(col.id)} title="Collapse"
                  className="text-gray-300 hover:text-gray-500 text-xs shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/50 transition">
                  ◀
                </button>

                {canManage && (
                  <button onClick={() => setConfirmDelete({ type: "col", colIdx })} title="Delete column"
                    className="text-gray-200 hover:text-red-400 text-xs shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition">
                    ✕
                  </button>
                )}
              </div>

              {/* Sub-header */}
              <div className="flex items-center px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider"
                style={{ background: `${style.bg}cc`, borderTop: `1px solid ${style.border}50` }}>
                <span className="flex-1">Task</span>
                <span className="w-14 text-right shrink-0">Priority</span>
                <span className="w-12 text-right shrink-0">Due</span>
              </div>
            </>
          )}

          {/* Color picker */}
          {showColorPicker && (
            <ColColorPicker
              color={col.color || style.color}
              onChange={c => handleColColorChange(colIdx, c)}
              onClose={() => setColorPickerColIdx(null)}
            />
          )}
        </div>

        {/* Column Body */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto py-1.5 transition-colors duration-150"
            style={{ background: isOver ? `${style.color}08` : "#f9fafb", minHeight: "200px" }}>

            {/* Stories */}
            {visibleStories.map(story => (
              <StoryCard key={story.id} story={story} colIdx={colIdx} />
            ))}

            {/* Orphan tasks */}
            {colOrphans.map(task => (
              <TaskCard key={task.id} task={task} colIdx={colIdx} />
            ))}

            {/* Empty state */}
            {visibleStories.length === 0 && colOrphans.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
                <div className="w-12 h-12 rounded-2xl border-2 border-dashed flex items-center justify-center text-xl transition"
                  style={{
                    borderColor: isOver ? style.color : "#e2e8f0",
                    color: isOver ? style.color : "#d1d5db",
                    background: isOver ? `${style.color}08` : "transparent"
                  }}>+</div>
                <span className="text-[11px]">Drop here</span>
              </div>
            )}

            {/* Drop indicator */}
            {isOver && (visibleStories.length > 0 || colOrphans.length > 0) && (
              <div className="mx-3 mt-1 mb-2 h-1 rounded-full opacity-60"
                style={{ background: `linear-gradient(90deg, ${style.color}, ${projectColor})` }} />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full w-full">
      {/* Confirm dialogs */}
      {confirmDelete !== null && (
        <ConfirmDialog
          message={
            confirmDelete.type === "bulk"
              ? `Delete ${selectedTasks.size} selected task${selectedTasks.size > 1 ? "s" : ""}?`
              : `Delete "${columns[(confirmDelete as any).colIdx]?.label}" column? Tasks will move to adjacent column.`
          }
          onConfirm={() => {
            if (confirmDelete.type === "bulk") handleBulkDelete();
            else handleDeleteColumn((confirmDelete as any).colIdx);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Floating child menu */}
      {floatingMenu && (
        <FloatingMenu
          position={{ top: floatingMenu.top, left: floatingMenu.left }}
          onClose={() => setFloatingMenu(null)}
          onCreate={ticketType => {
            if (onCreateTask) onCreateTask(floatingMenu.storyId, ticketType);
            setFloatingMenu(null);
          }}
        />
      )}

      {/* Board */}
      <div ref={boardRef}
        className="flex flex-row overflow-x-auto overflow-y-hidden h-full"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent", contain: "strict" }}>

        {columns.map((col, i) => (
          <KanbanCol key={col.id} col={col} colIdx={i} />
        ))}

        {/* Add Column */}
        {canManage && (
          <div className="flex flex-col shrink-0 px-3 py-2" style={{ minWidth: "180px" }}>
            {addingCol ? (
              <div className="flex flex-col gap-2 mt-1">
                <input autoFocus value={newColLabel} onChange={e => setNewColLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newColLabel.trim()) {
                      const newCol: KanbanColumn = { id: "col_" + Date.now(), label: newColLabel.trim() };
                      onSaveColumns([...columns, newCol]);
                      setNewColLabel(""); setAddingCol(false);
                    }
                    if (e.key === "Escape") { setAddingCol(false); setNewColLabel(""); }
                  }}
                  placeholder="Column name..."
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (newColLabel.trim()) {
                      const newCol: KanbanColumn = { id: "col_" + Date.now(), label: newColLabel.trim() };
                      onSaveColumns([...columns, newCol]);
                      setNewColLabel(""); setAddingCol(false);
                    }
                  }} className="flex-1 py-1.5 text-xs font-bold text-white rounded-lg" style={{ background: "#6366f1" }}>
                    Add
                  </button>
                  <button onClick={() => { setAddingCol(false); setNewColLabel(""); }}
                    className="flex-1 py-1.5 text-xs font-semibold text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingCol(true)}
                className="h-10 mt-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1.5 text-sm font-semibold px-4 whitespace-nowrap">
                <span className="text-lg leading-none">+</span> Add Column
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selectedTasks.size > 0 && (
        <BulkActionBar
          count={selectedTasks.size}
          columns={columns}
          users={[]}
          projectColor={projectColor}
          onDelete={() => setConfirmDelete({ type: "bulk" })}
          onMove={handleBulkMove}
          onAssign={handleBulkAssign}
          onPriority={handleBulkPriority}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}

/* ─── HEX TO HSL UTILITY ─── */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}