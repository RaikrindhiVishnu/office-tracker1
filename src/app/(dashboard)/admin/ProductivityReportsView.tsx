"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee } from "@/types/Employee";

interface ProductivityData {
  uid: string;
  name: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  tasksCompleted: number;
  projectsContributed: Set<string>;
}

export default function ProductivityReportsView() {
  const [data, setData] = useState<ProductivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthStr, setMonthStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [users, setUsers] = useState<Employee[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    };
    fetchUsers();
  }, []);

  const loadReport = async () => {
    if (!users.length) return;
    setLoading(true);
    try {
      const q = query(collection(db, "dailySheets"), where("monthStr", "==", monthStr));
      const snap = await getDocs(q);
      
      const statsMap: Record<string, ProductivityData> = {};
      users.forEach(u => {
        if (u.accountType === "EMPLOYEE") {
          statsMap[u.id] = { uid: u.id, name: u.name || u.email, totalHours: 0, billableHours: 0, nonBillableHours: 0, tasksCompleted: 0, projectsContributed: new Set() };
        }
      });

      snap.docs.forEach(doc => {
        const entry = doc.data();
        const uid = entry.uid;
        if (!statsMap[uid]) return;
        
        if (entry.tasks && entry.tasks.length > 0) {
          entry.tasks.forEach((t: any) => {
            const hrs = Number(t.hours) || 0;
            statsMap[uid].totalHours += hrs;
            if (t.isBillable !== false) statsMap[uid].billableHours += hrs;
            else statsMap[uid].nonBillableHours += hrs;
            if (t.project) statsMap[uid].projectsContributed.add(t.project);
            if (t.status === "Done" || t.status === "Completed") statsMap[uid].tasksCompleted++;
          });
        } else {
          const hrs = Number(entry.hours) || 0;
          statsMap[uid].totalHours += hrs;
          statsMap[uid].billableHours += hrs;
          if (entry.project) statsMap[uid].projectsContributed.add(entry.project);
          if (entry.status === "Done") statsMap[uid].tasksCompleted++;
        }
      });

      setData(Object.values(statsMap).sort((a, b) => b.totalHours - a.totalHours));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (users.length > 0) loadReport();
  }, [monthStr, users]);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Productivity Reports</h2>
          <p style={{ color: "#64748b", marginTop: 4 }}>Analyze team performance, billable vs non-billable hours.</p>
        </div>
        <div>
          <input 
            type="month" 
            value={monthStr} 
            onChange={e => setMonthStr(e.target.value)} 
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading report data...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <tr>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Employee</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Hours</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: "#2563eb" }}>Billable Hrs</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: "#64748b" }}>Non-Billable</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Tasks Completed</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Projects</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.uid} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{d.name}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800 }}>{d.totalHours.toFixed(1)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{d.billableHours.toFixed(1)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#64748b" }}>{d.nonBillableHours.toFixed(1)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{d.tasksCompleted}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>
                    {Array.from(d.projectsContributed).join(", ") || "—"}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No data found for this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
