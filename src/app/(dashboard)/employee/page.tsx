"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Image from "next/image";
import NavbarBreakStatus from "@/components/NavbarBreakStatus";
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  where, updateDoc, doc, setDoc, writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { auth, db, storage } from "@/lib/firebase";
import { checkIn, checkOut, getTodayAttendance } from "@/lib/attendance";
import { saveDailyUpdate } from "@/lib/dailyUpdates";
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
import AttendanceView from "./views/AttendanceView";
import NotificationsView from "./views/NotificationsView";
import CalendarModal from "./views/CalendarView";
import HolidaysView from "./views/HolidaysView";
import LeaveHistoryView from "./views/LeaveHistoryView";
import LeaveRequestView from "./views/LeaveRequestView";
import ProfileView from "./views/ProfileView";
import HelpView from "./views/HelpView";
import ProjectManagement from "./views/projectmanagement";
import { LeaveType } from "@/types/leave";
import Payslips from "./views/Payslips";

// ── IMPORT MeetChat overlay ──────────────────────────────
// Change this path to wherever your MeetChatAppUpdated file lives
import MeetChatAppUpdated from "@/components/MeetChatAppUpdated";

// ── Types ─────────────────────────────────────────────────
type ViewType =
  | "dashboard" | "work-update" | "attendance" | "notifications"
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
  { date: "2026-08-15", title: "Independence Day" },
  { date: "2026-08-28", title: "Raksha Bandhan" },
  { date: "2026-09-14", title: "Ganesh Chaturthi" },
  { date: "2026-10-02", title: "Gandhi Jayanthi" },
  { date: "2026-10-20", title: "Dussehra" },
  { date: "2026-11-08", title: "Diwali" },
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

const sidebarItems: [ViewType, string, string][] = [
  ["dashboard", "Dashboard", "📊"],
  ["work-update", "Work Update", "📝"],
  ["attendance", "Attendance", "⏰"],
  ["projects", "Projects", "📁"],
  ["payslips", "Payslips", "💰"],
  ["leave-request", "Apply Leave", "📋"],
  ["profile", "Profile", "👤"],
  ["help", "Help", "❓"],
];

