// "use client";

// import { Component, useEffect, useState } from "react";
// import { useAuth } from "@/context/AuthContext";
// import {
//   collection,
//   doc,
//   getDoc,
//   getDocs,
//   deleteDoc,
//   addDoc,
//   setDoc,
//   serverTimestamp,
// } from "firebase/firestore";
// import { db, auth } from "@/lib/firebase";
// import { signOut } from "firebase/auth";
// import { useRouter } from "next/navigation";
// import { exportMonthlyAttendance } from "@/lib/excel/exportMonthlyAttendance";
// import ProjectManagement from "./ProjectManagement";
// /* ================= TYPES ================= */
// type Session = {
//   checkIn: any;
//   checkOut: any;
// };

// type EmployeeRow = {
//   uid: string;
//   name: string;
//   email: string;
//   sessions: Session[];
//   morningCheckIn: any | null;
//   status: "ONLINE" | "OFFLINE";
//   totalMinutes: number;
//   task: string;
// };

// type User = {
//   uid: string;
//   name: string;
//   email: string;
//   designation: string;
//   accountType: string;
// };

// type Message = {
//   id: string;
//   text: string;
// };

// type View =
//   | "dashboard"
//   | "profile"
//   | "employees"
//   | "employeeDetails"
//   | "attendance"
//   | "messages"
//   // | "dailyReport"
//   // | "weeklyReport"
//   | "monthlyReport"
//   | "leaveReport"
//   | "calendar"
//   | "Project Management";

//   const DECLARED_HOLIDAYS: Record<
//   string,
//   { title: string }
// > = {
//   "2026-01-01": { title: "New Year" },
//   "2026-01-13": { title: "Bhogi" },
//   "2026-01-14": { title: "Pongal" },
//   "2026-03-04": { title: "Holi" },
//   "2026-03-19": { title: "Ugadi" },
//   "2026-08-15": { title: "Independence Day" },
//   "2026-08-28": { title: "Raksha Bandhan" },
//   "2026-09-14": { title: "Ganesh Chaturthi" },
//   "2026-10-02": { title: "Gandhi Jayanthi" },
//   "2026-10-20": { title: "Dussehra" },
//   "2026-11-08": { title: "Diwali" },
//   "2026-12-25": { title: "Christmas" },
// };

// /* ================= HELPERS ================= */
// const formatTime = (ts: any) =>
//   ts
//     ? ts.toDate().toLocaleTimeString([], {
//         hour: "2-digit",
//         minute: "2-digit",
//       })
//     : "--";

// const formatTotal = (m: number) =>
//   `${Math.floor(m / 60)}h ${m % 60}m`;

// const calculateTotalMinutes = (sessions: Session[]) => {
//   let total = 0;
//   for (const s of sessions) {
//     if (!s.checkIn) continue;
//     const start = s.checkIn.toDate().getTime();
//     const end = s.checkOut
//       ? s.checkOut.toDate().getTime()
//       : Date.now();
//     total += Math.floor((end - start) / 60000);
//   }
//   return total;
// };



// const attendanceStyle: Record<AttendanceType, string> = {
//   P: "bg-green-100 text-green-700",
//   A: "bg-red-100 text-red-700",
//   L: "bg-yellow-100 text-yellow-700",
//   SL: "bg-blue-100 text-blue-700",
//   LOP: "bg-purple-100 text-purple-700",
//   H: "bg-gray-200 text-gray-600",
// };


// type AttendanceType = "P" | "A" | "LOP" | "SL" | "H";

// const ATTENDANCE_ORDER: AttendanceType[] = [
//   "P",
//   "A",
//   "LOP",
//   "SL",
// ];

// const nextStatus = (current: AttendanceType): AttendanceType => {
//   if (current === "H") return "H"; // holiday locked
//   const idx = ATTENDANCE_ORDER.indexOf(current);
//   return ATTENDANCE_ORDER[(idx + 1) % ATTENDANCE_ORDER.length];
// };

