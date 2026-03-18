// lib/emailSender.ts
// Batch email sender with retry logic + Firestore logging.
// Uses Firebase ADMIN SDK — safe to run in Next.js API routes (Node.js).

import nodemailer        from "nodemailer";
import admin              from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";
import type { EmailBatch} from "../types";

const FieldValue = admin.firestore.FieldValue;

// ─── Nodemailer transport ─────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE  = 10;
const BATCH_DELAY = 1500;   // ms between batches — stay within Gmail limits
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Send one email with automatic retry ─────────────────────────────────────

async function sendWithRetry(
  email: string, name: string, subject: string, html: string, attempt = 0,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from:    `"HR Team – Techgy Innovations 🎉" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject,
      html,
    });
    return { ok: true };
  } catch (err: any) {
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY);
      return sendWithRetry(email, name, subject, html, attempt + 1);
    }
    return { ok: false, error: err.message ?? "Send failed" };
  }
}

// ─── Batch result type ────────────────────────────────────────────────────────

export interface BatchResult {
  total: number; sent: number; failed: number;
  errors: { email: string; error: string }[];
}

// ─── Main batch sender ────────────────────────────────────────────────────────

export async function sendBatch(batch: EmailBatch): Promise<BatchResult> {
  
  const result: BatchResult = { total: batch.recipients.length, sent: 0, failed: 0, errors: [] };
  const todayISO = new Date().toISOString().slice(0, 10);
  const sentAt   = new Date().toISOString();

  for (let i = 0; i < batch.recipients.length; i += BATCH_SIZE) {
    const chunk = batch.recipients.slice(i, i + BATCH_SIZE);

    await Promise.all(chunk.map(async (r) => {
      const html = batch.html(r.name);
      const { ok, error } = await sendWithRetry(r.email, r.name, batch.subject, html);

      // ── Write log entry via Admin SDK ──────────────────────────────────────
      const logData: Record<string, any> = {
        type:           batch.type,
        recipientEmail: r.email,
        recipientName:  r.name,
        subject:        batch.subject,
        sentAt,
        sentBy:         batch.sentBy,
        status:         ok ? "success" : "failed",
        createdAt:      FieldValue.serverTimestamp(),
      };
      if (r.id)        logData.employeeId = r.id;
      if (batch.refId) logData.refId      = batch.refId;
      if (error)       logData.error      = error;

      await adminDb.collection("greetingLogs").add(logData).catch(console.error);

      // ── Stamp lastWishSentOn on birthday employee doc ──────────────────────
      if (ok && batch.type === "birthday" && r.id) {
        await adminDb.collection("birthdays").doc(r.id)
          .update({ lastWishSentOn: todayISO })
          .catch(console.error);
      }

      if (ok) result.sent++;
      else { result.failed++; result.errors.push({ email: r.email, error: error! }); }
    }));

    if (i + BATCH_SIZE < batch.recipients.length) await delay(BATCH_DELAY);
  }

  return result;
}

// ─── Stamp last-sent date on festival / event docs ───────────────────────────

export async function markLastSent(
  col: "festivals" | "companyEvents",
  docId: string,
  field: string,
) {
  const todayISO = new Date().toISOString().slice(0, 10);
  await adminDb
    .collection(col)
    .doc(docId)
    .update({ [field]: todayISO })
    .catch(console.error);
}