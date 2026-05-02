"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { logActivity } from "@/lib/notifications";
import NotificationBell from "@/components/NotificationBell";
import CrossDeptFeed from "@/components/CrossDeptFeed";
import { useAuth } from "@/context/AuthContext";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, where, orderBy, serverTimestamp, updateDoc,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// 1. TYPES
// ─────────────────────────────────────────────────────────────
interface Campaign {
  id?: string;
  name: string;
  channel: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  month: string;
  ctr?: number;
  createdAt?: unknown;
}

interface Lead {
  id?: string;
  name: string;
  email: string;
  source: string;
  stage: "awareness" | "interest" | "consideration" | "converted";
  assignedTo?: string;
  createdAt?: unknown;
}

interface SocialStat {
  id?: string;
  platform: string;
  followers: number;
  engagement: number;
  posts?: number;
  reach?: number;
  createdAt?: unknown;
}

// ─────────────────────────────────────────────────────────────
// 2. FIRESTORE SERVICES
// ─────────────────────────────────────────────────────────────
export function subscribeCampaigns(
  month: string,
  cb: (items: Campaign[]) => void,
) {
  const q = query(collection(db, "campaigns"), where("month", "==", month));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Campaign, "id">) })));
  });
}

export function subscribeLeads(cb: (items: Lead[]) => void) {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) })));
  });
}

export function subscribeSocial(cb: (items: SocialStat[]) => void) {
  const q = query(collection(db, "social"), orderBy("platform", "asc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SocialStat, "id">) })));
  });
}

export async function addCampaign(data: Omit<Campaign, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "campaigns"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: "CAMPAIGN_CREATED",
    title: "New campaign launched",
    message: `${data.name} campaign started on ${data.channel}`,
    icon: "📢",
    createdBy: "Marketing",
    visibleTo: ["sales", "admin", "finance"],
    priority: "medium",
  });
  return ref;
}

export async function deleteCampaign(id: string, name: string) {
  await deleteDoc(doc(db, "campaigns", id));
  await logActivity({
    type: "CAMPAIGN_DELETED",
    title: "Campaign removed",
    message: `${name} campaign was deleted`,
    icon: "🗑️",
    createdBy: "Marketing",
    visibleTo: ["admin"],
    priority: "low",
  });
}

export async function addLead(data: Omit<Lead, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "leads"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: "LEAD_CREATED",
    title: "New lead captured",
    message: `${data.name} from ${data.source}`,
    icon: "🎯",
    createdBy: "Marketing",
    visibleTo: ["sales"],
    priority: "medium",
  });
  return ref;
}

export async function updateLeadStage(lead: Lead, stage: Lead["stage"]) {
  await updateDoc(doc(db, "leads", lead.id!), { stage });
  if (stage === "converted") {
    await logActivity({
      type: "LEAD_CONVERTED",
      title: "Lead converted 🔥",
      message: `${lead.name} converted via ${lead.source}`,
      icon: "🔥",
      createdBy: "Marketing",
      visibleTo: ["sales", "admin"],
      priority: "high",
    });
  }
}

export async function deleteLead(id: string) {
  return deleteDoc(doc(db, "leads", id));
}

export async function addSocialStat(data: Omit<SocialStat, "id" | "createdAt">) {
  return addDoc(collection(db, "social"), { ...data, createdAt: serverTimestamp() });
}

export async function deleteSocialStat(id: string) {
  return deleteDoc(doc(db, "social", id));
}

