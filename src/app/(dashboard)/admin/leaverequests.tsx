"use client";
// ============================================================
// ADMIN LEAVE REQUESTS DASHBOARD
// Usage: <AdminLeaveRequests leaveRequests={[...]} users={[...]} updateLeaveStatus={fn} holidays={[...]} />
// ============================================================

import React, { useState, useMemo } from "react";

// ── TYPES ──────────────────────────────────────────────────
type LeaveStatus = "Approved" | "Rejected";
type TabKey      = "requests" | "holidays";
type ViewMode    = "table" | "cards";

interface User {
  uid: string;
  name: string;
  email: string;
  profilePhoto?: string;
}

interface LeaveRequest {
  id: string;
  uid: string;
  userName?: string;
  userEmail?: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  status: string;
}

interface Holiday {
  date: string;
  name: string;
  type: "national" | "optional";
}

interface ConfirmAction {
  id: string;
  action: LeaveStatus;
}

interface AdminHolidayCalendarProps {
  holidays: Holiday[];
  leaveRequests: LeaveRequest[];
  users: User[];
}

interface AdminLeaveRequestsProps {
  leaveRequests?: LeaveRequest[];
  users?: User[];
  holidays?: Holiday[];
  updateLeaveStatus?: (id: string, status: LeaveStatus) => void | Promise<void>;
}

