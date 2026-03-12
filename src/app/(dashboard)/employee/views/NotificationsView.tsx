"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Leave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: "Pending" | "Approved" | "Rejected";
};

type ChatNotif = {
  id: string;
  fromUid: string;
  fromName: string;
  message: string;
  chatId: string;
  timestamp: any;
  read: boolean;
};

type Props = {
  leaveNotifications: Leave[];
  markNotificationAsRead: (id: string) => void;
  queryNotifications?: any[];
  markQueryNotificationAsRead?: (id: string) => void;
  onClose?: () => void;
  /** When true: hides the built-in header (used inside DashboardView modal) */
  hideHeader?: boolean;
  /** Called when user clicks a chat notification — e.g. switch to Chat tab */
  onGoToChat?: (chatId: string) => void;
};

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function NotificationsView({
  leaveNotifications,
  markNotificationAsRead,
  queryNotifications = [],
  markQueryNotificationAsRead,
  onClose,
  hideHeader = false,
  onGoToChat,
}: Props) {
  const { user } = useAuth();
  const [fadingItems, setFadingItems] = useState<Set<string>>(new Set());
  const [chatNotifs, setChatNotifs] = useState<ChatNotif[]>([]);

  // ── Subscribe to unread chat notifications ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snap) => {
      setChatNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatNotif)));
    });
  }, [user]);

  const markChatNotifRead = async (id: string) =>
    updateDoc(doc(db, "notifications", id), { read: true });

  const markAllChatRead = async () => {
    const batch = writeBatch(db);
    chatNotifs.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalCount = leaveNotifications.length + queryNotifications.length + chatNotifs.length;
  const hasNone = totalCount === 0;

  // ── Fade-out animation helper ───────────────────────────────────────────────
  const fadeOut = (key: string, callback: () => void) => {
    setFadingItems((prev) => new Set(prev).add(key));
    setTimeout(() => {
      callback();
      setFadingItems((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }, 320);
  };

  const handleLeaveRead = (id: string) => fadeOut(`leave-${id}`, () => markNotificationAsRead(id));
  const handleQueryRead = (id: string) => {
    if (!markQueryNotificationAsRead) return;
    fadeOut(`query-${id}`, () => markQueryNotificationAsRead(id));
  };
  const handleChatRead = (id: string) => fadeOut(`chat-${id}`, () => markChatNotifRead(id));

  const handleMarkAllRead = async () => {
    leaveNotifications.forEach((l) => markNotificationAsRead(l.id));
    queryNotifications.forEach((q) => markQueryNotificationAsRead?.(q.id));
    await markAllChatRead();
  };

  const itemStyle = (key: string): React.CSSProperties => ({
    transition: "opacity 0.32s ease, transform 0.32s ease",
    opacity: fadingItems.has(key) ? 0 : 1,
    transform: fadingItems.has(key) ? "translateX(60px)" : "translateX(0)",
  });

  // ── Body (shared between modal and standalone) ──────────────────────────────
  const body = (
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
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{leaveNotifications.length}</span>
          </div>
          <div className="space-y-3">
            {leaveNotifications.map((leave) => (
              <div
                key={leave.id}
                style={itemStyle(`leave-${leave.id}`)}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  leave.status === "Approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${
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
                      📅{" "}
                      {parseLocalDate(leave.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" – "}
                      {parseLocalDate(leave.toDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleLeaveRead(leave.id)}
                  title="Mark as read"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-red-100 border border-gray-200 transition-colors text-gray-400 hover:text-red-600 shrink-0 ml-3 shadow-sm"
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
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{queryNotifications.length}</span>
          </div>
          <div className="space-y-3">
            {queryNotifications.map((q: any) => (
              <div
                key={q.id}
                style={itemStyle(`query-${q.id}`)}
                className="flex items-start justify-between p-4 rounded-xl bg-purple-50 border border-purple-200"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center text-xl shrink-0">💬</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Admin replied to your query</p>
                    <p className="text-xs text-purple-700 font-medium mt-0.5 truncate">Subject: {q.subject}</p>
                    {q.adminReply && (
                      <div className="mt-2 px-3 py-2 bg-white border border-purple-200 rounded-lg">
                        <p className="text-sm text-gray-700 italic line-clamp-3">&ldquo;{q.adminReply}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleQueryRead(q.id)}
                  title="Mark as read"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-purple-100 border border-gray-200 transition-colors text-gray-400 hover:text-purple-600 shrink-0 ml-3 shadow-sm mt-0.5"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. CHAT MESSAGES ── */}
      {chatNotifs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">New Messages</span>
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{chatNotifs.length}</span>
          </div>
          <div className="space-y-3">
            {chatNotifs.map((n) => (
              <div
                key={n.id}
                style={itemStyle(`chat-${n.id}`)}
                className="flex items-start justify-between p-4 rounded-xl bg-blue-50 border border-blue-200"
              >
                {/* Clickable area → go to chat */}
                <button
                  className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  onClick={() => {
                    handleChatRead(n.id);
                    onGoToChat?.(n.chatId);
                  }}
                >
                  <div className="w-11 h-11 rounded-full bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
                    {n.fromName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">
                      {n.fromName}
                      <span className="ml-1 font-normal text-blue-600">sent you a message</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate italic">&ldquo;{n.message}&rdquo;</p>
                    {n.timestamp && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        🕐{" "}
                        {n.timestamp?.toDate?.()?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {onGoToChat && (
                      <span className="inline-block mt-1.5 text-[10px] font-bold text-blue-500 hover:text-blue-700">
                        Open chat →
                      </span>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleChatRead(n.id)}
                  title="Mark as read"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-blue-100 border border-gray-200 transition-colors text-gray-400 hover:text-blue-600 shrink-0 ml-3 shadow-sm mt-0.5"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // ── Standalone notifications page ───────────────────────────────────────────
  if (!hideHeader) {
    return (
      <div className="flex justify-center px-2">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                🔔 Notifications
                {totalCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalCount}</span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {hasNone ? "You're all caught up!" : `${totalCount} unread notification${totalCount !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!hasNone && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Mark all read
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>
          {body}
        </div>
      </div>
    );
  }

  // ── Inside DashboardView modal (hideHeader=true) ────────────────────────────
  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
        <p className="text-sm text-gray-500">
          {hasNone ? "You're all caught up!" : `${totalCount} unread notification${totalCount !== 1 ? "s" : ""}`}
        </p>
        {!hasNone && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-gray-400 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      {body}
    </div>
  );
}