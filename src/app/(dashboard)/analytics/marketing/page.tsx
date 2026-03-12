"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────
interface TrafficTrendItem  { month: string; sessions: number; }
interface ChannelItem       { channel: string; conversions: number; spend: number; }
interface CampaignItem      { name: string; impressions: number; clicks: number; ctr: number; }
interface FunnelItem        { name: string; value: number; fill: string; }
interface SocialItem        { platform: string; followers: number; engagement: number; }
interface IndexError        { collection: string; message: string; }

interface MarketingData {
  totalReach:      number;
  totalLeads:      number;
  convRate:        string;
  totalSpend:      number;
  roi:             string;
  ctr:             string;
  trafficTrend:    TrafficTrendItem[];
  byChannel:       ChannelItem[];
  campaigns:       CampaignItem[];
  funnelData:      FunnelItem[];
  socialStats:     SocialItem[];
  usingDemo:       boolean;
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

const PALETTE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

// ── Formatters ───────────────────────────────────────────
const fmtMoney = (v: number): string =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`;

const fmtShort = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);

// ── Extract Firebase index URL ───────────────────────────
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
                  This query requires a composite index. Click the button → Firebase Console opens → click{" "}
                  <strong>Create Index</strong> → done.
                </p>
                {!url && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#92400e", wordBreak: "break-all", fontFamily: "monospace" }}>
                    {err.message}
                  </p>
                )}
              </div>
            </div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 18px", background: "#f59e0b", color: "#fff",
                borderRadius: 10, fontSize: 12, fontWeight: 800,
                textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                boxShadow: "0 2px 10px rgba(245,158,11,0.4)",
              }}>
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
function Card({ title, subtitle, badge, children }: CardProps) {
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

// ── Demo data ─────────────────────────────────────────────
const DEMO: Pick<MarketingData, "trafficTrend" | "byChannel" | "campaigns" | "funnelData" | "socialStats"> = {
  trafficTrend: [
    { month: "Jan", sessions: 48000 }, { month: "Feb", sessions: 55000 },
    { month: "Mar", sessions: 52000 }, { month: "Apr", sessions: 63000 },
    { month: "May", sessions: 71000 }, { month: "Jun", sessions: 68000 },
    { month: "Jul", sessions: 80000 }, { month: "Aug", sessions: 76000 },
    { month: "Sep", sessions: 89000 }, { month: "Oct", sessions: 94000 },
    { month: "Nov", sessions: 102000 },{ month: "Dec", sessions: 118000 },
  ],
  byChannel: [
    { channel: "Paid Search",  conversions: 5234, spend: 42000 },
    { channel: "Social Ads",   conversions: 4108, spend: 31000 },
    { channel: "Email",        conversions: 3890, spend: 8000  },
    { channel: "Organic SEO",  conversions: 3210, spend: 0     },
    { channel: "Referral",     conversions: 2292, spend: 12000 },
    { channel: "Display",      conversions: 1540, spend: 18000 },
  ],
  campaigns: [
    { name: "Summer Sale",     impressions: 980000, clicks: 42000, ctr: 4.3 },
    { name: "Brand Awareness", impressions: 760000, clicks: 21000, ctr: 2.8 },
    { name: "Retargeting",     impressions: 340000, clicks: 18200, ctr: 5.4 },
    { name: "Product Launch",  impressions: 520000, clicks: 14800, ctr: 2.8 },
    { name: "Newsletter",      impressions: 210000, clicks: 14300, ctr: 6.8 },
  ],
  funnelData: [
    { name: "Awareness",   value: 152000, fill: "#0ea5e9" },
    { name: "Interest",    value: 84000,  fill: "#8b5cf6" },
    { name: "Consideration",value: 38000, fill: "#f59e0b" },
    { name: "Converted",   value: 18734,  fill: "#10b981" },
  ],
  socialStats: [
    { platform: "Twitter / X",   followers: 16134, engagement: 3.2 },
    { platform: "LinkedIn",      followers: 24507, engagement: 4.8 },
    { platform: "Facebook",      followers: 32268, engagement: 2.1 },
    { platform: "Instagram",     followers: 11840, engagement: 5.9 },
  ],
};

// ── Firestore hook ────────────────────────────────────────
function useMarketingData(_filter: Filter) {
  const [data,        setData]        = useState<MarketingData | null>(null);
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
        if (isIndexError) {
          errs.push({ collection: collectionName, message: err.message ?? "" });
        } else {
          console.error(`[${collectionName}]`, err.message);
        }
        return [];
      }
    }

    const [campaigns, leads, social] = await Promise.all([
      safeQuery("campaigns", query(collection(db, "campaigns"), orderBy("createdAt", "desc"))),
      safeQuery("leads",     query(collection(db, "leads"),     orderBy("createdAt", "desc"))),
      safeQuery("social",    query(collection(db, "social"),    orderBy("platform",  "asc"))),
    ]);

    setIndexErrors(errs);

    // ── Aggregations ───────────────────────────────────────
    const monthMap:   Record<string, number> = {};
    const channelMap: Record<string, { conversions: number; spend: number }> = {};

    campaigns.forEach(c => {
      const mo = (c.month as string) || "—";
      monthMap[mo] = (monthMap[mo] || 0) + (Number(c.sessions) || 0);
      if (c.channel) {
        const ch = c.channel as string;
        if (!channelMap[ch]) channelMap[ch] = { conversions: 0, spend: 0 };
        channelMap[ch].conversions += Number(c.conversions) || 0;
        channelMap[ch].spend       += Number(c.spend)       || 0;
      }
    });

    const trafficTrend = Object.entries(monthMap).map(([month, sessions]) => ({ month, sessions }));
    const byChannel    = Object.entries(channelMap)
      .sort((a, b) => b[1].conversions - a[1].conversions)
      .map(([channel, v]) => ({ channel, ...v }));

    const campaignRows: CampaignItem[] = campaigns.map(c => ({
      name:        (c.name as string)              || "—",
      impressions: Number(c.impressions)           || 0,
      clicks:      Number(c.clicks)                || 0,
      ctr:         parseFloat((c.ctr as string))   || 0,
    })).sort((a, b) => b.impressions - a.impressions).slice(0, 5);

    const funnelColors = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981"];
    const funnelStages = ["awareness", "interest", "consideration", "converted"];
    const funnelData: FunnelItem[] = funnelStages.map((st, i) => ({
      name:  st.charAt(0).toUpperCase() + st.slice(1),
      value: leads.filter(l => l.stage === st).length,
      fill:  funnelColors[i],
    }));

    const socialStats: SocialItem[] = social.map(s => ({
      platform:   (s.platform   as string) || "—",
      followers:  Number(s.followers)      || 0,
      engagement: Number(s.engagement)     || 0,
    }));

    const totalReach  = trafficTrend.reduce((s, r) => s + r.sessions, 0);
    const totalLeads  = leads.length;
    const converted   = leads.filter(l => l.stage === "converted").length;
    const convRate    = totalLeads ? ((converted / totalLeads) * 100).toFixed(1) : "0";
    const totalSpend  = byChannel.reduce((s, c) => s + c.spend, 0);
    const revenue     = campaigns.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const roi         = totalSpend ? ((revenue / totalSpend) * 100).toFixed(1) : "0";
    const clicks      = campaigns.reduce((s, c) => s + (Number(c.clicks)      || 0), 0);
    const impressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
    const ctr         = impressions ? ((clicks / impressions) * 100).toFixed(2) : "0";

    const empty = !campaigns.length && !leads.length;

    setData({
      totalReach,
      totalLeads,
      convRate,
      totalSpend,
      roi,
      ctr,
      trafficTrend:  trafficTrend.length              ? trafficTrend   : DEMO.trafficTrend,
      byChannel:     byChannel.length                 ? byChannel      : DEMO.byChannel,
      campaigns:     campaignRows.length              ? campaignRows   : DEMO.campaigns,
      funnelData:    funnelData.some(f => f.value > 0)? funnelData     : DEMO.funnelData,
      socialStats:   socialStats.length               ? socialStats    : DEMO.socialStats,
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
export default function MarketingDashboard() {
  const [filter, setFilter] = useState<Filter>("Monthly");
  const { data, loading, indexErrors, lastUpdated, refetch } = useMarketingData(filter);

  const kpis: KPICardProps[] = [
    { label: "Total Reach",      value: data ? fmtShort(data.totalReach)               : "—", change: "12.4%", up: true,  icon: "📡", accent: "#0ea5e9", loading },
    { label: "Total Leads",      value: data ? data.totalLeads.toLocaleString()         : "—", change: "9.3%",  up: true,  icon: "🎯", accent: "#8b5cf6", loading },
    { label: "Conv. Rate",       value: data ? `${data.convRate}%`                      : "—", change: "2.1%",  up: true,  icon: "🔄", accent: "#10b981", loading },
    { label: "Total Spend",      value: data ? fmtMoney(data.totalSpend)                : "—", change: "5.8%",  up: false, icon: "💸", accent: "#f59e0b", loading },
    { label: "ROI",              value: data ? `${data.roi}%`                           : "—", change: "18.2%", up: true,  icon: "📈", accent: "#10b981", loading },
    { label: "Avg. CTR",         value: data ? `${data.ctr}%`                           : "—", change: "0.4%",  up: true,  icon: "👆", accent: "#ec4899", loading },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%   { background-position: 200% 0  } 100% { background-position: -200% 0 } }
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
          <div style={{ width: 40, height: 40, background: "#0ea5e9", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 2px 8px rgba(14,165,233,0.35)" }}>📊</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9" }} />
              <span style={{ fontSize: 10, color: "#0ea5e9", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              {lastUpdated && <span style={{ fontSize: 10, color: "#94a3b8" }}>· {lastUpdated}</span>}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.3px" }}>Marketing Dashboard</h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Campaign performance &amp; ROI · FY 2025</p>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
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

      {/* ── INDEX ERROR BANNERS ───────────────────────────── */}
      <IndexErrorBanner errors={indexErrors} />

      {/* ── Demo notice ───────────────────────────────────── */}
      {/* {data?.usingDemo && !loading && !indexErrors.length && (
        <div style={{ margin: "12px 28px 0", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
          ℹ️ No data in Firestore yet — showing demo data. Add documents to <strong>campaigns</strong>, <strong>leads</strong>, <strong>social</strong>.
        </div>
      )} */}

      {/* ── BODY ─────────────────────────────────────────── */}
      <main style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 22 }}>
          {kpis.map((k, i) => <KPICard key={i} {...k} />)}
        </div>

        {/* Row 1 — Traffic Trend + Channel Conversions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>

          <Card title="Monthly Traffic Trend" subtitle="campaigns · sessions by month" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data!.trafficTrend}>
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month"   tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="sessions" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#tg)" name="Sessions" dot={false} activeDot={{ r: 5, fill: "#0ea5e9" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Conversions by Channel" subtitle="campaigns · grouped by channel" badge="● Live">
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data!.byChannel} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="channel" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="conversions" name="Conversions" radius={[0, 6, 6, 0]}>
                    {data!.byChannel.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 2 — Funnel + Spend vs Conversions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 16, marginBottom: 16 }}>

          <Card title="Lead Conversion Funnel" subtitle="leads · grouped by stage" badge="● Live">
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
                <div style={{ marginTop: 16, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#0369a1", fontWeight: 700 }}>Overall Conversion Rate</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#0ea5e9" }}>{data?.convRate}%</span>
                </div>
              </>
            )}
          </Card>

          <Card title="Spend vs Conversions" subtitle="campaigns · by channel" badge="● Live">
            {loading ? <Skeleton h={240} /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data!.byChannel} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="channel" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left"  tickFormatter={(v: number) => fmtShort(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => fmtMoney(v)} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar yAxisId="left"  dataKey="conversions" name="Conversions" fill="#0ea5e9" radius={[6, 6, 0, 0]} opacity={0.85} />
                    <Bar yAxisId="right" dataKey="spend"       name="Spend ($)"   fill="#f59e0b" radius={[6, 6, 0, 0]} opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: "#0ea5e9" }} />
                    <span style={{ color: "#64748b" }}>Conversions</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: "#f59e0b" }} />
                    <span style={{ color: "#64748b" }}>Spend ($)</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Campaign Table */}
        <Card title="Active Campaigns" subtitle="campaigns · top 5 by impressions" badge={`${data?.campaigns?.length ?? 0} campaigns`}>
          {loading ? <Skeleton h={200} /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["#", "Campaign", "Impressions", "Clicks", "CTR", "Performance"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.campaigns.map((c, idx) => {
                    const max = data!.campaigns[0]?.impressions || 1;
                    const pct = Math.round((c.impressions / max) * 100);
                    const ctrColor = c.ctr >= 5 ? "#059669" : c.ctr >= 3 ? "#d97706" : "#e11d48";
                    return (
                      <tr
                        key={c.name}
                        style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: idx === 0 ? "#fef9c3" : idx === 1 ? "#f1f5f9" : "#fef3f2", color: idx === 0 ? "#a16207" : idx === 1 ? "#475569" : "#9f1239", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{idx + 1}</div>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: PALETTE[idx % PALETTE.length] + "22", color: PALETTE[idx % PALETTE.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{c.name.charAt(0)}</div>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px", color: "#475569", fontWeight: 600 }}>{fmtShort(c.impressions)}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{ background: "#eff6ff", color: "#3b82f6", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{fmtShort(c.clicks)}</span>
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: ctrColor }}>{c.ctr}%</span>
                        </td>
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
                  {data!.campaigns.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
                        No campaign data — add documents to your <strong>campaigns</strong> collection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Social Stats */}
        <div style={{ marginTop: 16 }}>
          <Card title="Social Media Performance" subtitle="social · followers & engagement" badge="● Live">
            {loading ? <Skeleton h={120} /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 4 }}>
                {data!.socialStats.map((s, i) => (
                  <div key={s.platform} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "0 12px 0 60px", background: PALETTE[i % PALETTE.length] + "15" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{s.platform}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: PALETTE[i % PALETTE.length], letterSpacing: "-0.5px" }}>{fmtShort(s.followers)}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>followers</div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 99 }}>
                        <div style={{ width: `${Math.min(s.engagement * 10, 100)}%`, height: "100%", background: PALETTE[i % PALETTE.length], borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PALETTE[i % PALETTE.length] }}>{s.engagement}% eng.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 18, paddingBottom: 8 }}>
          Marketing Dashboard · {new Date().toLocaleDateString()} · Firebase connected
        </p>
      </main>
    </div>
  );
}