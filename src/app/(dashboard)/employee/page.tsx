"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import {
  checkIn,
  checkOut,
  getTodayAttendance,
} from "@/lib/attendance";
import { saveDailyUpdate } from "@/lib/dailyUpdates";

/* ================= TYPES ================= */
type ViewType =
  | "dashboard"
  | "work-update"
  | "attendance"
  | "notifications"
  | "weekly-report"
  | "monthly-report"
  | "attendance-summary"
  | "calendar"
  | "holidays"
  | "leave-history"
  | "profile"
  | "help";

/* ================= HELPERS ================= */
const formatTime = (ts: any) =>
  ts
    ? ts.toDate().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

const formatTotal = (min = 0) =>
  `${Math.floor(min / 60)}h ${min % 60}m`;

const minutesSince = (ts: any) =>
  Math.floor((Date.now() - ts.toDate().getTime()) / 60000);

/* ================= COMPONENT ================= */
export default function EmployeeDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeView, setActiveView] =
    useState<ViewType>("dashboard");

  const [attendance, setAttendance] = useState<any>(null);
  const [onlineMinutes, setOnlineMinutes] =
    useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [messages, setMessages] = useState<string[]>([]);

  /* ---------- Load Attendance ---------- */
  const loadAttendance = async () => {
    if (!user) return;
    const data = await getTodayAttendance(user.uid);
    setAttendance(data);
  };

  useEffect(() => {
    if (!loading && user) loadAttendance();
  }, [loading, user]);

  /* ---------- Live Session Timer ---------- */
  useEffect(() => {
    if (!attendance?.sessions?.length) return;

    const last = attendance.sessions.at(-1);
    if (!last || last.checkOut) {
      setOnlineMinutes(null);
      return;
    }

    const update = () =>
      setOnlineMinutes(minutesSince(last.checkIn));

    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [attendance]);

  /* ---------- Admin Messages ---------- */
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => d.data().text))
    );
  }, []);

  if (loading || !user) return null;

  const sessions = attendance?.sessions || [];
  const lastSession = sessions.at(-1);
  const isCheckedIn = lastSession && !lastSession.checkOut;

  /* ---------- Save Work Update ---------- */
  const handleSaveUpdate = async () => {
    if (!task && !notes) {
      setMsg("Please add task or notes");
      return;
    }

    try {
      setSaving(true);
      setMsg("");
      await saveDailyUpdate(user.uid, task, notes);
      setMsg("✅ Update saved");
      setTask("");
      setNotes("");
    } catch {
      setMsg("❌ Failed to save update");
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="h-screen flex bg-[#f4f6f8] overflow-hidden">
      {/* ============== SIDEBAR ============== */}
      <aside className="w-64 bg-[#0b3a5a] text-white flex flex-col">
        <div className="p-6 text-xl font-semibold">
          🕒 Office Tracker
        </div>

        <div className="px-6 py-4 border-b border-white/10">
          <p className="font-medium">
            {user.email?.split("@")[0]}
          </p>
          <p className="text-xs text-white/70">
            Employee
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 text-sm">
          {[
            ["dashboard", "Dashboard"],
            ["work-update", "Work Update"],
            ["attendance", "Attendance"],
            ["notifications", "Notifications"],
            ["weekly-report", "Weekly Report"],
            ["monthly-report", "Monthly Report"],
            ["attendance-summary", "Attendance Summary"],
            ["calendar", "Calendar"],
            ["holidays", "Holidays"],
            ["leave-history", "Leave / LOP History"],
            ["profile", "My Profile"],
            ["help", "Help & Queries"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() =>
                setActiveView(id as ViewType)
              }
              className={`w-full text-left px-4 py-2 rounded ${
                activeView === id
                  ? "bg-white/10"
                  : "hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

       <button
  onClick={async () => {
    await signOut(auth);
    router.push("/login");
  }}
  className="
    mx-4 mb-4 mt-auto
    flex items-center gap-4
    rounded-full
    px-6 py-3
    text-sm font-semibold
    text-white
    bg-gradient-to-r from-red-400 to-orange-400
    shadow-md
    hover:shadow-lg
    transition-all
    active:scale-[0.98]
  "
>
  {/* LOGOUT ICON */}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-5 h-5"
  >
    {/* Arrow */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 12H9m0 0l3-3m-3 3l3 3"
    />
  </svg>

  <span className="tracking-wide">LOGOUT</span>
</button>

      </aside>

      {/* ============== RIGHT SIDE ============== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ANNOUNCEMENTS */}
        {messages.length > 0 && (
          <div className="bg-orange-400 text-white py-2 overflow-hidden">
            <style jsx>{`
              @keyframes marquee {
                0% {
                  transform: translateX(100%);
                }
                100% {
                  transform: translateX(-100%);
                }
              }
              .marquee {
                display: inline-flex;
                gap: 40px;
                white-space: nowrap;
                animation: marquee 22s linear infinite;
              }
            `}</style>
            <div className="marquee px-6 text-lg">
              {messages.map((m, i) => (
                <span key={i}>📣 {m}</span>
              ))}
            </div>
          </div>
        )}

        {/* HEADER */}
        <header className="bg-white border-b px-6 py-4 flex justify-between">
          <h1 className="text-xl font-semibold capitalize">
            {activeView.replace("-", " ")}
          </h1>

          <div className="flex gap-3">
            <button
              disabled={busy || isCheckedIn}
              onClick={async () => {
                setBusy(true);
                await checkIn(user.uid);
                await loadAttendance();
                setBusy(false);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Check In
            </button>

            <button
              disabled={busy || !isCheckedIn}
              onClick={async () => {
                setBusy(true);
                await checkOut(user.uid);
                await loadAttendance();
                setBusy(false);
              }}
              className="border px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Check Out
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* ========== DASHBOARD ========== */}
          {activeView === "dashboard" && (
            <>
              <div>
                <h2 className="text-3xl font-semibold">
                  Welcome back, {user.email?.split("@")[0]}
                </h2>
                <p className="text-gray-500 mt-1">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <Stat
                  title="Status"
                  value={isCheckedIn ? "Online" : "Offline"}
                />
                <Stat
                  title="Current Session"
                  value={
                    onlineMinutes !== null
                      ? formatTotal(onlineMinutes)
                      : "--"
                  }
                />
                <Stat
                  title="Total Worked"
                  value={
                    attendance?.totalMinutes
                      ? formatTotal(attendance.totalMinutes)
                      : "--"
                  }
                />
                <Stat
                  title="Sessions Today"
                  value={sessions.length}
                />
              </div>

              <div className="bg-white rounded-xl shadow p-8">
                <h3 className="text-lg font-semibold mb-6">
                  Today&apos;s Attendance
                </h3>

                {sessions.length === 0 ? (
                  <p className="text-gray-500 text-center">
                    No check-in yet
                  </p>
                ) : (
                  sessions.map((s: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between border-b py-2 text-sm"
                    >
                      <span>Session {i + 1}</span>
                      <span>{formatTime(s.checkIn)}</span>
                      <span>
                        {s.checkOut
                          ? formatTime(s.checkOut)
                          : "In progress"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-white rounded-xl shadow p-8 space-y-4">
                <h3 className="text-lg font-semibold">
                  Today&apos;s Work Update
                </h3>

                <input
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="What are you working on?"
                  className="w-full border rounded-xl px-4 py-3"
                />

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes..."
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3"
                />

                <button
                  onClick={handleSaveUpdate}
                  disabled={saving}
                  className="bg-[#0b3a5a] text-white px-6 py-3 rounded-xl"
                >
                  Save Update
                </button>

                {msg && (
                  <p className="text-sm text-gray-600">{msg}</p>
                )}
              </div>
            </>
          )}

          {/* ========== OTHER VIEWS PLACEHOLDER ========== */}
        {/* ========== WORK UPDATE ========== */}
{activeView === "work-update" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Work Update</h2>

    <input
      value={task}
      onChange={(e) => setTask(e.target.value)}
      placeholder="What are you working on?"
      className="w-full border rounded-xl px-4 py-3"
    />

    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder="Notes or progress details..."
      rows={4}
      className="w-full border rounded-xl px-4 py-3"
    />

    <button
      onClick={handleSaveUpdate}
      disabled={saving}
      className="bg-[#0b3a5a] text-white px-6 py-3 rounded-xl disabled:opacity-50"
    >
      Save Update
    </button>

    {msg && (
      <p className="text-sm text-gray-600">{msg}</p>
    )}
  </div>
)}

{/* ========== ATTENDANCE ========== */}
{activeView === "attendance" && (
  <div className="bg-white rounded-xl shadow p-8">
    <h2 className="text-xl font-semibold mb-6">Attendance</h2>

    {sessions.length === 0 ? (
      <div className="text-center text-gray-500 py-12">
        <div className="text-5xl mb-4">🕒</div>
        <p className="font-medium">No attendance today</p>
        <p className="text-sm">
          Click "Check In" to start your day
        </p>
      </div>
    ) : (
      <div className="space-y-3 text-sm">
        {sessions.map((s: any, i: number) => (
          <div
            key={i}
            className="flex justify-between border-b pb-2"
          >
            <span>Session {i + 1}</span>
            <span>{formatTime(s.checkIn)}</span>
            <span>
              {s.checkOut
                ? formatTime(s.checkOut)
                : "In progress"}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* ========== NOTIFICATIONS ========== */}
{activeView === "notifications" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Notifications</h2>

    {messages.length === 0 ? (
      <div className="text-center text-gray-500 py-12">
        <p className="font-medium">No notifications</p>
        <p className="text-sm">You’re all caught up 🎉</p>
      </div>
    ) : (
      <div className="space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className="border rounded-lg p-4 bg-gray-50"
          >
            <p className="text-sm">📣 {m}</p>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* ========== WEEKLY REPORT ========== */}
{activeView === "weekly-report" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">
      Weekly Report (Last 7 Days)
    </h2>

    {!attendance?.history?.length ? (
      <p className="text-gray-500">
        No weekly data available
      </p>
    ) : (
      <>
        {/* SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat
            title="Total Hours"
            value={formatTotal(
              attendance.history
                .slice(-7)
                .reduce(
                  (t: number, d: any) =>
                    t + (d.totalMinutes || 0),
                  0
                )
            )}
          />

          <Stat
            title="Present Days"
            value={
              attendance.history
                .slice(-7)
                .filter((d: any) => d.status === "present")
                .length
            }
          />

          <Stat
            title="Total Sessions"
            value={
              attendance.history
                .slice(-7)
                .reduce(
                  (t: number, d: any) =>
                    t + (d.sessions?.length || 0),
                  0
                )
            }
          />
        </div>

        {/* TABLE */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Hours</th>
                <th className="p-3 text-left">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {attendance.history
                .slice(-7)
                .map((d: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{d.date}</td>
                    <td className="p-3 capitalize">
                      {d.status}
                    </td>
                    <td className="p-3">
                      {formatTotal(d.totalMinutes || 0)}
                    </td>
                    <td className="p-3">
                      {d.sessions?.length || 0}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
)}

{/* ========== MONTHLY REPORT ========== */}
{activeView === "monthly-report" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">
      Monthly Report ({new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })})
    </h2>

    {!attendance?.history?.length ? (
      <p className="text-gray-500">No monthly data available</p>
    ) : (
      <>
        {(() => {
          const now = new Date();
          const month = now.getMonth();
          const year = now.getFullYear();

          const monthly = attendance.history.filter((d: any) => {
            const dt = new Date(d.date);
            return dt.getMonth() === month && dt.getFullYear() === year;
          });

          const totalMinutes = monthly.reduce(
            (t: number, d: any) => t + (d.totalMinutes || 0),
            0
          );

          const present = monthly.filter((d: any) => d.status === "present").length;
          const absent = monthly.filter((d: any) => d.status === "absent").length;
          const lop = monthly.filter((d: any) => d.status === "lop").length;
          const workingDays = monthly.length;
          const attendancePct =
            workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;

          return (
            <>
              {/* SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Stat title="Total Hours" value={formatTotal(totalMinutes)} />
                <Stat title="Present Days" value={present} />
                <Stat title="Absent Days" value={absent} />
                <Stat title="Attendance %" value={`${attendancePct}%`} />
              </div>

              {/* TABLE */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Hours</th>
                      <th className="p-3 text-left">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((d: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-3">{d.date}</td>
                        <td className="p-3 capitalize">{d.status}</td>
                        <td className="p-3">{formatTotal(d.totalMinutes || 0)}</td>
                        <td className="p-3">{d.sessions?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </>
    )}
  </div>
)}

{/* ========== ATTENDANCE SUMMARY ========== */}
{activeView === "attendance-summary" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">
      Attendance Summary (Overall)
    </h2>

    {!attendance?.history?.length ? (
      <p className="text-gray-500">No attendance data available</p>
    ) : (
      <>
        {(() => {
          const all = attendance.history;

          const totalMinutes = all.reduce(
            (t: number, d: any) => t + (d.totalMinutes || 0),
            0
          );

          const present = all.filter((d: any) => d.status === "present").length;
          const absent = all.filter((d: any) => d.status === "absent").length;
          const lop = all.filter((d: any) => d.status === "lop").length;
          const holidays = all.filter((d: any) => d.status === "holiday").length;

          const totalDays = all.length;
          const attendancePct =
            totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

          const avgDailyMinutes =
            present > 0 ? Math.round(totalMinutes / present) : 0;

          return (
            <>
              {/* SUMMARY CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Stat title="Total Hours" value={formatTotal(totalMinutes)} />
                <Stat title="Present Days" value={present} />
                <Stat title="Absent Days" value={absent} />
                <Stat title="Attendance %" value={`${attendancePct}%`} />
              </div>

              {/* EXTRA METRICS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Stat title="LOP Days" value={lop} />
                <Stat title="Holidays" value={holidays} />
                <Stat
                  title="Avg Daily Hours"
                  value={formatTotal(avgDailyMinutes)}
                />
              </div>
            </>
          );
        })()}
      </>
    )}
  </div>
)}

{/* ========== CALENDAR ========== */}
{activeView === "calendar" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Attendance Calendar</h2>

    {(() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDay = firstDay.getDay();

      const getStatus = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rec = attendance?.history?.find((d: any) => d.date === dateStr);
        return rec?.status || null;
      };

      const days: any[] = [];

      for (let i = 0; i < startDay; i++) {
        days.push(<div key={`e-${i}`} />);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const status = getStatus(d);
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isToday = dateStr === today.toISOString().split("T")[0];
        const isWeekend = [0, 6].includes(new Date(dateStr).getDay());

        days.push(
          <div
            key={d}
            className={`h-12 flex items-center justify-center rounded-lg text-sm font-medium
              ${isToday ? "ring-2 ring-blue-500" : ""}
              ${isWeekend ? "bg-gray-100 text-gray-400" : ""}
              ${status === "present" ? "bg-green-100 text-green-700" : ""}
              ${status === "absent" ? "bg-red-100 text-red-700" : ""}
              ${status === "lop" ? "bg-yellow-100 text-yellow-700" : ""}
              ${status === "holiday" ? "bg-gray-200 text-gray-600" : ""}
            `}
          >
            {d}
          </div>
        );
      }

      return (
        <>
          <p className="text-gray-500">
            {today.toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </p>

          <div className="grid grid-cols-7 gap-2 text-center text-sm text-gray-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days}
          </div>

          {/* LEGEND */}
          <div className="flex flex-wrap gap-4 text-sm pt-4">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-green-100 rounded" /> Present
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-red-100 rounded" /> Absent
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-yellow-100 rounded" /> LOP
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded" /> Holiday
            </span>
          </div>
        </>
      );
    })()}
  </div>
)}

{/* ========== HOLIDAYS ========== */}
{activeView === "holidays" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Holidays</h2>

    {[
      { date: "2025-01-01", name: "New Year" },
      { date: "2025-01-26", name: "Republic Day" },
      { date: "2025-03-14", name: "Holi" },
      { date: "2025-08-15", name: "Independence Day" },
      { date: "2025-10-02", name: "Gandhi Jayanti" },
      { date: "2025-12-25", name: "Christmas" },
    ].map((h, i) => (
      <div
        key={i}
        className="flex justify-between items-center border-b py-3"
      >
        <span className="font-medium">{h.name}</span>
        <span className="text-sm text-gray-500">
          {new Date(h.date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
    ))}
  </div>
)}

{/* ========== LEAVE / LOP HISTORY ========== */}
{activeView === "leave-history" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Leave / LOP History</h2>

    {!attendance?.leaves?.length ? (
      <p className="text-gray-500">No leave history available</p>
    ) : (
      <div className="space-y-4">
        {attendance.leaves.map((l: any, i: number) => (
          <div
            key={i}
            className="border rounded-lg p-4 flex justify-between items-start"
          >
            <div>
              <p className="font-medium capitalize">
                {l.type} ({l.status})
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {l.reason || "—"}
              </p>
            </div>

            <div className="text-sm text-gray-500">
              {new Date(l.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* ========== MY PROFILE ========== */}
{activeView === "profile" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">My Profile</h2>

    <div className="flex items-center gap-6">
      <div className="w-24 h-24 rounded-full bg-[#0b3a5a] text-white flex items-center justify-center text-3xl font-semibold">
        {user.email?.[0]?.toUpperCase()}
      </div>

      <div>
        <p className="text-lg font-medium">
          {user.email?.split("@")[0]}
        </p>
        <p className="text-sm text-gray-500">
          {user.email}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Employee
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ProfileField label="Email" value={user.email} />
      <ProfileField label="Role" value="Employee" />
      <ProfileField label="Account Status" value="Active" />
      <ProfileField
        label="Joined On"
        value={
          attendance?.joinedAt
            ? new Date(attendance.joinedAt).toLocaleDateString("en-IN")
            : "—"
        }
      />
    </div>

    <p className="text-sm text-gray-500">
      Profile editing is managed by Admin / HR
    </p>
  </div>
)}

{/* ========== HELP & QUERIES ========== */}
{activeView === "help" && (
  <div className="bg-white rounded-xl shadow p-8 space-y-6">
    <h2 className="text-xl font-semibold">Help & Queries</h2>

    <div className="space-y-4">
      <input
        placeholder="Subject"
        className="w-full border rounded-xl px-4 py-3"
        id="query-subject"
      />

      <textarea
        placeholder="Describe your issue..."
        rows={4}
        className="w-full border rounded-xl px-4 py-3"
        id="query-message"
      />

      <button
        onClick={async () => {
          const subject = (
            document.getElementById("query-subject") as HTMLInputElement
          )?.value;
          const message = (
            document.getElementById("query-message") as HTMLTextAreaElement
          )?.value;

          if (!subject || !message) return;

          await fetch("/api/help", {
            method: "POST",
            body: JSON.stringify({
              uid: user.uid,
              subject,
              message,
            }),
          });

          alert("Query submitted");
        }}
        className="bg-[#0b3a5a] text-white px-6 py-3 rounded-xl"
      >
        Submit Query
      </button>
    </div>

    {/* PREVIOUS QUERIES */}
    <div className="space-y-4 pt-6">
      <h3 className="font-medium">Previous Queries</h3>

      {!attendance?.queries?.length ? (
        <p className="text-sm text-gray-500">
          No previous queries
        </p>
      ) : (
        attendance.queries.map((q: any, i: number) => (
          <div
            key={i}
            className="border rounded-lg p-4 space-y-2"
          >
            <p className="font-medium">{q.subject}</p>
            <p className="text-sm text-gray-500">{q.message}</p>

            {q.reply && (
              <div className="bg-green-50 border-l-4 border-green-500 p-3 text-sm">
                <strong>Admin Reply:</strong> {q.reply}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </div>
)}

        </main>
      </div>
    </div>
  );
}

/* ================= STAT ================= */
function Stat({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-gray-500 text-sm mb-2">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
function ProfileField({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium mt-1">{value || "—"}</p>
    </div>
  );
}
