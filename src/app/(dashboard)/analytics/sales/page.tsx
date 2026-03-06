"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────
interface SalesTrendItem   { month: string; amount: number; }
interface ProductItem      { name: string; sales: number; }
interface RegionItem       { region: string; amount: number; }
interface FunnelItem       { name: string; value: number; fill: string; }
interface RepItem          { name: string; deals: number; amount: number; region: string; }
interface IndexError       { collection: string; message: string; }

interface SalesData {
  totalSales:    number;
  q1Sales:       number;
  q2Sales:       number;
  totalLeads:    number;
  convRate:      string;
  customerCount: number;
  salesTrend:    SalesTrendItem[];
  topProducts:   ProductItem[];
  byRegion:      RegionItem[];
  funnelData:    FunnelItem[];
  topReps:       RepItem[];
  usingDemo:     boolean;
}

interface KPICardProps {
  label:   string;
  value:   string;
  change:  string;
  up:      boolean;
  icon:    string;
  accent:  string;
  loading: boolean;
}

interface CardProps {
  title:     string;
  subtitle?: string;
  badge?:    string;
  children:  React.ReactNode;
}

interface ChartTipProps {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?:   string;
}

interface SkeletonProps { h?: number; w?: number | string; r?: number; }

interface IndexErrorBannerProps { errors: IndexError[]; }

// ── Constants ────────────────────────────────────────────
const FILTERS = ["Daily", "Weekly", "Monthly", "Quarterly"] as const;
type Filter = typeof FILTERS[number];

const PALETTE = ["#4f46e5","#059669","#d97706","#e11d48","#7c3aed","#0284c7"];

