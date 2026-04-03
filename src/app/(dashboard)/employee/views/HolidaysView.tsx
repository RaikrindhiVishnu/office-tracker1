"use client";

type Holiday = {
  title: string;
  date: string;
  type?: string;
};

type Props = {
  holidays: Holiday[];
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function HolidaysView({ holidays }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = holidays
    .map((h) => ({ ...h, dateObj: parseLocalDate(h.date) }))
    .filter((h) => h.dateObj >= today)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (upcoming.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center justify-center gap-3 text-center">
        <span className="text-5xl">🗓️</span>
        <p className="text-lg font-semibold text-gray-500">No upcoming holidays</p>
        <p className="text-sm text-gray-400">Check back later for updates.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        maxWidth: 540,
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 24px 14px",
          borderBottom: "1px solid #f0f2f7",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 20 }}>🗓️</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d2e", letterSpacing: "-0.2px" }}>
          Holidays 2026
        </span>
        <span style={{ fontSize: 11.5, color: "#8b93a7", marginLeft: "auto", fontWeight: 500 }}>
          {upcoming.length} upcoming
        </span>
      </div>

      {/* List */}
      <div style={{ padding: "10px 0 8px" }}>
        {upcoming.map((h, i) => {
          const diffDays = Math.round(
            (h.dateObj.getTime() - today.getTime()) / 86400000
          );
          const isToday = diffDays === 0;
          const isSoon = diffDays <= 20 && !isToday;

          const badgeLabel = isToday
            ? "Today 🎉"
            : diffDays === 1
            ? "Tomorrow"
            : isSoon
            ? `${diffDays} days`
            : null;

          const badgeStyle: React.CSSProperties = isToday
            ? { background: "#dcfce7", color: "#16a34a" }
            : { background: "#fff3e0", color: "#d97706" };

          return (
            <div key={i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "11px 24px",
                  gap: 14,
                  transition: "background 0.15s",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "#f7f9fc")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                }
              >
                {/* Bullet */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />

                {/* Date */}
                <span
                  style={{ minWidth: 178, fontSize: 13, color: "#374151", fontWeight: 500 }}
                >
                  {formatDate(h.dateObj)}
                </span>

                {/* Name */}
                <span style={{ flex: 1, fontSize: 13, color: "#1a1d2e", fontWeight: 600 }}>
                  {h.title}
                </span>

                {/* Badge */}
                {badgeLabel && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 9px",
                      borderRadius: 20,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      ...badgeStyle,
                    }}
                  >
                    {badgeLabel}
                  </span>
                )}
              </div>

              {/* Divider */}
              {i < upcoming.length - 1 && (
                <div style={{ height: 1, background: "#f0f2f7", margin: "2px 24px" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}