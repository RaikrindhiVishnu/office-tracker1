import React from "react";
import { T, SectionCard, Table, SalaryTag } from "./FinanceUI";
import { PurchaseRequest, SalaryAdvance, Reimbursement } from "./financeTypes";

export default function ApprovalCenterTab({
  purchaseRequests, salaryAdvances, reimbursements,
  onUpdatePurchase, onUpdateAdvance, onUpdateReimbursement
}: {
  purchaseRequests: PurchaseRequest[];
  salaryAdvances: SalaryAdvance[];
  reimbursements: Reimbursement[];
  onUpdatePurchase: (id: string, status: "Pending" | "Approved" | "Rejected") => void;
  onUpdateAdvance: (id: string, status: "Pending" | "Approved" | "Rejected") => void;
  onUpdateReimbursement: (id: string, status: "Pending" | "Approved" | "Rejected" | "Reimbursed") => void;
}) {
  const pendingPurchases = purchaseRequests.filter(r => r.status === "Pending");
  const pendingAdvances = salaryAdvances.filter(a => a.status === "Pending");
  const pendingReimbursements = reimbursements.filter(e => e.status === "Pending");

  const totalPending = pendingPurchases.length + pendingAdvances.length + pendingReimbursements.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ padding: "16px 20px", background: T.amberBg, border: `1px solid ${T.amber}44`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: T.amber }}>{totalPending} Pending Approvals</div>
          <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>Review and action requests from across the company.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <SectionCard title="Purchase Requests" subtitle={`${pendingPurchases.length} pending`}>
          <Table
            headers={["Item", "Cost", "Actions"]}
            rows={pendingPurchases.map(r => [
              <span style={{ fontWeight: 700, color: T.ink }}>{r.item}</span>,
              <SalaryTag v={r.estimatedCost} color={T.amber} />,
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => r.id && onUpdatePurchase(r.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                <button onClick={() => r.id && onUpdatePurchase(r.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
              </div>,
            ])}
          />
        </SectionCard>

        <SectionCard title="Salary Advances" subtitle={`${pendingAdvances.length} pending`}>
          <Table
            headers={["Employee", "Amount", "Actions"]}
            rows={pendingAdvances.map(a => [
              <span style={{ fontWeight: 700, color: T.ink }}>{a.employeeName}</span>,
              <SalaryTag v={a.amount} color={T.violet} />,
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => a.id && onUpdateAdvance(a.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                <button onClick={() => a.id && onUpdateAdvance(a.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
              </div>,
            ])}
          />
        </SectionCard>

        <SectionCard title="Reimbursements" subtitle={`${pendingReimbursements.length} pending`}>
          <Table
            headers={["Employee", "Amount", "Item", "Type", "Actions"]}
            rows={pendingReimbursements.map(e => [
              <span style={{ fontWeight: 700, color: T.ink }}>{e.employeeName || "—"}</span>,
              <SalaryTag v={e.cost} color={T.green} />,
              <span style={{ fontSize: 11, color: T.inkMid }}>{e.itemName}</span>,
              <span style={{ fontSize: 11, color: T.inkMid }}>{e.productType}</span>,
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => e.id && onUpdateReimbursement(e.id, "Approved")} style={{ padding: "4px 8px", background: T.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                <button onClick={() => e.id && onUpdateReimbursement(e.id, "Rejected")} style={{ padding: "4px 8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
              </div>,
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}
