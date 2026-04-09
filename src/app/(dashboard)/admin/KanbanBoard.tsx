"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/* ─── TYPES ─── */
export interface KanbanColumn { id: string; label: string; }
export interface Task {
  id: string; title: string; description?: string; projectId: string;
  sprintId?: string | null; assignedTo?: string | null; assignedToName?: string | null;
  assignedDate?: string; dueDate?: string; priority: string; status: string;
  estimatedHours?: number; actualHours?: number; storyPoints?: number;
  tags?: string[];
  // ✅ UNIFIED FIELDS — use ONLY these, never "type" or "parentId"
  ticketType?: "story" | "task" | "bug" | "defect";
  parentStoryId?: string | null;
  parentStoryTitle?: string;
  taskCode?: string; // e.g. STR-001, TSK-003
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
const PRI_DOT: Record<string, string> = {
  Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444",
};
const PRI_BG: Record<string, string> = {
  Low: "#f0fdf4", Medium: "#fffbeb", High: "#fff7ed", Critical: "#fef2f2",
};
const PRI_TEXT: Record<string, string> = {
  Low: "#16a34a", Medium: "#d97706", High: "#ea580c", Critical: "#dc2626",
};

// ✅ Keyed by ticketType (unified)
const TYPE_META: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  story:  { icon: "📘", color: "#3730a3", label: "Story",  bg: "#eef2ff" },
  task:   { icon: "🧩", color: "#0369a1", label: "Task",   bg: "#eff6ff" },
  bug:    { icon: "🐞", color: "#b91c1c", label: "Bug",    bg: "#fef2f2" },
  defect: { icon: "🎯", color: "#b45309", label: "Defect", bg: "#fffbeb" },
};

/* ─── ID GENERATION ─── */
const TYPE_PREFIX: Record<string, string> = {
  story: "STR", task: "TSK", bug: "BUG", defect: "DEF",
};

