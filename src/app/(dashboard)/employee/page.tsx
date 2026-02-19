"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  where,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { auth, db, storage } from "@/lib/firebase";
import { checkIn, checkOut, getTodayAttendance } from "@/lib/attendance";
import { saveDailyUpdate } from "@/lib/dailyUpdates";

// Import your existing components
import CallCenter from "../calls/CallCenter";
import CallHistory from "@/components/CallHistory";
import MeetPanel from "@/components/MeetPanel";
import IncomingCallListener from "@/components/IncomingCallListener";
import MeetView from "@/components/MeetView";

// Import views
import DashboardView from "./views/DashboardView";
import WorkUpdateView from "./views/WorkUpdateView";
import AttendanceView from "./views/AttendanceView";
import NotificationsView from "./views/NotificationsView";
import CalendarModal from "./views/CalendarView";
import HolidaysView from "./views/HolidaysView";
import LeaveHistoryView from "./views/LeaveHistoryView";
import LeaveRequestView from "./views/LeaveRequestView";
import ProfileView from "./views/ProfileView";
import HelpView from "./views/HelpView";
import ProjectManagement from "./views/projectmanagement";

type ViewType =
  | "dashboard"
  | "work-update"
  | "attendance"
  | "notifications"
  | "calendar"
  | "holidays"
  | "leave-history"
  | "leave-request"
  | "profile"
  | "help"
  | "projects"
  | "meet"
  | "tasks"
  | "team"
  | "reports"
  | "settings";

type LeaveRequest = {
  id: string;
  leaveType: "Casual" | "Sick" | "LOP";
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: any;
  notificationRead?: boolean;
};

const formatTime = (ts: any) =>
  ts
    ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";
const formatTotal = (min = 0) => `${Math.floor(min / 60)}h ${min % 60}m`;

// Holiday data
const holidays = [
  { date: "2026-01-01", title: "New Year" },
  { date: "2026-01-13", title: "Bhogi" },
  { date: "2026-01-14", title: "Pongal" },
  { date: "2026-03-04", title: "Holi" },
  { date: "2026-03-19", title: "Ugadi" },
  { date: "2026-08-15", title: "Independence Day" },
  { date: "2026-08-28", title: "Raksha Bandhan" },
  { date: "2026-09-14", title: "Ganesh Chaturthi" },
  { date: "2026-10-02", title: "Gandhi Jayanthi" },
  { date: "2026-10-20", title: "Dussehra" },
  { date: "2026-11-08", title: "Diwali" },
  { date: "2026-12-25", title: "Christmas" },
];

const isSunday = (year: number, month: number, day: number) => {
  return new Date(year, month, day).getDay() === 0;
};
const isSecondSaturday = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day);
  return date.getDay() === 6 && day >= 8 && day <= 14;
};
const isFourthSaturday = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day);
  return date.getDay() === 6 && day >= 22 && day <= 28;
};
const isFifthSaturday = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day);
  return date.getDay() === 6 && day >= 29;
};
const isHoliday = (dateStr: string) => {
  return holidays.find((h) => h.date === dateStr);
};

const sidebarGroups = [
  {
    title: "WORKSPACE",
    items: [
      ["dashboard", "Dashboard", "📊"],
      // ["tasks", "My Tasks", "✓"],
      ["team", "Team", "👥"],
    ],
  },
  {
    title: "WORK",
    items: [
      ["work-update", "Work Update", "📝"],
      ["attendance", "Attendance", "⏰"],
      ["projects", "Projects", "📁"],
      ["reports", "Reports", "📈"],
    ],
  },
   {
    title: "PROJECT MANAGEMENT",
    items: [
     ["projects", "Projects", "📁"],  
    ],
  },
  {
    title: "LEAVE & HOLYDAYS",
    items: [
      ["leave-request", "Apply Leave", "📋"],
      ["leave-history", "Leave History", "📜"],
      ["holidays", "Holidays", "🎉"],
      // ["calendar", "Calendar", "📅"],
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      ["notifications", "Notifications", "🔔"],
      ["meet", "Meet", "📹"],
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      ["profile", "Profile", "👤"],
      // ["settings", "Settings", "⚙️"],
      ["help", "Help", "❓"],
    ],
  },
];

