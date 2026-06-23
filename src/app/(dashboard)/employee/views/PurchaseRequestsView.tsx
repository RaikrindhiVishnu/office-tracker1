"use client";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PurchaseRequest {
  id: string;
  uid: string;
  employeeName: string;
  itemName: string;
  vendorName: string;
  estimatedCost: number;
  priority: "Low" | "Medium" | "High";
  reason: string;
  status: "Pending" | "Approved" | "Ordered" | "Delivered" | "Rejected";
  createdAt: any;
}

function fmtCur(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n); }

export default function PurchaseRequestsView({ user }: { user: any }) {
  const [tab, setTab] = useState<"new" | "history">("history");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [itemName, setItemName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [estimatedCost, setEstimatedCost] = useState<number | "">("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [reason, setReason] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "purchaseRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!itemName || !estimatedCost || !reason) { setMsg({ type: "error", text: "Please fill all required fields." }); return; }
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, "purchaseRequests"), {
        uid: user.uid,
        employeeName: user.displayName || user.email?.split("@")[0],
        employeeEmail: user.email,
        itemName: itemName.trim(),
        vendorName: vendorName.trim(),
        estimatedCost: Number(estimatedCost),
        priority,
        reason: reason.trim(),
        status: "Pending",
        createdAt: serverTimestamp(),
      });
      setMsg({ type: "success", text: "Purchase request submitted successfully!" });
      setItemName(""); setVendorName(""); setEstimatedCost(""); setPriority("Medium"); setReason("");
      setTimeout(() => setTab("history"), 1500);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to submit." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Purchase Requests</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Request equipment, software, or office supplies</p>
        </div>
        <button onClick={() => setTab("new")}
          style={{ padding: "10px 18px", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + New Request
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 24, gap: 4 }}>
        {(["history", "new"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", border: "none", background: "transparent",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            borderBottom: tab === t ? "2px solid #f97316" : "2px solid transparent",
            color: tab === t ? "#f97316" : "#64748b", marginBottom: -2,
          }}>
            {t === "new" ? "➕ New Request" : `📋 My Requests (${requests.length})`}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>Submit Purchase Request</h2>
          {msg && (
            <div style={{ background: msg.type === "success" ? "#f0fdf4" : "#fff1f2", color: msg.type === "success" ? "#15803d" : "#881337", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>{msg.text}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Item Name *</label>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. MacBook Pro M3" required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Estimated Cost (₹) *</label>
                <input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 150000" min={1} required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Preferred Vendor (Optional)</label>
                <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g. Amazon / Dell"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High - Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Business Justification *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why do you need this?" required rows={3}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical" }} />
            </div>

            <button type="submit" disabled={submitting}
              style={{ width: "100%", padding: "12px 24px", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      )}

      {tab === "history" && (
        loading ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
        : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 600 }}>No purchase requests yet</div>
          </div>
        ) : requests.map(req => {
          return (
            <div key={req.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{req.itemName}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Vendor: {req.vendorName || "Not specified"} | Priority: {req.priority}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ 
                    background: req.status === "Approved" || req.status === "Delivered" ? "#f0fdf4" : req.status === "Rejected" ? "#fff1f2" : "#eff6ff", 
                    color: req.status === "Approved" || req.status === "Delivered" ? "#15803d" : req.status === "Rejected" ? "#881337" : "#1d4ed8", 
                    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 
                  }}>{req.status}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{fmtCur(req.estimatedCost)}</span>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 8 }}>
                <span className="font-semibold text-slate-700">Reason:</span> {req.reason}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