// const getAutoStatus = ({
//   uid,
//   dateStr,
//   sessionsByDate,
//   isHolidayDay,
// }: {
//   uid: string;
//   dateStr: string;
//   sessionsByDate: Record<string, string[]>;
//   isHolidayDay: boolean;
// }): AttendanceType => {
//   if (isHolidayDay) return "H";
//   if (sessionsByDate[`${uid}_${dateStr}`]) return "P";
//   return "A";
// };


// /* ================= COMPONENT ================= */
// export default function AdminPage() {
//   const { user, loading } = useAuth();
//   const router = useRouter();

//   const [openExcel, setOpenExcel] = useState(false);

// const [calendarDate, setCalendarDate] = useState(new Date());
// const [monthlyDate, setMonthlyDate] = useState(new Date());

//  const [monthlyAttendance, setMonthlyAttendance] = useState<
//     Record<string, Record<string, AttendanceType>>
//   >({});


  
// /* ✅ DEFINE THIS FIRST */
// const monthYear = {
//   year: monthlyDate.getFullYear(),
//   month: monthlyDate.getMonth(),
// };

// const monthKey = `${monthYear.year}-${String(
//   monthYear.month + 1
// ).padStart(2, "0")}`;

// // 🔹 LOAD MONTHLY ATTENDANCE WHEN MONTH CHANGES
// useEffect(() => {
//   const loadMonthlyAttendance = async () => {
//     const ref = doc(db, "monthlyAttendance", monthKey);
//     const snap = await getDoc(ref);

//     if (snap.exists()) {
//       setMonthlyAttendance(snap.data() as any);
//     } else {
//       setMonthlyAttendance({});
//     }
//   };

//   loadMonthlyAttendance();
// }, [monthKey]);

// /* ✅ THEN USE IT */
// const monthlyDaysInMonth = new Date(
//   monthYear.year,
//   monthYear.month + 1,
//   0
// ).getDate();

//   const [view, setView] = useState<View>("dashboard");
//   const [rows, setRows] = useState<EmployeeRow[]>([]);
//   const [users, setUsers] = useState<User[]>([]);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [busy, setBusy] = useState(true);
//   const [date, setDate] = useState(
//     new Date().toISOString().split("T")[0]
//   );

//   const [selectedEmployee, setSelectedEmployee] =
//     useState<EmployeeRow | null>(null);
//   const [selectedUser, setSelectedUser] =
//     useState<User | null>(null);

//   /* ================= LOAD DASHBOARD ================= */
//   const loadDashboard = async (selectedDate?: string) => {
//     setBusy(true);
//     const targetDate =
//       selectedDate || new Date().toISOString().split("T")[0];

//     const usersSnap = await getDocs(collection(db, "users"));
//     const rowsData: EmployeeRow[] = [];

//     for (const u of usersSnap.docs) {
//       const uid = u.id;
//       const userData = u.data();

//       const attendanceSnap = await getDoc(
//         doc(db, "attendance", `${uid}_${targetDate}`)
//       );

//       const sessions: Session[] = attendanceSnap.exists()
//         ? attendanceSnap.data().sessions || []
//         : [];

//       const morningCheckIn =
//         sessions.length > 0 ? sessions[0].checkIn : null;

//       const lastSession = sessions[sessions.length - 1];
//       const isOnline = lastSession && !lastSession.checkOut;

//       const updateSnap = await getDoc(
//         doc(db, "dailyUpdates", `${uid}_${targetDate}`)
//       );

//       rowsData.push({
//         uid,
//         name: userData.name,
//         email: userData.email,
//         sessions,
//         morningCheckIn,
//         status: isOnline ? "ONLINE" : "OFFLINE",
//         totalMinutes: calculateTotalMinutes(sessions),
//         task: updateSnap.exists()
//           ? updateSnap.data().currentTask
//           : "—",
//       });
//     }

//     setRows(rowsData);
//     setBusy(false);
//   };

//   const loadUsers = async () => {
//     const snap = await getDocs(collection(db, "users"));
//     setUsers(
//       snap.docs.map((d) => ({
//         uid: d.id,
//         ...(d.data() as any),
//       }))
//     );
//   };

//   const loadMessages = async () => {
//     const snap = await getDocs(collection(db, "messages"));
//     setMessages(
//       snap.docs.map((d) => ({
//         id: d.id,
//         text: d.data().text,
//       }))
//     );
//   };

