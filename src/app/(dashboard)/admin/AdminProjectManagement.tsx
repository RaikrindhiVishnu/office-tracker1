// "use client";

// import { useState, useEffect, useRef } from "react";
// import {
//   addDoc, collection, serverTimestamp, deleteDoc, doc,
//   updateDoc, onSnapshot, query, where, orderBy, getDocs,
// } from "firebase/firestore";
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// import { db, storage } from "@/lib/firebase";

// /* ── Import from KanbanBoard.tsx ── */
// import { KanbanBoard, TaskModal } from "./KanbanBoard";
// import type { KanbanColumn, Task } from "./KanbanBoard";

// /* ─── TYPES ─── */
// interface Project {
//   id: string; name: string; clientName?: string; description?: string;
//   projectType: "Billing" | "Non-Billing"; billingType?: "Hourly" | "Fixed Cost" | "Internal";
//   startDate?: string; endDate?: string; projectManager?: string;
//   members: string[]; budget?: number; priority: "Low" | "Medium" | "High" | "Critical";
//   status: "Not Started" | "Planning" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
//   progress: number; createdBy: string; createdAt: any; color?: string;
//   columns?: KanbanColumn[];
// }
// interface Sprint { id: string; name: string; projectId: string; startDate?: string; endDate?: string; status: string; createdAt: any; }
// interface WorkLog { id: string; userId: string; userName: string; projectId: string; projectName: string; taskId?: string; taskName?: string; description: string; hoursWorked: number; workStatus: "Completed" | "In Progress" | "Blocked"; date: string; createdAt: any; }
// interface Milestone { id: string; projectId: string; title: string; dueDate?: string; status: "pending" | "completed"; createdAt: any; }
// interface DailyTask { id: string; projectId: string; projectName: string; taskTitle: string; description: string; hoursWorked: number; workStatus: "Completed" | "In Progress" | "Blocked" | "Review"; category: string; }
// interface DailyEntry { id: string; userId: string; userName: string; userEmail: string; date: string; month: string; tasks: DailyTask[]; totalHours: number; status: "submitted" | "draft"; submittedAt?: any; createdAt: any; }
// interface WorkloadItem { user: any; total: number; done: number; inProgress: number; blocked: number; }
// interface UserSummaryItem { user: any; totalH: number; days: number; byProject: Record<string, number>; byStatus: Record<string, number>; }

// /* ─── CONSTANTS ─── */
// const DEFAULT_COLUMNS: KanbanColumn[] = [
//   { id: "todo", label: "To Do" },
//   { id: "inprogress", label: "In Progress" },
//   { id: "review", label: "Review" },
//   { id: "done", label: "Done" },
//   { id: "blocked", label: "Blocked" },
// ];

// const PROJECT_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];

// const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
//   "Not Started": { color: "#64748b", bg: "#f1f5f9", dot: "#94a3b8" },
//   "Planning":    { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
//   "In Progress": { color: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
//   "On Hold":     { color: "#ea580c", bg: "#fff7ed", dot: "#f97316" },
//   "Completed":   { color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
//   "Cancelled":   { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
// };

// const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
//   Low:      { color: "#16a34a", bg: "#f0fdf4", icon: "▼" },
//   Medium:   { color: "#d97706", bg: "#fffbeb", icon: "●" },
//   High:     { color: "#ea580c", bg: "#fff7ed", icon: "▲" },
//   Critical: { color: "#dc2626", bg: "#fef2f2", icon: "⚡" },
// };

// const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
//   story:  { icon: "📘", color: "#3730a3", label: "Story"  },
//   task:   { icon: "🧩", color: "#0369a1", label: "Task"   },
//   bug:    { icon: "🐞", color: "#b91c1c", label: "Bug"    },
//   defect: { icon: "⚠️", color: "#b45309", label: "Defect" },
// };

// function getColConfig(col: KanbanColumn, index: number) {
//   const PALETTE = [
//     { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9" },
//     { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe" },
//     { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe" },
//     { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7" },
//     { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2" },
//     { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", headerBg: "#cffafe" },
//     { color: "#d97706", bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7" },
//     { color: "#db2777", bg: "#fdf2f8", border: "#fbcfe8", headerBg: "#fce7f3" },
//   ];
//   return PALETTE[index % PALETTE.length];
// }

// const DAILY_CATEGORIES = ["Development","Design","Testing","Meeting","Documentation","Review","DevOps","Research","Support","Other"];
// const DAILY_STATUS_COLORS: Record<string,{bg:string;color:string;dot:string}> = {
//   Completed:    { bg:"#f0fdf4", color:"#16a34a", dot:"#22c55e" },
//   "In Progress":{ bg:"#eff6ff", color:"#2563eb", dot:"#3b82f6" },
//   Blocked:      { bg:"#fef2f2", color:"#dc2626", dot:"#ef4444" },
//   Review:       { bg:"#f5f3ff", color:"#7c3aed", dot:"#8b5cf6" },
// };

// function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
// function getFirstDayOfMonth(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
// const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// const Avatar = ({ name, size = "sm", color }: { name?: string; size?: "xs" | "sm" | "md" | "lg"; color?: string }) => {
//   const s = { xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
//   const colors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
//   const bg = color || colors[(name?.charCodeAt(0)||0) % colors.length];
//   return (
//     <div className={`${s[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-white`} style={{background:bg}}>
//       {name?.[0]?.toUpperCase()||"?"}
//     </div>
//   );
// };

// const ProgressRing = ({ pct, size=48, stroke=4, color="#6366f1" }: { pct:number; size?:number; stroke?:number; color?:string }) => {
//   const r=(size-stroke)/2, circ=2*Math.PI*r, offset=circ-(pct/100)*circ;
//   return (
//     <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
//       <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
//       <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
//         strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
//         style={{transition:"stroke-dashoffset 0.6s ease"}} />
//     </svg>
//   );
// };

// /* ─── MEMBER PICKER ─── */
// function MemberPicker({ users, currentUid, selected, onChange }: {
//   users: any[]; currentUid: string; selected: string[]; onChange: (s: string[]) => void;
// }) {
//   const [search, setSearch] = useState("");
//   const eligible = users.filter((u:any) => u.uid !== currentUid);
//   const filtered = eligible.filter((u:any) => {
//     const name = (u.displayName || u.name || u.email?.split("@")[0] || "").toLowerCase();
//     return name.includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase());
//   });
//   const toggle = (uid: string) => { onChange(selected.includes(uid) ? selected.filter(id => id !== uid) : [...selected, uid]); };
//   const getName = (u: any) => u.displayName || u.name || u.email?.split("@")[0] || "Unknown";
//   const colors = ["#6366f1","#7c3aed","#db2777","#d97706","#059669","#0891b2","#dc2626","#16a34a"];
//   return (
//     <div>
//       <div className="flex items-center justify-between mb-2">
//         <label className="text-xs font-medium text-gray-500">Team Members</label>
//         {selected.length > 0 && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selected.length} selected</span>}
//       </div>
//       <div className="relative mb-2">
//         <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
//         <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
//           className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white transition" />
//         {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs">✕</button>}
//       </div>
//       <div className="border border-gray-200 rounded-xl overflow-hidden">
//         <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
//           {filtered.length === 0
//             ? <div className="py-6 text-center text-xs text-gray-400">No members found</div>
//             : filtered.map((u: any) => {
//               const name = getName(u); const checked = selected.includes(u.uid);
//               const colorIdx = (name.charCodeAt(0) || 0) % colors.length;
//               return (
//                 <div key={u.uid} onClick={() => toggle(u.uid)}
//                   className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${checked ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}>
//                   <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:colors[colorIdx]}}>{name[0]?.toUpperCase()}</div>
//                   <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{name}</p><p className="text-[10px] text-gray-400 truncate">{u.email}</p></div>
//                   <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>
//                     {checked && <span className="text-white text-[9px] font-bold">✓</span>}
//                   </div>
//                 </div>
//               );
//             })}
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ─── SPRINT PICKER ─── */
// function SprintPicker({ sprints, activeSprint, onSelect, onDelete }: {
//   sprints: Sprint[]; activeSprint: Sprint|null;
//   onSelect: (s: Sprint|null) => void; onDelete: (s: Sprint) => void;
// }) {
//   const [open, setOpen] = useState(false);
//   const ref = useRef<HTMLDivElement>(null);
//   useEffect(() => {
//     const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
//     document.addEventListener("mousedown", h);
//     return () => document.removeEventListener("mousedown", h);
//   }, []);
//   return (
//     <div ref={ref} className="relative">
//       <button onClick={() => setOpen(o => !o)}
//         className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 transition focus:outline-none"
//         style={{minWidth:"130px"}}>
//         <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: activeSprint ? "#8b5cf6" : "#d1d5db"}} />
//         <span className="flex-1 text-left text-gray-700 truncate">{activeSprint ? activeSprint.name : "All Sprints"}</span>
//         <span className="text-gray-400 text-[10px] shrink-0">{open ? "▴" : "▾"}</span>
//       </button>
//       {open && (
//         <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1" style={{minWidth:"200px",maxWidth:"240px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
//           <div onClick={() => { onSelect(null); setOpen(false); }}
//             className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition text-xs ${!activeSprint ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}>
//             <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
//             <span className="flex-1">All Sprints</span>
//             {!activeSprint && <span className="text-indigo-500 text-[10px]">✓</span>}
//           </div>
//           {sprints.length > 0 && <div className="border-t border-gray-100 my-1" />}
//           {sprints.length === 0
//             ? <div className="px-3 py-3 text-[11px] text-gray-400 text-center">No sprints yet</div>
//             : sprints.map(s => (
//               <div key={s.id}
//                 className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition group/spr ${activeSprint?.id === s.id ? "bg-purple-50" : "hover:bg-gray-50"}`}
//                 onClick={() => { onSelect(s); setOpen(false); }}>
//                 <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
//                 <div className="flex-1 min-w-0">
//                   <p className={`text-xs truncate ${activeSprint?.id === s.id ? "text-purple-700 font-semibold" : "text-gray-700"}`}>{s.name}</p>
//                   {(s.startDate || s.endDate) && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.startDate||"?"} → {s.endDate||"?"}</p>}
//                 </div>
//                 {activeSprint?.id === s.id && <span className="text-purple-500 text-[10px] shrink-0">✓</span>}
//                 <button onClick={e => { e.stopPropagation(); onDelete(s); setOpen(false); }}
//                   className="opacity-0 group-hover/spr:opacity-100 w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition shrink-0 text-[11px]">✕</button>
//               </div>
//             ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ADMIN DAILY SHEET
// ═══════════════════════════════════════════ */
// function AdminDailySheet({ user, users, projects }: { user:any; users:any[]; projects:any[] }) {
//   const currentMonth = new Date().toISOString().slice(0,7);
//   const [viewMonth, setViewMonth] = useState(currentMonth);
//   const [entries, setEntries] = useState<DailyEntry[]>([]);
//   const [selectedUser, setSelectedUser] = useState("all");
//   const [selectedProject, setSelectedProject] = useState("all");
//   const [sheetView, setSheetView] = useState<"table"|"byuser"|"calendar">("table");

