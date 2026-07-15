import React, { useState } from "react";
import { T, SectionCard, Table, Input, AddBtn, DeleteBtn, SalaryTag, DeptBadge } from "./FinanceUI";
import { Budget } from "./financeTypes";

export default function BudgetManagementTab({ budgets, month, onAdd, onDelete }: {
  budgets: Budget[];
  month: string;
  onAdd: (data: Omit<Budget, "id" | "createdAt" | "month">) => void;
  onDelete: (id: string) => void;
}) {
  const [department, setDepartment] = useState("");
  const [allocated, setAllocated] = useState("");
  const [used, setUsed] = useState("");

  const handleAdd = () => {
    if (!department || !allocated) return;
    onAdd({ department, allocated: parseFloat(allocated), used: parseFloat(used) || 0 });
    setDepartment(""); setAllocated(""); setUsed("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="Allocate Budget" subtitle="Set monthly department limits">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Department Name" value={department} onChange={setDepartment} placeholder="e.g. Marketing" />
          <Input label="Allocated Budget (₹)" value={allocated} onChange={setAllocated} type="number" placeholder="0" />
          <Input label="Already Used (₹)" value={used} onChange={setUsed} type="number" placeholder="0" />
          <AddBtn onClick={handleAdd} label="Save Budget" />
        </div>
      </SectionCard>

      <SectionCard title="Department Budgets" subtitle={`${budgets.length} tracked budgets`}>
        <Table
          headers={["Department", "Allocated", "Used", "Remaining", "Utilization", ""]}
          rows={budgets.map(b => {
            const remaining = b.allocated - b.used;
            const percentage = b.allocated > 0 ? (b.used / b.allocated) * 100 : 0;
            return [
              <DeptBadge dept={b.department} />,
              <SalaryTag v={b.allocated} color={T.inkMid} />,
              <SalaryTag v={b.used} color={T.amber} />,
              <SalaryTag v={remaining} color={remaining < 0 ? T.red : T.green} />,
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120 }}>
                <div style={{ flex: 1, height: 6, background: T.surfaceHi, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, percentage)}%`, height: "100%", background: percentage > 90 ? T.red : percentage > 75 ? T.amber : T.green, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 10, color: T.inkMid, fontWeight: 700 }}>{percentage.toFixed(0)}%</span>
              </div>,
              <DeleteBtn onClick={() => b.id && onDelete(b.id)} />,
            ];
          })}
        />
      </SectionCard>
    </div>
  );
}
