// src/components/notifications/NotificationPreferences.tsx

"use client";

import React, { useState } from "react";
import { useNotifications } from "@/context/NotificationContext";
import { NotificationCategory } from "@/lib/notificationTypes";
import {
  Bell,
  Volume2,
  VolumeX,
  Compass,
  Smartphone,
  Mail,
  MessageSquare,
  Moon,
  Clock,
  Check,
} from "lucide-react";

const CATEGORIES: { id: NotificationCategory; label: string; desc: string }[] = [
  { id: "attendance", label: "Attendance Alerts", desc: "Clock-in/out reminders, break timers, corrections" },
  { id: "leave", label: "Leave Approvals", desc: "Request submissions, status updates, team shortages" },
  { id: "task", label: "Task & Kanban Updates", desc: "Task assignments, comment mentions, deadlines" },
  { id: "meeting", label: "Meetings & Calls", desc: "Schedules, 15m reminders, AI summaries" },
  { id: "message", label: "Team Chat Messages", desc: "Direct messages, channel mentions, announcements" },
  { id: "emergency", label: "Emergency Broadcasts", desc: "Office closures, outage alerts, security events" },
  { id: "ai", label: "AI Insights", desc: "Wellbeing guides, focus modes, update prompts" },
  { id: "productivity", label: "Productivity Milestones", desc: "Streaks, milestone achievements, badges" },
];

const TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "Europe/London",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export const NotificationPreferencesComponent: React.FC = () => {
  const { preferences, updatePreferences } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!preferences) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-100">
        <p className="text-sm text-gray-500 animate-pulse">Loading notification settings...</p>
      </div>
    );
  }

  const handleCategoryToggle = async (catId: NotificationCategory, field: "enabled" | "sound" | "vibrate") => {
    const current = preferences.categories[catId] || { enabled: true, sound: true, vibrate: true };
    const updatedCategories = {
      ...preferences.categories,
      [catId]: {
        ...current,
        [field]: !current[field],
      },
    };

    setSaving(true);
    try {
      await updatePreferences({ categories: updatedCategories });
      triggerSuccessBadge();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleGlobalToggle = async (field: "doNotDisturb" | "emailEnabled" | "pushEnabled" | "whatsappEnabled") => {
    setSaving(true);
    try {
      await updatePreferences({ [field]: !preferences[field] });
      triggerSuccessBadge();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleQuietHoursChange = async (field: "enabled" | "from" | "to" | "timezone", value: any) => {
    const updatedQuietHours = {
      ...preferences.quietHours,
      [field]: value,
    };

    setSaving(true);
    try {
      await updatePreferences({ quietHours: updatedQuietHours });
      triggerSuccessBadge();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const triggerSuccessBadge = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure how and when you receive enterprise alerts.</p>
        </div>
        {success && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200 text-xs font-semibold">
            <Check className="w-3.5 h-3.5" />
            Saved successfully
          </div>
        )}
      </div>

      {/* 1. Master Controls */}
      <div className="py-6 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Master Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Do Not Disturb */}
          <div className={`p-4 rounded-2xl border transition-all duration-300 ${preferences.doNotDisturb ? "bg-red-50/50 border-red-200" : "bg-gray-50/50 border-gray-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className={`p-2 rounded-xl ${preferences.doNotDisturb ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Do Not Disturb (DND)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Silence all notifications, except emergencies.</p>
                </div>
              </div>
              <button
                onClick={() => handleGlobalToggle("doNotDisturb")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${preferences.doNotDisturb ? "bg-red-600" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.doNotDisturb ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className={`p-4 rounded-2xl border transition-all duration-300 ${preferences.quietHours.enabled ? "bg-indigo-50/50 border-indigo-200" : "bg-gray-50/50 border-gray-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className={`p-2 rounded-xl ${preferences.quietHours.enabled ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Quiet Hours</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Mute pushes during specific daily times.</p>
                </div>
              </div>
              <button
                onClick={() => handleQuietHoursChange("enabled", !preferences.quietHours.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${preferences.quietHours.enabled ? "bg-indigo-600" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.quietHours.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {preferences.quietHours.enabled && (
              <div className="mt-4 pt-4 border-t border-indigo-100 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">From:</span>
                  <input
                    type="time"
                    value={preferences.quietHours.from}
                    onChange={(e) => handleQuietHoursChange("from", e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">To:</span>
                  <input
                    type="time"
                    value={preferences.quietHours.to}
                    onChange={(e) => handleQuietHoursChange("to", e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">Timezone:</span>
                  <select
                    value={preferences.quietHours.timezone}
                    onChange={(e) => handleQuietHoursChange("timezone", e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Delivery Modes */}
      <div className="py-6 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Delivery Modes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${preferences.pushEnabled ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-400"}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-800">Push Alerts</span>
            </div>
            <button
              onClick={() => handleGlobalToggle("pushEnabled")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${preferences.pushEnabled ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.pushEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Email notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${preferences.emailEnabled ? "bg-purple-100 text-purple-600" : "bg-gray-200 text-gray-400"}`}>
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-800">Email Alerts</span>
            </div>
            <button
              onClick={() => handleGlobalToggle("emailEnabled")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${preferences.emailEnabled ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.emailEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* WhatsApp notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${preferences.whatsappEnabled ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}>
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-800">WhatsApp</span>
            </div>
            <button
              onClick={() => handleGlobalToggle("whatsappEnabled")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${preferences.whatsappEnabled ? "bg-green-600" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.whatsappEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Category Customization */}
      <div className="py-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Customize Categories</h3>
        <div className="flex flex-col gap-4">
          {CATEGORIES.map((cat) => {
            const current = preferences.categories[cat.id] || { enabled: true, sound: true, vibrate: true };
            const disabled = preferences.doNotDisturb && cat.id !== "emergency";
            
            return (
              <div
                key={cat.id}
                className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${
                  current.enabled && !disabled
                    ? "bg-white border-gray-100 shadow-sm"
                    : "bg-gray-50/50 border-gray-100 opacity-60"
                }`}
              >
                {/* Details */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 capitalize">{cat.label}</h4>
                    {!current.enabled && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        Muted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cat.desc}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6 mt-4 md:mt-0 shrink-0">
                  {/* Category sound */}
                  {current.enabled && !disabled && (
                    <div className="flex items-center gap-4 border-r border-gray-100 pr-6">
                      {/* Sound toggle */}
                      <button
                        onClick={() => handleCategoryToggle(cat.id, "sound")}
                        className={`p-2 rounded-xl transition-colors ${current.sound ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-400"}`}
                        title={current.sound ? "Sound Enabled" : "Sound Muted"}
                      >
                        {current.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>

                      {/* Vibrate toggle */}
                      <button
                        onClick={() => handleCategoryToggle(cat.id, "vibrate")}
                        className={`p-2 rounded-xl transition-colors ${current.vibrate ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-400"}`}
                        title={current.vibrate ? "Vibration On" : "Vibration Off"}
                      >
                        <Compass className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Enable category alert */}
                  <button
                    onClick={() => handleCategoryToggle(cat.id, "enabled")}
                    disabled={disabled}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      disabled
                        ? "bg-gray-200 cursor-not-allowed"
                        : current.enabled
                        ? "bg-indigo-600"
                        : "bg-gray-300"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${current.enabled && !disabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
