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
import ProjectManagement from "../../app/(dashboard)/admin/ProjectManagement";
import AdminQueriesView from "../../app/(dashboard)/admin/AdminQueriesView";
import MessagesView from "../../app/(dashboard)/admin/meassages";
import MonthlyReport from "../../app/(dashboard)/admin/monthlyreport";
import CalendarView from "../../app/(dashboard)/admin/calendar";
import LeadsView from "../../app/(dashboard)/admin/LeadsView";
import InvoicesView from "../../app/(dashboard)/admin/InvoicesView";
import AccountsDashboard from "../../app/(dashboard)/admin/Accounts/AccountsDashboard";
import ITAssetsView from "../../app/(dashboard)/admin/it-assets/page";
import AIInsightsView from "../../app/(dashboard)/admin/AIInsightsView";
import EmployeesView from "../../app/(dashboard)/admin/employees";
import AdminBreakView from "@/components/AdminBreakView";
import LeaveRequests from "../../app/(dashboard)/admin/leaverequests";
import { MobileDirectory } from "./MobileDirectory";
import MeetChatAppUpdated from "../../components/MeetChatAppUpdated";
import GreetingsAdmin from "../GreetingsAdmin";
import { NotificationCenter } from "../notifications/NotificationCenter";
import OrgChart from "../../components/OrgChart";
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
import { doc, onSnapshot, getDocs, query, collection, orderBy, addDoc, serverTimestamp, where, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeaveType } from "@/types/leave";
import { checkIn, checkOut } from "@/lib/attendance";

