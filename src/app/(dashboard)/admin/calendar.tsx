import React from 'react';

interface CalendarViewProps {
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  isSunday: (year: number, month: number, day: number) => boolean;
  isSecondSaturday: (year: number, month: number, day: number) => boolean;
  isFourthSaturday: (year: number, month: number, day: number) => boolean;
  isFifthSaturday: (year: number, month: number, day: number) => boolean;
  isHoliday: (dateStr: string) => { title: string } | null;
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
  isHoliday,
}) => {
  if (!showCalendar) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => setShowCalendar(false)}
    >
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {/* CLOSE BUTTON */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowCalendar(false)}
            className="bg-white rounded-full w-8 h-8 shadow hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>

        {/* CALENDAR - COMPACT VERSION */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Holiday Calendar</h2>
              <p className="text-xs text-slate-500">View holidays and weekends</p>
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
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
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
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 text-center font-bold text-slate-700 mb-2 text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty cells for days before month starts */}
            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth(),
                1
              ).getDay(),
            }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {/* Days of the month */}
            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth() + 1,
                0
              ).getDate(),
            }).map((_, i) => {
              const day = i + 1;
              const currentYear = calendarDate.getFullYear();
              const currentMonth = calendarDate.getMonth();

              const isToday =
                day === new Date().getDate() &&
                currentMonth === new Date().getMonth() &&
                currentYear === new Date().getFullYear();

              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;

              const sunday = isSunday(currentYear, currentMonth, day);
              const secondSat = isSecondSaturday(currentYear, currentMonth, day);
              const fourthSat = isFourthSaturday(currentYear, currentMonth, day);
              const fifthSat = isFifthSaturday(currentYear, currentMonth, day);
              const holiday = isHoliday(dateStr);

              const isHolidayDay =
                sunday || secondSat || fourthSat || fifthSat || holiday;

              return (
                <div
                  key={day}
                  className={`h-16 border-2 rounded-lg p-1.5 text-xs relative transition-all ${
                    isToday
                      ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50"
                      : isHolidayDay
                      ? "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`font-bold text-sm ${
                      isToday ? "text-indigo-700" : "text-slate-900"
                    }`}
                  >
                    {day}
                  </div>

                  {isHolidayDay && (
                    <div className="mt-0.5 text-[9px] text-rose-600 font-semibold truncate">
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

                  {isToday && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] text-indigo-700 font-bold bg-indigo-200 px-1 py-0.5 rounded">
                      TODAY
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend - Compact */}
          <div className="mt-3 flex flex-wrap gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded"></div>
              <span className="text-xs font-medium text-slate-700">
                Holiday/Weekend
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-indigo-50 border-2 border-indigo-500 rounded"></div>
              <span className="text-xs font-medium text-slate-700">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-white border-2 border-slate-200 rounded"></div>
              <span className="text-xs font-medium text-slate-700">
                Regular Day
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;