"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Types 
type BreakType = "MORNING" | "LUNCH" | "EVENING";

interface Break {
  type: BreakType;
  startTime: Timestamp;
  endTime?: Timestamp;
}

// ── Helpers 
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getActiveBreak = (breaks: Break[]): Break | null =>
  breaks.find((b) => b.startTime && !b.endTime) ?? null;

const formatHHMMSS = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatClock = (ts: Timestamp | undefined) => {
  if (!ts) return "--";
  return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const breakMeta: Record<BreakType, { label: string; icon: string; pillBg: string; pillText: string; dotColor: string; btnGrad: string }> = {
  MORNING: {
    label: "Morning Break",
    icon: "☕",
    pillBg: "bg-amber-500/20 border-amber-400/40",
    pillText: "text-amber-200",
    dotColor: "bg-amber-400",
    btnGrad: "from-amber-400 to-orange-500",
  },
  LUNCH: {
    label: "Lunch Break",
    icon: "🍱",
    pillBg: "bg-emerald-500/20 border-emerald-400/40",
    pillText: "text-emerald-200",
    dotColor: "bg-emerald-400",
    btnGrad: "from-emerald-400 to-teal-500",
  },
  EVENING: {
    label: "Evening Break",
    icon: "🌆",
    pillBg: "bg-violet-500/20 border-violet-400/40",
    pillText: "text-violet-200",
    dotColor: "bg-violet-400",
    btnGrad: "from-violet-400 to-purple-600",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NavbarBreakStatus({
  uid,
  isCheckedIn,
}: {
  uid: string;
  isCheckedIn: boolean;
}) {
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dateStr = getTodayStr();
  const docRef = doc(db, "attendance", `${uid}_${dateStr}`);

  // ── Firestore listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setBreaks(snap.data().breaks ?? []);
      } else {
        setBreaks([]);
      }
    });
    return unsub;
  }, [uid]);

  // ── Live break timer ──────────────────────────────────────────────────────
  const activeBreak = getActiveBreak(breaks);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeBreak) { setElapsed(0); return; }
    const tick = () => {
      const start = activeBreak.startTime.toDate().getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeBreak?.startTime]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startBreak = useCallback(async (type: BreakType) => {
    if (!isCheckedIn || activeBreak) return;
    setLoading(true);
    try {
      const newBreak: Break = { type, startTime: Timestamp.now() };
      await updateDoc(docRef, { breaks: arrayUnion(newBreak) });
    } catch (e) {
      console.error("startBreak error:", e);
    } finally {
      setLoading(false);
    }
  }, [docRef, isCheckedIn, activeBreak]);

  const endBreak = useCallback(async () => {
    if (!activeBreak) return;
    setLoading(true);
    try {
      const updated = breaks.map((b) =>
        b.startTime === activeBreak.startTime ? { ...b, endTime: Timestamp.now() } : b
      );
      await updateDoc(docRef, { breaks: updated });
    } catch (e) {
      console.error("endBreak error:", e);
    } finally {
      setLoading(false);
    }
  }, [docRef, breaks, activeBreak]);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalBreakSeconds = breaks.reduce((acc, b) => {
    if (!b.startTime) return acc;
    const start = b.startTime.toDate().getTime();
    const end = b.endTime ? b.endTime.toDate().getTime() : (b === activeBreak ? Date.now() : start);
    return acc + Math.max(0, Math.floor((end - start) / 1000));
  }, 0);

  const completedBreaks = breaks.filter((b) => b.endTime);
  const usedTypes = new Set(breaks.map((b) => b.type));

  // ── Pill appearance ───────────────────────────────────────────────────────
  const pillContent = activeBreak
    ? {
        bg: breakMeta[activeBreak.type].pillBg,
        text: breakMeta[activeBreak.type].pillText,
        dot: breakMeta[activeBreak.type].dotColor,
        label: `${breakMeta[activeBreak.type].icon} ${breakMeta[activeBreak.type].label}`,
        timer: formatHHMMSS(elapsed),
      }
    : isCheckedIn
    ? {
        bg: "bg-green-500/20 border-green-400/40",
        text: "text-green-200",
        dot: "bg-green-400",
        label: "Working",
        timer: null,
      }
    : {
        bg: "bg-white/10 border-white/20",
        text: "text-white/60",
        dot: "bg-gray-400",
        label: "⚪ Not Checked In",
        timer: null,
      };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── PILL BUTTON ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={!isCheckedIn}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full border
          backdrop-blur-sm transition-all duration-200 select-none
          hover:brightness-110 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed
          ${pillContent.bg}
        `}
        style={{ minWidth: 0 }}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${pillContent.dot} ${activeBreak ? "animate-pulse" : ""}`} />
        <span className={`text-xs font-semibold whitespace-nowrap ${pillContent.text}`}>
          {pillContent.label}
        </span>
        {pillContent.timer && (
          <span className={`font-mono text-xs font-bold ${pillContent.text} tabular-nums`}>
            {pillContent.timer}
          </span>
        )}
        {isCheckedIn && (
          <svg
            className={`w-3 h-3 ${pillContent.text} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* ── DROPDOWN ── */}
      {open && isCheckedIn && (
        <div
          className="absolute right-0 top-full mt-2 w-72 z-200 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{
            background: "linear-gradient(135deg, #0f1e35 0%, #1a2e4a 60%, #0d2236 100%)",
            animation: "dropIn 0.18s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Break Status</p>
              <p className={`text-sm font-bold mt-0.5 ${activeBreak ? breakMeta[activeBreak.type].pillText : "text-green-300"}`}>
                {activeBreak
                  ? `${breakMeta[activeBreak.type].icon} On ${breakMeta[activeBreak.type].label}`
                  : " Currently Working"}
              </p>
            </div>
            {activeBreak && (
              <div className="text-right">
                <p className="text-[10px] text-white/40">Since</p>
                <p className="text-xs font-semibold text-white/70">{formatClock(activeBreak.startTime)}</p>
                <p className="font-mono text-sm font-bold text-amber-300 tabular-nums">{formatHHMMSS(elapsed)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-b border-white/10 space-y-2">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Start Break</p>
            {(["MORNING", "LUNCH", "EVENING"] as BreakType[]).map((type) => {
              const meta = breakMeta[type];
              const alreadyDone = usedTypes.has(type);
              const disabled = !!activeBreak || loading || alreadyDone;
              return (
                <button
                  key={type}
                  onClick={() => startBreak(type)}
                  disabled={disabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                    transition-all duration-150
                    ${disabled
                      ? "opacity-40 cursor-not-allowed bg-white/5"
                      : `bg-linear-to-r ${meta.btnGrad} hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] cursor-pointer`
                    }
                  `}
                >
                  <span className="text-base">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white leading-none">{meta.label}</p>
                    {alreadyDone && <p className="text-[10px] text-white/60 mt-0.5">Already used today</p>}
                  </div>
                  {alreadyDone && <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">Done</span>}
                </button>
              );
            })}

            {activeBreak && (
              <button
                onClick={endBreak}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-linear-to-r from-red-500 to-rose-600 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] transition-all duration-150 mt-1"
              >
                <span className="text-base">⏹</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white leading-none">End Break</p>
                  <p className="text-[10px] text-white/70 mt-0.5">Return to working</p>
                </div>
                {loading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
              </button>
            )}
          </div>

          {/* Today Summary */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Today&apos;s Summary</p>
            {completedBreaks.length === 0 && !activeBreak ? (
              <p className="text-xs text-white/30 italic">No breaks taken yet</p>
            ) : (
              <div className="space-y-1.5">
                {breaks.map((b, i) => {
                  const meta = breakMeta[b.type];
                  const isActive = !b.endTime;
                  const dur = b.endTime
                    ? Math.floor((b.endTime.toDate().getTime() - b.startTime.toDate().getTime()) / 1000)
                    : isActive ? elapsed : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-white/70">{meta.label.split(" ")[0]}</span>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">
                              <span className="w-1 h-1 bg-amber-400 rounded-full animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/40">
                          {formatClock(b.startTime)} – {b.endTime ? formatClock(b.endTime) : "ongoing"}
                        </p>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${meta.pillText}`}>
                        {formatHHMMSS(dur)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Total */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
              <p className="text-[11px] font-bold text-white/50">Total Break</p>
              <p className="text-sm font-bold text-white font-mono tabular-nums">
                {formatHHMMSS(totalBreakSeconds)}
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}