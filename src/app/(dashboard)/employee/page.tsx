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
import CallCenter from "../calls/CallCenter";
import CallHistory from "@/components/CallHistory";
import MeetPanel from "@/components/MeetPanel";
import IncomingCallListener from "@/components/IncomingCallListener";
import MeetView from "@/components/MeetView";
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

<CallCenter />;

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
  | "meet";

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
const minutesSince = (ts: any) =>
  Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
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
    title: "MAIN",
    items: [
      ["dashboard", "Dashboard", "M3 12l2-2..."],
    ],
  },

  {
    title: "WORK",
    items: [
      ["work-update", "Work Update", "M9 5H7..."],
      ["attendance", "Attendance", "M12 8v4..."],
      ["meet", "Meet", "M17 20h5..."],
    ],
  },

  {
    title: "LEAVE & CALENDAR",
    items: [
      ["leave-request", "Apply Leave", "M9 12h6..."],
      ["leave-history", "Leave History", "M9 5H7..."],
      ["holidays", "Holidays", "M12 8v13..."],
      ["calendar", "Calendar", "M8 7V3..."],
    ],
  },

  {
    title: "COMMUNICATION",
    items: [
      ["notifications", "Notifications", "M15 17h5..."],
    ],
  },

  {
    title: "ACCOUNT",
    items: [
      ["profile", "Profile", "M16 7a4..."],
      ["help", "Help", "M8.228 9..."],
    ],
  },
];

export default function EmployeeDashboard() {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
const [onlineMinutes, setOnlineMinutes] = useState<number | null>(null);
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
  const [leaveType, setLeaveType] = useState<"Casual" | "Sick" | "LOP">(
    "Casual",
  );
  const [openGroup, setOpenGroup] = useState<string | null>("MAIN");

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
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
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

      const checkOut = s.checkOut
        ? s.checkOut.toDate().getTime()
        : Date.now(); // running session

      if (checkIn) {
        seconds += Math.floor((checkOut - checkIn) / 1000);
      }
    });

    setTotalSeconds(seconds);
  };

  calculateTotalSeconds();

  // ONLY create interval if currently checked in
  const last = attendance.sessions.at(-1);

  if (last && !last.checkOut) {
    const interval = setInterval(calculateTotalSeconds, 1000);
    return () => clearInterval(interval);
  }
}, [attendance]);


  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));

    return onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => d.data().text)),
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"));

    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })));
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "leaveRequests"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(q, (snap) =>
      setLeaveRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
      ),
    );
  }, [user]);
  if (loading || !user) return null;
  const sessions = attendance?.sessions || [];
  const lastSession = sessions.at(-1);
  const isCheckedIn = lastSession && !lastSession.checkOut;
  const leaveNotifications = leaveRequests.filter(
    (l) =>
      (l.status === "Approved" || l.status === "Rejected") &&
      !l.notificationRead,
  );

  // Calculate monthly attendance summary

  const getMonthlyAttendanceSummary = () => {
    if (!attendance?.history)
      return { present: 0, absent: 0, total: 0, percentage: 0 };

    const currentMonth = attendance.history.filter((d: any) => {
      const recordDate = new Date(d.date);

      return (
        recordDate.getMonth() === month && recordDate.getFullYear() === year
      );
    });

    const present = currentMonth.filter(
      (d: any) => d.status === "present",
    ).length;

    const absent = currentMonth.filter(
      (d: any) => d.status === "absent",
    ).length;
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
    } catch {
      setLeaveMsg("❌ Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Validate file size (max 5MB)

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");

      return;
    }

    // Validate file type

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");

      return;
    }

    try {
      setUploading(true);

      // Upload to Firebase Storage

      const storageRef = ref(
        storage,
        `profilePhotos/${user.uid}/${Date.now()}_${file.name}`,
      );
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      // Update Firestore - use setDoc with merge to create if doesn't exist
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
  const handleSubmitQuery = async () => {
    if (!querySubject.trim() || !queryMessage.trim()) {
      setQueryMsg("Please fill all fields");

      return;
    }

    try {
      setQuerySubmitting(true);
      setQueryMsg("");
      await addDoc(collection(db, "queries"), {
        uid: user.uid,
        userName: user.email?.split("@")[0] || "Unknown",
        userEmail: user.email || "",
        subject: querySubject,
        message: queryMessage,
        status: "Pending",
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
const formatTimer = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
};

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0b3a5a] text-white flex flex-col transform transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
              </svg>
            </div>

            <span className="font-semibold">Office Tracker</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden hover:bg-white/10 p-1.5 rounded"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 border-b border-white/10">
          <p className="font-medium truncate">{user.email?.split("@")[0]}</p>

          <p className="text-xs text-white/60">Employee</p>
        </div>

        {/* <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            [
              "dashboard",
              "Dashboard",
              "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
            ],

            [
              "work-update",
              "Work Update",
              "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
            ],

            [
              "attendance",
              "Attendance",
              "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
            ],

            [
              "notifications",
              "Notifications",
              "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
            ],

            [
              "leave-request",
              "Apply Leave",
              "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            ],

            [
              "leave-history",
              "Leave History",
              "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
            ],

            [
              "calendar",
              "Calendar",
              "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
            ],

            [
              "holidays",
              "Holidays",
              "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7",
            ],

            [
              "profile",
              "Profile",
              "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
            ],

            [
              "help",
              "Help",
              "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
            ],

            ["meet", "Meet", "M17 20h5v-2a3 3 0 00-5.356-1.857"],
          ].map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => {
                setActiveView(id as ViewType);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition relative ${activeView === id ? "bg-white/10" : "hover:bg-white/5"}`}
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
                  d={icon}
                />
              </svg>

              <span className="text-sm">{label}</span>

              {id === "notifications" &&
                messages.length + leaveNotifications.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    {messages.length + leaveNotifications.length}
                  </span>
                )}
            </button>
          ))}
        </nav> */}
<nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
  {sidebarGroups.map((group) => (
    <div key={group.title}>
      
      {/* GROUP TITLE */}
      <button
        onClick={() =>
          setOpenGroup(openGroup === group.title ? null : group.title)
        }
        className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-white/60 hover:text-white"
      >
        {group.title}
      <svg
  className={`w-4 h-4 transition-transform duration-300 ${
    openGroup === group.title ? "rotate-180" : "rotate-0"
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

      {/* DROPDOWN */}
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
                activeView === id
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              }`}
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
                  d={icon}
                />
              </svg>

              <span className="text-sm">{label}</span>

              {/* Notification Badge */}
              {id === "notifications" &&
                messages.length + leaveNotifications.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    {messages.length + leaveNotifications.length}
                  </span>
                )}
            </button>
          ))}
        </div>
      )}
    </div>
  ))}