//   useEffect(() => {
//     const parsedYear  = parseInt(viewMonth.split("-")[0], 10);
//     const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1;
//     const daysInMonth = getDaysInMonth(parsedYear, parsedMonth);
//     const start = `${viewMonth}-01`;
//     const end = `${viewMonth}-${String(daysInMonth).padStart(2, "0")}`;
//     const q = query(collection(db, "dailyEntries"), where("date",">=",start), where("date","<=",end), orderBy("date","asc"));
//     return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyEntry))));
//   }, [viewMonth]);

//   const parsedYear  = parseInt(viewMonth.split("-")[0], 10);
//   const parsedMonth = parseInt(viewMonth.split("-")[1], 10) - 1;
//   const monthName = new Date(parsedYear, parsedMonth, 1).toLocaleString("default", { month: "long", year: "numeric" });
//   const prevMonth = () => { const d = new Date(parsedYear, parsedMonth-1, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
//   const nextMonth = () => { const d = new Date(parsedYear, parsedMonth+1, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

//   const filtered = entries.filter(e => {
//     if (selectedUser!=="all" && e.userId!==selectedUser) return false;
//     if (selectedProject!=="all" && !e.tasks.some(t=>t.projectId===selectedProject)) return false;
//     return true;
//   });
//   const allRows = filtered.flatMap(e => e.tasks.map(t=>({...t,date:e.date,userName:e.userName,userId:e.userId,entryStatus:e.status})));
//   const totalHours = filtered.reduce((s,e)=>s+e.totalHours,0);
//   const submittedDays = entries.filter(e=>e.status==="submitted").length;
//   const uniqueEmps = [...new Set(entries.map(e=>e.userId))].length;

//   const userSummary: UserSummaryItem[] = users.map((u:any) => {
//     const ue = entries.filter(e=>e.userId===u.uid);
//     const totalH = ue.reduce((s,e)=>s+e.totalHours,0);
//     const days = ue.filter(e=>e.status==="submitted").length;
//     const byProject = ue.flatMap(e=>e.tasks).reduce((acc:Record<string,number>,t)=>{ acc[t.projectName]=(acc[t.projectName]||0)+t.hoursWorked; return acc; },{});
//     const byStatus = ue.flatMap(e=>e.tasks).reduce((acc:Record<string,number>,t)=>{ acc[t.workStatus]=(acc[t.workStatus]||0)+1; return acc; },{});
//     return { user:u, totalH, days, byProject, byStatus };
//   }).filter((x:UserSummaryItem)=>x.totalH>0||x.days>0);

//   return (
//     <div className="space-y-5">
//       <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap shadow-sm">
//         <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
//           <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">←</button>
//           <span className="px-3 text-sm font-bold text-gray-800">{monthName}</span>
//           <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-gray-500 text-sm transition">→</button>
//         </div>
//         <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
//           <option value="all">All Employees</option>
//           {users.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}
//         </select>
//         <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
//           <option value="all">All Projects</option>
//           {projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
//         </select>
//         <div className="flex bg-gray-100 rounded-xl overflow-hidden ml-auto">
//           {(["table","byuser","calendar"] as const).map(m=>{
//             const labels: Record<string,string> = { table:"📋 Table", byuser:"👥 By User", calendar:"📅 Calendar" };
//             return <button key={m} onClick={()=>setSheetView(m)} className={`px-4 py-2 text-xs font-bold transition ${sheetView===m?"bg-indigo-600 text-white":"text-gray-500 hover:text-gray-700"}`}>{labels[m]}</button>;
//           })}
//         </div>
//       </div>
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//         {[
//           {label:"Total Hours",val:`${totalHours}h`,color:"#6366f1"},
//           {label:"Days Submitted",val:submittedDays,color:"#16a34a"},
//           {label:"Active Employees",val:uniqueEmps,color:"#f59e0b"},
//           {label:"Avg Hrs / Day",val:`${submittedDays?(totalHours/submittedDays).toFixed(1):0}h`,color:"#ec4899"},
//         ].map(s=>(
//           <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
//             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
//             <p className="text-3xl font-black" style={{color:s.color}}>{s.val}</p>
//           </div>
//         ))}
//       </div>
//       {sheetView==="table" && (
//         <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead>
//                 <tr className="border-b border-gray-100 bg-gray-50">
//                   {["Date","Employee","Project","Task","Category","Status","Hours"].map(h=>(
//                     <th key={h} className="px-5 py-3.5 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {allRows.length===0
//                   ? <tr><td colSpan={7} className="py-16 text-center text-gray-300"><div className="text-4xl mb-2">📋</div><p className="text-sm">No entries for {monthName}</p></td></tr>
//                   : allRows.map((row,i)=>{
//                     const sc = DAILY_STATUS_COLORS[row.workStatus];
//                     const d = new Date(row.date+"T12:00:00");
//                     return (
//                       <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30 transition">
//                         <td className="px-5 py-3.5">
//                           <div className="flex items-center gap-2">
//                             <span className={`w-2 h-2 rounded-full shrink-0 ${row.entryStatus==="submitted"?"bg-green-400":"bg-yellow-400"}`} />
//                             <p className="text-sm font-semibold text-gray-800">{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</p>
//                           </div>
//                         </td>
//                         <td className="px-5 py-3.5"><div className="flex items-center gap-2"><Avatar name={row.userName} size="xs" /><span className="text-sm font-semibold text-gray-700">{row.userName}</span></div></td>
//                         <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">{row.projectName}</span></td>
//                         <td className="px-5 py-3.5"><p className="text-sm font-semibold text-gray-800">{row.taskTitle}</p>{row.description&&<p className="text-xs text-gray-400 max-w-xs truncate">{row.description}</p>}</td>
//                         <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">{row.category}</td>
//                         <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{background:sc?.bg,color:sc?.color}}>{row.workStatus}</span></td>
//                         <td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{row.hoursWorked}h</td>
//                       </tr>
//                     );
//                   })}
//               </tbody>
//               {allRows.length>0&&(
//                 <tfoot><tr className="border-t border-gray-100 bg-gray-50"><td colSpan={6} className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-wider">Total for {monthName}</td><td className="px-5 py-3.5 text-2xl font-black text-indigo-600">{totalHours}h</td></tr></tfoot>
//               )}
//             </table>
//           </div>
//         </div>
//       )}
//       {sheetView==="byuser" && (
//         <div className="space-y-4">
//           {userSummary.length===0
//             ? <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl text-gray-300"><div className="text-4xl mb-2">👥</div><p className="text-sm">No submissions this month</p></div>
//             : userSummary.map(({user:u,totalH,days,byProject,byStatus}:UserSummaryItem)=>(
//             <div key={u.uid} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
//               <div className="flex items-center gap-4 p-5 border-b border-gray-50">
//                 <Avatar name={u.email} size="md" />
//                 <div className="flex-1"><p className="font-black text-gray-900">{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</p><p className="text-xs text-gray-400">{u.email}</p></div>
//                 <div className="flex gap-6">
//                   <div className="text-center"><p className="text-3xl font-black text-indigo-600">{totalH}h</p><p className="text-xs text-gray-400">Total Hours</p></div>
//                   <div className="text-center"><p className="text-3xl font-black text-green-600">{days}</p><p className="text-xs text-gray-400">Days Logged</p></div>
//                 </div>
//               </div>
//               <div className="grid grid-cols-2 divide-x divide-gray-50">
//                 <div className="p-4">
//                   <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">By Project</p>
//                   <div className="space-y-2">{Object.entries(byProject).map(([proj,hrs])=>(
//                     <div key={proj} className="flex items-center gap-3"><span className="text-xs font-semibold text-indigo-600 flex-1 truncate">{proj}</span><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-indigo-500" style={{width:`${(hrs/totalH)*100}%`}} /></div><span className="text-xs font-black text-indigo-600 w-8 text-right">{hrs}h</span></div>
//                   ))}</div>
//                 </div>
//                 <div className="p-4">
//                   <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">By Status</p>
//                   <div className="space-y-2">{Object.entries(byStatus).map(([status,cnt])=>{
//                     const sc=DAILY_STATUS_COLORS[status];
//                     return <div key={status} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:sc?.dot}} /><span className="text-xs text-gray-500 flex-1">{status}</span><span className="text-sm font-black" style={{color:sc?.color}}>{cnt}</span></div>;
//                   })}</div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//       {sheetView==="calendar" && (
//         <AdminCalendar entries={entries} viewMonth={viewMonth} year={parsedYear} month={parsedMonth} />
//       )}
//     </div>
//   );
// }

// function AdminCalendar({ entries, viewMonth, year, month }: { entries: DailyEntry[]; viewMonth: string; year: number; month: number }) {
//   const [popupDate, setPopupDate] = useState<string|null>(null);
//   const todayStr = new Date().toISOString().split("T")[0];
//   const popupEntries = popupDate ? entries.filter(e=>e.date===popupDate) : [];
//   return (
//     <>
//       {popupDate&&popupEntries.length>0&&(
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={()=>setPopupDate(null)}>
//           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
//           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
//             <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
//               <div>
//                 <p className="font-black text-gray-900 text-base">{new Date(popupDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
//                 <div className="flex items-center gap-3 mt-1"><span className="text-sm font-black text-indigo-600">{popupEntries.reduce((s,e)=>s+e.totalHours,0)}h total</span><span className="text-xs text-gray-400">{popupEntries.length} employee{popupEntries.length!==1?"s":""}</span></div>
//               </div>
//               <button onClick={()=>setPopupDate(null)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">✕</button>
//             </div>
//             <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
//               {popupEntries.map(entry=>(
//                 <div key={entry.id} className="p-5">
//                   <div className="flex items-center gap-3 mb-3">
//                     <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">{entry.userName[0]?.toUpperCase()}</div>
//                     <div className="flex-1"><p className="font-bold text-gray-900 text-sm">{entry.userName}</p><p className="text-xs text-gray-400">{entry.userEmail}</p></div>
//                     <div className="flex items-center gap-2">
//                       <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${entry.status==="submitted"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{entry.status==="submitted"?"✅ Submitted":"📝 Draft"}</span>
//                       <span className="text-xl font-black text-indigo-600">{entry.totalHours}h</span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}
//       <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
//         <div className="grid grid-cols-7 border-b border-gray-100">
//           {WEEKDAYS.map(d=><div key={d} className="py-3 text-center text-xs font-black text-gray-400 uppercase tracking-widest border-r border-gray-50 last:border-r-0">{d}</div>)}
//         </div>
//         <div className="grid grid-cols-7">
//           {Array(getFirstDayOfMonth(year,month)).fill(null).map((_,i)=><div key={`e${i}`} className="h-28 border-r border-b border-gray-50" />)}
//           {Array(getDaysInMonth(year,month)).fill(null).map((_,i)=>{
//             const day=i+1; const dateStr=`${viewMonth}-${day.toString().padStart(2,"0")}`;
//             const dayEntries=entries.filter(e=>e.date===dateStr);
//             const totalDayH=dayEntries.reduce((s,e)=>s+e.totalHours,0);
//             const isToday=dateStr===todayStr; const hasData=dayEntries.length>0;
//             return (
//               <div key={dateStr} onClick={()=>hasData&&setPopupDate(dateStr)}
//                 className={`h-28 border-r border-b border-gray-50 p-2 flex flex-col transition-all ${isToday?"bg-indigo-50/40":""} ${hasData?"cursor-pointer hover:bg-gray-50":""}`}>
//                 <div className="flex items-center justify-between mb-1">
//                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${isToday?"bg-indigo-600 text-white":"text-gray-400"}`}>{day}</div>
//                   {hasData&&<span className="text-[10px] font-black text-indigo-500">{totalDayH}h</span>}
//                 </div>
//                 {hasData&&(
//                   <div className="flex-1 overflow-hidden space-y-0.5">
//                     <div className="text-[10px] font-bold text-gray-400">{dayEntries.length} emp</div>
//                     {dayEntries.slice(0,3).map(e=>(
//                       <div key={e.id} className="flex items-center gap-1 min-w-0">
//                         <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.status==="submitted"?"bg-green-400":"bg-yellow-400"}`} />
//                         <span className="text-[9px] text-gray-500 truncate font-medium">{e.userName}</span>
//                         <span className="text-[9px] font-black text-indigo-400 shrink-0">{e.totalHours}h</span>
//                       </div>
//                     ))}
//                     {dayEntries.length>3&&<p className="text-[9px] font-bold text-indigo-400">+{dayEntries.length-3} more</p>}
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     </>
//   );
// }

