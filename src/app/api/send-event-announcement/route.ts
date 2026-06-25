import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const {
      eventId,
      type = "announcement",
      sentBy = "admin",
      recipients,
    } = await req.json();

    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    // 1. Get event details
    const evDoc = await db.collection("companyEvents").doc(eventId).get();
    if (!evDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const ev = evDoc.data()!;

    // 2. Resolve recipients
    let recipientList: { email: string; name: string }[] = [];

    if (Array.isArray(recipients) && recipients.length > 0) {
      recipientList = recipients.filter(r => r.email);
    } else {
      const snap = await db.collection("users").get();
      recipientList = snap.docs
        .map(d => ({ email: d.data().email || d.data().workEmail || "", name: d.data().name || "" }))
        .filter(r => r.email);
    }

    if (recipientList.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // 3. Send emails one by one with delay to avoid Gmail rate limiting
    let sent = 0;
    const errors: string[] = [];

    for (const r of recipientList) {
      try {
        await sendEmail({
          to: r.email,
          subject: type === "reminder"
            ? `⏰ Reminder: ${ev.title} is coming up!`
            : `📅 ${ev.title} — You're Invited!`,
          html: buildEventHtml(ev, r.name, type),
        });

        await db.collection("greetingLogs").add({
          type: "event",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: type === "reminder" ? `⏰ Reminder: ${ev.title}` : `📅 ${ev.title}`,
          sentAt: new Date().toISOString(),
          sentBy,
          status: "success",
        });

        sent++;

        // 4000ms delay between emails to stay within Gmail limits and avoid spam filters
        await new Promise(res => setTimeout(res, 4000));

      } catch (err: any) {
        errors.push(`${r.email}: ${err.message}`);

        await db.collection("greetingLogs").add({
          type: "event",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: `${ev.title} (${type})`,
          sentAt: new Date().toISOString(),
          sentBy,
          status: "failed",
          error: err.message,
        });
      }
    }

    // 4. Mark as sent
    const updateField = type === "reminder" ? "reminderSentOn" : "announcementSentOn";
    await db.collection("companyEvents").doc(eventId).update({
      [updateField]: new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({ sent, errors });
  } catch (err: any) {
    console.error("send-event-announcement error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

function buildEventHtml(ev: any, recipientName: string, type: string): string {
  const isReminder = type === "reminder";
  const content = `
    ${isReminder
      ? `<p>This is a friendly reminder about the upcoming <strong>${ev.title}</strong> event.</p>`
      : `<p>We're excited to invite you to <strong>${ev.title}</strong>!</p>`
    }
    ${ev.description ? `<p>${ev.description}</p>` : ""}
    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #e2e8f0;">
      <div style="font-size:13px;color:#334155;margin-bottom:6px;">📅 <strong>Date:</strong> ${ev.eventDate}</div>
      ${ev.location ? `<div style="font-size:13px;color:#334155;margin-bottom:6px;">📍 <strong>Location:</strong> ${ev.location}</div>` : ""}
      ${ev.rsvpLink ? `<div style="font-size:13px;color:#334155;">🔗 <a href="${ev.rsvpLink}" style="color:#2563eb;font-weight:700;">RSVP Here</a></div>` : ""}
    </div>
    <p>See you there!</p>
  `;

  const { buildMncEmailHtml } = require("@/lib/emailTemplate");
  return buildMncEmailHtml(
    isReminder ? `Reminder: ${ev.title}` : ev.title,
    isReminder ? "⏰" : "📅",
    isReminder ? "Don't forget — this event is coming up soon!" : "You're Invited!",
    recipientName || "Team Member",
    content
  );
}