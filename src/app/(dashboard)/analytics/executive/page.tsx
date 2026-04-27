"use client";

import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, getDocs,
} from "firebase/firestore";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ComposedChart,
} from "recharts";

// ══════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════
interface SaleRecord {
  id: string;
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  target?: number;
  [key: string]: unknown;
}

interface Project {
  id: string;
  name: string;
  team?: string;
  lead?: string;
  progress?: number;
  budget?: number;
  spent?: number;
  status?: string;
  priority?: string;
  deadline?: string;
  salary?: number;
  attendance?: number;
  tasks?: number;
  [key: string]: unknown;
}

interface Employee {
  id: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  productivity?: number;
  status?: string;
  [key: string]: unknown;
}

interface Task {
  id: string;
  title: string;
  assignedTo?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  project?: string;
  [key: string]: unknown;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  source?: string;
  value?: number;
  since?: string;
  status?: string;
  [key: string]: unknown;
}

interface Lead {
  id: string;
  name: string;
  email?: string;
  status?: string;
  value?: number;
  source?: string;
  [key: string]: unknown;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  date?: string;
  description?: string;
  [key: string]: unknown;
}

interface Alert {
  id: string;
  type: "warning" | "danger" | "info" | "success";
  title: string;
  msg: string;
  [key: string]: unknown;
}

interface Payroll {
  id: string;
  amount?: number;
  [key: string]: unknown;
}

interface Asset {
  id: string;
  value?: number;
  [key: string]: unknown;
}

interface UserRecord {
  id: string;
  name?: string;
  email?: string;
  accountType?: string;
  designation?: string;
  department?: string;
  role?: string;
  productivity?: number;
  status?: string;
  [key: string]: unknown;
}

type ModalType = 
  | { type: "project"; data?: Project }
  | { type: "employee"; data?: Employee }
  | { type: "task"; data?: Partial<Task> }
  | { type: "expense" }
  | { type: "lead" }
  | { type: "customer" }
  | { type: "sale"; data?: SaleRecord }
  | null;

interface ConfirmState {
  message: string;
  onConfirm: () => Promise<void>;
}

// ══════════════════════════════════════════════════════════
//  FIREBASE INIT
// ══════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyC99siXcTLipvR_x-HL_1N6eOLQMNj-4ZE",
  authDomain: "office-tracker-33067.firebaseapp.com",
  projectId: "office-tracker-33067",
  storageBucket: "office-tracker-33067.firebasestorage.app",
  messagingSenderId: "179006164956",
  appId: "1:179006164956:web:db06a9a5050a2833774919",
  measurementId: "G-MZY97JTR3F",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ══════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════
const T = {
  bg: "#f7f8fc",
  bgCard: "#ffffff",
  bgSidebar: "#ffffff",
  bgHover: "#f1f4f9",
  border: "#e8ecf4",
  primary: "#2563eb",
  primaryLt: "#eff6ff",
  primaryDk: "#1d4ed8",
  success: "#16a34a",
  successLt: "#f0fdf4",
  warning: "#d97706",
  warningLt: "#fffbeb",
  danger: "#dc2626",
  dangerLt: "#fef2f2",
  purple: "#7c3aed",
  purpleLt: "#f5f3ff",
  cyan: "#0891b2",
  cyanLt: "#ecfeff",
  text: "#0f172a",
  textSub: "#475569",
  textMuted: "#94a3b8",
  shadow: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.07)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.09)",
} as const;

const CHART_COLORS = [T.primary, T.success, T.warning, T.purple, T.cyan, T.danger];

// ── FORMATTERS ──────────────────────────────────────────
const fmtMoney = (v: number): string =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K`
  : `$${(v || 0).toFixed(0)}`;

const fmtShort = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
  : String(v || 0);

// ── GLOBAL CSS ────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;1,9..144,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; font-family: 'Plus Jakarta Sans', sans-serif; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes slideIn { from{opacity:0;transform:translateY(-6px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .hover-card { transition: all 0.2s ease; }
  .hover-card:hover { box-shadow: ${T.shadowMd} !important; transform: translateY(-1px); border-color: ${T.primary}33 !important; }
  .hover-row:hover { background: ${T.bgHover} !important; }
  .btn-t { transition: all 0.15s ease; }
  .btn-t:hover { filter: brightness(0.94); transform: translateY(-1px); }
  input, select, textarea {
    background: ${T.bg} !important; border: 1.5px solid ${T.border} !important;
    color: ${T.text} !important; border-radius: 8px !important;
    padding: 9px 12px !important; font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 13px !important; outline: none !important; width: 100%;
    transition: border-color 0.2s;
  }
  input:focus, select:focus, textarea:focus { border-color: ${T.primary} !important; background: #fff !important; }
  label { font-size: 11px; color: ${T.textSub}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 5px; }
  .nav-btn { transition: all 0.15s ease; }
  .nav-btn:hover { background: ${T.bgHover} !important; }
  .progress-bar { transition: width 0.8s cubic-bezier(.4,0,.2,1); }
  .spin { animation: spin 0.8s linear infinite; display: inline-block; }
`;

// ══════════════════════════════════════════════════════════
//  FIREBASE HOOKS
// ══════════════════════════════════════════════════════════
function useCollection<T extends { id: string }>(colName: string): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, colName),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [colName]);

  return { data, loading, error };
}

// ── CRUD helpers ─────────────────────────────────────────
const addItem = (col: string, data: Record<string, unknown>) =>
  addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });

const updateItem = (col: string, id: string, data: Record<string, unknown>) =>
  updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });

const deleteItem = (col: string, id: string) =>
  deleteDoc(doc(db, col, id));

// ══════════════════════════════════════════════════════════
//  UI PRIMITIVES
// ══════════════════════════════════════════════════════════
function Skeleton({ h = 40, w = "100%", r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: `linear-gradient(90deg,#f1f4f9 25%,#e8ecf4 50%,#f1f4f9 75%)`,
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function Card({ children, style = {}, className = "", onClick }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`hover-card ${className}`} onClick={onClick} style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 14, boxShadow: T.shadow,
      transition: "all 0.2s ease", ...style,
    }}>{children}</div>
  );
}

function Badge({ children, color = T.primary }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 10, fontWeight: 700, padding: "3px 8px",
      borderRadius: 99, background: color + "18", color,
      border: `1px solid ${color}28`,
      letterSpacing: "0.04em", textTransform: "uppercase",
      fontFamily: "'JetBrains Mono', monospace",
    }}>{children}</span>
  );
}

type BtnVariant = "primary" | "success" | "danger" | "warning" | "outline" | "ghost";

function Btn({
  children, onClick, variant = "ghost", size = "sm", disabled = false, style = {}, icon
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
}) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: T.primary, color: "#fff", border: "none", boxShadow: `0 2px 8px ${T.primary}35` },
    success: { background: T.successLt, color: T.success, border: `1px solid ${T.success}28` },
    danger: { background: T.dangerLt, color: T.danger, border: `1px solid ${T.danger}28` },
    warning: { background: T.warningLt, color: T.warning, border: `1px solid ${T.warning}28` },
    outline: { background: "transparent", color: T.textSub, border: `1px solid ${T.border}` },
    ghost: { background: T.bgHover, color: T.textSub, border: `1px solid ${T.border}` },
  };
  return (
    <button className="btn-t" onClick={onClick} disabled={disabled} style={{
      ...variants[variant], cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: 8, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
      opacity: disabled ? 0.45 : 1, display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: size === "sm" ? 11 : 13, padding: size === "sm" ? "6px 12px" : "9px 18px",
      whiteSpace: "nowrap", ...style,
    }}>
      {icon && <span style={{ fontSize: size === "sm" ? 12 : 14 }}>{icon}</span>}
      {children}
    </button>
  );
}

