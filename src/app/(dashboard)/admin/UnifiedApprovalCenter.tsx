"use client";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

type ApprovalType = "Leave" | "Regularization" | "Expense" | "Advance Salary" | "Purchase Request";

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  uid: string;
  employeeName: string;
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  createdAt: number;
  originalData: any;
}

export default function UnifiedApprovalCenter() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApprovalType | "All">("All");

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // 1. Leave Requests
    unsubs.push(onSnapshot(query(collection(db, "leaveRequests"), where("status", "==", "Pending")), snap => {
      const leaves = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: "Leave" as ApprovalType, uid: data.uid, employeeName: data.userName,
          title: `${data.leaveType} Leave`, subtitle: `${data.fromDate} to ${data.toDate}`,
          status: data.status, createdAt: data.createdAt?.toMillis() || 0, originalData: data
        };
      });
      updateItems("Leave", leaves);
    }));

    // 2. Regularizations
    unsubs.push(onSnapshot(query(collection(db, "attendance_regularization"), where("status", "==", "Pending")), snap => {
      const regs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: "Regularization" as ApprovalType, uid: data.uid, employeeName: data.userName || "Employee",
          title: "Attendance Regularization", subtitle: `Date: ${data.date}`,
          status: data.status, createdAt: data.createdAt?.toMillis() || 0, originalData: data
        };
      });
      updateItems("Regularization", regs);
    }));

    // 3. Expenses
    unsubs.push(onSnapshot(query(collection(db, "expenseClaims"), where("status", "==", "Submitted")), snap => {
      const exps = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: "Expense" as ApprovalType, uid: data.uid, employeeName: data.employeeName,
          title: data.title, subtitle: `${data.items?.length || 0} items`, amount: data.totalAmount,
          status: data.status, createdAt: data.createdAt?.toMillis() || 0, originalData: data
        };
      });
      updateItems("Expense", exps);
    }));

    // 4. Advance Salary
    unsubs.push(onSnapshot(query(collection(db, "advanceSalary"), where("status", "==", "Pending")), snap => {
      const advs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: "Advance Salary" as ApprovalType, uid: data.uid, employeeName: data.employeeName,
          title: "Advance Salary Request", subtitle: `Repayment: ${data.repaymentMonths} months`, amount: data.amount,
          status: data.status, createdAt: data.createdAt?.toMillis() || 0, originalData: data
        };
      });
      updateItems("Advance Salary", advs);
    }));

    // 5. Purchase Requests
    unsubs.push(onSnapshot(query(collection(db, "purchaseRequests"), where("status", "==", "Pending")), snap => {
      const purs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: "Purchase Request" as ApprovalType, uid: data.uid, employeeName: data.employeeName,
          title: data.itemName, subtitle: `Vendor: ${data.vendorName || "Any"} | Priority: ${data.priority}`, amount: data.estimatedCost,
          status: data.status, createdAt: data.createdAt?.toMillis() || 0, originalData: data
        };
      });
      updateItems("Purchase Request", purs);
    }));

    let allItems: ApprovalItem[] = [];
    const maps: Record<string, ApprovalItem[]> = {};

    function updateItems(type: string, newItems: ApprovalItem[]) {
      maps[type] = newItems;
      allItems = Object.values(maps).flat().sort((a, b) => b.createdAt - a.createdAt);
      setItems([...allItems]);
      setLoading(false);
    }

    return () => unsubs.forEach(u => u());
  }, []);

  const handleAction = async (item: ApprovalItem, action: "Approved" | "Rejected") => {
    try {
      let collectionName = "";
      let statusField = "status";
      let payload: any = { status: action };

      if (item.type === "Leave") { collectionName = "leaveRequests"; }
      else if (item.type === "Regularization") { collectionName = "attendance_regularization"; }
      else if (item.type === "Expense") { collectionName = "expenseClaims"; }
      else if (item.type === "Advance Salary") { collectionName = "advanceSalary"; }
      else if (item.type === "Purchase Request") { collectionName = "purchaseRequests"; }

      await updateDoc(doc(db, collectionName, item.id), payload);

      // Notification
      const title = `${item.type} ${action}`;
      const msg = `Your ${item.type} request "${item.title}" has been ${action.toLowerCase()}.`;
      triggerPushNotification(item.uid, title, msg).catch(console.error);
      triggerEmailNotification(item.uid, title, msg, action === "Rejected" ? "error" : "success").catch(console.error);

    } catch (err) {
      console.error(err);
      alert("Action failed.");
    }
  };

  const filteredItems = filter === "All" ? items : items.filter(i => i.type === filter);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>Unified Approval Center</h2>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px 0" }}>Approve Leave, Regularization, Expenses, and Salary Advances in one place.</p>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["All", "Leave", "Regularization", "Expense", "Advance Salary", "Purchase Request"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 20, border: "1px solid",
            borderColor: filter === f ? "#2563eb" : "#e2e8f0",
            background: filter === f ? "#2563eb" : "#fff",
            color: filter === f ? "#fff" : "#64748b",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 600 }}>All caught up!</div>
          <div style={{ fontSize: 12 }}>No pending approvals.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredItems.map(item => {
            const isMoney = item.type === "Expense" || item.type === "Advance Salary" || item.type === "Purchase Request";
            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {item.type === "Leave" ? "🌴" : item.type === "Regularization" ? "⏳" : item.type === "Expense" ? "🧾" : item.type === "Purchase Request" ? "📦" : "💸"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{item.employeeName}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 12 }}>{item.type}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2, fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.subtitle}</div>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {isMoney && (
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                      ₹{item.amount?.toLocaleString("en-IN")}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleAction(item, "Rejected")} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#fff1f2", color: "#e11d48", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Reject">
                      ✕
                    </button>
                    <button onClick={() => handleAction(item, "Approved")} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#f0fdf4", color: "#16a34a", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Approve">
                      ✓
                    </button>
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
