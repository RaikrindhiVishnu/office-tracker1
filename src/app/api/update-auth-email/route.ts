import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin"; // Firebase Admin SDK

export async function POST(req: NextRequest) {
  try {
    const { uid, newEmail } = await req.json();

    if (!uid || !newEmail) {
      return NextResponse.json({ error: "Missing uid or newEmail" }, { status: 400 });
    }

    await adminAuth.updateUser(uid, { email: newEmail });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Auth email update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}