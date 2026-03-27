"use client";

// app/(dashboard)/hr/page.tsx
// Full HR Dashboard — mirrors admin architecture with HR-scoped features:
// Dashboard · Leave Requests · Employees (view+edit) · Attendance · Payslips · Announcements · Queries

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/common/ProtectedRoute";

// ── Re-use existing sub-components ──────────────────────────────────────────
import LeaveRequests     from "@/app/(dashboard)/admin/leaverequests";
import MonthlyReport     from "@/app/(dashboard)/admin/monthlyreport";
import AdminBreakView    from "@/components/AdminBreakView";
import IncomingCallListener from "@/components/IncomingCallListener";

// ── Types ────────────────────────────────────────────────────────────────────
import type { AttendanceType } from "@/types/attendance";
import type { Employee }       from "@/types/Employee";
import type { Session }        from "@/types/Employee";
import type { EmployeeRow }    from "@/types/EmployeeRow";

type HRView =
  | "dashboard" | "leave" | "employees" | "attendance"
  | "payslips"  | "announcements" | "queries" | "breakMonitor";

interface Notification {
  id        : string;
  toUid     : string;
  title     : string;
  message   : string;
  read      : boolean;
  createdAt : Timestamp;
}

interface LeaveRequest {
  id        : string;
  uid       : string;
  userName  : string;
  userEmail : string;
  leaveType : string;
  fromDate  : string;
  toDate    : string;
  reason    : string;
  status    : "Pending" | "Approved" | "Rejected";
  createdAt : any;
}

interface Query {
  id           : string;
  uid          : string;
  userName     : string;
  userEmail    : string;
  subject      : string;
  message      : string;
  status       : "open" | "resolved";
  adminUnread  : boolean;
  reply       ?: string;
  createdAt    : any;
}