</nav>

        <button
          onClick={async () => {
            await signOut(auth);
            router.push("/login");
          }}
          className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-white rounded-full hover:shadow-lg transition"
        >
          <svg
            className="w-5 h-5 text-[#0b3a5a]"
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

          <span className="font-bold text-[#0b3a5a]">LOGOUT</span>
        </button>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {messages.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white py-2 overflow-hidden shadow-lg">
            <div className="animate-marquee whitespace-nowrap px-6 flex gap-8">
              {messages.map((m, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 font-medium"
                >
                  📣 {m}
                </span>
              ))}
            </div>
          </div>
        )}

        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <h1 className="text-xl font-semibold capitalize">
              {activeView.replace("-", " ")}
            </h1>
          </div>

      <div className="flex items-center gap-3">

  {/* 🔥 CALENDAR BUTTON */}
  <button
  onClick={() => setShowCalendar(true)}
  className="p-1 rounded-sm hover:bg-slate-100 transition"
>
  <img
    src="https://cdn-icons-png.flaticon.com/512/10691/10691802.png"
    alt="Calendar"
    className="w-8 h-8 object-contain"
  />
</button>
{/* 🔔 NOTIFICATIONS */}
<button
  onClick={() => setActiveView("notifications")}
  className="relative p-2 rounded-lg hover:bg-slate-100 transition"
>
  <img
    src="https://cdn-icons-png.flaticon.com/128/891/891012.png"
    alt="Notifications"
    className="w-7 h-7 object-contain"
  />

  {/* Badge */}
  {(messages.length + leaveNotifications.length) > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
      {messages.length + leaveNotifications.length}
    </span>
  )}
</button>

