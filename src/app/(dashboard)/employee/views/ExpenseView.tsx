"use client";
import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

type ExpenseCategory = "Travel" | "Food" | "Accommodation" | "Office Supplies" | "Communication" | "Training" | "Medical" | "Miscellaneous";
type ExpenseStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Reimbursed";

interface ExpenseItem {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  receiptUrl?: string;
}

interface ExpenseClaim {
  id: string;
  uid: string;
  employeeName: string;
  employeeEmail: string;
  title: string;
  items: ExpenseItem[];
  totalAmount: number;
  currency: string;
  status: ExpenseStatus;
  submittedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  adminRemark?: string;
  paymentDate?: string;
  createdAt?: Timestamp | null;
}

const CATEGORIES: ExpenseCategory[] = ["Travel", "Food", "Accommodation", "Office Supplies", "Communication", "Training", "Medical", "Miscellaneous"];
const CATEGORY_EMOJI: Record<string, string> = {
  Travel: "✈️", Food: "🍽️", Accommodation: "🏨", "Office Supplies": "📎",
  Communication: "📞", Training: "📚", Medical: "🏥", Miscellaneous: "📦"
};

function fmtCur(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n); }
function statusColor(s?: string) {
  switch (s) {
    case "Approved": case "Reimbursed": return { bg: "#f0fdf4", color: "#15803d" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    case "Submitted": return { bg: "#eff6ff", color: "#1d4ed8" };
    case "Draft": return { bg: "#f8fafc", color: "#64748b" };
    default: return { bg: "#fffbeb", color: "#92400e" };
  }
}

export default function ExpenseView({ user }: { user: any }) {
  const [tab, setTab] = useState<"new" | "history">("history");
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ExpenseItem[]>([{ description: "", amount: 0, category: "Travel", date: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "expenseClaims"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseClaim)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const addItem = () => setItems([...items, { description: "", amount: 0, category: "Travel", date: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof ExpenseItem, val: any) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!title.trim()) { setMsg({ type: "error", text: "Please enter a claim title." }); return; }
    if (items.some(i => !i.description || !i.amount || !i.date)) {
      setMsg({ type: "error", text: "Please fill all expense item details." }); return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenseClaims"), {
        uid: user.uid,
        employeeName: user.displayName || user.email?.split("@")[0],
        employeeEmail: user.email,
        title: title.trim(),
        items,
        totalAmount,
        currency: "INR",
        status: "Submitted",
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setMsg({ type: "success", text: "Expense claim submitted successfully!" });
      setTitle(""); setItems([{ description: "", amount: 0, category: "Travel", date: "" }]);
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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Expense Claims</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Submit and track your business expense reimbursements</p>
        </div>
        <button onClick={() => setTab("new")}
          style={{ padding: "10px 18px", background: "linear-gradient(135deg,#2563eb,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + New Claim
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Submitted", value: claims.length, color: "#2563eb", bg: "#eff6ff" },
          { label: "Pending", value: claims.filter(c => c.status === "Submitted").length, color: "#d97706", bg: "#fffbeb" },
          { label: "Approved", value: claims.filter(c => c.status === "Approved" || c.status === "Reimbursed").length, color: "#059669", bg: "#f0fdf4" },
          { label: "Total Amount", value: fmtCur(claims.filter(c => c.status === "Approved" || c.status === "Reimbursed").reduce((s, c) => s + c.totalAmount, 0)), color: "#7c3aed", bg: "#ede9fe", isString: true },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.color}20` }}>
            <div style={{ fontSize: (s as any).isString ? 16 : 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 24, gap: 4 }}>
        {(["history", "new"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", border: "none", background: "transparent",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
            color: tab === t ? "#2563eb" : "#64748b", marginBottom: -2,
          }}>
            {t === "new" ? "➕ New Claim" : `📋 My Claims (${claims.length})`}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>Submit Expense Claim</h2>
          {msg && (
            <div style={{ background: msg.type === "success" ? "#f0fdf4" : "#fff1f2", color: msg.type === "success" ? "#15803d" : "#881337", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>{msg.text}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Claim Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Client Visit to Mumbai – June 2026"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Expense Items *</label>
                <button type="button" onClick={addItem} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add Item</button>
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Description" required
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12 }} />
                  <select value={item.category} onChange={e => updateItem(i, "category", e.target.value)}
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12 }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>)}
                  </select>
                  <input type="number" value={item.amount || ""} onChange={e => updateItem(i, "amount", Number(e.target.value))} placeholder="₹ Amount" required min={0}
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12 }} />
                  <input type="date" value={item.date} onChange={e => updateItem(i, "date", e.target.value)} required
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12 }} />
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, opacity: items.length === 1 ? 0.3 : 1 }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Total Claim Amount</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>{fmtCur(totalAmount)}</span>
            </div>

            <button type="submit" disabled={submitting}
              style={{ width: "100%", padding: "12px 24px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting..." : "Submit Expense Claim"}
            </button>
          </form>
        </div>
      )}

      {tab === "history" && (
        loading ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
        : claims.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
            <div style={{ fontWeight: 600 }}>No expense claims submitted yet</div>
            <button onClick={() => setTab("new")} style={{ marginTop: 12, padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Submit First Claim</button>
          </div>
        ) : claims.map(claim => {
          const sc = statusColor(claim.status);
          return (
            <div key={claim.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>🧾 {claim.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{claim.items.length} item{claim.items.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ background: sc.bg, color: sc.color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{claim.status}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{fmtCur(claim.totalAmount)}</span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {claim.items.map((item, i) => (
                  <span key={i} style={{ background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: 6, fontSize: 11 }}>
                    {CATEGORY_EMOJI[item.category]} {item.description} — {fmtCur(item.amount)}
                  </span>
                ))}
              </div>
              {claim.adminRemark && <div style={{ marginTop: 8, fontSize: 12, color: "#7c3aed", fontStyle: "italic" }}>Admin: {claim.adminRemark}</div>}
              {claim.status === "Reimbursed" && <div style={{ marginTop: 6, fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Reimbursed{claim.paymentDate ? ` on ${claim.paymentDate}` : ""}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
