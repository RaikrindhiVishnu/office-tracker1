"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface OnboardingTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface LifecycleRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "Onboarding" | "Offboarding" | "Probation";
  status: "Pending" | "In Progress" | "Completed";
  tasks: OnboardingTask[];
  targetDate: string; // Joining date or Exit Date or Probation End Date
  notes?: string;
  createdAt: any;
}

export default function EmployeeLifecycle() {
  const [tab, setTab] = useState<"onboarding" | "probation" | "offboarding">("onboarding");
  const [records, setRecords] = useState<LifecycleRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [selEmp, setSelEmp] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "lifecycleRecords"), orderBy("createdAt", "desc")), snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as LifecycleRecord)));
    });
    getDocs(collection(db, "users")).then(s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!selEmp || !targetDate) return;
    setSaving(true);
    const emp = users.find(u => u.id === selEmp);
    
    let defaultTasks: OnboardingTask[] = [];
    if (tab === "onboarding") {
      defaultTasks = [
        { id: "1", title: "Collect ID and Address Proof", isCompleted: false },
        { id: "2", title: "Setup Company Email", isCompleted: false },
        { id: "3", title: "Assign IT Assets (Laptop)", isCompleted: false },
        { id: "4", title: "Bank Account Details Verified", isCompleted: false },
        { id: "5", title: "Office Tour & Introduction", isCompleted: false },
      ];
    } else if (tab === "offboarding") {
      defaultTasks = [
        { id: "1", title: "Collect IT Assets", isCompleted: false },
        { id: "2", title: "Revoke Access (Email, Slack, Jira)", isCompleted: false },
        { id: "3", title: "Knowledge Transfer (KT) Signed Off", isCompleted: false },
        { id: "4", title: "Full & Final Settlement (F&F)", isCompleted: false },
        { id: "5", title: "Exit Interview", isCompleted: false },
      ];
    } else {
      defaultTasks = [
        { id: "1", title: "1-Month Review", isCompleted: false },
        { id: "2", title: "3-Month Review", isCompleted: false },
        { id: "3", title: "Final Manager Feedback", isCompleted: false },
        { id: "4", title: "Confirm Employment Letter", isCompleted: false },
      ];
    }

    try {
      await addDoc(collection(db, "lifecycleRecords"), {
        employeeId: selEmp,
        employeeName: emp?.name || emp?.email || "Unknown",
        type: tab === "onboarding" ? "Onboarding" : tab === "offboarding" ? "Offboarding" : "Probation",
        status: "Pending",
        tasks: defaultTasks,
        targetDate,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setSelEmp("");
      setTargetDate("");
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (recordId: string, tasks: OnboardingTask[], taskId: string) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
    const allDone = updated.every(t => t.isCompleted);
    await updateDoc(doc(db, "lifecycleRecords", recordId), {
      tasks: updated,
      status: allDone ? "Completed" : "In Progress"
    });
  };

  const filtered = records.filter(r => r.type.toLowerCase() === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employee Lifecycle</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage Onboarding, Probation, and Offboarding checklists</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-sm text-sm">
          + Start {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {(["onboarding", "probation", "offboarding"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${tab === t ? "border-teal-600 text-teal-700 bg-teal-50" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* CONTENT GRID */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center text-gray-400">
          <p className="text-3xl mb-3">🚀</p>
          <p className="font-medium text-sm">No active {tab} records</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{r.employeeName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Target: {r.targetDate}</p>
                </div>
                <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${r.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : r.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  {r.status}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase mb-1">
                  <span>Tasks</span>
                  <span>{r.tasks.filter(t => t.isCompleted).length} / {r.tasks.length}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full transition-all ${r.status === 'Completed' ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${(r.tasks.filter(t => t.isCompleted).length / Math.max(1, r.tasks.length)) * 100}%` }} />
                </div>
                {r.tasks.map(t => (
                  <label key={t.id} className="flex items-start gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 transition ${t.isCompleted ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
                      {t.isCompleted && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <input type="checkbox" className="hidden" checked={t.isCompleted} onChange={() => toggleTask(r.id, r.tasks, t.id)} />
                    <span className={`text-sm ${t.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Start {tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Select Employee</label>
                <select value={selEmp} onChange={e => setSelEmp(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-gray-50">
                  <option value="">Choose...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  {tab === "onboarding" ? "Joining Date" : tab === "offboarding" ? "Exit Date" : "Probation End Date"}
                </label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-gray-50"/>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !selEmp || !targetDate} className="flex-1 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition shadow-sm">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
