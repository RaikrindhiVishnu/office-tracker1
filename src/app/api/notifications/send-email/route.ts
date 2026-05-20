import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import nodemailer from "nodemailer";

// Reusable transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2. Parse body
    const { toEmail, toName, title, message, type } = await req.json();

    if (!toEmail || !title || !message) {
      return NextResponse.json(
        { error: "Missing required fields: toEmail, title, message" },
        { status: 400 }
      );
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    // 3. Determine icon/color based on type
    const typeConfig: Record<string, { icon: string; color: string }> = {
      success: { icon: "✅", color: "#16a34a" },
      error:   { icon: "❌", color: "#dc2626" },
      warning: { icon: "⚠️", color: "#d97706" },
      info:    { icon: "ℹ️", color: "#2563eb" },
    };
    const { icon, color } = typeConfig[type] || typeConfig.info;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://office-tracker-1.vercel.app";

    // 4. Build HTML email
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
          <img src="${appUrl}/logo.svg" alt="Office Tracker" style="height: 48px; margin-bottom: 12px;" onerror="this.style.display='none'" />
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Office Tracker CRM</h1>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 36px 40px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
          <div style="display: inline-block; background: ${color}15; border: 1px solid ${color}30; border-radius: 8px; padding: 8px 16px; margin-bottom: 20px;">
            <span style="color: ${color}; font-weight: 700; font-size: 13px;">${icon} ${type?.toUpperCase() || "NOTIFICATION"}</span>
          </div>

          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 12px 0; font-weight: 700;">${title}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">${message}</p>

          <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Open Office Tracker →
          </a>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px 40px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated notification from <strong>Techgy Innovations CRM</strong>.<br/>
            © ${new Date().getFullYear()} Techgy Innovations. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // 5. Send email
    await transporter.sendMail({
      from: `"Techgy Innovations CRM 🔔" <${process.env.GMAIL_USER}>`,
      to: `"${toName || toEmail}" <${toEmail}>`,
      subject: `${icon} ${title}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Email Notification API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
