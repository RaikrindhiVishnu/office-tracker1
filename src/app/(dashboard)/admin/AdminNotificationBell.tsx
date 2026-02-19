"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/employeeSync";
import { Timestamp } from "firebase/firestore";
import type { EmployeeNotification } from "@/types/EmployeeNotification";

export default function AdminNotificationBell() {
  const { user, userData } = useAuth();

  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [readNotifications, setReadNotifications] = useState<EmployeeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ================= SUBSCRIBE ================= */

  useEffect(() => {
    if (!user?.uid || userData?.accountType !== "ADMIN") return;

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (newNotifications) => {
        setNotifications(newNotifications);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid, userData?.accountType]);

  /* ================= CLOSE ON OUTSIDE CLICK ================= */

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  /* ================= ACTIONS ================= */

  const handleMarkAsRead = async (notification: EmployeeNotification) => {
    try {
      await markNotificationAsRead(notification.id);

      // Move to read notifications
      setReadNotifications((prev) => [notification, ...prev]);
      
      // Remove from unread
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notification.id)
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;

    try {
      await markAllNotificationsAsRead(user.uid);

      // Move all to read
      setReadNotifications((prev) => [...notifications, ...prev]);
      setNotifications([]);
    } catch (error) {
      console.error("Failed to mark all notifications:", error);
    }
  };

  /* ================= HELPERS ================= */

  const getChangedFields = (changes?: string[]): string[] => {
    return changes ?? [];
  };

  const formatFieldName = (field: string): string =>
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

  const formatTimestamp = (timestamp?: Timestamp): string => {
    if (!timestamp) return "Just now";

    const date = timestamp.toDate();
    const diffMs = Date.now() - date.getTime();

    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  
  /* ================= GUARD ================= */

  if (!user?.uid || userData?.accountType !== "ADMIN") return null;

  /* ================= RENDER NOTIFICATION ITEM ================= */

  const renderNotification = (notification: EmployeeNotification, isRead: boolean = false) => {
    const changedFields = getChangedFields(notification.changes);

    return (
      <div
        key={notification.id}
        onClick={() => !isRead && handleMarkAsRead(notification)}
        className={`p-5 border-b border-slate-100 transition-all duration-200 ${
          !isRead 
            ? "hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent cursor-pointer group bg-white" 
            : "bg-slate-50/50 opacity-75"
        }`}
      >
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg ${
              !isRead 
                ? "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600" 
                : "bg-gradient-to-br from-slate-400 to-slate-500"
            }`}>
              {notification.employeeName?.charAt(0).toUpperCase() || "?"}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-bold text-slate-800 text-base leading-tight">
                {notification.employeeName}
              </p>
              
              {!isRead && (
                <div className="flex-shrink-0">
                  <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                </div>
              )}
            </div>

            <p className="text-slate-600 text-sm mb-3">
              Updated their profile information
            </p>

            {/* Changed Fields - Show ALL fields */}
            {changedFields.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Updated Fields ({changedFields.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {changedFields.map((field) => (
                    <span
                      key={field}
                      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium ${
                        !isRead
                          ? "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200"
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {formatFieldName(field)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer - Timestamp & Action */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">
                  {formatTimestamp(notification.createdAt)}
                </p>
              </div>

              {!isRead && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                    Mark as read
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ================= UI ================= */

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Bell Button - Larger */}
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        className="relative p-3 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 rounded-2xl transition-all duration-200 group"
        aria-label="Notifications"
      >
        <svg
          className={`w-7 h-7 transition-colors ${
            notifications.length > 0
              ? "text-blue-600"
              : "text-slate-500 group-hover:text-slate-700"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* 🔴 Badge - Larger */}
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[24px] h-6 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center px-2 shadow-lg ring-2 ring-white">
            {notifications.length > 99 ? "99+" : notifications.length}
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></span>
          </span>
        )}
      </button>

      {/* ================= DROPDOWN - MUCH LARGER ================= */}

      {showDropdown && (
        <>
          {/* Backdrop overlay */}
          <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setShowDropdown(false)}></div>
          
          <div className="absolute right-0 mt-3 w-[560px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
            
            {/* Header - Larger with gradient */}
           <div className="px-5 py-2 bg-gradient-to-r from-blue-200 to-indigo-500 border-b border-slate-200/60">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-2xl">
                    Notifications
                  </h3>
                  {/* <p className="text-black text-sm mt-1">
                    {notifications.length === 0
                      ? "You're all caught up!"
                      : `${notifications.length} unread notification${notifications.length > 1 ? "s" : ""}`}
                  </p> */}
                </div>

                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-xl transition-all backdrop-blur-sm"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setActiveTab("unread")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                    activeTab === "unread"
                      ? "bg-white text-blue-600 shadow-lg"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  Unread ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab("read")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                    activeTab === "read"
                      ? "bg-white text-blue-600 shadow-lg"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  Read ({readNotifications.length})
                </button>
              </div>
            </div>

            {/* Notification List - Much taller */}
            <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
              {/* Loading State */}
              {loading ? (
                <div className="p-16 text-center">
                  <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-400 mt-4 font-medium">Loading notifications...</p>
                </div>
              ) : (
                <>
                  {/* UNREAD TAB */}
                  {activeTab === "unread" && (
                    <>
                      {notifications.length === 0 ? (
                        /* Empty State - Larger */
                        <div className="p-16 text-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                            <svg
                              className="w-12 h-12 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <h4 className="font-bold text-xl text-slate-700 mb-2">
                            All caught up!
                          </h4>
                          <p className="text-slate-500">
                            No new notifications at the moment
                          </p>
                        </div>
                      ) : (
                        /* Unread Notifications */
                        <div>
                          {notifications.map((notification) => 
                            renderNotification(notification, false)
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* READ TAB */}
                  {activeTab === "read" && (
                    <>
                      {readNotifications.length === 0 ? (
                        <div className="p-16 text-center">
                          <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
                            <svg
                              className="w-12 h-12 text-slate-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                              />
                            </svg>
                          </div>
                          <h4 className="font-bold text-xl text-slate-700 mb-2">
                            No read notifications
                          </h4>
                          <p className="text-slate-500">
                            Notifications you've dismissed will appear here
                          </p>
                        </div>
                      ) : (
                        /* Read Notifications */
                        <div>
                          {readNotifications.map((notification) => 
                            renderNotification(notification, true)
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
            }

            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }

            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }

            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
        </>
      )}
    </div>
  );
}