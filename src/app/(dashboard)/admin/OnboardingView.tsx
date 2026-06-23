"use client";
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ONBOARDING_STAGES = [
  "Pre-Onboarding",
  "Day 1: Orientation",
  "Week 1: IT & Setup",
  "Month 1: Integration",
  "Completed"
];

const DEFAULT_CHECKLIST = {
  "Pre-Onboarding": [
    { id: "1", task: "Send Welcome Email", done: false },
    { id: "2", task: "Collect Documents", done: false },
    { id: "3", task: "Create Employee Email", done: false },
  ],
  "Day 1: Orientation": [
    { id: "4", task: "Office Tour / Intro", done: false },
    { id: "5", task: "Handover Laptop & Assets", done: false },
    { id: "6", task: "HR Policy Walkthrough", done: false },
  ],
  "Week 1: IT & Setup": [
    { id: "7", task: "Software Access Provisioning", done: false },
    { id: "8", task: "Role-specific Training Started", done: false },
    { id: "9", task: "Add to Payroll System", done: false },
  ],
  "Month 1: Integration": [
    { id: "10", task: "First 30-day Check-in", done: false },
    { id: "11", task: "Goal Setting for Quarter", done: false },
  ],
  "Completed": []
};

export default function OnboardingView({ user }: { user: any }) {
  const [onboardings, setOnboardings] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newHire, setNewHire] = useState({ name: "", email: "", role: "", startDate: "" });

  useEffect(() => {
    const q = query(collection(db, "onboardings"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setOnboardings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleStartOnboarding = async () => {
    if (!newHire.name || !newHire.role) return;
    await addDoc(collection(db, "onboardings"), {
      ...newHire,
      stage: "Pre-Onboarding",
      checklist: DEFAULT_CHECKLIST,
      createdBy: user.uid,
      createdAt: serverTimestamp()
    });
    setShowModal(false);
    setNewHire({ name: "", email: "", role: "", startDate: "" });
  };

  const toggleTask = async (onboardingId: string, stage: string, taskId: string, currentVal: boolean) => {
    const onboarding = onboardings.find(o => o.id === onboardingId);
    if (!onboarding) return;
    const updatedChecklist = { ...onboarding.checklist };
    updatedChecklist[stage] = updatedChecklist[stage].map((t: any) => t.id === taskId ? { ...t, done: !currentVal } : t);
    
    // Auto-advance stage logic (optional): if all tasks in a stage are done, it could prompt to move stage.
    await updateDoc(doc(db, "onboardings", onboardingId), { checklist: updatedChecklist });
  };

  const updateStage = async (id: string, newStage: string) => {
    await updateDoc(doc(db, "onboardings", id), { stage: newStage });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this onboarding record?")) {
      await deleteDoc(doc(db, "onboardings", id));
    }
  };

  return (
    <div style={{ padding: "30px", background: "#f8fafc", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Employee Onboarding</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Track new hires through their onboarding journey.</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)" }}>
          + Start Onboarding
        </button>
      </div>

      <div style={{ display: "flex", gap: "20px", overflowX: "auto", paddingBottom: "20px" }}>
        {ONBOARDING_STAGES.map(stage => {
          const stageRecords = onboardings.filter(o => o.stage === stage);
          return (
            <div key={stage} style={{ minWidth: "320px", maxWidth: "320px", background: "#f1f5f9", borderRadius: "16px", padding: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#334155", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stage}</h3>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748b", background: "#e2e8f0", padding: "2px 8px", borderRadius: "100px" }}>
                  {stageRecords.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {stageRecords.map(record => {
                  const tasks = record.checklist?.[stage] || [];
                  const completedTasks = tasks.filter((t: any) => t.done).length;
                  const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 100;
                  
                  return (
                    <div key={record.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <h4 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{record.name}</h4>
                        <button onClick={() => handleDelete(record.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: "16px" }}>×</button>
                      </div>
                      
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 4px 0", fontWeight: 600 }}>{record.role}</p>
                      <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 12px 0" }}>Start: {record.startDate}</p>
                      
                      {stage !== "Completed" && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, color: "#64748b", marginBottom: "4px", textTransform: "uppercase" }}>
                            <span>Progress</span>
                            <span>{completedTasks}/{tasks.length}</span>
                          </div>
                          <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "10px", overflow: "hidden" }}>
                            <div style={{ height: "100%", background: progress === 100 ? "#10b981" : "#4f46e5", width: `${progress}%`, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      )}

                      {tasks.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                          {tasks.map((t: any) => (
                            <label key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                              <input 
                                type="checkbox" 
                                checked={t.done} 
                                onChange={() => toggleTask(record.id, stage, t.id, t.done)}
                                style={{ marginTop: "2px", accentColor: "#4f46e5" }}
                              />
                              <span style={{ fontSize: "12px", color: t.done ? "#94a3b8" : "#475569", textDecoration: t.done ? "line-through" : "none", lineHeight: "1.3" }}>
                                {t.task}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Move to</span>
                        <select 
                          value={record.stage} 
                          onChange={e => updateStage(record.id, e.target.value)}
                          style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", color: "#4f46e5", fontWeight: 700 }}
                        >
                          {ONBOARDING_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {stageRecords.length === 0 && (
                  <div style={{ flex: 1, border: "2px dashed #cbd5e1", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px", fontWeight: 600, padding: "20px", textAlign: "center" }}>
                    No one in {stage}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: "500px", borderRadius: "20px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Start Onboarding</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}>×</button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>New Hire Name *</label>
                <input value={newHire.name} onChange={e => setNewHire({...newHire, name: e.target.value})} placeholder="e.g. Alex Johnson" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Role *</label>
                  <input value={newHire.role} onChange={e => setNewHire({...newHire, role: e.target.value})} placeholder="e.g. Marketing Manager" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Start Date</label>
                  <input type="date" value={newHire.startDate} onChange={e => setNewHire({...newHire, startDate: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Email</label>
                <input type="email" value={newHire.email} onChange={e => setNewHire({...newHire, email: e.target.value})} placeholder="Personal or company email" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
              </div>
            </div>
            
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleStartOnboarding} disabled={!newHire.name || !newHire.role} style={{ padding: "10px 20px", background: "#4f46e5", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", opacity: (!newHire.name || !newHire.role) ? 0.5 : 1 }}>Start Onboarding</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
