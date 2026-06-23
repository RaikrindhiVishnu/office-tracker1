"use client";

import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, getDoc, setDoc, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AttendanceRegularization, RegularizationStatus } from "@/types/regularization";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

function getStatusColor(status: string) {
  switch (status) {
    case "Pending": return { bg: "#fffbeb", color: "#92400e" };
    case "Approved": return { bg: "#f0fdf4", color: "#14532d" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    default: return { bg: "#f1f5f9", color: "#475569" };
  }
}

// Convert "HH:mm" to Firestore Timestamp for the given date
function timeStringToTimestamp(dateStr: string, timeStr: string): Timestamp | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return Timestamp.fromDate(date);
}

export default function AdminRegularizationRequestsView() {
  const [requests, setRequests] = useState<AttendanceRegularization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttendanceRegularization | null>(null);
  const [adminRemark, setAdminRemark] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "attendance_regularization"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRegularization));
      setRequests(data);
      setLoading(false);
      setSelected(prev => prev ? data.find(r => r.id === prev.id) ?? null : null);
    });
    return () => unsub();
  }, []);

  const handleUpdateStatus = async (status: RegularizationStatus) => {
    if (!selected || !selected.id) return;
    setProcessing(true);
    try {
      const isApproved = status === "Approved";

      // If approved, update attendance collection
      if (isApproved) {
        const attendanceId = `${selected.employeeId}_${selected.attendanceDate}`;
        const attRef = doc(db, "attendance", attendanceId);
        const attSnap = await getDoc(attRef);

        const newCheckIn = selected.requestedCheckIn ? timeStringToTimestamp(selected.attendanceDate, selected.requestedCheckIn) : null;
        const newCheckOut = selected.requestedCheckOut ? timeStringToTimestamp(selected.attendanceDate, selected.requestedCheckOut) : null;

        if (attSnap.exists()) {
          const data = attSnap.data();
          const sessions = data.sessions || [];
          if (sessions.length > 0) {
            if (newCheckIn) sessions[0].checkIn = newCheckIn;
            if (newCheckOut) sessions[0].checkOut = newCheckOut;
            // Recalculate duration if both exist
            if (sessions[0].checkIn && sessions[0].checkOut) {
              const start = sessions[0].checkIn.toDate();
              const end = sessions[0].checkOut.toDate();
              sessions[0].durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
            }
          } else {
            sessions.push({
              checkIn: newCheckIn,
              checkOut: newCheckOut,
              durationMinutes: (newCheckIn && newCheckOut) ? Math.floor((newCheckOut.toDate().getTime() - newCheckIn.toDate().getTime()) / 60000) : 0
            });
          }
          await updateDoc(attRef, { sessions });
        } else {
          // Create new record
          const session = {
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            durationMinutes: (newCheckIn && newCheckOut) ? Math.floor((newCheckOut.toDate().getTime() - newCheckIn.toDate().getTime()) / 60000) : 0
          };
          await setDoc(attRef, {
            userId: selected.employeeId,
            date: selected.attendanceDate,
            sessions: [session],
            totalMinutes: session.durationMinutes
          });
        }
      }

      await updateDoc(doc(db, "attendance_regularization", selected.id), {
        status,
        adminRemarks: adminRemark,
        reviewedAt: serverTimestamp(),
      });

      // Notify the employee
      try {
        const title = isApproved ? "Regularization Approved ✓" : "Regularization Rejected";
        const message = isApproved 
          ? `Your attendance regularization request for ${selected.attendanceDate} has been approved.` 
          : `Your attendance regularization request for ${selected.attendanceDate} has been rejected.`;
        
        triggerPushNotification(selected.employeeId, title, message).catch(console.error);
        triggerEmailNotification(
          selected.employeeId, 
          title, 
          message + (adminRemark ? `\n\nAdmin Remark: ${adminRemark}` : ""),
          isApproved ? "success" : "error"
        ).catch(console.error);
      } catch (e) {
        console.error("Failed to send notification", e);
      }

      setSelected(null);
      setAdminRemark("");
    } catch (err) {
      console.error("Failed to process request:", err);
      alert("Failed to process the request.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 24, fontFamily: "Inter, sans-serif" }}>Loading requests...</div>;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "Inter, sans-serif", background: "#f8fafc" }}>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px 0" }}>Regularization Requests</h2>
        
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Employee</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Date</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Type</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Requested Times</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0", maxWidth: 220 }}>Reason</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const c = getStatusColor(r.status);
                return (
                  <tr 
                    key={r.id} 
                    onClick={() => setSelected(r)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selected?.id === r.id ? "#eff6ff" : "transparent" }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>{r.employeeName}</td>
                    <td style={{ padding: "12px 16px" }}>{new Date(r.attendanceDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{r.requestType}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                        {r.requestedCheckIn && (
                          <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>In: {r.requestedCheckIn}</span>
                        )}
                        {r.requestedCheckOut && (
                          <span style={{ background: "#f0fdf4", color: "#15803d", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Out: {r.requestedCheckOut}</span>
                        )}
                        {!r.requestedCheckIn && !r.requestedCheckOut && <span style={{ color: "#94a3b8" }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 220 }}>
                      <div style={{ fontSize: 12, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={r.reason}>
                        {r.reason || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: c.bg, color: c.color, padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                        style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>No requests found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ width: 380, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Request Details</h3>
            <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#64748b" }}>&times;</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Employee</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.employeeName}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Attendance Date</div>
              <div style={{ fontSize: 14 }}>{new Date(selected.attendanceDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Request Type</div>
              <div style={{ fontSize: 14, background: "#f8fafc", padding: "6px 10px", borderRadius: 6, display: "inline-block" }}>{selected.requestType}</div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Requested In</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.requestedCheckIn || "—"}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Requested Out</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.requestedCheckOut || "—"}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Reason</div>
              <div style={{ fontSize: 13, background: "#f1f5f9", padding: 12, borderRadius: 8, color: "#334155" }}>{selected.reason}</div>
            </div>

            {selected.status === "Pending" ? (
              <div style={{ marginTop: "auto" }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Admin Remark</label>
                  <textarea 
                    value={adminRemark}
                    onChange={(e) => setAdminRemark(e.target.value)}
                    placeholder="Enter remark (optional)"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minHeight: 80, resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button 
                    disabled={processing}
                    onClick={() => handleUpdateStatus("Approved")}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 600, cursor: processing ? "not-allowed" : "pointer" }}
                  >
                    Approve
                  </button>
                  <button 
                    disabled={processing}
                    onClick={() => handleUpdateStatus("Rejected")}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 600, cursor: processing ? "not-allowed" : "pointer" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "auto" }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Admin Remark</div>
                <div style={{ fontSize: 13, background: selected.status === "Approved" ? "#f0fdf4" : "#fff1f2", color: selected.status === "Approved" ? "#14532d" : "#881337", padding: 12, borderRadius: 8 }}>
                  {selected.adminRemarks || "No remark provided."}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
