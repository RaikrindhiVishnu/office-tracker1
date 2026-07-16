import React from "react";
import { T, fmt } from "./FinanceUI";

export default function FinalSheetTab({ data }: { data: any }) {
  const {
    expenses,
    purchaseRequests,
    salaryAdvances,
    vendorPayments,
    budgets,
    payroll,
    employees,
    assets,
    reimbursements,
    payrollTotals,
  } = data;

  // Flatten all transactions into a single array
  const transactions: { id: string; name: string; type: string; amount: number; date: string }[] = [];

  expenses.forEach((e: any, i: number) => {
    if (e.amount > 0) transactions.push({ id: `exp-${i}`, name: e.category + (e.note ? ` - ${e.note}` : ''), type: "Expense", amount: e.amount, date: e.date || "-" });
  });

  purchaseRequests.filter((r: any) => r.status === "Approved" || r.status === "Ordered" || r.status === "Delivered").forEach((r: any, i: number) => {
    if (r.estimatedCost > 0) transactions.push({ id: `pr-${i}`, name: r.itemName || "Purchase Req", type: "Purchase", amount: r.estimatedCost, date: "-" });
  });

  salaryAdvances.filter((a: any) => a.status === "Approved").forEach((a: any, i: number) => {
    if (a.amount > 0) transactions.push({ id: `adv-${i}`, name: a.employeeName || "Advance", type: "Advance", amount: a.amount, date: "-" });
  });

  vendorPayments.filter((v: any) => v.status === "Paid").forEach((v: any, i: number) => {
    if (v.amount > 0) transactions.push({ id: `ven-${i}`, name: v.vendorName || "Vendor", type: "Vendor", amount: v.amount, date: "-" });
  });

  budgets.forEach((b: any, i: number) => {
    if (b.used > 0) transactions.push({ id: `bud-${i}`, name: b.department || "Budget", type: "Budget", amount: b.used, date: "-" });
  });

  assets.forEach((a: any, i: number) => {
    if (a.totalCost > 0) transactions.push({ id: `ast-${i}`, name: a.name || "Asset", type: "Asset", amount: a.totalCost, date: "-" });
  });

  reimbursements.filter((r: any) => r.status === "Approved" || r.status === "Reimbursed").forEach((r: any, i: number) => {
    if (r.cost > 0) transactions.push({ id: `reim-${i}`, name: r.employeeName || "Reimb.", type: "Reimbursement", amount: r.cost, date: "-" });
  });

  if (payrollTotals.totalFinal > 0) {
    payroll.forEach((p: any, i: number) => {
      if (p.finalSalary > 0) transactions.push({ id: `pay-${i}`, name: p.employeeName || "Payroll", type: "Payroll", amount: p.finalSalary, date: "-" });
    });
  } else {
    employees.forEach((e: any, i: number) => {
      if (e.salary > 0) transactions.push({ id: `sal-${i}`, name: e.name || "Employee", type: "Salary", amount: e.salary, date: "-" });
    });
  }

  const grandTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* Header Section */}
      <div style={{
        background: "#ffffff", borderRadius: 12, padding: "30px 40px", 
        border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>Itemized Financial Statement</h1>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 6, fontWeight: 500 }}>Comprehensive Ledger for {currentMonthName}</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Each and every rupee accounted for.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Total Outflow</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{fmt(grandTotal)}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, fontWeight: 600 }}>{transactions.length} Total Entries</div>
        </div>
      </div>

      {/* Full Width Ledger Table */}
      <div style={{
        background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", 
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "5%" }}>S.No</th>
                <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "15%" }}>Date</th>
                <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "15%" }}>Category / Type</th>
                <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "45%" }}>Description</th>
                <th style={{ padding: "16px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "20%", textAlign: "right" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#64748b", fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: "16px 24px", fontSize: 13, color: "#64748b" }}>{t.date}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <span style={{ 
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, 
                      background: "#f1f5f9", color: "#334155" 
                    }}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: 14, color: "#0f172a", fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: "16px 24px", fontSize: 15, color: "#0f172a", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                    {t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {transactions.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={4} style={{ padding: "20px 24px", fontSize: 16, fontWeight: 800, color: "#0f172a", textAlign: "right" }}>
                    GRAND TOTAL CALCULATED:
                  </td>
                  <td style={{ padding: "20px 24px", fontSize: 20, fontWeight: 900, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
