// src/lib/leaveActions.ts

import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { notifyLeaveApproved, notifyLeaveRejected } from "@/lib/notifications";

import type { LeaveRequest, LeaveBalance, LeaveType } from "@/types/leave";

// ── Leave type → balance key mapping ─────────────────────────────
const BALANCE_KEY: Partial<Record<LeaveType, keyof LeaveBalance>> = {
  annual: "annual",
  sick: "sick",
  casual: "casual",
};

// ── APPROVE LEAVE ────────────────────────────────────────────────
export async function approveLeaveRequest(
  request: LeaveRequest,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const balanceKey = BALANCE_KEY[request.leaveType];

    await runTransaction(db, async (tx) => {
      const requestRef = doc(db, "requests", request.id);
      const empRef = doc(db, "employees", request.uid);

      const empSnap = await tx.get(empRef);

      if (!empSnap.exists()) {
        throw new Error(`Employee not found: ${request.uid}`);
      }

      const data = empSnap.data();
      const balance = (data?.leaveBalance ?? {}) as LeaveBalance;

      // 🔹 Deduct leave balance if applicable
      if (balanceKey) {
        const current = balance[balanceKey] ?? 0;

        if (current < request.totalDays) {
          throw new Error(
            `Insufficient ${balanceKey} balance. Available: ${current}, Requested: ${request.totalDays}`
          );
        }

        tx.update(empRef, {
          [`leaveBalance.${balanceKey}`]: current - request.totalDays,
        });
      }

      // 🔹 Update leave request
      tx.update(requestRef, {
        status: "approved",
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
      });
    });

    // 🔔 Notification (outside transaction)
    await notifyLeaveApproved(
      request.uid,
      `${request.fromDate} - ${request.toDate}`,
      request.id
    );

    return { success: true };
  } catch (err: any) {
    console.error("approveLeaveRequest:", err);
    return {
      success: false,
      error: err.message || "Failed to approve leave",
    };
  }
}

// ── REJECT LEAVE ────────────────────────────────────────────────
export async function rejectLeaveRequest(
  request: LeaveRequest,
  reviewerId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, "requests", request.id), {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      ...(reason ? { rejectionReason: reason } : {}),
    });

    // 🔔 Notification
    await notifyLeaveRejected(
      request.uid,
      `${request.fromDate} - ${request.toDate}`,
      reason || "Rejected by HR",
      request.id
    );

    return { success: true };
  } catch (err: any) {
    console.error("rejectLeaveRequest:", err);
    return {
      success: false,
      error: err.message || "Failed to reject leave",
    };
  }
}

// ── GET LEAVE BALANCE ───────────────────────────────────────────
export async function getLeaveBalance(
  uid: string
): Promise<LeaveBalance | null> {
  try {
    const snap = await getDoc(doc(db, "employees", uid));
    if (!snap.exists()) return null;

    return (snap.data()?.leaveBalance ?? null) as LeaveBalance | null;
  } catch (error) {
    console.error("getLeaveBalance:", error);
    return null;
  }
}