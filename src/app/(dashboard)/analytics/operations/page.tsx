"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ─────────────────────────────────────────────────
const FILTERS = ["Daily", "Weekly", "Monthly", "Quarterly"];
const PALETTE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

// ── Formatters ───────────────────────────────────────────
const fmtShort = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);

// ── Demo data ─────────────────────────────────────────────
const DEMO = {
  costDistribution: [
    { month: "Jan", inventoryMgmt: 21000, customerSvc: 8000, carryingCost: 15000, transport: 11000, warehousing: 9000 },
    { month: "Feb", inventoryMgmt: 24000, customerSvc: 9000, carryingCost: 17000, transport: 13000, warehousing: 10000 },
    { month: "Mar", inventoryMgmt: 22000, customerSvc: 7500, carryingCost: 14000, transport: 12000, warehousing: 8500 },
    { month: "Apr", inventoryMgmt: 27000, customerSvc: 10000, carryingCost: 18000, transport: 14000, warehousing: 11000 },
    { month: "May", inventoryMgmt: 25000, customerSvc: 9500, carryingCost: 16000, transport: 13500, warehousing: 10500 },
    { month: "Jun", inventoryMgmt: 28000, customerSvc: 11000, carryingCost: 19000, transport: 15000, warehousing: 12000 },
  ],
  orderFulfillment: [
    { month: "Jan", onTime: 85 },
    { month: "Feb", onTime: 87 },
    { month: "Mar", onTime: 86 },
    { month: "Apr", onTime: 89 },
    { month: "May", onTime: 88 },
    { month: "Jun", onTime: 88.82 },
  ],
  supplierPerformance: [
    { supplier: "Supplier A", onTime: 94, quality: 96, cost: 88 },
    { supplier: "Supplier B", onTime: 87, quality: 91, cost: 95 },
    { supplier: "Supplier C", onTime: 79, quality: 88, cost: 92 },
    { supplier: "Supplier D", onTime: 95, quality: 97, cost: 85 },
    { supplier: "Supplier E", onTime: 82, quality: 90, cost: 89 },
  ],
  inventoryLevels: [
    { category: "Raw Materials",  current: 4200, reorder: 1500, max: 6000 },
    { category: "WIP",            current: 1800, reorder: 500,  max: 3000 },
    { category: "Finished Goods", current: 3100, reorder: 1000, max: 5000 },
    { category: "Spare Parts",    current: 900,  reorder: 300,  max: 2000 },
  ],
};

// ── Skeleton ─────────────────────────────────────────────
function Skeleton({ h = 40, w = "100%", r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear",
    }} />
  );
}

