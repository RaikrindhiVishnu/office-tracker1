"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, query, onSnapshot, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminJobsView() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("Full-time");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");

  useEffect(() => {
    const q = query(collection(db, "jobs"));
    const unsub = onSnapshot(q, snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "jobs"), {
        title, department, location, type, description, requirements,
        status: "Open",
        applicantsCount: 0,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setTitle(""); setDepartment(""); setLocation(""); setType("Full-time"); setDescription(""); setRequirements("");
    } catch (err) {
      console.error(err);
      alert("Failed to create job.");
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, "jobs", id), {
      status: currentStatus === "Open" ? "Closed" : "Open"
    });
  };

  const deleteJob = async (id: string) => {
    if (confirm("Delete this job posting?")) {
      await deleteDoc(doc(db, "jobs", id));
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading jobs...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recruitment & Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">Manage open positions and track applicants.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm">
          + Post New Job
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{job.title}</h3>
                  <p className="text-sm text-indigo-600 font-medium">{job.department} • {job.location}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                  job.status === "Open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {job.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>{job.type}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{job.applicantsCount || 0} Applicants</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>Posted: {job.createdAt?.toDate().toLocaleDateString() || "Recently"}</span>
              </div>

              <div className="flex-1 space-y-4 text-sm text-slate-600 mb-6">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                  <p className="line-clamp-2">{job.description}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-auto">
                <button onClick={() => deleteJob(job.id)} className="text-rose-500 hover:text-rose-700 text-sm font-semibold transition">Delete</button>
                <div className="flex gap-2">
                  <button onClick={() => toggleStatus(job.id, job.status)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition">
                    {job.status === "Open" ? "Close Job" : "Re-open"}
                  </button>
                  <button className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-lg transition">
                    View Applicants
                  </button>
                </div>
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
              No job postings yet.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h3 className="text-lg font-bold text-slate-800">Post New Job</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full">×</button>
            </div>
            <form onSubmit={handleCreateJob} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Job Title</label>
                  <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Department</label>
                  <input required value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Location</label>
                  <input required value={location} onChange={e => setLocation(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Job Type</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400">
                    <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
                  <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Requirements</label>
                  <textarea required value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 resize-none" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm">Post Job</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