async function checkCTRAlert(campaign: Campaign) {
  if ((campaign.ctr ?? 0) < 2 && (campaign.ctr ?? 0) > 0) {
    await logActivity({
      type: "LOW_CTR_ALERT",
      title: "Campaign underperforming",
      message: `${campaign.name} CTR is only ${campaign.ctr}% on ${campaign.channel}`,
      icon: "⚠️",
      createdBy: "System",
      visibleTo: ["admin"],
      priority: "high",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. MAIN HOOK
// ─────────────────────────────────────────────────────────────
function useMarketing(month: string) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [social, setSocial] = useState<SocialStat[]>([]);
  const alertedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const u1 = subscribeCampaigns(month, items => {
      setCampaigns(items);
      items.forEach(c => {
        if (c.id && !alertedRef.current.has(c.id)) {
          alertedRef.current.add(c.id);
          checkCTRAlert(c);
        }
      });
    });
    const u2 = subscribeLeads(setLeads);
    const u3 = subscribeSocial(setSocial);
    return () => { u1(); u2(); u3(); };
  }, [month]);

  const totalReach = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConv = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const overallCTR = totalReach ? parseFloat(((totalClicks / totalReach) * 100).toFixed(2)) : 0;
  const roi = totalSpend ? parseFloat(((totalRevenue / totalSpend) * 100).toFixed(1)) : 0;
  const converted = leads.filter(l => l.stage === "converted").length;
  const convRate = leads.length ? parseFloat(((converted / leads.length) * 100).toFixed(1)) : 0;
  const totalFollowers = social.reduce((s, r) => s + r.followers, 0);
  const avgEngagement = social.length ? parseFloat((social.reduce((s, r) => s + r.engagement, 0) / social.length).toFixed(1)) : 0;

  const channelMap: Record<string, { conversions: number; spend: number; revenue: number }> = {};
  campaigns.forEach(c => {
    if (!channelMap[c.channel]) channelMap[c.channel] = { conversions: 0, spend: 0, revenue: 0 };
    channelMap[c.channel].conversions += c.conversions;
    channelMap[c.channel].spend += c.spend;
    channelMap[c.channel].revenue += c.revenue;
  });
  const byChannel = Object.entries(channelMap)
    .sort((a, b) => b[1].conversions - a[1].conversions)
    .map(([channel, v]) => ({ channel, ...v }));

  const monthMap: Record<string, number> = {};
  campaigns.forEach(c => { monthMap[c.month] = (monthMap[c.month] || 0) + c.clicks; });
  const trafficTrend = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mo, clicks]) => ({ month: mo.slice(0, 7), clicks }));

  const STAGE_COLORS = [T.blue, T.violet, T.amber, T.green];
  const STAGES: Lead["stage"][] = ["awareness", "interest", "consideration", "converted"];
  const funnelData = STAGES.map((st, i) => ({
    name: st.charAt(0).toUpperCase() + st.slice(1),
    value: leads.filter(l => l.stage === st).length,
    fill: STAGE_COLORS[i],
  }));

  return {
    campaigns, leads, social,
    totalReach, totalClicks, totalConv, totalSpend, totalRevenue,
    overallCTR, roi, convRate, converted,
    totalFollowers, avgEngagement,
    byChannel, trafficTrend, funnelData,
  };
}

// ─────────────────────────────────────────────────────────────
// 4. DESIGN TOKENS  — identical to Finance dashboard
// ─────────────────────────────────────────────────────────────
const T = {
  bg: "#f0f2f8",
  surface: "#ffffff",
  surfaceHi: "#f4f6fb",
  border: "#e2e8f0",
  borderHi: "#c9d3e0",
  ink: "#0f172a",
  inkMid: "#475569",
  inkDim: "#94a3b8",
  green: "#059669",
  greenBg: "#ecfdf5",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  violet: "#7c3aed",
  violetBg: "#f5f3ff",
  teal: "#0891b2",
  tealBg: "#ecfeff",
  pink: "#db2777",
  pinkBg: "#fdf2f8",
  sky: "#0ea5e9",
  skyBg: "#f0f9ff",
};

const PALETTE = [T.blue, T.green, T.violet, T.amber, T.red, T.teal, T.pink, "#ffa657"];
const CHANNELS = ["Paid Search", "Social Ads", "Email", "Organic SEO", "Referral", "Display", "Google Ads", "YouTube"];
const SOURCES = ["Facebook", "Instagram", "LinkedIn", "Google", "Twitter", "Email", "Referral", "Organic"];
const STAGES: Lead["stage"][] = ["awareness", "interest", "consideration", "converted"];
const PLATFORMS = ["Instagram", "LinkedIn", "Facebook", "Twitter / X", "YouTube", "TikTok"];

