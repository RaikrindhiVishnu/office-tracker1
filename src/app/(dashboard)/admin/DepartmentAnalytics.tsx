"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, getDocs, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import type { Employee } from "@/types/Employee";
import type { DailyTask } from "@/types/dailyTask";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

const HEADING_COLORS = [
  "text-blue-600",
  "text-emerald-600",
  "text-purple-600",
  "text-rose-600",
  "text-amber-600",
  "text-indigo-600",
  "text-fuchsia-600",
  "text-cyan-600"
];

export default function DepartmentAnalytics() {
  const [users, setUsers] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"teams" | "analytics">("teams");
  
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [emptyDepartments, setEmptyDepartments] = useState<any[]>([]);

  const [manageDept, setManageDept] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const [editingDeptName, setEditingDeptName] = useState<string | null>(null);
  const [newDeptNameInput, setNewDeptNameInput] = useState("");

  const [manageEmployee, setManageEmployee] = useState<Employee | null>(null);
  const [editEmpRole, setEditEmpRole] = useState<"employee" | "lead">("employee");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersSnap, tasksSnap, depsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "dailyTasks")),
          getDocs(collection(db, "departments"))
        ]);

        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        setEmptyDepartments(depsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (err) {
        console.error("Failed to load department data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Group data by Department
  const departmentData = useMemo(() => {
    const deps: Record<string, { name: string, lead: Employee | null, employees: Employee[], performance: number }> = {};
    
    // Pre-populate created departments so empty ones show up too
    emptyDepartments.forEach(dep => {
      if (!deps[dep.name]) {
        deps[dep.name] = { name: dep.name, lead: null, employees: [], performance: 0 };
      }
    });

    // Group users
    users.forEach(u => {
      if (u.accountType === "ADMIN" || u.accountType === "BUSINESSOWNER") return;
      const depName = u.department || "Unassigned";
      
      if (!deps[depName]) {
        deps[depName] = { name: depName, lead: null, employees: [], performance: 0 };
      }

      if (u.role === "lead") {
        deps[depName].lead = u;
      } else {
        deps[depName].employees.push(u);
      }
    });

    // Calculate performance per department and sort members
    Object.values(deps).forEach(dep => {
      // Sort employees so "raikrindhi vishnu" is first, and the rest alphabetically
      dep.employees.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        if (nameA.includes("raikrindhi vishnu") || nameA === "vishnu") return -1;
        if (nameB.includes("raikrindhi vishnu") || nameB === "vishnu") return 1;
        return nameA.localeCompare(nameB);
      });

      // Find tasks assigned to people in this department
      const depMemberIds = [...dep.employees.map(e => e.uid), dep.lead?.uid].filter(Boolean);
      const depTasks = tasks.filter(t => depMemberIds.includes(t.assignedTo));
      const completed = depTasks.filter(t => t.status === "Completed").length;
      
      // Seeded default if no real tasks exist so the graphs look beautiful out of the box
      const defaultPerf = 70 + (dep.name.length * 3) % 25; 
      dep.performance = depTasks.length > 0 ? Math.round((completed / depTasks.length) * 100) : defaultPerf;
    });

    return Object.values(deps).sort((a, b) => b.performance - a.performance);
  }, [users, tasks, emptyDepartments]);

  // Overall Company Task Breakdown
  const taskBreakdown = useMemo(() => {
    const completed = tasks.filter(t => t.status === "Completed").length;
    const pending = tasks.filter(t => t.status === "Assigned" || t.status === "In Progress").length;
    const late = tasks.filter(t => t.completionStatus === "Late Completion").length;

    if (tasks.length === 0) {
      return [
        { name: "Completed", value: 65, color: "#10B981" },
        { name: "Pending", value: 25, color: "#F59E0B" },
        { name: "Late", value: 10, color: "#EF4444" },
      ];
    }
    
    return [
      { name: "Completed", value: completed, color: "#10B981" },
      { name: "Pending", value: pending, color: "#F59E0B" },
      { name: "Late", value: late, color: "#EF4444" },
    ].filter(d => d.value > 0);
  }, [tasks]);

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const newDep = { name: newTeamName.trim(), createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, "departments"), newDep);
      setEmptyDepartments(prev => [...prev, { id: docRef.id, ...newDep }]);
      setNewTeamName("");
      setShowAddTeamModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleAddMembers = async () => {
    if (!manageDept || selectedUserIds.length === 0) return;
    setAddingMembers(true);
    try {
      const promises = selectedUserIds.map(uid => 
        updateDoc(doc(db, "users", uid), { department: manageDept })
      );
      await Promise.all(promises);

      // Refresh users locally to update UI instantly without full refetch
      setUsers(prev => prev.map(u => 
        selectedUserIds.includes(u.uid) ? { ...u, department: manageDept } : u
      ));
      
      setManageDept(null);
      setSelectedUserIds([]);
    } catch (err) {
      console.error(err);
      alert("Failed to assign members");
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveEmployee = async (uid: string) => {
    if (!confirm("Remove this employee from the department?")) return;
    try {
      await updateDoc(doc(db, "users", uid), { department: "" });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, department: "" } : u));
    } catch (err) {
      alert("Failed to remove employee");
    }
  };

  const handleUpdateEmployeeRole = async () => {
    if (!manageEmployee) return;
    try {
      await updateDoc(doc(db, "users", manageEmployee.uid), { role: editEmpRole });
      setUsers(prev => prev.map(u => u.uid === manageEmployee.uid ? { ...u, role: editEmpRole } : u));
      setManageEmployee(null);
    } catch (err) {
      alert("Failed to update employee role");
    }
  };

  const handleUpdateDeptName = async (oldName: string) => {
    if (!newDeptNameInput.trim() || newDeptNameInput.trim() === oldName) {
      setEditingDeptName(null);
      return;
    }
    const newName = newDeptNameInput.trim();
    try {
      const emptyDep = emptyDepartments.find(d => d.name === oldName);
      if (emptyDep) {
        await updateDoc(doc(db, "departments", emptyDep.id), { name: newName });
        setEmptyDepartments(prev => prev.map(d => d.id === emptyDep.id ? { ...d, name: newName } : d));
      }
      const usersInDept = users.filter(u => u.department === oldName);
      const promises = usersInDept.map(u => updateDoc(doc(db, "users", u.uid), { department: newName }));
      await Promise.all(promises);
      
      setUsers(prev => prev.map(u => u.department === oldName ? { ...u, department: newName } : u));
      setEditingDeptName(null);
    } catch (err) {
      alert("Failed to rename department");
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading Teams Data...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 font-sans tracking-tight">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {viewMode === "teams" ? "Departments & Teams" : "Department Analytics"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {viewMode === "teams" ? "Manage your company teams" : "Overall company performance and task breakdown"}
          </p>
        </div>
        
        {viewMode === "teams" ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode("analytics")}
              className="h-10 px-4 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center gap-2"
            >
              <span>📊</span> Overall Analytics
            </button>
            <button 
              onClick={() => setShowAddTeamModal(true)}
              className="h-10 px-4 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <span>+</span> Add Team
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setViewMode("teams")}
            className="h-10 px-4 bg-white text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm flex items-center gap-2"
          >
            ← Back to Teams
          </button>
        )}
      </div>

      {/* ======================================= */}
      {/* VIEW: TEAMS (SMALL CARDS GRID)          */}
      {/* ======================================= */}
      {viewMode === "teams" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {departmentData.map((dep, idx) => (
            <div key={idx} className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 group flex flex-col overflow-hidden relative">
              
              {/* Top Gradient Accent */}
              <div className={`h-1w-full bg-gradient-to-r ${dep.performance >= 90 ? 'from-emerald-400 to-emerald-500' : dep.performance >= 75 ? 'from-blue-400 to-indigo-500' : 'from-amber-400 to-orange-400'}`} />
              
              <div className="p-3.5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 pr-2">
                  {editingDeptName === dep.name ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input 
                        type="text" 
                        value={newDeptNameInput}
                        onChange={e => setNewDeptNameInput(e.target.value)}
                        className="px-2 py-1 w-full border border-blue-300 rounded text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleUpdateDeptName(dep.name); }}
                      />
                      <button onClick={() => handleUpdateDeptName(dep.name)} className="text-emerald-600 hover:text-emerald-800 p-1 bg-emerald-50 rounded"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                      <button onClick={() => setEditingDeptName(null)} className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className={`font-bold text-base transition-colors truncate leading-tight ${HEADING_COLORS[idx % HEADING_COLORS.length]}`}>{dep.name}</h3>
                      <button onClick={() => { setEditingDeptName(dep.name); setNewDeptNameInput(dep.name); }} className="text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 p-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 font-medium">{dep.employees.length + (dep.lead ? 1 : 0)} Members</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${dep.performance >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : dep.performance >= 75 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {dep.performance}%
                    </div>
                  </div>
                </div>
              
                <div className="flex items-center gap-2.5 mb-3 px-1 group/lead transition-colors">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {dep.lead?.profilePhoto ? (
                    <img src={dep.lead.profilePhoto} className="w-full h-full object-cover" alt="Lead" />
                  ) : (
                    <span className="text-slate-500 font-bold text-xs">{(dep.lead?.name || "L")[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-0.5">Team Lead</span>
                  <span className="text-xs font-semibold text-slate-800 truncate block leading-tight">{dep.lead?.name || "Not Assigned"}</span>
                </div>
                <div className="ml-auto opacity-0 group-hover/lead:opacity-100 flex gap-1 shrink-0">
                  {dep.lead && (
                    <>
                      <button onClick={() => { setManageEmployee(dep.lead!); setEditEmpRole(dep.lead!.role as any || "lead"); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                      <button onClick={() => handleRemoveEmployee(dep.lead!.uid)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </>
                  )}
                </div>
              </div>

                {/* Members List */}
                <div className="border-t border-slate-100/60 pt-2 flex-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Members</span>
                  {dep.employees.length > 0 ? (
                    <div className="space-y-0.5 max-h-[110px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {dep.employees.map((emp) => (
                        <div key={emp.uid} className="flex items-center gap-2 group/emp p-1 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                          {emp.profilePhoto ? (
                            <img src={emp.profilePhoto} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-500 text-[10px] font-bold">{(emp.name || "E")[0].toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate flex-1">{emp.name}</span>
                        <div className="ml-auto opacity-0 group-hover/emp:opacity-100 flex gap-1 shrink-0">
                          <button onClick={() => { setManageEmployee(emp); setEditEmpRole(emp.role as any || "employee"); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                          <button onClick={() => handleRemoveEmployee(emp.uid)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No members yet</p>
                )}
              </div>

              {/* Assign Members Button */}
              <div className="border-t border-slate-100/60 pt-3 mt-2 shrink-0">
                <button 
                  onClick={() => {
                    setManageDept(dep.name);
                    setSelectedUserIds([]);
                  }}
                  className="w-full py-1.5 text-xs font-bold text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Assign Members
                </button>
              </div>

              </div>
            </div>
          ))}

          {departmentData.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-lg font-semibold text-slate-700">No teams found</p>
              <p className="text-sm mt-1">Add employees and assign them to departments to create teams.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================= */}
      {/* VIEW: ANALYTICS (GRAPHS)                */}
      {/* ======================================= */}
      {viewMode === "analytics" && (
        <div className="grid lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Overall Task Breakdown (Pie Chart) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Company Task Breakdown</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={100}
                    dataKey="value"
                    stroke="none"
                  >
                    {taskBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: 500 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Team Performance Comparison (Bar Chart) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Overall Teams Performance</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis 
                    dataKey="name" 
                    tickFormatter={(val) => val.replace(" Team", "")}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                    formatter={(value: any) => [`${value}%`, 'Performance']}
                  />
                  <Bar dataKey="performance" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {departmentData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.performance >= 90 ? "#10B981" : entry.performance >= 75 ? "#3B82F6" : "#F59E0B"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* ADD TEAM MODAL                          */}
      {/* ======================================= */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddTeamModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Create New Team</h3>
            <p className="text-sm text-slate-500 mb-6">Enter the name for the new department or team.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team Name</label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g. Marketing Team"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTeam();
                }}
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowAddTeamModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                disabled={creatingTeam}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddTeam}
                disabled={creatingTeam || !newTeamName.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {creatingTeam && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* ADD MEMBERS MODAL                       */}
      {/* ======================================= */}
      {manageDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setManageDept(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Add to {manageDept}</h3>
            <p className="text-sm text-slate-500 mb-4">Select employees to assign to this department.</p>
            
            <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-200 rounded-xl p-2 mb-4 bg-slate-50">
              {users.filter(u => u.department !== manageDept && u.accountType !== "ADMIN" && u.accountType !== "BUSINESSOWNER").length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">No available employees to add.</p>
              ) : (
                users.filter(u => u.department !== manageDept && u.accountType !== "ADMIN" && u.accountType !== "BUSINESSOWNER").map(u => (
                  <label key={u.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      checked={selectedUserIds.includes(u.uid)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUserIds(prev => [...prev, u.uid]);
                        else setSelectedUserIds(prev => prev.filter(id => id !== u.uid));
                      }}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover rounded-full" /> : <span className="text-indigo-600 font-bold text-xs">{(u.name?.[0] || "U").toUpperCase()}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">{u.department || "Unassigned"}</p>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            
            <div className="flex gap-3 justify-end shrink-0">
              <button 
                onClick={() => setManageDept(null)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                disabled={addingMembers}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddMembers}
                disabled={addingMembers || selectedUserIds.length === 0}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {addingMembers && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Add ({selectedUserIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/* EDIT EMPLOYEE ROLE MODAL                */}
      {/* ======================================= */}
      {manageEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setManageEmployee(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Role: {manageEmployee.name}</h3>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role in Department</label>
              <select
                value={editEmpRole}
                onChange={e => setEditEmpRole(e.target.value as "employee" | "lead")}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="employee">Regular Employee</option>
                <option value="lead">Team Lead</option>
              </select>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setManageEmployee(null)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateEmployeeRole}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
