"use client";
import { createPortal } from "react-dom";
import type { Task } from "./KanbanBoard";
// =============================================================================
// TYPES
// =============================================================================

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  goal?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sprintType?: "Normal" | "Release" | "Hotfix";
  capacity?: number;
  velocity?: number;
  tags?: string[];
  status: "planned" | "active" | "on_hold" | "overdue" | "completed" | "archived";
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  taskId?: string;
  projectId: string;
  action:
    | "created"
    | "moved"
    | "updated"
    | "assigned"
    | "status_changed"
    | "sprint_changed"
    | "priority_changed"
    | "commented"
    | "deleted";
  from?: Record<string, any>;
  to?: Record<string, any>;
  userId: string;
  userName: string;
  description: string;
  createdAt: any;
}

export interface TaskLink {
  title: string;
  url: string;
}

export interface TaskImage {
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: any;
}

export interface ExtendedTask {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  sprintId?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedDate?: string;
  dueDate?: string;
  priority: string;
  status: string;
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  tags?: string[];
  ticketType?:
    | "epic"
    | "story"
    | "task"
    | "bug"
    | "defect"
    | "subtask"
    | "spike"
    | "improvement";
  parentStoryId?: string | null;
  taskCode?: string;
  createdBy: string;
  createdAt: any;
  images?: TaskImage[];
  links?: TaskLink[];
  blockedBy?: string[];
  blocks?: string[];
  relatedTasks?: string[];
}

export type SprintStatus = Sprint["status"];

// =============================================================================
// IMPORTS
// =============================================================================

import { useState, useEffect, useRef } from "react";
import {
  addDoc,
  updateDoc,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

// Minimal Task type — matches KanbanBoard's Task shape
// export interface Task {
//   id: string;
//   title: string;
//   taskCode?: string;
//   sprintId?: string | null;
//   status: string;
//   priority: string;
//   ticketType?: string;
//   storyPoints?: number;
//   assignedToName?: string | null;
//   tags?: string[];
// }

export interface KanbanColumn {
  id: string;
  label: string;
}

// =============================================================================
// SPRINT FORM MODAL
// =============================================================================

interface SprintFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  editingSprint?: Sprint | null;
  onSaved?: (sprint: Sprint) => void;
}

const STATUS_OPTIONS: {
  value: Sprint["status"];
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: "planned",   label: "Planned",   color: "#d97706", bg: "#fffbeb" },
  { value: "active",    label: "Active",    color: "#2563eb", bg: "#eff6ff" },
  { value: "on_hold",   label: "On Hold",   color: "#ea580c", bg: "#fff7ed" },
  { value: "completed", label: "Completed", color: "#16a34a", bg: "#f0fdf4" },
  { value: "archived",  label: "Archived",  color: "#6b7280", bg: "#f9fafb" },
];

const SPRINT_TYPES: {
  value: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "Normal",  label: "Normal",  icon: "🏃", desc: "Standard sprint" },
  { value: "Release", label: "Release", icon: "🚀", desc: "Release sprint" },
  { value: "Hotfix",  label: "Hotfix",  icon: "🔥", desc: "Emergency fixes" },
];

function autoStatus(
  startDate?: string,
  endDate?: string,
  current?: Sprint["status"]
): Sprint["status"] {
  if (current === "completed" || current === "archived") return current;
  const now = new Date();
  if (startDate && new Date(startDate) > now) return "planned";
  if (endDate && new Date(endDate) < now) return "overdue";
  if (startDate && new Date(startDate) <= now) return "active";
  return "planned";
}

