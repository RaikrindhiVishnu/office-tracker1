"use client";

type Props = {
  sessions: any[];
  formatTime: (ts: any) => string;
};

export default function AttendanceView({
  sessions,
  formatTime,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Attendance</h2>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium">No attendance today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any, i: number) => (
            <div
              key={i}
              className="flex justify-between p-3 border-b border-gray-200"
            >
              <span className="font-medium">Session {i + 1}</span>

              <span className="text-gray-600">
                {formatTime(s.checkIn)}
              </span>

              <span className="text-gray-600">
                {s.checkOut
                  ? formatTime(s.checkOut)
                  : "In progress"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
