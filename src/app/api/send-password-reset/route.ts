import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate Firebase password-reset link via Admin SDK
    const resetLink = await getAuth().generatePasswordResetLink(normalizedEmail);

    // Send via your existing Nodemailer setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.verify();

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : "https://office-tracker-1.vercel.app/login";

    await transporter.sendMail({
      from: `"Techgy Innovations" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Reset Your Password – Office Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px;">
          <h2 style="color:#193677;">Reset Your Password</h2>

          <p>We received a request to reset the password for your account
             (<strong>${normalizedEmail}</strong>).</p>

          <div style="background:#f4f6f9; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; font-size:13px; color:#555;">
              Click the button below to set a new password.
              This link expires in <strong>1 hour</strong>.
            </p>
          </div>

          <p>
            <a href="${resetLink}"
               target="_blank"
               style="display:inline-block; background:#193677; color:white;
                      padding:12px 24px; text-decoration:none;
                      border-radius:6px; font-weight:bold;">
              Reset My Password
            </a>
          </p>

          <p style="margin-top:25px; font-size:12px; color:#888;">
            If you did not request a password reset, you can safely ignore this email.
          </p>

          <p style="margin-top:20px; font-size:12px; color:gray;">
            © ${new Date().getFullYear()} Techgy Innovations
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Password reset error:", err);
    if (err?.code === "auth/user-not-found")
      return NextResponse.json({ error: "No account found with this email address." }, { status: 404 });
    if (err?.code === "auth/invalid-email")
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    return NextResponse.json({ error: "Failed to send reset email. Please try again." }, { status: 500 });
  }
}