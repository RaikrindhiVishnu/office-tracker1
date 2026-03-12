"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, ReferenceLine,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────
interface CashFlowItem      { month: string; inflow: number; outflow: number; net: number; }
interface ProfitMarginItem  { month: string; revenue: number; cost: number; margin: number; }
interface BudgetItem        { category: string; budget: number; actual: number; variance: number; }
interface ForecastItem      { month: string; actual: number | null; forecast: number; }
interface ExpenseItem       { category: string; amount: number; pct: number; }
interface IndexError        { collection: string; message: string; }

interface FinancialData {
  totalRevenue:     number;
  totalCost:        number;
  netProfit:        number;
  profitMargin:     string;
  accountsReceivable: number;
  accountsPayable:  number;
  equityRatio:      string;
  debtEquity:       string;
  cashFlowTrend:    CashFlowItem[];
  profitTrend:      ProfitMarginItem[];
  budgetItems:      BudgetItem[];
  forecastData:     ForecastItem[];
  topExpenses:      ExpenseItem[];
  usingDemo:        boolean;
}

interface KPICardProps {
  label:   string;
  value:   string;
  change:  string;
  up:      boolean;
  icon:    string;
  accent:  string;
  sub?:    string;
  loading: boolean;
}

interface GaugeProps   { value: number; max: number; color: string; label: string; }
interface CardProps    { title: string; subtitle?: string; badge?: string; children: React.ReactNode; }
interface ChartTipProps{ active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; }
interface SkeletonProps{ h?: number; w?: number | string; r?: number; }
interface IndexErrorBannerProps { errors: IndexError[]; }

// ── Constants ────────────────────────────────────────────
const FILTERS = ["Daily", "Weekly", "Monthly", "Quarterly"] as const;
type Filter = typeof FILTERS[number];

const PALETTE = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

