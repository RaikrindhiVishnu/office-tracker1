import React from "react";
import { T, SectionCard, KPICard, Table, fmt } from "./FinanceUI";

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
    grandTotal,
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
    { category: "Expenses (Manual + Claims)", count: expenses.length, amount: totalManual + approvedClaimsTotal },
    { category: "Purchase Requests (Approved)", count: purchaseRequests.length, amount: approvedPRTotal },
    { category: "Salary Advances (Approved)", count: salaryAdvances.length, amount: totalAdvances },
    { category: "Vendor Payments (Paid)", count: vendorPayments.length, amount: totalVendors },
    { category: "Budgets (Tracked)", count: budgets.length, amount: budgets.reduce((s: number, b: any) => s + b.used, 0) },
    { category: "Payroll (Processed or Base)", count: payroll.length > 0 ? payroll.length : employees.length, amount: totalPayroll },
    { category: "Assets (Added)", count: assets.length, amount: totalAssets },
    { category: "Reimbursements (Approved/Paid)", count: reimbursements.length, amount: totalReimbursements },
  ];

  const actualTotalExpenditure = summaryData.reduce((s, row) => s + row.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KPICard icon="📉" label="Total Expenditure" value={fmt(actualTotalExpenditure)} accent={T.red} sub="Sum of all categories below" />
        <KPICard icon="📊" label="Grand Total (Overview)" value={fmt(grandTotal)} accent={T.blue} sub="Salary + Expenses + Assets" />
        <KPICard icon="👥" label="Total Employees" value={String(employees.length)} accent={T.teal} sub="Active headcount" />
      </div>

      <SectionCard title="Consolidated Financial Statement (Profit & Loss / Expenditure View)" subtitle="Breakdown of all counts and actual monetary outflows.">
        <Table
          headers={["Category", "Entries Count", "Total Amount"]}
          rows={summaryData.map((row) => [
            <span key="1" style={{ fontWeight: 600, color: T.ink }}>{row.category}</span>,
            <span key="2" style={{ color: T.inkMid, fontWeight: 700 }}>{row.count} entries</span>,
            <span key="3" style={{ fontWeight: 800, color: T.red, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(row.amount)}</span>,
          ])}
        />
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: `2px dashed ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.inkMid }}>Total Loss / Outflow:</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: T.red, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(actualTotalExpenditure)}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
