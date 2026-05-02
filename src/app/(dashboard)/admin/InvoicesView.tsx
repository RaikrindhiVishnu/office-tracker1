"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { InvoiceEngine, InvoiceData, InvoiceItem } from "@/lib/InvoiceEngine";

export default function InvoicesView() {
  const { companyId, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "companies", companyId, "invoices"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Invoice fetch error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [companyId, authLoading]);

  const addItem = () => setItems([...items, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      item.amount = item.quantity * item.rate;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!companyId || !clientName) return;
    try {
      await InvoiceEngine.generateInvoice(companyId, {
        clientName,
        items,
        dueDate: dueDate || undefined,
        status: "draft"
      });
      setShowCreate(false);
      setItems([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
      setClientName("");
      setDueDate("");
    } catch (error) {
      console.error("Error creating invoice:", error);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!companyId || !window.confirm("Delete this invoice record?")) return;
    try {
      await deleteDoc(doc(db, "companies", companyId, "invoices", id));
    } catch (error) {
      console.error("Error deleting invoice:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium italic">Synchronizing Billing Records...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-0 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="bg-slate-50/50 px-6 py-6 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200 text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Invoicing System</h2>
              <p className="text-sm text-slate-500 font-medium">Automated client billing & status tracking</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <PlusIcon /> Generate New Invoice
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inv #</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4 font-bold text-slate-900 text-sm">{inv.invoiceNumber}</td>
                <td className="px-6 py-4 font-semibold text-slate-600 text-sm">{inv.clientName}</td>
                <td className="px-6 py-4 font-black text-slate-900 text-sm">{InvoiceEngine.formatCurrency(inv.total)}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    inv.status === "paid" ? "bg-emerald-100 text-emerald-600" :
                    inv.status === "sent" ? "bg-blue-100 text-blue-600" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => deleteInvoice(inv.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <div className="text-4xl mb-4 opacity-10">📄</div>
                  <p className="text-slate-400 font-medium italic">No billing records found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Creation Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-0 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-xl font-bold">Draft New Invoice</h2>
                <p className="text-xs opacity-70 mt-1 font-medium text-slate-300">Create a professional billing record</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                <XIcon />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              {/* Form Section */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Recipient / Client Name</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Client or Organization Name" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Payment Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Billing Items</label>
                  <button onClick={addItem} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-lg transition-all">+ Add Line Item</button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center group">
                      <div className="flex-[3]">
                        <input placeholder="Service/Product Description" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                      </div>
                      <div className="flex-1">
                        <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none text-center" />
                      </div>
                      <div className="flex-1">
                        <input type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(idx, "rate", Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none text-center" />
                      </div>
                      <div className="w-24 text-right font-bold text-slate-900 text-xs">
                        ₹{item.amount.toLocaleString()}
                      </div>
                      <button onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Section */}
              <div className="bg-slate-50 rounded-2xl p-6 flex flex-col items-end gap-3 border border-slate-100">
                <div className="flex justify-between w-full max-w-[200px] text-xs font-medium text-slate-500">
                  <span>Subtotal:</span>
                  <span className="text-slate-900 font-bold">₹{items.reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-full max-w-[200px] text-xs font-medium text-slate-500">
                  <span>GST (18%):</span>
                  <span className="text-slate-900 font-bold">₹{(items.reduce((s, i) => s + i.amount, 0) * 0.18).toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-200 w-full max-w-[200px] my-1"></div>
                <div className="flex justify-between w-full max-w-[200px] text-base font-black text-slate-900">
                  <span>Total:</span>
                  <span className="text-indigo-600">₹{(items.reduce((s, i) => s + i.amount, 0) * 1.18).toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handleCreate}
                disabled={!clientName}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
              >
                Create Invoice Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>; }
function XIcon({ className = "w-5 h-5" }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }
function TrashIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>; }