export function SprintFormModal({
  open,
  onClose,
  projectId,
  editingSprint,
  onSaved,
}: SprintFormModalProps) {
  const empty = {
    name: "",
    goal: "",
    description: "",
    startDate: "",
    endDate: "",
    sprintType: "Normal" as Sprint["sprintType"],
    capacity: "",
    velocity: "",
    tags: "",
    status: "planned" as Sprint["status"],
  };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [durationDays, setDurationDays] = useState<number | null>(null);

  useEffect(() => {
    if (editingSprint) {
      setF({
        name: editingSprint.name || "",
        goal: editingSprint.goal || "",
        description: editingSprint.description || "",
        startDate: editingSprint.startDate || "",
        endDate: editingSprint.endDate || "",
        sprintType: editingSprint.sprintType || "Normal",
        capacity: editingSprint.capacity?.toString() || "",
        velocity: editingSprint.velocity?.toString() || "",
        tags: editingSprint.tags?.join(", ") || "",
        status: editingSprint.status || "planned",
      });
    } else {
      setF(empty);
    }
  }, [editingSprint, open]);

  useEffect(() => {
    if (f.startDate && f.endDate) {
      const diff = Math.round(
        (new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) /
          86400000
      );
      setDurationDays(diff > 0 ? diff : null);
    } else {
      setDurationDays(null);
    }
  }, [f.startDate, f.endDate])

if (!open) return null;

const computedStatus = autoStatus(f.startDate, f.endDate, f.status);

const handleSave = async () => {
  if (!f.name.trim()) return;
  setSaving(true);
  try {
    const data: any = {
      name: f.name.trim(),
      goal: f.goal.trim(),
      description: f.description.trim(),
      projectId,
      sprintType: f.sprintType,
      status: computedStatus,
      createdAt: editingSprint?.createdAt || serverTimestamp(),
    };

    if (f.startDate) data.startDate = f.startDate;
    if (f.endDate) data.endDate = f.endDate;
    if (f.capacity) data.capacity = Number(f.capacity);
    if (f.velocity) data.velocity = Number(f.velocity);
    data.tags = f.tags
      ? f.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    if (editingSprint) {
      await updateDoc(doc(db, "sprints", editingSprint.id), data);
      onSaved?.({ ...editingSprint, ...data });
    } else {
      const docRef = await addDoc(collection(db, "sprints"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      onSaved?.({ id: docRef.id, ...data } as Sprint);
    }
    onClose();
  } finally {
    setSaving(false);
  }
};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
        >
          <div>
            <h2 className="text-base font-bold text-white">
              {editingSprint ? "Edit Sprint" : "Create Sprint"}
            </h2>
            <p className="text-xs text-purple-200 mt-0.5">
              Plan your sprint details
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Sprint Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Sprint Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SPRINT_TYPES.map((st) => (
                <button
                  key={st.value}
                  onClick={() =>
                    setF({ ...f, sprintType: st.value as Sprint["sprintType"] })
                  }
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition ${
                    f.sprintType === st.value
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-500 hover:border-purple-200"
                  }`}
                >
                  <span style={{ fontSize: 18 }}>{st.icon}</span>
                  <span>{st.label}</span>
                  <span className="text-[10px] font-normal text-gray-400">
                    {st.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Goal */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Sprint Name <span className="text-red-400">*</span>
              </label>
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                placeholder="e.g. Sprint 1 — Auth & Dashboard"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Sprint Goal
              </label>
              <input
                value={f.goal}
                onChange={(e) => setF({ ...f, goal: e.target.value })}
                placeholder="What does this sprint aim to achieve?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Description
              </label>
              <textarea
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                rows={2}
                placeholder="Additional context, notes, or scope..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={f.startDate}
                onChange={(e) => setF({ ...f, startDate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={f.endDate}
                onChange={(e) => setF({ ...f, endDate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
          </div>
          {durationDays !== null && (
            <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <span>📅</span>
              <span className="font-semibold">Duration: {durationDays} days</span>
              <span className="text-purple-400">
                ({Math.round(durationDays / 7)} weeks)
              </span>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setF({ ...f, status: s.value })}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    f.status === s.value
                      ? "border-current shadow-sm"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                  style={
                    f.status === s.value
                      ? {
                          background: s.bg,
                          color: s.color,
                          borderColor: s.color + "60",
                        }
                      : {}
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity & Velocity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Team Capacity (hrs)
              </label>
              <input
                type="number"
                value={f.capacity}
                onChange={(e) => setF({ ...f, capacity: e.target.value })}
                placeholder="e.g. 160"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Velocity (story pts)
              </label>
              <input
                type="number"
                value={f.velocity}
                onChange={(e) => setF({ ...f, velocity: e.target.value })}
                placeholder="e.g. 40"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Tags{" "}
              <span className="text-gray-300 font-normal">(comma-separated)</span>
            </label>
            <input
              value={f.tags}
              onChange={(e) => setF({ ...f, tags: e.target.value })}
              placeholder="auth, payments, v2.0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!f.name.trim() || saving}
            className="px-6 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
          >
            {saving
              ? "Saving..."
              : editingSprint
              ? "Update Sprint"
              : "Create Sprint"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SprintStatusBadge({ sprint }: { sprint: Sprint }) {
  const now = new Date();
  let label = "Planned",
    color = "#d97706",
    bg = "#fffbeb";

  if (sprint.status === "completed") {
    label = "Completed";
    color = "#16a34a";
    bg = "#f0fdf4";
  } else if (sprint.status === "archived") {
    label = "Archived";
    color = "#6b7280";
    bg = "#f9fafb";
  } else if (sprint.status === "on_hold") {
    label = "On Hold";
    color = "#ea580c";
    bg = "#fff7ed";
  } else if (sprint.endDate && new Date(sprint.endDate) < now) {
    label = "Overdue";
    color = "#dc2626";
    bg = "#fef2f2";
  } else if (sprint.startDate && new Date(sprint.startDate) <= now) {
    label = "Active";
    color = "#2563eb";
    bg = "#eff6ff";
  }

  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// =============================================================================
// ACTIVITY TIMELINE
// =============================================================================

const ACTION_META: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  created:          { icon: "✨", color: "#16a34a", bg: "#f0fdf4", label: "Created" },
  moved:            { icon: "↗️", color: "#2563eb", bg: "#eff6ff", label: "Moved" },
  updated:          { icon: "✏️", color: "#7c3aed", bg: "#f5f3ff", label: "Updated" },
  assigned:         { icon: "👤", color: "#0891b2", bg: "#ecfeff", label: "Assigned" },
  status_changed:   { icon: "🔄", color: "#d97706", bg: "#fffbeb", label: "Status changed" },
  sprint_changed:   { icon: "🏃", color: "#7c3aed", bg: "#f5f3ff", label: "Sprint changed" },
  priority_changed: { icon: "⚡", color: "#dc2626", bg: "#fef2f2", label: "Priority changed" },
  commented:        { icon: "💬", color: "#6366f1", bg: "#eef2ff", label: "Commented" },
  deleted:          { icon: "🗑️", color: "#dc2626", bg: "#fef2f2", label: "Deleted" },
};

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskActivityTimeline({
  taskId,
  projectColor,
}: {
  taskId: string;
  projectColor: string;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      where("taskId", "==", taskId),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) =>
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)))
    );
  }, [taskId]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-300">
        <div style={{ fontSize: 40 }} className="mb-2">
          📜
        </div>
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-0">
      {logs.map((log, i) => {
        const meta = ACTION_META[log.action] || ACTION_META.updated;
        const isLast = i === logs.length - 1;
        return (
          <div key={log.id} className="flex gap-3 relative">
            {!isLast && (
              <div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 z-10"
              style={{
                background: meta.bg,
                border: `2px solid ${meta.color}30`,
              }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm">
                    <span className="font-semibold text-gray-800">
                      {log.userName}
                    </span>{" "}
                    <span className="text-gray-500">
                      {meta.label.toLowerCase()}
                    </span>
                  </p>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                    {log.createdAt?.toDate
                      ? timeAgo(log.createdAt.toDate())
                      : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{log.description}</p>
                {(log.from || log.to) && (
                  <div className="flex items-center gap-2 mt-2">
                    {log.from &&
                      Object.keys(log.from).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 line-through border border-red-100"
                        >
                          {String(log.from?.[k])}
                        </span>
                      ))}
                    {log.from && log.to && (
                      <span className="text-gray-300 text-xs">→</span>
                    )}
                    {log.to &&
                      Object.keys(log.to).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                          style={{
                            background: meta.bg,
                            color: meta.color,
                            borderColor: meta.color + "30",
                          }}
                        >
                          {String(log.to?.[k])}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectActivityTimeline({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) =>
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)))
    );
  }, [projectId]);

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>📜</span> Activity Stream
          <span className="ml-auto text-xs font-normal text-gray-400">
            {logs.length} events
          </span>
        </h3>
        <div className="space-y-0">
          {logs.slice(0, 60).map((log, i) => {
            const meta = ACTION_META[log.action] || ACTION_META.updated;
            return (
              <div key={log.id} className="flex gap-4 relative">
                {i < logs.length - 1 && (
                  <div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />
                )}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 z-10"
                  style={{ background: meta.bg }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 pb-5">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm">
                        <span className="font-semibold text-gray-800">
                          {log.userName}
                        </span>{" "}
                        <span className="text-gray-500">{log.description}</span>
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {log.createdAt?.toDate
                          ? log.createdAt.toDate().toLocaleString()
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <div style={{ fontSize: 48 }} className="mb-3">
                📜
              </div>
              <p className="text-sm">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function logActivityEntry(
  params: Omit<ActivityLog, "id" | "createdAt">
) {
  await addDoc(collection(db, "activityLogs"), {
    ...params,
    createdAt: serverTimestamp(),
  });
}

// =============================================================================
// TASK ATTACHMENTS — Images & Links
// =============================================================================

interface TaskImagesProps {
  taskId: string;
  projectId: string;
  images: TaskImage[];
  canManage: boolean;
  projectColor: string;
}

export function TaskImages({
  taskId,
  projectId,
  images,
  canManage,
  projectColor,
}: TaskImagesProps) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Max image size is 5MB");
      return;
    }
    try {
      setUploading(true);
      const storageRef = ref(
        storage,
        `taskImages/${projectId}/${taskId}/${Date.now()}_${file.name}`
      );
      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);
      const image: TaskImage = {
        url,
        name: file.name,
        uploadedBy: "",
        uploadedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "projectTasks", taskId), {
        images: arrayUnion(image),
      });
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (image: TaskImage) => {
    if (!confirm("Remove this image?")) return;
    await updateDoc(doc(db, "projectTasks", taskId), {
      images: arrayRemove(image),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Images ({images.length})
        </h3>
        {canManage && (
          <label
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer transition hover:opacity-90 ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
            style={{ background: projectColor }}
          >
            {uploading ? "⏳ Uploading..." : "🖼️ Add Image"}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {images.length === 0 ? (
        <div className="text-center py-6 text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
          <div style={{ fontSize: 32 }} className="mb-1">
            🖼️
          </div>
          <p className="text-xs">No images attached</p>
          {canManage && (
            <p className="text-xs text-gray-200 mt-1">
              Click "Add Image" above
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-square cursor-pointer"
              onClick={() => setLightbox(img.url)}
            >
              <img
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(img.url);
                  }}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 text-xs hover:bg-white transition"
                >
                  🔍
                </button>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(img);
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center text-white text-xs hover:bg-red-500 transition"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

interface TaskLinksProps {
  taskId: string;
  links: TaskLink[];
  canManage: boolean;
  projectColor: string;
}

export function TaskLinks({
  taskId,
  links,
  canManage,
  projectColor,
}: TaskLinksProps) {
  const [adding, setAdding] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return;
    let url = newLink.url.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    setSaving(true);
    try {
      await updateDoc(doc(db, "projectTasks", taskId), {
        links: arrayUnion({ title: newLink.title.trim(), url }),
      });
      setNewLink({ title: "", url: "" });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (link: TaskLink) => {
    await updateDoc(doc(db, "projectTasks", taskId), {
      links: arrayRemove(link),
    });
  };

  const LINK_ICONS: Record<string, string> = {
    figma: "🎨", notion: "📝", jira: "🔵", github: "🐙",
    gitlab: "🦊", docs: "📄", drive: "📁", slack: "💬",
    api: "🔌", design: "🎨", doc: "📄",
  };

  const getLinkIcon = (title: string) => {
    const lower = title.toLowerCase();
    for (const [key, icon] of Object.entries(LINK_ICONS)) {
      if (lower.includes(key)) return icon;
    }
    return "🔗";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Links ({links.length})
        </h3>
        {canManage && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition hover:opacity-90"
            style={{ background: projectColor }}
          >
            + Add Link
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-3 space-y-2">
          <input
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            placeholder="Link title (e.g. Figma Design)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <input
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            placeholder="URL (e.g. https://figma.com/...)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newLink.title || !newLink.url}
              className="flex-1 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40"
              style={{ background: projectColor }}
            >
              {saving ? "Saving..." : "Add"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewLink({ title: "", url: "" });
              }}
              className="flex-1 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {links.length === 0 && !adding ? (
        <div className="text-center py-6 text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
          <div style={{ fontSize: 28 }} className="mb-1">
            🔗
          </div>
          <p className="text-xs">No links added</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition group"
            >
              <span style={{ fontSize: 18 }}>{getLinkIcon(link.title)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {link.title}
                </p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs hover:underline truncate block"
                  style={{ color: projectColor }}
                >
                  {link.url}
                </a>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-gray-300 hover:text-gray-500 transition text-sm"
              >
                ↗
              </a>
              {canManage && (
                <button
                  onClick={() => handleRemove(link)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TASK DEPENDENCIES
// =============================================================================

interface TaskDepsProps {
  task: Task & {
    blockedBy?: string[];
    blocks?: string[];
    relatedTasks?: string[];
  };
  allTasks: Task[];
  canManage: boolean;
  onTaskClick: (t: Task) => void;
  projectColor: string;
}

type DepType = "blockedBy" | "blocks" | "relatedTasks";

const DEP_META: Record<
  DepType,
  { label: string; icon: string; color: string; bg: string; emptyMsg: string }
> = {
  blockedBy:    { label: "Blocked by",  icon: "🚫", color: "#dc2626", bg: "#fef2f2", emptyMsg: "Not blocked by anything" },
  blocks:       { label: "Blocks",      icon: "⛔", color: "#ea580c", bg: "#fff7ed", emptyMsg: "Not blocking anything" },
  relatedTasks: { label: "Related to",  icon: "🔗", color: "#6366f1", bg: "#eef2ff", emptyMsg: "No related tasks" },
};

export function TaskDependencies({
  task,
  allTasks,
  canManage,
  onTaskClick,
  projectColor,
}: TaskDepsProps) {
  const [adding, setAdding] = useState<DepType | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const getLinkedTasks = (ids: string[]) =>
    ids.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];

  const handleAdd = async (depType: DepType, targetId: string) => {
    await updateDoc(doc(db, "projectTasks", task.id), {
      [depType]: arrayUnion(targetId),
    });
    setAdding(null);
    setSearchQ("");
  };

  const handleRemove = async (depType: DepType, targetId: string) => {
    await updateDoc(doc(db, "projectTasks", task.id), {
      [depType]: arrayRemove(targetId),
    });
  };

  const existingIds = [
    ...(task.blockedBy || []),
    ...(task.blocks || []),
    ...(task.relatedTasks || []),
    task.id,
  ];

  const filteredCandidates = allTasks.filter(
    (t) =>
      !existingIds.includes(t.id) &&
      t.ticketType !== "story" &&
      (t.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        t.taskCode?.toLowerCase().includes(searchQ.toLowerCase()))
  );

  const isBlocked = (task.blockedBy?.length || 0) > 0;

  return (
    <div className="space-y-4">
      {isBlocked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          <span style={{ fontSize: 16 }}>⚠️</span>
          This task is blocked by {task.blockedBy?.length} other task
          {(task.blockedBy?.length || 0) > 1 ? "s" : ""}
        </div>
      )}

      {(
        Object.entries(DEP_META) as [DepType, (typeof DEP_META)[DepType]][]
      ).map(([depType, meta]) => {
        const linked = getLinkedTasks((task as any)[depType] || []);
        return (
          <div
            key={depType}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {meta.label}
                </span>
                {linked.length > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {linked.length}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    setAdding(adding === depType ? null : depType);
                    setSearchQ("");
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition hover:opacity-90"
                  style={{ background: meta.color }}
                >
                  {adding === depType ? "Cancel" : "+ Link"}
                </button>
              )}
            </div>

            {adding === depType && (
              <div className="mb-3">
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {filteredCandidates.length === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">
                      No tasks found
                    </p>
                  ) : (
                    filteredCandidates.slice(0, 20).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleAdd(depType, t.id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition flex items-center gap-2"
                      >
                        <span className="text-xs font-mono text-gray-400">
                          {t.taskCode}
                        </span>
                        <span className="text-xs text-gray-700 truncate">
                          {t.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {linked.length === 0 ? (
              <p className="text-xs text-gray-300 italic">{meta.emptyMsg}</p>
            ) : (
              <div className="space-y-1.5">
                {linked.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 transition group"
                    style={{
                      borderColor: meta.color + "30",
                      background: meta.bg + "80",
                    }}
                  >
                    <button
                      onClick={() => onTaskClick(t)}
                      className="flex-1 flex items-center gap-2 min-w-0 text-left"
                    >
                      <span
                        className="text-xs font-mono font-bold shrink-0"
                        style={{ color: meta.color }}
                      >
                        {t.taskCode}
                      </span>
                      <span className="text-xs text-gray-700 truncate">
                        {t.title}
                      </span>
                      {t.status === "blocked" && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">
                          Blocked
                        </span>
                      )}
                    </button>
                    {canManage && (
                      <button
                        onClick={() => handleRemove(depType, t.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition text-xs shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MOVE TO SPRINT MODAL
// =============================================================================

interface MoveToSprintProps {
  task: Task;
  sprints: Sprint[];
  currentSprintId?: string | null;
  onMoved?: () => void;
  onClose: () => void;
  open: boolean;
}

export function MoveToSprintModal({
  task,
  sprints,
  currentSprintId,
  onMoved,
  onClose,
  open,
}: MoveToSprintProps) {
  const [selected, setSelected] = useState<string>(currentSprintId || "");
  useEffect(() => {
  setSelected(currentSprintId || "");
}, [currentSprintId, task]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

const handleMove = async () => {
  if (!task?.id) {
    console.error("❌ Task missing:", task);
    return;
  }

  setSaving(true);
  try {
    await updateDoc(doc(db, "projectTasks", task.id), {
      sprintId: selected || null,
    });

    onMoved?.();
    onClose();
  } catch (err) {
    console.error("Move failed:", err);
  } finally {
    setSaving(false);
  }
};

  
   return createPortal(
    <div
      className="fixed inset-0 z-999 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    > 
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Move to Sprint</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-55">
             {task?.title || "No task selected"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={() => setSelected("")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
              !selected
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-100 hover:bg-gray-50"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            <span className="text-sm font-semibold text-gray-600">
              Backlog (no sprint)
            </span>
            {!selected && (
              <span className="ml-auto text-indigo-500 text-xs">✓</span>
            )}
          </button>

          {sprints.map((sprint) => {
            const isCurrent = sprint.id === currentSprintId;
            const isSelected = sprint.id === selected;
            return (
              <button
                key={sprint.id}
                onClick={() => setSelected(sprint.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
                  isSelected
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-100 hover:bg-gray-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {sprint.name}
                  </p>
                  {(sprint.startDate || sprint.endDate) && (
                    <p className="text-xs text-gray-400">
                      {sprint.startDate} → {sprint.endDate}
                    </p>
                  )}
                </div>
                {isCurrent && (
                  <span className="text-[10px] text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full shrink-0">
                    Current
                  </span>
                )}
                {isSelected && (
                  <span className="ml-auto text-purple-500 text-xs shrink-0">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={saving}
            className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 transition"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
          >
            {saving ? "Moving..." : "Move"}
          </button>
        </div>
       </div>
    </div>,
    document.body
  );
}

interface BulkMoveSprintsProps {
  projectId: string;
  fromSprint: Sprint | null;
  toSprint: Sprint | null;
  sprints: Sprint[];
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

export function BulkMoveSprintsModal({
  projectId,
  fromSprint,
  sprints,
  open,
  onClose,
  onDone,
}: BulkMoveSprintsProps) {
  const [targetSprintId, setTargetSprintId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  if (!open) return null;

  const handleMove = async () => {
    setMoving(true);
    try {
      const q = fromSprint
        ? query(
            collection(db, "projectTasks"),
            where("projectId", "==", projectId),
            where("sprintId", "==", fromSprint.id)
          )
        : query(
            collection(db, "projectTasks"),
            where("projectId", "==", projectId),
            where("sprintId", "==", null)
          );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) =>
        batch.update(d.ref, { sprintId: targetSprintId || null })
      );
      await batch.commit();
      onDone?.();
      onClose();
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Bulk Move Tasks</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
            ⚠️ All tasks from{" "}
            <strong>{fromSprint?.name || "Backlog"}</strong> will be moved to
            the selected sprint.
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Move to sprint
            </label>
            <select
              value={targetSprintId}
              onChange={(e) => setTargetSprintId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            >
              <option value="">Backlog (no sprint)</option>
              {sprints
                .filter((s) => s.id !== fromSprint?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving}
            className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
          >
            {moving ? "Moving..." : "Move All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SPRINT REPORTS
// =============================================================================

interface SprintReportsProps {
  sprints: Sprint[];
  tasks: Task[];
  columns: KanbanColumn[];
  projectColor: string;
  onTaskClick: (t: Task) => void;
  onClose?: () => void; // ✅ ADD THIS
}

export function SprintReports({
  sprints,
  tasks,
  columns,
  projectColor,
  onTaskClick,
   onClose, 
}: SprintReportsProps) {
  const doneColId =
    columns.find((c) => c.label.toLowerCase() === "done")?.id || "done";
  const nonStoryTasks = tasks.filter((t) => t.ticketType !== "story");

  if (sprints.length === 0) {
    return (
      <div className="p-6 text-center py-20 text-gray-300">
        <div style={{ fontSize: 48 }} className="mb-3">
          🏃
        </div>
        <p className="text-sm font-medium">No sprints yet</p>
        <p className="text-xs mt-1">Create sprints to see reports</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
       <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold">Sprint Reports</h2>

      {onClose && (
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          ← Back
        </button>
      )}
    </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sprints.map((sprint) => {
          const sprintTasks = nonStoryTasks.filter(
            (t) => t.sprintId === sprint.id
          );
          const done = sprintTasks.filter(
            (t) => t.status === doneColId
          ).length;
          const inProgress = sprintTasks.filter(
            (t) => t.status === "inprogress"
          ).length;
          const blocked = sprintTasks.filter(
            (t) => t.status === "blocked"
          ).length;
          const todo = sprintTasks.length - done - inProgress - blocked;
          const pct = sprintTasks.length
            ? Math.round((done / sprintTasks.length) * 100)
            : 0;
          const bugs = sprintTasks.filter(
            (t) => t.ticketType === "bug"
          ).length;
          const storyPts = sprintTasks.reduce(
            (s, t) => s + (t.storyPoints || 0),
            0
          );

          const now = new Date();
          let statusLabel = "Planned",
            statusColor = "#d97706",
            statusBg = "#fffbeb";
          if (sprint.status === "completed") {
            statusLabel = "Completed";
            statusColor = "#16a34a";
            statusBg = "#f0fdf4";
          } else if (sprint.endDate && new Date(sprint.endDate) < now) {
            statusLabel = "Overdue";
            statusColor = "#dc2626";
            statusBg = "#fef2f2";
          } else if (
            sprint.startDate &&
            new Date(sprint.startDate) <= now
          ) {
            statusLabel = "Active";
            statusColor = "#2563eb";
            statusBg = "#eff6ff";
          }

          return (
            <div
              key={sprint.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-50 flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{
                        background: statusBg,
                        color: statusColor,
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}
                    >
                      {statusLabel}
                    </span>
                    {sprint.sprintType && sprint.sprintType !== "Normal" && (
                      <span className="text-xs text-gray-400">
                        {sprint.sprintType === "Release" ? "🚀" : "🔥"}{" "}
                        {sprint.sprintType}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm truncate">
                    {sprint.name}
                  </h3>
                  {sprint.goal && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {sprint.goal}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-500 font-medium">
                      Completion
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: projectColor }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "#16a34a" : projectColor,
                      }}
                    />
                  </div>
                </div>

                {sprintTasks.length > 0 && (
                  <div className="flex gap-px h-2 rounded-full overflow-hidden">
                    {done > 0 && (
                      <div
                        style={{
                          width: `${(done / sprintTasks.length) * 100}%`,
                          background: "#16a34a",
                        }}
                      />
                    )}
                    {inProgress > 0 && (
                      <div
                        style={{
                          width: `${(inProgress / sprintTasks.length) * 100}%`,
                          background: "#2563eb",
                        }}
                      />
                    )}
                    {blocked > 0 && (
                      <div
                        style={{
                          width: `${(blocked / sprintTasks.length) * 100}%`,
                          background: "#dc2626",
                        }}
                      />
                    )}
                    {todo > 0 && (
                      <div
                        style={{
                          width: `${(todo / sprintTasks.length) * 100}%`,
                          background: "#e5e7eb",
                        }}
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Total",   val: sprintTasks.length, color: "#64748b" },
                    { label: "Done",    val: done,               color: "#16a34a" },
                    { label: "Blocked", val: blocked,            color: "#dc2626" },
                    { label: "Bugs",    val: bugs,               color: "#b91c1c" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-lg py-2">
                      <p
                        className="text-sm font-black"
                        style={{ color: s.color }}
                      >
                        {s.val}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {sprint.startDate || "—"} → {sprint.endDate || "—"}
                  </span>
                  {sprint.capacity && <span>Cap: {sprint.capacity}h</span>}
                  {storyPts > 0 && <span>🎯 {storyPts}pts</span>}
                </div>

                {sprint.velocity && (
                  <div className="flex items-center gap-2 text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5">
                    <span className="text-purple-600 font-semibold">
                      ⚡ Target velocity: {sprint.velocity} pts
                    </span>
                    {storyPts > 0 && (
                      <span
                        className={
                          storyPts >= sprint.velocity
                            ? "text-green-600 font-bold"
                            : "text-amber-600"
                        }
                      >
                        {storyPts >= sprint.velocity
                          ? "✓ Met"
                          : `${sprint.velocity - storyPts} pts behind`}
                      </span>
                    )}
                  </div>
                )}

                {sprint.tags && sprint.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sprint.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BacklogSection
        tasks={nonStoryTasks.filter((t) => !t.sprintId)}
        onTaskClick={onTaskClick}
        projectColor={projectColor}
      />
    </div>
  );
}

function BacklogSection({
  tasks,
  onTaskClick,
  projectColor,
}: {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  projectColor: string;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
        <span style={{ fontSize: 18 }}>📥</span>
        <h3 className="font-bold text-gray-800 text-sm">Sprint Backlog</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {tasks.length} tasks
        </span>
        <p className="text-xs text-gray-400 ml-2">
          Tasks not assigned to any sprint
        </p>
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.slice(0, 20).map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition"
          >
            <span className="text-sm">
              {task.ticketType === "bug"
                ? "🐞"
                : task.ticketType === "defect"
                ? "🎯"
                : "🧩"}
            </span>
            <span className="text-xs font-mono text-gray-400">
              {task.taskCode}
            </span>
            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
              {task.title}
            </span>
            <span className="text-xs text-gray-400">
              {task.assignedToName || "Unassigned"}
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background:
                  task.priority === "Critical"
                    ? "#fef2f2"
                    : task.priority === "High"
                    ? "#fff7ed"
                    : "#f0fdf4",
                color:
                  task.priority === "Critical"
                    ? "#dc2626"
                    : task.priority === "High"
                    ? "#ea580c"
                    : "#16a34a",
              }}
            >
              {task.priority}
            </span>
          </div>
        ))}
        {tasks.length > 20 && (
          <p className="text-xs text-center py-3 text-gray-400">
            +{tasks.length - 20} more in backlog
          </p>
        )}
      </div>
    </div>
  );
}
export function SprintPicker({
  sprints,
  activeSprint,
  onSelect,
  onDelete,
  onEdit,
}: any) {
  return (
    <div className="flex gap-2 mb-3 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded ${
          !activeSprint ? "bg-blue-600 text-white" : "bg-gray-100"
        }`}
      >
        All
      </button>

      {sprints.map((s: any) => (
        <div key={s.id} className="flex items-center gap-1">
          <button
            onClick={() => onSelect(s)}
            className={`px-3 py-1 rounded ${
              activeSprint?.id === s.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100"
            }`}
          >
            {s.name}
          </button>

          {onEdit && (
            <button onClick={() => onEdit(s)}>✏️</button>
          )}

          {onDelete && (
            <button onClick={() => onDelete(s)}>🗑️</button>
          )}
        </div>
      ))}
    </div>
  );
}