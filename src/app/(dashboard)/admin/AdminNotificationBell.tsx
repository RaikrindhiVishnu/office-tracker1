"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/employeeSync";
import { Timestamp } from "firebase/firestore";

/* ================= TYPES ================= */

export interface EmployeeNotification {
  id: string;
  type: string;
  employeeId: string;
  employeeName: string;
  message: string;
  changes?: Record<string, unknown>;
  timestamp?: Timestamp;
  read: boolean;
}

/* ================= COMPONENT ================= */

export default function AdminNotificationBell() {
  const { user, userData } = useAuth();

  const [notifications, setNotifications] = useState<
    EmployeeNotification[]
  >([]);

  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ================= SUBSCRIBE ================= */

  useEffect(() => {
    if (!user?.uid || userData?.role !== "admin") return;

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (newNotifications: EmployeeNotification[]) => {
        // 🔥 IMPORTANT: Explicit typing prevents DocumentData errors
        setNotifications(newNotifications);
      }
    );

    return unsubscribe;
  }, [user?.uid, userData?.role]);

  /* ================= OUTSIDE CLICK ================= */

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
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, [showDropdown]);

  /* ================= ACTIONS ================= */

  const handleMarkAsRead = async (
    notificationId: string
  ) => {
    await markNotificationAsRead(notificationId);

    // optimistic update
    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;

    await markAllNotificationsAsRead(user.uid);

    setNotifications([]);
    setShowDropdown(false);
  };

  /* ================= HELPERS ================= */

  const getChangedFields = (
    changes?: Record<string, unknown>
  ): string[] => {
    if (!changes) return [];

    return Object.keys(changes).filter(
      (key) =>
        key !== "lastUpdated" &&
        key !== "lastUpdatedBy" &&
        key !== "profilePhoto"
    );
  };

  const formatFieldName = (field: string): string =>
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

  const formatTimestamp = (
    timestamp?: Timestamp
  ): string => {
    if (!timestamp) return "Just now";

    const date = timestamp.toDate();
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  /* ================= GUARD ================= */

  if (userData?.role !== "admin") return null;

  /* ================= UI ================= */

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell */}
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors"
      >
        {/* Icon */}
        <svg
          className="w-6 h-6 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {notifications.length > 9
              ? "9+"
              : notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="px-4 py-3 border-b bg-slate-50 flex justify-between">
            <h3 className="font-bold">
              Notifications ({notifications.length})
            </h3>

            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                You're all caught up 🎉
              </div>
            ) : (
              notifications.map((notification) => {
                const changedFields = getChangedFields(
                  notification.changes
                );

                return (
                  <div
                    key={notification.id}
                    onClick={() =>
                      handleMarkAsRead(notification.id)
                    }
                    className="p-4 hover:bg-slate-50 cursor-pointer border-b"
                  >
                    <p className="font-semibold text-sm">
                      {notification.employeeName} updated
                      their profile
                    </p>

                    {changedFields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {changedFields
                          .slice(0, 3)
                          .map((field) => (
                            <span
                              key={field}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                            >
                              {formatFieldName(field)}
                            </span>
                          ))}
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-1">
                      {formatTimestamp(
                        notification.timestamp
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
