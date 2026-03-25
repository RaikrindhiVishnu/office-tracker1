"use client";
// components/AdminBreakView.tsx

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  calcTotalBreakMinutes,
  formatBreakDuration,
  formatBreakTime,
  getActiveBreak,
  BREAK_LIMIT_MINUTES,
  type Break,
  type BreakType,
} from "@/lib/breakTracking";

type EmployeeBreakRow = {
  uid: string;
  name: string;
  email: string;
  profilePhoto?: string;
  breaks: Break[];
  totalBreakMinutes: number;
  activeBreak: Break | null;
  status: "WORKING" | "ON_BREAK" | "OFFLINE";
};

const BREAK_ICONS: Record<BreakType, string> = {
  MORNING: "☕",
  LUNCH: "🍽️",
  EVENING: "🌇",
};

const BREAK_COLORS: Record<BreakType, { bg: string; text: string; border: string }> = {
  MORNING: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  LUNCH:   { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  EVENING: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

function LiveTimer({ startTime }: { startTime: any }) {
  const [elapsed, setElapsed] = useState("00:00");
  useEffect(() => {
    const tick = () => {
      const start = startTime?.toDate?.()?.getTime() || Date.now();
      const secs  = Math.floor((Date.now() - start) / 1000);
      const m     = Math.floor(secs / 60);
      const s     = secs % 60;
      setElapsed(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  return <span className="font-mono font-bold text-amber-600">{elapsed}</span>;
}

type Props = {
  date?: string; // YYYY-MM-DD, defaults to today
};

export default function AdminBreakView({ date }: Props) {
  const [rows, setRows] = useState<EmployeeBreakRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ON_BREAK" | "WORKING" | "OFFLINE">("ALL");

  const targetDate = date || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    let unsubscribers: (() => void)[] = [];

    const init = async () => {
      setLoading(true);
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as any),
      }));

      const rowMap: Record<string, EmployeeBreakRow> = {};

      // Initialize all users
      users.forEach((u) => {
        rowMap[u.uid] = {
          uid: u.uid,
          name: u.name || u.email?.split("@")[0] || "Unknown",
          email: u.email || "",
          profilePhoto: u.profilePhoto || "",
          breaks: [],
          totalBreakMinutes: 0,
          activeBreak: null,
          status: "OFFLINE",
        };
      });

      // Listen to each user's attendance doc
      users.forEach((u) => {
        const attRef = doc(db, "attendance", `${u.uid}_${targetDate}`);
        const unsub = onSnapshot(attRef, (snap) => {
          if (!snap.exists()) {
            rowMap[u.uid] = {
              ...rowMap[u.uid],
              breaks: [],
              totalBreakMinutes: 0,
              activeBreak: null,
              status: "OFFLINE",
            };
          } else {
            const data = snap.data();
            const breaks: Break[] = data.breaks || [];
            const sessions = data.sessions || [];
            const lastSession = sessions[sessions.length - 1];
            const isOnline = lastSession && !lastSession.checkOut;
            const active = getActiveBreak(breaks);

            rowMap[u.uid] = {
              ...rowMap[u.uid],
              breaks,
              totalBreakMinutes: calcTotalBreakMinutes(breaks),
              activeBreak: active,
              status: active ? "ON_BREAK" : isOnline ? "WORKING" : "OFFLINE",
            };
          }
          // Trigger re-render
          setRows(Object.values(rowMap).sort((a, b) => {
            const order = { ON_BREAK: 0, WORKING: 1, OFFLINE: 2 };
            return order[a.status] - order[b.status];
          }));
        });
        unsubscribers.push(unsub);
      });

      setLoading(false);
    };

    init();
    return () => unsubscribers.forEach((u) => u());
  }, [targetDate]);

  const filtered = rows.filter((r) =>
    filterStatus === "ALL" ? true : r.status === filterStatus
  );

  const onBreakCount  = rows.filter((r) => r.status === "ON_BREAK").length;
  const workingCount  = rows.filter((r) => r.status === "WORKING").length;
  const offlineCount  = rows.filter((r) => r.status === "OFFLINE").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#193677] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="On Break"
          value={onBreakCount}
          color="amber"
          icon="⏸️"
          onClick={() => setFilterStatus(filterStatus === "ON_BREAK" ? "ALL" : "ON_BREAK")}
          active={filterStatus === "ON_BREAK"}
        />
        <StatCard
          label="Working"
          value={workingCount}
          color="emerald"
          icon="💼"
          onClick={() => setFilterStatus(filterStatus === "WORKING" ? "ALL" : "WORKING")}
          active={filterStatus === "WORKING"}
        />
        <StatCard
          label="Offline"
          value={offlineCount}
          color="slate"
          icon="🔴"
          onClick={() => setFilterStatus(filterStatus === "OFFLINE" ? "ALL" : "OFFLINE")}
          active={filterStatus === "OFFLINE"}
        />
      </div>

      {/* Employee Break Rows */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">☕</div>
            <p className="text-sm font-medium">No employees in this category</p>
          </div>
        )}

        {filtered.map((row) => (
          <EmployeeBreakCard
            key={row.uid}
            row={row}
            expanded={expandedUid === row.uid}
            onToggle={() => setExpandedUid(expandedUid === row.uid ? null : row.uid)}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label, value, color, icon, onClick, active,
}: {
  label: string; value: number; color: string; icon: string; onClick: () => void; active: boolean;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
    amber:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  activeBg: "bg-amber-100"  },
    emerald:{ bg: "bg-emerald-50",text: "text-emerald-700",border: "border-emerald-200",activeBg: "bg-emerald-100"},
    slate:  { bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200",  activeBg: "bg-slate-100"  },
  };
  const c = colorMap[color] || colorMap.slate;
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
        active ? `${c.activeBg} ${c.border} shadow-sm` : `${c.bg} ${c.border}`
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs font-semibold ${c.text} uppercase tracking-wide`}>{label}</span>
      </div>
      <p className={`text-3xl font-bold ${c.text}`}>{value}</p>
    </button>
  );
}

function EmployeeBreakCard({
  row, expanded, onToggle,
}: {
  row: EmployeeBreakRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isOverLimit = row.totalBreakMinutes > BREAK_LIMIT_MINUTES;

  const statusConfig = {
    ON_BREAK: { bg: "bg-amber-50",   border: "border-amber-300", badge: "bg-amber-500",  label: "On Break",  dot: "bg-amber-500"  },
    WORKING:  { bg: "bg-emerald-50", border: "border-emerald-200",badge: "bg-emerald-500",label: "Working",   dot: "bg-emerald-500"},
    OFFLINE:  { bg: "bg-gray-50",    border: "border-gray-200",  badge: "bg-gray-400",   label: "Offline",   dot: "bg-gray-400"   },
  }[row.status];

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${statusConfig.border} ${expanded ? "shadow-lg" : "shadow-sm hover:shadow-md"}`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 p-4 text-left ${statusConfig.bg} transition-all`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden shadow-md bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold">
            {row.profilePhoto ? (
              <img src={row.profilePhoto} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              row.name[0]?.toUpperCase()
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusConfig.dot} ${row.status === "ON_BREAK" ? "animate-pulse" : ""}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800 text-sm truncate">{row.name}</p>
            <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${statusConfig.badge}`}>
              {statusConfig.label}
            </span>
            {isOverLimit && (
              <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-red-500 flex items-center gap-0.5">
                ⚠️ Limit Exceeded
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{row.email}</p>

          {/* Active break info */}
          {row.activeBreak && (
            <div className="flex items-center gap-2 mt-1">
              <span>{BREAK_ICONS[row.activeBreak.type]}</span>
              <span className="text-xs text-amber-700 font-medium">
                {row.activeBreak.type} break —{" "}
              </span>
              <LiveTimer startTime={row.activeBreak.startTime} />
            </div>
          )}
        </div>

        {/* Break time summary */}
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold ${isOverLimit ? "text-red-600" : "text-gray-700"}`}>
            {formatBreakDuration(row.totalBreakMinutes)}
          </p>
          <p className="text-[10px] text-gray-400">Total Breaks</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{row.breaks.length} break{row.breaks.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 ml-1">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded break details */}
      {expanded && (
        <div className="bg-white border-t border-gray-100 p-4">
          {row.breaks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">No breaks taken today</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Break Details</p>
              {row.breaks.map((b, i) => {
                const cfg = BREAK_COLORS[b.type];
                const isActive = !b.endTime;
                const duration = b.startTime && b.endTime
                  ? Math.floor((b.endTime.toDate().getTime() - b.startTime.toDate().getTime()) / 60000)
                  : null;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}
                  >
                    <span className="text-xl">{BREAK_ICONS[b.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${cfg.text}`}>{b.type} BREAK</span>
                        {isActive && (
                          <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full animate-pulse font-bold">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                        <span>▶ {formatBreakTime(b.startTime)}</span>
                        {b.endTime && <span>■ {formatBreakTime(b.endTime)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {duration !== null ? (
                        <span className={`text-sm font-bold ${cfg.text}`}>
                          {formatBreakDuration(duration)}
                        </span>
                      ) : (
                        <LiveTimer startTime={b.startTime} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              <div className={`flex items-center justify-between p-3 rounded-lg mt-3 ${
                isOverLimit ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-200"
              }`}>
                <span className={`text-xs font-semibold ${isOverLimit ? "text-red-600" : "text-gray-600"}`}>
                  Total Break Time
                </span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${isOverLimit ? "text-red-600" : "text-gray-800"}`}>
                    {formatBreakDuration(row.totalBreakMinutes)}
                  </span>
                  {isOverLimit && (
                    <p className="text-[10px] text-red-500">
                      +{formatBreakDuration(row.totalBreakMinutes - BREAK_LIMIT_MINUTES)} over limit
                    </p>
                  )}
                </div>
              </div>

              {/* Break bar visual */}
              <div className="mt-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isOverLimit
                        ? "bg-gradient-to-r from-red-500 to-red-600"
                        : "bg-gradient-to-r from-emerald-400 to-teal-500"
                    }`}
                    style={{ width: `${Math.min((row.totalBreakMinutes / BREAK_LIMIT_MINUTES) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>0</span>
                  <span>Limit: {formatBreakDuration(BREAK_LIMIT_MINUTES)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}