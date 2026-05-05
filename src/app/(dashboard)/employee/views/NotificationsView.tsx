"use client";

import { useState, useMemo } from "react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotificationItem = {
  id: string;
  type: "chat" | "leave" | "query" | "announcement";
  title: string;
  subtitle: string;
  timestamp: any;
  isRead: boolean;
  isDeleted?: boolean;
  raw: any; 
};

export type Props = {
  leaveNotifications?: any[];
  markNotificationAsRead?: (id: string) => void;
  queryNotifications?: any[];
  markQueryNotificationAsRead?: (id: string) => void;
  chatNotifications?: any[];
  markChatNotificationAsRead?: (id: string) => void;
  announcements?: any[];
  markAnnouncementRead?: (id: string) => void;
  markAllNotificationsRead?: () => void;
  
  onMarkRead?: (id: string, type: string) => void;
  onMarkAllRead?: () => void;
  onDeleteNotification?: (id: string, type: string) => void;
  
  onGoToChat?: (chatId: string) => void;
  onClose?: () => void;
  dismissedAnnouncements?: Set<string>;
  hideHeader?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: any) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function UnifiedNotificationsView({
  leaveNotifications = [],
  markNotificationAsRead,
  queryNotifications = [],
  markQueryNotificationAsRead,
  chatNotifications = [],
  markChatNotificationAsRead,
  announcements = [],
  markAnnouncementRead,
  markAllNotificationsRead: legacyMarkAllRead,
  
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onGoToChat,
  onClose,
  dismissedAnnouncements = new Set(),
  hideHeader = false,
}: Props) {
  const { user } = useAuth();
  const [locallyDeleted, setLocallyDeleted] = useState<Set<string>>(new Set());

  // 1. Unify all notifications into a single sorted list
  const allNotifications = useMemo(() => {
    const list: NotificationItem[] = [];

    chatNotifications.forEach(n => {
      list.push({
        id: n.id,
        type: "chat",
        title: n.fromName || "New Message",
        subtitle: n.message,
        timestamp: n.timestamp,
        isRead: n.read === true || n.isRead === true,
        isDeleted: n.deletedByEmployee === true,
        raw: n
      });
    });

    leaveNotifications.forEach(l => {
      list.push({
        id: l.id,
        type: "leave",
        title: `Leave ${l.status}`,
        subtitle: `${l.leaveType} leave: ${l.fromDate} to ${l.toDate}`,
        timestamp: l.createdAt,
        isRead: l.notificationRead === true,
        isDeleted: l.deletedByEmployee === true,
        raw: l
      });
    });

    queryNotifications.forEach(q => {
      list.push({
        id: q.id,
        type: "query",
        title: "Query Reply",
        subtitle: q.subject,
        timestamp: q.createdAt,
        isRead: q.employeeUnread === false,
        isDeleted: q.deletedByEmployee === true,
        raw: q
      });
    });

    announcements.forEach(a => {
      list.push({
        id: a.id,
        type: "announcement",
        title: "Announcement",
        subtitle: a.text,
        timestamp: a.createdAt,
        isRead: dismissedAnnouncements.has(a.id),
        raw: a
      });
    });

    return list.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() || new Date(a.timestamp).getTime() || 0;
      const tb = b.timestamp?.toMillis?.() || new Date(b.timestamp).getTime() || 0;
      return tb - ta;
    });
  }, [chatNotifications, leaveNotifications, queryNotifications, announcements]);

  // 2. Filter and Split (Unread vs Read)
  const activeItems = allNotifications.filter(n => !n.isDeleted && !locallyDeleted.has(n.id));
  const unreadItems = activeItems.filter(n => !n.isRead);
  const readItems = activeItems.filter(n => n.isRead);

  // 3. Actions
  const handleMarkRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    
    // Call props
    if (onMarkRead) onMarkRead(item.id, item.type);
    if (item.type === "chat") markChatNotificationAsRead?.(item.id);
    else if (item.type === "leave") markNotificationAsRead?.(item.id);
    else if (item.type === "query") markQueryNotificationAsRead?.(item.id);
    else if (item.type === "announcement") markAnnouncementRead?.(item.id);

    try {
      if (item.type === "chat") await updateDoc(doc(db, "notifications", item.id), { read: true, isRead: true });
      else if (item.type === "leave") await updateDoc(doc(db, "leaveRequests", item.id), { notificationRead: true });
      else if (item.type === "query") await updateDoc(doc(db, "employeeQueries", item.id), { employeeUnread: false });
    } catch (err) { console.error(err); }
  };

  const handleMarkAllRead = async () => {
    if (onMarkAllRead) { onMarkAllRead(); return; }
    if (legacyMarkAllRead) { legacyMarkAllRead(); return; }
    
    if (unreadItems.length === 0) return;
    const batch = writeBatch(db);
    unreadItems.forEach(n => {
      if (n.type === "chat") batch.update(doc(db, "notifications", n.id), { read: true, isRead: true });
      else if (n.type === "leave") batch.update(doc(db, "leaveRequests", n.id), { notificationRead: true });
      else if (n.type === "query") batch.update(doc(db, "employeeQueries", n.id), { employeeUnread: false });
    });
    await batch.commit();
  };

  const handleDelete = async (item: NotificationItem) => {
    setLocallyDeleted(prev => new Set(prev).add(item.id));
    if (onDeleteNotification) onDeleteNotification(item.id, item.type);
    try {
      if (item.type === "chat") await updateDoc(doc(db, "notifications", item.id), { deletedByEmployee: true });
      else if (item.type === "leave") await updateDoc(doc(db, "leaveRequests", item.id), { deletedByEmployee: true });
      else if (item.type === "query") await updateDoc(doc(db, "employeeQueries", item.id), { deletedByEmployee: true });
    } catch (err) { console.error(err); }
  };

  const renderItem = (item: NotificationItem) => (
    <div 
      key={item.id} 
      onClick={() => { handleMarkRead(item); if (item.type === "chat" && onGoToChat) onGoToChat(item.raw.chatId); }} 
      className={`group flex items-start gap-4 p-4 rounded-2xl transition-all cursor-pointer border ${item.isRead ? "bg-white border-transparent opacity-60" : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200"}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${item.isRead ? "bg-gray-200 text-gray-500" : "bg-blue-500 text-white shadow-sm"}`}>
        {item.isRead ? "✓" : item.type === "chat" ? "💬" : item.type === "leave" ? "📋" : item.type === "query" ? "✉️" : "📢"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-sm font-bold truncate ${item.isRead ? "text-gray-500" : "text-gray-900"}`}>{item.title}</h4>
          <span className="text-[10px] font-semibold text-gray-400">{timeAgo(item.timestamp)}</span>
        </div>
        <p className={`text-xs mt-1 line-clamp-2 ${item.isRead ? "text-gray-400" : "text-gray-600"}`}>{item.subtitle}</p>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); handleDelete(item); }} 
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-auto"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 overflow-hidden">
      {/* Header */}
      {!hideHeader && (
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            Notifications
            {unreadItems.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">{unreadItems.length}</span>}
          </h2>
          <div className="flex items-center gap-2">
            {unreadItems.length > 0 && <button onClick={handleMarkAllRead} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">Mark all read</button>}
            {onClose && <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">✕</button>}
          </div>
        </div>
      )}

      {/* List style (no tabs, just sections) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
        {unreadItems.length > 0 && (
          <section>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">New Alerts</h3>
            <div className="space-y-2">{unreadItems.map(renderItem)}</div>
          </section>
        )}

        {readItems.length > 0 && (
          <section>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">Already Read</h3>
            <div className="space-y-2">{readItems.map(renderItem)}</div>
          </section>
        )}

        {activeItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6 text-gray-400">
            <div className="text-4xl mb-4 opacity-20">✨</div>
            <h3 className="font-bold">All caught up!</h3>
          </div>
        )}
      </div>
    </div>
  );
}