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
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#7c3aed,#6366f1,#0ea5e9);padding:48px 32px;text-align:center;position:relative;">
            <div style="font-size:64px;margin-bottom:12px;">🏆</div>
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:900;letter-spacing:-.5px;">
              Congratulations!
            </h1>
            <p style="color:rgba(255,255,255,.9);margin:10px 0 0;font-size:15px;">${title}</p>
            <div style="position:absolute;top:16px;right:16px;font-size:28px;opacity:.25;">${icon}</div>
          </div>

          <div style="padding:36px 32px;">
            <p style="font-size:17px;color:#1e293b;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>

            <p style="font-size:15px;color:#334155;line-height:1.8;margin:0 0 20px;">
              We are absolutely thrilled to recognize your outstanding achievement and present you with this award! 🎊
            </p>

            <div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #ddd6fe;border-radius:14px;padding:24px;margin:0 0 24px;text-align:center;">
              <div style="font-size:42px;margin-bottom:10px;">${icon}</div>
              <div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${category}</div>
              <div style="font-size:20px;font-weight:900;color:#4c1d95;">${title}</div>
              ${description ? `<p style="font-size:13.5px;color:#6d28d9;margin:12px 0 0;line-height:1.6;">${description}</p>` : ""}
            </div>

            <p style="font-size:14.5px;color:#334155;line-height:1.8;margin:0 0 20px;">
              Your hard work, dedication, and commitment to excellence have not gone unnoticed. You are an inspiration to the entire team at Techgy Innovations!
            </p>

            <p style="font-size:14.5px;color:#334155;line-height:1.8;margin:0 0 24px;">
              Keep up the fantastic work and continue to make us proud. The best is yet to come! 🚀
            </p>

            <p style="font-size:15px;color:#1e293b;margin:0;">
              With pride and appreciation,<br/>
              <strong style="color:#193677;">Techgy Innovations HR Team</strong>
            </p>
          </div>

          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} Techgy Innovations · All Rights Reserved</p>
          </div>
        </div>
      `,
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