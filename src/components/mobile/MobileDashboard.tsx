// src/components/mobile/MobileDashboard.tsx

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { NotificationCenter } from "../notifications/NotificationCenter";
import OrgChart from "../../components/OrgChart";
import { BottomSheetNotification } from "./BottomSheetNotification";
import DailySheetView from "../../app/(dashboard)/employee/views/DailySheetView";
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

            // AI Project Health Score Logic
            const dueDate = p.dueDate ? new Date(p.dueDate) : null;
            const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
            const memberCount = p.members?.length || 0;

            let health = { label: "🟢 On Track", color: "bg-emerald-500/80 border-emerald-400 text-emerald-50" };
            if (daysLeft < 3 && p.status !== "Testing" && p.status !== "Completed") {
              health = { label: "🔴 At Risk", color: "bg-rose-500/80 border-rose-400 text-rose-50" };
            } else if (daysLeft < 7 || memberCount < 2) {
              health = { label: "🟡 Warning", color: "bg-amber-500/80 border-amber-400 text-amber-50" };
            }

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
                    <div className="flex gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white drop-shadow-sm">
                        {p.status || 'Active'}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full drop-shadow-sm border backdrop-blur-md ${health.color}`}>
                        {health.label}
                      </span>
                    </div>
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

const CANONICAL_HOLIDAYS = [
  { title: "New Year", date: "2026-01-01", type: "National" },
  { title: "Bhogi", date: "2026-01-13", type: "Festival" },
  { title: "Pongal", date: "2026-01-14", type: "Festival" },
  { title: "Holi", date: "2026-03-04", type: "Festival" },
  { title: "Ugadi", date: "2026-03-19", type: "Festival" },
  { title: "Muharram", date: "2026-06-26", type: "Optional" },
  { title: "Raksha Bandan", date: "2026-08-28", type: "Festival" },
  { title: "Janmastami", date: "2026-09-04", type: "Optional" },
  { title: "Ganesh Chaturthi", date: "2026-09-14", type: "Festival" },
  { title: "Gandhi Jayanthi", date: "2026-10-02", type: "National" },
  { title: "Dussehra", date: "2026-10-20", type: "Festival" },
  { title: "Diwali", date: "2026-11-09", type: "Festival" },
  { title: "Christmas", date: "2026-12-25", type: "National" },
];

export const MobileDashboard: React.FC = () => {
  const { user, userData, userRole, loading, logout } = useAuth();
  const { notifications, unreadCount } = useNotifications();
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
  const [holidays, setHolidays] = useState<any[]>(CANONICAL_HOLIDAYS);
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, snap => {
      // Check for newly added chat messages to trigger device notifications
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
          // Only trigger for truly new notifications (created within the last 5 seconds)
          if (createdAt > Date.now() - 5000) {
            triggerDeviceNotification(data.fromName || "New Message", data.message || "You received a new chat message.");
            playSound('pop');
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([25, 40, 25]);
            }
          }
        }
      });

      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(n => n.deletedByEmployee !== true)
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setChatNotifications(docs);
    });
    return () => unsubscribe();
  }, [user]);

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

  const totalUnread = unreadCount + chatNotifications.filter(c => !c.read).length;

  const prevUnreadCount = useRef(totalUnread);
  useEffect(() => {
    if (totalUnread > prevUnreadCount.current) {
      setShowNotifications(true);
      playSound('pop');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 40, 25]);
      }
    }
    prevUnreadCount.current = totalUnread;
  }, [totalUnread]);

  // ── Native Mobile: Device Notifications ──
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // We don't automatically request anymore because iOS blocks it without user gesture.
      // Handled by the banner in the UI now.
    }
  }, []);

  const triggerDeviceNotification = (title: string, body: string) => {
    setShowNotifications(true); // Show in-app bottom sheet
    if (typeof window === "undefined" || !("Notification" in window)) return;
    
    const sendPush = () => {
      const options = { body, icon: "/favicon.ico" };
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg && reg.showNotification) reg.showNotification(title, options);
          else new window.Notification(title, options);
        }).catch(() => new window.Notification(title, options));
      } else {
        new window.Notification(title, options);
      }
    };

    if (Notification.permission === "granted") {
      sendPush();
    }
  };

  // ── Native Mobile: Haptic Feedback & Sounds ──
  const playSound = (type: 'pop' | 'refresh') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'pop') {
        // Professional crisp "tick" (like iOS keyboard or premium UI click)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.02);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.03);
      } else if (type === 'refresh') {
        // Professional "Success/Refresh" tone (clean, soft double harmonic)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        
        // Envelope for first note
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        
        // Envelope for second note
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.12);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  };

  const triggerHaptic = (style: 'light' | 'success') => {
    playSound(style === 'success' ? 'refresh' : 'pop');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (style === 'light') navigator.vibrate(15);
      if (style === 'success') navigator.vibrate([25, 40, 25]);
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");

  // ── Native Mobile: Pull-to-Refresh & Swipe Gestures ──
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const TABS_ORDER = ["home", "directory", "profile", "assistant", "standup", "attendance"];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartY.current || !touchStartX.current) return;
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    const deltaY = y - touchStartY.current;

    // If at the very top and pulling down, calculate pull progress for refresh
    if (window.scrollY <= 0 && deltaY > 0) {
      const progress = Math.min(deltaY / 150, 1);
      setPullProgress(progress);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartY.current || !touchStartX.current) return;
    const y = e.changedTouches[0].clientY;
    const x = e.changedTouches[0].clientX;
    const deltaY = y - touchStartY.current;
    const deltaX = x - touchStartX.current;

    // Check Pull-to-Refresh
    if (window.scrollY <= 0 && deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX)) {
      triggerHaptic('success');
      setIsRefreshing(true);
      setPullProgress(0);
      setTimeout(() => setIsRefreshing(false), 1500); // Mock network request duration
    } else {
      setPullProgress(0);
    }

    // Check Horizontal Swipe
    if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const currentIndex = TABS_ORDER.indexOf(activeTab as string);
      if (currentIndex !== -1) {
        if (deltaX < 0 && currentIndex < TABS_ORDER.length - 1) {
          // Swipe Left -> Next Tab
          setActiveTab(TABS_ORDER[currentIndex + 1] as any);
          triggerHaptic('light');
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe Right -> Prev Tab
          setActiveTab(TABS_ORDER[currentIndex - 1] as any);
          triggerHaptic('light');
        }
      }
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setScrollDirection("down");
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection("up");
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Org Chart Modal State
  const [showOrgChart, setShowOrgChart] = useState(false);

  // Live Timer State
  const [attendance, setAttendance] = useState<any>(null);
  const [weeklyAttendance, setWeeklyAttendance] = useState<any[]>([]);
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
    const unsubHolidays = onSnapshot(query(collection(db, "holidays"), orderBy("date", "asc")), (snap) => {
      if (snap.empty) {
        setHolidays(CANONICAL_HOLIDAYS);
      } else {
        setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    });
    return () => {
      unsubProjects();
      unsubUsers();
      unsubAnnouncements();
      unsubEvents();
      unsubLeaves();
      unsubHolidays();
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

  // Fetch weekly attendance for Weekly Insights
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "attendance"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWeeklyAttendance(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [user]);

  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Sunday is 0, make it 7
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const currentDayIdx = dayOfWeek - 1;

    let totalWeekLogHours = 0;

    const chartData = days.map((dayName, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const record = weeklyAttendance.find(r => r.date === dateStr);
      let hours = 0;
      let blocks: any[] = [];

      if (index > currentDayIdx) {
        // Future day
        return { day: dayName, hours: 0, blocks: [] };
      }

      if (record && record.sessions && record.sessions.length > 0) {
        let totalMs = 0;
        const d10am = new Date(d); d10am.setHours(10, 0, 0, 0);
        const d7pm = new Date(d); d7pm.setHours(19, 0, 0, 0);
        
        for (const s of record.sessions) {
          const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
          if (!start) continue;
          
          const end = s.checkOut ? (s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut) : Date.now();
          
          const clampedStart = Math.max(start, d10am.getTime());
          const actualEnd = s.checkOut ? end : Math.min(Date.now(), d7pm.getTime());
          const clampedEnd = Math.min(actualEnd, d7pm.getTime());
          
          if (clampedEnd > clampedStart) {
            totalMs += (clampedEnd - clampedStart);
          }
        }
        hours = totalMs / (1000 * 60 * 60);
      } else if (record && record.totalMinutes) {
        hours = record.totalMinutes / 60;
      }

      hours = parseFloat(hours.toFixed(1));

      if (hours === 0) {
        // Absent or no checkin for past/current day -> red block
        return { day: dayName, hours: 0, blocks: [{ type: "break", h: "100%" }] };
      }

      totalWeekLogHours += hours;

      const hPercent = Math.min(100, (hours / 9) * 100);
      if (record.sessions && record.sessions.length > 1) {
          const h1 = hPercent * 0.45;
          const h2 = hPercent * 0.45;
          blocks = [
            { type: "work", h: `${h1}%` },
            { type: "break", h: `10%` },
            { type: "work", h: `${h2}%` }
          ];
      } else {
          blocks = [{ type: "work", h: `${hPercent}%` }];
      }

      return { day: dayName, hours, blocks };
    });

    return { data: chartData, totalHours: totalWeekLogHours.toFixed(1) };
  }, [weeklyAttendance]);

  // Calculate live shift timer
  useEffect(() => {
    let interval: any;
    if (attendance) {
      const isCheckedIn = attendance.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null;
      if (isCheckedIn) {
        interval = setInterval(() => {
          const sessions = attendance.sessions || [];
          let totalMs = 0;
          const today = new Date();
          const d10am = new Date(today); d10am.setHours(10, 0, 0, 0);
          const d7pm = new Date(today); d7pm.setHours(19, 0, 0, 0);

          for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
            if (!start) continue;
            const end = s.checkOut ? (s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut) : Date.now();
            
            const clampedStart = Math.max(start, d10am.getTime());
            const clampedEnd = Math.min(end, d7pm.getTime());
            
            if (clampedEnd > clampedStart) {
              totalMs += (clampedEnd - clampedStart);
            }
          }
          setShiftSeconds(Math.floor(totalMs / 1000));
        }, 1000);
      } else {
        const sessions = attendance.sessions || [];
        let totalMs = 0;
        const today = new Date();
        const d10am = new Date(today); d10am.setHours(10, 0, 0, 0);
        const d7pm = new Date(today); d7pm.setHours(19, 0, 0, 0);

        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const start = s.checkIn?.toMillis ? s.checkIn.toMillis() : s.checkIn;
          const end = s.checkOut?.toMillis ? s.checkOut.toMillis() : s.checkOut;
          if (!start || !end) continue;

          const clampedStart = Math.max(start, d10am.getTime());
          const clampedEnd = Math.min(end, d7pm.getTime());
          
          if (clampedEnd > clampedStart) {
            totalMs += (clampedEnd - clampedStart);
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
      triggerHaptic('success');
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
      <div className="min-h-screen bg-gray-50/50 pb-24 text-gray-900 w-full overflow-hidden">
        {/* Skeleton Top Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="w-24 h-8 bg-gray-200 rounded-lg animate-pulse" />
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="px-4 pt-1 pb-4">
          <div className="w-full h-12 bg-gray-200 rounded-xl animate-pulse" />
        </div>

        {/* Skeleton Hero Card */}
        <div className="px-4 mb-6">
          <div className="w-full h-32 bg-gray-200 rounded-[28px] animate-pulse" />
        </div>

        {/* Skeleton Grid */}
        <div className="px-4 grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center animate-pulse">
              <div className="w-12 h-12 bg-gray-100 rounded-full mb-3" />
              <div className="w-20 h-4 bg-gray-100 rounded-full mb-1.5" />
              <div className="w-12 h-3 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Determine visibility permissions
  const isManager = userRole === "admin" || userRole === "hr" || userRole === "superadmin";
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  // Calculate today's progress percentage safely outside JSX to avoid Turbopack regex parsing issues
  const todayProgressPercent = Math.min(100, (shiftSeconds / 28800) * 100);

  return (
    <div
      className="min-h-screen bg-gray-50/50 pb-24 text-gray-900 overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Global Branded Header — for all tabs except chat */}
      {activeTab !== "chat" && (
        <div className={`px-4 pt-3 pb-1 flex items-center justify-between sticky top-0 z-40 transition-transform duration-500 ease-in-out ${isScrolled ? "bg-white shadow-sm border-b border-gray-200" : "bg-[#e0e7ff]"} ${scrollDirection === "down" ? "-translate-y-[150%]" : "translate-y-0"}`}>
          <div className="flex items-center gap-2">
            <Image src="/logo-black.svg" alt="TGY CRM Logo" width={85} height={50} className="object-contain" priority />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("chat")} className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H7V22L11.6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="12" cy="11" r="1.2" fill="#3b82f6" />
                <circle cx="16" cy="11" r="1.2" fill="#3b82f6" />
              </svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[1.5px] border-white"></span>
            </button>
            <button onClick={() => { triggerHaptic('light'); triggerDeviceNotification('Office Tracker Alerts', 'You have new team messages and approval requests.'); }} className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center active:scale-90 transition-transform relative">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[1.5px] border-white text-[8px] text-white font-bold flex items-center justify-center">{totalUnread}</span>
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

      {/* Pull-to-Refresh Indicator */}
      <div
        className="flex justify-center items-center w-full overflow-hidden transition-all duration-200 ease-out"
        style={{ height: isRefreshing ? 60 : pullProgress * 60, opacity: isRefreshing ? 1 : pullProgress }}
      >
        <div className="bg-white shadow-md rounded-full p-2 flex items-center justify-center">
          <RefreshCw className={`w-5 h-5 text-indigo-500 ${isRefreshing ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullProgress * 360}deg)` }} />
        </div>
      </div>

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
            <div className="bg-[#e0e7ff] px-4 pt-1 pb-1 flex items-center gap-3 relative z-50">
              <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
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
              <button onClick={() => setActiveTab("assistant")} className="w-9 h-9 rounded-2xl bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform">
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
                          { label: "Check In / Attendance", tab: "attendance", icon: "👤", desc: "View shift details" },
                          { label: "Daily Standup", tab: "standup", icon: "🎙️", desc: "Voice update" },
                          { label: "AI Assistant", tab: "assistant", icon: "✨", desc: "Chat & Ask" },
                          { label: "Projects & Tasks", tab: "projects", icon: "📁", desc: "View timelines" },
                          { label: "Payslips", tab: "payslips", icon: "📄", desc: "View salary" },
                          { label: "Apply Leave", tab: "leave", icon: "🏄", desc: "Request off" },
                          { label: "Directory", tab: "directory", icon: "👥", desc: "Find colleagues" },
                          { label: "Chat / Messages", tab: "chat", icon: "💬", desc: "Team chats" },
                          { label: "Calendar", tab: "calendar", icon: "📅", desc: "Company events" }
                        ];
                        const queryLower = searchQuery.toLowerCase();

                        const matchedApps = apps.filter(a => a.label.toLowerCase().includes(queryLower) || a.tab.toLowerCase().includes(queryLower) || a.desc.toLowerCase().includes(queryLower));

                        const matchedUsers = users.filter(u => {
                          const roleMatches = (queryLower.includes("hr") && u.role?.toLowerCase().includes("hr")) ||
                            (queryLower.includes("admin") && u.role?.toLowerCase().includes("admin")) ||
                            (queryLower.includes("dev") && u.role?.toLowerCase().includes("dev"));
                          return roleMatches || u.name?.toLowerCase().includes(queryLower) || u.role?.toLowerCase().includes(queryLower);
                        });

                        const matchedProjects = projects.filter(p => {
                          if (queryLower.includes("delay") || queryLower.includes("overdue") || queryLower.includes("late") || queryLower.includes("risk")) {
                            return p.dueDate && new Date(p.dueDate) < new Date();
                          }
                          if (queryLower.includes("due today")) {
                            return p.dueDate && new Date(p.dueDate).toDateString() === new Date().toDateString();
                          }
                          if (queryLower.includes("active") || queryLower.includes("ongoing")) {
                            return p.status !== "Completed";
                          }
                          return p.name?.toLowerCase().includes(queryLower) || p.description?.toLowerCase().includes(queryLower);
                        });

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
            <div className="bg-[#e0e7ff] px-3 pt-1 pb-1 flex gap-2 overflow-x-auto hide-scrollbar">
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
                  onClick={() => { triggerHaptic('light'); setActiveTab(item.tab as any); }}
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

                <div className="flex flex-col relative z-10 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.6 }}
                      className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 backdrop-blur-md px-2.5 py-1 rounded-full"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">Welcome Back 👋</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-right shrink-0"
                    >
                      <div className="text-[10px] sm:text-xs font-black text-white/90 whitespace-nowrap">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="text-[9px] font-semibold text-indigo-300 mt-0.5 whitespace-nowrap">Shift: 9:00 AM - 6:00 PM</div>
                    </motion.div>
                  </div>

                  {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 mx-4 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="text-[12px] font-bold text-white leading-tight">
                        Enable real-time notifications for updates and messages.
                      </div>
                      <button
                        onClick={() => {
                          Notification.requestPermission().then(permission => {
                            if (permission === "granted") {
                              new Notification("Notifications Enabled", { body: "You will now receive device notifications." });
                              // Force re-render to hide banner
                              setHolidays([...holidays]); 
                            }
                          });
                        }}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[11px] py-2 rounded-lg shadow-sm"
                      >
                        Allow Notifications
                      </button>
                    </motion.div>
                  )}

                  <div className="overflow-hidden mt-1">
                    <motion.h2
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="text-[22px] sm:text-3xl font-black tracking-tight drop-shadow-md leading-snug break-words pr-2"
                    >
                      <span className="text-white/80 text-[12px] font-bold uppercase tracking-widest block mb-0.5">
                        {new Date().getHours() < 12 ? "Good Morning," : new Date().getHours() < 18 ? "Good Afternoon," : "Good Evening,"}
                      </span>
                      {userData.name || "Employee"}
                    </motion.h2>
                  </div>
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
                    onClick={() => { handleHomeCheckInOut(); triggerHaptic('success'); }}
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

            {/* ── ✨ AI SMART DASHBOARD INSIGHTS ── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mx-4 mb-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 shadow-sm relative overflow-hidden"
            >
              <div className="absolute -top-2 -right-2 p-2 opacity-10">
                <Sparkles className="w-16 h-16 text-indigo-600" />
              </div>
              <div className="flex items-start gap-3 relative z-10">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest mb-1">AI Daily Briefing</h3>
                  <p className="text-[13px] text-indigo-900/80 font-medium leading-relaxed">
                    {attendance?.sessions?.length > 0 && attendance.sessions[attendance.sessions.length - 1].checkOut === null
                      ? `You're clocked in! You have ${projects.filter((p: any) => p.status !== "Completed").length} active projects on the board. Let's make today productive.`
                      : `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}! Don't forget to check in. You currently have ${pendingLeaves.filter((l: any) => l.uid === user.uid).length} pending leave requests.`}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── SMART HIGHLIGHTS AUTO-LOOP CAROUSEL ── */}
            <div className="mb-4 overflow-hidden relative w-full">
              <h3 className="pl-4 text-lg font-bold text-gray-900 tracking-tight mb-3">Smart Highlights</h3>

              {/* Marquee Container */}
              <div className="w-full overflow-hidden">
                <motion.div
                  className="flex gap-3 w-max pl-4"
                  animate={{ x: ["0%", "-50%"] }}
                  transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
                >
                  {[...Array(2)].map((_, loopIndex) => (
                    <React.Fragment key={loopIndex}>
                      {/* Leave Balance Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">🌴</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Leaves</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xl font-black text-gray-900">{(userData as any).casualLeaves !== undefined ? (userData as any).casualLeaves : 12}</div>
                          <div className="text-[9px] text-emerald-600 font-bold uppercase">Casual Left</div>
                        </div>
                      </div>

                      {/* Upcoming Holiday Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">🎉</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Holiday</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xs font-black text-gray-900 truncate">Thanksgiving</div>
                          <div className="text-[9px] text-rose-600 font-bold uppercase">In 5 Days</div>
                        </div>
                      </div>

                      {/* Current Task Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">🎯</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">My Task</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xs font-black text-gray-900 truncate">UI Redesign</div>
                          <div className="text-[9px] text-blue-600 font-bold uppercase">In Progress</div>
                        </div>
                      </div>

                      {/* Latest Announcement Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-amber-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">📢</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Update</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xs font-black text-gray-900 truncate">Townhall Sync</div>
                          <div className="text-[9px] text-amber-600 font-bold uppercase">Tomorrow, 10 AM</div>
                        </div>
                      </div>

                      {/* Work Anniversary Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-purple-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">🎂</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Events</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xs font-black text-gray-900 truncate">Work Anniv.</div>
                          <div className="text-[9px] text-purple-600 font-bold uppercase">Next Week</div>
                        </div>
                      </div>

                      {/* Payroll Status Card */}
                      <div className="min-w-[140px] w-[140px] bg-white rounded-[16px] p-3 border border-gray-100 flex flex-col justify-between shadow-sm shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-teal-50 rounded-bl-full z-0"></div>
                        <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                          <span className="text-lg">💰</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Payroll</div>
                        </div>
                        <div className="relative z-10 mt-1">
                          <div className="text-xs font-black text-gray-900 truncate">May Payslip</div>
                          <div className="text-[9px] text-teal-600 font-bold uppercase">Ready</div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* ── RECENT ACTIVITY ── */}
            <div className="px-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-3">Recent Activity</h3>
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
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Team Status</h3>
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
                {users.map((u: any) => {
                  // Mock AI Sentiment
                  let sentiment = { emoji: "😐", color: "bg-gray-100 border-gray-200" };
                  if (u.status === "ONLINE") sentiment = { emoji: "🔥", color: "bg-emerald-50 border-emerald-200" };
                  else if (u.name?.length % 3 === 0) sentiment = { emoji: "😴", color: "bg-rose-50 border-rose-200" };
                  else sentiment = { emoji: "😊", color: "bg-blue-50 border-blue-200" };

                  return (
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
                        {/* AI Sentiment Badge */}
                        {isManager && (
                          <div className={`absolute -top-1 -left-1 w-4 h-4 flex items-center justify-center text-[10px] rounded-full border shadow-sm ${sentiment.color}`} title="AI Sentiment Prediction">
                            {sentiment.emoji}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-extrabold text-gray-600 truncate w-14 text-center group-hover:text-indigo-600 transition-colors">{u.name?.split(" ")[0]}</span>
                    </motion.div>
                  )
                })}
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
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recent Activity</h2>
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

            {/* 7. Apps & Tools Grid */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-white p-6 border-b border-gray-100"
            >
              <div className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-6">Apps & Tools</div>
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
                  { icon: UserCheck, label: "Check In", tab: "attendance", bg: "bg-sky-50 text-sky-600 hover:bg-sky-100" },
                  { icon: Mic, label: "Standup", tab: "standup", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
                  { icon: FileText, label: "Timesheet", tab: "daily-sheet", bg: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
                  { icon: Folder, label: "Projects", tab: "projects", bg: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
                  { icon: Calendar, label: "Leave", tab: "leave", bg: "bg-rose-50 text-rose-600 hover:bg-rose-100" },
                  { icon: MessageSquare, label: "Chat", tab: "chat", bg: "bg-cyan-50 text-cyan-600 hover:bg-cyan-100" },
                  { icon: Calendar, label: "Calendar", tab: "calendar", bg: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
                  { icon: FileText, label: "Payslips", tab: "payslips", bg: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
                  { icon: Users, label: "Directory", tab: "directory", bg: "bg-teal-50 text-teal-600 hover:bg-teal-100" },
                  { icon: UserIcon, label: "Profile", tab: "profile", bg: "bg-pink-50 text-pink-600 hover:bg-pink-100" },
                  { icon: HelpCircle, label: "Help", tab: "help", bg: "bg-amber-50 text-amber-600 hover:bg-amber-100" },
                  { icon: Sparkles, label: "AI Chat", tab: "assistant", bg: "bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100" },
                  { icon: Layers, label: "More", tab: "more", bg: "bg-slate-50 text-slate-600 hover:bg-slate-100" },
                ].map((item, i) => (
                  <motion.button
                    variants={{
                      hidden: { opacity: 0, scale: 0.8 },
                      show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300 } }
                    }}
                    key={i} onClick={() => { triggerHaptic('light'); setActiveTab(item.tab as any); }}
                    className="flex flex-col items-center gap-2.5 group cursor-pointer"
                  >
                    <div className={`w-14 h-14 rounded-[1.5rem] ${item.bg} flex items-center justify-center group-active:scale-90 group-hover:-translate-y-1 group-hover:shadow-md transition-all`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 group-hover:text-gray-900 transition-colors">{item.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>

            {/* 8. Weekly Insights (New Section) */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-teal-50/30 px-5 pt-5 pb-8 border-b border-teal-100/50"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Weekly Insights</h2>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-teal-100/50">
                  <Award className="w-4 h-4 text-teal-500" />
                </div>
              </div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { type: "spring" } }
                }}
                className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden"
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-teal-50 rounded-full blur-2xl z-0"></div>

                <div className="relative z-10">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Week Logged</div>
                      <div className="text-2xl font-black text-gray-900 leading-none">{weeklyChartData.totalHours}<span className="text-sm font-bold text-gray-400">h</span></div>
                    </div>
                    <div className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Break Gap
                    </div>
                  </div>

                  {/* Building Bar Graph - Professional Aesthetic */}
                  <div className="relative h-44 w-full mt-8 flex pb-6">
                    {/* Y-Axis Labels & Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none z-0">
                      {[8, 4, 0].map(val => (
                        <div key={val} className="w-full flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-300 w-4 text-right">{val}h</span>
                          <div className="flex-1 border-b border-dashed border-gray-200/60"></div>
                        </div>
                      ))}
                    </div>

                    {/* Bars Container */}
                    <div className="flex-1 flex items-end justify-between pl-8 relative z-10 h-[calc(100%-24px)]">
                      {weeklyChartData.data.map((d, i) => (
                        <div key={d.day} className="flex flex-col items-center group h-full justify-end relative w-6">
                          {/* Always-visible Time Text */}
                          <div className="absolute -top-6 text-[9px] font-black text-indigo-600 z-20">
                            {d.hours > 0 ? `${d.hours}h` : ""}
                          </div>

                          {/* Lollipop Line (Straight line with top dot) */}
                          <div className="w-[3px] h-full flex flex-col-reverse justify-start items-center relative z-10">
                            {d.blocks.map((b, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ height: 0 }}
                                whileInView={{ height: b.h }}
                                viewport={{ once: false }}
                                transition={{ duration: 0.8, delay: i * 0.05 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                className={`w-full rounded-[2px] ${b.type === 'work' ? 'bg-indigo-400' : 'bg-rose-500'} ${b.type === 'break' ? 'my-0.5' : ''}`}
                              />
                            ))}
                            {/* Top Dot */}
                            {d.hours > 0 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: false }}
                                transition={{ delay: i * 0.05 + 0.5, type: "spring", bounce: 0.6 }}
                                className="w-2.5 h-2.5 bg-indigo-600 rounded-full border border-white z-20 -mb-1 shadow-sm"
                              />
                            )}
                            {/* Empty state pill for aesthetics when 0 hours */}
                            {d.hours === 0 && <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mb-1"></div>}
                          </div>

                          {/* X-Axis Label */}
                          <div className="absolute -bottom-6 text-[10px] font-bold text-gray-400 group-hover:text-indigo-600 transition-colors">
                            {d.day.charAt(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </motion.div>
            </motion.div>

            {/* 9. Focus Mode (Deep Work Timer) */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, margin: "-50px" }}
              className="bg-violet-50/40 px-5 pt-6 pb-8 border-b border-violet-100/50"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Focus Mode</h2>
                <div className="text-[10px] font-bold text-violet-600 bg-violet-100/50 px-3 py-1 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></div> Deep Work
                </div>
              </div>

              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: "spring" } } }}
                className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-violet-100/50 flex flex-col items-center relative overflow-hidden"
              >
                {/* Decorative background blurs */}
                <div className="absolute -left-10 -top-10 w-32 h-32 bg-violet-100/50 rounded-full blur-3xl z-0 pointer-events-none"></div>
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-fuchsia-100/50 rounded-full blur-3xl z-0 pointer-events-none"></div>

                <div className="relative z-10 w-full flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full border-[6px] border-violet-50 flex items-center justify-center mb-5 relative shadow-sm">
                    {/* Simulated progress ring background */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="6" className="text-violet-500" strokeDasharray="295" strokeDashoffset="295" />
                    </svg>
                    <div className="text-3xl font-black text-gray-900 tabular-nums tracking-tight">25:00</div>
                  </div>

                  <h3 className="text-[13px] font-black text-gray-900 mb-1">Ready to focus?</h3>
                  <p className="text-[10px] text-gray-500 font-medium text-center mb-5 px-4">Mute notifications and track your deep work time.</p>

                  <button className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[11px] font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md">
                    <span className="text-sm">🎧</span> Start Session
                  </button>
                </div>
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
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">My Action Items</h2>
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
              className="px-4 py-6"
            >
              <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-black text-gray-900">Upcoming Holidays</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-500">
                      {holidays.filter(h => new Date(h.date + "T00:00:00").getTime() >= new Date().setHours(0,0,0,0)).slice(0, 5).length} remaining
                    </span>
                    <button className="text-[11px] font-bold text-blue-600 tracking-wide">View all &rarr;</button>
                  </div>
                </div>

                <div className="flex flex-col">
                  {holidays.filter(h => new Date(h.date + "T00:00:00").getTime() >= new Date().setHours(0,0,0,0)).slice(0, 5).map((holiday, i, arr) => {
                    const d = new Date(holiday.date + "T00:00:00");
                    const isLast = i === arr.length - 1;
                    return (
                      <div key={holiday.id || i} className={`flex items-center py-3.5 ${isLast ? '' : 'border-b border-gray-100'}`}>
                        <div className="w-[55px] shrink-0 text-[13px] font-black text-blue-600">
                          {d.getDate()} {d.toLocaleString('default', { month: 'short' })}
                        </div>
                        <div className="flex-1 text-[13.5px] font-semibold text-gray-800 truncate pr-2">
                          {holiday.title || holiday.name}
                        </div>
                        <div className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md ${
                          holiday.type === 'National' ? 'bg-blue-50 text-blue-600' :
                          holiday.type === 'Festival' ? 'bg-orange-50 text-orange-500' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {holiday.type || 'Optional'}
                        </div>
                      </div>
                    );
                  })}
                  {holidays.filter(h => new Date(h.date + "T00:00:00").getTime() >= new Date().setHours(0,0,0,0)).length === 0 && (
                    <div className="text-[12px] font-bold text-gray-400 text-center py-4">No upcoming holidays scheduled</div>
                  )}
                </div>
              </div>
            </motion.div>



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

        {/* Tab: DAILY SHEET */}
        {activeTab === "daily-sheet" && (
          <div className="min-h-screen bg-gray-50 pb-32">
            <DailySheetView />
          </div>
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



      {/* Floating Glass Bottom Navigation Bar */}
      <nav className={`fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[480px] bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] py-2 px-6 flex items-center justify-between z-50 transition-transform duration-500 ease-in-out ${(scrollDirection === "down" || activeTab === "chat") ? "translate-y-[200px]" : "translate-y-0"}`}>
        {/* Home */}
        <button
          onClick={() => { setActiveTab("home"); triggerHaptic('light'); }}
          className="flex flex-col items-center gap-1 transition-all group relative"
        >
          <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${activeTab === "home" ? "bg-indigo-100 text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className={`text-[9px] font-bold transition-all ${activeTab === "home" ? "text-indigo-600" : "text-gray-400"}`}>Home</span>
        </button>

        {/* Attendance */}
        <button
          onClick={() => { setActiveTab("attendance"); triggerHaptic('light'); }}
          className="flex flex-col items-center gap-1 transition-all group relative"
        >
          <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${activeTab === "attendance" ? "bg-indigo-100 text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <span className={`text-[9px] font-bold transition-all ${activeTab === "attendance" ? "text-indigo-600" : "text-gray-400"}`}>Attendance</span>
        </button>

        {/* Standup */}
        <button
          onClick={() => { setActiveTab("standup"); triggerHaptic('light'); }}
          className="flex flex-col items-center gap-1 transition-all group relative"
        >
          <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${activeTab === "standup" ? "bg-indigo-100 text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`}>
            <Mic className="w-5 h-5" />
          </div>
          <span className={`text-[9px] font-bold transition-all ${activeTab === "standup" ? "text-indigo-600" : "text-gray-400"}`}>Standup</span>
        </button>

        {/* AI Chat */}
        <button
          onClick={() => { setActiveTab("assistant"); triggerHaptic('light'); }}
          className="flex flex-col items-center gap-1 transition-all group relative"
        >
          <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${activeTab === "assistant" ? "bg-indigo-100 text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <span className={`text-[9px] font-bold transition-all ${activeTab === "assistant" ? "text-indigo-600" : "text-gray-400"}`}>AI Chat</span>
        </button>

        {/* Logout */}
        <button
          onClick={() => { setShowLogoutConfirm(true); triggerHaptic('light'); }}
          className="flex flex-col items-center gap-1 transition-all group relative"
        >
          <div className="flex items-center justify-center w-12 h-8 rounded-full transition-all text-gray-400 group-hover:text-rose-500 group-hover:bg-rose-50">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold text-gray-400 group-hover:text-rose-500">Logout</span>
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
                <p className="text-sm font-medium text-gray-500">You will be returned to the login screen. Your data is safe and synced.</p>
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

      {/* ── IN-APP NOTIFICATIONS BOTTOM SHEET ── */}
      <BottomSheetNotification
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

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
