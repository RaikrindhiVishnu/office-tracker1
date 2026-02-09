"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  subscribeToNotifications, 
  markNotificationAsRead,
  markAllNotificationsAsRead 
} from "@/lib/employeeSync";

type Leave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  status: "Pending" | "Approved" | "Rejected";
};

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

type Props = {
  leaveNotifications: Leave[];
  messages: string[];
  markNotificationAsRead: (id: string) => void;
};

export default function NotificationsView({
  leaveNotifications,
  messages,
  markNotificationAsRead: markLeaveAsRead,
}: Props) {
  const { user, userData } = useAuth();
  const [employeeNotifications, setEmployeeNotifications] = useState<EmployeeNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // Subscribe to employee update notifications (only for admins)
  useEffect(() => {
    if (!user?.uid || userData?.role !== "admin") return;

    setLoading(true);
const unsubscribe = subscribeToNotifications(
  user.uid,
  (notifications) => {

    const typedNotifications: EmployeeNotification[] =
      notifications.map((n: any) => ({
        id: n.id,
        type: n.type,
        employeeId: n.employeeId,
        employeeName: n.employeeName,
        message: n.message,
        changes: n.changedFields ?? n.changes ?? null,
        timestamp: n.createdAt ?? n.timestamp ?? null,
        read: n.read ?? false,
      }));

    setEmployeeNotifications(typedNotifications);
    setLoading(false);
  }
);

    return () => unsubscribe();
  }, [user?.uid, userData?.role]);

  // Handle marking employee notification as read
  const handleMarkEmployeeNotificationRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setEmployeeNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Handle marking all employee notifications as read
  const handleMarkAllEmployeeNotificationsRead = async () => {
    if (!user?.uid) return;
    await markAllNotificationsAsRead(user.uid);
    setEmployeeNotifications([]);
  };

  // Get field names that were changed
  const getChangedFields = (changes: any): string[] => {
    if (!changes) return [];
    return Object.keys(changes).filter(key => 
      key !== 'lastUpdated' && 
      key !== 'lastUpdatedBy' &&
      key !== 'profilePhoto'
    );
  };

  // Format field name for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Notifications</h2>
        
        {employeeNotifications.length > 0 && (
          <button
            onClick={handleMarkAllEmployeeNotificationsRead}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Employee Update Notifications (Admin Only) */}
      {userData?.role === "admin" && employeeNotifications.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
            <span>Employee Updates</span>
            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {employeeNotifications.length}
            </span>
          </h3>

          {employeeNotifications.map((notification) => {
            const changedFields = getChangedFields(notification.changes);
            
            return (
              <div
                key={notification.id}
                onClick={() => handleMarkEmployeeNotificationRead(notification.id)}
                className="p-4 rounded-lg border-l-4 border-blue-500 bg-blue-50 cursor-pointer transition hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-white"
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
                  <div className="flex-1">
                    <p className="font-semibold text-blue-700">
                      {notification.employeeName} updated their profile
                    </p>

                    {changedFields.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600 font-medium">
                          Updated fields:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {changedFields.map((field) => (
                            <span
                              key={field}
                              className="inline-block bg-white px-2 py-1 rounded text-xs font-medium text-gray-700 border border-gray-200"
                            >
                              {formatFieldName(field)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      {notification.timestamp?.toDate?.()?.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }) || "Just now"}
                    </p>

                    <p className="text-xs text-gray-700 mt-1">
                      Click to mark as read
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leave Notifications */}
      {leaveNotifications.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
            <span>Leave Updates</span>
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {leaveNotifications.length}
            </span>
          </h3>

          {leaveNotifications.map((leave) => (
            <div
              key={leave.id}
              onClick={() => markLeaveAsRead(leave.id)}
              className={`p-4 rounded-lg border-l-4 cursor-pointer transition hover:shadow-md ${
                leave.status === "Approved"
                  ? "bg-green-50 border-green-500"
                  : "bg-red-50 border-red-500"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    leave.status === "Approved"
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {leave.status === "Approved" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    )}
                  </svg>
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p
                    className={`font-semibold ${
                      leave.status === "Approved"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    Your {leave.leaveType} leave has been{" "}
                    {leave.status.toLowerCase()}! 🎉
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    📅{" "}
                    {new Date(leave.fromDate).toLocaleDateString("en-IN")} -{" "}
                    {new Date(leave.toDate).toLocaleDateString("en-IN")}
                  </p>

                  <p className="text-xs text-gray-700 mt-1">
                    Click to mark as read
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcements */}
      {messages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase">
            Announcements
          </h3>

          {messages.map((m, i) => (
            <div
              key={i}
              className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                  </svg>
                </div>
                <p className="text-gray-800 font-medium flex-1">📣 {m}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {messages.length === 0 && 
       leaveNotifications.length === 0 && 
       employeeNotifications.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-3 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5"
            />
          </svg>

          <p className="font-medium">No notifications</p>
          <p className="text-sm mt-1">You're all caught up! 🎉</p>
        </div>
      )}

      {/* Loading State */}
      {loading && employeeNotifications.length === 0 && (
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
        </div>
      )}
    </div>
  );
}