"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BudgetItem {
  category: string;
  amount: number;
}

export default function AdminBudgetTracking() {
  const [loading, setLoading] = useState(false);
  const [monthStr, setMonthStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const itemsMap: Record<string, number> = {
        "Payroll": 0,
        "Reimbursements (Expenses)": 0,
        "Purchase Requests": 0,
        "Salary Advances": 0,
      };

      // 1. Payroll
      const qPay = query(collection(db, "payslips"), where("monthStr", "==", monthStr));
      const snapPay = await getDocs(qPay);
      snapPay.forEach(doc => { itemsMap["Payroll"] += doc.data().grossSalary || 0; });

      // 2. Reimbursements
      const qExp = query(collection(db, "expenseClaims"), where("status", "in", ["Approved", "Paid"]));
      const snapExp = await getDocs(qExp);
      snapExp.forEach(doc => {
        const d = doc.data();
        if (d.createdAt?.toDate().toISOString().startsWith(monthStr)) {
          itemsMap["Reimbursements (Expenses)"] += d.totalAmount || 0;
        }
      });

      // 3. Purchase Requests
      const qPur = query(collection(db, "purchaseRequests"), where("status", "in", ["Approved", "Ordered", "Delivered"]));
      const snapPur = await getDocs(qPur);
      snapPur.forEach(doc => {
        const d = doc.data();
        if (d.createdAt?.toDate().toISOString().startsWith(monthStr)) {
          itemsMap["Purchase Requests"] += d.estimatedCost || 0;
        }
      });

      // 4. Advances
      const qAdv = query(collection(db, "advanceSalary"), where("status", "==", "Approved"));
      const snapAdv = await getDocs(qAdv);
      snapAdv.forEach(doc => {
        const d = doc.data();
        if (d.createdAt?.toDate().toISOString().startsWith(monthStr)) {
          itemsMap["Salary Advances"] += d.amount || 0;
        }
      });

      const items = Object.entries(itemsMap).map(([category, amount]) => ({ category, amount }));
      setBudgetItems(items);
      setTotalSpent(items.reduce((a, b) => a + b.amount, 0));

    } catch (err) {
      console.error("Budget tracking error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthStr]);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Budget & Expense Tracking</h2>
          <p style={{ color: "#64748b", marginTop: 4 }}>Monitor company spending across payroll, expenses, and purchases.</p>
        </div>
        <div>
          <input 
            type="month" 
            value={monthStr} 
            onChange={e => setMonthStr(e.target.value)} 
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 32, textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Total Outflow ({monthStr})</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
          ₹{totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Aggregating financial data...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <tr>
                <th style={{ padding: "16px 20px", textAlign: "left" }}>Category</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Amount (₹)</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map(item => {
                const pct = totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={item.category} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px 20px", fontWeight: 600, color: "#1e293b" }}>{item.category}</td>
                    <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                      ₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                        <div style={{ width: 100, height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#3b82f6" }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", width: 40 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
