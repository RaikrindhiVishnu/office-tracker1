import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { sendEmail } from "@/lib/email";
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

      // Check if on leave
      const leavesSnap = await adminDb.collection("leaveRequests")
        .where("uid", "==", userDoc.id)
        .where("status", "==", "approved")
        .get();

      const isOnLeave = leavesSnap.docs.some(doc => {
        const leave = doc.data();
        if (!leave.fromDate || !leave.toDate) return false;
        return leave.fromDate <= todayStr && leave.toDate >= todayStr;
      });
      
      if (isOnLeave) continue;

      if (type === "morning") {
        // Check if checked in
        const attId = `${userDoc.id}_${todayStr}`;
        const attSnap = await adminDb.collection("attendance").doc(attId).get();
        if (!attSnap.exists) {
          await sendWhatsApp(phone, `Hey ${userData.name || 'there'}! It's time to start your day. Don't forget to check in on Office Tracker! Reply "check me in" to Tracker Bot.`);
          
          if (userData.email) {
            await sendEmail({
              to: userData.email,
              subject: "Please Check In Today",
              html: `
                <p>Hi ${userData.name || 'there'},</p>
                <p>We noticed you haven't checked in today. Please check in on the Office Tracker as soon as possible.</p>
                <p><em>Note: Checking in after 10:15 AM may be considered a late mark unless previously approved.</em></p>
                <p>Best,<br/>HR Team</p>
              `
            });
          }

          await adminDb.collection("notifications").add({
            uid: userDoc.id,
            title: "Check-in Reminder",
            message: "You haven't checked in today. Please check in immediately. Note: It is past 10:15 AM.",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          sentCount++;
        }
      } else if (type === "evening") {
        // Check if time sheet submitted (dailySheets collection)
        const sheetsSnap = await adminDb.collection("dailySheets")
          .where("uid", "==", userDoc.id)
          .where("dateStr", "==", todayStr)
          .get();
        
        if (sheetsSnap.empty) {
          await sendWhatsApp(phone, `Good evening ${userData.name || 'there'}! Your day is almost over. Don't forget to submit your Time Sheet on Office Tracker!`);
          
          if (userData.email) {
            await sendEmail({
              to: userData.email,
              subject: "Reminder: Fill Your Time Sheet",
              html: `
                <p>Hi ${userData.name || 'there'},</p>
                <p>You haven't filled your time sheet for today yet. Please submit your entries as soon as possible.</p>
                <p>Best,<br/>HR Team</p>
              `
            });
          }

          await adminDb.collection("notifications").add({
            uid: userDoc.id,
            title: "Time Sheet Reminder",
            message: "You missed filling your time sheet today. Please fill it.",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

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
