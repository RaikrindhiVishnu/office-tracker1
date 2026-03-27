// src/types/transaction.ts

import { Timestamp } from "firebase/firestore";

export type TransactionType     = "income" | "expense" | "salary";
export type TransactionCategory =
  | "sales"
  | "IT"
  | "payroll"
  | "rent"
  | "subscription"
  | "marketing"
  | "operations"
  | "repair"
  | "license";
export type TransactionStatus = "pending" | "approved";

export interface Transaction {
  id            : string;          // Firestore doc id (injected by hook)
  type          : TransactionType;
  category      : TransactionCategory;
  amount        : number;
  description  ?: string;
  department   ?: string;
  projectId    ?: string | null;
  status        : TransactionStatus;
  month         : string;          // "YYYY-MM"
  createdBy     : string;          // userId
  createdByName : string;
  receiptUrl   ?: string | null;   // Firebase Storage download URL
  createdAt     : Timestamp;
}

// Options accepted by useTransactions()
export interface UseTransactionsOptions {
  type       ?: TransactionType;
  category   ?: TransactionCategory;
  department ?: string;
  createdBy  ?: string;
  startDate  ?: Date;
  endDate    ?: Date;
  status     ?: TransactionStatus;
}

// Return value of useTransactions()
export interface UseTransactionsReturn {
  transactions  : Transaction[];
  loading       : boolean;
  error         : string | null;
  totalIncome   : number;
  totalExpense  : number;
  netProfit     : number;
}