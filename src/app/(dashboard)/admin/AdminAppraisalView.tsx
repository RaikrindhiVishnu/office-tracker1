"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminAppraisalView() {
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedAppraisal, setSelectedAppraisal] = useState<any>(null);
  const [managerFeedback, setManagerFeedback] = useState("");
  const [managerRating, setManagerRating] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "appraisals"));
    const unsub = onSnapshot(q, snap => {
      setAppraisals(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppraisal) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "appraisals", selectedAppraisal.id), {
        managerFeedback,
        managerRating,
        status: "Reviewed",
      });
      setSelectedAppraisal(null);
      alert("Appraisal reviewed successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8 text-slate-500">Loading appraisals...</div>;

  const pendingCount = appraisals.filter(a => a.status === "Pending Review").length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-800">Performance Appraisals</h1>
        <p className="text-sm text-slate-500 mt-1">Review self-appraisals and provide feedback.</p>
        <div className="mt-4 flex gap-3">
          <div className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-bold">
            {pendingCount} Pending Reviews
          </div>
          <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold">
            {appraisals.length - pendingCount} Reviewed
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appraisals.map(app => (
            <div key={app.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{app.userName}</h3>
                  <p className="text-xs text-slate-500">{app.period}</p>
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                  app.status === "Pending Review" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {app.status}
                </span>
              </div>

              <div className="flex-1 space-y-3 my-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Self Rating</span>
                  <div className="text-lg font-bold text-indigo-600 leading-none mt-1">{app.selfRating} / 5</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achievements</span>
                  <p className="text-sm text-slate-700 mt-1 line-clamp-2" title={app.achievements}>{app.achievements}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAppraisal(app);
                  setManagerFeedback(app.managerFeedback || "");
                  setManagerRating(app.managerRating || 3);
                }}
                className="w-full py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition"
              >
                {app.status === "Pending Review" ? "Review Now" : "View / Edit Review"}
              </button>
            </div>
          ))}
          {appraisals.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No appraisals found.
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedAppraisal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Review: {selectedAppraisal.userName}</h3>
                <p className="text-xs text-slate-500">{selectedAppraisal.period}</p>
              </div>
              <button onClick={() => setSelectedAppraisal(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Employee's Submission */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 text-sm border-b border-slate-200 pb-2">Employee&apos;s Self-Appraisal</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achievements</span>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{selectedAppraisal.achievements}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Challenges</span>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{selectedAppraisal.challenges}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Goals</span>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{selectedAppraisal.goals}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Self Rating</span>
                    <div className="text-xl font-bold text-indigo-600 mt-1">{selectedAppraisal.selfRating} / 5</div>
                  </div>
                </div>
              </div>

              {/* Manager's Review Form */}
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">Manager Review</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manager Rating (1-5)</label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map(num => (
                      <label key={num} className="flex flex-col items-center gap-1 cursor-pointer">
                        <input type="radio" name="managerRating" value={num} checked={managerRating === num} onChange={() => setManagerRating(num)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-slate-600">{num}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Feedback & Comments</label>
                  <textarea 
                    required 
                    value={managerFeedback} 
                    onChange={e => setManagerFeedback(e.target.value)} 
                    rows={4} 
                    placeholder="Provide constructive feedback..." 
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition text-sm resize-none" 
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setSelectedAppraisal(null)} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition">Cancel</button>
                  <button disabled={submitting} type="submit" className="px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition shadow-sm disabled:opacity-50">
                    {submitting ? "Saving..." : "Submit Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
