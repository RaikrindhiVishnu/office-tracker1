"use client";

import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from "recharts";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp,
  getDocs, Timestamp,
} from "firebase/firestore";
import NotificationBell from "@/components/NotificationBell";
import {
  logSaleCreated,
  logLeadWon,
} from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import CrossDeptFeed from "@/components/CrossDeptFeed";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Tab = "overview" | "sales" | "leads" | "clients" | "payments" | "analytics" | "collaboration";
type SaleStatus = "pending" | "completed" | "cancelled" | "in_progress";
type PaymentStatus = "paid" | "partial" | "unpaid";
type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type SaleType = "software" | "project" | "image" | "video" | "service" | "product" | "other";

interface Employee {
  id: string;
  uid?: string;
  name: string;
  department?: string;
  position?: string;
  designation?: string;
  role?: string;
  salary?: number;
  baseSalary?: number;
  email?: string;
  profilePhoto?: string;
}

interface Sale {
  id?: string;
  clientName: string;
  product: string;
  type: SaleType;
  amount: number;
  paidAmount: number;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  salesPerson: string;
  salesPersonId?: string;
  region: string;
  date: string;
  dueDate: string;
  notes: string;
  invoiceNo: string;
  createdAt?: Timestamp | string;
}

interface Lead {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  stage: LeadStage;
  value: number;
  salesPerson: string;
  salesPersonId?: string;
  source: string;
  notes: string;
  createdAt?: Timestamp | string;
}

interface Client {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  totalBusiness: number;
  status: "active" | "inactive" | "prospect";
  industry: string;
  address: string;
  createdAt?: Timestamp | string;
}

interface Payment {
  id?: string;
  clientName: string;
  invoiceNo: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  paymentDate: string;
  method: string;
  status: PaymentStatus;
  notes: string;
  createdAt?: Timestamp | string;
}

