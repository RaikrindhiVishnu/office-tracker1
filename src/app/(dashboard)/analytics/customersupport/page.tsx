"use client";

import { useState, useEffect } from "react";
import { logActivity, logTicketCreated, logTicketResolved } from "@/lib/notifications";
import CrossDeptFeed from "@/components/CrossDeptFeed";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, orderBy, limit,
  addDoc, serverTimestamp, updateDoc, doc, deleteDoc
} from "firebase/firestore";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, BarChart, Bar
} from "recharts";

/* ── Fonts ─────────────────────────────────────────────── */
const FONT = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

/* ── Design tokens ──────────────────────────────────────── */
const T = {
  bg:       "#f0f2f8",
  surface:  "#ffffff",
  surfaceHi:"#f8f9fd",
  border:   "#e4e8f0",
  text:     "#0f172a",
  sub:      "#334155",
  muted:    "#94a3b8",
  faint:    "#e2e8f0",
  blue:     "#3b82f6",
  sky:      "#0ea5e9",
  violet:   "#8b5cf6",
  rose:     "#f43f5e",
  orange:   "#f97316",
  amber:    "#f59e0b",
  green:    "#10b981",
  teal:     "#14b8a6",
  pink:     "#ec4899",
  indigo:   "#6366f1",
} as const;

/* ── Types ──────────────────────────────────────────────── */
interface BadgeCfg { bg: string; color: string; border: string; }

type PriorityKey       = "Critical" | "High" | "Medium" | "Low";
type StatusKey         = "Open" | "In Progress" | "Waiting" | "Resolved";
type TabKey            = "overview" | "tickets" | "agents" | "reports" | "settings";
type FilterKey         = "Today" | "This Week" | "This Month";
type PriorityFilterKey = "All" | PriorityKey;
type NotifState        = { email: boolean; sla: boolean; newTicket: boolean; dailyReport: boolean };
type SlaHState         = { critical: string; high: string; medium: string };

/* ── Demo data ─────────────────────────────────────────── */
const ticketTrend = [
  { day:"Mon", new:120, resolved:98  },
  { day:"Tue", new:145, resolved:122 },
  { day:"Wed", new:183, resolved:154 },
  { day:"Thu", new:161, resolved:140 },
  { day:"Fri", new:214, resolved:191 },
  { day:"Sat", new:92,  resolved:87  },
  { day:"Sun", new:73,  resolved:71  },
];

const issueData = [
  { label:"Login Issues",     pct:34, count:422, color:T.blue   },
  { label:"Payment Errors",   pct:25, count:310, color:T.violet },
  { label:"Technical Bugs",   pct:19, count:236, color:T.orange },
  { label:"Account Mgmt",     pct:13, count:161, color:T.green  },
  { label:"Feature Requests", pct:9,  count:111, color:T.pink   },
];

const channelData = [
  { name:"Email",  value:45, color:T.blue   },
  { name:"Chat",   value:30, color:T.violet },
  { name:"Phone",  value:15, color:T.amber  },
  { name:"Social", value:10, color:T.green  },
];

const agents = [
  { name:"Sara Thomas",  initials:"ST", handled:61, resolved:58, time:"7m",  csat:98, trend:"+4%", color:T.blue   },
  { name:"Priya Mehta",  initials:"PM", handled:52, resolved:49, time:"8m",  csat:97, trend:"+2%", color:T.violet },
  { name:"Rahul Sharma", initials:"RS", handled:45, resolved:40, time:"10m", csat:94, trend:"+1%", color:T.sky    },
  { name:"Anil Kumar",   initials:"AK", handled:38, resolved:35, time:"14m", csat:88, trend:"-1%", color:T.orange },
  { name:"Dev Patel",    initials:"DP", handled:33, resolved:29, time:"16m", csat:85, trend:"-3%", color:T.rose   },
];

// (Mock data moved to state for real-time sync)

// (Mock data moved to state)

const csatMonths = [
  {m:"Jan",s:88},{m:"Feb",s:90},{m:"Mar",s:87},
  {m:"Apr",s:92},{m:"May",s:91},{m:"Jun",s:94},{m:"Jul",s:92},
];

