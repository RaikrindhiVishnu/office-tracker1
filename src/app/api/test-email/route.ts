import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  try {
    console.log("API KEY:", process.env.RESEND_API_KEY);

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "raikrindhivishnu2000@gmail.com", // ← the email you used to sign up on resend.com
      subject: "Test Email",
      html: "<h1>Test Working!</h1><p>Temp password: Test@1234</p>",
    });

    console.log("Result:", result);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message, full: JSON.stringify(error) }, { status: 500 });
  }
}