const AnimatedSearchPlaceholder = () => {
  const words = ["people", "tasks", "projects", "updates", "attendance", "leaves", "messages"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center overflow-hidden h-6 pointer-events-none">
      <span className="text-[13px] text-gray-400 font-medium whitespace-nowrap">Search for &quot;</span>
      <div className="relative inline-flex items-center justify-center px-1">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={words[index]}
            initial={{ y: 25, opacity: 0, filter: "blur(4px)", scale: 0.9 }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ y: -25, opacity: 0, filter: "blur(4px)", scale: 0.9 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
            className="text-[13px] text-indigo-600 font-bold whitespace-nowrap inline-block"
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.span layout transition={{ duration: 0.5, type: "spring", bounce: 0.4 }} className="text-[13px] text-gray-400 font-medium">&quot;</motion.span>
    </div>
  );
};

const ActiveProjectsSlider = ({ projects, users, setActiveTab }: any) => {
  const activeProjects = projects.filter((p: any) => p.status !== "Completed");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (activeProjects.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeProjects.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [activeProjects.length, isPaused]);

  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.targetTouches[0].clientX;
    setIsPaused(true);
  };
  const handleTouchMove = (e: any) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      setCurrentIndex((prev) => (prev === activeProjects.length - 1 ? 0 : prev + 1));
    }
    if (distance < -50) {
      setCurrentIndex((prev) => (prev === 0 ? activeProjects.length - 1 : prev - 1));
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (activeProjects.length === 0) return null;

  const bgImages = [
    "https://images.pexels.com/photos/158028/bellingrath-gardens-alabama-landscape-scenic-158028.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/259280/pexels-photo-259280.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/440731/pexels-photo-440731.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/235615/pexels-photo-235615.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2886937/pexels-photo-2886937.jpeg?auto=compress&cs=tinysrgb&w=800",
  ];

  return (
    <div className="bg-emerald-50/40 pt-6 pb-6 overflow-hidden relative">
      <div className="px-5 mb-4 flex items-center justify-between relative z-10">
        <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Active Projects</h3>
        <button onClick={() => setActiveTab("projects")} className="text-[10px] font-bold text-indigo-600 bg-indigo-50/80 px-3 py-1 rounded-full active:scale-95 transition-transform">View All</button>
      </div>

      <div
        className="w-full overflow-hidden relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          className="flex w-full"
          animate={{ x: `-${currentIndex * 100}%` }}
          transition={{ type: "tween", ease: [0.25, 1, 0.5, 1], duration: 0.6 }}
        >
          {activeProjects.map((p: any, index: number) => {
            const bgImage = p.imageUrl || bgImages[index % bgImages.length];
            return (
              <div key={p.id} className="w-full shrink-0 px-4">
                <div
                  onClick={() => setActiveTab("projects")}
                  className="rounded-[16px] p-5 w-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all duration-300 cursor-pointer relative overflow-hidden group h-[220px]"
                >
                  <div className="absolute inset-0 z-0">
                    <img src={bgImage} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.1] transition-transform duration-700 ease-out" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 z-0 group-hover:via-black/50 transition-colors duration-500"></div>

                  <div className="flex items-center justify-between mb-2 relative z-10">
                    <div className="w-9 h-9 rounded-[12px] bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-sm">
                      <Folder className="w-4 h-4 text-white drop-shadow-md" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white drop-shadow-sm">
                      {p.status || 'Active'}
                    </span>
                  </div>

                  <div className="mt-auto relative z-10">
                    <h4 className="text-[18px] font-black text-white mb-1.5 truncate drop-shadow-sm">{p.name}</h4>
                    <p className="text-[12px] text-white/80 line-clamp-1 font-medium mb-4 opacity-90 group-hover:opacity-100 transition-opacity">
                      {p.description || "Farm project..."}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-1.5">
                        {(p.members || []).slice(0, 3).map((mId: string, i: number) => {
                          const u = users.find((user: any) => user.uid === mId || user.id === mId);
                          return (
                            <div key={i} className="w-7 h-7 rounded-full border-[1.5px] border-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden z-10 relative">
                              {u?.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-white">{u?.name?.charAt(0) || "U"}</span>}
                            </div>
                          );
                        })}
                        {(p.members?.length || 0) > 3 && (
                          <div className="w-7 h-7 rounded-full border-[1.5px] border-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center relative z-0">
                            <span className="text-[9px] font-black text-white">+{(p.members?.length || 0) - 3}</span>
                          </div>
                        )}
                      </div>
                      {p.dueDate && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest mb-0.5">Due</span>
                          <span className="text-[11px] font-black text-white drop-shadow-sm">
                            {new Date(p.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Pagination Dashes */}
      {activeProjects.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {activeProjects.map((_: any, idx: number) => (
            <div
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1 rounded-full cursor-pointer transition-all duration-500 ease-out ${idx === currentIndex ? 'w-5 bg-indigo-600' : 'w-2.5 bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MobileAdminDashboard: React.FC = () => {
  const { user, userData, userRole, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("home");

  // Admin Module States
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState<any>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [accountType, setAccountType] = useState<any>("EMPLOYEE");
  const [role, setRole] = useState<"employee" | "lead">("employee");
  const [department, setDepartment] = useState("");

  const DECLARED_HOLIDAYS: Record<string, { title: string }> = {
    "2026-01-01": { title: "New Year" },
    "2026-01-13": { title: "Bhogi" },
    "2026-01-14": { title: "Pongal" },
    "2026-03-04": { title: "Holi" },
    "2026-03-19": { title: "Ugadi" },
    "2026-06-26": { title: "Muharram" },
    "2026-08-28": { title: "Raksha Bandan" },
    "2026-09-04": { title: "Janmastami" },
    "2026-09-14": { title: "Ganesh Chaturthi" },
    "2026-10-02": { title: "Gandhi Jayanthi" },
    "2026-10-20": { title: "Dussehra" },
    "2026-11-09": { title: "Diwali" },
    "2026-12-25": { title: "Christmas" },
  };
  const isSunday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;
  const isSecondSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 2;
  const isFourthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 4;
  const isFifthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && Math.ceil(d / 7) === 5;
  const isHoliday = (dateStr: string) => DECLARED_HOLIDAYS[dateStr];

  const getAutoStatus = ({ isHolidayDay }: any): any => isHolidayDay ? "H" : "A";
  const saveMonthlyAttendance = async (uid: string, dateStr: string, status: any) => {
    const monthKey = `${monthlyDate.getFullYear()}-${String(monthlyDate.getMonth() + 1).padStart(2, "0")}`;
    await setDoc(doc(db, "monthlyAttendance", monthKey), { [uid]: { [dateStr]: status }, updatedAt: serverTimestamp() }, { merge: true });
  };
  const loadMessages = async () => {
    const snap = await getDocs(collection(db, "messages"));
    setMessages(snap.docs.map((d) => ({ id: d.id, text: d.data().text })));
  };
  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    await addDoc(collection(db, "messages"), { text: newMsg, createdAt: serverTimestamp() });
    setNewMsg("");
    loadMessages();
  };
  useEffect(() => { loadMessages(); }, []);

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

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Notifications Modal State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Org Chart Modal State
  const [showOrgChart, setShowOrgChart] = useState(false);

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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };
  // Resolve name from userData, Firebase Auth displayName, or email prefix
  const resolvedName = userData?.name || user?.displayName || user?.email?.split("@")[0] || "Admin";
  const firstName = resolvedName.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 text-gray-900">
      {/* Global Branded Header — for all tabs except fullscreen chat overlay */}
      {activeTab !== "fullscreen-chat" && (
        <div className={`px-4 pt-5 pb-3 flex items-center justify-between sticky top-0 z-40 ${isScrolled ? "bg-white shadow-sm border-b border-gray-200" : "bg-[#e0e7ff]"}`}>
          <div className="flex items-center gap-2">
            <Image src="/logo-black.svg" alt="TGY CRM Logo" width={85} height={50} className="object-contain" priority />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("fullscreen-chat")} className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H7V22L11.6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="12" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="16" cy="11" r="1.2" fill="#3b82f6" />
              </svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
            </button>
            <button onClick={() => setShowNotifications(true)} className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
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
      <main className={["home"].includes(activeTab) ? "w-full pb-20" : "w-full px-0 pt-4 max-w-lg mx-auto flex flex-col pb-20"}>

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
            <div className="bg-[#e0e7ff] px-4 pt-3 pb-4 flex items-center gap-3 relative z-50">
              <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="absolute inset-0 bg-transparent w-full h-full pl-[44px] pr-4 text-[13px] font-medium text-gray-900 focus:outline-none z-10"
                  placeholder=""
                />

                <div className={`transition-opacity duration-300 pointer-events-none flex-1 ${searchQuery || isSearchFocused ? 'opacity-0' : 'opacity-100'}`}>
                  <AnimatedSearchPlaceholder />
                </div>
              </div>
              <button onClick={() => setActiveTab("assistant")} className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" />
                </svg>
              </button>

              {/* SEARCH RESULTS DROPDOWN */}
              <AnimatePresence>
                {searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.98 }}
                    className="absolute top-full left-4 right-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/50 overflow-hidden flex flex-col z-[100] mt-1"
                  >
                    <div className="max-h-[60vh] overflow-y-auto p-2 pb-4">
                      {/* Apps/Features Results */}
                      {(() => {
                        const apps = [
                          { label: "Team", tab: "employees", icon: "👥", desc: "Manage employees" },
                          { label: "Projects", tab: "projects", icon: "📁", desc: "View timelines" },
                          { label: "Approvals", tab: "approvals", icon: "✅", desc: "Leave requests" },
                          { label: "Messages", tab: "messages", icon: "💬", desc: "Broadcasts" },
                          { label: "Tickets", tab: "queries", icon: "🎫", desc: "Employee queries" },
                          { label: "CRM", tab: "crm", icon: "📈", desc: "Leads" },
                          { label: "Billing", tab: "invoices", icon: "🧾", desc: "Invoices" },
                          { label: "Accounts", tab: "accounts", icon: "💰", desc: "Payroll" },
                          { label: "Assets", tab: "assets", icon: "💻", desc: "IT Assets" },
                          { label: "AI Hub", tab: "ai", icon: "🧠", desc: "Insights" },
                          { label: "Calendar", tab: "calendar", icon: "📅", desc: "Company Events" },
                          { label: "Reports", tab: "monthly", icon: "📑", desc: "Attendance Reports" },
                        ];
                        const matchedApps = apps.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()) || a.tab.toLowerCase().includes(searchQuery.toLowerCase()));

                        const matchedUsers = users.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.role?.toLowerCase().includes(searchQuery.toLowerCase()));

                        const matchedProjects = projects.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));

                        if (matchedApps.length === 0 && matchedUsers.length === 0 && matchedProjects.length === 0) {
                          return <div className="p-8 text-center text-gray-400 text-[13px] font-bold">No results found for "{searchQuery}"</div>;
                        }

                        return (
                          <div className="flex flex-col gap-4 px-2 pt-2">
                            {matchedApps.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 ml-1">Apps & Tools</h4>
                                <div className="flex flex-col gap-1">
                                  {matchedApps.map((app, i) => (
                                    <div key={i} onClick={() => { setActiveTab(app.tab as any); setSearchQuery(""); }} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl active:scale-[0.98] transition-all">
                                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg">{app.icon}</div>
                                      <div>
                                        <div className="text-[13px] font-bold text-gray-900">{app.label}</div>
                                        <div className="text-[10px] text-gray-500 font-medium">{app.desc}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {matchedUsers.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 ml-1 mt-2">People Directory</h4>
                                <div className="flex flex-col gap-1">
                                  {matchedUsers.map((u) => (
                                    <div key={u.id} onClick={() => { setActiveTab("directory"); setSearchQuery(""); }} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl active:scale-[0.98] transition-all">
                                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                        {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{u.name?.charAt(0)}</div>}
                                      </div>
                                      <div>
                                        <div className="text-[13px] font-bold text-gray-900">{u.name}</div>
                                        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{u.role || "Employee"}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {matchedProjects.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 ml-1 mt-2">Projects</h4>
                                <div className="flex flex-col gap-1">
                                  {matchedProjects.map((p) => (
                                    <div key={p.id} onClick={() => { setActiveTab("projects"); setSearchQuery(""); }} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl active:scale-[0.98] transition-all">
                                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
                                      <div className="flex-1 truncate">
                                        <div className="text-[13px] font-bold text-gray-900 truncate">{p.name}</div>
                                        <div className="text-[10px] text-gray-500 font-medium truncate">{p.description || "No description"}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── CATEGORY NAV TABS ── */}
            <div className="bg-[#e0e7ff] px-3 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
              {([
                { label: "Home", tab: "home", icon: "🏠" },
                { label: "Team", tab: "employees", icon: "👥" },
                { label: "Projects", tab: "projects", icon: "📁" },
                { label: "Approvals", tab: "approvals", icon: "✅" },
                { label: "Messages", tab: "messages", icon: "💬" },
                { label: "Tickets", tab: "queries", icon: "🎫" },
                { label: "CRM", tab: "crm", icon: "📈" },
                { label: "Billing", tab: "invoices", icon: "🧾" },
                { label: "Accounts", tab: "accounts", icon: "💰" },
                { label: "Assets", tab: "assets", icon: "💻" },
                { label: "AI Hub", tab: "ai", icon: "🧠" },
                { label: "Calendar", tab: "calendar", icon: "📅" },
                { label: "Reports", tab: "monthly", icon: "📑" },
              ] as const).map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab as any)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-2xl transition-all ${activeTab === item.tab ? "bg-white text-gray-900 font-black shadow-sm" : "bg-transparent text-gray-800 hover:bg-white/20 font-bold"
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
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="mx-4 mt-2 mb-3 text-white rounded-[24px] p-5 shadow-2xl shadow-indigo-900/20 relative overflow-hidden group"
              >
                {/* Cinematic Breathing Parallax Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#4f46e5] z-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />

                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 z-0 pointer-events-none mix-blend-overlay"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.6 }}
                      className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 backdrop-blur-md px-2.5 py-1 rounded-full mb-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">Welcome Back 👋</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="text-[9px] font-bold text-white/70 uppercase tracking-widest mb-0.5"
                    >
                      {getGreeting()}
                    </motion.div>

                    {/* Awwwards-style Text Mask Reveal */}
                    <div className="overflow-hidden">
                      <motion.h2
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        className="text-3xl font-black tracking-tight drop-shadow-md"
                      >
                        Hey, {firstName}
                      </motion.h2>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-right mt-1"
                  >
                    <div className="text-xs font-black text-white/90">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="text-[9px] font-semibold text-indigo-300 mt-0.5">Shift: 9:00 AM - 6:00 PM</div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6, type: "spring" }}
                  className="bg-white/10 backdrop-blur-lg rounded-[16px] p-3 flex items-center justify-between border border-white shadow-lg relative z-10"
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">Today's Shift Timer</span>
                    <span className="text-2xl font-black tracking-tight mt-0.5 tabular-nums leading-none">
                      {formatTimer(shiftSeconds)}
                    </span>
                  </div>
                  <button
                    onClick={handleHomeCheckInOut}
                    disabled={isSyncing}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all duration-300 flex items-center gap-1.5 ${attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null
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
                </motion.div>
              </motion.div>
            </div>

            {/* ── ADMIN QUICK STATS ── */}
            <div className="px-4 mb-4">
              <div className="flex items-center gap-3">
                <div onClick={() => setActiveTab("approvals")} className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-transform">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✅</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Approvals</div>
                  </div>
                  <div className="text-base font-black text-rose-500">{pendingLeaves.length}</div>
                </div>
                <div onClick={() => setActiveTab("employees")} className="flex-1 bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-transform">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">👥</span>
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Team</div>
                  </div>
                  <div className="text-base font-black text-indigo-600">{users.length}</div>
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
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-amber-50/30 border-b border-amber-100/50 py-5"
            >
              <div className="px-5 mb-4 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Team Status</h3>
                <span className="text-[10px] font-bold text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{users.filter(u => u.status === "ONLINE").length} Online</span>
              </div>
              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                  }
                }}
                className="flex overflow-x-auto hide-scrollbar px-5 gap-5 pb-1"
              >
                {users.map(u => (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, scale: 0.8, x: -20 },
                      show: { opacity: 1, scale: 1, x: 0, transition: { type: "spring", stiffness: 300 } }
                    }}
                    key={u.id}
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                    onClick={() => setActiveTab("directory")}
                  >
                    <div className="relative group-active:scale-90 transition-transform">
                      <div className="w-[52px] h-[52px] rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
                        {u.profilePhoto ? <img src={u.profilePhoto} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <span className="w-full h-full flex items-center justify-center font-bold text-gray-400">{u.name?.charAt(0)}</span>}
                      </div>
                      <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${u.status === "ONLINE" ? "bg-emerald-500" : "bg-gray-300"}`} />
                    </div>
                    <span className="text-[10px] font-extrabold text-gray-600 truncate w-14 text-center group-hover:text-indigo-600 transition-colors">{u.name?.split(" ")[0]}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* 4.5 Active Projects Slider */}
            <ActiveProjectsSlider projects={projects} users={users} setActiveTab={setActiveTab} />

            {/* 5. Activity Feed */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-sky-50/40 px-4 pt-4 pb-2"
            >
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg font-black text-gray-900">Recent activity</h2>
                <button className="text-[13px] font-bold text-indigo-600">See all</button>
              </div>

              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.15 }
                  }
                }}
                className="flex flex-col gap-3"
              >
                {/* AI Assistant */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                  onClick={() => setActiveTab("assistant")}
                  className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-indigo-50/70 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">AI Assistant</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Chat, summarize & ask anything</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Now</span>
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full group-hover:bg-indigo-100 transition-colors">Active</span>
                  </div>
                </motion.div>

                {/* Daily standup */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                  onClick={() => setActiveTab("standup")}
                  className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-emerald-50/70 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <Mic className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Daily standup</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Voice update pending</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">9:00 AM</span>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full group-hover:bg-orange-100 transition-colors">Due</span>
                  </div>
                </motion.div>

                {/* Leave request */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                  onClick={() => setActiveTab("approvals")}
                  className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-rose-50/70 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                      <CalendarX2 className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-rose-600 transition-colors">Leave request</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">{pendingLeaves.length} requests awaiting review</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">2h ago</span>
                    <span className="bg-rose-50 text-rose-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full group-hover:bg-rose-100 transition-colors">{pendingLeaves.length} pending</span>
                  </div>
                </motion.div>

                {/* Project Alpha */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                  onClick={() => setActiveTab("projects")}
                  className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-[18px] bg-violet-50/70 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                      <GitPullRequest className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-violet-600 transition-colors">Project Alpha</h3>
                      <p className="text-xs font-medium text-gray-400 mt-0.5">Sprint 4 — 3 tasks overdue</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Yesterday</span>
                    <span className="bg-violet-50 text-violet-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full group-hover:bg-violet-100 transition-colors">In review</span>
                  </div>
                </motion.div>

              </motion.div>
            </motion.div>

            {/* 6. Today's Overview — compact */}
            <div className="bg-purple-50/30 px-4 pt-3 pb-6 border-b border-purple-100/50">
              <div className="flex items-center justify-between mb-4 px-0.5">
                <h2 className="text-[15px] font-black text-gray-900">Today's overview</h2>
                <button className="text-[12px] font-bold text-indigo-500">Details</button>
              </div>

              <div className="grid grid-cols-2 gap-3">

                {/* Card 1: Time Logged */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 0.1, type: "spring" }}
                  className="rounded-[20px] p-4 flex flex-col gap-2 shadow-[0_4px_15px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:scale-[1.03] hover:shadow-xl transition-all cursor-pointer h-[105px]"
                >
                  <div className="absolute inset-0 z-0">
                    <img src="https://images.pexels.com/photos/1198264/pexels-photo-1198264.jpeg?auto=compress&cs=tinysrgb&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 z-0 group-hover:via-black/50 transition-colors"></div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[10px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      </div>
                      <span className="text-[11px] font-black text-white/90 drop-shadow-sm">Time</span>
                    </div>
                    {(attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null) && (
                      <span className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full shadow-sm">Active</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-0.5 leading-none mt-auto relative z-10">
                    <span className="text-2xl font-black text-white drop-shadow-md">{formatTimer(shiftSeconds).split(':')[0]}</span>
                    <span className="text-[10px] font-bold text-white/70">h</span>
                    <span className="text-2xl font-black text-white drop-shadow-md ml-0.5">{formatTimer(shiftSeconds).split(':')[1]}</span>
                    <span className="text-[10px] font-bold text-white/70">m</span>
                  </div>
                </motion.div>

                {/* Card 2: Projects */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 0.2, type: "spring" }}
                  onClick={() => setActiveTab("projects")}
                  className="rounded-[20px] p-4 flex flex-col gap-2 shadow-[0_4px_15px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:scale-[1.03] hover:shadow-xl transition-all cursor-pointer h-[105px]"
                >
                  <div className="absolute inset-0 z-0">
                    <img src="https://images.pexels.com/photos/2886937/pexels-photo-2886937.jpeg?auto=compress&cs=tinysrgb&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 z-0 group-hover:via-black/50 transition-colors"></div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[10px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                        <Folder className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      </div>
                      <span className="text-[11px] font-black text-white/90 drop-shadow-sm">Projects</span>
                    </div>
                    <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full shadow-sm">{projects.filter(p => p.members?.includes(user?.uid) || p.assignedTo?.includes(user?.email)).length} on</span>
                  </div>
                  <div className="text-2xl font-black text-white leading-none mt-auto relative z-10 drop-shadow-md">
                    {projects.filter(p => p.members?.includes(user?.uid) || p.assignedTo?.includes(user?.email)).length}
                  </div>
                </motion.div>

                {/* Card 3: Tasks */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="rounded-[20px] p-4 flex flex-col gap-2 shadow-[0_4px_15px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:scale-[1.03] hover:shadow-xl transition-all cursor-pointer h-[105px]"
                >
                  <div className="absolute inset-0 z-0">
                    <img src="https://images.pexels.com/photos/317355/pexels-photo-317355.jpeg?auto=compress&cs=tinysrgb&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 z-0 group-hover:via-black/50 transition-colors"></div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[10px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                        <Layers className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      </div>
                      <span className="text-[11px] font-black text-white/90 drop-shadow-sm">Tasks</span>
                    </div>
                    <span className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 text-orange-100 text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full shadow-sm">Due</span>
                  </div>
                  <div className="text-2xl font-black text-white leading-none mt-auto relative z-10 drop-shadow-md">8</div>
                </motion.div>

                {/* Card 4: Online */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 0.4, type: "spring" }}
                  onClick={() => setActiveTab("directory")}
                  className="rounded-[20px] p-4 flex flex-col gap-2 shadow-[0_4px_15px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:scale-[1.03] hover:shadow-xl transition-all cursor-pointer h-[105px]"
                >
                  <div className="absolute inset-0 z-0">
                    <img src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 z-0 group-hover:via-black/50 transition-colors"></div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[10px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                        <Users className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      </div>
                      <span className="text-[11px] font-black text-white/90 drop-shadow-sm">Online</span>
                    </div>
                    <span className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full shadow-sm">{users.filter(u => u.status === "ONLINE").length} now</span>
                  </div>
                  <div className="text-2xl font-black text-white leading-none mt-auto relative z-10 drop-shadow-md">{users.filter(u => u.status === "ONLINE").length}</div>
                </motion.div>

              </div>
            </div>

            {/* 7. Admin Quick Access Grid */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-white p-6 border-b border-gray-100"
            >
              <div className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-6">Admin Modules</div>
              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 }
                  }
                }}
                className="grid grid-cols-4 gap-y-6 gap-x-2"
              >
                {[
                  { emoji: "👥", label: "Team", tab: "employees", bg: "bg-sky-50 text-sky-600 hover:bg-sky-100" },
                  { emoji: "✅", label: "Approvals", tab: "approvals", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
                  { emoji: "📁", label: "Projects", tab: "projects", bg: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
                  { emoji: "🎫", label: "Tickets", tab: "queries", bg: "bg-rose-50 text-rose-600 hover:bg-rose-100" },
                  { emoji: "💬", label: "Messages", tab: "messages", bg: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
                  { emoji: "📈", label: "CRM", tab: "crm", bg: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
                  { emoji: "🧾", label: "Billing", tab: "invoices", bg: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
                  { emoji: "💰", label: "Accounts", tab: "accounts", bg: "bg-teal-50 text-teal-600 hover:bg-teal-100" },
                  { emoji: "💻", label: "IT Assets", tab: "assets", bg: "bg-cyan-50 text-cyan-600 hover:bg-cyan-100" },
                  { emoji: "🧠", label: "AI Hub", tab: "ai", bg: "bg-violet-50 text-violet-600 hover:bg-violet-100" },
                  { emoji: "📅", label: "Calendar", tab: "calendar", bg: "bg-amber-50 text-amber-600 hover:bg-amber-100" },
                  { emoji: "📑", label: "Reports", tab: "monthly", bg: "bg-lime-50 text-lime-600 hover:bg-lime-100" },
                  { emoji: "👤", label: "Attendance", tab: "attendance", bg: "bg-red-50 text-red-600 hover:bg-red-100" },
                  { emoji: "🏄", label: "Work Update", tab: "standup", bg: "bg-pink-50 text-pink-600 hover:bg-pink-100" },
                  { emoji: "📄", label: "Payslips", tab: "payslips", bg: "bg-gray-50 text-gray-600 hover:bg-gray-100" },
                  { emoji: "🗒️", label: "Emp Details", tab: "employees", bg: "bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100" },
                  { emoji: "🎉", label: "Greetings", tab: "greetings", bg: "bg-amber-50 text-amber-600 hover:bg-amber-100" },
                ].map((item, i) => (
                  <motion.button
                    variants={{
                      hidden: { opacity: 0, scale: 0.8 },
                      show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300 } }
                    }}
                    key={i}
                    onClick={() => {
                      setActiveTab(item.tab as any);
                      if (item.tab === "calendar") {
                        setShowCalendar(true);
                      }
                    }}
                    className="flex flex-col items-center gap-2.5 group cursor-pointer"
                  >
                    <div className={`w-14 h-14 rounded-[1.5rem] ${item.bg} flex items-center justify-center group-active:scale-90 group-hover:-translate-y-1 group-hover:shadow-md transition-all text-2xl`}>
                      {item.emoji}
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 group-hover:text-gray-900 transition-colors">{item.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>



            {/* 10. My Action Items */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-emerald-50/40 px-5 pt-6 pb-8 border-b border-emerald-100/50"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-black text-gray-900">My Action Items</h2>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100/50">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>

              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col gap-3">
                {[
                  { text: "Submit Q3 Expense Report", due: "Today", urgent: true },
                  { text: "Review Design Mocks", due: "Tomorrow", urgent: false },
                  { text: "Complete Compliance Training", due: "Next Week", urgent: false }
                ].map((task, i) => (
                  <div key={i} className="bg-white rounded-[20px] p-4 flex items-center gap-3 shadow-sm border border-emerald-100/50 active:scale-[0.98] transition-transform cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0" />
                    <div className="flex-1">
                      <div className="text-[13px] font-black text-gray-900 leading-tight">{task.text}</div>
                      <div className={`text-[10px] font-bold mt-0.5 ${task.urgent ? 'text-rose-500' : 'text-gray-400'}`}>Due {task.due}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* 11. Company Announcements */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-amber-50/40 px-5 pt-6 pb-8 border-b border-amber-100/50"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-black text-gray-900">Announcements</h2>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-amber-100/50">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                </div>
              </div>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="bg-white rounded-[24px] p-5 shadow-sm border border-amber-100/50 flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100/40 rounded-bl-full z-0 pointer-events-none"></div>
                <div className="relative z-10 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <span className="text-lg">📢</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-md uppercase tracking-widest">Important</span>
                      <span className="text-[9px] font-bold text-gray-400">2 hrs ago</span>
                    </div>
                    <h3 className="text-[13px] font-black text-gray-900 leading-tight mb-1.5">Open Enrollment is Live!</h3>
                    <p className="text-[11px] font-medium text-gray-500 leading-relaxed line-clamp-2">Please review and select your health benefits for the upcoming year before Friday.</p>
                    <button className="text-[10px] font-bold text-amber-600 mt-2 uppercase tracking-widest hover:underline">Read full memo →</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* 12. Upcoming Holidays */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-cyan-50/40 px-5 pt-6 pb-8 border-b border-cyan-100/50"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-black text-gray-900">Upcoming Holidays</h2>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-cyan-100/50">
                  <CalendarX2 className="w-4 h-4 text-cyan-500" />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { date: "Aug 28", name: "Raksha Bandan", day: "Friday" },
                  { date: "Sep 04", name: "Janmastami", day: "Friday" }
                ].map((holiday, i) => (
                  <motion.div
                    key={i}
                    variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { delay: i * 0.1 } } }}
                    className="bg-white rounded-[20px] p-3 flex items-center gap-4 shadow-sm border border-cyan-100/50 group active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-[14px] bg-cyan-50 border border-cyan-100/50 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-cyan-600 uppercase">{holiday.date.split(' ')[0]}</span>
                      <span className="text-lg font-black text-gray-900 leading-none">{holiday.date.split(' ')[1]}</span>
                    </div>
                    <div>
                      <div className="text-[13px] font-black text-gray-900">{holiday.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 mt-0.5">{holiday.day} — Company Off</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>



          </div>
        )}

        {/* Employee-shared tabs also available in Admin */}
        {activeTab === "attendance" && <MobileAttendance />}
        {activeTab === "standup" && <VoiceWorkUpdate />}
        {activeTab === "assistant" && (
          <div className="h-[calc(100dvh-150px)] w-full relative">
            <ChatBot isInline={true} />
          </div>
        )}
        {activeTab === "payslips" && <MobilePayslips />}
        {activeTab === "profile" && <MobileProfile />}
        {activeTab === "leave" && <MobileLeave />}
        {activeTab === "directory" && (
          <div className="p-4 bg-gray-50 min-h-screen">
            <MobileDirectory user={{ ...user, ...userData }} />
          </div>
        )}
        {activeTab === "fullscreen-chat" && (
          <div style={{ position: "fixed", inset: 0, zIndex: 45, display: "flex", flexDirection: "column" }}>
            <MeetChatAppUpdated users={users} isOpen={true} onClose={() => setActiveTab("home")} />
          </div>
        )}
        {activeTab === "projects" && (
          <div className="w-full min-h-screen">
            <ProjectManagement user={{ ...user, ...userData }} projects={projects} users={users} />
          </div>
        )}
        {activeTab === "greetings" && (
          <div className="w-full min-h-screen">
            <GreetingsAdmin />
          </div>
        )}

        {/* Admin Modules */}
        {activeTab === "employees" && (

           <div className="px-2">
              <div className="bg-white rounded-2xl shadow-sm p-4 overflow-x-auto overflow-y-hidden mb-6">
                 <EmployeesView 
                    view="employees" setView={setActiveTab as any} selectedEmployee={selectedEmployee} users={users} 
                    setSelectedUser={setSelectedEmployee} deleteUser={() => alert("Please use desktop app to delete users.")} showAddUser={showAddUser} 
                    setShowAddUser={setShowAddUser} msg="" name={name} setName={setName} email={email} 
                    setEmail={setEmail} designation={designation} setDesignation={setDesignation} 
                    accountType={accountType} setAccountType={setAccountType} handleAddUser={() => alert("Please use desktop app to add users.")} 
                    creatingUser={false} formatTime={(ts: any) => ts?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ""} 
                    formatTotal={(mins: number = 0) => `${Math.floor(mins / 60)}h ${mins % 60}m`} 
                    role={role} setRole={setRole} department={department} setDepartment={setDepartment}
                 />
              </div>
           </div>
        )}
        {activeTab === "approvals" && (
           <div className="px-2">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                 <LeaveRequests />
              </div>
           </div>
        )}
        {activeTab === "queries" && (
           <div className="px-2 overflow-x-auto">
              {/* @ts-ignore */}
              <AdminQueriesView user={user} userData={userData} />
           </div>
        )}
        {activeTab === "messages" && (
           <div className="px-2">
             <MessagesView view={activeTab} messages={messages} newMsg={newMsg} setNewMsg={setNewMsg} sendMessage={sendMessage} loadMessages={loadMessages} db={db} />
           </div>
        )}
        {activeTab === "crm" && (
           <div className="px-2 overflow-x-auto"><LeadsView /></div>
        )}
        {activeTab === "invoices" && (
           <div className="px-2 overflow-x-auto"><InvoicesView /></div>
        )}
        {activeTab === "accounts" && (
           <div className="px-2 overflow-x-auto"><AccountsDashboard /></div>
        )}
        {activeTab === "assets" && (
           <div className="px-2 overflow-x-auto"><ITAssetsView /></div>
        )}
        {activeTab === "ai" && (
           <div className="px-2 overflow-x-auto"><AIInsightsView /></div>
        )}
        {activeTab === "calendar" && (
           <div className="px-2 overflow-x-auto">
              <CalendarView showCalendar={showCalendar} setShowCalendar={(show) => {
                setShowCalendar(show);
                if (!show) setActiveTab("home");
              }} calendarDate={calendarDate} setCalendarDate={setCalendarDate} isSunday={isSunday} isSecondSaturday={isSecondSaturday} isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday} isHoliday={isHoliday} />
           </div>
        )}
        {activeTab === "monthly" && (
           <div className="px-2 overflow-x-auto">
              <MonthlyReport db={db} users={users} monthlyDate={monthlyDate} setMonthlyDate={setMonthlyDate} monthlyAttendance={monthlyAttendance} setMonthlyAttendance={setMonthlyAttendance} sessionsByDate={{}} isHoliday={isHoliday} saveMonthlyAttendance={saveMonthlyAttendance as any} getAutoStatus={getAutoStatus} isSunday={isSunday} isSecondSaturday={isSecondSaturday} isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday} />
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

        {/* Team */}
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "employees" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold">Team</span>
        </button>

        {/* AI Bot */}
        <button
          onClick={() => setActiveTab("assistant")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "assistant" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-bold">AI Bot</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "profile" ? "text-indigo-600 scale-105" : "text-gray-400 hover:text-gray-600"
            }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>

        {/* Logout */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex flex-col items-center gap-1 transition-all text-rose-400 hover:text-rose-600 active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[9px] font-bold">Logout</span>
        </button>
      </nav>

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-[201] p-6 pb-10 max-w-lg mx-auto"
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-col items-center text-center gap-3 mb-6">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-1">
                  <LogOut className="w-7 h-7 text-rose-500" />
                </div>
                <h2 className="text-xl font-black text-gray-900">Sign Out?</h2>
                <p className="text-sm font-medium text-gray-500">You will be returned to the login screen. All your data is safely synced.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => { setShowLogoutConfirm(false); await logout(); router.push("/login"); }}
                  className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-lg shadow-rose-200"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-black py-4 rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── IN-APP NOTIFICATIONS MODAL ── */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] h-full bg-white rounded-t-3xl shadow-2xl z-[101] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <h2 className="text-lg font-black text-gray-900">Notifications</h2>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NotificationCenter />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Render Desktop-style Org Chart Modal */}
      {showOrgChart && (
        <OrgChart employees={users} onClose={() => setShowOrgChart(false)} />
      )}
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
