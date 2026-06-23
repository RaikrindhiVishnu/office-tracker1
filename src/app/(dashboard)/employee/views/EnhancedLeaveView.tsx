"use client";
import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";
import { Palmtree, Thermometer, Plane, Home, Scale, Clock } from "lucide-react";

type LeaveType = "Casual" | "Sick" | "Annual" | "Work From Home" | "Comp Off" | "Half Day";
type HalfDaySlot = "AM" | "PM";
type Status = "Pending" | "Approved" | "Rejected" | "Cancelled";

interface LeaveBalance { casual: number; sick: number; annual: number; compOff: number; }
interface LeaveRequest {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  halfDaySlot?: HalfDaySlot;
  reason: string;
  status: Status;
  createdAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  adminRemark?: string;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function getDays(from?: string, to?: string, isHalf = false) {
  if (isHalf) return 0.5;
  if (!from || !to) return 1;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  return d >= 0 ? d + 1 : 1;
}
function statusColor(s?: string) {
  switch (s) {
    case "Approved": return { bg: "#f0fdf4", color: "#15803d" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    case "Cancelled": return { bg: "#f1f5f9", color: "#475569" };
    default: return { bg: "#fffbeb", color: "#92400e" };
  }
}

const LEAVE_TYPES: LeaveType[] = ["Casual", "Sick", "Annual", "Work From Home", "Comp Off", "Half Day"];
const LEAVE_ICONS: Record<string, React.ReactNode> = {
  Casual: <Palmtree size={16} />,
  Sick: <Thermometer size={16} />,
  Annual: <Plane size={16} />,
  "Work From Home": <Home size={16} />,
  "Comp Off": <Scale size={16} />,
  "Half Day": <Clock size={16} />
};

export default function EnhancedLeaveRequestView({ user }: { user: any }) {
  const [tab, setTab] = useState<"request" | "history">("request");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>({ casual: 12, sick: 6, annual: 15, compOff: 0 });
  const [loading, setLoading] = useState(true);

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>("Casual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [halfDaySlot, setHalfDaySlot] = useState<HalfDaySlot>("AM");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isHalfDay = leaveType === "Half Day";

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "leaveRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "leaveBalances", user.uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setBalance({
          casual: d.casual ?? 12,
          sick: d.sick ?? 6,
          annual: d.annual ?? 15,
          compOff: d.compOff ?? 0,
        });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!fromDate || !reason.trim()) { setMsg({ type: "error", text: "Please fill all required fields." }); return; }
    if (!isHalfDay && !toDate) { setMsg({ type: "error", text: "Please select an end date." }); return; }

    const days = getDays(fromDate, isHalfDay ? fromDate : toDate, isHalfDay);

