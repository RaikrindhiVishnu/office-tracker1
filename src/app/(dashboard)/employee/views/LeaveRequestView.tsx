"use client";

import { useState, useMemo } from "react";
import { LeaveType } from "@/types/leave";

// ─── LOP REMOVED ─────────────────────────────────────────
const LEAVE_COLORS: Record<LeaveType, { bg: string; text: string; dot: string }> = {
  Casual:           { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  Sick:             { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "Work From Home": { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const LEAVE_ICONS: Record<string, string> = {
  Casual: "🌴",
  Sick: "🤒",
  "Work From Home": "🏠",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string; icon: string }> = {
  Pending:  { bg: "#FFFBEB", text: "#92400E", ring: "#F59E0B", icon: "⏳" },
  Approved: { bg: "#F0FDF4", text: "#14532D", ring: "#22C55E", icon: "✅" },
  Rejected: { bg: "#FFF1F2", text: "#881337", ring: "#F43F5E", icon: "❌" },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const SHORT_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ─── TYPES ────────────────────────────────────────────────
interface Holiday {
  date: string;       // "YYYY-MM-DD"
  name: string;
  type: "national" | "optional";
}

interface LeaveRecord {
  id: string;
  leaveType: LeaveType;   // ✅ correct
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  adminNote?: string;
}

interface BalanceItem {
  type: string;
  icon: string;
  remaining: number;
  total: number;
}

// ─── DEMO DATA ────────────────────────────────────────────
const DEMO_BALANCE: BalanceItem[] = [
  { type: "Casual",          icon: "🌴", remaining: 8,  total: 12 },
  { type: "Sick",            icon: "🤒", remaining: 5,  total: 8  },
  { type: "Work From Home",  icon: "🏠", remaining: 10, total: 15 },
];

const DEMO_LEAVES: LeaveRecord[] = [
  { id: "1", leaveType: "Casual",         fromDate: "2025-06-10", toDate: "2025-06-12", reason: "Family vacation to Goa.",          status: "Approved", adminNote: "Approved. Enjoy!" },
  { id: "2", leaveType: "Sick",           fromDate: "2025-07-03", toDate: "2025-07-04", reason: "High fever and body ache.",         status: "Pending"  },
  { id: "3", leaveType: "Work From Home", fromDate: "2025-07-15", toDate: "2025-07-17", reason: "Home renovation in progress.",      status: "Approved" },
  { id: "4", leaveType: "Casual",         fromDate: "2025-08-01", toDate: "2025-08-01", reason: "Personal errand at govt. office.",  status: "Rejected", adminNote: "Not available this month." },
];

// Holidays — in real usage pass these from Firestore via props
const DEMO_HOLIDAYS: Holiday[] = [
  { date: "2025-01-14", name: "Makar Sankranti",     type: "national"  },
  { date: "2025-01-26", name: "Republic Day",         type: "national"  },
  { date: "2025-03-17", name: "Holi",                 type: "national"  },
  { date: "2025-04-14", name: "Dr. Ambedkar Jayanti", type: "optional"  },
  { date: "2025-04-18", name: "Good Friday",          type: "national"  },
  { date: "2025-05-12", name: "Buddha Purnima",       type: "optional"  },
  { date: "2025-06-07", name: "Eid ul-Adha",          type: "national"  },
  { date: "2025-07-06", name: "Bonalu",                type: "optional"  },
  { date: "2025-08-15", name: "Independence Day",     type: "national"  },
  { date: "2025-08-16", name: "Raksha Bandhan",       type: "optional"  },
  { date: "2025-08-27", name: "Janmashtami",          type: "national"  },
  { date: "2025-09-05", name: "Ganesh Chaturthi",     type: "national"  },
  { date: "2025-10-02", name: "Gandhi Jayanti",       type: "national"  },
  { date: "2025-10-02", name: "Dussehra",             type: "national"  },
  { date: "2025-10-20", name: "Diwali",               type: "national"  },
  { date: "2025-10-21", name: "Diwali (Laxmi Puja)", type: "national"  },
  { date: "2025-11-05", name: "Bhai Dooj",            type: "optional"  },
  { date: "2025-11-15", name: "Guru Nanak Jayanti",   type: "national"  },
  { date: "2025-12-25", name: "Christmas",            type: "national"  },
];

// ─── HELPERS ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ══════════════════════════════════════════════════════════
//  HOLIDAY CALENDAR (monthly view)
// ══════════════════════════════════════════════════════════
function HolidayCalendar({ holidays }: { holidays: Holiday[] }) {
  const now   = new Date();
  const [month, setMonth] = useState(now.getMonth());   // 0-indexed
  const [year,  setYear]  = useState(now.getFullYear());
  const today  = todayStr();

  // Group holidays by "YYYY-MM"
  const byMonth = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    holidays.forEach(h => {
      const k = h.date.slice(0, 7);
      if (!map[k]) map[k] = [];
      map[k].push(h);
    });
    return map;
  }, [holidays]);

  const monthKey    = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthHols   = byMonth[monthKey] ?? [];
  const holSet      = new Set(monthHols.map(h => h.date));

  const firstDayDow = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y+1); } else setMonth(m => m+1); };

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
      </div>

      {/* Month navigator */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <button onClick={prev} style={navBtnStyle}>‹</button>
        <span style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={next} style={navBtnStyle}>›</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* ── Mini Calendar ── */}
        <div style={{ background:"#f8fafc", borderRadius:14, padding:14, border:"1px solid #e2e8f0" }}>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
            {SHORT_DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#94a3b8", padding:"3px 0" }}>{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {Array.from({ length: firstDayDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const ds    = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isHol = holSet.has(ds);
              const isTdy = ds === today;
              const dow   = new Date(year, month, day).getDay();
              const isWkd = dow === 0 || dow === 6;
              return (
                <div key={day} title={isHol ? monthHols.filter(h=>h.date===ds).map(h=>h.name).join(", ") : ""} style={{
                  textAlign:"center", padding:"5px 2px", borderRadius:7, fontSize:12, fontWeight: isHol||isTdy ? 800 : 400,
                  background: isTdy ? "#1E3A5F" : isHol ? "#fef9c3" : "transparent",
                  color: isTdy ? "#fff" : isHol ? "#92400e" : isWkd ? "#ef4444" : "#334155",
                  cursor: isHol ? "default" : "default",
                  position:"relative",
                }}>
                  {day}
                  {isHol && !isTdy && (
                    <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"#f59e0b" }} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
            {[
              { label:"Today",   box:"#1E3A5F", fg:"#fff" },
              { label:"Holiday", box:"#fef9c3", fg:"#92400e" },
              { label:"Weekend", box:"transparent", fg:"#ef4444", border:"1px solid #fca5a5" },
            ].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:l.box, border:l.border||"none" }} />
                <span style={{ color:"#64748b", fontWeight:600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Holiday list for month ── */}
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:"#0f172a", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            {MONTH_NAMES[month]} Holidays
            {monthHols.length > 0 && (
              <span style={{ background:"#fef9c3", color:"#92400e", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                {monthHols.length}
              </span>
            )}
          </div>

          {monthHols.length === 0 ? (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#94a3b8", fontSize:13, background:"#f8fafc", borderRadius:12, border:"1px dashed #e2e8f0" }}>
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
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"10px 12px", borderRadius:12,
                    background: past ? "#f8fafc" : "#fffbeb",
                    border:`1px solid ${past ? "#e2e8f0" : "#fcd34d"}`,
                    opacity: past ? 0.6 : 1,
                  }}>
                    {/* Date box */}
                    <div style={{
                      width:42, height:42, borderRadius:10, flexShrink:0,
                      background: past ? "#e2e8f0" : "#1E3A5F",
                      color: past ? "#64748b" : "#fff",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center", lineHeight:1.2,
                    }}>
                      <span style={{ fontSize:15, fontWeight:900 }}>{dayN}</span>
                      <span style={{ fontSize:9,  fontWeight:600, opacity:0.8 }}>{dow}</span>
                    </div>
                    {/* Name */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {h.name}
                      </div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                        {MONTH_NAMES[month]} {dayN}, {year}
                      </div>
                    </div>
                    {/* Type */}
                    <span style={{
                      fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, flexShrink:0,
                      background: h.type==="national" ? "#dcfce7" : "#eff6ff",
                      color:      h.type==="national" ? "#166534"  : "#1d4ed8",
                    }}>
                      {h.type === "national" ? "National" : "Optional"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Month quick-jump row ── */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:16 }}>
        {MONTH_NAMES.map((name, i) => {
          const k     = `${year}-${String(i+1).padStart(2,"0")}`;
          const count = (byMonth[k] ?? []).length;
          const sel   = i === month;
          return (
            <button key={name} onClick={() => setMonth(i)} style={{
              padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:700,
              border:"none", cursor:"pointer", position:"relative",
              background: sel ? "#1E3A5F" : count > 0 ? "#fef9c3" : "#f1f5f9",
              color:      sel ? "#fff"    : count > 0 ? "#92400e" : "#64748b",
            }}>
              {name.slice(0,3)}
              {count > 0 && !sel && (
                <span style={{
                  position:"absolute", top:-5, right:-5,
                  width:15, height:15, borderRadius:"50%",
                  background:"#f59e0b", color:"#fff",
                  fontSize:8, fontWeight:900,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width:32, height:32, borderRadius:8,
  border:"1px solid #e2e8f0", background:"#fff",
  cursor:"pointer", fontSize:18, fontWeight:700,
  color:"#334155", display:"flex", alignItems:"center", justifyContent:"center",
};


export default function LeaveRequestView({
  leaveType = "Casual" as LeaveType,
 setLeaveType = (() => {}) as (v: LeaveType) => void,
  fromDate = "",
  setFromDate = (_: string) => {},
  toDate = "",
  setToDate = (_: string) => {},
  leaveReason = "",
  setLeaveReason = (_: string) => {},
  handleSubmitLeave = () => {},
  submitting = false,
  leaveMsg = "",
  myLeaves = DEMO_LEAVES as LeaveRecord[],
  leaveBalance = DEMO_BALANCE as BalanceItem[],
  holidays = DEMO_HOLIDAYS as Holiday[],
}) {
  const [tab,           setTab]           = useState<"apply"|"history"|"holidays">("apply");
  const [historyFilter, setHistoryFilter] = useState("All");
  const [expandedId,    setExpandedId]    = useState<string|null>(null);

  const days = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const diff = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000;
    return diff >= 0 ? diff + 1 : 0;
  }, [fromDate, toDate]);

  const filtered = useMemo(() =>
    myLeaves.filter(l => historyFilter === "All" || l.status === historyFilter),
    [myLeaves, historyFilter]
  );

  // Next upcoming holiday (for hero)
  const today   = todayStr();
  const nextHol = holidays.filter(h => h.date >= today)[0];

  return (
    <div style={S.root}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
  {/* <div>
    <div style={{ fontSize:24, fontWeight:800, color:"#0f172a", letterSpacing:-0.5 }}>Leave Portal</div>
    <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>Manage & track your leave requests</div>
  </div> */}
  {nextHol && (
    <div style={{ background:"#fff", borderRadius:12, padding:"10px 16px", border:"1px solid #e2e8f0", boxShadow:"0 2px 8px #0000000D", textAlign:"right" }}>
      <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Next Holiday</div>
      <div style={{ fontSize:14, color:"#0f172a", fontWeight:800, marginTop:2 }}>{nextHol.name}</div>
      <div style={{ fontSize:11, color:"#64748b", marginTop:1 }}>{nextHol.date}</div>
    </div>
  )}
</div>

      {/* ── BALANCE CARDS ────────────────────────────────── */}
      {/* <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
        {leaveBalance.map(b => (
          <div key={b.type} style={{ ...S.balCard, borderTopColor: LEAVE_COLORS[b.type]?.dot ?? "#6366F1" }}>
            <div style={{ fontSize:26, marginBottom:6 }}>{b.icon}</div>
            <div style={{ fontSize:32, fontWeight:800, color:"#111827", lineHeight:1 }}>{b.remaining}</div>
            <div style={{ fontSize:12, fontWeight:600, color:"#6B7280", marginTop:4, marginBottom:10 }}>
              {b.type === "Work From Home" ? "WFH" : b.type}
            </div>
            <div style={S.bar}>
              <div style={{ ...S.fill, width:`${Math.min((b.remaining/b.total)*100,100)}%`, background: LEAVE_COLORS[b.type]?.dot ?? "#6366F1" }} />
            </div>
            <div style={{ fontSize:11, color:"#9CA3AF" }}>{b.remaining}/{b.total} days</div>
          </div>
        ))}
      </div> */}

      {/* ── TABS ─────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {([
          ["apply",    "✏️ Apply for Leave"],
          ["history",  "📋 My Leave History"],
          ["holidays", "🗓️ Holiday Calendar"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...S.tab, ...(tab === key ? S.tabActive : {}),
          }}>{label}</button>
        ))}
      </div>

      {/* ── APPLY TAB ────────────────────────────────────── */}
      {tab === "apply" && (
        <div style={S.card}>
          {/* <div style={S.cardTitle}>📝 New Leave Application</div> */}

          <label style={S.label}>Leave Type</label>
          {/* 3 columns — LOP removed */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {(Object.keys(LEAVE_COLORS) as LeaveType[]).map(type => {
              const c   = LEAVE_COLORS[type];
              const sel = leaveType === type;
              return (
                <button key={type} onClick={() => setLeaveType(type as LeaveType)} style={{
                  padding:"14px 8px", borderRadius:12, cursor:"pointer",
                  fontSize:13, fontWeight:600,
                  display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                  transition:"all 0.2s",
                  background: sel ? c.dot    : "#F9FAFB",
                  color:      sel ? "#fff"   : "#374151",
                  border:     `2px solid ${sel ? c.dot : "#E5E7EB"}`,
                  transform:  sel ? "translateY(-2px)" : "none",
                  boxShadow:  sel ? `0 6px 20px ${c.dot}55` : "none",
                }}>
                  <span style={{ fontSize:22 }}>{LEAVE_ICONS[type]}</span>
                  <span>{type === "Work From Home" ? "WFH" : type}</span>
                </button>
              );
            })}
          </div>

          {leaveType === "Work From Home" && (
            <div style={{ background:"#F0FDF4", border:"1.5px solid #BBF7D0", borderRadius:12, padding:"14px 16px", display:"flex", gap:12, color:"#15803D", fontSize:13, marginTop:12 }}>
              <span style={{ fontSize:20 }}>🏠</span>
              <div>
                <strong>Work From Home Mode</strong>
                <div style={{ fontSize:12, marginTop:3 }}>
                  Once approved, you can log in from any location — no office presence needed.
                </div>
              </div>
            </div>
          )}

          {/* Dates */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"end", marginTop:4 }}>
            <div>
              <label style={S.label}>📅 From Date</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={S.input} />
            </div>
            <div style={{ fontSize:20, color:"#9CA3AF", paddingBottom:8, textAlign:"center" }}>→</div>
            <div>
              <label style={S.label}>📅 To Date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={S.input} />
            </div>
          </div>

          {days > 0 && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#EFF6FF", color:"#1D4ED8", border:"1.5px solid #BFDBFE", borderRadius:20, padding:"6px 16px", fontSize:13, marginTop:12 }}>
              🗓️ <strong>{days} {days===1?"day":"days"}</strong> of {leaveType} leave
            </div>
          )}

          {/* Reason */}
          <label style={S.label}>📝 Reason for Leave</label>
          <div style={{ position:"relative" }}>
            <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
              rows={5} placeholder="Describe your reason in detail..."
              style={{ ...S.input, resize:"vertical", fontFamily:"inherit", lineHeight:1.6 }} />
            <div style={{ position:"absolute", bottom:10, right:12, fontSize:11, color:"#9CA3AF" }}>{leaveReason.length} chars</div>
          </div>

          <button onClick={handleSubmitLeave} disabled={submitting} style={{
            width:"100%", marginTop:20,
            background:"linear-gradient(135deg,#1E3A5F,#2D6A9F)",
            color:"#fff", border:"none", borderRadius:14,
            padding:"15px 24px", fontSize:15, fontWeight:700,
            cursor: submitting?"not-allowed":"pointer",
            opacity: submitting ? 0.6 : 1,
            boxShadow:"0 6px 20px #1E3A5F44",
          }}>
            {submitting ? "⏳ Submitting..." : "🚀 Submit Leave Request"}
          </button>

          {leaveMsg && (
            <div style={{
              marginTop:14, borderRadius:10, padding:"12px 16px", fontSize:13, fontWeight:500,
              border:"1.5px solid", textAlign:"center",
              background:   leaveMsg.toLowerCase().includes("success") ? "#F0FDF4" : "#FFF1F2",
              color:        leaveMsg.toLowerCase().includes("success") ? "#15803D" : "#BE123C",
              borderColor:  leaveMsg.toLowerCase().includes("success") ? "#BBF7D0" : "#FECDD3",
            }}>{leaveMsg}</div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────── */}
      {tab === "history" && (
        <div style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div style={S.cardTitle}>📋 Leave History</div>
            <div style={{ display:"flex", gap:6 }}>
              {["All","Pending","Approved","Rejected"].map(s => (
                <button key={s} onClick={() => setHistoryFilter(s)} style={{
                  border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer",
                  background: historyFilter===s ? "#1E3A5F" : "#F3F4F6",
                  color:      historyFilter===s ? "#fff"    : "#6B7280",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0" }}>
              <div style={{ fontSize:48 }}>📭</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#374151", marginTop:12 }}>No requests found</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(leave => {
                const lc  = LEAVE_COLORS[leave.leaveType] ?? LEAVE_COLORS.Casual;
                const sc  = STATUS_STYLES[leave.status]   ?? STATUS_STYLES.Pending;
                const exp = expandedId === leave.id;
                return (
                  <div key={leave.id} style={{ background:"#FAFAFA", borderRadius:12, border:"1px solid #E5E7EB", overflow:"hidden", borderLeft:`4px solid ${lc.dot}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", cursor:"pointer" }}
                      onClick={() => setExpandedId(exp ? null : leave.id)}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ background:lc.bg, color:lc.text, borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
                          {leave.leaveType}
                        </span>
                        <span style={{ fontSize:13, color:"#374151", fontWeight:500 }}>
                          {leave.fromDate} → {leave.toDate}
                        </span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ background:sc.bg, color:sc.text, border:`1px solid ${sc.ring}`, borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
                          {sc.icon} {leave.status}
                        </span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>{exp?"▲":"▼"}</span>
                      </div>
                    </div>
                    {exp && (
                      <div style={{ padding:"0 18px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                        <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:10, padding:"12px 14px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", marginBottom:6 }}>📝 Reason</div>
                          <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>{leave.reason || "No reason provided."}</div>
                        </div>
                        {leave.adminNote && (
                          <div style={{ background:"#F0F9FF", border:"1px solid #BAE6FD", borderRadius:10, padding:"12px 14px" }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"#0369A1", textTransform:"uppercase", marginBottom:6 }}>💬 Admin Note</div>
                            <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>{leave.adminNote}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HOLIDAYS TAB ─────────────────────────────────── */}
      {tab === "holidays" && (
        <div style={S.card}>
          <div style={S.cardTitle}>🗓️ Company Holiday Calendar</div>
          <HolidayCalendar holidays={holidays} />
        </div>
      )}

    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:     { fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:820, margin:"0 auto", padding:24, background:"#F8FAFC", minHeight:"100vh" },
  hero:     { background:"linear-gradient(135deg,#1E3A5F 0%,#2D6A9F 100%)", borderRadius:20, padding:"28px 32px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, boxShadow:"0 8px 32px #1E3A5F44" },
  avatarRing: { width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" },
  heroName: { fontSize:22, fontWeight:800, color:"#fff", letterSpacing:-0.5 },
  heroSub:  { fontSize:13, color:"rgba(255,255,255,0.72)", marginTop:2 },
  balCard:  { background:"#fff", borderRadius:16, padding:"18px 16px", borderTop:"4px solid #6366F1", boxShadow:"0 2px 12px #0000000D", textAlign:"center" },
  bar:      { height:5, background:"#F3F4F6", borderRadius:10, overflow:"hidden", marginBottom:6 },
  fill:     { height:"100%", borderRadius:10, transition:"width 0.6s ease" },
  tab:      { padding:"10px 20px", borderRadius:12, border:"2px solid #E5E7EB", background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", color:"#6B7280" },
  tabActive:{ background:"#1E3A5F", color:"#fff", border:"2px solid #1E3A5F" },
  card:     { background:"#fff", borderRadius:20, padding:28, boxShadow:"0 4px 24px #0000000F" },
  cardTitle:{ fontSize:18, fontWeight:800, color:"#111827", marginBottom:20 },
  label:    { display:"block", fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8, marginTop:16 },
  input:    { border:"2px solid #E5E7EB", borderRadius:10, padding:"10px 14px", fontSize:14, width:"100%", outline:"none", boxSizing:"border-box" },
};