//   useEffect(() => {
//   const loadMonthlyAttendance = async () => {
//     const ref = doc(db, "monthlyAttendance", monthKey);
//     const snap = await getDoc(ref);

//     if (snap.exists()) {
//       setMonthlyAttendance(snap.data() as any);
//     } else {
//       setMonthlyAttendance({});
//     }
//   };

//   loadMonthlyAttendance();
// }, [monthKey]);

//   useEffect(() => {
//     if (loading || !user) return;
//     loadDashboard();
//     loadUsers();
//     loadMessages();
//     const i = setInterval(loadDashboard, 60000);
//     return () => clearInterval(i);
//   }, [loading, user]);

//   /* ================= ACTIONS ================= */
//   const sendMessage = async () => {
//     if (!newMsg.trim()) return;
//     await addDoc(collection(db, "messages"), {
//       text: newMsg,
//       createdAt: serverTimestamp(),
//     });
//     setNewMsg("");
//     loadMessages();
//   };

//   const deleteUser = async (uid: string) => {
//     if (!confirm("Delete employee?")) return;
//     await deleteDoc(doc(db, "users", uid));
//     loadUsers();
//     loadDashboard();
//   };

//   const handleLogout = async () => {
//     await signOut(auth);
//     router.push("/login");
//   };

//   if (loading) return <p className="p-6">Loading...</p>;
//   if (!user) return <p className="p-6">Not logged in</p>;

//   // ✅ ALWAYS DERIVED FROM monthlyDate
// const year = monthlyDate.getFullYear();
// const month = monthlyDate.getMonth();
// const daysInMonth = new Date(year, month + 1, 0).getDate();

// //   const year = calendarDate.getFullYear();
// // const month = calendarDate.getMonth();

// const firstDay = new Date(year, month, 1).getDay();
// // const daysInMonth = new Date(year, month + 1, 0).getDate();

// const isSunday = (y: number, m: number, d: number) =>
//   new Date(y, m, d).getDay() === 0;

// const isSecondSaturday = (y: number, m: number, d: number) => {
//   const date = new Date(y, m, d);
//   return date.getDay() === 6 && Math.ceil(d / 7) === 2;
// };

// const isFourthSaturday = (y: number, m: number, d: number) => {
//   const date = new Date(y, m, d);
//   return date.getDay() === 6 && Math.ceil(d / 7) === 4;
// };

// const isFifthSaturday = (y: number, m: number, d: number) => {
//   const date = new Date(y, m, d);
//   return date.getDay() === 6 && Math.ceil(d / 7) === 5;
// };

// const isHoliday = (dateStr: string) =>
//   DECLARED_HOLIDAYS[dateStr];


// const sessionsByDate: Record<string, string[]> = {};

// rows.forEach((r) => {
//   r.sessions.forEach((s) => {
//     if (!s.checkIn) return;

//     const date = s.checkIn.toDate();
//     const dateStr = `${date.getFullYear()}-${String(
//       date.getMonth() + 1
//     ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

//     const key = `${r.uid}_${dateStr}`;

//     if (!sessionsByDate[key]) {
//       sessionsByDate[key] = [];
//     }

//     sessionsByDate[key].push("SESSION");
//   });
// });

// // 🔹 AUTO SAVE MONTHLY ATTENDANCE
//  const saveMonthlyAttendance = async (
//   uid: string,
//   dateStr: string,
//   status: AttendanceType
// ) => {
//   const ref = doc(db, "monthlyAttendance", monthKey);

//   await setDoc(
//     ref,
//     {
//       [uid]: {
//         [dateStr]: status,
//       },
//       updatedAt: serverTimestamp(),
//     },
//     { merge: true }
//   );
// };

//   /* ================= UI ================= */
//   return (
//     <div className="min-h-screen flex bg-gray-100">
//       {/* SIDEBAR */}
//       <aside className="w-64 bg-[#0b3a5a] text-white fixed inset-y-0 flex flex-col">
//         <div className="h-20 flex items-center justify-center text-xl font-semibold border-b border-white/10">
//           Office Tracker
//         </div>

