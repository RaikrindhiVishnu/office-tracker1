// app/api/send-achievement-email/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

const CATEGORY_ICONS: Record<string, string> = {
  "Employee of the Month": "🌟",
  "Best Performance":      "📈",
  "Sales Champion":        "💰",
  "Team Player":           "🤝",
  "Innovation Award":      "💡",
  "Leadership Award":      "👑",
  "Customer Hero":         "🦸",
  "Most Improved":         "📊",
  "Long Service":          "🏅",
};

export async function POST(req: NextRequest) {
  try {
    const {
      achievementId,
      email,
      name,
      title,
      category,
      description,
      sentBy = "admin",
    } = await req.json();

    if (!achievementId || !email) return NextResponse.json({ error: "achievementId and email required" }, { status: 400 });

    const icon = CATEGORY_ICONS[category] || "🏆";

    await sendEmail({
      to: email,
      subject: `🏆 Congratulations ${name}! — ${title}`,
    const content = `
      <p>We are absolutely thrilled to recognize your outstanding achievement and present you with this award! 🎊</p>
      <div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe;border-radius:14px;padding:24px;margin:24px 0;text-align:center;">
        <div style="font-size:42px;margin-bottom:10px;">${icon}</div>
        <div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${category}</div>
        <div style="font-size:20px;font-weight:900;color:#4c1d95;">${title}</div>
        ${description ? `<p style="font-size:13.5px;color:#6d28d9;margin:12px 0 0;line-height:1.6;">${description}</p>` : ""}
      </div>
      <p>Your hard work, dedication, and commitment to excellence have not gone unnoticed. You are an inspiration to the entire team at Techgy Innovations!</p>
      <p>Keep up the fantastic work and continue to make us proud. The best is yet to come! 🚀</p>
    `;

    const { buildMncEmailHtml } = require("@/lib/emailTemplate");

    await sendEmail({
      to: email,
      subject: `🏆 Congratulations ${name}! — ${title}`,
      html: buildMncEmailHtml(
        "Congratulations!",
        "🏆",
        title,
        name,
        content
      ),
    });

    // Mark as sent in Firestore
    await db.collection("achievements").doc(achievementId).update({
      sentOn: new Date().toISOString().slice(0, 10),
    });

    // Log it
    await db.collection("greetingLogs").add({
      type: "achievement",
      recipientEmail: email,
      recipientName: name,
      subject: `🏆 Congratulations ${name}! — ${title}`,
      sentAt: new Date().toISOString(),
      sentBy,
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("send-achievement-email error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}