// ENHANCED ANNOUNCEMENT BAR COMPONENT
function AnnouncementBar({ messages }: { messages: string[] }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showNotificationDot, setShowNotificationDot] = useState(false);

  useEffect(() => {
    if (messages.length > 0 && isCollapsed) {
      setShowNotificationDot(true);
    }
  }, [messages, isCollapsed]);

  useEffect(() => {
    if (!isCollapsed) {
      setShowNotificationDot(false);
    }
  }, [isCollapsed]);

  if (messages.length === 0) return null;

  return (
    <>
      {/* Full Announcement Bar */}
      <div
        className={`bg-gradient-to-r from-[#ae9c62] to-[#2d4a7c] text-white overflow-hidden shadow-lg transition-all duration-500 ease-in-out relative ${
          isCollapsed ? "h-0 opacity-0" : "h-10 opacity-100 -mt-3"
        }`}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
        </div>

        <div className="relative h-full flex items-center">
          {/* Left Controls */}
          <div className="flex items-center gap-2 px-4 z-10">
            <div className="relative">
              <span className="text-2xl animate-pulse">📣</span>
              {!isPaused && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                </span>
              )}
            </div>
          </div>

          {/* Scrolling Messages */}
          <div className="flex-1 overflow-hidden">
            {/* <div className="marquee"> */}
              <div className="marquee-track flex items-center">
               {messages.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 mx-6 whitespace-nowrap font-medium"
                  >
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    {m}
                  </div>
                ))}
              {/* </div> */}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 px-4 z-10">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-white/20 rounded-md transition-all duration-200 hover:rotate-180"
              title="Collapse"
            >
              <svg
                className="w-4 h-4 transition-transform duration-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsed Expand Button */}
      {isCollapsed && (
        <div className="relative">
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute top-[-1] left-[87%] z-50 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white px-4 py-0 rounded-b-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group"
            title="Expand announcements"
          >
            {showNotificationDot && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
              </span>
            )}
            <span>Announcement</span>
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

export default function ZohoStyleEmployeeDashboard() {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<ViewType>("dashboard");
  const [attendance, setAttendance] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<"Casual" | "Sick" | "LOP">("Casual");
  const [openGroup, setOpenGroup] = useState<string | null>("WORKSPACE");
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
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ✅ NEW: Query notifications state
  const [queryNotifications, setQueryNotifications] = useState<any[]>([]);

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  // Load projects
  useEffect(() => {
    const unsubProjects = onSnapshot(
      query(collection(db, "projects"), orderBy("createdAt", "desc")),
      (snap) => setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsubProjects();
  }, []);

  const loadAttendance = async () => {
    if (!user) return;
    const data = await getTodayAttendance(user.uid);
    setAttendance(data);
    if (data?.profilePhoto) setProfilePhoto(data.profilePhoto);
  };

  useEffect(() => {
    if (!loading && user) loadAttendance();
  }, [loading, user]);

  useEffect(() => {
    if (!attendance?.sessions?.length) return;

    const calculateTotalSeconds = () => {
      let seconds = 0;
      attendance.sessions.forEach((s: any) => {
        const checkIn = s.checkIn?.toDate()?.getTime();
        const checkOut = s.checkOut ? s.checkOut.toDate().getTime() : Date.now();
        if (checkIn) {
          seconds += Math.floor((checkOut - checkIn) / 1000);
        }
      });
      setTotalSeconds(seconds);
    };

    calculateTotalSeconds();
    const last = attendance.sessions.at(-1);
    if (last && !last.checkOut) {
      const interval = setInterval(calculateTotalSeconds, 1000);
      return () => clearInterval(interval);
    }
  }, [attendance]);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => d.data().text))
    );
  }, []);

  useEffect(() => {
  try {
    const raw = localStorage.getItem("tgy_dismissed_announcements");
    if (raw) setDismissedAnnouncements(new Set(JSON.parse(raw)));
  } catch {}
}, []);

  useEffect(() => {
    const q = query(collection(db, "users"));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })));
    });
  }, []);

  useEffect(() => {
  if (!user) return;

  const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.profilePhoto) {
        setProfilePhoto(data.profilePhoto);
      }
    }
  });

  return () => unsubscribe();
}, [user]);


  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "leaveRequests"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) =>
      setLeaveRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
  }, [user]);

  // ✅ NEW: Listen for query reply notifications (employeeUnread = true)
 useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "employeeQueries"),
    where("employeeId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const unreadQueries = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d: any) => d.employeeUnread === true);

    setQueryNotifications(unreadQueries);
  });
}, [user]);


  if (loading || !user) return null;

  const sessions = attendance?.sessions || [];
  const lastSession = sessions.at(-1);
  const isCheckedIn = lastSession && !lastSession.checkOut;

  const leaveNotifications = leaveRequests.filter(
  (l) => (l.status === "Approved" || l.status === "Rejected") && !l.notificationRead
);