//          <nav className="p-4 space-y-2 text-sm">
//           <Nav onClick={() => setView("dashboard")}>🏠 Dashboard</Nav>
//           {/* <Nav onClick={() => setView("dailyReport")}>📄 Daily Report</Nav>
//           <Nav onClick={() => setView("weeklyReport")}>📊 Weekly Report</Nav> */}
//           <Nav onClick={() => setView("monthlyReport")}>📅 Monthly Report</Nav>
//           <Nav onClick={() => setView("calendar")}>🗓 Calendar</Nav>
//           <Nav onClick={() => setView("leaveReport")}>🚫 Leaves / LOPs</Nav>
//           <Nav onClick={() => setView("Project Management")}> Project Management</Nav>
//           <Nav onClick={() => setView("employees")}>👥 Employees</Nav>
//           <Nav onClick={() => setView("messages")}>💬 Messages</Nav>
//           <Nav onClick={() => router.push("/admin/add-user")}>➕ Add User</Nav>
//         </nav>

//         <button
//           onClick={handleLogout}
//           className="mt-auto m-4 bg-red-600 py-2 rounded font-semibold"
//         >
//           Logout
//         </button>
//       </aside>

//       {/* MAIN */}
//       <div className="ml-64 flex-1 flex flex-col h-screen">
//         <main className="flex-1 overflow-y-auto p-6 space-y-6">

//           {/* DASHBOARD */}
//  {view === "dashboard" && (
//   <div className="bg-white rounded-xl shadow overflow-x-auto">
//     <table className="w-full text-sm table-fixed">
//       <thead className="bg-gray-50">
//         <tr>
//           <th className="p-3 w-[22%] text-left">Employee</th>
//           <th className="p-3 w-[10%] text-left">Status</th>
//           <th className="p-3 w-[14%] text-left">Morning</th>
//           <th className="p-3 w-[14%] text-left">Total</th>
//           <th className="p-3 w-[25%] text-left">Task</th>
//           <th className="p-3 w-[15%] text-left">Profile</th>
//         </tr>
//       </thead>
//       <tbody>
//         {!busy &&
//           rows.map((r) => (
//             <tr key={r.uid} className="border-t">
//               <td className="p-3 truncate">
//                 <b>{r.name}</b>
//                 <div className="text-xs text-gray-500 truncate">
//                   {r.email}
//                 </div>
//               </td>

//               <td className="p-3">
//                 <span
//                   className={`px-2 py-1 text-xs rounded ${
//                     r.status === "ONLINE"
//                       ? "bg-green-100 text-green-700"
//                       : "bg-gray-200 text-gray-600"
//                   }`}
//                 >
//                   {r.status}
//                 </span>
//               </td>

//               <td className="p-3">
//                 {formatTime(r.morningCheckIn)}
//               </td>

//               <td className="p-3 font-medium">
//                 {formatTotal(r.totalMinutes)}
//               </td>

//               <td className="p-3 truncate">
//                 {r.task}
//               </td>

//               <td className="p-3">
//                 <button
//                   onClick={() => {
//                     setSelectedEmployee(r);
//                     setView("profile");
//                   }}
//                   className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
//                 >
//                   View
//                 </button>
//               </td>
//             </tr>
//           ))}
//       </tbody>
//     </table>
//   </div>
// )}

// {/* ATTENDANCE */}
// {view === "attendance" && (
//   <div className="space-y-4">
//     <input
//       type="date"
//       value={date}
//       onChange={(e) => {
//         setDate(e.target.value);
//         loadDashboard(e.target.value);
//       }}
//       className="border px-3 py-2 rounded"
//     />

//     <div className="grid gap-3">
//       {rows.map((r) => (
//         <div
//           key={r.uid}
//           className="bg-white p-4 rounded shadow flex justify-between items-center"
//         >
//           <div>
//             <b>{r.name}</b>
//             <div className="text-xs text-gray-500">
//               {r.email}
//             </div>
//           </div>
//           <div className="font-medium">
//             {formatTotal(r.totalMinutes)}
//           </div>
//         </div>
//       ))}
//     </div>
//   </div>
// )}

