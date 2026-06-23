import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createTransport } from "nodemailer";
import { buildMncEmailHtml } from "@/lib/emailTemplate";

// Reusable transporter (lazy-init to avoid module-load failures)
function getTransporter() {
  return createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

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
    const content = `
      <div style="display: inline-block; background: ${color}15; border: 1px solid ${color}30; border-radius: 8px; padding: 8px 16px; margin-bottom: 20px;">
        <span style="color: ${color}; font-weight: 700; font-size: 13px;">${icon} ${(type ?? "info").toUpperCase()}</span>
      </div>
      <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">${message}</p>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Open Office Tracker &rarr;
      </a>
    `;

    const html = buildMncEmailHtml(
      title,
      icon,
      "Office Tracker Notification",
      toName ?? "",
      content
    );

    // 5. Send email
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Techgy Innovations CRM 🔔" <${process.env.GMAIL_USER}>`,
      to: `"${toName || toEmail}" <${toEmail}>`,
      subject: `${icon} ${title}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log full details server-side for easier debugging
    console.error("[Email Notification API] Error name:", error?.name);
    console.error("[Email Notification API] Error message:", error?.message);
    console.error("[Email Notification API] Error stack:", error?.stack);
    return NextResponse.json(
      { error: error?.message || "Failed to send email", details: error?.name },
      { status: 500 }
    );
  }
}
