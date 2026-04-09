"use client";
import { useState, useEffect, useCallback } from "react";
import { logActivity } from "@/lib/notifications";
import NotificationBell from "@/components/NotificationBell";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, PieChart, Pie, Cell, Legend,
} from "recharts";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore, Firestore,
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, where, orderBy, Timestamp, serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

// ─────────────────────────────────────────────────────────────
// 1. FIREBASE CONFIG
// ─────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0];
  return initializeApp(FIREBASE_CONFIG);
}

function getDB(): Firestore {
  return getFirestore(getFirebaseApp());
}

// ─────────────────────────────────────────────────────────────
// 2. TYPES
// ─────────────────────────────────────────────────────────────
interface Employee {
  id?: string;
  uid?: string;
  name: string;
  email?: string;
  phone?: string;
  profilePhoto?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  employeeId?: string;
  designation?: string;
  role?: string;
  department: string;
  dateOfJoining?: string;
  employmentType?: string;
  workLocation?: string;
  reportingManager?: string;
  accountType?: string;
  workExperience?: string;
  salary?: number;
  baseSalary?: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  aadharNumber?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  createdAt?: Timestamp;
}

interface PayrollEntry {
  id?: string;
  employeeId: string;
  employeeName: string;
  month: string;
  baseSalary: number;
  bonus: number;
  deduction: number;
  finalSalary: number;
  createdAt?: Timestamp;
}

interface Expense {
  id?: string;
  category: string;
  amount: number;
  note: string;
  month: string;
  date: string;
  createdAt?: Timestamp;
}

interface Asset {
  id?: string;
  name: string;
  purchaseCost: number;
  maintenanceCost: number;
  totalCost: number;
  month: string;
  createdAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// 3. FIRESTORE SERVICES
// ─────────────────────────────────────────────────────────────
export function subscribeEmployees(cb: (items: Employee[], total: number) => void) {
  const db = getDB();
  return onSnapshot(collection(db, "users"), snap => {
    const items = snap.docs.map(d => {
      const data = d.data() as Employee;
      const resolvedSalary = (typeof data.salary === "number" ? data.salary : 0)
                           || (typeof data.baseSalary === "number" ? data.baseSalary : 0);
      return { id: d.id, uid: d.id, ...data, salary: resolvedSalary, baseSalary: resolvedSalary };
    }).filter(e => e.name);
    const total = items.reduce((s, e) => s + (e.salary || 0), 0);
    cb(items, total);
  });
}

export async function addEmployee(data: Omit<Employee, "id" | "uid" | "createdAt">) {
  const db = getDB();
  return addDoc(collection(db, "employees"), { ...data, createdAt: serverTimestamp() });
}
export async function deleteEmployee(id: string) {
  return deleteDoc(doc(getDB(), "employees", id));
}

export async function addPayroll(
  data: Omit<PayrollEntry, "id" | "finalSalary" | "createdAt">
) {
  const db = getDB();
  const finalSalary = data.baseSalary + data.bonus - data.deduction;

  const ref = await addDoc(collection(db, "payroll"), {
    ...data,
    finalSalary,
    createdAt: serverTimestamp(),
  });

  await logActivity({
    type: "PAYROLL_PROCESSED",
    title: "Payroll entry added",
    message: `${data.employeeName}'s salary of ₹${finalSalary.toLocaleString("en-IN")} processed for ${data.month}`,
    icon: "💰",
    createdBy: "Finance",
    visibleTo: ["hr", "admin"],
    priority: "medium",
  });

  return ref;
}
export async function deletePayroll(id: string) {
  return deleteDoc(doc(getDB(), "payroll", id));
}
export function subscribePayroll(
  month: string,
  cb: (items: PayrollEntry[], totals: { totalFinal: number; totalBonus: number; totalDeduction: number }) => void,
) {
  const db = getDB();
  const q = query(collection(db, "payroll"), where("month", "==", month));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollEntry));
    const totalFinal     = items.reduce((s, p) => s + p.finalSalary, 0);
    const totalBonus     = items.reduce((s, p) => s + p.bonus, 0);
    const totalDeduction = items.reduce((s, p) => s + p.deduction, 0);
    cb(items, { totalFinal, totalBonus, totalDeduction });
  });
}

