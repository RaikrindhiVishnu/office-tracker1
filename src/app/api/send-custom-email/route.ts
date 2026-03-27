// app/api/send-custom-email/route.ts
// ✅ Matches the same pattern as send-event-announcement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

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

        await sendEmail({
          to: r.email,
          subject: subject.trim(),
          html: buildMailHtml(personalBody, r.name, priority),
          // Pass attachments if your sendEmail helper supports it
          ...(attachments.length > 0 ? { attachments } : {}),
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

  const cleanBody = body.trim();

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
      
      <!-- HEADER (FIXED) -->
      <div style="background:${isHigh ? "#e11d48" : "#193677"};padding:32px;text-align:center;">
        <div style="font-size:44px;margin-bottom:10px;">
          ${isHigh ? "🔴" : "✉️"}
        </div>

        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">
          ${isHigh ? "Important Message" : "Message from HR"}
        </h1>

        ${
          isHigh
            ? `<p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:13px;">
                This is a high priority message — please read carefully.
               </p>`
            : ""
        }
      </div>

      <!-- BODY (CONTROLLED) -->
      <div style="padding:32px;">

        <!-- Greeting (AUTO) -->
        <p style="font-size:16px;color:#1e293b;margin:0;">
          Dear <strong>${recipientName || "Team Member"}</strong>,
        </p>

        <!-- USER CONTENT -->
        <div style="font-size:15px;color:#334155;line-height:1.75;margin-top:16px;white-space:pre-line;">
${cleanBody}
        </div>

        <!-- SIGNATURE (FIXED) -->
        <p style="font-size:14px;color:#64748b;margin-top:28px;">
          Warm regards,<br/>
          <strong>Techgy Innovations HR Team</strong>
        </p>
      </div>
    </div>
  `;
}