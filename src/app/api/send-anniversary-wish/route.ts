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

    const content = `
      <p>Today marks your <strong>${ordinal(years)} work anniversary</strong> at Techgy Innovations! 🚀</p>
      <p>Over the past ${years} year${years > 1 ? "s" : ""}, you have been an invaluable part of our team. Your dedication, hard work, and commitment to excellence have made a real difference. We are grateful to have you on board!</p>
      <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin:24px 0;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🏆</div>
        <div style="font-size:22px;font-weight:900;color:#b45309;">${years} Year${years > 1 ? "s" : ""} of Excellence</div>
        <div style="font-size:14px;color:#92400e;margin-top:4px;">Thank you for your continued dedication</div>
      </div>
      <p>Here's to many more years of growth, success, and achievement together. We look forward to all the amazing things we will accomplish as a team!</p>
    `;

    const { buildMncEmailHtml } = require("@/lib/emailTemplate");

    await sendEmail({
      to: email,
      subject: `🎉 Happy ${ordinal(years)} Work Anniversary, ${name}!`,
      html: buildMncEmailHtml(
        `${ordinal(years)} Work Anniversary!`,
        "🎉",
        `Celebrating ${years} incredible year${years > 1 ? "s" : ""} with us`,
        name,
        content
      ),
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