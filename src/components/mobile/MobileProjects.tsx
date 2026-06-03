"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { FolderKanban, Clock, Loader2, CheckCircle2, CircleDashed, AlertCircle } from "lucide-react";
import { TicketType, TICKET_TYPES } from "@/lib/kanbanUtils";

interface ProjectTask {
  id: string;
  projectId: string;
  projectName?: string;
  code: string;
  title: string;
  description: string;
  status: string;
  ticketType: TicketType;
  priority: string;
  dueDate?: string;
  storyPoints?: number;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Low: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", icon: "▼" },
  Medium: { color: "text-amber-600", bg: "bg-amber-50 border-amber-100", icon: "●" },
  High: { color: "text-orange-600", bg: "bg-orange-50 border-orange-100", icon: "▲" },
  Critical: { color: "text-rose-600", bg: "bg-rose-50 border-rose-100", icon: "⚡" },
};

const NEXT_STATUS: Record<string, string> = {
  new: "dev_in_progress",
  dev_in_progress: "unit_testing",
  unit_testing: "ready_for_qa",
  ready_for_qa: "done",
  reopened: "dev_in_progress"
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  dev_in_progress: "In Progress",
  unit_testing: "Unit Testing",
  ready_for_qa: "Ready for QA",
  testing_in_progress: "Testing",
  reopened: "Reopened",
  done: "Done"
};

export const MobileProjects = ({ projects = [] }: { projects?: any[] }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "projectTasks"),
      where("assignedTo", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: ProjectTask[] = [];
      snap.forEach((docSnap) => {
        const t = docSnap.data();
        const proj = projects.find(p => p.id === t.projectId);
        data.push({
          id: docSnap.id,
          ...t,
          projectName: proj?.name || "Unknown Project",
        } as ProjectTask);
      });
      // Sort in memory since we didn't add composite index for assignedTo + createdAt
      data.sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        return 0;
      });
      setTasks(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, projects]);

  const activeTasks = useMemo(() => tasks.filter(t => t.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.status === "done"), [tasks]);

  const advanceStatus = async (task: ProjectTask) => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    setUpdatingId(task.id);
    try {
      await updateDoc(doc(db, "projectTasks", task.id), { status: next });
    } catch (err) {
      console.error(err);
      alert("Failed to update task");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Loading Tasks</p>
      </div>
    );
  }

  const renderTask = (task: ProjectTask) => {
    const typeCfg = TICKET_TYPES[task.ticketType || "task"];
    const prioCfg = PRIORITY_CONFIG[task.priority || "Medium"];
    const nextSt  = NEXT_STATUS[task.status];

    return (
      <div key={task.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3 relative overflow-hidden">
        {task.status === "done" && <div className="absolute inset-0 bg-gray-50/50 pointer-events-none" />}
        
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border`} style={{ background: typeCfg.bg, color: typeCfg.color, borderColor: typeCfg.border }}>
                {typeCfg.icon} {typeCfg.label}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border flex items-center gap-1 ${prioCfg.bg} ${prioCfg.color}`}>
                {prioCfg.icon} {task.priority || "Medium"}
              </span>
              <span className="text-[10px] font-bold text-gray-400">{task.code}</span>
            </div>
            <h4 className={`text-sm font-bold leading-snug ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {task.title}
            </h4>
            <p className="text-[10px] font-bold text-indigo-600 mt-1 uppercase tracking-wider truncate">
              {task.projectName}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: task.status === "done" ? "#10b981" : "#3b82f6" }} />
            <span className="text-xs font-bold text-gray-600">{STATUS_LABELS[task.status] || task.status}</span>
          </div>

          {task.status !== "done" && nextSt && (
            <button
              onClick={() => advanceStatus(task)}
              disabled={updatingId === task.id}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {updatingId === task.id ? (
                <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <>Move to {STATUS_LABELS[nextSt]}</>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <FolderKanban className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-gray-900">My Tasks</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Swipe or tap to update your assigned tickets.</p>
      </div>

      <div className="flex flex-col gap-6 pb-10">
        <div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
            <CircleDashed className="w-4 h-4 text-blue-500" /> Active Tasks ({activeTasks.length})
          </h3>
          {activeTasks.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">You have no active tasks.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeTasks.map(renderTask)}
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2 mt-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Recently Done
            </h3>
            <div className="flex flex-col gap-3">
              {completedTasks.slice(0, 5).map(renderTask)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
