"use client";

/**
 * AdminLeaveRequests.tsx — HR Dashboard: Leave Management
 * UI: Zoho-style clean table + right drawer
 * Logic: 100% preserved from original
 *   - Approve/Reject updates leaveRequests collection
 *   - Deducts leaveBalances (casual/sick/annual/lop/wfh)
 *   - Keeps employees + users collections in sync
 *   - Sends notification to employee on approve/reject
 *   - Holiday calendar tab preserved
 *   - Real-time onSnapshot throughout
 *   - DELETE option added (row + drawer)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar, Clock, CheckCircle, XCircle, Users,
  Palmtree, Stethoscope, Home, TrendingUp, Trash2,
} from "lucide-react";
import {
  collection, query, where, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc, addDoc, getDocs, serverTimestamp,
  Timestamp, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────

type LeaveType   = "Casual" | "Sick" | "Work From Home" | "Annual";
type LeaveStatus = "Pending" | "Approved" | "Rejected";
type HolidayType = "national" | "optional";

interface LeaveBalance { annual: number; sick: number; casual: number; }

interface LeaveRequest {
  id: string;
  uid?: string;
  userName?: string;
  userEmail?: string;
  department?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  reason?: string;
  status?: string;
  createdAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  notificationRead?: boolean;
}

interface Holiday { id: string; date: string; name: string; type: HolidayType; }

interface LeaveCfgEntry {
  bg: string; color: string; dot: string;
  Icon: React.ComponentType<{ size?: number }>;
  balanceKey: "casual" | "sick" | "annual" | null;
}
interface StatusCfgEntry { bg: string; color: string; border: string; dot: string; label: string; }

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_CFG: Record<string, LeaveCfgEntry> = {
  "Casual":         { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6", Icon: Palmtree,    balanceKey: "casual"  },
  "Sick":           { bg: "#fff7ed", color: "#c2410c", dot: "#f97316", Icon: Stethoscope, balanceKey: "sick"    },
  "Work From Home": { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", Icon: Home,        balanceKey: null      },
  "Annual":         { bg: "#fdf4ff", color: "#7e22ce", dot: "#a855f7", Icon: TrendingUp,  balanceKey: "annual"  },
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
const AVATAR_COLORS = [
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

const getLeaveCfg  = (lt: unknown): LeaveCfgEntry  => typeof lt === "string" ? (LEAVE_CFG[lt]  ?? LEAVE_CFG_DEFAULT)  : LEAVE_CFG_DEFAULT;
const getStatusCfg = (s:  unknown): StatusCfgEntry => typeof s  === "string" ? (STATUS_CFG[s]  ?? STATUS_CFG_DEFAULT) : STATUS_CFG_DEFAULT;
const getAvatarStyle = (name?: string | null) => AVATAR_COLORS[((name ?? "").charCodeAt(0) || 65) % AVATAR_COLORS.length];
const getInitials    = (name?: string | null) => (name ?? "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getDays(from: string, to: string) {
  if (!from || !to) return 1;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return d >= 0 ? d + 1 : 1;
}
function fmtDate(str: string) {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  const d    = ts?.seconds ? new Date(ts.seconds * 1000) : new Date();
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)      return "Just now";
  if (diff < 3_600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400)  return `${Math.floor(diff / 3_600)}h ago`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Shared Sub-components ─────────────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  const { bg, color } = getAvatarStyle(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 600, flexShrink: 0,
      border: `1px solid ${color}25`,
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
      fontSize: 11, fontWeight: 500, padding: "3px 9px",
      borderRadius: 20, background: bg, color,
      border: border ? `1px solid ${border}` : "none",
      whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function LeaveBalanceBadges({ balance }: { balance: LeaveBalance | null }) {
  if (!balance) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {[
        { label: "Annual", value: balance.annual, color: "#7e22ce", bg: "#fdf4ff" },
        { label: "Casual", value: balance.casual, color: "#1d4ed8", bg: "#eff6ff" },
        { label: "Sick",   value: balance.sick,   color: "#c2410c", bg: "#fff7ed" },
      ].map(({ label, value, color, bg }) => (
        <div key={label} style={{
          background: bg, color, border: `1px solid ${color}25`,
          borderRadius: 10, padding: "4px 10px", fontSize: 11, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {label === "Annual" ? "📅" : label === "Casual" ? "🏖" : "🤒"} {value ?? 0} {label}
        </div>
      ))}
    </div>
  );
}

// ─── Holiday Calendar ─────────────────────────────────────────────────────────

function HolidayCalendar({ holidays, leaveRequests }: { holidays: Holiday[]; leaveRequests: LeaveRequest[] }) {
  const now  = new Date();
  const [month,   setMonth]   = useState(now.getMonth());
  const [year,    setYear]    = useState(now.getFullYear());
  const [selDate, setSelDate] = useState<string | null>(null);
  const today    = todayStr();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y+1); } else setMonth(m => m+1); };

  const monthHols = useMemo(() => holidays.filter(h => h.date.startsWith(monthKey)), [holidays, monthKey]);
  const holSet    = new Set(monthHols.map(h => h.date));

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
    <div style={{ padding: "20px 24px", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{MONTH_NAMES[month]} {year}</span>
        <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>{natCount} National</span>
        <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>{optCount} Optional</span>
        {onLeaveThisMonth.length > 0 && (
          <span style={{ background: "#fdf4ff", color: "#7e22ce", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
            {onLeaveThisMonth.length} on leave
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={prev} style={navBtnStyle}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{MONTH_NAMES[month]} {year}</span>
            <button onClick={next} style={navBtnStyle}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
            {SHORT_DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#94a3b8", padding: "2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMon }, (_, i) => i + 1).map(day => {
              const ds       = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isHol    = holSet.has(ds);
              const isTdy    = ds === today;
              const isSel    = ds === selDate;
              const dow      = new Date(year, month, day).getDay();
              const isWkd    = dow === 0 || dow === 6;
              const leaves   = leavesPerDate[ds] ?? [];
              const hasLeave = leaves.length > 0;
              return (
                <div key={day}
                  onClick={() => (hasLeave || isHol) && setSelDate(isSel ? null : ds)}
                  style={{
                    textAlign: "center", padding: "5px 2px", borderRadius: 6, fontSize: 11,
                    fontWeight: isHol || isTdy || hasLeave ? 600 : 400,
                    background: isSel ? "#4f46e5" : isTdy ? "#1e3a5f" : isHol ? "#fef9c3" : hasLeave ? "#fdf4ff" : "transparent",
                    color: isSel ? "#fff" : isTdy ? "#fff" : isHol ? "#92400e" : hasLeave ? "#7e22ce" : isWkd ? "#ef4444" : "#334155",
                    cursor: (hasLeave || isHol) ? "pointer" : "default",
                    border: isSel ? "1.5px solid #4f46e5" : "1.5px solid transparent",
                    position: "relative", transition: "all 0.1s",
                  }}
                >
                  {day}
                  {hasLeave && !isSel && !isTdy && (
                    <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#a855f7" }} />
                  )}
                  {isHol && !isTdy && !isSel && !hasLeave && (
                    <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#f59e0b" }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {[{ label: "Today", bg: "#1e3a5f" }, { label: "Holiday", bg: "#fef9c3" }, { label: "Leave", bg: "#fdf4ff" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: "1px solid #e2e8f0" }} />
                <span style={{ color: "#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selDate ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  {new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <button onClick={() => setSelDate(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#64748b" }}>✕ Close</button>
              </div>
              {selHols.map((h, i) => (
                <div key={i} style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>{h.name}</div>
                    <Chip label={h.type === "national" ? "National" : "Optional"} bg={h.type === "national" ? "#dcfce7" : "#eff6ff"} color={h.type === "national" ? "#166534" : "#1d4ed8"} />
                  </div>
                </div>
              ))}
              {selLeaves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 12, background: "#f8fafc", borderRadius: 10, border: "1px dashed #e2e8f0" }}>No employees on leave</div>
              ) : selLeaves.map((leave, i) => {
                const lc = getLeaveCfg(leave.leaveType);
                const sc = getStatusCfg(leave.status);
                return (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `3px solid ${lc.dot}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={leave.userName} size={28} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{leave.userName ?? "—"}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{leave.userEmail ?? "—"}</div>
                        </div>
                      </div>
                      <Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} />
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <Chip label={leave.leaveType ?? "Unknown"} bg={lc.bg} color={lc.color} dot={lc.dot} />
                      <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "2px 8px", fontSize: 10 }}>
                        {leave.fromDate ?? "—"} → {leave.toDate ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
                {MONTH_NAMES[month]} Holidays
                {monthHols.length > 0 && (
                  <span style={{ marginLeft: 8, background: "#fef9c3", color: "#92400e", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{monthHols.length}</span>
                )}
              </div>
              {monthHols.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 12, background: "#f8fafc", borderRadius: 10, border: "1px dashed #e2e8f0" }}>No holidays this month</div>
              ) : monthHols.map((h, i) => {
                const d    = new Date(h.date + "T00:00:00");
                const past = h.date < today;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: past ? "#f8fafc" : "#fffbeb", border: `1px solid ${past ? "#e2e8f0" : "#fcd34d"}`, opacity: past ? 0.6 : 1, marginBottom: 6 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, background: past ? "#e2e8f0" : "#1e3a5f", color: past ? "#64748b" : "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d.getDate()}</span>
                      <span style={{ fontSize: 8, opacity: 0.8 }}>{(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const)[d.getDay()]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{fmtDate(h.date)}</div>
                    </div>
                    <Chip label={h.type === "national" ? "National" : "Optional"} bg={h.type === "national" ? "#dcfce7" : "#eff6ff"} color={h.type === "national" ? "#166534" : "#1d4ed8"} />
                  </div>
                );
              })}
              {onLeaveThisMonth.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7e22ce", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>On Leave This Month</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {onLeaveThisMonth.map(name => (
                      <span key={name} style={{ background: "#fdf4ff", border: "1px solid #e9d5ff", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#7e22ce" }}>{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 16 }}>
        {MONTH_NAMES.map((name, i) => {
          const k   = `${year}-${String(i+1).padStart(2,"0")}`;
          const hc  = holidays.filter(h => h.date.startsWith(k)).length;
          const lc  = leaveRequests.filter(l => (l.status ?? "") !== "Rejected" && ((l.fromDate ?? "").startsWith(k) || (l.toDate ?? "").startsWith(k))).length;
          const sel = i === month;
          return (
            <button key={name} onClick={() => setMonth(i)} style={{
              padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500, border: "none",
              cursor: "pointer", position: "relative",
              background: sel ? "#1e3a5f" : hc > 0 ? "#fef9c3" : "#f1f5f9",
              color: sel ? "#fff" : hc > 0 ? "#92400e" : "#64748b",
            }}>
              {name.slice(0, 3)}
              {(hc > 0 || lc > 0) && !sel && (
                <span style={{ position: "absolute", top: -5, right: -5, width: 14, height: 14, borderRadius: "50%", background: lc > 0 ? "#a855f7" : "#f59e0b", color: "#fff", fontSize: 7, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

const navBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e8f0",
  background: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600,
  color: "#334155", display: "flex", alignItems: "center", justifyContent: "center",
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminLeaveRequests() {
  const [requests,        setRequests]        = useState<LeaveRequest[]>([]);
  const [holidays,        setHolidays]        = useState<Holiday[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [tab,             setTab]             = useState<"requests" | "calendar">("requests");
  const [statusFilter,    setStatusFilter]    = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [typeFilter,      setTypeFilter]      = useState<"all" | string>("all");
  const [monthFilter,     setMonthFilter]     = useState<"all" | string>("all");
  const [search,          setSearch]          = useState("");
  const [selected,        setSelected]        = useState<LeaveRequest | null>(null);
  const [confirm,         setConfirm]         = useState<{ id: string; action: LeaveStatus } | null>(null);
  const [deleteConfirm,   setDeleteConfirm]   = useState<string | null>(null); // id of row pending delete
  const [updating,        setUpdating]        = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);
  const [loadingBalance,  setLoadingBalance]  = useState(false);
  const [page,            setPage]            = useState(0);
  const [perPage,         setPerPage]         = useState(10);

  // ── Firestore: leaveRequests ────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
        setRequests(data);
        setLoading(false);
        setSelected(prev => prev ? data.find(r => r.id === prev.id) ?? prev : null);
      },
      err => { console.error(err); setError("Failed to load leave requests."); setLoading(false); },
    );
    return () => unsub();
  }, []);

  // ── Firestore: holidays ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "holidays"),
      snap => setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday))),
      err  => console.error("holidays:", err),
    );
    return () => unsub();
  }, []);

  // ── Load leave balance when drawer opens ────────────────────────────────────
  useEffect(() => {
    if (!selected?.uid) { setSelectedBalance(null); return; }
    setLoadingBalance(true);
    const uid = selected.uid as string;
    getDoc(doc(db, "employees", uid))
      .then(snap => {
        if (snap.exists() && snap.data().leaveBalance) {
          setSelectedBalance(snap.data().leaveBalance as LeaveBalance);
        } else {
          return getDoc(doc(db, "users", uid)).then(usnap => {
            setSelectedBalance(usnap.exists() && usnap.data().leaveBalance ? usnap.data().leaveBalance as LeaveBalance : null);
          });
        }
      })
      .catch(() => setSelectedBalance(null))
      .finally(() => setLoadingBalance(false));
  }, [selected?.uid, selected?.id]);

  // ── Core action: approve/reject + deduct balance + notify ──────────────────
  const handleUpdateStatus = async (id: string, newStatus: LeaveStatus) => {
    setUpdating(true);
    try {
      const req = requests.find(r => r.id === id);
      if (!req) throw new Error("Request not found");

      await updateDoc(doc(db, "leaveRequests", id), {
        status: newStatus, reviewedAt: serverTimestamp(), notificationRead: false,
      });

      if (newStatus === "Approved" && req.uid) {
        const lc         = getLeaveCfg(req.leaveType);
        const balanceKey = lc.balanceKey;
        const days       = getDays(req.fromDate ?? "", req.toDate ?? "");
        const leaveBalSnap = await getDocs(query(collection(db, "leaveBalances"), where("uid", "==", req.uid)));

        if (balanceKey === "casual" || balanceKey === "sick") {
          if (!leaveBalSnap.empty) {
            const balDoc      = leaveBalSnap.docs[0];
            const balData     = balDoc.data();
            const currentUsed = balData?.[balanceKey]?.used  ?? 0;
            const quota       = balData?.[balanceKey]?.quota ?? 12;
            await updateDoc(doc(db, "leaveBalances", balDoc.id), {
              [`${balanceKey}.used`]:  Math.min(currentUsed + days, quota),
              [`${balanceKey}.quota`]: quota,
            });
          } else {
            await addDoc(collection(db, "leaveBalances"), {
              uid:    req.uid,
              sick:   { quota: 12, used: balanceKey === "sick"   ? Math.min(days, 12) : 0 },
              casual: { quota: 12, used: balanceKey === "casual" ? Math.min(days, 12) : 0 },
              lop:    { used: 0 },
              wfh:    { used: 0 },
            });
          }
        }

        const leaveKeyLower = req.leaveType?.toLowerCase();
        if (leaveKeyLower === "lop" || leaveKeyLower === "wfh") {
          if (!leaveBalSnap.empty) {
            const balDoc      = leaveBalSnap.docs[0];
            const currentUsed = balDoc.data()?.[leaveKeyLower]?.used ?? 0;
            await updateDoc(doc(db, "leaveBalances", balDoc.id), { [`${leaveKeyLower}.used`]: currentUsed + days });
          } else {
            await addDoc(collection(db, "leaveBalances"), {
              uid:    req.uid,
              sick:   { quota: 12, used: 0 },
              casual: { quota: 12, used: 0 },
              lop:    { used: leaveKeyLower === "lop" ? days : 0 },
              wfh:    { used: leaveKeyLower === "wfh" ? days : 0 },
            });
          }
        }

        if (balanceKey) {
          const empRef  = doc(db, "employees", req.uid);
          const empSnap = await getDoc(empRef);
          if (empSnap.exists()) {
            const current = empSnap.data().leaveBalance ?? { annual: 18, sick: 12, casual: 6 };
            await updateDoc(empRef, { leaveBalance: { ...current, [balanceKey]: Math.max(0, (current[balanceKey] ?? 0) - days) } });
          } else {
            const userRef  = doc(db, "users", req.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const current = userSnap.data().leaveBalance ?? { annual: 18, sick: 12, casual: 6 };
              await updateDoc(userRef, { leaveBalance: { ...current, [balanceKey]: Math.max(0, (current[balanceKey] ?? 0) - days) } });
            }
          }
        }
      }

      if (req.uid) {
        await addDoc(collection(db, "notifications"), {
          toUid:     req.uid,
          fromName:  "HR Admin",
          fromUid:   "hr_system",
          type:      "leave_update",
          message:   newStatus === "Approved"
            ? `Your ${req.leaveType ?? ""} leave (${req.fromDate} – ${req.toDate}) has been approved ✅`
            : `Your ${req.leaveType ?? ""} leave (${req.fromDate} – ${req.toDate}) has been rejected ❌`,
          chatId:    "",
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

  // ── Delete action ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "leaveRequests", id));
      if (selected?.id === id) setSelected(null);
      setDeleteConfirm(null);
    } catch (e) {
      console.error("Delete error:", e);
      alert("Failed to delete request. Check Firestore permissions.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total    = requests.length;
  const pending  = requests.filter(r => (r.status ?? "") === "Pending").length;
  const approved = requests.filter(r => (r.status ?? "") === "Approved").length;
  const rejected = requests.filter(r => (r.status ?? "") === "Rejected").length;

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => { if (r.fromDate) set.add(r.fromDate.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter === "pending"  && (r.status ?? "") !== "Pending")  return false;
      if (statusFilter === "approved" && (r.status ?? "") !== "Approved") return false;
      if (statusFilter === "rejected" && (r.status ?? "") !== "Rejected") return false;
      if (typeFilter !== "all" && r.leaveType !== typeFilter)              return false;
      if (monthFilter !== "all" && !(r.fromDate ?? "").startsWith(monthFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (r.userName   || "").toLowerCase().includes(s) ||
          (r.userEmail  || "").toLowerCase().includes(s) ||
          (r.leaveType  || "").toLowerCase().includes(s) ||
          (r.reason     || "").toLowerCase().includes(s) ||
          (r.department || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, monthFilter, search]);

  const totalPages  = Math.ceil(filtered.length / perPage) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows    = filtered.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const closeDrawer = () => { setSelected(null); setDeleteConfirm(null); };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        .lm-root * { box-sizing: border-box; }
        .lm-root {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #f4f6fb;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        @keyframes lm-spin { to { transform: rotate(360deg); } }
        @keyframes lm-drawer-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .lm-tabs { display: flex; gap: 2px; padding: 10px 20px 0; background: #fff; border-bottom: 1px solid #e8ecf3; flex-shrink: 0; }
        .lm-tab  { font-size: 12px; font-weight: 500; padding: 7px 16px; border-radius: 8px 8px 0 0; border: 1px solid transparent; background: transparent; color: #64748b; cursor: pointer; font-family: inherit; transition: all 0.12s; }
        .lm-tab.on { background: #f4f6fb; color: #0f172a; border-color: #e8ecf3; border-bottom-color: #f4f6fb; }

        .lm-filterbar {
          background: #fff; border-bottom: 1px solid #e8ecf3;
          padding: 10px 20px; display: flex; gap: 8px;
          align-items: center; flex-wrap: wrap; flex-shrink: 0;
        }
        .lm-search {
          padding: 7px 10px 7px 30px; border: 1px solid #e2e8f0;
          border-radius: 8px; font-size: 12px; color: #1e293b;
          background: #f8fafc; outline: none; font-family: inherit; width: 200px;
        }
        .lm-search:focus { border-color: #4f46e5; background: #fff; }
        .lm-search-wrap { position: relative; }
        .lm-search-ic   { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #94a3b8; pointer-events: none; }
        .lm-sel {
          padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
          font-size: 12px; color: #475569; background: #fff;
          cursor: pointer; outline: none; font-family: inherit;
        }
        .lm-sel:focus { border-color: #4f46e5; }
        .lm-status-pills { display: flex; gap: 3px; background: #f1f5f9; padding: 3px; border-radius: 8px; }
        .lm-spill {
          font-size: 11px; font-weight: 500; padding: 5px 10px; border-radius: 6px;
          border: none; cursor: pointer; background: transparent; color: #64748b;
          font-family: inherit; transition: all 0.12s; white-space: nowrap;
        }
        .lm-spill.on   { background: #0f172a; color: #fff; }
        .lm-spill:not(.on):hover { background: #e2e8f0; }

        .lm-table-wrap { flex: 1; overflow: auto; background: #fff; }
        .lm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .lm-table thead th {
          position: sticky; top: 0; z-index: 1;
          background: #f8fafc; padding: 10px 14px;
          text-align: left; font-size: 11px; font-weight: 500;
          color: #64748b; border-bottom: 1px solid #e8ecf3;
          white-space: nowrap;
        }
        .lm-table tbody tr { border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.1s; }
        .lm-table tbody tr:hover { background: #f8faff; }
        .lm-table tbody tr:hover .lm-row-del { opacity: 1; }
        .lm-table tbody tr.selected { background: #eff0ff; }
        .lm-table td { padding: 10px 14px; color: #1e293b; }

        .lm-approve-inline {
          font-size: 11px; font-weight: 500; padding: 5px 12px;
          background: #f0fdf4; color: #15803d; border: 1px solid #86efac;
          border-radius: 7px; cursor: pointer; font-family: inherit;
        }
        .lm-approve-inline:hover { background: #dcfce7; }
        .lm-reject-inline {
          font-size: 11px; font-weight: 500; padding: 5px 12px;
          background: #fff1f2; color: #be123c; border: 1px solid #fda4af;
          border-radius: 7px; cursor: pointer; font-family: inherit;
        }
        .lm-reject-inline:hover { background: #ffe4e6; }

        /* Delete button in row — hidden until row hover */
        .lm-row-del {
          width: 26px; height: 26px; border-radius: 6px;
          border: 1px solid transparent; background: transparent;
          cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          color: #cbd5e0; transition: all 0.13s;
          opacity: 0;
          flex-shrink: 0;
        }
        .lm-row-del:hover { color: #e53e3e; border-color: #fed7d7; background: #fff5f5; }
        .lm-row-del.armed { opacity: 1; color: #e53e3e; border-color: #fca5a5; background: #fff5f5; }

        .lm-pagination {
          background: #fff; border-top: 1px solid #e8ecf3;
          padding: 8px 20px; display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: #64748b; flex-shrink: 0;
        }
        .lm-pg-btn {
          padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 7px;
          background: #fff; color: #475569; cursor: pointer; font-size: 12px;
          font-family: inherit;
        }
        .lm-pg-btn:disabled { opacity: 0.35; cursor: default; }
        .lm-pg-btn.on { background: #4f46e5; color: #fff; border-color: #4f46e5; }
        .lm-pg-sel {
          padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 7px;
          background: #fff; color: #475569; font-size: 12px; font-family: inherit; outline: none;
        }

        .lm-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.28);
          z-index: 200; display: flex; justify-content: flex-end;
        }
        .lm-drawer {
          width: 420px; max-width: 96vw; background: #fff;
          height: 100%; display: flex; flex-direction: column;
          border-left: 1px solid #e2e8f0;
          animation: lm-drawer-in 0.2s ease;
          overflow: hidden;
        }
        .lm-drawer-head {
          padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .lm-drawer-meta { flex: 1; min-width: 0; }
        .lm-drawer-name { font-size: 14px; font-weight: 600; color: #0f172a; }
        .lm-drawer-info { font-size: 11px; color: #64748b; margin-top: 1px; }
        .lm-close-btn {
          font-size: 12px; padding: 5px 12px; border: 1px solid #e2e8f0;
          border-radius: 8px; background: transparent; cursor: pointer;
          color: #64748b; font-family: inherit;
        }
        .lm-close-btn:hover { background: #f1f5f9; }

        /* Delete button in drawer header */
        .lm-drawer-del {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid #fed7d7; background: #fff5f5;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #fc8181; flex-shrink: 0; transition: all 0.12s;
        }
        .lm-drawer-del:hover { background: #fed7d7; color: #e53e3e; border-color: #fca5a5; }

        /* Delete confirm banner inside drawer */
        .lm-del-banner {
          margin: 0 18px 0;
          padding: 10px 14px;
          background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          flex-shrink: 0;
        }
        .lm-del-banner-txt { font-size: 12.5px; font-weight: 400; color: #c53030; }
        .lm-del-yes {
          padding: 5px 12px; background: #e53e3e; color: #fff;
          border: none; border-radius: 6px; font-size: 12px; font-weight: 500;
          font-family: inherit; cursor: pointer;
        }
        .lm-del-yes:hover { background: #c53030; }
        .lm-del-yes:disabled { opacity: 0.5; cursor: not-allowed; }
        .lm-del-no {
          padding: 5px 12px; background: transparent; color: #718096;
          border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 12px;
          font-family: inherit; cursor: pointer;
        }
        .lm-del-no:hover { border-color: #cbd5e0; color: #4a5568; }

        .lm-drawer-body {
          flex: 1; overflow-y: auto; padding: 16px 18px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .lm-drawer-body::-webkit-scrollbar { width: 4px; }
        .lm-drawer-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        .lm-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .lm-info-box  { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px; }
        .lm-info-lbl  { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .lm-info-val  { font-size: 14px; font-weight: 600; color: #0f172a; }
        .lm-info-sub  { font-size: 11px; color: #64748b; margin-top: 2px; }
        .lm-bal-box   { background: #f8fafc; border: 1px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; }
        .lm-reason-box{ background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px; }
        .lm-drawer-footer {
          border-top: 1px solid #f1f5f9; padding: 12px 18px;
          background: #fafbfc; flex-shrink: 0; display: flex;
          gap: 8px; align-items: center;
        }
        .lm-btn-approve {
          font-size: 12px; font-weight: 600; padding: 8px 20px;
          background: #16a34a; color: #fff; border: none;
          border-radius: 9px; cursor: pointer; font-family: inherit;
        }
        .lm-btn-approve:hover   { background: #15803d; }
        .lm-btn-approve:disabled{ opacity: 0.45; cursor: not-allowed; }
        .lm-btn-reject {
          font-size: 12px; font-weight: 600; padding: 8px 20px;
          background: #dc2626; color: #fff; border: none;
          border-radius: 9px; cursor: pointer; font-family: inherit;
        }
        .lm-btn-reject:hover   { background: #b91c1c; }
        .lm-btn-reject:disabled{ opacity: 0.45; cursor: not-allowed; }
        .lm-done-bar {
          padding: 10px 18px; background: #f0fdf4;
          border-top: 1px solid #bbf7d0; display: flex;
          align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .lm-rej-bar {
          padding: 10px 18px; background: #fff1f2;
          border-top: 1px solid #fda4af; display: flex;
          align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .lm-reopen-btn {
          font-size: 11px; padding: 5px 12px; border: 1px solid #e2e8f0;
          border-radius: 7px; background: #f8fafc; cursor: pointer;
          color: #64748b; font-family: inherit;
        }

        .lm-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          z-index: 300; display: flex; align-items: center; justify-content: center;
        }
        .lm-modal {
          background: #fff; border-radius: 16px; padding: 32px 28px;
          max-width: 340px; width: 90%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
        }
        .lm-empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
      `}</style>

      <div className="lm-root">

        {/* ── TABS ── */}
        <div className="lm-tabs">
          {([
            { key: "requests", label: "Leave Requests" },
            { key: "calendar", label: "Holiday Calendar" },
          ] as const).map(({ key, label }) => (
            <button key={key} className={`lm-tab${tab === key ? " on" : ""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {/* ── REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            {/* Filter bar */}
            <div className="lm-filterbar">
              <div className="lm-search-wrap">
                <span className="lm-search-ic">🔍</span>
                <input className="lm-search" placeholder="Search name, email, reason…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
              </div>
              <div className="lm-status-pills">
                {([
                  ["all",      `All (${total})`],
                  ["pending",  `Pending (${pending})`],
                  ["approved", `Approved (${approved})`],
                  ["rejected", `Rejected (${rejected})`],
                ] as const).map(([f, label]) => (
                  <button key={f} className={`lm-spill${statusFilter === f ? " on" : ""}`} onClick={() => { setStatusFilter(f); setPage(0); }}>{label}</button>
                ))}
              </div>
              <select className="lm-sel" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
                <option value="all">All Types</option>
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Annual">Annual</option>
                <option value="Work From Home">WFH</option>
              </select>
              <select className="lm-sel" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(0); }}>
                <option value="all">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="lm-table-wrap">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", flexDirection: "column", gap: 12, color: "#94a3b8" }}>
                  <div style={{ width: 28, height: 28, border: "2.5px solid #e2e8f0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "lm-spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: 12 }}>Loading requests…</span>
                </div>
              ) : error ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#ef4444" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontSize: 13 }}>{error}</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="lm-empty">
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 4 }}>No requests found</div>
                  <div style={{ fontSize: 12 }}>{search ? "Try a different search" : "No requests match this filter"}</div>
                </div>
              ) : (
                <table className="lm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 200 }}>Employee</th>
                      <th style={{ width: 110 }}>Leave Type</th>
                      <th style={{ width: 100 }}>From</th>
                      <th style={{ width: 100 }}>To</th>
                      <th style={{ width: 60  }}>Days</th>
                      <th style={{ width: 100 }}>Applied</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(req => {
                      const lc   = getLeaveCfg(req.leaveType);
                      const sc   = getStatusCfg(req.status);
                      const days = getDays(req.fromDate ?? "", req.toDate ?? "");
                      const isPending = (req.status ?? "") === "Pending";
                      const isArmed   = deleteConfirm === req.id;
                      return (
                        <tr key={req.id} className={selected?.id === req.id ? "selected" : ""} onClick={() => setSelected(req)}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={req.userName} size={30} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>{req.userName || "Unknown"}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{req.department || req.userEmail || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td><Chip label={req.leaveType ?? "—"} bg={lc.bg} color={lc.color} dot={lc.dot} /></td>
                          <td style={{ fontSize: 11, color: "#475569" }}>{fmtDate(req.fromDate ?? "")}</td>
                          <td style={{ fontSize: 11, color: "#475569" }}>{fmtDate(req.toDate ?? "")}</td>
                          <td style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>{days}</td>
                          <td style={{ fontSize: 11, color: "#94a3b8" }}>{timeAgo(req.createdAt)}</td>
                          <td><Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} /></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isPending ? (
                                <>
                                  <button className="lm-approve-inline" disabled={updating} onClick={() => setConfirm({ id: req.id, action: "Approved" })}>✓ Approve</button>
                                  <button className="lm-reject-inline"  disabled={updating} onClick={() => setConfirm({ id: req.id, action: "Rejected" })}>✗ Reject</button>
                                </>
                              ) : (
                                <button
                                  style={{ fontSize: 11, padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#f8fafc", cursor: "pointer", color: "#64748b", fontFamily: "inherit" }}
                                  onClick={() => handleUpdateStatus(req.id, "Pending")}
                                >
                                  Reopen
                                </button>
                              )}
                              {/* Delete icon — arms on first click, deletes on second */}
                              <button
                                className={`lm-row-del${isArmed ? " armed" : ""}`}
                                title={isArmed ? "Click again to confirm delete" : "Delete request"}
                                onClick={e => {
                                  e.stopPropagation();
                                  if (isArmed) {
                                    void handleDelete(req.id);
                                  } else {
                                    setDeleteConfirm(req.id);
                                    // Auto-disarm after 3s
                                    setTimeout(() => setDeleteConfirm(c => c === req.id ? null : c), 3000);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="lm-pagination">
                <span style={{ flex: 1 }}>
                  {currentPage * perPage + 1}–{Math.min((currentPage + 1) * perPage, filtered.length)} of {filtered.length} requests
                </span>
                <select className="lm-pg-sel" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(0); }}>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <button className="lm-pg-btn" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                {Array.from({ length: totalPages }, (_, i) => {
                  if (totalPages > 7 && i > 1 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
                    return i === 2 ? <span key={i} style={{ padding: "0 4px", color: "#94a3b8" }}>…</span> : null;
                  }
                  return <button key={i} className={`lm-pg-btn${currentPage === i ? " on" : ""}`} onClick={() => setPage(i)}>{i + 1}</button>;
                })}
                <button className="lm-pg-btn" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            )}
          </>
        )}

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (
          <div style={{ flex: 1, overflow: "auto", background: "#fff", margin: "12px 20px 20px", borderRadius: 12, border: "1px solid #e8ecf3" }}>
            <HolidayCalendar holidays={holidays} leaveRequests={requests} />
          </div>
        )}

        {/* ── RIGHT DRAWER ── */}
        {selected && (
          <div className="lm-overlay" onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}>
            <div className="lm-drawer">
              {/* Drawer head */}
              <div className="lm-drawer-head">
                <Avatar name={selected.userName} size={40} />
                <div className="lm-drawer-meta">
                  <div className="lm-drawer-name">{selected.userName}</div>
                  <div className="lm-drawer-info">{selected.userEmail ?? "—"}{selected.department ? ` · ${selected.department}` : ""}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    {(() => {
                      const lc = getLeaveCfg(selected.leaveType);
                      const sc = getStatusCfg(selected.status);
                      return (
                        <>
                          <Chip label={selected.leaveType ?? "—"} bg={lc.bg} color={lc.color} dot={lc.dot} />
                          <Chip label={sc.label} bg={sc.bg} color={sc.color} border={sc.border} dot={sc.dot} />
                        </>
                      );
                    })()}
                  </div>
                </div>
                {/* Delete button in drawer */}
                <button
                  className="lm-drawer-del"
                  title="Delete this request"
                  onClick={() => setDeleteConfirm(selected.id)}
                >
                  <Trash2 size={13} />
                </button>
                <button className="lm-close-btn" onClick={closeDrawer}>✕</button>
              </div>

              {/* Delete confirmation banner — shown inside drawer */}
              {deleteConfirm === selected.id && (
                <div className="lm-del-banner" style={{ margin: "10px 18px 0" }}>
                  <span className="lm-del-banner-txt">Permanently delete this request? This cannot be undone.</span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="lm-del-no" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    <button className="lm-del-yes" disabled={deleting} onClick={() => void handleDelete(selected.id)}>
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              )}

              {/* Drawer body */}
              <div className="lm-drawer-body">
                <div className="lm-info-grid">
                  <div className="lm-info-box">
                    <div className="lm-info-lbl">From date</div>
                    <div className="lm-info-val">{fmtDate(selected.fromDate ?? "")}</div>
                    <div className="lm-info-sub">{selected.fromDate ?? "—"}</div>
                  </div>
                  <div className="lm-info-box">
                    <div className="lm-info-lbl">To date</div>
                    <div className="lm-info-val">{fmtDate(selected.toDate ?? "")}</div>
                    <div className="lm-info-sub">{selected.toDate ?? "—"}</div>
                  </div>
                  <div className="lm-info-box">
                    <div className="lm-info-lbl">Duration</div>
                    <div className="lm-info-val">{getDays(selected.fromDate ?? "", selected.toDate ?? "")} days</div>
                    <div className="lm-info-sub">{selected.leaveType ?? "—"}</div>
                  </div>
                  <div className="lm-info-box">
                    <div className="lm-info-lbl">Department</div>
                    <div className="lm-info-val" style={{ fontSize: 13 }}>{selected.department || "—"}</div>
                    <div className="lm-info-sub">{timeAgo(selected.createdAt)}</div>
                  </div>
                </div>

                <div className="lm-bal-box">
                  <div className="lm-info-lbl">Leave balance</div>
                  {loadingBalance ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Loading balance…</div>
                  ) : selectedBalance ? (
                    <LeaveBalanceBadges balance={selectedBalance} />
                  ) : (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Balance not found in Firestore.</div>
                  )}
                  {selectedBalance && getLeaveCfg(selected.leaveType).balanceKey && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 7, border: "1px solid #e2e8f0" }}>
                      Approving will deduct <strong>{getDays(selected.fromDate ?? "", selected.toDate ?? "")} day(s)</strong> from {selected.leaveType} balance automatically.
                    </div>
                  )}
                </div>

                <div className="lm-reason-box">
                  <div className="lm-info-lbl">Reason for leave</div>
                  <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, marginTop: 4 }}>{selected.reason || "No reason provided."}</div>
                </div>

                {selected.reviewedAt && (
                  <div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "10px 12px" }}>
                    <div className="lm-info-lbl">Last reviewed</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#475569", marginTop: 4 }}>{timeAgo(selected.reviewedAt)}</div>
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              {(selected.status ?? "") === "Approved" ? (
                <div className="lm-done-bar">
                  <span style={{ fontSize: 12, color: "#15803d", fontWeight: 500 }}>✓ Approved — balance decremented</span>
                  <button className="lm-reopen-btn" onClick={() => handleUpdateStatus(selected.id, "Pending")}>Reopen</button>
                </div>
              ) : (selected.status ?? "") === "Rejected" ? (
                <div className="lm-rej-bar">
                  <span style={{ fontSize: 12, color: "#881337", fontWeight: 500 }}>✗ This request was rejected</span>
                  <button className="lm-reopen-btn" onClick={() => handleUpdateStatus(selected.id, "Pending")}>Reopen</button>
                </div>
              ) : (
                <div className="lm-drawer-footer">
                  <button className="lm-btn-approve" disabled={updating} onClick={() => setConfirm({ id: selected.id, action: "Approved" })}>
                    {updating ? "…" : "✓ Approve"}
                  </button>
                  <button className="lm-btn-reject" disabled={updating} onClick={() => setConfirm({ id: selected.id, action: "Rejected" })}>
                    {updating ? "…" : "✗ Reject"}
                  </button>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
                    {getDays(selected.fromDate ?? "", selected.toDate ?? "")}-day {selected.leaveType ?? "Unknown"} leave
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONFIRM MODAL (approve/reject) ── */}
        {confirm && (
          <div className="lm-modal-overlay">
            <div className="lm-modal">
              <div style={{ fontSize: 40, marginBottom: 10 }}>{confirm.action === "Approved" ? "✅" : "❌"}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
                {confirm.action === "Approved" ? "Approve Leave?" : "Reject Leave?"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 22, lineHeight: 1.6 }}>
                {confirm.action === "Approved"
                  ? "This will approve the request, deduct leave days from their balance, and notify the employee instantly."
                  : "This will reject the request and notify the employee instantly."}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirm(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateStatus(confirm.id, confirm.action)}
                  disabled={updating}
                  style={{ background: confirm.action === "Approved" ? "#16a34a" : "#dc2626", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: updating ? 0.5 : 1 }}
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