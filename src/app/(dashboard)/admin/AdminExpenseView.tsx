"use client";
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, Timestamp, addDoc, getDocs, deleteDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

interface ExpenseItem {
  description: string;
  amount: number;
  category: string;
  date: string;
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
  status: string;
  submittedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  adminRemark?: string;
  paymentDate?: string;
  createdAt?: Timestamp | null;
}

interface PurchaseRequest {
  id: string;
  uid: string;
  employeeName: string;
  employeeEmail: string;
  itemName: string;
  vendorName: string;
  estimatedCost: number;
  priority: "Low" | "Medium" | "High";
  reason: string;
  expectedDate?: string;
  department?: string;
  quantity?: number;
  productLink?: string;
  images?: string[];
  status: "Pending" | "Approved" | "Ordered" | "Delivered" | "Rejected";
  createdAt: any;
}

interface UserOpt {
  uid: string;
  name: string;
  email: string;
}

const EXPENSE_CATEGORIES = ["Travel", "Food", "Accommodation", "Office Supplies", "Communication", "Training", "Medical", "Miscellaneous"];
const CATEGORY_EMOJI: Record<string, string> = {
  Travel: "✈️", Food: "🍽️", Accommodation: "🏨", "Office Supplies": "📎",
  Communication: "📞", Training: "📚", Medical: "🏥", Miscellaneous: "📦"
};

function fmtCur(n: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n); }

