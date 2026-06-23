"use client";
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STAGES = ["Applied", "Phone Screen", "Interview", "Offer", "Hired", "Rejected"];

export default function RecruitmentView({ user }: { user: any }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [newCandidate, setNewCandidate] = useState({ name: "", email: "", phone: "", jobId: "", stage: "Applied", notes: "" });
  const [interviewDetails, setInterviewDetails] = useState({ date: "", time: "", interviewer: "", link: "" });
  const [offerDetails, setOfferDetails] = useState({ salary: "", startDate: "", expiryDate: "" });

  useEffect(() => {
    const q = query(collection(db, "candidates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    getDocs(query(collection(db, "openJobs"))).then(snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return unsub;
  }, []);

  const handleAddCandidate = async () => {
    if (!newCandidate.name || !newCandidate.jobId) return;
    await addDoc(collection(db, "candidates"), {
      ...newCandidate,
      createdBy: user.uid,
      createdAt: serverTimestamp()
    });
    setShowModal(false);
    setNewCandidate({ name: "", email: "", phone: "", jobId: "", stage: "Applied", notes: "" });
  };

  const updateStage = async (id: string, newStage: string) => {
    await updateDoc(doc(db, "candidates", id), { stage: newStage });
  };

  const handleScheduleInterview = async () => {
    if (!selectedCandidate) return;
    await updateDoc(doc(db, "candidates", selectedCandidate.id), { 
      interview: interviewDetails,
      stage: "Interview" 
    });
    setShowInterviewModal(false);
    setSelectedCandidate(null);
    setInterviewDetails({ date: "", time: "", interviewer: "", link: "" });
  };

  const handleSendOffer = async () => {
    if (!selectedCandidate) return;
    await updateDoc(doc(db, "candidates", selectedCandidate.id), { 
      offer: offerDetails,
      stage: "Offer" 
    });
    setShowOfferModal(false);
    setSelectedCandidate(null);
    setOfferDetails({ salary: "", startDate: "", expiryDate: "" });
    alert(`Offer letter generated and sent to ${selectedCandidate.name}!`);
  };

  return (
    <div style={{ padding: "30px", background: "#f8fafc", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Candidate Tracking (ATS)</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>Manage recruitment pipeline and applicant stages</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)" }}>
          + Add Candidate
        </button>
      </div>

      <div style={{ display: "flex", gap: "20px", overflowX: "auto", paddingBottom: "20px" }}>
        {STAGES.map(stage => (
          <div key={stage} style={{ minWidth: "300px", background: "#f1f5f9", borderRadius: "16px", padding: "16px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#334155", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stage}</h3>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748b", background: "#e2e8f0", padding: "2px 8px", borderRadius: "100px" }}>
                {candidates.filter(c => c.stage === stage).length}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {candidates.filter(c => c.stage === stage).map(candidate => {
                const job = jobs.find(j => j.id === candidate.jobId);
                return (
                  <div key={candidate.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <h4 style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{candidate.name}</h4>
                      <select 
                        value={candidate.stage} 
                        onChange={e => updateStage(candidate.id, e.target.value)}
                        style={{ fontSize: "11px", padding: "2px 4px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", color: "#475569" }}
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0", fontWeight: 600 }}>{job?.title || "Unknown Job"}</p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "12px", color: "#475569" }}>📧 {candidate.email || "No email"}</span>
                      <span style={{ fontSize: "12px", color: "#475569" }}>📱 {candidate.phone || "No phone"}</span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                      <button onClick={() => { setSelectedCandidate(candidate); setShowInterviewModal(true); }} style={{ flex: 1, padding: "6px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#2563eb", cursor: "pointer" }}>
                        Schedule
                      </button>
                      <button onClick={() => { setSelectedCandidate(candidate); setShowOfferModal(true); }} style={{ flex: 1, padding: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#16a34a", cursor: "pointer" }}>
                        Send Offer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: "500px", borderRadius: "20px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Add Candidate</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}>×</button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Candidate Name *</label>
                <input value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} placeholder="e.g. Jane Smith" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Job Applied For *</label>
                <select value={newCandidate.jobId} onChange={e => setNewCandidate({...newCandidate, jobId: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}>
                  <option value="">Select a Job</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Email</label>
                  <input type="email" value={newCandidate.email} onChange={e => setNewCandidate({...newCandidate, email: e.target.value})} placeholder="jane@example.com" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Phone</label>
                  <input value={newCandidate.phone} onChange={e => setNewCandidate({...newCandidate, phone: e.target.value})} placeholder="(555) 123-4567" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                </div>
              </div>
            </div>
            
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddCandidate} disabled={!newCandidate.name || !newCandidate.jobId} style={{ padding: "10px 20px", background: "#4f46e5", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", opacity: (!newCandidate.name || !newCandidate.jobId) ? 0.5 : 1 }}>Save Candidate</button>
            </div>
          </div>
        </div>
      )}

      {showInterviewModal && selectedCandidate && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: "500px", borderRadius: "20px", overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Schedule Interview: {selectedCandidate.name}</h2>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Date</label>
                  <input type="date" value={interviewDetails.date} onChange={e => setInterviewDetails({...interviewDetails, date: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Time</label>
                  <input type="time" value={interviewDetails.time} onChange={e => setInterviewDetails({...interviewDetails, time: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Interviewer</label>
                <input value={interviewDetails.interviewer} onChange={e => setInterviewDetails({...interviewDetails, interviewer: e.target.value})} placeholder="Interviewer Name" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Meeting Link</label>
                <input value={interviewDetails.link} onChange={e => setInterviewDetails({...interviewDetails, link: e.target.value})} placeholder="https://meet.google.com/..." style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
              <button onClick={() => setShowInterviewModal(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleScheduleInterview} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Schedule & Notify</button>
            </div>
          </div>
        </div>
      )}

      {showOfferModal && selectedCandidate && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: "500px", borderRadius: "20px", overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Create Offer: {selectedCandidate.name}</h2>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Annual Salary / Compensation</label>
                <input value={offerDetails.salary} onChange={e => setOfferDetails({...offerDetails, salary: e.target.value})} placeholder="$120,000" style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Proposed Start Date</label>
                  <input type="date" value={offerDetails.startDate} onChange={e => setOfferDetails({...offerDetails, startDate: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Offer Expiry Date</label>
                  <input type="date" value={offerDetails.expiryDate} onChange={e => setOfferDetails({...offerDetails, expiryDate: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                </div>
              </div>
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc" }}>
              <button onClick={() => setShowOfferModal(false)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSendOffer} style={{ padding: "10px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Generate & Send Offer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
