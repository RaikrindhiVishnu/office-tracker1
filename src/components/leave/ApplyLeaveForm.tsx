"use client";

// src/components/leave/ApplyLeaveForm.tsx

import { useState, FormEvent } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { LeaveType } from "@/types/leave";

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "casual", "Work From Home"];

interface ApplyLeaveFormProps {
  leaveBalance ?: { annual: number; sick: number; casual: number };
  onSuccess    ?: () => void;
  onCancel     ?: () => void;
}

// ── Calculate working days between two date strings ───────────────────────
function calcWorkingDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end   = new Date(to);
  if (end < start) return 0;
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function ApplyLeaveForm({
  leaveBalance,
  onSuccess,
  onCancel,
}: ApplyLeaveFormProps) {
  const { user, userData } = useAuth();

  const [leaveType,  setLeaveType]  = useState<LeaveType>("annual");
  const [fromDate,   setFromDate]   = useState<string>("");
  const [toDate,     setToDate]     = useState<string>("");
  const [reason,     setReason]     = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error,      setError]      = useState<string>("");
  const [success,    setSuccess]    = useState<string>("");

  const totalDays = calcWorkingDays(fromDate, toDate);

  // Balance for selected type
  const balanceMap: Record<string, number | undefined> = {
    annual : leaveBalance?.annual,
    sick   : leaveBalance?.sick,
    casual : leaveBalance?.casual,
  };
  const availableBalance = balanceMap[leaveType];

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fromDate || !toDate) { setError("Please select both start and end dates."); return; }
    if (new Date(toDate) < new Date(fromDate)) { setError("End date must be after start date."); return; }
    if (!reason.trim()) { setError("Please provide a reason for your leave."); return; }
    if (totalDays === 0) { setError("No working days in selected range."); return; }

    // Balance check (skip for WFH)
    if (leaveType !== "Work From Home" && availableBalance !== undefined) {
      if (totalDays > availableBalance) {
        setError(`Insufficient ${leaveType} leave balance. Available: ${availableBalance} day(s), Requested: ${totalDays} day(s).`);
        return;
      }
    }

    if (!user) { setError("Not authenticated."); return; }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "requests"), {
        type         : "leave",
        leaveType,
        uid          : user.uid,
        employeeName : (userData?.name as string) ?? user.email ?? "Unknown",
        department   : (userData?.department as string) ?? null,
        fromDate,
        toDate,
        totalDays,
        reason       : reason.trim(),
        status       : "pending",
        createdAt    : Timestamp.now(),
      });

      setSuccess("Leave request submitted successfully!");
      setFromDate("");
      setToDate("");
      setReason("");
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Apply for Leave</h2>
          {onCancel && (
            <button onClick={onCancel} style={styles.closeBtn}>✕</button>
          )}
        </div>

        {/* Balance pills */}
        {leaveBalance && (
          <div style={styles.balanceRow}>
            {(["annual", "sick", "casual"] as const).map((t) => (
              <div key={t} style={{
                ...styles.balancePill,
                background  : leaveType === t ? "#143d3d" : "#f1f5f9",
                color       : leaveType === t ? "#fff"    : "#475569",
              }}>
                <span style={{ fontWeight: 800 }}>{leaveBalance[t]}</span>
                <span style={{ fontSize: 11 }}>{t}</span>
              </div>
            ))}
          </div>
        )}

        {success && <div style={styles.successBanner}>{success}</div>}
        {error   && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          {/* Leave type */}
          <div style={styles.field}>
            <label style={styles.label}>Leave Type *</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              style={styles.select}
              disabled={submitting}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>From Date *</label>
              <input
                type="date"
                value={fromDate}
                min={today}
                onChange={(e) => setFromDate(e.target.value)}
                style={styles.input}
                disabled={submitting}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>To Date *</label>
              <input
                type="date"
                value={toDate}
                min={fromDate || today}
                onChange={(e) => setToDate(e.target.value)}
                style={styles.input}
                disabled={submitting}
                required
              />
            </div>
          </div>

          {/* Working days indicator */}
          {totalDays > 0 && (
            <div style={styles.daysIndicator}>
              📅 <strong>{totalDays}</strong> working day{totalDays > 1 ? "s" : ""}
              {availableBalance !== undefined && leaveType !== "Work From Home" && (
                <span style={{ color: totalDays > availableBalance ? "#be123c" : "#15803d" }}>
                  &nbsp;({availableBalance} available)
                </span>
              )}
            </div>
          )}

          {/* Reason */}
          <div style={styles.field}>
            <label style={styles.label}>Reason *</label>
            <textarea
              placeholder="Briefly describe the reason for your leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...styles.input, resize: "vertical", minHeight: 80 }}
              disabled={submitting}
              rows={3}
              required
            />
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            {onCancel && (
              <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={submitting}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: submitting ? 0.65 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay      : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  card         : { background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", padding: "32px 28px", boxSizing: "border-box" },
  header       : { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title        : { margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" },
  closeBtn     : { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8", padding: "4px 8px" },
  balanceRow   : { display: "flex", gap: 10, marginBottom: 20 },
  balancePill  : { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", borderRadius: 99, gap: 2, fontSize: 13, transition: "all 0.2s" },
  successBanner: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#15803d", fontWeight: 500 },
  errorBanner  : { background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#be123c", fontWeight: 500 },
  form         : { display: "flex", flexDirection: "column", gap: 16 },
  row          : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field        : { display: "flex", flexDirection: "column", gap: 5 },
  label        : { fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" },
  input        : { padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" },
  select       : { padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", background: "#fff", cursor: "pointer", width: "100%" },
  daysIndicator: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#475569" },
  actions      : { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancelBtn    : { padding: "10px 20px", background: "#f1f5f9", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#475569", cursor: "pointer" },
  submitBtn    : { padding: "10px 24px", background: "#143d3d", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", boxShadow: "0 4px 12px rgba(20,61,61,0.3)", transition: "opacity 0.2s" },
};