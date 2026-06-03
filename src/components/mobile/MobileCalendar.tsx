"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Gift, PartyPopper } from "lucide-react";

export const MobileCalendar = () => {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [holidays, setHolidays] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Fetch Holidays
    const u1 = onSnapshot(query(collection(db, "holidays"), orderBy("date", "asc")), (snap) => {
      setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Fetch Birthdays (from users)
    const u2 = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data();
        const bd = data.dateOfBirth || data.birthDate || "";
        return {
          id: d.id,
          name: data.name || "",
          birthDate: bd,
          birthMonthDay: bd ? bd.slice(5, 10) : ""
        };
      }).filter(e => e.birthDate);
      setBirthdays(list);
    });
    // Fetch Events
    const u3 = onSnapshot(collection(db, "companyEvents"), (snap) => {
      setEvents(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, date: data.date || data.eventDate || "" };
      }));
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const makeDateStr = (y: number, m: number, day: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isSunday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;

  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  
  const handlePrev = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const handleNext = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
        <button onClick={handlePrev} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Company Calendar</span>
          <h2 className="text-lg font-black text-gray-900 mt-0.5">
            {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
        </div>
        <button onClick={handleNext} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100">
        <div className="grid grid-cols-7 text-center mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-[10px] font-black text-gray-400 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
          
          {Array.from({ length: monthEnd.getDate() }).map((_, i) => {
            const day = i + 1;
            const y = calendarDate.getFullYear();
            const m = calendarDate.getMonth();
            const dateStr = makeDateStr(y, m, day);
            const mdStr = `${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            const now = new Date();
            const isToday = day === now.getDate() && m === now.getMonth() && y === now.getFullYear();
            
            const hol = holidays.find(h => h.date === dateStr);
            const bdays = birthdays.filter(b => b.birthMonthDay === mdStr);
            const evts = events.filter(e => e.date === dateStr);
            const isWeekend = isSunday(y, m, day);
            
            let bg = "bg-gray-50/50 text-gray-700";
            let border = "border-transparent";
            if (isToday) { bg = "bg-indigo-50 text-indigo-700"; border = "border-indigo-200"; }
            else if (hol || isWeekend) { bg = "bg-rose-50 text-rose-700"; }
            else if (bdays.length > 0) { bg = "bg-purple-50 text-purple-700"; }
            else if (evts.length > 0) { bg = "bg-emerald-50 text-emerald-700"; }

            return (
              <div key={day} className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border ${bg} ${border}`}>
                <span className={`text-xs font-bold ${isToday ? 'text-indigo-700' : ''}`}>{day}</span>
                <div className="flex gap-0.5 mt-0.5">
                  {hol && <div className="w-1 h-1 rounded-full bg-rose-500" />}
                  {bdays.length > 0 && <div className="w-1 h-1 rounded-full bg-purple-500" />}
                  {evts.length > 0 && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend / Upcoming */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">This Month</h3>
        
        <div className="flex flex-col gap-3">
          {holidays.filter(h => h.date.startsWith(makeDateStr(calendarDate.getFullYear(), calendarDate.getMonth(), 1).slice(0, 7))).map((h, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><CalIcon className="w-4 h-4" /></div>
              <div>
                <div className="text-xs font-bold text-rose-900">{h.title}</div>
                <div className="text-[10px] font-bold text-rose-400 mt-0.5">{h.date}</div>
              </div>
            </div>
          ))}
          
          {birthdays.filter(b => b.birthMonthDay.startsWith(String(calendarDate.getMonth() + 1).padStart(2, "0"))).map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Gift className="w-4 h-4" /></div>
              <div>
                <div className="text-xs font-bold text-purple-900">{b.name}'s Birthday</div>
                <div className="text-[10px] font-bold text-purple-400 mt-0.5">{b.birthMonthDay}</div>
              </div>
            </div>
          ))}

          {events.filter(e => e.date && e.date.startsWith(makeDateStr(calendarDate.getFullYear(), calendarDate.getMonth(), 1).slice(0, 7))).map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><PartyPopper className="w-4 h-4" /></div>
              <div>
                <div className="text-xs font-bold text-emerald-900">{e.title}</div>
                <div className="text-[10px] font-bold text-emerald-400 mt-0.5">{e.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
