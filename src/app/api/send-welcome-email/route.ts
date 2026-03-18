// app/api/send-welcome-email/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const {
      joinerId,
      email,
      name,
      designation,
      sentBy = "admin",
    } = await req.json();

    if (!joinerId || !email || !name) {
      return NextResponse.json(
        { error: "joinerId, email and name are required" },
        { status: 400 }
      );
    }

    await sendEmail({
      to: email,
      subject: `👋 Welcome to Techgy Innovations, ${name}!`,
      html: `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f1f3d,#193677,#2563eb);padding:50px 30px;text-align:center;color:#fff;">
      <div style="font-size:52px;margin-bottom:10px;">🚀</div>
      <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:-.4px;">
        Welcome to Techgy Innovations
      </h1>
      <p style="margin-top:10px;font-size:15px;color:rgba(255,255,255,.9);">
        We're excited to have you join our growing team
      </p>
  </div>

  <!-- Body -->
  <div style="padding:36px 34px;color:#334155;line-height:1.7;font-size:15px;">

    <p style="font-size:17px;color:#1e293b;">
      Dear <strong>${name}</strong>,
    </p>

    <p>
      A warm welcome to <strong>Techgy Innovations</strong>. We are delighted to have you join our organization as a 
      <strong>${designation || "team member"}</strong>. Your experience, ideas, and passion will play an important role in helping us 
      continue building innovative solutions and delivering value to our clients.
    </p>

    <p>
      At Techgy Innovations, we believe that our people are the heart of everything we do. Our mission is to foster a 
      culture of collaboration, creativity, and continuous learning where every team member can grow and make a 
      meaningful impact.
    </p>

    <p>
      As you begin your journey with us, we encourage you to explore new ideas, share your knowledge, and collaborate 
      with your colleagues across teams. We are confident that your contributions will help us move forward toward 
      achieving our vision of delivering technology that truly transforms businesses.
    </p>

    <p>
      Starting a new role is always an exciting step, and our team is here to support you along the way. 
      We hope you find your experience with Techgy Innovations both rewarding and inspiring.
    </p>

    <p style="margin-top:24px;">
      Once again, welcome to the Techgy family. We look forward to the achievements we will accomplish together.
    </p>

    <p style="margin-top:28px;color:#1e293b;">
      Warm regards,<br>
      <strong style="color:#193677;">Techgy Innovations HR Team</strong>
    </p>

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px;text-align:center;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        © ${new Date().getFullYear()} Techgy Innovations · All Rights Reserved
      </p>
  </div>

</div>
`,
    });

    // Update Firestore record
    await db.collection("newJoiners").doc(joinerId).update({
      welcomeEmailSentOn: new Date().toISOString().slice(0, 10),
    });

    // Log activity
    await db.collection("greetingLogs").add({
      type: "welcome",
      recipientEmail: email,
      recipientName: name,
      subject: `👋 Welcome to Techgy Innovations, ${name}!`,
      sentAt: new Date().toISOString(),
      sentBy,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Welcome email sent successfully",
    });

  } catch (error: any) {
    console.error("send-welcome-email error:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}