// ── Formatters ───────────────────────────────────────────
const fmtMoney = (v: number): string =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`;

const fmtShort = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);

// ── Extract Firebase index URL from error message ────────
function extractIndexUrl(msg = ""): string | null {
  const m = msg.match(/https:\/\/console\.firebase\.google\.com[^\s"'>]+/);
  return m ? m[0] : null;
}

// ── Index Error Banner ───────────────────────────────────
function IndexErrorBanner({ errors }: IndexErrorBannerProps) {
  if (!errors?.length) return null;
  return (
    <div style={{ padding: "12px 28px 0" }}>
      {errors.map((err, i) => {
        const url = extractIndexUrl(err.message);
        return (
          <div key={i} style={{
            background: "#fffbeb", border: "1px solid #fcd34d",
            borderRadius: 12, padding: "14px 18px", marginBottom: 10,
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#92400e" }}>
                  Missing Firestore Index —{" "}
                  <code style={{ background: "#fef3c7", padding: "1px 7px", borderRadius: 5, fontSize: 12 }}>
                    {err.collection}
                  </code>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
                  This query requires a composite index that doesn&apos;t exist yet.
                  Click the button → Firebase Console opens → click <strong>Create Index</strong> → done.
                </p>
                {!url && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#92400e", wordBreak: "break-all", fontFamily: "monospace" }}>
                    {err.message}
                  </p>
                )}
              </div>
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 18px", background: "#f59e0b", color: "#fff",
                  borderRadius: 10, fontSize: 12, fontWeight: 800,
                  textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                  boxShadow: "0 2px 10px rgba(245,158,11,0.4)",
                }}
              >
                🔗 Create Index in Firebase →
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────
function Skeleton({ h = 40, w = "100%", r = 8 }: SkeletonProps) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear",
    }} />
  );
}

// ── KPI Card ─────────────────────────────────────────────
function KPICard({ label, value, change, up, icon, accent, loading }: KPICardProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "18px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
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
function Card({ title, subtitle, badge, children }: CardProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>{subtitle}</p>}
        </div>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#f0fdf4", color: "#166534" }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Chart Tooltip ────────────────────────────────────────
function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: "2px 0" }}>
          {p.name}: {p.value > 999 ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Demo fallback data ────────────────────────────────────
const DEMO: Pick<SalesData, "salesTrend" | "topProducts" | "byRegion" | "funnelData" | "topReps"> = {
  salesTrend: [
    { month: "Jan", amount: 320000 }, { month: "Feb", amount: 410000 }, { month: "Mar", amount: 375000 },
    { month: "Apr", amount: 490000 }, { month: "May", amount: 530000 }, { month: "Jun", amount: 480000 },
    { month: "Jul", amount: 620000 }, { month: "Aug", amount: 590000 }, { month: "Sep", amount: 660000 },
    { month: "Oct", amount: 720000 }, { month: "Nov", amount: 780000 }, { month: "Dec", amount: 850000 },
  ],
  topProducts: [
    { name: "Product A", sales: 980000 }, { name: "Product B", sales: 760000 },
    { name: "Product C", sales: 620000 }, { name: "Product D", sales: 480000 },
    { name: "Product E", sales: 340000 }, { name: "Product F", sales: 210000 },
  ],
  byRegion: [
    { region: "North", amount: 1200000 }, { region: "South", amount: 980000 },
    { region: "East",  amount: 860000  }, { region: "West",  amount: 720000 }, { region: "Central", amount: 540000 },
  ],
  funnelData: [
    { name: "New",       value: 1248, fill: "#4f46e5" }, { name: "Contacted", value: 842,  fill: "#0284c7" },
    { name: "Qualified", value: 524,  fill: "#d97706" }, { name: "Converted", value: 307,  fill: "#059669" },
  ],
  topReps: [
    { name: "Alex Johnson",  deals: 48, amount: 620000, region: "North"   },
    { name: "Maria Garcia",  deals: 41, amount: 540000, region: "West"    },
    { name: "James Lee",     deals: 37, amount: 490000, region: "East"    },
    { name: "Sara Williams", deals: 33, amount: 420000, region: "South"   },
    { name: "Tom Brown",     deals: 29, amount: 360000, region: "Central" },
  ],
};

// ── Firestore data hook ───────────────────────────────────
function useSalesData(_filter: Filter) {
  const [data,        setData]        = useState<SalesData | null>(null);
  const [loading,     setLoading]     = useState<boolean>(true);
  const [indexErrors, setIndexErrors] = useState<IndexError[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const errs: IndexError[] = [];

    async function safeQuery(collectionName: string, q: ReturnType<typeof query>): Promise<Record<string, unknown>[]> {
      try {
        const snap = await getDocs(q);
        return snap.docs.map(d => ({
  id: d.id,
  ...(d.data() as Record<string, unknown>)
}));
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const isIndexError =
          err.code === "failed-precondition" ||
          err.message?.toLowerCase().includes("index") ||
          err.message?.includes("console.firebase.google.com");
        if (isIndexError) {
          errs.push({ collection: collectionName, message: err.message ?? "" });
        } else {
          console.error(`[${collectionName}]`, err.message);
        }
        return [];
      }
    }

    const [sales, leads, customers] = await Promise.all([
      safeQuery("sales",     query(collection(db, "sales"),     orderBy("createdAt", "asc"))),
      safeQuery("leads",     query(collection(db, "leads"),     orderBy("createdAt", "desc"))),
      safeQuery("customers", query(collection(db, "customers"), orderBy("createdAt", "desc"))),
    ]);

    setIndexErrors(errs);

    // ── Aggregations ───────────────────────────────────────
    const monthMap:   Record<string, number> = {};
    const productMap: Record<string, number> = {};
    const regionMap:  Record<string, number> = {};
    const repMap:     Record<string, { deals: number; amount: number; region: string }> = {};

    sales.forEach(s => {
      const mo = (s.month as string) || "—";
      monthMap[mo] = (monthMap[mo] || 0) + (Number(s.amount) || 0);
      if (s.product) {
        const p = s.product as string;
        productMap[p] = (productMap[p] || 0) + (Number(s.amount) || 0);
      }
      if (s.region) {
        const r = s.region as string;
        regionMap[r] = (regionMap[r] || 0) + (Number(s.amount) || 0);
      }
      if (s.rep) {
        const rep = s.rep as string;
        if (!repMap[rep]) repMap[rep] = { deals: 0, amount: 0, region: (s.region as string) || "—" };
        repMap[rep].deals++;
        repMap[rep].amount += Number(s.amount) || 0;
      }
    });

    const salesTrend:  SalesTrendItem[] = Object.entries(monthMap).map(([month, amount]) => ({ month, amount }));
    const topProducts: ProductItem[]    = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, sales]) => ({ name, sales }));
    const byRegion:    RegionItem[]     = Object.entries(regionMap).sort((a, b) => b[1] - a[1]).map(([region, amount]) => ({ region, amount }));
    const topReps:     RepItem[]        = Object.entries(repMap).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5).map(([name, v]) => ({ name, ...v }));

    const funnelColors = ["#4f46e5", "#0284c7", "#d97706", "#059669"];
    const funnelData: FunnelItem[] = ["new", "contacted", "qualified", "converted"].map((st, i) => ({
      name:  st.charAt(0).toUpperCase() + st.slice(1),
      value: leads.filter(l => l.status === st).length,
      fill:  funnelColors[i],
    }));

    const totalSales    = sales.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const half          = Math.floor(sales.length / 2);
    const converted     = leads.filter(l => l.status === "converted").length;
    const convRate      = leads.length ? ((converted / leads.length) * 100).toFixed(1) : "0";
    const empty         = !sales.length && !leads.length;

    setData({
      totalSales,
      q1Sales:       sales.slice(0, half).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      q2Sales:       sales.slice(half).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      totalLeads:    leads.length,
      convRate,
      customerCount: customers.length,
      salesTrend:    salesTrend.length             ? salesTrend   : DEMO.salesTrend,
      topProducts:   topProducts.length            ? topProducts  : DEMO.topProducts,
      byRegion:      byRegion.length               ? byRegion     : DEMO.byRegion,
      funnelData:    funnelData.some(f => f.value > 0) ? funnelData : DEMO.funnelData,
      topReps:       topReps.length                ? topReps      : DEMO.topReps,
      usingDemo:     empty,
    });

    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, [_filter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, indexErrors, lastUpdated, refetch: fetchData };
}

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function SalesDashboard() {
  const [filter, setFilter] = useState<Filter>("Monthly");
  const { data, loading, indexErrors, lastUpdated, refetch } = useSalesData(filter);

  const kpis: KPICardProps[] = [
    { label: "Total Sales",      value: data ? fmtMoney(data.totalSales)              : "—", change: "18.4%", up: true,  icon: "💵", accent: "#4f46e5", loading },
    { label: "Q1 Sales",         value: data ? fmtMoney(data.q1Sales)                : "—", change: "12.1%", up: true,  icon: "📅", accent: "#0284c7", loading },
    { label: "Q2 Sales",         value: data ? fmtMoney(data.q2Sales)                : "—", change: "22.8%", up: true,  icon: "📅", accent: "#059669", loading },
    { label: "Total Leads",      value: data ? data.totalLeads.toLocaleString()       : "—", change: "9.3%",  up: true,  icon: "🎯", accent: "#d97706", loading },
    { label: "Conversion Rate",  value: data ? `${data.convRate}%`                   : "—", change: "2.1%",  up: true,  icon: "🔄", accent: "#7c3aed", loading },
    { label: "Customers",        value: data ? data.customerCount.toLocaleString()   : "—", change: "5.7%",  up: true,  icon: "👤", accent: "#e11d48", loading },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "14px 28px", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#059669", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 2px 8px rgba(5,150,105,0.35)" }}>💵</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {lastUpdated}</span>}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.3px" }}>Sales Dashboard</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Sales performance &amp; revenue · FY 2025</p>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none",
                cursor: "pointer", transition: "all 0.15s",
                background: filter === f ? "#059669" : "transparent",
                color:      filter === f ? "#fff"    : "#64748b",
                boxShadow:  filter === f ? "0 1px 6px rgba(5,150,105,0.3)" : "none",
              }}>{f}</button>
            ))}
          </div>
          <button onClick={refetch} style={{ padding: "7px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Refresh</button>
          <button style={{ padding: "7px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(5,150,105,0.3)" }}>⬇ Export CSV</button>
        </div>
      </header>

      {/* ── INDEX ERROR BANNERS ──────────────────────────────── */}
      <IndexErrorBanner errors={indexErrors} />

      {/* ── Demo notice ─────────────────────────────────────── */}
      {data?.usingDemo && !loading && !indexErrors.length && (
        <div style={{ margin: "12px 28px 0", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
          ℹ️ No data in Firestore yet — showing demo data. Add documents to <strong>sales</strong>, <strong>leads</strong>, <strong>customers</strong>.
        </div>
      )}

      {/* ── BODY ────────────────────────────────────────────── */}
      <main style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 22 }}>
          {kpis.map((k, i) => <KPICard key={i} {...k} />)}
        </div>

        {/* Row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>
          <Card title="Monthly Sales Trend" subtitle="sales · ordered by createdAt" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data!.salesTrend}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#059669" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={2.5} fill="url(#sg)" name="Sales" dot={false} activeDot={{ r: 5, fill: "#059669" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Top Products by Revenue" subtitle="sales · grouped by product" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data!.topProducts} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="sales" name="Revenue" radius={[0, 6, 6, 0]}>
                    {data!.topProducts.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>
          <Card title="Sales by Region" subtitle="sales · grouped by region" badge="● Live">
            {loading ? <Skeleton h={240} /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data!.byRegion} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="region" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="amount" name="Sales" radius={[6, 6, 0, 0]}>
                      {data!.byRegion.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {data!.byRegion.map((r, i) => (
                    <div key={r.region} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[i % PALETTE.length] }} />
                      <span style={{ color: "#64748b" }}>{r.region}:</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmtMoney(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card title="Lead Conversion Funnel" subtitle="leads · grouped by status" badge="● Live">
            {loading ? <Skeleton h={240} /> : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                  {data!.funnelData.map(stage => {
                    const max = data!.funnelData[0]?.value || 1;
                    const pct = Math.round((stage.value / max) * 100);
                    return (
                      <div key={stage.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "#334155" }}>{stage.name}</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <span style={{ color: "#94a3b8" }}>{pct}%</span>
                            <span style={{ fontWeight: 800, color: "#0f172a" }}>{stage.value.toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ width: "100%", height: 10, background: "#f1f5f9", borderRadius: 99 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: stage.fill, borderRadius: 99, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>Overall Conversion Rate</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#059669" }}>{data?.convRate}%</span>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Top Reps Table */}
        <Card title="Top Sales Representatives" subtitle="sales · grouped by rep field" badge={`${data?.topReps?.length ?? 0} reps`}>
          {loading ? <Skeleton h={200} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["#", "Sales Rep", "Region", "Deals", "Revenue", "Performance"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.topReps.map((rep, idx) => {
                    const max = data!.topReps[0]?.amount || 1;
                    const pct = Math.round((rep.amount / max) * 100);
                    return (
                      <tr
                        key={rep.name}
                        style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: idx === 0 ? "#fef9c3" : idx === 1 ? "#f1f5f9" : "#fef3f2", color: idx === 0 ? "#a16207" : idx === 1 ? "#475569" : "#9f1239", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: PALETTE[idx % PALETTE.length] + "22", color: PALETTE[idx % PALETTE.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{rep.name.charAt(0)}</div>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{rep.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px", color: "#64748b" }}>{rep.region}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{ background: "#eff6ff", color: "#3b82f6", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{rep.deals}</span>
                        </td>
                        <td style={{ padding: "13px 14px", color: "#059669", fontWeight: 800, fontSize: 14 }}>{fmtMoney(rep.amount)}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 90, height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: PALETTE[idx % PALETTE.length], borderRadius: 99, transition: "width 0.8s ease" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data!.topReps.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
                        No rep data — add a <strong>rep</strong> field to your <strong>sales</strong> documents.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 18, paddingBottom: 8 }}>
          Sales Dashboard · Office Tracker · {new Date().toLocaleDateString()} · Firebase connected
        </p>
      </main>
    </div>
  );
}