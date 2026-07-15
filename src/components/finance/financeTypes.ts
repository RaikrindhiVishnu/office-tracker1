import { Timestamp } from "firebase/firestore";

export interface PurchaseRequest {
  id?: string;
  item: string;
  estimatedCost: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  month: string;
  createdAt?: Timestamp;
}

export interface SalaryAdvance {
  id?: string;
  employeeName: string;
  employeeId?: string;
  amount: number;
  reason: string;
  repaymentMonths: number;
  status: "Pending" | "Approved" | "Rejected";
  month: string;
  createdAt?: Timestamp;
}

export interface VendorPayment {
  id?: string;
  vendorName: string;
  service: string;
  amount: number;
  dueDate: string;
  status: "Pending" | "Paid";
  month: string;
  createdAt?: Timestamp;
}

export interface Budget {
  id?: string;
  department: string;
  allocated: number;
  used: number;
  month: string;
  createdAt?: Timestamp;
}

export interface Reimbursement {
  id?: string;
  itemName: string;
  cost: number;
  date: string;
  status: "Pending" | "Approved" | "Rejected" | "Reimbursed";
  employeeName: string;
  productType: string;
  month: string;
  createdAt?: Timestamp;
}
