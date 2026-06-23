"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams } from "next/navigation";

export default function ClientPortal() {
  const { projectId } = useParams() as { projectId: string };
  const [project, setProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const pSnap = await getDoc(doc(db, "projects", projectId));
        if (pSnap.exists()) {
          setProject({ id: pSnap.id, ...pSnap.data() });
          const mSnap = await getDocs(query(collection(db, "projectMilestones"), where("projectId", "==", projectId), orderBy("dueDate", "asc")));
          setMilestones(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (projectId) loadData();
  }, [projectId]);

  if (loading) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>Loading client portal...</div>;
  }

  if (!project) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>Project not found or access denied.</div>;
  }

  const progress = project.progress || 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: project.color || "#534AB7", color: "#fff", padding: "40px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>{project.name}</h1>
        <p style={{ fontSize: 16, opacity: 0.9, marginTop: 8 }}>Client Status Portal</p>
      </header>

      <main style={{ maxWidth: 800, margin: "-20px auto 40px", padding: "0 24px" }}>
        {/* Progress Card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Overall Progress</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, height: 12, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: project.color || "#534AB7", borderRadius: 6 }} />
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: project.color || "#534AB7" }}>{progress}%</span>
          </div>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 16 }}>{project.description}</p>
        </div>

        {/* Milestones Card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Project Milestones</h2>
          
          {milestones.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No milestones defined for this project.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {milestones.map((m, i) => {
                const isAchieved = m.status === "Achieved";
                return (
                  <div key={m.id} style={{ display: "flex", gap: 16, opacity: isAchieved ? 0.7 : 1 }}>
                    <div style={{ width: 2, background: i === milestones.length - 1 ? "transparent" : "#e2e8f0", position: "relative", marginTop: 24 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: isAchieved ? "#22c55e" : "#cbd5e1", position: "absolute", top: -24, left: -7, border: "3px solid #fff" }} />
                    </div>
                    <div style={{ flex: 1, background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", textDecoration: isAchieved ? "line-through" : "none" }}>{m.title}</h3>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: isAchieved ? "#dcfce7" : m.status === "In Progress" ? "#dbeafe" : "#f1f5f9", color: isAchieved ? "#166534" : m.status === "In Progress" ? "#1e40af" : "#475569" }}>
                          {m.status}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{m.description}</p>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginTop: 12 }}>
                        Target: {new Date(m.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
