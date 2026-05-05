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
  notificationRead?: boolean;
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
  /** Optional: Pass chat notifications from parent to keep sync with header badge */
  chatNotifications?: ChatNotif[];
  /** Optional: Pass chat marking function from parent for optimistic sync */
  markChatNotificationAsRead?: (id: string) => void;
  /** Optional: Pass mark all read function from parent */
  markAllNotificationsRead?: () => void;
  /** Optional: Announcements from parent */
  announcements?: { id: string; text: string }[];
  /** Optional: Mark announcement as read */
  markAnnouncementRead?: (id: string) => void;
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

const CheckIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default function NotificationsView({
  leaveNotifications,
  markNotificationAsRead,
  queryNotifications = [],
  markQueryNotificationAsRead,
  chatNotifications,
  markChatNotificationAsRead,
  markAllNotificationsRead,
  announcements = [],
  markAnnouncementRead,
  onClose,
  hideHeader = false,
  onGoToChat,
}: Props) {
  const { user } = useAuth();
  const [chatNotifs, setChatNotifs] = useState<ChatNotif[]>([]);
  
  // ✅ 1. THE SINGLE SOURCE OF TRUTH (Local sets to track "Read" status optimistically)
  const [locallyReadLeave, setLocallyReadLeave] = useState<Set<string>>(new Set());
  const [locallyReadQuery, setLocallyReadQuery] = useState<Set<string>>(new Set());
  const [locallyReadChat, setLocallyReadChat] = useState<Set<string>>(new Set());
  const [locallyReadAnnouncements, setLocallyReadAnnouncements] = useState<Set<string>>(new Set());

  // ── Subscribe to unread chat notifications (only if not provided by props) ───
  useEffect(() => {
    if (!user || chatNotifications) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snap) => {
      setChatNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatNotif)));
    });
  }, [user, chatNotifications]);

  const sourceChatNotifs = chatNotifications || chatNotifs;

  // ✅ 2. CALCULATE DERIVED STATES (Unread vs Already Read)
  const unreadLeave = leaveNotifications.filter(l => l.notificationRead !== true && !locallyReadLeave.has(l.id));
  const readLeave = leaveNotifications.filter(l => l.notificationRead === true || locallyReadLeave.has(l.id));

  const unreadQuery = queryNotifications.filter(q => q.employeeUnread === true && !locallyReadQuery.has(q.id));
  const readQuery = queryNotifications.filter(q => q.employeeUnread !== true || locallyReadQuery.has(q.id));

  const unreadChat = sourceChatNotifs.filter(n => n.read !== true && !locallyReadChat.has(n.id));
  const readChat = sourceChatNotifs.filter(n => n.read === true || locallyReadChat.has(n.id));

  const unreadAnnouncements = announcements.filter(a => !locallyReadAnnouncements.has(a.id));
  const readAnnouncements = announcements.filter(a => locallyReadAnnouncements.has(a.id));

  const totalUnread = unreadLeave.length + unreadQuery.length + unreadChat.length + unreadAnnouncements.length;
  const hasUnread = totalUnread > 0;

  const markChatRead = async (id: string) => {
    setLocallyReadChat(prev => new Set(prev).add(id));
    if (markChatNotificationAsRead) markChatNotificationAsRead(id);
    else await updateDoc(doc(db, "notifications", id), { read: true, isRead: true });
  };

  const handleMarkAllRead = async () => {
    setLocallyReadLeave(new Set([...Array.from(locallyReadLeave), ...leaveNotifications.map(l => l.id)]));
    setLocallyReadQuery(new Set([...Array.from(locallyReadQuery), ...queryNotifications.map(q => q.id)]));
    setLocallyReadChat(new Set([...Array.from(locallyReadChat), ...sourceChatNotifs.map(n => n.id)]));
    setLocallyReadAnnouncements(new Set([...Array.from(locallyReadAnnouncements), ...announcements.map(a => a.id)]));

    if (markAllNotificationsRead) {
      markAllNotificationsRead();
    } else {
      unreadLeave.forEach(l => markNotificationAsRead(l.id));
      unreadQuery.forEach(q => markQueryNotificationAsRead?.(q.id));
      unreadAnnouncements.forEach(a => markAnnouncementRead?.(a.id));
      const batch = writeBatch(db);
      unreadChat.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true, isRead: true }));
      await batch.commit();
    }
  };

  const renderLeaveItem = (leave: Leave, isRead: boolean) => (
    <div
      key={leave.id}
      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
        isRead 
          ? "bg-gray-50 border-gray-100 opacity-60" 
          : leave.status === "Approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
          isRead ? "bg-gray-100" : leave.status === "Approved" ? "bg-green-100" : "bg-red-100"
        }`}>
          {leave.status === "Approved" ? "✅" : "❌"}
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-sm ${isRead ? "text-gray-500" : "text-gray-800"}`}>
            {leave.leaveType} leave <span className={leave.status === "Approved" ? "text-green-600" : "text-red-600"}>{leave.status}</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            📅 {parseLocalDate(leave.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {parseLocalDate(leave.toDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </p>
        </div>
      </div>
      {!isRead && (
        <button
          onClick={() => {
            setLocallyReadLeave(prev => new Set(prev).add(leave.id));
            markNotificationAsRead(leave.id);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-red-100 border border-gray-200 text-gray-400 hover:text-red-600 transition-colors shadow-sm"
        >
          <XIcon />
        </button>
      )}
    </div>
  );

  const renderQueryItem = (q: any, isRead: boolean) => (
    <div
      key={q.id}
      className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
        isRead ? "bg-gray-50 border-gray-100 opacity-60" : "bg-purple-50 border-purple-200"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${isRead ? "bg-gray-100" : "bg-purple-100"}`}>💬</div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isRead ? "text-gray-500" : "text-gray-800"}`}>Query Reply</p>
          <p className="text-[11px] text-purple-700 font-medium truncate">{q.subject}</p>
        </div>
      </div>
      {!isRead && (
        <button
          onClick={() => {
            setLocallyReadQuery(prev => new Set(prev).add(q.id));
            markQueryNotificationAsRead?.(q.id);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-purple-100 border border-gray-200 text-gray-400 hover:text-purple-600 transition-colors shadow-sm mt-0.5"
        >
          <XIcon />
        </button>
      )}
    </div>
  );

  const renderChatItem = (n: ChatNotif, isRead: boolean) => (
    <div
      key={n.id}
      className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
        isRead ? "bg-gray-50 border-gray-100 opacity-60" : "bg-blue-50 border-blue-200"
      }`}
    >
      <button
        className="flex items-start gap-3 flex-1 min-w-0 text-left"
        onClick={() => {
          markChatRead(n.id);
          onGoToChat?.(n.chatId);
        }}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${
          isRead ? "bg-gray-300" : "bg-linear-to-br from-blue-400 to-indigo-500"
        }`}>
          {n.fromName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isRead ? "text-gray-500" : "text-gray-800"}`}>
            {n.fromName} <span className="ml-0.5 font-normal text-blue-600">sent a message</span>
          </p>
          <p className="text-[11px] text-gray-600 truncate italic mt-0.5">&ldquo;{n.message}&rdquo;</p>
        </div>
      </button>
      {!isRead && (
        <button
          onClick={() => markChatRead(n.id)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-blue-100 border border-gray-200 text-gray-400 hover:text-blue-600 transition-colors shadow-sm mt-0.5"
        >
          <XIcon />
        </button>
      )}
    </div>
  );

  const renderAnnouncementCard = (a: any, isRead: boolean) => (
    <div
      key={a.id}
      className={`flex items-start justify-between p-4 rounded-xl border ${
        isRead ? "bg-gray-50 border-gray-200 opacity-60" : "bg-yellow-50 border-yellow-200"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isRead ? "bg-gray-100" : "bg-yellow-400"}`}>
          {isRead ? "✓" : "📣"}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isRead ? "text-gray-500" : "text-gray-800"}`}>New Announcement</p>
          <p className="text-xs text-gray-400 mt-0.5 italic">&ldquo;{a.text}&rdquo;</p>
        </div>
      </div>
      {!isRead && (
        <button
          onClick={() => {
            setLocallyReadAnnouncements(prev => new Set(prev).add(a.id));
            markAnnouncementRead?.(a.id);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-yellow-100 border border-gray-200 text-gray-400 hover:text-yellow-600 transition-colors shadow-sm mt-0.5"
        >
          <XIcon />
        </button>
      )}
    </div>
  );

  const content = (
    <div className="px-6 py-5 space-y-8 max-h-[75vh] overflow-y-auto scrollbar-hide">
      {hasUnread ? (
        <div className="space-y-6">
          {unreadChat.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                New Messages <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              </h3>
              <div className="space-y-3">{unreadChat.map(n => renderChatItem(n, false))}</div>
            </section>
          )}

          {unreadLeave.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                Leave Status <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </h3>
              <div className="space-y-3">{unreadLeave.map(l => renderLeaveItem(l, false))}</div>
            </section>
          )}

          {unreadAnnouncements.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                Announcements <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              </h3>
              <div className="space-y-3">{unreadAnnouncements.map(a => renderAnnouncementCard(a, false))}</div>
            </section>
          )}

          {unreadQuery.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                Query Replies <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              </h3>
              <div className="space-y-3">{unreadQuery.map(q => renderQueryItem(q, false))}</div>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-4">✨</div>
          <p className="text-gray-900 font-bold">All caught up!</p>
          <p className="text-xs text-gray-500 mt-1">No new notifications right now</p>
        </div>
      )}

      {(readLeave.length > 0 || readQuery.length > 0 || readChat.length > 0 || readAnnouncements.length > 0) && (
        <section className="pt-4 border-t border-gray-100">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Already Read</h3>
          <div className="space-y-2.5">
            {readChat.map(n => renderChatItem(n, true))}
            {readAnnouncements.map(a => renderAnnouncementCard(a, true))}
            {readLeave.map(l => renderLeaveItem(l, true))}
            {readQuery.map(q => renderQueryItem(q, true))}
          </div>
        </section>
      )}
    </div>
  );

  if (!hideHeader) {
    return (
      <div className="flex justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-linear-to-b from-gray-50 to-white border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                🔔 Notifications
                {totalUnread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-all"
                >
                  Mark all read
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>
          {content}
        </div>
      </div>
    );
  }

  // Dashboard modal style
  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {totalUnread} New Alerts
        </p>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg hover:bg-blue-50"
          >
            Mark all read
          </button>
        )}
      </div>
      {content}
    </div>
  );
}