const reportData = [
  { month:"Jan", tickets:380, resolved:340, csat:88 },
  { month:"Feb", tickets:420, resolved:390, csat:90 },
  { month:"Mar", tickets:460, resolved:410, csat:87 },
  { month:"Apr", tickets:510, resolved:470, csat:92 },
  { month:"May", tickets:490, resolved:450, csat:91 },
  { month:"Jun", tickets:540, resolved:510, csat:94 },
  { month:"Jul", tickets:580, resolved:540, csat:92 },
];

/* ── Priority / Status configs ────────────────────────── */
const priorityCfg: Record<PriorityKey, BadgeCfg> = {
  Critical: { bg:"#fff1f2", color:"#f43f5e", border:"#fecdd3" },
  High:     { bg:"#fff7ed", color:"#f97316", border:"#fed7aa" },
  Medium:   { bg:"#f5f3ff", color:"#8b5cf6", border:"#ddd6fe" },
  Low:      { bg:"#f0fdf4", color:"#10b981", border:"#a7f3d0" },
};

const statusCfg: Record<StatusKey, BadgeCfg> = {
  "Open":        { bg:"#eff6ff", color:"#3b82f6", border:"#bfdbfe" },
  "In Progress": { bg:"#f5f3ff", color:"#8b5cf6", border:"#ddd6fe" },
  "Waiting":     { bg:"#fffbeb", color:"#f59e0b", border:"#fde68a" },
  "Resolved":    { bg:"#f0fdf4", color:"#10b981", border:"#a7f3d0" },
};

/* ── Reusable components ────────────────────────────────── */
function Badge({ label, cfg }: { label: string; cfg: BadgeCfg }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:cfg.color, flexShrink:0 }} />
      {label}
    </span>
  );
}

interface TipProps { active?: boolean; payload?: { name:string; value:number; color:string }[]; label?: string; }
function Tip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
      <div style={{ color:T.muted, marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, fontWeight:700, marginBottom:2 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = Math.max(1, Math.ceil(to / 40));
    const t = setInterval(() => { v = Math.min(v + step, to); setVal(v); if (v >= to) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [to]);
  return <>{val.toLocaleString()}{suffix}</>;
}

function Panel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:T.muted, marginBottom:12 }}>{children}</div>;
}

function Ring({ pct, color, size = 90, stroke = 8 }: { pct:number; color:string; size?:number; stroke?:number }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.faint} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
        strokeLinecap="round" style={{ transition:"stroke-dashoffset 1.2s ease" }} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   OVERVIEW TAB
   (Now accepts tickets as props for real-time updates)
