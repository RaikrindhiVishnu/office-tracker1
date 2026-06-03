// src/components/notifications/NotificationCenter.tsx

"use client";

import React, { useState, useMemo } from "react";
import { useNotifications } from "@/context/NotificationContext";
import { Notification } from "@/lib/notifications";
import { NotificationCategory } from "@/lib/notificationTypes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  CheckCheck,
  Trash2,
  Inbox,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getMobileRedirect } from "@/lib/roleRouting";

const CATEGORIES: { id: NotificationCategory | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "All Alerts", emoji: "🔔" },
  { id: "attendance", label: "Attendance", emoji: "💼" },
  { id: "leave", label: "Leaves", emoji: "🌴" },
  { id: "task", label: "Tasks", emoji: "🎯" },
  { id: "meeting", label: "Meetings", emoji: "📹" },
  { id: "message", label: "Messages", emoji: "💬" },
  { id: "emergency", label: "Emergency", emoji: "🚨" },
  { id: "ai", label: "AI Insights", emoji: "🧠" },
  { id: "productivity", label: "Rewards", emoji: "🏆" },
];

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    unreadByCategory,
    markAsRead,
    deleteNotification,
    bulkMarkRead,
    bulkDelete,
  } = useNotifications();

  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<NotificationCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "high">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Format date helper
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "";
    const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // 1. Tab filter
      if (activeTab !== "all" && n.category !== activeTab) return false;

      // 2. Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = n.title?.toLowerCase().includes(query);
        const bodyMatch = n.message?.toLowerCase().includes(query);
        if (!titleMatch && !bodyMatch) return false;
      }

      // 3. Status filter
      if (filterMode === "unread" && n.isRead) return false;
      if (filterMode === "high" && n.priority !== "high" && n.priority !== "emergency") return false;

      return true;
    });
  }, [notifications, activeTab, searchQuery, filterMode]);

  // Bulk select toggles
  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  const handleSelectToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkMarkRead = async () => {
    await bulkMarkRead(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} notifications?`)) {
      await bulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.isRead) {
      await markAsRead(n.id);
    }
    if (n.clickAction) {
      const target = getMobileRedirect(n.clickAction);
      if (target) router.push(target);
    } else if (n.category) {
      const target = getMobileRedirect(n.category);
      if (target) router.push(target);
    }
  };

  return (
    <div className="w-full">
      {/* Main List Area */}
      <div className="bg-white rounded-3xl border border-gray-100 p-4 md:p-6 shadow-sm flex flex-col min-h-[500px]">
        {/* Filters Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between pb-6 border-b border-gray-100 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
            />
          </div>

          {/* Filter Mode Chips */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Filter className="w-4 h-4 text-gray-400 mr-1" />
            {(["all", "unread", "high"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all duration-300 ${filterMode === mode
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}
              >
                {mode === "high" ? "High Priority" : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions Header */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center justify-between py-3 px-2 border-b border-gray-50 bg-gray-50/30 rounded-xl mt-3 shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredNotifications.length}
                onChange={handleSelectAll}
                className="w-4.5 h-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-500">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : `Select all (${filteredNotifications.length})`}
              </span>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkMarkRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark Read
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 border border-gray-100">
                <Inbox className="w-7 h-7 text-gray-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">All caught up!</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                No notifications match your current tab or filter constraints.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {filteredNotifications.map((n) => {
                  const isSelected = selectedIds.includes(n.id);
                  const isHigh = n.priority === "high" || n.priority === "emergency";
                  const categoryItem = CATEGORIES.find((cat) => cat.id === n.category);

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleItemClick(n)}
                      className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${isSelected
                          ? "bg-indigo-50/40 border-indigo-200"
                          : !n.isRead
                            ? "bg-blue-50/20 border-blue-100 hover:bg-blue-50/40"
                            : "bg-white border-gray-50 hover:bg-gray-50/50 hover:border-gray-100"
                        }`}
                    >
                      {/* Checkbox */}
                      <div
                        onClick={(e) => handleSelectToggle(n.id, e)}
                        className="pt-0.5 shrink-0"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </div>

                      {/* Content Details */}
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Category Tag */}
                          {categoryItem && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                              <span className="text-[11px]">{categoryItem.emoji}</span>
                              {categoryItem.label}
                            </span>
                          )}

                          {/* High importance tag */}
                          {isHigh && (
                            <span className="px-2 py-0.5 rounded-lg bg-red-100 text-[10px] font-extrabold text-red-600 uppercase tracking-wider">
                              {n.priority}
                            </span>
                          )}
                        </div>

                        <h4 className={`text-sm mt-1.5 font-bold truncate ${n.isRead ? "text-gray-700" : "text-gray-900"}`}>
                          {n.title}
                        </h4>
                        <p className={`text-xs mt-1 leading-relaxed ${n.isRead ? "text-gray-400" : "text-gray-600"}`}>
                          {n.message}
                        </p>

                        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatDate(n.createdAt)}</span>
                        </div>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {(n.clickAction || n.category) && (
                          <div
                            title="Go to details"
                            className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this notification?")) {
                              deleteNotification(n.id);
                            }
                          }}
                          title="Delete"
                          className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-600 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Read Indicator dot */}
                      {!n.isRead && (
                        <div className="absolute right-4 top-4 w-2.5 h-2.5 bg-blue-500 rounded-full group-hover:opacity-0 transition-opacity duration-200" />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