const DECLARED_HOLIDAYS: Record<string, { title: string }> = {
  "2026-01-01": { title: "New Year" },
  "2026-01-13": { title: "Bhogi" },
  "2026-01-14": { title: "Pongal" },
  "2026-03-04": { title: "Holi" },
  "2026-03-19": { title: "Ugadi" },
  "2026-08-15": { title: "Independence Day" },
  "2026-08-28": { title: "Raksha Bandhan" },
  "2026-09-14": { title: "Ganesh Chaturthi" },
  "2026-10-02": { title: "Gandhi Jayanthi" },
  "2026-10-20": { title: "Dussehra" },
  "2026-11-08": { title: "Diwali" },
  "2026-12-25": { title: "Christmas" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (ts: any) =>
  ts ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

const formatTotal = (m?: number): string => {
  const minutes = m ?? 0;
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  if (h === 0 && min === 0) return "0m";
  return h ? `${h}h ${min}m` : `${min}m`;
};

const calcTotalMinutes = (sessions: Session[]) => {
  let total = 0;
  for (const s of sessions) {
    if (!s?.checkIn) continue;
    const start = s.checkIn?.toDate ? s.checkIn.toDate().getTime() : new Date(s.checkIn as any).getTime();
    const end   = s.checkOut
      ? (s.checkOut?.toDate ? s.checkOut.toDate().getTime() : new Date(s.checkOut as any).getTime())
      : Date.now();
    const diff = end - start;
    if (diff > 0) total += Math.floor(diff / 60000);
  }
  return total;
};

const isSunday          = (y: number, m: number, d: number) => new Date(y, m, d).getDay() === 0;
const isSecondSaturday  = (y: number, m: number, d: number) => { const date = new Date(y, m, d); return date.getDay() === 6 && Math.ceil(d / 7) === 2; };
const isFourthSaturday  = (y: number, m: number, d: number) => { const date = new Date(y, m, d); return date.getDay() === 6 && Math.ceil(d / 7) === 4; };
const isFifthSaturday   = (y: number, m: number, d: number) => { const date = new Date(y, m, d); return date.getDay() === 6 && Math.ceil(d / 7) === 5; };
const isHoliday         = (dateStr: string) => DECLARED_HOLIDAYS[dateStr];

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function HRDashboard() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // ── Layout state ─────────────────────────────────────────────────────────
  const [view,             setView]             = useState<HRView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [showCalendar,     setShowCalendar]     = useState(false);

  // ── Data state ────────────────────────────────────────────────────────────
  const [rows,             setRows]             = useState<EmployeeRow[]>([]);
  const [users,            setUsers]            = useState<Employee[]>([]);
  const [leaveRequests,    setLeaveRequests]    = useState<LeaveRequest[]>([]);
  const [queries,          setQueries]          = useState<Query[]>([]);
  const [messages,         setMessages]         = useState<{ id: string; text: string; createdAt: any }[]>([]);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<Record<string, Record<string, AttendanceType>>>({});
  const [monthlyDate,      setMonthlyDate]      = useState(new Date());
  const [busy,             setBusy]             = useState(true);
  const [queryUnread,      setQueryUnread]      = useState(0);

  // ── Employee detail / edit state ──────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editedEmployee,   setEditedEmployee]   = useState<Employee | null>(null);
  const [isEditing,        setIsEditing]        = useState(false);
  const [editMsg,          setEditMsg]          = useState("");

  // ── Payslip state ─────────────────────────────────────────────────────────
  const [selectedPayEmployee, setSelectedPayEmployee] = useState<string>("");
  const [payMonth,             setPayMonth]            = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payslipData,   setPayslipData]   = useState<any>(null);
  const [generatingPay, setGeneratingPay] = useState(false);

  // ── Announcement state ────────────────────────────────────────────────────
  const [newMsg,        setNewMsg]        = useState("");
  const [sendingMsg,    setSendingMsg]    = useState(false);

  // ── Query reply state ─────────────────────────────────────────────────────
  const [replyingTo,  setReplyingTo]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // ── Search / filter state ─────────────────────────────────────────────────
  const [empSearch,    setEmpSearch]    = useState("");
  const [leaveFilter,  setLeaveFilter]  = useState<"All" | "Pending" | "Approved" | "Rejected">("All");

  // ── Notification bell ─────────────────────────────────────────────────────
  const [notifOpen,  setNotifOpen]  = useState(false);
  const unreadNotif = notifications.filter((n) => !n.read).length;

  const monthKey = `${monthlyDate.getFullYear()}-${String(monthlyDate.getMonth() + 1).padStart(2, "0")}`;

  // ── LOAD DASHBOARD ────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (selectedDate?: string) => {
    setBusy(true);
    const targetDate = selectedDate || new Date().toISOString().split("T")[0];
    const usersSnap  = await getDocs(collection(db, "users"));
    const rowsData: EmployeeRow[] = [];

    for (const u of usersSnap.docs) {
      const uid      = u.id;
      const uData    = u.data();
      const attSnap  = await getDoc(doc(db, "attendance", `${uid}_${targetDate}`));
      const sessions: Session[] = attSnap.exists() ? attSnap.data().sessions || [] : [];
      const sorted   = [...sessions].sort((a, b) => {
        const aT = a.checkIn?.toDate ? a.checkIn.toDate().getTime() : new Date(a.checkIn as any).getTime();
        const bT = b.checkIn?.toDate ? b.checkIn.toDate().getTime() : new Date(b.checkIn as any).getTime();
        return aT - bT;
      });
      const last     = sessions[sessions.length - 1];
      const isOnline = last && !last.checkOut;
      const updateSnap = await getDoc(doc(db, "dailyUpdates", `${uid}_${targetDate}`));

      rowsData.push({
        id: uid, uid,
        name: uData.name, email: uData.email, profilePhoto: uData.profilePhoto || "",
        sessions: sorted,
        morningCheckIn: sorted[0]?.checkIn ?? null,
        status: isOnline ? "ONLINE" : "OFFLINE",
        totalMinutes: calcTotalMinutes(sorted),
        task: updateSnap.exists() ? updateSnap.data().currentTask : "—",
      });
    }
    setRows(rowsData);
    setBusy(false);
  }, []);

  const loadUsers = useCallback(async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(snap.docs.map((d) => ({ id: d.id, uid: d.id, ...(d.data() as Omit<Employee, "id" | "uid">) })));
  }, []);

  const loadLeaveRequests = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "leaveRequests"), orderBy("createdAt", "desc")));
    setLeaveRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }, []);

  const loadMessages = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "messages"), orderBy("createdAt", "desc")));
    setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }, []);

  const loadMonthlyAttendance = useCallback(async () => {
    const ref  = doc(db, "monthlyAttendance", monthKey);
    const snap = await getDoc(ref);
    setMonthlyAttendance(snap.exists() ? (snap.data() as any) : {});
  }, [monthKey]);

  // ── REAL-TIME LISTENERS ───────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user) return;

    // Queries (with unread badge)
    const qUnread = query(collection(db, "employeeQueries"), where("adminUnread", "==", true));
    const unsubQueries = onSnapshot(qUnread, (snap) => setQueryUnread(snap.size));

    // All queries for HR
    const qAll = query(collection(db, "employeeQueries"), orderBy("createdAt", "desc"));
    const unsubAllQueries = onSnapshot(qAll, (snap) => {
      setQueries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    // Notifications for this HR user
    const qNotif = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubNotif = onSnapshot(qNotif, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    // Initial data loads
    loadDashboard();
    loadUsers();
    loadLeaveRequests();
    loadMessages();
    loadMonthlyAttendance();

    const interval = setInterval(loadDashboard, 60000);

    return () => {
      unsubQueries();
      unsubAllQueries();
      unsubNotif();
      clearInterval(interval);
    };
  }, [loading, user]);

  useEffect(() => { loadMonthlyAttendance(); }, [monthKey]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected", leave: LeaveRequest) => {
    await setDoc(doc(db, "leaveRequests", leaveId), { status, updatedAt: serverTimestamp() }, { merge: true });

    // Notify employee
    await addDoc(collection(db, "notifications"), {
      toUid    : leave.uid,
      title    : status === "Approved" ? "✅ Leave Approved" : "❌ Leave Rejected",
      message  : `Your ${leave.leaveType} leave from ${leave.fromDate} to ${leave.toDate} has been ${status.toLowerCase()}.`,
      read     : false,
      createdAt: serverTimestamp(),
    });

    // Decrement balance on approve
    if (status === "Approved") {
      const empRef  = doc(db, "users", leave.uid);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        const balance = empSnap.data()?.leaveBalance || {};
        const key = leave.leaveType === "Sick" ? "sick" : leave.leaveType === "Casual" ? "casual" : "annual";
        if (typeof balance[key] === "number" && balance[key] > 0) {
          await updateDoc(empRef, { [`leaveBalance.${key}`]: balance[key] - 1 });
        }
      }
    }
    await loadLeaveRequests();
  };

  const saveEmployeeEdit = async () => {
    if (!editedEmployee) return;
    setEditMsg("");
    await updateDoc(doc(db, "users", editedEmployee.id), {
      name        : editedEmployee.name,
      designation : editedEmployee.designation,
      department  : editedEmployee.department,
      salary      : editedEmployee.salary,
      updatedAt   : serverTimestamp(),
    });
    setSelectedEmployee({ ...editedEmployee });
    setIsEditing(false);
    setEditMsg("✅ Updated successfully");
    setTimeout(() => setEditMsg(""), 3000);
    await loadUsers();
  };

  const sendAnnouncement = async () => {
    if (!newMsg.trim()) return;
    setSendingMsg(true);
    await addDoc(collection(db, "messages"), { text: newMsg.trim(), createdAt: serverTimestamp() });
    setNewMsg("");
    await loadMessages();
    setSendingMsg(false);
  };

  const sendQueryReply = async (queryId: string, employeeUid: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    const batch = writeBatch(db);
    batch.update(doc(db, "employeeQueries", queryId), {
      reply       : replyText.trim(),
      status      : "resolved",
      adminUnread : false,
      repliedAt   : serverTimestamp(),
    });
    await batch.commit();

    // Notify employee
    await addDoc(collection(db, "notifications"), {
      toUid    : employeeUid,
      title    : "💬 Your query has been answered",
      message  : replyText.trim().slice(0, 120),
      read     : false,
      createdAt: serverTimestamp(),
    });

    setReplyingTo(null);
    setReplyText("");
    setSendingReply(false);
  };

  const markAllNotifRead = async () => {
    const batch = writeBatch(db);
    notifications.filter((n) => !n.read).forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const generatePayslip = async () => {
    if (!selectedPayEmployee || !payMonth) return;
    setGeneratingPay(true);
    const emp = users.find((u) => u.id === selectedPayEmployee);
    if (!emp) { setGeneratingPay(false); return; }

    // Fetch attendance for the month
    const [yr, mo] = payMonth.split("-").map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    let presentDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const attKey  = `${emp.id}_${dateStr}`;
      const attSnap = await getDoc(doc(db, "attendance", attKey));
      if (attSnap.exists() && (attSnap.data().sessions?.length ?? 0) > 0) presentDays++;
    }

    const salary      = (emp as any).salary ?? 0;
    const perDay      = salary / daysInMonth;
    const lopDays     = daysInMonth - presentDays;
    const lopDeduct   = Math.round(perDay * lopDays);
    const netSalary   = Math.max(0, salary - lopDeduct);

    setPayslipData({ emp, salary, presentDays, lopDays, lopDeduct, netSalary, payMonth, daysInMonth });
    setGeneratingPay(false);
  };

  const saveMonthlyAttendance = async (uid: string, dateStr: string, status: AttendanceType) => {
    const ref = doc(db, "monthlyAttendance", monthKey);
    await setDoc(ref, { [uid]: { [dateStr]: status }, updatedAt: serverTimestamp() }, { merge: true });
  };

  // Derived
  const sessionsByDate: Record<string, string[]> = {};
  rows.forEach((r) => {
    r.sessions.forEach((s) => {
      if (!s.checkIn) return;
      const date    = (s.checkIn as any).toDate();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const key     = `${r.uid}_${dateStr}`;
      if (!sessionsByDate[key]) sessionsByDate[key] = [];
      sessionsByDate[key].push("SESSION");
    });
  });

  const totalEmployees  = rows.length;
  const onlineCount     = rows.filter((r) => r.status === "ONLINE").length;
  const pendingLeaves   = leaveRequests.filter((l) => l.status === "Pending").length;
  const openQueries     = queries.filter((q) => q.status === "open").length;
  const avgWork         = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.totalMinutes, 0) / rows.length) : 0;

  const filteredEmployees = users.filter((u) =>
    (u.name ?? "").toLowerCase().includes(empSearch.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(empSearch.toLowerCase())
  );

  const filteredLeave = leaveRequests.filter((l) =>
    leaveFilter === "All" ? true : l.status === leaveFilter
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading HR Portal...</p>
      </div>
    </div>
  );

  if (!user) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">

      {/* ── MOBILE MENU BUTTON ── */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-teal-700 text-white rounded-xl shadow-xl transition-all duration-300 hover:scale-105"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* ── SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity" />
      )}

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className={`${sidebarCollapsed ? "lg:w-20" : "lg:w-72"} w-72 bg-[#12334f] text-white fixed inset-y-0 z-40 transform transition-all duration-300 ease-out ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} lg:translate-x-0 flex flex-col`}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between border-b border-white/10 bg-[#12334f] px-4">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">HR Portal</p>
                <p className="text-teal-300 text-xs">Human Resources</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center shadow-lg mx-auto">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem icon={<HomeIcon />}       label="Dashboard"     active={view === "dashboard"}    onClick={() => { setView("dashboard");    setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
          <NavItem icon={<LeaveIcon />}      label="Leave Requests" active={view === "leave"}       onClick={() => { setView("leave");        setSidebarOpen(false); }} collapsed={sidebarCollapsed} badge={pendingLeaves || undefined} />
          <NavItem icon={<EmployeesIcon />}  label="Employees"     active={view === "employees"}    onClick={() => { setView("employees");    setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
          <NavItem icon={<AttendanceIcon />} label="Attendance"    active={view === "attendance"}   onClick={() => { setView("attendance");   setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
          <NavItem icon={<PayslipIcon />}    label="Payslips"      active={view === "payslips"}     onClick={() => { setView("payslips");     setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
          <NavItem icon={<MegaphoneIcon />}  label="Announcements" active={view === "announcements"} onClick={() => { setView("announcements"); setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
          <NavItem icon={<QueryIcon />}      label="Queries"       active={view === "queries"}      onClick={() => { setView("queries");      setSidebarOpen(false); }} collapsed={sidebarCollapsed} badge={queryUnread || undefined} />
          <NavItem icon={<BreakIcon />}      label="Break Monitor" active={view === "breakMonitor"} onClick={() => { setView("breakMonitor"); setSidebarOpen(false); }} collapsed={sidebarCollapsed} />
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="m-4 bg-gray-500 hover:bg-red-700 py-3 px-5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group text-white"
        >
          <LogoutIcon />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </aside>

      {/* ═══════════════ MAIN ═══════════════ */}
      <div className={`${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"} flex-1 flex flex-col min-h-screen transition-all duration-300`}>

        {/* ── TOP BAR ── */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="pt-12 lg:pt-0">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 capitalize">
                  {view === "breakMonitor" ? "Break Monitor" : view === "announcements" ? "Announcements" : view.replace(/([A-Z])/g, " $1").trim()}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              <div className="flex items-center gap-4">

                {/* Notification Bell */}
                <div className="relative">
                  <button onClick={() => setNotifOpen((o) => !o)} className="relative p-2 hover:bg-slate-100 rounded-xl transition">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadNotif > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadNotif > 9 ? "9+" : unreadNotif}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl z-50">
                        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-sm">Notifications {unreadNotif > 0 && `(${unreadNotif})`}</span>
                          {unreadNotif > 0 && (
                            <button onClick={markAllNotifRead} className="text-xs text-teal-600 font-semibold hover:underline">Mark all read</button>
                          )}
                        </div>
                        {notifications.length === 0
                          ? <p className="text-center text-slate-400 text-sm py-8">No notifications</p>
                          : notifications.map((n) => (
                            <div key={n.id} className={`px-4 py-3 border-b border-slate-50 ${n.read ? "" : "bg-teal-50"}`}>
                              <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                              <p className="text-slate-500 text-xs mt-1 leading-relaxed">{n.message}</p>
                              <p className="text-slate-400 text-xs mt-1">
                                {n.createdAt?.toDate?.()?.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) ?? ""}
                              </p>
                            </div>
                          ))
                        }
                      </div>
                    </>
                  )}
                </div>

                {/* Calendar button */}
                <button onClick={() => setShowCalendar(true)} className="p-1 rounded-lg hover:bg-slate-100 transition">
                  <img src="https://cdn-icons-png.flaticon.com/512/10691/10691802.png" alt="Calendar" className="w-8 h-8 object-contain" />
                </button>

                {/* Meet */}
                <button
                  onClick={() => window.open("/meet", "_blank")}
                  className="flex items-center justify-center w-9 h-9 rounded-xl font-semibold text-white bg-[#2380de] shadow-lg hover:shadow-xl transition-all"
                >
                  <img src="https://cdn-icons-png.flaticon.com/128/8407/8407947.png" alt="Meet" className="w-5 h-5 object-contain" />
                </button>

                {/* Profile */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg">
                    {(userData as any)?.profilePhoto
                      ? <img src={(userData as any).profilePhoto} alt="HR" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-teal-700 flex items-center justify-center text-white font-bold text-sm">{user.email?.[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900">{(userData as any)?.name ?? user.email?.split("@")[0]}</p>
                    <p className="text-xs text-teal-600 font-medium">HR Manager</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ═══════════════ VIEWS ═══════════════ */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">

          {/* ────────────────── DASHBOARD ────────────────── */}
          {view === "dashboard" && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Employees" value={totalEmployees} icon="👥" color="from-teal-500 to-teal-700" />
                <StatCard title="Online Now"       value={onlineCount}   icon="🟢" color="from-emerald-500 to-green-600" />
                <StatCard title="Pending Leaves"   value={pendingLeaves} icon="📋" color="from-amber-400 to-orange-500" />
                <StatCard title="Open Queries"     value={openQueries}   icon="💬" color="from-blue-500 to-indigo-600" />
              </div>

              {/* Avg work time */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900">Average Work Time Today</h3>
                  <span className="font-bold text-teal-600 text-lg">{formatTotal(avgWork)}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-teal-700 rounded-full transition-all duration-700" style={{ width: `${Math.min((avgWork / 480) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Based on 8h target</p>
              </div>

              {/* Live employee list */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4">Today's Attendance — Live</h3>
                {busy ? (
                  <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {rows.sort((a, b) => b.totalMinutes - a.totalMinutes).map((r) => (
                      <div key={r.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl hover:bg-teal-50 transition-colors">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${r.status === "ONLINE" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {r.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                          <p className="text-xs text-slate-400 truncate">{r.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-teal-600 text-sm">{formatTotal(r.totalMinutes)}</p>
                          <p className="text-xs text-slate-400">
                            {r.morningCheckIn ? `In: ${formatTime(r.morningCheckIn)}` : "Not checked in"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leave summary */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4">Leave Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Pending",  count: leaveRequests.filter((l) => l.status === "Pending").length,  color: "bg-amber-50 text-amber-700 border-amber-100" },
                    { label: "Approved", count: leaveRequests.filter((l) => l.status === "Approved").length, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                    { label: "Rejected", count: leaveRequests.filter((l) => l.status === "Rejected").length, color: "bg-rose-50 text-rose-700 border-rose-100" },
                  ].map((s) => (
                    <div key={s.label} className={`${s.color} border rounded-xl p-4 text-center`}>
                      <p className="text-2xl font-bold">{s.count}</p>
                      <p className="text-xs font-semibold mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── LEAVE REQUESTS ────────────────── */}
          {view === "leave" && (
            <div className="space-y-4">
              {/* Filter tabs */}
              <div className="flex gap-2 flex-wrap">
                {(["All", "Pending", "Approved", "Rejected"] as const).map((f) => (
                  <button key={f} onClick={() => setLeaveFilter(f)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${leaveFilter === f ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-200 hover:border-teal-300"}`}
                  >{f}</button>
                ))}
              </div>

              {filteredLeave.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="font-semibold">No {leaveFilter.toLowerCase()} requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeave.map((leave) => (
                    <div key={leave.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{leave.userName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{leave.userEmail}</p>
                        </div>
                        <StatusBadge status={leave.status} />
                      </div>
                      <div className="flex gap-6 mt-4 flex-wrap">
                        <Detail label="Type"  value={leave.leaveType} />
                        <Detail label="From"  value={leave.fromDate} />
                        <Detail label="To"    value={leave.toDate} />
                        <Detail label="Reason" value={leave.reason} />
                      </div>
                      {leave.status === "Pending" && (
                        <div className="flex gap-3 mt-4">
                          <button onClick={() => updateLeaveStatus(leave.id, "Approved", leave)}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
                            ✓ Approve
                          </button>
                          <button onClick={() => updateLeaveStatus(leave.id, "Rejected", leave)}
                            className="px-5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-bold rounded-xl transition-colors">
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ────────────────── EMPLOYEES ────────────────── */}
          {view === "employees" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text" placeholder="Search employees..."
                  value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Employee selected detail panel */}
              {selectedEmployee ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => { setSelectedEmployee(null); setIsEditing(false); }} className="p-2 hover:bg-slate-100 rounded-xl transition">
                      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h3 className="font-bold text-slate-900 text-lg">Employee Details</h3>
                    {!isEditing && (
                      <button onClick={() => { setIsEditing(true); setEditedEmployee(selectedEmployee); }} className="ml-auto px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 text-sm font-semibold rounded-xl hover:bg-teal-100 transition">
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  {editMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">{editMsg}</div>}

                  {isEditing && editedEmployee ? (
                    <div className="space-y-4">
                      {[
                        { label: "Name",        key: "name",        type: "text" },
                        { label: "Designation", key: "designation", type: "text" },
                        { label: "Department",  key: "department",  type: "text" },
                        { label: "Salary (₹)",  key: "salary",      type: "number" },
                      ].map(({ label, key, type }) => (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
                          <input
                            type={type}
                            value={(editedEmployee as any)[key] ?? ""}
                            onChange={(e) => setEditedEmployee({ ...editedEmployee, [key]: type === "number" ? Number(e.target.value) : e.target.value } as any)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      ))}
                      <div className="flex gap-3 mt-2">
                        <button onClick={saveEmployeeEdit} className="px-6 py-2.5 bg-teal-700 text-white font-bold rounded-xl hover:bg-teal-800 transition text-sm shadow-sm">Save Changes</button>
                        <button onClick={() => { setIsEditing(false); setEditMsg(""); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Name",        value: selectedEmployee.name },
                        { label: "Email",       value: selectedEmployee.email },
                        { label: "Designation", value: (selectedEmployee as any).designation },
                        { label: "Department",  value: (selectedEmployee as any).department },
                        { label: "Account Type",value: (selectedEmployee as any).accountType },
                        { label: "Salary",      value: (selectedEmployee as any).salary ? `₹${(selectedEmployee as any).salary.toLocaleString("en-IN")}` : "—" },
                      ].map((item) => (
                        <div key={item.label} className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{item.label}</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">{item.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Today's session log for this employee */}
                  <div className="mt-6">
                    <h4 className="font-bold text-slate-900 mb-3">Today's Check-in/out Log</h4>
                    {(() => {
                      const row = rows.find((r) => r.uid === selectedEmployee.id);
                      if (!row || row.sessions.length === 0) return <p className="text-slate-400 text-sm">No sessions today</p>;
                      return (
                        <div className="space-y-2">
                          {row.sessions.map((s, i) => (
                            <div key={i} className="flex gap-6 p-3 bg-slate-50 rounded-xl text-sm">
                              <span className="text-slate-500">Session {i + 1}</span>
                              <span className="text-emerald-600 font-semibold">In: {formatTime(s.checkIn)}</span>
                              <span className="text-rose-600 font-semibold">Out: {s.checkOut ? formatTime(s.checkOut) : "Still in"}</span>
                            </div>
                          ))}
                          <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-sm font-bold text-teal-700">
                            Total: {formatTotal(row.totalMinutes)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map((emp) => {
                    const row = rows.find((r) => r.uid === emp.id);
                    return (
                      <div key={emp.id} onClick={() => setSelectedEmployee(emp)}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 hover:border-teal-300 hover:shadow-md cursor-pointer transition-all">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{emp.name}</p>
                          <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            {(emp as any).designation || "—"}
                          </span>
                          {row && (
                            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${row.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              <span className={`w-2 h-2 rounded-full ${row.status === "ONLINE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                              {row.status === "ONLINE" ? `${formatTotal(row.totalMinutes)}` : "Offline"}
                            </span>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ────────────────── ATTENDANCE ────────────────── */}
          {view === "attendance" && (
            <MonthlyReport
              db={db} users={users} monthlyDate={monthlyDate} setMonthlyDate={setMonthlyDate}
              monthlyAttendance={monthlyAttendance} setMonthlyAttendance={setMonthlyAttendance}
              sessionsByDate={sessionsByDate} isHoliday={isHoliday}
              saveMonthlyAttendance={saveMonthlyAttendance}
              getAutoStatus={({ uid, dateStr, sessionsByDate: sbd, isHolidayDay }) => {
                if (isHolidayDay) return "H";
                return sbd[`${uid}_${dateStr}`] ? "P" : "A";
              }}
              isSunday={isSunday} isSecondSaturday={isSecondSaturday}
              isFourthSaturday={isFourthSaturday} isFifthSaturday={isFifthSaturday}
            />
          )}

          {/* ────────────────── PAYSLIPS ────────────────── */}
          {view === "payslips" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4">Generate Payslip</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Employee</label>
                    <select
                      value={selectedPayEmployee} onChange={(e) => { setSelectedPayEmployee(e.target.value); setPayslipData(null); }}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select employee</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {(u as any).designation || "Employee"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Month</label>
                    <input type="month" value={payMonth} onChange={(e) => { setPayMonth(e.target.value); setPayslipData(null); }}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <button onClick={generatePayslip} disabled={generatingPay || !selectedPayEmployee}
                    className="px-6 py-2.5 bg-teal-700 text-white font-bold rounded-xl hover:bg-teal-800 transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    {generatingPay ? "Calculating..." : "Generate Payslip"}
                  </button>
                </div>
              </div>

              {payslipData && (
                <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-lg p-6 sm:p-8" id="payslip-print">
                  {/* Payslip header */}
                  <div className="flex items-start justify-between border-b-2 border-teal-100 pb-5 mb-5">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">PAYSLIP</h2>
                      <p className="text-teal-600 font-semibold mt-1">
                        {new Date(payslipData.payMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{payslipData.emp.name}</p>
                      <p className="text-sm text-slate-500">{payslipData.emp.email}</p>
                      <p className="text-sm text-slate-500">{payslipData.emp.designation || "Employee"}</p>
                    </div>
                  </div>

                  {/* Attendance summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Working Days",   value: payslipData.daysInMonth,  color: "bg-slate-50 text-slate-700" },
                      { label: "Present Days",   value: payslipData.presentDays,  color: "bg-emerald-50 text-emerald-700" },
                      { label: "LOP Days",       value: payslipData.lopDays,      color: "bg-rose-50 text-rose-700" },
                    ].map((item) => (
                      <div key={item.label} className={`${item.color} rounded-xl p-4 text-center`}>
                        <p className="text-2xl font-black">{item.value}</p>
                        <p className="text-xs font-semibold mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Salary breakdown */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                      <span className="text-slate-600">Gross Salary</span>
                      <span className="font-semibold text-slate-900">₹{payslipData.salary.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                      <span className="text-rose-600">LOP Deduction ({payslipData.lopDays} days)</span>
                      <span className="font-semibold text-rose-600">− ₹{payslipData.lopDeduct.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-teal-50 rounded-xl px-4 mt-2">
                      <span className="font-black text-teal-800">Net Salary</span>
                      <span className="font-black text-teal-800 text-xl">₹{payslipData.netSalary.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => window.print()}
                      className="flex-1 py-2.5 bg-teal-700 text-white font-bold rounded-xl hover:bg-teal-800 transition text-sm shadow-sm">
                      🖨️ Print Payslip
                    </button>
                    <button onClick={() => setPayslipData(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition text-sm">
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── ANNOUNCEMENTS ────────────────── */}
          {view === "announcements" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4">Send Announcement to All Employees</h3>
                <textarea
                  value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your announcement here..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <button onClick={sendAnnouncement} disabled={sendingMsg || !newMsg.trim()}
                  className="mt-3 px-6 py-2.5 bg-teal-700 text-white font-bold rounded-xl hover:bg-teal-800 transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {sendingMsg ? "Sending..." : "📣 Send Announcement"}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-700">Past Announcements</h3>
                {messages.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">No announcements yet.</div>
                ) : messages.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-sm text-slate-800">{m.text}</p>
                    {m.createdAt && (
                      <p className="text-xs text-slate-400 mt-2">
                        {m.createdAt?.toDate?.()?.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) ?? ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ────────────────── QUERIES ────────────────── */}
          {view === "queries" && (
            <div className="space-y-3">
              {queries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <p className="text-4xl mb-3">💬</p>
                  <p className="font-semibold">No queries from employees</p>
                </div>
              ) : queries.map((q) => (
                <div key={q.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${q.adminUnread ? "border-teal-300" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{q.userName}</p>
                      <p className="text-xs text-slate-400">{q.userEmail}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${q.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {q.status === "open" ? "Open" : "Resolved"}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 mt-3">{q.subject}</p>
                  <p className="text-sm text-slate-600 mt-1">{q.message}</p>

                  {q.reply && (
                    <div className="mt-3 p-3 bg-teal-50 border border-teal-100 rounded-xl">
                      <p className="text-xs font-semibold text-teal-600 mb-1">HR Reply:</p>
                      <p className="text-sm text-teal-800">{q.reply}</p>
                    </div>
                  )}

                  {q.status === "open" && (
                    replyingTo === q.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyText} onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          rows={2}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => sendQueryReply(q.id, q.uid)} disabled={sendingReply || !replyText.trim()}
                            className="px-5 py-2 bg-teal-700 text-white text-sm font-bold rounded-xl hover:bg-teal-800 transition disabled:opacity-50">
                            {sendingReply ? "Sending..." : "Send Reply"}
                          </button>
                          <button onClick={() => { setReplyingTo(null); setReplyText(""); }}
                            className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyingTo(q.id); setReplyText(""); }}
                        className="mt-3 px-5 py-2 bg-teal-50 text-teal-700 border border-teal-200 text-sm font-semibold rounded-xl hover:bg-teal-100 transition">
                        💬 Reply
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ────────────────── BREAK MONITOR ────────────────── */}
          {view === "breakMonitor" && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Break Monitor</h2>
                  <p className="text-sm text-slate-500">Real-time employee break tracking</p>
                </div>
              </div>
              <AdminBreakView />
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 py-4 px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
            <span>© 2026 Office Tracker · HR Portal</span>
            <span className="text-teal-600 font-medium">{(userData as any)?.name ?? user.email}</span>
          </div>
        </footer>
      </div>

      <IncomingCallListener />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
        @media print {
          body > * { display: none !important; }
          #payslip-print { display: block !important; position: fixed; inset: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active = false, onClick, badge, collapsed = false }: {
  icon: React.ReactNode; label: string; active?: boolean;
  onClick: () => void; badge?: number; collapsed?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 relative ${
        active ? "bg-teal-700/60 text-white shadow-md" : "text-slate-300 hover:bg-white/10 hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : ""}
    >
      <span className={collapsed ? "" : "shrink-0"}>{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">{badge}</span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
      )}
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl mb-3 shadow-md`}>
        {icon}
      </div>
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending : "bg-amber-100 text-amber-700 border border-amber-200",
    Approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    Rejected: "bg-rose-100 text-rose-700 border border-rose-200",
  };
  return (
    <span className={`${map[status] ?? "bg-slate-100 text-slate-600"} px-3 py-1 rounded-full text-xs font-bold`}>
      {status}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{value || "—"}</p>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────────
const HomeIcon     = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const LeaveIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const EmployeesIcon= () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const AttendanceIcon=() => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const PayslipIcon  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const MegaphoneIcon= () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
const QueryIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const BreakIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LogoutIcon   = () => <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE EXPORT — wrapped in ProtectedRoute
// ─────────────────────────────────────────────────────────────────────────────
export default function HRPage() {
  return (
    <ProtectedRoute allowedRoles={["hr", "admin", "superadmin"]}>
      <HRDashboard />
    </ProtectedRoute>
  );
}