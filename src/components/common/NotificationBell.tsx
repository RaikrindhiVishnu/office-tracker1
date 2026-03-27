"use client";

// src/components/common/NotificationBell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Drop this anywhere in your navbar / header:
//
//   import NotificationBell from "@/components/common/NotificationBell";
//   <NotificationBell userId={user.uid} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, query, where, orderBy,
  onSnapshot, updateDoc, doc, writeBatch, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification, NotificationType } from "@/lib/notifications";

// ─── Icon colours per type ────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { dot: string; icon: string; label: string }> = {
  success: { dot: "bg-green-500",  icon: "✓", label: "text-green-600" },
  error:   { dot: "bg-red-500",    icon: "✕", label: "text-red-600"   },
  warning: { dot: "bg-amber-400",  icon: "⚠", label: "text-amber-600" },
  info:    { dot: "bg-blue-500",   icon: "i", label: "text-blue-600"  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
}

export default function NotificationBell({ userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Real-time listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
    });
    return () => unsub();
  }, [userId]);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Mark single as read ─────────────────────────────────────────────────────
  const handleRead = useCallback(async (n: Notification) => {
    if (!n.isRead) {
      await updateDoc(doc(db, "notifications", n.id), { isRead: true });
    }
  }, []);

  // ── Mark all as read ────────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { isRead: true }));
      await batch.commit();
    } finally {
      setMarkingAll(false);
    }
  }, [notifications]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount ? ` — ${unreadCount} unread` : ""}`}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-gray-600">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ maxHeight: "480px", display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 transition-colors"
              >
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.5" className="text-gray-400">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">All caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleRead(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${!n.isRead ? "bg-blue-50/40" : ""}`}
                      >
                        {/* Type indicator dot */}
                        <div className="shrink-0 mt-0.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${cfg.dot}`}>
                            {cfg.icon}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs font-semibold truncate ${n.isRead ? "text-gray-700" : "text-gray-900"}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 leading-relaxed ${n.isRead ? "text-gray-400" : "text-gray-600"}`}>
                            {n.message}
                          </p>
                          {n.relatedCollection && (
                            <span className="inline-block mt-1.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {n.relatedCollection}
                            </span>
                          )}
                        </div>

                        {/* Unread dot */}
                        {!n.isRead && (
                          <div className="shrink-0 mt-1.5">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}