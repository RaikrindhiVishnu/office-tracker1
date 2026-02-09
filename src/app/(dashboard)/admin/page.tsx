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
// import CallCenter from "../calls/CallCenter";
// import CallButton from "@/components/CallButton";
// import CallHistory from "@/components/CallHistory";
import MeetView from "@/components/MeetView";
import IncomingCallListener from "@/components/IncomingCallListener";
import { createUserWithEmailAndPassword } from "firebase/auth";
import EmployeeDetails from "./employeedetails";
import LeaveRequests from "./leaverequests";
import MonthlyReport from "./monthlyreport";
import Dashboard from "./dashboard";
import EmployeesView from "./employees";
import CalendarView from "./calendar";
import MessagesView from "./meassages";
import MeetChatApp from "@/components/MeetChatAppUpdated";
import AccountsDashboard from "./Accounts/AccountsDashboard";
import AdminNotificationsPage from "./AdminNotificationBell";
// <CallCenter />

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
  // | "analytics"
  | "Project Management"
  | "Meet"
  | "notifications"
  | "accounts";

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
  const [showMeet, setShowMeet] = useState(false);
 const [openExcel, setOpenExcel] = useState(false);
// const [extraCols, setExtraCols] = useState(0);
// const [extraData, setExtraData] = useState({});
const [showAddUser, setShowAddUser] = useState(false);
const [showCalendar, setShowCalendar] = useState(false);
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 5; // Adjust this number as needed
// form states
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [designation, setDesignation] = useState("Developer");
const [accountType, setAccountType] = useState("EMPLOYEE");

const [msg, setMsg] = useState("");
const [creatingUser, setCreatingUser] = useState(false);

const [extraCols, setExtraCols] = useState<Record<string, string[]>>({});
const [extraData, setExtraData] = useState<
  Record<string, Record<string, string>>
>({});

const [selectedUser, setSelectedUser] = useState(null);

const [isEditing, setIsEditing] = useState(false);
const [editedUser, setEditedUser] = useState({});


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
  if (selectedUser) {
    setEditedUser(selectedUser);
  }
}, [selectedUser]);

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
const handleSaveEmployee = () => {
  // Update the user in your database/state
  // Example: updateEmployeeInFirebase(editedUser);
  setSelectedUser(editedUser);
  setIsEditing(false);
  // Show success message
  alert("Employee details updated successfully!");
};

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

