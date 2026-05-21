// app/api/scheduler/daily/route.ts
// Daily cron job. Uses Firebase Admin SDK — runs safely in Node.js.
// Trigger: Vercel Cron at 08:00 AM IST (02:30 UTC) — see vercel.json
// Auth: Authorization: Bearer <SCHEDULER_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendBatch, markLastSent }   from "@/lib/emailSender";
import {
  buildBirthdayHtml,
  buildFestivalHtml,
  buildEventHtml,
} from "@/lib/emailTemplates";

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.SCHEDULER_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db        = adminDb;
  const todayISO  = new Date().toISOString().slice(0, 10);
  const todayMMDD = todayISO.slice(5);
  const report: any = { date: todayISO, jobs: [] };

  // ── 1. Birthday Wishes ──────────────────────────────────────────────────────
  try {
    const snap = await db.collection("users").get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const due = users.filter((u: any) => {
      const birthDate = u.dateOfBirth || u.birthDate;
      if (!birthDate || !u.email) return false;
      
      const mm = birthDate.slice(5, 7);
      const dd = birthDate.slice(8, 10);
      const birthMonthDay = `${mm}-${dd}`;
      
      return birthMonthDay === todayMMDD && u.lastWishSentOn !== todayISO;
    });

    if (due.length > 0) {
      const result = await sendBatch({
        recipients: due.map((u: any) => ({ id: u.id, email: u.email, name: u.name })),
        subject:    `🎂 Happy Birthday from Techgy Innovations! 🎉`,
        html:       buildBirthdayHtml,
        type:       "birthday",
        sentBy:     "system",
      });
      
      // Update lastWishSentOn in users collection
      for (const u of due) {
        await db.collection("users").doc(u.id).update({ lastWishSentOn: todayISO });
      }
      
      report.jobs.push({ job: "birthday_wishes", count: due.length, ...result });

      // NEW: Notify admins about the birthdays today
      try {
        const adminUsers = users.filter((u: any) => u.accountType === "ADMIN" && u.email);
        const adminRecipients = [
          { id: "admin_custom", email: "officetracker1@gmail.com", name: "Admin" },
          ...adminUsers.map((a: any) => ({ id: a.id, email: a.email, name: a.name || "Admin" }))
        ];
        
        // Remove duplicate emails
        const seen = new Set();
        const uniqueAdminRecipients = adminRecipients.filter(r => {
          if (seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });

        const names = due.map((u: any) => u.name || u.email?.split("@")[0] || "Employee").join(", ");
        const bdayAlertHtml = (adminName: string) => `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e3a8a; margin-top: 0;">🎉 Birthday Alert!</h2>
            <p>Hello ${adminName},</p>
            <p>Here is a reminder that today is a birthday for the following employee(s):</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
              🎂 ${names}
            </div>
            <p>Please make sure to congratulate them!</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280; text-align: center;">Techgy Innovations HR System</p>
          </div>
        `;

        await sendBatch({
          recipients: uniqueAdminRecipients,
          subject: `🎂 Birthday Alert: ${names}`,
          html: bdayAlertHtml,
          type: "admin_birthday_alert",
          sentBy: "system",
        });
      } catch (err: any) {
        console.error("Failed to send admin birthday alerts", err);
      }

    } else {
      report.jobs.push({ job: "birthday_wishes", skipped: true });
    }
  } catch (err: any) {
    report.jobs.push({ job: "birthday_wishes", error: err.message });
  }

  // ── 2. Festival Greetings ───────────────────────────────────────────────────
  try {
    const [festSnap, empSnap] = await Promise.all([
      db.collection("festivals").get(),
      db.collection("users").get(),
    ]);
    const festivals  = festSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const recipients = empSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((e: any) => e.email)
      .map((e: any) => ({ id: e.id, email: e.email, name: e.name }));

    for (const fest of festivals) {
      if (!fest.sendEmail) continue;
      const advance  = Number(fest.sendInAdvanceDays) || 0;
      const sendDate = advance > 0 ? addDays(fest.festivalDate, -advance) : fest.festivalDate;
      if (sendDate !== todayISO || fest.lastSentOn === todayISO) continue;
      if (recipients.length === 0) {
        report.jobs.push({ job: `festival_${fest.id}`, skipped: true, reason: "No employees" });
        continue;
      }
      const result = await sendBatch({
        recipients,
        subject: fest.emailSubject || `🎉 ${fest.title} Wishes – Techgy Innovations`,
        html: (name: string) => buildFestivalHtml(
          name, fest.title,
          fest.emailMessage || `Wishing you a wonderful ${fest.title}!`,
          fest.bannerEmoji  || "🎉",
          fest.bannerColor  || "#f59e0b",
        ),
        type: "festival", sentBy: "system", refId: fest.id,
      });
      await markLastSent("festivals", fest.id, "lastSentOn");
      report.jobs.push({ job: `festival_${fest.id}`, title: fest.title, ...result });
    }
  } catch (err: any) {
    report.jobs.push({ job: "festival_greetings", error: err.message });
  }

  // ── 3. Event Announcements & Reminders ─────────────────────────────────────
  try {
    const [evSnap, empSnap] = await Promise.all([
      db.collection("companyEvents").get(),
      db.collection("users").get(),
    ]);
    const events     = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const recipients = empSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((e: any) => e.email)
      .map((e: any) => ({ id: e.id, email: e.email, name: e.name }));

    for (const ev of events) {
      if (!ev.sendAnnouncementEmail) continue;
      // Announcement on event day
      if (ev.eventDate === todayISO && ev.announcementSentOn !== todayISO) {
        const result = await sendBatch({
          recipients,
          subject: `📅 Today: ${ev.title}`,
          html: (name: string) => buildEventHtml(
            name, ev.title, ev.description, ev.eventDate,
            ev.location, ev.rsvpLink, ev.color,
          ),
          type: "event", sentBy: "system", refId: ev.id,
        });
        await markLastSent("companyEvents", ev.id, "announcementSentOn");
        report.jobs.push({ job: `event_announce_${ev.id}`, title: ev.title, ...result });
      }
      // Reminder N days before
      const remind = Number(ev.reminderDaysBefore) || 0;
      if (remind > 0) {
        const reminderDate = addDays(ev.eventDate, -remind);
        if (reminderDate === todayISO && ev.reminderSentOn !== todayISO) {
          const result = await sendBatch({
            recipients,
            subject: `⏰ Reminder: ${ev.title} in ${remind} day${remind > 1 ? "s" : ""}!`,
            html: (name: string) => buildEventHtml(
              name, ev.title, ev.description, ev.eventDate,
              ev.location, ev.rsvpLink, ev.color,
            ),
            type: "event", sentBy: "system", refId: ev.id,
          });
          await markLastSent("companyEvents", ev.id, "reminderSentOn");
          report.jobs.push({ job: `event_reminder_${ev.id}`, title: ev.title, ...result });
        }
      }
    }
  } catch (err: any) {
    report.jobs.push({ job: "event_reminders", error: err.message });
  }

  return NextResponse.json({ ok: true, ...report });
}

export async function GET() {
  return NextResponse.json({ status: "Scheduler active", time: new Date().toISOString() });
}