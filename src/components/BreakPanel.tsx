"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  doc, onSnapshot, updateDoc, arrayUnion, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Types 
export type BreakType = "MORNING" | "LUNCH" | "EVENING";

export interface Break {
  type: BreakType;
  startTime: Timestamp;
  endTime?: Timestamp;
}

// ── Helpers
export const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const getActiveBreak = (breaks: Break[]): Break | null =>
  breaks.find((b) => b.startTime && !b.endTime) ?? null;

const fmt = (ts?: Timestamp) =>
  ts ? ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";

const hms = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const hmLabel = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
};

// ── Break config 
const BREAK_CONFIG: Record<BreakType, {
  icon: string;
  label: string;
  short: string;
  from: string;
  to: string;
  glow: string;
  badge: string;
  badgeText: string;
  timeline: string;
}> = {
  MORNING: {
    icon: "☕",
    label: "Morning Break",
    short: "Morning",
    from: "from-amber-400",
    to: "to-orange-500",
    glow: "shadow-amber-500/40",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "text-amber-600",
    timeline: "border-amber-400",
  },
  LUNCH: {
    icon: "🍱",
    label: "Lunch Break",
    short: "Lunch",
    from: "from-emerald-400",
    to: "to-teal-500",
    glow: "shadow-emerald-500/40",
    badge: "bg-emerald-100 text-emerald-700",
    badgeText: "text-emerald-600",
    timeline: "border-emerald-400",
  },
  EVENING: {
    icon: "🌆",
    label: "Evening Break",
    short: "Evening",
    from: "from-violet-400",
    to: "to-purple-600",
    glow: "shadow-violet-500/40",
    badge: "bg-violet-100 text-violet-700",
    badgeText: "text-violet-600",
    timeline: "border-violet-400",
  },
};

