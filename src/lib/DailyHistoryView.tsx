"use client";

import { useState, useEffect, useMemo } from "react";
import {
  fetchSnapshotDates,
  fetchSnapshotByDate,
  formatDateLabel,
  DailySnapshot,
  DailyEmployeeRecord,
} from "@/lib/dailySnapshot";

interface DailyHistoryViewProps {
  formatTime: (minutes: number) => string;
  formatTotal: (minutes: number) => string;
}

export default function DailyHistoryView({
  formatTime,
  formatTotal,
}: DailyHistoryViewProps) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Load available dates on mount
  useEffect(() => {
    fetchSnapshotDates()
      .then((d) => {
        setDates(d);
        if (d.length > 0) setSelectedDate(d[0]); // auto-select latest
      })
      .finally(() => setLoadingDates(false));
  }, []);

  // Load snapshot when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSnapshot(true);
    setSnapshot(null);
    setCurrentPage(1);
    setSearchQuery("");
    setFilterStatus("ALL");
    fetchSnapshotByDate(selectedDate)
      .then(setSnapshot)
      .finally(() => setLoadingSnapshot(false));
  }, [selectedDate]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.employees.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === "ALL" || e.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [snapshot, searchQuery, filterStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleFilterChange = (s: "ALL" | "ONLINE" | "OFFLINE") => {
    setFilterStatus(s);
    setCurrentPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  // Attendance rate
  const attendanceRate = snapshot
    ? Math.round((snapshot.onlineCount / Math.max(snapshot.totalEmployees, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="text-2xl">📅</span> Daily History
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              View employee attendance and work logs by date
            </p>
          </div>

          {/* Date Selector */}
          {loadingDates ? (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
              <span className="text-sm">Loading dates...</span>
            </div>
          ) : dates.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No historical data yet</p>
          ) : (
            <select
              value={selectedDate ?? ""}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:border-indigo-500 focus:outline-none transition-colors bg-white shadow-sm"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDateLabel(d)} {d === dates[0] ? "(Latest)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total</p>
            <p className="text-3xl font-bold text-slate-900">{snapshot.totalEmployees}</p>
            <p className="text-xs text-slate-400 mt-1">employees</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Online</p>
            <p className="text-3xl font-bold text-emerald-700">{snapshot.onlineCount}</p>
            <p className="text-xs text-emerald-400 mt-1">checked in</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Offline</p>
            <p className="text-3xl font-bold text-slate-700">{snapshot.offlineCount}</p>
            <p className="text-xs text-slate-400 mt-1">absent / not logged</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-violet-100 p-4">
            <p className="text-xs font-semibold text-violet-600 uppercase mb-1">Avg Work</p>
            <p className="text-3xl font-bold text-violet-700">{formatTotal(snapshot.avgWorkTime)}</p>
            <p className="text-xs text-violet-400 mt-1">per employee</p>
          </div>
        </div>
      )}

      {/* Attendance Bar */}
      {snapshot && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Attendance Rate</p>
            <p className="text-sm font-bold text-slate-900">{attendanceRate}%</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {snapshot.onlineCount} of {snapshot.totalEmployees} employees were online on{" "}
            {formatDateLabel(snapshot.date)}
          </p>
        </div>
      )}

      {/* Employee Table */}
      {snapshot && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-5">
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "ONLINE", "OFFLINE"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleFilterChange(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filterStatus === s
                      ? s === "ALL"
                        ? "bg-indigo-600 text-white shadow"
                        : s === "ONLINE"
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-slate-600 text-white shadow"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {s === "ALL"
                    ? `All (${snapshot.employees.length})`
                    : s === "ONLINE"
                    ? `Online (${snapshot.onlineCount})`
                    : `Offline (${snapshot.offlineCount})`}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredEmployees.length)}–
            {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of{" "}
            {filteredEmployees.length} employees
          </p>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  {["Employee", "Status", "Check-in", "Total Work", "Last Task"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((e) => (
                    <tr key={e.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                            {e.profilePhoto ? (
                              <img
                                src={e.profilePhoto}
                                alt={e.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#575797] flex items-center justify-center text-white font-bold">
                                {e.name[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{e.name}</p>
                            <p className="text-xs text-slate-500">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            e.status === "ONLINE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              e.status === "ONLINE" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {e.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">
                        {formatTime(e.morningCheckIn)}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {formatTotal(e.totalMinutes)}
                      </td>
                      <td className="px-5 py-4 text-slate-600 max-w-xs">
                        <p className="truncate" title={e.task}>
                          {e.task || <span className="italic text-slate-400">No task logged</span>}
                        </p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                      No employees match your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {paginatedEmployees.map((e) => (
              <div
                key={e.uid}
                className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-md p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shadow">
                      {e.profilePhoto ? (
                        <img src={e.profilePhoto} alt={e.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#7788ac] flex items-center justify-center text-white font-bold">
                          {e.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{e.name}</p>
                      <p className="text-xs text-slate-500">{e.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      e.status === "ONLINE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium">Check-in</p>
                    <p className="font-bold text-blue-900 text-sm">{formatTime(e.morningCheckIn)}</p>
                  </div>
                  <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium">Worked</p>
                    <p className="font-bold text-purple-900 text-sm">{formatTotal(e.totalMinutes)}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Last Task</p>
                  <p className="text-sm text-slate-800">
                    {e.task || <span className="italic text-slate-400">No task logged</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    currentPage === 1
                      ? "border-slate-100 text-slate-300 cursor-not-allowed"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      p === currentPage
                        ? "bg-indigo-600 text-white shadow"
                        : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    currentPage === totalPages
                      ? "border-slate-100 text-slate-300 cursor-not-allowed"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <span className="text-sm text-slate-500">{itemsPerPage} per page</span>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loadingSnapshot && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3" />
          <p className="text-slate-500">Loading snapshot for {selectedDate ? formatDateLabel(selectedDate) : "selected date"}...</p>
        </div>
      )}

      {/* No data state */}
      {!loadingDates && !loadingSnapshot && dates.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-14 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No history yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Daily snapshots are saved automatically each day. Come back tomorrow to see your first historical report.
          </p>
        </div>
      )}
    </div>
  );
}
