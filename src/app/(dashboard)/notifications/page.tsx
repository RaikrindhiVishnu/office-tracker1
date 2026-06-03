// src/app/(dashboard)/notifications/page.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationPreferencesComponent } from "@/components/notifications/NotificationPreferences";
import { useNotifications } from "@/context/NotificationContext";
import { Bell, Settings, ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotificationsPage() {
  const { unreadCount, notifications } = useNotifications();
  const [viewMode, setViewMode] = useState<"list" | "settings">("list");
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      {/* Top Breadcrumb & Actions Header */}
      <div className="max-w-3xl mx-auto mb-6">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors mb-3 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm w-fit cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-950 flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500 text-white font-extrabold px-3 py-1 rounded-full border-2 border-white shadow-sm animate-pulse">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
          </div>

          {/* Action Toggle */}
          <div className="shrink-0 flex gap-2">
            {viewMode === "settings" ? (
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-gray-700 rounded-2xl text-sm font-bold shadow-sm transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Back to Alerts</span>
              </button>
            ) : (
              <button
                onClick={() => setViewMode("settings")}
                className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 bg-white border border-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 rounded-2xl text-sm font-bold shadow-sm transition-all duration-300"
              >
                <Settings className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-3xl mx-auto">
        {viewMode === "settings" ? (
          <NotificationPreferencesComponent />
        ) : (
          <NotificationCenter />
        )}
      </div>
    </div>
  );
}