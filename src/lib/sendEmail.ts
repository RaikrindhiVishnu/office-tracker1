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

    await transporter.sendMail({
      from: `"Techgy Innovations" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Welcome - Your Login Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px;">
          <h2 style="color:#193677;">Welcome to Techgy Innovations, ${name}!</h2>

          <p>Your employee account has been created.</p>

          <div style="background:#f4f6f9;padding:15px;border-radius:8px;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>

          <p>Please change your password after first login.</p>

          <p>
            <a href="${loginUrl}" 
               style="background:#193677;color:white;padding:10px 20px;
                      text-decoration:none;border-radius:5px;">
              Login Here
            </a>
          </p>

          <p style="margin-top:20px;font-size:12px;color:gray;">
            © ${new Date().getFullYear()} Techgy Innovations
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully to:", email);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
}