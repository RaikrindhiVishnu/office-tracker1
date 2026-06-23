"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function OrgChartView() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const { rootNodes, childrenMap } = useMemo(() => {
    const map: Record<string, any[]> = {};
    const roots: any[] = [];
    
    employees.forEach(emp => {
      // Use email as unique identifier or ID.
      // reportingTo holds ID. If no reportingTo or reportingTo is empty/not found, it's a root.
      const managerId = emp.reportingTo;
      if (!managerId) {
        roots.push(emp);
      } else {
        if (!map[managerId]) map[managerId] = [];
        map[managerId].push(emp);
      }
    });
    
    // Fallback: If roots are empty but we have employees (e.g. everyone reports to someone but the root is missing), we might need to handle circular or missing managers.
    // For simplicity, any employee whose reportingTo ID doesn't exist in our array becomes a root.
    const allIds = new Set(employees.map(e => e.id));
    const finalRoots: any[] = [];
    employees.forEach(emp => {
      if (!emp.reportingTo || !allIds.has(emp.reportingTo)) {
        finalRoots.push(emp);
      }
    });

    return { rootNodes: finalRoots, childrenMap: map };
  }, [employees]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading organization structure...</div>;

  const renderNode = (node: any) => {
    const children = childrenMap[node.id] || [];
    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col items-center min-w-[160px] relative z-10 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden mb-3">
            {node.profilePhoto ? (
              <img src={node.profilePhoto} alt={node.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-700 font-bold">
                {node.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-800 text-center leading-tight mb-1">{node.name || "Unnamed"}</h4>
          <p className="text-[10px] font-bold text-indigo-600 text-center uppercase tracking-wider">{node.designation || "Employee"}</p>
          {node.department && <p className="text-[10px] text-slate-500 text-center mt-1 bg-slate-50 px-2 py-0.5 rounded">{node.department}</p>}
        </div>

        {/* Children */}
        {children.length > 0 && (
          <div className="relative flex flex-col items-center pt-6 mt-0">
            {/* Vertical Line from parent */}
            <div className="absolute top-0 w-px h-6 bg-slate-300"></div>
            
            {/* Horizontal Line connecting children */}
            <div className="flex justify-center relative">
              {children.length > 1 && (
                <div className="absolute top-0 h-px bg-slate-300" style={{ 
                  left: "calc(50% / " + children.length + ")", 
                  right: "calc(50% / " + children.length + ")" 
                }}></div>
              )}
              
              <div className="flex gap-6">
                {children.map(child => (
                  <div key={child.id} className="relative pt-6">
                    {/* Vertical Line to child */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-slate-300"></div>
                    {renderNode(child)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-20">
        <h1 className="text-2xl font-bold text-slate-800">Organization Chart</h1>
        <p className="text-sm text-slate-500 mt-1">Visual hierarchy of company structure.</p>
      </div>

      <div className="flex-1 overflow-auto p-12">
        <div className="min-w-max flex justify-center pb-20">
          <div className="flex gap-12">
            {rootNodes.map(root => renderNode(root))}
          </div>
          {rootNodes.length === 0 && (
            <div className="text-center text-slate-500 py-12">No organizational data found. Ensure "Reporting To" is set in employee profiles.</div>
          )}
        </div>
      </div>
    </div>
  );
}