// /* ═══════════════════════════════════════════
//    MAIN COMPONENT
// ═══════════════════════════════════════════ */
// export default function AdminProjectManagement({ user, projects, users }: { user: any; projects: any[]; users: any[] }) {
//   const [activeProject, setActiveProject] = useState<Project|null>(null);
//   const [activeTask, setActiveTask] = useState<Task|null>(null);
//   const [tasks, setTasks] = useState<Task[]>([]);
//   const [sprints, setSprints] = useState<Sprint[]>([]);
//   const [activeSprint, setActiveSprint] = useState<Sprint|null>(null);
//   const [activities, setActivities] = useState<any[]>([]);
//   const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
//   const [milestones, setMilestones] = useState<Milestone[]>([]);
//   const [comments, setComments] = useState<any[]>([]);
//   const [taskFiles, setTaskFiles] = useState<any[]>([]);
//   const [subtasks, setSubtasks] = useState<any[]>([]);
//   const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
//   const [viewMode, setViewMode] = useState<"dashboard"|"kanban"|"list"|"timeline"|"workload"|"reports"|"gantt">("dashboard");
//   const [filterPriority, setFilterPriority] = useState("all");
//   const [filterAssignee, setFilterAssignee] = useState("all");
//   const [filterType, setFilterType] = useState("all");
//   const [search, setSearch] = useState("");
//   const [showProjectForm, setShowProjectForm] = useState(false);
//   const [editingProject, setEditingProject] = useState<Project|null>(null);
//   const [showTaskModal, setShowTaskModal] = useState(false);
//   const [showSprintForm, setShowSprintForm] = useState(false);
//   const [showMilestoneForm, setShowMilestoneForm] = useState(false);
//   const [commentText, setCommentText] = useState("");
//   const [uploading, setUploading] = useState(false);
//   const [newSubtask, setNewSubtask] = useState("");
//   const [projectsView, setProjectsView] = useState<"grid"|"list">("grid");
//   const [taskDetailTab, setTaskDetailTab] = useState<"details"|"subtasks"|"files"|"comments"|"logs">("details");
//   const [mainTab, setMainTab] = useState<"projects"|"dailysheet">("projects");

//   const [pf, setPf] = useState({
//     name:"", clientName:"", description:"",
//     projectType:"Billing" as "Billing"|"Non-Billing",
//     billingType:"Hourly" as "Hourly"|"Fixed Cost"|"Internal",
//     startDate:"", endDate:"", projectManager:"", budget:"",
//     priority:"Medium" as "Low"|"Medium"|"High"|"Critical",
//     status:"Planning" as Project["status"],
//     selectedMembers:[] as string[], color:PROJECT_COLORS[0]
//   });
//   const [sf, setSf] = useState({ name:"", startDate:"", endDate:"" });
//   const [mf, setMf] = useState({ title:"", dueDate:"" });

//   const isProjectManager = activeProject?.projectManager === user.uid;
//   const canManage = isProjectManager || activeProject?.createdBy === user.uid;

//   /* ── Stories (for TaskModal parent picker) ── */
//   const stories = tasks.filter(t => t.type === "story");

//   useEffect(() => {
//     if (!activeProject) return;
//     const cols = activeProject.columns && activeProject.columns.length > 0
//       ? activeProject.columns : DEFAULT_COLUMNS;
//     setColumns(cols);
//   }, [activeProject]);

//   useEffect(() => {
//     if (!activeProject) return;
//     const tq = activeSprint
//       ? query(collection(db,"projectTasks"), where("projectId","==",activeProject.id), where("sprintId","==",activeSprint.id))
//       : query(collection(db,"projectTasks"), where("projectId","==",activeProject.id));
//     const u1=onSnapshot(tq, s=>setTasks(s.docs.map(d=>({id:d.id,...d.data()} as Task))));
//     const u2=onSnapshot(query(collection(db,"sprints"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setSprints(s.docs.map(d=>({id:d.id,...d.data()} as Sprint))));
//     const u3=onSnapshot(query(collection(db,"projectActivities"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setActivities(s.docs.map(d=>({id:d.id,...d.data()}))));
//     const u4=onSnapshot(query(collection(db,"workLogs"),where("projectId","==",activeProject.id),orderBy("createdAt","desc")),s=>setWorkLogs(s.docs.map(d=>({id:d.id,...d.data()} as WorkLog))));
//     const u5=onSnapshot(query(collection(db,"milestones"),where("projectId","==",activeProject.id)),s=>setMilestones(s.docs.map(d=>({id:d.id,...d.data()} as Milestone))));
//     return ()=>{ u1(); u2(); u3(); u4(); u5(); };
//   },[activeProject,activeSprint]);

//   useEffect(() => {
//     if (!activeTask) return;
//     const u1=onSnapshot(query(collection(db,"taskComments"),where("taskId","==",activeTask.id),orderBy("createdAt","asc")),s=>setComments(s.docs.map(d=>({id:d.id,...d.data()}))));
//     const u2=onSnapshot(query(collection(db,"taskFiles"),where("taskId","==",activeTask.id),orderBy("createdAt","desc")),s=>setTaskFiles(s.docs.map(d=>({id:d.id,...d.data()}))));
//     const u3=onSnapshot(query(collection(db,"subtasks"),where("taskId","==",activeTask.id)),s=>setSubtasks(s.docs.map(d=>({id:d.id,...d.data()}))));
//     return ()=>{ u1(); u2(); u3(); };
//   },[activeTask]);

//   const sendNotification = async (userId:string,type:string,title:string,message:string,projectId?:string,taskId?:string) => {
//     await addDoc(collection(db,"notifications"),{userId,type,title,message,projectId:projectId??null,taskId:taskId??null,read:false,createdAt:serverTimestamp()});
//   };
//   const logActivity = async (projectId:string,action:string,description:string,taskId?:string) => {
//     await addDoc(collection(db,"projectActivities"),{projectId,userId:user.uid,userName:user.email?.split("@")[0]??"",action,description,taskId:taskId??null,createdAt:serverTimestamp()});
//   };

//   const handleSaveColumns = async (cols: KanbanColumn[]) => {
//     if (!activeProject) return;
//     await updateDoc(doc(db,"projects",activeProject.id), { columns: cols });
//     setActiveProject(prev => prev ? {...prev, columns: cols} : prev);
//   };

//   const handleSaveProject = async () => {
//     if (!pf.name.trim()) return;
//     const members=[user.uid,...pf.selectedMembers.filter((m:string)=>m!==user.uid)];
//     const data={name:pf.name,clientName:pf.clientName,description:pf.description,projectType:pf.projectType,billingType:pf.billingType,startDate:pf.startDate,endDate:pf.endDate,projectManager:pf.projectManager||user.uid,members,budget:pf.budget?Number(pf.budget):null,priority:pf.priority,status:pf.status,progress:0,color:pf.color};
//     if (editingProject) {
//       await updateDoc(doc(db,"projects",editingProject.id), data);
//       const newM=members.filter((m:string)=>!editingProject.members.includes(m));
//       for (const m of newM) await sendNotification(m,"project_added","Added to Project",`You've been added to "${pf.name}"`,editingProject.id);
//       await logActivity(editingProject.id,"updated project",`Updated "${pf.name}"`);
//     } else {
//       const r=await addDoc(collection(db,"projects"),{...data,columns:DEFAULT_COLUMNS,createdBy:user.uid,createdAt:serverTimestamp()});
//       for (const m of members.filter((m:string)=>m!==user.uid)) await sendNotification(m,"project_added","Added to Project",`You've been added to "${pf.name}"`,r.id);
//       await logActivity(r.id,"created project",`Created "${pf.name}"`);
//     }
//     setShowProjectForm(false); setEditingProject(null);
//     setPf({name:"",clientName:"",description:"",projectType:"Billing",billingType:"Hourly",startDate:"",endDate:"",projectManager:"",budget:"",priority:"Medium",status:"Planning",selectedMembers:[],color:PROJECT_COLORS[0]});
//   };

//   const handleDeleteProject = async (id:string) => {
//     if (!confirm("Delete this project?")) return;
//     await deleteDoc(doc(db,"projects",id));
//   };

//   const handleEditProject = (p:Project) => {
//     setEditingProject(p);
//     setPf({name:p.name,clientName:p.clientName||"",description:p.description||"",projectType:p.projectType,billingType:p.billingType||"Hourly",startDate:p.startDate||"",endDate:p.endDate||"",projectManager:p.projectManager||"",budget:p.budget?.toString()||"",priority:p.priority,status:p.status,selectedMembers:p.members.filter((m:string)=>m!==user.uid),color:p.color||PROJECT_COLORS[0]});
//     setShowProjectForm(true);
//   };

//   /* ── Task creation — now includes type + parentId ── */
//   const handleCreateTask = async (tf: any) => {
//     if (!tf.title.trim() || !activeProject) return;
//     const au = users.find((u:any) => u.uid === tf.assignedTo);
//     const isStory = tf.type === "story";
//     const taskRef = await addDoc(collection(db,"projectTasks"), {
//       title: tf.title,
//       description: tf.description,
//       projectId: activeProject.id,
//       sprintId: activeSprint?.id || null,
//       assignedTo: tf.assignedTo || null,
//       assignedToName: au?.email?.split("@")[0] || null,
//       assignedDate: new Date().toISOString().split("T")[0],
//       dueDate: tf.dueDate,
//       priority: tf.priority,
//       /* Stories get a special "story" pseudo-status; children use column status */
//       status: isStory ? "story" : (tf.status || columns[0]?.id || "todo"),
//       estimatedHours: isStory ? 0 : Number(tf.estimatedHours) || 0,
//       actualHours: 0,
//       storyPoints: Number(tf.storyPoints) || 3,
//       tags: tf.tags ? tf.tags.split(",").map((t:string) => t.trim()).filter(Boolean) : [],
//       /* Hierarchy fields */
//       type: tf.type || "task",
//       parentId: (!isStory && tf.parentId) ? tf.parentId : null,
//       createdBy: user.uid,
//       createdAt: serverTimestamp(),
//     });
//     if (tf.assignedTo) await sendNotification(tf.assignedTo,"task_assigned","Task Assigned",`"${tf.title}" assigned in ${activeProject.name}`,activeProject.id,taskRef.id);
//     const typeLabel = TYPE_META[tf.type]?.label || "Task";
//     await logActivity(activeProject.id,`created ${typeLabel.toLowerCase()}`,`Created "${tf.title}"`,taskRef.id);
//   };