// {/* PROFILE */}
// {view === "profile" && selectedEmployee && (
//   <div className="bg-white p-6 rounded-xl shadow max-w-3xl">
//     <button
//       onClick={() => setView("dashboard")}
//       className="text-blue-600 mb-4"
//     >
//       ← Back
//     </button>

//     <h2 className="text-2xl font-semibold">
//       {selectedEmployee.name}
//     </h2>

//     <p className="text-gray-500">
//       {selectedEmployee.email}
//     </p>

//     {/* TOTAL HOURS + STATUS */}
//     <div className="mt-2 mb-6 flex flex-wrap gap-3 items-center">
//       <span
//         className={`px-3 py-1 rounded text-sm font-medium ${
//           selectedEmployee.status === "ONLINE"
//             ? "bg-green-100 text-green-700"
//             : "bg-gray-200 text-gray-600"
//         }`}
//       >
//         {selectedEmployee.status}
//       </span>

//       <span className="px-3 py-1 rounded text-sm bg-blue-100 text-blue-700 font-medium">
//         Total Worked: {formatTotal(selectedEmployee.totalMinutes)}
//       </span>
//     </div>

//     {/* SESSIONS TABLE */}
//     <table className="w-full text-sm table-fixed border">
//       <thead className="bg-gray-50">
//         <tr>
//           <th className="p-2 w-[15%] text-left">Session</th>
//           <th className="p-2 w-[25%] text-left">Check In</th>
//           <th className="p-2 w-[25%] text-left">Check Out</th>
//           <th className="p-2 w-[35%] text-left">Duration</th>
//         </tr>
//       </thead>
//       <tbody>
//         {selectedEmployee.sessions.map((s, i) => {
//           const start = s.checkIn.toDate().getTime();
//           const end = s.checkOut
//             ? s.checkOut.toDate().getTime()
//             : Date.now();
//           const mins = Math.floor((end - start) / 60000);

//           return (
//             <tr key={i} className="border-t">
//               <td className="p-2">#{i + 1}</td>
//               <td className="p-2">{formatTime(s.checkIn)}</td>
//               <td className="p-2">
//                 {s.checkOut
//                   ? formatTime(s.checkOut)
//                   : "In progress"}
//               </td>
//               <td className="p-2 font-medium">
//                 {formatTotal(mins)}
//               </td>
//             </tr>
//           );
//         })}
//       </tbody>
//     </table>
//   </div>
// )}

//         {/* EMPLOYEES */}
// {view === "employees" && (
//   <div className="bg-white rounded-xl shadow overflow-x-auto">
//     <table className="w-full text-sm table-fixed">
//       <thead className="bg-gray-50">
//         <tr>
//           <th className="p-3 w-[20%] text-left">Name</th>
//           <th className="p-3 w-[30%] text-left">Email</th>
//           <th className="p-3 w-[20%] text-left">Designation</th>
//           <th className="p-3 w-[15%] text-left">Account</th>
//           <th className="p-3 w-[15%] text-left">Actions</th>
//         </tr>
//       </thead>

//       <tbody>
//         {users.map((u) => (
//           <tr key={u.uid} className="border-t">
//             <td className="p-3 truncate font-medium">
//               {u.name}
//             </td>

//             <td className="p-3 truncate text-gray-700">
//               {u.email}
//             </td>

//             <td className="p-3 truncate">
//               {u.designation}
//             </td>

//             <td className="p-3">
//               {u.accountType}
//             </td>

//             <td className="p-3">
//               <button
//                 onClick={() => {
//                   setSelectedUser(u);
//                   setView("employeeDetails");
//                 }}
//                 className="text-blue-600 mr-3 text-sm"
//               >
//                 View
//               </button>

//               <button
//                 onClick={() => deleteUser(u.uid)}
//                 className="text-red-600 text-sm"
//               >
//                 Delete
//               </button>
//             </td>
//           </tr>
//         ))}
//       </tbody>
//     </table>
//   </div>
// )}

