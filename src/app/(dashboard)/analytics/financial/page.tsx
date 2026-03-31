"use client";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, PieChart, Pie, Cell,
} from "recharts";

// ─── DESIGN TOKENS ────────────────────────────────────────────
const C = {
  bg:        "#f7f8fc",
  white:     "#ffffff",
  border:    "#e8eaf0",
  borderHi:  "#d1d5e0",
  ink:       "#0f1623",
  inkMid:    "#3d4a5c",
  inkDim:    "#8693a4",
  inkFaint:  "#bec7d4",
  emerald:   "#059669",
  emeraldBg: "#ecfdf5",
  blue:      "#2563eb",
  blueBg:    "#eff6ff",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  amber:     "#d97706",
  amberBg:   "#fffbeb",
  violet:    "#7c3aed",
  violetBg:  "#f5f3ff",
  teal:      "#0891b2",
  tealBg:    "#ecfeff",
  shadow:    "0 1px 4px rgba(15,22,35,0.06), 0 4px 16px rgba(15,22,35,0.04)",
  shadowMd:  "0 2px 8px rgba(15,22,35,0.08), 0 8px 32px rgba(15,22,35,0.06)",
};

const PALETTE = [C.blue, C.emerald, C.violet, C.amber, C.red, C.teal, "#ec4899", "#84cc16"];

// ─── TYPES ────────────────────────────────────────────────────
type ImpactType = "revenue" | "expense";
type DeptType   = "Sales" | "HR" | "IT" | "Operations";

interface DeptEvent {
  id: string;
  from: DeptType;
  type: string;
  icon: string;
  title: string;
  desc: string;
  amount: number;
  impact: ImpactType;
  ts: number;
  read: boolean;
}

interface MonthlyData {
  month: string;
  revenue: number;
  cost: number;
  net: number;
  margin: number;
}

interface ForecastData {
  month: string;
  actual: number | null;
  forecast: number;
}

interface BudgetItem {
  category: string;
  budget: number;
  actual: number;
  variance: number;
}

interface ExpenseItem {
  category: string;
  amount: number;
  pct: number;
}

// ─── CROSS-DEPARTMENT EVENTS ───────────────────────────────────
const DEPT_EVENTS: DeptEvent[] = [
  { id:"ev1",  from:"Sales",      type:"sale_closed",    icon:"🎯", title:"Enterprise Deal Closed",       desc:"Arjun closed ₹3.2L deal with GlobalCo",       amount:320000,  impact:"revenue", ts: Date.now() - 2*60000,   read: false },
  { id:"ev2",  from:"HR",         type:"payroll_run",    icon:"👥", title:"June Payroll Processed",        desc:"₹1.98L payroll disbursed to 12 employees",    amount:-198000, impact:"expense", ts: Date.now() - 18*60000,  read: false },
  { id:"ev3",  from:"Sales",      type:"sale_closed",    icon:"🎯", title:"SaaS Deal Won",                 desc:"Priya closed ₹95K deal with TechStart",       amount:95000,   impact:"revenue", ts: Date.now() - 45*60000,  read: true  },
  { id:"ev4",  from:"IT",         type:"asset_purchase", icon:"💻", title:"IT Asset Purchase",             desc:"8× MacBook Pro M3 ordered — ₹48K",            amount:-48000,  impact:"expense", ts: Date.now() - 2*3600000, read: true  },
  { id:"ev5",  from:"Operations", type:"expense",        icon:"🏢", title:"Office Rent Paid",              desc:"June rent ₹45K debited",                      amount:-45000,  impact:"expense", ts: Date.now() - 4*3600000, read: true  },
  { id:"ev6",  from:"Sales",      type:"sale_closed",    icon:"🎯", title:"Consulting Contract Signed",    desc:"Ravi closed ₹1.45L with Nexus Ltd",           amount:145000,  impact:"revenue", ts: Date.now() - 6*3600000, read: true  },
  { id:"ev7",  from:"IT",         type:"subscription",   icon:"🔄", title:"AWS Invoice Received",          desc:"Monthly AWS bill ₹12.4K auto-debited",        amount:-12400,  impact:"expense", ts: Date.now() - 8*3600000, read: true  },
  { id:"ev8",  from:"HR",         type:"payroll_run",    icon:"👥", title:"May Payroll Processed",         desc:"₹1.98L payroll — includes performance bonus",  amount:-198000, impact:"expense", ts: Date.now() - 36*3600000,read: true  },
];

