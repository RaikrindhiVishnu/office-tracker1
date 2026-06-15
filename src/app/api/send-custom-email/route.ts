// app/api/send-custom-email/route.ts
// ✅ Matches the same pattern as send-event-announcement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const {
      subject,
      body,
      recipients,
      priority = "normal",
      sentBy = "admin",
      attachments = [],
    } = await req.json();

    // Validation
    if (!subject?.trim())
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    if (!body?.trim())
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    if (!Array.isArray(recipients) || recipients.length === 0)
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });

    // Filter out entries without email
    const recipientList: { email: string; name: string }[] = recipients.filter(
      (r: any) => r.email
    );

    if (recipientList.length === 0)
      return NextResponse.json({ error: "No valid recipients" }, { status: 400 });

    let sent = 0;
    const errors: string[] = [];

    for (const r of recipientList) {
      try {
        // Replace {name} placeholder for personalisation
        const personalBody = body.replace(/\{name\}/gi, r.name || r.email);

        const logoPath = path.join(process.cwd(), "public", "logo.svg");
        const logoAttachment = {
          filename: "logo.svg",
          path: logoPath,
          cid: "companylogo"
        };
        const allAttachments = [...attachments, logoAttachment];

        await sendEmail({
          to: r.email,
          subject: subject.trim(),
          html: buildMailHtml(personalBody, r.name, priority),
          attachments: allAttachments,
        });

        await db.collection("greetingLogs").add({
          type: "mail",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: subject.trim(),
          sentAt: new Date().toISOString(),
          sentBy,
          status: "success",
          priority,
        });

        sent++;

        // 500ms delay between emails — same as other routes
        await new Promise(res => setTimeout(res, 500));

      } catch (err: any) {
        errors.push(`${r.email}: ${err.message}`);

        await db.collection("greetingLogs").add({
          type: "mail",
          recipientEmail: r.email,
          recipientName: r.name,
          subject: subject.trim(),
          sentAt: new Date().toISOString(),
          sentBy,
          status: "failed",
          error: err.message,
          priority,
        });
      }
    }

    if (sent === 0) {
      return NextResponse.json(
        { error: "All emails failed to send", details: errors },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent, failed: errors.length, errors: errors.length ? errors : undefined });

  } catch (err: any) {
    console.error("send-custom-email error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

function buildMailHtml(body: string, recipientName: string, priority: string): string {
  const isHigh = priority === "high";
  const cleanBody = body.trim().replace(/\n/g, '<br/>');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${isHigh ? '<p style="color: #dc2626; font-weight: bold;">[High Priority]</p>' : ''}
      <p>Hi ${recipientName || 'Team'},</p>
      <div style="margin-top: 15px; margin-bottom: 30px;">
        ${cleanBody}
      </div>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #666;">
        <img src="cid:companylogo" alt="Techgy Innovations Logo" style="max-width: 130px; height: auto; margin-bottom: 10px;" />
        <p style="margin: 0; font-weight: bold; color: #1e3a8a;">HR Team</p>
        <p style="margin: 3px 0 0 0;">Techgy Innovations</p>
        <a href="https://techgyinnovations.com" style="color: #2563eb; text-decoration: none;">www.techgyinnovations.com</a>
      </div>
    </div>
  `;
}