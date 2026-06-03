// src/components/mobile/MobileDashboard.tsx

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { MobileAttendance } from "./MobileAttendance";
import { VoiceWorkUpdate } from "./VoiceWorkUpdate";
import { MobileMeetingJoiner } from "./MobileMeetingJoiner";
import { MobileQuickApprovals } from "./MobileQuickApprovals";
import ChatBot from "../ChatBot";
import { EmergencyBroadcast } from "./EmergencyBroadcast";
import { MobileLeave } from "./MobileLeave";
import { MobileProfile } from "./MobileProfile";
import { MobileHelp } from "./MobileHelp";
import { MobilePayslips } from "./MobilePayslips";
import ProjectManagement from "../../app/(dashboard)/employee/views/projectmanagement";
import { MobileDirectory } from "./MobileDirectory";
import MeetChatAppUpdated from "../../components/MeetChatAppUpdated";
import { MobileCalendar } from "./MobileCalendar";
import {
  Home,
  UserCheck,
  Mic,
  MessageSquare,
  ShieldAlert,
  AlertTriangle,
  LogOut,
  Calendar,
  Layers,
  Award,
  Sparkles,
  ChevronRight,
  Folder,
  FileText,
  User as UserIcon,
  HelpCircle,
  Users,
  Clock,
  RefreshCw,
  CalendarX2,
  GitPullRequest,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getTodayDateStr } from "@/lib/breakTracking";
import { doc, onSnapshot, getDocs, query, collection, orderBy, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeaveType } from "@/types/leave";
import { checkIn, checkOut } from "@/lib/attendance";

