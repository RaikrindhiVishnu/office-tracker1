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

    const { buildMncEmailHtml } = await import("@/lib/emailTemplate");

    const content = `
      <p>A warm welcome to <strong>Techgy Innovations</strong>. We are delighted to have you join our organization as a <strong>${designation || "team member"}</strong>. Your experience, ideas, and passion will play an important role in helping us continue building innovative solutions and delivering value to our clients.</p>
      <p>At Techgy Innovations, we believe that our people are the heart of everything we do. Our mission is to foster a culture of collaboration, creativity, and continuous learning where every team member can grow and make a meaningful impact.</p>
      <p>As you begin your journey with us, we encourage you to explore new ideas, share your knowledge, and collaborate with your colleagues across teams. We are confident that your contributions will help us move forward toward achieving our vision of delivering technology that truly transforms businesses.</p>
      <p>Starting a new role is always an exciting step, and our team is here to support you along the way. We hope you find your experience with Techgy Innovations both rewarding and inspiring.</p>
      <p style="margin-top:24px;">Once again, welcome to the Techgy family. We look forward to the achievements we will accomplish together.</p>
    `;

    await sendEmail({
      to: email,
      subject: `👋 Welcome to Techgy Innovations, ${name}!`,
      html: buildMncEmailHtml(
        "Welcome to Techgy Innovations",
        "🚀",
        "We're excited to have you join our growing team",
        name,
        content
      ),
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