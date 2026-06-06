"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Calendar, MessageSquare, AlertTriangle } from "lucide-react";

export interface BottomSheetNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
}

export const BottomSheetNotification: React.FC<BottomSheetNotificationProps> = ({
  isOpen,
  onClose,
  notifications,
}) => {
  // Prevent body scrolling when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case "event": return <Calendar className="w-5 h-5 text-indigo-500" />;
      case "message": return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case "alert": return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default: return <Bell className="w-5 h-5 text-amber-500" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case "event": return "bg-indigo-50";
      case "message": return "bg-blue-50";
      case "alert": return "bg-rose-50";
      default: return "bg-amber-50";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[101] flex flex-col"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2 w-full" onClick={onClose}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            <div className="px-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900">Notifications</h2>
                <p className="text-xs font-semibold text-gray-500">You have {notifications.length} new updates</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 active:scale-95 transition-transform">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable List */}
            <div className="overflow-y-auto px-4 py-4 flex-1">
              {notifications.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-500">All caught up!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {notifications.map((notif, i) => (
                    <motion.div
                      key={notif.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex gap-4 active:scale-[0.98] transition-transform"
                    >
                      <div className={`w-12 h-12 shrink-0 rounded-full ${getBg(notif.type)} flex items-center justify-center`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-0.5">{notif.title}</h4>
                        <p className="text-xs text-gray-600 font-medium leading-relaxed mb-2 line-clamp-2">
                          {notif.message}
                        </p>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {notif.time || "Just now"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