// ─── FINANCIAL DATA ────────────────────────────────────────────
const MONTHLY: MonthlyData[] = [
  { month:"Jan", revenue:620000,  cost:430000, net:190000, margin:30.6 },
  { month:"Feb", revenue:540000,  cost:410000, net:130000, margin:24.1 },
  { month:"Mar", revenue:710000,  cost:480000, net:230000, margin:32.4 },
  { month:"Apr", revenue:680000,  cost:530000, net:150000, margin:22.1 },
  { month:"May", revenue:830000,  cost:520000, net:310000, margin:37.3 },
  { month:"Jun", revenue:1390000, cost:680000, net:710000, margin:51.1 },
];

const FORECAST: ForecastData[] = [
  { month:"Apr", actual:150000,  forecast:160000 },
  { month:"May", actual:310000,  forecast:290000 },
  { month:"Jun", actual:710000,  forecast:650000 },
  { month:"Jul", actual:null,    forecast:780000 },
  { month:"Aug", actual:null,    forecast:840000 },
  { month:"Sep", actual:null,    forecast:920000 },
];

const BUDGET_ITEMS: BudgetItem[] = [
  { category:"Payroll",       budget:1200000, actual:1150000, variance:50000  },
  { category:"Marketing",     budget:180000,  actual:204000,  variance:-24000 },
  { category:"IT & Infra",    budget:200000,  actual:172000,  variance:28000  },
  { category:"Operations",    budget:280000,  actual:270000,  variance:10000  },
  { category:"R&D",           budget:220000,  actual:198000,  variance:22000  },
];

const EXPENSE_BREAKDOWN: ExpenseItem[] = [
  { category:"Payroll",    amount:1150000, pct:52 },
  { category:"Operations", amount:270000,  pct:12 },
  { category:"IT & Infra", amount:172000,  pct:8  },
  { category:"Marketing",  amount:204000,  pct:9  },
  { category:"R&D",        amount:198000,  pct:9  },
  { category:"Other",      amount:220000,  pct:10 },
];

// ─── UTILS ────────────────────────────────────────────────────
const fmt = (v: number): string =>
  v >= 1e6 ? `₹${(v / 1e6).toFixed(2)}M`
  : v >= 1e3 ? `₹${(v / 1e3).toFixed(1)}K`
  : `₹${v.toLocaleString()}`;

const fmtS = (v: number): string =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
  : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
  : String(Math.abs(v));

const timeAgo = (ts: number): string => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const impactColor: Record<ImpactType, string> = { revenue: C.emerald, expense: C.red };
const deptColor: Record<string, string>        = { Sales: C.blue, HR: C.violet, IT: C.teal, Operations: C.amber };

