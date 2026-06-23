"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function EmployeeDirectoryView() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, snap => {
      const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(usersList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const departments = useMemo(() => {
    const deps = new Set(employees.map(e => e.department).filter(Boolean));
    return ["All", ...Array.from(deps)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (departmentFilter !== "All" && emp.department !== departmentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (emp.name || "").toLowerCase().includes(q) ||
          (emp.email || "").toLowerCase().includes(q) ||
          (emp.skills || "").toLowerCase().includes(q) ||
          (emp.designation || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, search, departmentFilter]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#f8fafc] flex flex-col">
      {/* Header & Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
        <p className="text-sm text-slate-500 mt-1">Search colleagues by name, skills, or department.</p>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search names, skills, designation..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition text-sm text-slate-700"
            />
          </div>
          <select 
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-400 outline-none min-w-[200px]"
          >
            {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEmployees.map(emp => (
            <div key={emp.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 h-20 relative">
                <div className="absolute -bottom-10 left-6">
                  <div className="w-20 h-20 rounded-xl border-4 border-white bg-slate-100 overflow-hidden flex items-center justify-center text-2xl shadow-md">
                    {emp.profilePhoto ? (
                      <img src={emp.profilePhoto} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-slate-400">{emp.name?.charAt(0).toUpperCase() || "?"}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-12 pb-5 px-6 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 truncate">{emp.name || "Unnamed"}</h3>
                <p className="text-sm font-medium text-indigo-600 truncate">{emp.designation || "No Designation"}</p>
                <div className="mt-3 space-y-2 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.27 7.27c.883.883 2.317.883 3.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="truncate">{emp.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    <span className="truncate">{emp.department || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <span className="truncate">{emp.phone || "—"}</span>
                  </div>
                </div>
                {emp.skills && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap gap-1.5">
                      {emp.skills.split(",").slice(0, 3).map((skill: string, i: number) => (
                        skill.trim() && <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{skill.trim()}</span>
                      ))}
                      {emp.skills.split(",").length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded text-[10px] font-bold">+{emp.skills.split(",").length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredEmployees.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
              <span className="text-4xl mb-4 opacity-50">🔍</span>
              <h3 className="text-lg font-bold text-slate-700">No employees found</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
