"use client";

import { useState } from "react";

type Leave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: "Pending" | "Approved" | "Rejected";
};

type Props = {
  leaveNotifications: Leave[];
  messages: string[];
  markNotificationAsRead: (id: string) => void;
  queryNotifications?: any[];
  markQueryNotificationAsRead?: (id: string) => void;
  onClose?: () => void;
  dismissedAnnouncements: Set<string>;
  onDismissAnnouncement: (message: string) => void;
};

export default function NotificationsView({
  leaveNotifications,
  messages,
  markNotificationAsRead,
  queryNotifications = [],
  markQueryNotificationAsRead,
  onClose,
  dismissedAnnouncements,
  onDismissAnnouncement,
}: Props) {
  const [fadingItems, setFadingItems] = useState<Set<string>>(new Set());

  const visibleMessages = messages.filter((m) => !dismissedAnnouncements.has(m));
  const totalCount = leaveNotifications.length + visibleMessages.length + queryNotifications.length;
  const hasNone = totalCount === 0;

  const fadeOut = (key: string, callback: () => void) => {
    setFadingItems((prev) => new Set(prev).add(key));
    setTimeout(() => {
      callback();
      setFadingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 320);
  };

  const handleLeaveRead = (id: string) =>
    fadeOut(`leave-${id}`, () => markNotificationAsRead(id));

  const handleQueryRead = (id: string) => {
    if (!markQueryNotificationAsRead) return;
    fadeOut(`query-${id}`, () => markQueryNotificationAsRead(id));
  };

  const handleDismissAnnouncement = (message: string) =>
    fadeOut(`ann-${message}`, () => onDismissAnnouncement(message));

  const XIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const itemStyle = (key: string) => ({
    transition: "opacity 0.32s ease, transform 0.32s ease",
    opacity: fadingItems.has(key) ? 0 : 1,
    transform: fadingItems.has(key) ? "translateX(60px)" : "translateX(0)",
  });

  return (
    <div className="flex justify-center px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🔔 Notifications
              {totalCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalCount}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasNone
                ? "You're all caught up!"
                : `${totalCount} unread notification${totalCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900 flex-shrink-0"
            >
              <XIcon />
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Empty state */}
          {hasNone && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="text-6xl mb-4">🔕</div>
              <p className="text-lg font-semibold text-gray-500">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No new notifications right now</p>
            </div>
          )}

          {/* ── 1. LEAVE UPDATES ── */}
          {leaveNotifications.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Leave Updates</span>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {leaveNotifications.length}
                </span>
              </div>
              <div className="space-y-3">
                {leaveNotifications.map((leave) => (
                  <div
                    key={leave.id}
                    style={itemStyle(`leave-${leave.id}`)}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      leave.status === "Approved"
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                        leave.status === "Approved" ? "bg-green-100" : "bg-red-100"
                      }`}>
                        {leave.status === "Approved" ? "✅" : "❌"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">
                          Your <strong>{leave.leaveType}</strong> leave has been{" "}
                          <span className={leave.status === "Approved" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            {leave.status}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          📅 {new Date(leave.fromDate).toLocaleDateString("en-IN")} –{" "}
                          {new Date(leave.toDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLeaveRead(leave.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-red-100 border border-gray-200 transition-colors text-gray-400 hover:text-red-600 flex-shrink-0 ml-3 shadow-sm"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 2. QUERY REPLIES ── */}
          {queryNotifications.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Query Replies</span>
                <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {queryNotifications.length}
                </span>
              </div>
              <div className="space-y-3">
                {queryNotifications.map((q: any) => (
                  <div
                    key={q.id}
                    style={itemStyle(`query-${q.id}`)}
                    className="flex items-start justify-between p-4 rounded-xl bg-purple-50 border border-purple-200"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0">
                        💬
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">Admin replied to your query</p>
                        <p className="text-xs text-purple-700 font-medium mt-0.5 truncate">
                          Subject: {q.subject}
                        </p>
                        {q.adminReply && (
                          <div className="mt-2 px-3 py-2 bg-white border border-purple-200 rounded-lg">
                            <p className="text-sm text-gray-700 italic line-clamp-3">"{q.adminReply}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleQueryRead(q.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-purple-100 border border-gray-200 transition-colors text-gray-400 hover:text-purple-600 flex-shrink-0 ml-3 shadow-sm mt-0.5"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 3. ANNOUNCEMENTS ── */}
          {visibleMessages.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Announcements</span>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {visibleMessages.length}
                </span>
              </div>
              <div className="space-y-3">
                {visibleMessages.map((m) => (
                  <div
                    key={m}
                    style={itemStyle(`ann-${m}`)}
                    className="flex items-start justify-between p-4 rounded-xl bg-orange-50 border border-orange-200"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center text-xl flex-shrink-0">
                        📣
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-orange-800">Admin Announcement</p>
                        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed break-words">{m}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissAnnouncement(m)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-orange-100 border border-gray-200 transition-colors text-gray-400 hover:text-orange-600 flex-shrink-0 ml-3 shadow-sm mt-0.5"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}