══════════════════════════════════════════════════════════ */
function OverviewTab({ tickets }: { tickets: any[] }) {
  const queue = tickets.filter(t => t.status !== "Resolved").slice(0, 6);
  const resolvedCount = tickets.filter(t => t.status === "Resolved").length;
  const openCount = tickets.filter(t => t.status === "Open").length;
  const criticalCount = tickets.filter(t => t.priority === "Critical" && t.status !== "Resolved").length;

  const resolveTicket = async (id: string, customer: string) => {
    await updateDoc(doc(db, "tickets", id), { status: "Resolved", updatedAt: serverTimestamp() });
    await logTicketResolved("Support Agent", customer, id);
  };
  const kpis: { label:string; value:number; suffix:string; color:string; bg:string; icon:string; delta:string; up:boolean }[] = [
    { label:"Total Tickets", value:tickets.length, suffix:"",  color:T.blue,   bg:"#eff6ff", icon:"🎫", delta:"+12%", up:true  },
    { label:"Open Tickets",  value:openCount,  suffix:"",  color:T.rose,   bg:"#fff1f2", icon:"🔴", delta:"+5%",  up:false },
    { label:"Resolved",      value:resolvedCount, suffix:"",  color:T.green,  bg:"#f0fdf4", icon:"✅", delta:"+9%",  up:true  },
    { label:"Critical",      value:criticalCount, suffix:"",  color:T.amber,  bg:"#fffbeb", icon:"⏳", delta:"-2%",  up:true  },
    { label:"Avg Response",  value:12,   suffix:"m", color:T.violet, bg:"#f5f3ff", icon:"⚡", delta:"-3m",  up:true  },
    { label:"CSAT Score",    value:92,   suffix:"%", color:T.teal,   bg:"#f0fdfa", icon:"😊", delta:"+2%",  up:true  },
  ];

  const statusBars: { l:string; pct:number; c:string }[] = [
    { l:"Open",        pct:tickets.length ? Math.round((openCount/tickets.length)*100) : 0, c:T.blue   },
    { l:"In Progress", pct:25, c:T.violet },
    { l:"Waiting",     pct:15, c:T.amber  },
    { l:"Resolved",    pct:20, c:T.green  },
  ];

  const legend: { color:string; l:string }[] = [{ color:T.blue, l:"New" }, { color:T.green, l:"Resolved" }];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:16, padding:"18px 16px", position:"relative", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", animation:`fadeUp 0.35s ease ${i*0.06}s both` }}>
            <div style={{ position:"absolute", top:-18, right:-18, width:72, height:72, borderRadius:"50%", background:k.color, opacity:0.07 }} />
            <div style={{ width:40, height:40, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, marginBottom:12 }}>{k.icon}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color, letterSpacing:"-0.5px", lineHeight:1 }}>
              <Counter to={k.value} suffix={k.suffix} />
            </div>
            <div style={{ fontSize:11, color:T.muted, marginTop:5, fontWeight:600 }}>{k.label}</div>
            <div style={{ position:"absolute", top:14, right:14 }}>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:99, background:k.up?"#dcfce7":"#fee2e2", color:k.up?"#16a34a":"#dc2626" }}>{k.delta}</span>
            </div>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:k.color, opacity:0.6, borderRadius:"0 0 16px 16px" }} />
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:16 }}>
        <Panel>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <SLabel>Volume Trend</SLabel>
              <div style={{ fontSize:16, fontWeight:700, color:T.text }}>Ticket Flow This Week</div>
            </div>
            <div style={{ display:"flex", gap:14 }}>
              {legend.map(x => (
                <div key={x.l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.muted, fontWeight:600 }}>
                  <div style={{ width:18, height:3, background:x.color, borderRadius:2 }} />{x.l}
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ticketTrend}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.blue}  stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.blue}  stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.green} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.green} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.faint} />
              <XAxis dataKey="day"      tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis                    tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="new"      name="New"      stroke={T.blue}  strokeWidth={2.5} fill="url(#ga)" dot={false} />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke={T.green} strokeWidth={2.5} fill="url(#gb)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Panel style={{ flex:1 }}>
            <SLabel>Status Breakdown</SLabel>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
              <div style={{ position:"relative" }}>
                <Ring pct={82} color={T.blue} />
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ fontSize:20, fontWeight:800, color:T.blue }}>82%</div>
                  <div style={{ fontSize:9, color:T.muted }}>resolved</div>
                </div>
              </div>
            </div>
            {statusBars.map(s => (
              <div key={s.l} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                  <span style={{ color:T.sub, fontWeight:600 }}>{s.l}</span>
                  <span style={{ color:T.text, fontWeight:700 }}>{s.pct}%</span>
                </div>
                <div style={{ height:5, background:T.faint, borderRadius:99 }}>
                  <div style={{ width:`${s.pct}%`, height:"100%", background:s.c, borderRadius:99, transition:"width 1s ease" }} />
                </div>
              </div>
            ))}
          </Panel>

          <Panel style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div>
              <div style={{ fontSize:32, fontWeight:800, color:T.green, lineHeight:1 }}>92%</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:3, fontWeight:600 }}>CSAT Score</div>
              <div style={{ display:"flex", gap:8, marginTop:6 }}>
                <span style={{ fontSize:11, color:T.green, fontWeight:700 }}>↑ 860</span>
                <span style={{ fontSize:11, color:T.rose,  fontWeight:700 }}>↓ 40</span>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <ResponsiveContainer width="100%" height={56}>
                <LineChart data={csatMonths}>
                  <Line type="monotone" dataKey="s" stroke={T.green} strokeWidth={2.5} dot={false} />
                  <Tooltip
                   formatter={(v: number | undefined) => [`${v ?? 0}%`, "CSAT"]}
                    contentStyle={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:8, fontSize:11 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>
        <Panel>
          <SLabel>Issue Categories</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            {issueData.map((item, i) => (
              <div key={item.label}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`${item.color}15`, border:`1px solid ${item.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:item.color }}>{i+1}</div>
                    <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{item.label}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:11, color:T.muted }}>{item.count} tickets</span>
                    <span style={{ fontSize:12, fontWeight:800, color:item.color, minWidth:30, textAlign:"right" }}>{item.pct}%</span>
                  </div>
                </div>
                <div style={{ height:6, background:T.faint, borderRadius:99 }}>
                  <div style={{ width:`${item.pct}%`, height:"100%", borderRadius:99, background:item.color, transition:"width 1s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SLabel>Support Channels</SLabel>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <PieChart width={130} height={130}>
              <Pie data={channelData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={4}>
                {channelData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip
                formatter={(v: number | undefined) => [`${v ?? 0}%`]}
                contentStyle={{ background:"#fff", border:`1px solid ${T.border}`, fontSize:11, borderRadius:8 }}
              />
            </PieChart>
          </div>
          {channelData.map(c => (
            <div key={c.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:c.color }} />
                <span style={{ fontSize:12, color:T.sub, fontWeight:500 }}>{c.name}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:60, height:4, background:T.faint, borderRadius:99 }}>
                  <div style={{ width:`${c.value}%`, height:"100%", background:c.color, borderRadius:99 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:T.text, minWidth:28, textAlign:"right" }}>{c.value}%</span>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TICKETS TAB
══════════════════════════════════════════════════════════ */
function TicketsTab({ tickets }: { tickets: any[] }) {
  const [search,  setSearch]  = useState("");
  const [filterP, setFilterP] = useState<PriorityFilterKey>("All");

  const filtered = tickets.filter(t => {
    const matchSearch = (t.customer || "").toLowerCase().includes(search.toLowerCase()) || (t.issue || "").toLowerCase().includes(search.toLowerCase()) || t.id.includes(search);
    const matchP      = filterP === "All" || t.priority === filterP;
    return matchSearch && matchP;
  });

  const stats: { label:string; value:number|string; color:string; icon:string; raw?:boolean }[] = [
    { label:"Total Open",    value:tickets.filter(t=>t.status!=="Resolved").length,  color:T.blue,   icon:"📂"           },
    { label:"Critical",      value:tickets.filter(t=>t.priority==="Critical"&&t.status!=="Resolved").length,    color:T.rose,   icon:"🔴"           },
    { label:"High Priority", value:tickets.filter(t=>t.priority==="High"&&t.status!=="Resolved").length,   color:T.orange, icon:"🟠"           },
    { label:"Avg Wait Time", value:"9m", color:T.violet, icon:"⏱", raw:true },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:14, padding:"16px", display:"flex", alignItems:"center", gap:14, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:`${s.color}12`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>
                {s.raw ? s.value : <Counter to={s.value as number} />}
              </div>
              <div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:3, gap:2 }}>
            {(["All","Critical","High","Medium","Low"] as PriorityFilterKey[]).map(p => (
              <button key={p} onClick={() => setFilterP(p)}
                style={{ padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", transition:"all 0.15s", background:filterP===p?T.blue:"transparent", color:filterP===p?"#fff":T.muted }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..."
              style={{ padding:"8px 14px", border:`1px solid ${T.border}`, borderRadius:10, fontSize:12, color:T.text, background:T.bg, outline:"none", width:220 }} />
            <button style={{ padding:"8px 16px", background:T.blue, color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer" }}>+ New Ticket</button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"90px 150px 1fr 110px 120px 70px 140px", gap:10, padding:"0 12px 10px", borderBottom:`2px solid ${T.faint}` }}>
          {["Ticket","Customer","Issue","Priority","Status","Wait","Actions"].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:T.muted }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.muted, fontSize:13 }}>No tickets match your search.</div>
        )}

        {filtered.map((t, i) => {
          const ps = priorityCfg[t.priority];
          const ss = statusCfg[t.status];
          return (
            <div key={t.id}
              style={{ display:"grid", gridTemplateColumns:"90px 150px 1fr 110px 120px 70px 140px", gap:10, padding:"13px 12px", borderRadius:10, alignItems:"center", border:"1px solid transparent", transition:"all 0.15s", cursor:"pointer", background:i%2===0?"transparent":T.surfaceHi }}
              onMouseEnter={e => { e.currentTarget.style.background="#eff6ff"; e.currentTarget.style.borderColor=T.blue+"44"; }}
              onMouseLeave={e => { e.currentTarget.style.background=i%2===0?"transparent":T.surfaceHi; e.currentTarget.style.borderColor="transparent"; }}>
              <div style={{ fontSize:12, fontWeight:800, color:T.blue, fontFamily:"monospace" }}>{t.id}</div>
              <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{t.customer}</div>
              <div style={{ fontSize:12, color:T.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.issue}</div>
              <Badge label={t.priority} cfg={ps} />
              <Badge label={t.status}   cfg={ss} />
              <div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>{t.ch} {t.wait}</div>
              <div style={{ display:"flex", gap:4 }}>
                <button style={{ padding:"4px 9px", background:"#eff6ff", color:T.blue, border:`1px solid ${T.blue}30`, borderRadius:6, fontSize:10, fontWeight:700, cursor:"pointer" }}>Assign</button>
                <button
                  style={{ padding:"4px 9px", background:"#fff1f2", color:T.rose, border:`1px solid ${T.rose}30`, borderRadius:6, fontSize:10, fontWeight:700, cursor:"pointer" }}
                  onClick={() => {
                    logActivity({
                      type: "TICKET_ESCALATED",
                      title: `Ticket escalated: ${t.id}`,
                      message: `${t.customer}'s ticket "${t.issue}" has been escalated (${t.priority} priority). Sales team may need to follow up.`,
                      icon: "🚨",
                      createdBy: "Support",
                      visibleTo: ["sales", "admin", "finance"],
                      priority: t.priority === "Critical" ? "high" : t.priority === "High" ? "medium" : "low",
                    });
                  }}
                >Escalate</button>
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel>
        <SLabel>SLA Monitoring & Resolve</SLabel>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
          {tickets.filter(t => t.status !== "Resolved").map(s => {
            const ps = priorityCfg[s.priority as PriorityKey] || priorityCfg.Low;
            const breached = s.priority === "Critical";
            return (
              <div key={s.id} style={{ padding:"14px 16px", borderRadius:12, background:breached?"#fff1f2":"#fffbeb", border:`1.5px solid ${breached?"#fecdd3":"#fde68a"}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:800, color:T.blue }}>{s.id.slice(0, 5)}</span>
                      <Badge label={s.priority} cfg={ps} />
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{s.issue}</div>
                  </div>
                  <button
                    onClick={() => resolveTicket(s.id, s.customer)}
                    style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", border:"none", background:breached?T.rose:T.amber, color:"#fff", flexShrink:0, marginLeft:8 }}>
                    {breached?"Resolve":"Review"}
                  </button>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:breached?T.rose:T.amber }}>{breached?"🔴":"🟡"} {breached ? "Breached SLA" : "SLA Active"}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AGENTS TAB
══════════════════════════════════════════════════════════ */
function AgentsTab() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        {agents.map((a, i) => {
          const resRate = Math.round((a.resolved / a.handled) * 100);
          return (
            <div key={a.name}
              style={{ background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:16, padding:"20px 16px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", transition:"transform 0.2s, box-shadow 0.2s", cursor:"pointer", position:"relative", overflow:"hidden" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 8px 24px ${a.color}22`; e.currentTarget.style.borderColor=a.color; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor=T.border; }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:a.color }} />
              <div style={{ fontSize:14, marginBottom:10 }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
              <div style={{ width:52, height:52, borderRadius:"50%", background:`${a.color}15`, border:`2px solid ${a.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:a.color, margin:"0 auto 12px" }}>{a.initials}</div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>{a.name}</div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>{a.handled} tickets · {a.time} avg</div>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:4 }}>
                  <span style={{ color:T.muted }}>Resolution</span>
                  <span style={{ fontWeight:700, color:a.color }}>{resRate}%</span>
                </div>
                <div style={{ height:5, background:T.faint, borderRadius:99 }}>
                  <div style={{ width:`${resRate}%`, height:"100%", background:a.color, borderRadius:99 }} />
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                <span style={{ color:T.muted }}>CSAT</span>
                <span style={{ fontWeight:800, color:a.csat>=95?T.green:a.csat>=88?T.amber:T.rose }}>{a.csat}%</span>
              </div>
              <div style={{ marginTop:8, fontSize:11, fontWeight:700, color:a.trend.startsWith("+")?T.green:T.rose }}>{a.trend} this week</div>
            </div>
          );
        })}
      </div>

      <Panel>
        <SLabel>Detailed Agent Performance</SLabel>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${T.faint}` }}>
                {["Rank","Agent","Handled","Resolved","Resolution Rate","Avg Response","CSAT","Trend"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px", color:T.muted, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => {
                const resRate = Math.round((a.resolved / a.handled) * 100);
                return (
                  <tr key={a.name}
                    style={{ borderBottom:`1px solid ${T.faint}`, transition:"background 0.15s", cursor:"pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = T.surfaceHi; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                    <td style={{ padding:"13px 14px" }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:`${a.color}15`, color:a.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800 }}>{i+1}</div>
                    </td>
                    <td style={{ padding:"13px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:"50%", background:`${a.color}15`, border:`1.5px solid ${a.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:a.color }}>{a.initials}</div>
                        <span style={{ fontWeight:700, color:T.text }}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"13px 14px", color:T.sub, fontWeight:600 }}>{a.handled}</td>
                    <td style={{ padding:"13px 14px", color:T.sub, fontWeight:600 }}>{a.resolved}</td>
                    <td style={{ padding:"13px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:80, height:5, background:T.faint, borderRadius:99 }}>
                          <div style={{ width:`${resRate}%`, height:"100%", background:a.color, borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:a.color }}>{resRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding:"13px 14px", color:T.sub }}>{a.time}</td>
                    <td style={{ padding:"13px 14px" }}><span style={{ fontWeight:800, color:a.csat>=95?T.green:a.csat>=88?T.amber:T.rose }}>{a.csat}%</span></td>
                    <td style={{ padding:"13px 14px" }}><span style={{ fontWeight:700, color:a.trend.startsWith("+")?T.green:T.rose }}>{a.trend}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORTS TAB
══════════════════════════════════════════════════════════ */
function ReportsTab() {
  const cards: { label:string; value:string; color:string; icon:string; sub:string }[] = [
    { label:"Total Tickets (YTD)", value:"3,980", color:T.blue,   icon:"🎫", sub:"↑ 18% vs last year"  },
    { label:"Avg Resolution Time", value:"4.2h",  color:T.violet, icon:"⏱", sub:"↓ 0.8h improved"     },
    { label:"CSAT Average (YTD)",  value:"91.2%", color:T.green,  icon:"😊", sub:"↑ 3.4% vs last year" },
  ];

  const barLegend: { c:string; l:string }[] = [{ c:T.blue, l:"Tickets" }, { c:T.green, l:"Resolved" }];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {cards.map(s => (
          <div key={s.label} style={{ background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:16, padding:"20px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", borderTop:`4px solid ${s.color}` }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginTop:4 }}>{s.label}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <Panel>
        <SLabel>Monthly Performance Overview</SLabel>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData} barSize={18} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.faint} />
            <XAxis dataKey="month"   tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis                   tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="tickets"  name="Tickets"  fill={T.blue}  radius={[4,4,0,0] as [number,number,number,number]} opacity={0.85} />
            <Bar dataKey="resolved" name="Resolved" fill={T.green} radius={[4,4,0,0] as [number,number,number,number]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:20, justifyContent:"center", marginTop:12 }}>
          {barLegend.map(x => (
            <div key={x.l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.muted }}>
              <div style={{ width:12, height:12, borderRadius:3, background:x.c }} />{x.l}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SLabel>CSAT Score Trend</SLabel>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={reportData}>
            <defs>
              <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.teal} stopOpacity={0.2} />
                <stop offset="95%" stopColor={T.teal} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.faint} />
            <XAxis dataKey="month" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[80,100]} tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="csat" name="CSAT %" stroke={T.teal} strokeWidth={2.5} fill="url(#gc)" dot={{ r:4, fill:T.teal }} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════════════════════ */
function SettingsTab() {
  const [notif, setNotif] = useState<NotifState>({ email:true, sla:true, newTicket:false, dailyReport:true });
  const [slaH,  setSlaH]  = useState<SlaHState>({ critical:"1", high:"4", medium:"24" });

  const notifItems: { key: keyof NotifState; label:string; sub:string }[] = [
    { key:"email",       label:"Email Alerts",         sub:"Receive ticket updates via email"         },
    { key:"sla",         label:"SLA Breach Alerts",    sub:"Get notified when SLA is about to breach" },
    { key:"newTicket",   label:"New Ticket Alerts",    sub:"Alert for every new ticket created"       },
    { key:"dailyReport", label:"Daily Summary Report", sub:"Get a daily digest every morning"         },
  ];

  const slaItems: { key: keyof SlaHState; label:string; color:string }[] = [
    { key:"critical", label:"Critical Priority", color:T.rose   },
    { key:"high",     label:"High Priority",     color:T.orange },
    { key:"medium",   label:"Medium Priority",   color:T.violet },
  ];

  const actions: { l:string; c:string }[] = [
    { l:"🎫 Assign Ticket",     c:T.blue   },
    { l:"🔺 Escalate Issue",    c:T.rose   },
    { l:"🏷 Change Priority",   c:T.amber  },
    { l:"💬 Reply to Customer", c:T.green  },
    { l:"✅ Close Ticket",      c:T.teal   },
    { l:"📊 Generate Report",   c:T.violet },
    { l:"📤 Export Tickets",    c:T.indigo },
    { l:"⚙️ SLA Rules",         c:T.orange },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        <Panel>
          <SLabel>Notification Preferences</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {notifItems.map(n => (
              <div key={n.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:T.surfaceHi, borderRadius:12, border:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{n.label}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{n.sub}</div>
                </div>
                <div
                  onClick={() => setNotif(p => ({ ...p, [n.key]: !p[n.key] }))}
                  style={{ width:44, height:24, borderRadius:99, background:notif[n.key]?T.blue:T.faint, cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:2, left:notif[n.key]?22:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SLabel>SLA Response Thresholds</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {slaItems.map(s => (
              <div key={s.key} style={{ padding:"14px 16px", background:T.surfaceHi, borderRadius:12, border:`1px solid ${T.border}`, borderLeft:`4px solid ${s.color}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>{s.label}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <input
                    type="number"
                    value={slaH[s.key]}
                    onChange={e => setSlaH(p => ({ ...p, [s.key]: e.target.value }))}
                    style={{ width:70, padding:"6px 10px", border:`1.5px solid ${s.color}50`, borderRadius:8, fontSize:13, fontWeight:700, color:s.color, background:"#fff", outline:"none", textAlign:"center" }}
                  />
                  <span style={{ fontSize:12, color:T.muted }}>hours response time</span>
                </div>
              </div>
            ))}
            <button style={{ padding:"11px", background:T.blue, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>
              Save SLA Settings
            </button>
          </div>
        </Panel>

        <Panel style={{ gridColumn:"1 / -1" }}>
          <SLabel>Quick Actions</SLabel>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {actions.map(a => (
              <button key={a.l}
                style={{ padding:"10px 18px", background:`${a.c}12`, border:`1.5px solid ${a.c}30`, color:a.c, borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background=`${a.c}22`; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background=`${a.c}12`; e.currentTarget.style.transform="translateY(0)"; }}>
                {a.l}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function SupportDashboard() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [tab,    setTab]    = useState<TabKey>("overview");
  const [filter, setFilter] = useState<FilterKey>("This Week");
  const [now,    setNow]    = useState(new Date());

  useEffect(() => {
    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const addDemoTicket = async () => {
    const issues = ["Login failure", "Payment Error", "App Crash", "Feature Request", "UI Bug"];
    const priorities: PriorityKey[] = ["Low", "Medium", "High", "Critical"];
    const customers = ["John Doe", "Jane Smith", "Mike Ross", "Harvey Specter", "Donna Paulsen"];

    const ticket = {
      customer: customers[Math.floor(Math.random() * customers.length)],
      issue: issues[Math.floor(Math.random() * issues.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: "Open",
      createdAt: serverTimestamp(),
      ch: "💬"
    };

    const docRef = await addDoc(collection(db, "tickets"), ticket);
    await logTicketCreated(ticket.customer, ticket.issue, ticket.priority, docRef.id);
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = FONT;
    document.head.appendChild(link);
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const navItems: { icon:string; id:TabKey; label:string }[] = [
    { icon:"⊞",  id:"overview", label:"Overview" },
    { icon:"🎫", id:"tickets",  label:"Tickets"  },
    { icon:"👥", id:"agents",   label:"Agents"   },
    { icon:"📊", id:"reports",  label:"Reports"  },
    { icon:"⚙️", id:"settings", label:"Settings" },
  ];

  const tabContent: Record<TabKey, React.ReactNode> = {
    overview: <OverviewTab tickets={tickets} />,
    tickets:  <TicketsTab tickets={tickets} />,
    agents:   <AgentsTab />,
    reports:  <ReportsTab />,
    settings: <SettingsTab />,
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Plus Jakarta Sans',sans-serif", display:"flex" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
      `}</style>

      {/* SIDEBAR */}
      <aside style={{ width:72, background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 0", gap:4, position:"sticky", top:0, height:"100vh", flexShrink:0, boxShadow:"2px 0 8px rgba(0,0,0,0.04)" }}>
        <div style={{ width:40, height:40, background:`linear-gradient(135deg,${T.blue},${T.violet})`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, marginBottom:20, boxShadow:`0 4px 14px ${T.blue}40` }}>🎧</div>
        {navItems.map(({ icon, id, label }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} title={label}
              style={{ width:48, height:48, borderRadius:12, border:"none", cursor:"pointer", fontSize:18, transition:"all 0.18s", background:active?`${T.blue}15`:"transparent", color:active?T.blue:T.muted, outline:active?`2px solid ${T.blue}30`:"none", position:"relative" }}>
              {icon}
              {active && <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:3, height:24, background:T.blue, borderRadius:"0 3px 3px 0" }} />}
            </button>
          );
        })}
        <div style={{ flex:1 }} />
        <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${T.blue},${T.violet})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff", boxShadow:`0 2px 8px ${T.blue}30` }}>A</div>
      </aside>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto" }}>
        <header style={{ background:`${T.surface}f0`, backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div>
            <div style={{ fontSize:10, color:T.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:2, fontWeight:700 }}>
              {navItems.find(n => n.id === tab)?.label}
            </div>
            <h1 style={{ fontSize:20, fontWeight:800, color:T.text, letterSpacing:"-0.3px" }}>Customer Support Dashboard</h1>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:99, padding:"5px 12px" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.green, display:"inline-block", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:11, color:T.green, fontWeight:700 }}>Live</span>
              <span style={{ fontSize:10, color:T.muted }}>{now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
            </div>
            <div style={{ display:"flex", background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:3, gap:2 }}>
              {(["Today","This Week","This Month"] as FilterKey[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", transition:"all 0.15s", background:filter===f?T.blue:"transparent", color:filter===f?"#fff":T.muted }}>
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={addDemoTicket}
              style={{ padding:"7px 16px", background:T.blue, color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:`0 2px 8px ${T.blue}40` }}>＋ New Ticket</button>
          </div>
        </header>

        <main style={{ padding:"24px 28px", flex:1, animation:"fadeUp 0.3s ease" }}>
          {tabContent[tab]}
          {tab === "overview" && (
            <div style={{ marginTop: 20 }}>
              <CrossDeptFeed
                role="sales"
                accentColor="#3b82f6"
                title="Sales & Business Activity"
                maxItems={8}
              />
            </div>
          )}
          <div style={{ textAlign:"center", color:T.muted, fontSize:11, marginTop:24, paddingBottom:8 }}>
            Customer Support Dashboard · {new Date().toLocaleDateString()} · Support Intelligence Platform
          </div>
        </main>
      </div>
    </div>
  );
}