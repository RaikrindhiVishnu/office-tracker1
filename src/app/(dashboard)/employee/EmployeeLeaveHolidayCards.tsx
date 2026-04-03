// // ─── EMPLOYEE + LEAVE + HOLIDAY STACK CARDS ──────────────────────────────────
// "use client";

// import { useState, useEffect, useCallback } from "react";
// import {
//   collection, query, where, onSnapshot,
//   getDocs, orderBy, doc, updateDoc, increment,
// } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import LeaveRequestView from "@/app/(dashboard)/employee/views/LeaveRequestView";
// import { LeaveType } from "@/types/leave";

// const CANONICAL_HOLIDAYS: any[] = [];

// // ─── EMPLOYEE + LEAVE + HOLIDAY STACK CARDS ──────────────────────────────────
// function EmployeeLeaveHolidayCards({ user }: { user: any }) {
//   const [profile,   setProfile]   = useState<any>(null);
//   const [leaveData, setLeaveData] = useState<any>(null);
//   const [leaveDocId,setLeaveDocId]= useState<string|null>(null);
//   const [holidays,  setHolidays]  = useState<any[]>([]);
//   const [loading,   setLoading]   = useState(true);

//   // ── Modal state ──
//   const [modalOpen,   setModalOpen]   = useState(false);
//   const [leaveType,   setLeaveType]   = useState("Casual");
//   const [fromDate,    setFromDate]    = useState("");
//   const [toDate,      setToDate]      = useState("");
//   const [leaveReason, setLeaveReason] = useState("");
//   const [submitting,  setSubmitting]  = useState(false);
//   const [leaveMsg,    setLeaveMsg]    = useState("");

//   useEffect(() => {
//     if (!user?.uid) return;

//     const unsubUser = onSnapshot(
//       query(collection(db, "users"), where("uid", "==", user.uid)),
//       (snap) => { if (!snap.empty) setProfile(snap.docs[0].data()); }
//     );

//     const unsubLeave = onSnapshot(
//       query(collection(db, "leaveBalances"), where("uid", "==", user.uid)),
//       (snap) => {
//         if (!snap.empty) {
//           setLeaveData(snap.docs[0].data());
//           setLeaveDocId(snap.docs[0].id);
//         }
//       }
//     );

//     getDocs(query(collection(db, "holidays"), orderBy("date", "asc")))
//       .then((snap) => {
//         setHolidays(
//           !snap.empty
//             ? snap.docs.map((d) => ({ id: d.id, ...d.data() }))
//             : CANONICAL_HOLIDAYS
//         );
//       })
//       .catch(() => setHolidays(CANONICAL_HOLIDAYS))
//       .finally(() => setLoading(false));

//     return () => { unsubUser(); unsubLeave(); };
//   }, [user]);

//   // ── Submit leave to Firestore ──
//   const handleSubmitLeave = async () => {
//     if (!fromDate || !toDate || !leaveReason.trim()) {
//       setLeaveMsg("Please fill all fields.");
//       return;
//     }

//     const days = Math.ceil(
//       (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000
//     ) + 1;

//     // Check balance
//     const fieldMap: Record<string, string> = { Sick: "sick", Casual: "casual" };
//     const field = fieldMap[leaveType];
//     if (field && leaveDocId) {
//       const remaining = (leaveData?.[field]?.quota ?? 12) - (leaveData?.[field]?.used ?? 0);
//       if (days > remaining) {
//         setLeaveMsg(`Only ${remaining} ${leaveType} leave(s) remaining.`);
//         return;
//       }
//     }

//     setSubmitting(true);
//     setLeaveMsg("");
//     try {
//       await addDoc(collection(db, "leaveRequests"), {
//         uid: user.uid,
//         leaveType,
//         fromDate,
//         toDate,
//         days,
//         reason: leaveReason,
//         status: "Pending",
//         createdAt: serverTimestamp(),
//       });

//       // Update used count in leaveBalances
//       if (field && leaveDocId) {
//         const { increment } = await import("firebase/firestore");
//         await updateDoc(doc(db, "leaveBalances", leaveDocId), {
//           [`${field}.used`]: increment(days),
//         });
//       }

//       setLeaveMsg("✅ Request submitted");
//       setFromDate(""); setToDate(""); setLeaveReason("");
//     } catch (e) {
//       setLeaveMsg("❌ Submission failed. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const initials = (name: string) =>
//     (name ?? "").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

//   const leaveRows = [
//     {
//       label:    "Sick Leaves",
//       quota:    leaveData?.sick?.quota   ?? 12,
//       used:     leaveData?.sick?.used    ?? 0,
//       color:    "#6366f1",
//       typeKey:  "Sick",
//     },
//     {
//       label:    "Casual Leaves",
//       quota:    leaveData?.casual?.quota ?? 12,
//       used:     leaveData?.casual?.used  ?? 0,
//       color:    "#f59e0b",
//       typeKey:  "Casual",
//     },
//   ];

