"use client";

type Holiday = {
  title: string;
  date: string;
  type?: string;
};

type Props = {
  holidays: Holiday[];
};

// FIX: Parse date as local time to avoid UTC off-by-one (e.g. Jan 1 showing as Dec 31 in IST)
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  National: { color: "#6366f1", icon: "🇮🇳", label: "National" },
  Festival: { color: "#f59e0b", icon: "🎊", label: "Festival" },
  Optional: { color: "#06b6d4", icon: "⭐", label: "Optional" },
};

const DEFAULT_TYPE = { color: "#10b981", icon: "🎉", label: "Holiday" };

export default function HolidaysView({ holidays }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // FIX: Sort holidays chronologically
  const sorted = [...holidays].sort(
    (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  const upcoming = sorted.filter((h) => parseLocalDate(h.date) >= today);
  const past     = sorted.filter((h) => parseLocalDate(h.date) < today);

  // FIX: Empty state
  if (holidays.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">🗓️</span>
        <p className="text-lg font-semibold text-gray-500">No holidays listed</p>
        <p className="text-sm text-gray-400">Check back later for updates.</p>
      </div>
    );
  }

  const HolidayRow = ({ h, isPast }: { h: Holiday; isPast: boolean }) => {
    const date     = parseLocalDate(h.date);
    const cfg      = TYPE_CONFIG[h.type ?? ""] ?? DEFAULT_TYPE;
    const isToday  = date.getTime() === today.getTime();

    // Days away label
    const diffMs   = date.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    const daysLabel =
      isToday      ? "Today! 🎉"                                  :
      diffDays === 1 ? "Tomorrow"                                  :
      !isPast && diffDays <= 30 ? `${diffDays} days away`         :
      null;

    return (
      <div
        className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all hover:scale-[1.01]"
        style={{
          background:  isPast ? "#f8fafc" : isToday ? `${cfg.color}08` : "#fff",
          border:      `1px solid ${isPast ? "#e2e8f0" : isToday ? cfg.color : cfg.color + "30"}`,
          opacity:     isPast ? 0.55 : 1,
        }}
      >
        {/* Date box */}
        <div
          className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 text-white"
          style={{
            background: isPast
              ? "#94a3b8"
              : `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
            boxShadow: isPast ? "none" : `0 4px 12px ${cfg.color}40`,
          }}
        >
          <span className="text-[10px] font-bold uppercase leading-none">
            {date.toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="text-xl font-black leading-tight">{date.getDate()}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${isPast ? "text-gray-500" : "text-gray-800"}`}>
            {h.title}
          </p>
          {/* FIX: Show full weekday name */}
          <p className="text-xs text-gray-400 mt-0.5">
            {date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Right badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* FIX: Show type badge */}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${cfg.color}15`, color: cfg.color }}
          >
            {cfg.icon} {cfg.label}
          </span>
          {daysLabel && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: isToday ? `${cfg.color}20` : "#f0fdf4",
                color:      isToday ? cfg.color         : "#16a34a",
              }}
            >
              {daysLabel}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-5"
        style={{ background: "linear-gradient(135deg,#f59e0b18,#6366f108)", borderBottom: "1px solid #f1f5f9" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg,#f59e0b25,#f59e0b10)", border: "1px solid #f59e0b30" }}
            >
              🎉
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Holidays 2026</h2>
              <p className="text-xs text-gray-400 mt-0.5">{upcoming.length} upcoming · {past.length} past</p>
            </div>
          </div>
          {/* Summary chips */}
          <div className="hidden sm:flex items-center gap-2">
            {[
              { label: "National", color: "#6366f1" },
              { label: "Festival", color: "#f59e0b" },
            ].map((t) => {
              const count = holidays.filter((h) => h.type === t.label).length;
              return count > 0 ? (
                <span
                  key={t.label}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: `${t.color}12`, color: t.color }}
                >
                  {count} {t.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-6">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Upcoming · {upcoming.length}
            </p>
            <div className="space-y-2">
              {upcoming.map((h, i) => (
                <HolidayRow key={i} h={h} isPast={false} />
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2">
              Past · {past.length}
            </p>
            <div className="space-y-2">
              {past.map((h, i) => (
                <HolidayRow key={i} h={h} isPast />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}