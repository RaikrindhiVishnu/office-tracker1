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
  console.log("Checking for date:", todayStr);

  const usersSnap = await adminDb.collection("users").get();
  console.log(`Found ${usersSnap.docs.length} users.`);

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

    if (isOnLeave) {
      console.log(`User ${userData.email} is on leave. Skipping.`);
      continue;
    }

    // Check if checked in
    const attId = `${userDoc.id}_${todayStr}`;
    const attSnap = await adminDb.collection("attendance").doc(attId).get();

    if (!attSnap.exists) {
      console.log(`User ${userData.email} hasn't checked in. Sending email...`);
      try {
        await transporter.sendMail({
          from: `"Office Tracker" <${process.env.GMAIL_USER}>`,
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
          `,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${userData.email}:`, err);
      }
    }
  }

  console.log(`Successfully sent ${sentCount} morning reminder emails.`);
  process.exit(0);
}

run();
