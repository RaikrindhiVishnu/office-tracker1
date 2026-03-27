// src/types/leave.ts

import { Timestamp } from "firebase/firestore";

export type LeaveType   = "annual" | "sick" | "casual" | "Work From Home";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveBalance {
  annual  : number;
  sick    : number;
  casual  : number;
}

export interface LeaveRequest {
  id           : string;       // Firestore doc id (injected by hook)
  type         : "leave";
  leaveType    : LeaveType;
  uid          : string;       // employee userId
  employeeName : string;
  department  ?: string;
  fromDate     : string;       // "YYYY-MM-DD"
  toDate       : string;       // "YYYY-MM-DD"
  totalDays    : number;
  reason       : string;
  status       : LeaveStatus;
  reviewedBy  ?: string;       // HR/Admin userId
  reviewedAt  ?: Timestamp;
  createdAt    : Timestamp;
}

export interface Notification {
  id        : string;
  uid       : string;          // recipient userId
  title     : string;
  message   : string;
  read      : boolean;
  createdAt : Timestamp;
}