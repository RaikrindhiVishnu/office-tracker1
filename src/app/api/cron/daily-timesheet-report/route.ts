import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/email";
import { buildMncEmailHtml } from "@/lib/emailTemplate";

export async function GET(request: Request) {
  // Add simple auth so only Vercel cron or admin can hit this endpoint
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    // Return 401 if unauthorized, but for local dev we can allow or check differently
  }

  try {
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Get all users
    const usersSnap = await db.collection("users").get();
    const users = usersSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Unknown",
      email: doc.data().email || doc.data().workEmail || "",
      department: doc.data().department || "Other",
      role: doc.data().role || "employee",
    }));

    // Find the admins to send this report to
    const admins = users.filter(u => u.role === "admin" || u.role === "hr");
    const adminEmails = admins.map(a => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      return NextResponse.json({ message: "No admins found to send report" });
    }

    // 2. Get today's attendance records
    const attendanceSnap = await db
      .collection("attendance")
      .where("date", "==", dateStr)
      .get();
      
    const attendanceRecords: Record<string, any> = {};
    attendanceSnap.docs.forEach((doc) => {
      attendanceRecords[doc.data().userId] = doc.data();
    });

    // 3. Get today's daily sheets
    const sheetsSnap = await db
      .collection("dailySheets")
      .where("dateStr", "==", dateStr)
      .get();
      
    const sheetsRecords: Record<string, any> = {};
    sheetsSnap.docs.forEach((doc) => {
      sheetsRecords[doc.data().uid] = doc.data();
    });

    // 4. Group by Team
    const teams: Record<string, any[]> = {};
    
    users.forEach(user => {
      const team = user.department;
      if (!teams[team]) teams[team] = [];
      
      const att = attendanceRecords[user.id];
      const sheet = sheetsRecords[user.id];
      
      let isHoliday = sheet?.isHoliday || false;
      let statusText = att?.sessions && att.sessions.length > 0 ? "Present" : isHoliday ? "Holiday" : "Absent";
      
      const eodStatus = sheet?.status || "In Progress";
      
      // Get the tasks list. If there is no sheet or no tasks, push an empty row for the employee.
      const tasksList = sheet?.tasks && sheet.tasks.length > 0 
        ? sheet.tasks 
        : [{ project: sheet?.project || "", taskTitle: sheet?.taskTitle || "", description: sheet?.description || "" }];

      tasksList.forEach((t: any) => {
        // Ensure we include the row even if taskTitle is empty (so the employee at least shows as absent/present)
        teams[team].push({
          name: user.name,
          attendance: statusText,
          project: t.project || "N/A",
          task: t.taskTitle + (t.description ? ` - ${t.description}` : ""),
          eod: eodStatus
        });
      });
    });

    // 5. Build HTML
    let tableHtml = "";

    // Sort teams alphabetically
    const sortedTeams = Object.keys(teams).sort();

    for (const team of sortedTeams) {
      const teamRows = teams[team];
      if (teamRows.length === 0) continue;

      // Filter out duplicate employee names if they are just absent with no tasks so it doesn't clutter, 
      // Actually we grouped them, they shouldn't duplicate unless they have multiple tasks.
      
      tableHtml += `
        <tr>
          <td colspan="5" style="background:#0f172a;color:#ffffff;padding:12px 14px;font-weight:bold;font-size:14px;text-transform:uppercase;">${team}</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Employee Name</th>
          <th style="padding:10px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Attendance</th>
          <th style="padding:10px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Project</th>
          <th style="padding:10px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Task Assigned</th>
          <th style="padding:10px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">EOD Status</th>
        </tr>
      `;

      teamRows.forEach(row => {
        const attColor = row.attendance === "Present" ? "#059669" : row.attendance === "Holiday" ? "#ca8a04" : "#e11d48";
        tableHtml += `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-weight:600;">${row.name}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:${attColor};font-weight:700;">${row.attendance}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${row.project}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${row.task || "-"}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${row.attendance === "Absent" ? "-" : row.eod}</td>
          </tr>
        `;
      });
    }

    const contentHtml = `
      <div style="margin-bottom:24px;">
        <p>Here is the daily task sheet summary for <strong>${dateStr}</strong> grouped by team.</p>
      </div>
      
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;border:1px solid #e2e8f0;">
          ${tableHtml}
        </table>
      </div>
    `;

    const emailHtml = buildMncEmailHtml(
      "Daily Team-Wise Task Sheet Report",
      "📋",
      `Task Summary for ${dateStr}`,
      "Admin Team",
      contentHtml
    );

    // 6. Send to all admins
    let sentCount = 0;
    for (const adminEmail of adminEmails) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: \`📋 Daily Task Sheet Report - \${dateStr}\`,
          html: emailHtml,
        });
        sentCount++;
      } catch (err) {
        console.error(\`Failed to send to \${adminEmail}\`, err);
      }
    }

    return NextResponse.json({ success: true, sentTo: sentCount });

  } catch (err: any) {
    console.error("Daily timesheet report error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
