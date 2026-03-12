"use client";

import { useState, useMemo } from "react";
import type { AttendanceType } from "@/types/attendance";

interface User {
  uid: string;
  name: string;
  designation?: string;
  salary?: number;
}

interface MonthlyReportProps {
  users: User[];
  monthlyDate: Date;
  setMonthlyDate: (date: Date | ((prev: Date) => Date)) => void;
  monthlyAttendance: Record<string, Record<string, AttendanceType>>;
  setMonthlyAttendance: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, AttendanceType>>>
  >;
  sessionsByDate: Record<string, any>;
  isHoliday: (dateStr: string) => any;
  saveMonthlyAttendance: (uid: string, dateStr: string, status: AttendanceType) => void;
  getAutoStatus: (params: {
    uid: string;
    dateStr: string;
    sessionsByDate: Record<string, any>;
    isHolidayDay: boolean;
  }) => AttendanceType;
  isSunday: (year: number, month: number, day: number) => boolean;
  isSecondSaturday: (year: number, month: number, day: number) => boolean;
  isFourthSaturday: (year: number, month: number, day: number) => boolean;
  isFifthSaturday: (year: number, month: number, day: number) => boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  P:   { label: "Present",  bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  A:   { label: "Absent",   bg: "bg-red-50",      text: "text-red-600",     dot: "bg-red-500",     ring: "ring-red-200"     },
  LOP: { label: "LOP",      bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   ring: "ring-amber-200"   },
  H:   { label: "Holiday",  bg: "bg-slate-100",   text: "text-slate-400",   dot: "bg-slate-400",   ring: "ring-slate-200"   },
};

const nextStatus = (current: AttendanceType): AttendanceType => {
  if (current === "H")   return "H";
  if (current === "P")   return "A";
  if (current === "A")   return "LOP";
  return "P";
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
];

export default function MonthlyReport({
  users,
  monthlyDate,
  setMonthlyDate,
  monthlyAttendance,
  setMonthlyAttendance,
  sessionsByDate,
  isHoliday,
  saveMonthlyAttendance,
  getAutoStatus,
  isSunday,
  isSecondSaturday,
  isFourthSaturday,
  isFifthSaturday,
}: MonthlyReportProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const year = monthlyDate.getFullYear();
  const month = monthlyDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = monthlyDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.designation || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [users, searchQuery]
  );

  function getDayStatuses(uid: string) {
    return Array.from({ length: daysInMonth }, (_, d) => {
      const day = d + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isHolidayDay =
        isSunday(year, month, day) ||
        isSecondSaturday(year, month, day) ||
        isFourthSaturday(year, month, day) ||
        isFifthSaturday(year, month, day) ||
        !!isHoliday(dateStr);
      const autoStatus = getAutoStatus({ uid, dateStr, sessionsByDate, isHolidayDay });
      return {
        dateStr,
        status: (isHolidayDay ? "H" : monthlyAttendance[uid]?.[dateStr] ?? autoStatus) as AttendanceType,
        isHolidayDay,
      };
    });
  }

