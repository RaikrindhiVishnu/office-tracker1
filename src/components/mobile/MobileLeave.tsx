"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Calendar, CalendarCheck, Clock, FileText, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { LeaveType } from "@/types/leave";

interface LeaveRecord {
  id: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt?: any;
}

const LEAVE_TYPES = [
  { id: "casual", label: "Casual Leave", icon: "🧑🏻‍💻", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { id: "sick", label: "Sick Leave", icon: "🤒", color: "bg-orange-50 text-orange-600 border-orange-200" },
  { id: "annual", label: "Annual Leave", icon: "🏖️", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { id: "Work From Home", label: "Work From Home", icon: "🏠", color: "bg-green-50 text-green-600 border-green-200" },
];

export const MobileLeave = () => {
  const { user, userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"apply" | "history">("apply");
  const [history, setHistory] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "leaveRequests"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: LeaveRecord[] = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as LeaveRecord));
      setHistory(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      setMsg("Please fill all fields.");
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setMsg("End date must be after start date.");
      return;
    }
    if (!user) return;

    try {
      setSubmitting(true);
      setMsg("");
      await addDoc(collection(db, "leaveRequests"), {
        uid: user.uid,
        userName: userData?.name || user.email?.split("@")[0] || "Unknown",
        userEmail: user.email || "",
        userPhoto: userData?.profilePhoto || "",
        leaveType,
        fromDate,
        toDate,
        reason: reason.trim(),
        status: "Pending",
        notificationRead: false,
        createdAt: serverTimestamp(),
      });
      setMsg("success");
      setFromDate("");
      setToDate("");
      setReason("");
      setTimeout(() => {
        setMsg("");
        setActiveTab("history");
      }, 2000);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "Approved") return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase">Approved</span>;
    if (status === "Rejected") return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase">Rejected</span>;
    return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase">Pending</span>;
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Leave Requests</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Apply for time off or view your past requests.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab("apply")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === "apply" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Apply Leave
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          History
        </button>
      </div>

      {/* Apply Tab */}
      {activeTab === "apply" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {msg && msg !== "success" && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {msg}
            </div>
          )}
          {msg === "success" && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Leave request submitted successfully!
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setLeaveType(type.id as LeaveType)}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2 transition-all ${leaveType === type.id ? type.color + ' ring-2 ring-offset-1 ring-current/20' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-[10px] font-bold">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">From Date</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">To Date</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">Reason for leave</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Going out of station for family function"
              className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-rose-200"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Request
          </button>
        </form>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-3 pb-10">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-rose-500 animate-spin" /></div>
          ) : history.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-600">No leave history</p>
            </div>
          ) : (
            history.map((req) => (
              <div key={req.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{LEAVE_TYPES.find(t => t.id === req.leaveType)?.icon || "📅"}</span>
                    <h4 className="text-sm font-bold text-gray-900 capitalize">{req.leaveType} Leave</h4>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                
                <div className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-gray-50 px-3 py-2 rounded-xl w-fit">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {req.fromDate} <span className="text-gray-400 font-normal">to</span> {req.toDate}
                </div>

                <div className="mt-1">
                  <p className="text-[11px] text-gray-500 leading-relaxed"><strong className="text-gray-700">Reason:</strong> {req.reason}</p>
                </div>

                {req.adminNote && (
                  <div className="mt-2 bg-orange-50 border border-orange-100 p-2.5 rounded-xl">
                    <p className="text-[10px] text-orange-800"><strong className="uppercase tracking-wider">Manager Note:</strong> {req.adminNote}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
