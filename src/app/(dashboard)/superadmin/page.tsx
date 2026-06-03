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
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  x: "M18 6 6 18M6 6l12 12",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  menu: "M3 12h18M3 6h18M3 18h18"
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
const statusC: Record<string, string> = { active: "#10b981", suspended: "#ef4444", resolved: "#10b981", open: "#f59e0b" };
const auditC: Record<string, string> = { create: "#10b981", suspend: "#ef4444", upgrade: "#3b82f6", alert: "#8b5cf6" };
const auditBg: Record<string, string> = { create: "#ecfdf5", suspend: "#fef2f2", upgrade: "#eff6ff", alert: "#f5f3ff" };
const roleC: Record<string, string> = { admin: "#8b5cf6", manager: "#3b82f6", hr: "#ec4899", finance: "#f59e0b", employee: "#10b981" };

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Badge = ({ label, color, bg }: { label: string; color: string; bg?: string }) => (
  <span style={{
    background: bg || color + "15",
    color,
  }} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-current/20 whitespace-nowrap capitalize inline-block">
    {label}
  </span>
);

const Avatar = ({ name, size = 34, color = "#3b82f6" }: { name: string; size?: number; color?: string }) => (
  <div style={{
    width: size, height: size,
    background: color + "20",
    border: `1px solid ${color}40`,
    fontSize: size * 0.38, color,
  }} className="rounded-full flex items-center justify-center font-extrabold shrink-0">
    {name?.[0]?.toUpperCase()}
  </div>
);

const StatCard = ({ icon, label, value, sub, accent = "#3b82f6", trend, iconBg }: any) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col gap-2 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      <div style={{ background: iconBg || accent + "12", color: accent }} className="w-8 h-8 rounded-lg flex items-center justify-center">
        <Ic p={P[icon]} s={16} />
      </div>
    </div>
    <div className="text-2xl font-extrabold text-slate-800 leading-none">{value}</div>
    <div className="flex items-center justify-between">
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      {trend && <span className={`text-[10px] font-bold ${trend.startsWith("+") ? "text-emerald-500" : "text-rose-500"}`}>{trend}</span>}
    </div>
  </div>
);

