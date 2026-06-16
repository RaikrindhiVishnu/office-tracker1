const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env.local") });

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDb = admin.firestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function run() {
  const todayStr = new Date().toISOString().split("T")[0];
  console.log("Checking evening timesheets for date:", todayStr);

  const usersSnap = await adminDb.collection("users").get();
  let sentCount = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    if (!userData.email) continue;

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

    // Check if timesheet submitted
    const sheetsSnap = await adminDb.collection("dailySheets")
      .where("uid", "==", userDoc.id)
      .where("dateStr", "==", todayStr)
      .get();

    if (sheetsSnap.empty) {
      console.log(`User ${userData.email} hasn't filled timesheet. Sending email...`);
      try {
        await transporter.sendMail({
          from: `"Office Tracker" <${process.env.GMAIL_USER}>`,
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
          `,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${userData.email}:`, err);
      }
    }
  }

  console.log(`Successfully sent ${sentCount} evening reminder emails.`);
  process.exit(0);
}

run();
