"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: "New" | "Contacted" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";
  value: number;
  source: string;
  notes: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  "New": "#3b82f6",
  "Contacted": "#8b5cf6",
  "Proposal": "#f59e0b",
  "Negotiation": "#6366f1",
  "Closed Won": "#10b981",
  "Closed Lost": "#ef4444"
};

const statusBgs: Record<string, string> = {
  "New": "#eff6ff",
  "Contacted": "#f5f3ff",
  "Proposal": "#fffbeb",
  "Negotiation": "#eef2ff",
  "Closed Won": "#ecfdf5",
  "Closed Lost": "#fef2f2"
};

export default function LeadsView() {
  const { companyId, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    value: 0, source: "", notes: "", status: "New" as Lead["status"]
  });

  useEffect(() => {
    if (authLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "companies", companyId, "leads"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q,
      (snap) => {
        setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [companyId, authLoading]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.company.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const handleAdd = async () => {
    if (!companyId) return;
    try {
      await addDoc(collection(db, "companies", companyId, "leads"), {
        ...form,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setForm({ name: "", company: "", email: "", phone: "", value: 0, source: "", notes: "", status: "New" });
    } catch (error) {
      console.error("Error adding lead:", error);
    }
  };

  const updateStatus = async (id: string, newStatus: Lead["status"]) => {
    if (!companyId) return;
    try {
      await updateDoc(doc(db, "companies", companyId, "leads", id), {
        status: newStatus
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteLead = async (id: string) => {
    if (!companyId || !window.confirm("Are you sure you want to delete this lead?")) return;
    try {
      await deleteDoc(doc(db, "companies", companyId, "leads", id));
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Loading CRM Pipeline...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-0 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="bg-slate-50/50 px-6 py-6 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200 text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Leads Pipeline</h2>
              <p className="text-sm text-slate-500 font-medium">Manage sales opportunities & conversions</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <PlusIcon /> Add New Lead
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 mt-6">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none transition-all"
            />
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white cursor-pointer"
          >
            <option value="All">All Statuses</option>
            {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Grid Content */}
      <div className="p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredLeads.map(lead => (
            <div key={lead.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-indigo-100 transition-all group relative">
              <div className="flex justify-between items-start mb-3">
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: statusBgs[lead.status], color: statusColors[lead.status] }}>
                  {lead.status}
                </span>
                <div className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg">₹{lead.value.toLocaleString()}</div>
              </div>

              <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{lead.name}</h3>
              <p className="text-xs text-slate-500 font-semibold mb-4">{lead.company || "No Company"}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded-lg">
                  <MailIcon className="w-3 h-3 opacity-60" /> <span className="truncate">{lead.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded-lg">
                  <PhoneIcon className="w-3 h-3 opacity-60" /> {lead.phone}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-50">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                  className="flex-1 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border-none rounded-lg px-2 py-1.5 text-slate-600 outline-none cursor-pointer transition-colors"
                >
                  {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => deleteLead(lead.id)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="text-4xl mb-4 opacity-20">📂</div>
              <p className="text-slate-400 font-medium italic">No leads found matching your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-0 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-bold">New Sales Opportunity</h2>
                <p className="text-xs opacity-70 mt-1 font-medium text-slate-300">Add a potential deal to your pipeline</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                <XIcon />
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Lead Full Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="e.g. John Smith" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Company Name" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Deal Value (₹)</label>
                  <input type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Email Address</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="john@example.com" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all" placeholder="Any additional details..." />
                </div>
              </div>

              <button
                onClick={handleAdd}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 transition-all active:scale-[0.98] mt-4"
              >
                Create Lead & Start Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon() { return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>; }
function SearchIcon({ className }: { className?: string }) { return <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>; }
function MailIcon({ className }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" /></svg>; }
function PhoneIcon({ className }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>; }
function XIcon() { return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }
function TrashIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>; }