//   const todayMs = new Date().setHours(0, 0, 0, 0);
//   const upcomingHolidays = holidays
//     .filter((h) => new Date(h.date).getTime() >= todayMs)
//     .slice(0, 10);
//   const pastHolidays = holidays
//     .filter((h) => new Date(h.date).getTime() < todayMs)
//     .slice(-4).reverse();

//   const typeColor: Record<string, string> = {
//     National: "#6366f1", Festival: "#f59e0b", Optional: "#06b6d4",
//   };

//   if (loading) {
//     return (
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
//         {[0, 1].map((i) => (
//           <div key={i} className="dash-card p-5 animate-pulse">
//             <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
//             <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
//             <div className="h-3 bg-gray-100 rounded w-2/3" />
//           </div>
//         ))}
//       </div>
//     );
//   }

//   return (
//     <>
//       {/* ══════════════ APPLY LEAVE MODAL ══════════════ */}
//       {modalOpen && (
//         <Modal onClose={() => setModalOpen(false)} wide>
//           <ApplyLeaveModal
//             leaveType={leaveType}
//             setLeaveType={setLeaveType}
//             fromDate={fromDate}
//             setFromDate={setFromDate}
//             toDate={toDate}
//             setToDate={setToDate}
//             leaveReason={leaveReason}
//             setLeaveReason={setLeaveReason}
//             handleSubmitLeave={handleSubmitLeave}
//             submitting={submitting}
//             leaveMsg={leaveMsg}
//             onClose={() => setModalOpen(false)}
//           />
//         </Modal>
//       )}

//       {/* ══════════════ STACK CARDS ══════════════ */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

//         {/* ── Card 1: Employee Details + Leave Status ── */}
//         <div className="dash-card p-5 flex flex-col gap-4">

//           {/* Profile */}
//           <div className="flex items-center gap-3">
//             {profile?.profilePhoto ? (
//               <img
//                 src={profile.profilePhoto}
//                 alt={profile?.name}
//                 className="w-14 h-14 rounded-xl object-cover shrink-0"
//                 style={{ border: "2px solid #e0e7ff" }}
//               />
//             ) : (
//               <div
//                 className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
//                 style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
//               >
//                 {initials(profile?.name ?? profile?.displayName ?? user?.displayName ?? "?")}
//               </div>
//             )}
//             <div className="min-w-0">
//               <p className="font-black text-gray-900 text-base truncate">
//                 {profile?.name ?? profile?.displayName ?? user?.displayName ?? "Employee"}
//               </p>
//               <p className="text-xs text-gray-400 mt-0.5 font-semibold truncate">
//                 {profile?.employeeId ?? profile?.empId ?? "—"} ·{" "}
//                 {profile?.employmentType ?? profile?.empType ?? "Full Time"}
//               </p>
//               <p className="text-sm font-bold mt-0.5 truncate" style={{ color: "#6366f1" }}>
//                 {profile?.designation ?? profile?.role ?? "Employee"}
//               </p>
//             </div>
//           </div>

//           {/* Employee Information */}
//           <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
//             <h1
//               style={{
//                 fontFamily: "inherit", fontSize: "14px", fontWeight: 800,
//                 color: "#1e1b4b", letterSpacing: "-0.01em", marginBottom: "6px",
//               }}
//             >
//               Employee Information
//             </h1>
//             {[
//               { label: "Mobile",  value: profile?.phone ?? profile?.mobile ?? "—" },
//               { label: "Email",   value: profile?.email ?? user?.email ?? "—" },
//               { label: "Address", value: profile?.address ?? profile?.workLocation ?? "—" },
//             ].map(({ label, value }) => (
//               <div key={label} className="flex gap-2">
//                 <span className="text-gray-400 shrink-0 font-semibold" style={{ minWidth: 60, fontSize: 12.5 }}>
//                   {label}
//                 </span>
//                 <span className="text-gray-700 truncate font-medium" style={{ fontSize: 12.5 }}>
//                   {value}
//                 </span>
//               </div>
//             ))}
//           </div>

//           {/* Leave Status */}
//           <div className="flex flex-col gap-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>

//             {/* Header: label + Apply Leave button */}
//             <div className="flex items-center justify-between">
//               <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>
//                 Leave Status
//               </p>
//               {/* ✅ THIS IS THE BUTTON — onClick sets modalOpen true */}
//               <button
//                 onClick={() => { setLeaveMsg(""); setModalOpen(true); }}
//                 style={{
//                   background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
//                   color: "#fff", border: "none", borderRadius: 8,
//                   padding: "5px 14px", fontSize: 11, fontWeight: 700,
//                   fontFamily: "inherit", cursor: "pointer",
//                   letterSpacing: "0.02em",
//                   boxShadow: "0 2px 8px rgba(99,102,241,0.28)",
//                 }}
//               >
//                 Apply Leave
//               </button>
//             </div>

//             {/* Leave rows */}
//             {leaveRows.map(({ label, quota, used, color, typeKey }) => {
//               const balance   = quota - used;
//               const pct       = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
//               const completed = balance <= 0;
//               const leftColor = completed ? "#ef4444" : balance <= 3 ? "#f59e0b" : "#10b981";
//               const barColor  = pct >= 100 ? "#ef4444" : pct > 75 ? "#f59e0b" : color;

