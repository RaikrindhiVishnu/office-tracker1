import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// ── Email helper (nodemailer / Gmail — FREE) ──────────────────────────────────
async function sendEmail(toEmail: string, toName: string, subject: string, body: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const { buildMncEmailHtml } = require("@/lib/emailTemplate");
    const content = `
      <div style="background: #f0f9ff; border-left: 4px solid #0b3a5a; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; color: #1e3a5f; font-size: 14px; line-height: 1.6;">${body}</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
        This is an automated message from your AI HR Assistant.
      </p>
    `;

    await transporter.sendMail({
      from: `"Tracker Bot 🤖" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      html: buildMncEmailHtml(
        "Tracker Bot — AI Assistant",
        "🤖",
        "",
        toName,
        content
      ),
    });
  } catch (err) {
    console.error("[AI Workflow] Email failed:", err);
  }
}

// ── In-app notification helper (server-side adminDb) ─────────────────────────
async function createInAppNotification(userId: string, title: string, message: string, type: string = "info") {
  try {
    await adminDb.collection("notifications").add({
      userId,
      type,
      title,
      message,
      isRead: false,
      relatedCollection: "ai-workflow",
      createdAt: admin.firestore.Timestamp.now(),
    });
  } catch (err) {
    console.error("[AI Workflow] In-app notification failed:", err);
  }
}

// ── AI Message Generator ──────────────────────────────────────────────────────
async function generateAIMessage(prompt: string, fallback: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/\*/g, ""); // strip markdown for plain email
  } catch {
    return fallback;
  }
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Notify employee + optionally admin ───────────────────────────────────────
async function notifyEmployee(
  userId: string,
  email: string | null,
  name: string,
  inAppTitle: string,
  inAppBody: string,
  inAppType: string,
  emailSubject: string,
) {
  await createInAppNotification(userId, inAppTitle, inAppBody, inAppType);
  if (email) await sendEmail(email, name, emailSubject, inAppBody);
}

// ── MAIN CRON HANDLER ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.SCHEDULER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    morningNudges: 0,
    noUpdateReminders: 0,
    blockerEscalations: 0,
    etaFollowUps: 0,
    breakReminders: 0,
  };

  try {
    const now = new Date();
    const hourIST = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() >= 30 ? 1 : 0);
    const isMorning = hourIST >= 9 && hourIST <= 11;
    const isEvening = hourIST >= 17 && hourIST <= 19;
    const today = todayStr();

    const usersSnap = await adminDb.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      const userId = userDoc.id;
      const name = user?.name || "there";
      const email: string | null = user?.email || null;

      // ── 1. MORNING NUDGE: Not checked in yet ─────────────────────────────
      if (isMorning) {
        const attSnap = await adminDb.collection("attendance").doc(`${userId}_${today}`).get();
        if (!attSnap.exists) {
          const notifId = `checkin_${userId}_${today}`;
          const notifRef = adminDb.collection("notifications").doc(notifId);
          const snap = await notifRef.get();
          if (!snap.exists) {
            const msg = await generateAIMessage(
              `Write a short, warm morning reminder (plain text, 40-50 words) for an employee named "${name}" to check in on their attendance app. Sound like a friendly AI bot. No markdown.`,
              `Good morning ${name}! 👋 Don't forget to check in on Office Tracker to start your day. Have a productive one!`
            );
            await notifRef.set({
              userId,
              type: "info",
              title: "⏰ Good Morning! Time to Check In",
              message: msg,
              isRead: false,
              relatedCollection: "ai-workflow",
              createdAt: admin.firestore.Timestamp.now(),
            });
            if (email) await sendEmail(email, name, "Good Morning — Don't Forget to Check In!", msg);
            results.morningNudges++;
          }
        }
      }

      // ── 2. NO UPDATE REMINDER: No work update in last 24h ────────────────
      if (isEvening) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const updatesSnap = await adminDb.collection("workUpdates")
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(oneDayAgo))
          .get();

        const userUpdates = updatesSnap.docs.filter(doc => doc.data().uid === userId);

        if (userUpdates.length === 0) {
          const notifId = `workupdate_${userId}_${today}`;
          const notifRef = adminDb.collection("notifications").doc(notifId);
          const snap = await notifRef.get();
          if (!snap.exists) {
            const msg = await generateAIMessage(
              `Write a short, nudging reminder (plain text, 50-60 words) for an employee named "${name}" who hasn't submitted their daily work update today. Ask them to share their progress. Sound encouraging, not nagging. No markdown.`,
              `Hi ${name}! 📋 It looks like you haven't submitted your daily work update today. Even a brief summary helps keep the team aligned. Please take a moment to share what you worked on!`
            );
            await notifRef.set({
              userId,
              type: "warning",
              title: "📋 Daily Update Not Submitted",
              message: msg,
              isRead: false,
              relatedCollection: "ai-workflow",
              createdAt: admin.firestore.Timestamp.now(),
            });
            if (email) await sendEmail(email, name, "Daily Work Update Reminder", msg);
            results.noUpdateReminders++;
          }
        }
      }

      // ── 3. 5:00 O'CLOCK BREAK REMINDER: At 5:00 PM IST ───────────────────
      if (hourIST === 17) {
        const notifId = `break_${userId}_${today}`;
        const notifRef = adminDb.collection("notifications").doc(notifId);
        const snap = await notifRef.get();
        if (!snap.exists) {
          const msg = await generateAIMessage(
            `Write a friendly, short message (plain text, 40-50 words) reminding an employee named "${name}" that it's 5:00 PM (Tea/Coffee break time). Sound like a warm office companion bot. No markdown.`,
            `Hi ${name}! ☕ It's 5:00 PM—time for a quick tea or coffee break. Step away from your desk, stretch, and refresh yourself!`
          );
          await notifRef.set({
            userId,
            type: "info",
            title: "☕ It's 5:00 PM! Tea/Coffee Break Time",
            message: msg,
            isRead: false,
            relatedCollection: "ai-workflow",
            createdAt: admin.firestore.Timestamp.now(),
          });
          if (email) await sendEmail(email, name, "Tea/Coffee Break Time! ☕", msg);
          results.breakReminders++;
        }
      }

      // ── 4. BLOCKER ESCALATION: Unresolved blocker for 48h+ ───────────────
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const blockerSnap = await adminDb.collection("workUpdates")
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(twoDaysAgo))
        .get();

      const userBlockerDocs = blockerSnap.docs.filter(doc => doc.data().uid === userId);

      for (const updateDoc of userBlockerDocs) {
        const data = updateDoc.data();
        const blockers = data.blockers || "";
        if (!blockers || blockers.toLowerCase() === "none" || blockers.trim() === "" || data.blockerEscalated) continue;

        // Notify employee
        const empMsg = await generateAIMessage(
          `Write a short follow-up (plain text, 50 words) for an employee named "${name}" who reported a blocker 2 days ago: "${blockers}". Ask if it's resolved and if they need help. Professional tone. No markdown.`,
          `Hi ${name}, I noticed you reported a blocker 2 days ago: "${blockers}". Has this been resolved? If you still need help, please reach out to your manager or team.`
        );
        await notifyEmployee(userId, email, name, "🚧 Blocker Follow-Up", empMsg, "warning", "Following Up on Your Reported Blocker");

        // Notify all admins
        const adminMsg = `Blocker Alert: ${name} reported a blocker 2+ days ago that appears unresolved.\n\nBlocker: "${blockers}"\n\nPlease check in with ${name} to help resolve this.`;
        const adminsSnap = await adminDb.collection("users").where("role", "==", "admin").get();
        for (const adminDoc of adminsSnap.docs) {
          const adminData = adminDoc.data();
          await notifyEmployee(adminDoc.id, adminData.email || null, adminData.name || "Admin", `🚨 Blocker Alert: ${name}`, adminMsg, "error", `Blocker Alert — ${name} needs help`);
        }

        // Mark as escalated to avoid repeat
        await adminDb.collection("workUpdates").doc(updateDoc.id).update({ blockerEscalated: true });
        results.blockerEscalations++;
      }

      // ── 5. ETA FOLLOW-UP: Task passed ETA, still open ────────────────────
      const tasksSnap = await adminDb.collection("projectTasks")
        .where("assignedTo", "==", userId)
        .where("status", "in", ["open", "in-progress"])
        .get();

      for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.eta || task.etaFollowedUp) continue;

        const etaDate = new Date(task.eta);
        if (isNaN(etaDate.getTime()) || etaDate >= now) continue;

        const taskTitle = task.title || "your task";
        const etaMsg = await generateAIMessage(
          `Write a short professional message (plain text, 50 words) for an employee named "${name}". Their task "${taskTitle}" had an ETA of "${task.eta}" and is still open. Politely ask for an updated ETA. No markdown.`,
          `Hi ${name}, I noticed your task "${taskTitle}" had an ETA of "${task.eta}" but is still marked as open. Could you provide an updated ETA? This helps the team plan better.`
        );
        await notifyEmployee(userId, email, name, `⏳ ETA Passed: ${taskTitle}`, etaMsg, "warning", `Task ETA Overdue: ${taskTitle}`);
        await adminDb.collection("projectTasks").doc(taskDoc.id).update({ etaFollowedUp: true });
        results.etaFollowUps++;
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("[AI Workflow Engine Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