//   const handleDeleteTask = async (taskId:string) => {
//     if (!confirm("Delete this task?")) return;
//     await deleteDoc(doc(db,"projectTasks",taskId));
//     setActiveTask(null);
//   };

//   const handleAssignTask = async (taskId:string,userId:string) => {
//     const au=users.find((u:any)=>u.uid===userId);
//     await updateDoc(doc(db,"projectTasks",taskId),{assignedTo:userId,assignedToName:au?.email?.split("@")[0]});
//     if (userId&&activeProject) await sendNotification(userId,"task_assigned","Task Assigned",`A task was assigned in ${activeProject.name}`,activeProject.id,taskId);
//     await logActivity(activeProject!.id,"assigned task",`Assigned to ${au?.email?.split("@")[0]}`,taskId);
//   };

//   const handleTaskStatusChange = async (taskId:string,newStatus:string) => {
//     await updateDoc(doc(db,"projectTasks",taskId),{
//       status:newStatus,
//       ...(newStatus==="inprogress"?{startedAt:serverTimestamp()}:{}),
//       ...(newStatus==="done"?{completedAt:serverTimestamp()}:{})
//     });
//     await logActivity(activeProject!.id,"moved task",`→ ${columns.find(c=>c.id===newStatus)?.label||newStatus}`,taskId);
//     const snap=await getDocs(query(collection(db,"projectTasks"),where("projectId","==",activeProject!.id)));
//     const all=snap.docs.map(d=>d.data());
//     const nonStory=all.filter(t=>t.type!=="story");
//     const doneColId=columns.find(c=>c.label.toLowerCase()==="done")?.id||"done";
//     if (nonStory.length) await updateDoc(doc(db,"projects",activeProject!.id),{progress:Math.round((nonStory.filter(t=>t.status===doneColId).length/nonStory.length)*100)});
//   };

//   const handleCreateSprint = async () => {
//     if (!sf.name.trim()) return;
//     await addDoc(collection(db,"sprints"),{name:sf.name,projectId:activeProject!.id,startDate:sf.startDate,endDate:sf.endDate,status:"active",createdAt:serverTimestamp()});
//     await logActivity(activeProject!.id,"created sprint",`Sprint "${sf.name}"`);
//     setSf({name:"",startDate:"",endDate:""}); setShowSprintForm(false);
//   };

//   const handleDeleteSprint = async (sprint:Sprint) => {
//     if (!confirm(`Delete sprint "${sprint.name}"?`)) return;
//     await deleteDoc(doc(db,"sprints",sprint.id));
//     if (activeSprint?.id===sprint.id) setActiveSprint(null);
//     await logActivity(activeProject!.id,"deleted sprint",`Deleted sprint "${sprint.name}"`);
//   };

//   const handleCreateMilestone = async () => {
//     if (!mf.title.trim()) return;
//     await addDoc(collection(db,"milestones"),{title:mf.title,dueDate:mf.dueDate,projectId:activeProject!.id,status:"pending",createdAt:serverTimestamp()});
//     setMf({title:"",dueDate:""}); setShowMilestoneForm(false);
//   };
//   const toggleMilestone = async (m:Milestone) => { await updateDoc(doc(db,"milestones",m.id),{status:m.status==="pending"?"completed":"pending"}); };

//   const handleAddComment = async () => {
//     if (!commentText.trim()) return;
//     await addDoc(collection(db,"taskComments"),{taskId:activeTask!.id,projectId:activeProject!.id,userId:user.uid,userName:user.email?.split("@")[0],text:commentText,createdAt:serverTimestamp()});
//     setCommentText("");
//   };

//   const handleFileUpload = async (e:React.ChangeEvent<HTMLInputElement>) => {
//     const file=e.target.files?.[0];
//     if (!file||!activeTask||!activeProject) return;
//     if (file.size>10*1024*1024) { alert("Max 10MB"); return; }
//     try {
//       setUploading(true);
//       const sr=ref(storage,`projectFiles/${activeProject.id}/${activeTask.id}/${Date.now()}_${file.name}`);
//       const snap=await uploadBytes(sr,file);
//       const url=await getDownloadURL(snap.ref);
//       await addDoc(collection(db,"taskFiles"),{taskId:activeTask.id,projectId:activeProject.id,fileName:file.name,fileUrl:url,uploadedBy:user.uid,uploadedByName:user.email?.split("@")[0],createdAt:serverTimestamp()});
//     } catch(err:any) { alert(`Upload failed: ${err.message}`); } finally { setUploading(false); }
//   };

//   const handleAddSubtask = async () => {
//     if (!newSubtask.trim()) return;
//     await addDoc(collection(db,"subtasks"),{taskId:activeTask!.id,projectId:activeProject!.id,text:newSubtask,done:false,createdAt:serverTimestamp()});
//     setNewSubtask("");
//   };
//   const toggleSubtask = async (st:any) => { await updateDoc(doc(db,"subtasks",st.id),{done:!st.done}); };

//   /* Filtering (exclude stories from priority/assignee filters — they're shown as headers) */
//   const filteredTasks = tasks.filter(t => {
//     if (filterPriority!=="all" && t.priority!==filterPriority) return false;
//     if (filterAssignee!=="all" && t.assignedTo!==filterAssignee) return false;
//     if (filterType!=="all" && t.type!==filterType) return false;
//     if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
//     return true;
//   });

//   const projectMembers = activeProject ? users.filter((u:any) => activeProject.members.includes(u.uid)) : [];
//   const totalHours = workLogs.reduce((s,l)=>s+(l.hoursWorked||0),0);
//   const nonStoryTasks = tasks.filter(t => t.type !== "story");
//   const workloadData: WorkloadItem[] = projectMembers.map((u:any) => {
//     const ut = nonStoryTasks.filter(t => t.assignedTo===u.uid);
//     return { user:u, total:ut.length, done:ut.filter(t=>t.status==="done").length, inProgress:ut.filter(t=>t.status==="inprogress").length, blocked:ut.filter(t=>t.status==="blocked").length };
//   });
//   const doneColId = columns.find(c=>c.label.toLowerCase()==="done")?.id||"done";
//   const overdueTasks = nonStoryTasks.filter(t => t.dueDate && new Date(t.dueDate)<new Date() && t.status!==doneColId);

//   /* ══ TASK DETAIL PANEL ══ */
//   if (activeTask) {
//     const pc = PRIORITY_CONFIG[activeTask.priority];
//     const tm = TYPE_META[activeTask.type || "task"] || TYPE_META.task;
//     const subtasksDone = subtasks.filter(s=>s.done).length;
//     const subtaskPct = subtasks.length ? Math.round((subtasksDone/subtasks.length)*100) : 0;
//     const parentStory = activeTask.parentId ? tasks.find(t=>t.id===activeTask.parentId) : null;

//     return (
//       <div className="fixed inset-0 z-50 flex items-stretch" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>
//         <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
//         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setActiveTask(null)} />
//         <div className="relative ml-auto w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
//           <div className="shrink-0" style={{background:`linear-gradient(135deg,${activeProject?.color||"#6366f1"} 0%,${activeProject?.color||"#6366f1"}dd 100%)`}}>
//             <div className="p-5">
//               <div className="flex items-center justify-between mb-3">
//                 <div className="flex items-center gap-2 flex-wrap">
//                   <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">{activeProject?.name}</span>
//                   <span className="text-white/40">•</span>
//                   {/* Type badge */}
//                   <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
//                     {tm.icon} {tm.label}
//                   </span>
//                   {/* Parent story link */}
//                   {parentStory && (
//                     <>
//                       <span className="text-white/40">→</span>
//                       <button onClick={()=>setActiveTask(parentStory)}
//                         className="text-xs text-white/80 hover:text-white underline underline-offset-2 transition">
//                         📘 {parentStory.title}
//                       </button>
//                     </>
//                   )}
//                 </div>
//                 <div className="flex items-center gap-2">
//                   {canManage && <button onClick={()=>handleDeleteTask(activeTask.id)} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-white transition text-xs">🗑️ Delete</button>}
//                   <button onClick={()=>setActiveTask(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">✕</button>
//                 </div>
//               </div>
//               <h2 className="text-xl font-bold text-white leading-snug mb-3">{activeTask.title}</h2>
//               <div className="flex flex-wrap items-center gap-2">
//                 {pc && <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md" style={{background:pc.bg,color:pc.color}}>{pc.icon} {activeTask.priority}</span>}
//                 {activeTask.tags?.map(tag=><span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-medium">#{tag}</span>)}
//                 {activeTask.storyPoints&&<span className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-medium">🎯 {activeTask.storyPoints}pt</span>}
//               </div>
//             </div>
//             <div className="flex border-t border-white/20">
//               {([["details","📋 Details"],["subtasks","✅ Subtasks"],["files","📎 Files"],["comments","💬 Comments"],["logs","⏱ Logs"]] as const).map(([t,l])=>(
//                 <button key={t} onClick={()=>setTaskDetailTab(t)}
//                   className={`flex-1 py-2.5 text-xs font-semibold transition ${taskDetailTab===t?"bg-white/20 text-white border-b-2 border-white":"text-white/60 hover:text-white/80"}`}>
//                   {l}
//                   {t==="comments"&&comments.length>0&&<span className="ml-1 bg-white/30 text-white text-[10px] rounded-full px-1.5">{comments.length}</span>}
//                   {t==="subtasks"&&subtasks.length>0&&<span className="ml-1 bg-white/30 text-white text-[10px] rounded-full px-1.5">{subtasksDone}/{subtasks.length}</span>}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
//             {taskDetailTab==="details"&&(
//               <div className="space-y-4">
//                 {activeTask.description&&<div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3><p className="text-sm text-gray-700 leading-relaxed">{activeTask.description}</p></div>}

//                 {/* Hierarchy info */}
//                 {activeTask.type === "story" && (
//                   <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
//                     <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Story Children</p>
//                     <div className="space-y-1">
//                       {tasks.filter(t => t.parentId === activeTask.id).map(child => {
//                         const ctm = TYPE_META[child.type||"task"];
//                         return (
//                           <button key={child.id} onClick={()=>setActiveTask(child)}
//                             className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-100 transition text-left">
//                             <span>{ctm.icon}</span>
//                             <span className="text-xs font-medium text-indigo-800 flex-1">{child.title}</span>
//                             <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"white",color:ctm.color}}>{child.status}</span>
//                           </button>
//                         );
//                       })}
//                       {tasks.filter(t=>t.parentId===activeTask.id).length===0&&<p className="text-xs text-indigo-400">No children yet — create a task/bug/defect and select this story as parent.</p>}
//                     </div>
//                   </div>
//                 )}