export async function addExpense(data: Omit<Expense, "id" | "month" | "createdAt">) {
  const db = getDB();
  const month = data.date.slice(0, 7);

  const ref = await addDoc(collection(db, "expenses"), {
    ...data,
    month,
    createdAt: serverTimestamp(),
  });

  await logActivity({
    type: "EXPENSE_ADDED",
    title: "New expense logged",
    message: `${data.category} expense of ₹${data.amount.toLocaleString("en-IN")} added for ${month}`,
    icon: "🧾",
    createdBy: "Finance",
    relatedId: ref.id,
    visibleTo: ["hr", "sales", "admin"],
    priority: data.amount >= 50000 ? "high" : "low",
  });

  return ref;
}
export async function deleteExpense(id: string) {
  return deleteDoc(doc(getDB(), "expenses", id));
}
export function subscribeExpenses(
  month: string,
  cb: (items: Expense[], totalManual: number, byCategory: Record<string, number>) => void,
) {
  const db = getDB();
  const q = query(collection(db, "expenses"), where("month", "==", month));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
    const totalManual = items.reduce((s, e) => s + e.amount, 0);
    const byCategory: Record<string, number> = {};
    items.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    cb(items, totalManual, byCategory);
  });
}

export async function addAsset(data: Omit<Asset, "id" | "totalCost" | "createdAt">) {
  const db = getDB();
  const totalCost = data.purchaseCost + data.maintenanceCost;
  return addDoc(collection(db, "assets"), { ...data, totalCost, createdAt: serverTimestamp() });
}
export async function deleteAsset(id: string) {
  return deleteDoc(doc(getDB(), "assets", id));
}
export function subscribeAssets(
  month: string,
  cb: (items: Asset[], totalAssetCost: number) => void,
) {
  const db = getDB();
  const q = query(collection(db, "assets"), where("month", "==", month));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
    const totalAssetCost = items.reduce((s, a) => s + a.totalCost, 0);
    cb(items, totalAssetCost);
  });
}

// ─────────────────────────────────────────────────────────────
// 4. MAIN HOOK
// ─────────────────────────────────────────────────────────────
function useFinance(month: string) {
  const [employees,     setEmployees]     = useState<Employee[]>([]);
  const [totalSalary,   setTotalSalary]   = useState(0);
  const [payroll,       setPayroll]       = useState<PayrollEntry[]>([]);
  const [payrollTotals, setPayrollTotals] = useState({ totalFinal: 0, totalBonus: 0, totalDeduction: 0 });
  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [totalManual,   setTotalManual]   = useState(0);
  const [byCategory,    setByCategory]    = useState<Record<string, number>>({});
  const [assets,        setAssets]        = useState<Asset[]>([]);
  const [totalAssets,   setTotalAssets]   = useState(0);

  useEffect(() => {
    const u1 = subscribeEmployees((items, total) => { setEmployees(items); setTotalSalary(total); });
    const u2 = subscribePayroll(month, (items, totals) => { setPayroll(items); setPayrollTotals(totals); });
    const u3 = subscribeExpenses(month, (items, total, bycat) => { setExpenses(items); setTotalManual(total); setByCategory(bycat); });
    const u4 = subscribeAssets(month, (items, total) => { setAssets(items); setTotalAssets(total); });
    return () => { u1(); u2(); u3(); u4(); };
  }, [month]);

  const finalSalaryUsed = payrollTotals.totalFinal > 0 ? payrollTotals.totalFinal : totalSalary;
  const grandTotal = finalSalaryUsed + totalManual + totalAssets;
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  return {
    employees, totalSalary,
    payroll, payrollTotals,
    expenses, totalManual, byCategory, categoryData,
    assets, totalAssets,
    grandTotal,
    finalSalaryUsed,
  };
}

// ─────────────────────────────────────────────────────────────
// 5. DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg:        "#f0f2f8",
  surface:   "#ffffff",
  surfaceHi: "#f4f6fb",
  border:    "#e2e8f0",
  borderHi:  "#c9d3e0",
  ink:       "#0f172a",
  inkMid:    "#475569",
  inkDim:    "#94a3b8",
  green:     "#059669",
  greenBg:   "#ecfdf5",
  blue:      "#2563eb",
  blueBg:    "#eff6ff",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  amber:     "#d97706",
  amberBg:   "#fffbeb",
  violet:    "#7c3aed",
  violetBg:  "#f5f3ff",
  teal:      "#0891b2",
  tealBg:    "#ecfeff",
  pink:      "#db2777",
  pinkBg:    "#fdf2f8",
};

const PALETTE = [T.blue, T.green, T.violet, T.amber, T.red, T.teal, T.pink, "#ffa657"];
const EXPENSE_QUICK = ["Rent", "WiFi", "Electricity", "Water", "Furniture", "Transport", "Other"];

