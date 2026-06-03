// src/components/mobile/MobileQuickApprovals.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/leaveActions";
import { LeaveRequest } from "@/types/leave";
import { Check, X, Clipboard, ShieldCheck, CornerDownRight, Loader2 } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export const MobileQuickApprovals: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen to pending requests
    const q = query(collection(db, "requests"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as LeaveRequest))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Quick approvals listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleApprove = async (req: LeaveRequest) => {
    if (!user) return;
    setProcessingId(req.id);
    try {
      const res = await approveLeaveRequest(req, user.uid);
      if (res.success) {
        showToast({
          title: "Leave Request Approved ✓",
          message: `${req.employeeName}'s leave has been approved.`,
          category: "leave",
          priority: "medium",
        });
      } else {
        alert(res.error || "Failed to approve request");
      }
    } catch (e: any) {
      alert(e.message || "Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (req: LeaveRequest) => {
    if (!user) return;
    setProcessingId(req.id);
    try {
      const res = await rejectLeaveRequest(req, user.uid, rejectionReason);
      if (res.success) {
        showToast({
          title: "Leave Request Rejected ✕",
          message: `${req.employeeName}'s leave has been rejected.`,
          category: "leave",
          priority: "medium",
        });
        setRejectingId(null);
        setRejectionReason("");
      } else {
        alert(res.error || "Failed to reject request");
      }
    } catch (e: any) {
      alert(e.message || "Rejection failed");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="text-center text-xs text-gray-400 py-6 animate-pulse">Loading pending approvals...</div>;
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
        Quick Approvals
      </h3>

      <div className="flex flex-col gap-4">
        {requests.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">All caught up!</p>
            <p className="text-[10px] text-gray-400 mt-0.5">No pending leaves to approve.</p>
          </div>
        ) : (
          requests.map((req) => {
            const isProcessing = processingId === req.id;
            const isRejecting = rejectingId === req.id;

            return (
              <div
                key={req.id}
                className="flex flex-col p-4 bg-gray-50/50 border border-gray-50 rounded-2xl gap-3 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{req.employeeName}</h4>
                    <p className="text-[10px] text-gray-500 mt-1 capitalize">
                      {req.leaveType} leave · {req.totalDays} {req.totalDays === 1 ? "day" : "days"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                      Dates: {req.fromDate} to {req.toDate}
                    </p>
                    {req.reason && (
                      <p className="text-[10px] text-gray-500 mt-2 italic bg-white p-2 rounded-lg border border-gray-100/50">
                        "{req.reason}"
                      </p>
                    )}
                  </div>
                </div>

                {isRejecting && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                    <textarea
                      placeholder="Specify rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <div className="flex gap-2 self-end">
                      <button
                        onClick={() => handleRejectSubmit(req)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold shadow-sm"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason("");
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!isRejecting && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100/50">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(req.id)}
                      disabled={isProcessing}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