//                 <div className="grid grid-cols-2 gap-3">
//                   {[
//                     {label:"Status", content:(
//                       activeTask.type==="story" ? <div className="text-xs font-bold px-2 py-1.5 text-indigo-700 bg-indigo-50 rounded-lg">Story (auto)</div>
//                       : canManage
//                         ? <select value={activeTask.status} onChange={async e=>{await handleTaskStatusChange(activeTask.id,e.target.value);setActiveTask({...activeTask,status:e.target.value});}} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
//                         : <div className="text-xs font-semibold text-gray-700 px-2 py-1.5">{columns.find(c=>c.id===activeTask.status)?.label||activeTask.status}</div>
//                     )},
//                     {label:"Assignee", content:(
//                       canManage
//                         ? <select value={activeTask.assignedTo||""} onChange={e=>handleAssignTask(activeTask.id,e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"><option value="">Unassigned</option>{users.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}</select>
//                         : <div className="flex items-center gap-2 px-2 py-1"><Avatar name={activeTask.assignedToName||"?"} size="xs"/><span className="text-xs text-gray-700">{activeTask.assignedToName||"Unassigned"}</span></div>
//                     )},
//                     {label:"Priority", content:(
//                       canManage
//                         ? <select value={activeTask.priority} onChange={async e=>{await updateDoc(doc(db,"projectTasks",activeTask.id),{priority:e.target.value});setActiveTask({...activeTask,priority:e.target.value as any});}} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select>
//                         : <div className="text-xs font-semibold px-2 py-1.5" style={{color:PRIORITY_CONFIG[activeTask.priority]?.color}}>{activeTask.priority}</div>
//                     )},
//                     {label:"Due Date", content:(
//                       canManage
//                         ? <input type="date" defaultValue={activeTask.dueDate?.split("T")[0]||""} onChange={async e=>{await updateDoc(doc(db,"projectTasks",activeTask.id),{dueDate:e.target.value});}} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
//                         : <div className="text-xs text-gray-700 px-2 py-1.5">{activeTask.dueDate||"—"}</div>
//                     )},
//                   ].map(({label,content})=>(
//                     <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm"><p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">{label}</p>{content}</div>
//                   ))}
//                 </div>

//                 {activeTask.type!=="story"&&(
//                   <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//                     <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Time Tracking</h3>
//                     <div className="flex items-center gap-4">
//                       <ProgressRing pct={activeTask.estimatedHours?Math.min(((activeTask.actualHours||0)/activeTask.estimatedHours)*100,100):0} color={activeProject?.color||"#6366f1"} />
//                       <div className="flex-1">
//                         <div className="grid grid-cols-3 gap-2 text-center mb-2">
//                           <div><p className="text-lg font-black text-gray-900">{activeTask.estimatedHours||0}h</p><p className="text-xs text-gray-400">Estimated</p></div>
//                           <div><p className="text-lg font-black text-gray-900">{activeTask.actualHours||0}h</p><p className="text-xs text-gray-400">Logged</p></div>
//                           <div><p className="text-lg font-black" style={{color:activeProject?.color||"#6366f1"}}>{activeTask.storyPoints||0}</p><p className="text-xs text-gray-400">Points</p></div>
//                         </div>
//                         {canManage&&(
//                           <div className="flex gap-3">
//                             <div className="flex-1"><label className="text-xs text-gray-400">Est. Hours</label><input type="number" defaultValue={activeTask.estimatedHours||""} onChange={async e=>{await updateDoc(doc(db,"projectTasks",activeTask.id),{estimatedHours:Number(e.target.value)});}} className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" /></div>
//                             <div className="flex-1"><label className="text-xs text-gray-400">Actual Hours</label><input type="number" defaultValue={activeTask.actualHours||""} onChange={async e=>{await updateDoc(doc(db,"projectTasks",activeTask.id),{actualHours:Number(e.target.value)});}} className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" /></div>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}

//             {taskDetailTab==="subtasks"&&(
//               <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//                 <div className="flex items-center justify-between mb-3">
//                   <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
//                   <div className="flex items-center gap-2"><div className="w-24 bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full transition-all" style={{width:`${subtaskPct}%`,background:activeProject?.color||"#6366f1"}} /></div><span className="text-xs font-bold text-gray-500">{subtasksDone}/{subtasks.length}</span></div>
//                 </div>
//                 <div className="space-y-2 mb-3">
//                   {subtasks.map((st:any)=>(
//                     <div key={st.id} onClick={()=>toggleSubtask(st)} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition hover:bg-gray-50 ${st.done?"opacity-60":""}`}>
//                       <div className="w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 transition" style={{background:st.done?(activeProject?.color||"#6366f1"):"transparent",borderColor:st.done?(activeProject?.color||"#6366f1"):"#d1d5db"}}>
//                         {st.done&&<span className="text-white text-xs font-bold">✓</span>}
//                       </div>
//                       <span className={`text-sm ${st.done?"line-through text-gray-400":"text-gray-700"}`}>{st.text}</span>
//                     </div>
//                   ))}
//                   {subtasks.length===0&&<p className="text-xs text-gray-400 text-center py-4">No subtasks yet</p>}
//                 </div>
//                 {canManage&&(
//                   <div className="flex gap-2">
//                     <input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} placeholder="Add a subtask..." onKeyDown={e=>e.key==="Enter"&&handleAddSubtask()} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none" />
//                     <button onClick={handleAddSubtask} className="inline-flex items-center px-3 py-2 text-white text-xs font-semibold rounded-lg" style={{background:activeProject?.color||"#6366f1"}}>Add</button>
//                   </div>
//                 )}
//               </div>
//             )}

//             {taskDetailTab==="files"&&(
//               <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//                 <div className="flex items-center justify-between mb-3">
//                   <h3 className="text-sm font-semibold text-gray-700">Attachments ({taskFiles.length})</h3>
//                   {canManage&&<label className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white cursor-pointer ${uploading?"opacity-50":""}`} style={{background:activeProject?.color||"#6366f1"}}>{uploading?"⏳ Uploading...":"📤 Upload"}<input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} /></label>}
//                 </div>
//                 {taskFiles.length===0?<div className="text-center py-8 text-gray-400"><div className="text-4xl mb-2">📁</div><p className="text-sm">No files attached yet</p></div>
//                   :<div className="space-y-2">{taskFiles.map((f:any)=>(
//                     <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
//                       <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">{f.fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)?"🖼️":f.fileName.match(/\.pdf$/i)?"📕":"📄"}</div>
//                       <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{f.fileName}</p><p className="text-xs text-gray-400">by {f.uploadedByName}</p></div>
//                       <span className="text-gray-300 text-sm">↗</span>
//                     </a>
//                   ))}</div>}
//               </div>
//             )}

//             {taskDetailTab==="comments"&&(
//               <div className="space-y-3">
//                 {comments.map((c:any)=>(
//                   <div key={c.id} className={`flex gap-3 ${c.userId===user.uid?"flex-row-reverse":""}`}>
//                     <Avatar name={c.userName} size="sm" />
//                     <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${c.userId===user.uid?"rounded-tr-sm text-white":"rounded-tl-sm bg-white border border-gray-100"}`} style={c.userId===user.uid?{background:activeProject?.color||"#6366f1"}:{}}>
//                       <p className={`text-xs font-semibold mb-1 ${c.userId===user.uid?"text-white/70":"text-gray-500"}`}>{c.userName} · {c.createdAt?.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>
//                       <p className={`text-sm leading-relaxed ${c.userId===user.uid?"text-white":"text-gray-700"}`}>{c.text}</p>
//                     </div>
//                   </div>
//                 ))}
//                 {comments.length===0&&<div className="text-center py-12 text-gray-400"><div className="text-5xl mb-3">💬</div><p className="text-sm font-medium">Start the conversation</p></div>}
//               </div>
//             )}

//             {taskDetailTab==="logs"&&(
//               <div className="space-y-3">
//                 {workLogs.filter(l=>l.taskId===activeTask.id).length===0
//                   ?<div className="text-center py-12 text-gray-400"><div className="text-5xl mb-3">⏱</div><p className="text-sm">No work logged yet</p></div>
//                   :workLogs.filter(l=>l.taskId===activeTask.id).map(log=>(
//                     <div key={log.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//                       <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm text-gray-800">{log.userName}</span><span className="font-black text-lg" style={{color:activeProject?.color||"#6366f1"}}>{log.hoursWorked}h</span></div>
//                       <p className="text-sm text-gray-600">{log.description}</p>
//                       <div className="flex items-center gap-3 mt-2">
//                         <span className="text-xs text-gray-400">{log.date}</span>
//                         <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.workStatus==="Completed"?"bg-green-100 text-green-700":log.workStatus==="Blocked"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{log.workStatus}</span>
//                       </div>
//                     </div>
//                   ))}
//               </div>
//             )}
//           </div>

//           {taskDetailTab==="comments"&&(
//             <div className="shrink-0 p-4 bg-white border-t border-gray-100">
//               <div className="flex gap-2">
//                 <Avatar name={user?.email?.split("@")[0]} size="sm" />
//                 <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Write a comment..." onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&handleAddComment()} className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" />
//                 <button onClick={handleAddComment} disabled={!commentText.trim()} className="inline-flex items-center px-4 py-2 text-white text-xs font-semibold rounded-xl disabled:opacity-40" style={{background:activeProject?.color||"#6366f1"}}>Send</button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   }

//   /* ══ PROJECT VIEW ══ */
//   if (activeProject) {
//     return (
//       <div className="h-screen flex flex-col bg-gray-50 overflow-hidden" style={{fontFamily:"'Inter', system-ui, sans-serif"}}>
//         <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} .hide-sb::-webkit-scrollbar{display:none;}.hide-sb{scrollbar-width:none;}`}</style>

//         {/* Task creation modal — passes stories for parent picker */}
//         <TaskModal
//           open={showTaskModal}
//           onClose={()=>setShowTaskModal(false)}
//           onSubmit={handleCreateTask}
//           users={users}
//           columns={columns}
//           projectColor={activeProject.color||"#6366f1"}
//           stories={stories}
//         />

//         {/* Top header */}
//         <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
//           <div className="px-6 py-3 flex items-center gap-4">
//             <button onClick={()=>{setActiveProject(null);setActiveSprint(null);setViewMode("dashboard");}}
//               className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">← Projects</button>
//             <div className="w-px h-5 bg-gray-200" />
//             <div className="flex items-center gap-2">
//               <div className="w-2.5 h-2.5 rounded-full" style={{background:activeProject.color||"#6366f1"}} />
//               <h1 className="font-bold text-gray-900 text-sm">{activeProject.name}</h1>
//               {activeProject.clientName&&<span className="text-xs text-gray-400">· {activeProject.clientName}</span>}
//               {canManage&&<span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">👑 PM</span>}
//             </div>
//             <div className="flex items-center gap-3 ml-auto">
//               <div className="flex items-center gap-2">
//                 <div className="w-32 bg-gray-200 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${activeProject.progress}%`,background:activeProject.color||"#6366f1"}} /></div>
//                 <span className="text-xs font-bold text-gray-500">{activeProject.progress}%</span>
//               </div>
//               {overdueTasks.length>0&&<span className="inline-flex items-center text-xs font-semibold bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">⚠️ {overdueTasks.length} overdue</span>}
//               <div className="flex -space-x-2">{projectMembers.slice(0,5).map((u:any)=><Avatar key={u.uid} name={u.email} size="xs" />)}</div>
//             </div>
//           </div>