interface TooltipPayloadItem {
  name: string;
  value: number | string;
  color?: string;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10,
      padding: "10px 14px", fontSize: 12, boxShadow: T.shadowMd,
    }}>
      <p style={{ color: T.textMuted, marginBottom: 6, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || T.text, fontWeight: 700, margin: "2px 0", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
          {p.name}: <span style={{ color: T.text }}>{typeof p.value === "number" && p.value > 999 ? fmtShort(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, action, badge }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.2px" }}>{title}</h3>
          {badge && <Badge color={T.primary}>{badge}</Badge>}
        </div>
        {subtitle && <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

function Progress({ value, color = T.primary, h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div style={{ height: h, background: T.bgHover, borderRadius: 99, overflow: "hidden" }}>
      <div className="progress-bar" style={{ width: `${Math.min(100, value || 0)}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 14px", background: color + "10", borderRadius: 10, border: `1px solid ${color}20` }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Fraunces', serif" }}>{value}</span>
      <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );
}

const STATUS_MAP: Record<string, { color: string }> = {
  "On Track": { color: T.success },
  "Completed": { color: T.success },
  "Active": { color: T.success },
  "completed": { color: T.success },
  "converted": { color: T.success },
  "At Risk": { color: T.warning },
  "On Leave": { color: T.warning },
  "pending": { color: T.warning },
  "contacted": { color: T.cyan },
  "qualified": { color: T.purple },
  "proposal": { color: T.primary },
  "Delayed": { color: T.danger },
  "new": { color: T.textMuted },
  "In Progress": { color: T.primary },
};

const statusProps = (s: string): { color: string; label: string } => {
  const found = STATUS_MAP[s];
  return found
    ? { ...found, label: s.charAt(0).toUpperCase() + s.slice(1) }
    : { color: T.textMuted, label: s || "Unknown" };
};

const PRIORITY_MAP: Record<string, string> = {
  Critical: T.danger,
  High: T.warning,
  Medium: T.primary,
  Low: T.textMuted,
};

const priorityColor = (p: string): string => PRIORITY_MAP[p] || T.textMuted;

// ══════════════════════════════════════════════════════════
//  MODAL SYSTEM
// ══════════════════════════════════════════════════════════
function Modal({ title, children, onClose, width = 520, subtitle }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
  subtitle?: string;
}) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 18, padding: 28, width, maxWidth: "95vw",
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.13)",
        animation: "slideIn 0.2s ease", border: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{
            background: T.bgHover, border: `1px solid ${T.border}`, color: T.textSub,
            width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label>{lbl}</label>{children}</div>;
}

function FormActions({ onClose, onSave, saving, saveLabel = "Save" }: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
      <Btn onClick={onClose} size="md">Cancel</Btn>
      <Btn onClick={onSave} variant="primary" size="md" disabled={saving}>{saving ? "Saving…" : saveLabel}</Btn>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <Modal title="Confirm Delete" onClose={onCancel} width={400}>
      <div style={{ padding: "4px 0 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: T.dangerLt, border: `1px solid ${T.danger}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚠️</div>
        <p style={{ color: T.textSub, fontSize: 14, lineHeight: 1.7 }}>{message}</p>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn onClick={onCancel} size="md">Cancel</Btn>
        <Btn onClick={async () => { setDeleting(true); await onConfirm(); }} variant="danger" size="md" disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Btn>
      </div>
    </Modal>
  );
}

// ── Domain modals ─────────────────────────────────────────
function ProjectModal({ project, employees, onClose }: {
  project?: Project;
  employees: Employee[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: project?.name ?? "",
    team: (project?.team as string) ?? "",
    lead: (project?.lead as string) ?? "",
    progress: project?.progress ?? 0,
    budget: project?.budget ?? "",
    status: (project?.status as string) ?? "On Track",
    priority: (project?.priority as string) ?? "Medium",
    deadline: (project?.deadline as string) ?? "",
    salary: project?.salary ?? "",
    attendance: project?.attendance ?? "",
    tasks: project?.tasks ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      ...f,
      budget: Number(f.budget) || 0,
      progress: Number(f.progress) || 0,
      salary: Number(f.salary) || 0,
      attendance: Number(f.attendance) || 0,
      tasks: Number(f.tasks) || 0,
    };
    if (project?.id) await updateItem("projects", project.id, payload);
    else await addItem("projects", { ...payload, spent: 0 });
    onClose();
  };

  return (
    <Modal title={project ? "Edit Project" : "New Project"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Project Name"><input value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. CRM Overhaul" /></Field>
        <Field label="Team"><input value={String(f.team)} onChange={e => set("team", e.target.value)} placeholder="e.g. Engineering" /></Field>
        <Field label="Project Lead">
          <select value={String(f.lead)} onChange={e => set("lead", e.target.value)}>
            <option value="">Select lead</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name} ({emp.department})</option>
            ))}
          </select>
        </Field>
        <Field label="Budget ($)"><input type="number" value={String(f.budget)} onChange={e => set("budget", e.target.value)} /></Field>
        <Field label="Progress (%)"><input type="number" min={0} max={100} value={String(f.progress)} onChange={e => set("progress", Number(e.target.value))} /></Field>
        <Field label="Deadline"><input type="date" value={String(f.deadline)} onChange={e => set("deadline", e.target.value)} /></Field>
        <Field label="Status">
          <select value={String(f.status)} onChange={e => set("status", e.target.value)}>
            {["On Track", "At Risk", "Delayed", "Completed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={String(f.priority)} onChange={e => set("priority", e.target.value)}>
            {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Salary"><input type="number" value={String(f.salary)} onChange={e => set("salary", e.target.value)} /></Field>
        <Field label="Attendance (%)"><input type="number" value={String(f.attendance)} onChange={e => set("attendance", e.target.value)} /></Field>
        <Field label="Tasks"><input type="number" value={String(f.tasks)} onChange={e => set("tasks", e.target.value)} /></Field>
      </div>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel={project ? "Update" : "Create Project"} />
    </Modal>
  );
}

function EmployeeModal({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const [f, setF] = useState({
    name: employee?.name ?? "",
    email: (employee?.email as string) ?? "",
    department: (employee?.department as string) ?? "",
    role: (employee?.role as string) ?? "",
    status: (employee?.status as string) ?? "Active",
    productivity: employee?.productivity ?? 85,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...f, productivity: Number(f.productivity) || 0 };
    if (employee?.id) await updateItem("employees", employee.id, payload);
    else await addItem("employees", { ...payload, tasks: 0 });
    onClose();
  };

  return (
    <Modal title={employee ? "Edit Employee" : "Add Employee"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Full Name"><input value={f.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={e => set("email", e.target.value)} /></Field>
        <Field label="Department"><input value={f.department} onChange={e => set("department", e.target.value)} /></Field>
        <Field label="Role"><input value={f.role} onChange={e => set("role", e.target.value)} /></Field>
        <Field label="Status">
          <select value={f.status} onChange={e => set("status", e.target.value)}>
            {["Active", "On Leave", "Inactive"].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Productivity (%)">
          <input type="number" min={0} max={100} value={f.productivity} onChange={e => set("productivity", Number(e.target.value))} />
        </Field>
      </div>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel={employee ? "Update" : "Add Employee"} />
    </Modal>
  );
}

function TaskModal({ task, employees, onClose }: {
  task?: Partial<Task>;
  employees: Employee[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    title: task?.title ?? "",
    assignedTo: (task?.assignedTo as string) ?? "",
    priority: (task?.priority as string) ?? "Medium",
    status: (task?.status as string) ?? "pending",
    dueDate: (task?.dueDate as string) ?? "",
    project: (task?.project as string) ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...f };
    if (task?.id) await updateItem("tasks", task.id, payload);
    else await addItem("tasks", payload);
    onClose();
  };

  return (
    <Modal title={task?.id ? "Edit Task" : "Create Task"} onClose={onClose}>
      <Field label="Task Title"><input value={f.title} onChange={e => set("title", e.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Assign To">
          <select value={f.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
            <option value="">Select employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.name}>{emp.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={f.priority} onChange={e => set("priority", e.target.value)}>
            {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Due Date"><input type="date" value={f.dueDate} onChange={e => set("dueDate", e.target.value)} /></Field>
        <Field label="Project"><input value={f.project} onChange={e => set("project", e.target.value)} /></Field>
      </div>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel={task?.id ? "Update" : "Create Task"} />
    </Modal>
  );
}

function SaleModal({ sale, onClose }: { sale?: SaleRecord; onClose: () => void }) {
  const [f, setF] = useState({
    month: sale?.month ?? "",
    revenue: sale?.revenue ?? "",
    expenses: sale?.expenses ?? "",
    profit: sale?.profit ?? "",
    target: sale?.target ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!String(f.month).trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      month: f.month,
      revenue: Number(f.revenue) || 0,
      expenses: Number(f.expenses) || 0,
      profit: Number(f.profit) || 0,
      target: Number(f.target) || 0,
    };
    if (sale?.id) await updateItem("sales", sale.id, payload);
    else await addItem("sales", payload);
    onClose();
  };

  return (
    <Modal title={sale ? "Edit Sales Record" : "Add Sales Record"} onClose={onClose}>
      <Field label="Month (e.g. Jan, Feb)"><input value={String(f.month)} onChange={e => set("month", e.target.value)} placeholder="Jan" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Revenue ($)"><input type="number" value={String(f.revenue)} onChange={e => set("revenue", e.target.value)} /></Field>
        <Field label="Expenses ($)"><input type="number" value={String(f.expenses)} onChange={e => set("expenses", e.target.value)} /></Field>
        <Field label="Profit ($)"><input type="number" value={String(f.profit)} onChange={e => set("profit", e.target.value)} /></Field>
        <Field label="Target ($)"><input type="number" value={String(f.target)} onChange={e => set("target", e.target.value)} /></Field>
      </div>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel={sale ? "Update" : "Add Record"} />
    </Modal>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ category: "", amount: "", date: "", description: "" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.category || !f.amount) return;
    setSaving(true);
    await addItem("expenses", { ...f, amount: Number(f.amount) });
    onClose();
  };

  return (
    <Modal title="Log Expense" onClose={onClose}>
      <Field label="Category">
        <select value={f.category} onChange={e => set("category", e.target.value)}>
          <option value="">Select</option>
          {["Payroll", "Marketing", "Infrastructure", "Operations", "R&D", "Travel", "Legal", "Other"].map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Amount ($)"><input type="number" value={f.amount} onChange={e => set("amount", e.target.value)} /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={e => set("date", e.target.value)} /></Field>
      </div>
      <Field label="Description">
        <textarea value={f.description} onChange={e => set("description", e.target.value)} style={{ height: 80, resize: "none" }} />
      </Field>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel="Log Expense" />
    </Modal>
  );
}

function LeadModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", email: "", status: "new", value: "", source: "" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    await addItem("leads", { ...f, value: Number(f.value) || 0 });
    onClose();
  };

  return (
    <Modal title="Add Lead" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Company / Contact"><input value={f.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={e => set("email", e.target.value)} /></Field>
        <Field label="Est. Value ($)"><input type="number" value={f.value} onChange={e => set("value", e.target.value)} /></Field>
        <Field label="Source">
          <select value={f.source} onChange={e => set("source", e.target.value)}>
            <option value="">Select</option>
            {["Website", "Referral", "LinkedIn", "Cold Outreach", "Event", "Partner"].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Stage">
        <select value={f.status} onChange={e => set("status", e.target.value)}>
          {["new", "contacted", "qualified", "proposal", "converted"].map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel="Add Lead" />
    </Modal>
  );
}

function CustomerModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", email: "", source: "", value: "", since: "", status: "Active" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    await addItem("customers", { ...f, value: Number(f.value) || 0 });
    onClose();
  };

  return (
    <Modal title="Add Customer" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Company Name"><input value={f.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={e => set("email", e.target.value)} /></Field>
        <Field label="Source"><input value={f.source} onChange={e => set("source", e.target.value)} /></Field>
        <Field label="Contract Value ($)"><input type="number" value={f.value} onChange={e => set("value", e.target.value)} /></Field>
        <Field label="Since (YYYY-MM)"><input value={f.since} onChange={e => set("since", e.target.value)} placeholder="2024-01" /></Field>
        <Field label="Status">
          <select value={f.status} onChange={e => set("status", e.target.value)}>
            {["Active", "At Risk", "Churned"].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <FormActions onClose={onClose} onSave={save} saving={saving} saveLabel="Add Customer" />
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  KPI CARD
// ══════════════════════════════════════════════════════════
function KPICard({ label, value, subValue, change, up, icon, color, loading, target, targetLabel }: {
  label: string;
  value: string;
  subValue?: string;
  change?: string;
  up?: boolean;
  icon: string;
  color: string;
  loading?: boolean;
  target?: number;
  targetLabel?: string;
}) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icon}</div>
        {loading ? <Skeleton h={20} w={52} /> :
          change !== undefined && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
              background: up ? T.successLt : T.dangerLt, color: up ? T.success : T.danger,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{up ? "↑" : "↓"} {change}</span>
          )
        }
      </div>
      {loading ? <Skeleton h={30} w="65%" /> :
        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: "-0.5px", fontFamily: "'Fraunces', serif" }}>{value}</div>
      }
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, fontWeight: 600 }}>{label}</div>
      {subValue && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{subValue}</div>}
      {target !== undefined && !loading && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>{targetLabel || "vs Target"}</span>
            <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{target}%</span>
          </div>
          <Progress value={target} color={color} h={4} />
        </div>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  ALERTS PANEL
// ══════════════════════════════════════════════════════════
const ALERT_TYPE_COLOR: Record<string, string> = {
  warning: T.warning,
  danger: T.danger,
  info: T.primary,
  success: T.success,
};

const ALERT_TYPE_ICON: Record<string, string> = {
  warning: "⚠️",
  danger: "🔴",
  info: "ℹ️",
  success: "✅",
};

function AlertsPanel({ alerts, onClose }: { alerts: Alert[]; onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", top: 52, right: 0, width: 340,
      background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14,
      boxShadow: T.shadowLg, zIndex: 200, animation: "slideIn 0.2s ease", overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>
          Alerts{" "}
          <span style={{ background: T.dangerLt, color: T.danger, padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, marginLeft: 6 }}>{alerts.length}</span>
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      {alerts.length === 0 && <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No active alerts 🎉</div>}
      {alerts.map((a, i) => (
        <div key={i} style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, background: (ALERT_TYPE_COLOR[a.type] || T.primary) + "08" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{ALERT_TYPE_ICON[a.type] || "ℹ️"}</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: ALERT_TYPE_COLOR[a.type] || T.primary, marginBottom: 2 }}>{a.title}</p>
              <p style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5 }}>{a.msg}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  EMPTY STATE
// ══════════════════════════════════════════════════════════
function EmptyState({
  icon = "📭",
  title = "No data yet",
  sub = "Add your first record to get started.",
}: {
  icon?: string;
  title?: string;
  sub?: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: "56px 0", color: T.textMuted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: T.textSub }}>{title}</p>
      <p style={{ fontSize: 12, marginTop: 4 }}>{sub}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  NAV ITEMS
// ══════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { id: "overview", icon: "📊", label: "Overview" },
  { id: "finance", icon: "💰", label: "Finance" },
  { id: "analytics", icon: "📈", label: "Analytics" },
  { id: "projects", icon: "🚀", label: "Projects" },
  { id: "employees", icon: "👥", label: "Employees" },
  { id: "tasks", icon: "✅", label: "Tasks" },
  { id: "customers", icon: "🤝", label: "Customers" },
  { id: "leads", icon: "🎯", label: "Leads" },
  { id: "expenses", icon: "📋", label: "Expenses" },
] as const;

// ══════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ══════════════════════════════════════════════════════════
export default function ExecutiveDashboard() {
  const [tab, setTab] = useState("overview");
  const [role, setRole] = useState("Admin");
  const [filter, setFilter] = useState("Monthly");
  const [sideOpen, setSideOpen] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState<string | null>(null);
  const [employeesFull, setEmployeesFull] = useState<Employee[]>([]);

  // Live Firestore collections
  const { data: sales, loading: salesLoading } = useCollection<SaleRecord>("sales");
  const { data: projects, loading: projLoading } = useCollection<Project>("projects");
  const { data: users, loading: empLoading } = useCollection<UserRecord>("users");

  const employees: Employee[] = users
    .filter(u => u.name)
    .map(u => ({
      id: u.id,
      name: u.name ?? "",
      email: u.email as string | undefined,
      department: (u.accountType as string) ?? "General",
      role: (u.designation as string) ?? "Employee",
      productivity: u.productivity ?? 0,
      status: (u.status as string) ?? "Active",
    }));

  const loadEmployeesFull = async () => {
    const usersSnap = await getDocs(collection(db, "users"));
    const rowsData: Employee[] = usersSnap.docs.map(u => {
      const userData = u.data();
      return {
        id: u.id,
        name: (userData["name"] as string) ?? "",
        department: (userData["department"] as string) ?? "General",
        role: (userData["role"] as string) ?? "Employee",
      };
    });
    setEmployeesFull(rowsData);
  };

  const { data: tasks, loading: tasksLoading } = useCollection<Task>("tasks");
  const { data: customers, loading: custLoading } = useCollection<Customer>("customers");
  const { data: leads, loading: leadsLoading } = useCollection<Lead>("leads");
  const { data: expenses, loading: expLoading } = useCollection<Expense>("expenses");
  const { data: alerts } = useCollection<Alert>("alerts");
  const { data: payroll } = useCollection<Payroll>("payroll");
  const { data: assets } = useCollection<Asset>("assets");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadEmployeesFull(); }, []);

  const canEdit = role === "Admin" || role === "Manager";
  const canDelete = role === "Admin";
  const canAdd = role === "Admin" || role === "Manager";

  // ── Derived metrics ──────────────────────────────────────
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalProfit = sales.reduce((s, r) => s + (r.profit || 0), 0);
  const totalExpenses = sales.reduce((s, r) => s + (r.expenses || 0), 0);
  const totalExpenseLogs = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const profitMargin = totalRevenue ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
  const payrollCost = payroll.reduce((s, p) => s + (p.amount || 0), 0);
  const assetValue = assets.reduce((s, a) => s + (a.value || 0), 0);

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const taskPct = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const activeProjects = projects.filter(p => p.status !== "Completed").length;
  const atRiskProjects = projects.filter(p => ["At Risk", "Delayed"].includes(p.status ?? "")).length;

  const convertedLeads = leads.filter(l => l.status === "converted").length;
  const conversionRate = leads.length ? ((convertedLeads / leads.length) * 100).toFixed(1) : 0;

  const avgProductivity = employees.length
    ? Math.round(employees.reduce((s, e) => s + (e.productivity || 0), 0) / employees.length)
    : 0;

  // Expense category aggregation
  const expCats = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {});
  const expenseCategories = Object.entries(expCats).map(([name, value]) => ({ name, value }));

  // Dept headcount
  const deptMap = employees.reduce<Record<string, number>>((acc, e) => {
    const dept = e.department || "Unknown";
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});
  const deptData = Object.entries(deptMap).map(([name, headcount]) => ({
    name,
    headcount,
    value: employees.length ? Math.round((headcount / employees.length) * 100) : 0,
  }));

  // Sales funnel
  const stageOrder = ["new", "contacted", "qualified", "proposal", "converted"];
  const stageColors = [T.primary, T.cyan, T.purple, T.warning, T.success];
  const salesFunnel = stageOrder.map((s, i) => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: leads.filter(l => l.status === s).length,
    color: stageColors[i],
  }));

  // ── Delete helper ────────────────────────────────────────
  const confirmDelete = (col: string, id: string, name: string) => {
    setConfirm({
      message: `Permanently delete "${name}"? This cannot be undone.`,
      onConfirm: async () => { await deleteItem(col, id); setConfirm(null); },
    });
  };

  // ── Advance lead ─────────────────────────────────────────
  const advanceLead = async (l: Lead) => {
    const stages = ["new", "contacted", "qualified", "proposal", "converted"];
    const idx = stages.indexOf(l.status ?? "new");
    const next = stages[idx + 1];
    if (next) await updateItem("leads", l.id, { status: next });
  };

  // ── Complete helpers ─────────────────────────────────────
  const completeTask = (t: Task) => updateItem("tasks", t.id, { status: "completed" });
  const completeProject = (p: Project) => updateItem("projects", p.id, { status: "Completed", progress: 100 });

  // ── Export CSV ───────────────────────────────────────────
  const exportCSV = (rows: Record<string, unknown>[], fname: string) => {
    if (!rows?.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = fname;
    a.click();
  };

  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{CSS}</style>

      {/* ══ SIDEBAR ════════════════════════════════════════ */}
      <aside style={{
        width: sideOpen ? 228 : 66, transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
        background: T.bgSidebar, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", flexShrink: 0, overflow: "hidden",
      }}>
        <div style={{ padding: sideOpen ? "18px 18px 14px" : "18px 14px 14px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: `linear-gradient(135deg,${T.primary},${T.primaryDk})`,
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, color: "#fff", flexShrink: 0, boxShadow: `0 4px 12px ${T.primary}45`,
            }}>⬡</div>
            {sideOpen && (
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color: T.text }}>APEX ERP</div>
              </div>
            )}
          </div>
        </div>

        {sideOpen && (
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
            <label>Signed in as</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              {["Admin", "Manager", "Employee"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        )}

        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV_ITEMS.map(item => {
            const active = tab === item.id;
            return (
              <button key={item.id} className="nav-btn" onClick={() => setTab(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: 10, padding: sideOpen ? "9px 12px" : "9px 16px",
                borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 2,
                background: active ? T.primaryLt : "transparent",
                color: active ? T.primary : T.textSub,
                textAlign: "left", fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: active ? 700 : 500, fontSize: 13,
                borderLeft: active ? `3px solid ${T.primary}` : "3px solid transparent",
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                {sideOpen && item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 10, borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => setSideOpen(o => !o)} style={{
            width: "100%", padding: 8, borderRadius: 10,
            background: T.bgHover, border: `1px solid ${T.border}`,
            color: T.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>{sideOpen ? "‹ Collapse" : "›"}</button>
        </div>
      </aside>

      {/* ══ MAIN ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* HEADER */}
        <header style={{
          background: "rgba(247,248,252,0.94)", borderBottom: `1px solid ${T.border}`,
          backdropFilter: "blur(10px)", padding: "12px 24px",
          position: "sticky", top: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: T.text, fontFamily: "'Fraunces', serif" }}>Executive Dashboard</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.success, display: "inline-block", animation: "pulse 2s infinite" }} />
              {now && <span style={{ fontSize: 10, color: T.textMuted }}>· {now}</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 190 }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: T.textMuted }}>🔍</span>
            </div>

            <div style={{ display: "flex", background: "#fff", borderRadius: 10, padding: 3, gap: 2, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
              {["Daily", "Weekly", "Monthly", "Quarterly"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: filter === f ? T.primary : "transparent",
                  color: filter === f ? "#fff" : T.textMuted,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>{f}</button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <button onClick={() => setShowAlerts(v => !v)} style={{
                background: "#fff", border: `1px solid ${T.border}`, color: T.textSub,
                borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 16,
                position: "relative", boxShadow: T.shadow,
              }}>
                🔔
                {alerts.length > 0 && <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: T.danger, border: `1.5px solid ${T.bg}` }} />}
              </button>
              {showAlerts && <AlertsPanel alerts={alerts} onClose={() => setShowAlerts(false)} />}
            </div>

            <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${T.primary},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>
              {role[0]}
            </div>
          </div>
        </header>

        {/* BODY */}
        <main style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* ════ OVERVIEW ════════════════════════════════ */}
          {tab === "overview" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(192px, 1fr))", gap: 12, marginBottom: 20 }}>
                {([
                  { label: "Total Revenue", value: fmtMoney(totalRevenue), change: "--", up: true, icon: "💰", color: T.primary, loading: salesLoading },
                  { label: "Net Profit", value: fmtMoney(totalProfit), subValue: `${profitMargin}% margin`, change: "--", up: true, icon: "📈", color: T.success, loading: salesLoading },
                  { label: "Total Expenses", value: fmtMoney(totalExpenses + totalExpenseLogs), change: "--", up: false, icon: "📉", color: T.danger, loading: salesLoading },
                  { label: "Active Projects", value: String(activeProjects), change: "--", up: true, icon: "🚀", color: T.purple, loading: projLoading },
                  { label: "Employees", value: String(employees.length), change: "--", up: true, icon: "👥", color: T.cyan, loading: empLoading },
                  { label: "Customers", value: String(customers.length), change: "--", up: true, icon: "🤝", color: T.primary, loading: custLoading },
                  { label: "Leads", value: String(leads.length), change: "--", up: true, icon: "🎯", color: T.warning, loading: leadsLoading },
                  { label: "Conversion Rate", value: `${conversionRate}%`, change: "--", up: true, icon: "🔄", color: T.success, loading: leadsLoading },
                  { label: "Avg Productivity", value: `${avgProductivity}%`, change: "--", up: true, icon: "⚡", color: avgProductivity >= 80 ? T.success : T.warning, loading: empLoading },
                  { label: "Task Completion", value: `${taskPct}%`, subValue: `${completedTasks}/${tasks.length} tasks`, change: "--", up: true, icon: "✅", color: T.purple, loading: tasksLoading },
                  { label: "Payroll Cost", value: fmtMoney(payrollCost), change: "--", up: false, icon: "💸", color: T.danger, loading: false },
                  { label: "Asset Value", value: fmtMoney(assetValue), change: "--", up: true, icon: "🏦", color: T.cyan, loading: false },
                ] as const).map((k, i) => <KPICard key={i} {...k} />)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14, marginBottom: 14 }}>
                <Card style={{ padding: 20 }}>
                  <SectionHeader
                    title="Revenue vs Expenses"
                    subtitle="Monthly trend"
                    badge="Live"
                    action={canAdd && <Btn onClick={() => setModal({ type: "sale" })} variant="primary" size="sm" icon="＋">Add Record</Btn>}
                  />
                  {salesLoading ? <Skeleton h={220} /> : sales.length === 0 ? <EmptyState icon="📊" title="No sales data" sub="Add monthly records to see charts." /> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={[...sales].sort((a, b) => (a.month || "").localeCompare(b.month || ""))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtShort} tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <defs>
                          <linearGradient id="revGrd" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={T.primary} stopOpacity={0.14} />
                            <stop offset="95%" stopColor={T.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="revenue" fill="url(#revGrd)" stroke={T.primary} strokeWidth={2.5} name="Revenue" dot={false} />
                        {sales[0]?.target !== undefined && (
                          <Line type="monotone" dataKey="target" stroke={T.danger} strokeWidth={1.5} strokeDasharray="5 4" name="Target" dot={false} />
                        )}
                        <Bar dataKey="profit" fill={T.success} radius={[3, 3, 0, 0]} name="Profit" maxBarSize={10} opacity={0.8} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Dept. Headcount" subtitle={`${employees.length} employees`} />
                  {empLoading ? <Skeleton h={220} /> : deptData.length === 0 ? <EmptyState icon="👥" title="No employees" sub="Add employees to see department split." /> : (
                    <>
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie data={deptData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                            {deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [`${v ?? 0}%`, "Share"]}
                            contentStyle={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                        {deptData.map((dp, i) => (
                          <div key={dp.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span style={{ color: T.textSub }}>{dp.name}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{dp.headcount}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Sales Funnel" subtitle="Lead conversion pipeline" />
                  {leadsLoading ? <Skeleton h={200} /> : leads.length === 0 ? <EmptyState icon="🎯" title="No leads" sub="Add leads to track your pipeline." /> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {salesFunnel.map((stage, i) => {
                        const maxVal = salesFunnel[0]?.value || 1;
                        const pct = maxVal ? Math.round((stage.value / maxVal) * 100) : 0;
                        const prev = i > 0 ? salesFunnel[i - 1] : null;
                        const drop = prev?.value ? Math.round(((prev.value - stage.value) / prev.value) * 100) : null;
                        return (
                          <div key={stage.name}>
                            {drop !== null && drop > 0 && (
                              <div style={{ fontSize: 10, color: T.danger, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>↓ {drop}% drop</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 11, color: T.textSub, width: 76, flexShrink: 0, fontWeight: 600 }}>{stage.name}</span>
                              <div style={{ flex: 1, height: 24, background: T.bgHover, borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ width: `${Math.max(pct, 5)}%`, height: "100%", background: stage.color, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width 0.8s ease" }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{stage.value}</span>
                                </div>
                              </div>
                              <span style={{ fontSize: 10, color: T.textMuted, width: 34, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 6, padding: "8px 12px", background: T.successLt, borderRadius: 8, border: `1px solid ${T.success}28` }}>
                        <span style={{ fontSize: 12, color: T.success, fontWeight: 700 }}>Conversion Rate: {conversionRate}%</span>
                      </div>
                    </div>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Operations Snapshot" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {([
                      { label: "Task Completion", value: `${taskPct}%`, sub: `${completedTasks}/${tasks.length} done`, color: T.success },
                      { label: "Active Projects", value: activeProjects, sub: `${atRiskProjects} at risk`, color: T.purple },
                      { label: "Total Customers", value: customers.length, sub: `${leads.length} in pipeline`, color: T.cyan },
                      { label: "Avg Productivity", value: `${avgProductivity}%`, sub: `${employees.length} employees`, color: T.primary },
                    ] as const).map(s => (
                      <div key={s.label} style={{ padding: 14, background: s.color + "08", borderRadius: 10, border: `1px solid ${s.color}1a` }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.value}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, marginTop: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ════ FINANCE ══════════════════════════════════ */}
          {tab === "finance" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                {([
                  { label: "Revenue", value: fmtMoney(totalRevenue), icon: "💰", color: T.primary, loading: salesLoading },
                  { label: "Profit", value: fmtMoney(totalProfit), subValue: `${profitMargin}% margin`, icon: "📈", color: T.success, loading: salesLoading },
                  { label: "Expenses (Sales)", value: fmtMoney(totalExpenses), icon: "📉", color: T.danger, loading: salesLoading },
                  { label: "Logged Expenses", value: fmtMoney(totalExpenseLogs), icon: "🧾", color: T.warning, loading: expLoading },
                  { label: "Payroll", value: fmtMoney(payrollCost), icon: "💸", color: T.purple, loading: false },
                  { label: "Asset Value", value: fmtMoney(assetValue), icon: "🏦", color: T.cyan, loading: false },
                ] as const).map((k, i) => <KPICard key={i} {...k} />)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <Card style={{ padding: 20 }}>
                  <SectionHeader
                    title="Expense Breakdown"
                    subtitle="From expense log"
                    action={canAdd && <Btn onClick={() => setModal({ type: "expense" })} variant="primary" size="sm" icon="＋">Log Expense</Btn>}
                  />
                  {expLoading ? <Skeleton h={260} /> : expenseCategories.length === 0 ? <EmptyState icon="🧾" title="No expenses logged" /> : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={expenseCategories} cx="50%" cy="50%" outerRadius={68} paddingAngle={2} dataKey="value">
                            {expenseCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [`${v ?? 0}`, "Amount"]}
                            contentStyle={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                        {expenseCategories.map((e, i) => (
                          <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span style={{ color: T.textSub }}>{e.name}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(e.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Monthly Profit Margin %" subtitle="From sales records" />
                  {salesLoading ? <Skeleton h={260} /> : sales.length === 0 ? <EmptyState icon="📊" title="No sales data" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={[...sales].sort((a, b) => (a.month || "").localeCompare(b.month || "")).map(r => ({
                        month: r.month,
                        margin: r.revenue ? +((r.profit / r.revenue) * 100).toFixed(1) : 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis unit="%" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="margin" fill={T.success} radius={[5, 5, 0, 0]} name="Margin %" maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Expense Log"
                  subtitle={`${expenses.length} entries`}
                  action={<Btn onClick={() => exportCSV(expenses as unknown as Record<string, unknown>[], "expenses.csv")} variant="outline" size="sm" icon="⬇">Export</Btn>}
                />
                {expLoading ? <Skeleton h={120} /> : expenses.length === 0 ? <EmptyState icon="🧾" title="No expenses yet" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Category", "Amount", "Date", "Description", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenses
                          .filter(e => !search || e.category?.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase()))
                          .map((e, idx) => (
                            <tr key={e.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "12px" }}><Badge color={T.warning}>{e.category}</Badge></td>
                              <td style={{ padding: "12px", fontWeight: 700, color: T.danger, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(e.amount)}</td>
                              <td style={{ padding: "12px", color: T.textMuted, fontSize: 11 }}>{e.date || "—"}</td>
                              <td style={{ padding: "12px", color: T.textSub, fontSize: 12 }}>{e.description || "—"}</td>
                              <td style={{ padding: "12px" }}>
                                {canDelete && <Btn onClick={() => confirmDelete("expenses", e.id, e.category)} variant="danger" size="sm">Del</Btn>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ════ ANALYTICS ════════════════════════════════ */}
          {tab === "analytics" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Revenue vs Expenses (Full)" subtitle="All months" />
                  {salesLoading ? <Skeleton h={240} /> : sales.length === 0 ? <EmptyState icon="📊" title="No sales data" /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={[...sales].sort((a, b) => (a.month || "").localeCompare(b.month || ""))}>
                        <defs>
                          <linearGradient id="rA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={T.primary} stopOpacity={0.13} />
                            <stop offset="95%" stopColor={T.primary} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="eA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={T.danger} stopOpacity={0.11} />
                            <stop offset="95%" stopColor={T.danger} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtShort} tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="revenue" stroke={T.primary} strokeWidth={2} fill="url(#rA)" name="Revenue" dot={false} />
                        <Area type="monotone" dataKey="expenses" stroke={T.danger} strokeWidth={2} fill="url(#eA)" name="Expenses" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Lead Pipeline" subtitle="By stage" />
                  {leadsLoading ? <Skeleton h={240} /> : leads.length === 0 ? <EmptyState icon="🎯" title="No leads" /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={salesFunnel} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                        <XAxis type="number" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Leads" maxBarSize={22}>
                          {salesFunnel.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader
                    title="Sales Records"
                    subtitle="Edit / manage monthly records"
                    action={canAdd && <Btn onClick={() => setModal({ type: "sale" })} variant="primary" size="sm" icon="＋">Add</Btn>}
                  />
                  {salesLoading ? <Skeleton h={200} /> : sales.length === 0 ? <EmptyState icon="📊" title="No records" /> : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {["Month", "Revenue", "Expenses", "Profit", "Target", "Actions"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...sales].sort((a, b) => (a.month || "").localeCompare(b.month || "")).map((s, i) => (
                            <tr key={s.id || i} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "10px" }}><Badge color={T.primary}>{s.month}</Badge></td>
                              <td style={{ padding: "10px", fontWeight: 700, color: T.primary, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(s.revenue)}</td>
                              <td style={{ padding: "10px", color: T.danger, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(s.expenses)}</td>
                              <td style={{ padding: "10px", color: T.success, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(s.profit)}</td>
                              <td style={{ padding: "10px", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{s.target ? fmtMoney(s.target) : "—"}</td>
                              <td style={{ padding: "10px" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {canEdit && <Btn onClick={() => setModal({ type: "sale", data: s })} size="sm">Edit</Btn>}
                                  {canDelete && <Btn onClick={() => confirmDelete("sales", s.id, s.month)} variant="danger" size="sm">Del</Btn>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader title="Project Status Distribution" subtitle="Health overview" />
                  {projLoading ? <Skeleton h={200} /> : projects.length === 0 ? <EmptyState icon="🚀" title="No projects" /> : (() => {
                    const statusCounts = projects.reduce<Record<string, number>>((acc, p) => {
                      const key = p.status ?? "Unknown";
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {});
                    const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%" cy="50%" outerRadius={70} paddingAngle={3}
                            dataKey="value"
                            label={(props) => `${props.name ?? ""}: ${props.value ?? 0}`}
                            labelLine={false}
                          >
                            {pieData.map((d, i) => <Cell key={i} fill={statusProps(d.name).color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </Card>
              </div>
            </div>
          )}

          {/* ════ PROJECTS ══════════════════════════════════ */}
          {tab === "projects" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {([
                  { label: "Total", value: projects.length, color: T.primary },
                  { label: "On Track", value: projects.filter(p => p.status === "On Track").length, color: T.success },
                  { label: "At Risk/Delayed", value: atRiskProjects, color: T.danger },
                  { label: "Completed", value: projects.filter(p => p.status === "Completed").length, color: T.textMuted },
                ] as const).map(s => <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Projects"
                  subtitle={`${activeProjects} active`}
                  action={
                    <div style={{ display: "flex", gap: 8 }}>
                      {canAdd && <Btn onClick={() => setModal({ type: "project" })} variant="primary" size="sm" icon="＋">New Project</Btn>}
                      <Btn onClick={() => exportCSV(projects as unknown as Record<string, unknown>[], "projects.csv")} variant="outline" size="sm" icon="⬇">CSV</Btn>
                    </div>
                  }
                />
                {projLoading ? <Skeleton h={200} /> : projects.length === 0 ? <EmptyState icon="🚀" title="No projects yet" sub="Create your first project." /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Project", "Lead", "Team", "Progress", "Budget", "Status", "Priority", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projects
                          .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || String(p.lead || "").toLowerCase().includes(search.toLowerCase()))
                          .map((p, idx) => {
                            const sp = statusProps(p.status ?? "");
                            const budgetPct = p.budget ? Math.round(((p.spent || 0) / p.budget) * 100) : 0;
                            return (
                              <tr key={p.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ fontWeight: 700, color: T.text }}>{p.name}</div>
                                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>Due: {String(p.deadline || "—")}</div>
                                </td>
                                <td style={{ padding: "13px 12px", color: T.textSub, fontSize: 12 }}>{String(p.lead || "—")}</td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 12 }}>{String(p.team || "—")}</td>
                                <td style={{ padding: "13px 12px", minWidth: 120 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1 }}><Progress value={p.progress || 0} color={sp.color} h={5} /></div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: sp.color, fontFamily: "'JetBrains Mono', monospace" }}>{p.progress || 0}%</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Budget: {budgetPct}% used</div>
                                </td>
                                <td style={{ padding: "13px 12px", color: T.textSub, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{p.budget ? fmtMoney(p.budget) : "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={sp.color}>{sp.label}</Badge></td>
                                <td style={{ padding: "13px 12px" }}><Badge color={priorityColor(String(p.priority || ""))}>{String(p.priority || "—")}</Badge></td>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {canEdit && <Btn onClick={() => setModal({ type: "project", data: p })} size="sm">Edit</Btn>}
                                    {canEdit && p.status !== "Completed" && <Btn onClick={() => completeProject(p)} variant="success" size="sm">✓</Btn>}
                                    {canDelete && <Btn onClick={() => confirmDelete("projects", p.id, p.name)} variant="danger" size="sm">Del</Btn>}
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
            </div>
          )}

          {/* ════ EMPLOYEES ═════════════════════════════════ */}
          {tab === "employees" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {([
                  { label: "Total", value: employees.length, color: T.primary },
                  { label: "Active", value: employees.filter(e => e.status === "Active").length, color: T.success },
                  { label: "On Leave", value: employees.filter(e => e.status === "On Leave").length, color: T.warning },
                  { label: "Avg Productivity", value: `${avgProductivity}%`, color: T.purple },
                ] as const).map(s => <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Employees"
                  subtitle={`${employees.length} total`}
                  action={
                    <div style={{ display: "flex", gap: 8 }}>
                      {canAdd && <Btn onClick={() => setModal({ type: "employee" })} variant="primary" size="sm" icon="＋">Add Employee</Btn>}
                      <Btn onClick={() => exportCSV(employees as unknown as Record<string, unknown>[], "employees.csv")} variant="outline" size="sm" icon="⬇">CSV</Btn>
                    </div>
                  }
                />
                {empLoading ? <Skeleton h={200} /> : employees.length === 0 ? <EmptyState icon="👥" title="No employees yet" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Employee", "Department", "Role", "Productivity", "Status", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employees
                          .filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.department?.toLowerCase().includes(search.toLowerCase()))
                          .map((e, idx) => {
                            const sp = statusProps(e.status ?? "Active");
                            const pc = (e.productivity ?? 0) >= 90 ? T.success : (e.productivity ?? 0) >= 70 ? T.warning : T.danger;
                            return (
                              <tr key={e.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.primary + "20", border: `2px solid ${T.primary}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: T.primary }}>
                                      {(e.name || "?")[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: T.text }}>{e.name}</div>
                                      <div style={{ fontSize: 10, color: T.textMuted }}>{e.email || "—"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "13px 12px", color: T.textSub }}>{e.department || "—"}</td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 12 }}>{e.role || "—"}</td>
                                <td style={{ padding: "13px 12px", minWidth: 100 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1 }}><Progress value={e.productivity || 0} color={pc} h={5} /></div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: pc, fontFamily: "'JetBrains Mono', monospace" }}>{e.productivity || 0}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: "13px 12px" }}><Badge color={sp.color}>{sp.label}</Badge></td>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {canEdit && <Btn onClick={() => setModal({ type: "employee", data: e })} size="sm">Edit</Btn>}
                                    {canAdd && <Btn onClick={() => setModal({ type: "task", data: { assignedTo: e.name } })} variant="success" size="sm" icon="＋">Task</Btn>}
                                    {canDelete && <Btn onClick={() => confirmDelete("employees", e.id, e.name)} variant="danger" size="sm">Del</Btn>}
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
            </div>
          )}

          {/* ════ TASKS ═════════════════════════════════════ */}
          {tab === "tasks" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {([
                  { label: "Total Tasks", value: tasks.length, color: T.primary },
                  { label: "Completed", value: completedTasks, color: T.success },
                  { label: "Pending", value: pendingTasks, color: T.warning },
                  { label: "Completion %", value: `${taskPct}%`, color: T.purple },
                ] as const).map(s => <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Tasks"
                  subtitle="All assignments"
                  action={canAdd && <Btn onClick={() => setModal({ type: "task" })} variant="primary" size="sm" icon="＋">Create Task</Btn>}
                />
                {tasksLoading ? <Skeleton h={200} /> : tasks.length === 0 ? <EmptyState icon="✅" title="No tasks yet" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Task", "Assigned To", "Project", "Priority", "Due Date", "Status", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tasks
                          .filter(t => !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.assignedTo?.toLowerCase().includes(search.toLowerCase()))
                          .map((t, idx) => {
                            const sp = statusProps(t.status ?? "pending");
                            const pc = priorityColor(t.priority ?? "");
                            const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed";
                            return (
                              <tr key={t.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ fontWeight: 600, color: T.text, textDecoration: t.status === "completed" ? "line-through" : "none", opacity: t.status === "completed" ? 0.5 : 1 }}>{t.title}</div>
                                  {overdue && <Badge color={T.danger}>Overdue</Badge>}
                                </td>
                                <td style={{ padding: "13px 12px", color: T.textSub }}>{t.assignedTo || "—"}</td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 11 }}>{t.project || "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={pc}>{t.priority || "—"}</Badge></td>
                                <td style={{ padding: "13px 12px", color: overdue ? T.danger : T.textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: overdue ? 700 : 400 }}>{t.dueDate || "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={sp.color}>{sp.label}</Badge></td>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {canEdit && t.status !== "completed" && <Btn onClick={() => completeTask(t)} variant="success" size="sm">✓ Done</Btn>}
                                    {canEdit && <Btn onClick={() => setModal({ type: "task", data: t })} size="sm">Edit</Btn>}
                                    {canDelete && <Btn onClick={() => confirmDelete("tasks", t.id, t.title)} variant="danger" size="sm">Del</Btn>}
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
            </div>
          )}

          {/* ════ CUSTOMERS ══════════════════════════════════ */}
          {tab === "customers" && (
            <div className="fade-up">
              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Customers"
                  subtitle={`${customers.length} total`}
                  action={
                    <div style={{ display: "flex", gap: 8 }}>
                      {canAdd && <Btn onClick={() => setModal({ type: "customer" })} variant="primary" size="sm" icon="＋">Add Customer</Btn>}
                      <Btn onClick={() => exportCSV(customers as unknown as Record<string, unknown>[], "customers.csv")} variant="outline" size="sm" icon="⬇">Export</Btn>
                    </div>
                  }
                />
                {custLoading ? <Skeleton h={200} /> : customers.length === 0 ? <EmptyState icon="🤝" title="No customers yet" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Customer", "Source", "Email", "Contract Value", "Since", "Status", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {customers
                          .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()))
                          .map((c, idx) => {
                            const sp = statusProps(c.status ?? "Active");
                            return (
                              <tr key={c.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "13px 12px", fontWeight: 700, color: T.text }}>{c.name}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={T.cyan}>{c.source || "—"}</Badge></td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{c.email || "—"}</td>
                                <td style={{ padding: "13px 12px", fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(c.value || 0)}</td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 11 }}>{c.since || "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={sp.color}>{sp.label}</Badge></td>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {canAdd && (
                                      <Btn
                                        onClick={async () => {
                                          await addItem("leads", {
                                            name: c.name,
                                            email: c.email ?? "",
                                            status: "contacted",
                                            value: c.value || 0,
                                            source: c.source ?? "",
                                          });
                                        }}
                                        variant="success"
                                        size="sm"
                                      >→ Lead</Btn>
                                    )}
                                    {canDelete && <Btn onClick={() => confirmDelete("customers", c.id, c.name)} variant="danger" size="sm">Del</Btn>}
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
            </div>
          )}

          {/* ════ LEADS ══════════════════════════════════════ */}
          {tab === "leads" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
                {["new", "contacted", "qualified", "proposal", "converted"].map(s => {
                  const sp = statusProps(s);
                  return <StatPill key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={leads.filter(l => l.status === s).length} color={sp.color} />;
                })}
              </div>

              <Card style={{ padding: 20 }}>
                <SectionHeader
                  title="Sales Pipeline"
                  subtitle={`${leads.length} leads · ${conversionRate}% conversion`}
                  action={canAdd && <Btn onClick={() => setModal({ type: "lead" })} variant="primary" size="sm" icon="＋">Add Lead</Btn>}
                />
                {leadsLoading ? <Skeleton h={200} /> : leads.length === 0 ? <EmptyState icon="🎯" title="No leads yet" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["Lead", "Email", "Source", "Est. Value", "Stage", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads
                          .filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()))
                          .map((l, idx) => {
                            const sp = statusProps(l.status ?? "new");
                            return (
                              <tr key={l.id || idx} className="hover-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "13px 12px", fontWeight: 700, color: T.text }}>{l.name}</td>
                                <td style={{ padding: "13px 12px", color: T.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{l.email || "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={T.cyan}>{l.source || "—"}</Badge></td>
                                <td style={{ padding: "13px 12px", fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{l.value ? fmtMoney(l.value) : "—"}</td>
                                <td style={{ padding: "13px 12px" }}><Badge color={sp.color}>{sp.label}</Badge></td>
                                <td style={{ padding: "13px 12px" }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {canEdit && l.status !== "converted" && <Btn onClick={() => advanceLead(l)} variant="primary" size="sm">Advance →</Btn>}
                                    {canDelete && <Btn onClick={() => confirmDelete("leads", l.id, l.name)} variant="danger" size="sm">Del</Btn>}
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
            </div>
          )}

          {/* ════ EXPENSES TAB ══════════════════════════════ */}
          {tab === "expenses" && (
            <div className="fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                {([
                  { label: "Total Logged", value: fmtMoney(totalExpenseLogs), color: T.danger },
                  { label: "Entries", value: expenses.length, color: T.primary },
                  { label: "Categories", value: Object.keys(expCats).length, color: T.purple },
                ] as const).map(s => <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <Card style={{ padding: 20 }}>
                  <SectionHeader
                    title="By Category"
                    subtitle="Expense distribution"
                    action={canAdd && <Btn onClick={() => setModal({ type: "expense" })} variant="primary" size="sm" icon="＋">Log</Btn>}
                  />
                  {expLoading ? <Skeleton h={260} /> : expenseCategories.length === 0 ? <EmptyState icon="🧾" title="No expenses" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={expenseCategories}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtShort} tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="value" radius={[5, 5, 0, 0]} name="Amount" maxBarSize={28}>
                          {expenseCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card style={{ padding: 20 }}>
                  <SectionHeader
                    title="All Expenses"
                    subtitle="Full log"
                    action={<Btn onClick={() => exportCSV(expenses as unknown as Record<string, unknown>[], "expenses.csv")} variant="outline" size="sm" icon="⬇">Export</Btn>}
                  />
                  {expLoading ? <Skeleton h={260} /> : expenses.length === 0 ? <EmptyState icon="🧾" title="No expenses" /> : (
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {expenses.map((e, i) => (
                        <div key={e.id || i} className="hover-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 6px", borderBottom: `1px solid ${T.border}` }}>
                          <div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <Badge color={CHART_COLORS[i % CHART_COLORS.length]}>{e.category}</Badge>
                              <span style={{ fontSize: 11, color: T.textMuted }}>{e.date || "—"}</span>
                            </div>
                            {e.description && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{e.description}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontWeight: 700, color: T.danger, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(e.amount)}</span>
                            {canDelete && <Btn onClick={() => confirmDelete("expenses", e.id, e.category)} variant="danger" size="sm">Del</Btn>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══ MODALS ════════════════════════════════════════════ */}
      {modal?.type === "project" && (
        <ProjectModal
          project={modal.data}
          employees={employeesFull}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "employee" && <EmployeeModal employee={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === "task" && <TaskModal task={modal.data} employees={employees} onClose={() => setModal(null)} />}
      {modal?.type === "expense" && <ExpenseModal onClose={() => setModal(null)} />}
      {modal?.type === "lead" && <LeadModal onClose={() => setModal(null)} />}
      {modal?.type === "customer" && <CustomerModal onClose={() => setModal(null)} />}
      {modal?.type === "sale" && <SaleModal sale={modal.data} onClose={() => setModal(null)} />}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}