"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { CSSProperties, ReactNode, ChangeEvent } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import {
  collection, getDocs, query, where,
  doc, updateDoc, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  navBg:"#234567", navText:"#a8b8d0", navActive:"#ffffff",
  bg:"#f0f4f8", surface:"#ffffff", surfaceAlt:"#f7fafd", border:"#e2eaf3",
  primary:"#1a6ed8", primaryLight:"#e8f0fd",
  green:"#22c55e", greenLight:"#dcfce7",
  red:"#ef4444", redLight:"#fee2e2",
  yellow:"#f59e0b", yellowLight:"#fef3c7",
  purple:"#8b5cf6", purpleLight:"#ede9fe",
  cyan:"#06b6d4", cyanLight:"#cffafe",
  text:"#1e293b", textMuted:"#64748b", textSoft:"#94a3b8",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.10)",
} as const;

const PIE_COLORS = [T.primary, T.purple, T.green, T.yellow, T.red, T.cyan];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee {
  id: string; name?: string; email?: string; department?: string;
  role?: string; status?: string; isBillingEmployee?: boolean; salary?: number | string;
  companyId?: string; [key: string]: unknown;
}
interface Project {
  id: string; name: string; clientName?: string; budget?: number | string;
  billingType?: string; status?: string; revenueGenerated?: number | string;
  companyId?: string; [key: string]: unknown;
}
interface Timesheet {
  id: string; date?: string; userId?: string; employeeId?: string;
  employeeName?: string; department?: string; projectName?: string;
  billingType?: string; hoursWorked?: number | string;
  companyId?: string; [key: string]: unknown;
}
interface Expense {
  id: string; type: string; amount?: number | string;
  description?: string; month?: number; year?: number;
  companyId?: string; [key: string]: unknown;
}
interface ProjForm {
  name: string; clientName: string; budget: string;
  billingType: string; status: string; revenueGenerated: string;
}
interface ExpForm { type: string; amount: string; description: string; }
interface EmpForm {
  department: string; isBillingEmployee: boolean; status: string; salary: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtINR = (n: number | string | undefined): string => {
  const x = Number(n) || 0;
  if (x >= 1e7) return `₹${(x / 1e7).toFixed(2)}Cr`;
  if (x >= 1e5) return `₹${(x / 1e5).toFixed(2)}L`;
  if (x >= 1000) return `₹${(x / 1000).toFixed(1)}K`;
  return `₹${x}`;
};
const fmtFull = (n: number | string | undefined): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
const thirtyDaysAgo = new Date(now);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const thirtyDayStr = thirtyDaysAgo.toISOString().split("T")[0];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Avatar({ name = "", size = 36 }: { name?: string; size?: number }) {
  const pal = ["#1a6ed8","#8b5cf6","#22c55e","#f59e0b","#ef4444","#06b6d4","#ec4899","#14b8a6"];
  const bg = pal[(name.charCodeAt(0) || 0) % pal.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, flexShrink: 0 }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

interface StatCardProps {
  label: string; value: string | number; sub?: string;
  icon: string; color?: string; lightColor?: string;
}
function StatCard({ label, value, sub, icon, color = T.primary, lightColor = T.primaryLight }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ background: T.surface, borderRadius: 14, padding: "18px 20px", boxShadow: hovered ? T.shadowMd : T.shadow, border: `1px solid ${T.border}`, transform: hovered ? "translateY(-1px)" : "translateY(0)", transition: "all 0.18s", cursor: "default" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.text, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: lightColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, marginLeft: 10 }}>{icon}</div>
      </div>
    </div>
  );
}

interface SectionCardProps { title: string; sub?: string; children: ReactNode; action?: ReactNode; }
function SectionCard({ title, sub, children, action }: SectionCardProps) {
  return (
    <div style={{ background: T.surface, borderRadius: 14, boxShadow: T.shadow, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

type BadgeLabel = "billing" | "non-billing" | "active" | "completed" | "on_hold" | "on_leave" | "resigned" | string;
function Badge({ label }: { label: BadgeLabel }) {
  const map: Record<string, { bg: string; color: string; text: string }> = {
    billing:       { bg: T.greenLight,   color: "#15803d",  text: "Billing"     },
    "non-billing": { bg: T.surfaceAlt,   color: T.textMuted,text: "Non-Billing" },
    active:        { bg: T.primaryLight, color: "#1d4ed8",  text: "Active"      },
    completed:     { bg: T.purpleLight,  color: "#6d28d9",  text: "Completed"   },
    on_hold:       { bg: T.yellowLight,  color: "#92400e",  text: "On Hold"     },
    on_leave:      { bg: T.yellowLight,  color: "#92400e",  text: "On Leave"    },
    resigned:      { bg: T.redLight,     color: "#991b1b",  text: "Resigned"    },
  };
  const s = map[label] ?? { bg: T.surfaceAlt, color: T.textMuted, text: label || "—" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", textTransform: "capitalize" }}>
      {s.text}
    </span>
  );
}

type BtnVariant = "primary" | "ghost" | "danger";
interface BtnProps { children: ReactNode; onClick?: () => void; variant?: BtnVariant; size?: "md" | "sm"; disabled?: boolean; }
function Btn({ children, onClick, variant = "primary", size = "md", disabled }: BtnProps) {
  const v: Record<BtnVariant, CSSProperties> = {
    primary: { background: T.primary,      color: "#fff" },
    ghost:   { background: "transparent",  color: T.primary, border: `1px solid ${T.border}` },
    danger:  { background: T.red,          color: "#fff" },
  };
  const sz: CSSProperties = size === "sm" ? { padding: "5px 12px", fontSize: 12 } : { padding: "8px 16px", fontSize: 13 };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ borderRadius: 8, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "opacity 0.15s", fontFamily: "inherit", opacity: disabled ? 0.6 : 1, ...v[variant], ...sz }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.82"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >
      {children}
    </button>
  );
}

interface InputProps { label?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; }
function Input({ label, value, onChange, type = "text", placeholder }: InputProps) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>{label}</label>}
      <input
        type={type} value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, color: T.text, background: T.surfaceAlt, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        onFocus={e => (e.target.style.borderColor = T.primary)}
        onBlur={e => (e.target.style.borderColor = T.border)}
      />
    </div>
  );
}

