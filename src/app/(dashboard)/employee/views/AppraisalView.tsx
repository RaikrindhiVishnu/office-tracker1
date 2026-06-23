"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AppraisalView({ user }: { user: any }) {
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [period, setPeriod] = useState(`${new Date().getFullYear()} Q1`);
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [goals, setGoals] = useState("");
  const [rating, setRating] = useState<number>(3);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "appraisals"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      setAppraisals(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "appraisals"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        userEmail: user.email || "",
        period,
        achievements,
        challenges,
        goals,
        selfRating: rating,
        status: "Pending Review",
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      setAchievements("");
      setChallenges("");
      setGoals("");
      setRating(3);
      alert("Appraisal submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to submit appraisal.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading appraisals...</div>;
  }

  return (
    <div className="h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Performance Appraisals</h1>
            <p className="text-sm text-slate-500 mt-1">Submit self-appraisals and track your performance reviews.</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm"
          >
            {showForm ? "Cancel" : "+ New Self-Appraisal"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5 animate-in slide-in-from-top-4">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">Submit Self-Appraisal</h2>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Review Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition text-sm">
                <option value={`${new Date().getFullYear()} Q1`}>{new Date().getFullYear()} Q1 (Jan - Mar)</option>
                <option value={`${new Date().getFullYear()} Q2`}>{new Date().getFullYear()} Q2 (Apr - Jun)</option>
                <option value={`${new Date().getFullYear()} Q3`}>{new Date().getFullYear()} Q3 (Jul - Sep)</option>
                <option value={`${new Date().getFullYear()} Q4`}>{new Date().getFullYear()} Q4 (Oct - Dec)</option>
                <option value={`${new Date().getFullYear()} Annual`}>{new Date().getFullYear()} Annual Review</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Achievements</label>
              <textarea required value={achievements} onChange={e => setAchievements(e.target.value)} rows={3} placeholder="What were your main accomplishments this period?" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition text-sm resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Challenges Faced</label>
              <textarea required value={challenges} onChange={e => setChallenges(e.target.value)} rows={2} placeholder="Any blockers or areas where you needed support?" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition text-sm resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Goals for Next Period</label>
              <textarea required value={goals} onChange={e => setGoals(e.target.value)} rows={2} placeholder="What do you want to achieve next?" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition text-sm resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Self Rating (1-5)</label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map(num => (
                  <label key={num} className="flex flex-col items-center gap-1 cursor-pointer">
                    <input type="radio" name="rating" value={num} checked={rating === num} onChange={() => setRating(num)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-slate-600">{num}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button disabled={submitting} type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Appraisal"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">History</h2>
          {appraisals.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              No appraisals submitted yet.
            </div>
          ) : (
            appraisals.map(app => (
              <div key={app.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">{app.period}</h3>
                    <p className="text-xs text-slate-400">{app.createdAt?.toDate().toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    app.status === "Pending Review" ? "bg-amber-100 text-amber-700" :
                    app.status === "Reviewed" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {app.status}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achievements</span>
                    <p className="text-sm text-slate-700 mt-1">{app.achievements}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Self Rating</span>
                      <div className="text-sm font-bold text-indigo-600 mt-1">{app.selfRating} / 5</div>
                    </div>
                    {app.managerRating && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manager Rating</span>
                        <div className="text-sm font-bold text-emerald-600 mt-1">{app.managerRating} / 5</div>
                      </div>
                    )}
                  </div>
                  {app.managerFeedback && (
                    <div className="bg-indigo-50 p-3 rounded-xl mt-4 border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Manager Feedback</span>
                      <p className="text-sm text-indigo-900 mt-1">{app.managerFeedback}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