//           {/* EMPLOYEE DETAILS */}
//           {view === "employeeDetails" && selectedUser && (
//             <div className="bg-white p-6 rounded-xl shadow max-w-xl">
//               <button
//                 onClick={() => setView("employees")}
//                 className="text-blue-600 mb-4"
//               >
//                 ← Back
//               </button>
//               <p><b>Name:</b> {selectedUser.name}</p>
//               <p><b>Email:</b> {selectedUser.email}</p>
//               <p><b>Designation:</b> {selectedUser.designation}</p>
//               <p><b>Account:</b> {selectedUser.accountType}</p>
//             </div>
//           )}

//           {/* MESSAGES */}
//           {view === "messages" && (
//             <div className="bg-white p-6 rounded-xl shadow max-w-xl">
//               <input
//                 value={newMsg}
//                 onChange={(e) => setNewMsg(e.target.value)}
//                 className="border px-3 py-2 w-full mb-3"
//                 placeholder="Message"
//               />
//               <button
//                 onClick={sendMessage}
//                 className="bg-black text-white px-4 py-2 rounded"
//               >
//                 Send
//               </button>

//               <ul className="mt-4 space-y-2">
//                 {messages.map((m) => (
//                   <li
//                     key={m.id}
//                     className="flex justify-between border p-2"
//                   >
//                     {m.text}
//                     <button
//                       onClick={() =>
//                         deleteDoc(doc(db, "messages", m.id))
//                       }
//                       className="text-red-600"
//                     >
//                       Delete
//                     </button>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}

//           {/* {view === "dailyReport" && (
//   <AdminPlaceholder title="Daily Report (All Employees)" />
// )} */}

// {/* {view === "weeklyReport" && (
//   <AdminPlaceholder title="Weekly Report (All Employees)" />
// )} */}


// {view === "monthlyReport" && (
//   <div className="bg-white rounded-xl shadow p-6">

//     {/* ===== MONTH HEADER ===== */}
//     <div className="flex justify-between items-center mb-4">
//       <button
//         onClick={() =>
//           setMonthlyDate(
//             (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
//           )
//         }
//         className="px-3 py-1 border rounded"
//       >
//         ◀
//       </button>

//       <h2 className="text-xl font-semibold">
//         {monthlyDate.toLocaleDateString("en-IN", {
//           month: "long",
//           year: "numeric",
//         })}
//       </h2>

//       <button
//         onClick={() =>
//           setMonthlyDate(
//             (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
//           )
//         }
//         className="px-3 py-1 border rounded"
//       >
//         ▶
//       </button>
//     </div>

//     {/* ===== TABLE ===== */}
//     <div className="overflow-x-auto">
//       <table className="border-collapse w-full text-xs">
//         <thead className="bg-gray-100 sticky top-0 z-10">
//           <tr>
//             <th className="border px-3 py-2 text-left w-48">
//               Employee
//             </th>

//             {Array.from({ length: daysInMonth }).map((_, d) => {
//               const dateObj = new Date(year, month, d + 1);
//               return (
//                 <th key={d} className="border px-1 py-1 text-center">
//                   <div className="font-semibold">{d + 1}</div>
//                   <div className="text-gray-500">
//                     {dateObj.toLocaleDateString("en-IN", {
//                       weekday: "short",
//                     })}
//                   </div>
//                 </th>
//               );
//             })}

//             <th className="border px-2">P</th>
//             <th className="border px-2">A</th>
//             <th className="border px-2">LOP</th>
//             <th className="border px-2">Salary</th>
//             <th className="border px-2">Net</th>
//           </tr>
//         </thead>

//         <tbody>
//           {users.map((u) => {
//             /* ===== PRE-CALCULATE DAY STATUSES ===== */
//             const dayStatuses: AttendanceType[] = Array.from(
//               { length: daysInMonth },
//               (_, d) => {
//                 const day = d + 1;
//                 const dateStr = `${year}-${String(month + 1).padStart(
//                   2,
//                   "0"
//                 )}-${String(day).padStart(2, "0")}`;

//                 const isHolidayDay =
//                   isSunday(year, month, day) ||
//                   isSecondSaturday(year, month, day) ||
//                   isFourthSaturday(year, month, day) ||
//                   isFifthSaturday(year, month, day) ||
//                   isHoliday(dateStr);

