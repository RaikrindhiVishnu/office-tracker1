"use client";
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

interface ExpenseClaim {
  id: string;
  uid: string;
  employeeName: string;
  employeeEmail: string;
  title: string;
  items: { description: string; amount: number; category: string; date: string }[];
  totalAmount: number;
  currency: string;
  status: string;
  submittedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  adminRemark?: string;
  paymentDate?: string;
  createdAt?: Timestamp | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Travel: "✈️", Food: "🍽️", Accommodation: "🏨", "Office Supplies": "📎",
  Communication: "📞", Training: "📚", Medical: "🏥", Miscellaneous: "📦"
};

function fmtCur(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n); }
function statusStyle(s?: string) {
  switch (s) {
    case "Approved": return { bg: "#f0fdf4", color: "#15803d" };
    case "Reimbursed": return { bg: "#ecfdf5", color: "#065f46" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    case "Submitted": return { bg: "#eff6ff", color: "#1d4ed8" };
    default: return { bg: "#f8fafc", color: "#64748b" };
  }
}
function avatar(name?: string) {
  const colors = ["#6366f1", "#db2777", "#059669", "#d97706", "#7c3aed", "#0284c7"];
  const c = colors[((name ?? "").charCodeAt(0) || 65) % colors.length];
  return { color: c, bg: c + "18", initials: (name ?? "?")[0]?.toUpperCase() ?? "?" };
}

export default function AdminExpenseView() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);
  const [adminRemark, setAdminRemark] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    const q = query(collection(db, "expenseClaims"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseClaim)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAction = async (newStatus: "Approved" | "Rejected" | "Reimbursed") => {
    if (!selected) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, "expenseClaims", selected.id), {
        status: newStatus,
        adminRemark,
        paymentDate: newStatus === "Reimbursed" ? paymentDate : null,
        reviewedAt: serverTimestamp(),
      });
      const title = newStatus === "Approved" ? "Expense Approved ✓" : newStatus === "Reimbursed" ? "Expense Reimbursed 💰" : "Expense Rejected";
      const msg = newStatus === "Approved"
        ? `Your expense claim "${selected.title}" of ${fmtCur(selected.totalAmount)} has been approved.`
        : newStatus === "Reimbursed"
        ? `Your expense claim "${selected.title}" of ${fmtCur(selected.totalAmount)} has been reimbursed${paymentDate ? ` on ${paymentDate}` : ""}.`
        : `Your expense claim "${selected.title}" was rejected.${adminRemark ? ` Reason: ${adminRemark}` : ""}`;
      triggerPushNotification(selected.uid, title, msg).catch(console.error);
      triggerEmailNotification(selected.uid, title, msg, newStatus === "Rejected" ? "error" : "success").catch(console.error);
      setSelected(null); setAdminRemark(""); setPaymentDate("");
    } catch (err) {
      alert("Failed to update expense claim."); console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = filter === "All" ? claims : claims.filter(c => c.status === filter);
  const totalPending = claims.filter(c => c.status === "Submitted").reduce((s, c) => s + c.totalAmount, 0);
  const totalApproved = claims.filter(c => c.status === "Approved" || c.status === "Reimbursed").reduce((s, c) => s + c.totalAmount, 0);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f8fafc" }}>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>Expense Management</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px 0" }}>Review and reimburse employee expense claims</p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Claims", v: claims.length, color: "#2563eb", bg: "#eff6ff" },
            { label: "Pending", v: claims.filter(c => c.status === "Submitted").length, color: "#d97706", bg: "#fffbeb" },
            { label: "Approved", v: claims.filter(c => c.status === "Approved").length, color: "#059669", bg: "#f0fdf4" },
            { label: "Pending Amount", v: fmtCur(totalPending), color: "#ea580c", bg: "#fff7ed", isStr: true },
            { label: "Paid Out", v: fmtCur(totalApproved), color: "#7c3aed", bg: "#ede9fe", isStr: true },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.color}20` }}>
              <div style={{ fontSize: (s as any).isStr ? 14 : 22, fontWeight: 800, color: s.color }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["All", "Submitted", "Approved", "Reimbursed", "Rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid",
              borderColor: filter === f ? "#2563eb" : "#e2e8f0",
              background: filter === f ? "#2563eb" : "#fff",
              color: filter === f ? "#fff" : "#64748b",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}>{f}</button>
          ))}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
            <div style={{ fontWeight: 600 }}>No {filter !== "All" ? filter : ""} expense claims</div>
          </div>
        ) : filtered.map(c => {
          const av = avatar(c.employeeName);
          const sc = statusStyle(c.status);
          return (
            <div key={c.id} onClick={() => { setSelected(c); setAdminRemark(c.adminRemark || ""); }}
              style={{ background: selected?.id === c.id ? "#eff6ff" : "#fff", borderRadius: 12, border: `1px solid ${selected?.id === c.id ? "#bfdbfe" : "#e2e8f0"}`, padding: 16, marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{av.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{c.employeeName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>🧾 {c.title}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ background: sc.bg, color: sc.color, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{c.status}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{fmtCur(c.totalAmount)}</span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {c.items.slice(0, 3).map((item, i) => (
                  <span key={i} style={{ background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 5, fontSize: 11 }}>
                    {CATEGORY_EMOJI[item.category] || "📦"} {item.description}
                  </span>
                ))}
                {c.items.length > 3 && <span style={{ fontSize: 11, color: "#94a3b8" }}>+{c.items.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {selected && (
        <div style={{ width: 400, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Expense Details</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{selected.employeeName}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Claim Title</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{selected.title}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Expense Items</div>
              {selected.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{CATEGORY_EMOJI[item.category]} {item.description}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.date} · {item.category}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{fmtCur(item.amount)}</div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: "#2563eb", fontSize: 18 }}>{fmtCur(selected.totalAmount)}</span>
              </div>
            </div>

            {selected.status === "Submitted" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Admin Remark</label>
                  <textarea value={adminRemark} onChange={e => setAdminRemark(e.target.value)} placeholder="Add a note (optional)"
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minHeight: 70, resize: "vertical" }} />
                </div>
              </>
            )}
            {selected.status === "Approved" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Payment Date</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              </div>
            )}
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}>
            {selected.status === "Submitted" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={processing} onClick={() => handleAction("Approved")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  ✓ Approve
                </button>
                <button disabled={processing} onClick={() => handleAction("Rejected")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  ✕ Reject
                </button>
              </div>
            )}
            {selected.status === "Approved" && (
              <button disabled={processing || !paymentDate} onClick={() => handleAction("Reimbursed")}
                style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (processing || !paymentDate) ? 0.6 : 1 }}>
                💰 Mark as Reimbursed
              </button>
            )}
            {(selected.status === "Rejected" || selected.status === "Reimbursed") && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13 }}>This claim has been {selected.status.toLowerCase()}.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