    // Check for duplicate
    const overlap = requests.find(r =>
      r.status !== "Rejected" && r.status !== "Cancelled" &&
      r.fromDate === fromDate && r.leaveType === leaveType
    );
    if (overlap) { setMsg({ type: "error", text: "You already have a request for this date." }); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "leaveRequests"), {
        uid: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "Unknown",
        userEmail: user.email,
        department: user.department || "",
        leaveType,
        fromDate,
        toDate: isHalfDay ? fromDate : toDate,
        halfDaySlot: isHalfDay ? halfDaySlot : null,
        days,
        reason: reason.trim(),
        status: "Pending",
        createdAt: serverTimestamp(),
      });
      setMsg({ type: "success", text: `${leaveType} request submitted successfully.` });
      setFromDate(""); setToDate(""); setReason(""); setLeaveType("Casual");
      setTimeout(() => setTab("history"), 1500);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to submit request." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (req: LeaveRequest) => {
    if (!confirm("Cancel this leave request?")) return;
    await updateDoc(doc(db, "leaveRequests", req.id), {
      status: "Cancelled",
      cancelledAt: serverTimestamp(),
    });
  };

  const usedBalance = (type: LeaveType) => {
    return requests
      .filter(r => r.leaveType === type && r.status === "Approved")
      .reduce((sum, r) => sum + getDays(r.fromDate, r.toDate, r.leaveType === "Half Day"), 0);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 24, gap: 4 }}>
        {(["request", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", border: "none", background: "transparent",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
            color: tab === t ? "#2563eb" : "#64748b", marginBottom: -2,
          }}>
            {t === "request" ? "📋 New Request" : `📜 My History (${requests.length})`}
          </button>
        ))}
      </div>

      {tab === "request" && (
        <div style={{ display: "flex", gap: 24, alignItems: "stretch", flexWrap: "wrap", minHeight: 400 }}>
          <div style={{ flex: "1 1 500px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, display: "flex", flexDirection: "column" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Apply for Leave</h2>
            {msg && (
              <div style={{ background: msg.type === "success" ? "#f0fdf4" : "#fff1f2", color: msg.type === "success" ? "#15803d" : "#881337", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
                {msg.text}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {/* Leave Type */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Leave Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {LEAVE_TYPES.map(lt => (
                    <button key={lt} type="button" onClick={() => setLeaveType(lt)} style={{
                      padding: "10px 8px", borderRadius: 10, border: "2px solid",
                      borderColor: leaveType === lt ? "#2563eb" : "#e2e8f0",
                      background: leaveType === lt ? "#eff6ff" : "#fff",
                      color: leaveType === lt ? "#2563eb" : "#374151",
                      fontWeight: 600, fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      {LEAVE_ICONS[lt]} {lt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: isHalfDay ? "1fr 1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                    {isHalfDay ? "Date" : "From Date"}
                  </label>
                  <input type="date" required value={fromDate} onChange={e => { setFromDate(e.target.value); if (isHalfDay) setToDate(e.target.value); }}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
                {isHalfDay ? (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Half Day Slot</label>
                    <select value={halfDaySlot} onChange={e => setHalfDaySlot(e.target.value as HalfDaySlot)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                      <option value="AM">🌅 First Half (AM)</option>
                      <option value="PM">🌆 Second Half (PM)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>To Date</label>
                    <input type="date" required={!isHalfDay} min={fromDate} value={toDate} onChange={e => setToDate(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                  </div>
                )}
              </div>

              {fromDate && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                  📆 Duration: <strong>{getDays(fromDate, isHalfDay ? fromDate : toDate, isHalfDay)} day{getDays(fromDate, isHalfDay ? fromDate : toDate, isHalfDay) !== 1 ? "s" : ""}</strong>
                  {isHalfDay ? ` (${halfDaySlot})` : ""}
                </div>
              )}

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Reason *</label>
                <textarea required value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Brief reason for leave..."
                  style={{ width: "100%", flex: 1, minHeight: 120, padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical" }} />
              </div>

              <button type="submit" disabled={submitting}
                style={{ padding: "12px 24px", marginTop: "auto", background: "linear-gradient(135deg,#2563eb,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Submitting..." : "Submit Leave Request"}
              </button>
            </form>
          </div>

          <div style={{ width: 280, flexShrink: 0, background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#334155" }}>Leave Balances</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {[
                { label: "Casual", total: balance.casual, type: "Casual" as LeaveType, color: "#2563eb", bg: "#eff6ff" },
                { label: "Sick", total: balance.sick, type: "Sick" as LeaveType, color: "#ea580c", bg: "#fff7ed" },
                { label: "Annual", total: balance.annual, type: "Annual" as LeaveType, color: "#7c3aed", bg: "#ede9fe" },
                { label: "Comp Off", total: balance.compOff, type: "Comp Off" as LeaveType, color: "#0891b2", bg: "#ecfeff" },
              ].map(b => {
                const used = usedBalance(b.type);
                const avail = Math.max(0, b.total - used);
                return (
                  <div key={b.label} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>{LEAVE_ICONS[b.type]}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{b.label}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{used} / {b.total} Used</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: b.color }}>{avail}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600 }}>No leave requests yet</div>
            </div>
          ) : requests.map(r => {
            const sc = statusColor(r.status);
            return (
              <div key={r.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                      {LEAVE_ICONS[r.leaveType]} {r.leaveType}
                      {r.halfDaySlot ? ` (${r.halfDaySlot})` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      {fmtDate(r.fromDate)}{!r.halfDaySlot && r.toDate && r.toDate !== r.fromDate ? ` → ${fmtDate(r.toDate)}` : ""} · {getDays(r.fromDate, r.toDate, r.leaveType === "Half Day")} day{getDays(r.fromDate, r.toDate, r.leaveType === "Half Day") !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{r.reason}</div>
                    {r.adminRemark && <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, fontStyle: "italic" }}>Admin: {r.adminRemark}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ background: sc.bg, color: sc.color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{r.status}</span>
                    {r.status === "Pending" && (
                      <button onClick={() => handleCancel(r)}
                        style={{ background: "none", border: "1px solid #fca5a5", color: "#dc2626", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
