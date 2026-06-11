"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DailyTask } from "@/types/dailyTask";

export default function EmployeeTasksView({ user }: { user: any }) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Assigned" | "In Progress" | "Completed">("All");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // Fetch users for resolving "Created By" names
    import("firebase/firestore").then(({ getDocs, collection }) => {
      getDocs(collection(db, "users")).then(snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(console.error);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "projectTasks"),
      where("assignedTo", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setTasks(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setLoading(false);
    });

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [user?.uid]);

  const updateStatus = async (taskId: string, status: "todo" | "in progress" | "done") => {
    try {
      const payload: any = { status, updatedAt: serverTimestamp() };
      if (status === "done") {
        const notes = window.prompt("Add any completion notes or remarks for your Lead (optional):");
        if (notes === null) return; // cancelled
        payload.actualCompletionDate = new Date().toISOString();
        if (notes.trim()) payload.employeeNotes = notes.trim();
      }
      await updateDoc(doc(db, "projectTasks", taskId), payload);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      const title = t.title || t.taskName || "";
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const isCompleted = t.status === "done" || t.status === "Completed";
      const isWorking = t.status === "in progress" || t.status === "In Progress";
      
      let matchesFilter = true;
      if (filterStatus === "Completed") matchesFilter = isCompleted;
      if (filterStatus === "In Progress") matchesFilter = isWorking;
      if (filterStatus === "Assigned") matchesFilter = !isCompleted && !isWorking;
      
      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === "done" || t.status === "Completed").length;
    const inProgress = tasks.filter((t: any) => t.status === "in progress" || t.status === "In Progress").length;
    const assigned = total - completed - inProgress;
    return { total, completed, inProgress, assigned };
  }, [tasks]);

  const formatDate = (dateInput: any) => {
    if (!dateInput) return "--";
    const d = dateInput.seconds ? new Date(dateInput.seconds * 1000) : new Date(dateInput);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  // --- LIST VIEW ---
  const renderList = () => (
    <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden mt-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search task, description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-[240px] transition-all"
            />
          </div>
          
          <div className="flex gap-2 text-xs font-medium">
            <button onClick={() => setFilterStatus("All")} className={`px-3 py-1.5 rounded-full transition-colors ${filterStatus === "All" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>All ({stats.total})</button>
            <button onClick={() => setFilterStatus("Assigned")} className={`px-3 py-1.5 rounded-full transition-colors ${filterStatus === "Assigned" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Assigned ({stats.assigned})</button>
            <button onClick={() => setFilterStatus("In Progress")} className={`px-3 py-1.5 rounded-full transition-colors ${filterStatus === "In Progress" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Working ({stats.inProgress})</button>
            <button onClick={() => setFilterStatus("Completed")} className={`px-3 py-1.5 rounded-full transition-colors ${filterStatus === "Completed" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Completed ({stats.completed})</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-[11px] text-gray-500 font-medium bg-white">
              <th className="px-3 py-3 font-medium">Task</th>
              <th className="px-3 py-3 font-medium">Created By</th>
              <th className="px-3 py-3 font-medium">Priority</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-center">Assigned At</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-center">Deadline</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-center">Completed At</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">No tasks found matching your criteria.</td></tr>
            ) : filteredTasks.map((t: any) => {
              const isCompleted = t.status === "done" || t.status === "Completed";
              const isWorking = t.status === "in progress" || t.status === "In Progress";
              const assignedByUser = users.find(u => u.uid === t.createdBy);
              const assignedByName = t.createdByName || assignedByUser?.name || assignedByUser?.displayName || assignedByUser?.email?.split('@')[0] || "Unassigned";
              return (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors bg-white">
                <td className="px-3 py-3">
                  <p className="text-[12px] font-semibold text-gray-800 break-words line-clamp-2">{t.title || t.taskName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 break-words line-clamp-1" title={t.description}>{t.description}</p>
                </td>
                
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(assignedByName)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">{assignedByName}</p>
                    </div>
                  </div>
                </td>

                <td className="px-3 py-3">
                  <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex border 
                    ${t.priority === 'High' || t.priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-100' : 
                      t.priority === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                      'bg-blue-50 text-blue-600 border-blue-100'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${t.priority === 'High' || t.priority === 'Critical' ? 'bg-red-500' : t.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                    {t.priority || 'Medium'}
                  </div>
                </td>

                <td className="px-3 py-3 text-[11px] text-gray-600 text-center">
                  {(() => {
                    const d = new Date(t.createdAt?.seconds * 1000 || Date.now());
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 text-[11px] text-center">
                  {(() => {
                    const deadlineStr = t.dueDate || t.expectedCompletionDate;
                    if (!deadlineStr) return <span className="text-gray-400">-</span>;
                    const d = new Date(deadlineStr);
                    const isLate = d < new Date() && t.status !== 'Completed' && t.status !== 'done';
                    return (
                      <div className={`flex flex-col items-center justify-center ${isLate ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                        <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className={`text-[10px] whitespace-nowrap ${isLate ? 'text-red-500' : 'text-gray-400'}`}>{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 text-[11px] text-gray-600 text-center">
                  {(() => {
                    if ((t.status !== 'done' && t.status !== 'Completed') || !t.updatedAt) return "-";
                    const d = new Date(t.updatedAt?.seconds * 1000 || Date.now());
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })()}
                </td>

                <td className="px-3 py-3">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium bg-white shadow-sm
                    ${isCompleted ? "border-green-200 text-green-700" :
                      isWorking ? "border-orange-200 text-orange-700" :
                      "border-blue-200 text-blue-700"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-green-500" : isWorking ? "bg-orange-500" : "bg-blue-500"}`}></div>
                    {( {
                                new: "New",
                                dev_in_progress: "Dev In Progress",
                                unit_testing: "Unit Testing",
                                ready_for_qa: "Ready For QA",
                                testing_in_progress: "Testing In Progress",
                                reopened: "Reopened",
                                done: "Done",
                                r_and_d: "R & D",
                                Completed: "Done"
                              } as Record<string, string> )[t.status as string] || (t.status as string) || 'New'}
                  </div>
                </td>

                <td className="px-3 py-3 text-right">
                  {!isCompleted && !isWorking && (
                    <button onClick={() => updateStatus(t.id, "in progress")} className="px-4 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 shadow-sm transition-colors">Start</button>
                  )}
                  {isWorking && (
                    <button onClick={() => updateStatus(t.id, "done")} className="px-4 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 shadow-sm transition-colors">Complete</button>
                  )}
                  {isCompleted && (
                    <span className="text-[12px] text-gray-400 italic">Done</span>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="p-10 flex justify-center items-center h-[50vh]"><div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 animate-fade-in font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* --- PRODUCTIVITY STATS (NEW FEATURE) --- */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Tasks</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-lg">📋</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Pending</p>
              <h3 className="text-2xl font-bold text-blue-700">{stats.assigned}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-lg">⏳</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">In Progress</p>
              <h3 className="text-2xl font-bold text-orange-700">{stats.inProgress}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 text-lg">🔥</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-sm font-medium text-green-600">Completed</p>
              <h3 className="text-2xl font-bold text-green-700">{stats.completed}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-lg relative z-10">✅</div>
            {/* Progress bar background */}
            <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}></div>
          </div>
        </div>

        {/* --- TITLE --- */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🚀</span> My Tasks
          </h2>
        </div>

        {/* --- CONTENT --- */}
        <div className="transition-all duration-300 ease-in-out">
          {renderList()}
        </div>

      </div>
    </div>
  );
}
