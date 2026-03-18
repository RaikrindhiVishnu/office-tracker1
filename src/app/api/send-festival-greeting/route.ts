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

    if (!festivalId) return NextResponse.json({ error: "festivalId required" }, { status: 400 });

    // 1. Get festival details
    const festDoc = await db.collection("festivals").doc(festivalId).get();
    if (!festDoc.exists) return NextResponse.json({ error: "Festival not found" }, { status: 404 });
    const fest = festDoc.data()!;

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
          subject: fest.emailSubject,
          html: buildFestivalHtml(fest, r.name),
        });

        await db.collection("greetingLogs").add({
          type: "festival",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: fest.emailSubject,
          sentAt: new Date().toISOString(),
          sentBy,
          status: "success",
        });

        sent++;

        // 500ms delay between emails to stay within Gmail limits
        await new Promise(res => setTimeout(res, 500));

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

function buildFestivalHtml(fest: any, recipientName: string): string {
  const message = fest.emailMessage || `Wishing you and your family a wonderful ${fest.title}!`;
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
      <div style="background:${fest.bannerColor || "#f59e0b"};padding:40px 32px;text-align:center;">
        <div style="font-size:64px;margin-bottom:12px;">${fest.bannerEmoji || "🎊"}</div>
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">${fest.title}</h1>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;color:#1e293b;">Dear <strong>${recipientName || "Team Member"}</strong>,</p>
        <p style="font-size:15px;color:#334155;line-height:1.7;">${message}</p>
        <p style="font-size:14px;color:#64748b;margin-top:24px;">Warm regards,<br/><strong>Techgy Innovations HR Team</strong></p>
      </div>
    </div>
  `;
}