function fmt(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}
function fmtShort(v: number) {
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// ─────────────────────────────────────────────────────────────
// 6. MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, accent = T.blue }: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
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

function TabBtn({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
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

function Input({ label, value, onChange, type = "text", placeholder = "" }: {
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

function Select({ label, value, onChange, options }: {
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

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 22px", background: T.blue, color: "#fff", border: "none",
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

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
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

function DeptBadge({ dept }: { dept: string }) {
  const colors: Record<string, [string, string]> = {
    Engineering: [T.blue, T.blueBg],
    Sales: [T.green, T.greenBg],
    HR: [T.pink, T.pinkBg],
    Operations: [T.amber, T.amberBg],
    Finance: [T.violet, T.violetBg],
    Marketing: [T.teal, T.tealBg],
    IT: [T.ink, T.surfaceHi],
  };
  const [color, bg] = colors[dept] ?? [T.inkMid, T.surfaceHi];
  return (
    <span style={{ padding: "3px 9px", borderRadius: 99, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{dept}</span>
  );
}

function SalaryTag({ v, color = T.green }: { v: number; color?: string }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color }}>{fmt(v)}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. OVERVIEW TAB
// ─────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: ReturnType<typeof useFinance> }) {
  const { grandTotal, payrollTotals, totalManual, totalAssets, categoryData, employees, assets, finalSalaryUsed } = data;

  const salarySource = payrollTotals.totalFinal > 0 ? "From Payroll" : "From Employee Base";

  const summaryBars = [
    { name: "Salary",   value: finalSalaryUsed, color: T.blue },
    { name: "Expenses", value: totalManual,      color: T.green },
    { name: "Assets",   value: totalAssets,      color: T.violet },
  ];

  const payrollBreakdown = [
    { name: "Base",       value: payrollTotals.totalFinal + payrollTotals.totalDeduction - payrollTotals.totalBonus, color: T.blue },
    { name: "Bonus",      value: payrollTotals.totalBonus,     color: T.green },
    { name: "Deductions", value: payrollTotals.totalDeduction, color: T.red },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <KPICard icon="💰" label="Grand Total"      value={fmt(grandTotal)}        accent={T.blue}   sub="Salary + Expenses + Assets" />
        <KPICard icon="👥" label="Salary Cost"      value={fmt(finalSalaryUsed)}   accent={T.violet} sub={salarySource} />
        <KPICard icon="🧾" label="Manual Expenses"  value={fmt(totalManual)}        accent={T.green}  sub="Rent, WiFi, utilities…" />
        <KPICard icon="🏗️" label="Asset Cost"       value={fmt(totalAssets)}        accent={T.amber}  sub="Purchase + maintenance" />
        <KPICard icon="👤" label="Employees"        value={String(employees.length)} accent={T.teal}  sub="Active headcount" />
        <KPICard icon="📦" label="Assets"           value={String(assets.length)}   accent={T.pink}   sub="Tracked this month" />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <SectionCard title="Cost Distribution" subtitle="Salary · Expenses · Assets">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={summaryBars} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: T.inkMid, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[0, 6, 6, 0]}>
                {summaryBars.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Payroll Breakdown" subtitle="Base · Bonus · Deductions">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={payrollBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {payrollBreakdown.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: T.inkMid, fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Expense Categories" subtitle="Manual entries by category">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkDim, fontSize: 13 }}>No expense data yet</div>
          )}
        </SectionCard>
      </div>

      {/* Employee Financial Details Table */}
      <SectionCard
        title="Employee Financial Details"
        subtitle={`${employees.length} employees · live from users collection`}
      >
        <Table
          headers={["Photo", "Name", "Designation", "Monthly Salary", "Bank", "Account No"]}
          rows={employees.map(e => [
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: T.surfaceHi, border: `1px solid ${T.border}` }}>
              {e.profilePhoto
                ? <img src={e.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: T.blue, background: T.blueBg }}>
                    {(e.name || "?")[0].toUpperCase()}
                  </div>
              }
            </div>,
            <div>
              <div style={{ fontWeight: 700, color: T.ink, fontSize: 13 }}>{e.name}</div>
              <div style={{ fontSize: 11, color: T.inkDim }}>{e.email || ""}</div>
            </div>,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{e.designation || e.role || "—"}</span>,
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: T.green, fontSize: 13 }}>{e.salary ? fmt(e.salary) : "—"}</span>,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{e.bankName || "—"}</span>,
            <span style={{ color: T.inkMid, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              {e.accountNumber ? `••••${String(e.accountNumber).slice(-4)}` : "—"}
            </span>,
          ])}
        />
        {employees.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.inkMid, fontWeight: 700 }}>Total Monthly Salary:</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>
              {fmt(employees.reduce((s, e) => s + (e.salary || 0), 0))}
            </span>
            <span style={{ fontSize: 11, padding: "3px 10px", background: T.blueBg, color: T.blue, borderRadius: 99, fontWeight: 700 }}>
              {payrollTotals.totalFinal > 0 ? "⚡ Payroll overrides this" : "✅ Used in Grand Total"}
            </span>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. EXPENSES TAB
// ─────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, onAdd, onDelete }: {
  expenses: Expense[];
  onAdd: (data: Omit<Expense, "id" | "month" | "createdAt">) => void;
  onDelete: (id: string) => void;
}) {
  const [category, setCategory] = useState("Rent");
  const [amount,   setAmount]   = useState("");
  const [note,     setNote]     = useState("");
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));

  const handleAdd = () => {
    if (!amount || !date) return;
    onAdd({ category, amount: parseFloat(amount), note, date });
    setAmount(""); setNote("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="Add Expense" subtitle="Auto-tagged by month">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Quick Fill</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {EXPENSE_QUICK.map(q => (
                <button key={q} onClick={() => setCategory(q)} style={{
                  padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 7, cursor: "pointer",
                  border: `1px solid ${category === q ? T.blue : T.border}`,
                  background: category === q ? T.blueBg : T.surfaceHi,
                  color: category === q ? T.blue : T.inkMid, transition: "all 0.1s",
                }}>+ {q}</button>
              ))}
            </div>
          </div>
          <Select label="Category" value={category} onChange={setCategory} options={EXPENSE_QUICK} />
          <Input label="Amount (₹)" value={amount} onChange={setAmount} type="number" placeholder="0" />
          <Input label="Note" value={note} onChange={setNote} placeholder="Optional note" />
          <Input label="Date" value={date} onChange={setDate} type="date" />
          <AddBtn onClick={handleAdd} label="Add Expense" />
        </div>
      </SectionCard>

      <SectionCard title="Expense Records" subtitle={`${expenses.length} entries this month`}>
        <Table
          headers={["Date", "Category", "Amount", "Note", ""]}
          rows={expenses.map(e => [
            <span style={{ color: T.inkMid, fontSize: 11 }}>{e.date}</span>,
            <span style={{ padding: "3px 9px", borderRadius: 99, background: T.surfaceHi, color: T.blue, fontSize: 11, fontWeight: 700 }}>{e.category}</span>,
            <SalaryTag v={e.amount} color={T.green} />,
            <span style={{ color: T.inkMid, fontSize: 12 }}>{e.note || "—"}</span>,
            <DeleteBtn onClick={() => e.id && onDelete(e.id)} />,
          ])}
        />
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. PAYROLL TAB
// ─────────────────────────────────────────────────────────────
function PayrollTab({ payroll, payrollTotals, month, employees, onAdd, onDelete }: {
  payroll: PayrollEntry[];
  payrollTotals: { totalFinal: number; totalBonus: number; totalDeduction: number };
  month: string;
  employees: Employee[];
  onAdd: (data: Omit<PayrollEntry, "id" | "finalSalary" | "createdAt">) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedUid, setSelectedUid] = useState("");
  const [baseSalary,  setBaseSalary]  = useState("");
  const [bonus,       setBonus]       = useState("");
  const [deduction,   setDeduction]   = useState("");

  const handleSelectEmployee = (uid: string) => {
    setSelectedUid(uid);
    const emp = employees.find(e => (e.uid || e.id) === uid);
    if (emp) setBaseSalary(String(emp.salary || emp.baseSalary || ""));
  };

  const selectedEmp = employees.find(e => (e.uid || e.id) === selectedUid);

  const handleAdd = () => {
    if (!selectedUid || !baseSalary) return;
    const emp = employees.find(e => (e.uid || e.id) === selectedUid);
    onAdd({
      employeeId: selectedUid,
      employeeName: emp?.name || selectedUid,
      month,
      baseSalary: parseFloat(baseSalary),
      bonus: parseFloat(bonus) || 0,
      deduction: parseFloat(deduction) || 0,
    });
    setSelectedUid(""); setBaseSalary(""); setBonus(""); setDeduction("");
  };

  const chartData = payroll.map(p => ({
    name: p.employeeName.split(" ")[0],
    Base: p.baseSalary, Bonus: p.bonus, Deduction: p.deduction, Final: p.finalSalary,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        <SectionCard title="Add Payroll Entry" subtitle="Base + Bonus − Deduction = Final">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Select Employee</label>
              <select
                value={selectedUid} onChange={e => handleSelectEmployee(e.target.value)}
                style={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 13px", color: T.ink, fontSize: 13, width: "100%", cursor: "pointer", outline: "none" }}
              >
                <option value="">— Pick employee —</option>
                {employees.map(e => (
                  <option key={e.uid || e.id} value={e.uid || e.id}>
                    {e.name}{e.designation ? ` · ${e.designation}` : ""}{e.department ? ` (${e.department})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedEmp && (
              <div style={{ padding: "10px 12px", background: T.blueBg, borderRadius: 9, border: `1px solid ${T.blue}33`, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: T.blue + "22" }}>
                  {selectedEmp.profilePhoto
                    ? <img src={selectedEmp.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: T.blue }}>{(selectedEmp.name || "?")[0]}</div>
                  }
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{selectedEmp.name}</div>
                  <div style={{ fontSize: 11, color: T.inkMid }}>{selectedEmp.designation || selectedEmp.role} · {selectedEmp.department}</div>
                </div>
              </div>
            )}

            <Input label="Base Salary (₹)" value={baseSalary} onChange={setBaseSalary} type="number" placeholder="0" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Input label="Bonus (₹)"     value={bonus}     onChange={setBonus}     type="number" placeholder="0" />
              <Input label="Deduction (₹)" value={deduction} onChange={setDeduction} type="number" placeholder="0" />
            </div>
            {baseSalary && (
              <div style={{ padding: "10px 14px", background: T.surfaceHi, borderRadius: 9, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.inkMid, marginBottom: 3 }}>Final Salary Preview</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmt((parseFloat(baseSalary) || 0) + (parseFloat(bonus) || 0) - (parseFloat(deduction) || 0))}
                </div>
              </div>
            )}
            <AddBtn onClick={handleAdd} label="Add Payroll Entry" />
          </div>
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <KPICard icon="💵" label="Total Final"      value={fmt(payrollTotals.totalFinal)}     accent={T.blue} />
            <KPICard icon="🎁" label="Total Bonus"      value={fmt(payrollTotals.totalBonus)}     accent={T.green} />
            <KPICard icon="✂️" label="Total Deductions" value={fmt(payrollTotals.totalDeduction)} accent={T.red} />
          </div>
          {chartData.length > 0 && (
            <SectionCard title="Payroll Breakdown" subtitle="Salary composition per employee">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="name" tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: T.inkMid, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Base"      fill={T.blue}  stackId="a" />
                  <Bar dataKey="Bonus"     fill={T.green} stackId="a" />
                  <Bar dataKey="Deduction" fill={T.red} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      </div>

      <SectionCard title="Payroll Records" subtitle={`${payroll.length} entries for ${month}`}>
        <Table
          headers={["Employee", "Designation", "Dept", "Base", "Bonus", "Deduction", "Final Salary", ""]}
          rows={payroll.map(p => {
            const emp = employees.find(e => (e.uid || e.id) === p.employeeId);
            return [
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, overflow: "hidden", background: T.surfaceHi, flexShrink: 0 }}>
                  {emp?.profilePhoto
                    ? <img src={emp.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: T.blue, background: T.blueBg }}>{(p.employeeName || "?")[0]}</div>
                  }
                </div>
                <span style={{ fontWeight: 700, color: T.ink }}>{p.employeeName}</span>
              </div>,
              <span style={{ color: T.inkMid, fontSize: 11 }}>{emp?.designation || "—"}</span>,
              <DeptBadge dept={emp?.department || ""} />,
              <SalaryTag v={p.baseSalary}  color={T.inkMid} />,
              <SalaryTag v={p.bonus}       color={T.green} />,
              <span style={{ color: T.red, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>−{fmt(p.deduction)}</span>,
              <SalaryTag v={p.finalSalary} color={T.blue} />,
              <DeleteBtn onClick={() => p.id && onDelete(p.id)} />,
            ];
          })}
        />
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. EMPLOYEES TAB
// ─────────────────────────────────────────────────────────────
function EmployeesTab({ employees }: { employees: Employee[] }) {
  const [search,     setSearch]     = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  const depts = ["All", ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];

  const filtered = employees.filter(e => {
    const matchSearch = !search
      || e.name?.toLowerCase().includes(search.toLowerCase())
      || e.email?.toLowerCase().includes(search.toLowerCase())
      || e.employeeId?.toLowerCase().includes(search.toLowerCase())
      || e.designation?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "All" || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const totalSalaryFiltered = filtered.reduce((s, e) => s + (e.salary || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info banner */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: `linear-gradient(135deg, ${T.blueBg}, ${T.violetBg})`,
        border: `1px solid ${T.blue}33`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>🔗</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.blue }}>Live from Firestore · users collection</div>
          <div style={{ fontSize: 11, color: T.inkMid, marginTop: 1 }}>
            Same data used in Employee Profiles, Salary Structure, Attendance &amp; Chats.
            To edit, go to the Employee module.
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard icon="👥" label="Total Employees" value={String(employees.length)}                                          accent={T.blue}   sub="from users collection" />
        <KPICard icon="💰" label="Total Salary"    value={fmt(employees.reduce((s, e) => s + (e.salary || 0), 0))}          accent={T.green}  sub="sum of salary field" />
        <KPICard icon="🔍" label="Filtered"        value={String(filtered.length)}                                           accent={T.violet} sub={deptFilter === "All" ? "all departments" : deptFilter} />
        <KPICard icon="💵" label="Filtered Salary" value={fmt(totalSalaryFiltered)}                                          accent={T.amber}  sub="selected employees" />
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkDim, fontSize: 14 }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, ID, designation…"
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9,
              fontSize: 13, color: T.ink, outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = T.blue)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
        <select
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{
            padding: "9px 14px", background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 9, fontSize: 13, color: T.ink, cursor: "pointer", outline: "none",
          }}
        >
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || deptFilter !== "All") && (
          <button onClick={() => { setSearch(""); setDeptFilter("All"); }} style={{
            padding: "9px 14px", background: T.redBg, color: T.red,
            border: `1px solid ${T.red}44`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Clear</button>
        )}
      </div>

      {/* Employee table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>

        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "36px 2fr 1.2fr 1.4fr 1.1fr 1fr 1fr",
          gap: 0, padding: "9px 16px",
          background: T.surfaceHi, borderBottom: `1px solid ${T.border}`,
        }}>
          {["", "Employee", "Designation", "Date of Joining", "Salary", "Bank", "Account No"].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: T.inkDim, fontSize: 13 }}>No employees found</div>
        )}

        {filtered.map((e) => (
          <div key={e.id || e.uid} style={{ borderBottom: `1px solid ${T.border}44` }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "36px 2fr 1.2fr 1.4fr 1.1fr 1fr 1fr",
                gap: 0, padding: "11px 16px", alignItems: "center",
                background: "transparent", transition: "background 0.1s", cursor: "default",
              }}
              onMouseEnter={ev => { (ev.currentTarget as HTMLDivElement).style.background = T.surfaceHi; }}
              onMouseLeave={ev => { (ev.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {/* Avatar */}
              <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", background: T.surfaceHi, border: `1px solid ${T.border}`, flexShrink: 0 }}>
                {e.profilePhoto
                  ? <img src={e.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: `linear-gradient(135deg, ${T.blue}22, ${T.violet}22)`, color: T.blue, fontWeight: 800 }}>
                      {(e.name || "?")[0].toUpperCase()}
                    </div>
                }
              </div>

              {/* Name + email */}
              <div>
                <div style={{ fontWeight: 700, color: T.ink, fontSize: 13 }}>{e.name}</div>
                <div style={{ fontSize: 11, color: T.inkDim }}>{e.email || "—"}</div>
              </div>

              {/* Designation */}
              <span style={{ fontSize: 12, color: T.inkMid }}>{e.designation || e.role || "—"}</span>

              {/* Date of Joining */}
              <span style={{ fontSize: 12, color: T.inkMid }}>
                {e.dateOfJoining
                  ? new Date(e.dateOfJoining).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}
              </span>

              {/* Salary */}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: T.green, fontSize: 13 }}>
                {e.salary ? fmt(e.salary) : "—"}
              </span>

              {/* Bank */}
              <span style={{ fontSize: 12, color: T.inkMid }}>{e.bankName || "—"}</span>

              {/* Account No */}
              <span style={{ fontSize: 11, color: T.inkMid, fontFamily: "'JetBrains Mono', monospace" }}>
                {e.accountNumber ? `••••${String(e.accountNumber).slice(-4)}` : "—"}
              </span>
            </div>
          </div>
        ))}

        {/* Footer total */}
        {filtered.length > 0 && (
          <div style={{ padding: "10px 16px", background: T.surfaceHi, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.inkMid, fontWeight: 700 }}>{filtered.length} employees shown</span>
            <span style={{ fontSize: 12, color: T.inkMid }}>·</span>
            <span style={{ fontSize: 12, color: T.inkMid, fontWeight: 700 }}>Total Salary:</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totalSalaryFiltered)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 11. ASSETS TAB
// ─────────────────────────────────────────────────────────────
function AssetsTab({ assets, totalAssets, month, onAdd, onDelete }: {
  assets: Asset[];
  totalAssets: number;
  month: string;
  onAdd: (data: Omit<Asset, "id" | "totalCost" | "createdAt">) => void;
  onDelete: (id: string) => void;
}) {
  const [name,        setName]        = useState("");
  const [purchase,    setPurchase]    = useState("");
  const [maintenance, setMaintenance] = useState("");

  const handleAdd = () => {
    if (!name || !purchase) return;
    onAdd({ name, purchaseCost: parseFloat(purchase), maintenanceCost: parseFloat(maintenance) || 0, month });
    setName(""); setPurchase(""); setMaintenance("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
      <SectionCard title="Add Asset" subtitle="Purchase + maintenance = total">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Asset Name"            value={name}        onChange={setName}        placeholder="e.g. MacBook Pro M3" />
          <Input label="Purchase Cost (₹)"     value={purchase}    onChange={setPurchase}    type="number" placeholder="0" />
          <Input label="Maintenance Cost (₹)"  value={maintenance} onChange={setMaintenance} type="number" placeholder="0" />
          {purchase && (
            <div style={{ padding: "10px 14px", background: T.surfaceHi, borderRadius: 9, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.inkMid, marginBottom: 3 }}>Total Cost</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt((parseFloat(purchase) || 0) + (parseFloat(maintenance) || 0))}
              </div>
            </div>
          )}
          <AddBtn onClick={handleAdd} label="Add Asset" />
        </div>
      </SectionCard>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <KPICard icon="🏗️" label="Total Asset Cost" value={fmt(totalAssets)} accent={T.amber} sub={`${assets.length} assets in ${month}`} />
        <SectionCard title="Asset Register" subtitle={`${assets.length} assets`}>
          <Table
            headers={["Asset Name", "Purchase", "Maintenance", "Total Cost", ""]}
            rows={assets.map(a => [
              <span style={{ fontWeight: 700, color: T.ink }}>{a.name}</span>,
              <SalaryTag v={a.purchaseCost}     color={T.inkMid} />,
              <SalaryTag v={a.maintenanceCost}  color={T.amber} />,
              <SalaryTag v={a.totalCost}        color={T.violet} />,
              <DeleteBtn onClick={() => a.id && onDelete(a.id)} />,
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 12. FIRESTORE TAB
// ─────────────────────────────────────────────────────────────
const RULES_TEXT = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{id} {
      allow read, write: if request.auth != null;
    }
    match /payroll/{id} {
      allow read, write: if request.auth != null;
    }
    match /expenses/{id} {
      allow read, write: if request.auth != null;
    }
    match /assets/{id} {
      allow read, write: if request.auth != null;
    }
  }
}`;

const SCHEMA_TEXT = `// ── Firestore Collections ──────────────────────────
// employees/{id}
{
  name: string,
  role: string,
  designation?: string,
  department: string,
  email?: string,
  phone?: string,
  baseSalary: number,
  salary?: number,
  bankName?: string,
  accountNumber?: string,
  createdAt: Timestamp
}

// payroll/{id}
{
  employeeId: string,
  employeeName: string,
  month: string,
  baseSalary: number,
  bonus: number,
  deduction: number,
  finalSalary: number,
  createdAt: Timestamp
}

// expenses/{id}
{
  category: string,
  amount: number,
  note: string,
  date: string,
  month: string,
  createdAt: Timestamp
}

// assets/{id}
{
  name: string,
  purchaseCost: number,
  maintenanceCost: number,
  totalCost: number,
  month: string,
  createdAt: Timestamp
}`;

function FirestoreTab() {
  const [activeCode, setActiveCode] = useState<"schema" | "rules">("schema");
  const text = activeCode === "schema" ? SCHEMA_TEXT : RULES_TEXT;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}` }}>
        <TabBtn label="Collection Schema" active={activeCode === "schema"} onClick={() => setActiveCode("schema")} />
        <TabBtn label="Security Rules"   active={activeCode === "rules"}  onClick={() => setActiveCode("rules")} />
      </div>
      <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
            {activeCode === "schema" ? "firestore-schema.ts" : "firestore.rules"}
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
// 13. MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const MONTHS = [
  "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06",
  "2026-07","2026-08","2026-09","2026-10","2026-11","2026-12",
];
const MONTH_LABELS: Record<string, string> = {
  "2026-01":"Jan 2026","2026-02":"Feb 2026","2026-03":"Mar 2026","2026-04":"Apr 2026",
  "2026-05":"May 2026","2026-06":"Jun 2026","2026-07":"Jul 2026","2026-08":"Aug 2026",
  "2026-09":"Sep 2026","2026-10":"Oct 2026","2026-11":"Nov 2026","2026-12":"Dec 2026",
};

type Tab = "overview" | "expenses" | "payroll" | "employees" | "assets" | "firestore";

export default function FinancialDashboard() {
  const [month, setMonth] = useState("2026-03");
  const [tab,   setTab]   = useState<Tab>("overview");

  const data = useFinance(month);

  const handleAddExpense = useCallback((d: Omit<Expense,      "id"|"month"|"createdAt">)        => addExpense(d),  []);
  const handleDelExpense = useCallback((id: string)                                               => deleteExpense(id), []);
  const handleAddPayroll = useCallback((d: Omit<PayrollEntry, "id"|"finalSalary"|"createdAt">) => addPayroll(d),  []);
  const handleDelPayroll = useCallback((id: string)                                               => deletePayroll(id), []);
  const handleAddAsset   = useCallback((d: Omit<Asset,        "id"|"totalCost"|"createdAt">)    => addAsset(d),    []);
  const handleDelAsset   = useCallback((id: string)                                               => deleteAsset(id),  []);
  const { user } = useAuth();

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview",  label: "Overview" },
    { key: "expenses",  label: "Expenses",       count: data.expenses.length },
    { key: "payroll",   label: "Payroll",         count: data.payroll.length },
    { key: "employees", label: "Employees",       count: data.employees.length },
    { key: "assets",    label: "Assets",          count: data.assets.length },
  ];

  const salarySource = data.payrollTotals.totalFinal > 0 ? "payroll" : "base";

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

      {/* HEADER */}
      <header style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
        height: 58, display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)", width: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: `linear-gradient(135deg, ${T.blue}, #0ea5e9)`,
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>💰</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: T.ink, letterSpacing: "-0.3px" }}>Finance ERP</div>
            <div style={{ fontSize: 9, color: T.green, fontWeight: 700 }}>● LIVE</div>
          </div>
        </div>

        {/* <div style={{
          padding: "5px 14px", borderRadius: 99,
          background: salarySource === "payroll" ? T.blueBg : T.greenBg,
          border: `1px solid ${salarySource === "payroll" ? T.blue : T.green}44`,
          fontSize: 11, fontWeight: 700,
          color: salarySource === "payroll" ? T.blue : T.green,
        }}>
          {salarySource === "payroll" ? "⚡ Salary: from payroll entries" : "✅ Salary: from employee base"}
        </div> */}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
   <NotificationBell
  role="finance"
  uid={user?.uid || ""}
  accentColor="#2563eb"
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
          <div style={{
            padding: "7px 16px", background: T.blueBg, border: `1px solid ${T.blue}44`,
            borderRadius: 10, display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: T.inkMid, fontWeight: 700 }}>Grand Total</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(data.grandTotal)}</span>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 24px", display: "flex", gap: 0, overflowX: "auto", width: "100%",
      }}>
        {TABS.map(t => <TabBtn key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} count={t.count} />)}
      </div>

      {/* CONTENT */}
      <main style={{ padding: "20px 24px", width: "100%" }}>
        {tab === "overview"  && <OverviewTab  data={data} />}
        {tab === "expenses"  && <ExpensesTab  expenses={data.expenses}  onAdd={handleAddExpense} onDelete={handleDelExpense} />}
        {tab === "payroll"   && <PayrollTab   payroll={data.payroll}    payrollTotals={data.payrollTotals} month={month} employees={data.employees} onAdd={handleAddPayroll} onDelete={handleDelPayroll} />}
        {tab === "employees" && <EmployeesTab employees={data.employees} />}
        {tab === "assets"    && <AssetsTab    assets={data.assets}      totalAssets={data.totalAssets} month={month} onAdd={handleAddAsset} onDelete={handleDelAsset} />}
        {tab === "firestore" && <FirestoreTab />}
      </main>
    </div>
  );
}