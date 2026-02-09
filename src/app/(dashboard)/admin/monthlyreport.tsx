"use client";

import { useState } from "react";

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
  monthlyAttendance: Record<string, Record<string, string>>;
  setMonthlyAttendance: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  sessionsByDate: Record<string, any>;
  isHoliday: (dateStr: string) => any;
  saveMonthlyAttendance: (uid: string, dateStr: string, status: string) => void;
  getAutoStatus: (params: {
    uid: string;
    dateStr: string;
    sessionsByDate: Record<string, any>;
    isHolidayDay: boolean;
  }) => string;
  isSunday: (year: number, month: number, day: number) => boolean;
  isSecondSaturday: (year: number, month: number, day: number) => boolean;
  isFourthSaturday: (year: number, month: number, day: number) => boolean;
  isFifthSaturday: (year: number, month: number, day: number) => boolean;
}

const attendanceStyle: Record<string, string> = {
  P: "bg-emerald-100 text-emerald-700",
  A: "bg-rose-100 text-rose-700",
  LOP: "bg-violet-100 text-violet-700",
  H: "bg-slate-200 text-slate-600",
};

const nextStatus = (current: string): string => {
  if (current === "P") return "A";
  if (current === "A") return "LOP";
  return "P";
};

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
  const [openExcel, setOpenExcel] = useState(false);
  const [extraCols, setExtraCols] = useState<Record<string, string[]>>({});
  const [extraData, setExtraData] = useState<any>({});

  const year = monthlyDate.getFullYear();
  const month = monthlyDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Monthly Attendance Report
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setMonthlyDate(
                (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
              )
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            ←
          </button>

          <div className="px-4 py-1 bg-indigo-600 text-white rounded font-semibold">
            {monthlyDate.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </div>

          <button
            onClick={() =>
              setMonthlyDate(
                (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
              )
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="w-full max-h-[520px] overflow-auto border rounded-lg">
        <table className="border-collapse w-full text-[10px] sm:text-xs min-w-[1000px]">
          {/* HEADER */}
          <thead className="sticky top-0 z-30 bg-slate-100">
            <tr>
              <th className="border px-3 py-2 sticky left-0 bg-slate-200 z-40 w-44 text-left">
                Employee
              </th>

              {Array.from({ length: daysInMonth }).map((_, d) => {
                const dateObj = new Date(year, month, d + 1);
                const dayName = dateObj.toLocaleDateString("en-IN", {
                  weekday: "short",
                });

                const isWeekend =
                  dateObj.getDay() === 0 || dateObj.getDay() === 6;

                const dateStr = `${year}-${String(month + 1).padStart(
                  2,
                  "0"
                )}-${String(d + 1).padStart(2, "0")}`;

                const holiday = isHoliday(dateStr);

                return (
                  <th
                    key={d}
                    className={`border px-2 py-1 text-center ${
                      holiday
                        ? "bg-violet-100"
                        : isWeekend
                        ? "bg-rose-100"
                        : ""
                    }`}
                  >
                    <div className="font-bold">{d + 1}</div>
                    <div className="text-[10px] text-slate-600">
                      {dayName}
                    </div>
                  </th>
                );
              })}

              <th className="border px-2 bg-emerald-50">P</th>
              <th className="border px-2 bg-rose-50">A</th>
              <th className="border px-2 bg-violet-50">LOP</th>
              <th className="border px-2 py-2 bg-blue-100">Total Days</th>
              <th className="border px-2 bg-green-100">Net</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {users.map((u) => {
              const dayStatuses = Array.from(
                { length: daysInMonth },
                (_, d) => {
                  const day = d + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(
                    2,
                    "0"
                  )}-${String(day).padStart(2, "0")}`;

                  const isHolidayDay =
                    isSunday(year, month, day) ||
                    isSecondSaturday(year, month, day) ||
                    isFourthSaturday(year, month, day) ||
                    isFifthSaturday(year, month, day) ||
                    !!isHoliday(dateStr);

                  const autoStatus = getAutoStatus({
                    uid: u.uid,
                    dateStr,
                    sessionsByDate,
                    isHolidayDay,
                  });

                  return isHolidayDay
                    ? "H"
                    : monthlyAttendance[u.uid]?.[dateStr] ?? autoStatus;
                }
              );

              const presentCount = dayStatuses.filter((s) => s === "P").length;
              const absentCount = dayStatuses.filter((s) => s === "A").length;
              const lopCount = dayStatuses.filter((s) => s === "LOP").length;

              const salary = u.salary ?? 0;
              const perDay = salary / daysInMonth;
              const netPay = Math.round(perDay * presentCount);

              const totalWorkingDays = dayStatuses.filter(
                (s) => s !== "H"
              ).length;

              return (
                <tr key={u.uid} className="hover:bg-slate-50">
                  {/* EMPLOYEE */}
                  <td className="sticky left-0 bg-white border px-3 py-2 z-20">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {u.designation}
                    </div>
                  </td>

                  {/* DAY CELLS */}
                  {dayStatuses.map((status, d) => {
                    const day = d + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(
                      2,
                      "0"
                    )}-${String(day).padStart(2, "0")}`;

                    return (
                      <td
                        key={d}
                        onClick={() => {
                          if (status === "H") return;

                          const newStatus = nextStatus(status);

                          setMonthlyAttendance((prev) => ({
                            ...prev,
                            [u.uid]: {
                              ...(prev[u.uid] || {}),
                              [dateStr]: newStatus,
                            },
                          }));

                          saveMonthlyAttendance(u.uid, dateStr, newStatus);
                        }}
                        className={`border h-9 text-center font-bold cursor-pointer ${attendanceStyle[status]}`}
                      >
                        {status}
                      </td>
                    );
                  })}

                  <td className="border text-center bg-emerald-50 font-bold">
                    {presentCount}
                  </td>
                  <td className="border text-center bg-rose-50 font-bold">
                    {absentCount}
                  </td>
                  <td className="border text-center bg-violet-50 font-bold">
                    {lopCount}
                  </td>
                  <td className="border text-center bg-blue-50 font-bold">
                    {totalWorkingDays}
                  </td>

                  <td className="border text-center bg-green-100 font-bold text-green-700">
                    ₹{netPay}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* OPEN EXCEL BUTTON */}
      <button
        onClick={() => setOpenExcel(true)}
        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all"
      >
        Open Excel View
      </button>

      {/* EXCEL MODAL */}
      {openExcel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-[98%] h-[95%] rounded-xl shadow-xl flex flex-col">
            {/* HEADER */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">
                Excel Attendance –{" "}
                {monthlyDate.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const monthKey = `${year}-${String(month + 1).padStart(
                      2,
                      "0"
                    )}`;
                    setExtraCols((cols) => ({
                      ...cols,
                      [monthKey]: [
                        ...(cols[monthKey] || []),
                        `Column ${(cols[monthKey] || []).length + 1}`,
                      ],
                    }));
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-all"
                >
                  + Column
                </button>

                <button
                  onClick={() => setOpenExcel(false)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* TABLE */}
            <div className="flex-1 overflow-auto">
              <table className="border-collapse w-full text-xs min-w-[1200px]">
                <thead className="sticky top-0 bg-slate-100 z-30">
                  <tr>
                    <th className="border px-3 py-2 sticky left-0 bg-slate-200 z-40 w-44">
                      Employee
                    </th>

                    {/* DAYS */}
                    {Array.from({ length: daysInMonth }).map((_, d) => {
                      const dateObj = new Date(year, month, d + 1);
                      const dayName = dateObj.toLocaleDateString("en-IN", {
                        weekday: "short",
                      });

                      const isWeekend =
                        dateObj.getDay() === 0 || dateObj.getDay() === 6;

                      const dateStr = `${year}-${String(month + 1).padStart(
                        2,
                        "0"
                      )}-${String(d + 1).padStart(2, "0")}`;

                      const holiday = isHoliday(dateStr);

                      return (
                        <th
                          key={d}
                          className={`border px-2 py-1 text-center ${
                            holiday
                              ? "bg-violet-100"
                              : isWeekend
                              ? "bg-rose-100"
                              : ""
                          }`}
                        >
                          <div className="font-bold">{d + 1}</div>
                          <div className="text-[10px] text-slate-600">
                            {dayName}
                          </div>
                        </th>
                      );
                    })}

                    <th className="border px-2 bg-emerald-50">P</th>
                    <th className="border px-2 bg-rose-50">A</th>
                    <th className="border px-2 bg-violet-50">LOP</th>
                    <th className="border px-2 py-2 bg-blue-100">Total Days</th>
                    <th className="border px-2 bg-green-100">Net</th>

                    {/* EXTRA HEADERS */}
                    {(() => {
                      const monthKey = `${year}-${String(month + 1).padStart(
                        2,
                        "0"
                      )}`;
                      return (extraCols[monthKey] || []).map((col, i) => (
                        <th key={i} className="border px-3 py-1 bg-yellow-100">
                          <input
                            value={col}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraCols((cols) => ({
                                ...cols,
                                [monthKey]: (cols[monthKey] || []).map((c, idx) =>
                                  idx === i ? val : c
                                ),
                              }));
                            }}
                            className="w-full text-center outline-none bg-yellow-50"
                          />
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => {
                    const dayStatuses = Array.from(
                      { length: daysInMonth },
                      (_, d) => {
                        const day = d + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(
                          2,
                          "0"
                        )}-${String(day).padStart(2, "0")}`;

                        const isHolidayDay =
                          isSunday(year, month, day) ||
                          isSecondSaturday(year, month, day) ||
                          isFourthSaturday(year, month, day) ||
                          isFifthSaturday(year, month, day) ||
                          !!isHoliday(dateStr);

                        const autoStatus = getAutoStatus({
                          uid: u.uid,
                          dateStr,
                          sessionsByDate,
                          isHolidayDay,
                        });

                        return isHolidayDay
                          ? "H"
                          : monthlyAttendance[u.uid]?.[dateStr] ?? autoStatus;
                      }
                    );

                    const presentCount = dayStatuses.filter(
                      (s) => s === "P"
                    ).length;
                    const absentCount = dayStatuses.filter(
                      (s) => s === "A"
                    ).length;
                    const lopCount = dayStatuses.filter(
                      (s) => s === "LOP"
                    ).length;

                    const salary = u.salary ?? 0;
                    const perDay = salary / daysInMonth;
                    const netPay = Math.round(perDay * presentCount);

                    const totalWorkingDays = dayStatuses.filter(
                      (s) => s !== "H"
                    ).length;

                    const monthKey = `${year}-${String(month + 1).padStart(
                      2,
                      "0"
                    )}`;

                    return (
                      <tr key={u.uid} className="hover:bg-slate-50">
                        {/* EMPLOYEE */}
                        <td className="sticky left-0 bg-white border px-3 py-2 z-20">
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {u.designation}
                          </div>
                        </td>

                        {/* DAYS */}
                        {dayStatuses.map((status, d) => {
                          const day = d + 1;
                          const dateStr = `${year}-${String(
                            month + 1
                          ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                          return (
                            <td
                              key={d}
                              onClick={() => {
                                if (status === "H") return;

                                const newStatus = nextStatus(status);

                                setMonthlyAttendance((prev) => ({
                                  ...prev,
                                  [u.uid]: {
                                    ...(prev[u.uid] || {}),
                                    [dateStr]: newStatus,
                                  },
                                }));

                                saveMonthlyAttendance(
                                  u.uid,
                                  dateStr,
                                  newStatus
                                );
                              }}
                              className={`border h-9 text-center font-bold cursor-pointer ${attendanceStyle[status]}`}
                            >
                              {status}
                            </td>
                          );
                        })}

                        <td className="border text-center bg-emerald-50 font-bold">
                          {presentCount}
                        </td>
                        <td className="border text-center bg-rose-50 font-bold">
                          {absentCount}
                        </td>
                        <td className="border text-center bg-violet-50 font-bold">
                          {lopCount}
                        </td>
                        <td className="border text-center bg-blue-50 font-bold">
                          {totalWorkingDays}
                        </td>

                        <td className="border text-center bg-green-100 font-bold text-green-700">
                          ₹{netPay}
                        </td>

                        {/* EXTRA CELLS */}
                        {(extraCols[monthKey] || []).map((_, i) => (
                          <td key={i} className="border h-9">
                            <input
                              className="w-full outline-none text-center"
                              value={
                                extraData?.[monthKey]?.[u.uid]?.[i] || ""
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtraData((prev: any) => ({
                                  ...prev,
                                  [monthKey]: {
                                    ...(prev[monthKey] || {}),
                                    [u.uid]: {
                                      ...((prev[monthKey] || {})[u.uid] || {}),
                                      [i]: val,
                                    },
                                  },
                                }));
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}