"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Play, Square, Timer as TimerIcon, Plus, Target, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export const MobileTimer = ({ user }: { user: any }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTask, setActiveTask] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch user's tasks
  useEffect(() => {
    if (!user?.uid) return;
    const fetchTasks = async () => {
      const q = query(collection(db, "tasks"), where("assignees", "array-contains", user.uid));
      const snap = await getDocs(q);
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchTasks();
  }, [user]);

  // Timer interval
  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggle = () => {
    if (!activeTask && !isRunning) {
      alert("Please select or enter a task to track time against.");
      return;
    }
    setIsRunning(!isRunning);
  };

  const handleStopAndSave = async () => {
    if (!activeTask || elapsed < 60) {
      // Less than a minute, just reset
      setIsRunning(false);
      setElapsed(0);
      setActiveTask("");
      return;
    }

    setSaving(true);
    setIsRunning(false);
    try {
      const hoursWorked = elapsed / 3600;
      await addDoc(collection(db, "workLogs"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        taskId: activeTask, // could be a custom string or a project task id
        description: `Tracked time: ${activeTask}`,
        hours: hoursWorked,
        date: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp()
      });
      alert(`Saved ${formatTime(elapsed)} to work logs!`);
    } catch (err) {
      console.error(err);
      alert("Failed to save work log.");
    } finally {
      setSaving(false);
      setElapsed(0);
      setActiveTask("");
    }
  };

  return (
    <div className="flex flex-col gap-6 items-center justify-center pt-8">
      <div className="text-center space-y-2 mb-4">
        <h2 className="text-xl font-black text-gray-900">Focus Mode</h2>
        <p className="text-xs text-gray-500 max-w-[250px] mx-auto">Track your deep work sessions and automatically log hours to your projects.</p>
      </div>

      {/* Timer Circle */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: isRunning ? 360 : 0 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-4 border-dashed border-indigo-200"
        />
        <div className={`absolute inset-2 rounded-full border-[8px] transition-colors duration-1000 ${isRunning ? 'border-indigo-600 shadow-xl shadow-indigo-600/30' : 'border-gray-100'}`} />
        
        <div className="z-10 flex flex-col items-center">
          <span className="text-5xl font-black text-gray-900 tabular-nums tracking-tight">
            {formatTime(elapsed)}
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
            {isRunning ? 'Focusing...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Task Input */}
      <div className="w-full max-w-sm mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          What are you working on?
        </label>
        <input 
          type="text"
          disabled={isRunning}
          placeholder="e.g. Design new landing page..."
          value={activeTask}
          onChange={(e) => setActiveTask(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border border-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
        />
        {tasks.length > 0 && !isRunning && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tasks.slice(0, 3).map(t => (
              <button 
                key={t.id} 
                onClick={() => setActiveTask(t.title)}
                className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-bold truncate max-w-[150px] transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={handleToggle}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${
            isRunning ? "bg-amber-500 shadow-amber-500/30" : "bg-indigo-600 shadow-indigo-600/30"
          }`}
        >
          {isRunning ? <TimerIcon className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>

        {elapsed > 0 && (
          <button
            onClick={handleStopAndSave}
            disabled={saving}
            className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 active:scale-95 transition-all disabled:opacity-50"
          >
            <Square className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};