// ── Announcement Bar ──────────────────────────────────────
function AnnouncementBar({ messages }: { messages: string[] }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotificationDot, setShowNotificationDot] = useState(false);

  useEffect(() => { if (messages.length > 0 && isCollapsed) setShowNotificationDot(true); }, [messages, isCollapsed]);
  useEffect(() => { if (!isCollapsed) setShowNotificationDot(false); }, [isCollapsed]);

  if (messages.length === 0) return null;

  const totalChars = messages.reduce((sum, m) => sum + m.length, 0);
  const scrollDuration = Math.max(15, Math.ceil(totalChars * 0.065));

  return (
    <>
      <div className={`bg-linear-to-r from-[#d6a70d] to-[#2d4a7c] text-white overflow-hidden shadow-lg transition-all duration-500 ease-in-out relative ${isCollapsed ? "h-0 opacity-0" : "h-9 opacity-100"
        }`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white to-transparent animate-shimmer" />
        </div>
        <div className="relative h-full flex items-center">
          <div className="flex items-center gap-2 px-3 z-10">
            <div className="relative">
              <span className="text-xl animate-pulse">📣</span>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400" />
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden marquee-container">
            <div className="marquee-track flex items-center" style={{ animationDuration: `${scrollDuration}s` }}>
              {messages.map((m, i) => (
                <div key={i} className="flex items-center gap-2 mx-6 whitespace-nowrap font-medium text-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />{m}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 z-10">
            <button onClick={() => setIsCollapsed(true)} className="p-1 hover:bg-white/20 rounded-md transition-all duration-200" title="Collapse">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {isCollapsed && (
        <div className="relative">
          <button onClick={() => setIsCollapsed(false)}
            className="absolute top-0 left-[87%] z-20 bg-linear-to-r from-orange-500 via-red-500 to-pink-500 text-white px-3 py-0.5 rounded-b-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-1.5 group text-xs font-medium"
            title="Expand announcements">
            {showNotificationDot && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
              </span>
            )}
            <span>Announcement</span>
            <svg className="w-3 h-3 transition-transform duration-300 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

// ── Notification Dropdown ─────────────────────────────────
function NotificationDropdown({
  unread, read,
  markLeaveRead, markQueryRead, markChatRead, markAnnouncementRead, markAllRead, onClose, onGoToChat,
}: {
  unread: { leave: LeaveRequest[]; query: any[]; chat: ChatNotif[]; announcement: { id: string; text: string }[] };
  read: { leave: LeaveRequest[]; query: any[]; chat: ChatNotif[]; announcement: { id: string; text: string }[] };
  markLeaveRead: (id: string) => void;
  markQueryRead: (id: string) => void;
  markChatRead: (id: string) => void;
  markAnnouncementRead: (id: string) => void;
  markAllRead: () => void;
  onClose: () => void;
  onGoToChat?: (chatId: string) => void;
}) {
  const totalUnread = unread.leave.length + unread.query.length + unread.chat.length + unread.announcement.length;
  const hasNone = totalUnread === 0 && read.leave.length === 0 && read.query.length === 0 && read.chat.length === 0 && read.announcement.length === 0;

  const renderChat = (n: any, isRead: boolean) => (
    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isRead ? "bg-gray-50 border-gray-100 opacity-60" : "bg-blue-50 border-blue-200 hover:bg-blue-100"}`}>
      <button className="flex items-start gap-3 flex-1 min-w-0 text-left" onClick={() => { if (!isRead) markChatRead(n.id); onGoToChat?.(n.chatId); onClose(); }}>
        <div className={`w-9 h-9 rounded-full bg-linear-to-br flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${isRead ? "from-gray-300 to-gray-400" : "from-blue-400 to-indigo-500"}`}>{n.fromName.charAt(0).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{n.fromName}<span className={`font-normal ml-1 ${isRead ? "text-gray-500" : "text-blue-600"}`}>sent you a message</span></p>
          <p className="text-xs text-gray-600 mt-0.5 truncate italic">&ldquo;{n.message}&rdquo;</p>
        </div>
      </button>
      {!isRead && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markChatRead(n.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-blue-200 border border-blue-200 transition-colors text-gray-400 hover:text-blue-600 shrink-0 mt-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  const renderLeave = (leave: any, isRead: boolean) => (
    <div key={leave.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isRead ? "bg-gray-50 border-gray-100 opacity-60" : leave.status === "Approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${isRead ? "bg-gray-200 grayscale" : leave.status === "Approved" ? "bg-green-100" : "bg-red-100"}`}>{leave.status === "Approved" ? "✅" : "❌"}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight"><strong>{leave.leaveType}</strong> leave <span className={isRead ? "text-gray-500" : leave.status === "Approved" ? "text-green-600" : "text-red-600"}>{leave.status}</span></p>
        <p className="text-[10px] text-gray-500 mt-0.5">📅 {leave.fromDate} – {leave.toDate}</p>
      </div>
      {!isRead && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markLeaveRead(leave.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-red-100 border border-gray-200 transition-colors text-gray-400 hover:text-red-600 shrink-0">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  const renderQuery = (q: any, isRead: boolean) => (
    <div key={q.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isRead ? "bg-gray-50 border-gray-100 opacity-60" : "bg-purple-50 border-purple-200"}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${isRead ? "bg-gray-200 grayscale" : "bg-purple-100"}`}>💬</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">Admin replied to your query</p>
        <p className={`text-xs mt-0.5 truncate ${isRead ? "text-gray-500" : "text-purple-700"}`}>Subject: {q.subject}</p>
        {q.adminReply && <p className="text-xs text-gray-600 mt-1 italic line-clamp-2">&ldquo;{q.adminReply}&rdquo;</p>}
      </div>
      {!isRead && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markQueryRead(q.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-purple-100 border border-gray-200 transition-colors text-gray-400 hover:text-purple-600 shrink-0 mt-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  const renderAnnouncement = (a: any, isRead: boolean) => (
    <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isRead ? "bg-gray-50 border-gray-100 opacity-60" : "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-lg shrink-0 shadow-sm ${isRead ? "bg-gray-300" : "bg-yellow-400"}`}>📣</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight">New Announcement</p>
        <p className="text-xs text-gray-600 mt-0.5 italic">&ldquo;{a.text}&rdquo;</p>
      </div>
      {!isRead && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAnnouncementRead(a.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-yellow-200 border border-yellow-200 transition-colors text-gray-400 hover:text-yellow-600 shrink-0 mt-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <span className="font-bold text-gray-800 text-sm">Notifications</span>
          {totalUnread > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>}
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAllRead(); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Mark all read</button>
          )}
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4">
        {hasNone && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="text-5xl mb-3">🔕</div>
            <p className="font-semibold text-gray-500 text-sm">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1">No new notifications</p>
          </div>
        )}

        {/* UNREAD SECTION */}
        {unread.chat.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Messages</span><span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread.chat.length}</span></div>
            <div className="space-y-2">{unread.chat.map((n) => renderChat(n, false))}</div>
          </section>
        )}
        {unread.announcement.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Announcements</span><span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread.announcement.length}</span></div>
            <div className="space-y-2">{unread.announcement.map((a) => renderAnnouncement(a, false))}</div>
          </section>
        )}
        {unread.leave.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leave Updates</span><span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread.leave.length}</span></div>
            <div className="space-y-2">{unread.leave.map((l) => renderLeave(l, false))}</div>
          </section>
        )}
        {unread.query.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Query Replies</span><span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread.query.length}</span></div>
            <div className="space-y-2">{unread.query.map((q) => renderQuery(q, false))}</div>
          </section>
        )}

        {/* ALREADY READ SECTION */}
        {(read.chat.length > 0 || read.announcement.length > 0 || read.leave.length > 0 || read.query.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Already Read</span>
            </div>
            <div className="space-y-2">
              {read.chat.map(n => renderChat(n, true))}
              {read.announcement.map(a => renderAnnouncement(a, true))}
              {read.leave.map(l => renderLeave(l, true))}
              {read.query.map(q => renderQuery(q, true))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────
export default function ZohoStyleEmployeeDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ── ✅ NEW: MeetChat overlay state ──────────────────────
  const [showMeetChat, setShowMeetChat] = useState(false);

  const [showCalendar, setShowCalendar] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [users, setUsers] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<ViewType>("dashboard");

  useEffect(() => {
    const saved = localStorage.getItem("activeView") as ViewType | null;
    const validViews: ViewType[] = [
      "dashboard", "work-update", "attendance", "notifications",
      "calendar", "holidays", "leave-history", "leave-request",
      "profile", "help", "projects", "meet", "tasks", "team",
      "reports", "settings", "payslips"
    ];
    if (saved && validViews.includes(saved)) setActiveView(saved);
  }, []);

  const changeView = (view: ViewType) => {
    setActiveView(view);
    localStorage.setItem("activeView", view);
  };

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
  const [queryNotifications, setQueryNotifications] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<ChatNotif[]>([]);
  const [todayBreaks, setTodayBreaks] = useState<Break[]>([]);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Classic fix: if the element was removed from the DOM during the click (common in React),
      // document.body.contains(e.target) will be false. We should NOT close the dropdown in this case.
      if (e.target && !document.body.contains(e.target as Node)) return;

      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node))
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
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatNotif));
        docs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setChatNotifications(docs.slice(0, 50));
      }
    );
  }, [user]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")),
      snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const loadAttendance = async () => {
    if (!user) return;
    const data = await getTodayAttendance(user.uid);
    setAttendance(data);
    if (data?.profilePhoto) setProfilePhoto(data.profilePhoto);
  };

  useEffect(() => { if (!loading && user) loadAttendance(); }, [loading, user]);

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
        const ci = sess.checkIn?.toDate()?.getTime();
        if (!ci) return;
        const now = new Date();
        const shiftEnd = new Date(); shiftEnd.setHours(19, 0, 0, 0);
        let co = sess.checkOut ? sess.checkOut.toDate().getTime() : Math.min(now.getTime(), shiftEnd.getTime());
        if (activeBreak?.startTime && !sess.checkOut) co = activeBreak.startTime.toDate().getTime();
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
        const docs = snap.docs.map(d => ({ id: d.id, text: (d.data() as any).text || "" }));
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
    return onSnapshot(query(collection(db, "users")),
      snap => setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }))));
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
      snap => setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "employeeQueries"), where("employeeId", "==", user.uid), orderBy("createdAt", "desc")),
      snap => setQueryNotifications(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const doCheckIn = async () => { setBusy(true); await checkIn(user.uid); await loadAttendance(); setBusy(false); };
  const doCheckOut = async () => { setBusy(true); await checkOut(user.uid); await loadAttendance(); setBusy(false); };
  const handleSetLeaveType = (v: LeaveType) => setLeaveType(v);

  // ── ✅ NEW: open MeetChat overlay (called from dashboard card + navbar button)
  const openMeetChat = () => setShowMeetChat(true);
  const closeMeetChat = () => setShowMeetChat(false);

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">

      {/* ── SIDEBAR ── (unchanged) */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-[#192e44] text-white flex flex-col transform transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-3 flex items-center justify-between border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 ml-2">
              <Image src="/logo.svg" alt="TGY CRM Logo" width={90} height={70} className="object-contain" />
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:block p-2 hover:bg-white/10 rounded-lg transition">
            <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-lg">×</button>
        </div>
        {!sidebarCollapsed && (
          <div className="px-3 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg shrink-0">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-white">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{user.email?.split("@")[0]}</p>
                {activeBreak ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse inline-block" />
                    On {activeBreak.type} break
                  </p>
                ) : (
                  <p className="text-xs text-white/60">Employee</p>
                )}
              </div>
            </div>
          </div>
        )}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          {sidebarItems.map(([id, label, icon]) => (
            <button key={id} onClick={() => { changeView(id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group ${activeView === id ? "bg-white/15 text-white shadow-sm border border-white/10" : "text-white/75 hover:bg-white/8 hover:text-white"
                }`}
              title={sidebarCollapsed ? label : undefined}
            >
              {activeView === id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-400 rounded-r-full" />}
              <span className={`text-base shrink-0 transition-transform duration-150 ${activeView === id ? "scale-110" : "group-hover:scale-105"}`}>{icon}</span>
              {!sidebarCollapsed && <span className="text-sm font-medium truncate">{label}</span>}
              {id === "notifications" && totalNotifications > 0 && (
                sidebarCollapsed
                  ? <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                  : <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0">{totalNotifications}</span>
              )}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">{label}</div>
              )}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed ? (
          <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="mx-3 mb-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 rounded-lg hover:bg-white/20 transition text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="font-medium">Logout</span>
          </button>
        ) : (
          <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="mx-2 mb-3 p-2.5 bg-white/10 rounded-lg hover:bg-white/20 transition flex items-center justify-center" title="Logout">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        )}
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <header className="bg-linear-to-r from-[#1b3359] to-[#2b404c] text-white shadow-xl relative z-30">
          <div className="hidden lg:flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center min-w-0 shrink-0">
              <h1 className="text-lg font-bold capitalize flex items-center gap-2 whitespace-nowrap">
                📊 <span>{activeView.replace(/-/g, " ")}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/20">
                <div className="font-mono font-bold text-base text-amber-300 flex items-center gap-1">
                  <span>⏱</span><span className="tabular-nums">{formatTimer(totalSeconds)}</span>
                </div>
              </div>
              <NavbarBreakStatus uid={user.uid} isCheckedIn={!!isCheckedIn} />
              <button disabled={busy || !!isCheckedIn} onClick={doCheckIn} className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">Check In</button>
              <button disabled={busy || !isCheckedIn} onClick={doCheckOut} className="px-4 py-1.5 bg-red-600   text-white rounded-lg hover:bg-red-700   disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">Check Out</button>
              <button onClick={() => setShowCalendar(true)} className="p-2 hover:bg-white/10 rounded-lg transition-all group" title="Calendar">
                <img src="https://cdn-icons-png.flaticon.com/128/668/668278.png" alt="Calendar" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              </button>

              {/* Notification bell */}
              <div className="relative" ref={notifDropdownRef}>
                <button onClick={() => setShowNotifDropdown(prev => !prev)} className="relative p-2 hover:bg-white/10 rounded-lg transition-all group" title="Notifications">
                  <img src="https://cdn-icons-png.flaticon.com/128/7184/7184217.png" alt="Notifications" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-lg animate-pulse">{totalNotifications}</span>
                  )}
                </button>
                {showNotifDropdown && (
                  <NotificationDropdown
                    unread={{ leave: unreadLeave, query: unreadQuery, chat: unreadChat, announcement: unreadAnnouncements }}
                    read={{ leave: readLeave, query: readQuery, chat: readChat, announcement: readAnnouncements }}
                    markLeaveRead={markNotificationAsRead}
                    markQueryRead={markQueryNotificationAsRead}
                    markChatRead={markChatNotificationAsRead}
                    markAnnouncementRead={markAnnouncementRead}
                    markAllRead={markAllNotificationsRead}
                    onClose={() => setShowNotifDropdown(false)}
                    // ✅ clicking a chat notif opens the overlay, NOT changeView("meet")
                    onGoToChat={(_chatId) => { openMeetChat(); setShowNotifDropdown(false); }}
                  />
                )}
              </div>

              {/* ✅ MeetChat button — opens overlay instead of window.open */}
              <button
                onClick={openMeetChat}
                className="p-2 hover:bg-white/10 rounded-lg transition-all group"
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
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-1.5 p-1.5 hover:bg-white/10 rounded-lg transition-all">
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
                        <button onClick={() => { changeView("profile"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 group text-sm"><span className="text-lg group-hover:scale-110 transition-transform">👤</span><span className="font-medium">Profile</span></button>
                        <button onClick={() => { changeView("settings"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2.5 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 group text-sm"><span className="text-lg group-hover:scale-110 transition-transform">⚙️</span><span className="font-medium">Settings</span></button>
                        <hr className="my-1 border-gray-200" />
                        <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full text-left px-3 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-2.5 group text-sm"><span className="text-lg group-hover:scale-110 transition-transform">🚪</span><span className="font-medium">Logout</span></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <AnnouncementBar messages={messages} />

          {/* Mobile header */}
          <div className="lg:hidden px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-all" aria-label="Open menu">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h1 className="text-sm font-bold capitalize truncate max-w-36">📊 {activeView.replace(/-/g, " ")}</h1>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative" ref={notifDropdownRef}>
                  <NavbarBreakStatus uid={user.uid} isCheckedIn={!!isCheckedIn} />
                  <button onClick={() => setShowNotifDropdown(prev => !prev)} className="relative p-1.5 hover:bg-white/10 rounded-lg transition-all" aria-label="Notifications">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {totalNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[1.1rem] text-center animate-pulse">{totalNotifications}</span>
                    )}
                  </button>
                  {showNotifDropdown && (
                    <NotificationDropdown
                      unread={{ leave: unreadLeave, query: unreadQuery, chat: unreadChat, announcement: unreadAnnouncements }}
                      read={{ leave: readLeave, query: readQuery, chat: readChat, announcement: readAnnouncements }}
                      markLeaveRead={markNotificationAsRead}
                      markQueryRead={markQueryNotificationAsRead}
                      markChatRead={markChatNotificationAsRead}
                      markAnnouncementRead={markAnnouncementRead}
                      markAllRead={markAllNotificationsRead}
                      onClose={() => setShowNotifDropdown(false)}
                      onGoToChat={(_chatId) => { openMeetChat(); setShowNotifDropdown(false); }}
                    />
                  )}
                </div>
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-1 hover:bg-white/10 rounded-lg transition-all" aria-label="User menu">
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
                    <button onClick={() => { setActiveView("profile"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 text-sm"><span>👤</span><span>Profile</span></button>
                    <button onClick={() => { setActiveView("settings"); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-gray-700 hover:bg-blue-50 flex items-center gap-2.5 text-sm"><span>⚙️</span><span>Settings</span></button>
                    <hr className="my-1 border-gray-200" />
                    <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-sm"><span>🚪</span><span>Logout</span></button>
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/20 flex-1 min-w-0">
                <span className="font-mono font-bold text-xs text-amber-300 whitespace-nowrap">⏱ {formatTimer(totalSeconds)}</span>
              </div>
              <button disabled={busy || !!isCheckedIn} onClick={doCheckIn} className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs whitespace-nowrap">Check In</button>
              <button disabled={busy || !isCheckedIn} onClick={doCheckOut} className="px-2.5 py-1.5 bg-red-600   text-white rounded-lg hover:bg-red-700   disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs whitespace-nowrap">Check Out</button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCalendar(true)} className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-xs font-medium border border-white/20">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Calendar</span>
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

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-3 space-y-3">
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
              />
            )}
            {activeView === "attendance" && <EmployeeAttendanceView />}
            {activeView === "work-update" && <WorkUpdateView />}
            {activeView === "projects" && <ProjectManagement user={user} projects={projects} users={users} />}
            {activeView === "notifications" && (
              <NotificationsView
                leaveNotifications={leaveRequests.filter(l => (l.status === "Approved" || l.status === "Rejected") && !l.notificationRead)}
                markNotificationAsRead={markNotificationAsRead}
                queryNotifications={queryNotifications}
                markQueryNotificationAsRead={markQueryNotificationAsRead}
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
            {activeView === "tasks" && <TasksView user={user} />}
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
      />

      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        .marquee-track { display: inline-flex; white-space: nowrap; animation: marquee linear; animation-fill-mode: forwards; }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 3s infinite; }
      `}</style>

      <IncomingCallListener />
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────
function TasksView({ user }: any) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h2 className="text-xl font-bold mb-3">My Tasks</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4" />
                <div><h3 className="font-semibold text-sm">Task {i}</h3><p className="text-xs text-gray-600">Due: Today</p></div>
              </div>
              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">In Progress</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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