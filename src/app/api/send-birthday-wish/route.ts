import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ─── Birthday wish HTML template ─────────────────────────────────────────────

function buildEmailHtml(name: string): string {
  const firstName = name.split(" ")[0];
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#9333ea);padding:40px 32px;text-align:center;">
              <div style="font-size:64px;margin-bottom:8px;">🎂</div>
              <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0;letter-spacing:-0.5px;">
                Happy Birthday!
              </h1>
              <p style="color:#e0e7ff;font-size:15px;margin:8px 0 0;">
                Wishing you a wonderful day
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 16px;">
                Dear ${firstName}, 🎉
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
                On behalf of the entire team, we wish you a very
                <strong style="color:#6366f1;">Happy Birthday!</strong>
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
                Your hard work, dedication, and positive energy make our workplace
                a better place every single day. Today is all about you — we hope
                it's filled with joy, laughter, and everything you love. 🥳
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">
                Here's to another amazing year ahead. May all your dreams and
                goals come true!
              </p>

              <!-- Greeting card style box -->
              <div style="background:linear-gradient(135deg,#fdf4ff,#ede9fe);border:2px solid #c4b5fd;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:28px;">
                <p style="color:#7c3aed;font-size:20px;font-weight:800;margin:0 0 4px;">
                  🎈 Many Happy Returns of the Day! 🎈
                </p>
                <p style="color:#9333ea;font-size:14px;margin:0;">— Techgy Innovations</p>
              </div>

              <p style="color:#94a3b8;font-size:13px;margin:0;">
                With lots of love &amp; warm wishes,<br/>
                <strong style="color:#475569;">The HR Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                This is an automated birthday greeting from your company HR system.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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