"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task } from "@/lib/kanbanUtils";

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function ProjectGanttChart() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"Day" | "Week" | "Month">("Day");

  useEffect(() => {
    const fetchProjects = async () => {
      const pSnap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
      const pList = pSnap.docs.map(d => ({ id: d.id, name: d.data().name, color: d.data().color || "#534AB7" }));
      setProjects(pList);
      if (pList.length > 0) setSelectedProjectId(pList[0].id);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "projectTasks"), where("projectId", "==", selectedProjectId));
        const snap = await getDocs(q);
        const tList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(tList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [selectedProjectId]);

  const { minDate, maxDate, dates, dayWidth } = useMemo(() => {
    if (tasks.length === 0) return { minDate: new Date(), maxDate: new Date(), dates: [], dayWidth: 40 };
    
    let minT = new Date().getTime();
    let maxT = new Date().getTime();

    tasks.forEach(t => {
      const s = t.startDate ? new Date(t.startDate).getTime() : new Date(t.createdAt?.toDate?.() || Date.now()).getTime();
      const e = t.dueDate ? new Date(t.dueDate).getTime() : s + 86400000;
      if (s < minT) minT = s;
      if (e > maxT) maxT = e;
    });

    const mDate = new Date(minT);
    mDate.setDate(mDate.getDate() - 3); // Padding
    const mxDate = new Date(maxT);
    mxDate.setDate(mxDate.getDate() + 5);

    const dts = [];
    for (let d = new Date(mDate); d <= mxDate; d.setDate(d.getDate() + 1)) {
      dts.push(new Date(d));
    }

    return { minDate: mDate, maxDate: mxDate, dates: dts, dayWidth: viewMode === "Day" ? 40 : viewMode === "Week" ? 15 : 5 };
  }, [tasks, viewMode]);

  const getTaskStyle = (t: Task) => {
    const start = t.startDate ? new Date(t.startDate) : new Date(t.createdAt?.toDate?.() || Date.now());
    const end = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + 86400000);
    
    if (end < start) end.setTime(start.getTime() + 86400000);

    const diffStart = (start.getTime() - minDate.getTime()) / 86400000;
    const diffDur = (end.getTime() - start.getTime()) / 86400000 + 1;

    return {
      left: diffStart * dayWidth,
      width: diffDur * dayWidth,
    };
  };

  const handleTaskClick = (taskId: string) => {
    // Navigate to task details or open modal (omitted for simplicity, but could be added)
    console.log("Clicked task", taskId);
  };

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Project Gantt Chart</h2>
          <p style={{ color: "#64748b", marginTop: 4 }}>Visualize project timelines and dependencies.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value as any)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            <option value="Day">Day View</option>
            <option value="Week">Week View</option>
            <option value="Month">Month View</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading timeline...</div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1", color: "#94a3b8" }}>
          No tasks found for this project.
        </div>
      ) : (
        <div style={{ flex: 1, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", display: "flex", overflow: "hidden" }}>
          
          {/* Left panel: Task List */}
          <div style={{ width: 250, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
            <div style={{ height: 40, borderBottom: "1px solid #e2e8f0", padding: "10px 16px", fontWeight: 700, fontSize: 13, color: "#475569" }}>
              Tasks ({tasks.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {tasks.map((t, i) => (
                <div key={t.id} style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 500, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.title}
                </div>
              ))}
            </div>
          </div>

          {/* Right panel: Timeline */}
          <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header / Dates */}
            <div style={{ height: 40, borderBottom: "1px solid #e2e8f0", display: "flex", background: "#f8fafc" }}>
              {dates.map((d, i) => (
                <div key={i} style={{ width: dayWidth, minWidth: dayWidth, borderRight: "1px solid #e2e8f0", textAlign: "center", padding: "10px 0", fontSize: 10, fontWeight: 600, color: "#64748b" }}>
                  {viewMode === "Day" ? d.getDate() : viewMode === "Week" && d.getDay() === 1 ? `${d.getDate()}/${d.getMonth()+1}` : ""}
                </div>
              ))}
            </div>

            {/* Grid & Bars */}
            <div style={{ flex: 1, position: "relative", overflowY: "auto" }}>
              {/* Background grid lines */}
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, display: "flex" }}>
                {dates.map((d, i) => (
                  <div key={i} style={{ width: dayWidth, minWidth: dayWidth, borderRight: "1px solid #f1f5f9", height: "100%", background: d.getDay() === 0 || d.getDay() === 6 ? "#f8fafc" : "transparent" }} />
                ))}
              </div>

              {/* Task rows */}
              <div style={{ position: "relative" }}>
                {tasks.map((t, i) => {
                  const style = getTaskStyle(t);
                  const isDone = t.status === "done";
                  return (
                    <div key={t.id} style={{ height: 40, borderBottom: "1px solid #e2e8f0", position: "relative", zIndex: 10 }}>
                      <div 
                        onClick={() => handleTaskClick(t.id)}
                        style={{
                          position: "absolute",
                          top: 8,
                          height: 24,
                          ...style,
                          background: isDone ? "#10b981" : "#3b82f6",
                          borderRadius: 4,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 8px",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {style.width > 50 && t.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
