"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  subscribeToNotifications, 
  markNotificationAsRead,
  markAllNotificationsAsRead 
} from "@/lib/employeeSync";

type EmployeeNotification = {
  id: string;
  type: string;
  employeeId: string;
  employeeName: string;
  message: string;
  changes: any;
  timestamp: any;
  read: boolean;
};

export default function AdminNotificationBell() {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to notifications (only for admins)
  useEffect(() => {
    if (!user?.uid || userData?.role !== "admin") return;

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (newNotifications) => {
        setNotifications(newNotifications);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, userData?.role]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Handle marking all as read
  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    await markAllNotificationsAsRead(user.uid);
    setNotifications([]);
    setShowDropdown(false);
  };

  // Get changed fields
  const getChangedFields = (changes: any): string[] => {
    if (!changes) return [];
    return Object.keys(changes).filter(key => 
      key !== 'lastUpdated' && 
      key !== 'lastUpdatedBy' &&
      key !== 'profilePhoto'
    );
  };

  // Format field name
  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Format timestamp
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp?.toDate) return "Just now";
    
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
      month: "short"
    });
  };

  // Don't show for non-admin users
  if (userData?.role !== "admin") return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors"
      >
        {/* Bell Icon */}
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

        {/* Badge Count */}
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Notifications
                {notifications.length > 0 && (
                  <span className="ml-2 text-sm text-slate-500">
                    ({notifications.length})
                  </span>
                )}
              </h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="w-16 h-16 mx-auto text-slate-300 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="font-medium text-slate-900">No notifications</p>
                <p className="text-sm text-slate-500 mt-1">
                  You're all caught up! 🎉
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => {
                  const changedFields = getChangedFields(notification.changes);
                  
                  return (
                    <div
                      key={notification.id}
                      className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 mb-1">
                            {notification.employeeName} updated their profile
                          </p>

                          {changedFields.length > 0 && (
                            <div className="mb-2">
                              <div className="flex flex-wrap gap-1">
                                {changedFields.slice(0, 3).map((field) => (
                                  <span
                                    key={field}
                                    className="inline-block bg-blue-50 px-2 py-0.5 rounded text-xs font-medium text-blue-700 border border-blue-100"
                                  >
                                    {formatFieldName(field)}
                                  </span>
                                ))}
                                {changedFields.length > 3 && (
                                  <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">
                                    +{changedFields.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-slate-500">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>

                        {/* Close button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                        >
                          <svg
                            className="w-4 h-4 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}