//           {/* View tabs */}
//           <div className="px-4 flex items-center bg-white border-t border-gray-100" style={{borderBottom:"1px solid #f3f4f6"}}>
//             <div className="flex items-center overflow-x-auto hide-sb">
//               {([["dashboard","📊 Dashboard"],["kanban","⊞ Kanban"],["list","☰ List"],["timeline","📅 Timeline"],["workload","👥 Workload"],["reports","📊 Reports"],["gantt","📈 Gantt"]] as const).map(([m,label])=>(
//                 <button key={m} onClick={()=>setViewMode(m as typeof viewMode)}
//                   className="px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0"
//                   style={viewMode===m?{borderBottomColor:activeProject.color||"#4f46e5",color:activeProject.color||"#4f46e5"}:{borderBottomColor:"transparent",color:"#6b7280"}}>{label}</button>
//               ))}
//             </div>
//           </div>

//           {/* Controls */}
//           <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-wrap">
//             {viewMode!=="dashboard"&&(
//               <div className="flex items-center gap-2 flex-wrap flex-1">
//                 <SprintPicker sprints={sprints} activeSprint={activeSprint} onSelect={setActiveSprint} onDelete={handleDeleteSprint} />
//                 <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
//                   <option value="all">All Priorities</option>
//                   {["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}
//                 </select>
//                 <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
//                   <option value="all">All Assignees</option>
//                   {projectMembers.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}
//                 </select>
//                 <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
//                   <option value="all">All Types</option>
//                   <option value="story">📘 Story</option>
//                   <option value="task">🧩 Task</option>
//                   <option value="bug">🐞 Bug</option>
//                   <option value="defect">⚠️ Defect</option>
//                 </select>
//                 <div className="relative">
//                   <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
//                   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..." className="text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none w-36" />
//                 </div>
//               </div>
//             )}
//             {viewMode==="dashboard"&&<div className="flex-1" />}
//             <div className="flex items-center gap-2 shrink-0 ml-auto">
//               {canManage&&(
//                 <>
//                   <button onClick={()=>setShowMilestoneForm(!showMilestoneForm)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition">🏁 Milestone</button>
//                   <button onClick={()=>setShowSprintForm(!showSprintForm)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition">🏃 Sprint</button>
//                   {viewMode!=="dashboard"&&<button onClick={()=>setShowTaskModal(true)} className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-lg text-white transition hover:opacity-90" style={{background:activeProject.color||"#4f46e5"}}>+ Create</button>}
//                   <button onClick={()=>handleEditProject(activeProject)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">✏️ Edit</button>
//                 </>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Milestones */}
//         {milestones.length>0&&(
//           <div className="shrink-0 px-6 py-2 bg-white border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
//             <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Milestones</span>
//             {milestones.map(m=>(
//               <button key={m.id} onClick={()=>canManage&&toggleMilestone(m)}
//                 className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 transition ${m.status==="completed"?"border-green-200 bg-green-50 text-green-700 line-through":"border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300 hover:bg-amber-50"}`}>
//                 {m.status==="completed"?"✅":"🎯"} {m.title}{m.dueDate&&` · ${m.dueDate}`}
//               </button>
//             ))}
//           </div>
//         )}

//         {(showSprintForm||showMilestoneForm)&&canManage&&(
//           <div className="shrink-0 px-6 py-3 bg-indigo-50 border-b border-indigo-100">
//             {showSprintForm&&<div className="flex items-center gap-3"><span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">New Sprint</span><input value={sf.name} onChange={e=>setSf({...sf,name:e.target.value})} placeholder="Sprint name" className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" /><input type="date" value={sf.startDate} onChange={e=>setSf({...sf,startDate:e.target.value})} className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" /><input type="date" value={sf.endDate} onChange={e=>setSf({...sf,endDate:e.target.value})} className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" /><button onClick={handleCreateSprint} className="text-xs font-bold px-3 py-1.5 bg-purple-600 text-white rounded-lg">Create</button><button onClick={()=>setShowSprintForm(false)} className="text-xs text-gray-400">✕</button></div>}
//             {showMilestoneForm&&<div className="flex items-center gap-3"><span className="text-xs font-bold text-amber-700 uppercase tracking-wider">New Milestone</span><input value={mf.title} onChange={e=>setMf({...mf,title:e.target.value})} placeholder="Milestone title" className="text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" /><input type="date" value={mf.dueDate} onChange={e=>setMf({...mf,dueDate:e.target.value})} className="text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none" /><button onClick={handleCreateMilestone} className="text-xs font-bold px-3 py-1.5 bg-amber-500 text-white rounded-lg">Create</button><button onClick={()=>setShowMilestoneForm(false)} className="text-xs text-gray-400">✕</button></div>}
//           </div>
//         )}

//         {!canManage&&<div className="shrink-0 px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2"><span className="text-xs text-amber-700 font-medium">👁️ You have view-only access. Only the Project Manager can edit tasks, columns, and settings.</span></div>}