// ─────────────────────────────────────────────────────────────
// 5. FORMATTERS
// ─────────────────────────────────────────────────────────────
function fmt(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}
function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}
function fmtShort(v: number) {
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// ─────────────────────────────────────────────────────────────
// 6. MICRO-COMPONENTS  — same pattern as Finance
// ─────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, accent = T.blue }: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: "18px 20px", position: "relative", overflow: "hidden",
        transition: "border-color 0.2s, transform 0.15s, box-shadow 0.15s", cursor: "default",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = accent;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 24px ${accent}22`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = T.border;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at 100% 0%, ${accent}28 0%, transparent 70%)` }} />
      <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: "-0.5px", marginBottom: 3, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px", borderRadius: 0, border: "none",
      background: "transparent",
      color: active ? T.blue : T.inkMid,
      fontSize: 13, fontWeight: 700, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      borderBottom: active ? `2px solid ${T.blue}` : "2px solid transparent",
      transition: "all 0.15s",
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 99,
          background: active ? T.blueBg : T.surfaceHi,
          color: active ? T.blue : T.inkMid,
        }}>{count}</span>
      )}
    </button>
  );
}

function FieldInput({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9,
          padding: "9px 13px", color: T.ink, fontSize: 13, width: "100%",
          transition: "border-color 0.15s", outline: "none",
        }}
        onFocus={e => (e.target.style.borderColor = T.blue)}
        onBlur={e => (e.target.style.borderColor = T.border)}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9,
        padding: "9px 13px", color: T.ink, fontSize: 13, width: "100%", cursor: "pointer", outline: "none",
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function AddBtn({ onClick, label, color = T.blue }: { onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 22px", background: color, color: "#fff", border: "none",
      borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
      transition: "opacity 0.15s", width: "100%",
    }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
    >{label}</button>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 9px", background: T.redBg, color: T.red, border: `1px solid ${T.red}44`,
      borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}>✕</button>
  );
}

