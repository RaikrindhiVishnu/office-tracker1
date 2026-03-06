"use client";
import { useState, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

// ── SVG Icon Helper ───────────────────────────────────────────────────────────
interface IcProps { p: string; s?: number; stroke?: string; }
const Ic = ({ p, s = 16, stroke = "currentColor" }: IcProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={p} />
  </svg>
);

const P: Record<string, string> = {
  grid:     "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  building: "M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12",
  users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  dollar:   "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  bell:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus:     "M12 5v14M5 12h14",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  trending: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:    "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  x:        "M18 6 6 18M6 6l12 12",
  mail:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  lock:     "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  globe:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  chevD:    "M6 9l6 6 6-6",
  chevR:    "M9 18l6-6-6-6",
  tag:      "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  alert:    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  zap:      "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Company {
  id: string; name: string; plan: string; status: string;
  ownerEmail: string; employees: number; mrr: number;
  createdAt: string; country: string; industry: string; lastActive: string;
}
interface User {
  id: string; name: string; email: string; company: string;
  role: string; status: string; joined: string; lastLogin: string;
}
interface AuditLogEntry {
  id: string; action: string; target: string; actor: string; time: string; type: string;
}
interface SupportTicket {
  id: string; from: string; company: string; subject: string;
  status: string; priority: string; time: string;
}
interface Invoice {
  id: string; company: string; plan: string; amount: number; date: string; status: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const COMPANIES: Company[] = [
  { id:"c1", name:"TechGy Innovations",  plan:"enterprise", status:"active",    ownerEmail:"vishnu@techgy.com",      employees:14, mrr:4999, createdAt:"Jan 2024", country:"India",   industry:"IT Services",     lastActive:"2m ago"  },
  { id:"c2", name:"ByteForge Labs",       plan:"pro",        status:"active",    ownerEmail:"admin@byteforge.io",     employees:8,  mrr:999,  createdAt:"Mar 2024", country:"India",   industry:"SaaS",            lastActive:"1h ago"  },
  { id:"c3", name:"Nexus Digital",        plan:"pro",        status:"active",    ownerEmail:"ceo@nexusdigital.com",   employees:23, mrr:999,  createdAt:"Feb 2024", country:"UAE",     industry:"Digital Agency",  lastActive:"3h ago"  },
  { id:"c4", name:"Orion Systems",        plan:"free",       status:"suspended", ownerEmail:"ops@orion.io",           employees:3,  mrr:0,    createdAt:"Jun 2024", country:"India",   industry:"Consulting",      lastActive:"5d ago"  },
  { id:"c5", name:"CloudPeak Inc",        plan:"enterprise", status:"active",    ownerEmail:"hello@cloudpeak.com",    employees:51, mrr:4999, createdAt:"Nov 2023", country:"US",      industry:"Cloud/Infra",     lastActive:"10m ago" },
  { id:"c6", name:"Sigma Analytics",     plan:"pro",        status:"active",    ownerEmail:"team@sigma.io",          employees:17, mrr:999,  createdAt:"Apr 2024", country:"UK",      industry:"Data/Analytics",  lastActive:"30m ago" },
  { id:"c7", name:"Vertex Solutions",    plan:"free",       status:"active",    ownerEmail:"hr@vertex.co",           employees:5,  mrr:0,    createdAt:"Jul 2024", country:"India",   industry:"IT Services",     lastActive:"2d ago"  },
];

const ALL_USERS: User[] = [
  { id:"u1", name:"Vishnu Dev",     email:"vishnudev@gmail.com",   company:"TechGy Innovations",  role:"admin",    status:"active",   joined:"Jan 2024", lastLogin:"Just now"  },
  { id:"u2", name:"Tharun Kumar",   email:"tharun@techgy.com",     company:"TechGy Innovations",  role:"employee", status:"active",   joined:"Jan 2024", lastLogin:"2h ago"    },
  { id:"u3", name:"Priya Sharma",   email:"priya@techgy.com",      company:"TechGy Innovations",  role:"hr",       status:"active",   joined:"Feb 2024", lastLogin:"1d ago"    },
  { id:"u4", name:"Alex Chen",      email:"alex@byteforge.io",     company:"ByteForge Labs",       role:"admin",    status:"active",   joined:"Mar 2024", lastLogin:"5h ago"    },
  { id:"u5", name:"Sara Malik",     email:"sara@nexusdigital.com", company:"Nexus Digital",        role:"manager",  status:"active",   joined:"Feb 2024", lastLogin:"3h ago"    },
  { id:"u6", name:"Ravi Ops",       email:"ops@orion.io",          company:"Orion Systems",        role:"admin",    status:"suspended",joined:"Jun 2024", lastLogin:"5d ago"    },
  { id:"u7", name:"Lena Cloud",     email:"lena@cloudpeak.com",    company:"CloudPeak Inc",        role:"admin",    status:"active",   joined:"Nov 2023", lastLogin:"10m ago"   },
  { id:"u8", name:"Dan Sigma",      email:"dan@sigma.io",          company:"Sigma Analytics",      role:"employee", status:"active",   joined:"Apr 2024", lastLogin:"30m ago"   },
];

const AUDIT_LOGS: AuditLogEntry[] = [
  { id:"al1", action:"Company Created",       target:"Sigma Analytics",    actor:"Super Admin",  time:"Today 11:42 AM",   type:"create"  },
  { id:"al2", action:"Company Suspended",     target:"Orion Systems",      actor:"Super Admin",  time:"Today 09:15 AM",   type:"suspend" },
  { id:"al3", action:"Plan Upgraded",         target:"TechGy Innovations", actor:"Vishnu Dev",   time:"Yesterday 4:30 PM",type:"upgrade" },
  { id:"al4", action:"User Deactivated",      target:"Ravi Ops",           actor:"Super Admin",  time:"Yesterday 2:00 PM",type:"suspend" },
  { id:"al5", action:"Company Created",       target:"Vertex Solutions",   actor:"Super Admin",  time:"Jul 15, 2024",     type:"create"  },
  { id:"al6", action:"Password Reset Forced", target:"ops@orion.io",       actor:"Super Admin",  time:"Jul 10, 2024",     type:"alert"   },
  { id:"al7", action:"Plan Upgraded",         target:"ByteForge Labs",     actor:"Alex Chen",    time:"Mar 20, 2024",     type:"upgrade" },
  { id:"al8", action:"New Login – New Device",target:"lena@cloudpeak.com", actor:"System",       time:"Feb 26, 6:00 AM",  type:"alert"   },
];

const SUPPORT: SupportTicket[] = [
  { id:"s1", from:"Vishnu Dev",  company:"TechGy Innovations", subject:"Billing invoice mismatch",    status:"open",     priority:"high",   time:"2h ago" },
  { id:"s2", from:"Alex Chen",   company:"ByteForge Labs",      subject:"Can't add more employees",   status:"open",     priority:"medium", time:"5h ago" },
  { id:"s3", from:"Sara Malik",  company:"Nexus Digital",       subject:"Feature request: SSO login", status:"resolved", priority:"low",    time:"1d ago" },
  { id:"s4", from:"Lena Cloud",  company:"CloudPeak Inc",       subject:"Export report not working",  status:"open",     priority:"high",   time:"3h ago" },
];

// ── Color config ──────────────────────────────────────────────────────────────
const planColor: Record<string, string>  = { free:"#64748b", pro:"#3b82f6", enterprise:"#f59e0b" };
const planBg: Record<string, string>     = { free:"#f1f5f9", pro:"#eff6ff", enterprise:"#fffbeb" };
const statusC: Record<string, string>    = { active:"#10b981", suspended:"#ef4444", resolved:"#10b981", open:"#f59e0b" };
const statusBg: Record<string, string>   = { active:"#ecfdf5", suspended:"#fef2f2", resolved:"#ecfdf5", open:"#fffbeb" };
const priorityC: Record<string, string>  = { high:"#ef4444", medium:"#f59e0b", low:"#10b981" };
const priorityBg: Record<string, string> = { high:"#fef2f2", medium:"#fffbeb", low:"#ecfdf5" };
const auditC: Record<string, string>     = { create:"#10b981", suspend:"#ef4444", upgrade:"#3b82f6", alert:"#8b5cf6" };
const auditBg: Record<string, string>    = { create:"#ecfdf5", suspend:"#fef2f2", upgrade:"#eff6ff", alert:"#f5f3ff" };
const roleC: Record<string, string>      = { admin:"#8b5cf6", manager:"#3b82f6", hr:"#ec4899", finance:"#f59e0b", employee:"#10b981" };
const roleBg: Record<string, string>     = { admin:"#f5f3ff", manager:"#eff6ff", hr:"#fdf4ff", finance:"#fffbeb", employee:"#ecfdf5" };

// ── Shared UI ─────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color: string; bg?: string; }
const Badge = ({ label, color, bg }: BadgeProps) => (
  <span style={{
    background: bg || color + "15",
    color,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    border: `1px solid ${color}30`,
    whiteSpace: "nowrap" as const,
    textTransform: "capitalize" as const,
    display: "inline-block",
  }}>
    {label}
  </span>
);

interface AvatarProps { name: string; size?: number; color?: string; }
const Avatar = ({ name, size = 34, color = "#3b82f6" }: AvatarProps) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: color + "20",
    border: `2px solid ${color}40`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.36, fontWeight: 800, color, flexShrink: 0,
  }}>
    {name?.[0]?.toUpperCase()}
  </div>
);