{/* meet */}
 <button
 onClick={() => {
    window.open("/meet", "_blank"); // 👈 change route if needed
   
  }}
  className={`
 flex items-center justify-center
w-8 h-8
rounded-xl

    font-semibold text-white
    bg-[#2380de]
    shadow-lg hover:shadow-xl
    transition-all duration-300
    active:scale-[0.98]
  `}
>
  {/* ICON */}
  <div className="relative">
  <img
  src="https://cdn-icons-png.flaticon.com/128/8407/8407947.png"
  alt="Meet"
  className="w-5 h-5 object-contain"
/>
 </div>

  {/* TEXT */}
  {/* <span className="flex-1 text-left">Meet</span> */}
</button>
  {/* LIVE TIMER */}
  <div
    className={`px-2 py-1 text-white rounded-xl font-mono text-lg tracking-wider shadow-sm flex items-center gap-2 transition-colors duration-300 ${
      isCheckedIn ? "bg-green-600" : "bg-red-600"
    }`}
  >
    ⏱ {formatTimer(totalSeconds)}
  </div>

 

  {/* CHECK IN */}
  <button
    disabled={busy || isCheckedIn}
    onClick={async () => {
      setBusy(true);
      await checkIn(user.uid);
      await loadAttendance();
      setBusy(false);
    }}
    className="px-2 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition font-medium shadow-sm"
  >
    Check In
  </button>

  {/* CHECK OUT */}
  <button
    disabled={busy || !isCheckedIn}
    onClick={async () => {
      setBusy(true);
      await checkOut(user.uid);
      await loadAttendance();
      setBusy(false);
    }}
    className="px-2 py-1 border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition font-medium"
  >
    Check Out
  </button>

</div>


        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeView === "dashboard" && (
  <DashboardView
    user={user}
    isCheckedIn={isCheckedIn}
    onlineMinutes={onlineMinutes}
    attendance={attendance}
    sessions={sessions}
    formatTotal={formatTotal}
    formatTime={formatTime}
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

{activeView === "attendance" && (
  <AttendanceView
    sessions={sessions}
    formatTime={formatTime}
  />
)}


          {activeView === "notifications" && (
  <NotificationsView
    leaveNotifications={leaveNotifications}
    messages={messages}
    markNotificationAsRead={markNotificationAsRead}
  />
)}


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

          {activeView === "holidays" && (
  <HolidaysView holidays={holidays} />
)}

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

         {activeView === "profile" && (
  <ProfileView
    user={user}
    profilePhoto={profilePhoto}
    handlePhotoUpload={handlePhotoUpload}
    uploading={uploading}
    attendance={attendance}
  />
)}

         {activeView === "help" && (
  <HelpView
    querySubject={querySubject}
    setQuerySubject={setQuerySubject}
    queryMessage={queryMessage}
    setQueryMessage={setQueryMessage}
    handleSubmitQuery={handleSubmitQuery}
    querySubmitting={querySubmitting}
    queryMsg={queryMsg}
  />
)}


          {activeView === "meet" && (
            <MeetView users={users.filter((u) => u.uid !== user.uid)} />
          )}

          <CallHistory />
        </main>
      </div>

      {/* Monthly Attendance Summary Modal */}

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
              <h3 className="text-2xl font-bold text-slate-900">
                📊 Monthly Summary
              </h3>

              <button
                onClick={() => setShowAttendanceSummary(false)}
                className="text-gray-700 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-slate-600 mb-6">
              {calendarDate.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </p>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <div>
                  <p className="text-sm text-green-600 font-medium">
                    Present Days
                  </p>

                  <p className="text-3xl font-bold text-green-700">
                    {monthlyStats.present}
                  </p>
                </div>

                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border-2 border-red-200">
                <div>
                  <p className="text-sm text-red-600 font-medium">
                    Absent Days
                  </p>

                  <p className="text-3xl font-bold text-red-700">
                    {monthlyStats.absent}
                  </p>
                </div>

                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">
                    Attendance %
                  </p>

                  <p className="text-3xl font-bold text-indigo-700">
                    {monthlyStats.percentage}%
                  </p>
                </div>

                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAttendanceSummary(false)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          } /* start from right */

          100% {
            transform: translateX(-50%);
          } /* move to left */
        }

        .animate-marquee {
          animation: marquee 30s linear infinite;

          will-change: transform;

          backface-visibility: hidden;

          transform: translateZ(0);
        }
      `}</style>

      <IncomingCallListener />
    </div>
  );
}
