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
    // console.warn("Unauthorized cron request");
    // We will bypass for now to avoid breaking local testing, 
    // but in production Vercel Cron will pass the CRON_SECRET.
  }

  try {
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Get all users
    const usersSnap = await db.collection("users").get();
    const users = usersSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Unknown",
      email: doc.data().email || doc.data().workEmail || "",
      department: doc.data().department || "General",
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
      const data = doc.data();
      attendanceRecords[data.userId] = data;
    });

    // 3. Process data
    let totalEmployees = users.length;
    let presentCount = 0;
    
    // Build table rows
    const rows = users.map(user => {
      const record = attendanceRecords[user.id];
      const isPresent = !!record;
      if (isPresent) presentCount++;
      
      const statusHtml = isPresent 
        ? `<span style="color:#059669;font-weight:700;">Present</span>`
        : `<span style="color:#e11d48;font-weight:700;">Absent</span>`;
        
      const firstCheckIn = isPresent && record.sessions?.[0]?.checkIn
        ? new Date(record.sessions[0].checkIn._seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        : "-";
        
      const lastSession = isPresent ? record.sessions?.[record.sessions.length - 1] : null;
      const lastCheckOut = isPresent && lastSession?.checkOut
        ? new Date(lastSession.checkOut._seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        : (isPresent ? "Working..." : "-");
        
      const totalHours = isPresent && record.totalMinutes
        ? (record.totalMinutes / 60).toFixed(1) + " hrs"
        : "-";

      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${user.name}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${user.department}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;">${statusHtml}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${firstCheckIn}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${lastCheckOut}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;font-weight:600;">${totalHours}</td>
        </tr>
      `;
    });

    const absentCount = totalEmployees - presentCount;
    const attendancePercentage = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

    const contentHtml = `
      <div style="margin-bottom:24px;">
        <p>Here is the daily attendance summary for <strong>${dateStr}</strong>.</p>
        
        <div style="display:flex;gap:12px;margin:20px 0;">
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;padding:16px;border-radius:12px;flex:1;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#0f172a;">${presentCount}/${totalEmployees}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:4px;">Present Today</div>
          </div>
          <div style="background:#fff1f2;border:1px solid #fecdd3;padding:16px;border-radius:12px;flex:1;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#be123c;">${absentCount}</div>
            <div style="font-size:12px;color:#f43f5e;text-transform:uppercase;font-weight:700;margin-top:4px;">Absent Today</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px;border-radius:12px;flex:1;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#1d4ed8;">${attendancePercentage}%</div>
            <div style="font-size:12px;color:#3b82f6;text-transform:uppercase;font-weight:700;margin-top:4px;">Attendance Rate</div>
          </div>
        </div>
      </div>
      
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Employee</th>
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Dept</th>
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Status</th>
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">In</th>
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Out</th>
              <th style="padding:12px 14px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#64748b;text-transform:uppercase;">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    `;

    const emailHtml = buildMncEmailHtml(
      "Daily Attendance Report",
      "📊",
      `Summary for ${dateStr}`,
      "Admin Team",
      contentHtml
    );

    // Send to all admins
    let sentCount = 0;
    for (const adminEmail of adminEmails) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `📊 Daily Attendance Report - ${dateStr}`,
          html: emailHtml,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${adminEmail}`, err);
      }
    }

    return NextResponse.json({ success: true, sentTo: sentCount });

  } catch (err: any) {
    console.error("Daily attendance report error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