// ── Gauge Component ───────────────────────────────────────
function GaugeChart({ value, label, color }: { value: number; label: string; color: string }) {
  const strokeWidth = 12;
  const normalizedRadius = 60 - strokeWidth / 2;
  const pct = Math.min(value / 100, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <svg width={140} height={90} viewBox="0 0 140 90">
        <path
          d={`M ${strokeWidth / 2 + 10} 80 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${140 - strokeWidth / 2 - 10} 80`}
          fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth / 2 + 10} 80 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${140 - strokeWidth / 2 - 10} 80`}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${pct * Math.PI * normalizedRadius} ${Math.PI * normalizedRadius}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="12"  y="88" fill="#ef4444" fontSize="9" fontWeight="700">0</text>
        <text x="62"  y="20" fill="#f59e0b" fontSize="9" fontWeight="700" textAnchor="middle">50</text>
        <text x="118" y="88" fill="#10b981" fontSize="9" fontWeight="700">100</text>
        <text x="70"  y="72" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="900">{value}%</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "center", marginTop: -6 }}>{label}</div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────
function KPICard({ label, value, change, up, icon, accent, loading }: {
  label: string; value: string; change: string; up: boolean;
  icon: string; accent: string; loading: boolean;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
      padding: "18px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent, borderRadius: "16px 0 0 16px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: accent + "1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
        {loading ? <Skeleton h={20} w={56} r={20} /> : (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: up ? "#dcfce7" : "#fee2e2", color: up ? "#166534" : "#991b1b" }}>
            {up ? "↑" : "↓"} {change}
          </span>
        )}
      </div>
      {loading ? <Skeleton h={28} w="65%" r={6} /> : (
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>{value}</div>
      )}
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ── Chart Card ───────────────────────────────────────────
function Card({ title, subtitle, badge, children }: {
  title: string; subtitle?: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>{subtitle}</p>}
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#f0f9ff", color: "#0369a1" }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Chart Tooltip ────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: "2px 0" }}>
          {p.name}: {p.value > 999 ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Days Outstanding Card ─────────────────────────────────
function DaysCard({ label, value, icon, color, subtitle }: {
  label: string; value: number; icon: string; color: string; subtitle?: string;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
      padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-1px" }}>
        {value} <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>days</span>
      </div>
      {subtitle && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function SupplyChainDashboard() {
  const [filter, setFilter]           = useState("Monthly");
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState("Overview");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }, 1200);
    return () => clearTimeout(t);
  }, [filter]);

  const refetch = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }, 800);
  };

  const kpis: { label: string; value: string; change: string; up: boolean; icon: string; accent: string }[] = [
    { label: "Total Net Sales",    value: "$52.60M", change: "8.4%", up: true,  icon: "💰", accent: "#0ea5e9" },
    { label: "Total Costs",        value: "$16.35M", change: "3.1%", up: false, icon: "📊", accent: "#ef4444" },
    { label: "On-Time Delivery",   value: "88.82%",  change: "2.3%", up: true,  icon: "🚚", accent: "#10b981" },
    { label: "Orders On Time",     value: "34,432",  change: "5.2%", up: true,  icon: "✅", accent: "#8b5cf6" },
    { label: "Orders Delivered",   value: "38,768",  change: "4.8%", up: true,  icon: "📦", accent: "#f59e0b" },
    { label: "Inventory Turnover", value: "6.2x",    change: "1.1%", up: true,  icon: "🔄", accent: "#ec4899" },
  ];

  const costLegend: { key: string; name: string; color: string }[] = [
    { key: "inventoryMgmt", name: "Inventory Management",  color: "#0ea5e9" },
    { key: "customerSvc",   name: "Customer Service",      color: "#8b5cf6" },
    { key: "carryingCost",  name: "Carrying Cost of Inv.", color: "#f59e0b" },
    { key: "transport",     name: "Transport",             color: "#10b981" },
    { key: "warehousing",   name: "Warehousing",           color: "#ef4444" },
  ];

  const bottlenecks: { issue: string; severity: string; impact: string; region: string; color: string }[] = [
    { issue: "Port Congestion",   severity: "High",   impact: "Transport delay +3 days", region: "West Coast",  color: "#ef4444" },
    { issue: "Supplier Lead Time",severity: "Medium", impact: "Raw material shortage",   region: "Supplier A",  color: "#f59e0b" },
    { issue: "Warehouse Capacity",severity: "Low",    impact: "Finished goods at 84%",   region: "Warehouse 2", color: "#10b981" },
    { issue: "Customs Clearance", severity: "Medium", impact: "Delayed 12 shipments",    region: "East Port",   color: "#f59e0b" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "14px 28px", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#0ea5e9", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 2px 8px rgba(14,165,233,0.35)" }}>🏭</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {lastUpdated}</span>}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.3px" }}>Operations Performance Dashboard</h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Operations & fulfillment performance · FY 2025</p>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => { setFilter(f); setLoading(true); }} style={{
                padding: "5px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none",
                cursor: "pointer", transition: "all 0.15s",
                background: filter === f ? "#0ea5e9" : "transparent",
                color:      filter === f ? "#fff"    : "#64748b",
                boxShadow:  filter === f ? "0 1px 6px rgba(14,165,233,0.35)" : "none",
              }}>{f}</button>
            ))}
          </div>
          <button onClick={refetch} style={{ padding: "7px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Refresh</button>
          <button style={{ padding: "7px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(14,165,233,0.3)" }}>⬇ Export CSV</button>
        </div>
      </header>

      {/* ── BODY ── */}
      <main style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 22 }}>
          {kpis.map((k, i) => <KPICard key={i} {...k} loading={loading} />)}
        </div>

        {/* Row 1 — Filters + Cost Distribution + Days Outstanding */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 16, marginBottom: 16 }}>

          {/* Order Status Filter */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Order Status</h3>
            {["Overview", "Pending", "Processing", "Shipped", "Delivered", "Returns"].map(s => (
              <div key={s} onClick={() => setOrderStatus(s)} style={{
                padding: "8px 12px", borderRadius: 8, marginBottom: 4,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: orderStatus === s ? "#eff6ff" : "transparent",
                color: orderStatus === s ? "#0ea5e9" : "#64748b",
                borderLeft: orderStatus === s ? "3px solid #0ea5e9" : "3px solid transparent",
                transition: "all 0.15s",
              }}>{s}</div>
            ))}
            <div style={{ marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>Order Date</div>
              <div style={{ fontSize: 11, color: "#475569", background: "#f8fafc", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                📅 3/29/2025 – 9/17/2025
              </div>
            </div>
          </div>

          {/* Cost Distribution */}
          <Card title="Cost Distribution" subtitle="by category over time" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  {costLegend.map(l => (
                    <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                      <span style={{ color: "#64748b", fontWeight: 600 }}>{l.name}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={DEMO.costDistribution} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    {costLegend.map(l => (
                      <Bar key={l.key} dataKey={l.key} name={l.name} stackId="a" fill={l.color} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </Card>

          {/* Days Outstanding */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DaysCard label="Days Receivable Outstanding" value={40} icon="📥" color="#0ea5e9" subtitle="↓ 3 days vs last quarter" />
            <DaysCard label="Days Payable Outstanding"    value={29} icon="📤" color="#8b5cf6" subtitle="↑ 2 days vs last quarter" />
            <DaysCard label="Days Inventory Outstanding"  value={67} icon="📦" color="#f59e0b" subtitle="↓ 5 days vs last quarter" />
          </div>
        </div>

        {/* Row 2 — Gauges */}
        <Card title="Operational Performance Metrics" subtitle="Key rate indicators" badge="● Live">
          {loading ? <Skeleton h={160} /> : (
            <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16, padding: "8px 0" }}>
              <GaugeChart value={97.94} label="Perfect Order Rate"  color="#10b981" />
              <GaugeChart value={97.83} label="Order Accuracy Rate" color="#0ea5e9" />
              <GaugeChart value={97.88} label="Fill Rate"           color="#8b5cf6" />
              <GaugeChart value={88.82} label="On-Time Delivery"    color="#f59e0b" />
            </div>
          )}
        </Card>

        {/* Row 3 — Trends + Supplier */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginTop: 16, marginBottom: 16 }}>

          <Card title="On-Time Delivery Rate Trend" subtitle="Monthly performance" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={DEMO.orderFulfillment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[80, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="onTime" stroke="#10b981" strokeWidth={2.5} name="On-Time %" dot={{ r: 5, fill: "#10b981" }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Supplier Performance" subtitle="on-time, quality, cost scores" badge={`${DEMO.supplierPerformance.length} suppliers`}>
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DEMO.supplierPerformance} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="supplier" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="onTime"  name="On-Time %"  fill="#0ea5e9" radius={[4,4,0,0]} />
                  <Bar dataKey="quality" name="Quality %"  fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="cost"    name="Cost Score" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 4 — Inventory Table */}
        <Card title="Inventory Levels" subtitle="current stock vs reorder point" badge="4 categories">
          {loading ? <Skeleton h={160} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["#", "Category", "Current Stock", "Reorder Point", "Max Capacity", "Status", "Fill Level"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO.inventoryLevels.map((item, idx) => {
                    const pct = Math.round((item.current / item.max) * 100);
                    const isLow = item.current <= item.reorder * 1.2;
                    const statusColor = isLow ? "#ef4444" : pct > 80 ? "#f59e0b" : "#10b981";
                    const statusLabel = isLow ? "Low Stock" : pct > 80 ? "Near Full" : "Optimal";
                    return (
                      <tr key={item.category} style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: PALETTE[idx] + "22", color: PALETTE[idx], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                        </td>
                        <td style={{ padding: "13px 14px", fontWeight: 700, color: "#0f172a" }}>{item.category}</td>
                        <td style={{ padding: "13px 14px", color: "#475569", fontWeight: 600 }}>{item.current.toLocaleString()}</td>
                        <td style={{ padding: "13px 14px", color: "#475569" }}>{item.reorder.toLocaleString()}</td>
                        <td style={{ padding: "13px 14px", color: "#475569" }}>{item.max.toLocaleString()}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{ background: statusColor + "22", color: statusColor, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{statusLabel}</span>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 90, height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: PALETTE[idx], borderRadius: 99, transition: "width 0.8s ease" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Row 5 — Bottlenecks */}
        <div style={{ marginTop: 16 }}>
          <Card title="Active Bottlenecks & Delays" subtitle="real-time issue tracking" badge="● Live">
            {loading ? <Skeleton h={120} /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 4 }}>
                {bottlenecks.map(b => (
                  <div key={b.issue} style={{
                    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
                    padding: "14px 16px", borderLeft: `4px solid ${b.color}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{b.issue}</div>
                      <span style={{ background: b.color + "22", color: b.color, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{b.severity}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{b.impact}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>📍 {b.region}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 18, paddingBottom: 8 }}>
          Operations Dashboard · {new Date().toLocaleDateString()} · Operations Intelligence Platform
        </p>
      </main>
    </div>
  );
}