"use client";

import { useState } from "react";
import { View } from "@/types/View";
import { EmployeeRow } from "@/types/EmployeeRow";


// interface Employee {
//   uid: string;
//   name: string;
//   email: string;
//   status: "ONLINE" | "OFFLINE";
//   morningCheckIn: number;
//   totalMinutes: number;
//   task: string;
// }

interface DashboardProps {
  totalEmployees: number;
  onlineEmployees: number;
  offlineEmployees: number;
  avgWorkTime: number;
  rows: EmployeeRow[];
  busy: boolean;
  formatTime: (minutes: number) => string;
  formatTotal: (minutes: number) => string;
  setView: React.Dispatch<React.SetStateAction<View>>;
  setSelectedEmployee: React.Dispatch<
  React.SetStateAction<EmployeeRow | null>
>;

}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  trend?: string;
}

function StatCard({ title, value, icon, gradient, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mb-2">{value}</h3>
          {/* {trend && (
            <span className="text-sm font-semibold text-emerald-600">
              {trend}
            </span>
          )} */}
        </div>
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  totalEmployees,
  onlineEmployees,
  offlineEmployees,
  avgWorkTime,
  rows,
  busy,
  formatTime,
  formatTotal,
  setView,
  setSelectedEmployee,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");

  // Filter rows based on search and status
  const filteredRows = rows.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "ALL" || r.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Employees"
          value={totalEmployees}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
          gradient="from-blue-500 to-cyan-500"
          trend="+12%"
        />
        <StatCard
          title="Online Now"
          value={onlineEmployees}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          gradient="from-emerald-500 to-green-500"
          trend={`${Math.round((onlineEmployees / totalEmployees) * 100)}%`}
        />
        <StatCard
          title="Offline"
          value={offlineEmployees}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          }
          gradient="from-slate-500 to-slate-600"
        />
        <StatCard
          title="Avg Work Time"
          value={formatTotal(avgWorkTime)}
          icon={
            <svg
              className="w-8 h-8"
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
          }
          gradient="from-violet-500 to-purple-500"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filterStatus === "ALL"
                  ? "bg-[#4245ca38] text-black shadow-lg"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus("ONLINE")}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filterStatus === "ONLINE"
                  ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setFilterStatus("OFFLINE")}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filterStatus === "OFFLINE"
                  ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Offline
            </button>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {!busy &&
            filteredRows.map((r) => (
              <div
                key={r.uid}
                className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-200 p-4 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#7788ac] flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                      {r.name[0]?.toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate">{r.name}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {r.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ml-2 shadow-sm ${
                      r.status === "ONLINE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">
                      Check-in
                    </p>
                    <p className="font-bold text-blue-900">
                      {formatTime(r.morningCheckIn)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium mb-1">
                      Worked
                    </p>
                    <p className="font-bold text-purple-900">
                      {formatTotal(r.totalMinutes)}
                    </p>
                  </div>
                </div>

                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium mb-1">
                    Current Task
                  </p>
                  <p className="text-sm font-medium text-slate-800 line-clamp-2">
                    {r.task}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedEmployee(r);
                    setView("profile");
                  }}
                  className="w-full px-4 py-2.5 bg-[#5e8076] text-white rounded-xl font-semibold hover:bg-[#152b5c] transition-all shadow-md hover:shadow-lg"
                >
                  View Profile
                </button>
              </div>
            ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Current Task
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {!busy &&
                filteredRows.map((r, i) => (
                  <tr
                    key={r.uid}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#cacf82] flex items-center justify-center text-white font-bold shadow-md">
                          {r.name[0]?.toUpperCase()}
                        </div>

                        <div>
                          <div className="font-semibold text-slate-900">
                            {r.name}
                          </div>
                          <div className="text-sm text-slate-500">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                          r.status === "ONLINE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            r.status === "ONLINE"
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-slate-400"
                          }`}
                        ></span>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {formatTime(r.morningCheckIn)}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold">
                      {formatTotal(r.totalMinutes)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                      {r.task}
                    </td>
                    <td className="px-6 py-4">
                      <button
  onClick={() => {
    setSelectedEmployee(r);
    setView("profile");
  }}
  className="
    p-1
    rounded-md
    hover:bg-slate-200
    transition duration-200
    group
  "
>
  <img
    src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
    alt="View"
    draggable="false"
    className="
      w-5 h-5
      opacity-70
      group-hover:opacity-100
      group-hover:scale-110
      transition
    "
  />
</button>

                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}