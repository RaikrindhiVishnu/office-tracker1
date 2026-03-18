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
    fest.emailMessage ||
    `On this special occasion of ${fest.title}, we extend our heartfelt wishes to you and your loved ones. May this festival bring joy, prosperity, and success.`;

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#f3f4f6;padding:20px;">
    
    <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      
      <!-- HEADER -->
      <div style="background:${fest.bannerColor || "#111827"};padding:32px;text-align:center;">
        <div style="font-size:56px;margin-bottom:10px;">${fest.bannerEmoji || "🎊"}</div>
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;">
          ${fest.title} Greetings
        </h1>
      </div>

      <!-- BODY -->
      <div style="padding:32px;">
        <p style="font-size:15px;color:#111827;">
          Dear <strong>${recipientName || "Team Member"}</strong>,
        </p>

        <p style="font-size:15px;color:#374151;line-height:1.8;margin-top:12px;">
          ${message}
        </p>

        <p style="font-size:15px;color:#374151;line-height:1.8;margin-top:12px;">
          At <strong>Techgy Innovations Pvt. Ltd.</strong> and <strong>9DS</strong>, 
          we sincerely appreciate your dedication and valuable contributions. 
          Festivals are a time to celebrate togetherness, positivity, and the spirit of unity within our organization.
        </p>

        <p style="font-size:15px;color:#374151;line-height:1.8;margin-top:12px;">
          May this festive occasion bring happiness, success, and new opportunities into your life, 
          both personally and professionally.
        </p>

        <!-- SIGNATURE -->
        <p style="margin-top:24px;font-size:14px;color:#6b7280;">
          Warm regards,<br/>
          <strong>HR Team</strong><br/>
          Techgy Innovations Pvt. Ltd. & 9DS
        </p>
      </div>

      <!-- FOOTER -->
      <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;">
        © ${new Date().getFullYear()} Techgy Innovations Pvt. Ltd. & 9DS. All rights reserved.
      </div>

    </div>
  </div>
  `;
}