// ─── MICRO COMPONENTS ─────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color: string;
  bg?: string;
}
function Badge({ children, color, bg }: BadgeProps) {
  return (
    <span style={{ fontSize:10, fontWeight:800, padding:"3px 9px", borderRadius:99, background: bg || color+"18", color, letterSpacing:"0.04em", textTransform:"uppercase", display:"inline-block", whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

interface PillProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
}
function Pill({ children, active, onClick, color }: PillProps) {
  return (
    <button onClick={onClick} style={{ padding:"6px 14px", borderRadius:99, border: active ? "none" : `1px solid ${C.border}`, background: active ? (color || C.blue) : C.white, color: active ? "#fff" : C.inkMid, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s", boxShadow: active ? `0 2px 8px ${(color || C.blue)}44` : "none", whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}

interface ChartTipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}
function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px", fontSize:12, boxShadow:C.shadowMd }}>
      <div style={{ color:C.inkDim, marginBottom:6, fontWeight:700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, fontWeight:800, margin:"2px 0" }}>
          {p.name}: {typeof p.value === "number" && Math.abs(p.value) > 999 ? fmtS(p.value) : p.value}{p.name === "Margin %" ? "%" : ""}
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  accent: string;
  bg?: string;
  sub?: string;
}
function StatCard({ icon, label, value, change, up, accent, bg, sub }: StatCardProps) {
  return (
    <div
      style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:18, padding:"20px", boxShadow:C.shadow, position:"relative", overflow:"hidden", transition:"box-shadow 0.2s, transform 0.2s", cursor:"default" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = C.shadowMd; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = C.shadow;   (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ position:"absolute", top:0, right:0, width:72, height:72, borderRadius:"0 18px 0 72px", background: bg || accent+"12" }} />
      <div style={{ width:42, height:42, borderRadius:12, background: bg || accent+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, marginBottom:14 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:900, color:C.ink, letterSpacing:"-0.5px", marginBottom:3 }}>{value}</div>
      <div style={{ fontSize:12, color:C.inkDim, fontWeight:600, marginBottom: change ? 6 : 0 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color: accent, fontWeight:700 }}>{sub}</div>}
      {change && (
        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:6 }}>
          <span style={{ fontSize:11, fontWeight:800, padding:"2px 8px", borderRadius:99, background: up ? C.emeraldBg : C.redBg, color: up ? C.emerald : C.red }}>
            {up ? "↑" : "↓"} {change}
          </span>
          <span style={{ fontSize:10, color:C.inkFaint }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}
function SectionCard({ title, subtitle, badge, badgeColor, action, children, noPad }: SectionCardProps) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:18, boxShadow:C.shadow, overflow:"hidden" }}>
      <div style={{ padding:"18px 22px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:C.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:C.inkDim, marginTop:2 }}>{subtitle}</div>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {badge && <Badge color={badgeColor || C.blue}>{badge}</Badge>}
          {action}
        </div>
      </div>
      <div style={noPad ? {} : { padding:"18px 22px" }}>{children}</div>
    </div>
  );
}

// ─── NOTIFICATION PANEL ───────────────────────────────────────
interface NotificationPanelProps {
  events: DeptEvent[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
}
function NotificationPanel({ events, onClose, onMarkRead }: NotificationPanelProps) {
  return (
    <div style={{ position:"fixed", top:66, right:24, width:380, background:C.white, border:`1px solid ${C.border}`, borderRadius:20, boxShadow:"0 8px 40px rgba(15,22,35,0.14)", zIndex:200, overflow:"hidden", animation:"slideDown 0.2s ease" }}>
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:C.ink }}>Department Alerts</div>
          <div style={{ fontSize:11, color:C.inkDim, marginTop:1 }}>Finance is notified when other teams act</div>
        </div>
        <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", cursor:"pointer", fontSize:16, color:C.inkDim, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      <div style={{ maxHeight:420, overflowY:"auto" }}>
        {events.map((ev) => (
          <div
            key={ev.id}
            onClick={() => onMarkRead(ev.id)}
            style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}88`, display:"flex", gap:12, alignItems:"flex-start", background: ev.read ? C.white : "#f0f6ff", cursor:"pointer", transition:"background 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.bg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ev.read ? C.white : "#f0f6ff"; }}
          >
            <div style={{ width:38, height:38, borderRadius:10, background:(deptColor[ev.from] || C.blue)+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, position:"relative" }}>
              {ev.icon}
              {!ev.read && <div style={{ position:"absolute", top:-2, right:-2, width:9, height:9, borderRadius:"50%", background:C.blue, border:`2px solid ${C.white}` }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:3 }}>
                <div style={{ fontSize:12, fontWeight:800, color:C.ink }}>{ev.title}</div>
                <span style={{ fontSize:10, color:C.inkFaint, whiteSpace:"nowrap", flexShrink:0 }}>{timeAgo(ev.ts)}</span>
              </div>
              <div style={{ fontSize:11, color:C.inkDim, lineHeight:1.5 }}>{ev.desc}</div>
              <div style={{ display:"flex", gap:6, marginTop:6, alignItems:"center" }}>
                <Badge color={deptColor[ev.from] || C.blue}>{ev.from}</Badge>
                <span style={{ fontSize:11, fontWeight:800, color: ev.amount > 0 ? C.emerald : C.red }}>
                  {ev.amount > 0 ? "+" : ""}{fmt(Math.abs(ev.amount))}
                </span>
                <Badge color={impactColor[ev.impact]}>{ev.impact}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.border}`, background:C.bg }}>
        <div style={{ fontSize:11, color:C.inkDim, textAlign:"center" }}>
          💡 All department activities auto-sync here via <strong>activities</strong> collection
        </div>
      </div>
    </div>
  );
}

// ─── GAUGES ───────────────────────────────────────────────────
interface GaugeProps {
  value: number;
  max: number;
  color: string;
  label: string;
  unit?: string;
}
function Gauge({ value, max, color, label, unit = "" }: GaugeProps) {
  const pct  = Math.min((value / max) * 100, 100);
  const r    = 38;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  const dash = (pct / 100) * arc;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ position:"relative", width:90, height:54, overflow:"hidden" }}>
        <svg width={90} height={90} viewBox="0 0 90 90" style={{ position:"absolute", top:0, left:0 }}>
          <circle cx={45} cy={45} r={r} fill="none" stroke={C.border} strokeWidth={7} strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" transform="rotate(-225 45 45)" />
          <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-225 45 45)" style={{ transition:"stroke-dasharray 1.2s ease" }} />
        </svg>
        <div style={{ position:"absolute", bottom:0, width:"100%", textAlign:"center", fontSize:13, fontWeight:900, color:C.ink }}>{value}{unit}</div>
      </div>
      <div style={{ fontSize:10, color:C.inkDim, fontWeight:700, textAlign:"center", lineHeight:1.4, whiteSpace:"pre" }}>{label}</div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────
