import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendBatch } from "@/lib/emailSender";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  
  // Vercel Cron automatically sends a Bearer token using CRON_SECRET, 
  // but we also support the custom SCHEDULER_SECRET if configured.
  const isValidCron = auth === `Bearer ${process.env.CRON_SECRET}` || auth === `Bearer ${process.env.SCHEDULER_SECRET}`;
  
  if (!isValidCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb;
  const todayISO = new Date().toISOString().slice(0, 10);
  const report: any = { date: todayISO, jobs: [] };

  try {
    const [empSnap, attSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("attendance").where("date", "==", todayISO).get(),
    ]);

    const usersList = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const employees = usersList.filter((u: any) => u.accountType !== "ADMIN");
    const totalEmployees = employees.length;

    const checkedInUserIds = new Set(attSnap.docs.map(d => d.data().userId));
    
    // Find who checked in
    const presentEmployees = employees.filter((e: any) => checkedInUserIds.has(e.id));
    const absentEmployees = employees.filter((e: any) => !checkedInUserIds.has(e.id));

    const totalPresent = presentEmployees.length;
    const totalAbsent = absentEmployees.length;

    const presentList = presentEmployees.map((e: any) => e.name || e.email?.split("@")[0] || "Unknown").join(", ") || "None";
    const absentList = absentEmployees.map((e: any) => e.name || e.email?.split("@")[0] || "Unknown").join(", ") || "None";

    const adminUsers = usersList.filter((u: any) => u.accountType === "ADMIN" && u.email);
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

    const attendanceSummaryHtml = (adminName: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e3a8a; margin-top: 0;">📅 Daily Attendance Summary</h2>
        <p>Hello ${adminName},</p>
        <p>Here is the daily attendance report for <strong>${todayISO}</strong>:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 10px; text-align: left; font-weight: bold; color: #475569;">Metric</th>
            <th style="padding: 10px; text-align: right; font-weight: bold; color: #475569;">Count</th>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px; color: #1e293b;">Total Employees</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #1e293b;">${totalEmployees}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px; color: #16a34a; font-weight: bold;">Present (Checked In)</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #16a34a;">${totalPresent}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px; color: #dc2626; font-weight: bold;">Absent (Not Checked In)</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #dc2626;">${totalAbsent}</td>
          </tr>
        </table>

        <div style="margin-top: 20px;">
          <h4 style="color: #475569; margin-bottom: 5px;">✅ Checked In Today:</h4>
          <p style="font-size: 13px; color: #1e293b; background-color: #f0fdf4; padding: 10px; border-radius: 4px; line-height: 1.5;">${presentList}</p>
        </div>

        <div style="margin-top: 20px;">
          <h4 style="color: #475569; margin-bottom: 5px;">❌ Not Checked In Today:</h4>
          <p style="font-size: 13px; color: #1e293b; background-color: #fef2f2; padding: 10px; border-radius: 4px; line-height: 1.5;">${absentList}</p>
        </div>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">Techgy Innovations HR System</p>
      </div>
    `;

    const result = await sendBatch({
      recipients: uniqueAdminRecipients,
      subject: `📅 Daily Attendance Report – ${todayISO}`,
      html: attendanceSummaryHtml,
      type: "admin_attendance_summary",
      sentBy: "system",
    });

    report.jobs.push({ job: "attendance_summary", count: uniqueAdminRecipients.length, ...result });

  } catch (err: any) {
    report.jobs.push({ job: "attendance_summary", error: err.message });
  }

  return NextResponse.json({ ok: true, ...report });
}