export const MobileDashboard: React.FC = () => {
  const { user, userData, userRole, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    "home" | "attendance" | "standup" | "assistant" | "approvals" | "emergency" | "projects" | "payslips" | "profile" | "leave" | "help" | "directory" | "chat" | "calendar" | "more"
  >("home");

  // Firestore state for Project Management
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [companyEvents, setCompanyEvents] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  // Leave Request form states
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");

  // Live Timer State
  const [attendance, setAttendance] = useState<any>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleHomeCheckInOut = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const isCheckedIn = attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null;
      if (isCheckedIn) {
        await checkOut(user.uid);
      } else {
        await checkIn(user.uid);
      }
    } catch (error) {
      console.error("Home Check-In Error:", error);
      alert("Failed to update status.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Redirect if not logged in
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login?redirect=/mobile");
    }
  }, [user, loading, router]);

  // Read search parameters for deep-linking tabs reactively
  useEffect(() => {
    const tab = searchParams ? searchParams.get("tab") : null;
    if (tab && [
      "home", "attendance", "standup", "assistant", "approvals", "emergency",
      "projects", "payslips", "profile", "leave", "help", "directory", "more"
    ].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // Fetch projects and users for Project Management
  useEffect(() => {
    if (!user) return;
    const unsubProjects = onSnapshot(
      query(collection(db, "projects"), orderBy("createdAt", "desc")),
      (snap) => setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubAnnouncements = onSnapshot(
      query(collection(db, "messages"), orderBy("createdAt", "desc")),
      (snap) => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEvents = onSnapshot(collection(db, "companyEvents"), (snap) =>
      setCompanyEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubLeaves = onSnapshot(query(collection(db, "leaveRequests"), where("status", "==", "Pending")), (snap) =>
      setPendingLeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubProjects();
      unsubUsers();
      unsubAnnouncements();
      unsubEvents();
      unsubLeaves();
    };
  }, [user]);

  // Fetch today's attendance for the Live Timer
  useEffect(() => {
    if (!user) return;
    const dateStr = getTodayDateStr();
    const unsub = onSnapshot(doc(db, "attendance", `${user.uid}_${dateStr}`), (snap) => {
      if (snap.exists()) {
        setAttendance(snap.data());
      } else {
        setAttendance(null);
      }
    });
    return () => unsub();
  }, [user]);

  // Calculate live shift timer
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
        const sessions = attendance.sessions || [];
        let totalMs = 0;
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
          const end = s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut;
          if (start && end) totalMs += (end - start);
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

  // Handle leave submission
  const handleSubmitLeave = async () => {
    if (!fromDate || !toDate || !leaveReason.trim()) { setLeaveMsg("Please fill all fields"); return; }
    if (new Date(fromDate) > new Date(toDate)) { setLeaveMsg("End date must be after start date"); return; }
    try {
      setSubmitting(true); setLeaveMsg("");
      await addDoc(collection(db, "leaveRequests"), {
        uid: user!.uid, userName: user!.email?.split("@")[0] || "Unknown",
        userEmail: user!.email || "", userPhoto: userData?.profilePhoto || "",
        leaveType, fromDate, toDate, reason: leaveReason.trim(),
        status: "Pending", notificationRead: false, createdAt: serverTimestamp(),
      });
      setLeaveMsg("✅ Request submitted");
      setFromDate(""); setToDate(""); setLeaveReason(""); setLeaveType("casual");
      setTimeout(() => setLeaveMsg(""), 2000);
    } catch (error: any) { setLeaveMsg(`❌ ${error.message}`); }
    finally { setSubmitting(false); }
  };

  // Generate dynamic recent activities from user's actual sessions
  const recentActivities = useMemo(() => {
    const activities: any[] = [];
    if (attendance?.sessions) {
      attendance.sessions.forEach((s: any, idx: number) => {
        if (s.checkIn) {
          activities.push({
            id: `ci-${idx}`,
            icon: "🟢",
            title: "Checked In",
            time: s.checkIn?.toMillis ? new Date(s.checkIn.toMillis()) : new Date(s.checkIn),
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            desc: "Started shift"
          });
        }
        if (s.checkOut) {
          activities.push({
            id: `co-${idx}`,
            icon: "🔴",
            title: "Checked Out",
            time: s.checkOut?.toMillis ? new Date(s.checkOut.toMillis()) : new Date(s.checkOut),
            color: "text-rose-500",
            bg: "bg-rose-50",
            desc: "Ended shift"
          });
        }
      });
    }
    // Mock initialization if no actual moves
    if (activities.length === 0) {
       activities.push({
            id: `mock-ci`,
            icon: "🔵",
            title: "System Update",
            time: new Date(),
            color: "text-blue-500",
            bg: "bg-blue-50",
            desc: "App initialized successfully"
       })
    }
    activities.sort((a, b) => b.time.getTime() - a.time.getTime());
    return activities.slice(0, 3);
  }, [attendance]);

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center font-bold text-gray-500 animate-pulse">Loading employee profile...</div>
      </div>
    );
  }

  // Determine visibility permissions
  const isManager = userRole === "admin" || userRole === "hr" || userRole === "superadmin";
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  // Calculate today's progress percentage safely outside JSX to avoid Turbopack regex parsing issues
  const todayProgressPercent = Math.min(100, (shiftSeconds / 28800) * 100);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 text-gray-900">
      {/* Global Branded Header — for all tabs except chat */}
      {activeTab !== "chat" && (
        <div className="bg-white px-4 pt-4 pb-3 flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Image src="/logo-black.svg" alt="TGY CRM Logo" width={85} height={50} className="object-contain" priority />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("chat")} className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H7V22L11.6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="11" r="1.2" fill="#3b82f6"/>
                <circle cx="12" cy="11" r="1.2" fill="#3b82f6"/>
                <circle cx="16" cy="11" r="1.2" fill="#3b82f6"/>
              </svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
            </button>
            <button onClick={() => router.push("/notifications")} className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[1.5px] border-white text-[8px] text-white font-bold flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            <button onClick={() => setActiveTab("profile")} className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm active:scale-90 transition-transform overflow-hidden">
              {(userData as any).profilePhoto && typeof (userData as any).profilePhoto === "string"
                ? <img src={(userData as any).profilePhoto} className="w-full h-full object-cover" alt="avatar" />
                : <span className="text-white font-black text-sm">{userData.name?.charAt(0)?.toUpperCase() || "E"}</span>
              }
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Render Container */}
      <main className={["home", "projects", "payslips", "profile", "leave", "help", "directory", "chat", "calendar"].includes(activeTab) ? "w-full pb-20" : "px-4 pt-6 max-w-lg mx-auto flex flex-col gap-6 pb-20"}>

        {/* ═══════════════════════════════════════════════════ */}
        {/* Tab 1: HOME                                        */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === "home" && (
          <div className="flex flex-col bg-[#f4f5f7] min-h-screen">
            <style>{`
              @keyframes ticker-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .hide-scrollbar::-webkit-scrollbar { display: none; }
              .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .fade-in-up { animation: fade-in-up 0.4s ease both; }
            `}</style>



            {/* ── SEARCH BAR ── */}
            <div className="bg-white px-4 pt-3 pb-4 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2.5 bg-[#f4f5f7] rounded-2xl px-4 py-3 border border-gray-100">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <span className="text-[13px] text-gray-400 font-medium">Search people, tasks, projects...</span>
              </div>
              <button className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center active:scale-90 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8"/>
                </svg>
              </button>
            </div>

            {/* ── CATEGORY NAV TABS ── */}
            <div className="bg-white border-b border-gray-100 px-3 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
              {([
                { label: "Home", tab: "home", icon: "🏠" },
                { label: "Attend.", tab: "attendance", icon: "👤" },
                { label: "Projects", tab: "projects", icon: "📁" },
                { label: "Leave", tab: "leave", icon: "🏄" },
                { label: "Chat", tab: "chat", icon: "💬" },
                { label: "Payslips", tab: "payslips", icon: "📄" },
              ] as const).map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as any)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-2xl transition-all border-2 ${
                    activeTab === item.tab ? "bg-indigo-50 border-indigo-200 text-indigo-600 font-bold" : "border-gray-50 bg-white text-gray-500"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                </button>
              ))}
            </div>

            {/* 3. Scrolling Announcements & Welcome Hero */}
            <div className="bg-gradient-to-b from-[#f8f9fe] to-[#eff2fc] pt-2 pb-1">
              {announcements && announcements.length > 0 && (
                <div className="px-5 py-2 flex items-center gap-2.5 overflow-hidden">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0"></div>
                  <div className="flex-1 overflow-hidden relative h-4">
                    <div className="absolute whitespace-nowrap text-[12px] font-bold text-indigo-900/80 flex gap-10 animate-[ticker-scroll_25s_linear_infinite] items-center h-full">
                      {announcements.map(a => <span key={a.id}>{a.text}</span>)}
                      {announcements.map(a => <span key={a.id + "-clone"}>{a.text}</span>)}
                    </div>
                  </div>
                </div>
              )}

              {/* ── GREETING HERO CARD & CHECK-IN/OUT ── */}
              <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mx-4 mt-2 mb-4 bg-gradient-to-br from-[#6b4ce6] via-[#613ee0] to-[#542ecf] text-white rounded-[32px] p-6 shadow-xl shadow-indigo-200/50 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-full mb-3">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Welcome Back 👋</span>
                    </div>
                    <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1.5">Good Afternoon</div>
                    <h2 className="text-3xl font-black tracking-tight">Hey, {userData.name?.split(" ")[0] || "Employee"}</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white/90">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="text-[10px] font-semibold text-indigo-300 mt-0.5">Shift: 9:00 AM - 6:00 PM</div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Today's Shift Timer</span>
                  <span className="text-2xl font-black tracking-tight mt-0.5 tabular-nums">
                    {formatTimer(shiftSeconds)}
                  </span>
                </div>
                <button
                  onClick={handleHomeCheckInOut}
                  disabled={isSyncing}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all duration-300 flex items-center gap-2 ${
                    attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/20 active:scale-95"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-950/20 active:scale-95"
                  }`}
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  {attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null
                    ? "Check Out"
                    : "Check In"}
                </button>
              </div>
            </motion.div>
          </div>
          
          {/* ── LEAVE BALANCE INDICATOR ── */}
            <div className="px-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🌴</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Casual Leaves</div>
                  </div>
                  <div className="text-base font-black text-gray-900">{(userData as any).casualLeaves !== undefined ? (userData as any).casualLeaves : 12} <span className="text-[10px] text-gray-400 font-bold uppercase">left</span></div>
                </div>
                <div className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🤒</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Sick Leaves</div>
                  </div>
                  <div className="text-base font-black text-gray-900">{(userData as any).sickLeaves !== undefined ? (userData as any).sickLeaves : 12} <span className="text-[10px] text-gray-400 font-bold uppercase">left</span></div>
                </div>
              </div>
            </div>

            {/* ── RECENT ACTIVITY ── */}
            <div className="px-4 mb-4">
              <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Recent Activity</h3>
              <div className="bg-white rounded-[24px] p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute left-7 top-6 bottom-6 w-[2px] bg-gray-50"></div>
                {recentActivities.map((act, index) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={act.id} 
                    className="flex items-start gap-3 relative z-10"
                  >
                    <div className={`w-8 h-8 rounded-full ${act.bg} flex items-center justify-center shrink-0 border-[3px] border-white shadow-sm`}>
                      <span className="text-sm">{act.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{act.title}</h4>
                        <span className="text-[9px] font-bold text-gray-400 shrink-0 ml-2">
                          {act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{act.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* 2. Manager Pending Approvals */}
            {isManager && pendingLeaves.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-100 p-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <h4 className="text-xs font-black text-amber-900">Pending Approvals</h4>
                      <p className="text-[10px] text-amber-700 font-medium">{pendingLeaves.length} leave requests require review</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("approvals")} className="bg-white text-amber-700 text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm border border-amber-200">
                    Review
                  </button>
                </div>
              </div>
            )}

            {/* 4. Team Status */}
            <div className="bg-white border-b border-gray-100 py-5">
              <div className="px-5 mb-4 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Team Status</h3>
                <span className="text-[10px] font-bold text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{users.filter(u => u.status === "ONLINE").length} Online</span>
              </div>
              <div className="flex overflow-x-auto hide-scrollbar px-5 gap-5 pb-1">
                {users.map(u => (
                  <div key={u.id} className="flex flex-col items-center gap-2 shrink-0 active:scale-95 transition-transform" onClick={() => setActiveTab("directory")}>
                    <div className="relative">
                      <div className="w-[52px] h-[52px] rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
                        {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center font-bold text-gray-400">{u.name?.charAt(0)}</span>}
                      </div>
                      <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${u.status === "ONLINE" ? "bg-emerald-500" : "bg-gray-300"}`} />
                    </div>
                    <span className="text-[10px] font-extrabold text-gray-600 truncate w-14 text-center">{u.name?.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Activity Feed */}
            <div className="bg-[#f4f5f7] px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg font-black text-gray-900">Recent activity</h2>
                <button className="text-[13px] font-bold text-indigo-600">See all</button>
              </div>

              <div className="flex flex-col gap-3">
                {/* AI Assistant */}
                <div onClick={() => setActiveTab("assistant")} className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-indigo-50/70 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900">AI Assistant</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Chat, summarize & ask anything</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Now</span>
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full">Active</span>
                  </div>
                </div>

                {/* Daily standup */}
                <div onClick={() => setActiveTab("standup")} className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-emerald-50/70 flex items-center justify-center">
                      <Mic className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900">Daily standup</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Voice update pending</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">9:00 AM</span>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full">Due</span>
                  </div>
                </div>

                {/* Leave request */}
                <div onClick={() => setActiveTab("approvals")} className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-rose-50/70 flex items-center justify-center">
                      <CalendarX2 className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900">Leave request</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">{pendingLeaves.length} requests awaiting review</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">2h ago</span>
                    <span className="bg-rose-50 text-rose-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full">{pendingLeaves.length} pending</span>
                  </div>
                </div>

                {/* Project Alpha */}
                <div onClick={() => setActiveTab("projects")} className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-violet-50/70 flex items-center justify-center">
                      <GitPullRequest className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900">Project Alpha</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Sprint 4 — 3 tasks overdue</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Yesterday</span>
                    <span className="bg-violet-50 text-violet-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full">In review</span>
                  </div>
                </div>

              </div>
            </div>

            {/* 6. Today's Overview — compact */}
            <div className="bg-[#f4f5f7] px-4 pt-3 pb-4">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <h2 className="text-[15px] font-black text-gray-900">Today's overview</h2>
                <button className="text-[12px] font-bold text-indigo-500">Details</button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">

                {/* Card 1: Time Logged */}
                <div className="bg-white rounded-[20px] px-3.5 py-3 flex flex-col gap-2 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">Time</span>
                    </div>
                    {(attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null) && (
                      <span className="bg-emerald-50 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-0.5 leading-none">
                    <span className="text-xl font-black text-gray-900">{formatTimer(shiftSeconds).split(':')[0]}</span>
                    <span className="text-[10px] font-bold text-gray-400">h</span>
                    <span className="text-xl font-black text-gray-900 ml-0.5">{formatTimer(shiftSeconds).split(':')[1]}</span>
                    <span className="text-[10px] font-bold text-gray-400">m</span>
                  </div>
                </div>

                {/* Card 2: Projects */}
                <div className="bg-white rounded-[20px] px-3.5 py-3 flex flex-col gap-2 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <Folder className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">Projects</span>
                    </div>
                    <span className="bg-indigo-50 text-indigo-500 text-[9px] font-extrabold px-2 py-0.5 rounded-full">{projects.filter(p => p.members?.includes(user?.uid) || p.assignedTo?.includes(user?.email)).length} on</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 leading-none">{projects.filter(p => p.members?.includes(user?.uid) || p.assignedTo?.includes(user?.email)).length}</div>
                </div>

                {/* Card 3: Tasks */}
                <div className="bg-white rounded-[20px] px-3.5 py-3 flex flex-col gap-2 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-violet-50 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5 text-violet-500" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">Tasks</span>
                    </div>
                    <span className="bg-orange-50 text-orange-500 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Due</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 leading-none">8</div>
                </div>

                {/* Card 4: Online */}
                <div className="bg-white rounded-[20px] px-3.5 py-3 flex flex-col gap-2 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-rose-500" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">Online</span>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full">{users.filter(u => u.status === "ONLINE").length} now</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 leading-none">{users.filter(u => u.status === "ONLINE").length}</div>
                </div>

              </div>
            </div>

            {/* 7. Apps & Tools Grid */}
            <div className="bg-white p-6 border-b border-gray-100">
              <div className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-6">Apps & Tools</div>
              <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                {[
                  { icon: UserCheck, label: "Check In", tab: "attendance", bg: "bg-sky-50 text-sky-600" },
                  { icon: Mic, label: "Standup", tab: "standup", bg: "bg-emerald-50 text-emerald-600" },
                  { icon: Folder, label: "Projects", tab: "projects", bg: "bg-indigo-50 text-indigo-600" },
                  { icon: Calendar, label: "Leave", tab: "leave", bg: "bg-rose-50 text-rose-600" },
                  { icon: MessageSquare, label: "Chat", tab: "chat", bg: "bg-blue-50 text-blue-600" },
                  { icon: Calendar, label: "Calendar", tab: "calendar", bg: "bg-purple-50 text-purple-600" },
                  { icon: FileText, label: "Payslips", tab: "payslips", bg: "bg-orange-50 text-orange-600" },
                  { icon: Users, label: "Directory", tab: "directory", bg: "bg-teal-50 text-teal-600" },
                ].map((item, i) => (
                  <button key={i} onClick={() => setActiveTab(item.tab as any)} className="flex flex-col items-center gap-2.5 group">
                    <div className={`w-14 h-14 rounded-[1.5rem] ${item.bg} flex items-center justify-center group-active:scale-90 transition-transform`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-600">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: ATTENDANCE */}
        {activeTab === "attendance" && <MobileAttendance />}

        {/* Tab 3: DAILY UPDATE */}
        {activeTab === "standup" && <VoiceWorkUpdate />}

        {/* Tab 4: VOICE ASSISTANT */}
        {activeTab === "assistant" && (
          <div className="h-[calc(100dvh-150px)] w-full relative">
            <ChatBot isInline={true} />
          </div>
        )}

        {/* Tab 5: QUICK APPROVALS */}
        {activeTab === "approvals" && isManager && <MobileQuickApprovals />}

        {/* Tab 6: EMERGENCY BROADCAST */}
        {activeTab === "emergency" && isAdmin && <EmergencyBroadcast />}

        {/* Tab 7: PROJECTS */}
        {activeTab === "projects" && (
          <ProjectManagement user={{ ...user, ...userData }} projects={projects} users={users} />
        )}

        {/* Tab 8: PAYSLIPS */}
        {activeTab === "payslips" && (
          <MobilePayslips />
        )}

        {/* Tab 9: PROFILE */}
        {activeTab === "profile" && (
          <MobileProfile />
        )}

        {/* Tab 10: LEAVE REQUESTS */}
        {activeTab === "leave" && (
          <MobileLeave />
        )}

        {/* Tab 11: HELP & QUERIES */}
        {activeTab === "help" && (
          <MobileHelp />
        )}

        {/* Tab 12: DIRECTORY */}
        {activeTab === "directory" && (
          <div className="p-4 bg-gray-50 min-h-screen">
            <MobileDirectory user={{ ...user, ...userData }} />
          </div>
        )}

        {/* Tab 13: CHAT — full screen, no header, no bottom padding */}
        {activeTab === "chat" && (
          <div style={{ position: "fixed", inset: 0, zIndex: 45, display: "flex", flexDirection: "column" }}>
            <MeetChatAppUpdated users={users} isOpen={true} onClose={() => setActiveTab("home")} />
          </div>
        )}

        {/* Tab 14: CALENDAR */}
        {activeTab === "calendar" && (
          <MobileCalendar />
        )}

        {/* Tab 15: MORE */}
        {activeTab === "more" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Features Directory</h3>
              <div className="flex flex-col gap-2">
                <MenuOption icon={<Users className="w-5 h-5 text-sky-600" />} label="Colleague Directory" desc="Find and contact team members" onClick={() => setActiveTab("directory")} />
                <MenuOption icon={<MessageSquare className="w-5 h-5 text-indigo-600" />} label="Meet & Chat" desc="Team messaging and calls" onClick={() => setActiveTab("chat")} />
                <MenuOption icon={<Calendar className="w-5 h-5 text-rose-600" />} label="Company Calendar" desc="Holidays and team leaves" onClick={() => setActiveTab("calendar")} />
                <MenuOption icon={<Folder className="w-5 h-5 text-blue-600" />} label="Projects & Tasks" desc="View timelines and update kanban boards" onClick={() => setActiveTab("projects")} />
                <MenuOption icon={<FileText className="w-5 h-5 text-emerald-600" />} label="My Payslips" desc="View and download monthly payslips" onClick={() => setActiveTab("payslips")} />
                <MenuOption icon={<Calendar className="w-5 h-5 text-indigo-600" />} label="Apply Leave" desc="Request leaves and view holiday calendar" onClick={() => setActiveTab("leave")} />
                <MenuOption icon={<UserIcon className="w-5 h-5 text-amber-600" />} label="My Profile" desc="Update profile details and preferences" onClick={() => setActiveTab("profile")} />
                <MenuOption icon={<HelpCircle className="w-5 h-5 text-purple-600" />} label="Help & Queries" desc="Submit queries and review admin responses" onClick={() => setActiveTab("help")} />
              </div>
            </div>

            {isManager && (
              <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100 shadow-sm">
                <h3 className="text-sm font-black text-amber-900 mb-4 uppercase tracking-wider">Manager Quick Access</h3>
                <div className="flex flex-col gap-2">
                  <MenuOption icon={<Layers className="w-5 h-5 text-amber-600" />} label="Manage Approvals" desc="Review leaves and attendance requests" onClick={() => setActiveTab("approvals")} />
                  {isAdmin && (
                    <MenuOption icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="Emergency Alerts" desc="Broadcast emergency notifications" onClick={() => setActiveTab("emergency")} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 py-2.5 px-6 flex items-center justify-between z-40 max-w-lg mx-auto shadow-lg">
        {/* Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "home" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>

        {/* Attendance */}
        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "attendance" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[9px] font-bold">Attendance</span>
        </button>

        {/* Standup */}
        <button
          onClick={() => setActiveTab("standup")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "standup" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Mic className="w-5 h-5" />
          <span className="text-[9px] font-bold">Standup</span>
        </button>

        {/* AI Chat */}
        <button
          onClick={() => setActiveTab("assistant")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "assistant" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-bold">AI Chat</span>
        </button>

        {/* More */}
        <button
          onClick={() => setActiveTab("more")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "more" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[9px] font-bold">More</span>
        </button>
      </nav>
    </div>
  );
};

// Sub-component for Feature directory options
const MenuOption: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}> = ({ icon, label, desc, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 rounded-2xl transition-all text-left active:scale-[0.99] border border-transparent hover:border-gray-100"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="p-2.5 bg-gray-50 rounded-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <h4 className="text-xs font-extrabold text-gray-900 truncate">{label}</h4>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{desc}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
    </button>
  );
};