//               return (
//                 <div key={label}>
//                   <div className="flex justify-between items-center mb-1">
//                     <div className="flex items-center gap-2">
//                       <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
//                       {completed && (
//                         <span style={{ fontSize: 9, fontWeight: 800, background: "#fee2e2", color: "#ef4444", padding: "1px 7px", borderRadius: 99 }}>
//                           Completed
//                         </span>
//                       )}
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
//                         Total <strong style={{ color: "#374151", fontWeight: 700 }}>{quota}</strong>
//                       </span>
//                       <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
//                         Used <strong style={{ color: "#374151", fontWeight: 700 }}>{used}</strong>
//                       </span>
//                       <span style={{ fontSize: 12, fontWeight: 800, color: leftColor }}>Left {balance}</span>
//                       {/* Per-type quick apply button */}
//                       <button
//                         disabled={completed}
//                         onClick={() => {
//                           if (!completed) {
//                             setLeaveType(typeKey);
//                             setLeaveMsg("");
//                             setModalOpen(true);
//                           }
//                         }}
//                         style={{
//                           fontSize: 10, fontWeight: 700,
//                           padding: "3px 9px", borderRadius: 6,
//                           border: "none", cursor: completed ? "not-allowed" : "pointer",
//                           fontFamily: "inherit",
//                           background: completed ? "#f3f4f6" : color + "18",
//                           color:      completed ? "#d1d5db" : color,
//                           opacity:    completed ? 0.6 : 1,
//                         }}
//                       >
//                         {completed ? "Exhausted" : "Apply"}
//                       </button>
//                     </div>
//                   </div>
//                   <div className="rounded-full overflow-hidden" style={{ height: 5, background: "#f1f5f9" }}>
//                     <div
//                       className="h-full rounded-full transition-all"
//                       style={{ width: `${pct}%`, background: barColor }}
//                     />
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* ── Card 2: Holidays ── */}
//         <div className="dash-card p-5 flex flex-col gap-3">
//           <div className="flex items-center justify-between">
//             <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>
//               Holidays {new Date().getFullYear()}
//             </p>
//             <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 10px", borderRadius: 99, background: "#fef3c7", color: "#d97706", border: "1px solid #fcd34d55" }}>
//               {upcomingHolidays.length} upcoming
//             </span>
//           </div>

//           <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 340, paddingRight: 2 }}>
//             {upcomingHolidays.map((h, i) => {
//               const d        = new Date(h.date + "T00:00:00");
//               const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
//               const isNext   = i === 0;
//               const color    = typeColor[h.type] ?? "#6366f1";
//               return (
//                 <div key={h.id ?? h.date}
//                   className="flex items-center gap-3 px-2 py-2 rounded-xl transition-all"
//                   style={{ background: isNext ? color + "0d" : "transparent", border: isNext ? `1px solid ${color}25` : "1px solid transparent" }}
//                 >
//                   <div className="flex flex-col items-center justify-center rounded-lg shrink-0 text-white"
//                     style={{ width: 38, height: 38, background: `linear-gradient(135deg,${color},${color}bb)` }}>
//                     <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>
//                       {d.toLocaleDateString("en-IN", { month: "short" })}
//                     </span>
//                     <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{d.getDate()}</span>
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p style={{ fontSize: 12.5, fontWeight: 700, color: isNext ? color : "#1f2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
//                       {h.title}
//                     </p>
//                     <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
//                       {d.toLocaleDateString("en-IN", { weekday: "long" })}
//                     </p>
//                   </div>
//                   <div className="shrink-0 text-right">
//                     {isNext ? (
//                       <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: color + "15", color }}>
//                         {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
//                       </span>
//                     ) : (
//                       <span style={{ fontSize: 10, color: "#d1d5db", fontWeight: 600 }}>
//                         {daysLeft === 0 ? "Today!" : `${daysLeft}d`}
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               );
//             })}

//             {pastHolidays.length > 0 && (
//               <>
//                 <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#d1d5db", margin: "8px 8px 4px" }}>Past</p>
//                 {pastHolidays.map((h) => {
//                   const d = new Date(h.date + "T00:00:00");
//                   return (
//                     <div key={h.id ?? h.date} className="flex items-center gap-3 px-2 py-1.5 rounded-xl" style={{ opacity: 0.38 }}>
//                       <div className="flex flex-col items-center justify-center rounded-lg shrink-0" style={{ width: 38, height: 38, background: "#e2e8f0" }}>
//                         <span style={{ fontSize: 8, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>
//                           {d.toLocaleDateString("en-IN", { month: "short" })}
//                         </span>
//                         <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, color: "#94a3b8" }}>{d.getDate()}</span>
//                       </div>
//                       <div className="flex-1 min-w-0">
//                         <p style={{ fontSize: 12.5, fontWeight: 700, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</p>
//                         <p style={{ fontSize: 10, color: "#d1d5db", fontWeight: 500 }}>{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }