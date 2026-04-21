"use client";

import { useState, useMemo, useEffect } from "react";
import {
  collection, query, where, onSnapshot, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeaveType } from "@/types/leave";

// ─── CONSTANTS ────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const SHORT_DOW  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const LEAVE_META: Record<string, {
  dot: string; bg: string; text: string; icon: string; label: string; barColor: string;
}> = {
  annual:           { dot:"#06B6D4", bg:"#ecfeff", text:"#0e7490", icon:"📅",    label:"Annual",  barColor:"#06B6D4" },
  casual:           { dot:"#3B82F6", bg:"#eff6ff", text:"#1d4ed8", icon:"🧑🏻‍💻", label:"Casual",  barColor:"#f59e0b" },
  sick:             { dot:"#F97316", bg:"#fff7ed", text:"#c2410c", icon:"🤒",    label:"Sick",    barColor:"#22C55E" },
  "Work From Home": { dot:"#22C55E", bg:"#f0fdf4", text:"#15803d", icon:"🏠",    label:"WFH",     barColor:"#ef4444" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  Pending:  { bg:"#FFFBEB", text:"#92400E", ring:"#F59E0B" },
  Approved: { bg:"#F0FDF4", text:"#14532D", ring:"#22C55E" },
  Rejected: { bg:"#FFF1F2", text:"#881337", ring:"#F43F5E" },
};

// ─── TYPES ────────────────────────────────────────────────
type NavView = "apply" | "history" | "holidays";

interface Holiday {
  date: string;
  name: string;
  type: "national" | "optional";
}

interface LeaveRecord {
  id: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  adminNote?: string;
  days?: number;
  createdAt?: any;
}

interface BalanceItem {
  type: string;
  icon: string;
  label: string;
  remaining: number;
  total: number;
  barColor: string;
}

// ─── STATIC HOLIDAYS 2026 ─────────────────────────────────
// Declared after Holiday interface so TypeScript is satisfied
const STATIC_HOLIDAYS: Holiday[] = [
  { date:"2026-01-01", name:"New Year's Day",           type:"national" },
  { date:"2026-01-14", name:"Makar Sankranti / Pongal", type:"national" },
  { date:"2026-01-26", name:"Republic Day",             type:"national" },
  { date:"2026-03-20", name:"Ugadi",                    type:"national" },
  { date:"2026-03-25", name:"Holi",                     type:"national" },
  { date:"2026-08-15", name:"Independence Day",         type:"national" },
  { date:"2026-08-28", name:"Raksha Bandhan",           type:"national" },
  { date:"2026-09-14", name:"Ganesh Chaturthi",         type:"national" },
  { date:"2026-10-02", name:"Gandhi Jayanti",           type:"national" },
  { date:"2026-10-20", name:"Dussehra",                 type:"national" },
  { date:"2026-11-08", name:"Diwali",                   type:"national" },
  { date:"2026-12-25", name:"Christmas Day",            type:"national" },
];

// ─── HELPERS ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Parse "YYYY-MM-DD" safely using local constructor — avoids NaN from string parsing */
function parseDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// ══════════════════════════════════════════════════════════
// MINI CALENDAR
// ══════════════════════════════════════════════════════════
function MiniCalendar({ holidays, compact = false }: { holidays: Holiday[]; compact?: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const today = todayStr();

  const monthKey  = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthHols = holidays.filter(h => h.date.startsWith(monthKey));
  const holSet    = new Set(monthHols.map(h => h.date));
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month+1, 0).getDate();

  const prev = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prev} style={calNavBtn}>‹</button>
        <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>
          {MONTH_NAMES[month].slice(0,3)} {year}
        </span>
        <button onClick={next} style={calNavBtn}>›</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
        {SHORT_DAYS.map(d => (
          <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:"#94a3b8", padding:"2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array.from({length:firstDow}).map((_,i) => <div key={`e${i}`}/>)}
        {Array.from({length:daysInMon},(_,i)=>i+1).map(day => {
          const ds  = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isT = ds === today;
          const isH = holSet.has(ds);
          const dow = new Date(year, month, day).getDay();
          const isW = dow===0||dow===6;
          return (
            <div key={day} style={{
              textAlign:"center", padding:"5px 2px", borderRadius:6, fontSize:11,
              fontWeight: isT||isH ? 700 : 400,
              background: isT?"#1E3A5F":isH?"#fef9c3":"transparent",
              color: isT?"#fff":isH?"#92400e":isW?"#ef4444":"#334155",
              cursor:"default",
            }}>
              {day}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:5, maxHeight:compact?120:200, overflowY:"auto" }}>
        {monthHols.length===0 ? (
          <p style={{ fontSize:11, color:"#94a3b8", textAlign:"center", margin:0 }}>No holidays this month</p>
        ) : monthHols.map((h, i) => {
          const d   = parseDate(h.date);
          const past = h.date < today;
          return (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:8, padding:"6px 8px",
              borderRadius:7, background:"#f8fafc",
              border:"0.5px solid #e2e8f0", opacity:past?0.55:1,
            }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#0f172a", minWidth:32 }}>
                {String(d.getDate())} {SHORT_DOW[d.getDay()] ?? ""}
              </span>
              <span style={{ fontSize:11, color:"#64748b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {h.name}
              </span>
              <span style={{
                fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:99, flexShrink:0,
                background:h.type==="national"?"#dcfce7":"#eff6ff",
                color:     h.type==="national"?"#166534":"#1d4ed8",
              }}>
                {h.type==="national"?"Nat":"Opt"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const calNavBtn: React.CSSProperties = {
  width:24, height:24, borderRadius:6,
  border:"0.5px solid #e2e8f0", background:"#f8fafc",
  cursor:"pointer", fontSize:13, fontWeight:700, color:"#334155",
  display:"flex", alignItems:"center", justifyContent:"center",
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function LeaveRequestView({
  user,
  leaveType,    setLeaveType,
  fromDate,     setFromDate,
  toDate,       setToDate,
  leaveReason,  setLeaveReason,
  handleSubmitLeave,
  submitting,
  leaveMsg,
}: {
  user: any;
  leaveType: LeaveType;        setLeaveType:   (v: LeaveType) => void;
  fromDate: string;            setFromDate:    (v: string)   => void;
  toDate: string;              setToDate:      (v: string)   => void;
  leaveReason: string;         setLeaveReason: (v: string)   => void;
  handleSubmitLeave: () => void;
  submitting: boolean;
  leaveMsg: string;
}) {
  const [view,          setView]          = useState<NavView>("apply");
  const [historyFilter, setHistoryFilter] = useState("All");
  const [myLeaves,      setMyLeaves]      = useState<LeaveRecord[]>([]);
  const [leaveBalance,  setLeaveBalance]  = useState<BalanceItem[]>([]);
  const [dataLoading,   setDataLoading]   = useState(true);

  // holidays are static — no state needed
  const holidays = STATIC_HOLIDAYS;

  useEffect(() => {
    if (!user?.uid) { setDataLoading(false); return; }

    const unsubLeaves = onSnapshot(
      query(collection(db,"leaveRequests"), where("uid","==",user.uid), orderBy("createdAt","desc")),
      snap => setMyLeaves(snap.docs.map(d => ({ id:d.id, ...d.data() } as LeaveRecord)))
    );

    const unsubBalance = onSnapshot(
      query(collection(db,"leaveBalances"), where("uid","==",user.uid)),
      snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setLeaveBalance([
            { type:"annual",  icon:"📅",    label:"Annual", barColor:"#06B6D4",
              remaining:(data?.annual?.quota??12)-(data?.annual?.used??0), total:data?.annual?.quota??12 },
            { type:"casual",  icon:"🧑🏻‍💻", label:"Casual", barColor:"#f59e0b",
              remaining:(data?.casual?.quota??12)-(data?.casual?.used??0), total:data?.casual?.quota??12 },
            { type:"sick",    icon:"🤒",    label:"Sick",   barColor:"#22C55E",
              remaining:(data?.sick?.quota??12)-(data?.sick?.used??0),     total:data?.sick?.quota??12   },
          ]);
        }
        setDataLoading(false);
      }
    );

    // Fallback: stop spinner if balance doc doesn't exist
    const timer = setTimeout(() => setDataLoading(false), 2000);

    return () => { unsubLeaves(); unsubBalance(); clearTimeout(timer); };
  }, [user]);

  const today           = todayStr();
  const nextHol         = holidays.find(h => h.date >= today);
  const selectedBalance = leaveBalance.find(b => b.type === leaveType);
  const isExhausted     = selectedBalance ? selectedBalance.remaining <= 0 : false;

  const days = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const diff = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000;
    return diff >= 0 ? diff + 1 : 0;
  }, [fromDate, toDate]);

  const overQuota = days > 0 && !!selectedBalance && days > selectedBalance.remaining;

  const filtered = useMemo(() => (
    historyFilter === "All" ? myLeaves : myLeaves.filter(l => l.status === historyFilter)
  ), [myLeaves, historyFilter]);

  if (dataLoading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:400, color:"#64748b", fontSize:14, gap:10 }}>
      <span style={{fontSize:24}}>⏳</span> Loading your leave data…
    </div>
  );

  return (
    <div style={{
      fontFamily:"'DM Sans','Segoe UI',sans-serif",
      background:"#F1F5F9",
      minHeight:"100%",
      padding:20,
      display:"flex",
      flexDirection:"column",
      gap:16,
    }}>

      {/* ══ TOP NAV BAR ══════════════════════════════════ */}
      <div style={{
        background:"#fff", borderRadius:12,
        border:"0.5px solid #e8edf3", padding:"0 20px", height:52,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
      }}>
        <div style={{ display:"flex", gap:4 }}>
          {([
            { id:"apply",    icon:"✏️",  label:"Apply Leave" },
            { id:"history",  icon:"📋",  label:"My History",  badge:myLeaves.length },
            { id:"holidays", icon:"🗓️",  label:"Holidays",    badge:holidays.filter(h=>h.date>=today).length, badgeWarn:true },
          ] as { id:NavView; icon:string; label:string; badge?:number; badgeWarn?:boolean }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"6px 14px", borderRadius:8,
                border:`1.5px solid ${view===item.id?"#1E3A5F":"transparent"}`,
                background: view===item.id ? "#1E3A5F" : "transparent",
                color: view===item.id ? "#fff" : "#64748b",
                fontSize:12, fontWeight:600, cursor:"pointer",
                fontFamily:"inherit", transition:"all .13s",
              }}
            >
              <span style={{fontSize:13}}>{item.icon}</span>
              {item.label}
              {item.badge !== undefined && (
                <span style={{
                  fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                  background: view===item.id ? "rgba(255,255,255,0.2)" : item.badgeWarn ? "rgba(251,191,36,0.18)" : "#f1f5f9",
                  color: view===item.id ? "#fff" : item.badgeWarn ? "#92400e" : "#64748b",
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {nextHol && (
          <div style={{
            background:"#fef9c3", border:"1px solid #fcd34d",
            borderRadius:20, padding:"4px 12px",
            fontSize:11, fontWeight:600, color:"#92400e",
            display:"flex", alignItems:"center", gap:5,
          }}>
            <span style={{fontSize:12}}>🎉</span>
            <span style={{maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {nextHol.name}
            </span>
          </div>
        )}
      </div>

      {/* ─── APPLY ─── */}
      {view==="apply" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:16, alignItems:"start" }}>

          <div style={cardStyle}>
            <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:16 }}>
              New leave request
            </div>

            {/* Type selector */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              {(Object.keys(LEAVE_META) as LeaveType[]).map(type => {
                const m   = LEAVE_META[type];
                const bal = leaveBalance.find(b => b.type === type);
                const ex  = bal ? bal.remaining <= 0 : false;
                const sel = leaveType === type;
                return (
                  <button
                    key={type}
                    onClick={() => !ex && setLeaveType(type)}
                    disabled={ex}
                    style={{
                      padding:"10px 6px", borderRadius:9,
                      cursor: ex ? "not-allowed" : "pointer",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                      border:`1.5px solid ${sel?"#1E3A5F":ex?"#e5e7eb":"#e8edf3"}`,
                      background: ex?"#f9fafb":sel?"#1E3A5F":"#f8fafc",
                      opacity: ex ? 0.45 : 1, transition:"all .13s", fontFamily:"inherit",
                    }}
                  >
                    <span style={{fontSize:18}}>{m.icon}</span>
                    <span style={{fontSize:11, fontWeight:700, color:sel?"#fff":ex?"#9ca3af":"#374151"}}>
                      {m.label}
                    </span>
                    <span style={{fontSize:9, fontWeight:500, color:ex?"#ef4444":sel?"rgba(255,255,255,.65)":"#9ca3af"}}>
                      {ex ? "0 left" : `${bal?.remaining ?? 0} left`}
                    </span>
                  </button>
                );
              })}
            </div>

            {isExhausted && (
              <div style={{
                background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8,
                padding:"8px 12px", display:"flex", gap:7, alignItems:"flex-start",
                marginBottom:12, fontSize:12, color:"#dc2626",
              }}>
                <span>🚫</span>
                <span>No <strong>{leaveType}</strong> leaves remaining. Contact HR.</span>
              </div>
            )}

            {/* Dates */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:10, marginBottom:12 }}>
              <div>
                <label style={fieldLbl}>From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  min={today} disabled={isExhausted} style={{...inputSt, width:"fit-content"}}/>
              </div>
              <div style={{color:"#9ca3af", fontSize:14, paddingBottom:9}}>→</div>
              <div>
                <label style={fieldLbl}>To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  min={fromDate||today} disabled={isExhausted} style={{...inputSt, width:"fit-content"}}/>
              </div>
            </div>

            {days > 0 && (
              <div style={{marginBottom:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:5,
                  background: overQuota?"#fef2f2":"#eff6ff",
                  border:`1px solid ${overQuota?"#fecaca":"#bfdbfe"}`,
                  borderRadius:20, padding:"3px 12px",
                  fontSize:11, fontWeight:700, color: overQuota?"#dc2626":"#1d4ed8",
                }}>
                  📅 <strong>{days}</strong> {days===1?"day":"days"} selected
                </div>
                {overQuota && <span style={{fontSize:11, color:"#ef4444", fontWeight:600}}>⚠️ Exceeds quota</span>}
              </div>
            )}

            <label style={fieldLbl}>Reason</label>
            <div style={{position:"relative"}}>
              <textarea
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                placeholder="Briefly describe your reason for leave…"
                disabled={isExhausted}
                style={{...inputSt, resize:"none", minHeight:90, lineHeight:1.55, fontFamily:"inherit"}}
              />
              <span style={{position:"absolute", bottom:10, right:12, fontSize:10, color:"#9ca3af"}}>
                {leaveReason.length}
              </span>
            </div>

            <div style={{marginTop:14}}>
              <button
                onClick={handleSubmitLeave}
                disabled={submitting || isExhausted}
                style={{
                  width:"fit-content",
                  background: isExhausted ? "#e5e7eb" : "#1E3A5F",
                  color: isExhausted ? "#9ca3af" : "#fff",
                  border:"none", borderRadius:9,
                  padding:"11px 24px", fontSize:13, fontWeight:700,
                  cursor: submitting||isExhausted ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.65 : 1, fontFamily:"inherit", transition:"all .15s",
                  whiteSpace:"nowrap",
                }}
              >
                {isExhausted?"🚫 Quota Exhausted":submitting?"⏳ Submitting…":"🚀 Submit Leave Request"}
              </button>
            </div>

            {leaveMsg && (
              <div style={{
                marginTop:10, borderRadius:8, padding:"9px 14px",
                fontSize:12, fontWeight:500, textAlign:"center", border:"1px solid",
                background:  leaveMsg.toLowerCase().includes("success") ? "#f0fdf4" : "#fff1f2",
                color:       leaveMsg.toLowerCase().includes("success") ? "#15803d" : "#be123c",
                borderColor: leaveMsg.toLowerCase().includes("success") ? "#bbf7d0" : "#fecdd3",
              }}>
                {leaveMsg}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14}}>Calendar</div>
            <MiniCalendar holidays={holidays} compact />
          </div>
        </div>
      )}

      {/* ─── HISTORY ─── */}
      {view==="history" && (
        <div style={cardStyle}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8}}>
            <span style={{fontSize:13, fontWeight:700, color:"#0f172a"}}>All requests</span>
            <div style={{display:"flex", gap:5}}>
              {["All","Pending","Approved","Rejected"].map(s => (
                <button key={s} onClick={() => setHistoryFilter(s)} style={{
                  border:`0.5px solid ${historyFilter===s?"#1E3A5F":"#e2e8f0"}`,
                  borderRadius:7, padding:"4px 11px", fontSize:11, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit",
                  background: historyFilter===s ? "#1E3A5F" : "#f8fafc",
                  color: historyFilter===s ? "#fff" : "#6b7280",
                  transition:"all .12s",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {filtered.length===0 ? (
            <div style={{textAlign:"center", padding:"48px 0"}}>
              <div style={{fontSize:36, marginBottom:8}}>📭</div>
              <div style={{fontSize:14, fontWeight:700, color:"#374151"}}>No requests found</div>
              <div style={{fontSize:12, color:"#9ca3af", marginTop:4}}>
                {historyFilter==="All" ? "No leave requests submitted yet." : `No ${historyFilter} requests.`}
              </div>
            </div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:7}}>
              {filtered.map(leave => {
                const meta = LEAVE_META[leave.leaveType] ?? LEAVE_META.casual;
                const sc   = STATUS_STYLES[leave.status]  ?? STATUS_STYLES.Pending;
                return (
                  <div key={leave.id} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"11px 14px", borderRadius:10,
                    background:"#fafafa", border:"0.5px solid #e5e7eb",
                    borderLeft:`3px solid ${meta.dot}`,
                  }}>
                    <div style={{width:8, height:8, borderRadius:"50%", background:meta.dot, flexShrink:0}}/>
                    <span style={{fontSize:12, fontWeight:700, color:"#374151", minWidth:52}}>{meta.label}</span>
                    <span style={{fontSize:11, color:"#64748b", flex:1}}>
                      {leave.fromDate} → {leave.toDate}
                    </span>
                    {leave.days && <span style={{fontSize:10, color:"#9ca3af", fontWeight:600}}>{leave.days}d</span>}
                    <span style={{
                      fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:99,
                      border:`1px solid ${sc.ring}`, background:sc.bg, color:sc.text,
                    }}>
                      {leave.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── HOLIDAYS ─── */}
      {view==="holidays" && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:16, alignItems:"start"}}>

          <div style={cardStyle}>
            <div style={{fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14}}>
              Company Holidays 2026
              <span style={{fontSize:11, fontWeight:500, color:"#94a3b8", marginLeft:8}}>
                {holidays.length} holidays
              </span>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:7}}>
              {holidays.map((h, i) => {
                const d   = parseDate(h.date);
                const past = h.date < today;
                return (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"10px 12px", borderRadius:10,
                    background: past ? "#f8fafc" : "#fff",
                    border:`0.5px solid ${past?"#e8edf3":"#e2e8f0"}`,
                    opacity: past ? 0.5 : 1,
                  }}>
                    <div style={{
                      width:44, height:44, borderRadius:10, flexShrink:0,
                      background: past ? "#94a3b8" : "#1E3A5F", color:"#fff",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", lineHeight:1.15,
                    }}>
                      <span style={{fontSize:15, fontWeight:900}}>{String(d.getDate())}</span>
                      <span style={{fontSize:8, opacity:.7}}>{SHORT_DOW[d.getDay()] ?? ""}</span>
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {h.name}
                      </div>
                      <div style={{fontSize:11, color:"#64748b", marginTop:2}}>
                        {MONTH_NAMES[d.getMonth()]} {String(d.getDate())}, {d.getFullYear()} · {SHORT_DOW[d.getDay()] ?? ""}
                      </div>
                    </div>
                    {past && (
                      <span style={{fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:99, background:"#f1f5f9", color:"#94a3b8", flexShrink:0}}>
                        Past
                      </span>
                    )}
                    <span style={{
                      fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99, flexShrink:0,
                      background: h.type==="national" ? "#dcfce7" : "#eff6ff",
                      color:      h.type==="national" ? "#166534" : "#1d4ed8",
                    }}>
                      {h.type==="national" ? "National" : "Optional"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14}}>Calendar</div>
            <MiniCalendar holidays={holidays}/>
          </div>
        </div>
      )}

    </div>
  );
}

// ── SHARED STYLES ─────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:"#fff", borderRadius:12, padding:18, border:"0.5px solid #e8edf3",
};

const fieldLbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700,
  color:"#9ca3af", textTransform:"uppercase", letterSpacing:.6, marginBottom:5,
};

const inputSt: React.CSSProperties = {
  border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px",
  fontSize:12, width:"100%", outline:"none",
  boxSizing:"border-box", background:"#f9fafb",
  color:"#374151", fontFamily:"inherit", transition:"border-color .15s",
};