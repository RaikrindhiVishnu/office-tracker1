import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmployeeWelcomeEmail({
  email,
  name,
  tempPassword,
}: {
  email: string;
  name: string;
  tempPassword: string;
}) {
  console.log("📧 Attempting to send email to:", email);
  console.log("🔑 RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",  // ← this is the only allowed from on free plan
      to: email,
      subject: "Welcome - Your Login Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
          <h2 style="color: #143d3d;">Welcome, ${name}!</h2>
          <p>Your account has been created. Use the credentials below to log in:</p>
          <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> 
              <code style="font-size: 18px; background: #fff; padding: 4px 8px; border-radius: 4px;">
                ${tempPassword}
              </code>
            </p>
          </div>
          <p style="color: red;"><strong>Please change your password after first login.</strong></p>
          <p>Login at: <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">${process.env.NEXT_PUBLIC_APP_URL}/login</a></p>
        </div>
      `,
    });

    console.log("✅ Resend response:", JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error("❌ Resend error:", error.message);
    console.error("❌ Full error:", JSON.stringify(error));
    throw error;
  }
}