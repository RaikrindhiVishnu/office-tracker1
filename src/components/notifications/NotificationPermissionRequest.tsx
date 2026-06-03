// src/components/notifications/NotificationPermissionRequest.tsx

"use client";

import React, { useEffect, useState } from "react";
import { BellRing, X, ShieldAlert, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const NotificationPermissionRequest: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only prompt if permission has not been requested yet
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = Notification.permission;
      const dismissed = localStorage.getItem("notification_prompt_dismissed");
      
      if (permission === "default" && !dismissed) {
        // Trigger prompt after a short delay for better UX
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleRequestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      console.log(`[Permission] User choice: ${permission}`);
      setShowPrompt(false);
      
      // Reload page to re-initialize FCM tokens if granted
      if (permission === "granted") {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    // Suppress for 7 days
    localStorage.setItem("notification_prompt_dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 border border-gray-100 shadow-2xl flex flex-col gap-6 relative"
          >
            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon & Title */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 animate-bounce">
                <BellRing className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Enable Push Notifications</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-[280px] mx-auto">
                  Stay updated with realtime office changes on the go.
                </p>
              </div>
            </div>

            {/* Bullet points */}
            <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs text-gray-700">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <span>Get leave approvals and requests processed instantly.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <span>Receive clock-in reminders and meeting updates.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <span>Instant notifications for emergency office announcements.</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleRequestPermission}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl text-xs font-bold transition-all duration-300"
              >
                Enable Notifications
              </button>
              <button
                onClick={handleDismiss}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-semibold transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
