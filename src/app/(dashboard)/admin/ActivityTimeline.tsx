"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityLog } from "./types";

const ACTION_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
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

/* ── Task Activity Timeline (shown inside task detail) ── */
export function TaskActivityTimeline({ taskId, projectColor }: { taskId: string; projectColor: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      where("taskId", "==", taskId),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, snap =>
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)))
    );
  }, [taskId]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-300">
        <div style={{ fontSize: 40 }} className="mb-2">📜</div>
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 z-10"
              style={{ background: meta.bg, border: `2px solid ${meta.color}30` }}>
              {meta.icon}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm">
                    <span className="font-semibold text-gray-800">{log.userName}</span>{" "}
                    <span className="text-gray-500">{meta.label.toLowerCase()}</span>
                  </p>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                    {log.createdAt?.toDate ? timeAgo(log.createdAt.toDate()) : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{log.description}</p>
                {/* From → To */}
                {(log.from || log.to) && (
                  <div className="flex items-center gap-2 mt-2">
                    {log.from && Object.keys(log.from).map(k => (
                      <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 line-through border border-red-100">
                        {String(log.from?.[k])}
                      </span>
                    ))}
                    {log.from && log.to && <span className="text-gray-300 text-xs">→</span>}
                    {log.to && Object.keys(log.to).map(k => (
                      <span key={k} className="text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.color + "30" }}>
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

/* ── Project-level Activity Stream ── */
export function ProjectActivityTimeline({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap =>
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)))
    );
  }, [projectId]);

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>📜</span> Activity Stream
          <span className="ml-auto text-xs font-normal text-gray-400">{logs.length} events</span>
        </h3>
        <div className="space-y-0">
          {logs.slice(0, 60).map((log, i) => {
            const meta = ACTION_META[log.action] || ACTION_META.updated;
            return (
              <div key={log.id} className="flex gap-4 relative">
                {i < logs.length - 1 && <div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 z-10"
                  style={{ background: meta.bg }}>
                  {meta.icon}
                </div>
                <div className="flex-1 pb-5">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm">
                        <span className="font-semibold text-gray-800">{log.userName}</span>{" "}
                        <span className="text-gray-500">{log.description}</span>
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <div style={{ fontSize: 48 }} className="mb-3">📜</div>
              <p className="text-sm">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Utility: log activity ── */
export async function logActivityEntry(
  params: Omit<ActivityLog, "id" | "createdAt">
) {
  await addDoc(collection(db, "activityLogs"), {
    ...params,
    createdAt: serverTimestamp(),
  });
}
