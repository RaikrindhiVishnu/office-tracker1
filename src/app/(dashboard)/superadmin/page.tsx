"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
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
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  building: "M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  chart: "M18 20V10M12 20V4M6 20v-6",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  trending: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  x: "M18 6 6 18M6 6l12 12",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  chevD: "M6 9l6 6 6-6",
  chevR: "M9 18l6-6-6-6",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  alert: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
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
interface CompanyForm {
  name: string; email: string; password: string;
  plan: string; industry: string; country: string;
}

// ── Color config ──────────────────────────────────────────────────────────────
const planColor: Record<string, string> = { free: "#64748b", pro: "#3b82f6", enterprise: "#f59e0b" };
const planBg: Record<string, string> = { free: "#f1f5f9", pro: "#eff6ff", enterprise: "#fffbeb" };
const statusC: Record<string, string> = { active: "#10b981", suspended: "#ef4444", resolved: "#10b981", open: "#f59e0b" };
const statusBg: Record<string, string> = { active: "#ecfdf5", suspended: "#fef2f2", resolved: "#ecfdf5", open: "#fffbeb" };
const auditC: Record<string, string> = { create: "#10b981", suspend: "#ef4444", upgrade: "#3b82f6", alert: "#8b5cf6" };
const auditBg: Record<string, string> = { create: "#ecfdf5", suspend: "#fef2f2", upgrade: "#eff6ff", alert: "#f5f3ff" };
const roleC: Record<string, string> = { admin: "#8b5cf6", manager: "#3b82f6", hr: "#ec4899", finance: "#f59e0b", employee: "#10b981" };
const roleBg: Record<string, string> = { admin: "#f5f3ff", manager: "#eff6ff", hr: "#fdf4ff", finance: "#fffbeb", employee: "#ecfdf5" };

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Badge = ({ label, color, bg }: { label: string; color: string; bg?: string }) => (
  <span style={{
    background: bg || color + "15",
    color,
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 20,
    border: `1px solid ${color}30`,
    whiteSpace: "nowrap",
    textTransform: "capitalize",
    display: "inline-block",
  }}>
    {label}
  </span>
);

const Avatar = ({ name, size = 34, color = "#3b82f6" }: { name: string; size?: number; color?: string }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: color + "20",
    border: `1px solid ${color}40`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.38, fontWeight: 800, color, flexShrink: 0,
  }}>
    {name?.[0]?.toUpperCase()}
  </div>
);

const StatCard = ({ icon, label, value, sub, accent = "#3b82f6", trend, iconBg }: any) => (
  <div style={{
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: iconBg || accent + "12",
        display: "flex", alignItems: "center", justifyContent: "center", color: accent,
      }}>
        <Ic p={P[icon]} s={16} />
      </div>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{value}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
      {trend && <span style={{ fontSize: 10, fontWeight: 700, color: trend.startsWith("+") ? "#10b981" : "#ef4444" }}>{trend}</span>}
    </div>
  </div>
);

function Modal({ title, subtitle, onClose, children, width = 460 }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width, maxWidth: "95vw", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: "#1e293b", fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 0" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic p={P.x} s={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp: CSSProperties = { width: "100%", padding: "9px 12px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, boxSizing: "border-box", outline: "none" };
const sel: CSSProperties = { ...inp, cursor: "pointer" };