//                 const autoStatus = getAutoStatus({
//                   uid: u.uid,
//                   dateStr,
//                   sessionsByDate,
//                   isHolidayDay,
//                 });

//                 return isHolidayDay
//                   ? "H"
//                   : monthlyAttendance[u.uid]?.[dateStr] ?? autoStatus;
//               }
//             );

//             const presentCount = dayStatuses.filter((s) => s === "P").length;
//             const absentCount = dayStatuses.filter((s) => s === "A").length;
//             const lopCount = dayStatuses.filter((s) => s === "LOP").length;

//             const salary = u.salary ?? 0;
//             const perDay = salary / daysInMonth;
//             const netPay = Math.round(perDay * presentCount);

//             return (
//               <tr key={u.uid}>
//                 {/* EMPLOYEE */}
//                 <td className="sticky left-0 bg-white border px-3 py-2">
//                   <div className="font-medium">{u.name}</div>
//                   <div className="text-xs text-gray-500">
//                     {u.designation}
//                   </div>
//                 </td>

//                 {/* DAILY CELLS */}
//                 {dayStatuses.map((status, d) => {
//                   const day = d + 1;
//                   const dateStr = `${year}-${String(
//                     month + 1
//                   ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

//                   return (
//                     <td
//   key={d}
//   onClick={() => {
//     if (status === "H") return; // 🔒 holiday lock

//     const newStatus = nextStatus(status);

//     setMonthlyAttendance((prev) => ({
//       ...prev,
//       [u.uid]: {
//         ...(prev[u.uid] || {}),
//         [dateStr]: newStatus,
//       },
//     }));

//     // 🔥 AUTO SAVE (THIS LINE IS CRITICAL)
//     saveMonthlyAttendance(u.uid, dateStr, newStatus);
//   }}
//   className={`border h-9 text-center font-semibold ${
//     status === "H"
//       ? "cursor-not-allowed bg-gray-200 text-gray-600"
//       : "cursor-pointer"
//   } ${attendanceStyle[status]}`}
// >
//   {status}
// </td>

//                   );
//                 })}

//                 {/* SUMMARY */}
//                 <td className="border text-center">{presentCount}</td>
//                 <td className="border text-center text-red-600">
//                   {absentCount}
//                 </td>
//                 <td className="border text-center text-orange-600">
//                   {lopCount}
//                 </td>
//                 <td className="border text-center">{salary}</td>
//                 <td className="border text-center font-bold text-green-700">
//                   {netPay}
//                 </td>
//               </tr>
//             );
//           })}
//         </tbody>
//       </table>
//     </div>

//     {/* ===== EXPORT ===== */}
//     <button
//   onClick={() =>
//     exportMonthlyAttendance({
//       monthLabel: monthlyDate.toLocaleDateString("en-IN", {
//         month: "long",
//       }),
//       year,
//       month,
//       users,
//       monthlyAttendance,
//       daysInMonth,
//     })
//   }
//   className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
// >
//   ⬇ Download Excel
// </button>
// <button
//   onClick={() => setOpenExcel(true)}
//   className="mt-4 px-4 py-2 ml-6 bg-blue-600 text-white rounded"
// >
//   📊 Open Excel Sheet
// </button>

//   </div>
// )}

// {/* calendar */}
// {view === "calendar" && (
//   <div className="bg-white rounded-xl shadow p-6">
//     {/* HEADER */}
//     <div className="flex justify-between items-center mb-6">
//       <button
//         onClick={() =>
//           setCalendarDate(new Date(year, month - 1, 1))
//         }
//         className="px-3 py-1 border rounded"
//       >
//         ◀
//       </button>

//       <h2 className="text-xl font-semibold">
//         {calendarDate.toLocaleDateString("en-IN", {
//           month: "long",
//           year: "numeric",
//         })}
//       </h2>

//       <button
//         onClick={() =>
//           setCalendarDate(new Date(year, month + 1, 1))
//         }
//         className="px-3 py-1 border rounded"
//       >
//         ▶
//       </button>
//     </div>

//     {/* WEEK NAMES */}
//     <div className="grid grid-cols-7 text-center font-medium text-gray-600 mb-2">
//       {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
//         <div key={d}>{d}</div>
//       ))}
//     </div>

