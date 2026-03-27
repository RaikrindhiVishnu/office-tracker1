"use client";

// src/hooks/useTransactions.ts

import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Transaction,
  UseTransactionsOptions,
  UseTransactionsReturn,
} from "@/types/transaction";

// ── Extract Firestore index URL from error message ────────────────────────
function extractIndexUrl(msg = ""): string | null {
  const m = msg.match(/(https:\/\/console\.firebase\.google\.com\/[^\s"'\n]+)/);
  return m ? m[1].trim() : null;
}

function isIndexError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === "failed-precondition" ||
    err?.code === "9" ||
    (err?.message?.includes("index") ?? false) ||
    (err?.message?.includes("FAILED_PRECONDITION") ?? false) ||
    (err?.message?.includes("console.firebase.google.com") ?? false)
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useTransactions(
  options: UseTransactionsOptions = {}
): UseTransactionsReturn & { indexUrl: string | null } {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [indexUrl,     setIndexUrl]     = useState<string | null>(null);

  // Use a ref to avoid re-subscribing when options object reference changes
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setIndexUrl(null);

    const {
      type,
      category,
      department,
      createdBy,
      startDate,
      endDate,
      status,
    } = optionsRef.current;

    // ── Build query constraints ──────────────────────────────────────────
    const constraints: QueryConstraint[] = [];

    if (type)       constraints.push(where("type",       "==", type));
    if (category)   constraints.push(where("category",   "==", category));
    if (department) constraints.push(where("department", "==", department));
    if (createdBy)  constraints.push(where("createdBy",  "==", createdBy));
    if (status)     constraints.push(where("status",     "==", status));

    if (startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
    }
    if (endDate) {
      // Include the full end day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(end)));
    }

    // Always sort newest first
    constraints.push(orderBy("createdAt", "desc"));

    const q = query(collection(db, "transactions"), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Transaction, "id">),
        }));
        setTransactions(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useTransactions error:", err);
        if (isIndexError(err)) {
          const url = extractIndexUrl(err.message);
          setIndexUrl(url);
          setError(
            url
              ? `Missing Firestore index. Click the link to create it: ${url}`
              : "Missing Firestore composite index. Check the console for the creation link."
          );
        } else {
          setError(err.message ?? "Failed to load transactions.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // Re-subscribe only when filter values change (not the object reference)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.type,
    options.category,
    options.department,
    options.createdBy,
    options.status,
    options.startDate?.toISOString(),
    options.endDate?.toISOString(),
  ]);

  // ── Derived totals ────────────────────────────────────────────────────
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense" || t.type === "salary")
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const netProfit = totalIncome - totalExpense;

  return {
    transactions,
    loading,
    error,
    indexUrl,
    totalIncome,
    totalExpense,
    netProfit,
  };
}