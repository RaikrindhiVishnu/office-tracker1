"use client";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MonthlyTimesheetView({ user }: { user: any }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    if (!user?.uid || !selectedMonth) return;
    
    const q = query(
      collection(db, "dailySheets"),
      where("uid", "==", user.uid),
      where("monthStr", "==", selectedMonth),
      orderBy("dateStr", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, selectedMonth]);

  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDateStr = today.toISOString().slice(0, 10);
  
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isFutureMonth = new Date(year, month - 1, 1) > today;
  const maxDay = isFutureMonth ? 0 : (isCurrentMonth ? today.getDate() : daysInMonth);

  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${selectedMonth}-${String(i).padStart(2, "0")}`);
  }

  let billableHours = 0;
  let nonBillableHours = 0;

  const totalHours = entries.reduce((sum, e) => {
    if (e.tasks) {
      e.tasks.forEach((t: any) => {
        const hrs = Number(t.hours) || 0;
        if (t.isBillable !== false) billableHours += hrs;
        else nonBillableHours += hrs;
      });
    } else {
      const hrs = Number(e.hours || 0);
      billableHours += hrs; // legacy is billable by default
    }
    const entryHrs = e.tasks ? e.tasks.reduce((s: number, t: any) => s + (Number(t.hours) || 0), 0) : Number(e.hours || 0);
    return sum + entryHrs;
  }, 0);

  const expectedWorkDays = Array.from({length: maxDay}).filter((_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const day = d.getDay();
    let isWeekend = false;
    if (day === 0) isWeekend = true;
    if (day === 6) {
      const week = Math.ceil((i + 1) / 7);
      if (week === 2 || week === 4) isWeekend = true;
    }
    return !isWeekend;
  }).length;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Monthly Timesheet</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Overview of your logged hours for the month</p>
        </div>
        <div>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#334155", background: "#fff" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#eff6ff", borderRadius: 12, padding: "16px 20px", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Total Hours</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>{totalHours.toFixed(1)}h</div>
        </div>
        <div style={{ background: "#eef2ff", borderRadius: 12, padding: "16px 20px", border: "1px solid #c7d2fe" }}>
          <div style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textTransform: "uppercase" }}>Billable Hours</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3730a3", marginTop: 4 }}>{billableHours.toFixed(1)}h</div>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 20px", border: "1px solid #cbd5e1" }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>Non-Billable</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#334155", marginTop: 4 }}>{nonBillableHours.toFixed(1)}h</div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "16px 20px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 12, color: "#15803d", fontWeight: 700, textTransform: "uppercase" }}>Days Logged</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#14532d", marginTop: 4 }}>{entries.length} / {expectedWorkDays}</div>
        </div>
        <div style={{ background: "#fffbeb", borderRadius: 12, padding: "16px 20px", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700, textTransform: "uppercase" }}>Missing Logs</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#92400e", marginTop: 4 }}>{Math.max(0, expectedWorkDays - entries.length)}</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Day</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>Logged Hours</th>
              </tr>
            </thead>
            <tbody>
              {dates.reverse().map((dateStr) => {
                const isFuture = dateStr > todayDateStr;
                if (isFuture) return null;

                const d = new Date(dateStr + "T00:00:00");
                const day = d.getDay();
                const dateNum = d.getDate();
                let isWeekend = false;
                if (day === 0) isWeekend = true;
                if (day === 6) {
                  const week = Math.ceil(dateNum / 7);
                  if (week === 2 || week === 4) isWeekend = true;
                }

                const entry = entries.find(e => e.dateStr === dateStr);
                const hrs = entry ? (entry.tasks ? entry.tasks.reduce((s: number, t: any) => s + (Number(t.hours) || 0), 0) : Number(entry.hours || 0)) : 0;
                
                let statusText = "Missing";
                let statusColor = { bg: "#fee2e2", color: "#991b1b" };
                
                if (isWeekend) { statusText = "Weekend"; statusColor = { bg: "#f1f5f9", color: "#475569" }; }
                else if (entry) {
                  if (entry.isHoliday) { statusText = "Holiday"; statusColor = { bg: "#fef3c7", color: "#92400e" }; }
                  else if (entry.isDraft) { statusText = "Draft"; statusColor = { bg: "#e0e7ff", color: "#3730a3" }; }
                  else if (entry.status === "Approved") { statusText = "Approved"; statusColor = { bg: "#dcfce7", color: "#166534" }; }
                  else if (entry.status === "Rejected") { statusText = "Rejected"; statusColor = { bg: "#fee2e2", color: "#991b1b" }; }
                  else { statusText = "Submitted"; statusColor = { bg: "#dcfce7", color: "#166534" }; }
                }

                return (
                  <tr key={dateStr} style={{ borderBottom: "1px solid #f1f5f9", background: isWeekend ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#334155" }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 16, fontSize: 11, fontWeight: 700, background: statusColor.bg, color: statusColor.color }}>
                        {statusText}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: hrs > 0 ? "#2563eb" : "#94a3b8" }}>
                      {hrs > 0 ? `${hrs.toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
              {loading && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
