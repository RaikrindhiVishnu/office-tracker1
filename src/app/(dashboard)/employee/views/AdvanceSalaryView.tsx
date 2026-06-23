"use client";
import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

type AdvanceStatus = "Pending" | "Approved" | "Rejected" | "Disbursed";

interface AdvanceRequest {
  id: string;
  uid: string;
  employeeName: string;
  employeeEmail: string;
  amount: number;
  reason: string;
  repaymentMonths: number;
  status: AdvanceStatus;
  adminRemark?: string;
  disbursedDate?: string;
  createdAt: any;
}

function fmtCur(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n); }

export default function AdvanceSalaryView({ user }: { user: any }) {
  const [tab, setTab] = useState<"new" | "history">("history");
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "advanceSalary"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdvanceRequest)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!amount || amount <= 0) { setMsg({ type: "error", text: "Please enter a valid amount." }); return; }
    if (!reason.trim()) { setMsg({ type: "error", text: "Please enter a reason." }); return; }
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, "advanceSalary"), {
        uid: user.uid,
        employeeName: user.displayName || user.email?.split("@")[0],
        employeeEmail: user.email,
        amount: Number(amount),
        reason: reason.trim(),
        repaymentMonths: Number(repaymentMonths),
        status: "Pending",
        createdAt: serverTimestamp(),
      });
      setMsg({ type: "success", text: "Advance salary request submitted successfully!" });
      setAmount(""); setReason(""); setRepaymentMonths(1);
      setTimeout(() => setTab("history"), 1500);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to submit." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Advance Salary</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Request and track salary advances</p>
        </div>
        <button onClick={() => setTab("new")}
          style={{ padding: "10px 18px", background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Request Advance
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 24, gap: 4 }}>
        {(["history", "new"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", border: "none", background: "transparent",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            borderBottom: tab === t ? "2px solid #0ea5e9" : "2px solid transparent",
            color: tab === t ? "#0ea5e9" : "#64748b", marginBottom: -2,
          }}>
            {t === "new" ? "➕ New Request" : `📋 My Requests (${requests.length})`}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>Request Advance Salary</h2>
          {msg && (
            <div style={{ background: msg.type === "success" ? "#f0fdf4" : "#fff1f2", color: msg.type === "success" ? "#15803d" : "#881337", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>{msg.text}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Amount Needed (₹) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 50000" min={1000} required
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Repayment Schedule *</label>
              <select value={repaymentMonths} onChange={e => setRepaymentMonths(Number(e.target.value))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                <option value={1}>Deduct fully from next month's salary</option>
                <option value={2}>Deduct across 2 months</option>
                <option value={3}>Deduct across 3 months</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Reason for Advance *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why you need this advance" required rows={3}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical" }} />
            </div>

            <button type="submit" disabled={submitting}
              style={{ width: "100%", padding: "12px 24px", background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      )}

      {tab === "history" && (
        loading ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
        : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💸</div>
            <div style={{ fontWeight: 600 }}>No advance salary requests yet</div>
          </div>
        ) : requests.map(req => {
          return (
            <div key={req.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{fmtCur(req.amount)}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Repayment over {req.repaymentMonths} month{req.repaymentMonths > 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ 
                    background: req.status === "Approved" || req.status === "Disbursed" ? "#f0fdf4" : req.status === "Rejected" ? "#fff1f2" : "#eff6ff", 
                    color: req.status === "Approved" || req.status === "Disbursed" ? "#15803d" : req.status === "Rejected" ? "#881337" : "#1d4ed8", 
                    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 
                  }}>{req.status}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>
                    {new Date(req.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#475569" }}>
                <span className="font-semibold">Reason:</span> {req.reason}
              </div>
              {req.adminRemark && <div style={{ marginTop: 8, fontSize: 12, color: "#7c3aed", fontStyle: "italic" }}>Admin: {req.adminRemark}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
