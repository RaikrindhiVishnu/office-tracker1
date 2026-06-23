"use client";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTodayDateStr } from "@/lib/breakTracking";

export default function WeeklyTimesheetView({ user }: { user: any }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    // Getting last 30 days to build weeks easily
    const q = query(
      collection(db, "dailySheets"),
      where("uid", "==", user.uid),
      orderBy("dateStr", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const getWeekRange = (offset: number) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (offset * 7)); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    return {
      start: startOfWeek.toISOString().slice(0, 10),
      end: endOfWeek.toISOString().slice(0, 10),
      label: `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    };
  };

  const currentWeek = getWeekRange(weekOffset);
  const weekEntries = entries.filter(e => e.dateStr >= currentWeek.start && e.dateStr <= currentWeek.end);
  
  let billableHours = 0;
  let nonBillableHours = 0;
  
  const totalHours = weekEntries.reduce((sum, e) => {
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

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Weekly Timesheet</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>View your logged hours for the week</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 600 }}>← Prev</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{currentWeek.label}</span>
          <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset === 0} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: weekOffset === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: weekOffset === 0 ? 0.5 : 1 }}>Next →</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#eff6ff", borderRadius: 12, padding: 20, border: "1px solid #bfdbfe", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Total Hours</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>{totalHours.toFixed(1)}h</div>
          </div>
        </div>
        <div style={{ background: "#eef2ff", borderRadius: 12, padding: 20, border: "1px solid #c7d2fe", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textTransform: "uppercase" }}>Billable</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#3730a3", marginTop: 4 }}>{billableHours.toFixed(1)}h</div>
          </div>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>Non-Billable</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#334155", marginTop: 4 }}>{nonBillableHours.toFixed(1)}h</div>
          </div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 20, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#15803d", fontWeight: 700, textTransform: "uppercase" }}>Days Logged</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#14532d", marginTop: 4 }}>{weekEntries.length} / 5</div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "14px 16px", textAlign: "left", color: "#475569" }}>Day</th>
              <th style={{ padding: "14px 16px", textAlign: "left", color: "#475569" }}>Date</th>
              <th style={{ padding: "14px 16px", textAlign: "left", color: "#475569" }}>Status</th>
              <th style={{ padding: "14px 16px", textAlign: "left", color: "#475569" }}>Logged Hours</th>
            </tr>
          </thead>
          <tbody>
            {days.map((dayName, i) => {
              const date = new Date(currentWeek.start);
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().slice(0, 10);
              const entry = weekEntries.find(e => e.dateStr === dateStr);
              
              const isWeekend = i >= 5;
              const hrs = entry ? (entry.tasks ? entry.tasks.reduce((s: number, t: any) => s + (Number(t.hours) || 0), 0) : Number(entry.hours || 0)) : 0;
              const statusText = isWeekend ? "Weekend" : entry ? (entry.isDraft ? "Draft" : (entry.isHoliday ? "Holiday" : "Submitted")) : "Missing";

              return (
                <tr key={dateStr} style={{ borderBottom: "1px solid #f1f5f9", background: isWeekend ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>{dayName}</td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ 
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: statusText === "Submitted" ? "#dcfce7" : statusText === "Missing" ? "#fee2e2" : "#f1f5f9",
                      color: statusText === "Submitted" ? "#166534" : statusText === "Missing" ? "#991b1b" : "#475569"
                    }}>
                      {statusText}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: hrs > 0 ? "#2563eb" : "#94a3b8" }}>
                    {hrs > 0 ? `${hrs.toFixed(1)}h` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