export function generateTaskCode(ticketType: string, existingTasks: Task[]): string {
  const prefix = TYPE_PREFIX[ticketType] || "TSK";
  const max = existingTasks
    .filter(t => t.taskCode?.startsWith(prefix + "-"))
    .map(t => parseInt(t.taskCode!.split("-")[1] || "0", 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

const COL_PALETTE = [
  { dot: "#94a3b8", headerBg: "#f8fafc", border: "#e2e8f0", subHdr: "#f1f5f9", text: "#64748b" },
  { dot: "#3b82f6", headerBg: "#eff6ff", border: "#bfdbfe", subHdr: "#dbeafe", text: "#2563eb" },
  { dot: "#8b5cf6", headerBg: "#f5f3ff", border: "#ddd6fe", subHdr: "#ede9fe", text: "#7c3aed" },
  { dot: "#22c55e", headerBg: "#f0fdf4", border: "#bbf7d0", subHdr: "#dcfce7", text: "#16a34a" },
  { dot: "#ef4444", headerBg: "#fef2f2", border: "#fecaca", subHdr: "#fee2e2", text: "#dc2626" },
  { dot: "#06b6d4", headerBg: "#ecfeff", border: "#a5f3fc", subHdr: "#cffafe", text: "#0891b2" },
  { dot: "#f59e0b", headerBg: "#fffbeb", border: "#fde68a", subHdr: "#fef3c7", text: "#d97706" },
  { dot: "#ec4899", headerBg: "#fdf2f8", border: "#fbcfe8", subHdr: "#fce7f3", text: "#db2777" },
];

/* ─── AVATAR COLORS ─── */
const AVATAR_COLORS = ["#6366f1","#7c3aed","#db2777","#d97706","#059669","#0891b2","#e11d48","#0284c7"];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ─── CONFIRM DIALOG ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void; }) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-sm text-gray-700 mb-5 font-medium">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── TASK MODAL ─── */
export function TaskModal({ open, onClose, onSubmit, users, columns, projectColor, stories, defaultStoryId, defaultTicketType, existingTasks = [] }: {
  open: boolean; onClose: () => void;
  onSubmit: (f: any) => void;
  users: any[]; columns: KanbanColumn[]; projectColor: string;
  stories?: Task[];
  defaultStoryId?: string;
  defaultTicketType?: string;   // ✅ renamed from defaultType
  existingTasks?: Task[];
}) {
  const getAutoCode = (ticketType: string) => generateTaskCode(ticketType, existingTasks);

  const [f, setF] = useState({
    title: "", description: "", assignedTo: "", dueDate: "", priority: "Medium",
    status: columns[0]?.id || "todo", estimatedHours: "", storyPoints: "3",
    tags: "",
    ticketType: defaultTicketType || "task",   // ✅ unified field
    parentStoryId: defaultStoryId || "",        // ✅ unified field
    taskCode: getAutoCode(defaultTicketType || "task"),
  });
  const [taskCodeManual, setTaskCodeManual] = useState(false);

  useEffect(() => {
    const t = defaultTicketType || "task";
    const auto = getAutoCode(t);
    setF(prev => ({
      ...prev,
      ticketType: t,
      parentStoryId: defaultStoryId || "",
      status: columns[0]?.id || "todo",
      taskCode: auto,
    }));
    setTaskCodeManual(false);
  }, [open, defaultTicketType, defaultStoryId, columns]);

  // Auto-update taskCode when ticketType changes (unless user manually edited)
  const handleTypeChange = (t: string) => {
    setF(prev => ({
      ...prev,
      ticketType: t,
      parentStoryId: t === "story" ? "" : prev.parentStoryId,
      taskCode: taskCodeManual ? prev.taskCode : getAutoCode(t),
    }));
  };

  if (!open) return null;
  const isStory = f.ticketType === "story";

  const submit = () => {
    if (!f.title.trim()) return;
    const taskCode = f.taskCode?.trim() || generateTaskCode(f.ticketType, existingTasks);
    // ✅ Output uses unified field names ticketType + parentStoryId
    onSubmit({
      title: f.title,
      description: f.description,
      ticketType: f.ticketType,
      parentStoryId: f.parentStoryId || null,
      priority: f.priority,
      status: f.status,
      assignedTo: f.assignedTo,
      estimatedHours: Number(f.estimatedHours) || 0,
      storyPoints: Number(f.storyPoints) || 0,
      tags: f.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      taskCode,
    });
    setF({ title: "", description: "", assignedTo: "", dueDate: "", priority: "Medium", status: columns[0]?.id || "todo", estimatedHours: "", storyPoints: "3", tags: "", ticketType: "task", parentStoryId: "", taskCode: getAutoCode("task") });
    setTaskCodeManual(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: projectColor }}>
          <h3 className="font-bold text-white text-sm">
            {isStory ? "📘 Create Story" : `${TYPE_META[f.ticketType]?.icon || "🧩"} Create ${TYPE_META[f.ticketType]?.label || "Task"}`}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg">✕</button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Type</label>
            <div className="flex gap-2">
              {(["story", "task", "bug", "defect"] as const).map(t => {
                const tm = TYPE_META[t];
                return (
                  <button key={t} onClick={() => handleTypeChange(t)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg border-2 transition"
                    style={f.ticketType === t ? { borderColor: projectColor, background: projectColor + "15", color: tm.color } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                    {tm.icon} {tm.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual ID field */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">
              ID
              <span className="ml-1.5 text-[10px] text-gray-300 font-normal">(auto-generated · editable)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold pointer-events-none"
                style={{ color: TYPE_META[f.ticketType]?.color || "#64748b" }}>
                {TYPE_PREFIX[f.ticketType] || "TSK"}-
              </span>
              <input
                value={f.taskCode?.replace(/^[A-Z]+-/, "") || ""}
                onChange={e => {
                  const num = e.target.value.replace(/\D/g, "").slice(0, 6);
                  const prefix = TYPE_PREFIX[f.ticketType] || "TSK";
                  setF(prev => ({ ...prev, taskCode: num ? `${prefix}-${num.padStart(3, "0")}` : `${prefix}-` }));
                  setTaskCodeManual(true);
                }}
                placeholder="001"
                className="w-full border border-gray-200 rounded-lg pl-12 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
                style={{ borderColor: taskCodeManual ? "#6366f1" : "#e5e7eb" }}
              />
              {taskCodeManual && (
                <button
                  onClick={() => {
                    setF(prev => ({ ...prev, taskCode: getAutoCode(prev.ticketType) }));
                    setTaskCodeManual(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 hover:text-indigo-600 font-medium"
                  title="Reset to auto"
                >↺ auto</button>
              )}
            </div>
          </div>

          {/* Parent Story — only for task/bug/defect */}
          {!isStory && stories && stories.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Parent Story <span className="text-gray-300">(optional)</span></label>
              <select value={f.parentStoryId} onChange={e => setF({ ...f, parentStoryId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">None</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.taskCode ? `[${s.taskCode}] ` : ""}{s.title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Title <span className="text-red-400">*</span></label>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder={`${TYPE_META[f.ticketType]?.label || "Task"} title...`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Description</label>
            <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Assignee</label>
              <select value={f.assignedTo} onChange={e => setF({ ...f, assignedTo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.uid} value={u.uid}>{u.displayName || u.name || u.email?.split("@")[0] || "Unknown"}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Priority</label>
              <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {!isStory && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Initial Column</label>
                <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Due Date</label>
              <input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            {!isStory && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Est. Hours</label>
                <input type="number" value={f.estimatedHours} onChange={e => setF({ ...f, estimatedHours: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Story Points</label>
              <input type="number" value={f.storyPoints} onChange={e => setF({ ...f, storyPoints: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Tags <span className="text-gray-300">(comma-separated)</span></label>
            <input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="design, frontend, api"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!f.title.trim()} className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition hover:opacity-90" style={{ background: projectColor }}>
            Create {TYPE_META[f.ticketType]?.label || "Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── STORY CREATE DROPDOWN ─── */
function StoryCreateMenu({
  story,
  projectColor,
  onCreateChild,
}: {
  story: Task;
  projectColor: string;
  onCreateChild: (storyId: string, ticketType: string) => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 6, left: rect.left });
        }}
        className="w-6 h-6 flex items-center justify-center rounded-md bg-indigo-500 text-white hover:bg-indigo-600 text-xs"
      >
        +
      </button>

      {menuPos && (
        <FloatingMenu
          position={menuPos}
          onClose={() => setMenuPos(null)}
          onCreate={(ticketType) => {
            onCreateChild(story.id, ticketType);
            setMenuPos(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── FLOATING MENU ─── */
const FloatingMenu = ({ position, onClose, onCreate }: {
  position: { top: number; left: number };
  onClose: () => void;
  onCreate: (ticketType: string) => void;
}) => {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div
        style={{ position: "fixed", top: position.top, left: position.left, zIndex: 9999 }}
        className="bg-white border border-gray-200 rounded-xl shadow-xl w-40 py-2"
      >
        <div className="px-3 py-2 text-xs font-semibold text-gray-500">ADD TO STORY</div>
        <button onClick={() => onCreate("task")} className="w-full text-left px-3 py-2 hover:bg-gray-50">🧩 Task</button>
        <button onClick={() => onCreate("bug")} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-500">🐞 Bug</button>
        <button onClick={() => onCreate("defect")} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-orange-500">🎯 Defect</button>
      </div>
    </>,
    document.body
  );
};

/* ─── KANBAN BOARD ─── */
export function KanbanBoard({
  tasks, columns, setColumns, projectColor,
  onTaskClick, onStatusChange, canManage, onSaveColumns, onCreateTask,
}: KanbanBoardProps) {
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ colIdx: number } | null>(null);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");

  const toggleStory = (id: string) => {
    setCollapsedStories(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ✅ Use ticketType (unified field)
  const stories = tasks.filter(t => t.ticketType === "story");
  const orphans = tasks.filter(t => t.ticketType !== "story" && !t.parentStoryId);

  const getColStats = (colId: string) => {
    const colTasks = tasks.filter(t => t.status === colId && t.ticketType !== "story");
    const hours = colTasks.reduce((s, t) => s + (t.actualHours || 0), 0);
    return { count: colTasks.length, hours };
  };

  const getColRows = (colId: string) => {
    const rows: Array<{ kind: "task"; task: Task } | { kind: "story"; story: Task; children: Task[] }> = [];
    const orphanInCol = orphans.filter(t => t.status === colId);
    for (const t of orphanInCol) rows.push({ kind: "task", task: t });
    for (const story of stories) {
      // ✅ Use parentStoryId (unified field)
      const children = tasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story");
      const childrenInCol = children.filter(t => t.status === colId);
      if (childrenInCol.length > 0 || (colId === columns[0]?.id && children.length === 0)) {
        rows.push({ kind: "story", story, children: childrenInCol });
      }
    }
    return rows;
  };

  const formatDate = (d?: string) => {
    if (!d) return null;
    const date = new Date(d + "T12:00:00");
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const handleDeleteColumn = (colIdx: number) => {
    const colToDelete = columns[colIdx];
    const prevCol = columns[colIdx - 1] || columns[colIdx + 1];
    if (prevCol) {
      tasks.forEach(t => {
        if (t.status === colToDelete.id) {
          onStatusChange(t.id, prevCol.id);
        }
      });
    }
    onSaveColumns(columns.filter((_, i) => i !== colIdx));
    setConfirmDelete(null);
  };

  const handleColLabelSave = (colIdx: number) => {
    if (!editingColLabel.trim()) { setEditingColIdx(null); return; }
    const updated = columns.map((c, i) => i === colIdx ? { ...c, label: editingColLabel } : c);
    setColumns(updated);
    onSaveColumns(updated);
    setEditingColIdx(null);
  };

  /* ─── TASK CARD ─── */
  const TaskCard = ({ task, isChild, colIdx }: { task: Task; isChild?: boolean; colIdx: number }) => {
    const pal = COL_PALETTE[colIdx % COL_PALETTE.length];
    // ✅ Use ticketType
    const tm = TYPE_META[task.ticketType || "task"] || TYPE_META.task;
    const dueFmt = formatDate(task.dueDate);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
    const name = task.assignedToName;
    const isDragging = dragTask?.id === task.id;

    return (
      <div
        draggable={canManage}
        onDragStart={(e) => {
          setDragTask(task);
          const crt = e.currentTarget.cloneNode(true) as HTMLElement;
          crt.style.cssText = "position:absolute;top:-999px;left:-999px;opacity:0.9;transform:scale(1.03);width:260px;";
          document.body.appendChild(crt);
          e.dataTransfer.setDragImage(crt, 20, 20);
          setTimeout(() => document.body.removeChild(crt), 0);
        }}
        onDragEnd={() => setDragTask(null)}
        onClick={() => onTaskClick(task)}
        className="mx-2 my-2 rounded-lg border cursor-pointer group/card"
        style={{
          background: "#fff",
          borderColor: "#e5e7eb",
          boxShadow: isDragging ? "0 12px 30px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
          transform: isDragging ? "scale(1.03)" : "scale(1)",
          transition: "all 0.15s ease",
          borderLeft: `3px solid ${pal.dot}`,
        }}
      >
        {/* TOP: TYPE + ID */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <span className="text-xs">{tm.icon}</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: tm.bg, color: tm.color }}>
            {task.taskCode || "TSK-001"}
          </span>
          <div className="flex-1" />
          {task.priority && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">● {task.priority}</span>
          )}
        </div>

        {/* TITLE */}
        <div className="px-3 pt-2">
          <p className="text-sm font-semibold text-gray-800 group-hover/card:text-indigo-600 transition">{task.title}</p>
        </div>

        {/* DESCRIPTION */}
        {task.description && (
          <div className="px-3 pt-1">
            <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between px-3 pt-3 pb-3">
          <div className="text-[11px] text-gray-400">{dueFmt || "No due date"}</div>
          <div className="flex items-center gap-3">
            {name ? (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: avatarColor(name) }} title={name}>
                {name[0].toUpperCase()}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-300">?</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ─── STORY GROUP ROW ─── */
  const StoryGroup = ({ story, children, colIdx }: { story: Task; children: Task[]; colIdx: number }) => {
    const pal = COL_PALETTE[colIdx % COL_PALETTE.length];
    const collapsed = collapsedStories.has(story.id);
    // ✅ Use parentStoryId (unified field)
    const allChildren = tasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story");
    const doneCount = allChildren.filter(t => t.status === "done").length;
    const pct = allChildren.length ? Math.round((doneCount / allChildren.length) * 100) : 0;

    return (
      <div className="mx-2 my-2 rounded-xl overflow-hidden border border-indigo-100"
        style={{ background: "#f8f9ff", boxShadow: "0 1px 3px rgba(99,102,241,0.06)" }}>
        {/* Story header row */}
        <div className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer hover:bg-indigo-50/80 transition group/story"
          onClick={() => toggleStory(story.id)}>
          <span className="text-[10px] text-indigo-300 shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
          <span className="text-xs shrink-0">📘</span>
          {story.taskCode && (
            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-indigo-100 text-indigo-600 shrink-0">{story.taskCode}</span>
          )}
          <span className="flex-1 text-xs font-semibold text-indigo-700 truncate group-hover/story:text-indigo-900"
            onClick={e => { e.stopPropagation(); onTaskClick(story); }}>
            {story.title}
          </span>
          {/* Progress */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-14 bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : pal.dot }} />
            </div>
            <span className="text-[9px] font-bold text-indigo-400 w-10 text-right">{doneCount}/{allChildren.length}</span>
          </div>
          {canManage && onCreateTask && (
            <div onClick={e => e.stopPropagation()}>
              <StoryCreateMenu story={story} projectColor={projectColor} onCreateChild={onCreateTask} />
            </div>
          )}
        </div>
        {/* Children */}
        {!collapsed && (
          <div style={{ borderTop: "1px solid #e0e7ff" }}>
            {children.map(child => (
              <TaskCard key={child.id} task={child} isChild colIdx={colIdx} />
            ))}
            {children.length === 0 && (
              <div className="text-center py-3 text-[10px] text-indigo-200 italic">No items in this column</div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ─── COLUMN ─── */
  const KanbanCol = ({ col, colIdx }: { col: KanbanColumn; colIdx: number }) => {
    const pal = COL_PALETTE[colIdx % COL_PALETTE.length];
    const { count, hours } = getColStats(col.id);
    const rows = getColRows(col.id);
    const isOver = dragOver === col.id;
    const isEditingThisCol = editingColIdx === colIdx;

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      // ✅ Use ticketType (unified field) — stories are not draggable
      if (dragTask && dragTask.status !== col.id && dragTask.ticketType !== "story") {
        onStatusChange(dragTask.id, col.id);
      }
      setDragOver(null);
    };

    return (
      <div className="flex flex-col min-h-0 shrink-0"
        style={{ width: "280px", borderRight: "1px solid #e8ecf0", height: "100%" }}>
        {/* Column header */}
        <div className="shrink-0" style={{ background: pal.headerBg, borderBottom: `1px solid ${pal.border}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pal.dot }} />
            {isEditingThisCol ? (
              <input
                value={editingColLabel}
                autoFocus
                onChange={e => setEditingColLabel(e.target.value)}
                onBlur={() => handleColLabelSave(colIdx)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleColLabelSave(colIdx);
                  if (e.key === "Escape") setEditingColIdx(null);
                }}
                className="flex-1 text-xs font-bold bg-white border border-indigo-200 rounded px-1.5 py-0.5 outline-none"
                style={{ color: pal.text }}
              />
            ) : (
              <span
                onClick={() => { if (canManage) { setEditingColIdx(colIdx); setEditingColLabel(col.label); } }}
                className={`text-xs font-bold uppercase tracking-wider flex-1 ${canManage ? "cursor-pointer hover:opacity-70" : ""}`}
                style={{ color: pal.text }}
                title={canManage ? "Click to rename" : ""}
              >
                {col.label}
              </span>
            )}
            <span className="text-xs font-bold text-gray-500 bg-white/80 rounded px-1.5 py-0.5 border border-gray-100 shrink-0">{count}</span>
            {hours > 0 && <span className="text-[10px] text-gray-400 shrink-0">{hours}h</span>}
            {canManage && (
              <button
                onClick={() => setConfirmDelete({ colIdx })}
                title="Remove column"
                className="text-gray-200 hover:text-red-400 text-xs transition ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-red-50">
                ✕
              </button>
            )}
          </div>
          {/* Sub-header */}
          <div className="flex items-center px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider"
            style={{ background: pal.subHdr, borderTop: `1px solid ${pal.border}` }}>
            <span className="flex-1">TASK</span>
            <span className="w-16 text-right shrink-0">PRIORITY</span>
            <span className="w-14 text-right shrink-0">DUE</span>
            <span className="w-8 shrink-0" />
          </div>
        </div>

        {/* Column body */}
        <div
          className="flex-1 overflow-visible py-1.5 transition-colors duration-150"
          style={{ background: isOver ? `${pal.dot}10` : "#f9fafb", minHeight: "200px" }}
          onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
          onDrop={handleDrop}
        >
          {rows.map((row) =>
            row.kind === "task"
              ? <TaskCard key={row.task.id} task={row.task} colIdx={colIdx} />
              : <StoryGroup key={row.story.id} story={row.story} children={row.children} colIdx={colIdx} />
          )}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
              <div className="w-12 h-12 rounded-2xl border-2 border-dashed flex items-center justify-center text-xl transition duration-200"
                style={{ borderColor: isOver ? pal.dot : "#e2e8f0", color: isOver ? pal.dot : "#d1d5db", background: isOver ? `${pal.dot}08` : "transparent" }}>
                +
              </div>
              <span className="text-[11px]">Drop here</span>
            </div>
          )}

          {rows.length > 0 && isOver && (
            <div className="mx-3 mt-1 mb-2 h-1 rounded-full opacity-50 transition-all"
              style={{ background: `linear-gradient(90deg, ${pal.dot}, ${projectColor})` }} />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {confirmDelete !== null && (
        <ConfirmDialog
          message={`Delete "${columns[confirmDelete.colIdx]?.label}" column? Tasks will be moved to an adjacent column.`}
          onConfirm={() => handleDeleteColumn(confirmDelete.colIdx)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div
        className="flex flex-row overflow-x-auto overflow-y-hidden"
        style={{ height: "100%", width: "100%", scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent", contain: "strict" }}
      >
        {columns.map((col, i) => (
          <KanbanCol key={col.id} col={col} colIdx={i} />
        ))}

        {/* ➕ Add Column */}
        {canManage && (
          <div className="flex items-start px-3 py-2 shrink-0">
            <button
              onClick={() => {
                const newCol = { id: "col_" + Date.now(), label: "New Column" };
                onSaveColumns([...columns, newCol]);
              }}
              className="h-10 px-4 mt-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap"
              style={{ minWidth: "130px" }}
            >
              <span className="text-lg leading-none">+</span> Add Column
            </button>
          </div>
        )}
      </div>
    </>
  );
}