//     {/* GRID */}
//     <div className="grid grid-cols-7 gap-2">
//       {Array.from({ length: firstDay }).map((_, i) => (
//         <div key={`e-${i}`} />
//       ))}

//       {Array.from({ length: daysInMonth }).map((_, i) => {
//         const day = i + 1;

//         const isToday =
//   day === new Date().getDate() &&
//   month === new Date().getMonth() &&
//   year === new Date().getFullYear();


//         const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

//         const sunday = isSunday(year, month, day);
// const secondSat = isSecondSaturday(year, month, day);
// const fourthSat = isFourthSaturday(year, month, day);
// const fifthSat = isFifthSaturday(year, month, day);
// const holiday = isHoliday(dateStr);

// const isHolidayDay =
//   sunday || secondSat || fourthSat || fifthSat || holiday;


//         return (
//           <div
//             key={day}
//             className={`h-20 border rounded p-2 text-sm relative ${
//   isToday
//     ? "border-blue-500 ring-2 ring-blue-400"
//     : isHolidayDay
//     ? "bg-red-50 border-red-300"
//     : "bg-white"
// }`}

//           >
//             <div className="font-semibold">{day}</div>

//           {isHolidayDay && (
//   <div className="mt-2 text-xs text-red-600 font-medium">
//     {holiday
//       ? holiday.title
//       : sunday
//       ? "Sunday"
//       : secondSat
//       ? "2nd Saturday"
//       : fourthSat
//       ? "4th Saturday"
//       : fifthSat
//       ? "5th Saturday"
//       : ""}
//   </div>
// )}

// {isToday && (
//   <span className="absolute bottom-1 right-1 text-[10px] text-blue-600 font-semibold">
//     TODAY
//   </span>
// )}

//           </div>
//         );
//       })}
//     </div>
//   </div>
// )}


// {/* {view === "leaveReport" && (
//   <AdminPlaceholder title="Leaves & LOPs" />
// )} */}

// {view === "Project Management" && (
//   <ProjectManagement />
// )}


//         </main>

//         {/* FOOTER */}
//         <footer className="h-12 bg-white border-t flex items-center justify-center text-sm text-gray-600">
//           officetracker@gmail.com
//         </footer>
//       </div>
//       {openExcel && (
//   <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
//     <div className="bg-white w-[95%] h-[90%] rounded-xl shadow-lg flex flex-col">
//       {/* HEADER */}
//       <div className="flex justify-between items-center px-4 py-2 border-b">
//         <h2 className="text-lg font-semibold">
//           Payroll – Excel View
//         </h2>

//         <button
//           onClick={() => setOpenExcel(false)}
//           className="px-3 py-1 bg-red-500 text-white rounded"
//         >
//           ✕ Close
//         </button>
//       </div>

//       {/* BODY (Excel comes here next) */}
//      <div className="flex-1 overflow-hidden p-2">
//   <HotTable
//     data={excelData}
//     colHeaders={true}
//     rowHeaders={true}
//     width="100%"
//     height="100%"
//     stretchH="all"
//     licenseKey="non-commercial-and-evaluation"
//     afterChange={(changes, source) => {
//       if (source === "loadData" || !changes) return;

//       setExcelData((prev) => [...prev]);
//     }}
//   />
// </div>

//     </div>
//   </div>
// )}

//     </div>
//   );
// }

// /* ================= NAV ================= */
// function Nav({
//   children,
//   onClick,
// }: {
//   children: React.ReactNode;
//   onClick: () => void;
// }) {
//   return (
//     <div
//       onClick={onClick}
//       className="px-3 py-2 hover:bg-white/10 rounded cursor-pointer"
//     >
//       {children}
//     </div>
//   );
// }

// // function AdminPlaceholder({ title }: { title: string }) {
// //   return (
// //     <div className="bg-white rounded-xl shadow p-10 text-center">
// //       <h2 className="text-2xl font-semibold mb-2">{title}</h2>
// //       <p className="text-gray-500">
// //         This section will be implemented next
// //       </p>
// //     </div>
// //   );
// // }
