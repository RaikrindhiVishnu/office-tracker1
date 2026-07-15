import React, { useState } from "react";
import { T, SectionCard, Table, Input, Select, AddBtn, DeleteBtn, SalaryTag } from "./FinanceUI";
import { PurchaseRequest } from "./financeTypes";

export default function PurchaseRequestsTab({ requests, month, onAdd, onDelete, onUpdateStatus }: {
  requests: PurchaseRequest[];
  month: string;
  onAdd: (data: Omit<PurchaseRequest, "id" | "createdAt" | "month">) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: "Pending" | "Approved" | "Rejected") => void;
}) {
  const [item, setItem] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = () => {
    if (!item || !estimatedCost) return;
    onAdd({ item, estimatedCost: parseFloat(estimatedCost), reason, status: "Pending" });
    setItem(""); setEstimatedCost(""); setReason("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="New Purchase Request" subtitle="For laptops, software, furniture etc.">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Item Name" value={item} onChange={setItem} placeholder="e.g. MacBook Pro" />
          <Input label="Estimated Cost (₹)" value={estimatedCost} onChange={setEstimatedCost} type="number" placeholder="0" />
          <Input label="Reason / Justification" value={reason} onChange={setReason} placeholder="Why is this needed?" />
          <AddBtn onClick={handleAdd} label="Submit Request" />
        </div>
      </SectionCard>

      <SectionCard title="Purchase Requests" subtitle={`${requests.length} requests this month`}>
        <Table
          headers={["Item", "Cost", "Reason", "Status", "Actions", ""]}
          rows={requests.map(r => [
            <span style={{ fontWeight: 700, color: T.ink }}>{r.item}</span>,
            <SalaryTag v={r.estimatedCost} color={T.amber} />,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{r.reason || "—"}</span>,
            <span style={{
              padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: r.status === "Approved" ? T.greenBg : r.status === "Rejected" ? T.redBg : T.amberBg,
              color: r.status === "Approved" ? T.green : r.status === "Rejected" ? T.red : T.amber,
            }}>{r.status}</span>,
            <div style={{ display: "flex", gap: 6 }}>
              {r.status === "Pending" && (
                <>
                  <button onClick={() => r.id && onUpdateStatus(r.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                  <button onClick={() => r.id && onUpdateStatus(r.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                </>
              )}
            </div>,
            <DeleteBtn onClick={() => r.id && onDelete(r.id)} />,
          ])}
        />
      </SectionCard>
    </div>
  );
}
