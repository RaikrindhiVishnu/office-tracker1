import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { sendEmployeeWelcomeEmail } from "@/lib/sendEmail";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  return Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, ...otherData } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    const tempPassword = generatePassword();

    // 1️⃣ Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      displayName: name,
    });

    // 2️⃣ Save to Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email.trim().toLowerCase(),
      name,
      accountType: "EMPLOYEE",
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      ...otherData,
    });

    // 3️⃣ Send welcome email
    await sendEmployeeWelcomeEmail({ email, name, tempPassword });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Create employee error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}