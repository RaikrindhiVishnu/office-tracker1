"use client";

/**
 * AdminLeaveRequests.tsx  — HR Dashboard: Leave Management
 *
 * ✅ FIXES vs previous version:
 *   1. On Approve → decrements employee leaveBalance (annual/sick/casual) in employees collection
 *   2. On Approve/Reject → writes to notifications collection so employee sees it instantly
 *   3. Reads leaveBalance from employees collection and shows it in detail panel
 *   4. Uses same leaveRequests + notifications collections the employee dashboard already uses
 *   5. No ApplyLeaveForm import anywhere — employee submits via their own sidebar
 *
 * EMPLOYEE DASHBOARD SINGLE LINE FIX:
 *   Delete line ~1034:  <ApplyLeaveForm />
 *   That's all. The existing LeaveRequestView already handles submission correctly.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar, Clock, CheckCircle, XCircle, Users,
  Palmtree, Stethoscope, Home, TrendingUp,
} from "lucide-react";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, addDoc, serverTimestamp,
  Timestamp, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────

type LeaveType   = "Casual" | "Sick" | "Work From Home" | "Annual";
type LeaveStatus = "Pending" | "Approved" | "Rejected";
type HolidayType = "national" | "optional";

interface LeaveBalance {
  annual: number;
  sick:   number;
  casual: number;
}

interface LeaveRequest {
  id:              string;
  uid?:            string;
  userName?:       string;
  userEmail?:      string;
  department?:     string;
  leaveType?:      string;
  fromDate?:       string;
  toDate?:         string;
  reason?:         string;
  status?:         string;
  createdAt?:      Timestamp | null;
  reviewedAt?:     Timestamp | null;
  notificationRead?: boolean;
}

interface Holiday {
  id:   string;
  date: string;
  name: string;
  type: HolidayType;
}

interface LeaveCfgEntry {
  bg:    string;
  color: string;
  dot:   string;
  Icon:  React.ComponentType<{ size?: number }>;
  balanceKey: "casual" | "sick" | "annual" | null;
}

interface StatusCfgEntry {
  bg:     string;
  color:  string;
  border: string;
  dot:    string;
  label:  string;
}

interface AvatarColor { bg: string; color: string; }

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_CFG: Record<string, LeaveCfgEntry> = {
  "Casual":           { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6", Icon: Palmtree,    balanceKey: "casual"  },
  "Sick":             { bg: "#fff7ed", color: "#c2410c", dot: "#f97316", Icon: Stethoscope, balanceKey: "sick"    },
  "Work From Home":   { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", Icon: Home,        balanceKey: null      },
  "Annual":           { bg: "#fdf4ff", color: "#7e22ce", dot: "#a855f7", Icon: TrendingUp,  balanceKey: "annual"  },
};
const LEAVE_CFG_DEFAULT: LeaveCfgEntry = {
  bg: "#f1f5f9", color: "#475569", dot: "#94a3b8", Icon: Calendar, balanceKey: null,
};

const STATUS_CFG: Record<string, StatusCfgEntry> = {
  Pending:  { bg: "#fffbeb", color: "#92400e", border: "#fcd34d", dot: "#f59e0b", label: "Pending"  },
  Approved: { bg: "#f0fdf4", color: "#14532d", border: "#86efac", dot: "#22c55e", label: "Approved" },
  Rejected: { bg: "#fff1f2", color: "#881337", border: "#fda4af", dot: "#f43f5e", label: "Rejected" },
};
const STATUS_CFG_DEFAULT: StatusCfgEntry = {
  bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", dot: "#94a3b8", label: "Unknown",
};

const AVATAR_COLORS: AvatarColor[] = [
  { bg: "#eff0ff", color: "#6366f1" }, { bg: "#fce7f3", color: "#db2777" },
  { bg: "#d1fae5", color: "#059669" }, { bg: "#fffbeb", color: "#d97706" },
  { bg: "#ede9fe", color: "#7c3aed" }, { bg: "#e0f2fe", color: "#0284c7" },
  { bg: "#fef9c3", color: "#ca8a04" }, { bg: "#fee2e2", color: "#dc2626" },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;
const SHORT_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"] as const;

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function getLeaveCfg(lt: unknown): LeaveCfgEntry {
  if (typeof lt !== "string") return LEAVE_CFG_DEFAULT;
  return LEAVE_CFG[lt] ?? LEAVE_CFG_DEFAULT;
}
function getStatusCfg(s: unknown): StatusCfgEntry {
  if (typeof s !== "string") return STATUS_CFG_DEFAULT;
  return STATUS_CFG[s] ?? STATUS_CFG_DEFAULT;
}
function getAvatarStyle(name?: string | null): AvatarColor {
  return AVATAR_COLORS[((name ?? "").charCodeAt(0) || 65) % AVATAR_COLORS.length];
}
function getInitials(name?: string | null): string {
  return (name ?? "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getDays(from: string, to: string): number {
  if (!from || !to) return 1;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return d >= 0 ? d + 1 : 1;
}
function fmtDate(str: string): string {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date();
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)      return "Just now";
  if (diff < 3_600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400)  return `${Math.floor(diff / 3_600)}h ago`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const { bg, color } = getAvatarStyle(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, border: `1.5px solid ${color}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {getInitials(name) || "?"}
    </div>
  );
}

function Chip({ label, bg, color, border, dot }: {
  label: string; bg: string; color: string; border?: string; dot?: string;
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 20, background: bg, color,
      border: border ? `1px solid ${border}` : "none",
      whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot }} />}
      {label}
    </span>
  );
}

function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, color:"#94a3b8" }}>
      <div style={{ width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#6366f1", borderRadius:"50%", animation:"alr-spin 0.8s linear infinite" }} />
      <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
    </div>
  );
}

// ─── Leave Balance Badge ────────────────────────────────────────────────────────

function LeaveBalanceBadges({ balance }: { balance: LeaveBalance | null }) {
  if (!balance) return null;
  const items = [
    { label: "Annual",  value: balance.annual, color: "#7e22ce", bg: "#fdf4ff" },
    { label: "Casual",  value: balance.casual, color: "#1d4ed8", bg: "#eff6ff" },
    { label: "Sick",    value: balance.sick,   color: "#c2410c", bg: "#fff7ed" },
  ];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
      {items.map(({ label, value, color, bg }) => (
        <div key={label} style={{
          background: bg, color, border: `1px solid ${color}30`,
          borderRadius: 10, padding: "4px 10px", fontSize:11, fontWeight:700,
          display:"flex", alignItems:"center", gap:4,
        }}>
          <span style={{ fontSize:13 }}>
            {label === "Annual" ? "📅" : label === "Casual" ? "🏖" : "🤒"}
          </span>
          {value ?? 0} {label}
        </div>
      ))}
    </div>
  );
}

// ─── Holiday Mini Calendar ─────────────────────────────────────────────────────

function HolidayCalendar({ holidays, leaveRequests }: { holidays: Holiday[]; leaveRequests: LeaveRequest[] }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [selDate, setSelDate] = useState<string | null>(null);
  const today = todayStr();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthHols = useMemo(
    () => holidays.filter(h => h.date.startsWith(monthKey)),
    [holidays, monthKey],
  );
  const holSet = new Set(monthHols.map(h => h.date));

  const leavesPerDate = useMemo<Record<string, LeaveRequest[]>>(() => {
    const map: Record<string, LeaveRequest[]> = {};
    leaveRequests.forEach(l => {
      if ((l.status ?? "") === "Rejected") return;
      const from = new Date((l.fromDate ?? "") + "T00:00:00");
      const to   = new Date((l.toDate   ?? "") + "T00:00:00");
      const cur  = new Date(from);
      while (cur <= to) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
        if (ds.startsWith(monthKey)) { if (!map[ds]) map[ds] = []; map[ds].push(l); }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [leaveRequests, monthKey]);

  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const selLeaves = selDate ? (leavesPerDate[selDate] ?? []) : [];
  const selHols   = selDate ? monthHols.filter(h => h.date === selDate) : [];
  const natCount  = holidays.filter(h => h.date.startsWith(String(year)) && h.type === "national").length;
  const optCount  = holidays.filter(h => h.date.startsWith(String(year)) && h.type === "optional").length;
  const onLeaveThisMonth = useMemo<string[]>(() => {
    const names = new Set<string>();
    Object.values(leavesPerDate).forEach(ls => ls.forEach(l => names.add(l.userName ?? "—")));
    return [...names];
  }, [leavesPerDate]);

  return (
    <div style={{ padding:"20px 24px", flex:1, overflowY:"auto" }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <div style={{ background:"#1e3a5f", color:"#fff", borderRadius:10, padding:"5px 14px", fontSize:12, fontWeight:700 }}>📅 {year}</div>
        <span style={{ background:"#dcfce7", color:"#166534", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>🏖 {natCount} National</span>
        <span style={{ background:"#eff6ff", color:"#1d4ed8", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>✨ {optCount} Optional</span>
        {onLeaveThisMonth.length > 0 && (
          <span style={{ background:"#fdf4ff", color:"#7e22ce", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>👥 {onLeaveThisMonth.length} on leave</span>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Calendar grid */}
        <div style={{ background:"#f8fafc", borderRadius:14, padding:14, border:"1px solid #e2e8f0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <button onClick={prev} className="alr-nav-btn">&#8249;</button>
            <span style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>{MONTH_NAMES[month]} {year}</span>
            <button onClick={next} className="alr-nav-btn">&#8250;</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {SHORT_DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#94a3b8", padding:"2px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMon }, (_, i) => i + 1).map(day => {
              const ds      = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isHol   = holSet.has(ds);
              const isTdy   = ds === today;
              const isSel   = ds === selDate;
              const dow     = new Date(year, month, day).getDay();
              const isWkd   = dow === 0 || dow === 6;
              const leaves  = leavesPerDate[ds] ?? [];
              const hasLeave = leaves.length > 0;
              return (
                <div key={day} onClick={() => (hasLeave || isHol) && setSelDate(isSel ? null : ds)}
                  style={{
                    textAlign:"center", padding:"5px 2px", borderRadius:7, fontSize:11,
                    fontWeight: isHol || isTdy || hasLeave ? 800 : 400,
                    background: isSel ? "#4f46e5" : isTdy ? "#1e3a5f" : isHol ? "#fef9c3" : hasLeave ? "#fdf4ff" : "transparent",
                    color: isSel ? "#fff" : isTdy ? "#fff" : isHol ? "#92400e" : hasLeave ? "#7e22ce" : isWkd ? "#ef4444" : "#334155",
                    cursor: (hasLeave || isHol) ? "pointer" : "default",
                    border: isSel ? "2px solid #4f46e5" : "2px solid transparent",
                    position:"relative", transition:"all 0.12s",
                  }}
                >
                  {day}
                  {hasLeave && !isSel && !isTdy && (
                    <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width: leaves.length > 1 ? "auto" : 5, height:5, borderRadius:4, background:"#a855f7", padding: leaves.length > 1 ? "0 3px" : 0, fontSize:7, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }}>
                      {leaves.length > 1 ? leaves.length : ""}
                    </div>
                  )}
                  {isHol && !isTdy && !isSel && !hasLeave && (
                    <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:"#f59e0b" }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            {([{label:"Today",bg:"#1e3a5f"},{label:"Holiday",bg:"#fef9c3"},{label:"Leave",bg:"#fdf4ff"}] as const).map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                <div style={{ width:11, height:11, borderRadius:3, background:l.bg, border:"1px solid #e2e8f0" }} />
                <span style={{ color:"#64748b", fontWeight:600 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right info panel */}
        <div>
          {selDate ? (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>
                  {new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
                </div>
                <button onClick={() => setSelDate(null)} style={{ border:"none", background:"#f1f5f9", borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", color:"#64748b", fontWeight:600 }}>✕ Close</button>
              </div>
              {selHols.map((h, i) => (
                <div key={i} style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:12, padding:"10px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>🏖</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#92400e" }}>{h.name}</div>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background: h.type === "national" ? "#dcfce7" : "#eff6ff", color: h.type === "national" ? "#166534" : "#1d4ed8" }}>
                      {h.type === "national" ? "National" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
              {selLeaves.length === 0 ? (
                <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:12, background:"#f8fafc", borderRadius:12, border:"1px dashed #e2e8f0" }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>✅</div>No employees on leave
                </div>
              ) : selLeaves.map((leave, i) => {
                const lc = getLeaveCfg(leave.leaveType);
                const sc = getStatusCfg(leave.status);
                return (
                  <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"12px 14px", marginBottom:8, borderLeft:`4px solid ${lc.dot}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar name={leave.userName ?? "—"} size={30} />
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#111827" }}>{leave.userName ?? "—"}</div>
                          <div style={{ fontSize:11, color:"#9ca3af" }}>{leave.userEmail ?? "—"}</div>
                        </div>
                      </div>
                      <Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} />
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                      <Chip label={leave.leaveType ?? "Unknown"} bg={lc.bg} color={lc.color} dot={lc.dot} />
                      <span style={{ background:"#f3f4f6", color:"#374151", borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:500 }}>
                        {leave.fromDate ?? "—"} → {leave.toDate ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                {MONTH_NAMES[month]} Holidays
                {monthHols.length > 0 && <span style={{ background:"#fef9c3", color:"#92400e", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{monthHols.length}</span>}
              </div>
              {monthHols.length === 0 ? (
                <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:12, background:"#f8fafc", borderRadius:12, border:"1px dashed #e2e8f0" }}>
                  <div style={{ fontSize:26, marginBottom:4 }}>🎉</div>No holidays this month
                </div>
              ) : monthHols.map((h, i) => {
                const d    = new Date(h.date + "T00:00:00");
                const past = h.date < today;
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:12, background: past ? "#f8fafc" : "#fffbeb", border:`1px solid ${past ? "#e2e8f0" : "#fcd34d"}`, opacity: past ? 0.6 : 1, marginBottom:6 }}>
                    <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background: past ? "#e2e8f0" : "#1e3a5f", color: past ? "#64748b" : "#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", lineHeight:1.2 }}>
                      <span style={{ fontSize:14, fontWeight:900 }}>{d.getDate()}</span>
                      <span style={{ fontSize:8, fontWeight:600, opacity:0.8 }}>{(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const)[d.getDay()]}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:1 }}>{fmtDate(h.date)}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, flexShrink:0, background: h.type === "national" ? "#dcfce7" : "#eff6ff", color: h.type === "national" ? "#166534" : "#1d4ed8" }}>
                      {h.type === "national" ? "National" : "Optional"}
                    </span>
                  </div>
                );
              })}
              {onLeaveThisMonth.length > 0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#7e22ce", textTransform:"uppercase", letterSpacing:0.6, marginBottom:7 }}>👥 On Leave This Month</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {onLeaveThisMonth.map(name => (
                      <span key={name} style={{ background:"#fdf4ff", border:"1px solid #e9d5ff", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, color:"#7e22ce" }}>{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Month quick-jump */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:16 }}>
        {MONTH_NAMES.map((name, i) => {
          const k   = `${year}-${String(i+1).padStart(2,"0")}`;
          const hc  = holidays.filter(h => h.date.startsWith(k)).length;
          const lc  = leaveRequests.filter(l => (l.status ?? "") !== "Rejected" && ((l.fromDate ?? "").startsWith(k) || (l.toDate ?? "").startsWith(k))).length;
          const sel = i === month;
          return (
            <button key={name} onClick={() => setMonth(i)} style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", position:"relative", background: sel ? "#1e3a5f" : hc > 0 ? "#fef9c3" : "#f1f5f9", color: sel ? "#fff" : hc > 0 ? "#92400e" : "#64748b" }}>
              {name.slice(0, 3)}
              {(hc > 0 || lc > 0) && !sel && (
                <span style={{ position:"absolute", top:-5, right:-5, width:14, height:14, borderRadius:"50%", background: lc > 0 ? "#a855f7" : "#f59e0b", color:"#fff", fontSize:7, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {lc || hc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminLeaveRequests() {
  const [requests,   setRequests]   = useState<LeaveRequest[]>([]);
  const [holidays,   setHolidays]   = useState<Holiday[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [tab,        setTab]        = useState<"requests" | "calendar">("requests");
  const [filter,     setFilter]     = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState<LeaveRequest | null>(null);
  const [confirm,    setConfirm]    = useState<{ id: string; action: LeaveStatus } | null>(null);
  const [updating,   setUpdating]   = useState(false);
  // NEW: show leave balance of selected employee
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);
  const [loadingBalance,  setLoadingBalance]  = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // ── Firestore: leaveRequests listener ─────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
        setRequests(data);
        setLoading(false);
        // keep selected in sync
        setSelected(prev => prev ? data.find(r => r.id === prev.id) ?? prev : null);
      },
      err => { console.error(err); setError("Failed to load leave requests."); setLoading(false); },
    );
    return () => unsub();
  }, []);

  // ── Firestore: holidays listener ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "holidays"),
      snap => setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday))),
      err  => console.error("holidays:", err),
    );
    return () => unsub();
  }, []);

  // ── Load leave balance when selected changes ───────────────────────────────────
  useEffect(() => {
    if (!selected?.uid) { setSelectedBalance(null); return; }
    setLoadingBalance(true);
    // Try employees collection first (has leaveBalance object)
    getDoc(doc(db, "employees", selected.uid))
      .then(snap => {
        if (snap.exists() && snap.data().leaveBalance) {
          setSelectedBalance(snap.data().leaveBalance as LeaveBalance);
        } else {
          // Fallback: try users collection
          return getDoc(doc(db, "users", selected.uid)).then(usnap => {
            if (usnap.exists() && usnap.data().leaveBalance) {
              setSelectedBalance(usnap.data().leaveBalance as LeaveBalance);
            } else {
              setSelectedBalance(null);
            }
          });
        }
      })
      .catch(e => { console.error("leaveBalance fetch:", e); setSelectedBalance(null); })
      .finally(() => setLoadingBalance(false));
  }, [selected?.uid, selected?.id]);

  // ── Core action: update status + decrement balance + send notification ─────────
  const handleUpdateStatus = async (id: string, newStatus: LeaveStatus) => {
    setUpdating(true);
    try {
      const req = requests.find(r => r.id === id);
      if (!req) throw new Error("Request not found");

      // 1. Update the leaveRequest document
      await updateDoc(doc(db, "leaveRequests", id), {
        status:          newStatus,
        reviewedAt:      serverTimestamp(),
        notificationRead: false,   // employee will see notification dot
      });

      // 2. If approved, decrement leaveBalance in employees collection (and users as fallback)
      if (newStatus === "Approved" && req.uid) {
        const lc         = getLeaveCfg(req.leaveType);
        const balanceKey = lc.balanceKey;           // "casual" | "sick" | "annual" | null
        const days       = getDays(req.fromDate ?? "", req.toDate ?? "");

        if (balanceKey) {
          // Try employees collection
          const empRef  = doc(db, "employees", req.uid);
          const empSnap = await getDoc(empRef);

          if (empSnap.exists()) {
            const current = empSnap.data().leaveBalance ?? { annual: 18, sick: 12, casual: 6 };
            const updated = {
              ...current,
              [balanceKey]: Math.max(0, (current[balanceKey] ?? 0) - days),
            };
            await updateDoc(empRef, { leaveBalance: updated });
          } else {
            // Fallback: users collection
            const userRef  = doc(db, "users", req.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const current = userSnap.data().leaveBalance ?? { annual: 18, sick: 12, casual: 6 };
              const updated = {
                ...current,
                [balanceKey]: Math.max(0, (current[balanceKey] ?? 0) - days),
              };
              await updateDoc(userRef, { leaveBalance: updated });
            }
          }
        }
      }

      // 3. Write a notification so employee's bell shows it immediately
      //    This matches the notifications collection the employee dashboard already listens to
      if (req.uid) {
        await addDoc(collection(db, "notifications"), {
          toUid:     req.uid,
          fromName:  "HR Admin",
          fromUid:   "hr_system",
          type:      "leave_update",
          message:   newStatus === "Approved"
            ? `Your ${req.leaveType ?? ""} leave (${req.fromDate} – ${req.toDate}) has been approved ✅`
            : `Your ${req.leaveType ?? ""} leave (${req.fromDate} – ${req.toDate}) has been rejected ❌`,
          chatId:    "",       // not a chat notification
          read:      false,
          timestamp: serverTimestamp(),
        });
      }

    } catch (e) {
      console.error("Update error:", e);
      alert("Failed to update status. Check Firestore permissions.");
    } finally {
      setUpdating(false);
      setConfirm(null);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const total    = requests.length;
  const pending  = requests.filter(r => (r.status ?? "") === "Pending").length;
  const approved = requests.filter(r => (r.status ?? "") === "Approved").length;
  const rejected = requests.filter(r => (r.status ?? "") === "Rejected").length;

  const filtered = requests.filter(r => {
    const matchFilter =
      filter === "all" ||
      (filter === "pending"  && (r.status ?? "") === "Pending")  ||
      (filter === "approved" && (r.status ?? "") === "Approved") ||
      (filter === "rejected" && (r.status ?? "") === "Rejected");
    const matchType   = typeFilter === "all" || r.leaveType === typeFilter;
    const s           = search.toLowerCase();
    const matchSearch = !s ||
      (r.userName   || "").toLowerCase().includes(s) ||
      (r.userEmail  || "").toLowerCase().includes(s) ||
      (r.leaveType  || "").toLowerCase().includes(s) ||
      (r.reason     || "").toLowerCase().includes(s) ||
      (r.department || "").toLowerCase().includes(s);
    return matchFilter && matchType && matchSearch;
  });

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .alr-root { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f6fb; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        @keyframes alr-spin    { to { transform: rotate(360deg); } }
        @keyframes alr-slideIn { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:translateX(0); } }
        @keyframes alr-fadeUp  { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:translateY(0); } }
        .alr-slide  { animation: alr-slideIn 0.2s ease; }
        .alr-fadeup { animation: alr-fadeUp  0.18s ease; }

        .alr-topbar { background:#fff; border-bottom:1px solid #e8ecf3; padding:0 24px; height:54px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
        .alr-logo   { width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:15px; flex-shrink:0; }
        .alr-topbar-title { font-size:15px; font-weight:800; color:#0f172a; letter-spacing:-0.4px; }
        .alr-topbar-sep   { width:1px; height:18px; background:#e2e8f0; }
        .alr-topbar-sub   { font-size:13px; color:#64748b; font-weight:500; }
        .alr-pending-badge { background:#f59e0b; color:#fff; font-size:11px; font-weight:800; padding:2px 9px; border-radius:20px; margin-left:auto; }
        .alr-admin-av { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }

        .alr-tabbar { display:flex; gap:4px; padding:14px 24px 0; flex-shrink:0; }
        .alr-tab    { font-size:12px; font-weight:700; padding:7px 16px; border-radius:9px; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; font-family:inherit; transition:all 0.13s; }
        .alr-tab.on { background:#0f172a; color:#fff; border-color:#0f172a; }
        .alr-tab:not(.on):hover { background:#f1f5f9; }

        .alr-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; padding:14px 24px 0; flex-shrink:0; }
        .alr-stat-card { background:#fff; border:1px solid #e8ecf3; border-radius:14px; padding:18px 20px; display:flex; align-items:center; gap:14px; min-width:0; }
        .alr-stat-icon { width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .alr-stat-val  { font-size:28px; font-weight:700; color:#0f172a; line-height:1; letter-spacing:-1px; }
        .alr-stat-lbl  { font-size:12px; color:#64748b; font-weight:400; margin-top:4px; }

        .alr-main  { display:flex; gap:0; flex:1; min-height:0; margin:14px 24px 24px; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06); border:1px solid #e8ecf3; }

        .alr-left      { width:390px; flex-shrink:0; display:flex; flex-direction:column; background:#fff; border-right:1px solid #f1f5f9; }
        .alr-left-head { padding:14px 14px 10px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
        .alr-search-wrap { position:relative; margin-bottom:10px; }
        .alr-search      { width:100%; padding:8px 12px 8px 34px; border:1.5px solid #e8ecf3; border-radius:10px; font-size:12px; font-family:inherit; font-weight:500; color:#1e293b; background:#f8fafc; outline:none; transition:border-color 0.15s; }
        .alr-search:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 3px rgba(99,102,241,0.09); }
        .alr-search::placeholder { color:#cbd5e1; }
        .alr-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:13px; pointer-events:none; }
        .alr-filter-row  { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .alr-filters     { display:flex; gap:3px; background:#f1f5f9; padding:3px; border-radius:9px; flex:1; }
        .alr-filter-btn  { flex:1; font-size:10px; font-weight:700; padding:5px 6px; border-radius:7px; border:none; cursor:pointer; background:transparent; color:#64748b; font-family:inherit; transition:all 0.13s; white-space:nowrap; }
        .alr-filter-btn.on { background:#0f172a; color:#fff; }
        .alr-filter-btn:not(.on):hover { background:#e2e8f0; color:#334155; }
        .alr-type-sel  { font-size:11px; font-weight:600; padding:5px 8px; border:1.5px solid #e2e8f0; border-radius:8px; background:#fff; color:#475569; cursor:pointer; outline:none; font-family:inherit; }
        .alr-type-sel:focus { border-color:#6366f1; }

        .alr-rlist { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:4px; }
        .alr-rlist::-webkit-scrollbar { width:4px; }
        .alr-rlist::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:6px; }
        .alr-rcard { padding:12px; border-radius:10px; border:1px solid #e8ecf3; cursor:pointer; transition:all 0.13s; position:relative; background:#fff; }
        .alr-rcard:hover  { background:#f8faff; border-color:#dde6f7; }
        .alr-rcard.active { background:#eff0ff; border-color:#a5b4fc; box-shadow:0 0 0 1px #a5b4fc; }
        .alr-rcard-row    { display:flex; gap:10px; align-items:flex-start; }
        .alr-rcard-body   { flex:1; min-width:0; }
        .alr-rcard-nameline { display:flex; align-items:center; justify-content:space-between; margin-bottom:1px; }
        .alr-rcard-name  { font-size:12px; font-weight:700; color:#0f172a; }
        .alr-rcard-time  { font-size:10px; color:#94a3b8; font-weight:500; flex-shrink:0; }
        .alr-rcard-email { font-size:11px; color:#94a3b8; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .alr-rcard-subj  { font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }
        .alr-rcard-reason{ font-size:11px; color:#64748b; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.5; }
        .alr-rcard-chips { display:flex; gap:4px; margin-top:8px; flex-wrap:wrap; }

        .alr-right { flex:1; display:flex; flex-direction:column; background:#fff; min-width:0; }
        .alr-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#94a3b8; }

        .alr-det-head { padding:16px 20px; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
        .alr-det-top  { display:flex; align-items:flex-start; gap:12px; }
        .alr-det-meta { flex:1; min-width:0; }
        .alr-det-name { font-size:15px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; margin-bottom:3px; }
        .alr-det-info { font-size:12px; color:#64748b; }
        .alr-det-chips{ display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; align-items:center; }
        .alr-close-btn{ font-size:12px; font-weight:600; padding:6px 12px; border:1.5px solid #e2e8f0; border-radius:9px; background:transparent; cursor:pointer; color:#64748b; font-family:inherit; flex-shrink:0; transition:all 0.13s; }
        .alr-close-btn:hover { background:#f1f5f9; }

        .alr-det-body { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; }
        .alr-det-body::-webkit-scrollbar { width:4px; }
        .alr-det-body::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:6px; }

        .alr-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .alr-info-box  { background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; padding:14px 16px; }
        .alr-info-lbl  { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }
        .alr-info-val  { font-size:14px; font-weight:700; color:#0f172a; }
        .alr-info-sub  { font-size:11px; color:#64748b; margin-top:2px; }
        .alr-reason-box{ background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; padding:14px 16px; }
        .alr-reason-text{ font-size:13px; color:#334155; line-height:1.75; margin-top:6px; }
        .alr-balance-box { background:linear-gradient(135deg,#f0f4ff,#fdf4ff); border:1px solid #e0e7ff; border-radius:12px; padding:14px 16px; }

        .alr-act-footer { border-top:1px solid #f1f5f9; padding:14px 20px; background:#fafbfc; flex-shrink:0; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .alr-approve-btn { font-size:13px; font-weight:700; padding:9px 22px; background:#16a34a; color:#fff; border:none; border-radius:10px; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px; transition:background 0.13s; }
        .alr-approve-btn:hover { background:#15803d; }
        .alr-reject-btn  { font-size:13px; font-weight:700; padding:9px 22px; background:#dc2626; color:#fff; border:none; border-radius:10px; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px; transition:background 0.13s; }
        .alr-reject-btn:hover  { background:#b91c1c; }
        .alr-act-footer button:disabled { opacity:0.45; cursor:not-allowed; }
        .alr-done-bar  { padding:12px 20px; background:#f0fdf4; border-top:1px solid #bbf7d0; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .alr-done-text { font-size:12px; color:#15803d; font-weight:600; }
        .alr-rejected-bar { padding:12px 20px; background:#fff1f2; border-top:1px solid #fda4af; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .alr-rejected-text{ font-size:12px; color:#881337; font-weight:600; }
        .alr-reopen-btn{ font-size:11px; font-weight:700; padding:6px 13px; border:1.5px solid #e2e8f0; border-radius:8px; background:#f8fafc; cursor:pointer; color:#64748b; font-family:inherit; }
        .alr-reopen-btn:hover { background:#f1f5f9; }

        .alr-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:999; }
        .alr-modal   { background:#fff; border-radius:20px; padding:36px; max-width:360px; width:90%; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.2); }

        .alr-cal-main { flex:1; min-height:0; margin:14px 24px 24px; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06); border:1px solid #e8ecf3; background:#fff; display:flex; flex-direction:column; overflow-y:auto; }
        .alr-nav-btn  { width:30px; height:30px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-size:17px; font-weight:700; color:#334155; display:flex; align-items:center; justify-content:center; }
        .alr-error { flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; color:#ef4444; padding:20px; text-align:center; }
      `}</style>

      <div className="alr-root">

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div className="alr-topbar">
          <div className="alr-logo"><Calendar size={16} /></div>
          <span className="alr-topbar-title">Leave Requests</span>
          <div className="alr-topbar-sep" />
          <span className="alr-topbar-sub">HR Console</span>
          {pending > 0 && <div className="alr-pending-badge">{pending} pending</div>}
          <div className="alr-admin-av" style={{ marginLeft: pending > 0 ? 0 : "auto" }}>HR</div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="alr-tabbar">
          {([
            { key: "requests", label: "📋 Leave Requests"   },
            { key: "calendar", label: "🗓 Holiday Calendar" },
          ] as const).map(({ key, label }) => (
            <button key={key} className={`alr-tab${tab === key ? " on" : ""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="alr-stats">
          {([
            { icon: <Users       size={22} color="#534ab7" />, bg:"#eeedfe", label:"Total Requests", value:total    },
            { icon: <Clock       size={22} color="#854f0b" />, bg:"#faeeda", label:"Pending",         value:pending  },
            { icon: <CheckCircle size={22} color="#3b6d11" />, bg:"#eaf3de", label:"Approved",        value:approved },
            { icon: <XCircle     size={22} color="#be123c" />, bg:"#ffe4e6", label:"Rejected",        value:rejected },
          ] as const).map(({ icon, bg, label, value }) => (
            <div className="alr-stat-card" key={label}>
              <div className="alr-stat-icon" style={{ background:bg }}>{icon}</div>
              <div><div className="alr-stat-val">{value}</div><div className="alr-stat-lbl">{label}</div></div>
            </div>
          ))}
        </div>

        {/* ── REQUESTS TAB ────────────────────────────────────────────────── */}
        {tab === "requests" && (
          <div className="alr-main">

            {/* Left: request list */}
            <div className="alr-left">
              <div className="alr-left-head">
                <div className="alr-search-wrap">
                  <span className="alr-search-icon">🔍</span>
                  <input className="alr-search" placeholder="Search name, type, reason…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="alr-filter-row">
                  <div className="alr-filters">
                    {([
                      ["all",      `All (${total})`],
                      ["pending",  `⏳ ${pending}`],
                      ["approved", `✅ ${approved}`],
                      ["rejected", `❌ ${rejected}`],
                    ] as const).map(([f, label]) => (
                      <button key={f} className={`alr-filter-btn${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{label}</button>
                    ))}
                  </div>
                  <select className="alr-type-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="Casual">Casual</option>
                    <option value="Sick">Sick</option>
                    <option value="Annual">Annual</option>
                    <option value="Work From Home">WFH</option>
                  </select>
                </div>
              </div>

              <div className="alr-rlist">
                {loading ? (
                  <LoadingSpinner label="Loading requests…" />
                ) : error ? (
                  <div className="alr-error"><span style={{ fontSize:28 }}>⚠️</span><div style={{ fontSize:13, fontWeight:600 }}>{error}</div></div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"50px 16px", color:"#94a3b8" }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#475569", marginBottom:4 }}>No requests found</div>
                    <div style={{ fontSize:12 }}>{search ? "Try a different search" : "Nothing here yet"}</div>
                  </div>
                ) : filtered.map(req => {
                  const lc    = getLeaveCfg(req.leaveType);
                  const sc    = getStatusCfg(req.status);
                  const days  = getDays(req.fromDate ?? "", req.toDate ?? "");
                  const isAct = selected?.id === req.id;
                  const isPend = (req.status ?? "") === "Pending";
                  return (
                    <div key={req.id}
                      className={`alr-rcard${isAct ? " active" : ""}`}
                      style={{ borderLeft: isPend ? "3px solid #f59e0b" : "3px solid transparent" }}
                      onClick={() => setSelected(req)}
                    >
                      <div className="alr-rcard-row">
                        <Avatar name={req.userName} size={34} />
                        <div className="alr-rcard-body">
                          <div className="alr-rcard-nameline">
                            <span className="alr-rcard-name">{req.userName || "Unknown"}</span>
                            <span className="alr-rcard-time">{timeAgo(req.createdAt)}</span>
                          </div>
                          <div className="alr-rcard-email">{req.userEmail ?? "—"}{req.department ? ` · ${req.department}` : ""}</div>
                          <div className="alr-rcard-subj">{req.leaveType ?? "Unknown"} Leave — {days} {days === 1 ? "day" : "days"}</div>
                          <div className="alr-rcard-reason">{req.reason || "No reason provided."}</div>
                          <div className="alr-rcard-chips">
                            <Chip label={req.leaveType ?? "Unknown"} bg={lc.bg} color={lc.color} dot={lc.dot} />
                            <Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} />
                            <span style={{ fontSize:10, color:"#94a3b8", fontWeight:500, alignSelf:"center" }}>
                              📅 {fmtDate(req.fromDate ?? "")} → {fmtDate(req.toDate ?? "")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: detail panel */}
            <div className="alr-right">
              {!selected ? (
                <div className="alr-empty">
                  <div style={{ fontSize:44 }}>📋</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#475569" }}>Select a request</div>
                  <div style={{ fontSize:13 }}>Click any request on the left to review it</div>
                </div>
              ) : (
                <div className="alr-slide" style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
                  {/* Header */}
                  <div className="alr-det-head">
                    <div className="alr-det-top">
                      <Avatar name={selected.userName} size={46} />
                      <div className="alr-det-meta">
                        <div className="alr-det-name">{selected.userName}</div>
                        <div className="alr-det-info">{selected.userEmail ?? "—"}{selected.department ? ` · ${selected.department}` : ""}</div>
                        <div className="alr-det-chips">
                          {(() => {
                            const lc = getLeaveCfg(selected.leaveType);
                            const sc = getStatusCfg(selected.status);
                            return (
                              <>
                                <Chip label={selected.leaveType ?? "—"} bg={lc.bg} color={lc.color} dot={lc.dot} />
                                <Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} />
                                <span style={{ fontSize:11, color:"#94a3b8", fontWeight:500 }}>🕐 {timeAgo(selected.createdAt)}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <button className="alr-close-btn" onClick={() => setSelected(null)}>✕ Close</button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="alr-det-body" ref={detailRef}>
                    {/* Info grid */}
                    <div className="alr-info-grid">
                      <div className="alr-info-box">
                        <div className="alr-info-lbl">📅 From Date</div>
                        <div className="alr-info-val">{fmtDate(selected.fromDate ?? "")}</div>
                        <div className="alr-info-sub">{selected.fromDate ?? "—"}</div>
                      </div>
                      <div className="alr-info-box">
                        <div className="alr-info-lbl">📅 To Date</div>
                        <div className="alr-info-val">{fmtDate(selected.toDate ?? "")}</div>
                        <div className="alr-info-sub">{selected.toDate ?? "—"}</div>
                      </div>
                      <div className="alr-info-box">
                        <div className="alr-info-lbl">⏱ Duration</div>
                        <div className="alr-info-val">{getDays(selected.fromDate ?? "", selected.toDate ?? "")} Days</div>
                        <div className="alr-info-sub">{selected.leaveType ?? "—"}</div>
                      </div>
                      <div className="alr-info-box">
                        <div className="alr-info-lbl">📌 Department</div>
                        <div className="alr-info-val" style={{ fontSize:13 }}>{selected.department || "—"}</div>
                        <div className="alr-info-sub">{selected.userEmail}</div>
                      </div>
                    </div>

                    {/* Leave balance — NEW ✅ */}
                    <div className="alr-balance-box">
                      <div className="alr-info-lbl">🏦 Employee Leave Balance</div>
                      {loadingBalance ? (
                        <div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>Loading balance…</div>
                      ) : selectedBalance ? (
                        <LeaveBalanceBadges balance={selectedBalance} />
                      ) : (
                        <div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>
                          Balance not found — make sure employee document exists in Firestore with a <code>leaveBalance</code> field.
                        </div>
                      )}
                      {selectedBalance && getLeaveCfg(selected.leaveType).balanceKey && (
                        <div style={{ fontSize:11, color:"#64748b", marginTop:8, padding:"6px 10px", background:"#fff", borderRadius:8, border:"1px solid #e2e8f0" }}>
                          ℹ️ Approving this will deduct <strong>{getDays(selected.fromDate ?? "", selected.toDate ?? "")} day(s)</strong> from the employee&apos;s <strong>{selected.leaveType}</strong> balance automatically.
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div className="alr-reason-box">
                      <div className="alr-info-lbl">📝 Reason for Leave</div>
                      <div className="alr-reason-text">{selected.reason || "No reason provided."}</div>
                    </div>

                    {/* Reviewed timestamp */}
                    {selected.reviewedAt && (
                      <div style={{ background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:12, padding:"12px 16px" }}>
                        <div className="alr-info-lbl">🔖 Last Reviewed</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#475569", marginTop:4 }}>{timeAgo(selected.reviewedAt)}</div>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  {(selected.status ?? "") === "Approved" ? (
                    <div className="alr-done-bar">
                      <span className="alr-done-text">✓ Approved — balance already decremented</span>
                      <button className="alr-reopen-btn" onClick={() => handleUpdateStatus(selected.id, "Pending")}>Reopen</button>
                    </div>
                  ) : (selected.status ?? "") === "Rejected" ? (
                    <div className="alr-rejected-bar">
                      <span className="alr-rejected-text">✗ This request was rejected</span>
                      <button className="alr-reopen-btn" onClick={() => handleUpdateStatus(selected.id, "Pending")}>Reopen</button>
                    </div>
                  ) : (
                    <div className="alr-act-footer">
                      <button className="alr-approve-btn" disabled={updating} onClick={() => setConfirm({ id: selected.id, action: "Approved" })}>
                        {updating ? "…" : "✓ Approve"}
                      </button>
                      <button className="alr-reject-btn" disabled={updating} onClick={() => setConfirm({ id: selected.id, action: "Rejected" })}>
                        {updating ? "…" : "✗ Reject"}
                      </button>
                      <span style={{ fontSize:12, color:"#94a3b8", marginLeft:4 }}>
                        {getDays(selected.fromDate ?? "", selected.toDate ?? "")}-day {selected.leaveType ?? "Unknown"} leave request
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CALENDAR TAB ────────────────────────────────────────────────── */}
        {tab === "calendar" && (
          <div className="alr-cal-main">
            <HolidayCalendar holidays={holidays} leaveRequests={requests} />
          </div>
        )}

        {/* ── CONFIRM MODAL ─────────────────────────────────────────────── */}
        {confirm && (
          <div className="alr-overlay">
            <div className="alr-modal">
              <div style={{ fontSize:48, marginBottom:12 }}>{confirm.action === "Approved" ? "✅" : "❌"}</div>
              <div style={{ fontSize:20, fontWeight:800, color:"#111827", marginBottom:8 }}>
                {confirm.action === "Approved" ? "Approve Leave?" : "Reject Leave?"}
              </div>
              <div style={{ fontSize:13, color:"#6b7280", marginBottom:24 }}>
                {confirm.action === "Approved"
                  ? "This will approve the request, deduct leave days from their balance, and notify the employee instantly."
                  : "This will reject the request and notify the employee instantly."}
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => setConfirm(null)} style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateStatus(confirm.id, confirm.action)}
                  disabled={updating}
                  style={{ background: confirm.action === "Approved" ? "#16a34a" : "#dc2626", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity: updating ? 0.5 : 1 }}
                >
                  {updating ? "Updating…" : `Confirm ${confirm.action}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}