import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch (authError) {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // 2. Parse request
    const body = await req.json();
    const { userId, message } = body;

    if (!userId || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!accountSid || !authToken || !fromWhatsAppNumber) {
      console.warn("[Twilio] Missing Twilio credentials. Skipping WhatsApp notification.");
      return NextResponse.json({ success: false, message: "Twilio credentials not configured" });
    }

    // 3. Fetch user's phone number
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    let phone = userData?.phone || userData?.mobile;

    if (!phone) {
      console.warn(`[Twilio] User ${userId} has no phone number stored.`);
      return NextResponse.json({ success: false, message: "No phone number found" });
    }

    // Ensure phone is formatted correctly (E.164 format: +1234567890)
    if (!phone.startsWith("+")) {
      // Assuming India +91 if no code provided (common default). Adjust as needed!
      phone = `+91${phone.replace(/\D/g, "")}`;
    }

    // 4. Send WhatsApp via Twilio
    const client = twilio(accountSid, authToken);
    const twilioResponse = await client.messages.create({
      body: message,
      from: fromWhatsAppNumber, // should be e.g. 'whatsapp:+14155238886'
      to: `whatsapp:${phone}`,
    });

    console.log(`[Twilio] Sent WhatsApp to ${phone}. SID: ${twilioResponse.sid}`);
    return NextResponse.json({ success: true, sid: twilioResponse.sid });
  } catch (error: any) {
    console.error("[Twilio API Error]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
