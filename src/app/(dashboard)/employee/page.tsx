"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, updateDoc, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { useAuth } from "@/context/AuthContext";
import { auth, db, storage } from "@/lib/firebase";
import { checkIn, checkOut, getTodayAttendance } from "@/lib/attendance";
import { saveDailyUpdate } from "@/lib/dailyUpdates";
import CallCenter from "../calls/CallCenter";
import CallHistory from "@/components/CallHistory";
import IncomingCallListener from "@/components/IncomingCallListener";
import MeetView from "@/components/MeetView";



<CallCenter />

type ViewType = "dashboard" | "work-update" | "attendance" | "notifications" | "calendar" | "holidays" | "leave-history" | "leave-request" | "profile" | "help"| "meet";

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

const formatTime = (ts: any) => ts ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
const formatTotal = (min = 0) => `${Math.floor(min / 60)}h ${min % 60}m`;
const minutesSince = (ts: any) => Math.floor((Date.now() - ts.toDate().getTime()) / 60000);

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

export default function EmployeeDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);

  const [activeView, setActiveView] = useState<ViewType>("dashboard");
  const [attendance, setAttendance] = useState<any>(null);
  const [onlineMinutes, setOnlineMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<"Casual" | "Sick" | "LOP">("Casual");
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
    const last = attendance.sessions.at(-1);
    if (!last || last.checkOut) {
      setOnlineMinutes(null);
      return;
    }
    const update = () => setOnlineMinutes(minutesSince(last.checkIn));
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [attendance]);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => d.data().text)));
  }, []);

  useEffect(() => {
  const q = query(collection(db, "users"));
  return onSnapshot(q, (snap) => {
    setUsers(
      snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }))
    );
  });
}, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "leaveRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setLeaveRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
  }, [user]);

  if (loading || !user) return null;

  const sessions = attendance?.sessions || [];
  const lastSession = sessions.at(-1);
  const isCheckedIn = lastSession && !lastSession.checkOut;

  const leaveNotifications = leaveRequests.filter(l => 
    (l.status === "Approved" || l.status === "Rejected") && 
    !l.notificationRead
  );

  // Calculate monthly attendance summary
  const getMonthlyAttendanceSummary = () => {
    if (!attendance?.history) return { present: 0, absent: 0, total: 0, percentage: 0 };
    
    const currentMonth = attendance.history.filter((d: any) => {
      const recordDate = new Date(d.date);
      return recordDate.getMonth() === month && recordDate.getFullYear() === year;
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
      const storageRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}_${file.name}`);
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

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0b3a5a] text-white flex flex-col transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
              </svg>
            </div>
            <span className="font-semibold">Office Tracker</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden hover:bg-white/10 p-1.5 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 border-b border-white/10">
          <p className="font-medium truncate">{user.email?.split("@")[0]}</p>
          <p className="text-xs text-white/60">Employee</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            ["dashboard", "Dashboard", "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"],
            ["work-update", "Work Update", "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"],
            ["attendance", "Attendance", "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"],
            ["notifications", "Notifications", "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"],
            ["leave-request", "Apply Leave", "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"],
            ["leave-history", "Leave History", "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"],
            ["calendar", "Calendar", "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"],
            ["holidays", "Holidays", "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"],
            ["profile", "Profile", "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"],
            ["help", "Help", "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"],
            ["meet", "Meet", "M17 20h5v-2a3 3 0 00-5.356-1.857"]
          ].map(([id, label, icon]) => (
            <button key={id} onClick={() => { setActiveView(id as ViewType); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition relative ${activeView === id ? "bg-white/10" : "hover:bg-white/5"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              <span className="text-sm">{label}</span>
              {id === "notifications" && (messages.length + leaveNotifications.length) > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {messages.length + leaveNotifications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-white rounded-full hover:shadow-lg transition">
          <svg className="w-5 h-5 text-[#0b3a5a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-bold text-[#0b3a5a]">LOGOUT</span>
        </button>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {messages.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white py-2 overflow-hidden shadow-lg">
            <div className="animate-marquee whitespace-nowrap px-6 flex gap-8">
             {messages.map((m, i) => (
  <span key={i} className="inline-flex items-center gap-2 font-medium">
    📣 {m}
  </span>
))}

            </div>
          </div>
        )}

        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold capitalize">{activeView.replace("-", " ")}</h1>
          </div>

          <div className="flex gap-3">
            <button disabled={busy || isCheckedIn} onClick={async () => { setBusy(true); await checkIn(user.uid); await loadAttendance(); setBusy(false); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition font-medium shadow-sm">
              Check In
            </button>
            <button disabled={busy || !isCheckedIn} onClick={async () => { setBusy(true); await checkOut(user.uid); await loadAttendance(); setBusy(false); }} className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition font-medium">
              Check Out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeView === "dashboard" && (
            <>
              <div>
                <h2 className="text-3xl font-bold">Welcome back, {user.email?.split("@")[0]}</h2>
                <p className="text-gray-700 mt-1">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                  <p className="text-gray-700 text-sm mb-2">Status</p>
                  <p className="text-2xl font-semibold">{isCheckedIn ? "🟢 Online" : "⚫ Offline"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                  <p className="text-gray-700 text-sm mb-2">Current Session</p>
                  <p className="text-2xl font-semibold">{onlineMinutes !== null ? formatTotal(onlineMinutes) : "--"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                  <p className="text-gray-700 text-sm mb-2">Total Worked</p>
                  <p className="text-2xl font-semibold">{attendance?.totalMinutes ? formatTotal(attendance.totalMinutes) : "--"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                  <p className="text-gray-700 text-sm mb-2">Sessions Today</p>
                  <p className="text-2xl font-semibold">{sessions.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Today's Sessions</h3>
                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">No check-in yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="font-medium">Session {i + 1}</span>
                        <span className="text-gray-600">{formatTime(s.checkIn)}</span>
                        <span className={s.checkOut ? "text-gray-600" : "text-blue-600 font-medium"}>{s.checkOut ? formatTime(s.checkOut) : "⏱️ In progress"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeView === "work-update" && (
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold">Work Update</h2>
              <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What are you working on?" className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes or progress details..." rows={4} className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]" />
              <button onClick={handleSaveUpdate} disabled={saving} className="px-6 py-3 bg-[#0b3a5a] text-white rounded-xl hover:bg-[#0a3350] disabled:opacity-50 transition font-medium shadow">
                {saving ? "Saving..." : "Save Update"}
              </button>
              {msg && <p className="text-sm text-gray-600">{msg}</p>}
            </div>
          )}

          {activeView === "attendance" && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Attendance</h2>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="font-medium">No attendance today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between p-3 border-b border-gray-200">
                      <span className="font-medium">Session {i + 1}</span>
                      <span className="text-gray-600">{formatTime(s.checkIn)}</span>
                      <span className="text-gray-600">{s.checkOut ? formatTime(s.checkOut) : "In progress"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === "notifications" && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Notifications</h2>
              
              {leaveNotifications.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
                    <span>Leave Updates</span>
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{leaveNotifications.length}</span>
                  </h3>
                  {leaveNotifications.map((leave) => (
                    <div 
                      key={leave.id} 
                      className={`p-4 rounded-lg border-l-4 cursor-pointer transition hover:shadow-md ${
                        leave.status === "Approved" 
                          ? "bg-green-50 border-green-500" 
                          : "bg-red-50 border-red-500"
                      }`}
                      onClick={() => markNotificationAsRead(leave.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          leave.status === "Approved" ? "bg-green-500" : "bg-red-500"
                        }`}>
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {leave.status === "Approved" ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${
                            leave.status === "Approved" ? "text-green-700" : "text-red-700"
                          }`}>
                            Your {leave.leaveType} leave has been {leave.status.toLowerCase()}! 🎉
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            📅 {new Date(leave.fromDate).toLocaleDateString("en-IN")} - {new Date(leave.toDate).toLocaleDateString("en-IN")}
                          </p>
                          <p className="text-xs text-gray-700 mt-1">Click to mark as read</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {messages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase">Announcements</h3>
                  {messages.map((m, i) => (
                    <div key={i} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <p className="text-gray-800 font-medium">📣 {m}</p>
                    </div>
                  ))}
                </div>
              )}

              {messages.length === 0 && leaveNotifications.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="font-medium">No notifications</p>
                  <p className="text-sm mt-1">You're all caught up! 🎉</p>
                </div>
              )}
            </div>
          )}

          {activeView === "calendar" && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Holiday Calendar</h2>
                  <p className="text-sm text-slate-700">View holidays and weekends</p>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowAttendanceSummary(true)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
                  >
                    📊 Monthly Summary
                  </button>

                  <button
                    onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                    className="px-4 py-2 border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
                  >
                    ← Previous
                  </button>

                  <div className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg">
                    {calendarDate.toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>

                  <button
                    onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                    className="px-4 py-2 border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center font-bold text-slate-700 mb-3 text-sm lg:text-base">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-3">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 lg:gap-3">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;

                  const isToday =
                    day === new Date().getDate() &&
                    month === new Date().getMonth() &&
                    year === new Date().getFullYear();

                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  const sunday = isSunday(year, month, day);
                  const secondSat = isSecondSaturday(year, month, day);
                  const fourthSat = isFourthSaturday(year, month, day);
                  const fifthSat = isFifthSaturday(year, month, day);
                  const holiday = isHoliday(dateStr);

                  const isHolidayDay = sunday || secondSat || fourthSat || fifthSat || holiday;

                  // Check attendance status
                  const attendanceRecord = attendance?.history?.find((d: any) => d.date === dateStr);
                  const isPresent = attendanceRecord?.status === "present";
                  const isAbsent = attendanceRecord?.status === "absent";

                  return (
                    <div
                      key={day}
                      className={`h-20 sm:h-24 lg:h-28 border rounded-lg p-3 text-sm lg:text-base relative transition hover:shadow-sm ${
                        isToday
                          ? "border-indigo-500 ring-2 ring-indigo-200 shadow-sm"
                          : isHolidayDay
                          ? "bg-green-100 border-rose-300"
                          : isPresent
                          ? "bg-red-100 border-green-300"
                          : isAbsent
                          ? "bg-rose-100 border-red-300"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className={`font-bold ${isToday ? 'text-indigo-700' : 'text-slate-900'}`}>{day}</div>

                      {isHolidayDay && (
                        <div className="mt-1 lg:mt-2 text-xs lg:text-sm text-rose-600 font-semibold line-clamp-2">
                          {holiday ? holiday.title : sunday ? "Sunday" : secondSat ? "2nd Saturday" : fourthSat ? "4th Saturday" : fifthSat ? "5th Saturday" : ""}
                        </div>
                      )}

                      {isPresent && !isHolidayDay && (
                        <div className="mt-1 text-xs lg:text-xs text-green-700 font-semibold">✓ Present</div>
                      )}

                      {isAbsent && !isHolidayDay && (
                        <div className="mt-1 text-xs lg:text-xs text-red-700 font-semibold">✗ Absent</div>
                      )}

                      {isToday && (
                        <span className="absolute bottom-1 right-1 lg:bottom-2 lg:right-2 text-xs lg:text-xs text-indigo-700 font-bold bg-indigo-200 px-2 py-0.5 rounded-full">
                          TODAY
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-4 lg:gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-50 border-2 border-green-300 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-50 border-2 border-red-300 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-rose-50 to-pink-50 border-2 border-rose-300 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Holiday/Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-50 border-2 border-indigo-500 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Today</span>
                </div>
              </div>
            </div>
          )}

          {activeView === "holidays" && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Holidays 🎉</h2>
              {holidays.map((h, i) => (
                <div key={i} className="flex justify-between items-center border-b py-3 hover:bg-gray-50 px-2 rounded transition">
                  <span className="font-medium">🎊 {h.title}</span>
                  <span className="text-gray-700">{new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}

          {activeView === "leave-history" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200">
                  <p className="text-2xl font-bold text-amber-700">{leaveRequests.filter(l => l.status === "Pending").length}</p>
                  <p className="text-sm text-amber-600 font-medium">Pending</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border-2 border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-700">{leaveRequests.filter(l => l.status === "Approved").length}</p>
                  <p className="text-sm text-emerald-600 font-medium">Approved</p>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-6 border-2 border-rose-200">
                  <p className="text-2xl font-bold text-rose-700">{leaveRequests.filter(l => l.status === "Rejected").length}</p>
                  <p className="text-sm text-rose-600 font-medium">Rejected</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-xl font-semibold mb-4">My Leave Requests</h2>
                {leaveRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="font-medium">No leave requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leaveRequests.map((leave) => (
                      <div key={leave.id} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                        <div className="flex gap-2 mb-3">
                          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${leave.leaveType === "Casual" ? "bg-blue-100 text-blue-700" : leave.leaveType === "Sick" ? "bg-yellow-100 text-yellow-700" : "bg-purple-100 text-purple-700"}`}>
                            {leave.leaveType}
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${leave.status === "Approved" ? "bg-green-100 text-green-700" : leave.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                            {leave.status}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><strong>From:</strong> {new Date(leave.fromDate).toLocaleDateString("en-IN")}</p>
                          <p><strong>To:</strong> {new Date(leave.toDate).toLocaleDateString("en-IN")}</p>
                          <p><strong>Reason:</strong> {leave.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === "leave-request" && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
              <h2 className="text-xl font-semibold">Apply for Leave</h2>
              
              <div>
                <label className="block text-sm font-medium mb-2">Leave Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {["Casual", "Sick", "LOP"].map((type) => (
                    <button key={type} onClick={() => setLeaveType(type as any)} className={`px-4 py-2 rounded-xl font-medium transition border-2 ${leaveType === type ? "bg-[#0b3a5a] text-white border-[#0b3a5a]" : "bg-white border-gray-300 hover:border-[#0b3a5a]"}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">From Date</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[#0b3a5a]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">To Date</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || new Date().toISOString().split("T")[0]} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[#0b3a5a]" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Please provide a reason..." rows={4} className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]" />
              </div>

              <button onClick={handleSubmitLeave} disabled={submitting} className="w-full px-6 py-3 bg-[#0b3a5a] text-white rounded-xl hover:bg-[#0a3350] disabled:opacity-50 transition font-medium shadow">
                {submitting ? "Submitting..." : "Submit Request"}
              </button>

              {leaveMsg && <p className={`text-sm ${leaveMsg.includes("✅") ? "text-green-600" : "text-red-600"}`}>{leaveMsg}</p>}
            </div>
          )}

          {activeView === "profile" && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
              <h2 className="text-xl font-semibold">My Profile</h2>

              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-[#0b3a5a] shadow-lg" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-[#0b3a5a] text-white flex items-center justify-center text-4xl font-bold shadow-lg">
                      {user.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-10 h-10 bg-[#0b3a5a] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#0a3350] transition shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="text-center">
                        <svg className="animate-spin h-8 w-8 text-white mx-auto mb-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-white text-xs">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold">{user.email?.split("@")[0]}</p>
                  <p className="text-gray-700">{user.email}</p>
                  <p className="text-sm text-gray-400">Employee</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">Email</p>
                  <p className="font-medium mt-1">{user.email}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">Role</p>
                  <p className="font-medium mt-1">Employee</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">Status</p>
                  <p className="font-medium mt-1 text-green-600">● Active</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">Joined</p>
                  <p className="font-medium mt-1">{attendance?.joinedAt ? new Date(attendance.joinedAt).toLocaleDateString("en-IN") : "—"}</p>
                </div>
              </div>
            </div>
          )}

          {activeView === "help" && (
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold">Help & Queries</h2>
              <input 
                value={querySubject}
                onChange={(e) => setQuerySubject(e.target.value)}
                placeholder="Subject" 
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]" 
              />
              <textarea 
                value={queryMessage}
                onChange={(e) => setQueryMessage(e.target.value)}
                placeholder="Describe your issue..." 
                rows={4} 
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-[#0b3a5a]" 
              />
              <button 
                onClick={handleSubmitQuery}
                disabled={querySubmitting}
                className="px-6 py-3 bg-[#0b3a5a] text-white rounded-xl hover:bg-[#0a3350] disabled:opacity-50 transition font-medium shadow"
              >
                {querySubmitting ? "Submitting..." : "Submit Query"}
              </button>
              {queryMsg && (
                <p className={`text-sm ${queryMsg.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                  {queryMsg}
                </p>
              )}
            </div>
          )}



{activeView === "meet" && (
  <MeetView users={users.filter(u => u.uid !== user.uid)} />
)}
<CallHistory />
        </main>
      </div>
 
      {/* Monthly Attendance Summary Modal */}
      {showAttendanceSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAttendanceSummary(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">📊 Monthly Summary</h3>
              <button onClick={() => setShowAttendanceSummary(false)} className="text-gray-700 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl border-2 border-red-200">
                <div>
                  <p className="text-sm text-red-600 font-medium">Absent Days</p>
                  <p className="text-3xl font-bold text-red-700">{monthlyStats.absent}</p>
                </div>
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">Attendance %</p>
                  <p className="text-3xl font-bold text-indigo-700">{monthlyStats.percentage}%</p>
                </div>
                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <button onClick={() => setShowAttendanceSummary(false)} className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium">
              Close
            </button>
          </div>
        </div>
      )}

     <style jsx>{`
  @keyframes marquee {
    0% { transform: translateX(100%); }   /* start from right */
    100% { transform: translateX(-50%); } /* move to left */
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