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
  
  // Protect cron route (allow both custom scheduler secret and Vercel's native CRON_SECRET)
  const validSecrets = [
    `Bearer ${process.env.SCHEDULER_SECRET}`,
    `Bearer ${process.env.CRON_SECRET}`
  ];
  
  if (!auth || !validSecrets.includes(auth)) {
    console.error("[Cron API] Unauthorized attempt. Headers:", req.headers);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStr = today();
    const usersSnap = await adminDb.collection("users").get();
    
    let sentCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const phone = userData?.phone || userData?.mobile;
      if (!phone && !userData.email) continue;

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
          if (phone) {
            await sendWhatsApp(phone, `Hey ${userData.name || 'there'}! It's time to start your day. Don't forget to check in on Office Tracker! Reply "check me in" to Tracker Bot.`);
          }
          
          if (userData.email) {
            await sendEmail({
              to: userData.email,
              subject: "Daily Check-in Reminder – Please Check In Before 10:15 AM",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 20px;">Daily Check-in Reminder – Please Check In Before 10:15 AM</h2>
                  <p style="color: #475569; font-size: 16px;">Dear Team,</p>
                  <p style="color: #475569; font-size: 16px;">This is a friendly reminder to complete your <strong>daily check-in every working day before 10:15 AM</strong>.</p>
                  <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
                    <strong style="color: #991b1b;">⚠️ Warning:</strong> <span style="color: #7f1d1d;">Check-ins submitted after <strong>10:15 AM may be flagged as a late mark</strong> as per the attendance policy.</span>
                  </div>
                  <p style="color: #475569; font-size: 16px;">Please make it a habit to check in daily and ensure your attendance is recorded on time.</p>
                  <p style="color: #475569; font-size: 16px;">Thank you for your cooperation.</p>
                  <a href="https://office-tracker.com" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px; margin-bottom: 20px;">Check In Now</a>
                  <p style="color: #64748b; font-size: 14px; margin-top: 10px;">Best regards,<br/>techgyinnovations Team</p>
                </div>
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
          if (phone) {
            await sendWhatsApp(phone, `Good evening ${userData.name || 'there'}! Your day is almost over. Don't forget to submit your Time Sheet on Office Tracker!`);
          }
          
          if (userData.email) {
            await sendEmail({
              to: userData.email,
              subject: "Action Required: Daily Timesheet Pending",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h2 style="color: #0f172a;">Good Evening, ${userData.name || 'there'}! 🌇</h2>
                  <p style="color: #475569; font-size: 16px;">We hope you had a productive day! We noticed that your timesheet for today (${todayStr}) is still pending.</p>
                  <p style="color: #475569; font-size: 16px;">Please log in to the Office Tracker and log your tasks before wrapping up for the day.</p>
                  <a href="https://office-tracker.com" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Fill Timesheet</a>
                  <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Best regards,<br/>HR & Admin Team</p>
                </div>
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
