"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function CompanyPoliciesView({ isAdmin = false }: { isAdmin?: boolean }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("HR");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    const q = query(collection(db, "policies"));
    const unsub = onSnapshot(q, snap => {
      setPolicies(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "policies"), {
        title, category, content, link, createdAt: serverTimestamp()
      });
      setShowModal(false);
      setTitle(""); setCategory("HR"); setContent(""); setLink("");
    } catch (err) {
      console.error(err);
      alert("Failed to add policy.");
    }
  };

  const deletePolicy = async (id: string) => {
    if (confirm("Delete this policy?")) {
      await deleteDoc(doc(db, "policies", id));
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading policies...</div>;

  const categories = Array.from(new Set(policies.map(p => p.category)));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Company Policies & Guidelines</h1>
          <p className="text-sm text-slate-500 mt-1">Important resources and rules for all employees.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm">
            + Add Policy
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {policies.length === 0 ? (
          <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            No policies uploaded yet.
          </div>
        ) : (
          <div className="space-y-8 max-w-5xl mx-auto">
            {categories.map(cat => (
              <div key={cat} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">{cat} Policies</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {policies.filter(p => p.category === cat).map(policy => (
                    <div key={policy.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition group">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-800">{policy.title}</h3>
                        {isAdmin && (
                          <button onClick={() => deletePolicy(policy.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{policy.content}</p>
                      
                      {policy.link && (
                        <a href={policy.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          Open Document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Add New Policy</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleAddPolicy} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Policy Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400">
                  <option>HR</option><option>IT & Security</option><option>Finance</option><option>General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Summary / Content</label>
                <textarea required value={content} onChange={e => setContent(e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Document Link (Optional)</label>
                <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..." className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save Policy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