function expStatusStyle(s?: string) {
  switch (s) {
    case "Approved": return { bg: "#f0fdf4", color: "#15803d" };
    case "Reimbursed": return { bg: "#ecfdf5", color: "#065f46" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    case "Submitted": return { bg: "#eff6ff", color: "#1d4ed8" };
    default: return { bg: "#f8fafc", color: "#64748b" };
  }
}

function prStatusStyle(s?: string) {
  switch (s) {
    case "Approved": case "Delivered": return { bg: "#f0fdf4", color: "#15803d" };
    case "Ordered": return { bg: "#fef3c7", color: "#b45309" };
    case "Rejected": return { bg: "#fff1f2", color: "#881337" };
    case "Pending": return { bg: "#eff6ff", color: "#1d4ed8" };
    default: return { bg: "#f8fafc", color: "#64748b" };
  }
}

function avatar(name?: string) {
  const colors = ["#6366f1", "#db2777", "#059669", "#d97706", "#7c3aed", "#0284c7"];
  const c = colors[((name ?? "").charCodeAt(0) || 65) % colors.length];
  return { color: c, bg: c + "18", initials: (name ?? "?")[0]?.toUpperCase() ?? "?" };
}

export default function AdminExpenseView() {
  const [activeTab, setActiveTab] = useState<"Expenses" | "PurchaseRequests">("Expenses");
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer states
  const [selectedExpense, setSelectedExpense] = useState<ExpenseClaim | null>(null);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [editExTitle, setEditExTitle] = useState("");
  const [editExItems, setEditExItems] = useState<ExpenseItem[]>([]);

  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  
  // Action states
  const [adminRemark, setAdminRemark] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>("All");

  // Add Request States
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [addType, setAddType] = useState<"Expense" | "Purchase">("Expense");
  const [selectedUserUid, setSelectedUserUid] = useState<string>("");
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Add Expense form
  const [exTitle, setExTitle] = useState("");
  const [exItems, setExItems] = useState<ExpenseItem[]>([{ description: "", amount: 0, category: "Travel", date: "" }]);
  
  // Add Purchase form
  const [prItemName, setPrItemName] = useState("");
  const [prVendor, setPrVendor] = useState("");
  const [prCost, setPrCost] = useState<number | "">("");
  const [prPriority, setPrPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [prReason, setPrReason] = useState("");
  const [prDate, setPrDate] = useState("");
  const [prDept, setPrDept] = useState("");
  const [prQty, setPrQty] = useState<number | "">("");
  const [prLink, setPrLink] = useState("");
  const [prUploadedImages, setPrUploadedImages] = useState<string[]>([]);

  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      setUsers(snap.docs.map(d => ({
        uid: d.id,
        name: d.data().name || d.data().email?.split("@")[0] || "Unknown",
        email: d.data().email
      })));
    });
  }, []);

  useEffect(() => {
    const q1 = query(collection(db, "expenseClaims"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(q1, snap => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseClaim)));
      setLoading(false);
    });
    const q2 = query(collection(db, "purchaseRequests"), orderBy("createdAt", "desc"));
    const unsub2 = onSnapshot(q2, snap => {
      setPurchaseRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest)));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Action Handlers
  const handleExpenseAction = async (newStatus: "Approved" | "Rejected" | "Reimbursed") => {
    if (!selectedExpense) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, "expenseClaims", selectedExpense.id), {
        status: newStatus,
        adminRemark,
        paymentDate: newStatus === "Reimbursed" ? paymentDate : null,
        reviewedAt: serverTimestamp(),
      });
      const title = newStatus === "Approved" ? "Expense Approved ✓" : newStatus === "Reimbursed" ? "Expense Reimbursed 💰" : "Expense Rejected";
      const msg = newStatus === "Approved"
        ? `Your expense claim "${selectedExpense.title}" of ${fmtCur(selectedExpense.totalAmount)} has been approved.`
        : newStatus === "Reimbursed"
        ? `Your expense claim "${selectedExpense.title}" of ${fmtCur(selectedExpense.totalAmount)} has been reimbursed${paymentDate ? ` on ${paymentDate}` : ""}.`
        : `Your expense claim "${selectedExpense.title}" was rejected.${adminRemark ? ` Reason: ${adminRemark}` : ""}`;
      triggerPushNotification(selectedExpense.uid, title, msg).catch(console.error);
      triggerEmailNotification(selectedExpense.uid, title, msg, newStatus === "Rejected" ? "error" : "success").catch(console.error);
      setSelectedExpense(null); setAdminRemark(""); setPaymentDate("");
    } catch (err) {
      alert("Failed to update expense claim."); console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const startEditExpense = () => {
    if (!selectedExpense) return;
    setEditExTitle(selectedExpense.title);
    setEditExItems(JSON.parse(JSON.stringify(selectedExpense.items)));
    setIsEditingExpense(true);
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense) return;
    if (!editExTitle.trim() || editExItems.some(i => !i.description || !i.amount || !i.date)) {
      alert("Please fill all required fields correctly.");
      return;
    }
    setProcessing(true);
    try {
      const totalAmount = editExItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      await updateDoc(doc(db, "expenseClaims", selectedExpense.id), {
        title: editExTitle.trim(),
        items: editExItems,
        totalAmount,
      });
      // Update local state to reflect changes immediately
      setSelectedExpense({ ...selectedExpense, title: editExTitle.trim(), items: editExItems, totalAmount });
      setIsEditingExpense(false);
    } catch (err) {
      alert("Failed to update expense claim.");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchaseAction = async (newStatus: "Approved" | "Ordered" | "Delivered" | "Rejected") => {
    if (!selectedPR) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, "purchaseRequests", selectedPR.id), {
        status: newStatus,
        reviewedAt: serverTimestamp(),
      });
      let title = ""; let msg = "";
      if (newStatus === "Approved") { title = "Request Approved ✓"; msg = `Your request for ${selectedPR.itemName} was approved.`; }
      else if (newStatus === "Ordered") { title = "Item Ordered 📦"; msg = `Your requested item ${selectedPR.itemName} has been ordered.`; }
      else if (newStatus === "Delivered") { title = "Item Delivered 🎉"; msg = `Your requested item ${selectedPR.itemName} has been marked as delivered.`; }
      else if (newStatus === "Rejected") { title = "Request Rejected ✕"; msg = `Your request for ${selectedPR.itemName} was rejected.`; }
      
      triggerPushNotification(selectedPR.uid, title, msg).catch(console.error);
      triggerEmailNotification(selectedPR.uid, title, msg, newStatus === "Rejected" ? "error" : "success").catch(console.error);
      setSelectedPR(null);
    } catch (err) {
      alert("Failed to update purchase request."); console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (type: "Expense" | "Purchase", id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type === "Expense" ? "Expense Claim" : "Purchase Request"}?`)) return;
    try {
      if (type === "Expense") {
        await deleteDoc(doc(db, "expenseClaims", id));
        setSelectedExpense(null);
      } else {
        await deleteDoc(doc(db, "purchaseRequests", id));
        setSelectedPR(null);
      }
    } catch (err) {
      alert(`Failed to delete ${type.toLowerCase()}.`);
      console.error(err);
    }
  };

  // Add Handlers
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMsg(null);
    const user = users.find(u => u.uid === selectedUserUid);
    if (!user) { setAddMsg({ type: "error", text: "Please select an employee." }); return; }
    if (!exTitle.trim()) { setAddMsg({ type: "error", text: "Please enter a claim title." }); return; }
    if (exItems.some(i => !i.description || !i.amount || !i.date)) {
      setAddMsg({ type: "error", text: "Please fill all expense item details." }); return;
    }
    setSubmittingAdd(true);
    try {
      const totalAmount = exItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      await addDoc(collection(db, "expenseClaims"), {
        uid: user.uid,
        employeeName: user.name,
        employeeEmail: user.email,
        title: exTitle.trim(),
        items: exItems,
        totalAmount,
        currency: "INR",
        status: "Submitted",
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setAddMsg({ type: "success", text: "Expense claim added successfully!" });
      setTimeout(() => {
        setAddDrawerOpen(false);
        setExTitle(""); setExItems([{ description: "", amount: 0, category: "Travel", date: "" }]); setSelectedUserUid("");
        setAddMsg(null);
      }, 1000);
    } catch (err: any) {
      setAddMsg({ type: "error", text: err.message || "Failed to submit." });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMsg(null);
    const user = users.find(u => u.uid === selectedUserUid);
    if (!user) { setAddMsg({ type: "error", text: "Please select an employee." }); return; }
    if (!prItemName || !prCost || !prReason || !prDate) { setAddMsg({ type: "error", text: "Please fill all required fields." }); return; }
    
    setSubmittingAdd(true);
    try {

      await addDoc(collection(db, "purchaseRequests"), {
        uid: user.uid,
        employeeName: user.name,
        employeeEmail: user.email,
        itemName: prItemName.trim(),
        vendorName: prVendor.trim(),
        estimatedCost: Number(prCost),
        priority: prPriority,
        reason: prReason.trim(),
        expectedDate: prDate,
        department: prDept.trim(),
        quantity: prQty ? Number(prQty) : 1,
        productLink: prLink.trim(),
        images: prUploadedImages,
        status: "Pending",
        createdAt: serverTimestamp(),
      });
      setAddMsg({ type: "success", text: "Purchase request added successfully!" });
      setTimeout(() => {
        setAddDrawerOpen(false);
        setPrItemName(""); setPrVendor(""); setPrCost(""); setPrPriority("Medium"); setPrReason("");
        setPrDate(""); setPrDept(""); setPrQty(""); setPrLink(""); setPrUploadedImages([]); setSelectedUserUid("");
        setAddMsg(null);
      }, 1000);
    } catch (err: any) {
      setAddMsg({ type: "error", text: err.message || "Failed to submit." });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const filteredExpenses = filter === "All" ? claims : claims.filter(c => c.status === filter);
  const totalPending = claims.filter(c => c.status === "Submitted").reduce((s, c) => s + c.totalAmount, 0);
  const totalApproved = claims.filter(c => c.status === "Approved" || c.status === "Reimbursed").reduce((s, c) => s + c.totalAmount, 0);

  const pendingPRs = purchaseRequests.filter(r => r.status === "Pending").length;
  const approvedPRs = purchaseRequests.filter(r => r.status === "Approved").length;

  const totalPendingPRCost = purchaseRequests.filter(r => r.status === "Pending").reduce((s, r) => s + (r.estimatedCost || 0), 0);
  const totalApprovedPRCost = purchaseRequests.filter(r => r.status === "Approved" || r.status === "Ordered" || r.status === "Delivered").reduce((s, r) => s + (r.estimatedCost || 0), 0);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f8fafc" }}>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>Financial Requests</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Review expenses and purchase requests</p>
          </div>
          <button 
            onClick={() => setAddDrawerOpen(true)}
            style={{ padding: "10px 18px", background: "linear-gradient(135deg, #2563eb, #4f46e5)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>
            <svg style={{width: 16, height: 16}} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Request
          </button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={() => { setActiveTab("Expenses"); setSelectedExpense(null); setSelectedPR(null); }} style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
            color: activeTab === "Expenses" ? "#2563eb" : "#64748b", borderBottom: activeTab === "Expenses" ? "2px solid #2563eb" : "2px solid transparent",
            marginBottom: -1
          }}>Expenses ({claims.length})</button>
          <button onClick={() => { setActiveTab("PurchaseRequests"); setSelectedExpense(null); setSelectedPR(null); }} style={{
            padding: "10px 20px", border: "none", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
            color: activeTab === "PurchaseRequests" ? "#f97316" : "#64748b", borderBottom: activeTab === "PurchaseRequests" ? "2px solid #f97316" : "2px solid transparent",
            marginBottom: -1
          }}>Purchase Requests ({purchaseRequests.length})</button>
        </div>

        {activeTab === "Expenses" && (
          <>
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

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["All", "Submitted", "Approved", "Reimbursed", "Rejected"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "6px 14px", borderRadius: 20, border: "1px solid",
                  borderColor: filter === f ? "#2563eb" : "#e2e8f0", background: filter === f ? "#2563eb" : "#fff",
                  color: filter === f ? "#fff" : "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer",
                }}>{f}</button>
              ))}
            </div>

            {loading ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
            : filteredExpenses.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
                <div style={{ fontWeight: 600 }}>No {filter !== "All" ? filter : ""} expense claims</div>
              </div>
            ) : filteredExpenses.map(c => {
              const av = avatar(c.employeeName);
              const sc = expStatusStyle(c.status);
              return (
                <div key={c.id} onClick={() => { setSelectedExpense(c); setSelectedPR(null); setAdminRemark(c.adminRemark || ""); }}
                  style={{ background: selectedExpense?.id === c.id ? "#eff6ff" : "#fff", borderRadius: 12, border: `1px solid ${selectedExpense?.id === c.id ? "#bfdbfe" : "#e2e8f0"}`, padding: 16, marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}>
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
          </>
        )}

        {activeTab === "PurchaseRequests" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Requests", v: purchaseRequests.length, color: "#f97316", bg: "#fff7ed" },
                { label: "Pending", v: pendingPRs, color: "#d97706", bg: "#fffbeb" },
                { label: "Approved", v: approvedPRs, color: "#059669", bg: "#f0fdf4" },
                { label: "Ordered/Deliv", v: purchaseRequests.filter(r => r.status === "Ordered" || r.status === "Delivered").length, color: "#7c3aed", bg: "#ede9fe" },
                { label: "Pending Amt", v: fmtCur(totalPendingPRCost), color: "#ea580c", bg: "#fff7ed", isStr: true },
                { label: "Approved Amt", v: fmtCur(totalApprovedPRCost), color: "#10b981", bg: "#ecfdf5", isStr: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.color}20` }}>
                  <div style={{ fontSize: (s as any).isStr ? 14 : 22, fontWeight: 800, color: s.color }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loading ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
            : purchaseRequests.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                <div style={{ fontWeight: 600 }}>No purchase requests found</div>
              </div>
            ) : purchaseRequests.map(r => {
              const av = avatar(r.employeeName);
              const sc = prStatusStyle(r.status);
              return (
                <div key={r.id} onClick={() => { setSelectedPR(r); setSelectedExpense(null); }}
                  style={{ background: selectedPR?.id === r.id ? "#fff7ed" : "#fff", borderRadius: 12, border: `1px solid ${selectedPR?.id === r.id ? "#fed7aa" : "#e2e8f0"}`, padding: 16, marginBottom: 10, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{av.initials}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{r.employeeName}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>📦 {r.itemName}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{r.status}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{fmtCur(r.estimatedCost)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#475569" }}>
                    <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 5 }}>Priority: {r.priority}</span>
                    <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 5 }}>Req. by: {r.expectedDate}</span>
                    {r.vendorName && <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 5 }}>Vendor: {r.vendorName}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* EXPENSE DETAIL DRAWER */}
      {selectedExpense && (
        <div style={{ width: 420, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", animation: "slideIn 0.3s ease-out" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Expense Details</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{selectedExpense.employeeName}</div>
            </div>
            <button onClick={() => setSelectedExpense(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {isEditingExpense ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Claim Title *</label>
                  <input value={editExTitle} onChange={e => setEditExTitle(e.target.value)} required
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                </div>
                
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Expense Items *</div>
                {editExItems.map((item, i) => (
                  <div key={i} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12, background: "#f8fafc", position: "relative" }}>
                    {editExItems.length > 1 && (
                      <button type="button" onClick={() => setEditExItems(editExItems.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#ef4444", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                    )}
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>Description</label>
                      <input value={item.description} onChange={e => { const newItems = [...editExItems]; newItems[i].description = e.target.value; setEditExItems(newItems); }}
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} required />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>Amount (₹)</label>
                        <input type="number" value={item.amount || ""} onChange={e => { const newItems = [...editExItems]; newItems[i].amount = Number(e.target.value); setEditExItems(newItems); }}
                          style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} required />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>Category</label>
                        <select value={item.category} onChange={e => { const newItems = [...editExItems]; newItems[i].category = e.target.value; setEditExItems(newItems); }}
                          style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>Date</label>
                        <input type="date" value={item.date} onChange={e => { const newItems = [...editExItems]; newItems[i].date = e.target.value; setEditExItems(newItems); }}
                          style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} required />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setEditExItems([...editExItems, { description: "", amount: 0, category: "Travel", date: "" }])}
                  style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                  + Add Another Item
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Claim Title</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{selectedExpense.title}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Expense Items</div>
                  {selectedExpense.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{CATEGORY_EMOJI[item.category] || "📦"} {item.description}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.date} · {item.category}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{fmtCur(item.amount)}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontWeight: 800 }}>
                    <span>Total</span>
                    <span style={{ color: "#2563eb", fontSize: 18 }}>{fmtCur(selectedExpense.totalAmount)}</span>
                  </div>
                </div>

                {selectedExpense.status === "Submitted" && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Admin Remark</label>
                    <textarea value={adminRemark} onChange={e => setAdminRemark(e.target.value)} placeholder="Add a note (optional)"
                      style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minHeight: 70, resize: "vertical" }} />
                  </div>
                )}
                {selectedExpense.status === "Approved" && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Payment Date</label>
                    <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
            {isEditingExpense ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={processing} onClick={handleUpdateExpense}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  Save Changes
                </button>
                <button disabled={processing} onClick={() => setIsEditingExpense(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#64748b", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {selectedExpense.status === "Submitted" && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <button disabled={processing} onClick={() => handleExpenseAction("Approved")}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                      ✓ Approve
                    </button>
                    <button disabled={processing} onClick={() => handleExpenseAction("Rejected")}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                      ✕ Reject
                    </button>
                  </div>
                )}
                {selectedExpense.status === "Approved" && (
                  <button disabled={processing || !paymentDate} onClick={() => handleExpenseAction("Reimbursed")}
                    style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (processing || !paymentDate) ? 0.6 : 1, marginBottom: 12 }}>
                    💰 Mark as Reimbursed
                  </button>
                )}
                
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={startEditExpense}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #3b82f6", background: "transparent", color: "#3b82f6", fontWeight: 600, cursor: "pointer" }}>
                    Edit Request
                  </button>
                  <button onClick={() => handleDelete("Expense", selectedExpense.id)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 600, cursor: "pointer" }}>
                    Delete Request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PURCHASE REQUEST DETAIL DRAWER */}
      {selectedPR && (
        <div style={{ width: 420, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", animation: "slideIn 0.3s ease-out" }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Purchase Request</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{selectedPR.employeeName}</div>
            </div>
            <button onClick={() => setSelectedPR(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20, fontSize: 13, color: "#334155" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Item Name</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{selectedPR.itemName}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Est. Cost</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#2563eb" }}>{fmtCur(selectedPR.estimatedCost)}</div>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ marginBottom: 6 }}><strong>Vendor:</strong> {selectedPR.vendorName || "Any"}</div>
              <div style={{ marginBottom: 6 }}><strong>Priority:</strong> <span style={{ color: selectedPR.priority === "High" ? "#ef4444" : "#f97316", fontWeight: 600 }}>{selectedPR.priority}</span></div>
              <div style={{ marginBottom: 6 }}><strong>Req. Date:</strong> {selectedPR.expectedDate}</div>
              <div style={{ marginBottom: 6 }}><strong>Qty:</strong> {selectedPR.quantity || 1}</div>
              {selectedPR.department && <div style={{ marginBottom: 6 }}><strong>Dept:</strong> {selectedPR.department}</div>}
              {selectedPR.productLink && <div style={{ marginBottom: 6 }}><strong>Link:</strong> <a href={selectedPR.productLink} target="_blank" style={{ color: "#2563eb" }}>View Product</a></div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Reason / Justification</div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{selectedPR.reason}</p>
            </div>

            {selectedPR.images && selectedPR.images.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Attachments</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedPR.images.map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                      <img src={img} alt="attachment" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
            {selectedPR.status === "Pending" && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button disabled={processing} onClick={() => handlePurchaseAction("Approved")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  ✓ Approve
                </button>
                <button disabled={processing} onClick={() => handlePurchaseAction("Rejected")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1 }}>
                  ✕ Reject
                </button>
              </div>
            )}
            {selectedPR.status === "Approved" && (
              <button disabled={processing} onClick={() => handlePurchaseAction("Ordered")}
                style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1, marginBottom: 12 }}>
                📦 Mark as Ordered
              </button>
            )}
            {selectedPR.status === "Ordered" && (
              <button disabled={processing} onClick={() => handlePurchaseAction("Delivered")}
                style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: processing ? 0.6 : 1, marginBottom: 12 }}>
                🎉 Mark as Delivered
              </button>
            )}
            <button onClick={() => handleDelete("Purchase", selectedPR.id)}
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 600, cursor: "pointer" }}>
              Delete Request
            </button>
          </div>
        </div>
      )}

      {/* ADD REQUEST DRAWER */}
      {addDrawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.3)" }}>
          <div style={{ width: 500, background: "#fff", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", animation: "slideInRight 0.3s ease-out" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Request</h2>
              <button onClick={() => setAddDrawerOpen(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>
            
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", gap: 10, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
                <button onClick={() => setAddType("Expense")} style={{ flex: 1, padding: "8px 0", border: "none", background: addType === "Expense" ? "#fff" : "transparent", borderRadius: 6, fontWeight: 600, color: addType === "Expense" ? "#0f172a" : "#64748b", boxShadow: addType === "Expense" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", cursor: "pointer" }}>Expense Claim</button>
                <button onClick={() => setAddType("Purchase")} style={{ flex: 1, padding: "8px 0", border: "none", background: addType === "Purchase" ? "#fff" : "transparent", borderRadius: 6, fontWeight: 600, color: addType === "Purchase" ? "#0f172a" : "#64748b", boxShadow: addType === "Purchase" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", cursor: "pointer" }}>Purchase Request</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {addMsg && (
                <div style={{ background: addMsg.type === "success" ? "#f0fdf4" : "#fff1f2", color: addMsg.type === "success" ? "#15803d" : "#881337", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>{addMsg.text}</div>
              )}
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Employee (On behalf of) *</label>
                <select value={selectedUserUid} onChange={e => setSelectedUserUid(e.target.value)} required
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}>
                  <option value="">Select Employee</option>
                  {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>)}
                </select>
              </div>

              {addType === "Expense" ? (
                <form id="add-form" onSubmit={handleAddExpense}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Claim Title *</label>
                    <input value={exTitle} onChange={e => setExTitle(e.target.value)} placeholder="e.g. Client Visit" required
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Expense Items *</label>
                      <button type="button" onClick={() => setExItems([...exItems, { description: "", amount: 0, category: "Travel", date: "" }])} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add Item</button>
                    </div>
                    {exItems.map((item, i) => (
                      <div key={i} style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 10, border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <input value={item.description} onChange={e => { const newItems = [...exItems]; newItems[i].description = e.target.value; setExItems(newItems); }} placeholder="Description" required
                            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} />
                          <select value={item.category} onChange={e => { const newItems = [...exItems]; newItems[i].category = e.target.value; setExItems(newItems); }}
                            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "center" }}>
                          <input type="number" value={item.amount || ""} onChange={e => { const newItems = [...exItems]; newItems[i].amount = Number(e.target.value); setExItems(newItems); }} placeholder="₹ Amount" required min={0}
                            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} />
                          <input type="date" value={item.date} onChange={e => { const newItems = [...exItems]; newItems[i].date = e.target.value; setExItems(newItems); }} required
                            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }} />
                          <button type="button" onClick={() => { if (exItems.length > 1) setExItems(exItems.filter((_, idx) => idx !== i)); }}
                            style={{ background: "none", border: "none", cursor: exItems.length === 1 ? "not-allowed" : "pointer", color: "#ef4444", opacity: exItems.length === 1 ? 0.3 : 1 }}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ background: "#f0fdf4", color: "#15803d", padding: "10px 14px", borderRadius: 8, fontWeight: 700, display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                      <span>Total Amount:</span>
                      <span>{fmtCur(exItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</span>
                    </div>
                  </div>
                </form>
              ) : (
                <form id="add-form" onSubmit={handleAddPurchase}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Item Name *</label>
                      <input value={prItemName} onChange={e => setPrItemName(e.target.value)} placeholder="e.g. Laptop" required
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Est. Cost (₹) *</label>
                      <input type="number" value={prCost} onChange={e => setPrCost(e.target.value ? Number(e.target.value) : "")} min={1} required
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Vendor</label>
                      <input value={prVendor} onChange={e => setPrVendor(e.target.value)} placeholder="Optional"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Priority</label>
                      <select value={prPriority} onChange={e => setPrPriority(e.target.value as any)}
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High - Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Req. By Date *</label>
                      <input type="date" value={prDate} onChange={e => setPrDate(e.target.value)} required
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Quantity</label>
                      <input type="number" value={prQty} onChange={e => setPrQty(e.target.value ? Number(e.target.value) : "")} placeholder="1"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Department</label>
                      <input value={prDept} onChange={e => setPrDept(e.target.value)} placeholder="Optional"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Product Link</label>
                      <input type="url" value={prLink} onChange={e => setPrLink(e.target.value)} placeholder="Optional"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Upload Images (Optional)</label>
                    <input type="file" multiple accept="image/*" onChange={async e => {
                      const selected = e.target.files;
                      if (!selected) return;
                      const newFiles = Array.from(selected);
                      for (const file of newFiles) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new window.Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            let { width, height } = img;
                            const MAX_DIM = 800;
                            if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
                            else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext("2d");
                            ctx?.drawImage(img, 0, 0, width, height);
                            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                            setPrUploadedImages(prev => [...prev, compressedBase64]);
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                      style={{ width: "100%", padding: "10px 12px", border: "1px dashed #cbd5e1", borderRadius: 8, fontSize: 13, background: "#f8fafc" }} />
                    {prUploadedImages.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {prUploadedImages.map((img, i) => (
                          <div key={i} style={{ position: "relative" }}>
                            <img src={img} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                            <button type="button" onClick={() => setPrUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                              style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Reason / Justification *</label>
                    <textarea value={prReason} onChange={e => setPrReason(e.target.value)} required rows={3}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, resize: "vertical" }} />
                  </div>
                </form>
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
              <button type="submit" form="add-form" disabled={submittingAdd}
                style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: submittingAdd ? "not-allowed" : "pointer", opacity: submittingAdd ? 0.7 : 1 }}>
                {submittingAdd ? "Submitting..." : `Submit ${addType} Request`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
