"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy, where,
  onSnapshot, Timestamp
} from "firebase/firestore";

// ══════════════════════════════════════════════════════════
//  FIRESTORE COLLECTIONS USED:
//  • sales       → { month, year, revenue, expenses, profit, createdAt }
//  • projects    → { name, team, progress, budget, status, createdAt }
//  • employees   → { name, department, role, status, createdAt }
//  • tasks       → { status: "completed"|"pending", assignedTo, dueDate }
//  • customers   → { name, source, createdAt }
// ══════════════════════════════════════════════════════════

const DEPT_COLORS = ["#4f46e5", "#059669", "#d97706", "#e11d48", "#7c3aed"];
const FILTERS = ["Daily", "Weekly", "Monthly", "Quarterly"];

// ── Formatters ────────────────────────────────────────────
const fmtMoney = (v) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`;

const fmtShort = (v) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : v;

const statusStyle = (s) =>
  s === "On Track" ? { bg: "#dcfce7", color: "#166534" }
  : s === "At Risk" ? { bg: "#fef9c3", color: "#854d0e" }
  : { bg: "#fee2e2", color: "#991b1b" };

// ── Skeleton ──────────────────────────────────────────────
function Skeleton({ h = 40, w = "100%", r = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite linear",
    }} />
  );
}

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, change, up, icon, accent, loading }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 16, padding: "18px 16px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      position: "relative", overflow: "hidden",
      transition: "box-shadow 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 4, height: "100%",
        background: accent, borderRadius: "16px 0 0 16px",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: accent + "1a",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>{icon}</div>
        {loading
          ? <Skeleton h={20} w={56} r={20} />
          : <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              background: up ? "#dcfce7" : "#fee2e2",
              color: up ? "#166534" : "#991b1b",
            }}>{up ? "↑" : "↓"} {change}</span>
        }
      </div>
      {loading
        ? <Skeleton h={28} w="65%" r={6} />
        : <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>{value}</div>
      }
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────
function Card({ title, subtitle, badge, children, span = 1 }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 16, padding: "20px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      gridColumn: span > 1 ? `span ${span}` : undefined,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>{subtitle}</p>}
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#eff6ff", color: "#3b82f6" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: "2px 0" }}>
          {p.name}: {p.value > 999 ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  REAL FIRESTORE HOOK
// ══════════════════════════════════════════════════════════
function useExecutiveData(filter) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ── 1. SALES (revenue chart + totals) ─────────────────
      const salesSnap = await getDocs(
        query(collection(db, "sales"), orderBy("createdAt", "asc"))
      );
      const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── 2. PROJECTS ────────────────────────────────────────
      const projectsSnap = await getDocs(
        query(collection(db, "projects"), orderBy("createdAt", "desc"))
      );
      const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── 3. EMPLOYEES ───────────────────────────────────────
      const empSnap = await getDocs(collection(db, "employees"));
      const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── 4. TASKS ───────────────────────────────────────────
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── 5. CUSTOMERS ───────────────────────────────────────
      const custSnap = await getDocs(
        query(collection(db, "customers"), orderBy("createdAt", "desc"))
      );
      const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── COMPUTE KPIs ──────────────────────────────────────
      const totalRevenue = sales.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
      const totalProfit  = sales.reduce((s, r) => s + (Number(r.profit)  || 0), 0);
      const totalExpense = sales.reduce((s, r) => s + (Number(r.expenses)|| 0), 0);

      const completedTasks = tasks.filter(t => t.status === "completed").length;
      const activeProjects = projects.filter(p => p.status !== "Completed").length;

      // ── DEPT BREAKDOWN ────────────────────────────────────
      const deptMap = {};
      employees.forEach(e => {
        const dept = e.department || "Other";
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
      const total = employees.length || 1;
      const deptData = Object.entries(deptMap).map(([name, count]) => ({
        name, value: Math.round((count / total) * 100),
      }));

      // ── REVENUE CHART (last 12 entries) ───────────────────
      const revenueChart = sales.slice(-12).map(s => ({
        month: s.month || "—",
        revenue:  Number(s.revenue)  || 0,
        expenses: Number(s.expenses) || 0,
        profit:   Number(s.profit)   || 0,
      }));

      // ── PERFORMANCE SCORE (profit margin × scale) ────────
      const performanceTrend = sales.slice(-8).map((s, i) => {
        const margin = s.revenue ? (s.profit / s.revenue) * 100 : 0;
        return { week: `W${i + 1}`, score: Math.min(99, Math.round(margin * 2.5 + 60)) };
      });

      // ── PREV PERIOD COMPARISON (for % change badges) ──────
      const halfLen = Math.floor(sales.length / 2);
      const prevRevenue = sales.slice(0, halfLen).reduce((s, r) => s + (Number(r.revenue) || 0), 0);
      const revChange   = prevRevenue ? pctChange(totalRevenue, prevRevenue) : "N/A";

      setData({
        totalRevenue, totalProfit, totalExpense,
        activeProjects,
        employeeCount: employees.length,
        customerCount: customers.length,
        completedTasks,
        revChange,
        revenueChart,
        deptData: deptData.length ? deptData : fallbackDept,
        projects: projects.slice(0, 6),
        performanceTrend: performanceTrend.length ? performanceTrend : fallbackPerf,
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Firestore error:", e);
      setError(e.message);
      // fallback to demo data so UI doesn't break
      setData(FALLBACK_DATA);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, lastUpdated, refetch: fetch };
}

const pctChange = (curr, prev) =>
  prev === 0 ? "New" : `${((curr - prev) / prev * 100).toFixed(1)}%`;

// ── Fallback demo data (shown if Firestore collections are empty) ─────────────
const fallbackDept = [
  { name: "Engineering", value: 35 },
  { name: "Sales", value: 25 },
  { name: "Marketing", value: 20 },
  { name: "Support", value: 12 },
  { name: "Operations", value: 8 },
];
const fallbackPerf = [
  { week: "W1", score: 72 }, { week: "W2", score: 78 },
  { week: "W3", score: 74 }, { week: "W4", score: 82 },
  { week: "W5", score: 85 }, { week: "W6", score: 80 },
  { week: "W7", score: 88 }, { week: "W8", score: 91 },
];
const FALLBACK_DATA = {
  totalRevenue: 7830000, totalProfit: 2510000, totalExpense: 5320000,
  activeProjects: 142, employeeCount: 384, customerCount: 2847, completedTasks: 1203,
  revChange: "18.4%",
  revenueChart: [
    { month: "Jan", revenue: 420000, expenses: 310000, profit: 110000 },
    { month: "Feb", revenue: 480000, expenses: 340000, profit: 140000 },
    { month: "Mar", revenue: 390000, expenses: 295000, profit: 95000 },
    { month: "Apr", revenue: 560000, expenses: 370000, profit: 190000 },
    { month: "May", revenue: 610000, expenses: 410000, profit: 200000 },
    { month: "Jun", revenue: 580000, expenses: 395000, profit: 185000 },
    { month: "Jul", revenue: 720000, expenses: 460000, profit: 260000 },
    { month: "Aug", revenue: 690000, expenses: 440000, profit: 250000 },
    { month: "Sep", revenue: 750000, expenses: 480000, profit: 270000 },
    { month: "Oct", revenue: 810000, expenses: 510000, profit: 300000 },
    { month: "Nov", revenue: 870000, expenses: 540000, profit: 330000 },
    { month: "Dec", revenue: 950000, expenses: 580000, profit: 370000 },
  ],
  deptData: fallbackDept,
  projects: [
    { name: "CRM Overhaul",  team: "Engineering", progress: 78, budget: "$120K", status: "On Track" },
    { name: "Q4 Campaign",   team: "Marketing",   progress: 55, budget: "$45K",  status: "At Risk"  },
    { name: "ERP Migration", team: "Operations",  progress: 92, budget: "$380K", status: "On Track" },
    { name: "Sales AI Tool", team: "Sales",       progress: 34, budget: "$95K",  status: "Delayed"  },
    { name: "Support Portal",team: "Support",     progress: 67, budget: "$28K",  status: "On Track" },
  ],
  performanceTrend: fallbackPerf,
};

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function ExecutiveDashboard() {
  const [filter, setFilter] = useState("Monthly");
  const { data, loading, error, lastUpdated, refetch } = useExecutiveData(filter);

  const kpis = [
    { label: "Total Revenue",   value: data ? fmtMoney(data.totalRevenue)  : "—", change: data?.revChange || "—", up: true,  icon: "💰", accent: "#4f46e5" },
    { label: "Net Profit",      value: data ? fmtMoney(data.totalProfit)   : "—", change: "22.1%", up: true,  icon: "📈", accent: "#059669" },
    { label: "Active Projects", value: data ? String(data.activeProjects)  : "—", change: "+7",    up: true,  icon: "🚀", accent: "#0284c7" },
    { label: "Employees",       value: data ? String(data.employeeCount)   : "—", change: "+12",   up: true,  icon: "👥", accent: "#d97706" },
    { label: "Customers",       value: data ? data.customerCount.toLocaleString() : "—", change: "31.2%", up: true, icon: "🎯", accent: "#7c3aed" },
    { label: "Tasks Completed", value: data ? data.completedTasks.toLocaleString() : "—", change: "3.1%", up: false, icon: "✅", accent: "#475569" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.88; }
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "14px 28px", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, background: "#4f46e5", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: "0 2px 8px rgba(79,70,229,0.35)",
          }}>📊</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {lastUpdated}</span>}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.3px" }}>
              Executive Dashboard
            </h1>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Company-wide performance · FY 2025</p>

          {/* Filter pills */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: filter === f ? "#4f46e5" : "transparent",
                color: filter === f ? "#fff" : "#64748b",
                boxShadow: filter === f ? "0 1px 6px rgba(79,70,229,0.3)" : "none",
              }}>{f}</button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={refetch} style={{
            padding: "7px 14px", background: "#f1f5f9", color: "#475569",
            border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12,
            fontWeight: 700, cursor: "pointer",
          }}>↻ Refresh</button>

          {/* Export */}
          <button style={{
            padding: "7px 16px", background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
          }}>⬇ Export PDF</button>
        </div>
      </header>

      {/* ══ ERROR BANNER ════════════════════════════════════ */}
      {error && (
        <div style={{
          background: "#fef2f2", borderBottom: "1px solid #fca5a5",
          padding: "10px 28px", fontSize: 12, color: "#dc2626",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          ⚠️ Firestore error: {error} — showing demo data.
        </div>
      )}

      {/* ══ BODY ════════════════════════════════════════════ */}
      <main style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>

        {/* ── KPI CARDS ───────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14, marginBottom: 22,
        }}>
          {kpis.map((k, i) => <KPICard key={i} {...k} loading={loading} />)}
        </div>

        {/* ── ROW 1: Revenue + Profit/Expenses ────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>
          <Card title="Revenue Growth" subtitle="From Firestore · sales collection" badge="Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.revenueChart}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5}
                    fill="url(#revG)" name="Revenue" dot={false} activeDot={{ r: 5, fill: "#4f46e5" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Profit vs Expenses" subtitle="Monthly · finance data" badge="Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.revenueChart} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                  <Bar dataKey="profit"   fill="#059669" radius={[4,4,0,0]} name="Profit"   maxBarSize={13} />
                  <Bar dataKey="expenses" fill="#e11d48" radius={[4,4,0,0]} name="Expenses" maxBarSize={13} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* ── ROW 2: Dept Pie + Performance Score ─────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px,280px) 1fr",
          gap: 16, marginBottom: 16,
        }}>
          <Card title="Departments" subtitle="employees collection">
            {loading ? <Skeleton h={220} /> : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={data.deptData} cx="50%" cy="50%"
                      innerRadius={44} outerRadius={68}
                      paddingAngle={3} dataKey="value">
                      {data.deptData.map((_, i) => (
                        <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={v => [`${v}%`, "Share"]}
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
                  {data.deptData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: DEPT_COLORS[i % DEPT_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: "#64748b" }}>{d.name}</span>
                      </div>
                      <span style={{ color: "#0f172a", fontWeight: 800 }}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card title="Company Performance Score" subtitle="Computed from sales margin · weekly">
            {loading ? <Skeleton h={260} /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.performanceTrend}>
                  <defs>
                    <linearGradient id="perfG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#059669" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#059669" strokeWidth={2.5}
                    fill="url(#perfG)" name="Score"
                    dot={{ fill: "#059669", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#059669" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* ── PROJECTS TABLE ──────────────────────────────── */}
        <Card title="Active Projects" subtitle="Live from Firestore · projects collection" badge={`${data?.projects?.length || 0} projects`}>
          {loading ? <Skeleton h={200} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["Project", "Team", "Progress", "Budget", "Status"].map(h => (
                      <th key={h} style={{
                        textAlign: "left", padding: "10px 14px",
                        color: "#94a3b8", fontWeight: 700,
                        fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p, idx) => {
                    const sc = statusStyle(p.status);
                    return (
                      <tr key={p.id || idx} style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "13px 14px", color: "#0f172a", fontWeight: 700 }}>{p.name}</td>
                        <td style={{ padding: "13px 14px", color: "#64748b" }}>{p.team}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 100, height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                              <div style={{
                                width: `${p.progress || 0}%`, height: "100%",
                                background: "#4f46e5", borderRadius: 99,
                                transition: "width 0.8s ease",
                              }} />
                            </div>
                            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{p.progress || 0}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px", color: "#334155", fontWeight: 600 }}>{p.budget}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{
                            padding: "4px 12px", borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            background: sc.bg, color: sc.color,
                          }}>{p.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {data.projects.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
                  No projects found in Firestore. Add documents to the <strong>projects</strong> collection.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── SCHEMA GUIDE ───────────────────────────────── */}
        {/* <div style={{
          marginTop: 16, background: "#eff6ff",
          border: "1px solid #bfdbfe", borderRadius: 12,
          padding: "14px 18px",
        }}>
          <p style={{ fontSize: 12, color: "#1e40af", fontWeight: 800, marginBottom: 4 }}>
            🔌 Firestore Collections Required
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              ["sales", "month, year, revenue, expenses, profit, createdAt"],
              ["projects", "name, team, progress, budget, status, createdAt"],
              ["employees", "name, department, role, createdAt"],
              ["tasks", "status (completed|pending), assignedTo, dueDate"],
              ["customers", "name, source, createdAt"],
            ].map(([col, fields]) => (
              <span key={col} style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
                <strong>{col}</strong>: {fields}
              </span>
            ))}
          </div>
        </div> */}

        <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 18, paddingBottom: 8 }}>
          Executive Dashboard · Office Tracker · {new Date().toLocaleDateString()} · Connected to Firebase
        </p>
      </main>
    </div>
  );
}