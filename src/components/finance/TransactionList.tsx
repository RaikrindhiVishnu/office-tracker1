"use client";

// src/components/finance/TransactionList.tsx
// Example consumer of useTransactions() — drop into any dashboard page.

import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import AddTransactionForm from "./AddTransactionForm";
import type { UseTransactionsOptions, Transaction } from "@/types/transaction";

// ── Helpers ───────────────────────────────────────────────────────────────
function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style    : "currency",
    currency : "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────
interface TransactionListProps {
  /** Pre-set filters — e.g. pass department from a dashboard layout */
  defaultFilters?: UseTransactionsOptions;
}

export default function TransactionList({ defaultFilters = {} }: TransactionListProps): JSX.Element {
  const [showForm,   setShowForm]   = useState(false);
  const [filters,    setFilters]    = useState<UseTransactionsOptions>(defaultFilters);

  const {
    transactions,
    loading,
    error,
    indexUrl,
    totalIncome,
    totalExpense,
    netProfit,
  } = useTransactions(filters);

  // ── Summary cards ────────────────────────────────────────────────────
  const summaryCards = [
    { label: "Total Income",   value: totalIncome,   color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
    { label: "Total Expense",  value: totalExpense,  color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
    { label: "Net Profit",     value: netProfit,     color: netProfit >= 0 ? "#1d4ed8" : "#be123c", bg: "#eff6ff", border: "#bfdbfe" },
  ];

  // ── Status badge ─────────────────────────────────────────────────────
  function StatusBadge({ status }: { status: Transaction["status"] }): JSX.Element {
    const map = {
      approved : { bg: "#f0fdf4", color: "#15803d", label: "Approved" },
      pending  : { bg: "#fffbeb", color: "#92400e", label: "Pending" },
    };
    const s = map[status] ?? map.pending;
    return (
      <span style={{
        background   : s.bg,
        color        : s.color,
        borderRadius : 99,
        padding      : "2px 10px",
        fontSize     : 11,
        fontWeight   : 700,
      }}>{s.label}</span>
    );
  }

  // ── Type badge ───────────────────────────────────────────────────────
  function TypeBadge({ type }: { type: Transaction["type"] }): JSX.Element {
    const map = {
      income  : { bg: "#f0fdf4", color: "#15803d" },
      expense : { bg: "#fff1f2", color: "#be123c" },
      salary  : { bg: "#f5f3ff", color: "#6d28d9" },
    };
    const s = map[type] ?? { bg: "#f1f5f9", color: "#475569" };
    return (
      <span style={{
        background   : s.bg,
        color        : s.color,
        borderRadius : 99,
        padding      : "2px 10px",
        fontSize     : 11,
        fontWeight   : 700,
        textTransform: "capitalize",
      }}>{type}</span>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          Transactions
        </h1>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background   : "#143d3d",
            color        : "#fff",
            border       : "none",
            borderRadius : 10,
            padding      : "10px 20px",
            fontSize     : 14,
            fontWeight   : 700,
            cursor       : "pointer",
            boxShadow    : "0 4px 12px rgba(20,61,61,0.3)",
          }}
        >
          + Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{
            background   : card.bg,
            border       : `1px solid ${card.border}`,
            borderRadius : 14,
            padding      : "16px 20px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>
              {formatCurrency(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {(["income", "expense", "salary", ""] as const).map((t) => (
          <button
            key={t || "all"}
            onClick={() => setFilters((f) => ({ ...f, type: t || undefined }))}
            style={{
              padding      : "6px 16px",
              borderRadius : 99,
              border       : "1.5px solid",
              borderColor  : filters.type === (t || undefined) ? "#143d3d" : "#e2e8f0",
              background   : filters.type === (t || undefined) ? "#143d3d" : "#fff",
              color        : filters.type === (t || undefined) ? "#fff" : "#475569",
              fontSize     : 13,
              fontWeight   : 600,
              cursor       : "pointer",
              textTransform: "capitalize",
            }}
          >
            {t || "All"}
          </button>
        ))}
      </div>

      {/* Index error */}
      {indexUrl && (
        <div style={{
          background   : "#fffbeb",
          border       : "1px solid #fbbf24",
          borderRadius : 12,
          padding      : "14px 16px",
          marginBottom : 20,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#78350f" }}>
            ⚠️ Missing Firestore Index
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#92400e" }}>
            A composite index is needed for the current filters.
          </p>
          <a href={indexUrl} target="_blank" rel="noopener noreferrer" style={{
            display      : "inline-block",
            padding      : "8px 16px",
            background   : "#f59e0b",
            color        : "#fff",
            borderRadius : 8,
            fontSize     : 13,
            fontWeight   : 700,
            textDecoration: "none",
          }}>
            🔗 Create Index in Firebase →
          </a>
        </div>
      )}

      {/* General error */}
      {error && !indexUrl && (
        <div style={{
          background   : "#fff1f2",
          border       : "1px solid #fecdd3",
          borderRadius : 10,
          padding      : "10px 14px",
          marginBottom : 16,
          fontSize     : 13,
          color        : "#be123c",
        }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 14 }}>
          Loading transactions...
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && transactions.length === 0 && (
        <div style={{
          textAlign    : "center",
          padding      : "48px 0",
          color        : "#94a3b8",
          background   : "#f8fafc",
          borderRadius : 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No transactions found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Adjust filters or add a new transaction.</div>
        </div>
      )}

      {/* Table */}
      {!loading && transactions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Date", "Type", "Category", "Department", "Amount", "Description", "Status"].map((h) => (
                  <th key={h} style={{
                    padding      : "10px 14px",
                    textAlign    : "left",
                    fontWeight   : 700,
                    color        : "#475569",
                    borderBottom : "1.5px solid #e2e8f0",
                    whiteSpace   : "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>{formatDate(tx.createdAt as never)}</td>
                  <td style={tdStyle}><TypeBadge type={tx.type} /></td>
                  <td style={tdStyle}>{tx.category}</td>
                  <td style={tdStyle}>{tx.department ?? "—"}</td>
                  <td style={{
                    ...tdStyle,
                    fontWeight : 700,
                    color      : tx.type === "income" ? "#15803d" : "#be123c",
                  }}>
                    {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tx.description ?? "—"}
                  </td>
                  <td style={tdStyle}><StatusBadge status={tx.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showForm && (
        <AddTransactionForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding  : "12px 14px",
  color    : "#0f172a",
  verticalAlign: "middle",
};