// ── Main component 
export default function BreakPanel({
  uid,
  isCheckedIn,
}: {
  uid: string;
  isCheckedIn: boolean;
}) {
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateStr = getTodayDateStr();
  const docRef = doc(db, "attendance", `${uid}_${dateStr}`);

  // ── Firestore listener 
  useEffect(() => {
    const unsub = onSnapshot(docRef, (snap) => {
      setBreaks(snap.exists() ? (snap.data().breaks ?? []) : []);
    });
    return unsub;
  }, [uid]);

  // ── Live timer 
  const activeBreak = getActiveBreak(breaks);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeBreak) { setElapsed(0); return; }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - activeBreak.startTime.toDate().getTime()) / 1000));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeBreak?.startTime]);

  // ── Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Actions 
  const startBreak = useCallback(async (type: BreakType) => {
    if (!isCheckedIn) { showToast("⚠️ Please check in first"); return; }
    if (activeBreak)  { showToast("⚠️ End your current break first"); return; }
    const alreadyDone = breaks.some((b) => b.type === type && b.endTime);
    if (alreadyDone)  { showToast(`⚠️ ${BREAK_CONFIG[type].short} break already taken today`); return; }
    setLoading(true);
    try {
      await updateDoc(docRef, { breaks: arrayUnion({ type, startTime: Timestamp.now() }) });
      showToast(`${BREAK_CONFIG[type].icon} ${BREAK_CONFIG[type].label} started`);
    } catch { showToast("❌ Failed to start break"); }
    finally { setLoading(false); }
  }, [docRef, isCheckedIn, activeBreak, breaks]);

  const endBreak = useCallback(async () => {
    if (!activeBreak) return;
    setLoading(true);
    try {
      const updated = breaks.map((b) =>
        b.startTime.seconds === activeBreak.startTime.seconds && !b.endTime
          ? { ...b, endTime: Timestamp.now() }
          : b
      );
      await updateDoc(docRef, { breaks: updated });
      showToast("✅ Break ended — back to work!");
    } catch { showToast("❌ Failed to end break"); }
    finally { setLoading(false); }
  }, [docRef, breaks, activeBreak]);

  // ── Computed 
  const totalBreakSec = breaks.reduce((acc, b) => {
    const start = b.startTime.toDate().getTime();
    const end = b.endTime
      ? b.endTime.toDate().getTime()
      : activeBreak && b.startTime.seconds === activeBreak.startTime.seconds
        ? Date.now()
        : start;
    return acc + Math.max(0, Math.floor((end - start) / 1000));
  }, 0);

  const usedTypes = new Set(breaks.map((b) => b.type));

  return (
    <div className="relative">
      {/* ── Toast ── */}
      {toast && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-full shadow-xl whitespace-nowrap"
          style={{ animation: "fadeUp 0.2s ease" }}
        >
          {toast}
        </div>
      )}

      {/* ── Main card ── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

        {/* Card header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #0d2e4f 0%, #1a4a7a 60%, #0d3a68 100%)",
          }}
        >
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              ⏸ Break Manager
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Track and manage your work breaks</p>
          </div>

          {/* Live status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            activeBreak
              ? "bg-amber-500/20 border-amber-400/40"
              : isCheckedIn
              ? "bg-green-500/20 border-green-400/40"
              : "bg-white/10 border-white/20"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              activeBreak ? "bg-amber-400 animate-pulse" : isCheckedIn ? "bg-green-400" : "bg-gray-400"
            }`} />
            <span className={`text-xs font-bold ${
              activeBreak ? "text-amber-200" : isCheckedIn ? "text-green-200" : "text-white/50"
            }`}>
              {activeBreak
                ? `${BREAK_CONFIG[activeBreak.type].icon} ${BREAK_CONFIG[activeBreak.type].short}`
                : isCheckedIn ? "Working" : "Not In"}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Live break display (when on break) ── */}
          {activeBreak && (
            <div
              className={`rounded-xl p-4 bg-gradient-to-r ${BREAK_CONFIG[activeBreak.type].from} ${BREAK_CONFIG[activeBreak.type].to}`}
              style={{ animation: "fadeUp 0.3s ease" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                    Currently on
                  </p>
                  <p className="text-white text-lg font-bold mt-0.5 flex items-center gap-2">
                    {BREAK_CONFIG[activeBreak.type].icon} {BREAK_CONFIG[activeBreak.type].label}
                  </p>
                  <p className="text-white/70 text-xs mt-1">Started at {fmt(activeBreak.startTime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest">Duration</p>
                  <p className="font-mono text-3xl font-black text-white tabular-nums mt-0.5">
                    {hms(elapsed)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Break buttons ── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Start a Break
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["MORNING", "LUNCH", "EVENING"] as BreakType[]).map((type) => {
                const c = BREAK_CONFIG[type];
                const done = usedTypes.has(type) && !activeBreak;
                const active = activeBreak?.type === type;
                const disabled = (!!activeBreak && !active) || loading || !isCheckedIn || (done && !active);
                return (
                  <button
                    key={type}
                    onClick={() => !active ? startBreak(type) : undefined}
                    disabled={disabled}
                    className={`
                      relative flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-xl
                      font-semibold text-xs transition-all duration-200
                      ${active
                        ? `bg-gradient-to-br ${c.from} ${c.to} text-white shadow-lg ${c.glow} scale-[1.03]`
                        : disabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : `bg-gray-50 hover:bg-gradient-to-br hover:${c.from} hover:${c.to} hover:text-white border border-gray-200 hover:border-transparent hover:shadow-md hover:${c.glow} hover:scale-[1.03] active:scale-[0.98] text-gray-700`
                      }
                    `}
                  >
                    <span className="text-xl">{c.icon}</span>
                    <span className="leading-tight text-center">{c.short}</span>
                    {done && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* End break button */}
            {activeBreak && (
              <button
                onClick={endBreak}
                disabled={loading}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>⏹ End Break</>
                )}
              </button>
            )}
          </div>

          {/* ── Today's break summary ── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Today&apos;s Breaks
            </p>
            {breaks.length === 0 ? (
              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <span className="text-2xl opacity-40">💤</span>
                <p className="text-sm text-gray-400 italic">No breaks taken yet today</p>
              </div>
            ) : (
              <div className="relative pl-4 space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gray-200 rounded-full" />
                {breaks.map((b, i) => {
                  const c = BREAK_CONFIG[b.type];
                  const isActive = !b.endTime;
                  const durSec = b.endTime
                    ? Math.floor((b.endTime.toDate().getTime() - b.startTime.toDate().getTime()) / 1000)
                    : isActive ? elapsed : 0;
                  return (
                    <div key={i} className="flex items-start gap-3 pb-3 last:pb-0">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${c.timeline} bg-white shrink-0 mt-1 relative z-10`} />
                      <div className="flex-1 flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{c.icon}</span>
                            <span className="text-xs font-bold text-gray-700">{c.short} Break</span>
                            {isActive && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-600 text-[9px] font-bold rounded-full">
                                <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmt(b.startTime)} → {b.endTime ? fmt(b.endTime) : "ongoing"}
                          </p>
                        </div>
                        <span className={`font-mono text-xs font-bold ${c.badgeText}`}>
                          {hmLabel(durSec)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total break time */}
            <div className="mt-3 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm">⏱</span>
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Total Break</span>
              </div>
              <span className="font-mono font-black text-base text-white tabular-nums">
                {hmLabel(totalBreakSec)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}