"use client";

import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";

/* ─── TYPES ─── */
export type TicketType = "story" | "task" | "bug" | "defect";
export type ViewMode = "board" | "swimlane";
export type GroupBy = "assignee" | "priority" | "type";

export interface Column {
  id: string;
  label: string;
  wipLimit?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  sprintId?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedDate?: string;
  dueDate?: string;
  priority: string;
  status: string;
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  tags?: string[];
  ticketType?: TicketType;
  parentStoryId?: string;
  parentStoryTitle?: string;
  taskCode?: string;
  createdBy: string;
  createdAt: any;
}

/* ─── TICKET TYPE CONFIG ─── */
export const TICKET_TYPES: Record<
  TicketType,
  { label: string; icon: string; color: string; bg: string; border: string; description: string }
> = {
  story: { label: "Story", icon: "📖", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", description: "A user story" },
  task: { label: "Task", icon: "✅", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", description: "A unit of work" },
  bug: { label: "Bug", icon: "🐞", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", description: "Something broken" },
  defect: { label: "Defect", icon: "⚠️", color: "#d97706", bg: "#fffbeb", border: "#fde68a", description: "A quality issue" },
};

/* ─── CONSTANTS ─── */
const STATIC_COL_CONFIG: Record<string, { color: string; bg: string; border: string; headerBg: string; dot: string }> = {
  todo: { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#94a3b8" },
  inprogress: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  review: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  done: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
  blocked: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
};

const DYNAMIC_PALETTE = [
  { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#94a3b8" },
  { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
  { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", headerBg: "#cffafe", dot: "#06b6d4" },
  { color: "#d97706", bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7", dot: "#f59e0b" },
  { color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", headerBg: "#fce7f3", dot: "#ec4899" },
];

export function getColStyle(colId: string, index: number) {
  return STATIC_COL_CONFIG[colId] ?? DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length];
}

const PRI_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Low: { dot: "#22c55e", bg: "#f0fdf4", text: "#16a34a", label: "Low" },
  Medium: { dot: "#f59e0b", bg: "#fffbeb", text: "#d97706", label: "Medium" },
  High: { dot: "#f97316", bg: "#fff7ed", text: "#ea580c", label: "High" },
  Critical: { dot: "#ef4444", bg: "#fef2f2", text: "#dc2626", label: "Critical" },
};

const TYPE_META: Record<string, { icon: string; color: string; label: string; bg: string; border: string }> = {
  story: { icon: "📘", color: "#3730a3", label: "Story", bg: "#eef2ff", border: "#c7d2fe" },
  task: { icon: "🧩", color: "#0369a1", label: "Task", bg: "#eff6ff", border: "#bfdbfe" },
  bug: { icon: "🐞", color: "#b91c1c", label: "Bug", bg: "#fef2f2", border: "#fecaca" },
  defect: { icon: "🎯", color: "#b45309", label: "Defect", bg: "#fffbeb", border: "#fde68a" },
};

const AVATAR_COLORS = ["#6366f1", "#7c3aed", "#db2777", "#d97706", "#059669", "#0891b2", "#e11d48", "#0284c7", "#16a34a", "#854d0e"];

const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const avatarInitial = (name: string): string => (!name || name.includes("@")) ? "U" : name.trim()[0].toUpperCase();
const cleanName = (name: string | null | undefined): string => (!name || name.includes("@")) ? "User" : name;
function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function isOverdue(dueDate?: string, status?: string) {
  return !!dueDate && new Date(dueDate) < new Date() && status !== "done";
}

/* ─── PERMISSIONS ─── */
export function getPermissions(user: any, project: any) {
  const isAdmin = user?.accountType === "ADMIN";
  const isPM = !!(
    project?.projectManager === user?.uid ||
    (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user?.uid))
  );
  const fullControl = isAdmin || isPM;
  const designation: string = user?.designation || "";
  const isDevEngineer = ["Software Engineer", "Senior Software Engineer", "Frontend Engineer", "Backend Engineer", "Full Stack Engineer", "Android Developer", "Mobile App Developer", "DevOps Engineer"].some(d => designation.toLowerCase().includes(d.toLowerCase()));
  const isFrontendEngineer = designation.toLowerCase().includes("frontend engineer");
  const isQA = designation.toLowerCase().includes("qa");
  let canCreateTypes: TicketType[] = ["task"];
  if (fullControl) canCreateTypes = ["story", "task", "bug", "defect"];
  else if (isFrontendEngineer) canCreateTypes = ["story", "task"];
  else if (isDevEngineer) canCreateTypes = ["task"];
  else if (isQA) canCreateTypes = ["task", "bug", "defect"];
  return { isPM, isAdmin, fullControl, canCreateTypes, canEdit: fullControl, canDelete: fullControl, canAssign: fullControl };
}

export function canMoveTask(user: any, task: Task, project: any) {
  const isAdmin = user?.accountType === "ADMIN";
  const isPM = project?.projectManager === user?.uid || (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user?.uid));
  return isAdmin || isPM || task.assignedTo === user?.uid;
}

/* ─── FILTER STATE ─── */
interface FilterState {
  search: string;
  mine: boolean;
  overdue: boolean;
  priority: string;
  type: string;
  assignee: string;
}

/* ── Swimlane layout constants ── */
const SWIMLANE_COL_WIDTH = 240;  // px — card column width
const SWIMLANE_LABEL_WIDTH = 160; // px — left group label column

/* ══════════════════════════════════════════════
   KANBAN BOARD COMPONENT
══════════════════════════════════════════════ */
export function KanbanBoard({
  tasks,
  columns,
  projectColor = "#6366f1",
  currentUserId,
  isProjectManager,
  onTaskClick,
  onStatusChange,
  onUpdateColumns,
  onAddChildToStory,
  onToast,
  user,
  activeProject,
  toolbarPrefix,
}: {
  tasks: Task[];
  columns: Column[];
  projectColor?: string;
  currentUserId: string;
  isProjectManager: boolean;
  onTaskClick: (t: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onUpdateColumns: (cols: Column[]) => Promise<void>;
  onAddChildToStory: (story: Task, ticketType: TicketType) => void;
  onToast: (msg: string) => void;
  user: any;
  activeProject: any;
  toolbarPrefix?: React.ReactNode;
}) {
  const permissions = getPermissions(user, activeProject);

  /* ── View & UI state ── */
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("assignee");
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [storyPopup, setStoryPopup] = useState<{ storyId: string; top: number; left: number } | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [editingColWip, setEditingColWip] = useState<number | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  /* ── Filter state ── */
  const [filters, setFilters] = useState<FilterState>({
    search: "", mine: false, overdue: false, priority: "", type: "", assignee: "",
  });

  /* ── Drag state ── */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const draggingTaskRef = useRef<Task | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "s" || e.key === "S") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") {
        if (isFullscreen) { setIsFullscreen(false); return; }
        setFilters({ search: "", mine: false, overdue: false, priority: "", type: "", assignee: "" });
        setSelectedTasks(new Set());
        setBulkMoveOpen(false);
        setStoryPopup(null);
      }
      if (e.key === "?" || e.key === "/") { e.preventDefault(); setShowShortcuts(v => !v); }
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setIsFullscreen(v => !v); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  /* ── Lock body scroll in fullscreen ── */
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  /* ── Unique assignees for filter ── */
  const allAssignees = useMemo(() => {
    const map = new Map<string, string>();
    localTasks.forEach(t => { if (t.assignedTo && t.assignedToName) map.set(t.assignedTo, t.assignedToName); });
    return [...map.entries()];
  }, [localTasks]);

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => {
    return localTasks.filter(t => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!(t.title.toLowerCase().includes(s) || (t.taskCode || "").toLowerCase().includes(s) || (t.description || "").toLowerCase().includes(s) || (t.tags || []).some(tag => tag.toLowerCase().includes(s)))) return false;
      }
      if (filters.mine && t.assignedTo !== currentUserId) return false;
      if (filters.overdue && !isOverdue(t.dueDate, t.status)) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.type && t.ticketType !== filters.type) return false;
      if (filters.assignee && t.assignedTo !== filters.assignee) return false;
      return true;
    });
  }, [localTasks, filters, currentUserId]);

  const colTasks = (colId: string) => filteredTasks.filter(t => t.status === colId);
  const allColTasks = (colId: string) => localTasks.filter(t => t.status === colId);
  const activeFiltersCount = [filters.mine, filters.overdue, !!filters.priority, !!filters.type, !!filters.assignee].filter(Boolean).length;

  /* ── Story toggle ── */
  const toggleStory = (storyId: string, colId: string) => {
    const key = `${storyId}::${colId}`;
    setCollapsedStories(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  };

  /* ── Column collapse ── */
  const toggleCol = (colId: string) => {
    setCollapsedCols(prev => { const s = new Set(prev); s.has(colId) ? s.delete(colId) : s.add(colId); return s; });
  };

  /* ── Selection ── */
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTasks(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const selectAll = (colId: string) => {
    const ids = colTasks(colId).map(t => t.id);
    setSelectedTasks(prev => {
      const s = new Set(prev);
      const allSelected = ids.every(id => s.has(id));
      ids.forEach(id => allSelected ? s.delete(id) : s.add(id));
      return s;
    });
  };

  /* ── Bulk actions ── */
  const bulkMove = (targetColId: string) => {
    const count = selectedTasks.size;
    setLocalTasks(prev => prev.map(t => selectedTasks.has(t.id) ? { ...t, status: targetColId } : t));
    selectedTasks.forEach(id => onStatusChange(id, targetColId));
    setSelectedTasks(new Set());
    setBulkMoveOpen(false);
    onToast(`Moved ${count} tasks to ${columns.find(c => c.id === targetColId)?.label}`);
  };

  const bulkDelete = () => {
    if (!confirm(`Delete ${selectedTasks.size} selected tasks?`)) return;
    setLocalTasks(prev => prev.filter(t => !selectedTasks.has(t.id)));
    setSelectedTasks(new Set());
    onToast("Tasks deleted");
  };

  const bulkSetPriority = (priority: string) => {
    setLocalTasks(prev => prev.map(t => selectedTasks.has(t.id) ? { ...t, priority } : t));
    setSelectedTasks(new Set());
    onToast(`Priority set to ${priority}`);
  };

  /* ── Drag helpers ── */
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    if (!canMoveTask(user, task, activeProject)) {
      e.preventDefault();
      onToast("You can only move your own tasks");
      return;
    }
    draggingTaskRef.current = task;
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);

    const el = e.currentTarget as HTMLElement;
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${el.offsetWidth}px;opacity:0.95;pointer-events:none;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,0.22);background:white;transform:rotate(2deg) scale(1.04);`;
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, el.offsetWidth / 2, 32);
    requestAnimationFrame(() => {
      el.style.opacity = "0.3";
      el.style.transform = "scale(0.97)";
    });
  }, [user, activeProject, onToast]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (dragGhostRef.current) { document.body.removeChild(dragGhostRef.current); dragGhostRef.current = null; }
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    el.style.transform = "";
    setDraggingId(null);
    setDragOverCol(null);
    draggingTaskRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = draggingTaskRef.current || localTasks.find(t => t.id === taskId);
    if (!task) return;
    if (!canMoveTask(user, task, activeProject)) { onToast("Not allowed"); return; }
    if (task.status === colId) { setDragOverCol(null); return; }
    setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: colId } : t));
    setDraggingId(null);
    setDragOverCol(null);
    draggingTaskRef.current = null;
    onStatusChange(task.id, colId);
  }, [localTasks, user, activeProject, onStatusChange, onToast]);

  /* ── Column CRUD ── */
  const handleRenameCol = async (colId: string) => {
    if (!editingColLabel.trim()) { setEditingColId(null); return; }
    const updated = columns.map(c =>
      c.id === colId ? { ...c, label: editingColLabel.trim(), ...(editingColWip !== null ? { wipLimit: editingColWip } : {}) } : c
    );
    await onUpdateColumns(updated);
    setEditingColId(null);
    setEditingColWip(null);
  };

  const handleAddCol = async () => {
    if (!newColLabel.trim()) return;
    const id = newColLabel.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 8);
    await onUpdateColumns([...columns, { id, label: newColLabel.trim() }]);
    setNewColLabel("");
    setAddingCol(false);
  };

  const handleDeleteCol = async (colId: string) => {
    const tasksInCol = localTasks.filter(t => t.status === colId);
    if (tasksInCol.length > 0 && !confirm(`Column has ${tasksInCol.length} tasks. Delete anyway?`)) return;
    await onUpdateColumns(columns.filter(c => c.id !== colId));
  };

  /* ── WIP helpers ── */
  const getWipInfo = (col: Column) => {
    const lim = col.wipLimit ?? 0;
    const cnt = allColTasks(col.id).filter(t => t.ticketType !== "story").length;
    const exceeded = lim > 0 && cnt > lim;
    const nearLimit = lim > 0 && cnt >= lim * 0.8 && cnt <= lim;
    return { cnt, lim, exceeded, nearLimit, pct: lim > 0 ? Math.min(cnt / lim, 1) : 0 };
  };

  /* ── Column stats ── */
  const colStats = (colId: string) => {
    const ct = allColTasks(colId);
    const totalPts = ct.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const myTasks = ct.filter(t => t.assignedTo === currentUserId).length;
    const overdueCount = ct.filter(t => isOverdue(t.dueDate, t.status)).length;
    const uniqueAssignees = [...new Map(ct.filter(t => t.assignedToName).map(t => [t.assignedTo, t.assignedToName!])).values()].slice(0, 5);
    return { totalPts, myTasks, overdueCount, uniqueAssignees };
  };

  /* ── Swimlane groups ── */
  const swimlaneGroups = useMemo(() => {
    if (groupBy === "assignee") {
      const map = new Map<string, { label: string; avatar?: string; tasks: Task[] }>();
      map.set("unassigned", { label: "Unassigned", tasks: [] });
      filteredTasks.forEach(t => {
        const key = t.assignedTo || "unassigned";
        if (!map.has(key)) map.set(key, { label: cleanName(t.assignedToName), avatar: t.assignedToName, tasks: [] });
        map.get(key)!.tasks.push(t);
      });
      return [...map.entries()].filter(([, g]) => g.tasks.length > 0).map(([key, g]) => ({ key, label: g.label, avatar: g.avatar, tasks: g.tasks }));
    }
    if (groupBy === "priority") {
      return ["Critical", "High", "Medium", "Low"].map(p => ({
        key: p, label: p, avatar: undefined, tasks: filteredTasks.filter(t => t.priority === p),
      })).filter(g => g.tasks.length > 0);
    }
    if (groupBy === "type") {
      return (["story", "task", "bug", "defect"] as TicketType[]).map(tp => ({
        key: tp, label: TICKET_TYPES[tp].label, avatar: undefined, tasks: filteredTasks.filter(t => t.ticketType === tp),
      })).filter(g => g.tasks.length > 0);
    }
    return [];
  }, [filteredTasks, groupBy]);

  /* ══ TASK CARD ══ */
  const renderTaskCard = (task: Task, isChild: boolean = false) => {
    const tm = TYPE_META[task.ticketType || "task"] || TYPE_META.task;
    const pri = PRI_CONFIG[task.priority];
    const isSelected = selectedTasks.has(task.id);
    const isDragging = draggingId === task.id;
    const ovd = isOverdue(task.dueDate, task.status);
    const dueFmt = formatDate(task.dueDate);
    const mine = task.assignedTo === currentUserId;
    const draggable = canMoveTask(user, task, activeProject);
    const name = cleanName(task.assignedToName);

    return (
      <div
        draggable={draggable}
        onDragStart={e => { if (!draggable) { e.preventDefault(); return; } handleDragStart(e, task); }}
        onDragEnd={handleDragEnd}
        onClick={e => {
          if (e.shiftKey) { toggleSelect(task.id, e); return; }
          onTaskClick(task);
        }}
        style={{
          background: isSelected ? "#eff6ff" : "#ffffff",
          border: `1px solid ${isSelected ? "#6366f1" : ovd ? "#fca5a5" : "#e5e7eb"}`,
          borderLeft: `3px solid ${tm.color}`,
          borderRadius: "10px",
          padding: "10px 10px 8px",
          cursor: draggable ? "grab" : "default",
          opacity: isDragging ? 0.35 : 1,
          transform: isDragging ? "scale(0.97)" : "scale(1)",
          transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          position: "relative",
          display: "block",
          minWidth: 0,
          boxSizing: "border-box",
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "7px", minWidth: 0 }}>
          <div
            onClick={e => toggleSelect(task.id, e)}
            style={{
              width: "14px", height: "14px", borderRadius: "3px",
              border: `1.5px solid ${isSelected ? "#6366f1" : "#d1d5db"}`,
              background: isSelected ? "#6366f1" : "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}
          >
            {isSelected && <span style={{ color: "white", fontSize: "8px", fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: tm.bg, color: tm.color, flexShrink: 0 }}>
            {task.taskCode || "TSK"}
          </span>
          <span style={{ fontSize: "12px", flexShrink: 0 }}>{tm.icon}</span>
          {mine && (
            <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "100px", background: projectColor + "20", color: projectColor, flexShrink: 0 }}>You</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }} />
          {pri && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: pri.dot }} />
              <span style={{ fontSize: "10px", color: pri.text, fontWeight: 600 }}>{pri.label}</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", lineHeight: 1.4, marginBottom: "5px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {task.title}
        </p>
        {task.description && (
          <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "5px", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {task.description}
          </p>
        )}
        {task.tags && task.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>
            {task.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "100px", background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>#{tag}</span>
            ))}
            {task.tags.length > 3 && <span style={{ fontSize: "10px", color: "#9ca3af" }}>+{task.tags.length - 3}</span>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
          {task.assignedToName ? (
            <>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: avatarColor(name), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "9px", fontWeight: 700, flexShrink: 0 }} title={name}>
                {avatarInitial(name)}
              </div>
              <span style={{ fontSize: "11px", color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name}</span>
            </>
          ) : (
            <>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1.5px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: "9px", flexShrink: 0 }}>?</div>
              <span style={{ fontSize: "11px", color: "#d1d5db", flex: 1, minWidth: 0 }}>Unassigned</span>
            </>
          )}
          {dueFmt && (
            <span style={{ fontSize: "10px", fontWeight: ovd ? 700 : 500, color: ovd ? "#ef4444" : "#9ca3af", flexShrink: 0 }}>
              {ovd ? "⚡ " : ""}{dueFmt}
            </span>
          )}
          {task.storyPoints ? (
            <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "100px", background: "#f3f4f6", color: "#6b7280", flexShrink: 0 }}>{task.storyPoints}sp</span>
          ) : null}
          {task.estimatedHours ? (
            <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
              <div style={{ width: "32px", height: "3px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ height: "3px", borderRadius: "3px", background: "#6366f1", width: `${Math.min(((task.actualHours || 0) / task.estimatedHours) * 100, 100)}%` }} />
              </div>
              <span style={{ fontSize: "10px", color: "#9ca3af" }}>{task.actualHours || 0}h</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  /* ══ STORY CARD ══ */
  const renderStoryCard = (story: Task, colId: string) => {
    const key = `${story.id}::${colId}`;
    const isCollapsed = collapsedStories.has(key);
    const allChildren = localTasks.filter(t => t.parentStoryId === story.id && t.ticketType !== "story");
    const colChildren = filteredTasks.filter(t => t.parentStoryId === story.id && t.status === colId && t.ticketType !== "story");
    const doneCount = allChildren.filter(t => t.status === "done").length;
    const pct = allChildren.length ? Math.round((doneCount / allChildren.length) * 100) : 0;
    const pri = PRI_CONFIG[story.priority];
    const isSelected = selectedTasks.has(story.id);
    const ovd = isOverdue(story.dueDate, story.status);
    const mine = story.assignedTo === currentUserId;
    const draggable = canMoveTask(user, story, activeProject);
    const name = cleanName(story.assignedToName);

    return (
      <div style={{
        borderRadius: "10px",
        overflow: "hidden",
        border: `${isSelected ? "2px" : "1px"} solid ${isSelected ? "#6366f1" : "#ddd6fe"}`,
        background: isSelected ? "#eef2ff" : "#faf8ff",
        opacity: draggingId === story.id ? 0.35 : 1,
        transition: "all 0.2s",
        display: "block",
        minWidth: 0,
        boxSizing: "border-box",
        flexShrink: 0,
      }}>
        <div
          draggable={draggable}
          onDragStart={e => { if (!draggable) { e.preventDefault(); return; } handleDragStart(e, story); }}
          onDragEnd={handleDragEnd}
          onClick={e => { if (e.shiftKey) { toggleSelect(story.id, e); return; } onTaskClick(story); }}
          style={{ padding: "10px 10px 8px", cursor: draggable ? "grab" : "default", borderLeft: "3px solid #7c3aed" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "7px", minWidth: 0 }}>
            <div
              onClick={e => toggleSelect(story.id, e)}
              style={{ width: "14px", height: "14px", borderRadius: "3px", border: `1.5px solid ${isSelected ? "#6366f1" : "#c4b5fd"}`, background: isSelected ? "#6366f1" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {isSelected && <span style={{ color: "white", fontSize: "8px", fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "#ede9fe", color: "#5b21b6", flexShrink: 0 }}>
              {story.taskCode || "STR"}
            </span>
            <span style={{ fontSize: "12px" }}>📘</span>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#6d28d9", background: "#ede9fe", padding: "1px 6px", borderRadius: "100px" }}>Story</span>
            {mine && <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "100px", background: projectColor + "20", color: projectColor }}>You</span>}
            <div style={{ flex: 1, minWidth: 0 }} />
            {pri && (
              <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: pri.dot }} />
                <span style={{ fontSize: "10px", color: pri.text, fontWeight: 600 }}>{pri.label}</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#3730a3", lineHeight: 1.4, marginBottom: "6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {story.title}
          </p>
          {story.tags && story.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>
              {story.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "100px", background: "#ede9fe", color: "#6d28d9", fontWeight: 500 }}>#{tag}</span>
              ))}
            </div>
          )}
          <div style={{ marginBottom: "7px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#8b5cf6", marginBottom: "3px" }}>
              <span>{doneCount}/{allChildren.length} tasks</span>
              <span style={{ fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: "4px", background: "#ede9fe", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "4px", borderRadius: "4px", width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1", transition: "width 0.4s" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {story.assignedToName ? (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", flex: 1, minWidth: 0 }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: avatarColor(name), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "9px", fontWeight: 700, flexShrink: 0 }}>
                  {avatarInitial(name)}
                </div>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#5b21b6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name}</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", flex: 1, minWidth: 0 }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1.5px dashed #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontSize: "9px" }}>?</div>
                <span style={{ fontSize: "10px", color: "#c4b5fd" }}>Unassigned</span>
              </div>
            )}
            {story.dueDate && (
              <span style={{ fontSize: "10px", color: ovd ? "#ef4444" : "#8b5cf6", fontWeight: ovd ? 700 : 500, marginRight: "6px", flexShrink: 0 }}>
                {ovd ? "⚡ " : ""}{formatDate(story.dueDate)}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); toggleStory(story.id, colId); }}
              style={{ width: "22px", height: "22px", borderRadius: "6px", border: "1px solid #ddd6fe", background: "#ede9fe", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#6d28d9", marginRight: "4px", flexShrink: 0 }}
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
            {(isProjectManager || permissions.canCreateTypes.length > 0) && (

              <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    setStoryPopup(prev => prev?.storyId === story.id ? null : { storyId: story.id, top: r.bottom + 6, left: r.left - 138 });
                  }}
                  style={{ width: "22px", height: "22px", borderRadius: "6px", border: "none", background: projectColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", fontWeight: 700 }}
                >+</button>
              </div>
            )}

          </div>
        </div>

        {/* Children */}
        {!isCollapsed && (
          <div style={{ borderTop: "1px solid #ddd6fe", background: "#faf5ff", padding: "4px 0" }}>
            {colChildren.map(child => (
              <div key={child.id} style={{ margin: "3px 6px 3px 12px" }}>
                {renderTaskCard(child, true)}
              </div>
            ))}
            {colChildren.length === 0 && (
              <p style={{ textAlign: "center", fontSize: "10px", color: "#c4b5fd", padding: "8px", fontStyle: "italic" }}>No items in this column</p>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ══ COLUMN (board view) ══ */
  const renderColumn = (col: Column, colIndex: number) => {
    const cfg = getColStyle(col.id, colIndex);
    const ct = colTasks(col.id);
    const stats = colStats(col.id);
    const wip = getWipInfo(col);
    const isCollapsed = collapsedCols.has(col.id);
    const isOver = dragOverCol === col.id;

    const visibleStories = localTasks.filter(t => {
      if (t.ticketType !== "story") return false;
      if (t.status !== col.id) return false;
      const storyPassesFilter = filteredTasks.some(ft => ft.id === t.id);
      const hasVisibleChildrenHere = filteredTasks.some(ft =>
        ft.parentStoryId === t.id && ft.status === col.id && ft.ticketType !== "story"
      );
      return storyPassesFilter || hasVisibleChildrenHere;
    });

    const renderedAsChildren = new Set<string>();
    visibleStories.forEach(story => {
      filteredTasks
        .filter(t => t.parentStoryId === story.id && t.status === col.id && t.ticketType !== "story")
        .forEach(t => renderedAsChildren.add(t.id));
    });

    const colOrphans = ct.filter(t => t.ticketType !== "story" && !renderedAsChildren.has(t.id));
    const nonStoryCount = ct.filter(t => t.ticketType !== "story").length;

    if (isCollapsed) {
      return (
        <div
          style={{ width: "44px", minWidth: "44px", borderRight: "1px solid #e8ecf0", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: "8px", transition: "all 0.2s", flexShrink: 0 }}
          onDragOver={e => handleDragOver(e, col.id)}
          onDrop={e => handleDrop(e, col.id)}
          onDragLeave={handleDragLeave}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.color, writingMode: "vertical-lr", textTransform: "uppercase", letterSpacing: "0.1em" }}>{col.label}</span>
          <span style={{ fontSize: "11px", fontWeight: 800, color: cfg.color, padding: "2px 0", background: cfg.headerBg, borderRadius: "6px", width: "28px", textAlign: "center" }}>{nonStoryCount}</span>
          <button onClick={() => toggleCol(col.id)} style={{ marginTop: "auto", width: "28px", height: "28px", borderRadius: "8px", border: `1px solid ${cfg.border}`, background: "transparent", cursor: "pointer", fontSize: "10px", color: cfg.color }}>▶</button>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "272px", minWidth: "272px", borderRight: "1px solid #e8ecf0",
          background: isOver ? `${cfg.dot}08` : "#fff",
          display: "flex", flexDirection: "column",
          height: "100%",
          transition: "background 0.15s", flexShrink: 0,
          overflow: "hidden",
        }}
        onDragOver={e => handleDragOver(e, col.id)}
        onDrop={e => handleDrop(e, col.id)}
        onDragLeave={handleDragLeave}
      >
        {/* Header */}
        <div style={{ background: cfg.headerBg, borderBottom: `1px solid ${cfg.border}`, borderTop: `3px solid ${cfg.dot}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 12px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
            {editingColId === col.id && isProjectManager ? (
              <div style={{ flex: 1, display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  autoFocus
                  value={editingColLabel}
                  onChange={e => setEditingColLabel(e.target.value)}
                  onBlur={() => handleRenameCol(col.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleRenameCol(col.id); if (e.key === "Escape") setEditingColId(null); }}
                  style={{ flex: 1, fontSize: "12px", fontWeight: 700, background: "transparent", border: "none", borderBottom: `1px solid ${cfg.color}`, color: cfg.color, outline: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}
                />
              </div>
            ) : (
              <span
                style={{ fontSize: "12px", fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em", flex: 1, cursor: isProjectManager ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => isProjectManager && (setEditingColId(col.id), setEditingColLabel(col.label), setEditingColWip(col.wipLimit || 0))}
                title={isProjectManager ? "Click to rename" : col.label}
              >
                {col.label}
              </span>
            )}
            <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "100px", background: "white", color: cfg.color, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
              {nonStoryCount}{col.wipLimit ? `/${col.wipLimit}` : ""}
            </span>
            {isProjectManager && (
              <>
                <button onClick={() => toggleCol(col.id)} style={{ width: "20px", height: "20px", borderRadius: "5px", border: `1px solid ${cfg.border}`, background: "transparent", cursor: "pointer", fontSize: "10px", color: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>◀</button>
                <button onClick={() => handleDeleteCol(col.id)} disabled={columns.length <= 1} style={{ width: "20px", height: "20px", borderRadius: "5px", border: "none", background: "transparent", cursor: columns.length <= 1 ? "not-allowed" : "pointer", fontSize: "11px", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: columns.length <= 1 ? 0.3 : 1 }}>✕</button>
              </>
            )}
          </div>
          {col.wipLimit && col.wipLimit > 0 && (
            <div style={{ height: "3px", background: cfg.border, width: "100%" }}>
              <div style={{ height: "3px", background: wip.exceeded ? "#ef4444" : wip.nearLimit ? "#f59e0b" : cfg.dot, width: `${wip.pct * 100}%`, transition: "width 0.3s" }} />
            </div>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            scrollBehavior: "smooth",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            background: isOver ? `${cfg.dot}06` : "#f9fafb",
            minHeight: 0,
          }}
        >
          {isOver && (
            <div style={{ height: "3px", borderRadius: "3px", background: `linear-gradient(90deg, ${cfg.dot}, ${projectColor})`, opacity: 0.7, flexShrink: 0 }} />
          )}

          {visibleStories.map(story => (
            <Fragment key={story.id}>{renderStoryCard(story, col.id)}</Fragment>
          ))}
          {colOrphans.map(task => (
            <Fragment key={task.id}>{renderTaskCard(task)}</Fragment>
          ))}

          {visibleStories.length === 0 && colOrphans.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: "100px", gap: "6px", color: "#d1d5db" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", border: `2px dashed ${isOver ? cfg.dot : "#e5e7eb"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: isOver ? cfg.dot : "#d1d5db", transition: "all 0.2s" }}>+</div>
              <span style={{ fontSize: "11px" }}>Drop here</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "6px 12px", borderTop: `1px solid ${cfg.border}`, background: cfg.headerBg + "99", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: cfg.color + "99", fontWeight: 600 }}>{stats.totalPts} pts</span>
            <span style={{ fontSize: "10px", color: cfg.color + "80" }}>{stats.myTasks} mine</span>
            {stats.overdueCount > 0 && <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: 700 }}>⚡ {stats.overdueCount} overdue</span>}
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     SWIMLANE VIEW — fully fixed
     - Single scroll surface (overflow:auto)
     - Sticky column header row (top:0)
     - Sticky group label column (left:0)
     - Cards in flex column, gap, box-sizing:border-box
     - No overlap, no overflow
  ══════════════════════════════════════════════ */
  const renderSwimlaneView = () => {
    // Total width so horizontal scroll can extend the layout
    const totalWidth = SWIMLANE_LABEL_WIDTH + columns.length * SWIMLANE_COL_WIDTH;

    return (
      /* ── Single scroll container ── */
      <div
        style={{
          flex: 1,
          overflow: "auto",       // ← ONE scroll surface for both x and y
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* Min-width enforcer: prevents columns from squishing on narrow viewports */}
        <div style={{ minWidth: totalWidth + "px" }}>

          {/* ── Sticky column header row ── */}
          <div
            style={{
              display: "flex",
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "#fff",
              borderBottom: "2px solid #e5e7eb",
              minWidth: totalWidth + "px",
            }}
          >
            {/* Group-label column header — also sticky on x-axis */}
            <div
              style={{
                width: SWIMLANE_LABEL_WIDTH,
                minWidth: SWIMLANE_LABEL_WIDTH,
                padding: "10px 14px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderRight: "1px solid #e5e7eb",
                flexShrink: 0,
                // Sticky on the x-axis too
                position: "sticky",
                left: 0,
                background: "#fff",
                zIndex: 21,
                boxSizing: "border-box",
              }}
            >
              {groupBy === "assignee" ? "Assignee" : groupBy === "priority" ? "Priority" : "Type"}
            </div>

            {/* Per-column headers */}
            {columns.map((col, i) => {
              const cfg = getColStyle(col.id, i);
              const count = filteredTasks.filter(t => t.status === col.id).length;
              return (
                <div
                  key={col.id}
                  style={{
                    width: SWIMLANE_COL_WIDTH,
                    minWidth: SWIMLANE_COL_WIDTH,
                    padding: "9px 12px",
                    borderRight: "1px solid #e5e7eb",
                    borderTop: `3px solid ${cfg.dot}`,
                    background: cfg.headerBg,
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        color: cfg.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 100,
                        background: "#fff",
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Swimlane rows ── */}
          {swimlaneGroups.map(group => {
            const isCollapsedG = collapsedGroups.has(group.key);

            return (
              <div key={group.key} style={{ borderBottom: "1px solid #e5e7eb" }}>

                {/* Group header — sticky on Y below the column header */}
                <div
                  onClick={() =>
                    setCollapsedGroups(prev => {
                      const s = new Set(prev);
                      s.has(group.key) ? s.delete(group.key) : s.add(group.key);
                      return s;
                    })
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 14px",
                    cursor: "pointer",
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    position: "sticky",
                    top: "41px",       // sits right below the column header row
                    zIndex: 15,
                    minWidth: totalWidth + "px",
                    boxSizing: "border-box",
                  }}
                >
                  {groupBy === "assignee" && (
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: group.avatar ? avatarColor(cleanName(group.avatar)) : "#e5e7eb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: group.avatar ? "white" : "#9ca3af",
                        fontSize: "10px", fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      {group.avatar ? avatarInitial(cleanName(group.avatar)) : "?"}
                    </div>
                  )}
                  {groupBy === "priority" && (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: PRI_CONFIG[group.key]?.dot || "#9ca3af", flexShrink: 0 }} />
                  )}
                  {groupBy === "type" && (
                    <span style={{ fontSize: "14px" }}>{TYPE_META[group.key]?.icon || "📋"}</span>
                  )}
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{group.label}</span>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>{group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9ca3af" }}>
                    {isCollapsedG ? "▶" : "▼"}
                  </span>
                </div>

                {/* Card columns — only when not collapsed */}
                {!isCollapsedG && (
                  <div style={{ display: "flex", minWidth: totalWidth + "px" }}>

                    {/* Sticky left spacer that matches the group-label column */}
                    <div
                      style={{
                        width: SWIMLANE_LABEL_WIDTH,
                        minWidth: SWIMLANE_LABEL_WIDTH,
                        borderRight: "1px solid #e5e7eb",
                        flexShrink: 0,
                        position: "sticky",
                        left: 0,
                        background: "#f9fafb",
                        zIndex: 10,
                        boxSizing: "border-box",
                      }}
                    />

                    {/* Task card cells */}
                    {columns.map((col, i) => {
                      const colGroupTasks = group.tasks.filter(t => t.status === col.id);
                      const cfg = getColStyle(col.id, i);
                      const isOver = dragOverCol === col.id;

                      return (
                        <div
                          key={col.id}
                          style={{
                            width: SWIMLANE_COL_WIDTH,
                            minWidth: SWIMLANE_COL_WIDTH,
                            borderRight: "1px solid #e5e7eb",
                            // ✅ flex column layout — cards stack, never overlap
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            padding: "8px",
                            minHeight: 80,
                            // ✅ box-sizing so padding is inside the width
                            boxSizing: "border-box",
                            background: isOver ? `${cfg.dot}08` : "transparent",
                            transition: "background 0.15s",
                            flexShrink: 0,
                          }}
                          onDragOver={e => handleDragOver(e, col.id)}
                          onDrop={e => handleDrop(e, col.id)}
                          onDragLeave={handleDragLeave}
                        >
                          {colGroupTasks.length === 0 ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#d1d5db",
                                border: "1.5px dashed #e5e7eb",
                                borderRadius: 8,
                                flex: 1,
                                minHeight: 64,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isOver ? `${cfg.dot}06` : "transparent",
                                transition: "all 0.15s",
                              }}
                            >
                              {isOver ? "Drop here" : "—"}
                            </div>
                          ) : (
                            colGroupTasks.map(t => (
                              /*
                               * ✅ Wrapper div: 100% wide, box-sizing:border-box, flexShrink:0
                               * Prevents any card from overflowing or collapsing.
                               */
                              <div
                                key={t.id}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  flexShrink: 0,
                                  minWidth: 0,
                                }}
                              >
                                {renderTaskCard(t)}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Global empty state */}
          {swimlaneGroups.length === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                color: "#9ca3af",
                fontSize: "14px",
              }}
            >
              No tasks match current filters
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Bulk action bar ── */
  const renderBulkBar = () => {
    if (selectedTasks.size === 0) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "#eef2ff", borderBottom: "1px solid #c7d2fe", flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#4338ca" }}>{selectedTasks.size} selected</span>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setBulkMoveOpen(v => !v)}
            style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#fff", color: "#4338ca", cursor: "pointer", fontWeight: 600 }}
          >Move to ▾</button>
          {bulkMoveOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setBulkMoveOpen(false)} />
              <div style={{ position: "absolute", top: "32px", left: 0, zIndex: 50, background: "#fff", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid #e5e7eb", overflow: "hidden", minWidth: "160px" }}>
                {columns.map((col, i) => {
                  const cfg = getColStyle(col.id, i);
                  return (
                    <button key={col.id} onClick={() => bulkMove(col.id)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 14px", fontSize: "13px", background: "none", border: "none", cursor: "pointer", color: cfg.color, fontWeight: 600 }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot }} />
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {["Critical", "High", "Medium", "Low"].map(p => (
          <button key={p} onClick={() => bulkSetPriority(p)} style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: `1px solid ${PRI_CONFIG[p].dot}40`, background: PRI_CONFIG[p].bg, color: PRI_CONFIG[p].text, cursor: "pointer", fontWeight: 600 }}>
            {p}
          </button>
        ))}
        <button onClick={bulkDelete} style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>Delete</button>
        <button onClick={() => setSelectedTasks(new Set())} style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", marginLeft: "auto" }}>Clear</button>
      </div>
    );
  };

  /* ── Shortcuts modal ── */
  const renderShortcutsModal = () => (
    showShortcuts ? (
      <>
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10000 }} onClick={() => setShowShortcuts(false)} />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10001, background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 24px 48px rgba(0,0,0,0.18)", minWidth: "320px" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>Keyboard Shortcuts</h3>
            <button onClick={() => setShowShortcuts(false)} style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#6b7280" }}>✕</button>
          </div>
          {[
            ["S", "Focus search"],
            ["F", "Toggle fullscreen"],
            ["Esc", "Exit fullscreen / clear filters"],
            ["? /", "Toggle shortcuts"],
            ["Shift+Click", "Multi-select cards"],
            ["Drag", "Move task between columns"],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: "13px", color: "#374151" }}>{desc}</span>
              <kbd style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", border: "1px solid #e5e7eb", background: "#f9fafb", fontFamily: "monospace", color: "#374151" }}>{key}</kbd>
            </div>
          ))}
        </div>
      </>
    ) : null
  );

  /* ══ BOARD CONTENT ══ */
  const boardContent = (
    <div style={{
      display: "flex",
      flexDirection: "column",
      position: isFullscreen ? "fixed" : "relative",
      inset: isFullscreen ? 0 : undefined,
      zIndex: isFullscreen ? 9998 : undefined,
      width: isFullscreen ? "100vw" : "100%",
      height: isFullscreen ? "100vh" : "100%",

      background: "#fff",
      overflow: "hidden",
    }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, flexWrap: "nowrap", overflowX: "auto", whiteSpace: "nowrap", background: "#fff", zIndex: 20 }}>
        {toolbarPrefix}

        {/* Search */}
        {/* <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "6px 10px", minWidth: "180px" }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="7" cy="7" r="5" /><path d="m11 11 3 3" /></svg>
          <input
            ref={searchRef}
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search… (S)"
            style={{ border: "none", background: "transparent", fontSize: "13px", color: "#111827", outline: "none", width: "100%" }}
          />
          {filters.search && (
            <button onClick={() => setFilters(f => ({ ...f, search: "" }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "12px", padding: 0 }}>✕</button>
          )}
        </div> */}

        {/* Filters */}
        {[
          { key: "overdue", label: "⚡ Overdue" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilters(prev => ({ ...prev, [f.key]: !prev[f.key as keyof FilterState] }))}
            style={{
              fontSize: "12px", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
              border: `1px solid ${filters[f.key as keyof FilterState] ? projectColor : "#e5e7eb"}`,
              background: filters[f.key as keyof FilterState] ? projectColor + "15" : "#f9fafb",
              color: filters[f.key as keyof FilterState] ? projectColor : "#4b5563",
            }}
          >{f.label}</button>
        ))}

        {/* <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
          style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${filters.priority ? projectColor : "#e5e7eb"}`, background: filters.priority ? projectColor + "10" : "#f9fafb", color: filters.priority ? projectColor : "#4b5563", cursor: "pointer", fontWeight: 600, outline: "none" }}>
          <option value="">All priorities</option>
          {["Critical", "High", "Medium", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
        </select> */}

        {/* <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${filters.type ? projectColor : "#e5e7eb"}`, background: filters.type ? projectColor + "10" : "#f9fafb", color: filters.type ? projectColor : "#4b5563", cursor: "pointer", fontWeight: 600, outline: "none" }}>
          <option value="">All types</option>
          {(["story", "task", "bug", "defect"] as TicketType[]).map(tp => <option key={tp} value={tp}>{TICKET_TYPES[tp].label}</option>)}
        </select> */}

        {allAssignees.length > 0 && (
          <select value={filters.assignee} onChange={e => setFilters(f => ({ ...f, assignee: e.target.value }))}
            style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${filters.assignee ? projectColor : "#e5e7eb"}`, background: filters.assignee ? projectColor + "10" : "#f9fafb", color: filters.assignee ? projectColor : "#4b5563", cursor: "pointer", fontWeight: 600, outline: "none" }}>
            <option value="">All assignees</option>
            {allAssignees.map(([uid, name]) => <option key={uid} value={uid}>{cleanName(name)}</option>)}
          </select>
        )}

        {activeFiltersCount > 0 && (
          <button onClick={() => setFilters({ search: "", mine: false, overdue: false, priority: "", type: "", assignee: "" })}
            style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "8px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>
            Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""}
          </button>
        )}

        {(filters.search || activeFiltersCount > 0) && (
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            {filteredTasks.filter(t => t.ticketType !== "story").length} tasks
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: "2px", background: "#f3f4f6", borderRadius: "8px", padding: "2px" }}>
            {(["board", "swimlane"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 600, transition: "all 0.15s", background: viewMode === v ? "#fff" : "transparent", color: viewMode === v ? "#111827" : "#6b7280", boxShadow: viewMode === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {v === "board" ? "Board" : "Swimlanes"}
              </button>
            ))}
          </div>

          {/* Swimlane group by */}
          {viewMode === "swimlane" && (
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
              style={{ fontSize: "12px", padding: "5px 8px", borderRadius: "7px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", cursor: "pointer", outline: "none" }}>
              <option value="assignee">By Assignee</option>
              <option value="priority">By Priority</option>
              <option value="type">By Type</option>
            </select>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? "Exit fullscreen (Esc or F)" : "Fullscreen (F)"}
            style={{
              width: "30px", height: "30px", borderRadius: "8px",
              border: `1px solid ${isFullscreen ? projectColor : "#e5e7eb"}`,
              background: isFullscreen ? projectColor + "15" : "#fff",
              cursor: "pointer", color: isFullscreen ? projectColor : "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "15px", transition: "all 0.15s",
            }}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Bulk bar */}
      {renderBulkBar()}

      {/* ── Board / Swimlane ── */}
      {viewMode === "board" ? (
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", flex: 1, overflowX: "auto", overflowY: "hidden", height: "100%" }}>
            {columns.map((col, i) => <Fragment key={col.id}>{renderColumn(col, i)}</Fragment>)}

            {/* Add Column */}
            {isProjectManager && (
              <div style={{ flexShrink: 0, width: "200px", borderRight: "1px dashed #e5e7eb", background: "#fafafa", display: "flex", flexDirection: "column" }}>
                {addingCol ? (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      autoFocus
                      value={newColLabel}
                      onChange={e => setNewColLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddCol(); if (e.key === "Escape") setAddingCol(false); }}
                      placeholder="Column name…"
                      style={{ fontSize: "13px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 10px", outline: "none", background: "#fff" }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={handleAddCol} disabled={!newColLabel.trim()} style={{ flex: 1, padding: "6px", fontSize: "12px", fontWeight: 700, color: "#fff", background: projectColor, border: "none", borderRadius: "7px", cursor: newColLabel.trim() ? "pointer" : "not-allowed", opacity: newColLabel.trim() ? 1 : 0.5 }}>Add</button>
                      <button onClick={() => { setAddingCol(false); setNewColLabel(""); }} style={{ flex: 1, padding: "6px", fontSize: "12px", fontWeight: 600, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingCol(true)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: "20px", gap: "8px", height: "100%", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = projectColor; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
                  >
                    <div style={{ width: "32px", height: "32px", borderRadius: "9px", border: "1.5px dashed currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 300 }}>+</div>
                    <span style={{ fontSize: "11px", fontWeight: 600, writingMode: "vertical-lr" }}>Add Column</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        renderSwimlaneView()
      )}

      {/* Shortcuts modal */}
      {renderShortcutsModal()}

      {storyPopup && (
        createPortal(
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 10000 }} onClick={() => setStoryPopup(null)} />
            <div style={{ position: "fixed", top: storyPopup.top, left: storyPopup.left, zIndex: 10001, background: "#fff", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid #e5e7eb", overflow: "hidden", width: "160px" }}>
              <p style={{ fontSize: "10px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px 6px", borderBottom: "1px solid #f3f4f6" }}>Add to Story</p>
              {(["task", "bug", "defect"] as TicketType[])
                .map(type => {

                  const cfg = TYPE_META[type];
                  const story = localTasks.find(t => t.id === storyPopup.storyId);
                  return (
                    <button key={type} onClick={() => { setStoryPopup(null); if (story) onAddChildToStory(story, type); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", fontSize: "13px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: cfg.color, textAlign: "left" }}>
                      <span>{cfg.icon}</span><span>{cfg.label}</span>
                    </button>
                  );
                })}
            </div>
          </>,
          document.body
        )
      )}




    </div>
  );

  return isMounted && isFullscreen
    ? createPortal(boardContent, document.body)
    : boardContent;
}