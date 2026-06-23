"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function JobsView() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "jobs"), where("status", "==", "Open"));
    const unsub = onSnapshot(q, snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading open positions...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-800">Internal Job Board</h1>
        <p className="text-sm text-slate-500 mt-1">Browse open positions for internal transfer or referrals.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-slate-800">{job.title}</h3>
                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">New</span>
              </div>
              <p className="text-sm text-indigo-600 font-medium mb-4">{job.department} • {job.location}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-bold text-slate-600">{job.type}</span>
                <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-bold text-slate-600">Posted: {job.createdAt?.toDate().toLocaleDateString() || "Recently"}</span>
              </div>

              <div className="space-y-4 text-sm text-slate-600 flex-1">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</h4>
                  <p className="line-clamp-3">{job.description}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Requirements</h4>
                  <p className="line-clamp-3">{job.requirements}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
                <button className="flex-1 py-2.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-100 transition border border-indigo-100">
                  Refer Someone
                </button>
                <button className="flex-1 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition shadow-sm">
                  Apply Internally
                </button>
              </div>
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
              <span className="text-4xl mb-4 opacity-50">📭</span>
              <h3 className="text-lg font-bold text-slate-700">No open positions</h3>
              <p className="text-sm text-slate-500 mt-1">Check back later for new opportunities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
