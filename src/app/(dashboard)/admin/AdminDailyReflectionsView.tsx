"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

type Reflection = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  mood: string;
  accomplishments: string;
  hasBlocker: boolean;
  blockerDetails: string;
  needsSupport: boolean;
  supportDetails: string;
  additionalNotes: string;
  timestamp: any;
};

export default function AdminDailyReflectionsView() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "dailyReflections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Reflection[];
      setReflections(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredReflections = reflections.filter((r) => {
    const matchSearch = r.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = dateFilter ? r.date === dateFilter : true;
    return matchSearch && matchDate;
  });

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case "Great": return "😄";
      case "Good": return "🙂";
      case "Okay": return "😐";
      case "Struggling": return "😫";
      default: return "😶";
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case "Great": return "bg-green-100 text-green-700 border-green-200";
      case "Good": return "bg-blue-100 text-blue-700 border-blue-200";
      case "Okay": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Struggling": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Reflections</h1>
          <p className="text-sm text-gray-500 mt-1">Review team daily check-ins and blockers</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search employee..."
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <input
            type="date"
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredReflections.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No reflections found</h3>
          <p className="text-sm text-gray-500 mt-1">
            Try adjusting your search or date filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredReflections.map((reflection) => {
              const isExpanded = expandedId === reflection.id;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={reflection.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{reflection.userName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{reflection.date}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getMoodColor(reflection.mood)} flex items-center gap-1.5`}>
                      {getMoodEmoji(reflection.mood)} {reflection.mood}
                    </span>
                  </div>

                  <div className="p-5 flex-1 space-y-4">
                    {/* Flags */}
                    {(reflection.hasBlocker || reflection.needsSupport) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {reflection.hasBlocker && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Blocked
                          </span>
                        )}
                        {reflection.needsSupport && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            Needs Support
                          </span>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Accomplishments</h4>
                      <p className={`text-sm text-gray-700 whitespace-pre-wrap ${!isExpanded && "line-clamp-2"}`}>
                        {reflection.accomplishments || "None mentioned"}
                      </p>
                    </div>

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-4 pt-2"
                      >
                        {reflection.hasBlocker && (
                          <div>
                            <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Blocker Details</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reflection.blockerDetails}</p>
                          </div>
                        )}
                        {reflection.needsSupport && (
                          <div>
                            <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Support Needed</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reflection.supportDetails}</p>
                          </div>
                        )}
                        {reflection.additionalNotes && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Additional Notes</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reflection.additionalNotes}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {reflection.timestamp ? new Date(reflection.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : reflection.id)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                    >
                      {isExpanded ? "Show Less" : "Read More"}
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
