// app/api/send-anniversary-wish/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { employeeId, email, name, years, sentBy = "admin" } = await req.json();
    if (!employeeId || !email) return NextResponse.json({ error: "employeeId and email required" }, { status: 400 });

    const ordinal = (n: number) => {
      const s = ["th","st","nd","rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    await sendEmail({
      to: email,
      subject: `🎉 Happy ${ordinal(years)} Work Anniversary, ${name}!`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#f59e0b,#f97316,#ef4444);padding:48px 32px;text-align:center;position:relative;">
            <div style="font-size:60px;margin-bottom:12px;">🎉</div>
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-.5px;">
              ${ordinal(years)} Work Anniversary!
            </h1>
            <p style="color:rgba(255,255,255,.9);margin:10px 0 0;font-size:16px;">Celebrating ${years} incredible year${years > 1 ? "s" : ""} with us</p>
            <div style="position:absolute;top:16px;right:16px;font-size:24px;opacity:.3;">✨</div>
            <div style="position:absolute;bottom:16px;left:16px;font-size:20px;opacity:.3;">🌟</div>
          </div>

          <div style="padding:36px 32px;">
            <p style="font-size:17px;color:#1e293b;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>

            <p style="font-size:15px;color:#334155;line-height:1.8;margin:0 0 16px;">
              Today marks your <strong>${ordinal(years)} work anniversary</strong> at Techgy Innovations! 🚀
            </p>

            <p style="font-size:15px;color:#334155;line-height:1.8;margin:0 0 24px;">
              Over the past ${years} year${years > 1 ? "s" : ""}, you have been an invaluable part of our team. Your dedication, hard work, and commitment to excellence have made a real difference. We are grateful to have you on board!
            </p>

            <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🏆</div>
              <div style="font-size:22px;font-weight:900;color:#b45309;">${years} Year${years > 1 ? "s" : ""} of Excellence</div>
              <div style="font-size:14px;color:#92400e;margin-top:4px;">Thank you for your continued dedication</div>
            </div>

            <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 24px;">
              Here's to many more years of growth, success, and achievement together. We look forward to all the amazing things we will accomplish as a team!
            </p>

            <p style="font-size:15px;color:#1e293b;margin:0;">
              With appreciation,<br/>
              <strong style="color:#193677;">Techgy Innovations HR Team</strong>
            </p>
          </div>

          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} Techgy Innovations · All Rights Reserved</p>
          </div>
        </div>
      `,
    });

    // Update lastAnniversarySentOn in Firestore
    await db.collection("birthdays").doc(employeeId).update({
      lastAnniversarySentOn: new Date().toISOString().slice(0, 10),
    });

    // Log it
    await db.collection("greetingLogs").add({
      type: "anniversary",
      recipientEmail: email,
      recipientName: name,
      subject: `🎉 Happy ${ordinal(years)} Work Anniversary, ${name}!`,
      sentAt: new Date().toISOString(),
      sentBy,
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("send-anniversary-wish error:", err);

    // Log failure
    try {
      const { employeeId, email, name, sentBy = "admin" } = await req.json().catch(() => ({}));
      await db.collection("greetingLogs").add({
        type: "anniversary",
        recipientEmail: email || "",
        recipientName: name || "",
        subject: `Work Anniversary Wish`,
        sentAt: new Date().toISOString(),
        sentBy,
        status: "failed",
        error: err.message,
      });
    } catch {}

    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}