const visibleAnnouncementCount = messages.filter((m) => !dismissedAnnouncements.has(m)).length;
const totalNotifications = leaveNotifications.length + queryNotifications.length + visibleAnnouncementCount;
  const getMonthlyAttendanceSummary = () => {
    if (!attendance?.history)
      return { present: 0, absent: 0, total: 0, percentage: 0 };

    const currentMonth = attendance.history.filter((d: any) => {
      const recordDate = new Date(d.date);
      return (
        recordDate.getMonth() === month && recordDate.getFullYear() === year
      );
    });

    const present = currentMonth.filter((d: any) => d.status === "present").length;
    const absent = currentMonth.filter((d: any) => d.status === "absent").length;
    const total = currentMonth.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, percentage };
  };

  const monthlyStats = getMonthlyAttendanceSummary();

  const handleSaveUpdate = async () => {
    if (!task && !notes) {
      setMsg("Please add task or notes");
      return;
    }
    try {
      setSaving(true);
      setMsg("");
      await saveDailyUpdate(user.uid, task, notes);
      setMsg("✅ Update saved");
      setTask("");
      setNotes("");
    } catch {
      setMsg("❌ Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitLeave = async () => {
    if (!fromDate || !toDate || !leaveReason.trim()) {
      setLeaveMsg("Please fill all fields");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setLeaveMsg("End date must be after start date");
      return;
    }

    try {
      setSubmitting(true);
      setLeaveMsg("");

      await addDoc(collection(db, "leaveRequests"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        userEmail: user.email || "",
        userPhoto: profilePhoto || "",
        leaveType,
        fromDate,
        toDate,
        reason: leaveReason,
        status: "Pending",
        notificationRead: false,
        createdAt: serverTimestamp(),
      });

      setLeaveMsg("✅ Request submitted");
      setFromDate("");
      setToDate("");
      setLeaveReason("");
      setLeaveType("Casual");
    } catch (error: any) {
      console.error("Leave submit error:", error);
      setLeaveMsg(`❌ ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    try {
      setUploading(true);
      const storageRef = ref(
        storage,
        `profilePhotos/${user.uid}/${Date.now()}_${file.name}`
      );
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { profilePhoto: url }, { merge: true });
      setProfilePhoto(url);
      alert("Profile photo updated successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ✅ FIXED: Now uses employeeQueries collection
  const handleSubmitQuery = async () => {
    if (!querySubject.trim() || !queryMessage.trim()) {
      setQueryMsg("Please fill all fields");
      return;
    }
    try {
      setQuerySubmitting(true);
      setQueryMsg("");
      await addDoc(collection(db, "employeeQueries"), {
        employeeId: user.uid,
        employeeName: user.email?.split("@")[0] || "Unknown",
        employeeEmail: user.email || "",
        subject: querySubject,
        message: queryMessage,
        status: "pending",
        adminReply: "",
        employeeUnread: false,
        adminUnread: true,
        createdAt: serverTimestamp(),
      });
      setQueryMsg("✅ Query submitted successfully");
      setQuerySubject("");
      setQueryMessage("");
    } catch (error) {
      setQueryMsg("❌ Failed to submit query");
      console.error(error);
    } finally {
      setQuerySubmitting(false);
    }
  };

  const markNotificationAsRead = async (leaveId: string) => {
    try {
      const leaveDocRef = doc(db, "leaveRequests", leaveId);
      await updateDoc(leaveDocRef, { notificationRead: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // ✅ NEW: Mark query notification as read
  const markQueryNotificationAsRead = async (queryId: string) => {
    try {
      await updateDoc(doc(db, "employeeQueries", queryId), {
        employeeUnread: false,
      });
    } catch (error) {
      console.error("Failed to mark query notification as read:", error);
    }
  };

  // ✅ NEW: Mark ALL query notifications as read (called when opening notifications view)
  // const markAllQueryNotificationsAsRead = async () => {
  //   queryNotifications.forEach(async (q) => {
  //     await updateDoc(doc(db, "employeeQueries", q.id), {
  //       employeeUnread: false,
  //     });
  //   });
  // };

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-[#1b445c] text-white flex flex-col transform transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo & Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">TGY CRM</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block p-2 hover:bg-white/10 rounded-lg transition"
          >
            <svg
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
          >
            ×
          </button>
        </div>

        {/* User Profile */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg">
  {profilePhoto ? (
    <img
      src={profilePhoto}
      alt="Profile"
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-white">
      {user.email?.[0]?.toUpperCase()}
    </div>
  )}
</div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.email?.split("@")[0]}</p>
                <p className="text-xs text-white/60">Employee</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          {sidebarCollapsed ? (
            // Collapsed view - icons only
            <>
              {sidebarGroups.flatMap((group) =>
                group.items.map(([id, label, icon]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveView(id as ViewType);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-center p-3 rounded-lg transition relative group ${
                      activeView === id ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    title={label}
                  >
                    <span className="text-xl">{icon}</span>
                    {/* ✅ UPDATED: Uses totalNotifications */}
                    {id === "notifications" && totalNotifications > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                      {label}
                    </div>
                  </button>
                ))
              )}
            </>
          ) : (
            // Expanded view
            <>
              {sidebarGroups.map((group) => (
                <div key={group.title} className="mb-3">
                  <button
                    onClick={() =>
                      setOpenGroup(openGroup === group.title ? null : group.title)
                    }
                    className="w-full flex justify-between items-center px-3 py-2 text-sm font-bold text-white/60 hover:text-white transition"
                  >
                    {group.title}
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        openGroup === group.title ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {openGroup === group.title && (
                    <div className="mt-1 space-y-1">
                      {group.items.map(([id, label, icon]) => (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveView(id as ViewType);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition relative ${
                            activeView === id ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                        >
                          <span className="text-lg">{icon}</span>
                          <span className="text-sm">{label}</span>
                          {/* ✅ UPDATED: Uses totalNotifications */}
                          {id === "notifications" && totalNotifications > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                              {totalNotifications}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </nav>

        {/* Logout Button */}
        {!sidebarCollapsed ? (
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/login");
            }}
            className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 rounded-lg hover:bg-white/20 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="font-medium">Logout</span>
          </button>
        ) : (
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/login");
            }}
            className="mx-3 mb-4 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition flex items-center justify-center"
            title="Logout"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        )}
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ANNOUNCEMENT BANNER */}
       
        {/* HEADER */}
        <header className="bg-gradient-to-r from-[#ae9c62] to-[#2d4a7c] text-white shadow-xl relative z-10">

      {/* ─────────────────────────────────────────────
          DESKTOP HEADER  (lg and above) — UNCHANGED
      ───────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center justify-between px-6 py-4">
        {/* LEFT: Page Title */}
        <div className="flex items-center min-w-0 flex-shrink-0">
          <h1 className="text-xl font-bold capitalize flex items-center gap-2 whitespace-nowrap">
            📊 <span>{activeView.replace("-", " ")}</span>
          </h1>
        </div>

        {/* RIGHT: All Controls */}
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
            <div className="font-mono font-bold text-lg text-amber-300 flex items-center gap-1">
              <span>⏱</span>
              <span className="tabular-nums">{formatTimer(totalSeconds)}</span>
            </div>
          </div>

          {/* Check In */}
          <button
            disabled={busy || isCheckedIn}
            onClick={async () => {
              setBusy(true);
              await checkIn(user.uid);
              await loadAttendance();
              setBusy(false);
            }}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            Check In
          </button>

          {/* Check Out */}
          <button
            disabled={busy || !isCheckedIn}
            onClick={async () => {
              setBusy(true);
              await checkOut(user.uid);
              await loadAttendance();
              setBusy(false);
            }}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            Check Out
          </button>

          {/* Calendar */}
          <button
            onClick={() => setShowCalendar(true)}
            className="p-2.5 hover:bg-white/10 rounded-lg transition-all group flex items-center justify-center"
            title="Calendar"
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/668/668278.png"
              alt="Calendar"
              className="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
            />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setActiveView("notifications")}
            className="relative p-2.5 hover:bg-white/10 rounded-lg transition-all group flex items-center justify-center"
            title="Notifications"
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/7184/7184217.png"
              alt="Notifications"
              className="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
            />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-lg animate-pulse">
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Meet */}
          <button
            onClick={() => window.open("/meet", "_blank")}
            className="p-2.5 hover:bg-white/10 rounded-lg transition-all group"
            title="Start Meeting"
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/18114/18114578.png"
              alt="Start Meeting"
              className="w-6 h-6 group-hover:scale-110 transition-transform"
            />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg transition-all"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <svg
                className={`w-4 h-4 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-4 border-b bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg">
                        {profilePhoto ? (
                          <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white">
                            {user.email?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{user.email?.split("@")[0]}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => { setActiveView("profile"); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">👤</span>
                      <span className="font-medium">Profile</span>
                    </button>
                    <button
                      onClick={() => { setActiveView("settings"); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">⚙️</span>
                      <span className="font-medium">Settings</span>
                    </button>
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={async () => { await signOut(auth); router.push("/login"); }}
                      className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🚪</span>
                      <span className="font-medium">Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Announcement bar (shared, sits below desktop row) */}
      <AnnouncementBar messages={messages} />

      {/* ─────────────────────────────────────────────
          MOBILE HEADER  (below lg) — single layout, zero duplicates
          Layout:
            Row 1 │ [☰ Title]          [🔔 👤]
            Row 2 │ [Status · Timer]   [Check In] [Check Out]
            Row 3 │ [📅 Calendar]  [📹 Meet]   (icon actions)
      ───────────────────────────────────────────── */}
      <div className="lg:hidden px-4 py-3 space-y-2">

        {/* ── Row 1: Hamburger + Title | Notifications + Avatar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-bold capitalize truncate max-w-[160px]">
              📊 {activeView.replace("-", " ")}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Notifications */}
            <button
              onClick={() => setActiveView("notifications")}
              className="relative p-2 hover:bg-white/10 rounded-lg transition-all"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[1.1rem] text-center animate-pulse">
                  {totalNotifications}
                </span>
              )}
            </button>

            {/* Avatar / User menu toggle */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1 hover:bg-white/10 rounded-lg transition-all"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden shadow-md">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile user dropdown */}
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-4 mt-1 w-60 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b bg-gradient-to-br from-gray-50 to-white">
                <p className="font-semibold text-gray-900 truncate text-sm">{user.email?.split("@")[0]}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <div className="py-1">
                <button onClick={() => { setActiveView("profile"); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-3 text-sm">
                  <span>👤</span><span>Profile</span>
                </button>
                <button onClick={() => { setActiveView("settings"); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-3 text-sm">
                  <span>⚙️</span><span>Settings</span>
                </button>
                <hr className="my-1 border-gray-200" />
                <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-3 text-sm">
                  <span>🚪</span><span>Logout</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Row 2: Status + Timer | Check In / Check Out ── */}
        <div className="flex items-center gap-2">
          {/* Status + Timer pill */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20 flex-1 min-w-0">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${isCheckedIn ? "bg-green-500 text-white" : "bg-white/20 text-white/70"}`}>
              {isCheckedIn ? "🟢 In" : "⚪ Out"}
            </span>
            <span className="font-mono font-bold text-sm text-amber-300 whitespace-nowrap">
              ⏱ {formatTimer(totalSeconds)}
            </span>
          </div>

          {/* Check In */}
          <button
            disabled={busy || isCheckedIn}
            onClick={async () => { setBusy(true); await checkIn(user.uid); await loadAttendance(); setBusy(false); }}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs whitespace-nowrap"
          >
            Check In
          </button>

          {/* Check Out */}
          <button
            disabled={busy || !isCheckedIn}
            onClick={async () => { setBusy(true); await checkOut(user.uid); await loadAttendance(); setBusy(false); }}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs whitespace-nowrap"
          >
            Check Out
          </button>
        </div>

        {/* ── Row 3: Secondary actions (Calendar, Meet) ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-xs font-medium border border-white/20"
            aria-label="Calendar"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Calendar</span>
          </button>

          <button
            onClick={() => window.open("/meet", "_blank")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all text-xs font-medium"
            aria-label="Start Meeting"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Meet</span>
          </button>
        </div>

      </div>
    </header>
      {/* Mobile Status Bar */}
        {/* <div className="lg:hidden bg-white border-b px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isCheckedIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
              {isCheckedIn ? "🟢 In" : "⚪ Out"}
            </span>
            <span className="font-mono font-bold text-blue-600">
              ⏱ {formatTimer(totalSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={busy || isCheckedIn}
              onClick={async () => {
                setBusy(true);
                await checkIn(user.uid);
                await loadAttendance();
                setBusy(false);
              }}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-40"
            >
              Check In
            </button>
            <button
              disabled={busy || !isCheckedIn}
              onClick={async () => {
                setBusy(true);
                await checkOut(user.uid);
                await loadAttendance();
                setBusy(false);
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-40"
            >
              Check Out
            </button>
          </div>
        </div> */}

  
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 mt-6">
          <div className="p-6 space-y-6">
            {/* {activeView === "dashboard" && (
              <DashboardView
                user={user}
                isCheckedIn={isCheckedIn}
                onlineMinutes={null}
                attendance={attendance}
                sessions={sessions}
                formatTotal={formatTotal}
                formatTime={formatTime}
              />
            )} */}
{activeView === "dashboard" && (
  <DashboardView
    user={user}
    isCheckedIn={isCheckedIn}
    onlineMinutes={null}
    attendance={attendance}
    sessions={sessions}
    formatTotal={formatTotal}
    formatTime={formatTime}

    // ✅ Work Update — same state & handler used by the sidebar WorkUpdateView
    task={task}
    setTask={setTask}
    notes={notes}
    setNotes={setNotes}
    handleSaveUpdate={handleSaveUpdate}
    saving={saving}
    msg={msg}

    // ✅ Apply Leave — same state & handler used by the sidebar LeaveRequestView
    leaveType={leaveType}
    setLeaveType={setLeaveType}
    fromDate={fromDate}
    setFromDate={setFromDate}
    toDate={toDate}
    setToDate={setToDate}
    leaveReason={leaveReason}
    setLeaveReason={setLeaveReason}
    handleSubmitLeave={handleSubmitLeave}
    submitting={submitting}
    leaveMsg={leaveMsg}
  />
)}

            {activeView === "work-update" && (
              <WorkUpdateView
                task={task}
                setTask={setTask}
                notes={notes}
                setNotes={setNotes}
                handleSaveUpdate={handleSaveUpdate}
                saving={saving}
                msg={msg}
              />
            )}

            {activeView === "projects" && (
              <ProjectManagement user={user} projects={projects} users={users} />
            )}

            {activeView === "attendance" && (
              <AttendanceView sessions={sessions} formatTime={formatTime} />
            )}

            {/* ✅ UPDATED: Passes queryNotifications to NotificationsView */}
          {activeView === "notifications" && (
  <NotificationsView
    leaveNotifications={leaveNotifications}
    messages={messages}
    markNotificationAsRead={markNotificationAsRead}
    queryNotifications={queryNotifications}
    markQueryNotificationAsRead={markQueryNotificationAsRead}
    onClose={() => setActiveView("dashboard")}
    dismissedAnnouncements={dismissedAnnouncements}         // ← ADD
    onDismissAnnouncement={(msg) => {                        // ← ADD
      const next = new Set(dismissedAnnouncements).add(msg);
      setDismissedAnnouncements(next);
      try {
        localStorage.setItem("tgy_dismissed_announcements", JSON.stringify([...next]));
      } catch {}
    }}
  />
)}
            {activeView === "holidays" && <HolidaysView holidays={holidays} />}

            {activeView === "leave-history" && (
              <LeaveHistoryView leaveRequests={leaveRequests} />
            )}

            {activeView === "leave-request" && (
              <LeaveRequestView
                leaveType={leaveType}
                setLeaveType={setLeaveType}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                leaveReason={leaveReason}
                setLeaveReason={setLeaveReason}
                handleSubmitLeave={handleSubmitLeave}
                submitting={submitting}
                leaveMsg={leaveMsg}
              />
            )}

            {activeView === "profile" && <ProfileView />}

            {activeView === "help" && (
  <HelpView />
)}


            {activeView === "meet" && (
              <MeetView users={users.filter((u) => u.uid !== user.uid)} />
            )}

            {activeView === "tasks" && <TasksView user={user} />}
            {activeView === "team" && <TeamView users={users} />}
            {activeView === "reports" && <ReportsView user={user} attendance={attendance} />}
            {activeView === "settings" && <SettingsView user={user} />}
            {activeView === "dashboard" && <CallHistory />}
          </div>
        </main>
      </div>

      {/* Calendar Modal */}
      <CalendarModal
        show={showCalendar}
        onClose={() => setShowCalendar(false)}
        calendarDate={calendarDate}
        setCalendarDate={setCalendarDate}
        holidays={holidays}
        isSunday={isSunday}
        isSecondSaturday={isSecondSaturday}
        isFourthSaturday={isFourthSaturday}
        isFifthSaturday={isFifthSaturday}
        isHoliday={isHoliday}
      />

      {/* Attendance Summary Modal */}
      {showAttendanceSummary && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAttendanceSummary(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">📊 Monthly Summary</h3>
              <button onClick={() => setShowAttendanceSummary(false)} className="text-gray-700 hover:text-gray-900">
                ×
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              {calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <div>
                  <p className="text-sm text-green-600 font-medium">Present Days</p>
                  <p className="text-3xl font-bold text-green-700">{monthlyStats.present}</p>
                </div>
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-3xl">✓</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border-2 border-red-200">
                <div>
                  <p className="text-sm text-red-600 font-medium">Absent Days</p>
                  <p className="text-3xl font-bold text-red-700">{monthlyStats.absent}</p>
                </div>
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-3xl text-white">×</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">Attendance %</p>
                  <p className="text-3xl font-bold text-indigo-700">{monthlyStats.percentage}%</p>
                </div>
                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-3xl text-white">📈</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
  @keyframes scroll-left-to-right {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(120%);
    }
  }

  .marquee-track {
    display: inline-block;
    min-width: 100%;
    white-space: nowrap;
    animation: scroll-left-to-right 20s linear infinite;
  }

  .marquee-track:hover {
    animation-play-state: paused;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .animate-shimmer {
    animation: shimmer 3s infinite;
  }
`}</style>


      <IncomingCallListener />
    </div>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

function TasksView({ user }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">My Tasks</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5" />
                <div>
                  <h3 className="font-semibold">Task {i}</h3>
                  <p className="text-sm text-gray-600">Due: Today</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">In Progress</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamView({ users }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Team Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u: any) => (
            <div key={u.uid} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-white">
                {u.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold">{u.email?.split("@")[0]}</h3>
                <p className="text-sm text-gray-600">Online</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsView({ user, attendance }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Performance Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
            <h3 className="text-sm font-medium mb-2">Total Hours</h3>
            <p className="text-4xl font-bold">156h</p>
            <p className="text-sm mt-2">This Month</p>
          </div>
          <div className="p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white">
            <h3 className="text-sm font-medium mb-2">Tasks Completed</h3>
            <p className="text-4xl font-bold">42</p>
            <p className="text-sm mt-2">This Month</p>
          </div>
          <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white">
            <h3 className="text-sm font-medium mb-2">Attendance</h3>
            <p className="text-4xl font-bold">95%</p>
            <p className="text-sm mt-2">This Month</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ user }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">Email Notifications</label>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div>
            <label className="block font-semibold mb-2">Theme</label>
            <select className="w-full border-2 border-gray-300 rounded-lg px-4 py-2">
              <option>Light</option>
              <option>Dark</option>
            </select>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}