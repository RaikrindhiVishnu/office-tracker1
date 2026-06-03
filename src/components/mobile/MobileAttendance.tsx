// src/components/mobile/MobileAttendance.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { checkIn, checkOut } from "@/lib/attendance";
import { startBreak, endBreak, calcTotalBreakMinutes, getActiveBreak, getTodayDateStr } from "@/lib/breakTracking";
import { queueOfflineAction } from "@/lib/offlineSync";
import { storage, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { Camera, MapPin, Compass, AlertCircle, RefreshCw, CheckCircle2, CalendarDays, Clock } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { MobileAttendanceCalendar } from "./MobileAttendanceCalendar";

export const MobileAttendance: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // Screen states
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [viewMode, setViewMode] = useState<"today" | "history">("today");

  // Shift Timer States
  const [shiftSeconds, setShiftSeconds] = useState(0);

  // GPS States
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  // Camera States
  const [showCamera, setShowCamera] = useState(false);
  const [selfieSrc, setSelfieSrc] = useState<string | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check network status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOffline(!navigator.onLine);

    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const dateStr = getTodayDateStr();
    const unsub = onSnapshot(doc(db, "attendance", `${user.uid}_${dateStr}`), (snap) => {
      if (snap.exists()) {
        setAttendance(snap.data());
      } else {
        setAttendance(null);
      }
      setLoading(false);
    });
    requestLocation();
    
    return () => unsub();
  }, [user]);

  // Live timer effect
  useEffect(() => {
    let interval: any;
    if (attendance) {
      const isCheckedIn = attendance.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null;
      if (isCheckedIn) {
        interval = setInterval(() => {
          const sessions = attendance.sessions || [];
          let totalMs = 0;
          for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
            if (!start) continue;
            const end = s.checkOut ? (s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut) : Date.now();
            totalMs += (end - start);
          }
          setShiftSeconds(Math.floor(totalMs / 1000));
        }, 1000);
      } else {
        // Not actively checked in, just set total static time
        const sessions = attendance.sessions || [];
        let totalMs = 0;
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
          const end = s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut;
          if (start && end) {
            totalMs += (end - start);
          }
        }
        setShiftSeconds(Math.floor(totalMs / 1000));
      }
    } else {
      setShiftSeconds(0);
    }
    return () => clearInterval(interval);
  }, [attendance]);

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Vibrate phone helper
  const triggerHaptic = () => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Location request helper
  const requestLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocError("GPS is not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocError(null);
      },
      (err) => {
        console.warn("GPS Error:", err.message || "Unknown error");
        setLocError("Could not capture GPS location. Enable access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Setup camera stream
  const startCamera = async () => {
    setShowCamera(true);
    setSelfieSrc(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Camera access failed:", e);
      setLocError("Camera access denied. Please allow it.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // Flip horizontally for selfie mirror effect
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setSelfieSrc(dataUrl);
        stopCamera();
      }
    }
  };

  // Upload selfie helper
  const uploadSelfie = async (uid: string): Promise<string> => {
    if (!selfieSrc) return "";
    setUploadingSelfie(true);
    const dateStr = new Date().toISOString().split("T")[0];
    const path = `attendance/selfies/${uid}_${dateStr}.jpg`;
    const imageRef = storageRef(storage, path);
    try {
      await uploadString(imageRef, selfieSrc, "data_url");
      const url = await getDownloadURL(imageRef);
      return url;
    } catch (e) {
      console.error("Selfie upload failed:", e);
      throw e;
    } finally {
      setUploadingSelfie(false);
    }
  };

  // Perform Attendance actions
  const handleCheckIn = async () => {
    if (!user) return;
    if (!location && !offline) {
      alert("Capturing GPS coordinates... Please wait.");
      requestLocation();
      return;
    }

    if (!selfieSrc && !offline) {
      alert("A verification selfie is required to Clock-In.");
      startCamera();
      return;
    }

    setSyncing(true);
    triggerHaptic();

    try {
      if (offline) {
        await queueOfflineAction("checkin", {
          uid: user.uid,
          timestamp: Date.now(),
        });
        showToast({
          title: "Checked In Offline 🚀",
          message: "Check-in logged locally. Will sync when back online.",
          category: "attendance",
          priority: "medium",
        });
      } else {
        await uploadSelfie(user.uid);
        await checkIn(user.uid);
        triggerHaptic();
        showToast({
          title: "Checked In Successfully! ✓",
          message: `Clocked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
          category: "attendance",
          priority: "low",
        });
      }
      setSelfieSrc(null);
    } catch (e: any) {
      alert(e.message || "Failed check in");
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      if (offline) {
        await queueOfflineAction("checkout", {
          uid: user.uid,
          timestamp: Date.now(),
        });
        showToast({
          title: "Checked Out Offline 🚀",
          message: "Check-out logged locally. Will sync when back online.",
          category: "attendance",
          priority: "medium",
        });
      } else {
        await checkOut(user.uid);
        triggerHaptic();
        showToast({
          title: "Checked Out Successfully! ✓",
          message: "Rest well, check-out completed.",
          category: "attendance",
          priority: "low",
        });
      }
    } catch (e: any) {
      alert(e.message || "Failed check out");
    } finally {
      setSyncing(false);
    }
  };

  const handleBreakToggle = async () => {
    if (!user || !attendance) return;
    const active = getActiveBreak(attendance.breaks || []);
    setSyncing(true);
    try {
      if (active) {
        if (offline) {
          await queueOfflineAction("break", { uid: user.uid, action: "end" });
        } else {
          await endBreak(user.uid);
        }
        triggerHaptic();
        showToast({
          title: "Break Ended ⚡",
          message: "Back to productive mode. Focus mode active.",
          category: "attendance",
          priority: "low",
        });
      } else {
        if (offline) {
          await queueOfflineAction("break", { uid: user.uid, action: "start", type: "LUNCH" });
        } else {
          await startBreak(user.uid, "LUNCH");
        }
        triggerHaptic();
        showToast({
          title: "Break Logged ☕",
          message: "Enjoy your break. Push alerts are paused.",
          category: "attendance",
          priority: "low",
        });
      }
    } catch (e: any) {
      alert(e.message || "Failed break transition");
    } finally {
      setSyncing(false);
    }
  };

  // Render variables
  const isCheckedIn = attendance && attendance.sessions?.some((s: any) => s.checkOut === null);
  const activeBreak = attendance ? getActiveBreak(attendance.breaks || []) : null;

  return (
    <div className="flex flex-col h-full bg-white relative">
      
      {/* View Toggle */}
      <div className="px-4 py-2 flex justify-center">
        <div className="bg-gray-100 p-1 rounded-xl flex items-center shadow-inner">
          <button 
            onClick={() => setViewMode("today")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "today" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Clock className="w-4 h-4" /> Today
          </button>
          <button 
            onClick={() => setViewMode("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <CalendarDays className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      {viewMode === "history" ? (
        <div className="px-4 pb-8 flex-1 overflow-y-auto">
          <MobileAttendanceCalendar user={user} />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm max-w-md mx-auto w-full">
          {/* Offline Alert */}
          {offline && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Offline Mode. Actions will queue and auto-sync.
            </div>
          )}

          {/* Main Buttons */}
          <div className="flex flex-col items-center gap-6 py-4">
            {/* Status display */}
            <div className="text-center">
              <h2 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.15em] mb-4">Current Status</h2>
              
              <div className="flex flex-col items-center justify-center pt-2 pb-6">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Shift Time</span>
                <div className="text-6xl font-black text-gray-900 tracking-tighter tabular-nums drop-shadow-sm mb-4">
                  {formatTimer(shiftSeconds)}
                </div>
                <h3 className="text-xl font-extrabold text-gray-950 mt-1">
                  {activeBreak ? "☕ On Lunch Break" : isCheckedIn ? "🟢 Checked In / Active" : "🔴 Checked Out / Inactive"}
                </h3>
              </div>
            </div>

            {/* Dynamic Buttons */}
            {!isCheckedIn && !activeBreak ? (
              <button
                onClick={handleCheckIn}
                disabled={syncing}
                className="w-44 h-44 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-lg shadow-lg shadow-indigo-100 hover:shadow-xl active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-2 border-4 border-indigo-50"
              >
                {syncing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
                Check In
              </button>
            ) : (
              <div className="flex gap-4">
                {/* Break Toggle */}
                <button
                  onClick={handleBreakToggle}
                  disabled={syncing}
                  className={`w-32 h-32 rounded-full font-bold text-sm flex flex-col items-center justify-center gap-1.5 transition-all duration-300 border-4 ${
                    activeBreak
                      ? "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-emerald-50 border-emerald-50"
                      : "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-50 border-amber-50"
                  }`}
                >
                  ☕
                  <span>{activeBreak ? "Resume Work" : "Take Break"}</span>
                </button>

                {/* Check Out */}
                <button
                  onClick={handleCheckOut}
                  disabled={syncing || !!activeBreak}
                  className="w-32 h-32 rounded-full bg-gradient-to-tr from-red-500 to-rose-600 text-white font-bold text-sm flex flex-col items-center justify-center gap-1.5 shadow-rose-50 border-4 border-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  🔴
                  <span>Check Out</span>
                </button>
              </div>
            )}

            {/* GPS location status */}
            <div className="w-full mt-4 flex items-center gap-2.5 bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-xs">
              <MapPin className={`w-4 h-4 shrink-0 ${location ? "text-indigo-600" : "text-gray-400"}`} />
              <div className="flex-1 min-w-0">
                {location ? (
                  <div>
                    <p className="font-bold text-gray-800">GPS Locked</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)
                    </p>
                  </div>
                ) : locError ? (
                  <p className="text-red-500 font-medium">{locError}</p>
                ) : (
                  <p className="text-gray-400 font-medium">Acquiring satellite lock...</p>
                )}
              </div>
              <button onClick={requestLocation} className="p-1 text-gray-400 hover:text-gray-700">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Camera Overlay Modal */}
            {showCamera && (
              <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden p-5 flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-white text-center">Face/Selfie Verification</h4>
                  <div className="absolute inset-0 rounded-[32px] border-2 border-indigo-600/10 pointer-events-none" />
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-gray-800">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={capturePhoto}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                    >
                      Capture Selfie
                    </button>
                    <button
                      onClick={stopCamera}
                      className="py-3 px-4 bg-gray-800 text-gray-400 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Render Selfie Preview if Captured */}
            {selfieSrc && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 w-full text-xs">
                <img src={selfieSrc} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="Selfie" />
                <div className="flex-1">
                  <p className="font-bold text-indigo-800">Selfie Captured</p>
                  <p className="text-[10px] text-indigo-500 mt-0.5">Face verified successfully</p>
                </div>
                <button onClick={() => setSelfieSrc(null)} className="text-red-500 hover:text-red-700 font-semibold">
                  Retake
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};
