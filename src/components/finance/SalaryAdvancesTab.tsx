import React, { useState } from "react";
import { T, SectionCard, Table, Input, Select, AddBtn, DeleteBtn, SalaryTag } from "./FinanceUI";
import { SalaryAdvance } from "./financeTypes";

export default function SalaryAdvancesTab({ advances, month, onAdd, onDelete, onUpdateStatus }: {
  advances: SalaryAdvance[];
  month: string;
  onAdd: (data: Omit<SalaryAdvance, "id" | "createdAt" | "month">) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: "Pending" | "Approved" | "Rejected") => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("1");

  const handleAdd = () => {
    if (!employeeName || !amount) return;
    onAdd({ employeeName, amount: parseFloat(amount), reason, repaymentMonths: parseInt(repaymentMonths), status: "Pending" });
    setEmployeeName(""); setAmount(""); setReason(""); setRepaymentMonths("1");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="New Advance Request" subtitle="Deducted automatically from payroll">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Employee Name" value={employeeName} onChange={setEmployeeName} placeholder="John Doe" />
          <Input label="Amount (₹)" value={amount} onChange={setAmount} type="number" placeholder="0" />
          <Select label="Repayment Duration" value={repaymentMonths} onChange={setRepaymentMonths} options={["1", "2", "3", "6", "12"]} />
          <Input label="Reason / Notes" value={reason} onChange={setReason} placeholder="Optional reason" />
          <AddBtn onClick={handleAdd} label="Submit Request" />
        </div>
      </SectionCard>

      <SectionCard title="Salary Advances" subtitle={`${advances.length} requests this month`}>
        <Table
          headers={["Employee", "Amount", "Duration", "Reason", "Status", "Actions", ""]}
          rows={advances.map(a => [
            <span style={{ fontWeight: 700, color: T.ink }}>{a.employeeName}</span>,
            <SalaryTag v={a.amount} color={T.violet} />,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{a.repaymentMonths} month(s)</span>,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{a.reason || "—"}</span>,
            <span style={{
              padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: a.status === "Approved" ? T.greenBg : a.status === "Rejected" ? T.redBg : T.amberBg,
              color: a.status === "Approved" ? T.green : a.status === "Rejected" ? T.red : T.amber,
            }}>{a.status}</span>,
            <div style={{ display: "flex", gap: 6 }}>
              {a.status === "Pending" && (
                <>
                  <button onClick={() => a.id && onUpdateStatus(a.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                  <button onClick={() => a.id && onUpdateStatus(a.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                </>
              )}
            </div>,
            <DeleteBtn onClick={() => a.id && onDelete(a.id)} />,
          ])}
        />
      </SectionCard>
    </div>
  );
}
