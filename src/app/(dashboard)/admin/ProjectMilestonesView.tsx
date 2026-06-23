"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string;
  status: "Pending" | "In Progress" | "Achieved";
  createdAt: any;
}

export default function ProjectMilestonesView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Milestone["status"]>("Pending");

  useEffect(() => {
    const fetchProjects = async () => {
      const pSnap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
      const pList = pSnap.docs.map(d => ({ id: d.id, name: d.data().name, color: d.data().color || "#534AB7" }));
      setProjects(pList);
      if (pList.length > 0) setSelectedProjectId(pList[0].id);
    };
    fetchProjects();
  }, []);

  const fetchMilestones = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const q = query(collection(db, "projectMilestones"), where("projectId", "==", selectedProjectId), orderBy("dueDate", "asc"));
      const snap = await getDocs(q);
      setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestones();
  }, [selectedProjectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;

    try {
      if (editId) {
        await updateDoc(doc(db, "projectMilestones", editId), {
          title, description, dueDate, status, updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "projectMilestones"), {
          projectId: selectedProjectId,
          title, description, dueDate, status, createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchMilestones();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this milestone?")) return;
    try {
      await deleteDoc(doc(db, "projectMilestones", id));
      fetchMilestones();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (m: Milestone) => {
    setEditId(m.id);
    setTitle(m.title);
    setDescription(m.description);
    setDueDate(m.dueDate);
    setStatus(m.status);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setStatus("Pending");
  };

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Milestone Tracking</h2>
          <p style={{ color: "#64748b", marginTop: 4 }}>Track major project phases and deliverables.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 600 }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            style={{ padding: "8px 16px", background: "#f97316", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Milestone
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading milestones...</div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1", color: "#94a3b8" }}>
          No milestones defined for this project.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {milestones.map(m => {
            const isLate = new Date(m.dueDate) < new Date() && m.status !== "Achieved";
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: m.status === "Achieved" ? "#dcfce7" : isLate ? "#fee2e2" : "#f1f5f9" }}>
                    {m.status === "Achieved" ? "🏆" : isLate ? "⚠️" : "🎯"}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{m.title}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{m.description}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Due Date</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isLate ? "#ef4444" : "#0f172a", marginTop: 2 }}>
                      {new Date(m.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Status</div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ 
                        padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: m.status === "Achieved" ? "#dcfce7" : m.status === "In Progress" ? "#dbeafe" : "#f1f5f9",
                        color: m.status === "Achieved" ? "#166534" : m.status === "In Progress" ? "#1e40af" : "#475569"
                      }}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(m)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>✏️</button>
                    <button onClick={() => handleDelete(m.id)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 400, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800 }}>{editId ? "Edit Milestone" : "New Milestone"}</h3>
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Due Date *</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Achieved">Achieved</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: "10px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#f97316", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
