"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Stage = "Applied" | "Screening" | "Interview" | "Offered" | "Hired" | "Rejected";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  stage: Stage;
  resumeUrl?: string;
  interviewDate?: string;
  interviewLink?: string;
  offerLetterUrl?: string;
  createdAt: any;
}

const STAGES: Stage[] = ["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"];
const STAGE_COLORS: Record<Stage, string> = {
  Applied: "bg-gray-100 text-gray-700",
  Screening: "bg-blue-50 text-blue-700",
  Interview: "bg-purple-50 text-purple-700",
  Offered: "bg-amber-50 text-amber-700",
  Hired: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
};

export default function RecruitmentATS() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Form State
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", resumeUrl: "" });
  const [interviewForm, setInterviewForm] = useState({ date: "", time: "", link: "" });
  const [offerForm, setOfferForm] = useState({ ctc: "", joiningDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "candidates"), orderBy("createdAt", "desc")), snap => {
      setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Candidate)));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await addDoc(collection(db, "candidates"), {
      ...form,
      stage: "Applied",
      createdAt: serverTimestamp()
    });
    setForm({ name: "", email: "", phone: "", role: "", resumeUrl: "" });
    setShowAdd(false);
    setSaving(false);
  };

  const updateStage = async (id: string, newStage: Stage) => {
    await updateDoc(doc(db, "candidates", id), { stage: newStage });
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSaving(true);
    const dt = `${interviewForm.date}T${interviewForm.time}`;
    await updateDoc(doc(db, "candidates", selectedCandidate.id), {
      interviewDate: dt,
      interviewLink: interviewForm.link,
      stage: "Interview"
    });
    setShowInterview(false);
    setSelectedCandidate(null);
    setSaving(false);
  };

  const handleGenerateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSaving(true);
    // Mock Offer Letter Generation
    const offerUrl = `https://example.com/offer_${selectedCandidate.id}.pdf`;
    await updateDoc(doc(db, "candidates", selectedCandidate.id), {
      offerLetterUrl: offerUrl,
      stage: "Offered"
    });
    setShowOffer(false);
    setSelectedCandidate(null);
    setSaving(false);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recruitment & ATS</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage candidates, interviews, and offer letters</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-sm text-sm">
          + Add Candidate
        </button>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const colCandidates = candidates.filter(c => c.stage === stage);
          return (
            <div key={stage} className="w-80 flex-shrink-0 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col max-h-[800px]">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50 rounded-t-2xl">
                <h3 className="font-bold text-gray-700">{stage}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage]}`}>{colCandidates.length}</span>
              </div>
              <div className="p-3 overflow-y-auto flex-1 space-y-3">
                {colCandidates.map(c => (
                  <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-teal-300 transition-all group">
                    <h4 className="font-bold text-gray-900 text-sm truncate">{c.name}</h4>
                    <p className="text-xs text-teal-600 font-semibold mb-2">{c.role}</p>
                    <p className="text-xs text-gray-500 truncate mb-1">📧 {c.email}</p>
                    <p className="text-xs text-gray-500 truncate mb-3">📱 {c.phone}</p>
                    
                    {c.interviewDate && (
                      <div className="mb-3 p-2 bg-purple-50 rounded text-[11px] text-purple-700 border border-purple-100">
                        <span className="font-bold">Interview:</span> {new Date(c.interviewDate).toLocaleString()}
                        {c.interviewLink && <a href={c.interviewLink} target="_blank" className="block mt-1 underline">Join Meet</a>}
                      </div>
                    )}
                    
                    {c.offerLetterUrl && (
                      <div className="mb-3 p-2 bg-amber-50 rounded text-[11px] text-amber-700 border border-amber-100">
                        <a href={c.offerLetterUrl} target="_blank" className="font-bold underline">📄 View Offer Letter</a>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-50 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {stage !== "Rejected" && stage !== "Hired" && (
                        <select 
                          className="text-[10px] py-1 px-2 border rounded bg-gray-50 text-gray-600 outline-none"
                          value={c.stage}
                          onChange={(e) => updateStage(c.id, e.target.value as Stage)}
                        >
                          {STAGES.map(s => <option key={s} value={s}>Move to {s}</option>)}
                        </select>
                      )}
                      
                      {stage === "Screening" && (
                        <button onClick={() => { setSelectedCandidate(c); setShowInterview(true); }} className="text-[10px] px-2 py-1 bg-purple-100 text-purple-700 rounded font-semibold whitespace-nowrap hover:bg-purple-200">
                          Schedule
                        </button>
                      )}
                      
                      {stage === "Interview" && (
                        <button onClick={() => { setSelectedCandidate(c); setShowOffer(true); }} className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded font-semibold whitespace-nowrap hover:bg-amber-200">
                          Send Offer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD CANDIDATE MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Candidate</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Name</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-teal-400" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Email</label><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-teal-400" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label><input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-teal-400" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Role Applying For</label><input required value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-teal-400" /></div>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE INTERVIEW MODAL */}
      {showInterview && selectedCandidate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Schedule Interview</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedCandidate.name} - {selectedCandidate.role}</p>
            <form onSubmit={handleScheduleInterview} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs font-semibold text-gray-500 mb-1">Date</label><input type="date" required value={interviewForm.date} onChange={e=>setInterviewForm({...interviewForm,date:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-purple-400" /></div>
                <div className="flex-1"><label className="block text-xs font-semibold text-gray-500 mb-1">Time</label><input type="time" required value={interviewForm.time} onChange={e=>setInterviewForm({...interviewForm,time:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-purple-400" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Meeting Link (Meet/Zoom)</label><input required type="url" value={interviewForm.link} onChange={e=>setInterviewForm({...interviewForm,link:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-purple-400" /></div>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setShowInterview(false)} className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE OFFER MODAL */}
      {showOffer && selectedCandidate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Generate Offer Letter</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedCandidate.name} - {selectedCandidate.role}</p>
            <form onSubmit={handleGenerateOffer} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">CTC (Annual Salary)</label><input required type="number" value={offerForm.ctc} onChange={e=>setOfferForm({...offerForm,ctc:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-amber-400" placeholder="e.g. 500000" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Expected Joining Date</label><input type="date" required value={offerForm.joiningDate} onChange={e=>setOfferForm({...offerForm,joiningDate:e.target.value})} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-amber-400" /></div>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setShowOffer(false)} className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition">Generate & Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
