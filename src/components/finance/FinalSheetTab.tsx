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
    totalManual,
    totalAssets,
    approvedClaimsTotal,
    approvedPRTotal,
  } = data;

  const totalPayroll = payrollTotals.totalFinal > 0 ? payrollTotals.totalFinal : employees.reduce((s: number, e: any) => s + (e.salary || 0), 0);

  const totalReimbursements = reimbursements
    .filter((r: any) => r.status === "Approved" || r.status === "Reimbursed")
    .reduce((s: number, r: any) => s + (r.cost || 0), 0);
    
  const totalAdvances = salaryAdvances
    .filter((a: any) => a.status === "Approved")
    .reduce((s: number, a: any) => s + (a.amount || 0), 0);

  const totalVendors = vendorPayments
    .filter((v: any) => v.status === "Paid")
    .reduce((s: number, v: any) => s + (v.amount || 0), 0);

  const summaryData = [
    { category: "Payroll & Salaries", amount: totalPayroll },
    { category: "Manual Expenses & Employee Claims", amount: totalManual + approvedClaimsTotal },
    { category: "Purchase Requests", amount: approvedPRTotal },
    { category: "Salary Advances", amount: totalAdvances },
    { category: "Vendor Payments", amount: totalVendors },
    { category: "Budgets (Tracked)", amount: budgets.reduce((s: number, b: any) => s + b.used, 0) },
    { category: "Assets Purchased", amount: totalAssets },
    { category: "Reimbursements", amount: totalReimbursements },
  ].filter(row => row.amount > 0);

  const actualTotalExpenditure = summaryData.reduce((s, row) => s + row.amount, 0);
  const totalRevenue = 0; // Hardcoded for now
  const netProfit = totalRevenue - actualTotalExpenditure;

  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
      <div style={{
        width: "100%",
        maxWidth: 900,
        background: "#ffffff",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)",
        padding: "40px 60px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#333",
      }}>
        
        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.5px" }}>Profit and Loss</h1>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>For the period of {currentMonthName}</div>
        </div>

        {/* P&L TABLE */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          
          {/* OPERATING INCOME */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", borderBottom: "1px solid #eaeaea", paddingBottom: 8, marginBottom: 8 }}>
              Operating Income
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", fontSize: 14, color: "#444" }}>
              <span>Sales / Revenue</span>
              <span>{fmt(totalRevenue)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1a1a1a", borderTop: "1px solid #eaeaea", borderBottom: "1px solid #eaeaea", marginTop: 8, background: "#f9fafb" }}>
              <span>Total Operating Income</span>
              <span>{fmt(totalRevenue)}</span>
            </div>
          </div>

          {/* OPERATING EXPENSES */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", borderBottom: "1px solid #eaeaea", paddingBottom: 8, marginBottom: 8 }}>
              Operating Expenses
            </div>

            {summaryData.length > 0 ? (
              summaryData.map((row, idx) => (
                <div key={idx} style={{ 
                  display: "flex", justifyContent: "space-between", padding: "8px 16px", fontSize: 14, color: "#444",
                  borderBottom: idx === summaryData.length - 1 ? "none" : "1px solid #f5f5f5",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span>{row.category}</span>
                  <span>{fmt(row.amount)}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: "8px 16px", fontSize: 13, color: "#999", fontStyle: "italic" }}>No operating expenses recorded.</div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1a1a1a", borderTop: "1px solid #eaeaea", borderBottom: "1px solid #eaeaea", marginTop: 8, background: "#f9fafb" }}>
              <span>Total Operating Expenses</span>
              <span>{fmt(actualTotalExpenditure)}</span>
            </div>
          </div>

          {/* OPERATING PROFIT */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
            <span>Operating Profit</span>
            <span>{netProfit < 0 ? `-${fmt(Math.abs(netProfit))}` : fmt(netProfit)}</span>
          </div>

          <div style={{ height: 1, background: "#eaeaea", margin: "10px 0" }} />

          {/* NET PROFIT */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 16px", fontSize: 16, fontWeight: 800, color: netProfit < 0 ? "#dc2626" : "#16a34a", background: netProfit < 0 ? "#fef2f2" : "#f0fdf4", borderTop: netProfit < 0 ? "2px solid #fca5a5" : "2px solid #86efac", borderBottom: netProfit < 0 ? "2px solid #fca5a5" : "2px solid #86efac", marginTop: 20 }}>
            <span>Net Profit / (Loss)</span>
            <span>{netProfit < 0 ? `-${fmt(Math.abs(netProfit))}` : fmt(netProfit)}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