interface CollabNote {
  id?: string;
  from: "sales" | "hr" | "finance";
  to: "sales" | "hr" | "finance" | "all";
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  resolved: boolean;
  createdAt?: Timestamp | string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PALETTE = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0d9488","#c2410c"];
const SALE_TYPES: SaleType[] = ["software","project","image","video","service","product","other"];
const LEAD_STAGES: LeadStage[] = ["new","contacted","qualified","proposal","won","lost"];
const REGIONS = ["North","South","East","West","Central","International"];

const STAGE_CLR: Record<LeadStage, string> = {
  new:"#3b82f6", contacted:"#0891b2", qualified:"#d97706",
  proposal:"#7c3aed", won:"#059669", lost:"#dc2626",
};
const STATUS_CLR: Record<SaleStatus, string> = {
  pending:"#d97706", completed:"#059669", cancelled:"#dc2626", in_progress:"#0891b2",
};
const PAY_CLR: Record<PaymentStatus, string> = {
  paid:"#059669", partial:"#d97706", unpaid:"#dc2626",
};

const fmt = (v: number) =>
  v >= 1_000_000 ? `₹${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `₹${(v / 1_000).toFixed(1)}K`
  : `₹${v.toFixed(0)}`;
const fmtS = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);
const today = () => new Date().toISOString().split("T")[0];

const safeName = (raw: unknown): string =>
  typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "";

const safeHue = (name: string): number =>
  name.length > 0 ? (name.charCodeAt(0) * 37) % 360 : 200;

const safeInitials = (name: string): string => {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
};

// ─── EMPLOYEE LOADER ─────────────────────────────────────────────────────────
function subscribeAllEmployees(cb: (employees: Employee[]) => void): () => void {
  const normalise = (docId: string, data: Record<string, unknown>): Employee | null => {
    const name = safeName(data.name);
    if (!name) return null;
    const salary =
      (typeof data.salary     === "number" ? data.salary     : 0) ||
      (typeof data.baseSalary === "number" ? data.baseSalary : 0);
    return {
      id:          docId,
      uid:         docId,
      name,
      email:       typeof data.email        === "string" ? data.email        : undefined,
      department:  typeof data.department   === "string" ? data.department   : undefined,
      designation: typeof data.designation  === "string" ? data.designation  : undefined,
      role:        typeof data.role         === "string" ? data.role         : undefined,
      position:    typeof data.position     === "string" ? data.position     : undefined,
      profilePhoto:typeof data.profilePhoto === "string" ? data.profilePhoto : undefined,
      salary,
      baseSalary: salary,
    };
  };

  const sortByName = (arr: Employee[]) =>
    [...arr].sort((a, b) => a.name.localeCompare(b.name));

  const fallback = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const out = snap.docs
        .map(d => normalise(d.id, d.data() as Record<string, unknown>))
        .filter((e): e is Employee => e !== null);
      cb(sortByName(out));
    } catch (err) {
      console.error("[SalesDashboard] getDocs fallback failed:", err);
      cb([]);
    }
  };

  try {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const out = snap.docs
          .map(d => normalise(d.id, d.data() as Record<string, unknown>))
          .filter((e): e is Employee => e !== null);
        cb(sortByName(out));
      },
      (err) => {
        console.error("[SalesDashboard] onSnapshot error, falling back:", err);
        fallback();
      }
    );
    return unsub;
  } catch (err) {
    console.error("[SalesDashboard] onSnapshot init error:", err);
    fallback();
    return () => {};
  }
}

// ─── EMPLOYEE DROPDOWN ────────────────────────────────────────────────────────
function EmployeePicker({
  value, onChange, employees, placeholder = "Click to pick an employee",
}: {
  value: string;
  onChange: (name: string, id: string) => void;
  employees: Employee[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = employees.filter(e => {
    const term = q.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      (e.department  || "").toLowerCase().includes(term) ||
      (e.designation || e.position || e.role || "").toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const sel = employees.find(e => e.name === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "9px 12px", background: "#fff",
          border: `1.5px solid ${open ? "#4f46e5" : "#e2e8f0"}`,
          borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
          textAlign: "left", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif",
          boxShadow: open ? "0 0 0 3px rgba(79,70,229,0.1)" : "none",
          transition: "all 0.15s",
        }}
      >
        {sel ? (
          <>
            {sel.profilePhoto ? (
              <img src={sel.profilePhoto} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: `hsl(${safeHue(sel.name)},65%,90%)`,
                color:      `hsl(${safeHue(sel.name)},65%,32%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 11,
              }}>{safeInitials(sel.name)}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{sel.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                {[sel.designation || sel.position || sel.role, sel.department].filter(Boolean).join(" · ") || "Employee"}
              </div>
            </div>
          </>
        ) : (
          <span style={{ color: "#94a3b8", flex: 1 }}>{placeholder}</span>
        )}
        <span style={{ color: "#94a3b8", fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 2000,
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)", maxHeight: 320,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={`Search ${employees.length} employees…`}
              style={{
                width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0",
                borderRadius: 7, fontSize: 12, outline: "none", color: "#1e293b",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            />
          </div>
          <div style={{ padding: "5px 12px 4px", borderBottom: "1px solid #f8fafc", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
              {filtered.length} of {employees.length} employees
            </span>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                No employees found
              </div>
            ) : filtered.map(emp => {
              const h          = safeHue(emp.name);
              const isSelected = value === emp.name;
              const subLabel   = [emp.designation || emp.position || emp.role, emp.department].filter(Boolean).join(" · ");
              return (
                <div
                  key={emp.id}
                  onClick={() => { onChange(emp.name, emp.id); setOpen(false); setQ(""); }}
                  style={{
                    padding: "9px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    background: isSelected ? "#f0f9ff" : "transparent",
                    borderLeft: isSelected ? "3px solid #4f46e5" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? "#f0f9ff" : "transparent"; }}
                >
                  {emp.profilePhoto ? (
                    <img src={emp.profilePhoto} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: `hsl(${h},65%,90%)`, color: `hsl(${h},65%,32%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 12,
                    }}>{safeInitials(emp.name)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
                    {subLabel && <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subLabel}</div>}
                  </div>
                  {emp.department && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                      background: `hsl(${h},65%,90%)`, color: `hsl(${h},65%,32%)`,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>{emp.department}</span>
                  )}
                  {isSelected && <span style={{ color: "#4f46e5", fontSize: 14, flexShrink: 0 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SHARED UI ───────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + "18", color, textTransform: "capitalize", letterSpacing: "0.02em" }}>
      {label.replace("_", " ")}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 660, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.14)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 13, outline: "none", fontFamily: "'Plus Jakarta Sans',sans-serif" };
const selStyle: React.CSSProperties = { ...inp, cursor: "pointer" };

function KPI({ label, value, sub, icon, color, change, up }: { label: string; value: string; sub?: string; icon: string; color: string; change?: string; up?: boolean }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 14px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color, borderRadius: "16px 0 0 16px" }} />
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 21, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{label}</div>
      {change && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: up ? "#dcfce7" : "#fee2e2", color: up ? "#166534" : "#991b1b" }}>{up ? "↑" : "↓"} {change}</div>}
    </div>
  );
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
      <p style={{ color: "#64748b", marginBottom: 4, fontWeight: 700 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: "2px 0" }}>{p.name}: {p.value > 999 ? fmtS(p.value) : p.value}</p>)}
    </div>
  );
}

function Empty({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
      <div style={{ fontSize: 38, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{msg}</div>
    </div>
  );
}

const btnP: React.CSSProperties = { padding: "8px 18px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(79,70,229,0.28)" };
const btnS: React.CSSProperties = { padding: "8px 16px", background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", whiteSpace: "nowrap" };
const btnI = (c: "blue" | "red"): React.CSSProperties => ({ padding: "4px 9px", background: c === "blue" ? "#eff6ff" : "#fff1f2", color: c === "blue" ? "#3b82f6" : "#ef4444", border: `1px solid ${c === "blue" ? "#bfdbfe" : "#fecaca"}`, borderRadius: 6, fontSize: 11, cursor: "pointer" });

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function SalesDashboard() {
  const { user, userData } = useAuth();

  const [tab,          setTab]          = useState<Tab>("overview");
  const [sales,        setSales]        = useState<Sale[]>([]);
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [collabNotes,  setCollabNotes]  = useState<CollabNote[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [empLoading,   setEmpLoading]   = useState(true);
  const [financeTotal, setFinanceTotal] = useState(0);
  const [payrollTotal, setPayrollTotal] = useState(0);

  const [showSaleForm,    setShowSaleForm]    = useState(false);
  const [showLeadForm,    setShowLeadForm]    = useState(false);
  const [showClientForm,  setShowClientForm]  = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCollabForm,  setShowCollabForm]  = useState(false);
  const [editSale,    setEditSale]    = useState<Sale | null>(null);
  const [editLead,    setEditLead]    = useState<Lead | null>(null);
  const [editClient,  setEditClient]  = useState<Client | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);

  const [saleSearch,   setSaleSearch]   = useState("");
  const [leadFilter,   setLeadFilter]   = useState<LeadStage | "all">("all");
  const [clientSearch, setClientSearch] = useState("");
  const [payFilter,    setPayFilter]    = useState<PaymentStatus | "all">("all");

  // ── Firebase subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];

   const sub = <T,>(
  col: string,
  setter: (d: T[]) => void
) => {
  try {
    return onSnapshot(
      collection(db, col),
      snap => {
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as T[];

        setter(data);
      },
      () => {}
    );
  } catch {
    return () => {};
  }
};

   unsubs.push(sub<Sale>("sales", setSales));
unsubs.push(sub<Lead>("leads", setLeads));
unsubs.push(sub<Client>("clients", setClients));
unsubs.push(sub<Payment>("payments", setPayments));
unsubs.push(sub<CollabNote>("collab_notes", setCollabNotes));

    const empUnsub = subscribeAllEmployees(data => {
      setEmployees(data);
      setEmpLoading(false);
    });
    unsubs.push(empUnsub);

    (async () => {
      try {
        const [expSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "expenses")),
          getDocs(collection(db, "users")),
        ]);
        setFinanceTotal(expSnap.docs.reduce((a, d) => a + (Number((d.data() as Record<string, unknown>).amount) || 0), 0));
        setPayrollTotal(usersSnap.docs.reduce((a, d) => {
          const data = d.data() as Record<string, unknown>;
          return a + (Number(data.salary ?? data.baseSalary) || 0);
        }, 0));
      } catch {}
    })();

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalRevenue   = sales.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const totalPaid      = sales.reduce((a, s) => a + (Number(s.paidAmount) || 0), 0);
  const totalPending   = totalRevenue - totalPaid;
  const completedDeals = sales.filter(s => s.status === "completed").length;
  const wonLeads       = leads.filter(l => l.stage === "won").length;
  const convRate       = leads.length ? ((wonLeads / leads.length) * 100).toFixed(1) : "0";
  const netProfit      = totalRevenue - financeTotal - payrollTotal;

  const monthMap: Record<string, number> = {};
  sales.forEach(s => {
    const mo = s.date ? new Date(s.date).toLocaleString("default", { month: "short" }) : "—";
    monthMap[mo] = (monthMap[mo] || 0) + (Number(s.amount) || 0);
  });
  const trendData = Object.entries(monthMap).map(([month, amount]) => ({ month, amount }));

  const typeMap: Record<string, number> = {};
  sales.forEach(s => { typeMap[s.type] = (typeMap[s.type] || 0) + (Number(s.amount) || 0); });
  const byType = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  const regMap: Record<string, number> = {};
  sales.forEach(s => { if (s.region) regMap[s.region] = (regMap[s.region] || 0) + (Number(s.amount) || 0); });
  const byRegion = Object.entries(regMap).map(([region, amount]) => ({ region, amount }));

  const repMap: Record<string, { deals: number; amount: number }> = {};
  sales.forEach(s => {
    if (s.salesPerson) {
      if (!repMap[s.salesPerson]) repMap[s.salesPerson] = { deals: 0, amount: 0 };
      repMap[s.salesPerson].deals++;
      repMap[s.salesPerson].amount += Number(s.amount) || 0;
    }
  });
  const topReps = Object.entries(repMap).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);

  const funnelData = LEAD_STAGES.map(st => ({
    name: st.charAt(0).toUpperCase() + st.slice(1),
    value: leads.filter(l => l.stage === st).length,
    fill: STAGE_CLR[st] || "#94a3b8",
  }));

  const exportCSV = () => {
    const rows = ["Invoice,Client,Product,Type,Amount,Paid,Status,Payment,SalesPerson,Region,Date",
      ...sales.map(s => `${s.invoiceNo},${s.clientName},${s.product},${s.type},${s.amount},${s.paidAmount},${s.status},${s.paymentStatus},${s.salesPerson},${s.region},${s.date}`),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = "sales.csv"; a.click();
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const saveSale = async (s: Sale) => {
    if (s.id) {
      await updateDoc(doc(db, "sales", s.id), { ...s, updatedAt: serverTimestamp() });
    } else {
      const ref = await addDoc(collection(db, "sales"), { ...s, createdAt: serverTimestamp() });
      await logSaleCreated(
        s.salesPerson || (userData as any)?.name || "Sales team",
        s.clientName,
        Number(s.amount) || 0,
        ref.id
      );
    }
    setShowSaleForm(false);
    setEditSale(null);
  };

  const delSale     = async (id: string)    => { if(confirm("Delete?")) await deleteDoc(doc(db,"sales",id)); };

  const saveLead = async (l: Lead) => {
    const isNew = !l.id;
    const prevLead = leads.find(x => x.id === l.id);
    if (l.id) {
      await updateDoc(doc(db, "leads", l.id), { ...l, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, "leads"), { ...l, createdAt: serverTimestamp() });
    }
    // fire notification when stage becomes "won" (new lead won, or existing lead changed to won)
    if (
      l.stage === "won" &&
      (isNew || prevLead?.stage !== "won")
    ) {
      await logLeadWon(
        l.salesPerson || (userData as any)?.name || "Sales team",
        l.name,
        l.company,
        Number(l.value) || 0
      );
    }
    setShowLeadForm(false);
    setEditLead(null);
  };

  const delLead     = async (id: string)    => { if(confirm("Delete?")) await deleteDoc(doc(db,"leads",id)); };
  const saveClient  = async (c: Client)     => { c.id ? await updateDoc(doc(db,"clients",c.id),{...c,updatedAt:serverTimestamp()})   : await addDoc(collection(db,"clients"),{...c,createdAt:serverTimestamp()});     setShowClientForm(false);  setEditClient(null); };
  const delClient   = async (id: string)    => { if(confirm("Delete?")) await deleteDoc(doc(db,"clients",id)); };
  const savePayment = async (p: Payment)    => { p.id ? await updateDoc(doc(db,"payments",p.id),{...p,updatedAt:serverTimestamp()}) : await addDoc(collection(db,"payments"),{...p,createdAt:serverTimestamp()});   setShowPaymentForm(false); setEditPayment(null); };
  const delPayment  = async (id: string)    => { if(confirm("Delete?")) await deleteDoc(doc(db,"payments",id)); };
  const saveCollab  = async (n: CollabNote) => { await addDoc(collection(db,"collab_notes"),{...n,resolved:false,createdAt:serverTimestamp()}); setShowCollabForm(false); };
  const resolveCollab = async (id: string)  => { await updateDoc(doc(db,"collab_notes",id),{resolved:true}); };

  // ── SHARED EMPLOYEE PICKER FIELD ─────────────────────────────────────────
  const EmpPickerField = ({
    value,
    onChangeName,
    onChangeId,
  }: { value: string; onChangeName: (n: string) => void; onChangeId: (id: string) => void }) => (
    <Field label={empLoading ? "Sales Person — loading…" : `Sales Person — ${employees.length} employees from users`}>
      {empLoading ? (
        <div style={{ padding: "10px 12px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#94a3b8" }}>
          ⏳ Loading employees from Firebase…
        </div>
      ) : employees.length === 0 ? (
        <div style={{ padding: "10px 12px", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 8, fontSize: 12, color: "#c2410c" }}>
          ⚠️ No employees found in the <code>users</code> Firestore collection
        </div>
      ) : (
        <EmployeePicker
          value={value}
          onChange={(name, id) => { onChangeName(name); onChangeId(id); }}
          employees={employees}
          placeholder={`Choose from ${employees.length} employees…`}
        />
      )}
    </Field>
  );

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
        <KPI label="Total Revenue"  value={fmt(totalRevenue)}    icon="💵" color="#4f46e5" change="18%" up />
        <KPI label="Collected"      value={fmt(totalPaid)}       sub={`Pending ${fmt(totalPending)}`} icon="✅" color="#059669" />
        <KPI label="Net Profit"     value={fmt(netProfit)}       icon="📈" color={netProfit >= 0 ? "#059669" : "#dc2626"} />
        <KPI label="Total Sales"    value={String(sales.length)} sub={`${completedDeals} done`} icon="🧾" color="#0891b2" change="9%" up />
        <KPI label="Total Leads"    value={String(leads.length)} sub={`${wonLeads} won`} icon="🎯" color="#d97706" />
        <KPI label="Conversion"     value={`${convRate}%`}       icon="🔄" color="#7c3aed" />
        <KPI label="Clients"        value={String(clients.length)} icon="👥" color="#0d9488" change="3%" up />
        <KPI label="Employees"      value={empLoading ? "…" : String(employees.length)} icon="👤" color="#c2410c" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))", gap: 16, marginBottom: 16 }}>
        <Card title="Monthly Revenue Trend" sub="Real-time from Firebase">
          {trendData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.15}/><stop offset="100%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtS} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CTip/>}/>
                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fill="url(#rg)" name="Revenue" dot={false} activeDot={{r:4,fill:"#4f46e5"}}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty icon="📊" msg="Add sales to see trend"/>}
        </Card>
        <Card title="Revenue by Type" sub="Category breakdown">
          {byType.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent = 0 }) =>
  `${name} ${(percent * 100).toFixed(0)}%`
} labelLine={false} fontSize={10}>
                  {byType.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                </Pie>
                <Tooltip formatter={((value: number | undefined) => [fmt(value ?? 0), ""]) as any} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty icon="🥧" msg="No data yet"/>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))", gap: 16, marginBottom: 16 }}>
        <Card title="Sales Funnel" sub="Lead conversion pipeline">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {funnelData.map(st => {
              const max = funnelData[0]?.value || 1;
              const pct = max > 0 ? Math.round((st.value/max)*100) : 0;
              return (
                <div key={st.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "#475569", fontWeight: 600 }}>{st.name}</span>
                    <span style={{ color: st.fill, fontWeight: 800 }}>{st.value} <span style={{ color: "#94a3b8", fontSize: 10 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: st.fill, borderRadius: 99, transition: "width 0.8s" }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Top Sales Reps" sub="By total revenue">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {topReps.length ? topReps.map(([name,v],i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: PALETTE[i]+"18", color: PALETTE[i], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                  {safeInitials(name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "#475569", fontWeight: 600 }}>{name}</span>
                    <span style={{ color: PALETTE[i], fontWeight: 800 }}>{fmt(v.amount)}</span>
                  </div>
                  <div style={{ height: 5, background: "#f1f5f9", borderRadius: 99 }}>
                    <div style={{ width: `${Math.round((v.amount/(topReps[0]?.[1].amount||1))*100)}%`, height: "100%", background: PALETTE[i], borderRadius: 99 }}/>
                  </div>
                </div>
                <span style={{ background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{v.deals}d</span>
              </div>
            )) : <Empty icon="👤" msg="No rep data yet"/>}
          </div>
        </Card>
      </div>

      {byRegion.length > 0 && (
        <Card title="Revenue by Region">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byRegion} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="region" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={fmtS} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CTip/>}/>
              <Bar dataKey="amount" name="Revenue" radius={[6,6,0,0]}>
                {byRegion.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cross-Department Activity Feed */}
      <CrossDeptFeed
        role="sales"
        accentColor="#4f46e5"
        title="Incoming from Other Teams"
        maxItems={10}
      />
    </div>
  );

  // ── SALES TAB ─────────────────────────────────────────────────────────────
  const renderSales = () => {
    const filtered = sales.filter(s =>
      (s.clientName||"").toLowerCase().includes(saleSearch.toLowerCase()) ||
      (s.product||"").toLowerCase().includes(saleSearch.toLowerCase()) ||
      (s.salesPerson||"").toLowerCase().includes(saleSearch.toLowerCase())
    );
    return (
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input value={saleSearch} onChange={e=>setSaleSearch(e.target.value)} placeholder="🔍 Search client, product, rep..." style={{...inp,flex:1,minWidth:200}}/>
          <button onClick={()=>{setEditSale(null);setShowSaleForm(true);}} style={btnP}>+ Add Sale</button>
          <button onClick={exportCSV} style={btnS}>⬇ Export CSV</button>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>{["Invoice","Client","Product","Type","Amount","Paid","Status","Payment","Rep","Region","Date",""].map(h=>(
                <th key={h} style={{ padding:"11px 14px",color:"#64748b",fontWeight:700,fontSize:10,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=>(
                <tr key={s.id} style={{ borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="#f0f9ff")}
                  onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?"#fff":"#fafafa")}>
                  <td style={{padding:"11px 14px",color:"#94a3b8",fontFamily:"monospace",fontSize:11}}>{s.invoiceNo||"—"}</td>
                  <td style={{padding:"11px 14px",color:"#0f172a",fontWeight:700}}>{s.clientName}</td>
                  <td style={{padding:"11px 14px",color:"#475569"}}>{s.product}</td>
                  <td style={{padding:"11px 14px"}}><Badge label={s.type} color="#7c3aed"/></td>
                  <td style={{padding:"11px 14px",color:"#4f46e5",fontWeight:800}}>{fmt(Number(s.amount)||0)}</td>
                  <td style={{padding:"11px 14px",color:"#059669",fontWeight:700}}>{fmt(Number(s.paidAmount)||0)}</td>
                  <td style={{padding:"11px 14px"}}><Badge label={s.status} color={STATUS_CLR[s.status]||"#64748b"}/></td>
                  <td style={{padding:"11px 14px"}}><Badge label={s.paymentStatus} color={PAY_CLR[s.paymentStatus]||"#64748b"}/></td>
                  <td style={{padding:"11px 14px",color:"#475569"}}>{s.salesPerson}</td>
                  <td style={{padding:"11px 14px",color:"#94a3b8"}}>{s.region}</td>
                  <td style={{padding:"11px 14px",color:"#94a3b8",fontSize:11}}>{s.date}</td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setEditSale(s);setShowSaleForm(true);}} style={btnI("blue")}>✏️</button>
                      <button onClick={()=>delSale(s.id!)} style={btnI("red")}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<Empty icon="🧾" msg="No sales found. Add your first sale!"/>}
        </div>
      </div>
    );
  };

  // ── LEADS ─────────────────────────────────────────────────────────────────
  const renderLeads = () => {
    const filtered = leadFilter==="all"?leads:leads.filter(l=>l.stage===leadFilter);
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {(["all",...LEAD_STAGES] as (LeadStage|"all")[]).map(s=>(
            <button key={s} onClick={()=>setLeadFilter(s)} style={{ padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",textTransform:"capitalize", background:leadFilter===s?(s==="all"?"#4f46e5":STAGE_CLR[s as LeadStage]):"#f1f5f9", color:leadFilter===s?"#fff":"#64748b"}}>{s}</button>
          ))}
          <button onClick={()=>{setEditLead(null);setShowLeadForm(true);}} style={{...btnP,marginLeft:"auto"}}>+ Add Lead</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {filtered.map(l=>(
            <div key={l.id} style={{ background:"#fff",border:`1.5px solid ${STAGE_CLR[l.stage]}33`,borderRadius:14,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div><div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{l.name}</div><div style={{fontSize:11,color:"#94a3b8"}}>{l.company}</div></div>
                <Badge label={l.stage} color={STAGE_CLR[l.stage]}/>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,color:"#64748b",marginBottom:10}}>
                <div>📧 {l.email||"—"}</div><div>📞 {l.phone||"—"}</div>
                <div>👤 {l.salesPerson||"—"}</div><div style={{color:"#4f46e5",fontWeight:700}}>{fmt(Number(l.value)||0)}</div>
              </div>
              {l.notes&&<div style={{fontSize:11,color:"#64748b",background:"#f8fafc",padding:"6px 10px",borderRadius:8,marginBottom:10}}>{l.notes}</div>}
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setEditLead(l);setShowLeadForm(true);}} style={btnI("blue")}>✏️ Edit</button>
                <button onClick={()=>delLead(l.id!)} style={btnI("red")}>🗑️</button>
              </div>
            </div>
          ))}
          {filtered.length===0&&<div style={{gridColumn:"1/-1"}}><Empty icon="🎯" msg="No leads found"/></div>}
        </div>
      </div>
    );
  };

  // ── CLIENTS ───────────────────────────────────────────────────────────────
  const renderClients = () => {
    const filtered = clients.filter(c=>(c.name||"").toLowerCase().includes(clientSearch.toLowerCase())||(c.company||"").toLowerCase().includes(clientSearch.toLowerCase()));
    return (
      <div>
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="🔍 Search clients..." style={{...inp,flex:1}}/>
          <button onClick={()=>{setEditClient(null);setShowClientForm(true);}} style={btnP}>+ Add Client</button>
        </div>
        <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{background:"#f8fafc"}}>
              <tr>{["Name","Company","Email","Phone","Industry","Total Business","Status",""].map(h=>(
                <th key={h} style={{padding:"11px 14px",color:"#64748b",fontWeight:700,fontSize:10,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((c,i)=>(
                <tr key={c.id} style={{borderTop:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="#f0f9ff")}
                  onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?"#fff":"#fafafa")}>
                  <td style={{padding:"11px 14px",color:"#0f172a",fontWeight:700}}>{c.name}</td>
                  <td style={{padding:"11px 14px",color:"#475569"}}>{c.company}</td>
                  <td style={{padding:"11px 14px",color:"#64748b"}}>{c.email}</td>
                  <td style={{padding:"11px 14px",color:"#64748b"}}>{c.phone}</td>
                  <td style={{padding:"11px 14px",color:"#64748b"}}>{c.industry}</td>
                  <td style={{padding:"11px 14px",color:"#4f46e5",fontWeight:800}}>{fmt(Number(c.totalBusiness)||0)}</td>
                  <td style={{padding:"11px 14px"}}><Badge label={c.status} color={c.status==="active"?"#059669":c.status==="prospect"?"#d97706":"#94a3b8"}/></td>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setEditClient(c);setShowClientForm(true);}} style={btnI("blue")}>✏️</button>
                      <button onClick={()=>delClient(c.id!)} style={btnI("red")}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<Empty icon="👥" msg="No clients yet"/>}
        </div>
      </div>
    );
  };

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  const renderPayments = () => {
    const filtered = payFilter==="all"?payments:payments.filter(p=>p.status===payFilter);
    const totalDue = payments.filter(p=>p.status!=="paid").reduce((a,p)=>a+(Number(p.amount)-Number(p.paidAmount||0)),0);
    const overdue  = payments.filter(p=>p.status!=="paid"&&new Date(p.dueDate)<new Date());
    return (
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
          <KPI label="Collected"   value={fmt(totalPaid)}        icon="✅" color="#059669"/>
          <KPI label="Outstanding" value={fmt(totalDue)}         icon="⏳" color="#d97706"/>
          <KPI label="Overdue"     value={String(overdue.length)} icon="🔴" color="#dc2626"/>
          <KPI label="Records"     value={String(payments.length)} icon="📋" color="#0891b2"/>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {(["all","paid","partial","unpaid"] as (PaymentStatus|"all")[]).map(s=>(
            <button key={s} onClick={()=>setPayFilter(s)} style={{ padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",textTransform:"capitalize", background:payFilter===s?(s==="all"?"#4f46e5":PAY_CLR[s as PaymentStatus]):"#f1f5f9", color:payFilter===s?"#fff":"#64748b"}}>{s}</button>
          ))}
          <button onClick={()=>{setEditPayment(null);setShowPaymentForm(true);}} style={{...btnP,marginLeft:"auto"}}>+ Add Payment</button>
        </div>
        <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{background:"#f8fafc"}}>
              <tr>{["Invoice","Client","Total","Paid","Due","Due Date","Pay Date","Method","Status",""].map(h=>(
                <th key={h} style={{padding:"11px 14px",color:"#64748b",fontWeight:700,fontSize:10,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((p,i)=>{
                const due=Number(p.amount)-Number(p.paidAmount||0);
                const isOvd=p.status!=="paid"&&new Date(p.dueDate)<new Date();
                return (
                  <tr key={p.id} style={{borderTop:"1px solid #f1f5f9",background:isOvd?"#fff1f2":i%2===0?"#fff":"#fafafa"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#f0f9ff")}
                    onMouseLeave={e=>(e.currentTarget.style.background=isOvd?"#fff1f2":i%2===0?"#fff":"#fafafa")}>
                    <td style={{padding:"11px 14px",color:"#94a3b8",fontFamily:"monospace",fontSize:11}}>{p.invoiceNo||"—"}</td>
                    <td style={{padding:"11px 14px",color:"#0f172a",fontWeight:700}}>{p.clientName}</td>
                    <td style={{padding:"11px 14px",color:"#475569"}}>{fmt(Number(p.amount)||0)}</td>
                    <td style={{padding:"11px 14px",color:"#059669",fontWeight:700}}>{fmt(Number(p.paidAmount)||0)}</td>
                    <td style={{padding:"11px 14px",color:due>0?"#dc2626":"#94a3b8",fontWeight:due>0?700:400}}>{due>0?fmt(due):"—"}</td>
                    <td style={{padding:"11px 14px",color:isOvd?"#dc2626":"#64748b",fontSize:11}}>
                      {p.dueDate}{isOvd&&<span style={{fontSize:9,background:"#fee2e2",color:"#dc2626",padding:"1px 5px",borderRadius:4,marginLeft:4}}>OVERDUE</span>}
                    </td>
                    <td style={{padding:"11px 14px",color:"#64748b",fontSize:11}}>{p.paymentDate||"—"}</td>
                    <td style={{padding:"11px 14px",color:"#64748b"}}>{p.method||"—"}</td>
                    <td style={{padding:"11px 14px"}}><Badge label={p.status} color={PAY_CLR[p.status]}/></td>
                    <td style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{setEditPayment(p);setShowPaymentForm(true);}} style={btnI("blue")}>✏️</button>
                        <button onClick={()=>delPayment(p.id!)} style={btnI("red")}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<Empty icon="💳" msg="No payment records"/>}
        </div>
      </div>
    );
  };

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  const renderAnalytics = () => (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(380px,1fr))",gap:16,marginBottom:16}}>
        <Card title="Monthly Revenue" sub="Bar breakdown">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={trendData.length?trendData:[{month:"No Data",amount:0}]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={fmtS} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CTip/>}/>
              <Bar dataKey="amount" name="Revenue" radius={[6,6,0,0]}>{trendData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Sales by Type" sub="Revenue share">
          {byType.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent = 0 }) =>
  `${name} ${(percent * 100).toFixed(0)}%`
} labelLine={false} fontSize={10}>
                  {byType.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                </Pie>
  <Tooltip formatter={((value: number | undefined) => [fmt(value ?? 0), ""]) as any} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty icon="📊" msg="Add sales data"/>}
        </Card>
        <Card title="Lead Pipeline" sub="By stage">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={funnelData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip content={<CTip/>}/>
              <Bar dataKey="value" name="Leads" radius={[0,6,6,0]}>{funnelData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        {byRegion.length>0&&(
          <Card title="Revenue by Region">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byRegion} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="region" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtS} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="amount" name="Revenue" radius={[6,6,0,0]}>{byRegion.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      <Card title="Profit & Loss — Full Company View" sub="Integrated with Finance & HR">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:4}}>
          {[
            {l:"Gross Revenue", v:fmt(totalRevenue),c:"#4f46e5",i:"📈"},
            {l:"Total Expenses",v:fmt(financeTotal), c:"#dc2626",i:"📉"},
            {l:"Payroll Costs", v:fmt(payrollTotal), c:"#d97706",i:"👥"},
            {l:"Net Profit",    v:fmt(netProfit),    c:netProfit>=0?"#059669":"#dc2626",i:"💹"},
            {l:"Profit Margin", v:totalRevenue>0?`${((netProfit/totalRevenue)*100).toFixed(1)}%`:"—",c:"#7c3aed",i:"%"},
            {l:"Collected",     v:fmt(totalPaid),    c:"#059669",i:"✅"},
          ].map(item=>(
            <div key={item.l} style={{background:"#f8fafc",borderRadius:12,padding:"14px 16px",border:`1px solid ${item.c}22`}}>
              <div style={{fontSize:20,marginBottom:6}}>{item.i}</div>
              <div style={{fontSize:20,fontWeight:900,color:item.c,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{item.v}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{item.l}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  // ── COLLABORATION ─────────────────────────────────────────────────────────
  const renderCollaboration = () => (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="Open Requests" value={String(collabNotes.filter(n=>!n.resolved).length)}      icon="📬" color="#d97706"/>
        <KPI label="From HR"       value={String(collabNotes.filter(n=>n.from==="hr").length)}     icon="👥" color="#0891b2"/>
        <KPI label="From Finance"  value={String(collabNotes.filter(n=>n.from==="finance").length)} icon="💰" color="#059669"/>
        <KPI label="Total Notes"   value={String(collabNotes.length)}                              icon="💬" color="#7c3aed"/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button onClick={()=>setShowCollabForm(true)} style={btnP}>+ Send Collaboration Note</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
        {collabNotes.map(note=>{
          const fc=note.from==="hr"?"#0891b2":note.from==="finance"?"#059669":"#4f46e5";
          const pc=note.priority==="high"?"#dc2626":note.priority==="medium"?"#d97706":"#94a3b8";
          return (
            <div key={note.id} style={{background:"#fff",border:`1.5px solid ${note.resolved?"#e2e8f0":fc+"44"}`,borderRadius:14,padding:16,opacity:note.resolved?0.65:1,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={note.from} color={fc}/><span style={{fontSize:10,color:"#94a3b8"}}>→</span><Badge label={note.to} color="#64748b"/></div>
                <Badge label={note.priority} color={pc}/>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:6}}>{note.subject}</div>
              <div style={{fontSize:12,color:"#64748b",lineHeight:1.5,marginBottom:12}}>{note.message}</div>
              {!note.resolved
                ?<button onClick={()=>resolveCollab(note.id!)} style={{background:"#f0fdf4",color:"#059669",border:"1px solid #bbf7d0",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Mark Resolved</button>
                :<span style={{fontSize:11,color:"#94a3b8"}}>✓ Resolved</span>
              }
            </div>
          );
        })}
        {collabNotes.length===0&&<div style={{gridColumn:"1/-1"}}><Empty icon="💬" msg="No collaboration notes yet"/></div>}
      </div>
    </div>
  );

  // ── FORMS ─────────────────────────────────────────────────────────────────
  const SaleForm = () => {
    const [f,setF] = useState<Sale>(editSale||{clientName:"",product:"",type:"software",amount:0,paidAmount:0,status:"pending",paymentStatus:"unpaid",salesPerson:"",salesPersonId:"",region:"",date:today(),dueDate:"",notes:"",invoiceNo:`INV-${Date.now()}`});
    const s=(k:keyof Sale,v:unknown)=>setF(p=>({...p,[k]:v}));
    return (
      <Modal title={editSale?"Edit Sale":"Add New Sale"} onClose={()=>{setShowSaleForm(false);setEditSale(null);}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Invoice No"><input style={inp} value={f.invoiceNo} onChange={e=>s("invoiceNo",e.target.value)}/></Field>
          <Field label="Client Name"><input style={inp} value={f.clientName} onChange={e=>s("clientName",e.target.value)}/></Field>
          <Field label="Product / Service"><input style={inp} value={f.product} onChange={e=>s("product",e.target.value)}/></Field>
          <Field label="Sale Type"><select style={selStyle} value={f.type} onChange={e=>s("type",e.target.value as SaleType)}>{SALE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></Field>
          <Field label="Amount (₹)"><input type="number" style={inp} value={f.amount} onChange={e=>s("amount",Number(e.target.value))}/></Field>
          <Field label="Paid Amount (₹)"><input type="number" style={inp} value={f.paidAmount} onChange={e=>s("paidAmount",Number(e.target.value))}/></Field>
          <Field label="Sale Status"><select style={selStyle} value={f.status} onChange={e=>s("status",e.target.value as SaleStatus)}>{(["pending","in_progress","completed","cancelled"] as SaleStatus[]).map(st=><option key={st} value={st}>{st.replace("_"," ")}</option>)}</select></Field>
          <Field label="Payment Status"><select style={selStyle} value={f.paymentStatus} onChange={e=>s("paymentStatus",e.target.value as PaymentStatus)}>{(["unpaid","partial","paid"] as PaymentStatus[]).map(st=><option key={st} value={st}>{st}</option>)}</select></Field>
        </div>
        <EmpPickerField value={f.salesPerson} onChangeName={n=>s("salesPerson",n)} onChangeId={id=>s("salesPersonId",id)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Region"><select style={selStyle} value={f.region} onChange={e=>s("region",e.target.value)}><option value="">Select region</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></Field>
          <Field label="Sale Date"><input type="date" style={inp} value={f.date} onChange={e=>s("date",e.target.value)}/></Field>
          <Field label="Due Date"><input type="date" style={inp} value={f.dueDate} onChange={e=>s("dueDate",e.target.value)}/></Field>
        </div>
        <Field label="Notes"><textarea style={{...inp,height:70,resize:"vertical"}} value={f.notes} onChange={e=>s("notes",e.target.value)}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={()=>{setShowSaleForm(false);setEditSale(null);}} style={btnS}>Cancel</button>
          <button onClick={()=>saveSale(f)} style={btnP}>💾 Save Sale</button>
        </div>
      </Modal>
    );
  };

  const LeadForm = () => {
    const [f,setF]=useState<Lead>(editLead||{name:"",email:"",phone:"",company:"",stage:"new",value:0,salesPerson:"",salesPersonId:"",source:"",notes:""});
    const s=(k:keyof Lead,v:unknown)=>setF(p=>({...p,[k]:v}));
    return (
      <Modal title={editLead?"Edit Lead":"Add New Lead"} onClose={()=>{setShowLeadForm(false);setEditLead(null);}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Name"><input style={inp} value={f.name} onChange={e=>s("name",e.target.value)}/></Field>
          <Field label="Company"><input style={inp} value={f.company} onChange={e=>s("company",e.target.value)}/></Field>
          <Field label="Email"><input style={inp} value={f.email} onChange={e=>s("email",e.target.value)}/></Field>
          <Field label="Phone"><input style={inp} value={f.phone} onChange={e=>s("phone",e.target.value)}/></Field>
          <Field label="Stage"><select style={selStyle} value={f.stage} onChange={e=>s("stage",e.target.value as LeadStage)}>{LEAD_STAGES.map(st=><option key={st} value={st}>{st.charAt(0).toUpperCase()+st.slice(1)}</option>)}</select></Field>
          <Field label="Deal Value (₹)"><input type="number" style={inp} value={f.value} onChange={e=>s("value",Number(e.target.value))}/></Field>
        </div>
        <EmpPickerField value={f.salesPerson} onChangeName={n=>s("salesPerson",n)} onChangeId={id=>s("salesPersonId",id)}/>
        <Field label="Lead Source"><input style={inp} value={f.source} onChange={e=>s("source",e.target.value)}/></Field>
        <Field label="Notes"><textarea style={{...inp,height:70,resize:"vertical"}} value={f.notes} onChange={e=>s("notes",e.target.value)}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={()=>{setShowLeadForm(false);setEditLead(null);}} style={btnS}>Cancel</button>
          <button onClick={()=>saveLead(f)} style={btnP}>💾 Save Lead</button>
        </div>
      </Modal>
    );
  };

  const ClientForm = () => {
    const [f,setF]=useState<Client>(editClient||{name:"",email:"",phone:"",company:"",totalBusiness:0,status:"prospect",industry:"",address:""});
    const s=(k:keyof Client,v:unknown)=>setF(p=>({...p,[k]:v}));
    return (
      <Modal title={editClient?"Edit Client":"Add New Client"} onClose={()=>{setShowClientForm(false);setEditClient(null);}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Name"><input style={inp} value={f.name} onChange={e=>s("name",e.target.value)}/></Field>
          <Field label="Company"><input style={inp} value={f.company} onChange={e=>s("company",e.target.value)}/></Field>
          <Field label="Email"><input style={inp} value={f.email} onChange={e=>s("email",e.target.value)}/></Field>
          <Field label="Phone"><input style={inp} value={f.phone} onChange={e=>s("phone",e.target.value)}/></Field>
          <Field label="Industry"><input style={inp} value={f.industry} onChange={e=>s("industry",e.target.value)}/></Field>
          <Field label="Status"><select style={selStyle} value={f.status} onChange={e=>s("status",e.target.value as Client["status"])}>{(["prospect","active","inactive"] as Client["status"][]).map(st=><option key={st} value={st}>{st}</option>)}</select></Field>
          <Field label="Total Business (₹)"><input type="number" style={inp} value={f.totalBusiness} onChange={e=>s("totalBusiness",Number(e.target.value))}/></Field>
        </div>
        <Field label="Address"><input style={inp} value={f.address} onChange={e=>s("address",e.target.value)}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={()=>{setShowClientForm(false);setEditClient(null);}} style={btnS}>Cancel</button>
          <button onClick={()=>saveClient(f)} style={btnP}>💾 Save Client</button>
        </div>
      </Modal>
    );
  };

  const PaymentForm = () => {
    const [f,setF]=useState<Payment>(editPayment||{clientName:"",invoiceNo:"",amount:0,paidAmount:0,dueDate:today(),paymentDate:"",method:"bank_transfer",status:"unpaid",notes:""});
    const s=(k:keyof Payment,v:unknown)=>setF(p=>({...p,[k]:v}));
    return (
      <Modal title={editPayment?"Edit Payment":"Add Payment Record"} onClose={()=>{setShowPaymentForm(false);setEditPayment(null);}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Client Name"><input style={inp} value={f.clientName} onChange={e=>s("clientName",e.target.value)}/></Field>
          <Field label="Invoice No"><input style={inp} value={f.invoiceNo} onChange={e=>s("invoiceNo",e.target.value)}/></Field>
          <Field label="Total Amount (₹)"><input type="number" style={inp} value={f.amount} onChange={e=>s("amount",Number(e.target.value))}/></Field>
          <Field label="Paid Amount (₹)"><input type="number" style={inp} value={f.paidAmount} onChange={e=>s("paidAmount",Number(e.target.value))}/></Field>
          <Field label="Due Date"><input type="date" style={inp} value={f.dueDate} onChange={e=>s("dueDate",e.target.value)}/></Field>
          <Field label="Payment Date"><input type="date" style={inp} value={f.paymentDate} onChange={e=>s("paymentDate",e.target.value)}/></Field>
          <Field label="Method"><select style={selStyle} value={f.method} onChange={e=>s("method",e.target.value)}>{["bank_transfer","upi","cash","cheque","online","card"].map(m=><option key={m} value={m}>{m.replace("_"," ")}</option>)}</select></Field>
          <Field label="Status"><select style={selStyle} value={f.status} onChange={e=>s("status",e.target.value as PaymentStatus)}>{(["unpaid","partial","paid"] as PaymentStatus[]).map(st=><option key={st} value={st}>{st}</option>)}</select></Field>
        </div>
        <Field label="Notes"><textarea style={{...inp,height:60,resize:"vertical"}} value={f.notes} onChange={e=>s("notes",e.target.value)}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={()=>{setShowPaymentForm(false);setEditPayment(null);}} style={btnS}>Cancel</button>
          <button onClick={()=>savePayment(f)} style={btnP}>💾 Save Payment</button>
        </div>
      </Modal>
    );
  };

  const CollabForm = () => {
    const [f,setF]=useState<CollabNote>({from:"sales",to:"finance",subject:"",message:"",priority:"medium",resolved:false});
    const s=(k:keyof CollabNote,v:unknown)=>setF(p=>({...p,[k]:v}));
    return (
      <Modal title="Send Collaboration Note" onClose={()=>setShowCollabForm(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 14px"}}>
          <Field label="From"><select style={selStyle} value={f.from} onChange={e=>s("from",e.target.value)}>{["sales","hr","finance"].map(d=><option key={d} value={d}>{d.toUpperCase()}</option>)}</select></Field>
          <Field label="To"><select style={selStyle} value={f.to} onChange={e=>s("to",e.target.value)}>{["sales","hr","finance","all"].map(d=><option key={d} value={d}>{d.toUpperCase()}</option>)}</select></Field>
          <Field label="Priority"><select style={selStyle} value={f.priority} onChange={e=>s("priority",e.target.value as CollabNote["priority"])}>{["low","medium","high"].map(p=><option key={p} value={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Subject"><input style={inp} value={f.subject} onChange={e=>s("subject",e.target.value)}/></Field>
        <Field label="Message"><textarea style={{...inp,height:100,resize:"vertical"}} value={f.message} onChange={e=>s("message",e.target.value)}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={()=>setShowCollabForm(false)} style={btnS}>Cancel</button>
          <button onClick={()=>saveCollab(f)} style={btnP}>📤 Send Note</button>
        </div>
      </Modal>
    );
  };

  // ── TABS ──────────────────────────────────────────────────────────────────
  const TABS: {id:Tab;label:string;icon:string;count?:number}[] = [
    {id:"overview",      label:"Overview",    icon:"🏠"},
    {id:"sales",         label:"Sales",       icon:"🧾", count:sales.length},
    {id:"leads",         label:"Leads",       icon:"🎯", count:leads.length},
    {id:"clients",       label:"Clients",     icon:"👥", count:clients.length},
    {id:"payments",      label:"Payments",    icon:"💳", count:payments.length},
    {id:"analytics",     label:"Analytics",   icon:"📊"},
    {id:"collaboration", label:"Team Collab", icon:"💬", count:collabNotes.filter(n=>!n.resolved).length},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",color:"#1e293b"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        input:focus,select:focus,textarea:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.1)!important}
        input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:.5}
        select option{background:#fff;color:#1e293b}
      `}</style>

      {/* HEADER */}
      <header style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 28px",position:"sticky",top:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 12px rgba(79,70,229,.3)"}}>💹</div>
          <div>
            <div style={{fontSize:19,fontWeight:900,color:"#0f172a",letterSpacing:"-0.4px"}}>Sales Hub</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:1}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 5px #22c55e"}}/>
              <span style={{fontSize:10,color:"#22c55e",fontWeight:700,letterSpacing:"0.1em"}}>LIVE</span>
              <span style={{fontSize:10,color:"#94a3b8"}}>
                · {empLoading?"Loading employees…":`${employees.length} employees`}
              </span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {[{l:"Revenue",v:fmt(totalRevenue),c:"#4f46e5"},{l:"Profit",v:fmt(netProfit),c:netProfit>=0?"#059669":"#dc2626"}].map(item=>(
            <div key={item.l} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"6px 16px",textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:900,color:item.c}}>{item.v}</div>
              <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.l}</div>
            </div>
          ))}
          <button onClick={exportCSV} style={btnS}>⬇ CSV</button>
          {/* ── NOTIFICATION BELL ── */}
          {user && (
            <NotificationBell
              role="sales"
              uid={user.uid}
              accentColor="#4f46e5"
            />
          )}
        </div>
      </header>

      {/* TABS */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 28px",display:"flex",gap:0,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"13px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?800:600,fontFamily:"'Plus Jakarta Sans',sans-serif",color:tab===t.id?"#4f46e5":"#64748b",borderBottom:tab===t.id?"2.5px solid #4f46e5":"2.5px solid transparent",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,transition:"color 0.15s"}}>
            {t.icon} {t.label}
            {t.count!==undefined&&t.count>0&&(
              <span style={{background:tab===t.id?"#eff6ff":"#f1f5f9",color:tab===t.id?"#4f46e5":"#94a3b8",fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:20}}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* BODY */}
      <main style={{padding:"24px 28px",maxWidth:1600,margin:"0 auto"}}>
        {tab==="overview"      && renderOverview()}
        {tab==="sales"         && renderSales()}
        {tab==="leads"         && renderLeads()}
        {tab==="clients"       && renderClients()}
        {tab==="payments"      && renderPayments()}
        {tab==="analytics"     && renderAnalytics()}
        {tab==="collaboration" && renderCollaboration()}
      </main>

      {showSaleForm    && <SaleForm/>}
      {showLeadForm    && <LeadForm/>}
      {showClientForm  && <ClientForm/>}
      {showPaymentForm && <PaymentForm/>}
      {showCollabForm  && <CollabForm/>}
    </div>
  );
}