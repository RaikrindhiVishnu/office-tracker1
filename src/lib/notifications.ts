// src/lib/notifications.ts

import { db } from "@/lib/firebase";
import {
  collection, addDoc, updateDoc, doc, writeBatch, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

// ── Per-user notification type (existing — for employee bell) ─────────────────
export type NotificationType = "info" | "warning" | "success" | "error";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedCollection?: string;
  relatedDocId?: string;
  createdAt: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedCollection?: string;
  relatedDocId?: string;
}

// ── Cross-dashboard notification type (new — for dashboard bells) ─────────────
export type NotifRole =
  | "sales"
  | "hr"
  | "finance"
  | "admin"
  | "marketing";

export interface AppNotification {
  id?: string;
  type: string;           // "SALE_CREATED" | "LEAD_WON" | "EMPLOYEE_ADDED" | "EXPENSE_ADDED" etc.
  title: string;
  message: string;
  icon: string;           // emoji
  createdBy: string;      // user name
  createdByUid?: string;
  relatedId?: string;     // sale id, employee id, etc.
  visibleTo: NotifRole[]; // which dashboards see this
  readBy: string[];       // uids who marked read
  priority: "low" | "medium" | "high";
  createdAt?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-USER NOTIFICATIONS (existing — used by employee-facing bell)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Create a single notification ────────────────────────────────────────────
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const ref = await addDoc(collection(db, "notifications"), {
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    relatedCollection: params.relatedCollection || "",
    relatedDocId: params.relatedDocId || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Notify multiple users at once ───────────────────────────────────────────
export async function createNotificationForMany(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  const batch = writeBatch(db);
  userIds.forEach((userId) => {
    const ref = doc(collection(db, "notifications"));
    batch.set(ref, {
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      isRead: false,
      relatedCollection: params.relatedCollection || "",
      relatedDocId: params.relatedDocId || "",
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// ─── Mark single notification as read ────────────────────────────────────────
export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), { isRead: true });
}

// ─── Mark ALL notifications as read for a user ───────────────────────────────
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("isRead", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

// ─── Pre-built helpers for common employee actions ────────────────────────────
export const notifyLeaveApproved = (userId: string, dates: string, docId: string) =>
  createNotification({
    userId, type: "success",
    title: "Leave Approved ✓",
    message: `Your leave request for ${dates} has been approved.`,
    relatedCollection: "leaveRequests", relatedDocId: docId,
  });

export const notifyLeaveRejected = (userId: string, dates: string, reason: string, docId: string) =>
  createNotification({
    userId, type: "error",
    title: "Leave Request Rejected",
    message: `Your leave for ${dates} was rejected. Reason: ${reason}`,
    relatedCollection: "leaveRequests", relatedDocId: docId,
  });

export const notifyAttendanceFlagged = (userId: string, date: string, docId: string) =>
  createNotification({
    userId, type: "warning",
    title: "Attendance Flagged",
    message: `Your attendance on ${date} has been flagged for review.`,
    relatedCollection: "attendance", relatedDocId: docId,
  });

export const notifyPayslipReady = (userId: string, month: string, docId: string) =>
  createNotification({
    userId, type: "info",
    title: "Payslip Ready",
    message: `Your payslip for ${month} is now available.`,
    relatedCollection: "payslips", relatedDocId: docId,
  });

export const notifyAssetAssigned = (userId: string, assetName: string, docId: string) =>
  createNotification({
    userId, type: "info",
    title: "Asset Assigned",
    message: `${assetName} has been assigned to you.`,
    relatedCollection: "it_assets", relatedDocId: docId,
  });

export const notifyAssetRepairLogged = (userId: string, assetName: string, docId: string) =>
  createNotification({
    userId, type: "warning",
    title: "Asset Sent for Repair",
    message: `${assetName} has been sent for repair and is temporarily unavailable.`,
    relatedCollection: "it_assets", relatedDocId: docId,
  });

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-DASHBOARD NOTIFICATIONS (new — used by dashboard-level bells)
// Collection: "appNotifications" — separate from per-user "notifications"
// ─────────────────────────────────────────────────────────────────────────────

// ─── Log any cross-dashboard activity ────────────────────────────────────────
export async function logActivity(
  notif: Omit<AppNotification, "id" | "readBy" | "createdAt">
): Promise<void> {
  try {
    await addDoc(collection(db, "appNotifications"), {
      ...notif,
      readBy: [],
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[logActivity] failed:", err);
  }
}

// ─── Subscribe to notifications for a given dashboard role ───────────────────
export function subscribeNotifications(
  role: NotifRole,
  cb: (notifs: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, "appNotifications"),
    where("visibleTo", "array-contains", role),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
  });
}

// ─── Mark all appNotifications as read for a uid ─────────────────────────────
export async function markAllRead(notifs: AppNotification[], uid: string): Promise<void> {
  const unread = notifs.filter(n => !n.readBy?.includes(uid));
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(n => {
    batch.update(doc(db, "appNotifications", n.id!), {
      readBy: [...(n.readBy || []), uid],
    });
  });
  await batch.commit();
}

// ─── Pre-built helpers for cross-dashboard actions ───────────────────────────
export const logSaleCreated = (
  salesPerson: string,
  clientName: string,
  amount: number,
  saleId: string
) =>
  logActivity({
    type: "SALE_CREATED",
    title: "New sale closed",
    message: `${salesPerson} closed a deal with ${clientName} for ₹${amount.toLocaleString("en-IN")}`,
    icon: "💵",
    createdBy: salesPerson,
    relatedId: saleId,
    visibleTo: ["sales", "finance", "hr", "admin"],
    priority: amount >= 100000 ? "high" : "medium",
  });

export const logLeadWon = (
  salesPerson: string,
  leadName: string,
  company: string,
  value: number
) =>
  logActivity({
    type: "LEAD_WON",
    title: "Lead converted",
    message: `${salesPerson} converted ${leadName} from ${company} — ₹${value.toLocaleString("en-IN")}`,
    icon: "🎯",
    createdBy: salesPerson,
    visibleTo: ["sales", "hr", "finance"],
    priority: "high",
  });

export const logEmployeeAdded = (employeeName: string, department: string) =>
  logActivity({
    type: "EMPLOYEE_ADDED",
    title: "New employee added",
    message: `${employeeName} joined the ${department} department`,
    icon: "👤",
    createdBy: "HR",
    visibleTo: ["hr", "admin", "finance"],
    priority: "medium",
  });

export const logLeaveApproved = (
  hrName: string,
  employeeName: string,
  leaveType: string,
  dates: string
) =>
  logActivity({
    type: "LEAVE_APPROVED",
    title: "Leave approved",
    message: `${employeeName}'s ${leaveType} leave (${dates}) approved by ${hrName}`,
    icon: "✅",
    createdBy: hrName,
    visibleTo: ["hr", "admin"],
    priority: "low",
  });

export const logExpenseAdded = (category: string, amount: number, month: string) =>
  logActivity({
    type: "EXPENSE_ADDED",
    title: "New expense logged",
    message: `${category} expense of ₹${amount.toLocaleString("en-IN")} added for ${month}`,
    icon: "🧾",
    createdBy: "Finance",
    visibleTo: ["finance", "admin"],
    priority: amount >= 50000 ? "high" : "low",
  });

export const logPayrollProcessed = (employeeName: string, finalSalary: number, month: string) =>
  logActivity({
    type: "PAYROLL_PROCESSED",
    title: "Payroll entry added",
    message: `${employeeName}'s salary of ₹${finalSalary.toLocaleString("en-IN")} processed for ${month}`,
    icon: "💰",
    createdBy: "Finance",
    visibleTo: ["finance", "hr", "admin"],
    priority: "medium",
  });

export const logAnnouncement = (hrName: string, messageText: string) =>
  logActivity({
    type: "ANNOUNCEMENT",
    title: "New announcement",
    message: messageText.slice(0, 120),
    icon: "📣",
    createdBy: hrName,
    visibleTo: ["sales", "finance", "hr", "admin"],
    priority: "medium",
  });