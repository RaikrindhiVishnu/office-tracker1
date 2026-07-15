import React, { useState } from "react";
import { T, SectionCard, Table, Input, Select, AddBtn, DeleteBtn, SalaryTag } from "./FinanceUI";
import { VendorPayment } from "./financeTypes";

export default function VendorPaymentsTab({ payments, month, onAdd, onDelete, onUpdateStatus }: {
  payments: VendorPayment[];
  month: string;
  onAdd: (data: Omit<VendorPayment, "id" | "createdAt" | "month">) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: "Pending" | "Paid") => void;
}) {
  const [vendorName, setVendorName] = useState("");
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleAdd = () => {
    if (!vendorName || !amount) return;
    onAdd({ vendorName, service, amount: parseFloat(amount), dueDate, status: "Pending" });
    setVendorName(""); setService(""); setAmount(""); setDueDate("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="New Vendor Payment" subtitle="Schedule invoices and subscriptions">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Vendor / Payee" value={vendorName} onChange={setVendorName} placeholder="e.g. AWS" />
          <Input label="Service / Description" value={service} onChange={setService} placeholder="Cloud Hosting" />
          <Input label="Amount Due (₹)" value={amount} onChange={setAmount} type="number" placeholder="0" />
          <Input label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
          <AddBtn onClick={handleAdd} label="Add Payment" />
        </div>
      </SectionCard>

      <SectionCard title="Vendor Payments" subtitle={`${payments.length} invoices this month`}>
        <Table
          headers={["Vendor", "Service", "Amount", "Due Date", "Status", "Actions", ""]}
          rows={payments.map(p => [
            <span style={{ fontWeight: 700, color: T.ink }}>{p.vendorName}</span>,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{p.service || "—"}</span>,
            <SalaryTag v={p.amount} color={T.blue} />,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{p.dueDate || "—"}</span>,
            <span style={{
              padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: p.status === "Paid" ? T.greenBg : T.amberBg,
              color: p.status === "Paid" ? T.green : T.amber,
            }}>{p.status}</span>,
            <div style={{ display: "flex", gap: 6 }}>
              {p.status === "Pending" && (
                <button onClick={() => p.id && onUpdateStatus(p.id, "Paid")} style={{ padding: "4px 8px", background: T.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Mark Paid</button>
              )}
            </div>,
            <DeleteBtn onClick={() => p.id && onDelete(p.id)} />,
          ])}
        />
      </SectionCard>
    </div>
  );
}