export default function FinancialDashboard() {
  const [timeFilter, setTimeFilter]     = useState<string>("Monthly");
  const [events, setEvents]             = useState<DeptEvent[]>(DEPT_EVENTS);
  const [showNotif, setShowNotif]       = useState<boolean>(false);
  const [newEventFlash, setFlash]       = useState<boolean>(false);
  const [liveRevenue, setLiveRevenue]   = useState<number>(4770000);
  const [lastUpdated, setLastUpdated]   = useState<string>(
    new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })
  );
  const notifRef = useRef<HTMLDivElement>(null);

  const unread = events.filter(e => !e.read).length;

  // Simulate incoming cross-dept events
  useEffect(() => {
    const t = setTimeout(() => {
      const newEv: DeptEvent = {
        id: "ev_live",
        from: "Sales",
        type: "sale_closed",
        icon: "🎯",
        title: "New Deal Just Closed!",
        desc: "Arjun closed ₹2.6L deal with DataSoft — revenue updated",
        amount: 260000,
        impact: "revenue",
        ts: Date.now(),
        read: false,
      };
      setEvents(prev => [newEv, ...prev]);
      setLiveRevenue(v => v + 260000);
      setFlash(true);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }));
      setTimeout(() => setFlash(false), 3000);
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  // Close notif panel on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markRead    = (id: string) => setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  const markAllRead = ()           => setEvents(prev => prev.map(e => ({ ...e, read: true })));

  const totalRevenue = liveRevenue;
  const totalCost    = 2214000;
  const netProfit    = totalRevenue - totalCost;
  const profitMargin = ((netProfit / totalRevenue) * 100).toFixed(1);

  const MONTHLY_LIVE: MonthlyData[] = [
    ...MONTHLY.slice(0, -1),
    {
      ...MONTHLY[5],
      revenue: liveRevenue > 4770000 ? MONTHLY[5].revenue + 260000 : MONTHLY[5].revenue,
      net:     liveRevenue > 4770000 ? MONTHLY[5].net     + 260000 : MONTHLY[5].net,
    },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Sora','Segoe UI',sans-serif", color:C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes popIn     { 0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%,100%{box-shadow:0 0 0 0 #2563eb55}50%{box-shadow:0 0 0 6px #2563eb11} }
        @keyframes flashBg   { 0%,100%{background:#ecfdf5}50%{background:#d1fae5} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:99px; }
        input:focus { outline:none; border-color:#2563eb !important; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"0 28px", position:"sticky", top:0, zIndex:100, height:62, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 0 #e8eaf0, 0 2px 12px rgba(15,22,35,0.04)" }}>
        {/* Left */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:40, height:40, background:`linear-gradient(135deg,${C.blue},#0ea5e9)`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:`0 2px 12px ${C.blue}44` }}>💵</div>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:C.ink, letterSpacing:"-0.3px" }}>Finance Dashboard</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:1 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.emerald, boxShadow:`0 0 0 2px ${C.emerald}44` }} />
              <span style={{ fontSize:10, color:C.emerald, fontWeight:700 }}>LIVE</span>
              <span style={{ fontSize:10, color:C.inkFaint }}>· Updated {lastUpdated}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:6, background:C.bg, padding:4, borderRadius:12, border:`1px solid ${C.border}` }}>
          {(["Daily","Weekly","Monthly","Quarterly"] as const).map(f => (
            <Pill key={f} active={timeFilter === f} onClick={() => setTimeFilter(f)} color={C.blue}>{f}</Pill>
          ))}
        </div>

        {/* Right */}
        <div style={{ display:"flex", gap:8, alignItems:"center" }} ref={notifRef}>
          <div style={{ position:"relative" }}>
            <button
              onClick={() => setShowNotif(v => !v)}
              style={{ width:40, height:40, borderRadius:12, border:`1px solid ${unread > 0 ? C.blue : C.border}`, background: unread > 0 ? C.blueBg : C.white, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, transition:"all 0.15s", animation: newEventFlash ? "pulseRing 0.6s ease 3" : undefined }}
            >
              🔔
            </button>
            {unread > 0 && (
              <div style={{ position:"absolute", top:-4, right:-4, width:18, height:18, borderRadius:"50%", background:C.blue, color:"#fff", fontSize:10, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.white}`, animation: newEventFlash ? "popIn 0.4s ease" : undefined }}>
                {unread}
              </div>
            )}
            {showNotif && <NotificationPanel events={events} onClose={() => setShowNotif(false)} onMarkRead={markRead} />}
          </div>

          <button style={{ padding:"8px 16px", background:C.white, color:C.inkMid, border:`1px solid ${C.border}`, borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ↻ Refresh
          </button>
          <button style={{ padding:"8px 18px", background:C.blue, color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:`0 2px 10px ${C.blue}44` }}>
            ⬇ Export CSV
          </button>
        </div>
      </header>

      {/* ── CROSS-DEPT SYNC BAR ─────────────────────────────── */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"8px 28px", display:"flex", gap:0, overflowX:"auto" }}>
        {[
          { dept:"Sales", icon:"🎯", event:"Deal closed +₹2.6L", color:C.blue,   time:"just now", flash: newEventFlash },
          { dept:"HR",    icon:"👥", event:"Payroll run ₹1.98L", color:C.violet, time:"18m ago",  flash: false },
          { dept:"IT",    icon:"💻", event:"AWS invoice ₹12.4K", color:C.teal,   time:"8h ago",   flash: false },
          { dept:"Ops",   icon:"🏢", event:"Rent paid ₹45K",     color:C.amber,  time:"4h ago",   flash: false },
        ].map((d, i) => (
          <div key={d.dept} style={{ display:"flex", alignItems:"center", gap:0, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 20px", background: d.flash ? "#ecfdf5" : C.white, borderRadius:8, transition:"background 0.5s", animation: d.flash ? "flashBg 1s ease 3" : undefined }}>
              <div style={{ width:26, height:26, borderRadius:8, background:d.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>{d.icon}</div>
              <div>
                <div style={{ fontSize:11, fontWeight:800, color:C.ink }}>{d.dept} Team</div>
                <div style={{ fontSize:10, color: d.flash ? C.emerald : C.inkDim }}>{d.event} · <span style={{ color: d.flash ? C.emerald : C.inkFaint }}>{d.time}</span></div>
              </div>
            </div>
            {i < 3 && <div style={{ width:1, height:28, background:C.border, margin:"0 4px" }} />}
          </div>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"4px 0", flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.emerald }} />
          <span style={{ fontSize:10, fontWeight:700, color:C.inkDim }}>All departments synced · Single <code style={{ background:C.bg, padding:"1px 5px", borderRadius:4, color:C.blue }}>activities</code> collection</span>
        </div>
      </div>

      <main style={{ padding:"24px 28px", maxWidth:1600, margin:"0 auto" }}>

        {/* ── KPI CARDS ─────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:22 }}>
          {([
            { icon:"💰", label:"Total Revenue",       value: fmt(totalRevenue), accent:C.blue,   change:"18.4%", up:true,  sub: newEventFlash ? "↑ Updated live!" : "From activities" },
            { icon:"💸", label:"Total Cost",          value: fmt(totalCost),    accent:C.red,    change:"8.2%",  up:false, sub:"Payroll + Ops + IT" },
            { icon:"📈", label:"Net Profit",          value: fmt(netProfit),    accent:C.emerald,change:"24.1%", up:true,  sub:`${profitMargin}% margin` },
            { icon:"🧾", label:"Accounts Receivable", value: fmt(6621280),      accent:C.teal,   change:"5.7%",  up:true,  sub:"Avg. 14 days" },
            { icon:"📋", label:"Accounts Payable",    value: fmt(1630270),      accent:C.amber,  change:"2.3%",  up:false, sub:"Avg. 7 days" },
            { icon:"👥", label:"Payroll This Month",  value: fmt(198000),       accent:C.violet, change:"4.1%",  up:false, sub:"From HR · auto-synced" },
          ] as StatCardProps[]).map((k, i) => (
            <div key={i} style={{ animation:`fadeUp 0.4s ease ${i * 0.05}s both` }}>
              <StatCard {...k} />
            </div>
          ))}
        </div>

        {/* ── GAUGES ───────────────────────────────────────── */}
        <div style={{ marginBottom:18 }}>
          <SectionCard title="Key Financial Ratios" subtitle="Equity · Debt · Receivables · Payables · Margin" badge="● Live" badgeColor={C.blue}>
            <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:20, padding:"6px 0" }}>
              <Gauge value={75.4}                     max={100} color={C.blue}   label={"Equity Ratio\n75.4%"} />
              <Gauge value={1.1}                      max={5}   color={C.red}    label={"Debt / Equity\n1.1×"} />
              <Gauge value={14}                       max={60}  color={C.emerald}label={"AR Days\n14 days"} />
              <Gauge value={7}                        max={60}  color={C.amber}  label={"AP Days\n7 days"} />
              <Gauge value={parseFloat(profitMargin)} max={100} color={C.violet} label={`Profit Margin\n${profitMargin}%`} />
            </div>
          </SectionCard>
        </div>

        {/* ── CHARTS ROW 1 ────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(420px,1fr))", gap:16, marginBottom:16 }}>
          <SectionCard title="Cash Flow Statement" subtitle="Inflow vs Outflow · sourced from activities collection" badge="● Live" badgeColor={C.emerald}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={MONTHLY_LIVE}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtS(v as number)} tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="revenue" name="Inflow"  fill={C.blue} opacity={0.85} radius={[4,4,0,0]} barSize={14} />
                <Bar dataKey="cost"    name="Outflow" fill={C.red}  opacity={0.7}  radius={[4,4,0,0]} barSize={14} />
                <Line type="monotone" dataKey="net" name="Net" stroke={C.emerald} strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Revenue vs Cost & Margin" subtitle="Profit margin trend by month" badge="Analytics" badgeColor={C.violet}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={MONTHLY_LIVE}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.blue} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tickFormatter={v => fmtS(v as number)} tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area  yAxisId="l" type="monotone" dataKey="revenue" name="Revenue"  stroke={C.blue}   strokeWidth={2}   fill="url(#rg)" dot={false} />
                <Line  yAxisId="l" type="monotone" dataKey="cost"    name="Cost"     stroke={C.red}    strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                <Line  yAxisId="r" type="monotone" dataKey="margin"  name="Margin %" stroke={C.violet} strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* ── CHARTS ROW 2 ────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(420px,1fr))", gap:16, marginBottom:16 }}>

          {/* Budget Utilization */}
          <SectionCard title="Budget Utilization" subtitle="Planned vs actual · variance tracking" badge="Budgets" badgeColor={C.amber}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {BUDGET_ITEMS.map((item, i) => {
                const pct  = Math.min(Math.round((item.actual / item.budget) * 100), 130);
                const over = item.variance < 0;
                return (
                  <div key={item.category}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:C.ink }}>{item.category}</span>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:C.inkDim }}>{fmt(item.budget)} budget</span>
                        <span style={{ fontSize:11, fontWeight:800, padding:"2px 8px", borderRadius:99, background: over ? C.redBg : C.emeraldBg, color: over ? C.red : C.emerald }}>
                          {over ? "↑ Over" : "↓ Under"} {fmt(Math.abs(item.variance))}
                        </span>
                      </div>
                    </div>
                    <div style={{ width:"100%", height:8, background:C.bg, borderRadius:99, border:`1px solid ${C.border}` }}>
                      <div style={{ width:`${Math.min(pct, 100)}%`, height:"100%", background: over ? C.red : PALETTE[i % PALETTE.length], borderRadius:99, transition:"width 1s ease" }} />
                    </div>
                    <div style={{ fontSize:10, color:C.inkDim, marginTop:3 }}>{pct}% utilised · Actual: {fmt(item.actual)}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Forecast */}
          <SectionCard title="Revenue Forecast" subtitle="Actuals + 3-month projection" badge="Forecast" badgeColor={C.teal}>
            <ResponsiveContainer width="100%" height={195}>
              <ComposedChart data={FORECAST}>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={C.teal} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtS(v as number)} tick={{ fill:C.inkDim, fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="forecast" name="Forecast" stroke={C.teal} strokeWidth={2} strokeDasharray="5 3" fill="url(#fg)" dot={false} />
                <Line type="monotone" dataKey="actual"   name="Actual"   stroke={C.blue} strokeWidth={2.5} dot={{ r:5, fill:C.blue }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:16, marginTop:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}><div style={{ width:14, height:3, background:C.blue, borderRadius:1 }} /><span style={{ color:C.inkDim }}>Actual</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}><div style={{ width:14, height:3, background:C.teal, borderRadius:1 }} /><span style={{ color:C.inkDim }}>Forecast</span></div>
            </div>
          </SectionCard>
        </div>

        {/* ── EXPENSE TABLE ──────────────────────────────────── */}
        <SectionCard title="Expense Breakdown" subtitle="All expenses by category · auto-populated from activities" badge={`${EXPENSE_BREAKDOWN.length} categories`} badgeColor={C.blue} noPad>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                  {["#","Category","Amount","% of Total","Distribution"].map(h => (
                    <th key={h} style={{ padding:"12px 20px", textAlign:"left", color:C.inkDim, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXPENSE_BREAKDOWN.map((exp, idx) => (
                  <tr
                    key={exp.category}
                    style={{ borderBottom:`1px solid ${C.bg}`, transition:"background 0.15s", cursor:"default" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.bg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding:"14px 20px" }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background: idx === 0 ? C.amberBg : idx === 1 ? "#f1f5f9" : C.bg, color: idx === 0 ? C.amber : C.inkDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900 }}>{idx + 1}</div>
                    </td>
                    <td style={{ padding:"14px 20px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:PALETTE[idx % PALETTE.length], flexShrink:0 }} />
                        <span style={{ fontWeight:700, color:C.ink }}>{exp.category}</span>
                      </div>
                    </td>
                    <td style={{ padding:"14px 20px", color:C.red, fontWeight:900, fontSize:14 }}>{fmt(exp.amount)}</td>
                    <td style={{ padding:"14px 20px" }}>
                      <span style={{ background:C.blueBg, color:C.blue, padding:"3px 10px", borderRadius:99, fontSize:12, fontWeight:800 }}>{exp.pct}%</span>
                    </td>
                    <td style={{ padding:"14px 20px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:120, height:6, background:C.bg, borderRadius:99, border:`1px solid ${C.border}` }}>
                          <div style={{ width:`${exp.pct}%`, height:"100%", background:PALETTE[idx % PALETTE.length], borderRadius:99, transition:"width 1s ease" }} />
                        </div>
                        <span style={{ fontSize:11, color:C.inkDim, fontWeight:700 }}>{exp.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── HOW IT CONNECTS ───────────────────────────────── */}
        <div style={{ marginTop:16, background:C.white, border:`1px solid ${C.border}`, borderRadius:18, padding:"20px 24px", boxShadow:C.shadow }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.ink, marginBottom:14 }}>🔗 How Cross-Department Sync Works</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
            {([
              { dept:"Sales Team",    icon:"🎯", action:"Closes a deal",        result:"Revenue KPI updates instantly",   color:C.blue   },
              { dept:"HR Team",       icon:"👥", action:"Runs payroll",          result:"Expense & cost KPIs auto-adjust", color:C.violet },
              { dept:"IT Department", icon:"💻", action:"Purchases an asset",    result:"IT cost category updates",        color:C.teal   },
              { dept:"Operations",    icon:"🏢", action:"Pays rent / utilities", result:"Ops expense row auto-populated",  color:C.amber  },
            ] as { dept: string; icon: string; action: string; result: string; color: string }[]).map(c => (
              <div key={c.dept} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 14px", background:C.bg, borderRadius:12, border:`1px solid ${C.border}` }}>
                <div style={{ width:36, height:36, borderRadius:10, background:c.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.ink }}>{c.dept}</div>
                  <div style={{ fontSize:11, color:c.color, fontWeight:700, marginTop:1 }}>→ {c.action}</div>
                  <div style={{ fontSize:11, color:C.inkDim, marginTop:2 }}>{c.result}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, padding:"10px 14px", background:C.blueBg, borderRadius:10, fontSize:11, color:C.blue, fontWeight:600, border:`1px solid ${C.blue}22` }}>
            💡 All powered by a single Firestore <code style={{ background:C.white, padding:"1px 6px", borderRadius:4, fontWeight:800 }}>activities</code> collection — Finance reads everything automatically. No manual data entry across teams.
          </div>
        </div>

      </main>
    </div>
  );
}