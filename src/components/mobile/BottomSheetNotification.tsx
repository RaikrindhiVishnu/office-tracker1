"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface BottomSheetNotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgoShort(date: any) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m\nago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h\nago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d\nago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const BottomSheetNotification: React.FC<BottomSheetNotificationProps> = ({
  isOpen,
  onClose,
}) => {
  const { notifications: systemNotifications, markAsRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(n => n.deletedByEmployee !== true)
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setChatNotifications(docs.slice(0, 50));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // Combine system notifications (like task assignments) with chat notifications
  const allNotifications = [
    ...systemNotifications.map(n => ({ ...n, isChat: false, read: n.isRead })),
    ...chatNotifications.map(n => ({ 
      ...n, 
      isChat: true, 
      read: n.read, 
      title: n.fromName || "New Message", 
      message: n.message,
      createdAt: n.timestamp
    }))
  ].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
    return (tb || 0) - (ta || 0);
  });

  const unreadItems = allNotifications.filter(n => !n.read);
  const readItems = allNotifications.filter(n => n.read);
  const totalUnreadCount = unreadItems.length;

  const handleMarkRead = async (n: any) => {
    if (n.read) return;
    if (n.isChat) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    } else {
      markAsRead(n.id);
    }
  };

  const handleMarkAllRead = async () => {
    markAllRead(); // marks system ones
    const unreadChats = chatNotifications.filter(c => !c.read);
    if (unreadChats.length > 0) {
      const batch = writeBatch(db);
      unreadChats.forEach(c => batch.update(doc(db, "notifications", c.id), { read: true }));
      await batch.commit();
    }
  };

  const renderItem = (notif: any, index: number) => {
    return (
      <motion.div
        key={notif.id || index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => handleMarkRead(notif)}
        className={`flex items-start gap-4 p-4 rounded-[20px] bg-white border cursor-pointer active:scale-[0.98] transition-all shadow-sm ${
          notif.read ? "border-gray-100 opacity-70" : "border-gray-200"
        }`}
      >
        <div className="w-11 h-11 rounded-[14px] bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
          <MessageCircle className="w-6 h-6 fill-white text-white" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-[14.5px] font-black text-gray-900 truncate">
              {notif.title || notif.fromName || "Alert"}
            </h4>
            <span className="text-[10px] font-bold text-gray-400 whitespace-pre-line text-right leading-tight shrink-0 pt-0.5">
              {timeAgoShort(notif.createdAt)}
            </span>
          </div>
          <p className="text-[13px] font-medium text-gray-600 mt-1 line-clamp-1 truncate">
            {notif.message || notif.subtitle || "New notification"}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[88vh] bg-[#F8FAFC] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[201] flex flex-col"
          >
            {/* Header Area */}
            <div className="bg-white rounded-t-[32px] pt-3 pb-4 px-6 shadow-sm border-b border-gray-100 z-10">
              <div className="flex justify-center mb-4" onClick={onClose}>
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[22px] font-black text-gray-900">Notifications</h2>
                  {totalUnreadCount > 0 && (
                    <span className="bg-rose-400 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                      {totalUnreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {totalUnreadCount > 0 && (
                    <button 
                      onClick={() => handleMarkAllRead()} 
                      className="text-[13px] font-black text-blue-600 hover:text-blue-700 active:scale-95"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={onClose} className="text-gray-400 active:scale-90">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable List */}
            <div className="overflow-y-auto px-5 py-6 flex-1 bg-white">
              {unreadItems.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-4">
                    New Alerts
                  </h3>
                  <div className="flex flex-col gap-3">
                    {unreadItems.map((n, i) => renderItem(n, i))}
                  </div>
                </div>
              )}

              {readItems.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-4">
                    Already Read
                  </h3>
                  <div className="flex flex-col gap-3">
                    {readItems.map((n, i) => renderItem(n, i))}
                  </div>
                </div>
              )}

              {allNotifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-sm font-bold text-gray-500">All caught up!</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
