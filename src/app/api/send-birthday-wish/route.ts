import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

import { buildMncEmailHtml } from "@/lib/emailTemplate";

function buildEmailHtml(name: string): string {
  const firstName = name.split(" ")[0];
  const content = `
    <p>On behalf of the entire team, we wish you a very <strong style="color:#2563eb;">Happy Birthday!</strong></p>
    <p>Your hard work, dedication, and positive energy make our workplace a better place every single day. Today is all about you — we hope it's filled with joy, laughter, and everything you love. 🥳</p>
    <p>Here's to another amazing year ahead. May all your dreams and goals come true!</p>
    <div style="background:linear-gradient(135deg,#fdf4ff,#ede9fe);border:1px solid #c4b5fd;border-radius:12px;padding:20px 24px;text-align:center;margin-top:28px;">
      <p style="color:#7c3aed;font-size:20px;font-weight:800;margin:0 0 4px;">🎈 Many Happy Returns of the Day! 🎈</p>
    </div>
  `;
  return buildMncEmailHtml("Happy Birthday!", "🎂", "Wishing you a wonderful day", firstName, content);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { employeeId, email, name } = await req.json();

    // Basic validation
    if (!employeeId || !email || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Send email
    await transporter.sendMail({
      from:    `"HR Team 🎂" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: `🎂 Happy Birthday, ${name.split(" ")[0]}! 🎉`,
      html:    buildEmailHtml(name),
    });

    // ✅ Mark wish as sent today via Firestore REST API
    const todayISO = new Date().toISOString().slice(0, 10);
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/birthdays/${employeeId}?updateMask.fieldPaths=lastWishSentOn&key=${apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            lastWishSentOn: { stringValue: todayISO },
          },
        }),
      }
    );

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[send-birthday-wish]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}