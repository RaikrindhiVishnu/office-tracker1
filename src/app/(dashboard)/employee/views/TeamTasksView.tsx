"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DailyTask } from "@/types/dailyTask";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function TeamTasksView({ user }: { user: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [projectColumns, setProjectColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "New" | "Dev In Progress" | "Testing" | "Done">("All");
  const [filterMember, setFilterMember] = useState<string>("All");
  const [filterProject, setFilterProject] = useState<string>("All");
  const [showCustomDatePopup, setShowCustomDatePopup] = useState(false);

  const getMappedStatus = (raw: string) => {
    if (!raw) return "New";
    const lastIdx = raw.lastIndexOf("_");
    let norm = raw;
    if (lastIdx > -1) {
      const suffix = raw.substring(lastIdx + 1);
      if (suffix.length > 5 && /^[a-z0-9]+$/i.test(suffix)) {
        norm = raw.substring(0, lastIdx);
      }
    }
    const map: Record<string, string> = {
      new: "New",
      dev_in_progress: "Dev In Progress",
      unit_testing: "Testing",
      ready_for_qa: "Testing",
      testing_in_progress: "Testing",
      reopened: "New",
      done: "Done",
      Completed: "Done"
    };
    return map[norm] || "New";
  };

  const getDisplayStatus = (task: any) => {
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

    const proj = allProjects.find(p => p.id === task.projectId || p.name === task.projectName || p.name === task.project);
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


  const [filterTime, setFilterTime] = useState<"All Time" | "This Month" | "Today" | "Custom">("All Time");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Define TEAMS statically so they are available immediately on first render
  const TEAMS = useMemo(() => [
    { id: "team_frontend", name: "Front End Team", email: "frontend@team" },
    { id: "team_backend", name: "Backend Team", email: "backend@team" },
    { id: "team_uiux", name: "UI/UX Team", email: "uiux@team" },
    { id: "team_ai", name: "AI Team", email: "ai@team" },
    { id: "team_mobile", name: "Mobile Team", email: "mobile@team" },
    { id: "team_3dmax", name: "3D Max Team", email: "3dmax@team" },
    { id: "team_qa", name: "QA Team", email: "qa@team" },
  ], []);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchTeamAndTasks = async () => {
      let memberIds = [user.uid];
      let tMembers: any[] = [];
      try {
        if (user.role === "lead") {
          const q = query(collection(db, "users"), where("reportingTo", "==", user.uid));
          const snap = await getDocs(q);
          tMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          memberIds = [user.uid, ...tMembers.map(m => m.uid || m.id)];
        }
        setTeamMembers(tMembers);
      } catch (err) {
        console.error("Failed to fetch team members", err);
      }

      const unsubscribeFunctions: (() => void)[] = [];
      const allTasksMap = new Map();

      // Fetch all projects
      const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
        setAllProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubscribeFunctions.push(unsubProjects);
      
      const unsubProjectCols = onSnapshot(collection(db, "projectColumns"), (snap) => {
        setProjectColumns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubscribeFunctions.push(unsubProjectCols);

      // Firestore 'in' queries are limited to 10 elements
      const chunks = [];
      for (let i = 0; i < memberIds.length; i += 10) {
        chunks.push(memberIds.slice(i, i + 10));
      }

      chunks.forEach(chunk => {
        const tasksQuery = query(
          collection(db, "projectTasks"),
          where("assignedTo", "in", chunk)
        );

        const unsub = onSnapshot(tasksQuery, (snap) => {
          snap.docs.forEach(d => {
            allTasksMap.set(d.id, { id: d.id, ...d.data() });
          });
          
          // Determine items removed if any
          snap.docChanges().forEach(change => {
            if (change.type === "removed") {
              allTasksMap.delete(change.doc.id);
            }
          });

          // Re-sort in memory by createdAt descending
          const sorted = Array.from(allTasksMap.values()).sort((a, b) => {
             const tA = a.createdAt?.seconds || 0;
             const tB = b.createdAt?.seconds || 0;
             return tB - tA;
          });
          
          setTasks(sorted);
          setTasks(sorted);
          setLoading(false);
        }, (error) => {
          console.error("Firestore onSnapshot error:", error);
          setLoading(false);
        });
        unsubscribeFunctions.push(unsub);
      });
      
      // Fallback: stop loading after 5 seconds if onSnapshot never fires
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 5000);

      return () => {
        clearTimeout(timeout);
        unsubscribeFunctions.forEach(unsub => unsub());
      };
    };

    const cleanupPromise = fetchTeamAndTasks();

    return () => {
      cleanupPromise.then(cleanup => { if (cleanup) cleanup() });
    };
  }, [user?.uid, user?.role]);


  const handleReviewTask = async (taskId: string, quality: "Totally Correct" | "Partially Correct" | "Totally Wrong") => {
    try {
      // determine timeliness based on expected vs actual
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      let timeliness: "Completed On Time" | "Late Completion" = "Late Completion";
      if (task.actualHours !== undefined || task.dueDate) {
        if (!task.dueDate || new Date() <= new Date(task.dueDate)) {
          timeliness = "Completed On Time";
        }
      }

      await updateDoc(doc(db, "projectTasks", taskId), {
        qualityReview: quality,
        completionStatus: timeliness,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating review", err);
    }
  };


  // --- Filtering Logic ---
  const uniqueProjects = useMemo(() => {
    const pSet = new Set<string>();
    
    // Add all project names from DB
    allProjects.forEach(p => {
      if (p.name) pSet.add(p.name);
    });

    // Also include projects from tasks as fallback
    tasks.forEach((t: any) => {
      if (t.projectName) pSet.add(t.projectName);
      else if (t.project) pSet.add(t.project);
    });
    return Array.from(pSet).sort();
  }, [tasks, allProjects]);

  const baseFilteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      const title = t.title || t.taskName || "";
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesMember = true;
      if (filterMember !== "All") {
        matchesMember = t.assignedTo === filterMember;
      }
      
      let matchesTime = true;
      if (t.createdAt && filterTime !== "All Time") {
        const d = new Date(t.createdAt.seconds * 1000);
        const now = new Date();
        if (filterTime === "Today") {
          matchesTime = d.toDateString() === now.toDateString();
        } else if (filterTime === "This Month") {
          matchesTime = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (filterTime === "Custom") {
          if (customStart && customEnd) {
            const start = new Date(customStart + "T00:00:00");
            const end = new Date(customEnd + "T23:59:59");
            matchesTime = d >= start && d <= end;
          }
        }
      }
      
      let matchesProject = true;
      if (filterProject !== "All") {
        let pName = t.projectName || t.project;
        if (!pName && t.projectId) {
          const matchedProject = allProjects.find(p => p.id === t.projectId);
          if (matchedProject) pName = matchedProject.name;
        }
        matchesProject = pName === filterProject;
      }
      
      return matchesSearch && matchesMember && matchesTime && matchesProject;
    });
  }, [tasks, searchQuery, filterMember, filterTime, customStart, customEnd, filterProject, allProjects]);

  const filteredTasks = useMemo(() => {
    return baseFilteredTasks.filter((t: any) => {
      const mappedStatus = getMappedStatus(t.status);
      return filterStatus === "All" || mappedStatus === filterStatus;
    });
  }, [baseFilteredTasks, filterStatus]);

  // --- Analytics Calculations ---
  const stats = useMemo(() => {
    // Apply project filter to analytics tasks
    const projectFilteredTasks = filterProject === "All" 
      ? tasks 
      : tasks.filter((t: any) => {
          let pName = t.projectName || t.project;
          if (!pName && t.projectId) {
            const matchedProject = allProjects.find(p => p.id === t.projectId);
            if (matchedProject) pName = matchedProject.name;
          }
          return pName === filterProject;
        });

    const analyticsTasks = projectFilteredTasks.length > 0 ? projectFilteredTasks : [
      { status: "Completed", completionStatus: "Completed On Time", qualityReview: "Totally Correct", assignedTo: "team_frontend" },
      { status: "Completed", completionStatus: "Completed On Time", qualityReview: "Totally Correct", assignedTo: "team_backend" },
      { status: "Completed", completionStatus: "Completed On Time", qualityReview: "Partially Correct", assignedTo: "team_uiux" },
      { status: "Pending", completionStatus: "On Track", qualityReview: null, assignedTo: "team_ai" },
      { status: "Pending", completionStatus: "On Track", qualityReview: null, assignedTo: "team_mobile" },
      { status: "Completed", completionStatus: "Late Completion", qualityReview: "Totally Wrong", assignedTo: "team_3dmax" },
      { status: "Completed", completionStatus: "Completed On Time", qualityReview: "Totally Correct", assignedTo: "team_qa" },
      { status: "Pending", completionStatus: "On Track", qualityReview: null, assignedTo: "team_frontend" },
    ] as any[];

    let completed = 0, pending = 0, late = 0;
    let totallyCorrect = 0, partiallyCorrect = 0, totallyWrong = 0;

    analyticsTasks.forEach(t => {
      if (getMappedStatus(t.status) === "Done") completed++;
      else pending++;

      if (t.completionStatus === "Late Completion") late++;

      if (t.qualityReview === "Totally Correct") totallyCorrect++;
      else if (t.qualityReview === "Partially Correct") partiallyCorrect++;
      else if (t.qualityReview === "Totally Wrong") totallyWrong++;
    });

    const hasStatus = (completed + pending + late) > 0;
    const statusData = hasStatus ? [
      { name: "Completed", value: completed, color: "#10B981" },
      { name: "Pending", value: pending, color: "#F59E0B" },
      { name: "Late", value: late, color: "#EF4444" },
    ].filter(d => d.value > 0) : [
      { name: "No Tasks", value: 1, color: "#e2e8f0" }
    ];

    const hasQuality = (totallyCorrect + partiallyCorrect + totallyWrong) > 0;
    const qualityData = hasQuality ? [
      { name: "Correct", value: totallyCorrect, color: "#3B82F6" }, // Blue
      { name: "Partial", value: partiallyCorrect, color: "#8B5CF6" }, // Purple
      { name: "Wrong", value: totallyWrong, color: "#EC4899" }, // Pink
    ].filter(d => d.value > 0) : [
      { name: "No Reviews", value: 1, color: "#e2e8f0" }
    ];

    // Calculate Team performance for the Bar Chart
    const allMembers = [{ id: user.uid, name: "Me", email: user.email }, ...teamMembers];
    const membersToMap = allMembers.length > 1 ? allMembers : TEAMS; // Fallback to TEAMS only if no real team members loaded yet

    const employeeStats = membersToMap.map((m: any) => {
      const memberId = m.uid || m.id;
      // Get real tasks assigned to employees in this team
      const eTasks = analyticsTasks.filter((t: any) => t.assignedTo === memberId);
      const eCompleted = eTasks.filter((t: any) => getMappedStatus(t.status) === "Done").length;
      const ePending = eTasks.length - eCompleted;
      
      const eCorrect = eTasks.filter((t: any) => t.qualityReview === "Totally Correct").length;
      const ePartial = eTasks.filter((t: any) => t.qualityReview === "Partially Correct").length;
      const eWrong = eTasks.filter((t: any) => t.qualityReview === "Totally Wrong").length;
      
      let perf = 0;
      if (eTasks.length > 0) {
        perf = Math.round((eCompleted / eTasks.length) * 100);
      } else {
        // If no real tasks exist, use a default value to keep graph visually populated if we're using mock data
        perf = tasks.length === 0 ? (70 + ((m.name || "A").length * 2) % 30) : 0; 
      }
      
      const shortName = m.name ? (m.name === "Me" ? "Me" : m.name.split(" ")[0]) : (m.email?.split("@")[0] || "User");
      
      return { 
        name: m.name || m.email, 
        shortName, 
        performance: perf,
        total: eTasks.length,
        completed: eCompleted,
        pending: ePending,
        correct: eCorrect,
        partial: ePartial,
        wrong: eWrong
      };
    }).sort((a: any, b: any) => b.performance - a.performance).slice(0, 8); // Limit to top 8 so chart doesn't overflow

    return { completed, pending, late, statusData, qualityData, employeeStats, total: analyticsTasks.length };
  }, [tasks, filterProject, teamMembers, user]);

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-xs min-w-[150px]">
          <p className="font-bold text-gray-800 mb-2 border-b border-gray-50 pb-1">{data.name}</p>
          <div className="space-y-1">
            <p className="flex justify-between"><span className="text-gray-500">Performance:</span> <span className="font-bold text-indigo-600">{data.performance}%</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Total Tasks:</span> <span className="font-medium text-gray-700">{data.total}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Completed:</span> <span className="font-medium text-green-600">{data.completed}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Pending:</span> <span className="font-medium text-amber-600">{data.pending}</span></p>
            <div className="h-px bg-gray-100 my-1"></div>
            <p className="flex justify-between"><span className="text-gray-500">Correct:</span> <span className="font-medium text-blue-500">{data.correct}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Partial:</span> <span className="font-medium text-purple-500">{data.partial}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Wrong:</span> <span className="font-medium text-pink-500">{data.wrong}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 px-4 py-2 md:px-6 md:py-3 lg:px-8 lg:py-4 max-w-[1600px] mx-auto w-full">

      {/* HEADER - CLEAN, NO BORDER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Team Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Manage tasks and view analytics for {user.department}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
          <div className="relative">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="pl-3 pr-8 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer appearance-none w-full md:w-[180px] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-10px)_center] bg-[length:16px]"
            >
              <option value="All">All Projects</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            {showAnalytics ? "Hide Analytics" : "View Analytics"}
          </button>
        </div>
      </div>

      {/* Analytics Section (Toggleable) */}
      {showAnalytics && (
        <div className="space-y-6 animate-[popup_0.2s_ease-out]">
          {/* Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Team Members", val: teamMembers.length, clr: "bg-blue-50 text-blue-700 border-blue-100" },
              { label: "Total Tasks", val: stats.total, clr: "bg-gray-50 text-gray-700 border-gray-200" },
              { label: "Completed", val: stats.completed, clr: "bg-green-50 text-green-700 border-green-100" },
              { label: "Pending", val: stats.pending, clr: "bg-yellow-50 text-yellow-700 border-yellow-100" },
              { label: "Late Tasks", val: stats.late, clr: "bg-red-50 text-red-700 border-red-100" },
            ].map(s => (
              <div key={s.label} className={`p-5 rounded-2xl shadow-sm border ${s.clr}`}>
                <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-80">{s.label}</h4>
                <p className="text-3xl font-extrabold">{s.val}</p>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Task Status
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={45} paddingAngle={2}>
                      {stats.statusData.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div> Task Quality
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.qualityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={0} paddingAngle={2}>
                      {stats.qualityData.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Team Performance
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.employeeStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortName" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="performance" radius={[4, 4, 0, 0]}>
                      {stats.employeeStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.performance >= 80 ? '#10B981' : entry.performance >= 50 ? '#F59E0B' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Task List (Data Grid) - Hidden when viewing analytics */}
      {!showAnalytics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-4 animate-[popup_0.2s_ease-out]">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
              <div className="relative flex-shrink-0">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search task, description..." 
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[13px] w-full sm:w-64 focus:outline-none focus:border-gray-300 focus:ring-0 text-gray-700 placeholder-gray-400 transition-colors" 
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                <button onClick={() => setFilterStatus("All")} className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${filterStatus === 'All' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>All ({baseFilteredTasks.length})</button>
                <button onClick={() => setFilterStatus("New")} className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${filterStatus === 'New' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>New ({baseFilteredTasks.filter((t:any) => getMappedStatus(t.status) === 'New').length})</button>
                <button onClick={() => setFilterStatus("Dev In Progress")} className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${filterStatus === 'Dev In Progress' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>Dev In Progress ({baseFilteredTasks.filter((t:any) => getMappedStatus(t.status) === 'Dev In Progress').length})</button>
                <button onClick={() => setFilterStatus("Testing")} className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${filterStatus === 'Testing' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>Testing ({baseFilteredTasks.filter((t:any) => getMappedStatus(t.status) === 'Testing').length})</button>
                <button onClick={() => setFilterStatus("Done")} className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${filterStatus === 'Done' ? 'bg-[#0f172a] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>Done ({baseFilteredTasks.filter((t:any) => getMappedStatus(t.status) === 'Done').length})</button>
              </div>
            
              <div className="relative flex-shrink-0 z-20 flex items-center gap-2">
                <select
                  value={filterTime}
                  onChange={(e: any) => {
                    setFilterTime(e.target.value);
                    if (e.target.value === "Custom") {
                      setShowCustomDatePopup(true);
                    } else {
                      setShowCustomDatePopup(false);
                    }
                  }}
                  className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer w-[130px]"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Month">This Month</option>
                  <option value="Custom">Custom Date</option>
                </select>

                {filterTime === "Custom" && (
                  <button 
                    onClick={() => setShowCustomDatePopup(!showCustomDatePopup)} 
                    className={`p-2 rounded-lg border transition-colors ${showCustomDatePopup ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    title="Edit Dates"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                )}

                {showCustomDatePopup && (
                  <div className="absolute top-full right-0 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col gap-3 w-64 animate-[popup_0.2s_ease-out]">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Custom Date Range</p>
                      <button onClick={() => setShowCustomDatePopup(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex-shrink-0">
                <select
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer appearance-none w-full md:w-[200px] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:calc(100%-8px)_center] bg-[length:14px]"
                >
                  <option value="All">All Team Members</option>
                  <option value={user.uid}>My Tasks</option>
                  {teamMembers.map((m: any) => (
                    <option key={m.id} value={m.uid || m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
          </div>

          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-500">Loading tasks...</p>
            </div>
          ) : (
            <div className="w-full pb-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-[12px] text-slate-500 whitespace-nowrap">
                    <th className="px-3 py-4 font-semibold">Task</th>
                    <th className="px-3 py-4 font-semibold">Assigned To</th>
                    <th className="px-3 py-4 font-semibold text-center">Priority</th>
                    <th className="px-3 py-4 font-semibold whitespace-nowrap text-center">Assigned At</th>
                    <th className="px-3 py-4 font-semibold whitespace-nowrap text-center">Deadline</th>
                    <th className="px-3 py-4 font-semibold whitespace-nowrap text-center">Completed At</th>
                    <th className="px-3 py-4 font-semibold text-center">Status</th>
                    <th className="px-3 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-[15px] text-slate-400 font-medium">
                        No tasks found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-3 py-3">
                          {(() => {
                            let dispName = t.projectName || t.project;
                            if (!dispName && t.projectId) {
                              const matchedProject = allProjects.find(p => p.id === t.projectId);
                              if (matchedProject) dispName = matchedProject.name;
                            }
                            return dispName ? (
                              <p className="text-[10px] font-bold text-blue-600 mb-0.5 tracking-wider uppercase">{dispName}</p>
                            ) : null;
                          })()}
                          <p className="text-sm font-semibold text-slate-800 break-words whitespace-normal line-clamp-2">{t.title || (t as any).taskName}</p>
                          <p className="text-[12px] text-slate-500 mt-0.5 break-words whitespace-normal line-clamp-1">{t.description}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-start gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0">
                              {t.assignedToName?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <span className="text-[13px] font-medium text-slate-700 truncate max-w-[150px]">{t.assignedToName || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
                            ${t.priority === 'High' || t.priority === 'Critical' ? 'text-red-700' : 
                              t.priority === 'Medium' ? 'text-yellow-700' : 
                              'text-blue-700'}`}>
                            {t.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-600 text-center">
                          {(() => {
                            const d = new Date(t.createdAt?.seconds * 1000 || Date.now());
                            return (
                              <div className="flex flex-col items-center justify-center">
                                <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-center">
                          {(() => {
                            const deadlineStr = (t as any).dueDate || (t as any).expectedCompletionDate;
                            if (!deadlineStr) return <span className="text-slate-400">-</span>;
                            const d = new Date(deadlineStr);
                            const isLate = d < new Date() && getMappedStatus(t.status) !== 'Done';
                            return (
                              <div className={`flex flex-col items-center justify-center ${isLate ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className={`text-[10px] whitespace-nowrap ${isLate ? 'text-red-500' : 'text-slate-400'}`}>{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-600 text-center">
                          {(() => {
                            if (getMappedStatus(t.status) !== 'Done' || !(t as any).updatedAt) return "-";
                            const d = new Date((t as any).updatedAt?.seconds * 1000 || Date.now());
                            return (
                              <div className="flex flex-col items-center justify-center">
                                <span className="whitespace-nowrap">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-[13px] font-bold px-3 py-1 rounded-full whitespace-nowrap
                              ${getMappedStatus(t.status) === 'Done' ? 'bg-emerald-100 text-emerald-700' : 
                                getMappedStatus(t.status) === 'Testing' ? 'bg-purple-100 text-purple-700' : 
                                getMappedStatus(t.status) === 'Dev In Progress' ? 'bg-amber-100 text-amber-700' : 
                                'bg-slate-100 text-slate-700'}`}>
                              {getDisplayStatus(t)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {getMappedStatus(t.status) === "Done" && !(t as any).qualityReview ? (
                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <ReviewDropdown onReview={(val: any) => handleReviewTask(t.id, val)} />
                            </div>
                          ) : (t as any).qualityReview ? (
                            <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold border
                              ${(t as any).qualityReview === 'Totally Correct' ? 'bg-green-50 text-green-700 border-green-200' : 
                                (t as any).qualityReview === 'Partially Correct' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                'bg-red-50 text-red-700 border-red-200'}`}>
                              {(t as any).qualityReview === 'Totally Correct' ? '✅ Correct' : (t as any).qualityReview === 'Partially Correct' ? '⚠️ Partial' : '❌ Wrong'}
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-400">---</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function ReviewDropdown({ onReview }: { onReview: (val: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex items-center justify-between gap-2 w-[135px] hover:bg-slate-50 transition-colors"
      >
        Review Quality...
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-[50] py-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
            <button 
              onClick={() => { onReview("Totally Correct"); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-green-50 text-green-700 font-bold text-xs transition-colors"
            >
              Correct
            </button>
            <button 
              onClick={() => { onReview("Partially Correct"); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-yellow-50 text-yellow-700 font-bold text-xs transition-colors"
            >
              Partial
            </button>
            <button 
              onClick={() => { onReview("Totally Wrong"); setOpen(false); }}
              className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-700 font-bold text-xs transition-colors"
            >
              Wrong
            </button>
          </div>
        </>
      )}
    </div>
  );
}