// ── Formatters ───────────────────────────────────────────
const fmtMoney = (v: number): string =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(1)}K`
  : `$${v.toLocaleString()}`;

const fmtShort = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);

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
          <div key={i} style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#92400e" }}>
                  Missing Firestore Index — <code style={{ background: "#fef3c7", padding: "1px 7px", borderRadius: 5, fontSize: 12 }}>{err.collection}</code>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
                  Click the button → Firebase Console → <strong>Create Index</strong> → done.
                </p>
                {!url && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#92400e", wordBreak: "break-all", fontFamily: "monospace" }}>{err.message}</p>}
              </div>
            </div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "#f59e0b", color: "#fff", borderRadius: 10, fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 2px 10px rgba(245,158,11,0.4)" }}>
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
    <div style={{ height: h, width: w, borderRadius: r, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear" }} />
  );
}

// ── Gauge ────────────────────────────────────────────────
function Gauge({ value, max, color, label }: GaugeProps) {
  const pct  = Math.min((value / max) * 100, 100);
  const r    = 42;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * (circ * 0.75);
  const gap  = circ - dash;
  const rot  = -225;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 100, height: 60, overflow: "hidden" }}>
        <svg width={100} height={100} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={50} cy={50} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" transform={`rotate(${rot} 50 50)`} />
          <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${dash} ${gap + circ * 0.25}`} strokeLinecap="round" transform={`rotate(${rot} 50 50)`} style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div style={{ position: "absolute", bottom: 0, width: "100%", textAlign: "center", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
          {value.toFixed(1)}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────
function KPICard({ label, value, change, up, icon, accent, sub, loading }: KPICardProps) {
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
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>{value}</div>
      )}
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────
function Card({ title, subtitle, badge, children }: CardProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>{subtitle}</p>}
        </div>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#eff6ff", color: "#1d4ed8" }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────
function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: "2px 0" }}>
          {p.name}: {typeof p.value === "number" && p.value > 999 ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Demo data ─────────────────────────────────────────────
const DEMO: Pick<FinancialData, "cashFlowTrend" | "profitTrend" | "budgetItems" | "forecastData" | "topExpenses"> = {
  cashFlowTrend: [
    { month: "Jan", inflow: 620000, outflow: 410000, net:  210000 },
    { month: "Feb", inflow: 540000, outflow: 390000, net:  150000 },
    { month: "Mar", inflow: 710000, outflow: 460000, net:  250000 },
    { month: "Apr", inflow: 680000, outflow: 520000, net:  160000 },
    { month: "May", inflow: 830000, outflow: 490000, net:  340000 },
    { month: "Jun", inflow: 760000, outflow: 550000, net:  210000 },
    { month: "Jul", inflow: 920000, outflow: 580000, net:  340000 },
    { month: "Aug", inflow: 870000, outflow: 610000, net:  260000 },
    { month: "Sep", inflow: 1020000,outflow: 640000, net:  380000 },
    { month: "Oct", inflow: 980000, outflow: 660000, net:  320000 },
    { month: "Nov", inflow: 1150000,outflow: 700000, net:  450000 },
    { month: "Dec", inflow: 1320000,outflow: 760000, net:  560000 },
  ],
  profitTrend: [
    { month: "Jan", revenue: 620000, cost: 410000, margin: 33.9 },
    { month: "Feb", revenue: 540000, cost: 390000, margin: 27.8 },
    { month: "Mar", revenue: 710000, cost: 460000, margin: 35.2 },
    { month: "Apr", revenue: 680000, cost: 520000, margin: 23.5 },
    { month: "May", revenue: 830000, cost: 490000, margin: 41.0 },
    { month: "Jun", revenue: 760000, cost: 550000, margin: 27.6 },
    { month: "Jul", revenue: 920000, cost: 580000, margin: 36.9 },
    { month: "Aug", revenue: 870000, cost: 610000, margin: 29.9 },
    { month: "Sep", revenue: 1020000,cost: 640000, margin: 37.3 },
    { month: "Oct", revenue: 980000, cost: 660000, margin: 32.7 },
    { month: "Nov", revenue: 1150000,cost: 700000, margin: 39.1 },
    { month: "Dec", revenue: 1320000,cost: 760000, margin: 42.4 },
  ],
  budgetItems: [
    { category: "Operations",  budget: 420000, actual: 398000, variance:  22000 },
    { category: "Marketing",   budget: 180000, actual: 204000, variance: -24000 },
    { category: "R&D",         budget: 240000, actual: 218000, variance:  22000 },
    { category: "HR & Payroll",budget: 310000, actual: 315000, variance:  -5000 },
    { category: "IT & Infra",  budget: 120000, actual:  98000, variance:  22000 },
    { category: "Sales",       budget: 160000, actual: 172000, variance: -12000 },
  ],
  forecastData: [
    { month: "Jul", actual: 920000,  forecast: 900000  },
    { month: "Aug", actual: 870000,  forecast: 950000  },
    { month: "Sep", actual: 1020000, forecast: 1000000 },
    { month: "Oct", actual: 980000,  forecast: 1050000 },
    { month: "Nov", actual: 1150000, forecast: 1100000 },
    { month: "Dec", actual: 1320000, forecast: 1200000 },
    { month: "Jan", actual: null,    forecast: 1350000 },
    { month: "Feb", actual: null,    forecast: 1400000 },
    { month: "Mar", actual: null,    forecast: 1480000 },
  ],
  topExpenses: [
    { category: "Salaries",      amount: 580000, pct: 38 },
    { category: "COGS",          amount: 320000, pct: 21 },
    { category: "Marketing",     amount: 204000, pct: 13 },
    { category: "R&D",           amount: 218000, pct: 14 },
    { category: "IT & Infra",    amount:  98000, pct:  6 },
    { category: "Other",         amount: 122000, pct:  8 },
  ],
};

// ── Firestore hook ────────────────────────────────────────
function useFinancialData(_filter: Filter) {
  const [data,        setData]        = useState<FinancialData | null>(null);
  const [loading,     setLoading]     = useState<boolean>(true);
  const [indexErrors, setIndexErrors] = useState<IndexError[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const errs: IndexError[] = [];

    async function safeQuery(
      collectionName: string,
      q: ReturnType<typeof query>
    ): Promise<Record<string, unknown>[]> {
      try {
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const isIndexError =
          err.code === "failed-precondition" ||
          err.message?.toLowerCase().includes("index") ||
          err.message?.includes("console.firebase.google.com");
        if (isIndexError) errs.push({ collection: collectionName, message: err.message ?? "" });
        else console.error(`[${collectionName}]`, err.message);
        return [];
      }
    }

    const [transactions, budgets, forecasts] = await Promise.all([
      safeQuery("transactions", query(collection(db, "transactions"), orderBy("createdAt", "asc"))),
      safeQuery("budgets",      query(collection(db, "budgets"),      orderBy("category",  "asc"))),
      safeQuery("forecasts",    query(collection(db, "forecasts"),    orderBy("month",     "asc"))),
    ]);

    setIndexErrors(errs);

    // ── Aggregations ───────────────────────────────────────
    const monthMap:   Record<string, { inflow: number; outflow: number }> = {};
    const expenseMap: Record<string, number> = {};

    transactions.forEach(t => {
      const mo   = (t.month as string) || "—";
      const amt  = Number(t.amount) || 0;
      const type = (t.type as string) || "outflow";
      if (!monthMap[mo]) monthMap[mo] = { inflow: 0, outflow: 0 };
      if (type === "inflow") monthMap[mo].inflow += amt;
      else                   monthMap[mo].outflow += amt;
      if (t.category) {
        const cat = t.category as string;
        expenseMap[cat] = (expenseMap[cat] || 0) + (type === "outflow" ? amt : 0);
      }
    });

    const cashFlowTrend: CashFlowItem[] = Object.entries(monthMap).map(([month, v]) => ({
      month, inflow: v.inflow, outflow: v.outflow, net: v.inflow - v.outflow,
    }));

    const profitTrend: ProfitMarginItem[] = cashFlowTrend.map(r => ({
      month:   r.month,
      revenue: r.inflow,
      cost:    r.outflow,
      margin:  r.inflow ? parseFloat(((1 - r.outflow / r.inflow) * 100).toFixed(1)) : 0,
    }));

    const budgetItems: BudgetItem[] = budgets.map(b => ({
      category: (b.category as string)  || "—",
      budget:   Number(b.budget)        || 0,
      actual:   Number(b.actual)        || 0,
      variance: Number(b.budget) - Number(b.actual),
    }));

    const forecastData: ForecastItem[] = forecasts.map(f => ({
      month:    (f.month    as string)  || "—",
      actual:   f.actual != null ? Number(f.actual) : null,
      forecast: Number(f.forecast)     || 0,
    }));

    const totalExpense = Object.values(expenseMap).reduce((s, v) => s + v, 0);
    const topExpenses: ExpenseItem[] = Object.entries(expenseMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([category, amount]) => ({ category, amount, pct: totalExpense ? Math.round((amount / totalExpense) * 100) : 0 }));

    const totalRevenue = cashFlowTrend.reduce((s, r) => s + r.inflow,   0);
    const totalCost    = cashFlowTrend.reduce((s, r) => s + r.outflow,  0);
    const netProfit    = totalRevenue - totalCost;
    const profitMargin = totalRevenue ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";

    const ar = transactions.filter(t => t.type === "receivable").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const ap = transactions.filter(t => t.type === "payable").reduce((s, t)    => s + (Number(t.amount) || 0), 0);

    const empty = !transactions.length && !budgets.length;

    setData({
      totalRevenue,
      totalCost,
      netProfit,
      profitMargin,
      accountsReceivable: ar   || 6621280,
      accountsPayable:    ap   || 1630270,
      equityRatio:        "75.38",
      debtEquity:         "1.10",
      cashFlowTrend:  cashFlowTrend.length  ? cashFlowTrend  : DEMO.cashFlowTrend,
      profitTrend:    profitTrend.length    ? profitTrend    : DEMO.profitTrend,
      budgetItems:    budgetItems.length    ? budgetItems    : DEMO.budgetItems,
      forecastData:   forecastData.length   ? forecastData   : DEMO.forecastData,
      topExpenses:    topExpenses.length    ? topExpenses    : DEMO.topExpenses,
      usingDemo:      empty,
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
export default function FinancialDashboard() {
  const [filter, setFilter] = useState<Filter>("Monthly");
  const { data, loading, indexErrors, lastUpdated, refetch } = useFinancialData(filter);

  const kpis: KPICardProps[] = [
    { label: "Total Revenue",          value: data ? fmtMoney(data.totalRevenue)        : "—", change: "18.4%", up: true,  icon: "💰", accent: "#2563eb", loading },
    { label: "Total Cost",             value: data ? fmtMoney(data.totalCost)           : "—", change: "8.2%",  up: false, icon: "💸", accent: "#dc2626", loading },
    { label: "Net Profit",             value: data ? fmtMoney(data.netProfit)           : "—", change: "24.1%", up: true,  icon: "📈", accent: "#059669", loading },
    { label: "Profit Margin",          value: data ? `${data.profitMargin}%`            : "—", change: "3.2%",  up: true,  icon: "📊", accent: "#7c3aed", loading },
    { label: "Accounts Receivable",    value: data ? fmtMoney(data.accountsReceivable)  : "—", change: "5.7%",  up: true,  icon: "🧾", accent: "#0891b2", loading, sub: "Avg. 14 days" },
    { label: "Accounts Payable",       value: data ? fmtMoney(data.accountsPayable)     : "—", change: "2.3%",  up: false, icon: "📋", accent: "#d97706", loading, sub: "Avg. 7 days"  },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 28px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#2563eb", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 2px 8px rgba(37,99,235,0.35)" }}>💵</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb" }} />
              <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {lastUpdated}</span>}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.3px" }}>Financial Dashboard</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Revenue · Costs · Cash Flow · Forecasts · FY 2025</p>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.15s", background: filter === f ? "#2563eb" : "transparent", color: filter === f ? "#fff" : "#64748b", boxShadow: filter === f ? "0 1px 6px rgba(37,99,235,0.35)" : "none" }}>{f}</button>
            ))}
          </div>
          <button onClick={refetch} style={{ padding: "7px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Refresh</button>
          <button style={{ padding: "7px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}>⬇ Export CSV</button>
        </div>
      </header>

      <IndexErrorBanner errors={indexErrors} />

      {/* {data?.usingDemo && !loading && !indexErrors.length && (
        <div style={{ margin: "12px 28px 0", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
          ℹ️ No data in Firestore yet — showing demo data. Add documents to <strong>transactions</strong>, <strong>budgets</strong>, <strong>forecasts</strong>.
        </div>
      )} */}

      <main style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 22 }}>
          {kpis.map((k, i) => <KPICard key={i} {...k} />)}
        </div>

        {/* Gauges Row */}
        <div style={{ marginBottom: 16 }}>
          <Card title="Key Financial Ratios" subtitle="equity ratio · debt/equity · days outstanding" badge="● Live">
            {loading ? <Skeleton h={100} /> : (
              <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16, padding: "8px 0" }}>
                <Gauge value={parseFloat(data?.equityRatio ?? "75.38")} max={100} color="#2563eb" label={`Equity Ratio\n${data?.equityRatio}%`} />
                <Gauge value={parseFloat(data?.debtEquity  ?? "1.10")}  max={5}   color="#dc2626" label={`Debt/Equity\n${data?.debtEquity}x`} />
                <Gauge value={14}  max={60}  color="#059669" label={"AR Days\n14 days"} />
                <Gauge value={7}   max={60}  color="#d97706" label={"AP Days\n7 days"}  />
                <Gauge value={parseFloat(data?.profitMargin ?? "35")} max={100} color="#7c3aed" label={`Profit Margin\n${data?.profitMargin}%`} />
              </div>
            )}
          </Card>
        </div>

        {/* Row 1 — Cash Flow + Profit Trend */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>

          <Card title="Cash Flow Statement" subtitle="transactions · inflow vs outflow by month" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data!.cashFlowTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="inflow"  name="Inflow"  fill="#2563eb" opacity={0.8} radius={[4,4,0,0]} barSize={12} />
                  <Bar dataKey="outflow" name="Outflow" fill="#dc2626" opacity={0.7} radius={[4,4,0,0]} barSize={12} />
                  <Line type="monotone" dataKey="net" name="Net" stroke="#059669" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Revenue vs Cost & Margin" subtitle="transactions · profit margin trend" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data!.profitTrend}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area yAxisId="left"  type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} fill="url(#rg)" dot={false} />
                  <Line yAxisId="left"  type="monotone" dataKey="cost"    name="Cost"    stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  <Line yAxisId="right" type="monotone" dataKey="margin"  name="Margin %" stroke="#059669" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 2 — Budget Utilization + Forecast */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>

          <Card title="Budget Utilization & Variance" subtitle="budgets · actual vs planned" badge="● Live">
            {loading ? <Skeleton h={240} /> : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                  {data!.budgetItems.map((item, i) => {
                    const utilPct  = Math.min(Math.round((item.actual / item.budget) * 100), 130);
                    const overBudget = item.variance < 0;
                    return (
                      <div key={item.category}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: "#334155" }}>{item.category}</span>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>{fmtMoney(item.budget)} budget</span>
                            <span style={{ fontWeight: 700, color: overBudget ? "#dc2626" : "#059669", fontSize: 11, padding: "1px 7px", borderRadius: 20, background: overBudget ? "#fee2e2" : "#dcfce7" }}>
                              {overBudget ? "↑" : "↓"} {fmtMoney(Math.abs(item.variance))}
                            </span>
                          </div>
                        </div>
                        <div style={{ width: "100%", height: 8, background: "#f1f5f9", borderRadius: 99, position: "relative" }}>
                          <div style={{ width: `${Math.min(utilPct, 100)}%`, height: "100%", background: overBudget ? "#dc2626" : PALETTE[i % PALETTE.length], borderRadius: 99, transition: "width 0.8s ease" }} />
                          {overBudget && <div style={{ position: "absolute", right: 0, top: -2, width: 2, height: 12, background: "#dc2626", borderRadius: 1 }} />}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{utilPct}% utilised · Actual: {fmtMoney(item.actual)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card title="Revenue Forecast vs Actual" subtitle="forecasts · projected revenue" badge="● Live">
            {loading ? <Skeleton h={240} /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={data!.forecastData}>
                    <defs>
                      <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="forecast" name="Forecast" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 3" fill="url(#fg)" dot={false} />
                    <Line type="monotone" dataKey="actual"   name="Actual"   stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><div style={{ width: 12, height: 3, background: "#2563eb", borderRadius: 1 }} /><span style={{ color: "#64748b" }}>Actual</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><div style={{ width: 12, height: 3, background: "#7c3aed", borderRadius: 1, borderTop: "1px dashed #7c3aed" }} /><span style={{ color: "#64748b" }}>Forecast</span></div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Expense Breakdown Table */}
        <Card title="Expense Breakdown" subtitle="transactions · top expenses by category" badge={`${data?.topExpenses?.length ?? 0} categories`}>
          {loading ? <Skeleton h={200} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["#", "Category", "Amount", "% of Total", "Distribution"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.topExpenses.map((exp, idx) => (
                    <tr
                      key={exp.category}
                      style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: idx === 0 ? "#fef9c3" : idx === 1 ? "#f1f5f9" : "#fef3f2", color: idx === 0 ? "#a16207" : idx === 1 ? "#475569" : "#9f1239", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE[idx % PALETTE.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{exp.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px", color: "#dc2626", fontWeight: 800, fontSize: 14 }}>{fmtMoney(exp.amount)}</td>
                      <td style={{ padding: "13px 14px" }}>
                        <span style={{ background: "#eff6ff", color: "#2563eb", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{exp.pct}%</span>
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 120, height: 6, background: "#f1f5f9", borderRadius: 99 }}>
                            <div style={{ width: `${exp.pct}%`, height: "100%", background: PALETTE[idx % PALETTE.length], borderRadius: 99, transition: "width 0.8s ease" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{exp.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data!.topExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
                        No expense data — add documents with <strong>type: &quot;outflow&quot;</strong> and a <strong>category</strong> field to <strong>transactions</strong>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 18, paddingBottom: 8 }}>
          Financial Dashboard · Finance Team · {new Date().toLocaleDateString()} · Firebase connected
        </p>
      </main>
    </div>
  );
}