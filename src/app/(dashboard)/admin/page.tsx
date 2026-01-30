"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { exportMonthlyAttendance } from "@/lib/excel/exportMonthlyAttendance";
import ProjectManagement from "./ProjectManagement";
import type { AttendanceType } from "@/types/attendance";

/* ================= TYPES ================= */
type Session = {
  checkIn: any;
  checkOut: any;
};

type EmployeeRow = {
  uid: string;
  name: string;
  email: string;
  sessions: Session[];
  morningCheckIn: any | null;
  status: "ONLINE" | "OFFLINE";
  totalMinutes: number;
  task: string;
};

type User = {
  uid: string;
  name: string;
  email: string;
  designation: string;
  accountType: string;
  salary?: number;
};

type Message = {
  id: string;
  text: string;
};

type LeaveRequest = {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  leaveType: "Casual" | "Sick" | "LOP";
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: any;
};

type View =
  | "dashboard"
  | "profile"
  | "employees"
  | "employeeDetails"
  | "attendance"
  | "messages"
  | "monthlyReport"
  | "leaveReport"
  | "calendar"
  | "analytics"
  | "Project Management";

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

/* ================= HELPERS ================= */
const formatTime = (ts: any) =>
  ts
    ? ts.toDate().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

const formatTotal = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

const calculateTotalMinutes = (sessions: Session[]) => {
  let total = 0;
  for (const s of sessions) {
    if (!s.checkIn) continue;
    const start = s.checkIn.toDate().getTime();
    const end = s.checkOut ? s.checkOut.toDate().getTime() : Date.now();
    total += Math.floor((end - start) / 60000);
  }
  return total;
};

const attendanceStyle: Record<AttendanceType, string> = {
  P: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A: "bg-rose-100 text-rose-700 border-rose-200",
  L: "bg-amber-100 text-amber-700 border-amber-200",
  SL: "bg-sky-100 text-sky-700 border-sky-200",
  LOP: "bg-violet-100 text-violet-700 border-violet-200",
  H: "bg-slate-100 text-slate-600 border-slate-200",
};

const ATTENDANCE_ORDER: AttendanceType[] = ["P", "A", "LOP", "SL"];

const nextStatus = (current: AttendanceType): AttendanceType => {
  if (current === "H") return "H";
  const idx = ATTENDANCE_ORDER.indexOf(current);
  return ATTENDANCE_ORDER[(idx + 1) % ATTENDANCE_ORDER.length];
};

const getAutoStatus = ({
  uid,
  dateStr,
  sessionsByDate,
  isHolidayDay,
}: {
  uid: string;
  dateStr: string;
  sessionsByDate: Record<string, string[]>;
  isHolidayDay: boolean;
}): AttendanceType => {
  if (isHolidayDay) return "H";
  if (sessionsByDate[`${uid}_${dateStr}`]) return "P";
  return "A";
};

/* ================= COMPONENT ================= */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
 const [openExcel, setOpenExcel] = useState(false);
// const [extraCols, setExtraCols] = useState(0);
// const [extraData, setExtraData] = useState({});


const [extraCols, setExtraCols] = useState<Record<string, string[]>>({});
const [extraData, setExtraData] = useState<
  Record<string, Record<string, string>>
>({});



  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState<
    Record<string, Record<string, AttendanceType>>
  >({});

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");

  const monthYear = {
    year: monthlyDate.getFullYear(),
    month: monthlyDate.getMonth(),
  };

  const monthKey = `${monthYear.year}-${String(monthYear.month + 1).padStart(
    2,
    "0"
  )}`;

// excel data
useEffect(() => {
  const savedCols = localStorage.getItem("extraCols");
  const savedData = localStorage.getItem("extraData");

  if (savedCols) setExtraCols(JSON.parse(savedCols));
  if (savedData) setExtraData(JSON.parse(savedData));
}, []);

