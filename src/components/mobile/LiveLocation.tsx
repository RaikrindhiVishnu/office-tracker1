// src/components/mobile/LiveLocation.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Map, Navigation, ShieldCheck, RefreshCw, EyeOff } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export const LiveLocation: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // State
  const [sharing, setSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Get battery levels
  useEffect(() => {
    if (typeof window !== "undefined" && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level * 100);
        battery.onlevelchange = () => {
          setBatteryLevel(battery.level * 100);
        };
      });
    }
  }, []);

  const startTracking = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("GPS not supported");
      return;
    }

    setSharing(true);

    // Watch position
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(current);
        updateLocationInDb(current);
      },
      (err) => {
        console.error("watchPosition error:", err);
        stopTracking();
        alert("GPS tracking failed: Permission denied or time-out.");
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    watchIdRef.current = watchId;

    showToast({
      title: "GPS Tracking Active 🛰️",
      message: "Continuous location sharing enabled. Click to review settings.",
      category: "system",
      priority: "low",
    });
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    setCoords(null);
    showToast({
      title: "GPS Tracking Paused 👁️‍",
      message: "Location sharing successfully disabled.",
      category: "system",
      priority: "low",
    });
  };

  const updateLocationInDb = async (current: { lat: number; lng: number; accuracy: number }) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "liveLocations", user.uid), {
        userId: user.uid,
        name: user.displayName || "Employee",
        lat: current.lat,
        lng: current.lng,
        accuracy: current.accuracy,
        battery: batteryLevel,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to update location in Firestore:", e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Map className="w-4.5 h-4.5 text-indigo-600" />
        Live Location Tracking
      </h3>

      <div className="flex flex-col gap-4">
        {/* Toggle Panel */}
        <div className={`p-4 rounded-2xl border transition-all duration-300 ${sharing ? "bg-indigo-50/50 border-indigo-200 animate-pulse" : "bg-gray-50/50 border-gray-100"}`}>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className={`p-2.5 rounded-xl ${sharing ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                {sharing ? <Navigation className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900">
                  {sharing ? "Sharing Location Live" : "Location Sharing Paused"}
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Allows admin to verify dispatch status & safety.
                </p>
              </div>
            </div>

            <button
              onClick={sharing ? stopTracking : startTracking}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${sharing ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sharing ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {sharing && coords && (
            <div className="mt-3 pt-3 border-t border-indigo-100/50 flex flex-col gap-1 text-[10px] text-indigo-600 font-medium">
              <p className="flex items-center gap-1">
                <span>Lat: {coords.lat.toFixed(6)}</span>
                <span>·</span>
                <span>Lng: {coords.lng.toFixed(6)}</span>
              </p>
              <p>GPS Precision: ±{Math.round(coords.accuracy)}m</p>
              {batteryLevel !== null && <p>Device Battery: {Math.round(batteryLevel)}%</p>}
            </div>
          )}
        </div>

        {/* Privacy Shield Info */}
        <div className="flex gap-2.5 bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-[10px] text-gray-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Your Privacy Matters:</strong> Tracking is strictly opt-in and works only when toggled on. You can disable sharing at any time.
          </span>
        </div>
      </div>
    </div>
  );
};
