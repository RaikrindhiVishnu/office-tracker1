// app/api/send-festival-greeting/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const {
      festivalId,
      sentBy = "admin",
      recipients,
    } = await req.json();

    if (!festivalId) {
      return NextResponse.json({ error: "festivalId required" }, { status: 400 });
    }

    // 1. Get festival details
    const festDoc = await db.collection("festivals").doc(festivalId).get();
    if (!festDoc.exists) {
      return NextResponse.json({ error: "Festival not found" }, { status: 404 });
    }

    const fest = festDoc.data()!;

    // 2. Resolve recipients
    let recipientList: { email: string; name: string }[] = [];

    if (Array.isArray(recipients) && recipients.length > 0) {
      recipientList = recipients.filter(r => r.email);
    } else {
      const snap = await db.collection("users").get();
      recipientList = snap.docs
        .map(d => ({
          email: d.data().email || d.data().workEmail || "",
          name: d.data().name || "",
        }))
        .filter(r => r.email);
    }

    if (recipientList.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // 3. Send emails with delay (safe for Gmail limits)
    let sent = 0;
    const errors: string[] = [];

    for (const r of recipientList) {
      try {
        await sendEmail({
          to: r.email,
          subject: fest.emailSubject || `${fest.title} Greetings 🎉`,
          html: buildFestivalHtml(fest, r.name),
        });

        await db.collection("greetingLogs").add({
          type: "festival",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: fest.emailSubject || `${fest.title} Greetings`,
          sentAt: new Date().toISOString(),
          sentBy,
          status: "success",
        });

        sent++;

        // Delay to prevent rate limiting
        await new Promise(res => setTimeout(res, 400));

      } catch (err: any) {
        errors.push(`${r.email}: ${err.message}`);

        await db.collection("greetingLogs").add({
          type: "festival",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: fest.emailSubject,
          sentAt: new Date().toISOString(),
          sentBy,
          status: "failed",
          error: err.message,
        });
      }
    }

    // 4. Update lastSentOn
    await db.collection("festivals").doc(festivalId).update({
      lastSentOn: new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({ sent, errors });

  } catch (err: any) {
    console.error("send-festival-greeting error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}


// ==============================
// PROFESSIONAL EMAIL TEMPLATE
// ==============================

function buildFestivalHtml(fest: any, recipientName: string): string {
  const message =
    fest.emailMessage?.trim() ||
    `Wishing you a very Happy ${fest.title}.`;

  const { buildMncEmailHtml } = require("@/lib/emailTemplate");
  return buildMncEmailHtml(
    `${fest.title} Greetings`,
    fest.bannerEmoji || "🎉",
    "",
    recipientName || "Team Member",
    `<p style="white-space:pre-line;">${message}</p>`
  );
}