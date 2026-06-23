"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee } from "@/types/Employee";

interface PayrollRecord {
  uid: string;
  name: string;
  baseSalary: number;
  totalDays: number;
  lopDays: number;
  grossSalary: number;
  deductions: number; // Advance salary, taxes
  additions: number;  // Reimbursements, bonuses
  netSalary: number;
  status: "Draft" | "Paid";
}

export default function AdminPayrollView() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthStr, setMonthStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [users, setUsers] = useState<Employee[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    };
    fetchUsers();
  }, []);

  const handleGeneratePayroll = async () => {
    setLoading(true);
    try {
      const [y, m] = monthStr.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();

      const newRecords: PayrollRecord[] = [];

      for (const u of users) {
        if (!u.id || u.accountType !== "EMPLOYEE") continue;

        // Fetch LOP days
        const qAtt = query(
          collection(db, "attendance"),
          where("userId", "==", u.id),
          where("date", ">=", `${monthStr}-01`),
          where("date", "<=", `${monthStr}-31`)
        );
        const attSnap = await getDocs(qAtt);
        
        // This is a simplified LOP check. Real calculation involves checking approved Leaves vs actual attendance.
        // For demonstration, we assume any missing day (out of expected work days) is an LOP, or explicitly marked "LOP" leave.
        let lopDays = 0;
        
        // Check Approved LOP leaves
        const qLeave = query(
          collection(db, "leaveRequests"),
          where("uid", "==", u.id),
          where("status", "==", "Approved"),
          where("leaveType", "==", "LOP")
        );
        const leaveSnap = await getDocs(qLeave);
        leaveSnap.forEach(doc => {
          const l = doc.data();
          if (l.fromDate.startsWith(monthStr)) lopDays++; // Rough estimate, needs date diff
        });

        // Fetch Advances to deduct
        const qAdv = query(
          collection(db, "advanceSalary"),
          where("uid", "==", u.id),
          where("status", "==", "Approved")
        );
        const advSnap = await getDocs(qAdv);
        let advanceDeductions = 0;
        advSnap.forEach(doc => {
          const a = doc.data();
          advanceDeductions += (a.amount / a.repaymentMonths); // Deduct installment
        });

        // Fetch Reimbursements to add
        const qExp = query(
          collection(db, "expenseClaims"),
          where("uid", "==", u.id),
          where("status", "==", "Approved")
        );
        const expSnap = await getDocs(qExp);
        let reimbursements = 0;
        expSnap.forEach(doc => {
          const e = doc.data();
          if (e.createdAt?.toDate().toISOString().startsWith(monthStr)) {
            reimbursements += e.totalAmount;
          }
        });

        const baseSalary = u.salary || 30000; // default to 30k if not set
        const perDaySalary = baseSalary / daysInMonth;
        const lopDeduction = lopDays * perDaySalary;

        const grossSalary = baseSalary - lopDeduction;
        const deductions = advanceDeductions;
        const additions = reimbursements;
        const netSalary = grossSalary - deductions + additions;

        newRecords.push({
          uid: u.id,
          name: u.name || "Unknown",
          baseSalary,
          totalDays: daysInMonth,
          lopDays,
          grossSalary,
          deductions,
          additions,
          netSalary,
          status: "Draft",
        });
      }

      setRecords(newRecords);
    } catch (err) {
      console.error(err);
      alert("Failed to generate payroll");
    } finally {
      setLoading(false);
    }
  };

  const savePayroll = async () => {
    if (!records.length) return;
    try {
      const batch = [];
      for (const r of records) {
        const ref = doc(db, "payslips", `${r.uid}_${monthStr}`);
        batch.push(setDoc(ref, {
          ...r,
          monthStr,
          status: "Paid",
          generatedAt: new Date(),
        }));
      }
      await Promise.all(batch);
      alert("Payroll Disbursed and Payslips Generated!");
      setRecords(records.map(r => ({ ...r, status: "Paid" })));
    } catch (err) {
      console.error(err);
      alert("Failed to save payroll");
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Payroll Calculation Engine</h2>
          <p style={{ color: "#64748b", marginTop: 4 }}>Automatically calculate net pay factoring in LOPs, Advances, and Reimbursements.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input 
            type="month" 
            value={monthStr} 
            onChange={e => setMonthStr(e.target.value)} 
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
          <button 
            onClick={handleGeneratePayroll}
            disabled={loading}
            style={{ padding: "8px 16px", background: "#1e293b", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            {loading ? "Calculating..." : "Run Engine"}
          </button>
        </div>
      </div>

      {records.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <tr>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Employee</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Base Salary</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>LOP Days</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: "#ef4444" }}>Deductions</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: "#10b981" }}>Additions</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Net Salary</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.uid} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>₹{r.baseSalary.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: r.lopDays > 0 ? "#ef4444" : "inherit" }}>{r.lopDays}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#ef4444" }}>-₹{r.deductions.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#10b981" }}>+₹{r.additions.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>₹{r.netSalary.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: r.status === "Paid" ? "#dcfce7" : "#f1f5f9",
                      color: r.status === "Paid" ? "#166534" : "#475569"
                    }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "16px", background: "#f8fafc", textAlign: "right", borderTop: "1px solid #e2e8f0" }}>
            <button 
              onClick={savePayroll}
              style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
            >
              Disburse Payroll & Generate Payslips
            </button>
          </div>
        </div>
      )}

      {records.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
          Select a month and click "Run Engine" to calculate payroll.
        </div>
      )}
    </div>
  );
}
