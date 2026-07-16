import React from "react";

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

  // 1. Manual Expenses
  expenses.forEach((e: any, i: number) => {
    if (e.amount > 0) {
      transactions.push({ id: `exp-${i}`, name: e.category || "Expense", type: "Expense", amount: e.amount, date: e.date || "" });
    }
  });

  // 2. Purchase Requests
  purchaseRequests.filter((r: any) => r.status === "Approved" || r.status === "Ordered" || r.status === "Delivered").forEach((r: any, i: number) => {
    if (r.estimatedCost > 0) {
      transactions.push({ id: `pr-${i}`, name: r.itemName || "Purchase Req", type: "Purchase", amount: r.estimatedCost, date: "" });
    }
  });

  // 3. Salary Advances
  salaryAdvances.filter((a: any) => a.status === "Approved").forEach((a: any, i: number) => {
    if (a.amount > 0) {
      transactions.push({ id: `adv-${i}`, name: a.employeeName || "Advance", type: "Advance", amount: a.amount, date: "" });
    }
  });

  // 4. Vendor Payments
  vendorPayments.filter((v: any) => v.status === "Paid").forEach((v: any, i: number) => {
    if (v.amount > 0) {
      transactions.push({ id: `ven-${i}`, name: v.vendorName || "Vendor", type: "Vendor", amount: v.amount, date: "" });
    }
  });

  // 5. Budgets (Used)
  budgets.forEach((b: any, i: number) => {
    if (b.used > 0) {
      transactions.push({ id: `bud-${i}`, name: b.department || "Budget", type: "Budget", amount: b.used, date: "" });
    }
  });

  // 6. Assets
  assets.forEach((a: any, i: number) => {
    if (a.totalCost > 0) {
      transactions.push({ id: `ast-${i}`, name: a.name || "Asset", type: "Asset", amount: a.totalCost, date: "" });
    }
  });

  // 7. Reimbursements
  reimbursements.filter((r: any) => r.status === "Approved" || r.status === "Reimbursed").forEach((r: any, i: number) => {
    if (r.cost > 0) {
      transactions.push({ id: `reim-${i}`, name: r.employeeName || "Reimb.", type: "Reimburse", amount: r.cost, date: "" });
    }
  });

  // 8. Payroll / Salaries
  if (payrollTotals.totalFinal > 0) {
    payroll.forEach((p: any, i: number) => {
      if (p.finalSalary > 0) {
        transactions.push({ id: `pay-${i}`, name: p.employeeName || "Payroll", type: "Payroll", amount: p.finalSalary, date: "" });
      }
    });
  } else {
    // Default to employee base salaries
    employees.forEach((e: any, i: number) => {
      if (e.salary > 0) {
        transactions.push({ id: `sal-${i}`, name: e.name || "Employee", type: "Salary", amount: e.salary, date: "" });
      }
    });
  }

  // Calculate Grand Total
  const totalItems = transactions.length;
  const grandTotal = transactions.reduce((sum, t) => sum + t.amount, 0);

  const currentDateTime = new Date().toLocaleString("en-IN", { 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 20px", background: "#f1f5f9" }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#fff",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 2px 10px rgba(0,0,0,0.05)",
        padding: "30px 20px",
        fontFamily: "'Courier New', Courier, monospace",
        color: "#000",
        fontSize: 14,
        lineHeight: 1.5,
        position: "relative",
      }}>
        {/* Jagged bottom effect using pseudo-element (handled via simple border here) */}
        <div style={{ borderBottom: "2px dashed #ccc", paddingBottom: 16, marginBottom: 16, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, textTransform: "uppercase" }}>OFFICE TRACKER</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>123 Business Avenue, Tech Park</div>
          <div style={{ fontSize: 13 }}>City, State, 100010</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>GSTIN: 29ABCDE1234F1Z5</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>FINANCIAL STATEMENT</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span>Bill No: {Math.floor(100000 + Math.random() * 900000)}</span>
          <span>Date: {currentDateTime.split(',')[0]}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 16 }}>
          <span>Cashier: Admin</span>
          <span>Time:{currentDateTime.split(',')[1]}</span>
        </div>

        <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginBottom: 12, display: "flex", fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: "10%" }}>SNo</span>
          <span style={{ width: "55%" }}>Item Description</span>
          <span style={{ width: "35%", textAlign: "right" }}>Amount (Rs)</span>
        </div>

        <div style={{ minHeight: 200 }}>
          {transactions.map((t, idx) => (
            <div key={t.id} style={{ display: "flex", fontSize: 12, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ width: "10%" }}>{idx + 1}</span>
              <span style={{ width: "55%", paddingRight: 8 }}>
                {t.name.toUpperCase()}
                <br/>
                <span style={{ fontSize: 10, color: "#666" }}>({t.type.toUpperCase()})</span>
              </span>
              <span style={{ width: "35%", textAlign: "right" }}>
                {t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}

          {transactions.length === 0 && (
            <div style={{ textAlign: "center", fontStyle: "italic", padding: "20px 0" }}>No transactions found for this period.</div>
          )}
        </div>

        <div style={{ borderTop: "1px dashed #000", marginTop: 20, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
            <span>Total Items:</span>
            <span>{totalItems}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, marginTop: 8 }}>
            <span>GRAND TOTAL:</span>
            <span>₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div style={{ borderTop: "2px dashed #ccc", marginTop: 20, paddingTop: 20, textAlign: "center", fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>*** THANK YOU ***</div>
          <div style={{ marginTop: 4 }}>This is a computer generated statement.</div>
        </div>

        {/* Paper jagged edges (CSS trick) */}
        <div style={{
          position: "absolute", bottom: -6, left: 0, right: 0, height: 6,
          backgroundSize: "12px 12px",
          backgroundImage: "linear-gradient(135deg, transparent 50%, #fff 50%), linear-gradient(45deg, #fff 50%, transparent 50%)",
          backgroundPosition: "top left, top left",
          backgroundRepeat: "repeat-x"
        }} />
      </div>
    </div>
  );
}