// ── CONSTANTS ──────────────────────────────────────────────
const LEAVE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Casual:           { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  Sick:             { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "Work From Home": { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const LEAVE_ICONS: Record<string, string> = {
  Casual:           "🌴",
  Sick:             "🤒",
  "Work From Home": "🏠",
};

const STATUS_CFG: Record<string, { bg: string; text: string; ring: string; icon: string; label: string }> = {
  Pending:  { bg: "#FFFBEB", text: "#92400E", ring: "#F59E0B", icon: "⏳", label: "Pending"  },
  Approved: { bg: "#F0FDF4", text: "#14532D", ring: "#22C55E", icon: "✅", label: "Approved" },
  Rejected: { bg: "#FFF1F2", text: "#881337", ring: "#F43F5E", icon: "❌", label: "Rejected" },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── HELPERS ────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getDays(from: string, to: string): number {
  if (!from || !to) return 1;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  return d >= 0 ? d + 1 : 1;
}

// ── DEMO DATA ──────────────────────────────────────────────
const DEMO_USERS: User[] = [
  { uid: "u1", name: "Arjun Sharma", email: "arjun@acme.com" },
  { uid: "u2", name: "Priya Nair",   email: "priya@acme.com" },
  { uid: "u3", name: "Ravi Kumar",   email: "ravi@acme.com"  },
  { uid: "u4", name: "Sneha Patel",  email: "sneha@acme.com" },
  { uid: "u5", name: "Meera Reddy",  email: "meera@acme.com" },
];

const DEMO_REQUESTS: LeaveRequest[] = [
  { id:"1", uid:"u1", userName:"Arjun Sharma", userEmail:"arjun@acme.com", leaveType:"Casual",        fromDate:"2025-07-10", toDate:"2025-07-12", reason:"Annual family vacation to Ooty. Parents have been planning this trip for over 3 months.",    status:"Pending"  },
  { id:"2", uid:"u2", userName:"Priya Nair",   userEmail:"priya@acme.com", leaveType:"Sick",           fromDate:"2025-07-05", toDate:"2025-07-06", reason:"Diagnosed with viral fever and body aches. Doctor has recommended complete bed rest.",       status:"Approved" },
  { id:"3", uid:"u3", userName:"Ravi Kumar",   userEmail:"ravi@acme.com",  leaveType:"Work From Home", fromDate:"2025-07-15", toDate:"2025-07-17", reason:"Ongoing home renovation. Will be fully available and productive remotely.",                  status:"Pending"  },
  { id:"4", uid:"u4", userName:"Sneha Patel",  userEmail:"sneha@acme.com", leaveType:"Sick",           fromDate:"2025-07-20", toDate:"2025-07-20", reason:"Urgent personal appointment at hospital for routine check-up.",                             status:"Rejected" },
  { id:"5", uid:"u1", userName:"Arjun Sharma", userEmail:"arjun@acme.com", leaveType:"Sick",           fromDate:"2025-06-20", toDate:"2025-06-21", reason:"Severe migraine headache. Doctor prescribed medication and rest.",                          status:"Approved" },
  { id:"6", uid:"u5", userName:"Meera Reddy",  userEmail:"meera@acme.com", leaveType:"Casual",         fromDate:"2025-08-14", toDate:"2025-08-16", reason:"Sister's wedding ceremony and related family events.",                                      status:"Pending"  },
  { id:"7", uid:"u2", userName:"Priya Nair",   userEmail:"priya@acme.com", leaveType:"Work From Home", fromDate:"2025-08-04", toDate:"2025-08-06", reason:"Internet broadband upgrade at home scheduled for these days.",                              status:"Approved" },
  { id:"8", uid:"u3", userName:"Ravi Kumar",   userEmail:"ravi@acme.com",  leaveType:"Casual",         fromDate:"2025-09-05", toDate:"2025-09-05", reason:"Ganesh Chaturthi family pooja at ancestral home.",                                         status:"Pending"  },
];

const DEMO_HOLIDAYS: Holiday[] = [
  { date:"2025-01-14", name:"Makar Sankranti",      type:"national" },
  { date:"2025-01-26", name:"Republic Day",          type:"national" },
  { date:"2025-03-17", name:"Holi",                  type:"national" },
  { date:"2025-04-14", name:"Dr. Ambedkar Jayanti",  type:"optional" },
  { date:"2025-04-18", name:"Good Friday",           type:"national" },
  { date:"2025-05-12", name:"Buddha Purnima",        type:"optional" },
  { date:"2025-06-07", name:"Eid ul-Adha",           type:"national" },
  { date:"2025-07-06", name:"Bonalu",                type:"optional" },
  { date:"2025-08-15", name:"Independence Day",      type:"national" },
  { date:"2025-08-27", name:"Janmashtami",           type:"national" },
  { date:"2025-09-05", name:"Ganesh Chaturthi",      type:"national" },
  { date:"2025-10-02", name:"Gandhi Jayanti",        type:"national" },
  { date:"2025-10-20", name:"Diwali",                type:"national" },
  { date:"2025-11-15", name:"Guru Nanak Jayanti",    type:"national" },
  { date:"2025-12-25", name:"Christmas",             type:"national" },
];

// ══════════════════════════════════════════════════════════
//  HOLIDAY + EMPLOYEE LEAVES CALENDAR
// ══════════════════════════════════════════════════════════
const navBtnStyle: React.CSSProperties = {
  width:32, height:32, borderRadius:8, border:"1px solid #e2e8f0",
  background:"#fff", cursor:"pointer", fontSize:18, fontWeight:700,
  color:"#334155", display:"flex", alignItems:"center", justifyContent:"center",
};

function AdminHolidayCalendar({ holidays, leaveRequests, users }: AdminHolidayCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year,  setYear]  = useState<number>(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = todayStr();

  const prev = (): void => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = (): void => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthHols = useMemo(() =>
    holidays.filter(h => h.date.startsWith(monthKey)),
    [holidays, monthKey]
  );
  const holSet = new Set(monthHols.map(h => h.date));

  const leavesPerDate = useMemo((): Record<string, LeaveRequest[]> => {
    const map: Record<string, LeaveRequest[]> = {};
    leaveRequests.forEach(leave => {
      if (leave.status === "Rejected") return;
      const from = new Date(leave.fromDate + "T00:00:00");
      const to   = new Date(leave.toDate   + "T00:00:00");
      const cur  = new Date(from);
      while (cur <= to) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
        if (ds.startsWith(monthKey)) {
          if (!map[ds]) map[ds] = [];
          map[ds].push(leave);
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [leaveRequests, monthKey]);

  const empOnLeaveThisMonth = useMemo((): User[] => {
    const ids = new Set<string>();
    Object.values(leavesPerDate).forEach(leaves => leaves.forEach(l => ids.add(l.uid)));
    return [...ids]
      .map(uid => users.find(u => u.uid === uid))
      .filter((u): u is User => u !== undefined);
  }, [leavesPerDate, users]);

  const firstDayDow  = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const selectedLeaves   = selectedDate ? (leavesPerDate[selectedDate] ?? []) : [];
  const selectedHolidays = selectedDate ? monthHols.filter(h => h.date === selectedDate) : [];
  const natCount = holidays.filter(h => h.date.startsWith(String(year)) && h.type === "national").length;
  const optCount = holidays.filter(h => h.date.startsWith(String(year)) && h.type === "optional").length;

  return (
    <div>
      {/* Year pills */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ background:"#1E3A5F", color:"#fff", borderRadius:10, padding:"5px 14px", fontSize:13, fontWeight:700 }}>
          📅 {year}
        </div>
        <span style={{ background:"#dcfce7", color:"#166534", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
          🏖️ {natCount} National
        </span>
        <span style={{ background:"#eff6ff", color:"#1d4ed8", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
          ✨ {optCount} Optional
        </span>
        {empOnLeaveThisMonth.length > 0 && (
          <span style={{ background:"#fdf4ff", color:"#7e22ce", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
            👥 {empOnLeaveThisMonth.length} emp on leave this month
          </span>
        )}
      </div>

      {/* Month navigator */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <button onClick={prev} style={navBtnStyle}>&#8249;</button>
        <span style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={next} style={navBtnStyle}>&#8250;</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Mini Calendar */}
        <div style={{ background:"#f8fafc", borderRadius:14, padding:14, border:"1px solid #e2e8f0" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
            {SHORT_DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#94a3b8", padding:"3px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {Array.from({ length: firstDayDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const ds       = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isHol    = holSet.has(ds);
              const isTdy    = ds === today;
              const isSel    = ds === selectedDate;
              const dow      = new Date(year, month, day).getDay();
              const isWkd    = dow === 0 || dow === 6;
              const leaves   = leavesPerDate[ds] ?? [];
              const hasLeave = leaves.length > 0;
              return (
                <div key={day}
                  onClick={() => setSelectedDate(isSel ? null : ds)}
                  title={isHol ? monthHols.filter(h => h.date === ds).map(h => h.name).join(", ") : hasLeave ? `${leaves.length} employee(s) on leave` : ""}
                  style={{
                    textAlign:"center", padding:"5px 2px", borderRadius:7, fontSize:12,
                    fontWeight: isHol || isTdy || hasLeave ? 800 : 400,
                    background: isSel ? "#4F46E5" : isTdy ? "#1E3A5F" : isHol ? "#fef9c3" : hasLeave ? "#fdf4ff" : "transparent",
                    color: isSel ? "#fff" : isTdy ? "#fff" : isHol ? "#92400e" : hasLeave ? "#7e22ce" : isWkd ? "#ef4444" : "#334155",
                    cursor: (hasLeave || isHol) ? "pointer" : "default",
                    position:"relative",
                    border: isSel ? "2px solid #4F46E5" : "2px solid transparent",
                    transition:"all 0.12s",
                  }}>
                  {day}
                  {hasLeave && !isSel && !isTdy && (
                    <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width: leaves.length > 1 ? "auto" : 5, height:5, borderRadius:4, background:"#a855f7", padding: leaves.length > 1 ? "0 3px" : 0, fontSize:7, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }}>
                      {leaves.length > 1 ? leaves.length : ""}
                    </div>
                  )}
                  {isHol && !isTdy && !isSel && !hasLeave && (
                    <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"#f59e0b" }} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
            {[
              { label:"Today",      box:"#1E3A5F",     border:"none"                  },
              { label:"Holiday",    box:"#fef9c3",     border:"none"                  },
              { label:"Emp. Leave", box:"#fdf4ff",     border:"none"                  },
              { label:"Weekend",    box:"transparent", border:"1px solid #fca5a5"     },
            ].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:l.box, border:l.border }} />
                <span style={{ color:"#64748b", fontWeight:600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {selectedDate ? (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ border:"none", background:"#f1f5f9", borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", color:"#64748b", fontWeight:600 }}>&#x2715; Close</button>
              </div>
              {selectedHolidays.map((h, i) => (
                <div key={i} style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:12, padding:"10px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:22 }}>🏖️</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#92400e" }}>{h.name}</div>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background: h.type === "national" ? "#dcfce7" : "#eff6ff", color: h.type === "national" ? "#166534" : "#1d4ed8" }}>
                      {h.type === "national" ? "National" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
              {selectedLeaves.length === 0 ? (
                <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:13, background:"#f8fafc", borderRadius:12, border:"1px dashed #e2e8f0" }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>✅</div>
                  No employees on leave
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {selectedLeaves.map((leave, i) => {
                    const emp = users.find(u => u.uid === leave.uid);
                    const lc  = LEAVE_COLORS[leave.leaveType] ?? LEAVE_COLORS["Casual"];
                    const sc  = STATUS_CFG[leave.status]      ?? STATUS_CFG["Pending"];
                    return (
                      <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"12px 14px", borderLeft:`4px solid ${lc.dot}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:13, flexShrink:0 }}>
                              {(leave.userName ?? emp?.name ?? "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{leave.userName ?? emp?.name}</div>
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{leave.userEmail ?? emp?.email}</div>
                            </div>
                          </div>
                          <span style={{ background:sc.bg, color:sc.text, border:`1px solid ${sc.ring}`, borderRadius:8, padding:"3px 9px", fontSize:11, fontWeight:700 }}>{sc.icon} {sc.label}</span>
                        </div>
                        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                          <span style={{ background:lc.bg, color:lc.text, borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                            {LEAVE_ICONS[leave.leaveType] ?? ""} {leave.leaveType}
                          </span>
                          <span style={{ background:"#f3f4f6", color:"#374151", borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:500 }}>
                            {leave.fromDate} &#8594; {leave.toDate}
                          </span>
                        </div>
                        {leave.reason && (
                          <div style={{ fontSize:12, color:"#6b7280", marginTop:8, lineHeight:1.5 }}>
                            {leave.reason.slice(0, 100)}{leave.reason.length > 100 ? "…" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"#0f172a", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                {MONTH_NAMES[month]} Holidays
                {monthHols.length > 0 && (
                  <span style={{ background:"#fef9c3", color:"#92400e", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{monthHols.length}</span>
                )}
              </div>
              {monthHols.length === 0 ? (
                <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:13, background:"#f8fafc", borderRadius:12, border:"1px dashed #e2e8f0" }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>🎉</div>
                  No holidays this month
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {monthHols.map((h, i) => {
                    const d    = new Date(h.date + "T00:00:00");
                    const dayN = d.getDate();
                    const dow  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
                    const past = h.date < today;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, background:past ? "#f8fafc" : "#fffbeb", border:`1px solid ${past ? "#e2e8f0" : "#fcd34d"}`, opacity:past ? 0.6 : 1 }}>
                        <div style={{ width:42, height:42, borderRadius:10, flexShrink:0, background:past ? "#e2e8f0" : "#1E3A5F", color:past ? "#64748b" : "#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", lineHeight:1.2 }}>
                          <span style={{ fontSize:15, fontWeight:900 }}>{dayN}</span>
                          <span style={{ fontSize:9, fontWeight:600, opacity:0.8 }}>{dow}</span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                          <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{MONTH_NAMES[month]} {dayN}, {year}</div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, flexShrink:0, background:h.type === "national" ? "#dcfce7" : "#eff6ff", color:h.type === "national" ? "#166534" : "#1d4ed8" }}>
                          {h.type === "national" ? "National" : "Optional"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {empOnLeaveThisMonth.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#7e22ce", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>
                    👥 Employees on Leave
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {empOnLeaveThisMonth.map(emp => (
                      <div key={emp.uid} style={{ background:"#fdf4ff", border:"1px solid #e9d5ff", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600, color:"#7e22ce" }}>
                        {emp.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Month quick-jump */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:16 }}>
        {MONTH_NAMES.map((name, i) => {
          const k  = `${year}-${String(i + 1).padStart(2, "0")}`;
          const hc = holidays.filter(h => h.date.startsWith(k)).length;
          const leaveEmpSet = new Set<string>();
          leaveRequests.forEach(l => {
            if (l.status === "Rejected") return;
            if (l.fromDate.startsWith(k) || l.toDate.startsWith(k)) leaveEmpSet.add(l.uid);
          });
          const lc  = leaveEmpSet.size;
          const sel = i === month;
          return (
            <button key={name} onClick={() => setMonth(i)} style={{ padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", position:"relative", background:sel ? "#1E3A5F" : hc > 0 ? "#fef9c3" : "#f1f5f9", color:sel ? "#fff" : hc > 0 ? "#92400e" : "#64748b" }}>
              {name.slice(0, 3)}
              {(hc > 0 || lc > 0) && !sel && (
                <span style={{ position:"absolute", top:-5, right:-5, width:15, height:15, borderRadius:"50%", background: lc > 0 ? "#a855f7" : "#f59e0b", color:"#fff", fontSize:8, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>{lc || hc}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN ADMIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function AdminLeaveRequests({
  leaveRequests     = DEMO_REQUESTS,
  users             = DEMO_USERS,
  holidays          = DEMO_HOLIDAYS,
  updateLeaveStatus = () => {},
}: AdminLeaveRequestsProps) {
  const [tab,             setTab]             = useState<TabKey>("requests");
  const [search,          setSearch]          = useState<string>("");
  const [statusFilter,    setStatusFilter]    = useState<string>("All");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("All");
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [currentPage,     setCurrentPage]     = useState<number>(1);
  const [viewMode,        setViewMode]        = useState<ViewMode>("table");
  const [confirmAction,   setConfirmAction]   = useState<ConfirmAction | null>(null);
  const ITEMS = 8;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leaveRequests.filter(l => {
      const emp   = users.find(u => u.uid === l.uid);
      const name  = (l.userName  ?? emp?.name  ?? "").toLowerCase();
      const email = (l.userEmail ?? emp?.email ?? "").toLowerCase();
      const matchSearch = !q || name.includes(q) || email.includes(q) ||
        l.leaveType.toLowerCase().includes(q) ||
        (l.reason ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter    === "All" || l.status    === statusFilter;
      const matchType   = leaveTypeFilter === "All" || l.leaveType === leaveTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [leaveRequests, users, search, statusFilter, leaveTypeFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS, currentPage * ITEMS);

  const handleAction = (id: string, action: LeaveStatus): void => {
    setConfirmAction({ id, action });
  };

  const confirmDo = (): void => {
    if (confirmAction) {
      updateLeaveStatus(confirmAction.id, confirmAction.action);
    }
    setConfirmAction(null);
  };

  const TABS: Array<{ key: TabKey; label: string }> = [
    { key:"requests", label:"📋 Leave Requests"    },
    { key:"holidays", label:"🗓️ Holiday Calendar" },
  ];

  const VIEW_MODES: Array<{ mode: ViewMode; icon: string }> = [
    { mode:"table", icon:"☰" },
    { mode:"cards", icon:"⊞" },
  ];

  return (
    <div style={S.root}>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...S.tab, ...(tab === key ? S.tabActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ LEAVE REQUESTS TAB ══ */}
      {tab === "requests" && (
        <>
          {/* Filters */}
          <div style={S.filterBar}>
            <div style={S.searchWrap}>
              <span style={S.searchIcon}>🔍</span>
              <input
                placeholder="Search employee, leave type, reason..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                style={S.searchInput}
              />
              {search && <button onClick={() => setSearch("")} style={S.searchClear}>&#x2715;</button>}
            </div>
            <div style={S.pills}>
              {["All","Pending","Approved","Rejected"].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                  style={{ ...S.pill, background:statusFilter === s ? "#1E3A5F" : "#F3F4F6", color:statusFilter === s ? "#fff" : "#6B7280" }}>
                  {s}
                </button>
              ))}
            </div>
            <select value={leaveTypeFilter} onChange={e => { setLeaveTypeFilter(e.target.value); setCurrentPage(1); }} style={S.select}>
              <option value="All">All Types</option>
              {["Casual","Sick","Work From Home"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={S.viewToggle}>
              {VIEW_MODES.map(({ mode, icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ ...S.viewBtn, background:viewMode === mode ? "#1E3A5F" : "transparent", color:viewMode === mode ? "#fff" : "#9CA3AF" }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div style={S.resultCount}>
            Showing <strong>{filtered.length}</strong> of <strong>{leaveRequests.length}</strong> requests
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={S.empty}>
              <div style={{ fontSize:52 }}>📭</div>
              <div style={{ fontSize:20, fontWeight:800, color:"#374151", marginTop:12 }}>No requests found</div>
              <div style={{ color:"#9CA3AF", marginTop:6 }}>Try adjusting filters or search query</div>
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && filtered.length > 0 && (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr style={S.theadRow}>
                    {["Employee","Leave Type","Duration","Days","Status","Reason","Actions"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((leave, i) => {
                    const emp   = users.find(u => u.uid === leave.uid);
                    const lc    = LEAVE_COLORS[leave.leaveType] ?? LEAVE_COLORS["Casual"];
                    const sc    = STATUS_CFG[leave.status]      ?? STATUS_CFG["Pending"];
                    const days  = getDays(leave.fromDate, leave.toDate);
                    const isExp = expandedId === leave.id;
                    return (
                      <React.Fragment key={leave.id}>
                        <tr style={{ ...S.tbodyRow, background:i % 2 === 0 ? "#FAFAFA" : "#fff" }}>
                          <td style={S.td}>
                            <div style={S.empCell}>
                              <div style={S.empAvatar}>
                                {emp?.profilePhoto
                                  ? <img src={emp.profilePhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                  : <div style={S.empInitial}>{(leave.userName ?? emp?.name ?? "U")[0].toUpperCase()}</div>
                                }
                              </div>
                              <div>
                                <div style={S.empName}>{leave.userName ?? emp?.name ?? "Unknown"}</div>
                                <div style={S.empEmail}>{leave.userEmail ?? emp?.email ?? "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background:lc.bg, color:lc.text }}>
                              <span style={{ width:6, height:6, borderRadius:"50%", background:lc.dot, display:"inline-block", marginRight:5 }} />
                              {LEAVE_ICONS[leave.leaveType] ?? ""} {leave.leaveType}
                            </span>
                          </td>
                          <td style={S.td}>
                            <div style={S.durationCell}>
                              <div style={S.dateChip}>{leave.fromDate}</div>
                              <span style={{ color:"#9CA3AF", fontSize:11 }}>&#8594;</span>
                              <div style={S.dateChip}>{leave.toDate}</div>
                            </div>
                          </td>
                          <td style={S.td}><div style={S.daysChip}>{days}d</div></td>
                          <td style={S.td}>
                            <span style={{ ...S.statusBadge, background:sc.bg, color:sc.text, border:`1px solid ${sc.ring}` }}>
                              {sc.icon} {sc.label}
                            </span>
                          </td>
                          <td style={S.td}>
                            <button onClick={() => setExpandedId(isExp ? null : leave.id)}
                              style={{ ...S.reasonToggleBtn, background:isExp ? "#EEF2FF" : "#F9FAFB", color:isExp ? "#4F46E5" : "#6B7280", border:isExp ? "1.5px solid #C7D2FE" : "1.5px solid #E5E7EB" }}>
                              <span>{isExp ? "▲" : "▼"}</span>
                              <span>{isExp ? "Hide" : "View Reason"}</span>
                            </button>
                          </td>
                          <td style={{ ...S.td, textAlign:"center" }}>
                            {leave.status === "Pending" ? (
                              <div style={S.actionBtns}>
                                <button onClick={() => handleAction(leave.id, "Approved")} style={S.approveBtn}>&#10003; Approve</button>
                                <button onClick={() => handleAction(leave.id, "Rejected")} style={S.rejectBtn}>&#10005; Reject</button>
                              </div>
                            ) : <span style={{ color:"#9CA3AF", fontSize:12 }}>—</span>}
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ background:"#F5F7FF" }}>
                            <td colSpan={7} style={{ padding:0, borderBottom:"2px solid #C7D2FE" }}>
                              <div style={S.expandedPanel}>
                                <div style={S.expandedAccent} />
                                <div style={S.expandedSection}>
                                  <div style={S.expandedSectionLabel}>👤 Employee</div>
                                  <div style={S.expandedSectionValue}>{leave.userName ?? emp?.name ?? "Unknown"}</div>
                                  <div style={S.expandedSectionSub}>{leave.userEmail ?? emp?.email ?? "—"}</div>
                                </div>
                                <div style={S.expandedDivider} />
                                <div style={S.expandedSection}>
                                  <div style={S.expandedSectionLabel}>📋 Leave Type</div>
                                  <div style={{ marginTop:6 }}>
                                    <span style={{ ...S.badge, background:lc.bg, color:lc.text }}>
                                      <span style={{ width:6, height:6, borderRadius:"50%", background:lc.dot, display:"inline-block", marginRight:5 }} />
                                      {LEAVE_ICONS[leave.leaveType] ?? ""} {leave.leaveType}
                                    </span>
                                  </div>
                                </div>
                                <div style={S.expandedDivider} />
                                <div style={S.expandedSection}>
                                  <div style={S.expandedSectionLabel}>📅 Period</div>
                                  <div style={S.expandedSectionValue}>{leave.fromDate} &#8594; {leave.toDate}</div>
                                  <div style={S.expandedSectionSub}>{days} {days === 1 ? "day" : "days"} total</div>
                                </div>
                                <div style={S.expandedDivider} />
                                <div style={{ ...S.expandedSection, flex:1 }}>
                                  <div style={S.expandedSectionLabel}>📝 Full Reason</div>
                                  <div style={S.expandedReasonText}>{leave.reason ?? "No reason provided."}</div>
                                </div>
                                <div style={S.expandedDivider} />
                                <div style={{ ...S.expandedSection, justifyContent:"space-between", gap:12 }}>
                                  <div>
                                    <div style={S.expandedSectionLabel}>🔖 Status</div>
                                    <span style={{ ...S.statusBadge, background:sc.bg, color:sc.text, border:`1px solid ${sc.ring}`, marginTop:6, display:"inline-block" }}>
                                      {sc.icon} {sc.label}
                                    </span>
                                  </div>
                                  <button onClick={() => setExpandedId(null)} style={S.collapseBtn}>&#x2715; Close</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Card View */}
          {viewMode === "cards" && filtered.length > 0 && (
            <div style={S.cardsGrid}>
              {paginated.map(leave => {
                const emp    = users.find(u => u.uid === leave.uid);
                const lc     = LEAVE_COLORS[leave.leaveType] ?? LEAVE_COLORS["Casual"];
                const sc     = STATUS_CFG[leave.status]      ?? STATUS_CFG["Pending"];
                const days   = getDays(leave.fromDate, leave.toDate);
                const isExp  = expandedId === leave.id;
                const reason = leave.reason ?? "No reason.";
                return (
                  <div key={leave.id} style={{ ...S.leaveCard, borderTop:`4px solid ${lc.dot}` }}>
                    <div style={S.cardHeader}>
                      <div style={S.empCell}>
                        <div style={S.empAvatar}>
                          {emp?.profilePhoto
                            ? <img src={emp.profilePhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                            : <div style={S.empInitial}>{(leave.userName ?? emp?.name ?? "U")[0].toUpperCase()}</div>
                          }
                        </div>
                        <div>
                          <div style={S.empName}>{leave.userName ?? emp?.name ?? "Unknown"}</div>
                          <div style={S.empEmail}>{leave.userEmail ?? emp?.email ?? "—"}</div>
                        </div>
                      </div>
                      <span style={{ ...S.statusBadge, background:sc.bg, color:sc.text, border:`1px solid ${sc.ring}` }}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <div style={S.cardBody}>
                      <span style={{ ...S.badge, background:lc.bg, color:lc.text }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:lc.dot, display:"inline-block", marginRight:5 }} />
                        {LEAVE_ICONS[leave.leaveType] ?? ""} {leave.leaveType}
                      </span>
                      <span style={S.daysChip}>{days} {days === 1 ? "day" : "days"}</span>
                    </div>
                    <div style={S.cardDates}>📅 {leave.fromDate} &#8594; {leave.toDate}</div>
                    <div style={S.cardReason} onClick={() => setExpandedId(isExp ? null : leave.id)}>
                      <div style={S.cardReasonLabel}>📝 Reason</div>
                      <div style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>
                        {isExp ? reason : reason.slice(0, 80) + (reason.length > 80 ? "…" : "")}
                      </div>
                      {reason.length > 80 && (
                        <div style={{ fontSize:11, color:"#6366F1", fontWeight:600, marginTop:4 }}>
                          {isExp ? "▲ Show less" : "▼ Read full reason"}
                        </div>
                      )}
                    </div>
                    {leave.status === "Pending" && (
                      <div style={S.cardActions}>
                        <button onClick={() => handleAction(leave.id, "Approved")} style={S.approveBtn}>&#10003; Approve</button>
                        <button onClick={() => handleAction(leave.id, "Rejected")} style={S.rejectBtn}>&#10005; Reject</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={S.pagination}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ ...S.pageBtn, opacity:currentPage === 1 ? 0.4 : 1 }}>&#8592; Prev</button>
              <div style={S.pageNumbers}>
                {Array.from({ length:totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setCurrentPage(n)}
                    style={{ ...S.pageNum, background:currentPage === n ? "#1E3A5F" : "#F3F4F6", color:currentPage === n ? "#fff" : "#6B7280" }}>{n}</button>
                ))}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ ...S.pageBtn, opacity:currentPage === totalPages ? 0.4 : 1 }}>Next &#8594;</button>
            </div>
          )}
        </>
      )}

      {/* ══ HOLIDAY CALENDAR TAB ══ */}
      {tab === "holidays" && (
        <div style={{ background:"#fff", borderRadius:20, padding:28, boxShadow:"0 4px 24px #0000000F" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#111827", marginBottom:20 }}>🗓️ Holiday Calendar &amp; Employee Leaves</div>
          <AdminHolidayCalendar holidays={holidays} leaveRequests={leaveRequests} users={users} />
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={S.modalIcon}>{confirmAction.action === "Approved" ? "✅" : "❌"}</div>
            <div style={S.modalTitle}>{confirmAction.action === "Approved" ? "Approve Leave?" : "Reject Leave?"}</div>
            <div style={S.modalSub}>This action will update the leave status immediately.</div>
            <div style={S.modalBtns}>
              <button onClick={() => setConfirmAction(null)} style={S.modalCancel}>Cancel</button>
              <button onClick={confirmDo}
                style={{ ...S.modalConfirm, background:confirmAction.action === "Approved" ? "#16A34A" : "#DC2626" }}>
                Confirm {confirmAction.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:                { fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:1100, margin:"0 auto", padding:24, background:"#F8FAFC", minHeight:"100vh" },
  tab:                 { padding:"10px 20px", borderRadius:12, border:"2px solid #E5E7EB", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#6B7280" },
  tabActive:           { background:"#1E3A5F", color:"#fff", border:"2px solid #1E3A5F" },
  filterBar:           { background:"#fff", borderRadius:14, padding:"14px 18px", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", boxShadow:"0 2px 12px #0000000D", marginBottom:16 },
  searchWrap:          { flex:1, minWidth:220, position:"relative", display:"flex", alignItems:"center" },
  searchIcon:          { position:"absolute", left:12, fontSize:14 },
  searchInput:         { width:"100%", paddingLeft:36, paddingRight:32, paddingTop:9, paddingBottom:9, border:"1.5px solid #E5E7EB", borderRadius:10, fontSize:13, outline:"none", boxSizing:"border-box" },
  searchClear:         { position:"absolute", right:10, background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#9CA3AF" },
  pills:               { display:"flex", gap:6 },
  pill:                { border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
  select:              { border:"1.5px solid #E5E7EB", borderRadius:10, padding:"8px 12px", fontSize:13, outline:"none", cursor:"pointer" },
  viewToggle:          { display:"flex", background:"#F3F4F6", borderRadius:8, overflow:"hidden" },
  viewBtn:             { border:"none", padding:"8px 12px", cursor:"pointer", fontSize:15, transition:"all 0.15s" },
  resultCount:         { fontSize:13, color:"#6B7280", marginBottom:12 },
  empty:               { textAlign:"center", padding:"80px 0", background:"#fff", borderRadius:16 },
  tableWrap:           { background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px #0000000D" },
  table:               { width:"100%", borderCollapse:"collapse" },
  theadRow:            { background:"#1E3A5F" },
  th:                  { padding:"14px 18px", textAlign:"left", fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.85)", textTransform:"uppercase", letterSpacing:0.7 },
  tbodyRow:            { transition:"background 0.15s" },
  td:                  { padding:"14px 18px", verticalAlign:"middle" },
  empCell:             { display:"flex", alignItems:"center", gap:10 },
  empAvatar:           { width:38, height:38, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:"#E5E7EB" },
  empInitial:          { width:"100%", height:"100%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15 },
  empName:             { fontSize:13, fontWeight:700, color:"#111827" },
  empEmail:            { fontSize:11, color:"#9CA3AF", marginTop:1 },
  badge:               { display:"inline-flex", alignItems:"center", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700 },
  durationCell:        { display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" },
  dateChip:            { background:"#F3F4F6", borderRadius:6, padding:"3px 7px", fontSize:11, color:"#374151", fontWeight:500 },
  daysChip:            { background:"#EEF2FF", color:"#4F46E5", borderRadius:8, padding:"3px 10px", fontSize:12, fontWeight:700, display:"inline-block" },
  statusBadge:         { borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, whiteSpace:"nowrap" },
  reasonToggleBtn:     { display:"inline-flex", alignItems:"center", gap:5, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
  expandedPanel:       { display:"flex", flexDirection:"row", alignItems:"stretch", minHeight:90, borderTop:"1px solid #C7D2FE" },
  expandedAccent:      { width:5, background:"linear-gradient(180deg,#6366F1,#8B5CF6)", flexShrink:0 },
  expandedSection:     { display:"flex", flexDirection:"column", justifyContent:"center", padding:"14px 22px", minWidth:140 },
  expandedSectionLabel:{ fontSize:10, fontWeight:700, color:"#6366F1", textTransform:"uppercase", letterSpacing:0.8, marginBottom:5 },
  expandedSectionValue:{ fontSize:13, fontWeight:700, color:"#111827" },
  expandedSectionSub:  { fontSize:11, color:"#9CA3AF", marginTop:2 },
  expandedDivider:     { width:1, background:"#E0E7FF", flexShrink:0, margin:"10px 0" },
  expandedReasonText:  { fontSize:13, color:"#1E293B", lineHeight:1.7, marginTop:2 },
  collapseBtn:         { marginTop:8, background:"#EEF2FF", color:"#4F46E5", border:"1.5px solid #C7D2FE", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  actionBtns:          { display:"flex", gap:6, justifyContent:"center" },
  approveBtn:          { background:"#16A34A", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" },
  rejectBtn:           { background:"#DC2626", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" },
  cardsGrid:           { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 },
  leaveCard:           { background:"#fff", borderRadius:16, padding:20, boxShadow:"0 2px 12px #0000000D" },
  cardHeader:          { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 },
  cardBody:            { display:"flex", gap:8, alignItems:"center", marginBottom:10 },
  cardDates:           { fontSize:12, color:"#6B7280", marginBottom:12 },
  cardReason:          { background:"#F9FAFB", borderRadius:10, padding:"12px 14px", cursor:"pointer", marginBottom:12 },
  cardReasonLabel:     { fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", marginBottom:5 },
  cardActions:         { display:"flex", gap:8 },
  pagination:          { display:"flex", justifyContent:"center", alignItems:"center", gap:12, marginTop:24 },
  pageBtn:             { background:"#1E3A5F", color:"#fff", border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  pageNumbers:         { display:"flex", gap:6 },
  pageNum:             { border:"none", borderRadius:8, width:36, height:36, fontSize:13, fontWeight:600, cursor:"pointer" },
  modalOverlay:        { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 },
  modal:               { background:"#fff", borderRadius:20, padding:36, maxWidth:380, width:"90%", textAlign:"center", boxShadow:"0 20px 60px #00000033" },
  modalIcon:           { fontSize:48, marginBottom:12 },
  modalTitle:          { fontSize:22, fontWeight:800, color:"#111827", marginBottom:8 },
  modalSub:            { fontSize:14, color:"#6B7280", marginBottom:24 },
  modalBtns:           { display:"flex", gap:12, justifyContent:"center" },
  modalCancel:         { background:"#F3F4F6", color:"#374151", border:"none", borderRadius:10, padding:"11px 24px", fontSize:14, fontWeight:600, cursor:"pointer" },
  modalConfirm:        { color:"#fff", border:"none", borderRadius:10, padding:"11px 24px", fontSize:14, fontWeight:700, cursor:"pointer" },
};