  // Summary stats across all users
  const totalStats = useMemo(() => {
    let totalP = 0, totalA = 0, totalLOP = 0;
    users.forEach((u) => {
      const statuses = getDayStatuses(u.uid);
      totalP   += statuses.filter((s) => s.status === "P").length;
      totalA   += statuses.filter((s) => s.status === "A").length;
      totalLOP += statuses.filter((s) => s.status === "LOP").length;
    });
    return { totalP, totalA, totalLOP };
  }, [users, monthlyAttendance, monthlyDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans">
      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Title + Month Nav */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Attendance</p>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Monthly Report</h1>
            </div>
            <div className="flex items-center gap-1 ml-4 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setMonthlyDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all"
              >
                ‹
              </button>
              <span className="px-4 py-1.5 text-sm font-semibold text-slate-800 min-w-[130px] text-center">
                {monthLabel}
              </span>
              <button
                onClick={() => setMonthlyDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all"
              >
                ›
              </button>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee..."
                className="pl-9 pr-4 py-2 text-sm bg-slate-100 rounded-xl border-0 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all w-48"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Grid
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* ── SUMMARY STATS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Employees", value: users.length, icon: "👥", color: "from-blue-500 to-indigo-600", light: "bg-blue-50 text-blue-700" },
            { label: "Total Present",   value: totalStats.totalP,   icon: "✅", color: "from-emerald-500 to-teal-600", light: "bg-emerald-50 text-emerald-700" },
            { label: "Total Absent",    value: totalStats.totalA,   icon: "❌", color: "from-red-500 to-rose-600", light: "bg-red-50 text-red-700" },
            { label: "Loss of Pay",     value: totalStats.totalLOP, icon: "⚠️", color: "from-amber-500 to-orange-600", light: "bg-amber-50 text-amber-700" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${stat.light}`}>{stat.label}</span>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── LEGEND ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Legend:</span>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {key} — {cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            Public Holiday
          </div>
        </div>

        {/* ── GRID VIEW ── */}
        {view === "grid" && (
          <div className="space-y-3">
            {filteredUsers.map((u, idx) => {
              const dayStatuses = getDayStatuses(u.uid);
              const presentCount = dayStatuses.filter((s) => s.status === "P").length;
              const absentCount  = dayStatuses.filter((s) => s.status === "A").length;
              const lopCount     = dayStatuses.filter((s) => s.status === "LOP").length;
              const workingDays  = dayStatuses.filter((s) => s.status !== "H").length;
              const attendancePct = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

              return (
                <div key={u.uid} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  {/* Employee header bar */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0`}>
                      {getInitials(u.name)}
                    </div>

                    {/* Name + designation */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{u.name}</div>
                      <div className="text-xs text-slate-400 truncate">{u.designation}</div>
                    </div>

                    {/* Mini stats */}
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-600">{presentCount}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Present</div>
                      </div>
                      <div className="w-px h-8 bg-slate-100" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-500">{absentCount}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Absent</div>
                      </div>
                      <div className="w-px h-8 bg-slate-100" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">{lopCount}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">LOP</div>
                      </div>
                      <div className="w-px h-8 bg-slate-100" />
                      {/* Attendance bar */}
                      <div className="flex flex-col items-end gap-1 w-28">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Attendance</span>
                          <span className={`text-xs font-bold ${attendancePct >= 75 ? "text-emerald-600" : "text-red-500"}`}>{attendancePct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${attendancePct >= 75 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${attendancePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Day cells */}
                  <div className="px-4 py-3 overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                      {dayStatuses.map(({ dateStr, status, isHolidayDay }, d) => {
                        const day = d + 1;
                        const dateObj = new Date(year, month, day);
                        const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "narrow" });
                        const cfg = STATUS_CONFIG[status];
                        const cellKey = `${u.uid}-${dateStr}`;
                        const isPublicHoliday = !!isHoliday(dateStr) && !isSunday(year, month, day) && !isSecondSaturday(year, month, day) && !isFourthSaturday(year, month, day) && !isFifthSaturday(year, month, day);

                        return (
                          <div
                            key={d}
                            className="flex flex-col items-center gap-0.5 group relative"
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {/* Day number */}
                            <span className="text-[9px] text-slate-400 font-medium w-7 text-center">{day}</span>
                            <span className="text-[8px] text-slate-300 w-7 text-center">{dayName}</span>

                            {/* Status cell */}
                            <button
                              onClick={() => {
                                if (isHolidayDay) return;
                                const newStatus = nextStatus(status);
                                setMonthlyAttendance((prev) => ({
                                  ...prev,
                                  [u.uid]: { ...(prev[u.uid] || {}), [dateStr]: newStatus },
                                }));
                                saveMonthlyAttendance(u.uid, dateStr, newStatus);
                              }}
                              className={`
                                w-7 h-7 rounded-lg text-[9px] font-bold transition-all
                                ${cfg.bg} ${cfg.text}
                                ${isHolidayDay ? "cursor-default opacity-60" : "cursor-pointer hover:scale-110 hover:shadow-md hover:ring-2 " + cfg.ring}
                                ${isPublicHoliday ? "ring-2 ring-violet-300" : ""}
                                flex items-center justify-center
                              `}
                            >
                              {status === "LOP" ? "L" : status}
                            </button>

                            {/* Tooltip */}
                            {hoveredCell === cellKey && (
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                                <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap font-medium shadow-lg">
                                  {dateStr}<br />
                                  <span className={cfg.text.replace("text-", "text-")}>{cfg.label}</span>
                                  {!isHolidayDay && <span className="text-slate-400"> · click to toggle</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIST / TABLE VIEW ── */}
        {view === "list" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs border-collapse min-w-[1100px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-slate-800 text-white">
                    <th className="sticky left-0 z-40 bg-slate-800 px-4 py-3 text-left font-semibold w-44 rounded-tl-none">
                      Employee
                    </th>
                    {Array.from({ length: daysInMonth }).map((_, d) => {
                      const dateObj = new Date(year, month, d + 1);
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                      const holiday = isHoliday(dateStr);
                      return (
                        <th
                          key={d}
                          className={`border-l border-slate-700 px-1.5 py-2 text-center font-semibold ${
                            holiday ? "bg-violet-700/60" : isWeekend ? "bg-slate-700" : ""
                          }`}
                        >
                          <div className="text-[11px]">{d + 1}</div>
                          <div className="text-[9px] text-slate-300 font-normal">
                            {dateObj.toLocaleDateString("en-IN", { weekday: "narrow" })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="border-l border-slate-700 px-2 py-2 bg-emerald-700/60 text-center">P</th>
                    <th className="border-l border-slate-700 px-2 py-2 bg-red-700/60 text-center">A</th>
                    <th className="border-l border-slate-700 px-2 py-2 bg-amber-700/60 text-center">LOP</th>
                    <th className="border-l border-slate-700 px-2 py-2 bg-blue-700/60 text-center whitespace-nowrap">Days</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((u, idx) => {
                    const dayStatuses = getDayStatuses(u.uid);
                    const presentCount = dayStatuses.filter((s) => s.status === "P").length;
                    const absentCount  = dayStatuses.filter((s) => s.status === "A").length;
                    const lopCount     = dayStatuses.filter((s) => s.status === "LOP").length;
                    const workingDays  = dayStatuses.filter((s) => s.status !== "H").length;
                    const avatarColor  = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                    return (
                      <tr key={u.uid} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                        <td className="sticky left-0 bg-white border-r border-slate-100 px-3 py-2.5 z-20 hover:bg-blue-50/30">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 text-[11px]">{u.name}</div>
                              <div className="text-[9px] text-slate-400">{u.designation}</div>
                            </div>
                          </div>
                        </td>

                        {dayStatuses.map(({ dateStr, status, isHolidayDay }, d) => {
                          const cfg = STATUS_CONFIG[status];
                          return (
                            <td key={d} className="border border-slate-100 text-center p-0.5">
                              <button
                                onClick={() => {
                                  if (isHolidayDay) return;
                                  const newStatus = nextStatus(status);
                                  setMonthlyAttendance((prev) => ({
                                    ...prev,
                                    [u.uid]: { ...(prev[u.uid] || {}), [dateStr]: newStatus },
                                  }));
                                  saveMonthlyAttendance(u.uid, dateStr, newStatus);
                                }}
                                className={`w-full h-8 text-[10px] font-bold rounded transition-all ${cfg.bg} ${cfg.text} ${
                                  isHolidayDay ? "cursor-default opacity-50" : "hover:scale-95 hover:shadow-sm cursor-pointer"
                                }`}
                              >
                                {status === "LOP" ? "L" : status}
                              </button>
                            </td>
                          );
                        })}

                        <td className="border border-slate-100 text-center font-bold text-emerald-600 bg-emerald-50/50 text-xs">{presentCount}</td>
                        <td className="border border-slate-100 text-center font-bold text-red-500 bg-red-50/50 text-xs">{absentCount}</td>
                        <td className="border border-slate-100 text-center font-bold text-amber-600 bg-amber-50/50 text-xs">{lopCount}</td>
                        <td className="border border-slate-100 text-center font-bold text-blue-600 bg-blue-50/50 text-xs">{workingDays}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg font-semibold">No employees found</p>
            <p className="text-sm">Try adjusting your search query</p>
          </div>
        )}
      </div>
    </div>
  );
}