import nodemailer from "nodemailer";

export async function sendEmployeeWelcomeEmail({
  email,
  name,
  tempPassword,
}: {
  email: string;
  name: string;
  tempPassword: string;
}) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error("Missing Gmail environment variables");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Optional: verify connection (helps debugging)
    await transporter.verify();

    const loginUrl =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
        : "https://office-tracker-1.vercel.app/login";

    const { buildMncEmailHtml } = await import("./emailTemplate");
    const content = `
      <p>Your employee account has been created.</p>

      <div style="background:#f4f6f9;padding:15px;border-radius:8px;margin-bottom:20px;">
        <p style="margin:0 0 10px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>

      <p style="color:#d97706;font-weight:bold;margin-bottom:20px;">Please change your password after your first login.</p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${loginUrl}" 
           target="_blank"
           style="display:inline-block;background:#1e3a5f;color:white;
                  padding:12px 24px;text-decoration:none;
                  border-radius:6px;font-weight:bold;">
          Login to Office Tracker
        </a>
      </div>

      <p style="margin-top:25px;font-size:12px;color:#888;">
        If you did not expect this email, please contact HR.
      </p>
    `;

    await transporter.sendMail({
      from: `"Techgy Innovations" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Welcome - Your Login Credentials",
      html: buildMncEmailHtml(
        "Welcome to Techgy Innovations",
        "👋",
        "Your account is ready",
        name,
        content
      ),
    });

    console.log("Email sent successfully to:", email);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
}