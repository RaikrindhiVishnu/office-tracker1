"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, query, onSnapshot, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FeedbackView({ user, isAdmin = false }: { user?: any, isAdmin?: boolean }) {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState("Suggestion");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "feedbacks"));
    const unsub = onSnapshot(q, snap => {
      let data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt);
      
      // If not admin, only show own feedbacks and public replies (or just keep it simple, show all but hide anonymous names)
      if (!isAdmin && user?.uid) {
        data = data.filter(f => f.uid === user.uid || (f.status === "Published" && f.isAnonymous === false));
      }

      setFeedbacks(data);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin, user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedbacks"), {
        uid: user.uid,
        userName: isAnonymous ? "Anonymous Employee" : (user.email?.split("@")[0] || "Employee"),
        isAnonymous,
        category,
        content,
        status: "Open", // Open, Reviewed, Resolved
        adminReply: "",
        createdAt: serverTimestamp()
      });
      setContent("");
      setIsAnonymous(false);
      alert("Feedback submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminReply = async (id: string, reply: string) => {
    if (!reply.trim()) return;
    await updateDoc(doc(db, "feedbacks", id), {
      adminReply: reply,
      status: "Resolved",
      updatedAt: serverTimestamp()
    });
  };

  const deleteFeedback = async (id: string) => {
    if (confirm("Delete this feedback?")) {
      await deleteDoc(doc(db, "feedbacks", id));
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading feedback...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-800">{isAdmin ? "Feedback Management" : "Suggestion Box"}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin ? "Review and respond to employee feedback." : "Share your ideas, suggestions, or concerns."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
        
        {/* Submit Form (Only for employees) */}
        {!isAdmin && (
          <div className="w-full lg:w-1/3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Submit Feedback</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400">
                    <option>Suggestion</option><option>Concern</option><option>Workplace Issue</option><option>Question</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Feedback</label>
                  <textarea required value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="What's on your mind?" className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 resize-none text-sm" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm font-medium text-slate-700">Submit Anonymously</span>
                </label>
                <button disabled={submitting} type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Feedback List */}
        <div className={`w-full ${isAdmin ? "" : "lg:w-2/3"} space-y-4`}>
          {feedbacks.map(f => (
            <div key={f.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${f.isAnonymous ? "bg-slate-100 text-slate-400" : "bg-indigo-100 text-indigo-700"}`}>
                    {f.isAnonymous ? "A" : f.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      {f.userName}
                      {f.isAnonymous && isAdmin && <span className="text-[10px] text-rose-500 ml-2">(Admin can see: {f.uid})</span>}
                    </h3>
                    <p className="text-[10px] text-slate-400">{f.createdAt?.toDate().toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold text-slate-500">{f.category}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    f.status === "Open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {f.status}
                  </span>
                  {isAdmin && (
                    <button onClick={() => deleteFeedback(f.id)} className="text-slate-400 hover:text-rose-500 transition opacity-0 group-hover:opacity-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-wrap ml-11">{f.content}</p>

              {f.adminReply && (
                <div className="ml-11 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl relative">
                  <span className="absolute -top-2 left-3 bg-indigo-100 text-indigo-600 px-2 text-[10px] font-bold rounded">Admin Reply</span>
                  <p className="text-sm text-indigo-900 mt-1">{f.adminReply}</p>
                </div>
              )}

              {isAdmin && !f.adminReply && (
                <div className="ml-11 mt-4 pt-4 border-t border-slate-100">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const reply = (e.currentTarget.elements.namedItem('reply') as HTMLInputElement).value;
                    handleAdminReply(f.id, reply);
                  }} className="flex gap-2">
                    <input name="reply" required placeholder="Type a reply to resolve..." className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
                    <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700">Reply</button>
                  </form>
                </div>
              )}
            </div>
          ))}

          {feedbacks.length === 0 && (
            <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              No feedback found.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
