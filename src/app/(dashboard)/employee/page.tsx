"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Image from "next/image";
import NavbarBreakStatus from "@/components/NavbarBreakStatus";
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  where, updateDoc, doc, setDoc, writeBatch, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { auth, db, storage } from "@/lib/firebase";
import { checkIn, checkOut, getTodayAttendance } from "@/lib/attendance";
import { saveDailyUpdate } from "@/lib/dailyUpdates";
import { triggerEmailNotification, triggerWhatsAppNotification } from "@/lib/notifications";
import EmployeeAttendanceView from "./views/EmployeeAttendanceView";

import CallHistory from "@/components/CallHistory";
import MeetPanel from "@/components/MeetPanel";
import IncomingCallListener from "@/components/IncomingCallListener";
import MeetView from "@/components/MeetView";
import ApplyLeaveForm from "@/components/leave/ApplyLeaveForm";
import { createPortal } from "react-dom";

import BreakPanel from "@/components/BreakPanel";
import {
  getActiveBreak,
  getTodayDateStr,
  type Break,
} from "@/lib/breakTracking";

import DashboardView from "./views/DashboardView";
import WorkUpdateView from "./views/WorkUpdateView";
import DailySheetView from "./views/DailySheetView";
import AttendanceView from "./views/AttendanceView";
import UnifiedNotificationsView from "./views/NotificationsView";
import CalendarModal from "./views/CalendarView";
import HolidaysView from "./views/HolidaysView";
import LeaveHistoryView from "./views/LeaveHistoryView";
import LeaveRequestView from "./views/LeaveRequestView";
import ProfileView from "./views/ProfileView";
import HelpView from "./views/HelpView";
import ProjectManagement from "./views/projectmanagement";
import { LeaveType } from "@/types/leave";
import Payslips from "./views/Payslips";
import EmployeeTasksView from "./views/EmployeeTasksView";
import TeamTasksView from "./views/TeamTasksView";

