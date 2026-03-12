"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// ── Types ────────────────────────────────────────────────
type Status   = "In Progress" | "Completed" | "Blocked" | "Review";
type Priority = "Low" | "Medium" | "High" | "Urgent";

// ── Config ───────────────────────────────────────────────
const STATUSES: { value: Status; label: string; color: string; bg: string }[] = [
  { value: "In Progress", label: "In Progress", color: "text-blue-700",   bg: "bg-blue-50   border-blue-300"   },
  { value: "Completed",   label: "Completed",   color: "text-green-700",  bg: "bg-green-50  border-green-300"  },
  { value: "Blocked",     label: "Blocked",     color: "text-red-700",    bg: "bg-red-50    border-red-300"    },
  { value: "Review",      label: "Review",      color: "text-purple-700", bg: "bg-purple-50 border-purple-300" },
];

const PRIORITIES: { value: Priority; label: string; color: string; dot: string }[] = [
  { value: "Low",    label: "Low",    color: "text-gray-600",  dot: "bg-gray-400"   },
  { value: "Medium", label: "Medium", color: "text-yellow-700",dot: "bg-yellow-400" },
  { value: "High",   label: "High",   color: "text-orange-700",dot: "bg-orange-500" },
  { value: "Urgent", label: "Urgent", color: "text-red-700",   dot: "bg-red-500"    },
];

// ── Component ────────────────────────────────────────────
export default function WorkUpdateView() {
  const { user } = useAuth();

  const [task,     setTask]     = useState("");
  const [notes,    setNotes]    = useState("");
  const [status,   setStatus]   = useState<Status>("In Progress");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null);

  const handleSave = async () => {
    if (!task.trim() && !notes.trim()) {
      setMsg({ text: "Please enter a task or notes before saving.", ok: false });
      return;
    }
    if (!user) {
      setMsg({ text: "You must be logged in to save.", ok: false });
      return;
    }

    try {
      setSaving(true);
      setMsg(null);

      await addDoc(collection(db, "workUpdates"), {
        uid:       user.uid,
        userEmail: user.email ?? "",
        userName:  user.email?.split("@")[0] ?? "Unknown",
        task:      task.trim(),
        notes:     notes.trim(),
        status,
        priority,
        createdAt: serverTimestamp(),
      });

      setMsg({ text: "✅ Work update saved successfully!", ok: true });
      setTask("");
      setNotes("");
      setStatus("In Progress");
      setPriority("Medium");
    } catch (err) {
      console.error("WorkUpdate save error:", err);
      setMsg({ text: "❌ Failed to save. Please try again.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="bg-linear-to-r from-[#0b3a5a] to-[#1a5276] px-6 py-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📝 <span>Work Update</span>
          </h2>
          <p className="text-white/60 text-xs mt-0.5">Log what you're working on today</p>
        </div>

        <div className="p-6 space-y-5">

          {/* Task */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Task <span className="text-red-500">*</span>
            </label>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What are you working on?"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0b3a5a] transition-colors placeholder-gray-400"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-4">

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                      status === s.value
                        ? `${s.bg} ${s.color} shadow-sm`
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      status === s.value
                        ? s.value === "In Progress" ? "bg-blue-500"
                          : s.value === "Completed"  ? "bg-green-500"
                          : s.value === "Blocked"    ? "bg-red-500"
                          : "bg-purple-500"
                        : "bg-gray-300"
                    }`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                      priority === p.value
                        ? `${p.color} bg-opacity-10 border-current shadow-sm`
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                    style={priority === p.value ? { backgroundColor: "rgba(0,0,0,0.04)" } : {}}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${priority === p.value ? p.dot : "bg-gray-300"}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes / Progress</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe your progress, blockers, or next steps..."
              rows={4}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0b3a5a] transition-colors resize-none placeholder-gray-400"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-linear-to-r from-[#0b3a5a] to-[#1a5276] text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </span>
            ) : "💾 Save Work Update"}
          </button>

          {/* Message */}
          {msg && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
              msg.ok
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}