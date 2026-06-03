// src/components/mobile/EmergencyBroadcast.tsx

"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AlertOctagon, Send, Loader2, Megaphone } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

const EMERGENCY_TYPES = [
  { id: "office_closed", label: "🏢 Office Closed", subject: "Office Closed Alert" },
  { id: "weather", label: "⛈️ Weather Warning", subject: "Severe Weather Warning" },
  { id: "fire_drill", label: "🔥 Fire Drill Notice", subject: "Fire Drill Scheduled" },
  { id: "outage", label: "🔌 System Outage", subject: "Critical Outage Alert" },
];

export const EmergencyBroadcast: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [selectedType, setSelectedType] = useState(EMERGENCY_TYPES[0].id);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    if (!message.trim() || !user) return;

    if (!confirm("Are you sure you want to broadcast this EMERGENCY alert to ALL company employees?")) {
      return;
    }

    setSending(true);
    const selected = EMERGENCY_TYPES.find((t) => t.id === selectedType);
    const title = selected ? selected.subject : "Emergency Broadcast";

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/notifications/send-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title,
          body: message,
          icon: "/icon-192.png",
          data: {
            category: "emergency",
            priority: "emergency",
            clickAction: "/notifications?filter=emergency",
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send broadcast");
      }

      const res = await response.json();
      showToast({
        title: "Broadcast Dispatched! 🚨",
        message: `Alert successfully sent to ${res.successCount || 0} active device tokens.`,
        category: "emergency",
        priority: "emergency",
      });
      setMessage("");
    } catch (e: any) {
      alert(e.message || "Failed broadcasting emergency alert");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <AlertOctagon className="w-4.5 h-4.5 text-red-600" />
        Emergency Broadcast
      </h3>

      <div className="flex flex-col gap-4">
        {/* Type Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            Emergency Alert Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EMERGENCY_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`py-2 px-3 rounded-xl text-left text-xs font-bold border transition-all ${
                  selectedType === type.id
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message Field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            Alert Message
          </label>
          <textarea
            placeholder="Specify details, safety instructions, and action items..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleBroadcast}
          disabled={sending || !message.trim()}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-100 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Megaphone className="w-4 h-4" />
          )}
          Send Emergency Broadcast
        </button>
      </div>
    </div>
  );
};
