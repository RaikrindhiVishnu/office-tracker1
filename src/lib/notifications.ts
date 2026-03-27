// src/lib/notifications.ts
// ─────────────────────────────────────────────────────────────────────────────
// Usage (call after any approval / rejection / action):
//
//   import { createNotification } from "@/lib/notifications";
//
//   await createNotification({
//     userId: "uid_123",
//     type: "success",
//     title: "Leave Approved",
//     message: "Your leave request for Dec 25 has been approved.",
//     relatedCollection: "leaveRequests",
//     relatedDocId: leaveDoc.id,
//   });
// ─────────────────────────────────────────────────────────────────────────────

import { collection, addDoc, updateDoc, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { serverTimestamp } from "firebase/firestore"

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
    createdAt: serverTimestamp(), // 🔥 FIXED
  });
  return ref.id;
}

// ─── Notify multiple users at once ───────────────────────────────────────────

export async function createNotificationForMany(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
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
      createdAt: now,
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

// ─── Pre-built helpers for common actions ────────────────────────────────────
// Call these directly after approval / rejection actions.

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