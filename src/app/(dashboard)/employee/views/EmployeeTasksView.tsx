"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DailyTask } from "@/types/dailyTask";
import SectionLoader from "@/components/common/SectionLoader";

export default function EmployeeTasksView({ user }: { user: any }) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "New" | "Dev In Progress" | "Unit Testing" | "Ready For QA" | "Done">("All");
  const [filterProject, setFilterProject] = useState<string>("All");
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectColumns, setProjectColumns] = useState<any[]>([]);

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
  useEffect(() => {
    if (!user?.uid) return;
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubProjects();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubProjectCols = onSnapshot(collection(db, "projectColumns"), (snap) => {
      setProjectColumns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubProjectCols();
  }, [user?.uid]);

  const getStatusLabel = (task: any) => {
    const defaultMap: Record<string, string> = {
      new: "New",
      dev_in_progress: "Dev In Progress",
      unit_testing: "Unit Testing",
      ready_for_qa: "Ready For QA",
      testing_in_progress: "Testing In Progress",
      reopened: "Reopened",
      done: "Done",
      r_and_d: "R & D",
      Completed: "Done"
    };

    if (defaultMap[task.status]) return defaultMap[task.status];

    const proj = projects.find(p => p.id === task.projectId || p.name === task.projectName || p.name === task.project);
    if (proj && proj.kanbanColumns) {
      const col = proj.kanbanColumns.find((c: any) => c.id === task.status);
      if (col) return col.label;
    }
    
    if (proj) {
      const pCols = projectColumns.find(pc => pc.projectId === proj.id);
      if (pCols && pCols.columns) {
        const col = pCols.columns.find((c: any) => c.id === task.status);
        if (col) return col.label;
      }
    } else if (task.projectId) {
      const pCols = projectColumns.find(pc => pc.projectId === task.projectId);
      if (pCols && pCols.columns) {
        const col = pCols.columns.find((c: any) => c.id === task.status);
        if (col) return col.label;
      }
    }

    return task.status || "New";
  };
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

  const uniqueProjects = useMemo(() => {
    const pSet = new Set<string>();

    tasks.forEach((t: any) => {
      let pName = t.projectName || t.project;
      if (!pName && t.projectId) {
        const matchedProject = projects.find(p => p.id === t.projectId);
        if (matchedProject) pName = matchedProject.name;
      }
      if (pName) pSet.add(pName);
    });
    
    projects.forEach((p: any) => {
      const isMember = p.members?.includes(user?.uid) || 
                       p.projectManager === user?.uid || 
                       p.projectManagers?.includes(user?.uid) || 
                       p.createdBy === user?.uid;
      if (isMember && p.name) pSet.add(p.name);
    });
    
    return Array.from(pSet).sort();
  }, [tasks, projects, user?.uid]);

  const baseFilteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      let matchesProject = true;
      if (filterProject !== "All") {
        let pName = t.projectName || t.project;
        if (!pName && t.projectId) {
          const matchedProject = projects.find(p => p.id === t.projectId);
          if (matchedProject) pName = matchedProject.name;
        }
        matchesProject = pName === filterProject;
      }
      return matchesProject;
    });
  }, [tasks, filterProject, projects]);

  const filteredTasks = useMemo(() => {
    return baseFilteredTasks.filter((t: any) => {
      const title = t.title || t.taskName || "";
      const label = getStatusLabel(t);
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const isCompleted = t.status === "done" || t.status === "Completed" || label.toLowerCase() === "done" || label.toLowerCase() === "completed";
      const isWorking = t.status === "in progress" || t.status === "In Progress" || t.status === "dev_in_progress" || label.toLowerCase().includes("progress");

      let matchesFilter = true;
      const labelStr = label.toLowerCase();
      if (filterStatus === "New") matchesFilter = labelStr === "new";
      if (filterStatus === "Dev In Progress") matchesFilter = labelStr === "dev in progress";
      if (filterStatus === "Unit Testing") matchesFilter = labelStr === "unit testing";
      if (filterStatus === "Ready For QA") matchesFilter = labelStr === "ready for qa";
      if (filterStatus === "Done") matchesFilter = labelStr === "done" || labelStr === "completed";

      return matchesSearch && matchesFilter;
    });
  }, [baseFilteredTasks, searchQuery, filterStatus, projects, projectColumns]);

  const stats = useMemo(() => {
    const counts = { total: baseFilteredTasks.length, newTasks: 0, devInProgress: 0, unitTesting: 0, readyForQa: 0, done: 0 };
    let completed = 0;
    let inProgress = 0;

    baseFilteredTasks.forEach((t: any) => {
      const labelStr = getStatusLabel(t).toLowerCase();
      if (labelStr === "new") counts.newTasks++;
      else if (labelStr === "dev in progress") counts.devInProgress++;
      else if (labelStr === "unit testing") counts.unitTesting++;
      else if (labelStr === "ready for qa") counts.readyForQa++;
      else if (labelStr === "done" || labelStr === "completed") counts.done++;

      if (t.status === "done" || t.status === "Completed" || labelStr === "done" || labelStr === "completed") {
        completed++;
      } else if (t.status === "in progress" || t.status === "In Progress" || t.status === "dev_in_progress" || labelStr.includes("progress")) {
        inProgress++;
      }
    });

    const assigned = counts.total - completed - inProgress;

    return { ...counts, completed, inProgress, assigned };
  }, [baseFilteredTasks, projects, projectColumns]);

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
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative shrink-0">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search task, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full sm:w-[240px] transition-all"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="pl-3 pr-8 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm cursor-pointer appearance-none w-full sm:w-[180px] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-8px)_center] bg-[length:14px]"
            >
              <option value="All">All Projects</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 text-xs font-medium overflow-x-auto pb-2 sm:pb-0 hide-scrollbar w-full sm:w-auto">
          <button onClick={() => setFilterStatus("All")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "All" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>All ({stats.total})</button>
          <button onClick={() => setFilterStatus("New")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "New" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>New ({stats.newTasks})</button>
          <button onClick={() => setFilterStatus("Dev In Progress")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "Dev In Progress" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Dev In Progress ({stats.devInProgress})</button>
          <button onClick={() => setFilterStatus("Unit Testing")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "Unit Testing" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Unit Testing ({stats.unitTesting})</button>
          <button onClick={() => setFilterStatus("Ready For QA")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "Ready For QA" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Ready For QA ({stats.readyForQa})</button>
          <button onClick={() => setFilterStatus("Done")} className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "Done" ? "bg-slate-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Done ({stats.done})</button>
        </div>
      </div>

      {/* ── MOBILE VIEW (CARD LAYOUT) ── */}
      <div className="lg:hidden mx-2 sm:mx-4 mb-6 space-y-4 pt-4">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">No tasks found matching your criteria.</div>
        ) : filteredTasks.map((t: any) => {
          const label = getStatusLabel(t);
          const isCompleted = t.status === "done" || t.status === "Completed" || label.toLowerCase() === "done" || label.toLowerCase() === "completed";
          const isWorking = t.status === "in progress" || t.status === "In Progress" || t.status === "dev_in_progress" || label.toLowerCase().includes("progress");
          const assignedByUser = users.find(u => u.uid === t.createdBy);
          const assignedByName = t.createdByName || assignedByUser?.name || assignedByUser?.displayName || assignedByUser?.email?.split('@')[0] || "Unassigned";

          const deadlineStr = t.dueDate || t.expectedCompletionDate;
          const isLate = deadlineStr && new Date(deadlineStr) < new Date() && t.status !== 'Completed' && t.status !== 'done';
          const deadlineText = deadlineStr ? new Date(deadlineStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : "No deadline";

          return (
            <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
              {/* Header: Title & Status */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-tight">{t.title || t.taskName}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${isCompleted ? 'bg-green-100 text-green-700' : isWorking ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {label}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-y-2 mt-1">
                <div>
                  <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Priority</span>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${t.priority === 'High' || t.priority === 'Critical' ? 'text-red-600' : t.priority === 'Medium' ? 'text-yellow-600' : 'text-blue-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${t.priority === 'High' || t.priority === 'Critical' ? 'bg-red-500' : t.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                    {t.priority || 'Medium'}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Created By</span>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold shrink-0">
                      {(assignedByName)[0].toUpperCase()}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 truncate">{assignedByName}</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Assigned</span>
                  <span className="block mt-0.5 text-[11px] font-medium text-gray-700">
                    {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Deadline</span>
                  <span className={`block mt-0.5 text-[11px] font-medium ${isLate ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                    {deadlineText}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP VIEW (TABLE) ── */}
      <div className="hidden lg:block overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 text-[11px] text-gray-500 font-medium bg-white">
              <th className="px-3 py-3 font-medium">Task</th>
              <th className="px-3 py-3 font-medium">Created By</th>
              <th className="px-3 py-3 font-medium">Priority</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-center">Assigned At</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-center">Deadline</th>
              <th className="px-3 py-3 font-medium text-center">Completed At</th>
              <th className="px-3 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-500">No tasks found matching your criteria.</td></tr>
            ) : filteredTasks.map((t: any) => {
              const label = getStatusLabel(t);
              const isCompleted = t.status === "done" || t.status === "Completed" || label.toLowerCase() === "done" || label.toLowerCase() === "completed";
              const isWorking = t.status === "in progress" || t.status === "In Progress" || t.status === "dev_in_progress" || label.toLowerCase().includes("progress");
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

                  <td className="px-3 py-3 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium bg-white shadow-sm
                    ${isCompleted ? "border-green-200 text-green-700" :
                        isWorking ? "border-orange-200 text-orange-700" :
                          "border-blue-200 text-blue-700"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-green-500" : isWorking ? "bg-orange-500" : "bg-blue-500"}`}></div>
                      {getStatusLabel(t)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <SectionLoader />;

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
