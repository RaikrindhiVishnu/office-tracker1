"use client";

type Props = {
  show: boolean;
  onClose: () => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  holidays: any[];
  isSunday: any;
  isSecondSaturday: any;
  isFourthSaturday: any;
  isFifthSaturday: any;
  isHoliday: any;
};

export default function CalendarModal({
  show,
  onClose,
  calendarDate,
  setCalendarDate,
  holidays,
  isSunday,
  isSecondSaturday,
  isFourthSaturday,
  isFifthSaturday,
  isHoliday,
}: Props) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CLOSE BUTTON */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="bg-white rounded-full w-8 h-8 shadow hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Holiday Calendar
              </h2>
              <p className="text-xs text-slate-500">
                View holidays and weekends
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
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
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
                className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 text-center font-bold text-slate-700 mb-2 text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth(),
                1
              ).getDay(),
            }).map((_, i) => (
              <div key={i} />
            ))}

            {Array.from({
              length: new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth() + 1,
                0
              ).getDate(),
            }).map((_, i) => {
              const day = i + 1;
              const y = calendarDate.getFullYear();
              const m = calendarDate.getMonth();

              const isToday =
                day === new Date().getDate() &&
                m === new Date().getMonth() &&
                y === new Date().getFullYear();

              const dateStr = `${y}-${String(m + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;

              const holiday = isHoliday(dateStr);

              const isHolidayDay =
                isSunday(y, m, day) ||
                isSecondSaturday(y, m, day) ||
                isFourthSaturday(y, m, day) ||
                isFifthSaturday(y, m, day) ||
                holiday;

              return (
                <div
                  key={day}
                  className={`h-16 border-2 rounded-lg p-1.5 text-xs relative ${
                    isToday
                      ? "border-indigo-500 bg-indigo-50"
                      : isHolidayDay
                      ? "bg-rose-50 border-rose-300"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="font-bold">{day}</div>

                  {holiday && (
                    <div className="text-[9px] text-rose-600 truncate">
                      {holiday.title}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