//         <div className="flex-1 overflow-auto">
//           {/* DASHBOARD */}
//           {viewMode==="dashboard"&&(
//             <div className="p-5 space-y-5">
//               {/* Type summary row */}
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                 {(["story","task","bug","defect"] as const).map(t=>{
//                   const tm = TYPE_META[t];
//                   const cnt = tasks.filter(x=>x.type===t).length;
//                   return (
//                     <div key={t} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
//                       <span className="text-2xl">{tm.icon}</span>
//                       <div><p className="text-2xl font-black" style={{color:tm.color}}>{cnt}</p><p className="text-xs text-gray-400 capitalize">{tm.label}s</p></div>
//                     </div>
//                   );
//                 })}
//               </div>
//               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
//                 {[
//                   {label:"Total Items",val:tasks.length,color:"#6366f1",bg:"#eef2ff"},
//                   {label:"Completed",val:nonStoryTasks.filter(t=>t.status===doneColId).length,color:"#16a34a",bg:"#f0fdf4"},
//                   {label:"In Progress",val:nonStoryTasks.filter(t=>t.status==="inprogress").length,color:"#2563eb",bg:"#eff6ff"},
//                   {label:"Overdue",val:overdueTasks.length,color:"#dc2626",bg:"#fef2f2"},
//                   {label:"Total Hours",val:`${totalHours}h`,color:"#7c3aed",bg:"#f5f3ff"},
//                   {label:"Progress",val:`${activeProject.progress}%`,color:activeProject.color||"#6366f1",bg:"#f9fafb"},
//                 ].map(s=>(
//                   <div key={s.label} className="rounded-xl p-4 border" style={{background:s.bg,borderColor:s.color+"20"}}>
//                     <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:s.color}}>{s.label}</p>
//                     <p className="text-2xl font-black" style={{color:s.color}}>{s.val}</p>
//                   </div>
//                 ))}
//               </div>
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//                 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
//                   <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:activeProject.color||"#6366f1"}} />Story Overview</h3>
//                   <div className="space-y-3">
//                     {stories.length===0?<p className="text-xs text-gray-400 text-center py-4">No stories yet</p>
//                     :stories.map(story=>{
//                       const children = tasks.filter(t=>t.parentId===story.id);
//                       const done = children.filter(t=>t.status===doneColId).length;
//                       const pct = children.length?Math.round((done/children.length)*100):0;
//                       return (
//                         <div key={story.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={()=>setActiveTask(story)}>
//                           <span>📘</span>
//                           <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{story.title}</span>
//                           <div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${pct}%`,background:activeProject.color||"#6366f1"}} /></div>
//                           <span className="text-xs font-bold text-gray-500 w-10 text-right">{done}/{children.length}</span>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>
//                 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
//                   <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Overdue Work Items {overdueTasks.length>0&&<span className="ml-auto text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{overdueTasks.length} overdue</span>}</h3>
//                   {overdueTasks.length===0?<div className="flex flex-col items-center justify-center h-32 text-gray-300"><div className="text-3xl mb-2">✅</div><p className="text-xs">No overdue tasks!</p></div>
//                   :<div className="space-y-1 max-h-48 overflow-y-auto">
//                     {overdueTasks.slice(0,8).map(t=>{
//                       const tm2=TYPE_META[t.type||"task"];
//                       const daysLate=Math.floor((new Date().getTime()-new Date(t.dueDate!).getTime())/(1000*60*60*24));
//                       return(
//                         <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
//                           <div className="flex items-center gap-2 min-w-0"><span>{tm2.icon}</span><span className="text-xs font-medium text-gray-700 truncate">{t.title}</span></div>
//                           <span className="text-[11px] font-semibold text-red-500 shrink-0 ml-2">late {daysLate}d</span>
//                         </div>
//                       );
//                     })}
//                   </div>}
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* KANBAN */}
//           {viewMode==="kanban"&&(
//             <div className="h-full border border-gray-200 rounded-xl m-4 overflow-hidden bg-white shadow-sm flex flex-col">
//               <KanbanBoard
//                 tasks={filteredTasks}
//                 columns={columns}
//                 setColumns={setColumns}
//                 projectColor={activeProject.color||"#6366f1"}
//                 onTaskClick={setActiveTask}
//                 onStatusChange={handleTaskStatusChange}
//                 canManage={canManage}
//                 onSaveColumns={handleSaveColumns}
//               />
//             </div>
//           )}

//           {/* LIST */}
//           {viewMode==="list"&&(
//             <div className="p-6">
//               <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
//                 <table className="w-full">
//                   <thead><tr className="border-b border-gray-100 bg-gray-50">{["Type","Title","Status","Priority","Assignee","Est.","Due Date","Tags"].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
//                   <tbody>
//                     {filteredTasks.map(task=>{
//                       const pc=PRIORITY_CONFIG[task.priority];
//                       const tm2=TYPE_META[task.type||"task"];
//                       const col=columns.find(c=>c.id===task.status);
//                       const colIdx=columns.findIndex(c=>c.id===task.status);
//                       const cfg=getColConfig(col||{id:task.status,label:task.status},colIdx);
//                       const isOverdue=task.dueDate&&new Date(task.dueDate)<new Date()&&task.status!==doneColId;
//                       return(
//                         <tr key={task.id} onClick={()=>setActiveTask(task)} className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition group">
//                           <td className="px-4 py-3"><span title={tm2.label} className="text-lg">{tm2.icon}</span></td>
//                           <td className="px-4 py-3"><p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">{task.title}</p></td>
//                           <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs font-semibold"  style={{ color: cfg?.color || "#64748b" }}><div
//                            className="w-1.5 h-1.5 rounded-full"
//                            style={{ background: cfg?.color || "#64748b" }}
//                           />{col?.label||task.status}</span></td>
//                           <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{background:pc?.bg,color:pc?.color}}>{pc?.icon} {task.priority}</span></td>
//                           <td className="px-4 py-3">{task.assignedToName?<div className="flex items-center gap-2"><Avatar name={task.assignedToName} size="xs"/><span className="text-xs text-gray-600">{task.assignedToName}</span></div>:<span className="text-xs text-gray-300">—</span>}</td>
//                           <td className="px-4 py-3 text-xs font-semibold text-gray-600">{task.estimatedHours||0}h</td>
//                           <td className="px-4 py-3"><span className={`text-xs font-semibold ${isOverdue?"text-red-600":"text-gray-500"}`}>{task.dueDate||"—"}{isOverdue&&" ⚠️"}</span></td>
//                           <td className="px-4 py-3"><div className="flex gap-1">{task.tags?.slice(0,2).map(t=><span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}</div></td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//                 {filteredTasks.length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">📋</div><p className="text-sm">No tasks found</p></div>}
//               </div>
//             </div>
//           )}

//           {/* TIMELINE */}
//           {viewMode==="timeline"&&(
//             <div className="p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
//               <h3 className="font-bold text-gray-800 mb-6">Activity Stream</h3>
//               <div className="space-y-0">
//                 {activities.slice(0,60).map((a:any,i:number)=>(
//                   <div key={a.id} className="flex gap-4 relative">
//                     {i<activities.length-1&&<div className="absolute left-4 top-9 bottom-0 w-px bg-gray-100" />}
//                     <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5">{a.userName?.[0]?.toUpperCase()}</div>
//                     <div className="flex-1 pb-5"><div className="bg-gray-50 rounded-xl p-3 border border-gray-100"><div className="flex items-center justify-between mb-1"><p className="text-sm"><span className="font-semibold text-gray-800">{a.userName}</span> <span className="text-gray-500">{a.action}</span></p><span className="text-xs text-gray-400">{a.createdAt?.toDate().toLocaleString()}</span></div><p className="text-xs text-gray-600">{a.description}</p></div></div>
//                   </div>
//                 ))}
//                 {activities.length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">📜</div><p className="text-sm">No activity yet</p></div>}
//               </div>
//             </div></div>
//           )}

//           {/* WORKLOAD */}
//           {viewMode==="workload"&&(
//             <div className="p-6 space-y-5">
//               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
//                 {workloadData.map(({user:u,total,done,inProgress,blocked}:WorkloadItem)=>(
//                   <div key={u.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
//                     <div className="flex items-center gap-3 mb-4">
//                       <Avatar name={u.email} size="md" />
//                       <div><p className="font-bold text-gray-800 text-sm">{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</p><p className="text-xs text-gray-400">{total} tasks</p></div>
//                       <div className="ml-auto"><ProgressRing pct={total>0?Math.round((done/total)*100):0} size={44} stroke={4} color={activeProject.color||"#6366f1"} /></div>
//                     </div>
//                     <div className="space-y-2">
//                       {[{label:"Done",val:done,color:"#16a34a"},{label:"In Progress",val:inProgress,color:"#2563eb"},{label:"Blocked",val:blocked,color:"#dc2626"},{label:"Todo",val:total-done-inProgress-blocked,color:"#94a3b8"}].map(s=>(
//                         <div key={s.label} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}} /><span className="text-xs text-gray-500 flex-1">{s.label}</span><div className="flex-1 bg-gray-100 rounded-full h-1"><div className="h-1 rounded-full" style={{width:total>0?`${(s.val/total)*100}%`:"0%",background:s.color}} /></div><span className="text-xs font-bold text-gray-700 w-5 text-right">{s.val}</span></div>
//                       ))}
//                     </div>
//                     <div className="mt-4 pt-4 border-t border-gray-50"><p className="text-xs text-gray-400 mb-1">Hours logged</p><p className="text-2xl font-black" style={{color:activeProject.color||"#6366f1"}}>{workLogs.filter(l=>l.userId===u.uid).reduce((s,l)=>s+l.hoursWorked,0)}h</p></div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* REPORTS */}
//           {viewMode==="reports"&&(
//             <div className="p-6 space-y-5">
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                 {[{label:"Total Tasks",val:nonStoryTasks.length,sub:"excl. stories",color:"#6366f1"},{label:"Completed",val:nonStoryTasks.filter(t=>t.status===doneColId).length,sub:`${nonStoryTasks.length?Math.round((nonStoryTasks.filter(t=>t.status===doneColId).length/nonStoryTasks.length)*100):0}%`,color:"#16a34a"},{label:"Bugs",val:tasks.filter(t=>t.type==="bug").length,sub:"total bugs",color:"#dc2626"},{label:"Total Hours",val:`${totalHours}h`,sub:"all logged",color:"#7c3aed"}].map(s=>(
//                   <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p><p className="text-3xl font-black" style={{color:s.color}}>{s.val}</p><p className="text-xs text-gray-400 mt-1">{s.sub}</p></div>
//                 ))}
//               </div>
//               {/* Bug/Defect breakdown */}
//               <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
//                 <h3 className="font-bold text-gray-800 mb-4">Type Breakdown</h3>
//                 <div className="space-y-3">
//                   {(["story","task","bug","defect"] as const).map(t=>{
//                     const tm2=TYPE_META[t];
//                     const cnt=tasks.filter(x=>x.type===t).length;
//                     const pct=tasks.length?Math.round((cnt/tasks.length)*100):0;
//                     return(<div key={t} className="flex items-center gap-3"><span>{tm2.icon}</span><span className="text-xs font-semibold text-gray-600 w-16">{tm2.label}</span><div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${pct}%`,background:tm2.color}} /></div><span className="text-xs font-bold text-gray-700 w-8 text-right">{cnt}</span></div>);
//                   })}
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* GANTT */}
//           {viewMode==="gantt"&&(
//             <div className="p-6"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
//               <div className="p-5 border-b border-gray-50"><h3 className="font-bold text-gray-800">Task Timeline (Gantt)</h3></div>
//               <div className="p-5">
//                 {nonStoryTasks.filter(t=>t.dueDate).sort((a,b)=>new Date(a.dueDate!).getTime()-new Date(b.dueDate!).getTime()).map(task=>{
//                   const pc=PRIORITY_CONFIG[task.priority];
//                   const tm2=TYPE_META[task.type||"task"];
//                   const isOverdue=new Date(task.dueDate!)<new Date()&&task.status!==doneColId;
//                   return(
//                     <div key={task.id} onClick={()=>setActiveTask(task)} className="flex items-center gap-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition rounded-xl px-2 group">
//                       <div className="w-44 shrink-0"><div className="flex items-center gap-1.5"><span>{tm2.icon}</span><p className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-600">{task.title}</p></div>{task.assignedToName&&<p className="text-xs text-gray-400 pl-5">{task.assignedToName}</p>}</div>
//                       <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full flex items-center justify-end pr-2 min-w-10" style={{width:`${Math.max((task.actualHours||0)/(task.estimatedHours||1)*100,8)}%`,background:isOverdue?"#ef4444":(activeProject.color||"#6366f1"),opacity:task.status===doneColId?0.5:1}}><span className="text-[10px] font-bold text-white">{task.actualHours||0}h</span></div></div>
//                       <div className="w-28 shrink-0 flex items-center justify-end gap-2"><span className={`text-xs font-semibold ${isOverdue?"text-red-600":"text-gray-500"}`}>{task.dueDate}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:pc.bg,color:pc.color}}>{pc.icon}</span></div>
//                     </div>
//                   );
//                 })}
//                 {nonStoryTasks.filter(t=>t.dueDate).length===0&&<div className="text-center py-16 text-gray-300"><div className="text-5xl mb-3">📈</div><p className="text-sm">No tasks with due dates</p></div>}
//               </div>
//             </div></div>
//           )}
//         </div>
//       </div>
//     );
//   }

//   /* ══ MAIN HOME ══ */
//   const totalP=projects?.length||0;
//   const completedP=projects?.filter((p:any)=>p.status==="Completed").length||0;
//   const inProgressP=projects?.filter((p:any)=>p.status==="In Progress").length||0;
//   const billingP=projects?.filter((p:any)=>p.projectType==="Billing").length||0;

//   return (
//     <div className="min-h-screen" style={{background:"#f5f6fa",fontFamily:"'Inter', system-ui, sans-serif"}}>
//       <style>{`
//         .proj-card{transition:box-shadow 0.18s ease,transform 0.18s ease;}
//         .proj-card:hover{box-shadow:0 8px 32px rgba(0,0,0,0.10)!important;transform:translateY(-2px);}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
//         .modal-backdrop{animation:fadeIn 0.18s ease;}
//         .modal-panel{animation:slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);}
//         ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
//       `}</style>

//       {/* NEW / EDIT PROJECT MODAL */}
//       {showProjectForm&&(
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" style={{background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)"}}>
//           <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" style={{border:"1px solid #e5e7eb"}}>
//             <div className="shrink-0 px-6 py-5 flex items-center justify-between border-b border-gray-100">
//               <div><h2 className="text-base font-semibold text-gray-900">{editingProject?"Edit Project":"Create New Project"}</h2><p className="text-xs text-gray-400 mt-0.5">{editingProject?"Update project details":"Fill in the details to set up your project"}</p></div>
//               <button onClick={()=>{setShowProjectForm(false);setEditingProject(null);}} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-sm">✕</button>
//             </div>
//             <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
//               <div>
//                 <label className="text-xs font-medium text-gray-500 block mb-2">Project Color</label>
//                 <div className="flex gap-2">{PROJECT_COLORS.map(c=><button key={c} onClick={()=>setPf({...pf,color:c})} className="w-7 h-7 rounded-full transition-all hover:scale-110 shrink-0" style={{background:c,outline:pf.color===c?`2px solid ${c}`:"none",outlineOffset:"2px"}} />)}</div>
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Project Name <span className="text-red-400">*</span></label><input value={pf.name} onChange={e=>setPf({...pf,name:e.target.value})} placeholder="e.g. Website Redesign" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition" /></div>
//                 <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Client Name</label><input value={pf.clientName} onChange={e=>setPf({...pf,clientName:e.target.value})} placeholder="e.g. Acme Corp" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition" /></div>
//               </div>
//               <div><label className="text-xs font-medium text-gray-500 block mb-1.5">Description</label><textarea value={pf.description} onChange={e=>setPf({...pf,description:e.target.value})} placeholder="Brief project overview..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition resize-none" /></div>
//               <div className="grid grid-cols-2 gap-3">
//                 {[{label:"Billing Type",child:<select value={pf.projectType} onChange={e=>setPf({...pf,projectType:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition"><option value="Billing">Billing</option><option value="Non-Billing">Non-Billing</option></select>},{label:"Payment Model",child:<select value={pf.billingType} onChange={e=>setPf({...pf,billingType:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition"><option>Hourly</option><option>Fixed Cost</option><option>Internal</option></select>},{label:"Priority",child:<select value={pf.priority} onChange={e=>setPf({...pf,priority:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition">{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select>},{label:"Status",child:<select value={pf.status} onChange={e=>setPf({...pf,status:e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition">{["Not Started","Planning","In Progress","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}</select>},{label:"Budget ($)",child:<input type="number" value={pf.budget} onChange={e=>setPf({...pf,budget:e.target.value})} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />},{label:"Start Date",child:<input type="date" value={pf.startDate} onChange={e=>setPf({...pf,startDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />},{label:"End Date",child:<input type="date" value={pf.endDate} onChange={e=>setPf({...pf,endDate:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition" />}].map(({label,child})=>(<div key={label}><label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>{child}</div>))}
//                 <div>
//                   <label className="text-xs font-medium text-gray-500 block mb-1.5">Project Manager <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">Access Control</span></label>
//                   <select value={pf.projectManager} onChange={e=>setPf({...pf,projectManager:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition">
//                     <option value="">Select manager (defaults to you)</option>
//                     {users.map((u:any)=><option key={u.uid} value={u.uid}>{u.displayName||u.name||u.email?.split("@")[0]||"Unknown"}</option>)}
//                   </select>
//                   <p className="text-[10px] text-gray-400 mt-1">The PM can add/delete columns, create/edit/delete tasks, and edit the project.</p>
//                 </div>
//               </div>
//               <MemberPicker users={users} currentUid={user.uid} selected={pf.selectedMembers} onChange={(sel:string[])=>setPf({...pf,selectedMembers:sel})} />
//             </div>
//             <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
//               <button onClick={()=>{setShowProjectForm(false);setEditingProject(null);}} className="inline-flex items-center px-4 py-2 text-sm text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
//               <button onClick={handleSaveProject} className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition" style={{background:"#4f46e5"}}>{editingProject?"Save Changes":"Create Project"}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* TOP HEADER */}
//       <div className="bg-white border-b border-gray-200 px-6 py-0 sticky top-0 z-30" style={{boxShadow:"0 1px 0 #e5e7eb"}}>
//         <div className="max-w-screen-2xl mx-auto flex items-center justify-between h-14 gap-6">
//           <div className="flex items-center gap-3">
//             <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:"#4f46e5"}}>PH</div>
//             <div><h1 className="text-sm font-semibold text-gray-900">Project Hub</h1><p className="text-[10px] text-gray-400">Manage &amp; track all company projects</p></div>
//           </div>
//           <div className="flex items-center gap-2">
//             <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
//               <button onClick={()=>setMainTab("projects")} className="px-4 py-1.5 text-xs font-medium transition" style={mainTab==="projects"?{background:"white",color:"#4f46e5",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}:{color:"#6b7280"}}>Projects</button>
//               <button onClick={()=>setMainTab("dailysheet")} className="px-4 py-1.5 text-xs font-medium transition" style={mainTab==="dailysheet"?{background:"white",color:"#4f46e5",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}:{color:"#6b7280"}}>Daily Sheets</button>
//             </div>
//             {mainTab==="projects"&&<>
//               <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
//                 <button onClick={()=>setProjectsView("grid")} className="px-2.5 py-1.5 transition text-sm" style={projectsView==="grid"?{background:"#4f46e5",color:"white"}:{background:"white",color:"#9ca3af"}}>⊞</button>
//                 <button onClick={()=>setProjectsView("list")} className="px-2.5 py-1.5 transition text-sm" style={projectsView==="list"?{background:"#4f46e5",color:"white"}:{background:"white",color:"#9ca3af"}}>☰</button>
//               </div>
//               <button onClick={()=>{setEditingProject(null);setShowProjectForm(true);}} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition hover:opacity-90" style={{background:"#4f46e5"}}>+ New Project</button>
//             </>}
//           </div>
//         </div>
//       </div>

//       <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">
//         {mainTab==="dailysheet"&&<AdminDailySheet user={user} users={users} projects={projects||[]} />}
//         {mainTab==="projects"&&<>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//             {[{label:"Total Projects",val:totalP,color:"#4f46e5",bg:"#eef2ff",border:"#c7d2fe"},{label:"Completed",val:completedP,color:"#059669",bg:"#ecfdf5",border:"#a7f3d0"},{label:"In Progress",val:inProgressP,color:"#d97706",bg:"#fffbeb",border:"#fde68a"},{label:"Billing Projects",val:billingP,color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe"}].map(s=>(
//               <div key={s.label} className="bg-white rounded-xl p-4 flex items-center gap-4" style={{border:`1px solid ${s.border}`,boxShadow:`0 1px 4px ${s.color}12`}}>
//                 <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{background:s.bg}}><span className="text-xl font-black" style={{color:s.color}}>{s.val}</span></div>
//                 <div><p className="text-xs text-gray-400 leading-tight">{s.label}</p><p className="text-lg font-bold text-gray-800 leading-tight">{s.val}</p></div>
//               </div>
//             ))}
//           </div>
//           {projects?.length===0&&(
//             <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-200">
//               <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4" style={{background:"#eef2ff"}}>📁</div>
//               <p className="text-sm font-semibold text-gray-700">No projects yet</p>
//               <p className="text-xs text-gray-400 mt-1 mb-5">Create your first project to get started</p>
//               <button onClick={()=>setShowProjectForm(true)} className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white rounded-lg" style={{background:"#4f46e5"}}>+ New Project</button>
//             </div>
//           )}
//           {projectsView==="grid"&&projects?.length>0&&(
//             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
//               {projects?.map((project:any)=>{
//                 const sc=STATUS_CONFIG[project.status];
//                 const pc=PRIORITY_CONFIG[project.priority];
//                 const accentColor=project.color||"#4f46e5";
//                 const memberList=project.members?.slice(0,5).map((uid:string)=>users.find((u:any)=>u.uid===uid)).filter(Boolean);
//                 const isPM=project.projectManager===user.uid||project.createdBy===user.uid;
//                 return(
//                   <div key={project.id} className="proj-card bg-white rounded-xl overflow-hidden cursor-pointer group" style={{border:"1px solid #e5e7eb",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}} onClick={()=>{setActiveProject(project);setViewMode("dashboard");}}>
//                     <div className="p-4">
//                       <div className="flex items-start justify-between gap-2 mb-3">
//                         <div className="flex items-center gap-2.5 min-w-0">
//                           <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{background:accentColor}}>{project.name[0]?.toUpperCase()}</div>
//                           <div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900 truncate leading-tight group-hover:text-indigo-700 transition">{project.name}</h3>{project.clientName&&<p className="text-[11px] text-gray-400 truncate mt-0.5">{project.clientName}</p>}</div>
//                         </div>
//                         <div className="flex items-center gap-1.5 shrink-0">
//                           {isPM&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">👑 PM</span>}
//                           <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{background:sc?.bg,color:sc?.color}}>{project.status}</span>
//                         </div>
//                       </div>
//                       <p className="text-xs text-gray-400 line-clamp-1 mb-3">{project.description||"No description."}</p>
//                       <div className="flex flex-wrap gap-1 mb-3">
//                         {project.projectType==="Billing"&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Billing</span>}
//                         {project.billingType&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">{project.billingType}</span>}
//                         <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{background:pc?.bg,color:pc?.color,borderColor:pc?.color+"30"}}>{project.priority}</span>
//                         {project.endDate&&<span className="text-[10px] text-gray-400 ml-auto">Due {project.endDate}</span>}
//                       </div>
//                       <div className="mb-3">
//                         <div className="flex justify-between items-center mb-1"><span className="text-[10px] text-gray-400">Progress</span><span className="text-[10px] font-semibold" style={{color:accentColor}}>{project.progress||0}%</span></div>
//                         <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:`${project.progress||0}%`,background:accentColor}} /></div>
//                       </div>
//                       <div className="flex items-center justify-between">
//                         <div className="flex -space-x-1.5">{memberList?.map((u:any,i:number)=><div key={i} title={u?.email?.split("@")[0]} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold" style={{background:["#6366f1","#7c3aed","#db2777","#d97706","#059669"][i%5]}}>{u?.email?.[0]?.toUpperCase()}</div>)}{project.members?.length>5&&<span className="text-[10px] text-gray-400 pl-2">+{project.members.length-5}</span>}</div>
//                         {isPM&&<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
//                           <button onClick={e=>{e.stopPropagation();handleEditProject(project);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition text-xs">✏️</button>
//                           <button onClick={e=>{e.stopPropagation();handleDeleteProject(project.id);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition text-xs">🗑️</button>
//                         </div>}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//               <div onClick={()=>setShowProjectForm(true)} className="proj-card rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all min-h-50 group">
//                 <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center text-gray-300 group-hover:text-indigo-500 text-xl transition">+</div>
//                 <div className="text-center"><p className="text-xs font-medium text-gray-400 group-hover:text-indigo-600 transition">New Project</p><p className="text-[10px] text-gray-300 mt-0.5">Click to create</p></div>
//               </div>
//             </div>
//           )}
//           {projectsView==="list"&&projects?.length>0&&(
//             <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
//               <table className="w-full">
//                 <thead><tr className="border-b border-gray-100 bg-gray-50/70">{["Project","Status","Priority","Type","Progress","PM","Members","End Date",""].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
//                 <tbody>
//                   {projects?.map((project:any)=>{
//                     const sc=STATUS_CONFIG[project.status];
//                     const pc=PRIORITY_CONFIG[project.priority];
//                     const pm=users.find((u:any)=>u.uid===project.projectManager);
//                     const isPM=project.projectManager===user.uid||project.createdBy===user.uid;
//                     return(
//                       <tr key={project.id} onClick={()=>{setActiveProject(project);setViewMode("dashboard");}} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition group">
//                         <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:project.color||"#4f46e5"}}>{project.name[0]?.toUpperCase()}</div><div><p className="text-sm font-medium text-gray-800">{project.name}</p>{project.clientName&&<p className="text-[11px] text-gray-400">{project.clientName}</p>}</div></div></td>
//                         <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{background:sc?.bg,color:sc?.color}}>{project.status}</span></td>
//                         <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded border" style={{background:pc?.bg,color:pc?.color,borderColor:pc?.color+"30"}}>{project.priority}</span></td>
//                         <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${project.projectType==="Billing"?"bg-emerald-50 text-emerald-600":"bg-gray-100 text-gray-500"}`}>{project.projectType}</span></td>
//                         <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${project.progress||0}%`,background:project.color||"#4f46e5"}} /></div><span className="text-[11px] font-medium" style={{color:project.color||"#4f46e5"}}>{project.progress||0}%</span></div></td>
//                         <td className="px-4 py-3">{pm?<div className="flex items-center gap-1.5"><Avatar name={pm.email} size="xs" /><span className="text-[11px] text-gray-600 truncate max-w-20">{pm.displayName||pm.name||pm.email?.split("@")[0]||"—"}</span></div>:<span className="text-[11px] text-gray-300">—</span>}</td>
//                         <td className="px-4 py-3"><div className="flex -space-x-1.5">{project.members?.slice(0,4).map((uid:string,i:number)=>{const m=users.find((u:any)=>u.uid===uid);const mName=m?.displayName||m?.name||m?.email?.split("@")[0]||"?";return<div key={i} title={mName} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold" style={{background:["#6366f1","#7c3aed","#db2777","#d97706"][i%4]}}>{mName[0]?.toUpperCase()}</div>;})}</div></td>
//                         <td className="px-4 py-3 text-xs text-gray-500">{project.endDate||"—"}</td>
//                         <td className="px-4 py-3">{isPM&&<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={e=>{e.stopPropagation();handleEditProject(project);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 text-xs">✏️</button><button onClick={e=>{e.stopPropagation();handleDeleteProject(project.id);}} className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs">🗑️</button></div>}</td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </>}
//       </div>
//     </div>
//   );
// }