interface StatCardProps {
  icon: string; label: string; value: string | number;
  sub?: string; accent?: string; trend?: string; iconBg?: string;
}
const StatCard = ({ icon, label, value, sub, accent = "#3b82f6", trend, iconBg }: StatCardProps) => (
  <div style={{
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "20px 22px",
    display: "flex", flexDirection: "column", gap: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: iconBg || accent + "15",
        display: "flex", alignItems: "center", justifyContent: "center", color: accent,
      }}>
        <Ic p={P[icon]} s={18} />
      </div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{value}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>}
      {trend && <span style={{ fontSize: 11, fontWeight: 700, color: trend.startsWith("+") ? "#10b981" : "#ef4444", background: trend.startsWith("+") ? "#ecfdf5" : "#fef2f2", padding: "2px 8px", borderRadius: 20 }}>{trend}</span>}
    </div>
  </div>
);

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps { title: string; subtitle?: string; onClose: () => void; children: ReactNode; width?: number; }
function Modal({ title, subtitle, onClose, children, width = 460 }: ModalProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width, maxWidth: "95vw", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <h3 style={{ color: "#1e293b", fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic p={P.x} s={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface FieldProps { label: string; children: ReactNode; }
function Field({ label, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inp: CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "#f8fafc", border: "1.5px solid #e2e8f0",
  borderRadius: 9, color: "#1e293b", fontSize: 13,
  boxSizing: "border-box", outline: "none",
};
const sel: CSSProperties = { ...inp, cursor: "pointer" };

// ─── VIEWS ────────────────────────────────────────────────────────────────────

// ── 1. OVERVIEW ──────────────────────────────────────────────────────────────
interface OverviewProps { onNav: (id: string) => void; }
function Overview({ onNav }: OverviewProps) {
  const totalMRR = COMPANIES.reduce((s, c) => s + c.mrr, 0);
  const totalUsers = COMPANIES.reduce((s, c) => s + c.employees, 0);
  const active = COMPANIES.filter(c => c.status === "active").length;
  const revenueByMonth = [42, 58, 61, 70, 68, 81, 94, 88, 107, 119, 128, 141];
  const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const maxR = Math.max(...revenueByMonth);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", margin: 0 }}>Platform Overview</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>WorkSphere SaaS · Real-time platform metrics</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <StatCard icon="building" label="Total Companies" value={COMPANIES.length} sub={`${active} active`} accent="#3b82f6" trend="+2 this month" />
        <StatCard icon="users"    label="Total Users"     value={totalUsers}       sub="Across all tenants"   accent="#8b5cf6" trend="+12 this month" />
        <StatCard icon="dollar"   label="Monthly Revenue" value={`₹${totalMRR.toLocaleString()}`} sub="Current MRR" accent="#f59e0b" trend="+18%" />
        <StatCard icon="trending" label="Platform Growth" value="23%"              sub="Month over month"      accent="#10b981" trend="+5% vs last" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Revenue Growth 2024</div>
            <Badge label="₹141K peak" color="#f59e0b" bg="#fffbeb" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
            {revenueByMonth.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: "100%",
                  height: `${(v / maxR) * 110}px`,
                  background: i === 11 ? "#3b82f6" : i >= 9 ? "#bfdbfe" : "#e0e7ff",
                  borderRadius: "4px 4px 0 0",
                }} />
                <div style={{ fontSize: 9, color: "#94a3b8" }}>{months[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 18 }}>Plan Distribution</div>
          {[
            { plan:"Enterprise", count:2, color:"#f59e0b", pct:29 },
            { plan:"Pro",        count:3, color:"#3b82f6", pct:43 },
            { plan:"Free",       count:2, color:"#94a3b8", pct:28 },
          ].map(p => (
            <div key={p.plan} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{p.plan}</span>
                <span style={{ fontSize: 12, color: p.color, fontWeight: 700 }}>{p.count} cos · {p.pct}%</span>
              </div>
              <div style={{ height: 7, background: "#f1f5f9", borderRadius: 4 }}>
                <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Total ARR</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", marginTop: 2 }}>₹{(totalMRR * 12).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Recent Companies</span>
            <button onClick={() => onNav("companies")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>View All →</button>
          </div>
          {COMPANIES.slice(0, 5).map(c => (
            <div key={c.id} style={{ padding: "12px 20px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={c.name} size={36} color="#3b82f6" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.employees} employees · {c.country}</div>
              </div>
              <Badge label={c.plan} color={planColor[c.plan] ?? "#64748b"} bg={planBg[c.plan]} />
              <div style={{ fontSize: 11, color: "#94a3b8", minWidth: 60, textAlign: "right" }}>{c.lastActive}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Recent Activity</span>
          </div>
          {AUDIT_LOGS.slice(0, 6).map(log => (
            <div key={log.id} style={{ padding: "11px 20px", borderBottom: "1px solid #f8fafc", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: auditC[log.type] ?? "#94a3b8", marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{log.action}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{log.target} · {log.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 2. COMPANIES ─────────────────────────────────────────────────────────────
interface CompanyForm {
  name: string; email: string; password: string;
  plan: string; industry: string; country: string;
}

function Companies() {
  const [search, setSearch]     = useState("");
  const [plan, setPlan]         = useState("all");
  const [status, setStatus]     = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>({ name:"", email:"", password:"", plan:"free", industry:"IT Services", country:"India" });
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => COMPANIES.filter(c => {
    const q = search.toLowerCase();
    return (!q || c.name.toLowerCase().includes(q) || c.ownerEmail.includes(q))
      && (plan === "all" || c.plan === plan)
      && (status === "all" || c.status === status);
  }), [search, plan, status]);

  const totalMRR = filtered.reduce((s, c) => s + c.mrr, 0);

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => { setCreating(false); setShowCreate(false); setForm({ name:"",email:"",password:"",plan:"free",industry:"IT Services",country:"India" }); }, 1400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Companies</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>{COMPANIES.length} tenants · ₹{totalMRR.toLocaleString()} filtered MRR</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(29,78,216,0.3)" }}>
          <Ic p={P.plus} s={15} /> Create Company
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}><Ic p={P.search} s={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or email..." style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: 4 }}>
          {["all","free","pro","enterprise"].map(p => (
            <button key={p} onClick={() => setPlan(p)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const, background: plan === p ? "#1d4ed8" : "transparent", color: plan === p ? "#fff" : "#64748b" }}>{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: 4 }}>
          {["all","active","suspended"].map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const, background: status === s ? "#1d4ed8" : "transparent", color: status === s ? "#fff" : "#64748b" }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              {["Company","Owner","Industry","Plan","Employees","MRR","Status","Last Active","Actions"].map(h => (
                <th key={h} style={{ padding: "11px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={c.name} size={32} color="#3b82f6" />
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "monospace" }}>{c.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "13px 18px", color: "#64748b", fontSize: 12 }}>{c.ownerEmail}</td>
                <td style={{ padding: "13px 18px", color: "#64748b", fontSize: 12 }}>{c.industry}</td>
                <td style={{ padding: "13px 18px" }}><Badge label={c.plan} color={planColor[c.plan] ?? "#64748b"} bg={planBg[c.plan]} /></td>
                <td style={{ padding: "13px 18px", color: "#374151", fontWeight: 700 }}>{c.employees}</td>
                <td style={{ padding: "13px 18px", color: "#f59e0b", fontWeight: 700 }}>₹{c.mrr.toLocaleString()}</td>
                <td style={{ padding: "13px 18px" }}><Badge label={c.status} color={statusC[c.status] ?? "#64748b"} bg={statusBg[c.status]} /></td>
                <td style={{ padding: "13px 18px", color: "#94a3b8", fontSize: 12 }}>{c.lastActive}</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setSelected(c)} style={{ padding: "5px 10px", background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Details</button>
                    <button style={{ padding: "5px 10px", background: c.status === "active" ? "#fef2f2" : "#ecfdf5", color: c.status === "active" ? "#ef4444" : "#10b981", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {c.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 12, background: "#fafafa" }}>
          Showing {filtered.length} of {COMPANIES.length} companies
        </div>
      </div>

      {showCreate && (
        <Modal title="Create New Company" subtitle="Company + admin account will be created automatically" onClose={() => setShowCreate(false)}>
          <Field label="Company Name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" style={inp} /></Field>
          <Field label="Admin Email"><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@company.com" style={inp} /></Field>
          <Field label="Admin Password"><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" style={inp} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Plan">
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} style={sel}>
                <option value="free">Free</option>
                <option value="pro">Pro — ₹999/mo</option>
                <option value="enterprise">Enterprise — ₹4,999/mo</option>
              </select>
            </Field>
            <Field label="Country">
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} style={sel}>
                {["India","US","UK","UAE","Canada","Australia"].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Industry">
            <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={sel}>
              {["IT Services","SaaS","Digital Agency","Cloud/Infra","Consulting","Data/Analytics","E-commerce","Fintech"].map(i => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "11px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, color: "#64748b", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={handleCreate} disabled={creating} style={{ flex: 1, padding: "11px", background: "#1d4ed8", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: creating ? 0.7 : 1 }}>
              {creating ? "Creating…" : "Create Company"}
            </button>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={selected.name} subtitle={`Company ID: ${selected.id}`} onClose={() => setSelected(null)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {([["Owner Email",selected.ownerEmail],["Industry",selected.industry],["Country",selected.country],["Created",selected.createdAt],["Employees",String(selected.employees)],["Last Active",selected.lastActive]] as [string,string][]).map(([k,v]) => (
              <div key={k} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, textAlign: "center" as const }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Plan</div>
              <Badge label={selected.plan} color={planColor[selected.plan] ?? "#64748b"} bg={planBg[selected.plan]} />
            </div>
            <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, textAlign: "center" as const }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Status</div>
              <Badge label={selected.status} color={statusC[selected.status] ?? "#64748b"} bg={statusBg[selected.status]} />
            </div>
            <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, textAlign: "center" as const }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>MRR</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>₹{selected.mrr.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {([["Change Plan","#1d4ed8","#fff"],["Suspend","#fef2f2","#ef4444"],["Delete","#f8fafc","#64748b"]] as [string,string,string][]).map(([l, bg, c]) => (
              <button key={l} onClick={() => setSelected(null)} style={{ padding: "10px", background: bg, border: `1px solid ${c}30`, borderRadius: 9, color: c, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{l}</button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── 3. ALL USERS ─────────────────────────────────────────────────────────────
function AllUsers() {
  const [search, setSearch] = useState("");
  const [roleF, setRoleF]   = useState("all");

  const filtered = useMemo(() => ALL_USERS.filter(u => {
    const q = search.toLowerCase();
    return (!q || u.name.toLowerCase().includes(q) || u.email.includes(q) || u.company.toLowerCase().includes(q))
      && (roleF === "all" || u.role === roleF);
  }), [search, roleF]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>All Users</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>{ALL_USERS.length} users across all companies</p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}><Ic p={P.search} s={14} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, company..." style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: 4 }}>
          {["all","admin","manager","hr","employee"].map(r => (
            <button key={r} onClick={() => setRoleF(r)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const, background: roleF === r ? "#1d4ed8" : "transparent", color: roleF === r ? "#fff" : "#64748b" }}>{r}</button>
          ))}
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              {["User","Company","Role","Status","Joined","Last Login","Actions"].map(h => (
                <th key={h} style={{ padding: "11px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f8fafc" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={u.name} size={32} color={roleC[u.role] ?? "#3b82f6"} />
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "13px 18px", color: "#64748b", fontSize: 12 }}>{u.company}</td>
                <td style={{ padding: "13px 18px" }}><Badge label={u.role} color={roleC[u.role] ?? "#64748b"} bg={roleBg[u.role] ?? "#f1f5f9"} /></td>
                <td style={{ padding: "13px 18px" }}><Badge label={u.status} color={statusC[u.status] ?? "#64748b"} bg={statusBg[u.status] ?? "#f1f5f9"} /></td>
                <td style={{ padding: "13px 18px", color: "#94a3b8", fontSize: 12 }}>{u.joined}</td>
                <td style={{ padding: "13px 18px", color: "#94a3b8", fontSize: 12 }}>{u.lastLogin}</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ padding: "4px 10px", background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View</button>
                    <button style={{ padding: "4px 10px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 12, background: "#fafafa" }}>
          Showing {filtered.length} of {ALL_USERS.length} users
        </div>
      </div>
    </div>
  );
}

// ── 4. ANALYTICS ─────────────────────────────────────────────────────────────
function Analytics() {
  const bars = [42,58,61,70,68,81,94,88,107,119,128,141];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const maxB = Math.max(...bars);
  const userGrowth = [8,14,18,24,29,36,42,48,57,63,71,82];
  const maxU = Math.max(...userGrowth);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Platform Analytics</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>Revenue, growth, and usage metrics</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <StatCard icon="dollar"   label="MRR"        value="₹12,996" sub="Monthly Recurring Revenue" accent="#f59e0b" trend="+18% MoM" />
        <StatCard icon="users"    label="Total Users" value="121"     sub="Across 7 companies"        accent="#3b82f6" trend="+11 this mo" />
        <StatCard icon="trending" label="Churn Rate"  value="2.1%"    sub="1 company suspended"       accent="#ef4444" trend="-0.5% improved" />
        <StatCard icon="zap"      label="DAU"         value="67"      sub="Daily active users"         accent="#10b981" trend="+8 vs last wk" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 18 }}>Monthly Revenue (₹K)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
            {bars.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: `${(v / maxB) * 120}px`, background: i >= 10 ? "#3b82f6" : "#bfdbfe", borderRadius: "3px 3px 0 0" }} />
                <div style={{ fontSize: 8, color: "#94a3b8" }}>{months[i].slice(0, 1)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 18 }}>User Growth (cumulative)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
            {userGrowth.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: `${(v / maxU) * 120}px`, background: i >= 10 ? "#8b5cf6" : "#ddd6fe", borderRadius: "3px 3px 0 0" }} />
                <div style={{ fontSize: 8, color: "#94a3b8" }}>{months[i].slice(0, 1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Company Performance</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              {["Rank","Company","Plan","Users","MRR","Share","Growth"].map(h => (
                <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...COMPANIES].sort((a, b) => b.mrr - a.mrr).map((c, i) => {
              const totalMRR = COMPANIES.reduce((s, x) => s + x.mrr, 0);
              const share = totalMRR ? Math.round(c.mrr / totalMRR * 100) : 0;
              const growths = ["+24%","+11%","+8%","—","—","—","—"];
              const rankColors = ["#f59e0b","#3b82f6","#8b5cf6","#94a3b8","#94a3b8","#94a3b8","#94a3b8"];
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: (rankColors[i] ?? "#94a3b8") + "20", color: rankColors[i] ?? "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                  </td>
                  <td style={{ padding: "12px 18px", fontWeight: 700, color: "#1e293b" }}>{c.name}</td>
                  <td style={{ padding: "12px 18px" }}><Badge label={c.plan} color={planColor[c.plan] ?? "#64748b"} bg={planBg[c.plan]} /></td>
                  <td style={{ padding: "12px 18px", color: "#374151", fontWeight: 700 }}>{c.employees}</td>
                  <td style={{ padding: "12px 18px", color: "#f59e0b", fontWeight: 700 }}>₹{c.mrr.toLocaleString()}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                        <div style={{ width: `${share}%`, height: "100%", background: "#f59e0b", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 30 }}>{share}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: (growths[i] ?? "—").startsWith("+") ? "#10b981" : "#94a3b8" }}>{growths[i] ?? "—"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 5. BILLING ───────────────────────────────────────────────────────────────
function Billing() {
  const invoices: Invoice[] = [
    { id:"INV-001", company:"CloudPeak Inc",     plan:"enterprise", amount:4999, date:"Mar 1, 2026", status:"paid"    },
    { id:"INV-002", company:"TechGy Innovations",plan:"enterprise", amount:4999, date:"Mar 1, 2026", status:"paid"    },
    { id:"INV-003", company:"Nexus Digital",     plan:"pro",        amount:999,  date:"Mar 1, 2026", status:"paid"    },
    { id:"INV-004", company:"ByteForge Labs",    plan:"pro",        amount:999,  date:"Mar 1, 2026", status:"paid"    },
    { id:"INV-005", company:"Sigma Analytics",   plan:"pro",        amount:999,  date:"Mar 1, 2026", status:"pending" },
    { id:"INV-006", company:"Orion Systems",     plan:"free",       amount:0,    date:"—",           status:"free"    },
    { id:"INV-007", company:"Vertex Solutions",  plan:"free",       amount:0,    date:"—",           status:"free"    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Billing & Revenue</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>Subscription management and payment tracking</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <StatCard icon="dollar" label="MRR"     value="₹12,996" sub="5 paying customers"   accent="#f59e0b" />
        <StatCard icon="chart"  label="ARR"     value="₹155,952"sub="Annualized run rate"  accent="#10b981" />
        <StatCard icon="check"  label="Paid"    value="4"       sub="Active subscriptions"  accent="#3b82f6" />
        <StatCard icon="alert"  label="Pending" value="1"       sub="Awaiting payment"       accent="#ef4444" />
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, color: "#1e293b", fontSize: 15 }}>Invoice History</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
              {["Invoice","Company","Plan","Amount","Date","Status","Action"].map(h => (
                <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f8fafc" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 18px", color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>{inv.id}</td>
                <td style={{ padding: "12px 18px", fontWeight: 700, color: "#1e293b" }}>{inv.company}</td>
                <td style={{ padding: "12px 18px" }}><Badge label={inv.plan} color={planColor[inv.plan] ?? "#64748b"} bg={planBg[inv.plan]} /></td>
                <td style={{ padding: "12px 18px", color: "#f59e0b", fontWeight: 800 }}>{inv.amount ? `₹${inv.amount.toLocaleString()}` : "—"}</td>
                <td style={{ padding: "12px 18px", color: "#94a3b8", fontSize: 12 }}>{inv.date}</td>
                <td style={{ padding: "12px 18px" }}>
                  <Badge label={inv.status} color={inv.status==="paid"?"#10b981":inv.status==="pending"?"#f59e0b":"#94a3b8"} bg={inv.status==="paid"?"#ecfdf5":inv.status==="pending"?"#fffbeb":"#f1f5f9"} />
                </td>
                <td style={{ padding: "12px 18px" }}>
                  {inv.status==="paid" && <button style={{ padding:"4px 10px", background:"#eff6ff", color:"#3b82f6", border:"none", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer" }}>Download</button>}
                  {inv.status==="pending" && <button style={{ padding:"4px 10px", background:"#fffbeb", color:"#f59e0b", border:"none", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer" }}>Send Reminder</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 6. AUDIT LOG ─────────────────────────────────────────────────────────────
function AuditLog() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? AUDIT_LOGS : AUDIT_LOGS.filter(l => l.type === filter);
  const auditIcon: Record<string, string> = { create:P.plus, suspend:P.lock, upgrade:P.zap, alert:P.alert };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Audit Log</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>All platform-level actions and system events</p>
      </div>
      <div style={{ display: "flex", gap: 4, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: 4, alignSelf: "flex-start" }}>
        {["all","create","suspend","upgrade","alert"].map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const, background: filter === t ? "#1d4ed8" : "transparent", color: filter === t ? "#fff" : "#64748b" }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(log => (
          <div key={log.id} style={{ background: "#fff", border: `1px solid ${log.type === "alert" ? "#8b5cf620" : "#e2e8f0"}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: auditBg[log.type] ?? "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: auditC[log.type] ?? "#64748b", flexShrink: 0 }}>
              <Ic p={auditIcon[log.type] ?? P.activity} s={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{log.action}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Target: <span style={{ color: "#64748b" }}>{log.target}</span> · Actor: <span style={{ color: "#64748b" }}>{log.actor}</span></div>
            </div>
            <Badge label={log.type} color={auditC[log.type] ?? "#64748b"} bg={auditBg[log.type]} />
            <div style={{ fontSize: 11, color: "#94a3b8", minWidth: 140, textAlign: "right" as const }}>{log.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 7. SUPPORT ───────────────────────────────────────────────────────────────
function Support() {
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Support Tickets</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>{SUPPORT.filter(s => s.status === "open").length} open tickets across all companies</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <StatCard icon="mail"  label="Open Tickets"  value={SUPPORT.filter(s=>s.status==="open").length}     sub="Need attention"   accent="#f59e0b" />
        <StatCard icon="check" label="Resolved"       value={SUPPORT.filter(s=>s.status==="resolved").length} sub="This month"        accent="#10b981" />
        <StatCard icon="zap"   label="High Priority"  value={SUPPORT.filter(s=>s.priority==="high").length}   sub="Urgent attention"  accent="#ef4444" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SUPPORT.map(t => (
          <div key={t.id} style={{ background: "#fff", border: `1px solid ${t.priority==="high"&&t.status==="open" ? "#fecaca" : "#e2e8f0"}`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <Avatar name={t.from} size={40} color={priorityC[t.priority] ?? "#64748b"} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{t.subject}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{t.from} · {t.company} · {t.time}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge label={t.priority} color={priorityC[t.priority] ?? "#64748b"} bg={priorityBg[t.priority]} />
              <Badge label={t.status}   color={statusC[t.status] ?? "#64748b"} bg={statusBg[t.status] ?? "#f1f5f9"} />
            </div>
            {t.status === "open" && (
              <button onClick={() => setSelected(t)} style={{ padding: "7px 14px", background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reply</button>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <Modal title={`Reply: ${selected.subject}`} subtitle={`From ${selected.from} · ${selected.company}`} onClose={() => setSelected(null)}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Original message</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{selected.subject}</div>
          </div>
          <Field label="Your Reply">
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} placeholder="Type your response..." style={{ ...inp, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "10px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, color: "#64748b", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={() => { setSelected(null); setReply(""); }} style={{ flex: 1, padding: "10px", background: "#1d4ed8", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Send Reply</button>
            <button onClick={() => setSelected(null)} style={{ padding: "10px 16px", background: "#ecfdf5", border: "none", borderRadius: 9, color: "#10b981", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Mark Resolved</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── 8. SETTINGS ──────────────────────────────────────────────────────────────
interface ToggleRowProps { label: string; sub: string; defaultOn: boolean; }
function ToggleRow({ label, sub, defaultOn }: ToggleRowProps) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div>
        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
      <div onClick={() => setOn(o => !o)} style={{ width: 42, height: 22, borderRadius: 11, background: on ? "#1d4ed8" : "#e2e8f0", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 22 : 4, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );
}

function Settings() {
  const [tab, setTab] = useState("general");
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Platform Settings</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "3px 0 0" }}>Configure your WorkSphere SaaS platform</p>
      </div>
      <div style={{ display: "flex", gap: 3, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: 4, alignSelf: "flex-start" }}>
        {([ ["general","globe","General"], ["security","shield","Security"], ["billing","dollar","Billing Plans"], ["notifications","bell","Notifications"] ] as [string,string,string][]).map(([k,ic,label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: tab === k ? "#1d4ed8" : "transparent", color: tab === k ? "#fff" : "#64748b" }}>
            <Ic p={P[ic] ?? ""} s={13} />{label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 26, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 4 }}>General Configuration</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Platform Name"><input defaultValue="WorkSphere" style={inp} /></Field>
            <Field label="Support Email"><input defaultValue="support@worksphere.io" style={inp} /></Field>
            <Field label="Default Country">
              <select defaultValue="India" style={sel}>
                {["India","US","UK","UAE"].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Default Timezone">
              <select defaultValue="Asia/Kolkata" style={sel}>
                {["Asia/Kolkata","UTC","America/New_York","Europe/London"].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Platform Tagline"><input defaultValue="The Complete IT Company OS" style={inp} /></Field>
          <button onClick={save} style={{ alignSelf: "flex-start", padding: "10px 24px", background: saved ? "#ecfdf5" : "#1d4ed8", border: saved ? "1.5px solid #10b98140" : "none", borderRadius: 9, color: saved ? "#10b981" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      )}

      {tab === "security" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 26, display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 12 }}>Security Settings</div>
          <ToggleRow label="Enforce 2FA for Super Admins"    sub="Require two-factor authentication"             defaultOn={true}  />
          <ToggleRow label="Force password reset on signup"  sub="New users must change password on first login" defaultOn={true}  />
          <ToggleRow label="IP allowlist for Super Admin"    sub="Restrict super admin login to specific IPs"     defaultOn={false} />
          <ToggleRow label="Session timeout (idle)"          sub="Auto-logout after inactivity"                   defaultOn={true}  />
          <ToggleRow label="Audit all login events"          sub="Log every login attempt to audit trail"          defaultOn={true}  />
          <button onClick={save} style={{ alignSelf: "flex-start", marginTop: 12, padding: "10px 24px", background: saved ? "#ecfdf5" : "#1d4ed8", border: saved ? "1.5px solid #10b98140" : "none", borderRadius: 9, color: saved ? "#10b981" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            {saved ? "✓ Saved!" : "Save Security Settings"}
          </button>
        </div>
      )}

      {tab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { plan:"Free",       price:0,    color:"#64748b", bg:"#f1f5f9", features:["Up to 5 employees","Basic attendance","Leave management","Email support"] },
            { plan:"Pro",        price:999,  color:"#3b82f6", bg:"#eff6ff", features:["Up to 50 employees","All modules","Priority support","Analytics dashboard","Custom roles"] },
            { plan:"Enterprise", price:4999, color:"#f59e0b", bg:"#fffbeb", features:["Unlimited employees","White-label options","Dedicated support","API access","Custom integrations","SSO / SAML"] },
          ].map(p => (
            <div key={p.plan} style={{ background: "#fff", border: `1.5px solid ${p.color}30`, borderRadius: 14, padding: 22, display: "flex", gap: 20, alignItems: "flex-start", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ minWidth: 140 }}>
                <Badge label={p.plan} color={p.color} bg={p.bg} />
                <div style={{ fontSize: 26, fontWeight: 800, color: p.color, marginTop: 10 }}>₹{p.price.toLocaleString()}<span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>/mo</span></div>
              </div>
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", borderRadius: 8, padding: "5px 12px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#10b981", fontSize: 11 }}>✓</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{ padding: "8px 18px", background: "#f8fafc", border: `1.5px solid ${p.color}40`, color: p.color, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Edit Plan</button>
            </div>
          ))}
        </div>
      )}

      {tab === "notifications" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 26, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, marginBottom: 16 }}>Notification Preferences</div>
          <ToggleRow label="New company signup"      sub="Email notification" defaultOn={true}  />
          <ToggleRow label="Plan upgrade / downgrade" sub="Email notification" defaultOn={true}  />
          <ToggleRow label="Payment failure"         sub="Email notification" defaultOn={true}  />
          <ToggleRow label="Company suspension"      sub="Email notification" defaultOn={true}  />
          <ToggleRow label="New support ticket"      sub="Email notification" defaultOn={true}  />
          <ToggleRow label="Security alert"          sub="Email notification" defaultOn={true}  />
          <ToggleRow label="Weekly platform report"  sub="Email notification" defaultOn={false} />
          <ToggleRow label="Monthly revenue summary" sub="Email notification" defaultOn={true}  />
          <button onClick={save} style={{ marginTop: 16, padding: "10px 24px", background: saved ? "#ecfdf5" : "#1d4ed8", border: saved ? "1.5px solid #10b98140" : "none", borderRadius: 9, color: saved ? "#10b981" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            {saved ? "✓ Saved!" : "Save Preferences"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── NAV CONFIG ────────────────────────────────────────────────────────────────
interface NavItem { id: string; label: string; icon: string; badge?: number; }
interface NavSection { section: string; items: NavItem[]; }

const NAV: NavSection[] = [
  { section:"OVERVIEW", items:[
    { id:"overview",  label:"Dashboard",  icon:"grid"     },
    { id:"analytics", label:"Analytics",  icon:"chart"    },
  ]},
  { section:"PLATFORM", items:[
    { id:"companies", label:"Companies",  icon:"building", badge:COMPANIES.length   },
    { id:"users",     label:"All Users",  icon:"users",    badge:ALL_USERS.length    },
    { id:"billing",   label:"Billing",    icon:"dollar"   },
  ]},
  { section:"OPERATIONS", items:[
    { id:"audit",     label:"Audit Log",  icon:"activity" },
    { id:"support",   label:"Support",    icon:"mail",     badge:SUPPORT.filter(s=>s.status==="open").length },
  ]},
  { section:"SYSTEM", items:[
    { id:"settings",  label:"Settings",   icon:"settings" },
  ]},
];

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
interface SidebarProps { active: string; onNav: (id: string) => void; collapsed: boolean; onCollapse: () => void; }
function Sidebar({ active, onNav, collapsed, onCollapse }: SidebarProps) {
  return (
    <div style={{ width: collapsed ? 62 : 220, background: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", height: "100vh", flexShrink: 0, transition: "width 0.22s ease", overflow: "hidden" }}>
      <div style={{ padding: collapsed ? "16px 0" : "16px 18px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 10, flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#000" }}>W</div>
            <div>
              <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 14, lineHeight: 1 }}>WorkSphere</div>
              <div style={{ fontSize: 9, color: "#475569", marginTop: 2, letterSpacing: 1 }}>SUPER ADMIN</div>
            </div>
          </div>
        )}
        {collapsed && <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#000" }}>W</div>}
        {!collapsed && (
          <button onClick={onCollapse} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", display: "flex" }}>
            <Ic p={P.chevD} s={15} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {NAV.map(sec => (
          <div key={sec.section}>
            {!collapsed && <div style={{ padding: "10px 18px 3px", fontSize: 9, color: "#334155", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{sec.section}</div>}
            {sec.items.map(item => {
              const isActive = active === item.id;
              return (
                <button key={item.id} onClick={() => onNav(item.id)} title={collapsed ? item.label : undefined}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: collapsed ? 0 : 10, justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "9px 16px", background: isActive ? "#f59e0b18" : "transparent", border: "none", borderLeft: isActive ? "3px solid #f59e0b" : "3px solid transparent", color: isActive ? "#fbbf24" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: isActive ? 700 : 500 }}>
                  <Ic p={P[item.icon] ?? ""} s={15} />
                  {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
                  {!collapsed && item.badge != null && <span style={{ background: "#1d4ed8", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 10 }}>{item.badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#000", flexShrink: 0 }}>S</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Super Admin</div>
            <div style={{ fontSize: 10, color: "#475569" }}>Platform Owner</div>
          </div>
          <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", display: "flex" }}><Ic p={P.logout} s={14} /></button>
        </div>
      )}
    </div>
  );
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
interface TopBarProps { active: string; onCollapse: () => void; }
function TopBar({ active, onCollapse }: TopBarProps) {
  const label = NAV.flatMap(s => s.items).find(i => i.id === active)?.label ?? "Dashboard";
  return (
    <div style={{ height: 56, background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", paddingLeft: 22, paddingRight: 18, gap: 14, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <button onClick={onCollapse} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}>
        <Ic p={P.chevD} s={14} />
      </button>
      <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 16 }}>{label}</span>
      <div style={{ flex: 1 }} />
      <Badge label="👑 Super Admin" color="#f59e0b" bg="#fffbeb" />
      <div style={{ height: 20, width: 1, background: "#e2e8f0" }} />
      <button style={{ width: 34, height: 34, borderRadius: "50%", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer", position: "relative" }}>
        <Ic p={P.bell} s={16} />
        <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" }} />
      </button>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [active, setActive]       = useState("overview");
  const [collapsed, setCollapsed] = useState(false);

  const views: Record<string, ReactNode> = {
    overview:  <Overview onNav={setActive} />,
    companies: <Companies />,
    users:     <AllUsers />,
    analytics: <Analytics />,
    billing:   <Billing />,
    audit:     <AuditLog />,
    support:   <Support />,
    settings:  <Settings />,
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: 'Segoe UI', 'DM Sans', sans-serif; color: #1e293b; }
        input, select, textarea, button { font-family: inherit; }
        input::placeholder, textarea::placeholder { color: #cbd5e1; }
        input:focus, select:focus, textarea:focus { border-color: #3b82f6 !important; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", background: "#f1f5f9", overflow: "hidden" }}>
        <Sidebar active={active} onNav={setActive} collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar active={active} onCollapse={() => setCollapsed(c => !c)} />
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {views[active] ?? <div style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Coming soon</div>}
          </div>
        </div>
      </div>
    </>
  );
}