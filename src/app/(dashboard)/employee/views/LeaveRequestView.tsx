"use client";

import { useState, useMemo, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  orderBy, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeaveType } from "@/types/leave";

// ─── COLORS & ICONS ───────────────────────────────────────
const LEAVE_META: Record<string, { bg: string; text: string; dot: string; icon: string; label: string }> = {
  annual:          { bg: "#ECFEFF", text: "#0E7490", dot: "#06B6D4", icon: "📅", label: "Annual"  },
  casual:          { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6", icon: "🧑🏻‍💻", label: "Casual"  },
  sick:            { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316", icon: "🤒",  label: "Sick"    },
  "Work From Home":{ bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", icon: "🏠",  label: "WFH"     },
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
interface Holiday { date: string; name: string; type: "national"|"optional"; }
interface LeaveRecord {
  id: string; leaveType: LeaveType; fromDate: string; toDate: string;
  reason: string; status: string; adminNote?: string; days?: number; createdAt?: any;
}
interface BalanceItem { type: string; icon: string; remaining: number; total: number; }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ══════════════════════════════════════════════════════════
// HOLIDAY CALENDAR (compact, no stacking)
// ══════════════════════════════════════════════════════════
function HolidayCalendar({ holidays }: { holidays: Holiday[] }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const today = todayStr();

  const byMonth = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    holidays.forEach(h => { const k = h.date.slice(0,7); if (!map[k]) map[k]=[]; map[k].push(h); });
    return map;
  }, [holidays]);

  const monthKey    = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthHols   = byMonth[monthKey] ?? [];
  const holSet      = new Set(monthHols.map(h => h.date));
  const firstDayDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const prev = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  return (
    <div style={{ display:"flex", gap:16, height:"100%" }}>
      {/* Left: mini calendar */}
      <div style={{ width:240, flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <button onClick={prev} style={navBtn}>‹</button>
          <span style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>{MONTH_NAMES[month].slice(0,3)} {year}</span>
          <button onClick={next} style={navBtn}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
          {SHORT_DAYS.map(d=>(
            <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:"#94a3b8", padding:"2px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1 }}>
          {Array.from({length:firstDayDow}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const ds   = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isH  = holSet.has(ds);
            const isT  = ds===today;
            const dow  = new Date(year,month,day).getDay();
            const isW  = dow===0||dow===6;
            return (
              <div key={day} title={isH?monthHols.filter(h=>h.date===ds).map(h=>h.name).join(", "):""} style={{
                textAlign:"center", padding:"4px 1px", borderRadius:5,
                fontSize:11, fontWeight:isH||isT?800:400,
                background: isT?"#1E3A5F":isH?"#fef9c3":"transparent",
                color: isT?"#fff":isH?"#92400e":isW?"#ef4444":"#334155",
                position:"relative", cursor:"default",
              }}>
                {day}
                {isH&&!isT&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:"#f59e0b"}}/>}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {[{label:"Today",box:"#1E3A5F",fg:"#fff"},{label:"Holiday",box:"#fef9c3",fg:"#92400e"}].map(l=>(
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:l.box }}/>
              <span style={{ color:"#64748b", fontWeight:600 }}>{l.label}</span>
            </div>
          ))}
        </div>
        {/* Month quick-jump */}
        <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:10 }}>
          {MONTH_NAMES.map((name,i)=>{
            const k = `${year}-${String(i+1).padStart(2,"0")}`;
            const cnt = (byMonth[k]??[]).length;
            const sel = i===month;
            return (
              <button key={name} onClick={()=>setMonth(i)} style={{
                padding:"3px 7px", borderRadius:5, fontSize:9, fontWeight:700,
                border:"none", cursor:"pointer",
                background: sel?"#1E3A5F":cnt>0?"#fef9c3":"#f1f5f9",
                color:      sel?"#fff"    :cnt>0?"#92400e":"#64748b",
                position:"relative",
              }}>
                {name.slice(0,3)}
                {cnt>0&&!sel&&<span style={{position:"absolute",top:-4,right:-4,width:12,height:12,borderRadius:"50%",background:"#f59e0b",color:"#fff",fontSize:7,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: holiday list */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#0f172a", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
          {MONTH_NAMES[month]} Holidays
          {monthHols.length>0&&<span style={{background:"#fef9c3",color:"#92400e",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{monthHols.length}</span>}
        </div>
        {monthHols.length===0?(
          <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:12, background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0" }}>
            <div style={{fontSize:22,marginBottom:4}}>🎉</div>No holidays this month
          </div>
        ):(
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {monthHols.map((h,i)=>{
              const d = new Date(h.date+"T00:00:00");
              const dayN = d.getDate();
              const dow  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
              const past = h.date<today;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:past?"#f8fafc":"#fffbeb",border:`1px solid ${past?"#e2e8f0":"#fcd34d"}`,opacity:past?0.6:1}}>
                  <div style={{width:36,height:36,borderRadius:8,flexShrink:0,background:past?"#e2e8f0":"#1E3A5F",color:past?"#64748b":"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:1.1}}>
                    <span style={{fontSize:13,fontWeight:900}}>{dayN}</span>
                    <span style={{fontSize:8,fontWeight:600,opacity:0.8}}>{dow}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{fontSize:12,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                    <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{MONTH_NAMES[month]} {dayN}</div>
                  </div>
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,flexShrink:0,background:h.type==="national"?"#dcfce7":"#eff6ff",color:h.type==="national"?"#166534":"#1d4ed8"}}>
                    {h.type==="national"?"National":"Optional"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width:26, height:26, borderRadius:6, border:"1px solid #e2e8f0",
  background:"#fff", cursor:"pointer", fontSize:16, fontWeight:700,
  color:"#334155", display:"flex", alignItems:"center", justifyContent:"center",
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function LeaveRequestView({
  user,
  leaveType, setLeaveType,
  fromDate,  setFromDate,
  toDate,    setToDate,
  leaveReason, setLeaveReason,
  handleSubmitLeave,
  submitting,
  leaveMsg,
}: {
  user: any;
  leaveType: LeaveType;
  setLeaveType: (v: LeaveType) => void;
  fromDate: string; setFromDate: (v: string) => void;
  toDate:   string; setToDate:   (v: string) => void;
  leaveReason: string; setLeaveReason: (v: string) => void;
  handleSubmitLeave: () => void;
  submitting: boolean;
  leaveMsg: string;
}) {
  const [tab,           setTab]           = useState<"apply"|"history"|"holidays">("apply");
  const [historyFilter, setHistoryFilter] = useState("All");
  const [expandedId,    setExpandedId]    = useState<string|null>(null);

  const [myLeaves,     setMyLeaves]     = useState<LeaveRecord[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<BalanceItem[]>([]);
  const [holidays,     setHolidays]     = useState<Holiday[]>([]);
  const [dataLoading,  setDataLoading]  = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubLeaves = onSnapshot(
      query(collection(db,"leaveRequests"), where("uid","==",user.uid), orderBy("createdAt","desc")),
      snap => setMyLeaves(snap.docs.map(d=>({id:d.id,...d.data()} as LeaveRecord)))
    );

    const unsubBalance = onSnapshot(
      query(collection(db,"leaveBalances"), where("uid","==",user.uid)),
      snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setLeaveBalance([
            { type:"sick",          icon:"🤒",    remaining:(data?.sick?.quota??12)-(data?.sick?.used??0),    total:data?.sick?.quota??12   },
            { type:"casual",        icon:"🧑🏻‍💻", remaining:(data?.casual?.quota??12)-(data?.casual?.used??0), total:data?.casual?.quota??12 },
            { type:"Work From Home",icon:"🏠",    remaining:(data?.wfh?.quota??24)-(data?.wfh?.used??0),      total:data?.wfh?.quota??24    },
          ]);
        }
      }
    );

    getDocs(query(collection(db,"holidays"), orderBy("date","asc")))
      .then(snap => setHolidays(snap.docs.map(d => {
        const data = d.data();
        return { date:data.date, name:data.title??data.name??"Holiday", type:data.type==="Optional"?"optional":"national" } as Holiday;
      })))
      .catch(()=>setHolidays([]))
      .finally(()=>setDataLoading(false));

    return ()=>{ unsubLeaves(); unsubBalance(); };
  }, [user]);

  const days = useMemo(()=>{
    if (!fromDate||!toDate) return 0;
    const diff=(new Date(toDate).getTime()-new Date(fromDate).getTime())/86400000;
    return diff>=0?diff+1:0;
  },[fromDate,toDate]);

  const filtered = useMemo(()=>myLeaves.filter(l=>historyFilter==="All"||l.status===historyFilter),[myLeaves,historyFilter]);

  const today   = todayStr();
  const nextHol = holidays.filter(h=>h.date>=today)[0];
  const selectedBalance  = leaveBalance.find(b=>b.type===leaveType);
  const isExhausted      = selectedBalance?selectedBalance.remaining<=0:false;
  const overQuota        = days>0&&selectedBalance&&days>selectedBalance.remaining;

  if (dataLoading) return (
    <div style={{padding:40,textAlign:"center",color:"#64748b",fontSize:14}}>
      <div style={{fontSize:32,marginBottom:12}}>⏳</div>Loading your leave data...
    </div>
  );

  return (
    <div style={{
      fontFamily:"'DM Sans','Segoe UI',sans-serif",
      height:"calc(100vh - 120px)",
      display:"flex",
      flexDirection:"column",
      background:"#F1F5F9",
      borderRadius:16,
      overflow:"hidden",
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        background:"linear-gradient(120deg,#1E3A5F 0%,#1a5276 100%)",
        padding:"12px 20px",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        flexShrink:0,
        gap:12,
        flexWrap:"wrap",
      }}>
        {/* Tabs */}
        <div style={{ display:"flex", gap:4 }}>
          {([
            ["apply","✏️ Apply"],
            ["history","📋 History"],
            ["holidays","🗓️ Holidays"],
          ] as const).map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              padding:"6px 14px", borderRadius:8, border:"none",
              fontSize:12, fontWeight:700, cursor:"pointer",
              background: tab===key?"rgba(255,255,255,0.18)":"transparent",
              color: tab===key?"#fff":"rgba(255,255,255,0.6)",
              transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* Compact balance chips */}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {leaveBalance.map(b=>{
            const pct    = Math.round((b.remaining/b.total)*100);
            const low    = b.remaining<=3;
            const empty  = b.remaining<=0;
            return (
              <div key={b.type} style={{
                display:"flex", alignItems:"center", gap:5,
                background: empty?"rgba(239,68,68,0.18)":low?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.12)",
                border:`1px solid ${empty?"rgba(239,68,68,0.4)":low?"rgba(251,191,36,0.35)":"rgba(255,255,255,0.18)"}`,
                borderRadius:20, padding:"4px 10px",
              }}>
                <span style={{fontSize:13}}>{b.icon}</span>
                <span style={{fontSize:12,fontWeight:800,color:empty?"#fca5a5":low?"#fde68a":"#fff"}}>
                  {b.remaining}
                </span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontWeight:600}}>
                  /{b.total}
                </span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontWeight:600}}>
                  {b.type==="Work From Home"?"WFH":b.type}
                </span>
              </div>
            );
          })}
          {nextHol&&(
            <div style={{
              display:"flex",alignItems:"center",gap:5,
              background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",
              borderRadius:20,padding:"4px 10px",
            }}>
              <span style={{fontSize:10}}>🎉</span>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.75)",fontWeight:600,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {nextHol.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* ════ APPLY TAB ════ */}
        {tab==="apply"&&(
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, height:"100%" }}>

            {/* LEFT: leave type + dates + reason */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

              {/* Leave type selector */}
              <div style={card}>
                <div style={sectionLabel}>Leave Type</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {(Object.keys(LEAVE_META) as LeaveType[]).map(type=>{
                    const m   = LEAVE_META[type];
                    const sel = leaveType===type;
                    const bal = leaveBalance.find(b=>b.type===type);
                    const ex  = bal?bal.remaining<=0:false;
                    return (
                      <button key={type} onClick={()=>!ex&&setLeaveType(type)} disabled={ex} style={{
                        padding:"10px 8px", borderRadius:10, cursor:ex?"not-allowed":"pointer",
                        display:"flex", alignItems:"center", gap:8,
                        background: ex?"#f9fafb":sel?m.dot:"#f8fafc",
                        color:      ex?"#d1d5db":sel?"#fff":"#374151",
                        border:`2px solid ${ex?"#e5e7eb":sel?m.dot:"#e5e7eb"}`,
                        transition:"all 0.15s",
                        opacity: ex?0.5:1,
                        position:"relative",
                      }}>
                        <span style={{fontSize:18,filter:ex?"grayscale(1)":"none"}}>{m.icon}</span>
                        <div style={{flex:1,textAlign:"left"}}>
                          <div style={{fontSize:12,fontWeight:700,lineHeight:1}}>{m.label}</div>
                          {bal&&<div style={{fontSize:10,fontWeight:600,marginTop:2,color:ex?"#ef4444":sel?"rgba(255,255,255,0.8)":"#9ca3af"}}>
                            {ex?"Exhausted":`${bal.remaining} left`}
                          </div>}
                        </div>
                        {ex&&<span style={{position:"absolute",top:-5,right:-5,background:"#ef4444",color:"#fff",fontSize:7,fontWeight:900,padding:"1px 5px",borderRadius:99}}>DONE</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Exhausted warning */}
                {isExhausted&&(
                  <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:8,padding:"8px 12px",display:"flex",gap:8,color:"#dc2626",fontSize:11,marginTop:8,alignItems:"flex-start"}}>
                    <span>🚫</span>
                    <span>No <strong>{leaveType}</strong> leaves remaining. Contact HR.</span>
                  </div>
                )}
                {leaveType==="Work From Home"&&!isExhausted&&(
                  <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"8px 12px",display:"flex",gap:8,color:"#15803d",fontSize:11,marginTop:8}}>
                    <span>🏠</span><span>Once approved, work from any location.</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div style={card}>
                <div style={sectionLabel}>Select Dates</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 24px 1fr", alignItems:"center", gap:8 }}>
                  <div>
                    <label style={fieldLabel}>From</label>
                    <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                      min={today} disabled={isExhausted} style={inputStyle}/>
                  </div>
                  <div style={{textAlign:"center",color:"#9ca3af",fontSize:16,paddingTop:16}}>→</div>
                  <div>
                    <label style={fieldLabel}>To</label>
                    <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                      min={fromDate||today} disabled={isExhausted} style={inputStyle}/>
                  </div>
                </div>
                {days>0&&(
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{background:overQuota?"#fef2f2":"#eff6ff",border:`1.5px solid ${overQuota?"#fecaca":"#bfdbfe"}`,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700,color:overQuota?"#dc2626":"#1d4ed8",display:"inline-flex",alignItems:"center",gap:6}}>
                      🗓️ <strong>{days}</strong> {days===1?"day":"days"} selected
                    </div>
                    {overQuota&&<span style={{fontSize:11,color:"#ef4444",fontWeight:600}}>⚠️ Exceeds quota</span>}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: reason + submit */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{...card, flex:1, display:"flex", flexDirection:"column"}}>
                <div style={sectionLabel}>Reason for Leave</div>
                <div style={{position:"relative",flex:1,display:"flex",flexDirection:"column"}}>
                  <textarea
                    value={leaveReason}
                    onChange={e=>setLeaveReason(e.target.value)}
                    placeholder="Describe your reason in detail..."
                    disabled={isExhausted}
                    style={{
                      ...inputStyle,
                      flex:1,
                      resize:"none",
                      minHeight:140,
                      fontFamily:"inherit",
                      lineHeight:1.6,
                    }}
                  />
                  <div style={{position:"absolute",bottom:10,right:12,fontSize:10,color:"#9ca3af"}}>{leaveReason.length} chars</div>
                </div>
              </div>

              <div style={card}>
                <button
                  onClick={handleSubmitLeave}
                  disabled={submitting||isExhausted}
                  style={{
                    width:"100%",
                    background: isExhausted?"#e5e7eb":"linear-gradient(135deg,#1E3A5F,#1a6fa8)",
                    color: isExhausted?"#9ca3af":"#fff",
                    border:"none",borderRadius:10,
                    padding:"13px 24px",fontSize:14,fontWeight:700,
                    cursor:submitting||isExhausted?"not-allowed":"pointer",
                    opacity:submitting?0.6:1,
                    boxShadow:isExhausted?"none":"0 4px 14px #1E3A5F40",
                    transition:"all 0.15s",
                  }}
                >
                  {isExhausted?"🚫 Quota Exhausted":submitting?"⏳ Submitting...":"🚀 Submit Leave Request"}
                </button>
                {leaveMsg&&(
                  <div style={{
                    marginTop:10,borderRadius:8,padding:"10px 14px",fontSize:12,fontWeight:500,
                    border:"1.5px solid",textAlign:"center",
                    background:   leaveMsg.toLowerCase().includes("success")?"#F0FDF4":"#FFF1F2",
                    color:        leaveMsg.toLowerCase().includes("success")?"#15803D":"#BE123C",
                    borderColor:  leaveMsg.toLowerCase().includes("success")?"#BBF7D0":"#FECDD3",
                  }}>{leaveMsg}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ HISTORY TAB ════ */}
        {tab==="history"&&(
          <div style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div style={sectionLabel}>📋 My Leave History</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["All","Pending","Approved","Rejected"].map(s=>(
                  <button key={s} onClick={()=>setHistoryFilter(s)} style={{
                    border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",
                    background:historyFilter===s?"#1E3A5F":"#F3F4F6",
                    color:     historyFilter===s?"#fff":"#6B7280",
                  }}>{s}</button>
                ))}
              </div>
            </div>
            {filtered.length===0?(
              <div style={{textAlign:"center",padding:"48px 0"}}>
                <div style={{fontSize:40}}>📭</div>
                <div style={{fontSize:15,fontWeight:700,color:"#374151",marginTop:10}}>No requests found</div>
                <div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>{historyFilter==="All"?"No leave requests submitted yet.":`No ${historyFilter} requests.`}</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filtered.map(leave=>{
                  const lc  = LEAVE_META[leave.leaveType]??LEAVE_META.casual;
                  const sc  = STATUS_STYLES[leave.status]??STATUS_STYLES.Pending;
                  const exp = expandedId===leave.id;
                  return (
                    <div key={leave.id} style={{background:"#fafafa",borderRadius:10,border:"1px solid #e5e7eb",overflow:"hidden",borderLeft:`3px solid ${lc.dot}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer"}} onClick={()=>setExpandedId(exp?null:leave.id)}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{background:lc.bg,color:lc.text,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                            {lc.icon} {lc.label}
                          </span>
                          <span style={{fontSize:12,color:"#374151",fontWeight:500}}>{leave.fromDate} → {leave.toDate}</span>
                          {leave.days&&<span style={{fontSize:10,color:"#9ca3af",fontWeight:600}}>({leave.days}d)</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{background:sc.bg,color:sc.text,border:`1px solid ${sc.ring}`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                            {sc.icon} {leave.status}
                          </span>
                          <span style={{fontSize:11,color:"#9ca3af"}}>{exp?"▲":"▼"}</span>
                        </div>
                      </div>
                      {exp&&(
                        <div style={{padding:"0 16px 14px",display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",marginBottom:4}}>📝 Reason</div>
                            <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{leave.reason||"No reason provided."}</div>
                          </div>
                          {leave.adminNote&&(
                            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 12px"}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#0369a1",textTransform:"uppercase",marginBottom:4}}>💬 Admin Note</div>
                              <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{leave.adminNote}</div>
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

        {/* ════ HOLIDAYS TAB ════ */}
        {tab==="holidays"&&(
          <div style={{...card, height:"100%"}}>
            <div style={sectionLabel}>🗓️ Company Holiday Calendar</div>
            <HolidayCalendar holidays={holidays}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:"#fff", borderRadius:12, padding:16,
  boxShadow:"0 2px 8px #0000000A", border:"1px solid #e8edf3",
};

const sectionLabel: React.CSSProperties = {
  fontSize:11, fontWeight:800, color:"#64748b",
  textTransform:"uppercase", letterSpacing:0.8,
  marginBottom:10,
};

const fieldLabel: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700,
  color:"#9ca3af", textTransform:"uppercase",
  letterSpacing:0.5, marginBottom:4,
};

const inputStyle: React.CSSProperties = {
  border:"2px solid #e5e7eb", borderRadius:8,
  padding:"8px 10px", fontSize:13, width:"100%",
  outline:"none", boxSizing:"border-box",
  background:"#f9fafb",
};