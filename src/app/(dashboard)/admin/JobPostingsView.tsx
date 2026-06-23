"use client";
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function JobPostingsView({ user }: { user: any }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", department: "", location: "", type: "Full-Time", description: "", requirements: "", status: "Open" });

  useEffect(() => {
    const q = query(collection(db, "openJobs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleCreateJob = async () => {
    if (!newJob.title || !newJob.department) return;
    await addDoc(collection(db, "openJobs"), {
      ...newJob,
      createdBy: user.uid,
      createdAt: serverTimestamp()
    });
    setShowModal(false);
    setNewJob({ title: "", department: "", location: "", type: "Full-Time", description: "", requirements: "", status: "Open" });
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, "openJobs", id), { status: currentStatus === "Open" ? "Closed" : "Open" });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this job posting?")) {
      await deleteDoc(doc(db, "openJobs", id));
    }
  };

  return (
    <div style={{ padding: "30px", background: "#f8fafc", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Job Postings</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Manage open positions and career listings</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)" }}>
          + New Job Posting
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {jobs.map(job => (
          <div key={job.id} style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#1e293b", margin: 0 }}>{job.title}</h3>
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "100px", background: job.status === "Open" ? "#dcfce7" : "#f1f5f9", color: job.status === "Open" ? "#16a34a" : "#64748b" }}>
                {job.status}
              </span>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "6px", color: "#475569" }}>🏢 {job.department}</span>
              <span style={{ fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "6px", color: "#475569" }}>📍 {job.location || "Remote"}</span>
              <span style={{ fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "6px", color: "#475569" }}>⏱ {job.type}</span>
            </div>
            
            <p style={{ fontSize: "13px", color: "#64748b", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "20px", minHeight: "38px" }}>
              {job.description || "No description provided."}
            </p>

            <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
              <button onClick={() => toggleStatus(job.id, job.status)} style={{ flex: 1, padding: "8px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#475569", cursor: "pointer" }}>
                {job.status === "Open" ? "Close Job" : "Reopen Job"}
              </button>
              <button onClick={() => handleDelete(job.id)} style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#dc2626", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", background: "#fff", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
            <span style={{ fontSize: "32px", color: "#94a3b8", display: "block", marginBottom: "12px" }}>💼</span>
            <p style={{ color: "#64748b", margin: 0 }}>No job postings yet. Create one to start hiring!</p>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: "600px", borderRadius: "20px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Create Job Posting</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}>×</button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Job Title *</label>
                <input value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} placeholder="e.g. Senior Frontend Developer" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Department *</label>
                  <input value={newJob.department} onChange={e => setNewJob({...newJob, department: e.target.value})} placeholder="e.g. Engineering" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Location</label>
                  <input value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} placeholder="e.g. Remote, New York" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Employment Type</label>
                <select value={newJob.type} onChange={e => setNewJob({...newJob, type: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}>
                  <option>Full-Time</option>
                  <option>Part-Time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Description</label>
                <textarea value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} rows={4} placeholder="Brief description of the role..." style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", resize: "vertical" }} />
              </div>
            </div>
            
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreateJob} disabled={!newJob.title || !newJob.department} style={{ padding: "10px 20px", background: "#4f46e5", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", opacity: (!newJob.title || !newJob.department) ? 0.5 : 1 }}>Create Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