function Modal({ title, subtitle, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white rounded-2xl p-5 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-slate-800 text-lg font-extrabold m-0">{title}</h3>
            {subtitle && <p className="text-slate-400 text-xs mt-0.5 mb-0">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="bg-slate-100 border-none text-slate-500 w-7 h-7 rounded-md cursor-pointer flex items-center justify-center hover:bg-slate-200 transition-colors">
            <Ic p={P.x} s={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inpClass = "w-full px-3 py-2 bg-slate-50 border-[1.5px] border-slate-200 rounded-lg text-slate-800 text-[13px] box-border outline-none focus:border-blue-500 transition-colors";
const selClass = `${inpClass} cursor-pointer`;

/* ================= MAIN COMPONENT ================= */
export default function SuperAdminPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  if (loading) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Ic p={P.shield} s={16} />
          </div>
          <div className="font-extrabold text-[15px]">WorkSphere <span className="text-blue-500 text-[9px]">ROOT</span></div>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white bg-transparent border-none">
          <Ic p={mobileMenuOpen ? P.x : P.menu} s={24} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`${mobileMenuOpen ? "flex" : "hidden"} md:flex absolute md:relative z-40 w-full md:w-[250px] h-[calc(100vh-64px)] md:h-full bg-slate-900 text-white flex-col transition-transform top-[64px] md:top-0 left-0`}>
        <div className="hidden md:flex h-16 items-center gap-2.5 px-5 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Ic p={P.shield} s={16} />
          </div>
          <div className="font-extrabold text-[15px]">WorkSphere <span className="text-blue-500 text-[9px]">ROOT</span></div>
        </div>
        <div className="flex-1 p-3 md:p-4 flex flex-col gap-1 overflow-y-auto">
          {[
            { id: "overview", label: "Dashboard", icon: "grid" },
            { id: "companies", label: "Tenants", icon: "building", badge: companies.length },
            { id: "users", label: "Global Users", icon: "users", badge: allUsers.length },
            { id: "audit", label: "Audit Trail", icon: "activity" },
          ].map(m => (
            <button key={m.id} onClick={() => { setActiveTab(m.id); setMobileMenuOpen(false); }} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-none cursor-pointer text-[13px] font-semibold transition-colors ${activeTab === m.id ? "bg-blue-500/15 text-blue-500" : "bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-300"}`}>
              <Ic p={P[m.icon] || ""} s={14} />
              <span className="flex-1 text-left">{m.label}</span>
              {m.badge != null && <span className="text-[9px] opacity-80">{m.badge}</span>}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5">
          <button onClick={() => auth.signOut()} className="w-full flex items-center gap-2 text-rose-500 bg-transparent border-none cursor-pointer text-xs font-bold hover:text-rose-400 transition-colors">
            <Ic p={P.logout} s={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {activeTab === "overview" && <Overview companies={companies} allUsers={allUsers} auditLogs={auditLogs} onNav={setActiveTab} />}
        {activeTab === "companies" && <CompaniesView companies={companies} />}
        {activeTab === "users" && <UsersView users={allUsers} />}
        {activeTab === "audit" && <AuditView logs={auditLogs} />}
      </main>
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview({ companies, allUsers, auditLogs, onNav }: any) {
  const mrr = companies.reduce((s: number, c: any) => s + (c.mrr || 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="building" label="Total Tenants" value={companies.length} accent="#3b82f6" />
        <StatCard icon="dollar" label="Monthly Rev" value={`₹${mrr.toLocaleString()}`} accent="#f59e0b" />
        <StatCard icon="users" label="Global Users" value={allUsers.length} accent="#8b5cf6" />
        <StatCard icon="activity" label="Avg Uptime" value="99.98%" accent="#10b981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="font-extrabold text-[14px]">Recent Tenants</span>
            <button onClick={() => onNav("companies")} className="bg-transparent border-none text-blue-500 text-[11px] font-bold cursor-pointer hover:underline">View All</button>
          </div>
          {companies.slice(0, 5).map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <Avatar name={c.name} size={32} />
              <div className="flex-1">
                <div className="font-bold text-[13px]">{c.name}</div>
                <div className="text-[10px] text-slate-400">{c.plan} · {c.country}</div>
              </div>
              <div className="font-extrabold text-amber-500 text-xs">₹{(c.mrr || 0).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className="font-extrabold text-[14px] block mb-4">Recent Platform Events</span>
          {auditLogs.slice(0, 6).map((l: any) => (
            <div key={l.id} className="flex gap-2.5 py-2 items-start">
              <div style={{ background: auditC[l.type] || "#cbd5e1" }} className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" />
              <div>
                <div className="font-bold text-xs text-slate-800">{l.action}</div>
                <div className="text-[10px] text-slate-400">Target: {l.target} · {l.time ? new Date(l.time).toLocaleTimeString() : "N/A"}</div>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="m-0 text-xl font-extrabold text-slate-800">Tenants</h2>
          <p className="m-0 mt-0.5 text-slate-400 text-xs">Manage all business subscriptions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-blue-500 text-white border-none rounded-lg px-4 py-2 font-bold text-[13px] cursor-pointer hover:bg-blue-600 transition-colors shrink-0">Provision New Tenant</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full border-collapse text-[13px] min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Company", "Owner Email", "Plan", "MRR", "Status"].map(h => <th key={h} className="p-3 md:px-5 md:py-3 text-left text-[10px] text-slate-400 uppercase font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-3 md:px-5 md:py-3.5 font-bold text-slate-800">{c.name}</td>
                <td className="p-3 md:px-5 md:py-3.5 text-slate-500">{c.ownerEmail}</td>
                <td className="p-3 md:px-5 md:py-3.5"><Badge label={c.plan} color={planColor[c.plan] || "#64748b"} /></td>
                <td className="p-3 md:px-5 md:py-3.5 font-extrabold text-slate-800">₹{(c.mrr || 0).toLocaleString()}</td>
                <td className="p-3 md:px-5 md:py-3.5"><Badge label={c.status} color={statusC[c.status] || "#64748b"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Provision New Company" onClose={() => setShowCreate(false)}>
          {msg && <div className={`p-3 rounded-lg text-xs font-semibold mb-4 ${msg.includes("✅") ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"}`}>{msg}</div>}
          <div className="flex flex-col gap-3">
            <div><label className="text-[11px] font-bold text-slate-500 mb-1 block">Company Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inpClass} /></div>
            <div><label className="text-[11px] font-bold text-slate-500 mb-1 block">Admin Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inpClass} /></div>
            <div><label className="text-[11px] font-bold text-slate-500 mb-1 block">Initial Password</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inpClass} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[11px] font-bold text-slate-500 mb-1 block">Plan</label><select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className={selClass}><option value="free">Free</option><option value="pro">Pro (₹999)</option><option value="enterprise">Enterprise (₹4999)</option></select></div>
              <div><label className="text-[11px] font-bold text-slate-500 mb-1 block">Country</label><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inpClass} /></div>
            </div>
            <button onClick={handleCreate} disabled={loading} className={`mt-2 bg-blue-500 text-white border-none rounded-lg p-3 font-extrabold cursor-pointer hover:bg-blue-600 transition-colors ${loading ? "opacity-60" : ""}`}>{loading ? "Provisioning..." : "Initialize Tenant"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── USERS VIEW ───────────────────────────────────────────────────────────────
function UsersView({ users }: { users: User[] }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="m-0 text-xl font-extrabold text-slate-800">Global User Directory</h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full border-collapse text-[13px] min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{["User", "Company", "Role", "Joined"].map(h => <th key={h} className="p-3 md:px-5 md:py-3 text-left text-[10px] text-slate-400 uppercase font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-3 md:px-5 md:py-3">
                  <div className="font-bold text-slate-800">{u.name}</div>
                  <div className="text-[11px] text-slate-400">{u.email}</div>
                </td>
                <td className="p-3 md:px-5 md:py-3 text-slate-500">{u.company}</td>
                <td className="p-3 md:px-5 md:py-3"><Badge label={u.role} color={roleC[u.role] || "#64748b"} /></td>
                <td className="p-3 md:px-5 md:py-3 text-slate-400">{u.joined}</td>
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
    <div className="flex flex-col gap-5">
      <h2 className="m-0 text-xl font-extrabold text-slate-800">Platform Audit Trail</h2>
      <div className="flex flex-col gap-2">
        {logs.map(l => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-3 md:px-4 md:py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shadow-sm">
            <div style={{ background: auditBg[l.type] || "#f1f5f9", color: auditC[l.type] || "#64748b" }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
              <Ic p={P.activity} s={14} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[13px] text-slate-800">{l.action}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Target: {l.target} · Actor: {l.actor}</div>
            </div>
            <div className="text-[11px] text-slate-400 shrink-0">{l.time ? new Date(l.time).toLocaleString() : "N/A"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}