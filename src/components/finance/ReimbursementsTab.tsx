import React, { useState } from "react";
import { T, SectionCard, Table, Input, Select, AddBtn, DeleteBtn, SalaryTag } from "./FinanceUI";
import { Reimbursement } from "./financeTypes";

export default function ReimbursementsTab({ reimbursements, month, onAdd, onDelete, onUpdateStatus }: {
  reimbursements: Reimbursement[];
  month: string;
  onAdd: (data: Omit<Reimbursement, "id" | "createdAt" | "month">) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: "Pending" | "Approved" | "Rejected" | "Reimbursed") => void;
}) {
  const [itemName, setItemName] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [productType, setProductType] = useState("Subscription");

  const handleAdd = () => {
    if (!itemName || !cost || !date || !employeeName) return;
    onAdd({ itemName, cost: parseFloat(cost), date, employeeName, productType, status: "Pending" });
    setItemName(""); setCost(""); setDate(""); setEmployeeName(""); setProductType("Subscription");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="New Reimbursement" subtitle="Add claim for employee">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Item Name" value={itemName} onChange={setItemName} placeholder="e.g. Adobe Cloud" />
          <Input label="Cost (₹)" value={cost} onChange={setCost} type="number" placeholder="0" />
          <Input label="Date" value={date} onChange={setDate} type="date" />
          <Input label="Employee Name" value={employeeName} onChange={setEmployeeName} placeholder="John Doe" />
          <Select label="Product Type" value={productType} onChange={setProductType} options={["Subscription", "Asset", "Travel", "Office Supply", "Other"]} />
          <AddBtn onClick={handleAdd} label="Submit Claim" />
        </div>
      </SectionCard>

      <SectionCard title="Reimbursement Claims" subtitle={`${reimbursements.length} claims this month`}>
        <Table
          headers={["Employee", "Item", "Type", "Cost", "Date", "Status", "Actions", ""]}
          rows={reimbursements.map(r => [
            <span style={{ fontWeight: 700, color: T.ink }}>{r.employeeName}</span>,
            <span style={{ fontWeight: 700, color: T.ink }}>{r.itemName}</span>,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{r.productType}</span>,
            <SalaryTag v={r.cost} color={T.blue} />,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{r.date}</span>,
            <span style={{
              padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: r.status === "Approved" || r.status === "Reimbursed" ? T.greenBg : r.status === "Rejected" ? T.redBg : T.amberBg,
              color: r.status === "Approved" || r.status === "Reimbursed" ? T.green : r.status === "Rejected" ? T.red : T.amber,
            }}>{r.status}</span>,
            <div style={{ display: "flex", gap: 6 }}>
              {r.status === "Pending" && (
                <>
                  <button onClick={() => r.id && onUpdateStatus(r.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                  <button onClick={() => r.id && onUpdateStatus(r.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                </>
              )}
              {r.status === "Approved" && (
                <button onClick={() => r.id && onUpdateStatus(r.id, "Reimbursed")} style={{ padding: "4px 8px", background: T.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Mark Paid</button>
              )}
            </div>,
            <DeleteBtn onClick={() => r.id && onDelete(r.id)} />,
          ])}
        />
      </SectionCard>
    </div>
  );
}