// ── IMPORT MeetChat overlay ──────────────────────────────
// Change this path to wherever your MeetChatAppUpdated file lives
import MeetChatAppUpdated from "@/components/MeetChatAppUpdated";
import {
  LayoutGrid,
  Users,
  FileCheck,
  ClipboardList,
  Calendar,
  Clock,
  Folder,
  Receipt,
  Palmtree,
  User,
  HelpCircle,
  Settings,
  LogOut
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────
type ViewType =
  | "dashboard" | "work-update" | "daily-sheet" | "attendance" | "notifications"
  | "calendar" | "holidays" | "leave-history" | "leave-request"
  | "profile" | "help" | "projects" | "meet"
  | "tasks" | "team" | "reports" | "settings" | "payslips";

type LeaveRequest = {
  id: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: any;
  notificationRead?: boolean;
};

type ChatNotif = {
  id: string;
  fromUid: string;
  fromName: string;
  message: string;
  chatId: string;
  timestamp: any;
  read: boolean;
};

// ── Helpers ───────────────────────────────────────────────
const formatTime = (ts: any) =>
  ts ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

const formatTotal = (min = 0) => {
  if (min < 0) min = 0;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

// ── Data ──────────────────────────────────────────────────
const holidays = [
  { date: "2026-01-01", title: "New Year" },
  { date: "2026-01-13", title: "Bhogi" },
  { date: "2026-01-14", title: "Pongal" },
  { date: "2026-03-04", title: "Holi" },
  { date: "2026-03-19", title: "Ugadi" },
  { date: "2026-06-26", title: "Muharram" },
  { date: "2026-08-28", title: "Raksha Bandan" },
  { date: "2026-09-04", title: "Janmastami" },
  { date: "2026-09-14", title: "Ganesh Chaturthi" },
  { date: "2026-10-02", title: "Gandhi Jayanthi" },
  { date: "2026-10-20", title: "Dussehra" },
  { date: "2026-11-09", title: "Diwali" },
  { date: "2026-12-25", title: "Christmas" },
];

const isSunday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;
const isSecondSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 8 && d <= 14;
const isFourthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 22 && d <= 28;
const isFifthSaturday = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 6 && d >= 29;
const isHoliday = (dateStr: string): { title: string } | null => {
  const holiday = holidays.find(h => h.date === dateStr);
  return holiday ? { title: holiday.title } : null;
};

const getSidebarItems = (isLead: boolean): [ViewType, string, React.ReactNode][] => [
  ["dashboard", "Dashboard", <LayoutGrid key="dashboard" className="w-5 h-5" />],
  ...(isLead ? [["team", "Team Tasks", <Users key="team" className="w-5 h-5" />] as [ViewType, string, React.ReactNode]] : []),
  ["tasks", "My Tasks", <FileCheck key="tasks" className="w-5 h-5" />],
  ["daily-sheet", "Time Sheet", <Calendar key="daily-sheet" className="w-5 h-5" />],
  ["attendance", "Attendance", <Clock key="attendance" className="w-5 h-5" />],
  ["projects", "Projects", <Folder key="projects" className="w-5 h-5" />],
  ["payslips", "Payslips", <Receipt key="payslips" className="w-5 h-5" />],
  ["leave-request", "Apply Leave", <Palmtree key="leave-request" className="w-5 h-5" />],
  ["profile", "Profile", <User key="profile" className="w-5 h-5" />],
  ["help", "Help", <HelpCircle key="help" className="w-5 h-5" />],
];

// ── Notification Dropdown ─────────────────────────────────

// ── Main Dashboard ────────────────────────────────────────
export default function ZohoStyleEmployeeDashboard() {
  const { user, loading, userData } = useAuth();
  const router = useRouter();

  // ── ✅ NEW: MeetChat overlay state ──────────────────────
  const [showMeetChat, setShowMeetChat] = useState(false);
  const [chatTargetUid, setChatTargetUid] = useState<string | null>(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [users, setUsers] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<ViewType>("dashboard");

  // activeView effects moved down below state declarations

  const [attendance, setAttendance] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: string; text: string }[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [querySubject, setQuerySubject] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [querySubmitting, setQuerySubmitting] = useState(false);
  const [queryMsg, setQueryMsg] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showAttendanceSummary, setShowAttendanceSummary] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarScrollDirection, setSidebarScrollDirection] = useState<"up" | "down">("up");
  const [lastMainScrollY, setLastMainScrollY] = useState(0);
  const [queryNotifications, setQueryNotifications] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<ChatNotif[]>([]);
  const [todayBreaks, setTodayBreaks] = useState<Break[]>([]);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const mobileNotifDropdownRef = useRef<HTMLDivElement>(null);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  useEffect(() => {
    const saved = localStorage.getItem("activeView") as ViewType | null;
    const validViews: ViewType[] = [
      "dashboard", "work-update", "attendance", "notifications",
      "calendar", "holidays", "leave-history", "leave-request",
      "profile", "help", "projects", "meet", "tasks", "team",
      "reports", "settings", "payslips"
    ];
    if (saved && validViews.includes(saved)) {
      setActiveView(saved);
    }
  }, []);

  const changeView = (view: ViewType) => {
    setActiveView(view);
    localStorage.setItem("activeView", view);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Classic fix: if the element was removed from the DOM during the click (common in React),
      // document.body.contains(e.target) will be false. We should NOT close the dropdown in this case.
      if (e.target && !document.body.contains(e.target as Node)) return;

      const insideDesktop = notifDropdownRef.current && notifDropdownRef.current.contains(e.target as Node);
      const insideMobile = mobileNotifDropdownRef.current && mobileNotifDropdownRef.current.contains(e.target as Node);

      if (!insideDesktop && !insideMobile)
        setShowNotifDropdown(false);
    };
    // Use capture phase (true) to ensure this runs before React event handlers might remove the target element
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "notifications"), where("toUid", "==", user.uid)),
      snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(n => n.deletedByEmployee !== true) // Filter out deleted
          .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setChatNotifications(docs.slice(0, 50));
      }
    );
  }, [user]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")),
      snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    const dateStr = getTodayDateStr();
    const unsub = onSnapshot(doc(db, "attendance", `${user.uid}_${dateStr}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAttendance(data);
        if (data?.profilePhoto) setProfilePhoto(data.profilePhoto);
      } else {
        setAttendance(null);
      }
    });
    return () => unsub();
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const dateStr = getTodayDateStr();
    const attRef = doc(db, "attendance", `${user.uid}_${dateStr}`);
    return onSnapshot(attRef, (snap) => {
      if (snap.exists()) setTodayBreaks(snap.data().breaks || []);
      else setTodayBreaks([]);
    });
  }, [user]);

  const activeBreak = getActiveBreak(todayBreaks);

  useEffect(() => {
    if (!attendance?.sessions?.length) return;
    const calc = () => {
      let s = 0;
      attendance.sessions.forEach((sess: any) => {
        if (!sess.checkIn) return;
        const checkInDate = sess.checkIn.toDate();
        const shiftStart = new Date(checkInDate); shiftStart.setHours(10, 0, 0, 0);
        const shiftEnd = new Date(checkInDate); shiftEnd.setHours(19, 0, 0, 0);

        let ci = Math.max(checkInDate.getTime(), shiftStart.getTime());
        const now = new Date();

        let co = sess.checkOut ? sess.checkOut.toDate().getTime() : Math.min(now.getTime(), shiftEnd.getTime());
        if (activeBreak?.startTime && !sess.checkOut) co = Math.min(activeBreak.startTime.toDate().getTime(), shiftEnd.getTime());

        co = Math.min(co, shiftEnd.getTime());

        if (co > ci) {
          let sessionSeconds = Math.floor((co - ci) / 1000);
          const totalBreakSeconds = todayBreaks.reduce((acc: number, b: Break) => {
            if (!b.startTime) return acc;
            const start = b.startTime.toDate().getTime();
            const end = b.endTime ? b.endTime.toDate().getTime() : activeBreak?.startTime ? activeBreak.startTime.toDate().getTime() : start;
            return acc + Math.max(0, Math.floor((end - start) / 1000));
          }, 0);
          sessionSeconds -= totalBreakSeconds;
          s += Math.max(0, sessionSeconds);
        }
      });
      setTotalSeconds(s);
    };
    calc();
    const last = attendance.sessions.at(-1);
    if (last && !last.checkOut) {
      const iv = setInterval(calc, 1000);
      return () => clearInterval(iv);
    }
  }, [attendance, todayBreaks, activeBreak]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc")),
      snap => {
        const docs = snap.docs.map(d => ({
          id: d.id,
          text: (d.data() as any).text || "",
          createdAt: (d.data() as any).createdAt
        }));
        setAnnouncements(docs);
        setMessages(docs.map(d => d.text));
      });

  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tgy_dismissed_announcements");
      if (raw) setDismissedAnnouncements(new Set(JSON.parse(raw)));
    } catch { }
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, "users"))).then(snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) })));
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists() && snap.data().profilePhoto) setProfilePhoto(snap.data().profilePhoto);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "leaveRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc")),
      snap => setLeaveRequests(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(l => l.deletedByEmployee !== true)
      ));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, "employeeQueries"),
        where("employeeId", "==", user.uid),
        orderBy("createdAt", "desc")
      ),
      snap => setQueryNotifications(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(q => q.deletedByEmployee !== true)
      ));
  }, [user]);

  if (loading || !user) return null;

  const sessions = attendance?.sessions || [];
  const lastSession = sessions.at(-1);
  const isCheckedIn = lastSession && !lastSession.checkOut;

  const unreadLeave = leaveRequests.filter(l => (l.status === "Approved" || l.status === "Rejected") && !l.notificationRead);
  const readLeave = leaveRequests.filter(l => (l.status === "Approved" || l.status === "Rejected") && l.notificationRead);

  const unreadQuery = queryNotifications.filter(q => q.employeeUnread === true);
  const readQuery = queryNotifications.filter(q => q.employeeUnread === false);

  const unreadChat = chatNotifications.filter(c => !c.read);
  const readChat = chatNotifications.filter(c => c.read);

  const unreadAnnouncements = announcements.filter(a => !dismissedAnnouncements.has(a.id));
  const readAnnouncements = announcements.filter(a => dismissedAnnouncements.has(a.id));

  const totalNotifications = unreadLeave.length + unreadQuery.length + unreadChat.length + unreadAnnouncements.length;

  const getMonthlyAttendanceSummary = () => {
    if (!attendance?.history) return { present: 0, absent: 0, total: 0, percentage: 0 };
    const cm = attendance.history.filter((d: any) => { const rd = new Date(d.date); return rd.getMonth() === month && rd.getFullYear() === year; });
    const present = cm.filter((d: any) => d.status === "present").length;
    const absent = cm.filter((d: any) => d.status === "absent").length;
    const total = cm.length;
    return { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
  };
  const monthlyStats = getMonthlyAttendanceSummary();

  const handleSaveUpdate = async () => {
    if (!task && !notes) { setMsg("Please add task or notes"); return; }
    try {
      setSaving(true); setMsg("");
      await saveDailyUpdate(user.uid, task, notes);
      setMsg("✅ Update saved"); setTask(""); setNotes("");
    } catch { setMsg("❌ Failed to save"); }
    finally { setSaving(false); }
  };

  const handleSubmitLeave = async () => {
    if (!fromDate || !toDate || !leaveReason.trim()) { setLeaveMsg("Please fill all fields"); return; }
    if (new Date(fromDate) > new Date(toDate)) { setLeaveMsg("End date must be after start date"); return; }
    try {
      setSubmitting(true); setLeaveMsg("");
      await addDoc(collection(db, "leaveRequests"), {
        uid: user.uid, userName: user.email?.split("@")[0] || "Unknown",
        userEmail: user.email || "", userPhoto: profilePhoto || "",
        leaveType, fromDate, toDate, reason: leaveReason.trim(),
        status: "Pending", notificationRead: false, createdAt: serverTimestamp(),
      });

      try {
        const adminsSnapshot = await getDocs(query(collection(db, "users"), where("accountType", "==", "ADMIN")));
        const adminsData = adminsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        for (const admin of adminsData) {
          if (admin.email) {
            triggerEmailNotification(
              admin.id,
              `New Leave Request: ${user.email?.split("@")[0] || "Employee"}`,
              `A new leave request has been submitted by ${user.email}:\n\nType: ${leaveType}\nFrom: ${fromDate}\nTo: ${toDate}\nReason: ${leaveReason.trim()}\n\nPlease review it in the Admin Dashboard.`
            );
          }
          triggerWhatsAppNotification(admin.id, `*New Leave Request: ${user.email?.split("@")[0] || "Employee"}*\n\nType: ${leaveType}\nFrom: ${fromDate}\nTo: ${toDate}\nReason: ${leaveReason.trim()}\n\nPlease review it in the Admin Dashboard.`);
        }
      } catch (err) {
        console.error("Failed to send admin email/whatsapp", err);
      }

      setLeaveMsg("✅ Request submitted");
      setFromDate(""); setToDate(""); setLeaveReason(""); setLeaveType("casual");
      setTimeout(() => setLeaveMsg(""), 2000);
    } catch (error: any) { setLeaveMsg(`❌ ${error.message}`); }
    finally { setSubmitting(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File size must be less than 5MB"); return; }
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    try {
      setUploading(true);
      const snap = await uploadBytes(ref(storage, `profilePhotos/${user.uid}/${Date.now()}_${file.name}`), file);
      const url = await getDownloadURL(snap.ref);
      await setDoc(doc(db, "users", user.uid), { profilePhoto: url }, { merge: true });
      setProfilePhoto(url); alert("Profile photo updated successfully!");
    } catch (error) { console.error("Upload failed:", error); alert("Failed to upload photo. Please try again."); }
    finally { setUploading(false); }
  };

  const handleSubmitQuery = async () => {
    if (!querySubject.trim() || !queryMessage.trim()) { setQueryMsg("Please fill all fields"); return; }
    try {
      setQuerySubmitting(true); setQueryMsg("");
      await addDoc(collection(db, "employeeQueries"), {
        employeeId: user.uid, employeeName: user.email?.split("@")[0] || "Unknown",
        employeeEmail: user.email || "", subject: querySubject, message: queryMessage,
        status: "pending", adminReply: "", employeeUnread: false, adminUnread: true, createdAt: serverTimestamp(),
      });
      setQueryMsg("✅ Query submitted successfully"); setQuerySubject(""); setQueryMessage("");

      // Notify admins
      try {
        const adminsSnapshot = await getDocs(query(collection(db, "users"), where("accountType", "==", "ADMIN")));
        const adminsData = adminsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        for (const admin of adminsData) {
          if (admin.email) {
            triggerEmailNotification(
              admin.id,
              `New HR Request: ${querySubject}`,
              `An employee (${user.email}) has submitted a new query:\n\nTopic: ${querySubject}\nMessage:\n${queryMessage}\n\nPlease review and reply from the Admin Dashboard.`
            );
          }
        }
      } catch (err) { console.error("Failed to notify admins of query", err); }

    } catch (error) { setQueryMsg("❌ Failed to submit query"); console.error(error); }
    finally { setQuerySubmitting(false); }
  };

  const markNotificationAsRead = async (id: string) => { try { await updateDoc(doc(db, "leaveRequests", id), { notificationRead: true }); } catch (e) { console.error(e); } };
  const markQueryNotificationAsRead = async (id: string) => { try { await updateDoc(doc(db, "employeeQueries", id), { employeeUnread: false }); } catch (e) { console.error(e); } };
  const markChatNotificationAsRead = async (id: string) => { try { await updateDoc(doc(db, "notifications", id), { read: true }); } catch (e) { console.error(e); } };

  const markAnnouncementRead = (id: string) => {
    const newSet = new Set(dismissedAnnouncements);
    newSet.add(id);
    setDismissedAnnouncements(newSet);
    localStorage.setItem("tgy_dismissed_announcements", JSON.stringify(Array.from(newSet)));
  };

  const markAllNotificationsRead = async () => {
    const batch = writeBatch(db);
    unreadLeave.forEach(l => batch.update(doc(db, "leaveRequests", l.id), { notificationRead: true }));
    unreadQuery.forEach(q => batch.update(doc(db, "employeeQueries", q.id), { employeeUnread: false }));
    unreadChat.forEach(c => batch.update(doc(db, "notifications", c.id), { read: true }));

    const newSet = new Set(dismissedAnnouncements);
    unreadAnnouncements.forEach(a => newSet.add(a.id));
    setDismissedAnnouncements(newSet);
    localStorage.setItem("tgy_dismissed_announcements", JSON.stringify(Array.from(newSet)));

    await batch.commit();
  };

  const handleDeleteNotification = (id: string, type: string) => {
    if (type === "announcement") {
      const newSet = new Set(dismissedAnnouncements);
      newSet.add(id);
      setDismissedAnnouncements(newSet);
      localStorage.setItem("tgy_dismissed_announcements", JSON.stringify(Array.from(newSet)));
    }
  };

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const doCheckIn = async () => { setBusy(true); await checkIn(user.uid); setBusy(false); };
  const doCheckOut = async () => { setBusy(true); await checkOut(user.uid); setBusy(false); };
  const handleSetLeaveType = (v: LeaveType) => setLeaveType(v);

  const todayMD = new Date().toISOString().slice(5, 10);
  const todayBirthdayCount = users.filter(u => {
    const bday = u.dateOfBirth || u.birthDate;
    return bday && bday.slice(5, 10) === todayMD;
  }).length;

  // ── ✅ NEW: open MeetChat overlay (called from dashboard card + navbar button)
  const openMeetChat = () => { setChatTargetUid(null); setShowMeetChat(true); };
  const closeMeetChat = () => { setShowMeetChat(false); setChatTargetUid(null); };

  const openChatWith = (uid: string) => {
    setChatTargetUid(uid);
    setShowMeetChat(true);
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-[#282B3E] text-white flex flex-col transform transition-all duration-300 ${sidebarCollapsed ? "lg:w-16 w-52 lg:opacity-100 lg:translate-x-0" : "w-52 lg:opacity-100 lg:translate-x-0"} ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`h-[88px] px-4 flex items-center justify-between border-b border-white/10 ${sidebarCollapsed && !mobileMenuOpen ? "w-16 justify-center px-0" : "w-52"}`}>
          {(!sidebarCollapsed || mobileMenuOpen) && (
            <div className="flex items-center gap-2 ml-2">
              <Image src="/logo.svg" alt="TGY CRM Logo" width={90} height={40} className="object-contain invert brightness-0" />
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:block p-2 hover:bg-white/10 rounded-lg transition text-white">
            <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-white">×</button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {getSidebarItems(userData?.accountType === "LEAD" || userData?.role === "lead").map(([id, label, icon]) => (
            <button key={id} onClick={() => { changeView(id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center ${sidebarCollapsed && !mobileMenuOpen ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-3"} rounded-xl transition-all duration-150 relative group ${activeView === id ? "bg-white text-[#282B3E] font-bold" : "text-[#A0B2C6] hover:bg-white/10 hover:text-white font-medium"
                }`}
              title={(sidebarCollapsed && !mobileMenuOpen) ? label : undefined}
            >
              <span className={`${sidebarCollapsed && !mobileMenuOpen ? "text-xl drop-shadow-sm" : "text-[18px]"} shrink-0 transition-transform duration-150 ${activeView === id ? (sidebarCollapsed && !mobileMenuOpen ? "scale-110" : "scale-110") : (sidebarCollapsed && !mobileMenuOpen ? "group-hover:scale-110" : "group-hover:scale-105")}`}>{icon}</span>
              {(!sidebarCollapsed || mobileMenuOpen) && <span className="text-[14px] truncate tracking-wide">{label}</span>}
              {id === "notifications" && totalNotifications > 0 && (
                (sidebarCollapsed && !mobileMenuOpen)
                  ? <span className="absolute top-2 right-4 w-2 h-2 bg-rose-500 rounded-full shadow-sm animate-pulse" />
                  : <span className="ml-auto bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0">{totalNotifications}</span>
              )}
              {(sidebarCollapsed && !mobileMenuOpen) && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">{label}</div>
              )}
            </button>
          ))}
        </nav>
        {(!sidebarCollapsed || mobileMenuOpen) ? (
          <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="mx-4 mb-6 flex items-center justify-center gap-3 px-4 py-3.5 bg-[#31344A] rounded-xl hover:bg-[#3E425C] transition text-[15px] font-semibold text-white">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Logout</span>
          </button>
        ) : (
          <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="mx-2 mb-6 p-3.5 bg-[#31344A] rounded-xl hover:bg-[#3E425C] transition flex items-center justify-center text-white" title="Logout">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        )}
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <header className="min-h-[64px] h-auto lg:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-2 lg:px-8 shrink-0 sticky top-0 z-40">
          <div className="hidden lg:flex items-center justify-between w-full h-full">
            <div className="flex items-center min-w-0 shrink-0">
              <h1 className="text-lg font-bold capitalize flex items-center gap-2 whitespace-nowrap text-gray-900">
                {getSidebarItems(!!userData?.isLead).find(([key]) => key === activeView)?.[2] ?? <LayoutGrid className="w-5 h-5" />}{" "}
                <span>{getSidebarItems(!!userData?.isLead).find(([key]) => key === activeView)?.[1] ?? activeView.replace(/-/g, " ")}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 flex items-center gap-2 bg-[#F0F2F8] rounded-lg px-3 border border-[#E2E6F0] shadow-sm transition-all">
                <div className="font-mono font-bold text-xs text-[#282B3E] flex items-center gap-1.5">
                  <span className="opacity-70 text-sm">⏱</span><span className="tabular-nums">{formatTimer(totalSeconds)}</span>
                </div>
              </div>
              <NavbarBreakStatus uid={user.uid} isCheckedIn={!!isCheckedIn} />
              {isCheckedIn ? (
                <button disabled={busy} onClick={doCheckOut} className="h-8 px-4 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-xs hover:scale-[1.02] active:scale-95 shadow-sm">Check Out</button>
              ) : (
                <button disabled={busy} onClick={doCheckIn} className="h-8 px-4 bg-[#282B3E] text-white border border-[#282B3E] rounded-lg hover:bg-[#3E425C] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-xs hover:scale-[1.02] active:scale-95 shadow-sm">Check In</button>
              )}
              <button onClick={() => setShowCalendar(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-all group relative" title="Calendar">
                <img src="https://cdn-icons-png.flaticon.com/128/668/668278.png" alt="Calendar" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                {todayBirthdayCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm animate-bounce">
                    {todayBirthdayCount}
                  </span>
                )}
              </button>

              {/* Notification bell */}
              <div className="relative" ref={notifDropdownRef}>
                <button onClick={() => setShowNotifDropdown(prev => !prev)} className="relative p-2 hover:bg-gray-100 rounded-lg transition-all group" title="Notifications">
                  <img src="https://cdn-icons-png.flaticon.com/128/7184/7184217.png" alt="Notifications" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-lg animate-pulse">{totalNotifications}</span>
                  )}
                </button>
                {showNotifDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style={{ maxHeight: "80vh" }}>
                    <UnifiedNotificationsView
                      hideHeader={false}
                      leaveNotifications={leaveRequests.filter(l => (l.status === "Approved" || l.status === "Rejected"))}
                      markNotificationAsRead={markNotificationAsRead}
                      queryNotifications={queryNotifications}
                      markQueryNotificationAsRead={markQueryNotificationAsRead}
                      chatNotifications={chatNotifications}
                      markChatNotificationAsRead={markChatNotificationAsRead}
                      announcements={announcements}
                      dismissedAnnouncements={dismissedAnnouncements}
                      markAnnouncementRead={markAnnouncementRead}
                      markAllNotificationsRead={markAllNotificationsRead}
                      onDeleteNotification={handleDeleteNotification}
                      onClose={() => setShowNotifDropdown(false)}
                      onGoToChat={(_chatId) => { openMeetChat(); setShowNotifDropdown(false); }}
                    />
                  </div>
                )}
              </div>

              {/* ✅ MeetChat button — opens overlay instead of window.open */}
              <button
                onClick={openMeetChat}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all group"
                title="Open MeetChat"
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/128/18114/18114578.png"
                  alt="MeetChat"
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                />
              </button>

              {/* User menu */}
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-1.5 p-1.5 hover:bg-gray-100 rounded-lg transition-all">
                  <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg">
                    {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full bg-linear-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">{user.email?.[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showUserMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-1 w-60 bg-white rounded-xl shadow-2xl border border-gray-200 z-100 overflow-hidden">
                      <div className="p-3 border-b bg-linear-to-br from-gray-50 to-white">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg">
                            {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full bg-linear-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">{user.email?.[0]?.toUpperCase()}</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate text-sm">{user.email?.split("@")[0]}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { changeView("profile"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 group text-sm"><User className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="font-medium">Profile</span></button>
                        <button onClick={() => { changeView("settings"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 group text-sm"><Settings className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="font-medium">Settings</span></button>
                        <hr className="my-1 border-gray-200" />
                        <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full text-left px-3 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-2.5 group text-sm"><LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="font-medium">Logout</span></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>



          {/* Mobile header */}
          <div className="lg:hidden w-full py-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all" aria-label="Open menu">
                  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h1 className="text-sm font-bold capitalize flex items-center gap-2 truncate max-w-36 text-gray-900">
                  {getSidebarItems(!!userData?.isLead).find(([key]) => key === activeView)?.[2] ?? <LayoutGrid className="w-5 h-5" />}
                  <span>{getSidebarItems(!!userData?.isLead).find(([key]) => key === activeView)?.[1] ?? activeView.replace(/-/g, " ")}</span>
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative" ref={mobileNotifDropdownRef}>
                  <NavbarBreakStatus uid={user.uid} isCheckedIn={!!isCheckedIn} />
                  <button onClick={() => setShowNotifDropdown(prev => !prev)} className="relative p-1.5 hover:bg-gray-100 rounded-lg transition-all" aria-label="Notifications">
                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {totalNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[1.1rem] text-center animate-pulse">{totalNotifications}</span>
                    )}
                  </button>
                  {showNotifDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style={{ maxHeight: "80vh" }}>
                      <UnifiedNotificationsView
                        hideHeader={false}
                        leaveNotifications={leaveRequests.filter(l => (l.status === "Approved" || l.status === "Rejected"))}
                        markNotificationAsRead={markNotificationAsRead}
                        queryNotifications={queryNotifications}
                        markQueryNotificationAsRead={markQueryNotificationAsRead}
                        chatNotifications={chatNotifications}
                        markChatNotificationAsRead={markChatNotificationAsRead}
                        announcements={announcements}
                        dismissedAnnouncements={dismissedAnnouncements}
                        markAnnouncementRead={markAnnouncementRead}
                        markAllNotificationsRead={markAllNotificationsRead}
                        onDeleteNotification={handleDeleteNotification}
                        onClose={() => setShowNotifDropdown(false)}
                        onGoToChat={(_chatId) => { openMeetChat(); setShowNotifDropdown(false); }}
                      />
                    </div>
                  )}
                </div>
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-1 hover:bg-gray-100 rounded-lg transition-all" aria-label="User menu">
                  <div className="w-7 h-7 rounded-full overflow-hidden shadow-md">
                    {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full bg-linear-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-xs">{user.email?.[0]?.toUpperCase()}</div>
                    )}
                  </div>
                </button>
              </div>
            </div>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-3 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-2.5 border-b bg-linear-to-br from-gray-50 to-white">
                    <p className="font-semibold text-gray-900 truncate text-sm">{user.email?.split("@")[0]}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setActiveView("profile"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 text-sm"><User className="w-4 h-4" /><span>Profile</span></button>
                    <button onClick={() => { setActiveView("settings"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 text-sm"><Settings className="w-4 h-4" /><span>Settings</span></button>
                    <hr className="my-1 border-gray-200" />
                    <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-sm"><LogOut className="w-4 h-4" /><span>Logout</span></button>
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-8 flex items-center gap-2 bg-amber-50 rounded-lg px-3 border border-amber-200 flex-1 min-w-0">
                <span className="font-mono font-bold text-[11px] text-amber-700 whitespace-nowrap">⏱ {formatTimer(totalSeconds)}</span>
              </div>
              {isCheckedIn ? (
                <button disabled={busy} onClick={doCheckOut} className="h-8 px-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-[11px] whitespace-nowrap shadow-sm">Check Out</button>
              ) : (
                <button disabled={busy} onClick={doCheckIn} className="h-8 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-[11px] whitespace-nowrap shadow-sm">Check In</button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCalendar(true)} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all text-xs font-semibold text-gray-700 border border-gray-200 relative">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Calendar</span>
                {todayBirthdayCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm animate-bounce">
                    {todayBirthdayCount}
                  </span>
                )}
              </button>
              {/* ✅ Mobile MeetChat button — opens overlay */}
              <button
                onClick={openMeetChat}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#e8512a] hover:bg-[#d4431f] rounded-lg transition-all text-xs font-medium text-white"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chat</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile App Promo Banner */}
        <div className="lg:hidden p-3.5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 border-b border-indigo-900 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📱</span>
            <div>
              <h4 className="text-xs font-bold text-white">Office Tracker PWA</h4>
              <p className="text-[10px] text-indigo-200">Selfie & GPS check-in, AI standup, offline sync.</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/mobile")}
            className="py-1.5 px-3 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-extrabold rounded-lg text-[10px] transition-all shadow-sm shrink-0 active:scale-95"
          >
            Open App
          </button>
        </div>

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-0 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-3">
            {activeView === "dashboard" && (
              <DashboardView
                user={user}
                isCheckedIn={!!isCheckedIn}
                onlineMinutes={Math.floor(totalSeconds / 60)}
                attendance={attendance}
                sessions={sessions}
                formatTotal={formatTotal}
                formatTime={formatTime}
                handleSaveUpdate={handleSaveUpdate}
                saving={saving}
                msg={msg}
                leaveType={leaveType}
                setLeaveType={handleSetLeaveType}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                leaveReason={leaveReason}
                setLeaveReason={setLeaveReason}
                handleSubmitLeave={handleSubmitLeave}
                submitting={submitting}
                leaveMsg={leaveMsg}
                totalSeconds={totalSeconds}
                onGoToChat={(_chatId) => openMeetChat()}
                // ✅ NEW: wired to open the overlay
                onOpenMeetChat={openMeetChat}
                announcements={announcements}
              />
            )}
            {activeView === "attendance" && <EmployeeAttendanceView />}
            {activeView === "daily-sheet" && <DailySheetView />}
            {activeView === "work-update" && <WorkUpdateView />}
            {activeView === "projects" && <ProjectManagement user={{ ...user, ...userData }} projects={projects} users={users} setSidebarCollapsed={setSidebarCollapsed} />}
            {activeView === "notifications" && (
              <UnifiedNotificationsView
                chatNotifications={chatNotifications}
                markChatNotificationAsRead={markChatNotificationAsRead}
                leaveNotifications={leaveRequests}
                markNotificationAsRead={markNotificationAsRead}
                announcements={announcements.filter(a => !dismissedAnnouncements.has(a.id))}
                markAnnouncementRead={markAnnouncementRead}
                queryNotifications={queryNotifications}
                markQueryNotificationAsRead={markQueryNotificationAsRead}
                onDeleteNotification={handleDeleteNotification}
                onClose={() => changeView("dashboard")}
              />
            )}
            {activeView === "holidays" && <HolidaysView holidays={holidays} />}
            {activeView === "leave-history" && <LeaveHistoryView leaveRequests={leaveRequests} />}
            {activeView === "leave-request" && (
              <LeaveRequestView
                user={user}
                leaveType={leaveType} setLeaveType={handleSetLeaveType}
                fromDate={fromDate} setFromDate={setFromDate}
                toDate={toDate} setToDate={setToDate}
                leaveReason={leaveReason} setLeaveReason={setLeaveReason}
                handleSubmitLeave={handleSubmitLeave} submitting={submitting} leaveMsg={leaveMsg}
              />
            )}
            {activeView === "profile" && <ProfileView />}
            {activeView === "help" && <HelpView />}
            {activeView === "meet" && <MeetView users={users.filter((u: any) => u.uid !== user.uid)} />}
            {activeView === "tasks" && <EmployeeTasksView user={{ ...user, ...userData }} />}
            {activeView === "team" && <TeamTasksView user={{ ...user, ...userData }} />}
            {activeView === "reports" && <ReportsView user={user} attendance={attendance} />}
            {activeView === "settings" && <SettingsView user={user} />}
            {activeView === "payslips" && <Payslips />}
          </div>
        </main>
      </div>

      {/* ── CALENDAR MODAL ── */}
      <CalendarModal
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        calendarDate={calendarDate}
        setCalendarDate={setCalendarDate}
        holidays={holidays}
        isSunday={isSunday}
        isSecondSaturday={isSecondSaturday}
        isFourthSaturday={isFourthSaturday}
        isFifthSaturday={isFifthSaturday}
        isHoliday={isHoliday}
        onWishEmployee={openChatWith}
      />

      {showAttendanceSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAttendanceSummary(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">📊 Monthly Summary</h3>
              <button onClick={() => setShowAttendanceSummary(false)} className="text-gray-700 hover:text-gray-900">×</button>
            </div>
            <p className="text-slate-600 mb-4 text-sm">{calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            <div className="space-y-3">
              {[
                { label: "Present Days", value: monthlyStats.present, bg: "bg-green-50", border: "border-green-200", clr: "text-green-700", iconBg: "bg-green-500", icon: "✓" },
                { label: "Absent Days", value: monthlyStats.absent, bg: "bg-red-50", border: "border-red-200", clr: "text-red-700", iconBg: "bg-red-500", icon: "×" },
                { label: "Attendance %", value: `${monthlyStats.percentage}%`, bg: "bg-indigo-50", border: "border-indigo-200", clr: "text-indigo-700", iconBg: "bg-indigo-500", icon: "📈" },
              ].map(s => (
                <div key={s.label} className={`flex justify-between items-center p-3.5 ${s.bg} rounded-xl border-2 ${s.border}`}>
                  <div>
                    <p className={`text-sm font-medium ${s.clr}`}>{s.label}</p>
                    <p className={`text-2xl font-bold ${s.clr}`}>{s.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${s.iconBg} rounded-full flex items-center justify-center text-2xl text-white`}>{s.icon}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ MeetChat OVERLAY — rendered at root level so it covers everything */}
      <MeetChatAppUpdated
        users={users}
        isOpen={showMeetChat}
        onClose={closeMeetChat}
        targetUid={chatTargetUid}
      />

      <style jsx>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 3s infinite; }
      `}</style>

      <IncomingCallListener />
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────

function ReportsView({ user, attendance }: any) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h2 className="text-xl font-bold mb-3">Performance Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Hours", value: "156h", from: "from-blue-500", to: "to-blue-600" },
            { label: "Tasks Completed", value: "42", from: "from-green-500", to: "to-green-600" },
            { label: "Attendance", value: "95%", from: "from-purple-500", to: "to-purple-600" },
          ].map(s => (
            <div key={s.label} className={`p-5 bg-linear-to-br ${s.from} ${s.to} rounded-xl text-white`}>
              <h3 className="text-xs font-medium mb-1">{s.label}</h3>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs mt-1">This Month</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ user }: any) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h2 className="text-xl font-bold mb-3">Settings</h2>
        <div className="space-y-3">
          <div><label className="block font-semibold text-sm mb-1.5">Email Notifications</label><input type="checkbox" className="w-4 h-4" defaultChecked /></div>
          <div>
            <label className="block font-semibold text-sm mb-1.5">Theme</label>
            <select className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm"><option>Light</option><option>Dark</option></select>
          </div>
          <button className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">Save Settings</button>
        </div>
      </div>
    </div>
  );
}