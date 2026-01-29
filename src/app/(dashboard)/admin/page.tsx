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

// ✅ DEFINE TYPE FIRST
// type AttendanceType = "P" | "A" | "L" | "SL" | "LOP" | "H";

// ✅ THEN USE IT
const attendanceStyle: Record<AttendanceType, string> = {
  P: "bg-green-100 text-green-700",
  A: "bg-red-100 text-red-700",
  L: "bg-yellow-100 text-yellow-700",
  SL: "bg-blue-100 text-blue-700",
  LOP: "bg-purple-100 text-purple-700",
  H: "bg-gray-200 text-gray-600",
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [monthlyAttendance, setMonthlyAttendance] = useState<
    Record<string, Record<string, AttendanceType>>
  >({});

  const monthYear = {
    year: monthlyDate.getFullYear(),
    month: monthlyDate.getMonth(),
  };

  const monthKey = `${monthYear.year}-${String(monthYear.month + 1).padStart(
    2,
    "0"
  )}`;

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

  const monthlyDaysInMonth = new Date(
    monthYear.year,
    monthYear.month + 1,
    0
  ).getDate();

  const [view, setView] = useState<View>("dashboard");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [busy, setBusy] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

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

  if (loading) return <p className="p-6">Loading...</p>;
  if (!user) return <p className="p-6">Not logged in</p>;

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

  /* ================= UI ================= */
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* MOBILE MENU BUTTON */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#0b3a5a] text-white rounded-lg shadow-lg"
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
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* SIDEBAR OVERLAY (mobile) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`w-64 bg-[#0b3a5a] text-white fixed inset-y-0 z-40 transform transition-transform duration-300 lg:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 flex flex-col`}
      >
        <div className="h-16 lg:h-20 flex items-center justify-center text-lg lg:text-xl font-semibold border-b border-white/10">
          Office Tracker
        </div>

        <nav className="p-4 space-y-2 text-sm overflow-y-auto flex-1">
          <Nav
            onClick={() => {
              setView("dashboard");
              setSidebarOpen(false);
            }}
          >
            🏠 Dashboard
          </Nav>
          <Nav
            onClick={() => {
              setView("monthlyReport");
              setSidebarOpen(false);
            }}
          >
            📅 Monthly Report
          </Nav>
          <Nav
            onClick={() => {
              setView("calendar");
              setSidebarOpen(false);
            }}
          >
            🗓 Calendar
          </Nav>
          <Nav
            onClick={() => {
              setView("leaveReport");
              setSidebarOpen(false);
            }}
          >
            🚫 Leaves / LOPs
          </Nav>
          <Nav
            onClick={() => {
              setView("Project Management");
              setSidebarOpen(false);
            }}
          >
            📊 Project Management
          </Nav>
          <Nav
            onClick={() => {
              setView("employees");
              setSidebarOpen(false);
            }}
          >
            👥 Employees
          </Nav>
          <Nav
            onClick={() => {
              setView("messages");
              setSidebarOpen(false);
            }}
          >
            💬 Messages
          </Nav>
          <Nav
            onClick={() => {
              router.push("/admin/add-user");
              setSidebarOpen(false);
            }}
          >
            ➕ Add User
          </Nav>
        </nav>

        <button
          onClick={handleLogout}
          className="m-4 bg-red-600 py-2 rounded font-semibold hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6 pt-16 lg:pt-6">
          {/* DASHBOARD */}
          {view === "dashboard" && (
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-xs lg:text-sm min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 lg:p-3 text-left">Employee</th>
                    <th className="p-2 lg:p-3 text-left">Status</th>
                    <th className="p-2 lg:p-3 text-left">Morning</th>
                    <th className="p-2 lg:p-3 text-left">Total</th>
                    <th className="p-2 lg:p-3 text-left hidden md:table-cell">
                      Task
                    </th>
                    <th className="p-2 lg:p-3 text-left">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {!busy &&
                    rows.map((r) => (
                      <tr key={r.uid} className="border-t">
                        <td className="p-2 lg:p-3">
                          <b className="block truncate">{r.name}</b>
                          <div className="text-xs text-gray-500 truncate">
                            {r.email}
                          </div>
                        </td>

                        <td className="p-2 lg:p-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              r.status === "ONLINE"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>

                        <td className="p-2 lg:p-3">
                          {formatTime(r.morningCheckIn)}
                        </td>

                        <td className="p-2 lg:p-3 font-medium">
                          {formatTotal(r.totalMinutes)}
                        </td>

                        <td className="p-2 lg:p-3 truncate hidden md:table-cell max-w-[200px]">
                          {r.task}
                        </td>

                        <td className="p-2 lg:p-3">
                          <button
                            onClick={() => {
                              setSelectedEmployee(r);
                              setView("profile");
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PROFILE */}
          {view === "profile" && selectedEmployee && (
            <div className="bg-white p-4 lg:p-6 rounded-xl shadow max-w-4xl mx-auto">
              <button
                onClick={() => setView("dashboard")}
                className="text-blue-600 mb-4 hover:underline"
              >
                ← Back
              </button>

              <h2 className="text-xl lg:text-2xl font-semibold">
                {selectedEmployee.name}
              </h2>

              <p className="text-gray-500 text-sm lg:text-base">
                {selectedEmployee.email}
              </p>

              <div className="mt-2 mb-6 flex flex-wrap gap-3 items-center">
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedEmployee.status === "ONLINE"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {selectedEmployee.status}
                </span>

                <span className="px-3 py-1 rounded text-sm bg-blue-100 text-blue-700 font-medium">
                  Total Worked: {formatTotal(selectedEmployee.totalMinutes)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs lg:text-sm border min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Session</th>
                      <th className="p-2 text-left">Check In</th>
                      <th className="p-2 text-left">Check Out</th>
                      <th className="p-2 text-left">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.sessions.map((s, i) => {
                      const start = s.checkIn.toDate().getTime();
                      const end = s.checkOut
                        ? s.checkOut.toDate().getTime()
                        : Date.now();
                      const mins = Math.floor((end - start) / 60000);

                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">#{i + 1}</td>
                          <td className="p-2">{formatTime(s.checkIn)}</td>
                          <td className="p-2">
                            {s.checkOut ? formatTime(s.checkOut) : "In progress"}
                          </td>
                          <td className="p-2 font-medium">
                            {formatTotal(mins)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EMPLOYEES */}
          {view === "employees" && (
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-xs lg:text-sm min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 lg:p-3 text-left">Name</th>
                    <th className="p-2 lg:p-3 text-left hidden md:table-cell">
                      Email
                    </th>
                    <th className="p-2 lg:p-3 text-left">Designation</th>
                    <th className="p-2 lg:p-3 text-left hidden lg:table-cell">
                      Account
                    </th>
                    <th className="p-2 lg:p-3 text-left">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-t">
                      <td className="p-2 lg:p-3 font-medium">{u.name}</td>

                      <td className="p-2 lg:p-3 text-gray-700 hidden md:table-cell truncate">
                        {u.email}
                      </td>

                      <td className="p-2 lg:p-3">{u.designation}</td>

                      <td className="p-2 lg:p-3 hidden lg:table-cell">
                        {u.accountType}
                      </td>

                      <td className="p-2 lg:p-3 space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setView("employeeDetails");
                          }}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          View
                        </button>

                        <button
                          onClick={() => deleteUser(u.uid)}
                          className="text-red-600 text-sm hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* EMPLOYEE DETAILS */}
          {view === "employeeDetails" && selectedUser && (
            <div className="bg-white p-4 lg:p-6 rounded-xl shadow max-w-xl mx-auto">
              <button
                onClick={() => setView("employees")}
                className="text-blue-600 mb-4 hover:underline"
              >
                ← Back
              </button>
              <div className="space-y-2 text-sm lg:text-base">
                <p>
                  <b>Name:</b> {selectedUser.name}
                </p>
                <p>
                  <b>Email:</b> {selectedUser.email}
                </p>
                <p>
                  <b>Designation:</b> {selectedUser.designation}
                </p>
                <p>
                  <b>Account:</b> {selectedUser.accountType}
                </p>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {view === "messages" && (
            <div className="bg-white p-4 lg:p-6 rounded-xl shadow max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  className="border px-3 py-2 rounded flex-1 text-sm lg:text-base"
                  placeholder="Type your message..."
                />
                <button
                  onClick={sendMessage}
                  className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 whitespace-nowrap"
                >
                  Send
                </button>
              </div>

              <ul className="space-y-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center border p-3 rounded gap-2"
                  >
                    <span className="text-sm lg:text-base break-words flex-1">
                      {m.text}
                    </span>
                    <button
                      onClick={() => deleteDoc(doc(db, "messages", m.id))}
                      className="text-red-600 text-sm hover:underline whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MONTHLY REPORT */}
          {view === "monthlyReport" && (
            <div className="bg-white rounded-xl shadow p-4 lg:p-6">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() =>
                    setMonthlyDate(
                      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                    )
                  }
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  ◀
                </button>

                <h2 className="text-lg lg:text-xl font-semibold text-center">
                  {monthlyDate.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>

                <button
                  onClick={() =>
                    setMonthlyDate(
                      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                    )
                  }
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  ▶
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="border-collapse w-full text-[10px] lg:text-xs min-w-[800px]">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="border px-2 py-2 text-left w-32 lg:w-48 sticky left-0 bg-gray-100">
                        Employee
                      </th>

                      {Array.from({ length: daysInMonth }).map((_, d) => {
                        const dateObj = new Date(year, month, d + 1);
                        return (
                          <th
                            key={d}
                            className="border px-1 py-1 text-center min-w-[30px]"
                          >
                            <div className="font-semibold">{d + 1}</div>
                            <div className="text-gray-500 hidden lg:block">
                              {dateObj.toLocaleDateString("en-IN", {
                                weekday: "short",
                              })}
                            </div>
                          </th>
                        );
                      })}

                      <th className="border px-2">P</th>
                      <th className="border px-2">A</th>
                      <th className="border px-2">LOP</th>
                      <th className="border px-2 hidden lg:table-cell">
                        Salary
                      </th>
                      <th className="border px-2">Net</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((u) => {
                      const dayStatuses: AttendanceType[] = Array.from(
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

                      const presentCount = dayStatuses.filter(
                        (s) => s === "P"
                      ).length;
                      const absentCount = dayStatuses.filter(
                        (s) => s === "A"
                      ).length;
                      const lopCount = dayStatuses.filter(
                        (s) => s === "LOP"
                      ).length;

                      const salary = u.salary ?? 0;
                      const perDay = salary / daysInMonth;
                      const netPay = Math.round(perDay * presentCount);

                      return (
                        <tr key={u.uid}>
                          <td className="sticky left-0 bg-white border px-2 py-2">
                            <div className="font-medium text-xs">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-gray-500 hidden lg:block">
                              {u.designation}
                            </div>
                          </td>

                          {dayStatuses.map((status, d) => {
                            const day = d + 1;
                            const dateStr = `${year}-${String(
                              month + 1
                            ).padStart(2, "0")}-${String(day).padStart(
                              2,
                              "0"
                            )}`;

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
                                className={`border h-8 text-center font-semibold cursor-pointer ${
                                  status === "H"
                                    ? "cursor-not-allowed"
                                    : ""
                                } ${attendanceStyle[status]}`}
                              >
                                {status}
                              </td>
                            );
                          })}

                          <td className="border text-center">{presentCount}</td>
                          <td className="border text-center text-red-600">
                            {absentCount}
                          </td>
                          <td className="border text-center text-orange-600">
                            {lopCount}
                          </td>
                          <td className="border text-center hidden lg:table-cell">
                            {salary}
                          </td>
                          <td className="border text-center font-bold text-green-700">
                            {netPay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() =>
                  exportMonthlyAttendance({
                    monthLabel: monthlyDate.toLocaleDateString("en-IN", {
                      month: "long",
                    }),
                    year,
                    month,
                    users,
                    monthlyAttendance,
                    daysInMonth,
                  })
                }
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm lg:text-base"
              >
                ⬇ Download Excel
              </button>
            </div>
          )}

          {/* CALENDAR */}
          {view === "calendar" && (
            <div className="bg-white rounded-xl shadow p-4 lg:p-6">
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  ◀
                </button>

                <h2 className="text-lg lg:text-xl font-semibold">
                  {calendarDate.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>

                <button
                  onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                  className="px-3 py-1 border rounded hover:bg-gray-50"
                >
                  ▶
                </button>
              </div>

              <div className="grid grid-cols-7 text-center font-medium text-gray-600 mb-2 text-xs lg:text-sm">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 lg:gap-2">
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
                      className={`h-16 lg:h-20 border rounded p-1 lg:p-2 text-xs lg:text-sm relative ${
                        isToday
                          ? "border-blue-500 ring-2 ring-blue-400"
                          : isHolidayDay
                          ? "bg-red-50 border-red-300"
                          : "bg-white"
                      }`}
                    >
                      <div className="font-semibold">{day}</div>

                      {isHolidayDay && (
                        <div className="mt-1 text-[10px] lg:text-xs text-red-600 font-medium truncate">
                          {holiday
                            ? holiday.title
                            : sunday
                            ? "Sunday"
                            : secondSat
                            ? "2nd Sat"
                            : fourthSat
                            ? "4th Sat"
                            : fifthSat
                            ? "5th Sat"
                            : ""}
                        </div>
                      )}

                      {isToday && (
                        <span className="absolute bottom-1 right-1 text-[8px] lg:text-[10px] text-blue-600 font-semibold">
                          TODAY
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEAVE REPORT */}
          {view === "leaveReport" && (
            <div className="bg-white rounded-xl shadow p-4 lg:p-6">
              <h2 className="text-xl lg:text-2xl font-semibold mb-6">
                Leave Requests & LOPs
              </h2>

              <div className="space-y-4">
                {leaveRequests.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No leave requests found
                  </p>
                )}

                {leaveRequests.map((leave) => (
                  <div
                    key={leave.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {leave.userName}
                        </h3>
                        <p className="text-sm text-gray-600">{leave.userEmail}</p>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-3 py-1 rounded-full font-medium ${
                                leave.leaveType === "Casual"
                                  ? "bg-blue-100 text-blue-700"
                                  : leave.leaveType === "Sick"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {leave.leaveType} Leave
                            </span>

                            <span
                              className={`px-3 py-1 rounded-full font-medium ${
                                leave.status === "Approved"
                                  ? "bg-green-100 text-green-700"
                                  : leave.status === "Rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {leave.status}
                            </span>
                          </div>

                          <p>
                            <span className="font-medium">From:</span>{" "}
                            {new Date(leave.fromDate).toLocaleDateString()}
                          </p>
                          <p>
                            <span className="font-medium">To:</span>{" "}
                            {new Date(leave.toDate).toLocaleDateString()}
                          </p>
                          <p>
                            <span className="font-medium">Reason:</span>{" "}
                            {leave.reason}
                          </p>
                        </div>
                      </div>

                      {leave.status === "Pending" && (
                        <div className="flex gap-2 lg:flex-col">
                          <button
                            onClick={() =>
                              updateLeaveStatus(leave.id, "Approved")
                            }
                            className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() =>
                              updateLeaveStatus(leave.id, "Rejected")
                            }
                            className="flex-1 lg:flex-none px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROJECT MANAGEMENT */}
          {view === "Project Management" && <ProjectManagement />}
        </main>

        {/* FOOTER */}
        <footer className="h-12 bg-white border-t flex items-center justify-center text-xs lg:text-sm text-gray-600">
          officetracker@gmail.com
        </footer>
      </div>
    </div>
  );
}

/* ================= NAV ================= */
function Nav({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-3 py-2 hover:bg-white/10 rounded cursor-pointer transition-colors"
    >
      {children}
    </div>
  );
}