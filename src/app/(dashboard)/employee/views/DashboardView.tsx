"use client";

type Props = {
  user: any;
  isCheckedIn: boolean;
  onlineMinutes: number | null;
  attendance: any;
  sessions: any[];
  formatTotal: (min?: number) => string;
  formatTime: (ts: any) => string;
};

export default function DashboardView({
  user,
  isCheckedIn,
  onlineMinutes,
  attendance,
  sessions,
  formatTotal,
  formatTime,
}: Props) {
  return (
    <>
      {/* Welcome */}
      <div>
        <h2 className="text-3xl font-bold">
          Welcome back, {user.email?.split("@")[0]}
        </h2>

        <p className="text-gray-700 mt-1">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <Card
          title="Status"
          value={isCheckedIn ? "🟢 Online" : "⚫ Offline"}
        />

        {/* Current Session */}
        <Card
          title="Current Session"
          value={onlineMinutes !== null ? formatTotal(onlineMinutes) : "--"}
        />

        {/* Total Worked */}
        <Card
          title="Total Worked"
          value={
            attendance?.totalMinutes
              ? formatTotal(attendance.totalMinutes)
              : "--"
          }
        />

        {/* Sessions */}
        <Card title="Sessions Today" value={sessions.length} />
      </div>

      {/* Today's Sessions */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Today's Sessions</h3>

        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            <p className="font-medium">No check-in yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <span className="font-medium">Session {i + 1}</span>

                <span className="text-gray-600">
                  {formatTime(s.checkIn)}
                </span>

                <span
                  className={
                    s.checkOut
                      ? "text-gray-600"
                      : "text-blue-600 font-medium"
                  }
                >
                  {s.checkOut
                    ? formatTime(s.checkOut)
                    : "⏱️ In progress"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ✅ Reusable Card Component */
function Card({
  title,
  value,
}: {
  title: string;
  value: any;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
      <p className="text-gray-700 text-sm mb-2">{title}</p>

      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
