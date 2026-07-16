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

  // 1. Payroll / Salaries
  const payrollList = payrollTotals.totalFinal > 0 
    ? payroll.filter((p: any) => p.finalSalary > 0).map((p: any) => ({ name: p.employeeName, details: "Processed Payroll", amount: p.finalSalary }))
    : employees.filter((e: any) => e.salary > 0).map((e: any) => ({ name: e.name, details: "Base Salary", amount: e.salary }));
  const payrollTotal = payrollList.reduce((s: number, i: any) => s + i.amount, 0);

  // 2. Expenses
  const expList = expenses.filter((e: any) => e.amount > 0).map((e: any) => ({ name: e.category, details: e.note || "Manual Expense", amount: e.amount }));
  const expTotal = expList.reduce((s: number, i: any) => s + i.amount, 0);

  // 3. Purchase Requests
  const prList = purchaseRequests.filter((r: any) => r.status === "Approved" || r.status === "Ordered" || r.status === "Delivered" || r.status === "Pending")
    .map((r: any) => ({ name: r.employeeName || "Admin", item: r.itemName, details: r.reason || "-", status: r.status, amount: r.estimatedCost }));
  const prTotal = prList.reduce((s: number, i: any) => s + i.amount, 0);

  // 4. Salary Advances
  const advList = salaryAdvances.filter((a: any) => a.status === "Approved").map((a: any) => ({ name: a.employeeName, details: "Approved Advance", amount: a.amount }));
  const advTotal = advList.reduce((s: number, i: any) => s + i.amount, 0);

  // 5. Vendor Payments
  const venList = vendorPayments.filter((v: any) => v.status === "Paid").map((v: any) => ({ name: v.vendorName, details: "Vendor Payment", amount: v.amount }));
  const venTotal = venList.reduce((s: number, i: any) => s + i.amount, 0);

  // 6. Budgets
  const budList = budgets.filter((b: any) => b.used > 0).map((b: any) => ({ name: b.department, details: "Tracked Budget Used", amount: b.used }));
  const budTotal = budList.reduce((s: number, i: any) => s + i.amount, 0);

  // 7. Assets
  const astList = assets.filter((a: any) => a.totalCost > 0).map((a: any) => ({ name: a.name, details: "Asset Purchased", amount: a.totalCost }));
  const astTotal = astList.reduce((s: number, i: any) => s + i.amount, 0);

  // 8. Reimbursements
  const remList = reimbursements.filter((r: any) => r.status === "Approved" || r.status === "Reimbursed").map((r: any) => ({ name: r.employeeName, details: "Approved Reimbursement", amount: r.cost }));
  const remTotal = remList.reduce((s: number, i: any) => s + i.amount, 0);

  const summaryData = [
    { category: "Payroll & Salaries", count: payrollList.length, amount: payrollTotal },
    { category: "Manual Expenses", count: expList.length, amount: expTotal },
    { category: "Purchase Requests", count: prList.length, amount: prTotal },
    { category: "Salary Advances", count: advList.length, amount: advTotal },
    { category: "Vendor Payments", count: venList.length, amount: venTotal },
    { category: "Budgets (Used)", count: budList.length, amount: budTotal },
    { category: "Assets", count: astList.length, amount: astTotal },
    { category: "Reimbursements", count: remList.length, amount: remTotal },
  ];

  const grandTotal = summaryData.reduce((s, row) => s + row.amount, 0);

  const CategorySection = ({ title, list, total }: { title: string; list: any[]; total: number }) => (
    <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", overflow: "hidden", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{list.length} entries</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(total)}</span>
        </div>
      </div>
      
      {list.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#ffffff", borderBottom: "2px solid #f1f5f9" }}>
                <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "30%" }}>{title === "Purchase Requests" ? "Employee" : "Name / Category"}</th>
                {title === "Purchase Requests" && <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "20%" }}>Item</th>}
                <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: title === "Purchase Requests" ? "25%" : "50%" }}>Details / Reason</th>
                {title === "Purchase Requests" && <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "10%" }}>Status</th>}
                <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: "20%", textAlign: "right" }}>Cost (₹)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 24px", fontSize: 14, color: "#0f172a", fontWeight: 600 }}>{item.name}</td>
                  {title === "Purchase Requests" && <td style={{ padding: "12px 24px", fontSize: 13, color: "#0f172a", fontWeight: 700 }}>{item.item}</td>}
                  <td style={{ padding: "12px 24px", fontSize: 13, color: "#64748b" }}>{item.details}</td>
                  {title === "Purchase Requests" && <td style={{ padding: "12px 24px", fontSize: 12, color: T.blue, fontWeight: 700 }}>{item.status}</td>}
                  <td style={{ padding: "12px 24px", fontSize: 14, color: "#0f172a", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                    {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13, fontStyle: "italic", background: "#ffffff" }}>
          No entries for this category (0 items).
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>Category-Wise Final Sheet</h1>
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Full details for every transaction, broken down by category.</div>
      </div>

      {/* CATEGORY TABLES */}
      <CategorySection title="Payroll & Salaries" list={payrollList} total={payrollTotal} />
      <CategorySection title="Purchase Requests" list={prList} total={prTotal} />
      <CategorySection title="Manual Expenses" list={expList} total={expTotal} />
      <CategorySection title="Salary Advances" list={advList} total={advTotal} />
      <CategorySection title="Vendor Payments" list={venList} total={venTotal} />
      <CategorySection title="Budgets (Used)" list={budList} total={budTotal} />
      <CategorySection title="Assets" list={astList} total={astTotal} />
      <CategorySection title="Reimbursements" list={remList} total={remTotal} />

      {/* FINAL SUMMARY TABLE */}
      <div style={{ background: "#ffffff", borderRadius: 12, border: "2px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", overflow: "hidden", marginTop: 20 }}>
        <div style={{ padding: "20px 24px", background: "#1e293b", color: "#fff" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Financial Summary (All Categories)</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Category</th>
              <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Entries Count</th>
              <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px 24px", fontSize: 15, color: "#0f172a", fontWeight: 700 }}>{row.category}</td>
                <td style={{ padding: "16px 24px", fontSize: 14, color: "#64748b", fontWeight: 600, textAlign: "right" }}>{row.count} entries</td>
                <td style={{ padding: "16px 24px", fontSize: 15, color: "#0f172a", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                  {row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#fef2f2", borderTop: "3px solid #fca5a5" }}>
              <td colSpan={2} style={{ padding: "24px", fontSize: 18, fontWeight: 900, color: "#991b1b", textAlign: "right", textTransform: "uppercase" }}>
                Grand Total Outflow:
              </td>
              <td style={{ padding: "24px", fontSize: 24, fontWeight: 900, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}
