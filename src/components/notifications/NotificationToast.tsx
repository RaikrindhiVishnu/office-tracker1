// src/components/notifications/NotificationToast.tsx

"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotifications, ToastItem } from "@/context/NotificationContext";
import {
  Bell,
  Briefcase,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Zap,
  CheckCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getMobileRedirect } from "@/lib/roleRouting";

const CATEGORY_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; icon: React.ReactNode; accent: string }
> = {
  attendance: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    accent: "bg-blue-500",
    icon: <Briefcase className="w-5 h-5 text-blue-600" />,
  },
  leave: {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-800",
    accent: "bg-teal-500",
    icon: <Calendar className="w-5 h-5 text-teal-600" />,
  },
  task: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    accent: "bg-indigo-500",
    icon: <CheckCircle className="w-5 h-5 text-indigo-600" />,
  },
  meeting: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-800",
    accent: "bg-purple-500",
    icon: <Calendar className="w-5 h-5 text-purple-600" />,
  },
  message: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    accent: "bg-emerald-500",
    icon: <MessageSquare className="w-5 h-5 text-emerald-600" />,
  },
  emergency: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    accent: "bg-red-500",
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
  },
  ai: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-800",
    accent: "bg-violet-500",
    icon: <Zap className="w-5 h-5 text-violet-600" />,
  },
  productivity: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    accent: "bg-amber-500",
    icon: <Zap className="w-5 h-5 text-amber-600" />,
  },
  system: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-800",
    accent: "bg-slate-500",
    icon: <Bell className="w-5 h-5 text-slate-600" />,
  },
};

const playChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Programmatic double chime (C5 to E5)
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn("Web Audio chime blocked/failed:", e);
  }
};

export const NotificationToastContainer: React.FC = () => {
  const { toastQueue, dismissToast } = useNotifications();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm px-4 pointer-events-none md:bottom-auto md:top-4 md:right-4 md:px-0">
      <AnimatePresence>
        {toastQueue.map((toast) => (
          <ToastItemComponent key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItemComponent: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const router = useRouter();
  const cfg = CATEGORY_CONFIG[toast.category] || CATEGORY_CONFIG.system;
  const isEmergency = toast.priority === "emergency" || toast.category === "emergency";

  // Play chime on mount
  useEffect(() => {
    playChime();
  }, []);

  // Auto-dismiss setup
  useEffect(() => {
    if (isEmergency) return; // Emergency toast doesn't auto-dismiss
    const duration = toast.duration || (toast.priority === "high" ? 7000 : 5000);
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, isEmergency]);

  const handleClick = () => {
    if (toast.clickAction) {
      const target = getMobileRedirect(toast.clickAction);
      if (target) router.push(target);
    }
    onDismiss(toast.id);
  };

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    if (toast.clickAction) {
      const target = getMobileRedirect(toast.clickAction);
      if (target) router.push(target);
    }
    onDismiss(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex flex-col w-full rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 ${isEmergency
          ? "bg-red-600 border-red-700 text-white shadow-red-200/50"
          : `${cfg.bg} ${cfg.border} ${cfg.text}`
        }`}
      onClick={handleClick}
      role="alert"
    >
      <div className="flex items-start p-4 gap-3 relative">
        {/* Left Side Icon */}
        <div className={`p-2 rounded-xl shrink-0 ${isEmergency ? "bg-red-700/50 text-white" : "bg-white shadow-sm"}`}>
          {cfg.icon}
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0 pr-6">
          <h4 className={`text-sm font-bold truncate ${isEmergency ? "text-white" : "text-gray-900"}`}>
            {toast.title}
          </h4>
          <p className={`text-xs mt-1 leading-relaxed ${isEmergency ? "text-red-100" : "text-gray-600"}`}>
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${isEmergency
              ? "hover:bg-red-700 text-red-200 hover:text-white"
              : "hover:bg-gray-200/50 text-gray-400 hover:text-gray-700"
            }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Action Buttons */}
      {toast.actionButtons && toast.actionButtons.length > 0 && (
        <div className={`flex border-t divide-x shrink-0 ${isEmergency ? "border-red-700 divide-red-700" : "border-gray-100 divide-gray-100"}`}>
          {toast.actionButtons.map((btn, index) => (
            <button
              key={index}
              onClick={(e) => handleAction(e, btn.action)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold text-center transition-colors ${isEmergency
                  ? "bg-red-700/30 hover:bg-red-700/60 text-white"
                  : "bg-white/55 hover:bg-gray-50 text-indigo-600"
                }`}
            >
              {btn.title}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};
