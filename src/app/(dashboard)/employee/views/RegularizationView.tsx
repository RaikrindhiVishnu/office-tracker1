"use client";
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { triggerEmailNotification, triggerWhatsAppNotification } from "@/lib/notifications";
import { RegularizationRequestType, AttendanceRegularization } from "@/types/regularization";

export default function RegularizationView({ user }: { user: any }) {
  const [requests, setRequests] = useState<AttendanceRegularization[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"history" | "new">("history");

  const [date, setDate] = useState("");
  const [type, setType] = useState<RegularizationRequestType>("Missing Check-In");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    
    // In our rules we used companies/{companyId}/attendance_regularization 
    // BUT the legacy rule open it up directly under /attendance_regularization 
    // We will use the root level collection `attendance_regularization` for simplicity if not multi-tenant strictly, 
    // or we check how leaveRequests is done. Leave requests use `leaveRequests` root collection.
    // Let's use `attendance_regularization` at root.
    const q = query(
      collection(db, "attendance_regularization"),
      where("employeeId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceRegularization[];
      setRequests(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!date || !reason) {
      setErrorMsg("Please fill in the date and reason.");
      return;
    }

    if ((type === "Missing Check-In" || type === "Late Arrival") && !checkIn) {
      setErrorMsg("Please provide check-in time.");
      return;
    }
    if ((type === "Missing Check-Out" || type === "Early Exit") && !checkOut) {
      setErrorMsg("Please provide check-out time.");
      return;
    }
    if ((type === "Both Missing" || type === "Wrong Timing") && (!checkIn || !checkOut)) {
      setErrorMsg("Please provide both check-in and check-out times.");
      return;
    }

    // Validate Date: Max 3 days back, no future
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate >= today) {
      setErrorMsg("You can only request regularization for previous dates.");
      return;
    }

    const diffTime = Math.abs(today.getTime() - selectedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays > 3) {
      setErrorMsg("You cannot request regularization for dates older than 3 days.");
      return;
    }

    // Check if request already exists for this date
    const existing = requests.find(r => r.attendanceDate === date);
    if (existing) {
      setErrorMsg("You have already submitted a request for this date.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "attendance_regularization"), {
        companyId: user.companyId || "default",
        employeeId: user.uid,
        employeeName: user.email?.split("@")[0] || "Unknown",
        attendanceDate: date,
        requestType: type,
        requestedCheckIn: checkIn,
        requestedCheckOut: checkOut,
        reason: reason,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      setSuccessMsg("Regularization request submitted successfully.");
      
      // Notify Admins
      try {
        const adminsSnapshot = await getDocs(query(collection(db, "users"), where("accountType", "==", "ADMIN")));
        const adminsData = adminsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        for (const admin of adminsData) {
          if (admin.email) {
            triggerEmailNotification(
              admin.id,
              `New Attendance Regularization: ${user.email?.split("@")[0]}`,
              `A new regularization request has been submitted.\n\nDate: ${date}\nType: ${type}\nReason: ${reason}\n\nPlease review it in the Admin Dashboard.`
            );
          }
        }
      } catch (err) {
        console.error("Failed to notify admins", err);
      }

      setTimeout(() => {
        setViewMode("history");
        setDate("");
        setCheckIn("");
        setCheckOut("");
        setReason("");
        setType("Missing Check-In");
        setSuccessMsg("");
      }, 2000);

    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-100 text-green-800";
      case "Rejected": return "bg-red-100 text-red-800";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance Regularization</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === "history" 
                ? "bg-gray-200 text-gray-900 shadow-sm" 
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Request History
          </button>
          <button
            onClick={() => setViewMode("new")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === "new" 
                ? "bg-blue-600 text-white shadow-sm" 
                : "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
            }`}
          >
            New Request
          </button>
        </div>
      </div>

      {viewMode === "new" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Submit Regularization Request</h2>
          {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{errorMsg}</div>}
          {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{successMsg}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attendance Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum 3 days back. No future dates.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as RegularizationRequestType)}
                  className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Missing Check-In">Missing Check-In</option>
                  <option value="Missing Check-Out">Missing Check-Out</option>
                  <option value="Both Missing">Both Missing</option>
                  <option value="Wrong Timing">Wrong Timing</option>
                  <option value="Late Arrival">Late Arrival</option>
                  <option value="Early Exit">Early Exit</option>
                </select>
              </div>

              {(type === "Missing Check-In" || type === "Both Missing" || type === "Wrong Timing" || type === "Late Arrival") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested Check-In Time</label>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    required
                    className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {(type === "Missing Check-Out" || type === "Both Missing" || type === "Wrong Timing" || type === "Early Exit") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested Check-Out Time</label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                    className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly explain the reason for this request..."
                className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[#282B3E] text-white rounded-lg hover:bg-opacity-90 font-medium transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewMode === "history" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Request History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Requested Times</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading requests...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No regularization requests found.</td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 whitespace-nowrap">{req.attendanceDate}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">
                          {req.requestType}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-xs">
                          {req.requestedCheckIn && <div>In: <span className="font-semibold">{req.requestedCheckIn}</span></div>}
                          {req.requestedCheckOut && <div>Out: <span className="font-semibold">{req.requestedCheckOut}</span></div>}
                        </div>
                      </td>
                      <td className="p-4 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs truncate text-xs text-gray-500" title={req.adminRemarks}>
                        {req.adminRemarks || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