function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: T.inkMid, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: T.inkMid, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}44`, transition: "background 0.1s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = T.surfaceHi)}
              onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 12px", color: T.ink, verticalAlign: "middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} style={{ padding: "32px", textAlign: "center", color: T.inkDim, fontSize: 13 }}>No records yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ color: T.inkMid, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 800 }}>{p.name}: {fmtShort(p.value)}</div>
      ))}
    </div>
  );
}

function StageBadge({ stage }: { stage: Lead["stage"] }) {
  const map: Record<Lead["stage"], [string, string]> = {
    awareness: [T.sky, T.skyBg],
    interest: [T.violet, T.violetBg],
    consideration: [T.amber, T.amberBg],
    converted: [T.green, T.greenBg],
  };
  const [color, bg] = map[stage] || ["#64748b", "#f1f5f9"];
  return (
    <span style={{ padding: "3px 9px", borderRadius: 99, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", textTransform: "capitalize" }}>{stage}</span>
  );
}

function ChannelBadge({ ch }: { ch: string }) {
  const colors: Record<string, [string, string]> = {
    "Social Ads": [T.pink, T.pinkBg],
    "Paid Search": [T.blue, T.blueBg],
    "Email": [T.violet, T.violetBg],
    "Organic SEO": [T.green, T.greenBg],
    "Referral": [T.amber, T.amberBg],
    "Display": [T.teal, T.tealBg],
    "Google Ads": [T.red, T.redBg],
    "YouTube": [T.red, T.redBg],
  };
  const [color, bg] = colors[ch] ?? [T.inkMid, T.surfaceHi];
  return (
    <span style={{ padding: "3px 9px", borderRadius: 99, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{ch}</span>
  );
}

function MoneyTag({ v, color = T.green }: { v: number; color?: string }) {
  return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color }}>{fmt(v)}</span>;
}

// ─────────────────────────────────────────────────────────────
// 7. OVERVIEW TAB
// ─────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: ReturnType<typeof useMarketing> }) {
  const {
    campaigns, leads, social,
    totalReach, totalSpend, totalRevenue, overallCTR, roi, convRate,
    converted, totalFollowers, avgEngagement,
    byChannel, trafficTrend, funnelData,
  } = data;

  const spendVsRevenue = byChannel.map(c => ({ name: c.channel, Spend: c.spend, Revenue: c.revenue }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <KPICard icon="📡" label="Total Reach" value={fmtNum(totalReach)} accent={T.sky} sub="impressions across campaigns" />
        <KPICard icon="🎯" label="Total Leads" value={String(leads.length)} accent={T.violet} sub={`${converted} converted`} />
        <KPICard icon="🔄" label="Conv. Rate" value={`${convRate}%`} accent={T.green} sub="leads → converted" />
        <KPICard icon="💸" label="Total Spend" value={fmt(totalSpend)} accent={T.amber} sub="ad spend this month" />
        <KPICard icon="📈" label="ROI" value={`${roi}%`} accent={T.green} sub="revenue / spend" />
        <KPICard icon="👆" label="Avg. CTR" value={`${overallCTR}%`} accent={T.pink} sub="clicks / impressions" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        <SectionCard title="Monthly Click Trend" subtitle="clicks by month across campaigns">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trafficTrend}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="clicks" stroke={T.blue} strokeWidth={2.5} fill="url(#cg)" name="Clicks" dot={false} activeDot={{ r: 5, fill: T.blue }} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Funnel Breakdown" subtitle="lead stages distribution">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={funnelData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {funnelData.map((f, i) => <Cell key={i} fill={f.fill} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: T.inkMid, fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Conversions by Channel" subtitle="top channels this month">
          {byChannel.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={byChannel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="channel" tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="conversions" name="Conversions" radius={[0, 6, 6, 0]}>
                  {byChannel.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkDim, fontSize: 13 }}>No campaign data yet</div>
          )}
        </SectionCard>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

        <SectionCard title="Spend vs Revenue by Channel" subtitle="ROI comparison across channels">
          {spendVsRevenue.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={spendVsRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="name" tick={{ fill: T.inkMid, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Spend" fill={T.amber} radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Bar dataKey="Revenue" fill={T.green} radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: T.amber }} /><span style={{ color: T.inkMid }}>Spend</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: T.green }} /><span style={{ color: T.inkMid }}>Revenue</span></div>
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkDim, fontSize: 13 }}>No data yet</div>
          )}
        </SectionCard>

        <SectionCard title="Social Summary" subtitle="across all platforms">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: T.skyBg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.sky}33` }}>
                <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, marginBottom: 4 }}>FOLLOWERS</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.sky, fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(totalFollowers)}</div>
              </div>
              <div style={{ background: T.greenBg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.green}33` }}>
                <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, marginBottom: 4 }}>AVG ENG.</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>{avgEngagement}%</div>
              </div>
            </div>
            {social.slice(0, 4).map((s, i) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < Math.min(social.length - 1, 3) ? `1px solid ${T.border}44` : "none" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{s.platform}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: T.inkMid }}>{fmtNum(s.followers)}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: PALETTE[i % PALETTE.length] }}>{s.engagement}%</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Campaign Summary Table */}
      <SectionCard title="Campaign Performance" subtitle={`${campaigns.length} campaigns this month`}>
        <DataTable
          headers={["Campaign", "Channel", "Impressions", "Clicks", "CTR", "Conversions", "Spend", "Revenue", "ROI"]}
          rows={campaigns.slice(0, 8).map(c => {
            const ctrColor = (c.ctr ?? 0) >= 5 ? T.green : (c.ctr ?? 0) >= 3 ? T.amber : T.red;
            const campRoi = c.spend > 0 ? Math.round((c.revenue / c.spend) * 100) : 0;
            const roiColor = campRoi >= 200 ? T.green : campRoi >= 100 ? T.amber : T.red;
            return [
              <span style={{ fontWeight: 700, color: T.ink }}>{c.name}</span>,
              <ChannelBadge ch={c.channel} />,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.inkMid }}>{fmtNum(c.impressions)}</span>,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.inkMid }}>{fmtNum(c.clicks)}</span>,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: ctrColor }}>{c.ctr ?? 0}%</span>,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.inkMid }}>{c.conversions.toLocaleString()}</span>,
              <MoneyTag v={c.spend} color={T.amber} />,
              <MoneyTag v={c.revenue} color={T.green} />,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: roiColor }}>{campRoi}%</span>,
            ];
          })}
        />
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. CAMPAIGNS TAB
// ─────────────────────────────────────────────────────────────
function CampaignsTab({ campaigns, month, onAdd, onDelete }: {
  campaigns: Campaign[];
  month: string;
  onAdd: (data: Omit<Campaign, "id" | "createdAt">) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("Social Ads");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [conversions, setConversions] = useState("");
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !spend) return;
    const imp = Number(impressions) || 0;
    const clk = Number(clicks) || 0;
    const ctr = imp > 0 ? parseFloat(((clk / imp) * 100).toFixed(2)) : 0;
    onAdd({ name: name.trim(), channel, impressions: imp, clicks: clk, conversions: Number(conversions) || 0, spend: Number(spend), revenue: Number(revenue) || 0, month, ctr });
    setName(""); setImpressions(""); setClicks(""); setConversions(""); setSpend(""); setRevenue("");
  };

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalConv = campaigns.reduce((s, c) => s + c.conversions, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" }}>

        <SectionCard title="Add Campaign" subtitle="Auto-tagged to selected month">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldInput label="Campaign Name *" value={name} onChange={setName} placeholder="e.g. Summer Sale 2026" />
            <FieldSelect label="Channel" value={channel} onChange={setChannel} options={CHANNELS} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldInput label="Impressions" value={impressions} onChange={setImpressions} type="number" placeholder="100000" />
              <FieldInput label="Clicks" value={clicks} onChange={setClicks} type="number" placeholder="5000" />
              <FieldInput label="Conversions" value={conversions} onChange={setConversions} type="number" placeholder="500" />
              <FieldInput label="Spend (₹)" value={spend} onChange={setSpend} type="number" placeholder="20000" />
            </div>
            <FieldInput label="Revenue (₹)" value={revenue} onChange={setRevenue} type="number" placeholder="50000" />
            {spend && revenue && (
              <div style={{ padding: "10px 14px", background: T.surfaceHi, borderRadius: 9, border: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.inkMid, marginBottom: 2 }}>ROI Preview</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>
                    {Math.round((Number(revenue) / Number(spend)) * 100)}%
                  </div>
                </div>
                {clicks && impressions && (
                  <div>
                    <div style={{ fontSize: 10, color: T.inkMid, marginBottom: 2 }}>CTR Preview</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>
                      {((Number(clicks) / Number(impressions)) * 100).toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            )}
            <AddBtn onClick={handleAdd} label="🚀 Launch Campaign" />
          </div>
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <KPICard icon="💸" label="Total Spend" value={fmt(totalSpend)} accent={T.amber} />
            <KPICard icon="💰" label="Total Revenue" value={fmt(totalRevenue)} accent={T.green} />
            <KPICard icon="🔄" label="Conversions" value={String(totalConv)} accent={T.blue} />
          </div>

          <SectionCard title="Campaign Records" subtitle={`${campaigns.length} campaigns in ${month}`}>
            <DataTable
              headers={["Campaign", "Channel", "Impressions", "Clicks", "CTR", "Conv.", "Spend", "Revenue", "ROI", ""]}
              rows={campaigns.map(c => {
                const ctrColor = (c.ctr ?? 0) >= 5 ? T.green : (c.ctr ?? 0) >= 3 ? T.amber : T.red;
                const campRoi = c.spend > 0 ? Math.round((c.revenue / c.spend) * 100) : 0;
                return [
                  <span style={{ fontWeight: 700, color: T.ink }}>{c.name}</span>,
                  <ChannelBadge ch={c.channel} />,
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.inkMid }}>{fmtNum(c.impressions)}</span>,
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.inkMid }}>{fmtNum(c.clicks)}</span>,
                  <span style={{ fontWeight: 800, color: ctrColor }}>{c.ctr ?? 0}%</span>,
                  <span style={{ color: T.inkMid }}>{c.conversions}</span>,
                  <MoneyTag v={c.spend} color={T.amber} />,
                  <MoneyTag v={c.revenue} color={T.green} />,
                  <span style={{ fontWeight: 800, color: campRoi >= 200 ? T.green : campRoi >= 100 ? T.amber : T.red }}>{campRoi}%</span>,
                  <DeleteBtn onClick={() => c.id && onDelete(c.id, c.name)} />,
                ];
              })}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. LEADS TAB
// ─────────────────────────────────────────────────────────────
function LeadsTab({ leads, onAdd, onDelete, onStageChange }: {
  leads: Lead[];
  onAdd: (data: Omit<Lead, "id" | "createdAt">) => void;
  onDelete: (id: string) => void;
  onStageChange: (lead: Lead, stage: Lead["stage"]) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Facebook");
  const [stage, setStage] = useState<Lead["stage"]>("awareness");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), email, source, stage });
    setName(""); setEmail("");
  };

  const stageColors: Record<Lead["stage"], string> = {
    awareness: T.sky, interest: T.violet, consideration: T.amber, converted: T.green,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Stage summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {STAGES.map(st => {
          const count = leads.filter(l => l.stage === st).length;
          const color = stageColors[st];
          const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
          return (
            <div key={st} style={{ background: T.surface, border: `1px solid ${color}44`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{st}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'JetBrains Mono', monospace" }}>{count}</div>
              <div style={{ marginTop: 10, height: 4, background: T.border, borderRadius: 99 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: T.inkDim, marginTop: 4 }}>{pct}% of total</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>

        <SectionCard title="Add Lead" subtitle="Capture new marketing leads">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldInput label="Name *" value={name} onChange={setName} placeholder="John Doe" />
            <FieldInput label="Email" value={email} onChange={setEmail} type="email" placeholder="john@example.com" />
            <FieldSelect label="Source" value={source} onChange={setSource} options={SOURCES} />
            <FieldSelect label="Stage" value={stage} onChange={v => setStage(v as Lead["stage"])} options={STAGES.map(s => s.charAt(0).toUpperCase() + s.slice(1))} />
            <AddBtn onClick={handleAdd} label="🎯 Add Lead" color={T.violet} />
          </div>
        </SectionCard>

        <SectionCard
          title="Lead Records"
          subtitle={`${leads.length} total leads · ${leads.filter(l => l.stage === "converted").length} converted`}
        >
          <DataTable
            headers={["Lead", "Email", "Source", "Stage", "Update Stage", ""]}
            rows={leads.map(lead => [
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${stageColors[lead.stage]}22`, color: stageColors[lead.stage], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight: 700, color: T.ink }}>{lead.name}</span>
              </div>,
              <span style={{ color: T.inkDim, fontSize: 12 }}>{lead.email || "—"}</span>,
              <span style={{ padding: "3px 9px", borderRadius: 99, background: T.surfaceHi, color: T.inkMid, fontSize: 11, fontWeight: 700 }}>{lead.source}</span>,
              <StageBadge stage={lead.stage} />,
              <select
                value={lead.stage}
                onChange={e => onStageChange(lead, e.target.value as Lead["stage"])}
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontWeight: 600, color: T.inkMid, cursor: "pointer", background: T.surfaceHi, outline: "none" }}
              >
                {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>,
              <DeleteBtn onClick={() => lead.id && onDelete(lead.id)} />,
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. SOCIAL TAB
// ─────────────────────────────────────────────────────────────
function SocialTab({ social, onAdd, onDelete }: {
  social: SocialStat[];
  onAdd: (data: Omit<SocialStat, "id" | "createdAt">) => void;
  onDelete: (id: string) => void;
}) {
  const [platform, setPlatform] = useState("Instagram");
  const [followers, setFollowers] = useState("");
  const [engagement, setEngagement] = useState("");
  const [posts, setPosts] = useState("");
  const [reach, setReach] = useState("");

  const handleAdd = () => {
    if (!followers) return;
    onAdd({ platform, followers: Number(followers), engagement: Number(engagement) || 0, posts: Number(posts) || 0, reach: Number(reach) || 0 });
    setFollowers(""); setEngagement(""); setPosts(""); setReach("");
  };

  const totalFollowers = social.reduce((s, r) => s + r.followers, 0);
  const avgEngagement = social.length
    ? (social.reduce((s, r) => s + r.engagement, 0) / social.length).toFixed(1)
    : "0";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>

      <SectionCard title="Add Platform" subtitle="Track social media stats">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldSelect label="Platform" value={platform} onChange={setPlatform} options={PLATFORMS} />
          <FieldInput label="Followers" value={followers} onChange={setFollowers} type="number" placeholder="10000" />
          <FieldInput label="Engagement Rate %" value={engagement} onChange={setEngagement} type="number" placeholder="5.2" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FieldInput label="Posts" value={posts} onChange={setPosts} type="number" placeholder="120" />
            <FieldInput label="Reach" value={reach} onChange={setReach} type="number" placeholder="50000" />
          </div>
          <AddBtn onClick={handleAdd} label="📱 Add Platform" color={T.pink} />
        </div>
      </SectionCard>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <KPICard icon="👥" label="Total Followers" value={fmtNum(totalFollowers)} accent={T.sky} />
          <KPICard icon="💬" label="Avg Engagement" value={`${avgEngagement}%`} accent={T.green} />
          <KPICard icon="📱" label="Platforms" value={String(social.length)} accent={T.violet} />
        </div>

        {/* Platform cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {social.map((s, i) => (
            <div key={s.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at 100% 0%, ${PALETTE[i % PALETTE.length]}20 0%, transparent 70%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.platform}</div>
                <DeleteBtn onClick={() => s.id && onDelete(s.id)} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: PALETTE[i % PALETTE.length], fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px", marginTop: 10 }}>
                {fmtNum(s.followers)}
              </div>
              <div style={{ fontSize: 11, color: T.inkDim, marginTop: 2 }}>followers</div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: T.inkDim, fontWeight: 700 }}>ENGAGEMENT</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: PALETTE[i % PALETTE.length] }}>{s.engagement}%</span>
                </div>
                <div style={{ width: "100%", height: 5, background: T.border, borderRadius: 99 }}>
                  <div style={{ width: `${Math.min(s.engagement * 10, 100)}%`, height: "100%", background: PALETTE[i % PALETTE.length], borderRadius: 99, transition: "width 0.6s ease" }} />
                </div>
              </div>
              {(s.posts || s.reach) && (
                <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}44` }}>
                  {s.posts ? <div style={{ fontSize: 11, color: T.inkMid }}><span style={{ fontWeight: 800, color: T.ink }}>{s.posts}</span> posts</div> : null}
                  {s.reach ? <div style={{ fontSize: 11, color: T.inkMid }}><span style={{ fontWeight: 800, color: T.ink }}>{fmtNum(s.reach)}</span> reach</div> : null}
                </div>
              )}
            </div>
          ))}
        </div>

        <SectionCard title="Platform Records" subtitle={`${social.length} platforms tracked`}>
          <DataTable
            headers={["Platform", "Followers", "Engagement", "Posts", "Reach", ""]}
            rows={social.map(s => [
              <span style={{ fontWeight: 700, color: T.ink }}>{s.platform}</span>,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: T.sky }}>{fmtNum(s.followers)}</span>,
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: T.green }}>{s.engagement}%</span>,
              <span style={{ color: T.inkMid }}>{s.posts ?? "—"}</span>,
              <span style={{ color: T.inkMid }}>{s.reach ? fmtNum(s.reach) : "—"}</span>,
              <DeleteBtn onClick={() => s.id && onDelete(s.id)} />,
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 11. SCHEMA TAB  — same pattern as Finance's Firestore tab
// ─────────────────────────────────────────────────────────────
const SCHEMA_TEXT = `// ── Firestore Collections ──────────────────────────
// campaigns/{id}
{
  name: string,
  channel: string,        // "Social Ads" | "Paid Search" | …
  impressions: number,
  clicks: number,
  conversions: number,
  spend: number,          // ad spend in ₹
  revenue: number,
  month: string,          // "2026-04"
  ctr: number,            // auto-calculated
  createdAt: Timestamp
}

// leads/{id}
{
  name: string,
  email: string,
  source: string,         // "Facebook" | "Google" | …
  stage: string,          // "awareness"|"interest"|"consideration"|"converted"
  assignedTo?: string,
  createdAt: Timestamp
}

// social/{id}
{
  platform: string,       // "Instagram" | "LinkedIn" | …
  followers: number,
  engagement: number,     // percentage
  posts?: number,
  reach?: number,
  createdAt: Timestamp
}

// notifications/{id}   ← shared with HR / Finance / Sales
{
  type: string,
  title: string,
  message: string,
  icon: string,
  priority: "low" | "medium" | "high",
  read: boolean,
  createdBy: string,
  visibleTo: string[],    // ["sales", "admin"]
  createdAt: Timestamp
}`;

const RULES_TEXT = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /campaigns/{id} {
      allow read, write: if request.auth != null;
    }
    match /leads/{id} {
      allow read, write: if request.auth != null;
    }
    match /social/{id} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{id} {
      allow read, write: if request.auth != null;
    }
  }
}`;

function SchemaTab() {
  const [active, setActive] = useState<"schema" | "rules">("schema");
  const text = active === "schema" ? SCHEMA_TEXT : RULES_TEXT;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}` }}>
        <TabBtn label="Collection Schema" active={active === "schema"} onClick={() => setActive("schema")} />
        <TabBtn label="Security Rules" active={active === "rules"} onClick={() => setActive("rules")} />
      </div>
      <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
            {active === "schema" ? "firestore-marketing-schema.ts" : "firestore.rules"}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            style={{ padding: "4px 12px", background: T.blue, color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >Copy</button>
        </div>
        <pre style={{ padding: "20px", overflowX: "auto", fontSize: 12, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8, margin: 0 }}>
          {text}
        </pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 12. MONTHS CONFIG
// ─────────────────────────────────────────────────────────────
const MONTHS = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
];
const MONTH_LABELS: Record<string, string> = {
  "2026-01": "Jan 2026", "2026-02": "Feb 2026", "2026-03": "Mar 2026", "2026-04": "Apr 2026",
  "2026-05": "May 2026", "2026-06": "Jun 2026", "2026-07": "Jul 2026", "2026-08": "Aug 2026",
  "2026-09": "Sep 2026", "2026-10": "Oct 2026", "2026-11": "Nov 2026", "2026-12": "Dec 2026",
};

type MarketingTab = "overview" | "campaigns" | "leads" | "social" | "schema";

// ─────────────────────────────────────────────────────────────
// 13. MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function MarketingDashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState("2026-04");
  const [tab, setTab] = useState<MarketingTab>("overview");

  const data = useMarketing(month);

  const handleAddCampaign = useCallback((d: Omit<Campaign, "id" | "createdAt">) => addCampaign(d), []);
  const handleDelCampaign = useCallback((id: string, name: string) => deleteCampaign(id, name), []);
  const handleAddLead = useCallback((d: Omit<Lead, "id" | "createdAt">) => addLead(d), []);
  const handleDelLead = useCallback((id: string) => deleteLead(id), []);
  const handleStageChange = useCallback((lead: Lead, stage: Lead["stage"]) => updateLeadStage(lead, stage), []);
  const handleAddSocial = useCallback((d: Omit<SocialStat, "id" | "createdAt">) => addSocialStat(d), []);
  const handleDelSocial = useCallback((id: string) => deleteSocialStat(id), []);

  const TABS: { key: MarketingTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "campaigns", label: "Campaigns", count: data.campaigns.length },
    { key: "leads", label: "Leads", count: data.leads.length },
    { key: "social", label: "Social", count: data.social.length },
    // { key: "schema",    label: "Schema" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Sora', 'Segoe UI', sans-serif", color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        select option { background: #ffffff; color: #0f172a; }
        input:focus, select:focus { outline: none; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
        height: 58, display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)", width: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: `linear-gradient(135deg, ${T.sky}, ${T.blue})`,
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>📊</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: T.ink, letterSpacing: "-0.3px" }}>Marketing ERP</div>
            <div style={{ fontSize: 9, color: T.green, fontWeight: 700 }}>● LIVE · Firebase Firestore</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NotificationBell
            role="marketing"
            uid={user?.uid || ""}
            accentColor={T.sky}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.inkMid, fontWeight: 700 }}>Month</span>
            <select
              value={month} onChange={e => setMonth(e.target.value)}
              style={{
                background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9,
                padding: "6px 12px", color: T.ink, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              {MONTHS.map(m => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
            </select>
          </div>

          <div style={{ padding: "7px 16px", background: T.skyBg, border: `1px solid ${T.sky}44`, borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.inkMid, fontWeight: 700 }}>ROI</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: T.sky, fontFamily: "'JetBrains Mono', monospace" }}>{data.roi}%</span>
          </div>

          <div style={{ padding: "7px 16px", background: T.greenBg, border: `1px solid ${T.green}44`, borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.inkMid, fontWeight: 700 }}>Leads</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>{data.leads.length}</span>
          </div>
        </div>
      </header>

      {/* ── TABS ───────────────────────────────────────────── */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 24px", display: "flex", gap: 0, overflowX: "auto", width: "100%",
      }}>
        {TABS.map(t => (
          <TabBtn key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} count={t.count} />
        ))}
      </div>

      {/* ── CONTENT ────────────────────────────────────────── */}
      <main style={{ padding: "20px 24px", width: "100%" }}>
        {tab === "overview" && <><OverviewTab data={data} /><div style={{ marginTop: 20 }}><CrossDeptFeed role="marketing" accentColor={T.sky} title="Sales & Business Activity" maxItems={8} /></div></>}
        {tab === "campaigns" && <CampaignsTab campaigns={data.campaigns} month={month} onAdd={handleAddCampaign} onDelete={handleDelCampaign} />}
        {tab === "leads" && <LeadsTab leads={data.leads} onAdd={handleAddLead} onDelete={handleDelLead} onStageChange={handleStageChange} />}
        {tab === "social" && <SocialTab social={data.social} onAdd={handleAddSocial} onDelete={handleDelSocial} />}
        {tab === "schema" && <SchemaTab />}
      </main>
    </div>
  );
}