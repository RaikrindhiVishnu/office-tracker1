"use client";

// src/components/finance/AddTransactionForm.tsx

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { TransactionType, TransactionCategory } from "@/types/transaction";

// ── Constants ─────────────────────────────────────────────────────────────

const TYPES: TransactionType[] = ["income", "expense", "salary"];

const CATEGORIES: TransactionCategory[] = [
  "sales", "IT", "payroll", "rent", "subscription",
  "marketing", "operations", "repair", "license",
];

// Category → allowed types (UX guard)
const CATEGORY_TYPE_MAP: Record<TransactionCategory, TransactionType[]> = {
  sales        : ["income"],
  IT           : ["expense"],
  payroll      : ["salary", "expense"],
  rent         : ["expense"],
  subscription : ["expense"],
  marketing    : ["expense"],
  operations   : ["expense"],
  repair       : ["expense"],
  license      : ["expense"],
};

// ── Helper: current month as YYYY-MM ─────────────────────────────────────
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Props ─────────────────────────────────────────────────────────────────
interface AddTransactionFormProps {
  onSuccess ?: () => void;
  onCancel  ?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AddTransactionForm({
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const { user, userData } = useAuth();

  // ── Form state ──────────────────────────────────────────────────────────
  const [type,        setType]        = useState<TransactionType>("expense");
  const [category,    setCategory]    = useState<TransactionCategory>("operations");
  const [amount,      setAmount]      = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [projectId,   setProjectId]   = useState<string>("");

  // Department auto-filled from user profile
  const department = (userData?.department as string) ?? (userData?.accountType as string) ?? "";

  // Receipt upload
  const [receiptFile,     setReceiptFile]     = useState<File | null>(null);
  const [uploadProgress,  setUploadProgress]  = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error,      setError]      = useState<string>("");
  const [success,    setSuccess]    = useState<string>("");

  // ── File selection ──────────────────────────────────────────────────────
  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 10 * 1024 * 1024) {
      setError("Receipt file must be under 10 MB.");
      return;
    }
    setReceiptFile(file);
    setError("");
  }

  // ── Upload receipt to Firebase Storage ──────────────────────────────────
  async function uploadReceipt(file: File): Promise<string> {
    const path      = `receipts/${user!.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const task       = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadProgress(pct);
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    if (!user) {
      setError("You must be logged in to add a transaction.");
      return;
    }

    try {
      setSubmitting(true);

      // Upload receipt if provided
      let receiptUrl: string | null = null;
      if (receiptFile) {
        setUploadProgress(0);
        receiptUrl = await uploadReceipt(receiptFile);
      }

      // Write to Firestore
      await addDoc(collection(db, "transactions"), {
        type,
        category,
        amount        : parsedAmount,
        description   : description.trim() || null,
        department    : department || null,
        projectId     : projectId.trim() || null,
        status        : "pending",
        month         : getCurrentMonth(),
        createdBy     : user.uid,
        createdByName : userData?.name ?? user.email ?? "Unknown",
        receiptUrl,
        createdAt     : Timestamp.now(),
      });

      setSuccess("Transaction added successfully!");
      // Reset form
      setAmount("");
      setDescription("");
      setProjectId("");
      setReceiptFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";

      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error("AddTransaction error:", err);
      setError(e.message ?? "Failed to save transaction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Available types for selected category ───────────────────────────────
  const availableTypes = CATEGORY_TYPE_MAP[category] ?? TYPES;

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Add Transaction</h2>
          {onCancel && (
            <button onClick={onCancel} style={styles.closeBtn} aria-label="Close">✕</button>
          )}
        </div>

        {/* Success */}
        {success && (
          <div style={styles.successBanner}>{success}</div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBanner}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          {/* Row: Category + Type */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Category *</label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as TransactionCategory;
                  setCategory(cat);
                  // Auto-select first allowed type for this category
                  const allowed = CATEGORY_TYPE_MAP[cat];
                  if (allowed && !allowed.includes(type)) setType(allowed[0]);
                }}
                style={styles.select}
                disabled={submitting}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                style={styles.select}
                disabled={submitting}
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div style={styles.field}>
            <label style={styles.label}>Amount (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={styles.input}
              disabled={submitting}
              required
            />
          </div>

          {/* Description */}
          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea
              placeholder="Optional notes about this transaction..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...styles.input, resize: "vertical", minHeight: 72 }}
              disabled={submitting}
              rows={3}
            />
          </div>

          {/* Row: Department (read-only) + Project ID */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Department</label>
              <input
                type="text"
                value={department}
                readOnly
                style={{ ...styles.input, background: "#f1f5f9", color: "#64748b", cursor: "default" }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Project ID</label>
              <input
                type="text"
                placeholder="Optional"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={styles.input}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Receipt Upload */}
          <div style={styles.field}>
            <label style={styles.label}>Attach Receipt</label>
            <div
              style={styles.uploadZone}
              onClick={() => fileInputRef.current?.click()}
            >
              {receiptFile ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#143d3d" }}>
                    {receiptFile.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {(receiptFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Click to upload receipt
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    PNG, JPG, PDF — max 10 MB
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={submitting}
            />

            {/* Upload progress bar */}
            {submitting && receiptFile && uploadProgress > 0 && uploadProgress < 100 && (
              <div style={styles.progressWrap}>
                <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }} />
                <span style={styles.progressLabel}>{uploadProgress}%</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={styles.cancelBtn}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              style={{
                ...styles.submitBtn,
                opacity: submitting ? 0.65 : 1,
                cursor : submitting ? "not-allowed" : "pointer",
              }}
              disabled={submitting}
            >
              {submitting
                ? receiptFile && uploadProgress < 100
                  ? `Uploading ${uploadProgress}%...`
                  : "Saving..."
                : "Add Transaction"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position       : "fixed",
    inset          : 0,
    background     : "rgba(0,0,0,0.45)",
    display        : "flex",
    alignItems     : "center",
    justifyContent : "center",
    zIndex         : 1000,
    padding        : "20px",
  },
  card: {
    background   : "#fff",
    borderRadius : 20,
    boxShadow    : "0 24px 64px rgba(0,0,0,0.2)",
    width        : "100%",
    maxWidth     : 560,
    maxHeight    : "90vh",
    overflowY    : "auto",
    padding      : "32px 28px",
    boxSizing    : "border-box",
  },
  header: {
    display        : "flex",
    alignItems     : "center",
    justifyContent : "space-between",
    marginBottom   : 20,
  },
  title: {
    margin     : 0,
    fontSize   : 20,
    fontWeight : 800,
    color      : "#0f172a",
  },
  closeBtn: {
    background : "none",
    border     : "none",
    fontSize   : 18,
    cursor     : "pointer",
    color      : "#94a3b8",
    padding    : "4px 8px",
  },
  successBanner: {
    background   : "#f0fdf4",
    border       : "1px solid #bbf7d0",
    borderRadius : 10,
    padding      : "10px 14px",
    marginBottom : 16,
    fontSize     : 13,
    color        : "#15803d",
    fontWeight   : 500,
  },
  errorBanner: {
    background   : "#fff1f2",
    border       : "1px solid #fecdd3",
    borderRadius : 10,
    padding      : "10px 14px",
    marginBottom : 16,
    fontSize     : 13,
    color        : "#be123c",
    fontWeight   : 500,
  },
  form: {
    display       : "flex",
    flexDirection : "column",
    gap           : 16,
  },
  row: {
    display             : "grid",
    gridTemplateColumns : "1fr 1fr",
    gap                 : 12,
  },
  field: {
    display       : "flex",
    flexDirection : "column",
    gap           : 5,
  },
  label: {
    fontSize     : 12,
    fontWeight   : 600,
    color        : "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    padding      : "10px 14px",
    border       : "1.5px solid #e2e8f0",
    borderRadius : 10,
    fontSize     : 14,
    color        : "#0f172a",
    outline      : "none",
    fontFamily   : "inherit",
    boxSizing    : "border-box",
    width        : "100%",
  },
  select: {
    padding      : "10px 14px",
    border       : "1.5px solid #e2e8f0",
    borderRadius : 10,
    fontSize     : 14,
    color        : "#0f172a",
    outline      : "none",
    background   : "#fff",
    cursor       : "pointer",
    width        : "100%",
  },
  uploadZone: {
    border        : "2px dashed #cbd5e1",
    borderRadius  : 12,
    padding       : "20px 16px",
    cursor        : "pointer",
    transition    : "border-color 0.2s",
    display       : "flex",
    alignItems    : "center",
    justifyContent: "center",
  },
  progressWrap: {
    position     : "relative",
    height       : 6,
    background   : "#e2e8f0",
    borderRadius : 99,
    marginTop    : 8,
    overflow     : "hidden",
  },
  progressBar: {
    position     : "absolute",
    left         : 0,
    top          : 0,
    height       : "100%",
    background   : "#143d3d",
    borderRadius : 99,
    transition   : "width 0.3s",
  },
  progressLabel: {
    position  : "absolute",
    right     : 0,
    top       : -18,
    fontSize  : 11,
    color     : "#64748b",
  },
  actions: {
    display        : "flex",
    justifyContent : "flex-end",
    gap            : 10,
    marginTop      : 4,
  },
  cancelBtn: {
    padding      : "10px 20px",
    background   : "#f1f5f9",
    border       : "none",
    borderRadius : 10,
    fontSize     : 14,
    fontWeight   : 600,
    color        : "#475569",
    cursor       : "pointer",
  },
  submitBtn: {
    padding      : "10px 24px",
    background   : "#143d3d",
    border       : "none",
    borderRadius : 10,
    fontSize     : 14,
    fontWeight   : 700,
    color        : "#fff",
    boxShadow    : "0 4px 12px rgba(20,61,61,0.3)",
    transition   : "opacity 0.2s",
  },
};