"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { HelpCircle, MessageSquare, Plus, Send, X, Clock, Loader2, CheckCircle2 } from "lucide-react";

interface Query {
  id: string;
  subject: string;
  message: string;
  status: "Open" | "Resolved";
  reply?: string;
  createdAt?: any;
}

const CATEGORIES = ["Payroll Issue", "Attendance Issue", "Leave Problem", "IT / Hardware Support", "Other"];

export const MobileHelp = () => {
  const { user, userData } = useAuth();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "queries"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: Query[] = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Query));
      setQueries(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, "queries"), {
        uid: user.uid,
        userName: userData?.name || user.email?.split("@")[0],
        userEmail: user.email,
        subject,
        message: message.trim(),
        status: "Open",
        createdAt: serverTimestamp(),
      });
      setMessage("");
      setShowNewForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit query");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Loading Queries</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-6 relative min-h-screen pb-24">
      <div className="text-center">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Help & Queries</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Reach out to HR or Admin for support.</p>
      </div>

      <div className="flex flex-col gap-4">
        {queries.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-600">No queries yet</p>
            <p className="text-xs text-gray-400 mt-1">Need help? Tap the + button below.</p>
          </div>
        ) : (
          queries.map((q) => (
            <div key={q.id} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> {q.subject}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                  q.status === "Resolved" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                }`}>
                  {q.status}
                </span>
              </div>
              
              <div className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> You asked</span>
                  <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-2xl rounded-tl-none">{q.message}</p>
                  <span className="text-[9px] text-gray-400 self-end px-1">{formatDate(q.createdAt)}</span>
                </div>

                {q.reply && (
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-[10px] font-bold text-purple-600 self-end flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Admin Reply</span>
                    <p className="text-xs text-gray-800 leading-relaxed bg-purple-50 p-3 rounded-2xl rounded-tr-none border border-purple-100">{q.reply}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      {!showNewForm && (
        <button
          onClick={() => setShowNewForm(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-xl shadow-gray-900/20 flex items-center justify-center active:scale-95 transition-transform z-50"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* New Query Form Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/20 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 flex flex-col gap-5 animate-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">New Query</h3>
              <button onClick={() => setShowNewForm(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-2xl text-sm font-bold transition-transform active:scale-95 disabled:opacity-50 mt-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Send Query
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