interface SelOption { value: string; label: string; }
interface SelProps { label?: string; value: string; onChange: (v: string) => void; options: SelOption[]; }
function Sel({ label, value, onChange, options }: SelProps) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>{label}</label>}
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, color: T.text, background: T.surfaceAlt, cursor: "pointer", fontFamily: "inherit", outline: "none" }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; }
function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,27,45,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: T.textMuted, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

interface ToastProps { msg: string; type: string; }
function Toast({ msg, type }: ToastProps) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: type === "error" ? T.red : T.green, color: "#fff", padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 3000, boxShadow: T.shadowMd, fontFamily: "inherit" }}>
      {msg}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function BusinessOwnerDashboard() {
  const { user } = useAuth();
  const companyId: string = (user as Record<string, string> | null)?.companyId || (user as Record<string, string> | null)?.company || (user as Record<string, string> | null)?.orgId || "";

  const [tab, setTab]               = useState("overview");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [toast, setToast]           = useState<{ msg: string; type: string }>({ msg: "", type: "success" });
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<Timesheet[]>([]);
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [sheetFilter, setSheetFilter] = useState("all");
  const [deptFilter, setDeptFilter]   = useState("all");
  const [empSearch, setEmpSearch]     = useState("");
  const [addProjModal, setAddProjModal]   = useState(false);
  const [editProjModal, setEditProjModal] = useState<Project | null>(null);
  const [addExpModal, setAddExpModal]     = useState(false);
  const [editEmpModal, setEditEmpModal]   = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [projForm, setProjForm] = useState<ProjForm>({ name: "", clientName: "", budget: "", billingType: "billing", status: "active", revenueGenerated: "" });
  const [expForm, setExpForm]   = useState<ExpForm>({ type: "Salaries", amount: "", description: "" });
  const [empForm, setEmpForm]   = useState<EmpForm>({ department: "", isBillingEmployee: false, status: "active", salary: "" });

  const showToast = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast({ msg: "", type: "success" }), 3500); };

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let eS, pS, tS, xS;
      if (companyId) {
        [eS, pS, tS, xS] = await Promise.all([
          getDocs(query(collection(db, "users"),      where("companyId", "==", companyId))),
          getDocs(query(collection(db, "projects"),   where("companyId", "==", companyId))),
          getDocs(query(collection(db, "timesheets"), where("companyId", "==", companyId))),
          getDocs(query(collection(db, "expenses"),   where("companyId", "==", companyId))),
        ]);
      } else {
        [eS, pS, tS, xS] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "projects")),
          getDocs(collection(db, "timesheets")),
          getDocs(collection(db, "expenses")),
        ]);
      }
      const emps   = eS.docs.map(d => ({ id: d.id, ...d.data() })) as Employee[];
      const projs  = pS.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];
      const allTS  = tS.docs.map(d => ({ id: d.id, ...d.data() })) as Timesheet[];
      const exps   = xS.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];
      const monthTS = allTS.filter(t => { const d = (t.date || "").toString().slice(0, 10); return d >= monthStart && d <= monthEnd; });
      setEmployees(emps); setProjects(projs);
      setTimesheets(monthTS); setAllTimesheets(allTS);
      setExpenses(exps);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("index"))      setError(`⚠️ Firestore index needed — check browser console. ${msg}`);
      else if (msg.includes("permission")) setError(`⚠️ Permission denied. Check Firestore security rules. ${msg}`);
      else setError(`⚠️ ${msg}`);
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Stats ──
  const S = useMemo(() => {
    const total     = employees.length;
    const billing   = employees.filter(e => e.isBillingEmployee).length;
    const active    = employees.filter(e => !e.status || e.status === "active").length;
    const onLeave   = employees.filter(e => e.status === "on_leave").length;
    const actProj   = projects.filter(p => p.status === "active").length;
    const totalRev  = projects.reduce((s, p)  => s + Number(p.revenueGenerated || 0), 0);
    const totalExp  = expenses.reduce((s, e)  => s + Number(e.amount || 0), 0);
    const billingH  = timesheets.filter(t => t.billingType === "billing").reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    const nonBillingH = timesheets.filter(t => t.billingType !== "billing").reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    const totalH    = billingH + nonBillingH;
    return { total, billing, nonBilling: total - billing, active, onLeave, actProj, totalRev, totalExp, netProfit: totalRev - totalExp, billingH, nonBillingH, utilPct: totalH > 0 ? ((billingH / totalH) * 100).toFixed(1) : "0.0" };
  }, [employees, projects, timesheets, expenses]);

  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter((d): d is string => Boolean(d)))], [employees]);

  const sheetData = useMemo(() => allTimesheets.filter(t => {
    const d = (t.date || "").toString().slice(0, 10);
    if (d < thirtyDayStr) return false;
    if (sheetFilter !== "all" && t.billingType !== sheetFilter) return false;
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    return true;
  }).sort((a, b) => ((b.date || "") > (a.date || "") ? 1 : -1)), [allTimesheets, sheetFilter, deptFilter]);

  const sheetStats = useMemo(() => {
    const bH  = sheetData.filter(t => t.billingType === "billing").reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    const nH  = sheetData.filter(t => t.billingType !== "billing").reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    const tot = bH + nH;
    return { billingH: bH, nonBillingH: nH, utilPct: tot > 0 ? ((bH / tot) * 100).toFixed(1) : "0.0", total: sheetData.length };
  }, [sheetData]);

  const sheet30ChartData = useMemo(() => {
    const map: Record<string, { date: string; billing: number; nonBilling: number }> = {};
    allTimesheets.filter(t => (t.date || "").slice(0, 10) >= thirtyDayStr).forEach(t => {
      const d = (t.date || "").slice(0, 10); if (!d) return;
      if (!map[d]) map[d] = { date: d.slice(5), billing: 0, nonBilling: 0 };
      if (t.billingType === "billing") map[d].billing += Number(t.hoursWorked || 0);
      else map[d].nonBilling += Number(t.hoursWorked || 0);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [allTimesheets]);

  const filteredEmps = useMemo(() => employees.filter(e => !empSearch || (e.name || "").toLowerCase().includes(empSearch.toLowerCase()) || (e.email || "").toLowerCase().includes(empSearch.toLowerCase())), [employees, empSearch]);

  const empPerf = useMemo(() => {
    const map: Record<string, { name: string; dept: string; billingH: number; nonBH: number }> = {};
    timesheets.forEach(t => {
      const k = t.userId || t.employeeId || t.employeeName;
      if (!k) return;
      if (!map[k]) map[k] = { name: t.employeeName || k, dept: t.department || "—", billingH: 0, nonBH: 0 };
      if (t.billingType === "billing") map[k].billingH += Number(t.hoursWorked || 0);
      else map[k].nonBH += Number(t.hoursWorked || 0);
    });
    return Object.values(map).sort((a, b) => b.billingH - a.billingH).slice(0, 8);
  }, [timesheets]);

  const dailyHours = useMemo(() => {
    const map: Record<string, { date: string; billing: number; nonBilling: number }> = {};
    timesheets.forEach(t => {
      const d = (t.date || "").slice(0, 10); if (!d) return;
      if (!map[d]) map[d] = { date: d.slice(5), billing: 0, nonBilling: 0 };
      if (t.billingType === "billing") map[d].billing += Number(t.hoursWorked || 0);
      else map[d].nonBilling += Number(t.hoursWorked || 0);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [timesheets]);

  const expByType = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.type] = (map[e.type] || 0) + Number(e.amount || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const deptStats = useMemo(() => departments.map(dept => {
    const emps = employees.filter(e => e.department === dept);
    const ts   = allTimesheets.filter(t => t.department === dept);
    const bH   = ts.filter(t => t.billingType === "billing").reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    const tot  = ts.reduce((s, t) => s + Number(t.hoursWorked || 0), 0);
    return { dept, count: emps.length, billingH: bH, totalH: tot, util: tot > 0 ? Math.round((bH / tot) * 100) : 0 };
  }), [departments, employees, allTimesheets]);

  // ── Save handlers ──
  const saveProject = async () => {
    if (!projForm.name.trim()) return showToast("Project name required", "error");
    setSaving(true);
    try {
      const data: Record<string, unknown> = { name: projForm.name, clientName: projForm.clientName, budget: Number(projForm.budget || 0), billingType: projForm.billingType, status: projForm.status };
      if (companyId) data.companyId = companyId;
      if (editProjModal) {
        await updateDoc(doc(db, "projects", editProjModal.id), { ...data, revenueGenerated: Number(projForm.revenueGenerated || 0), updatedAt: serverTimestamp() });
        showToast("Project updated ✓");
      } else {
        await addDoc(collection(db, "projects"), { ...data, revenueGenerated: 0, createdAt: serverTimestamp() });
        showToast("Project added ✓");
      }
      setAddProjModal(false); setEditProjModal(null);
      setProjForm({ name: "", clientName: "", budget: "", billingType: "billing", status: "active", revenueGenerated: "" });
      await fetchAll();
    } catch (e: unknown) { showToast("Save failed: " + (e instanceof Error ? e.message : String(e)), "error"); }
    finally { setSaving(false); }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await deleteDoc(doc(db, "projects", id));
    showToast("Deleted ✓"); await fetchAll();
  };

  const saveExpense = async () => {
    if (!expForm.amount) return showToast("Amount required", "error");
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...expForm, amount: Number(expForm.amount), month: now.getMonth() + 1, year: now.getFullYear(), createdAt: serverTimestamp() };
      if (companyId) data.companyId = companyId;
      await addDoc(collection(db, "expenses"), data);
      showToast("Expense added ✓"); setAddExpModal(false);
      setExpForm({ type: "Salaries", amount: "", description: "" });
      await fetchAll();
    } catch (e: unknown) { showToast("Save failed: " + (e instanceof Error ? e.message : String(e)), "error"); }
    finally { setSaving(false); }
  };

  const saveEmployee = async () => {
    if (!editEmpModal) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", editEmpModal.id), { ...empForm, salary: Number(empForm.salary || 0), updatedAt: serverTimestamp() });
      showToast("Employee updated ✓"); setEditEmpModal(null); await fetchAll();
    } catch (e: unknown) { showToast("Update failed: " + (e instanceof Error ? e.message : String(e)), "error"); }
    finally { setSaving(false); }
  };

  const ttStyle: CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 };

  const navTabs = [
    { id: "overview",    label: "Overview",    icon: "🏠" },
    { id: "employees",   label: "Employees",   icon: "👥" },
    { id: "worksheet",   label: "30-Day Sheet", icon: "📋" },
    { id: "projects",    label: "Projects",    icon: "📁" },
    { id: "finance",     label: "Finance",     icon: "💰" },
    { id: "departments", label: "Departments", icon: "🏢" },
  ];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, background: T.bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${T.primary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: T.textMuted, fontSize: 14 }}>Loading dashboard…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'Nunito',-apple-system,sans-serif", overflow: "hidden", position: "fixed", inset: 0 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{margin:0;padding:0;overflow:hidden;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(100,116,139,0.25);border-radius:10px;}`}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 210, background: T.navBg, display: "flex", flexDirection: "column", height: "100vh", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0 }}>T</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>TechGy</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>INNOVATIONS</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "10px 7px 0", overflowY: "auto" }}>
          {navTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left", fontFamily: "inherit", background: tab === t.id ? "rgba(255,255,255,0.10)" : "transparent", color: tab === t.id ? "#fff" : T.navText, fontWeight: tab === t.id ? 800 : 500, fontSize: 13, borderLeft: `3px solid ${tab === t.id ? T.primary : "transparent"}`, transition: "all 0.15s" }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "8px 7px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={fetchAll} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.45)", padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>🔄 Refresh</button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* TOP BAR */}
        <div style={{ background: T.navBg, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{navTabs.find(t => t.id === tab)?.icon} {navTabs.find(t => t.id === tab)?.label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{now.toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {tab === "projects" && <Btn onClick={() => setAddProjModal(true)}>+ Add Project</Btn>}
            {tab === "finance"  && <Btn onClick={() => setAddExpModal(true)}>+ Add Expense</Btn>}
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "5px 12px 5px 6px", border: "1px solid rgba(255,255,255,0.12)" }}>
              <Avatar name={(user as Record<string, string> | null)?.displayName || (user as Record<string, string> | null)?.name || (user as Record<string, string> | null)?.email || "B"} size={28} />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{(user as Record<string, string> | null)?.displayName || (user as Record<string, string> | null)?.name || "Business Owner"}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.42)" }}>Business Owner</div>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ background: T.redLight, borderBottom: `1px solid ${T.red}`, padding: "9px 22px", fontSize: 12, color: T.red, fontWeight: 600, flexShrink: 0 }}>{error}</div>}

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 24px" }}>

          {/* ══ OVERVIEW ══ */}
          {tab === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
                <StatCard label="Total Employees" value={S.total}            sub={`${S.active} active · ${S.onLeave} on leave`} icon="👥" color={T.primary} lightColor={T.primaryLight} />
                <StatCard label="Active Projects"  value={S.actProj}          sub={`${projects.length} total`}                    icon="📁" color={T.purple} lightColor={T.purpleLight} />
                <StatCard label="Monthly Revenue"  value={fmtINR(S.totalRev)} sub="Project billing"                               icon="💰" color={T.green}  lightColor={T.greenLight} />
                <StatCard label="Net Profit"        value={fmtINR(S.netProfit)} sub={S.netProfit >= 0 ? "Profitable ✓" : "Operating at loss"} icon={S.netProfit >= 0 ? "📈" : "📉"} color={S.netProfit >= 0 ? T.green : T.red} lightColor={S.netProfit >= 0 ? T.greenLight : T.redLight} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                <StatCard label="Billing Employees" value={S.billing}          sub={`${S.nonBilling} non-billing`} icon="✅" color={T.green}  lightColor={T.greenLight} />
                <StatCard label="Utilization"        value={`${S.utilPct}%`}   sub="Billing / Total hrs"           icon="⚡" color={T.yellow} lightColor={T.yellowLight} />
                <StatCard label="Billing Hours"      value={S.billingH}         sub="This month"                    icon="⏱" color={T.cyan}   lightColor={T.cyanLight} />
                <StatCard label="Total Expenses"     value={fmtINR(S.totalExp)} sub="All categories"               icon="💸" color={T.red}    lightColor={T.redLight} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                <SectionCard title="Daily Hours This Month" sub="Billing vs Non-Billing">
                  {dailyHours.length === 0
                    ? <div style={{ textAlign: "center", color: T.textMuted, padding: "30px 0", fontSize: 13 }}>No timesheet data for this month yet.<br /><small>Employees submit timesheets from their dashboard.</small></div>
                    : <ResponsiveContainer width="100%" height={200}><BarChart data={dailyHours}><CartesianGrid strokeDasharray="3 3" stroke={T.border} /><XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={ttStyle} /><Bar dataKey="billing" fill={T.primary} name="Billing" radius={[3, 3, 0, 0]} /><Bar dataKey="nonBilling" fill={T.purple} name="Non-Billing" radius={[3, 3, 0, 0]} /><Legend wrapperStyle={{ fontSize: 11, color: T.textMuted }} /></BarChart></ResponsiveContainer>}
                </SectionCard>
                <SectionCard title="Employee Split" sub="Billing vs Non-Billing">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={[{ name: "Billing", value: S.billing || 0 }, { name: "Non-Billing", value: S.nonBilling || 0 }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                        <Cell fill={T.green} /><Cell fill={T.purple} />
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 6 }}>
                    {[{ val: S.billing, color: T.green, label: "Billing" }, { val: S.nonBilling, color: T.purple, label: "Non-Billing" }].map(d => (
                      <div key={d.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: d.color }}>{d.val}</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
              <SectionCard title="Project Overview" sub={`${projects.length} total`}>
                {projects.length === 0
                  ? <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No projects yet.</div>
                  : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: T.surfaceAlt }}>{["Project","Client","Budget","Received","Status","Type"].map(h => <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead><tbody>{projects.map(p => <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => (e.currentTarget.style.background = T.surfaceAlt)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><td style={{ padding: "10px 13px", fontSize: 13, fontWeight: 800, color: T.text }}>{p.name}</td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted }}>{p.clientName || "Internal"}</td><td style={{ padding: "10px 13px", fontSize: 12 }}>{fmtINR(p.budget)}</td><td style={{ padding: "10px 13px", fontSize: 12, color: T.green, fontWeight: 700 }}>{fmtINR(p.revenueGenerated)}</td><td style={{ padding: "10px 13px" }}><Badge label={p.status || ""} /></td><td style={{ padding: "10px 13px" }}><Badge label={p.billingType || ""} /></td></tr>)}</tbody></table></div>}
              </SectionCard>
            </div>
          )}

          {/* ══ EMPLOYEES ══ */}
          {tab === "employees" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                <StatCard label="Total"   value={S.total}   icon="👥" color={T.primary} lightColor={T.primaryLight} />
                <StatCard label="Active"  value={S.active}  icon="✅" color={T.green}  lightColor={T.greenLight} />
                <StatCard label="On Leave" value={S.onLeave} icon="🌴" color={T.yellow} lightColor={T.yellowLight} />
                <StatCard label="Billing" value={S.billing} icon="💼" color={T.purple} lightColor={T.purpleLight} />
              </div>
              <SectionCard title="All Employees" sub={`${filteredEmps.length} shown`} action={<input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search…" style={{ padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, outline: "none", width: 180 }} />}>
                {employees.length === 0
                  ? <div style={{ textAlign: "center", padding: "30px 0", color: T.textMuted, fontSize: 13 }}>No employees found.</div>
                  : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: T.surfaceAlt }}>{["Employee","Department","Role","Billing","Status","Edit"].map(h => <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead><tbody>{filteredEmps.map(emp => <tr key={emp.id} style={{ borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => (e.currentTarget.style.background = T.surfaceAlt)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><td style={{ padding: "10px 13px" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={emp.name || emp.email || "U"} size={30} /><div><div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{emp.name || "—"}</div><div style={{ fontSize: 11, color: T.textMuted }}>{emp.email}</div></div></div></td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted }}>{emp.department || "—"}</td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted, textTransform: "capitalize" }}>{emp.role || "employee"}</td><td style={{ padding: "10px 13px" }}><Badge label={emp.isBillingEmployee ? "billing" : "non-billing"} /></td><td style={{ padding: "10px 13px" }}><Badge label={emp.status || "active"} /></td><td style={{ padding: "10px 13px" }}><Btn size="sm" variant="ghost" onClick={() => { setEditEmpModal(emp); setEmpForm({ department: emp.department || "", isBillingEmployee: !!emp.isBillingEmployee, status: emp.status || "active", salary: String(emp.salary || "") }); }}>Edit</Btn></td></tr>)}</tbody></table></div>}
              </SectionCard>
              {empPerf.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <SectionCard title="Top Performers" sub="Billing hours this month">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {empPerf.map((emp, i) => {
                        const total = emp.billingH + emp.nonBH;
                        const pct = total > 0 ? (emp.billingH / total) * 100 : 0;
                        return (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{emp.name} <span style={{ color: T.textMuted, fontWeight: 400 }}>· {emp.dept}</span></span><span style={{ fontSize: 11, color: T.textMuted }}>{emp.billingH}h · {pct.toFixed(0)}%</span></div>
                            <div style={{ height: 7, background: T.border, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${T.primary},${T.cyan})`, borderRadius: 4 }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          )}

          {/* ══ 30-DAY SHEET ══ */}
          {tab === "worksheet" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                <StatCard label="Billing Hours"     value={sheetStats.billingH}    icon="⏱" color={T.green}  lightColor={T.greenLight} />
                <StatCard label="Non-Billing Hours" value={sheetStats.nonBillingH} icon="⏸" color={T.yellow} lightColor={T.yellowLight} />
                <StatCard label="Utilization"       value={`${sheetStats.utilPct}%`} icon="⚡" color={T.primary} lightColor={T.primaryLight} />
                <StatCard label="Total Entries"     value={sheetStats.total}       icon="📋" color={T.purple} lightColor={T.purpleLight} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <SectionCard title="Daily Hours (Last 30 Days)" sub="Billing vs Non-Billing">
                  {sheet30ChartData.length === 0
                    ? <div style={{ textAlign: "center", color: T.textMuted, padding: "30px 0", fontSize: 13 }}>No timesheet data in the last 30 days.</div>
                    : <ResponsiveContainer width="100%" height={200}><BarChart data={sheet30ChartData}><CartesianGrid strokeDasharray="3 3" stroke={T.border} /><XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={ttStyle} /><Bar dataKey="billing" fill={T.primary} name="Billing" radius={[3, 3, 0, 0]} /><Bar dataKey="nonBilling" fill={T.purple} name="Non-Billing" radius={[3, 3, 0, 0]} /><Legend wrapperStyle={{ fontSize: 11, color: T.textMuted }} /></BarChart></ResponsiveContainer>}
                </SectionCard>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.textMuted, textTransform: "uppercase" }}>Filter:</span>
                {["all","billing","non-billing"].map(f => <button key={f} onClick={() => setSheetFilter(f)} style={{ padding: "5px 13px", borderRadius: 8, border: `1px solid ${sheetFilter === f ? T.primary : T.border}`, background: sheetFilter === f ? T.primaryLight : T.surface, color: sheetFilter === f ? T.primary : T.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", fontFamily: "inherit" }}>{f}</button>)}
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, background: T.surface, cursor: "pointer", fontFamily: "inherit" }}>
                  <option value="all">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ fontSize: 11, color: T.textMuted }}>{sheetData.length} entries</span>
              </div>
              <SectionCard title="Last 30 Days — Timesheet Log">
                {sheetData.length === 0
                  ? <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted }}><div style={{ fontSize: 26, marginBottom: 8 }}>📋</div><div style={{ fontSize: 14, fontWeight: 600 }}>No entries found</div><div style={{ fontSize: 12, marginTop: 4 }}>Employees log hours from their Employee Dashboard</div></div>
                  : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: T.surfaceAlt }}>{["Date","Employee","Department","Project","Type","Hours"].map(h => <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead><tbody>{sheetData.map(row => <tr key={row.id} style={{ borderBottom: `1px solid ${T.border}` }} onMouseEnter={e => (e.currentTarget.style.background = T.surfaceAlt)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><td style={{ padding: "9px 13px", fontSize: 11, color: T.textMuted }}>{(row.date || "").slice(0, 10)}</td><td style={{ padding: "9px 13px", fontSize: 13, fontWeight: 700, color: T.text }}>{row.employeeName || "—"}</td><td style={{ padding: "9px 13px", fontSize: 12, color: T.textMuted }}>{row.department || "—"}</td><td style={{ padding: "9px 13px", fontSize: 12, color: T.textMuted }}>{row.projectName || "—"}</td><td style={{ padding: "9px 13px" }}><Badge label={row.billingType || "non-billing"} /></td><td style={{ padding: "9px 13px", fontSize: 13, fontWeight: 800, color: row.billingType === "billing" ? T.green : T.textMuted }}>{row.hoursWorked}h</td></tr>)}</tbody></table></div>}
              </SectionCard>
            </div>
          )}

          {/* ══ PROJECTS ══ */}
          {tab === "projects" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                <StatCard label="Total"     value={projects.length}                                          icon="📁" color={T.primary} lightColor={T.primaryLight} />
                <StatCard label="Active"    value={S.actProj}                                                icon="🟢" color={T.green}  lightColor={T.greenLight} />
                <StatCard label="Budget"    value={fmtINR(projects.reduce((s, p) => s + Number(p.budget || 0), 0))} icon="💼" color={T.purple} lightColor={T.purpleLight} />
                <StatCard label="Collected" value={fmtINR(S.totalRev)}                                       icon="✅" color={T.cyan}   lightColor={T.cyanLight} />
              </div>
              {projects.length === 0
                ? <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted, background: T.surface, borderRadius: 14, boxShadow: T.shadow }}><div style={{ fontSize: 36, marginBottom: 10 }}>📁</div><div style={{ fontSize: 15, fontWeight: 700 }}>No projects yet</div><div style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>Add your first project to start tracking revenue</div><Btn onClick={() => setAddProjModal(true)}>+ Add First Project</Btn></div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {projects.map(p => {
                      const budget   = Number(p.budget || 0);
                      const received = Number(p.revenueGenerated || 0);
                      const pct      = budget > 0 ? Math.min((received / budget) * 100, 100) : 0;
                      return (
                        <div key={p.id} style={{ background: T.surface, borderRadius: 14, padding: 18, boxShadow: T.shadow, border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}><span style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{p.name}</span><Badge label={p.status || ""} /><Badge label={p.billingType || ""} /></div>
                              <div style={{ fontSize: 11, color: T.textMuted }}>Client: <b>{p.clientName || "Internal"}</b></div>
                            </div>
                            <div style={{ display: "flex", gap: 7 }}>
                              <Btn size="sm" variant="ghost" onClick={() => { setEditProjModal(p); setProjForm({ name: p.name, clientName: p.clientName || "", budget: String(p.budget || ""), billingType: p.billingType || "billing", status: p.status || "active", revenueGenerated: String(p.revenueGenerated || "") }); }}>Edit</Btn>
                              <Btn size="sm" variant="danger" onClick={() => deleteProject(p.id)}>Delete</Btn>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                            {([["Budget", fmtINR(budget), T.surfaceAlt, T.text], ["Received", fmtINR(received), T.greenLight, T.green], ["Pending", fmtINR(budget - received), T.yellowLight, T.yellow]] as [string, string, string, string][]).map(([lbl, val, bg, col]) => (
                              <div key={lbl} style={{ background: bg, borderRadius: 8, padding: "9px 12px" }}><div style={{ fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 2 }}>{lbl}</div><div style={{ fontSize: 14, fontWeight: 900, color: col }}>{val}</div></div>
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, textTransform: "uppercase" }}>Payment Collection</span><span style={{ fontSize: 10, color: T.textMuted }}>{pct.toFixed(0)}%</span></div>
                          <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? T.green : pct >= 50 ? T.primary : T.yellow, borderRadius: 3 }} /></div>
                        </div>
                      );
                    })}
                  </div>}
            </div>
          )}

          {/* ══ FINANCE ══ */}
          {tab === "finance" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
                <StatCard label="Total Revenue"  value={fmtINR(S.totalRev)}  icon="💰" color={T.green} lightColor={T.greenLight}  sub="From projects" />
                <StatCard label="Total Expenses" value={fmtINR(S.totalExp)}  icon="💸" color={T.red}   lightColor={T.redLight}   sub="All categories" />
                <StatCard label="Net Profit"      value={fmtINR(S.netProfit)} icon={S.netProfit >= 0 ? "📈" : "📉"} color={S.netProfit >= 0 ? T.green : T.red} lightColor={S.netProfit >= 0 ? T.greenLight : T.redLight} sub={`${S.totalRev > 0 ? ((S.netProfit / S.totalRev) * 100).toFixed(1) : 0}% margin`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <SectionCard title="Expense Breakdown" sub="By category">
                  {expByType.length === 0
                    ? <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 13 }}><div style={{ fontSize: 26, marginBottom: 8 }}>💸</div>No expenses recorded yet.<br /><span style={{ fontSize: 11 }}>Click &quot;+ Add Expense&quot; in the top bar.</span></div>
                    : <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={expByType} cx="50%" cy="50%" outerRadius={80} dataKey="value">{expByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={v => fmtFull(v as number)} contentStyle={ttStyle} /><Legend wrapperStyle={{ fontSize: 11, color: T.textMuted }} /></PieChart></ResponsiveContainer>}
                </SectionCard>
                <SectionCard title="Financial Health" sub="Revenue vs Expenses">
                  {S.totalRev === 0 && S.totalExp === 0
                    ? <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 13 }}><div style={{ fontSize: 26, marginBottom: 8 }}>📊</div>No financial data yet.</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 10 }}>
                        {[{ label: "Revenue", val: S.totalRev, pct: 100, color: T.green }, { label: "Expenses", val: S.totalExp, pct: S.totalRev > 0 ? (S.totalExp / S.totalRev) * 100 : 100, color: T.red }, { label: "Net Profit", val: S.netProfit, pct: S.totalRev > 0 ? Math.max(0, (S.netProfit / S.totalRev) * 100) : 0, color: S.netProfit >= 0 ? T.primary : T.red }].map(d => (
                          <div key={d.label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.label}</span><span style={{ fontSize: 13, fontWeight: 800, color: d.color }}>{fmtINR(d.val)}</span></div>
                            <div style={{ height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(d.pct, 100)}%`, background: d.color, borderRadius: 4 }} /></div>
                          </div>
                        ))}
                      </div>}
                </SectionCard>
              </div>
              <SectionCard title="Expense Records" sub={`${expenses.length} entries`}>
                {expenses.length === 0
                  ? <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted }}><div style={{ fontSize: 26, marginBottom: 8 }}>💸</div><div style={{ fontSize: 14, fontWeight: 600 }}>No expenses yet</div><div style={{ fontSize: 12, marginTop: 4, marginBottom: 14 }}>Track your company spending</div><Btn onClick={() => setAddExpModal(true)}>+ Add First Expense</Btn></div>
                  : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: T.surfaceAlt }}>{["Category","Description","Amount","Month","Year"].map(h => <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead><tbody>{expenses.map((e, i) => <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}` }} onMouseEnter={ev => (ev.currentTarget.style.background = T.surfaceAlt)} onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}><td style={{ padding: "10px 13px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length] }} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{e.type}</span></div></td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted }}>{e.description || "—"}</td><td style={{ padding: "10px 13px", fontSize: 13, fontWeight: 800, color: T.red }}>{fmtFull(e.amount)}</td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted }}>{e.month || "—"}</td><td style={{ padding: "10px 13px", fontSize: 12, color: T.textMuted }}>{e.year || "—"}</td></tr>)}</tbody></table></div>}
              </SectionCard>
            </div>
          )}

          {/* ══ DEPARTMENTS ══ */}
          {tab === "departments" && (
            <div>
              {deptStats.length === 0
                ? <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted, background: T.surface, borderRadius: 14, boxShadow: T.shadow }}><div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div><div style={{ fontSize: 15, fontWeight: 700 }}>No department data</div><div style={{ fontSize: 13, marginTop: 4 }}>Ensure employees have a <code>department</code> field in Firestore.</div></div>
                : <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
                      <StatCard label="Departments"      value={deptStats.length}                                                            icon="🏢" color={T.primary} lightColor={T.primaryLight} />
                      <StatCard label="Total Billing Hrs" value={deptStats.reduce((s, d) => s + d.billingH, 0)}                              icon="⏱" color={T.green}  lightColor={T.greenLight}   sub="All departments" />
                      <StatCard label="Avg Utilization"  value={`${deptStats.length > 0 ? Math.round(deptStats.reduce((s, d) => s + d.util, 0) / deptStats.length) : 0}%`} icon="⚡" color={T.yellow} lightColor={T.yellowLight} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <SectionCard title="Hours by Department" sub="All-time billing vs total hours">
                        <ResponsiveContainer width="100%" height={Math.max(220, deptStats.length * 52)}>
                          <BarChart data={deptStats} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                            <XAxis type="number" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="dept" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                            <Tooltip contentStyle={ttStyle} />
                            <Bar dataKey="billingH" fill={T.primary} name="Billing Hours"  radius={[0, 4, 4, 0]} />
                            <Bar dataKey="totalH"   fill={T.purple}  name="Total Hours"    radius={[0, 4, 4, 0]} opacity={0.4} />
                            <Legend wrapperStyle={{ fontSize: 11, color: T.textMuted }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </SectionCard>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                      {deptStats.map((d, i) => (
                        <div key={d.dept} style={{ background: T.surface, borderRadius: 14, padding: 18, boxShadow: T.shadow, border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div><div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>{d.dept}</div><div style={{ fontSize: 11, color: T.textMuted }}>{d.count} employee{d.count !== 1 ? "s" : ""}</div></div>
                            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `conic-gradient(${PIE_COLORS[i % PIE_COLORS.length]} ${d.util * 3.6}deg,${T.border} 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: T.text }}>{d.util}%</div>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div style={{ background: T.primaryLight, borderRadius: 8, padding: "9px 11px" }}><div style={{ fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 2 }}>Billing Hrs</div><div style={{ fontSize: 15, fontWeight: 900, color: T.primary }}>{d.billingH}</div></div>
                            <div style={{ background: T.surfaceAlt,   borderRadius: 8, padding: "9px 11px" }}><div style={{ fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 2 }}>Total Hrs</div><div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>{d.totalH}</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>}
            </div>
          )}

        </div>
      </div>

      {/* ── MODALS ── */}
      <Modal open={addProjModal || !!editProjModal} onClose={() => { setAddProjModal(false); setEditProjModal(null); }} title={editProjModal ? "Edit Project" : "Add New Project"}>
        <Input label="Project Name *"   value={projForm.name}              onChange={v => setProjForm(f => ({ ...f, name: v }))}              placeholder="e.g. EcommerX Platform" />
        <Input label="Client Name"       value={projForm.clientName}        onChange={v => setProjForm(f => ({ ...f, clientName: v }))}        placeholder="e.g. RetailCo Ltd" />
        <Input label="Budget (₹)"        value={projForm.budget}            onChange={v => setProjForm(f => ({ ...f, budget: v }))}            type="number" placeholder="e.g. 1200000" />
        {editProjModal && <Input label="Revenue Received (₹)" value={projForm.revenueGenerated} onChange={v => setProjForm(f => ({ ...f, revenueGenerated: v }))} type="number" placeholder="e.g. 600000" />}
        <Sel label="Billing Type" value={projForm.billingType} onChange={v => setProjForm(f => ({ ...f, billingType: v }))} options={[{ value: "billing", label: "Billing" }, { value: "non-billing", label: "Non-Billing" }]} />
        <Sel label="Status"       value={projForm.status}      onChange={v => setProjForm(f => ({ ...f, status: v }))}      options={[{ value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "on_hold", label: "On Hold" }]} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => { setAddProjModal(false); setEditProjModal(null); }}>Cancel</Btn>
          <Btn onClick={saveProject} disabled={saving}>{saving ? "Saving…" : editProjModal ? "Update" : "Add Project"}</Btn>
        </div>
      </Modal>

      <Modal open={addExpModal} onClose={() => setAddExpModal(false)} title="Add Expense">
        <Sel label="Category" value={expForm.type} onChange={v => setExpForm(f => ({ ...f, type: v }))} options={["Salaries","Infrastructure","Tools & Licenses","Marketing","Miscellaneous","Other"].map(v => ({ value: v, label: v }))} />
        <Input label="Amount (₹) *"  value={expForm.amount}      onChange={v => setExpForm(f => ({ ...f, amount: v }))}      type="number" placeholder="e.g. 50000" />
        <Input label="Description"   value={expForm.description} onChange={v => setExpForm(f => ({ ...f, description: v }))} placeholder="Optional details" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => setAddExpModal(false)}>Cancel</Btn>
          <Btn onClick={saveExpense} disabled={saving}>{saving ? "Saving…" : "Add Expense"}</Btn>
        </div>
      </Modal>

      <Modal open={!!editEmpModal} onClose={() => setEditEmpModal(null)} title={`Edit: ${editEmpModal?.name || ""}`}>
        <Sel label="Department"    value={empForm.department}                   onChange={v => setEmpForm(f => ({ ...f, department: v }))}          options={[...new Set([...departments,"Engineering","Design","HR","Finance","Marketing","Sales"])].map(v => ({ value: v, label: v }))} />
        <Sel label="Billing Status" value={empForm.isBillingEmployee ? "true" : "false"} onChange={v => setEmpForm(f => ({ ...f, isBillingEmployee: v === "true" }))} options={[{ value: "true", label: "Billing Employee" }, { value: "false", label: "Non-Billing Employee" }]} />
        <Sel label="Status"         value={empForm.status}                       onChange={v => setEmpForm(f => ({ ...f, status: v }))}              options={[{ value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" }, { value: "resigned", label: "Resigned" }]} />
        <Input label="Salary (₹/month)" value={empForm.salary} onChange={v => setEmpForm(f => ({ ...f, salary: v }))} type="number" placeholder="e.g. 85000" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => setEditEmpModal(null)}>Cancel</Btn>
          <Btn onClick={saveEmployee} disabled={saving}>{saving ? "Saving…" : "Update Employee"}</Btn>
        </div>
      </Modal>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}