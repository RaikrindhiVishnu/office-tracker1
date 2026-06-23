"use client";
import { useState, useEffect } from "react";
import { collection, query, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task } from "@/lib/kanbanUtils";

interface Project {
  id: string;
  name: string;
  color: string;
  budget: number;
}

export default function AdminProjectCostingView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState<number>(0);

  const RATE_PER_HOUR = 800; // Rs. 800/hr default rate

  const fetchData = async () => {
    setLoading(true);
    try {
      const pSnap = await getDocs(query(collection(db, "projects")));
      const pList = pSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        color: d.data().color || "#534AB7",
        budget: d.data().budget || 0,
      }));
      setProjects(pList);

      const tSnap = await getDocs(query(collection(db, "projectTasks")));
      const tMap: Record<string, Task[]> = {};
      tSnap.docs.forEach(d => {
        const t = d.data() as Task;
        if (!tMap[t.projectId]) tMap[t.projectId] = [];
        tMap[t.projectId].push({ ...t, id: d.id });
      });
      setTasks(tMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateBudget = async (projectId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), { budget: newBudget });
      setProjects(projects.map(p => p.id === projectId ? { ...p, budget: newBudget } : p));
      setEditingBudget(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Project Costing & Profitability</h2>
        <p style={{ color: "#64748b", marginTop: 4 }}>Monitor project budgets against actual time logged by resources.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Aggregating project financials...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {projects.map(p => {
            const pTasks = tasks[p.id] || [];
            const totalEstimatedHours = pTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
            const totalActualHours = pTasks.reduce((acc, t) => acc + (t.actualHours || 0), 0);

            const estimatedCost = totalEstimatedHours * RATE_PER_HOUR;
            const actualCost = totalActualHours * RATE_PER_HOUR;
            const budget = p.budget;
            const variance = budget - actualCost;
            const isOverBudget = variance < 0;

            return (
              <div key={p.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{p.name}</h3>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{pTasks.length} total tasks</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Allocated Budget</div>
                    {editingBudget === p.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <input 
                          type="number" 
                          value={newBudget} 
                          onChange={(e) => setNewBudget(Number(e.target.value))} 
                          style={{ padding: "4px 8px", width: 100, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                        <button onClick={() => handleUpdateBudget(p.id)} style={{ padding: "4px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button>
                        <button onClick={() => setEditingBudget(null)} style={{ padding: "4px 8px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                          ₹{budget.toLocaleString("en-IN")}
                        </div>
                        <button onClick={() => { setEditingBudget(p.id); setNewBudget(budget); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: 12 }}>✏️ Edit</button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Est. Total Hours</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{totalEstimatedHours}h</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Actual Logged Hours</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{totalActualHours}h</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Cost Incurred (₹{RATE_PER_HOUR}/hr)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>₹{actualCost.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ background: isOverBudget ? "#fef2f2" : "#f0fdf4", padding: 16, borderRadius: 8, border: `1px solid ${isOverBudget ? "#fecaca" : "#bbf7d0"}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isOverBudget ? "#ef4444" : "#16a34a" }}>Profit / Variance</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isOverBudget ? "#dc2626" : "#16a34a", marginTop: 4 }}>
                      {isOverBudget ? "-" : "+"}₹{Math.abs(variance).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
                    <span>Budget Consumption</span>
                    <span>{budget > 0 ? ((actualCost / budget) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(budget > 0 ? (actualCost / budget) * 100 : 0, 100)}%`, background: isOverBudget ? "#ef4444" : p.color, borderRadius: 4 }} />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