useEffect(() => {
  localStorage.setItem("extraCols", JSON.stringify(extraCols));
  localStorage.setItem("extraData", JSON.stringify(extraData));
}, [extraCols, extraData]);



  useEffect(() => {
    const loadMonthlyAttendance = async () => {
      const ref = doc(db, "monthlyAttendance", monthKey);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setMonthlyAttendance(snap.data() as any);
      } else {
        setMonthlyAttendance({});
      }
    };

    loadMonthlyAttendance();
  }, [monthKey]);

  const [view, setView] = useState<View>("dashboard");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [busy, setBusy] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(
    null
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  /* ================= LOAD DASHBOARD ================= */
  const loadDashboard = async (selectedDate?: string) => {
    setBusy(true);
    const targetDate = selectedDate || new Date().toISOString().split("T")[0];

    const usersSnap = await getDocs(collection(db, "users"));
    const rowsData: EmployeeRow[] = [];

    for (const u of usersSnap.docs) {
      const uid = u.id;
      const userData = u.data();

      const attendanceSnap = await getDoc(
        doc(db, "attendance", `${uid}_${targetDate}`)
      );

      const sessions: Session[] = attendanceSnap.exists()
        ? attendanceSnap.data().sessions || []
        : [];

      const morningCheckIn = sessions.length > 0 ? sessions[0].checkIn : null;

      const lastSession = sessions[sessions.length - 1];
      const isOnline = lastSession && !lastSession.checkOut;

      const updateSnap = await getDoc(
        doc(db, "dailyUpdates", `${uid}_${targetDate}`)
      );

      rowsData.push({
        uid,
        name: userData.name,
        email: userData.email,
        sessions,
        morningCheckIn,
        status: isOnline ? "ONLINE" : "OFFLINE",
        totalMinutes: calculateTotalMinutes(sessions),
        task: updateSnap.exists() ? updateSnap.data().currentTask : "—",
      });
    }

    setRows(rowsData);
    setBusy(false);
  };

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(
      snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as any),
      }))
    );
  };

  const loadMessages = async () => {
    const snap = await getDocs(collection(db, "messages"));
    setMessages(
      snap.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
      }))
    );
  };

  const loadLeaveRequests = async () => {
    const snap = await getDocs(
      query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"))
    );
    setLeaveRequests(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );
  };

  useEffect(() => {
    if (loading || !user) return;
    loadDashboard();
    loadUsers();
    loadMessages();
    loadLeaveRequests();
    const i = setInterval(loadDashboard, 60000);
    return () => clearInterval(i);
  }, [loading, user]);

  /* ================= ACTIONS ================= */
  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    await addDoc(collection(db, "messages"), {
      text: newMsg,
      createdAt: serverTimestamp(),
    });
    setNewMsg("");
    loadMessages();
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("Delete employee?")) return;
    await deleteDoc(doc(db, "users", uid));
    loadUsers();
    loadDashboard();
  };

  const updateLeaveStatus = async (
    leaveId: string,
    status: "Approved" | "Rejected"
  ) => {
    await setDoc(
      doc(db, "leaveRequests", leaveId),
      { status, updatedAt: serverTimestamp() },
      { merge: true }
    );
    loadLeaveRequests();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
       <div className="w-16 h-16 border-4 border-[#193677] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Loading dashboard...</p>
      </div>
    </div>
  );
  
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <p className="text-slate-600 font-medium">Not authenticated</p>
      </div>
    </div>
  );

  const year = monthlyDate.getFullYear();
  const month = monthlyDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const isSunday = (y: number, m: number, d: number) =>
    new Date(y, m, d).getDay() === 0;

  const isSecondSaturday = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return date.getDay() === 6 && Math.ceil(d / 7) === 2;
  };

  const isFourthSaturday = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return date.getDay() === 6 && Math.ceil(d / 7) === 4;
  };

  const isFifthSaturday = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return date.getDay() === 6 && Math.ceil(d / 7) === 5;
  };

  const isHoliday = (dateStr: string) => DECLARED_HOLIDAYS[dateStr];

  const sessionsByDate: Record<string, string[]> = {};

  rows.forEach((r) => {
    r.sessions.forEach((s) => {
      if (!s.checkIn) return;

      const date = s.checkIn.toDate();
      const dateStr = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const key = `${r.uid}_${dateStr}`;

      if (!sessionsByDate[key]) {
        sessionsByDate[key] = [];
      }

      sessionsByDate[key].push("SESSION");
    });
  });

  const saveMonthlyAttendance = async (
    uid: string,
    dateStr: string,
    status: AttendanceType
  ) => {
    const ref = doc(db, "monthlyAttendance", monthKey);

    await setDoc(
      ref,
      {
        [uid]: {
          [dateStr]: status,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  // Filter and search logic
  const filteredRows = rows.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "ALL" || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Quick stats
  const totalEmployees = rows.length;
  const onlineEmployees = rows.filter(r => r.status === "ONLINE").length;
  const offlineEmployees = rows.filter(r => r.status === "OFFLINE").length;
  const avgWorkTime = rows.length > 0 
    ? Math.round(rows.reduce((sum, r) => sum + r.totalMinutes, 0) / rows.length)
    : 0;

  const pendingLeaves = leaveRequests.filter(l => l.status === "Pending").length;

  /* ================= UI ================= */
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* MOBILE MENU BUTTON */}
     <button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#606776] text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
  aria-label="Toggle menu"
>

        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {sidebarOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity"
        />
      )}

     {/* SIDEBAR */}
<aside
  className={`w-72 bg-[#12334f] text-white fixed inset-y-0 z-40 transform transition-all duration-300 ease-out lg:transform-none ${
    sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
  } lg:translate-x-0 flex flex-col`}
>
  {/* Logo Header */}
  <div className="h-23 flex items-center justify-center border-b border-white/10 bg-[#12334f]">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#184199] flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <div>
        <h1 className="text-lg font-bold tracking-tight">Office Tracker</h1>
        <p className="text-xs text-slate-400">Admin Panel</p>
      </div>
    </div>
  </div>


        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
            label="Dashboard"
            active={view === "dashboard"}
            onClick={() => { setView("dashboard"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            label="Analytics"
            active={view === "analytics"}
            onClick={() => { setView("analytics"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Monthly Report"
            active={view === "monthlyReport"}
            onClick={() => { setView("monthlyReport"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Calendar"
            active={view === "calendar"}
            onClick={() => { setView("calendar"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            label="Leave Requests"
            badge={pendingLeaves > 0 ? pendingLeaves : undefined}
            active={view === "leaveReport"}
            onClick={() => { setView("leaveReport"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
            label="Projects"
            active={view === "Project Management"}
            onClick={() => { setView("Project Management"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            label="Employees"
            active={view === "employees"}
            onClick={() => { setView("employees"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
            label="Messages"
            active={view === "messages"}
            onClick={() => { setView("messages"); setSidebarOpen(false); }}
          />
          
          <div className="pt-4 border-t border-white/10">
            <NavItem
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
              label="Add User"
              onClick={() => { router.push("/admin/add-user"); setSidebarOpen(false); }}
            />
          </div>
        </nav>

        {/* Logout Button */}
       <button
  onClick={handleLogout}
 className="m-4 bg-gray-500 hover:bg-red-700 py-3 px-5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group text-white"
>
  <svg
    className="w-5 h-5 group-hover:rotate-12 transition-transform"
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
  Logout
</button>

      </aside>

      {/* MAIN CONTENT */}
      <div className="lg:ml-72 flex-1 flex flex-col min-h-screen">
        
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="pt-12 lg:pt-0">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 capitalize">
                  {view === "Project Management" ? "Project Management" : view.replace(/([A-Z])/g, ' $1').trim()}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-[#193677]  flex items-center justify-center text-white font-bold shadow-lg">
  {user.email?.[0]?.toUpperCase()}
</div>

                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">{user.email?.split("@")[0]}</p>
                  <p className="text-xs text-slate-500">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* DASHBOARD */}
          {view === "dashboard" && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard
                  title="Total Employees"
                  value={totalEmployees}
                  icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                  gradient="from-blue-500 to-cyan-500"
                  trend="+12%"
                />
                <StatCard
                  title="Online Now"
                  value={onlineEmployees}
                  icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  gradient="from-emerald-500 to-green-500"
                  trend={`${Math.round((onlineEmployees/totalEmployees)*100)}%`}
                />
                <StatCard
                  title="Offline"
                  value={offlineEmployees}
                  icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                  gradient="from-slate-500 to-slate-600"
                />
                <StatCard
                  title="Avg Work Time"
                  value={formatTotal(avgWorkTime)}
                  icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  gradient="from-violet-500 to-purple-500"
                />
              </div>

              {/* Search and Filter */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                   <button
  onClick={() => setFilterStatus("ALL")}
  className={`px-4 py-2 rounded-xl font-medium transition-all ${
    filterStatus === "ALL"
      ? "bg-[#4245ca38] text-black shadow-lg"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`}
>

                      All
                    </button>
                    <button
                      onClick={() => setFilterStatus("ONLINE")}
                      className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        filterStatus === "ONLINE"
                          ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Online
                    </button>
                    <button
                      onClick={() => setFilterStatus("OFFLINE")}
                      className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        filterStatus === "OFFLINE"
                          ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Offline
                    </button>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="grid grid-cols-1 gap-4 lg:hidden">
                  {!busy && filteredRows.map((r) => (
                    <div key={r.uid} className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-200 p-4 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-[#7788ac] flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                          {r.name[0]?.toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">{r.name}</h3>
                            <p className="text-xs text-slate-500 truncate">{r.email}</p>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ml-2 shadow-sm ${
                            r.status === "ONLINE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <p className="text-xs text-blue-600 font-medium mb-1">Check-in</p>
                          <p className="font-bold text-blue-900">{formatTime(r.morningCheckIn)}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                          <p className="text-xs text-purple-600 font-medium mb-1">Worked</p>
                          <p className="font-bold text-purple-900">{formatTotal(r.totalMinutes)}</p>
                        </div>
                      </div>

                      <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-600 font-medium mb-1">Current Task</p>
                        <p className="text-sm font-medium text-slate-800 line-clamp-2">{r.task}</p>
                      </div>

                      <button
  onClick={() => {
    setSelectedEmployee(r);
    setView("profile");
  }}
  className="w-full px-4 py-2.5 bg-[#5e8076] text-white rounded-xl font-semibold hover:bg-[#152b5c] transition-all shadow-md hover:shadow-lg"
>
  View Profile
</button>

                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Check-in</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Current Task</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {!busy && filteredRows.map((r, i) => (
                        <tr key={r.uid} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#cacf82] flex items-center justify-center text-white font-bold shadow-md">
                              {r.name[0]?.toUpperCase()}
                              </div>

                              <div>
                                <div className="font-semibold text-slate-900">{r.name}</div>
                                <div className="text-sm text-slate-500">{r.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                              r.status === "ONLINE"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${r.status === "ONLINE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{formatTime(r.morningCheckIn)}</td>
                          <td className="px-6 py-4 text-slate-900 font-bold">{formatTotal(r.totalMinutes)}</td>
                          <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{r.task}</td>
                          <td className="px-6 py-4">
                           <button
                            onClick={() => {
                            setSelectedEmployee(r);
                            setView("profile");
                            }}
                            className="px-4 py-2 bg-[#cdd3d5] text-black rounded-lg font-medium hover:bg-[#3a445b] transition-all shadow-sm hover:shadow-md"
                            >
                            View
                            </button>

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ANALYTICS VIEW */}
          {view === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Overview */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Attendance Overview</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-600">Present</span>
                        <span className="text-sm font-bold text-emerald-600">{onlineEmployees}/{totalEmployees}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${(onlineEmployees/totalEmployees)*100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-600">Offline</span>
                        <span className="text-sm font-bold text-slate-600">{offlineEmployees}/{totalEmployees}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-500"
                          style={{ width: `${(offlineEmployees/totalEmployees)*100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Leave Statistics */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Leave Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-2xl font-bold text-amber-600">{leaveRequests.filter(l => l.status === "Pending").length}</p>
                      <p className="text-xs font-medium text-amber-700 mt-1">Pending</p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-2xl font-bold text-emerald-600">{leaveRequests.filter(l => l.status === "Approved").length}</p>
                      <p className="text-xs font-medium text-emerald-700 mt-1">Approved</p>
                    </div>
                    <div className="text-center p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <p className="text-2xl font-bold text-rose-600">{leaveRequests.filter(l => l.status === "Rejected").length}</p>
                      <p className="text-xs font-medium text-rose-700 mt-1">Rejected</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Top Performers Today</h3>
                <div className="space-y-4">
                  {rows
                    .sort((a, b) => b.totalMinutes - a.totalMinutes)
                    .slice(0, 5)
                    .map((r, index) => (
                      <div key={r.uid} className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-transparent rounded-xl hover:from-indigo-50 transition-colors">
                        <div className="text-2xl font-bold text-slate-300 w-8">{index + 1}</div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                          {r.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{r.name}</p>
                          <p className="text-sm text-slate-500">{r.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-indigo-600">{formatTotal(r.totalMinutes)}</p>
                          <p className="text-xs text-slate-500">worked today</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Add other views here with similar modern styling... */}
          {/* For brevity, I'll show the pattern for one more view */}

          {/* EMPLOYEE PROFILE */}
          {view === "profile" && selectedEmployee && (
            <div className="max-w-5xl mx-auto">
              <button
  onClick={() => setView("dashboard")}
  className="flex items-center gap-2 text-[#4f5665] hover:text-[#225c15] font-semibold mb-6 transition-colors group"
>
  <svg
    className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
  Back to Dashboard
</button>


              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Header with gradient */}
               <div className="h-32 bg-[#193677]"></div>

                
                <div className="px-6 lg:px-8 pb-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6 -mt-16 mb-6">
                    <div className="w-32 h-32 rounded-2xl bg-[#193677] flex items-center justify-center text-white text-4xl font-bold shadow-2xl border-4 border-white">
                    {selectedEmployee.name[0]?.toUpperCase()}
                    </div>

                    <div className="flex-1 pt-16 sm:pt-20">
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        {selectedEmployee.name}
                      </h2>
                      <p className="text-slate-500 mb-4">{selectedEmployee.email}</p>

                      <div className="flex flex-wrap gap-3">
                        <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${
                          selectedEmployee.status === "ONLINE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {selectedEmployee.status}
                        </span>
                        <span className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-100 text-indigo-700 shadow-sm">
                          Total: {formatTotal(selectedEmployee.totalMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-4">Session Details</h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                        <tr>
                          <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Session</th>
                          <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Check In</th>
                          <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Check Out</th>
                          <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEmployee.sessions.map((s, i) => {
                          const start = s.checkIn.toDate().getTime();
                          const end = s.checkOut ? s.checkOut.toDate().getTime() : Date.now();
                          const mins = Math.floor((end - start) / 60000);

                          return (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 lg:px-6 py-4 font-semibold text-slate-900">Session #{i + 1}</td>
                              <td className="px-4 lg:px-6 py-4 text-slate-700">{formatTime(s.checkIn)}</td>
                              <td className="px-4 lg:px-6 py-4">
                                {s.checkOut ? (
                                  <span className="text-slate-700">{formatTime(s.checkOut)}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    In progress
                                  </span>
                                )}
                              </td>
                              <td className="px-4 lg:px-6 py-4 font-bold text-indigo-600">{formatTotal(mins)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEES VIEW */}
          {view === "employees" && (
            <>
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-4 lg:hidden">
                {users.map((u) => (
                  <div key={u.uid} className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 hover:shadow-xl transition-all">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 mb-1 truncate">{u.name}</h3>
                        <p className="text-sm text-slate-500 truncate mb-2">{u.email}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {u.designation}
                          </span>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                            {u.accountType}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {u.salary && (
                      <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <p className="text-xs text-emerald-600 font-medium mb-1">Monthly Salary</p>
                        <p className="text-xl font-bold text-emerald-700">₹{u.salary.toLocaleString()}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setView("employeeDetails");
                        }}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => deleteUser(u.uid)}
                        className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-pink-700 transition-all shadow-md"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Designation</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Account Type</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Salary</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                                {u.name[0]?.toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-900">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                              {u.designation}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                              {u.accountType}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-700">
                            {u.salary ? `₹${u.salary.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setView("employeeDetails");
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                              >
                                View
                              </button>
                              <button
                                onClick={() => deleteUser(u.uid)}
                                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg font-medium hover:from-rose-600 hover:to-pink-700 transition-all shadow-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* EMPLOYEE DETAILS */}
          {view === "employeeDetails" && selectedUser && (
            <div className="max-w-3xl mx-auto">
              <button
                onClick={() => setView("employees")}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold mb-6 transition-colors group"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Employees
              </button>
              
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>
                
                <div className="px-6 lg:px-8 pb-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6 -mt-16">
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold shadow-2xl border-4 border-white">
                      {selectedUser.name[0]?.toUpperCase()}
                    </div>
                    
                    <div className="flex-1 pt-16 sm:pt-20">
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedUser.name}</h2>
                      <p className="text-slate-500 mb-4">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <p className="text-xs font-medium text-blue-600 mb-1">Designation</p>
                      <p className="text-lg font-bold text-blue-900">{selectedUser.designation}</p>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                      <p className="text-xs font-medium text-purple-600 mb-1">Account Type</p>
                      <p className="text-lg font-bold text-purple-900">{selectedUser.accountType}</p>
                    </div>
                    
                    {selectedUser.salary && (
                      <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 sm:col-span-2">
                        <p className="text-xs font-medium text-emerald-600 mb-1">Monthly Salary</p>
                        <p className="text-2xl font-bold text-emerald-900">₹{selectedUser.salary.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {view === "messages" && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#193677] flex items-center justify-center text-white shadow-lg">

                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Broadcast Messages</h2>
                    <p className="text-sm text-slate-500">Send announcements to all employees</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-slate-900 placeholder-slate-400"
                    placeholder="Type your announcement..."
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMsg.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Send Message
                  </button>
                </div>

                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="font-medium text-slate-600">No messages yet</p>
                      <p className="text-sm text-slate-500 mt-1">Create your first broadcast message</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-4 p-4 bg-gradient-to-r from-white to-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                        </div>
                        <p className="flex-1 text-slate-700 break-words">{m.text}</p>
                        <button
                          onClick={() => {
                            if (confirm("Delete this message?")) {
                              deleteDoc(doc(db, "messages", m.id)).then(() => loadMessages());
                            }
                          }}
                          className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg font-medium hover:bg-rose-200 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

     {/* MONTHLY REPORT */}
{view === "monthlyReport" && (
  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6">

    {/* HEADER */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
        Monthly Attendance Report
      </h2>

      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            setMonthlyDate(
              (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
            )
          }
          className="px-3 py-1 border rounded hover:bg-slate-50"
        >
          ←
        </button>

        <div className="px-4 py-1 bg-indigo-600 text-white rounded font-semibold">
          {monthlyDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </div>

        <button
          onClick={() =>
            setMonthlyDate(
              (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
            )
          }
          className="px-3 py-1 border rounded hover:bg-slate-50"
        >
          →
        </button>
      </div>
    </div>

    {/* TABLE CONTAINER */}
    <div className="w-full max-h-[520px] overflow-auto border rounded-lg">
      <table className="border-collapse w-full text-[10px] sm:text-xs min-w-[1000px]">

        {/* HEADER */}
        <thead className="sticky top-0 z-30 bg-slate-100">
          <tr>
            <th className="border px-3 py-2 sticky left-0 bg-slate-200 z-40 w-44 text-left">
              Employee
            </th>

            {Array.from({ length: daysInMonth }).map((_, d) => {
              const dateObj = new Date(year, month, d + 1);
              const dayName = dateObj.toLocaleDateString("en-IN", {
                weekday: "short",
              });

              const isWeekend =
                dateObj.getDay() === 0 || dateObj.getDay() === 6;

              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(d + 1).padStart(2, "0")}`;

              const holiday = isHoliday(dateStr);

              return (
                <th
                  key={d}
                  className={`border px-2 py-1 text-center ${
                    holiday
                      ? "bg-violet-100"
                      : isWeekend
                      ? "bg-rose-100"
                      : ""
                  }`}
                >
                  <div className="font-bold">{d + 1}</div>
                  <div className="text-[10px] text-slate-600">
                    {dayName}
                  </div>
                </th>
              );
            })}

            <th className="border px-2 bg-emerald-50">P</th>
            <th className="border px-2 bg-rose-50">A</th>
            <th className="border px-2 bg-violet-50">LOP</th>
            <th className="border px-2 py-2 bg-blue-100">Total Days</th>
            <th className="border px-2 bg-green-100">Net</th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {users.map((u) => {
            const dayStatuses = Array.from(
              { length: daysInMonth },
              (_, d) => {
                const day = d + 1;
                const dateStr = `${year}-${String(
                  month + 1
                ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                const isHolidayDay =
                  isSunday(year, month, day) ||
                  isSecondSaturday(year, month, day) ||
                  isFourthSaturday(year, month, day) ||
                  isFifthSaturday(year, month, day) ||
                  !!isHoliday(dateStr);

                const autoStatus = getAutoStatus({
                  uid: u.uid,
                  dateStr,
                  sessionsByDate,
                  isHolidayDay,
                });

                return isHolidayDay
                  ? "H"
                  : monthlyAttendance[u.uid]?.[dateStr] ?? autoStatus;
              }
            );

            const presentCount = dayStatuses.filter((s) => s === "P").length;
            const absentCount = dayStatuses.filter((s) => s === "A").length;
            const lopCount = dayStatuses.filter((s) => s === "LOP").length;

            const salary = u.salary ?? 0;
            const perDay = salary / daysInMonth;
            const netPay = Math.round(perDay * presentCount);
            
            const totalWorkingDays = dayStatuses.filter(
            (s) => s !== "H"
            ).length;


            return (
              <tr key={u.uid} className="hover:bg-slate-50">

                {/* EMPLOYEE */}
                <td className="sticky left-0 bg-white border px-3 py-2 z-20">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {u.designation}
                  </div>
                </td>

                {/* DAY CELLS */}
                {dayStatuses.map((status, d) => {
                  const day = d + 1;
                  const dateStr = `${year}-${String(
                    month + 1
                  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  return (
                    <td
                      key={d}
                      onClick={() => {
                        if (status === "H") return;

                        const newStatus = nextStatus(status);

                        setMonthlyAttendance((prev) => ({
                          ...prev,
                          [u.uid]: {
                            ...(prev[u.uid] || {}),
                            [dateStr]: newStatus,
                          },
                        }));

                        saveMonthlyAttendance(
                          u.uid,
                          dateStr,
                          newStatus
                        );
                      }}
                      className={`border h-9 text-center font-bold cursor-pointer ${attendanceStyle[status]}`}
                    >
                      {status}
                    </td>
                  );
                })}

                <td className="border text-center bg-emerald-50 font-bold">
                  {presentCount}
                </td>
                <td className="border text-center bg-rose-50 font-bold">
                  {absentCount}
                </td>
                <td className="border text-center bg-violet-50 font-bold">
                  {lopCount}
                </td>
                <td className="border text-center bg-blue-50 font-bold">
  {totalWorkingDays}
</td>

                <td className="border text-center bg-green-100 font-bold text-green-700">
                  ₹{netPay}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* OPEN EXCEL BUTTON */}
    <button
      onClick={() => setOpenExcel(true)}
      className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
    >
      Open Excel View
    </button>

    {/* EXCEL MODAL */}
 {/* EXCEL MODAL */}
   {openExcel && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
    <div className="bg-white w-[98%] h-[95%] rounded-xl shadow-xl flex flex-col">

      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-lg">
          Excel Attendance – {monthlyDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => {
              const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
              setExtraCols((cols) => ({
                ...cols,
                [monthKey]: [...(cols[monthKey] || []), `Column ${(cols[monthKey] || []).length + 1}`]
              }));
            }}
            className="px-3 py-2 bg-green-600 text-white rounded"
          >
            + Column
          </button>

          <button
            onClick={() => setOpenExcel(false)}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-full text-xs min-w-[1200px]">

          <thead className="sticky top-0 bg-slate-100 z-30">
            <tr>
              <th className="border px-3 py-2 sticky left-0 bg-slate-200 z-40 w-44">
                Employee
              </th>

              {/* DAYS */}
              {Array.from({ length: daysInMonth }).map((_, d) => {
                const dateObj = new Date(year, month, d + 1);
                const dayName = dateObj.toLocaleDateString("en-IN", {
                  weekday: "short",
                });

                const isWeekend =
                  dateObj.getDay() === 0 || dateObj.getDay() === 6;

                const dateStr = `${year}-${String(month + 1).padStart(
                  2,
                  "0"
                )}-${String(d + 1).padStart(2, "0")}`;

                const holiday = isHoliday(dateStr);

                return (
                  <th
                    key={d}
                    className={`border px-2 py-1 text-center ${
                      holiday
                        ? "bg-violet-100"
                        : isWeekend
                        ? "bg-rose-100"
                        : ""
                    }`}
                  >
                    <div className="font-bold">{d + 1}</div>
                    <div className="text-[10px] text-slate-600">
                      {dayName}
                    </div>
                  </th>
                );
              })}

              <th className="border px-2 bg-emerald-50">P</th>
              <th className="border px-2 bg-rose-50">A</th>
              <th className="border px-2 bg-violet-50">LOP</th>
              <th className="border px-2 py-2 bg-blue-100">Total Days</th>
              <th className="border px-2 bg-green-100">Net</th>

              {/* EXTRA HEADERS */}
              {(() => {
                const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
                return (extraCols[monthKey] || []).map((col, i) => (
                  <th key={i} className="border px-3 py-1 bg-yellow-100">
                    <input
                      value={col}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExtraCols((cols) => ({
                          ...cols,
                          [monthKey]: (cols[monthKey] || []).map((c, idx) => (idx === i ? val : c))
                        }));
                      }}
                      className="w-full text-center outline-none bg-yellow-50"
                    />
                  </th>
                ));
              })()}
            </tr>
          </thead>

          <tbody>
            {users.map((u) => {
              const dayStatuses = Array.from(
                { length: daysInMonth },
                (_, d) => {
                  const day = d + 1;
                  const dateStr = `${year}-${String(
                    month + 1
                  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  const isHolidayDay =
                    isSunday(year, month, day) ||
                    isSecondSaturday(year, month, day) ||
                    isFourthSaturday(year, month, day) ||
                    isFifthSaturday(year, month, day) ||
                    !!isHoliday(dateStr);

                  const autoStatus = getAutoStatus({
                    uid: u.uid,
                    dateStr,
                    sessionsByDate,
                    isHolidayDay,
                  });

                  return isHolidayDay
                    ? "H"
                    : monthlyAttendance[u.uid]?.[dateStr] ?? autoStatus;
                }
              );

              const presentCount = dayStatuses.filter((s) => s === "P").length;
              const absentCount = dayStatuses.filter((s) => s === "A").length;
              const lopCount = dayStatuses.filter((s) => s === "LOP").length;

              const salary = u.salary ?? 0;
              const perDay = salary / daysInMonth;
              const netPay = Math.round(perDay * presentCount);
              
              const totalWorkingDays = dayStatuses.filter(
                (s) => s !== "H"
              ).length;

              const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

              return (
                <tr key={u.uid} className="hover:bg-slate-50">

                  {/* EMPLOYEE */}
                  <td className="sticky left-0 bg-white border px-3 py-2 z-20">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {u.designation}
                    </div>
                  </td>

                  {/* DAYS */}
                  {dayStatuses.map((status, d) => {
                    const day = d + 1;
                    const dateStr = `${year}-${String(
                      month + 1
                    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                    return (
                      <td
                        key={d}
                        onClick={() => {
                          if (status === "H") return;

                          const newStatus = nextStatus(status);

                          setMonthlyAttendance((prev) => ({
                            ...prev,
                            [u.uid]: {
                              ...(prev[u.uid] || {}),
                              [dateStr]: newStatus,
                            },
                          }));

                          saveMonthlyAttendance(
                            u.uid,
                            dateStr,
                            newStatus
                          );
                        }}
                        className={`border h-9 text-center font-bold cursor-pointer ${attendanceStyle[status]}`}
                      >
                        {status}
                      </td>
                    );
                  })}

                  <td className="border text-center bg-emerald-50 font-bold">
                    {presentCount}
                  </td>
                  <td className="border text-center bg-rose-50 font-bold">
                    {absentCount}
                  </td>
                  <td className="border text-center bg-violet-50 font-bold">
                    {lopCount}
                  </td>
                  <td className="border text-center bg-blue-50 font-bold">
                    {totalWorkingDays}
                  </td>

                  <td className="border text-center bg-green-100 font-bold text-green-700">
                    ₹{netPay}
                  </td>

                  {/* EXTRA CELLS */}
                  {(extraCols[monthKey] || []).map((_, i) => (
                    <td key={i} className="border h-9">
                      <input
                        className="w-full outline-none text-center"
                        value={extraData?.[monthKey]?.[u.uid]?.[i] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtraData((prev: any) => ({
                            ...prev,
                            [monthKey]: {
                              ...(prev[monthKey] || {}),
                              [u.uid]: {
                                ...((prev[monthKey] || {})[u.uid] || {}),
                                [i]: val,
                              },
                            },
                          }));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}

  </div>
)}


          {/* CALENDAR */}
          {view === "calendar" && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Holiday Calendar</h2>
                  <p className="text-sm text-slate-500">View holidays and weekends</p>
                </div>
                
                <div className="flex items-center gap-3">
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

                  const dateStr = `${year}-${String(month + 1).padStart(
                    2,
                    "0"
                  )}-${String(day).padStart(2, "0")}`;

                  const sunday = isSunday(year, month, day);
                  const secondSat = isSecondSaturday(year, month, day);
                  const fourthSat = isFourthSaturday(year, month, day);
                  const fifthSat = isFifthSaturday(year, month, day);
                  const holiday = isHoliday(dateStr);

                  const isHolidayDay =
                    sunday || secondSat || fourthSat || fifthSat || holiday;

                  return (
                    <div
                      key={day}
                      className={`h-20 sm:h-24 lg:h-28 border-2 rounded-xl p-2 lg:p-3 text-sm lg:text-base relative transition-all hover:shadow-lg ${
                        isToday
                          ? "border-indigo-500 ring-4 ring-indigo-200 bg-indigo-50 shadow-lg"
                          : isHolidayDay
                          ? "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-300"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className={`font-bold ${isToday ? 'text-indigo-700' : 'text-slate-900'}`}>{day}</div>

                      {isHolidayDay && (
                        <div className="mt-1 lg:mt-2 text-[10px] lg:text-xs text-rose-600 font-semibold line-clamp-2">
                          {holiday
                            ? holiday.title
                            : sunday
                            ? "Sunday"
                            : secondSat
                            ? "2nd Saturday"
                            : fourthSat
                            ? "4th Saturday"
                            : fifthSat
                            ? "5th Saturday"
                            : ""}
                        </div>
                      )}

                      {isToday && (
                        <span className="absolute bottom-1 right-1 lg:bottom-2 lg:right-2 text-[9px] lg:text-xs text-indigo-700 font-bold bg-indigo-200 px-2 py-0.5 rounded-full">
                          TODAY
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-4 lg:gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Holiday/Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-50 border-2 border-indigo-500 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg"></div>
                  <span className="text-sm font-medium text-slate-700">Regular Day</span>
                </div>
              </div>
            </div>
          )}

          {/* LEAVE REPORT */}
          {view === "leaveReport" && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
                  Leave Management
                </h2>
                <p className="text-slate-600">Review and manage employee leave requests</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-lg border-2 border-amber-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-amber-700">{leaveRequests.filter(l => l.status === "Pending").length}</p>
                      <p className="text-sm font-medium text-amber-600">Pending</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl shadow-lg border-2 border-emerald-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-emerald-700">{leaveRequests.filter(l => l.status === "Approved").length}</p>
                      <p className="text-sm font-medium text-emerald-600">Approved</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl shadow-lg border-2 border-rose-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-rose-700">{leaveRequests.filter(l => l.status === "Rejected").length}</p>
                      <p className="text-sm font-medium text-rose-600">Rejected</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {leaveRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 text-center py-16">
                    <svg className="w-20 h-20 mx-auto mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-semibold text-slate-600">No leave requests</p>
                    <p className="text-sm text-slate-500 mt-1">All caught up!</p>
                  </div>
                ) : (
                  leaveRequests.map((leave) => (
                    <div
                      key={leave.id}
                      className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all"
                    >
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                              {leave.userName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-slate-900 mb-1">
                                {leave.userName}
                              </h3>
                              <p className="text-sm text-slate-500">{leave.userEmail}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-4">
                            <span
                              className={`px-4 py-2 rounded-xl font-bold text-sm shadow-sm ${
                                leave.leaveType === "Casual"
                                  ? "bg-blue-100 text-blue-700 border-2 border-blue-200"
                                  : leave.leaveType === "Sick"
                                  ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-200"
                                  : "bg-purple-100 text-purple-700 border-2 border-purple-200"
                              }`}
                            >
                              {leave.leaveType} Leave
                            </span>

                            <span
                              className={`px-4 py-2 rounded-xl font-bold text-sm shadow-sm ${
                                leave.status === "Approved"
                                  ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-200"
                                  : leave.status === "Rejected"
                                  ? "bg-rose-100 text-rose-700 border-2 border-rose-200"
                                  : "bg-amber-100 text-amber-700 border-2 border-amber-200"
                              }`}
                            >
                              {leave.status}
                            </span>
                          </div>

                          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-xs font-medium text-slate-500">From</p>
                                <p className="font-semibold text-slate-900">
                                  {new Date(leave.fromDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-xs font-medium text-slate-500">To</p>
                                <p className="font-semibold text-slate-900">
                                  {new Date(leave.toDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-200">
                              <p className="text-xs font-medium text-slate-500 mb-2">Reason</p>
                              <p className="text-sm text-slate-800">{leave.reason}</p>
                            </div>
                          </div>
                        </div>

                        {leave.status === "Pending" && (
                          <div className="flex flex-col gap-3 lg:min-w-[160px]">
                            <button
                              onClick={() => updateLeaveStatus(leave.id, "Approved")}
                              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                            <button
                              onClick={() => updateLeaveStatus(leave.id, "Rejected")}
                              className="px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-bold hover:from-rose-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PROJECT MANAGEMENT */}
          {view === "Project Management" && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 lg:p-8">
              <ProjectManagement />
            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 py-4 px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              officetracker@gmail.com
            </span>
            <span>© 2026 Office Tracker. All rights reserved.</span>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

/* ================= COMPONENTS ================= */
function NavItem({ icon, label, active = false, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
        active
          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={active ? "text-white" : ""}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, gradient, trend }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {trend && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-slate-600 text-sm font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}