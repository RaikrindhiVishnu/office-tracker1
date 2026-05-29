import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

function today(): string {
  return new Date().toISOString().split("T")[0];
}

async function sendWhatsApp(phone: string, message: string) {
  if (!accountSid || !authToken || !fromWhatsAppNumber) {
    console.warn("[Cron] Twilio credentials missing");
    return;
  }
  let formattedPhone = phone;
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = `+91${formattedPhone.replace(/\D/g, "")}`;
  }
  
  const client = twilio(accountSid, authToken);
  await client.messages.create({
    body: message,
    from: fromWhatsAppNumber,
    to: `whatsapp:${formattedPhone}`,
  });
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const auth = req.headers.get("Authorization");
  
  // Protect cron route
  if (auth !== `Bearer ${process.env.SCHEDULER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStr = today();
    const usersSnap = await adminDb.collection("users").get();
    
    let sentCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const phone = userData?.phone || userData?.mobile;
      if (!phone) continue;

      if (type === "morning") {
        // Check if checked in
        const attId = `${userDoc.id}_${todayStr}`;
        const attSnap = await adminDb.collection("attendance").doc(attId).get();
        if (!attSnap.exists) {
          await sendWhatsApp(phone, `Hey ${userData.name || 'there'}! It's time to start your day. Don't forget to check in on Office Tracker! Reply "check me in" to Tracker Bot.`);
          sentCount++;
        }
      } else if (type === "evening") {
        // Check if work update submitted
        const updatesSnap = await adminDb.collection("workUpdates")
          .where("uid", "==", userDoc.id)
          .get();
        
        const hasUpdateToday = updatesSnap.docs.some(doc => {
          const data = doc.data();
          if (!data.createdAt) return false;
          const dateStr = data.createdAt.toDate?.()?.toISOString().split("T")[0];
          return dateStr === todayStr;
        });

        if (!hasUpdateToday) {
          await sendWhatsApp(phone, `Good evening ${userData.name || 'there'}! Your day is almost over. Don't forget to submit your Daily Work Update on Office Tracker!`);
          sentCount++;
        }
      }
    }

    return NextResponse.json({ success: true, sentCount, type });
  } catch (error: any) {
    console.error("[Cron API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
