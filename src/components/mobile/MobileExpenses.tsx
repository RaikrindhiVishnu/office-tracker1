"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Receipt, Plus, DollarSign, Clock, CheckCircle2, XCircle, Camera, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const MobileExpenses = ({ user }: { user: any }) => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Travel");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "expenses"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        userPhoto: user.photoURL || "",
        amount: parseFloat(amount),
        category,
        description,
        status: "Pending",
        createdAt: serverTimestamp()
      });
      setShowForm(false);
      setAmount("");
      setDescription("");
      setCategory("Travel");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Approved": return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "Rejected": return "text-red-600 bg-red-50 border-red-100";
      default: return "text-amber-600 bg-amber-50 border-amber-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "Approved": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Rejected": return <XCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Summary */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-200">Total Reimbursed</h2>
          <div className="text-3xl font-black mt-2 flex items-center">
            <DollarSign className="w-7 h-7 opacity-80" />
            {expenses.filter(e => e.status === "Approved").reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
          </div>
          <p className="text-xs text-emerald-100/80 mt-1">
            {expenses.filter(e => e.status === "Pending").length} pending requests
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute top-4 right-4 p-3 bg-white/10 rounded-2xl backdrop-blur-md">
          <Receipt className="w-6 h-6 text-emerald-100" />
        </div>
      </div>

      {/* Action Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white p-4 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Expense Claim
        </button>
      )}

      {/* Submission Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Submit Expense</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Amount ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-gray-700"
                >
                  <option value="Travel">Travel & Transport</option>
                  <option value="Meals">Meals & Entertainment</option>
                  <option value="Supplies">Office Supplies</option>
                  <option value="Internet">Internet & Phone</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Description</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                  placeholder="What was this for?"
                />
              </div>

              {/* Receipt upload placeholder */}
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-gray-500 bg-gray-50">
                <Camera className="w-6 h-6 text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Tap to scan receipt</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 text-white p-3.5 rounded-xl font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {submitting ? "Submitting..." : "Submit Claim"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* History List */}
      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Claims</h3>
        
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">No expenses submitted yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 border border-gray-50 bg-gray-50/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Receipt className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{expense.category}</h4>
                    <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{expense.description}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-black text-gray-900">${expense.amount.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(expense.status)}`}>
                    {getStatusIcon(expense.status)}
                    {expense.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
