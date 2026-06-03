"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

export const MobileAttendanceCalendar = ({ user }: { user: any }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchMonthHistory = async () => {
    if (!user?.uid) return;
    setLoading(true);
    
    // We fetch attendance for the current user. Since document IDs are `${uid}_${date}`, 
    // we can query all and filter client side, or just fetch all for the user if we add a uid field.
    // Assuming attendance docs have 'userId' and 'date'
    try {
      const q = query(collection(db, "attendance"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const records = snap.docs.map(d => d.data());
      setHistory(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthHistory();
  }, [user, currentDate]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedRecord(null);
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedRecord(null);
  };

  const getRecordForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return history.find(r => r.date === dateStr);
  };

  const getStatusColor = (record: any) => {
    if (!record) return "bg-gray-50 border-gray-100 text-gray-400";
    if (record.totalMinutes > 0) return "bg-emerald-50 border-emerald-200 text-emerald-600 font-bold";
    return "bg-rose-50 border-rose-200 text-rose-500 font-bold"; // Has record but 0 minutes?
  };

  const formatTime = (ts: any) => {
    if (!ts) return "--:--";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar Header */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const record = getRecordForDay(day);
            const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
            
            return (
              <button
                key={day}
                onClick={() => setSelectedRecord(record || { date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, empty: true })}
                className={`aspect-square rounded-xl border flex items-center justify-center text-xs transition-all active:scale-95 ${getStatusColor(record)} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} ${selectedRecord?.date === record?.date ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedRecord && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              {new Date(selectedRecord.date).toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            {selectedRecord.empty ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">No Record</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">Present</span>
            )}
          </div>

          {!selectedRecord.empty ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-500"><Clock className="w-4 h-4" /></div>
                  <span className="text-xs font-bold text-gray-600">Total Logged Time</span>
                </div>
                <span className="text-sm font-black text-gray-900">
                  {Math.floor((selectedRecord.totalMinutes || 0) / 60)}h {(selectedRecord.totalMinutes || 0) % 60}m
                </span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sessions</h4>
                {selectedRecord.sessions?.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-medium text-gray-700 py-1.5 border-b border-gray-50 last:border-0">
                    <span>Session {idx + 1}</span>
                    <span className="tabular-nums tracking-tight">
                      {formatTime(s.checkIn)} — {s.checkOut ? formatTime(s.checkOut) : "Active"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-xs">
              No attendance data logged for this date.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