const handleAddUser = async () => {
  if (!name || !email || !password) {
    setMsg("❌ Please fill all fields");
    return;
  }

  try {
    setCreatingUser(true); // ✅ correct state
    setMsg("");

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      designation,
      accountType,
      enabled: true,
      createdAt: serverTimestamp(),
    });

    setMsg("✅ User created!");

    // reset form
    setName("");
    setEmail("");
    setPassword("");
    setDesignation("Developer");
    setAccountType("EMPLOYEE");

    // reload employees instantly
    loadUsers();

    // close popup
    setTimeout(() => {
      setShowAddUser(false);
      setMsg("");
    }, 600);

  } catch (err: any) {
    setMsg(`❌ ${err.message}`);
  } finally {
    setCreatingUser(false); // ✅ correct
  }
};

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
  <div className="h-18 flex items-center justify-center border-b border-white/10 bg-[#12334f]">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#184199] flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <div>
        <h1 className="text-lg mr-15 font-bold tracking-tight">Office Tracker</h1>
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
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            label="Employees"
            active={view === "employees"}
            onClick={() => { setView("employees"); setSidebarOpen(false); }}
          />
          {/* <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            label="Analytics"
            active={view === "analytics"}
            onClick={() => { setView("analytics"); setSidebarOpen(false); }}
          /> */}
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Attendences"
            active={view === "monthlyReport"}
            onClick={() => { setView("monthlyReport"); setSidebarOpen(false); }}
          />
          {/* <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Calendar"
            active={view === "calendar"}
            onClick={() => { setView("calendar"); setSidebarOpen(false); }}
          /> */}
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            label="Leave Requests"
            badge={pendingLeaves > 0 ? pendingLeaves : undefined}
            active={view === "leaveReport"}
            onClick={() => { setView("leaveReport"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
            label="Project Management"
            active={view === "Project Management"}
            onClick={() => { setView("Project Management"); setSidebarOpen(false); }}
          />
          <NavItem
  icon={
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
      />
    </svg>
  }
  label="Notifications"
  active={view === "notifications"}
  onClick={() => {
    setView("notifications");
    setSidebarOpen(false);
  }}
/>


          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
            label="Announcements"
            active={view === "messages"}
            onClick={() => { setView("messages"); setSidebarOpen(false); }}
          />
          <NavItem
  icon={
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
        d="M12 8c-3.866 0-7 1.79-7 4v4h14v-4c0-2.21-3.134-4-7-4zm0-2a3 3 0 110-6 3 3 0 010 6z"
      />
    </svg>
  }
  label="Accounts"
  active={view === "accounts"}
  onClick={() => {
    setView("accounts");
    setSidebarOpen(false);
  }}
/>

          {/* <NavItem
  icon={
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
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-6 4h5a2 2 0 002-2V8a2 2 0 00-2-2H9a2 2 0 00-2 2v8a2 2 0 002 2zm-6-2h.01"
      />
    </svg>
  }
  label="Meet"
  active={view === "Meet"}
  onClick={() => {
    setView("Meet");
    setSidebarOpen(false);
  }}
/> */}

          {/* <div className="pt-4 border-t border-white/10">
            <NavItem
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
              label="Add User"
              onClick={() => { router.push("/admin/add-user"); setSidebarOpen(false); }}
            />
          </div> */}
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
  <div className="px-4 sm:px-6 lg:px-8 py-0">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="pt-12 lg:pt-0">
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 capitalize">
          {view === "Project Management" ? "Project Management" : view.replace(/([A-Z])/g, ' $1').trim()}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      
      <div className="flex items-center gap-4">
         <button
 onClick={() => setView("notifications")}
  className="relative p-1 rounded-sm hover:bg-slate-100 transition"
>
  <img
    src="https://cdn-icons-png.flaticon.com/512/1827/1827392.png"
    alt="Notifications"
    className="w-8 h-8 object-contain"
  />

  {/* Red Badge */}
  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
</button>
        {/* Calendar Icon */}
       
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

        {/* 🔔 Notification Bell - NEW! */}
      {/* <div className="flex items-center justify-center w-10 h-10">
   <AdminNotificationBell />
</div> */}




        {/* Meet Button */}
        <button
          onClick={() => {
            window.open("/meet", "_blank");
            setSidebarOpen(false);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-xl font-semibold text-white bg-[#2380de] shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
        >
          <div className="relative">
            <img
              src="https://cdn-icons-png.flaticon.com/128/8407/8407947.png"
              alt="Meet"
              className="w-5 h-5 object-contain"
            />
          </div>
        </button>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#193677] flex items-center justify-center text-white font-bold shadow-lg">
            {user.email?.[0]?.toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {user.email?.split("@")[0]}
            </p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
       {/*dashboard*/}
       {view === "dashboard" && (
  <Dashboard
    totalEmployees={totalEmployees}
    onlineEmployees={onlineEmployees}
    offlineEmployees={offlineEmployees}
    avgWorkTime={avgWorkTime}
    rows={filteredRows} // or your rows array
    busy={busy}
    formatTime={formatTime}
    formatTotal={formatTotal}
    setView={setView}
    setSelectedEmployee={setSelectedEmployee}
  />
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
{/* employees view */}
         <EmployeesView
  view={view}
  setView={setView}
  selectedEmployee={selectedEmployee}
  users={users}
  setSelectedUser={setSelectedUser}
  deleteUser={deleteUser}
  showAddUser={showAddUser}
  setShowAddUser={setShowAddUser}
  msg={msg}
  name={name}
  setName={setName}
  email={email}
  setEmail={setEmail}
  password={password}
  setPassword={setPassword}
  designation={designation}
  setDesignation={setDesignation}
  accountType={accountType}
  setAccountType={setAccountType}
  handleAddUser={handleAddUser}
  creatingUser={creatingUser}
  formatTime={formatTime}
  formatTotal={formatTotal}
/>

 {view === "employeeDetails" && selectedUser && (
  <EmployeeDetails
    selectedUser={selectedUser}
    setView={setView}
    setSelectedUser={setSelectedUser}
    onSave={(updatedUser) => {
      // Optional: Add any additional logic when employee is saved
      // For example, update in Firebase, refresh data, etc.
      console.log("Employee updated:", updatedUser);
    }}
  />
)}
          {/* MESSAGES */}
         <MessagesView
  view={view}
  messages={messages}
  newMsg={newMsg}
  setNewMsg={setNewMsg}
  sendMessage={sendMessage}
  loadMessages={loadMessages}
  db={db}
/>
{/* monthly report */}
     {view === "monthlyReport" && (
  <MonthlyReport
    users={users}
    monthlyDate={monthlyDate}
    setMonthlyDate={setMonthlyDate}
    monthlyAttendance={monthlyAttendance}
    setMonthlyAttendance={setMonthlyAttendance}
    sessionsByDate={sessionsByDate}
    isHoliday={isHoliday}
    saveMonthlyAttendance={saveMonthlyAttendance}
    getAutoStatus={getAutoStatus}
    isSunday={isSunday}
    isSecondSaturday={isSecondSaturday}
    isFourthSaturday={isFourthSaturday}
    isFifthSaturday={isFifthSaturday}
  />
)}
          {/* CALENDAR */}
      <CalendarView
  showCalendar={showCalendar}
  setShowCalendar={setShowCalendar}
  calendarDate={calendarDate}
  setCalendarDate={setCalendarDate}
  isSunday={isSunday}
  isSecondSaturday={isSecondSaturday}
  isFourthSaturday={isFourthSaturday}
  isFifthSaturday={isFifthSaturday}
  isHoliday={isHoliday}
/>
{/* leave report */}
    {view === "leaveReport" && (
  <LeaveRequests
    leaveRequests={leaveRequests}
    updateLeaveStatus={updateLeaveStatus}
  />
)}
          {/* PROJECT MANAGEMENT */}
          {view === "Project Management" && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 lg:p-8">
              <ProjectManagement />
            </div>
          )}
{/* MEET */}
{view === "Meet" && (
  <MeetView
    users={users.filter(u => u.uid !== user.uid)}
  />
)}
<IncomingCallListener />
<MeetChatApp 
  users={users} 
  isOpen={showMeet} 
  onClose={() => setShowMeet(false)} 
/>
{view === "accounts" && <AccountsDashboard />}
{view === "notifications" && <AdminNotificationsPage />}


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
          ? "bg-[#58576358] text-white shadow-md"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span>{icon}</span>
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
      {/* <CallHistory /> */}
    </div>
    
  );
}