/* ================= MAIN COMPONENT ================= */
export default function SuperAdminPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!user) return;

    const unsubCompanies = onSnapshot(query(collection(db, "companies"), orderBy("createdAt", "desc")), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });

    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
      setAllUsers(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Unknown",
          email: data.email || "",
          company: data.companyId || "N/A",
          role: data.role || data.accountType || "employee",
          status: data.status || "active",
          joined: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "N/A",
          lastLogin: data.lastLogin ? new Date(data.lastLogin).toLocaleTimeString() : "N/A"
        } as User;
      }));
    });

    const unsubLogs = onSnapshot(query(collection(db, "audit_logs"), orderBy("time", "desc"), limit(50)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry)));
      setLoading(false);
    });

    return () => { unsubCompanies(); unsubUsers(); unsubLogs(); };
  }, [user]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", fontWeight: 700, color: "#64748b" }}>Loading Workspace...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 250, background: "#0f172a", color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic p={P.shield} s={16} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>WorkSphere <span style={{ color: "#3b82f6", fontSize: 9 }}>ROOT</span></div>
        </div>
        <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { id: "overview", label: "Dashboard", icon: "grid" },
            { id: "companies", label: "Tenants", icon: "building", badge: companies.length },
            { id: "users", label: "Global Users", icon: "users", badge: allUsers.length },
            { id: "audit", label: "Audit Trail", icon: "activity" },
          ].map(m => (
            <button key={m.id} onClick={() => setActiveTab(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: "none", background: activeTab === m.id ? "rgba(59,130,246,0.15)" : "transparent", color: activeTab === m.id ? "#3b82f6" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <Ic p={P[m.icon] || ""} s={14} />
              <span style={{ flex: 1, textAlign: "left" }}>{m.label}</span>
              {m.badge != null && <span style={{ fontSize: 9, opacity: 0.8 }}>{m.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => auth.signOut()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            <Ic p={P.logout} s={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {activeTab === "overview" && <Overview companies={companies} auditLogs={auditLogs} onNav={setActiveTab} />}
        {activeTab === "companies" && <CompaniesView companies={companies} />}
        {activeTab === "users" && <UsersView users={allUsers} />}
        {activeTab === "audit" && <AuditView logs={auditLogs} />}
      </main>
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview({ companies, auditLogs, onNav }: any) {
  const mrr = companies.reduce((s: number, c: any) => s + (c.mrr || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <StatCard icon="building" label="Total Tenants" value={companies.length} accent="#3b82f6" />
        <StatCard icon="dollar" label="Monthly Rev" value={`₹${mrr.toLocaleString()}`} accent="#f59e0b" />
        <StatCard icon="users" label="Global Users" value={allUsers.length} accent="#8b5cf6" />
        <StatCard icon="activity" label="Avg Uptime" value="99.98%" accent="#10b981" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Recent Tenants</span>
            <button onClick={() => onNav("companies")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>View All</button>
          </div>
          {companies.slice(0, 5).map((c: any) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
              <Avatar name={c.name} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{c.plan} · {c.country}</div>
              </div>
              <div style={{ fontWeight: 800, color: "#f59e0b", fontSize: 12 }}>₹{(c.mrr || 0).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
          <span style={{ fontWeight: 800, fontSize: 14, display: "block", marginBottom: 16 }}>Recent Platform Events</span>
          {auditLogs.slice(0, 6).map((l: any) => (
            <div key={l.id} style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "flex-start" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: auditC[l.type] || "#cbd5e1", marginTop: 6 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{l.action}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{l.target} · {l.time ? new Date(l.time).toLocaleTimeString() : "N/A"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COMPANIES VIEW ──────────────────────────────────────────────────────────
function CompaniesView({ companies }: { companies: Company[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CompanyForm>({ name: "", email: "", password: "", plan: "free", industry: "IT Services", country: "India" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleCreate = async () => {
    try {
      setLoading(true); setMsg("");
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/create-company", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("✅ Tenant Provisioned Successfully!");
      setTimeout(() => setShowCreate(false), 2000);
    } catch (e: any) { setMsg(`❌ ${e.message}`); } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Tenants</h2>
          <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 12 }}>Manage all business subscriptions</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Provision New Tenant</button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>
              {["Company", "Owner Email", "Plan", "MRR", "Status"].map(h => <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={{ padding: "14px 20px", fontWeight: 700 }}>{c.name}</td>
                <td style={{ padding: "14px 20px", color: "#64748b" }}>{c.ownerEmail}</td>
                <td style={{ padding: "14px 20px" }}><Badge label={c.plan} color={planColor[c.plan] || "#64748b"} /></td>
                <td style={{ padding: "14px 20px", fontWeight: 800 }}>₹{(c.mrr || 0).toLocaleString()}</td>
                <td style={{ padding: "14px 20px" }}><Badge label={c.status} color={statusC[c.status] || "#64748b"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Provision New Company" onClose={() => setShowCreate(false)}>
          {msg && <div style={{ padding: 12, borderRadius: 8, background: msg.includes("✅") ? "#ecfdf5" : "#fef2f2", color: msg.includes("✅") ? "#10b981" : "#ef4444", fontSize: 12, marginBottom: 16, fontWeight: 600 }}>{msg}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Company Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Admin Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Initial Password</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inp} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Plan</label><select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} style={sel}><option value="free">Free</option><option value="pro">Pro (₹999)</option><option value="enterprise">Enterprise (₹4999)</option></select></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Country</label><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} style={inp} /></div>
            </div>
            <button onClick={handleCreate} disabled={loading} style={{ marginTop: 8, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 800, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>{loading ? "Provisioning..." : "Initialize Tenant"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── USERS VIEW ───────────────────────────────────────────────────────────────
function UsersView({ users }: { users: User[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Global User Directory</h2>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>{["User", "Company", "Role", "Joined"].map(h => <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ fontWeight: 700 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>
                </td>
                <td style={{ padding: "12px 20px", color: "#64748b" }}>{u.company}</td>
                <td style={{ padding: "12px 20px" }}><Badge label={u.role} color={roleC[u.role] || "#64748b"} /></td>
                <td style={{ padding: "12px 20px", color: "#94a3b8" }}>{u.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AUDIT VIEW ───────────────────────────────────────────────────────────────
function AuditView({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Platform Audit Trail</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {logs.map(l => (
          <div key={l.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: auditBg[l.type] || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: auditC[l.type] || "#64748b" }}><Ic p={P.activity} s={14} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{l.action}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Target: {l.target} · Actor: {l.actor}</div>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{l.time ? new Date(l.time).toLocaleString() : "N/A"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}