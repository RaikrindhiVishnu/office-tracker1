import React from "react";

interface CalendarViewProps {
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  isSunday: (year: number, month: number, day: number) => boolean;
  isSecondSaturday: (year: number, month: number, day: number) => boolean;
  isFourthSaturday: (year: number, month: number, day: number) => boolean;
  isFifthSaturday: (year: number, month: number, day: number) => boolean;
  isHoliday: (dateStr: string) => any;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  showCalendar,
  setShowCalendar,
  calendarDate,
  setCalendarDate,
  isSunday,
  isSecondSaturday,
  isFourthSaturday,
  isFifthSaturday,
}) => {
  if (!showCalendar) return null;

  /* ✅ Recurring Company Holiday */
  const getHoliday = (dateStr: string): { title: string } | null => {
    const recurring: Record<string, { title: string }> = {
      "12-04": { title: "🎉 Office Anniversary" },
    };

    const [, month, day] = dateStr.split("-");
    return recurring[`${month}-${day}`] || null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => setShowCalendar(false)}
    >
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        
        {/* CLOSE */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowCalendar(false)}
            className="bg-white rounded-full w-8 h-8 shadow hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>

        {/* CALENDAR CARD */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4">
          
          {/* HEADER */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Holiday Calendar
              </h2>
              <p className="text-xs text-slate-500">
                View holidays and company events
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth() - 1,
                      1
                    )
                  )
                }
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
              >
                ← Previous
              </button>

              <div className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm">
                {calendarDate.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </div>

              <button
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth() + 1,
                      1
                    )
                  )
                }
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
              >
                Next →
              </button>
            </div>
          </div>

          {/* DAYS HEADER */}
          <div className="grid grid-cols-7 text-center font-bold text-slate-700 mb-2 text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          {/* GRID */}
          <div className="grid grid-cols-7 gap-1.5">
            
            {/* EMPTY CELLS */}
            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth(),
                1
              ).getDay(),
            }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {/* DAYS */}
            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth() + 1,
                0
              ).getDate(),
            }).map((_, i) => {
              const day = i + 1;
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();

              const today = new Date();

              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;

              const sunday = isSunday(year, month, day);
              const secondSat = isSecondSaturday(year, month, day);
              const fourthSat = isFourthSaturday(year, month, day);
              const fifthSat = isFifthSaturday(year, month, day);

              const holiday = getHoliday(dateStr);
              const isOfficeAnniversary =
                holiday?.title === "🎉 Office Anniversary";

              const isHolidayDay =
                sunday || secondSat || fourthSat || fifthSat || holiday;

              return (
                <div
                  key={day}
                  className={`h-20 border-2 rounded-lg p-1.5 text-xs relative transition-all
                  
                  ${
                    isToday
                      ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50"
                      : isOfficeAnniversary
                      ? "bg-gradient-to-br from-yellow-200 to-orange-300 border-yellow-500 shadow-md scale-[1.04]"
                      : isHolidayDay
                      ? "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* DAY */}
                  <div className="font-bold text-sm text-slate-900">
                    {day}
                  </div>

                  {/* HOLIDAY TEXT */}
                  {isHolidayDay && (
                    <div className="mt-1 text-[10px] leading-tight font-bold whitespace-normal">
                      {holiday
                        ? holiday.title
                        : sunday
                        ? "Sunday"
                        : secondSat
                        ? "2nd Sat"
                        : fourthSat
                        ? "4th Sat"
                        : fifthSat
                        ? "5th Sat"
                        : ""}
                    </div>
                  )}

                  {/* TODAY BADGE */}
                  {isToday && (
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-indigo-600 text-white px-1 py-0.5 rounded">
                      TODAY
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* LEGEND */}
          <div className="mt-3 flex flex-wrap gap-3 p-2.5 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gradient-to-br from-yellow-200 to-orange-300 border-2 border-yellow-500 rounded"></div>
              <span className="text-xs font-medium">Company Event</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded"></div>
              <span className="text-xs font-medium">Holiday / Weekend</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-indigo-50 border-2 border-indigo-500 rounded"></div>
              <span className="text-xs font-medium">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
