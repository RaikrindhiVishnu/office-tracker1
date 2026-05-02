"use client";

import { onAuthStateChanged } from "firebase/auth";
import { logActivity } from "@/lib/notifications";
import NotificationBell from "@/components/NotificationBell";
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, writeBatch,
  Timestamp, limit,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/common/ProtectedRoute";

import MonthlyReport        from "@/app/(dashboard)/admin/monthlyreport";
import IncomingCallListener from "@/components/IncomingCallListener";
import EmployeeTodayPanel   from "@/components/EmployeeTodayPanel";
import CrossDeptFeed from "@/components/CrossDeptFeed";

import type { AttendanceType } from "@/types/attendance";
import type { Employee }       from "@/types/Employee";
import type { Session }        from "@/types/Employee";
import type { EmployeeRow }    from "@/types/EmployeeRow";

// ── Types ─────────────────────────────────────────────────────────────────────
type HRView = "dashboard"|"leave"|"employees"|"attendance"|"payslips"|"announcements"|"queries";

interface Notification { id:string; toUid:string; title:string; message:string; read:boolean; createdAt:Timestamp; }
interface LeaveRequest  { id:string; uid:string; userName:string; userEmail:string; leaveType:string; fromDate:string; toDate:string; reason:string; status:"Pending"|"Approved"|"Rejected"; createdAt:any; }
interface Query         { id:string; uid:string; userName:string; userEmail:string; subject:string; message:string; status:"open"|"resolved"; adminUnread:boolean; reply?:string; createdAt:any; }
interface Break         { type:"MORNING"|"LUNCH"|"EVENING"; startTime:Timestamp; endTime?:Timestamp; }
interface WorkUpdate    { id:string; uid:string; userEmail:string; userName:string; task:string; notes:string; status:string; priority:string; createdAt:Timestamp; }

const HOLIDAYS: Record<string,{title:string}> = {
  "2026-01-01":{title:"New Year"},"2026-01-13":{title:"Bhogi"},"2026-01-14":{title:"Pongal"},
  "2026-03-04":{title:"Holi"},"2026-03-19":{title:"Ugadi"},"2026-08-15":{title:"Independence Day"},
  "2026-08-28":{title:"Raksha Bandhan"},"2026-09-14":{title:"Ganesh Chaturthi"},
  "2026-10-02":{title:"Gandhi Jayanthi"},"2026-10-20":{title:"Dussehra"},
  "2026-11-08":{title:"Diwali"},"2026-12-25":{title:"Christmas"},
};

const getTodayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtTime     = (ts:any) => ts ? ts.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "--";
const fmtTotal    = (m?:number) => { const min=m??0; const h=Math.floor(min/60); const r=min%60; if(!h&&!r) return "0m"; return h ? `${h}h ${r}m` : `${r}m`; };
const calcMins    = (sessions:Session[]) => { let t=0; for(const s of sessions){ if(!s?.checkIn) continue; const a=s.checkIn?.toDate?s.checkIn.toDate().getTime():new Date(s.checkIn as any).getTime(); const b=s.checkOut?(s.checkOut?.toDate?s.checkOut.toDate().getTime():new Date(s.checkOut as any).getTime()):Date.now(); if(b-a>0) t+=Math.floor((b-a)/60000); } return t; };
const calcBreakSec= (breaks:Break[]) => breaks.reduce((a,b)=>{ if(!b.startTime) return a; const s=b.startTime.toDate().getTime(); const e=b.endTime?b.endTime.toDate().getTime():s; return a+Math.max(0,Math.floor((e-s)/1000)); },0);
const fmtBreak    = (sec:number) => { if(!sec||sec<=0) return "—"; const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); if(h>0) return `${h}h ${m}m`; return m>0?`${m}m`:`${sec}s`; };
const activeBreak = (breaks:Break[]) => { const a=breaks.find(b=>b.startTime&&!b.endTime); if(!a) return null; return a.type==="MORNING"?"☕ Morning":a.type==="LUNCH"?"🍱 Lunch":"🌆 Evening"; };
const isSunday    = (y:number,m:number,d:number) => new Date(y,m,d).getDay()===0;
const isSecSat    = (y:number,m:number,d:number) => { const dt=new Date(y,m,d); return dt.getDay()===6&&Math.ceil(d/7)===2; };
const isFourthSat = (y:number,m:number,d:number) => { const dt=new Date(y,m,d); return dt.getDay()===6&&Math.ceil(d/7)===4; };
const isFifthSat  = (y:number,m:number,d:number) => { const dt=new Date(y,m,d); return dt.getDay()===6&&Math.ceil(d/7)===5; };
const isHoliday   = (ds:string) => HOLIDAYS[ds];

const WU_STATUS: Record<string,{icon:string;bg:string;color:string;dot:string}> = {
  "In Progress":{icon:"🔄",bg:"bg-blue-50",color:"text-blue-700",dot:"bg-blue-500"},
  "Completed":{icon:"✅",bg:"bg-emerald-50",color:"text-emerald-700",dot:"bg-emerald-500"},
  "Blocked":{icon:"🚫",bg:"bg-red-50",color:"text-red-700",dot:"bg-red-500"},
  "Review":{icon:"👀",bg:"bg-purple-50",color:"text-purple-700",dot:"bg-purple-500"},
};

// ── WorkUpdate tooltip ────────────────────────────────────────────────────────
function WUTooltip({ wu }: { wu:WorkUpdate|null }) {
  const [vis,setVis] = useState(false);
  const [pos,setPos] = useState({top:0,left:0,above:false});
  const ref = useRef<HTMLDivElement>(null);
  const W=260,H=180;
  const compute = useCallback(()=>{ if(!ref.current) return; const r=ref.current.getBoundingClientRect(); const above=window.innerHeight-r.bottom<H+16&&r.top>H+16; let left=r.left; if(left+W>window.innerWidth-8) left=window.innerWidth-W-8; if(left<8) left=8; setPos({top:above?r.top-H-8:r.bottom+8,left,above}); },[]);
  if(!wu) return <span className="text-gray-300 text-sm">—</span>;
  const sc=WU_STATUS[wu.status]??WU_STATUS["In Progress"];
  const fmt=(ts:Timestamp|null|undefined)=>ts?ts.toDate().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—";
  const tip=vis?createPortal(
    <div style={{position:"fixed",top:pos.top,left:pos.left,width:W,zIndex:99999}}
      onMouseEnter={()=>setVis(true)} onMouseLeave={()=>setVis(false)}
      className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 text-xs border border-gray-700/50">
      <p className="font-semibold text-white text-sm leading-snug mb-2">{wu.task}</p>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full mb-2 ${sc.bg} ${sc.color}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{wu.status}</span>
      {wu.notes&&<p className="text-gray-400 italic text-[11px] leading-relaxed mb-2 border-t border-gray-700 pt-2">"{wu.notes}"</p>}
      <p className="text-gray-500 text-[10px] border-t border-gray-700 pt-2">Submitted at {fmt(wu.createdAt)}</p>
    </div>, document.body
  ):null;
  return (
    <>
      <div ref={ref} onMouseEnter={()=>{compute();setVis(true);}} onMouseLeave={()=>setVis(false)} className="cursor-pointer max-w-xs truncate">
        <span className="text-gray-700 text-sm truncate block hover:text-teal-600 transition-colors">{wu.task||"—"}</span>
      </div>
      {tip}
    </>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({name,photo,size="md"}:{name?:string;photo?:string;size?:"sm"|"md"|"lg"|"xl"}) {
  const sz={sm:"w-8 h-8 text-xs",md:"w-9 h-9 text-sm",lg:"w-11 h-11 text-base",xl:"w-14 h-14 text-lg"};
  const pal=["bg-teal-500","bg-emerald-500","bg-cyan-500","bg-green-600","bg-teal-600","bg-emerald-600"];
  const c=pal[(name?.charCodeAt(0)??0)%pal.length];
  if(photo) return <img src={photo} alt={name} className={`${sz[size]} rounded-full object-cover ring-2 ring-white`}/>;
  return <div className={`${sz[size]} ${c} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>{name?.[0]?.toUpperCase()??"?"}</div>;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({label,value,sub,icon,trend,accent=false}:{label:string;value:string|number;sub?:string;icon:React.ReactNode;trend?:string;accent?:boolean}) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-3 ${accent?"bg-teal-600 text-white":"bg-white border border-gray-100"}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent?"bg-white/20":"bg-teal-50"}`}>
          <span className={accent?"text-white":"text-teal-600"}>{icon}</span>
        </div>
        {trend&&<span className={`text-xs font-semibold px-2 py-1 rounded-lg ${accent?"bg-white/20 text-white":"bg-teal-50 text-teal-700"}`}>{trend}</span>}
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${accent?"text-white":"text-gray-900"}`}>{value}</p>
        <p className={`text-xs mt-0.5 font-medium ${accent?"text-teal-100":"text-gray-400"}`}>{label}</p>
        {sub&&<p className={`text-[11px] mt-1 ${accent?"text-teal-200":"text-teal-600 font-medium"}`}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function Badge({status}:{status:string}) {
  const m:Record<string,string>={
    Pending:"bg-amber-50 text-amber-700 border border-amber-200",
    Approved:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    Rejected:"bg-red-50 text-red-600 border border-red-200",
    open:"bg-amber-50 text-amber-700 border border-amber-200",
    resolved:"bg-teal-50 text-teal-700 border border-teal-200",
    ONLINE:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    OFFLINE:"bg-gray-100 text-gray-500 border border-gray-200",
  };
  return <span className={`${m[status]??"bg-gray-100 text-gray-600"} px-2.5 py-0.5 rounded-full text-[11px] font-semibold`}>{status}</span>;
}

// ── Detail Field ──────────────────────────────────────────────────────────────
function Field({label,value}:{label:string;value:string}) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value||"—"}</p>
    </div>
  );
}

// ── Widget Holidays data ──────────────────────────────────────────────────────
const WIDGET_HOLIDAYS = [
  {date:"2026-01-01",title:"New Year"},
  {date:"2026-01-13",title:"Bhogi"},
  {date:"2026-01-14",title:"Pongal"},
  {date:"2026-03-04",title:"Holi"},
  {date:"2026-03-19",title:"Ugadi"},
  {date:"2026-08-15",title:"Independence Day"},
  {date:"2026-08-28",title:"Raksha Bandhan"},
  {date:"2026-09-14",title:"Ganesh Chaturthi"},
  {date:"2026-10-02",title:"Gandhi Jayanthi"},
  {date:"2026-10-20",title:"Dussehra"},
  {date:"2026-11-08",title:"Diwali"},
  {date:"2026-12-25",title:"Christmas"},
];

// ── Mini Calendar Widget ──────────────────────────────────────────────────────
function CalendarWidget({date,setDate,holidays,isSunday,isSecSat,isFourthSat}:{
  date:Date; setDate:(d:Date)=>void;
  holidays:{date:string;title:string}[];
  isSunday:(y:number,m:number,d:number)=>boolean;
  isSecSat:(y:number,m:number,d:number)=>boolean;
  isFourthSat:(y:number,m:number,d:number)=>boolean;
}) {
  const y=date.getFullYear(), m=date.getMonth();
  const todayStr=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const cells:Array<number|null>=Array(firstDay).fill(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);
  const isHol=(d:number)=>holidays.some(h=>h.date===`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  const isWeekOff=(d:number)=>isSunday(y,m,d)||isSecSat(y,m,d)||isFourthSat(y,m,d);
  const isToday=(d:number)=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`===todayStr;
  const prev=()=>setDate(new Date(y,m-1,1));
  const next=()=>setDate(new Date(y,m+1,1));
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">{monthNames[m]} {y}</h3>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const today=isToday(d), hol=isHol(d), woff=isWeekOff(d);
          return (
            <div key={i} className="flex items-center justify-center">
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-semibold cursor-default transition
                ${today?"bg-teal-600 text-white shadow-sm shadow-teal-200"
                  :hol?"bg-teal-50 text-teal-600 ring-1 ring-teal-200"
                  :woff?"text-red-400"
                  :"text-gray-600 hover:bg-gray-50"}`}>
                {d}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"/><span className="text-[10px] text-gray-400">Today</span></div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-50 ring-1 ring-teal-200 inline-block"/><span className="text-[10px] text-gray-400">Holiday</span></div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-100 inline-block"/><span className="text-[10px] text-red-400">Week Off</span></div>
      </div>
    </div>
  );
}

// ── Sidebar Nav Item ──────────────────────────────────────────────────────────
function SideNavItem({label,icon,active,onClick,badge}:{label:string;icon:React.ReactNode;active:boolean;onClick:()=>void;badge?:number}) {
  return (
    <button onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
        active
          ? "bg-teal-600 text-white shadow-sm shadow-teal-200"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
      }`}>
      <span className="text-base shrink-0">{icon}</span>
      <span>{label}</span>
      {badge!==undefined&&badge>0&&(
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${active?"bg-white/30 text-white":"bg-teal-100 text-teal-700"}`}>{badge>9?"9+":badge}</span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function HRDashboard() {
  const {user,userData,loading} = useAuth();
  const router = useRouter();

  useEffect(() => {
  if (!loading && !user) {
    router.replace("/login");
  }
}, [user, loading, router]); // ✅ ALWAYS SAME

  const [view,setView]            = useState<HRView>("dashboard");
  const [widgetDate, setWidgetDate] = useState(new Date());
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [todayPanel,setTodayPanel]= useState<EmployeeRow|null>(null);

  const [rows,setRows]               = useState<EmployeeRow[]>([]);
  const [users,setUsers]             = useState<Employee[]>([]);
  const [leaves,setLeaves]           = useState<LeaveRequest[]>([]);
  const [queries,setQueries]         = useState<Query[]>([]);
  const [msgs,setMsgs]               = useState<{id:string;text:string;createdAt:any}[]>([]);
  const [notifs,setNotifs]           = useState<Notification[]>([]);
  const [monthlyAtt,setMonthlyAtt]   = useState<Record<string,Record<string,AttendanceType>>>({});
  const [monthlyDate,setMonthlyDate] = useState(new Date());
  const [busy,setBusy]               = useState(true);
  const [queryUnread,setQueryUnread] = useState(0);

  const [breakData,setBreakData]     = useState<Record<string,Break[]>>({});
  const [wuMap,setWuMap]             = useState<Record<string,WorkUpdate>>({});
  const [search,setSearch]           = useState("");
  const [statusFilter,setStatusFilter] = useState<"ALL"|"ONLINE"|"OFFLINE">("ALL");
  const [page,setPage]               = useState(1);
  const PER_PAGE = 8;

  const [selEmp,setSelEmp]   = useState<Employee|null>(null);
  const [editEmp,setEditEmp] = useState<Employee|null>(null);
  const [editing,setEditing] = useState(false);
  const [editMsg,setEditMsg] = useState("");

  const [payEmpId,setPayEmpId] = useState("");
  const [payMonth,setPayMonth] = useState(()=>{ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [payData,setPayData]   = useState<any>(null);
  const [genPay,setGenPay]     = useState(false);

  const [newMsg,setNewMsg]     = useState("");
  const [sending,setSending]   = useState(false);

  const [replyTo,setReplyTo]   = useState<string|null>(null);
  const [replyTxt,setReplyTxt] = useState("");
  const [replying,setReplying] = useState(false);

  const [empSearch,setEmpSearch]    = useState("");
  const [leaveFilter,setLeaveFilter]= useState<"All"|"Pending"|"Approved"|"Rejected">("All");

  const [notifOpen,setNotifOpen] = useState(false);
  const unreadN = notifs.filter(n=>!n.read).length;

  const monthKey = `${monthlyDate.getFullYear()}-${String(monthlyDate.getMonth()+1).padStart(2,"0")}`;

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadRows = useCallback(async(date?:string)=>{
    setBusy(true);
    const td=date||getTodayStr();
    const snap=await getDocs(collection(db,"users"));
    const data:EmployeeRow[]=[];
    for(const u of snap.docs){
      const uid=u.id; const ud=u.data();
      const a=await getDoc(doc(db,"attendance",`${uid}_${td}`));
      const sess:Session[]=a.exists()?(a.data().sessions||[]):[];
      const sorted=[...sess].sort((x,y)=>{ const xt=x.checkIn?.toDate?x.checkIn.toDate().getTime():new Date(x.checkIn as any).getTime(); const yt=y.checkIn?.toDate?y.checkIn.toDate().getTime():new Date(y.checkIn as any).getTime(); return xt-yt; });
      const last=sess[sess.length-1];
      const upd=await getDoc(doc(db,"dailyUpdates",`${uid}_${td}`));
      data.push({id:uid,uid,name:ud.name,email:ud.email,profilePhoto:ud.profilePhoto||"",sessions:sorted,morningCheckIn:sorted[0]?.checkIn??null,status:last&&!last.checkOut?"ONLINE":"OFFLINE",totalMinutes:calcMins(sorted),task:upd.exists()?upd.data().currentTask:"—"});
    }
    setRows(data); setBusy(false);
  },[]);

  const loadUsers = useCallback(async()=>{ const s=await getDocs(collection(db,"users")); setUsers(s.docs.map(d=>({id:d.id,uid:d.id,...(d.data() as any)}))); },[]);
  const loadLeaves= useCallback(async()=>{ const s=await getDocs(query(collection(db,"leaveRequests"),orderBy("createdAt","desc"))); setLeaves(s.docs.map(d=>({id:d.id,...(d.data() as any)}))); },[]);
  const loadMsgs  = useCallback(async()=>{ const s=await getDocs(query(collection(db,"messages"),orderBy("createdAt","desc"))); setMsgs(s.docs.map(d=>({id:d.id,...(d.data() as any)}))); },[]);
  const loadMonthly=useCallback(async()=>{ const s=await getDoc(doc(db,"monthlyAttendance",monthKey)); setMonthlyAtt(s.exists()?(s.data() as any):{}); },[monthKey]);

  useEffect(()=>{ if(busy||rows.length===0) return; const td=getTodayStr(); Promise.all(rows.map(async r=>{ try{ const s=await getDoc(doc(db,"attendance",`${r.uid}_${td}`)); return {uid:r.uid,breaks:s.exists()?(s.data().breaks??[]):[]}; }catch{return{uid:r.uid,breaks:[]};} })).then(res=>{ const m:Record<string,Break[]>={}; res.forEach(({uid,breaks})=>{m[uid]=breaks;}); setBreakData(m); }); },[busy,rows.length]);

  useEffect(()=>{ const ts=new Date(); ts.setHours(0,0,0,0); const q=query(collection(db,"workUpdates"),orderBy("createdAt","desc"),limit(200)); return onSnapshot(q,snap=>{ const all=snap.docs.map(d=>({id:d.id,...d.data()} as WorkUpdate)); const today=all.filter(u=>{ if(!u.createdAt) return false; const d=new Date(u.createdAt.toDate()); d.setHours(0,0,0,0); return d.getTime()===ts.getTime(); }); const m:Record<string,WorkUpdate>={}; today.forEach(u=>{if(!m[u.uid]) m[u.uid]=u;}); setWuMap(m); }); },[]);

  useEffect(()=>{ if(loading||!user) return; const u1=onSnapshot(query(collection(db,"employeeQueries"),where("adminUnread","==",true)),s=>setQueryUnread(s.size)); const u2=onSnapshot(query(collection(db,"employeeQueries"),orderBy("createdAt","desc")),s=>setQueries(s.docs.map(d=>({id:d.id,...(d.data() as any)})))); const u3=onSnapshot(query(collection(db,"notifications"),where("toUid","==",user.uid),orderBy("createdAt","desc")),s=>setNotifs(s.docs.map(d=>({id:d.id,...(d.data() as any)})))); loadRows(); loadUsers(); loadLeaves(); loadMsgs(); loadMonthly(); const iv=setInterval(loadRows,60000); return ()=>{u1();u2();u3();clearInterval(iv);}; },[loading,user]);
  useEffect(()=>{ loadMonthly(); },[monthKey]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const logout = async()=>{ await signOut(auth); router.push("/login"); };

  const approveLeave = async(id:string,st:"Approved"|"Rejected",leave:LeaveRequest)=>{
    await setDoc(doc(db,"leaveRequests",id),{status:st,updatedAt:serverTimestamp()},{merge:true});
    await addDoc(collection(db,"notifications"),{toUid:leave.uid,title:st==="Approved"?"✅ Leave Approved":"❌ Leave Rejected",message:`Your ${leave.leaveType} leave from ${leave.fromDate} to ${leave.toDate} has been ${st.toLowerCase()}.`,read:false,createdAt:serverTimestamp()});
    if(st==="Approved"){ const es=await getDoc(doc(db,"users",leave.uid)); if(es.exists()){ const b=es.data()?.leaveBalance||{}; const k=leave.leaveType==="Sick"?"sick":leave.leaveType==="Casual"?"casual":"annual"; if(typeof b[k]==="number"&&b[k]>0) await updateDoc(doc(db,"users",leave.uid),{[`leaveBalance.${k}`]:b[k]-1}); } }
    await loadLeaves();
    await logActivity({
  type: "LEAVE_APPROVED",
  title: "Leave approved",
  message: `${leave.userName}'s ${leave.leaveType} leave (${leave.fromDate} → ${leave.toDate}) approved`,
  icon: "✅",
  createdBy: userData?.name || "HR",
  visibleTo: ["hr", "admin"],
  priority: "low",
});
  };

  const saveEmp = async()=>{ if(!editEmp) return; setEditMsg(""); await updateDoc(doc(db,"users",editEmp.id),{name:editEmp.name,designation:editEmp.designation,department:editEmp.department,salary:editEmp.salary,updatedAt:serverTimestamp()}); setSelEmp({...editEmp}); setEditing(false); setEditMsg("✅ Updated"); setTimeout(()=>setEditMsg(""),3000); await loadUsers(); };

  const broadcast = async()=>{
  if(!newMsg.trim()) return;
  setSending(true);

  await addDoc(collection(db,"messages"),{
    text:newMsg.trim(),
    createdAt:serverTimestamp()
  });

  // 🔔 ADD THIS HERE
  await logActivity({
    type: "ANNOUNCEMENT",
    title: "New announcement",
    message: newMsg.trim().slice(0, 100),
    icon: "📣",
    createdBy: userData?.name || "HR",
    visibleTo: ["sales", "finance", "hr"],
    priority: "medium",
  });

  setNewMsg("");
  await loadMsgs();
  setSending(false);
};

  const reply = async(qid:string,uid:string)=>{ if(!replyTxt.trim()) return; setReplying(true); const b=writeBatch(db); b.update(doc(db,"employeeQueries",qid),{reply:replyTxt.trim(),status:"resolved",adminUnread:false,repliedAt:serverTimestamp()}); await b.commit(); await addDoc(collection(db,"notifications"),{toUid:uid,title:"💬 Query Answered",message:replyTxt.trim().slice(0,120),read:false,createdAt:serverTimestamp()}); setReplyTo(null); setReplyTxt(""); setReplying(false); };

  const markRead = async()=>{ const b=writeBatch(db); notifs.filter(n=>!n.read).forEach(n=>b.update(doc(db,"notifications",n.id),{read:true})); await b.commit(); };

  const genPayslip = async()=>{ if(!payEmpId||!payMonth) return; setGenPay(true); const emp=users.find(u=>u.id===payEmpId); if(!emp){setGenPay(false);return;} const [yr,mo]=payMonth.split("-").map(Number); const dim=new Date(yr,mo,0).getDate(); let pres=0; for(let d=1;d<=dim;d++){const ds=`${yr}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; const s=await getDoc(doc(db,"attendance",`${emp.id}_${ds}`)); if(s.exists()&&(s.data().sessions?.length??0)>0) pres++;} const sal=(emp as any).salary??0; const ppd=sal/dim; const lop=dim-pres; const ded=Math.round(ppd*lop); setPayData({emp,salary:sal,presentDays:pres,lopDays:lop,lopDeduct:ded,netSalary:Math.max(0,sal-ded),payMonth,daysInMonth:dim}); setGenPay(false); };

  const saveAtt = async(uid:string,dateStr:string,s:AttendanceType)=>{ await setDoc(doc(db,"monthlyAttendance",monthKey),{[uid]:{[dateStr]:s},updatedAt:serverTimestamp()},{merge:true}); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const sbd:Record<string,string[]>={};
  rows.forEach(r=>{ r.sessions.forEach(s=>{ if(!s.checkIn) return; const d=(s.checkIn as any).toDate(); const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const k=`${r.uid}_${ds}`; if(!sbd[k]) sbd[k]=[]; sbd[k].push("S"); }); });

  const total   = rows.length;
  const online  = rows.filter(r=>r.status==="ONLINE").length;
  const offline = rows.filter(r=>r.status==="OFFLINE").length;
  const pendL   = leaves.filter(l=>l.status==="Pending").length;
  const openQ   = queries.filter(q=>q.status==="open").length;
  const avgWork = total>0?Math.round(rows.reduce((s,r)=>s+r.totalMinutes,0)/total):0;

  const filtRows = rows.filter(r=>{ const s=search.toLowerCase(); return((r.name??"").toLowerCase().includes(s)||(r.email??"").toLowerCase().includes(s))&&(statusFilter==="ALL"||r.status===statusFilter); });
  const totalP = Math.ceil(filtRows.length/PER_PAGE);
  const si = (page-1)*PER_PAGE;
  const pageRows = filtRows.slice(si,si+PER_PAGE);

  const filtEmps   = users.filter(u=>(u.name??"").toLowerCase().includes(empSearch.toLowerCase())||(u.email??"").toLowerCase().includes(empSearch.toLowerCase()));
  const filtLeaves = leaves.filter(l=>leaveFilter==="All"?true:l.status===leaveFilter);

  const userName = (userData as any)?.name ?? user?.email?.split("@")[0] ?? "HR";
  const hour = new Date().getHours();
  const greeting = hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";

  const navItems = [
    {key:"dashboard" as HRView,label:"Dashboard",icon:"⊞"},
    {key:"leave"     as HRView,label:"Leave Management",icon:"📋",badge:pendL},
    {key:"employees" as HRView,label:"Employees",icon:"👥"},
    {key:"attendance"as HRView,label:"Attendance",icon:"📅"},
    {key:"payslips"  as HRView,label:"Payroll",icon:"₹"},
    {key:"announcements" as HRView,label:"Announcements",icon:"📣"},
    {key:"queries"   as HRView,label:"Queries",icon:"💬",badge:queryUnread},
  ];

  if(loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">Loading</p>
      </div>
    </div>
  );
  if(!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{fontFamily:"'DM Sans','Nunito',system-ui,sans-serif"}}>

      {/* ── SIDEBAR ── */}
      {sidebarOpen&&<div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 ${sidebarOpen?"translate-x-0":"-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">HR Portal</p>
            <p className="text-[10px] text-gray-400">Office Tracker</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Main Menu</p>
          {navItems.map(n=>(
            <SideNavItem key={n.key} label={n.label} icon={n.icon} active={view===n.key} onClick={()=>{setView(n.key);setSidebarOpen(false);}} badge={n.badge}/>
          ))}

<div className="pt-4">
  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Quick Links</p>
  <button onClick={()=>router.push("/admin/it-assets")} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all text-left">
    <span className="text-base">🖥️</span><span>IT Assets</span>
  </button>
  <button onClick={()=>router.push("/admin/greetings")} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all text-left">
  <span className="text-base">🎉</span><span>Greetings Hub</span>
</button>
  <button onClick={()=>window.open("/meet","_blank")} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all text-left">
    <span className="text-base">📹</span><span>Video Meet</span>
  </button>
</div>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2">
            <Avatar name={userName} photo={(userData as any)?.profilePhoto} size="md"/>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-[10px] text-gray-400 font-medium">HR Manager</p>
            </div>
            <button onClick={logout} title="Logout" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">

        {/* ── TOPBAR ── */}
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-gray-50 rounded-xl transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>

          <div className="flex-1 max-w-sm relative hidden sm:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" placeholder="Search anything..." className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:bg-white transition"/>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Live
            </span>
            <NotificationBell
  role="hr"
  uid={user.uid}
  accentColor="#0d9488"
/>
            <div className="relative">
              <button onClick={()=>setNotifOpen(o=>!o)} className="relative p-2 hover:bg-gray-50 rounded-xl transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                {unreadN>0&&<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadN}</span>}
              </button>
              {notifOpen&&(<>
                <div className="fixed inset-0 z-40" onClick={()=>setNotifOpen(false)}/>
                <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-xl z-50">
                  <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                    {unreadN>0&&<button onClick={markRead} className="text-xs text-teal-600 hover:text-teal-800 font-semibold">Mark all read</button>}
                  </div>
                  {notifs.length===0
                    ?<p className="text-center text-gray-400 text-sm py-8">No notifications</p>
                    :notifs.map(n=>(
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${n.read?"":"bg-teal-50/40"}`}>
                        <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-gray-400 text-xs mt-1">{n.createdAt?.toDate?.()?.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})??""}</p>
                      </div>
                    ))
                  }
                </div>
              </>)}
            </div>

            <Avatar name={userName} photo={(userData as any)?.profilePhoto} size="sm"/>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 overflow-y-auto">

          {/* ════ DASHBOARD ════ */}
          {view==="dashboard"&&(
            <div className="space-y-6">

              {/* ── 1. Greeting ── */}
              <div>
                <h1 className="text-xl font-bold text-gray-900">Hello, {userName.split(" ")[0]}!</h1>
                <p className="text-gray-400 text-sm mt-0.5">{greeting} · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
              </div>

              {/* ── 2. KPI CARDS (TOP) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Employees" value={total}
                  sub={`${online} online now`}
                  trend={`${Math.round((online/Math.max(total,1))*100)}% Active`}
                  accent
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
                />
                <StatCard
                  label="Attendance Rate" value={`${total>0?Math.round((online/total)*100):0}%`}
                  sub={`${online} Present · ${offline} Absent`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
                <StatCard
                  label="Leave Requests" value={pendL}
                  sub={pendL>0?`${pendL} pending review`:"All reviewed"}
                  trend={pendL>0?"Review":"Clear"}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
                />
                <StatCard
                  label="Avg Work Time" value={fmtTotal(avgWork)}
                  sub="Today's average"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
              </div>

              {/* ── Cross-Department Activity Feed ── */}
              <CrossDeptFeed
                role="hr"
                accentColor="#0d9488"
                title="🏢 Company Activity Feed"
                maxItems={5}
              />

              {/* ── 3. WIDGET GRID (MIDDLE) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── COL 1: Calendar + Holidays ── */}
                <div className="space-y-4">

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <CalendarWidget
                      date={widgetDate}
                      setDate={setWidgetDate}
                      holidays={WIDGET_HOLIDAYS}
                      isSunday={isSunday}
                      isSecSat={isSecSat}
                      isFourthSat={isFourthSat}
                    />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Upcoming Holidays</h3>
                      <span className="text-xs text-teal-600 font-semibold bg-teal-50 px-2 py-1 rounded-lg">2026</span>
                    </div>
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {WIDGET_HOLIDAYS.filter(h=>new Date(h.date)>=new Date()).slice(0,8).map((h,i)=>{
                        const d=new Date(h.date);
                        const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                        const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-50 border border-teal-100 rounded-xl flex flex-col items-center justify-center shrink-0">
                              <p className="text-[10px] font-bold text-teal-500 leading-none">{months[d.getMonth()]}</p>
                              <p className="text-sm font-black text-teal-700 leading-none">{d.getDate()}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{h.title}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{days[d.getDay()]}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── COL 2: Attendance Report + Leave Overview ── */}
                <div className="space-y-4">

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Attendance Report</h3>
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">This Month</span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <p className="text-3xl font-black text-gray-900">{total>0?Math.round((online/total)*100):0}%</p>
                      <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full mb-1">
                        +{Math.max(0,(total>0?Math.round((online/total)*100):0)-85)}% vs last week
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 font-medium">Attendance Rate</p>
                    <div className="space-y-2">
                      {[
                        {label:"9:00 AM", pct:Math.min(100,Math.round((online/Math.max(total,1))*100+15))},
                        {label:"9:30 AM", pct:Math.min(100,Math.round((online/Math.max(total,1))*100+8))},
                        {label:"10:00 AM",pct:Math.min(100,Math.round((online/Math.max(total,1))*100))},
                        {label:"10:30 AM",pct:Math.min(100,Math.round((online/Math.max(total,1))*100-5))},
                        {label:"11:00 AM",pct:Math.min(100,Math.round((online/Math.max(total,1))*100-12))},
                        {label:"11:30 AM",pct:Math.min(100,Math.round((online/Math.max(total,1))*100-20))},
                      ].map((row,i)=>(
                        <div key={i} className="flex items-center gap-3">
                          <p className="text-[10px] text-gray-400 font-medium w-16 shrink-0">{row.label}</p>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{width:`${Math.max(0,row.pct)}%`,background:i<2?"#0f766e":i<4?"#14b8a6":"#5eead4"}}/>
                          </div>
                          <p className="text-[10px] text-gray-500 font-semibold w-8 text-right">{Math.max(0,row.pct)}%</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-3 pt-2 border-t border-gray-50">
                      {["Mon","Tue","Wed","Thu","Fri"].map(d=>(
                        <p key={d} className="text-[10px] text-gray-400 font-medium">{d}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Leave Overview</h3>
                      <span className="text-gray-400 text-base cursor-pointer">···</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative w-20 h-20 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0fdf4" strokeWidth="3"/>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#14b8a6" strokeWidth="3"
                            strokeDasharray={`${pendL>0?Math.max(5,100-pendL*10):85} 100`}
                            strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-lg font-black text-teal-700">{leaves.filter(l=>l.status==="Approved").length}</p>
                          <p className="text-[9px] text-gray-400 font-medium">Approved</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-900">{leaves.length}</p>
                        <p className="text-xs text-gray-400 font-medium">Total Requests</p>
                        <p className="text-xs text-teal-600 font-semibold mt-1 bg-teal-50 px-2 py-0.5 rounded-full inline-block">
                          {pendL} pending review
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        {label:"Approved",count:leaves.filter(l=>l.status==="Approved").length,color:"bg-teal-500",pct:leaves.length>0?Math.round((leaves.filter(l=>l.status==="Approved").length/leaves.length)*100):0},
                        {label:"Pending", count:pendL, color:"bg-amber-400",pct:leaves.length>0?Math.round((pendL/leaves.length)*100):0},
                        {label:"Rejected",count:leaves.filter(l=>l.status==="Rejected").length,color:"bg-red-400",pct:leaves.length>0?Math.round((leaves.filter(l=>l.status==="Rejected").length/leaves.length)*100):0},
                      ].map(row=>(
                        <div key={row.label} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-20 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${row.color} shrink-0`}/>
                            <p className="text-xs text-gray-500 font-medium">{row.label}</p>
                          </div>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.color}`} style={{width:`${row.pct}%`}}/>
                          </div>
                          <p className="text-xs font-bold text-gray-700 w-5 text-right">{row.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── COL 3: Team Performance + Employment Status + Open Queries ── */}
                <div className="space-y-4">

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Team Performance</h3>
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">Today</span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <p className="text-3xl font-black text-gray-900">{fmtTotal(avgWork)}</p>
                      <span className="text-xs font-bold text-teal-600 mb-1">avg work</span>
                    </div>
                    <p className="text-xs text-gray-400 font-medium mb-4">{online} of {total} employees online now</p>
                    <div className="relative h-24">
                      <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,50 C20,45 40,30 60,28 C80,26 100,20 120,18 C140,16 160,10 180,8 C190,7 200,6 200,6 L200,60 L0,60 Z" fill="url(#lineGrad)"/>
                        <path d="M0,50 C20,45 40,30 60,28 C80,26 100,20 120,18 C140,16 160,10 180,8 C190,7 200,6 200,6" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="200" cy="6" r="3" fill="#14b8a6"/>
                        <circle cx="200" cy="6" r="6" fill="#14b8a6" fillOpacity="0.2"/>
                      </svg>
                      <div className="flex justify-between mt-1">
                        {["Jan","Feb","Mar","Apr","May","Jun"].map(m=>(
                          <p key={m} className="text-[9px] text-gray-400 font-medium">{m}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Employment Status</h3>
                      <span className="text-gray-400 text-base cursor-pointer">···</span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <p className="text-3xl font-black text-gray-900">{total}</p>
                      <p className="text-xs text-gray-400 font-medium mb-1">Employees</p>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5 my-4">
                      <div className="h-full bg-teal-600 rounded-l-full transition-all" style={{width:`${total>0?Math.round((online/total)*100):0}%`}}/>
                      <div className="h-full bg-gray-200 rounded-r-full flex-1"/>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-4">
                      <span>0%</span><span>100%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {label:"Online",   count:online,  pct:total>0?Math.round((online/total)*100):0,   dot:"bg-teal-500"},
                        {label:"Offline",  count:offline, pct:total>0?Math.round((offline/total)*100):0,  dot:"bg-gray-300"},
                        {label:"On Leave", count:pendL,   pct:total>0?Math.round((pendL/total)*100):0,    dot:"bg-amber-400"},
                        {label:"Queries",  count:openQ,   pct:0,                                           dot:"bg-purple-400"},
                      ].map(s=>(
                        <div key={s.label} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`}/>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{s.pct}% — {s.count}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Open Queries</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${openQ>0?"bg-amber-50 text-amber-700":"bg-teal-50 text-teal-700"}`}>{openQ} open</span>
                    </div>
                    {queries.filter(q=>q.status==="open").slice(0,3).length===0
                      ?<p className="text-xs text-gray-400 py-4 text-center">No open queries 🎉</p>
                      :queries.filter(q=>q.status==="open").slice(0,3).map(q=>(
                        <div key={q.id} className="flex items-start gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
                          <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-xs shrink-0 mt-0.5">💬</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{q.subject}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{q.userName}</p>
                          </div>
                          {q.adminUnread&&<span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5"/>}
                        </div>
                      ))
                    }
                    {openQ>3&&<button onClick={()=>setView("queries")} className="w-full mt-2 text-xs text-teal-600 font-semibold hover:text-teal-800 transition">View all {openQ} queries →</button>}
                  </div>

                  {/* ── Sales Commissions (HR Visibility) ── */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Sales Performance</h3>
                      <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">COMMISSIONS (5%)</span>
                    </div>
                    <div className="space-y-3">
                      {/* We'll use the CrossDeptFeed internally or just show a simplified list here */}
                      <p className="text-[11px] text-gray-400 mb-2">Recent deals closed by the sales team:</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        <CrossDeptFeed
                          role="hr"
                          accentColor="#0d9488"
                          title=""
                          maxItems={5}
                          compact
                          filterType="SALE_CREATED"
                        />
                      </div>
                      <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Total Deals Today</span>
                        <span className="text-sm font-bold text-teal-700">Live Updates</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 4. EMPLOYEE TABLE (BOTTOM) ── */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-sm">Employee Overview</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Real-time attendance tracking</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input type="text" placeholder="Search..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-400 bg-gray-50 w-36"/>
                    </div>
                    {(["ALL","ONLINE","OFFLINE"] as const).map(s=>(
                      <button key={s} onClick={()=>{setStatusFilter(s);setPage(1);}}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter===s?"bg-teal-600 text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                        {s==="ALL"?"All":s==="ONLINE"?`Online (${online})`:`Offline (${offline})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {["Employee","Status","Check-In","Hours","Break","Current Task",""].map(h=>(
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {!busy&&pageRows.length>0?pageRows.map(r=>{
                        const bks=breakData[r.uid]??[]; const bsec=calcBreakSec(bks); const abt=activeBreak(bks); const wu=wuMap[r.uid]??null;
                        return (
                          <tr key={r.uid} className="hover:bg-gray-50/60 transition-colors group">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <Avatar name={r.name} photo={r.profilePhoto} size="md"/>
                                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${r.status==="ONLINE"?"bg-emerald-500":"bg-gray-300"}`}/>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                                  <p className="text-xs text-gray-400">{r.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5"><Badge status={r.status}/></td>
                            <td className="px-5 py-3.5 text-sm text-gray-600 font-medium tabular-nums">{fmtTime(r.morningCheckIn)}</td>
                            <td className="px-5 py-3.5 text-sm font-bold text-gray-900 tabular-nums">{fmtTotal(r.totalMinutes)}</td>
                            <td className="px-5 py-3.5">
                              {bsec>0
                                ?<div><p className="text-sm font-semibold text-gray-700">{fmtBreak(bsec)}</p>{abt&&<p className="text-[10px] text-amber-500 mt-0.5">{abt}</p>}</div>
                                :<span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-5 py-3.5 max-w-[180px]"><WUTooltip wu={wu}/></td>
                            <td className="px-5 py-3.5">
                              <button onClick={()=>setTodayPanel(r)} className="opacity-0 group-hover:opacity-100 transition p-1.5 hover:bg-teal-50 rounded-lg text-teal-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      }):(
                        <tr><td colSpan={7} className="py-14 text-center text-gray-400 text-sm">{busy?"Loading...":"No employees found"}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalP>1&&(
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400">{filtRows.length===0?0:si+1}–{Math.min(si+PER_PAGE,filtRows.length)} of {filtRows.length} employees</p>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setPage(p=>Math.max(p-1,1))} disabled={page===1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      {Array.from({length:totalP},(_,i)=>i+1).map(p=>(
                        <button key={p} onClick={()=>setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${p===page?"bg-teal-600 text-white":"text-gray-500 hover:bg-gray-100"}`}>{p}</button>
                      ))}
                      <button onClick={()=>setPage(p=>Math.min(p+1,totalP))} disabled={page===totalP} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* ── END DASHBOARD ── */}

            </div>
          )}

          {/* ════ LEAVE ════ */}
          {view==="leave"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Leave Management</h1>
                <p className="text-sm text-gray-400 mt-0.5">{pendL} pending requests · {leaves.filter(l=>l.status==="Approved").length} approved this period</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"Pending",count:pendL,bg:"bg-amber-50",text:"text-amber-700",border:"border-amber-100"},
                  {label:"Approved",count:leaves.filter(l=>l.status==="Approved").length,bg:"bg-teal-50",text:"text-teal-700",border:"border-teal-100"},
                  {label:"Rejected",count:leaves.filter(l=>l.status==="Rejected").length,bg:"bg-red-50",text:"text-red-600",border:"border-red-100"},
                ].map(s=>(
                  <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4 text-center`}>
                    <p className={`text-2xl font-bold ${s.text}`}>{s.count}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${s.text} opacity-70`}>{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                {(["All","Pending","Approved","Rejected"] as const).map(f=>(
                  <button key={f} onClick={()=>setLeaveFilter(f)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${leaveFilter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{f}</button>
                ))}
              </div>

              {filtLeaves.length===0
                ?<div className="bg-white rounded-2xl border border-gray-100 p-14 text-center text-gray-400"><p className="text-3xl mb-3">📋</p><p className="font-medium text-sm">No {leaveFilter.toLowerCase()} requests</p></div>
                :filtLeaves.map(l=>(
                  <div key={l.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.userName} size="md"/>
                        <div><p className="font-semibold text-gray-900">{l.userName}</p><p className="text-xs text-gray-400 mt-0.5">{l.userEmail}</p></div>
                      </div>
                      <Badge status={l.status}/>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <Field label="Type" value={l.leaveType}/>
                      <Field label="From" value={l.fromDate}/>
                      <Field label="To" value={l.toDate}/>
                      <Field label="Reason" value={l.reason}/>
                    </div>
                    {l.status==="Pending"&&(
                      <div className="flex gap-2 mt-4">
                        <button onClick={()=>approveLeave(l.id,"Approved",l)} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">✓ Approve</button>
                        <button onClick={()=>approveLeave(l.id,"Rejected",l)} className="px-4 py-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm font-semibold rounded-xl transition">✕ Reject</button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {/* ════ EMPLOYEES ════ */}
          {view==="employees"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Employees</h1>
                <p className="text-sm text-gray-400 mt-0.5">{users.length} team members</p>
              </div>

              <div className="relative max-w-sm">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder="Search employees..." value={empSearch} onChange={e=>setEmpSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
              </div>

              {selEmp?(
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={()=>{setSelEmp(null);setEditing(false);}} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <Avatar name={selEmp.name} photo={(selEmp as any).profilePhoto} size="lg"/>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-lg">{selEmp.name}</p>
                      <p className="text-sm text-gray-400">{selEmp.email}</p>
                    </div>
                    {!editing&&<button onClick={()=>{setEditing(true);setEditEmp(selEmp);}} className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-sm font-semibold rounded-xl transition">✏️ Edit</button>}
                  </div>

                  {editMsg&&<div className="mb-4 p-3 bg-teal-50 text-teal-700 border border-teal-100 rounded-xl text-sm font-medium">{editMsg}</div>}

                  {editing&&editEmp?(
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[{label:"Name",key:"name",type:"text"},{label:"Designation",key:"designation",type:"text"},{label:"Department",key:"department",type:"text"},{label:"Salary (₹)",key:"salary",type:"number"}].map(({label,key,type})=>(
                          <div key={key}>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                            <input type={type} value={(editEmp as any)[key]??""} onChange={e=>setEditEmp({...editEmp,[key]:type==="number"?Number(e.target.value):e.target.value} as any)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEmp} className="px-6 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition text-sm">Save</button>
                        <button onClick={()=>{setEditing(false);setEditMsg("");}} className="px-5 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition text-sm">Cancel</button>
                      </div>
                    </div>
                  ):(
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[{label:"Name",value:selEmp.name},{label:"Email",value:selEmp.email},{label:"Designation",value:(selEmp as any).designation},{label:"Department",value:(selEmp as any).department},{label:"Account Type",value:(selEmp as any).accountType},{label:"Salary",value:(selEmp as any).salary?`₹${(selEmp as any).salary.toLocaleString("en-IN")}`:undefined}].map(item=>(
                        <Field key={item.label} label={item.label} value={item.value||"—"}/>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="font-semibold text-gray-900 text-sm mb-3">Today's Sessions</p>
                    {(()=>{ const r=rows.find(r=>r.uid===selEmp.id); if(!r||r.sessions.length===0) return <p className="text-gray-400 text-sm">No sessions today</p>; return <div className="space-y-2">{r.sessions.map((s,i)=><div key={i} className="flex gap-6 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm"><span className="text-gray-400 font-medium">#{i+1}</span><span className="text-teal-600 font-semibold">▸ {fmtTime(s.checkIn)}</span><span className="text-red-500 font-semibold">◂ {s.checkOut?fmtTime(s.checkOut):"Active"}</span></div>)}<div className="p-3 bg-teal-600 text-white rounded-xl text-sm font-semibold">Total: {fmtTotal(r.totalMinutes)}</div></div>; })()}
                  </div>
                </div>
              ):(
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtEmps.map(emp=>{ const r=rows.find(r=>r.uid===emp.id); return (
                    <div key={emp.id} onClick={()=>setSelEmp(emp)} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-teal-200 hover:shadow-sm cursor-pointer transition-all group">
                      <div className="relative shrink-0">
                        <Avatar name={emp.name} photo={(emp as any).profilePhoto} size="lg"/>
                        {r&&<span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${r.status==="ONLINE"?"bg-emerald-500":"bg-gray-300"}`}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate text-sm">{emp.name}</p>
                        <p className="text-xs text-gray-400 truncate">{(emp as any).designation||emp.email}</p>
                        {r&&<p className={`text-xs font-semibold mt-1 ${r.status==="ONLINE"?"text-teal-600":"text-gray-400"}`}>{r.status==="ONLINE"?`${fmtTotal(r.totalMinutes)} worked`:"Offline"}</p>}
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          )}

          {/* ════ ATTENDANCE ════ */}
          {view==="attendance"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
                <p className="text-sm text-gray-400 mt-0.5">Monthly attendance report & management</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <MonthlyReport db={db} users={users} monthlyDate={monthlyDate} setMonthlyDate={setMonthlyDate} monthlyAttendance={monthlyAtt} setMonthlyAttendance={setMonthlyAtt} sessionsByDate={sbd} isHoliday={isHoliday} saveMonthlyAttendance={saveAtt} getAutoStatus={({uid,dateStr,sessionsByDate:s,isHolidayDay})=>{ if(isHolidayDay) return "H"; return s[`${uid}_${dateStr}`]?"P":"A"; }} isSunday={isSunday} isSecondSaturday={isSecSat} isFourthSaturday={isFourthSat} isFifthSaturday={isFifthSat}/>
              </div>
            </div>
          )}

          {/* ════ PAYSLIPS ════ */}
          {view==="payslips"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
                <p className="text-sm text-gray-400 mt-0.5">Generate and manage employee payslips</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-5">Generate Payslip</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Employee</label>
                    <select value={payEmpId} onChange={e=>{setPayEmpId(e.target.value);setPayData(null);}} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-gray-50">
                      <option value="">Select employee</option>
                      {users.map(u=><option key={u.id} value={u.id}>{u.name} — {(u as any).designation||"Employee"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Month</label>
                    <input type="month" value={payMonth} onChange={e=>{setPayMonth(e.target.value);setPayData(null);}} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-gray-50"/>
                  </div>
                  <button onClick={genPayslip} disabled={genPay||!payEmpId} className="px-6 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    {genPay?"Calculating...":"Generate →"}
                  </button>
                </div>
              </div>

              {payData&&(
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" id="payslip-print">
                  <div className="bg-teal-600 text-white px-8 py-6 flex items-start justify-between">
                    <div><p className="text-2xl font-bold">PAYSLIP</p><p className="text-teal-100 text-sm mt-1">{new Date(payData.payMonth+"-01").toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</p></div>
                    <div className="text-right"><p className="font-semibold text-white">{payData.emp.name}</p><p className="text-sm text-teal-100">{payData.emp.email}</p><p className="text-sm text-teal-100">{payData.emp.designation||"Employee"}</p></div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      {[{label:"Working Days",value:payData.daysInMonth,cls:"text-gray-900"},{label:"Present Days",value:payData.presentDays,cls:"text-teal-600"},{label:"LOP Days",value:payData.lopDays,cls:"text-red-500"}].map(item=>(
                        <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-1">{item.label}</p></div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between py-3 border-b border-gray-100 text-sm"><span className="text-gray-500">Gross Salary</span><span className="font-semibold text-gray-900">₹{payData.salary.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between py-3 border-b border-gray-100 text-sm"><span className="text-red-500">LOP Deduction ({payData.lopDays} days)</span><span className="font-semibold text-red-500">− ₹{payData.lopDeduct.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between py-4 bg-teal-600 text-white rounded-xl px-5 mt-3"><span className="font-bold">Net Salary</span><span className="font-bold text-xl">₹{payData.netSalary.toLocaleString("en-IN")}</span></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={()=>window.print()} className="flex-1 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition text-sm">🖨️ Print</button>
                      <button onClick={()=>setPayData(null)} className="px-5 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition text-sm">Clear</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ ANNOUNCEMENTS ════ */}
          {view==="announcements"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
                <p className="text-sm text-gray-400 mt-0.5">Broadcast messages to all employees</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">New Announcement</h2>
                <textarea value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Write your announcement for all employees..." rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none bg-gray-50"/>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-400">{newMsg.length} characters</p>
                  <button onClick={broadcast} disabled={sending||!newMsg.trim()} className="px-6 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    {sending?"Sending...":"📣 Broadcast"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Past Announcements</p>
                {msgs.length===0
                  ?<div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No announcements yet</div>
                  :msgs.map((m,i)=>(
                    <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 hover:shadow-sm transition">
                      <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center text-teal-600 text-xs font-bold shrink-0">{msgs.length-i}</div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 leading-relaxed">{m.text}</p>
                        {m.createdAt&&<p className="text-xs text-gray-400 mt-1.5">{m.createdAt?.toDate?.()?.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})??""}</p>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ════ QUERIES ════ */}
          {view==="queries"&&(
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Employee Queries</h1>
                <p className="text-sm text-gray-400 mt-0.5">{openQ} open · {queryUnread} unread</p>
              </div>

              {queries.length===0
                ?<div className="bg-white rounded-2xl border border-gray-100 p-14 text-center text-gray-400"><p className="text-3xl mb-3">💬</p><p className="font-medium text-sm">No queries yet</p></div>
                :queries.map(q=>(
                  <div key={q.id} className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-all ${q.adminUnread?"border-amber-200":"border-gray-100"}`}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={q.userName} size="md"/>
                        <div><p className="font-semibold text-gray-900">{q.userName}</p><p className="text-xs text-gray-400">{q.userEmail}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.adminUnread&&<span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>}
                        <Badge status={q.status}/>
                      </div>
                    </div>
                    <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 text-sm">{q.subject}</p>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{q.message}</p>
                    </div>
                    {q.reply&&(
                      <div className="mt-3 bg-teal-50 border border-teal-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1.5">HR Reply</p>
                        <p className="text-sm text-teal-800 leading-relaxed">{q.reply}</p>
                      </div>
                    )}
                    {q.status==="open"&&(replyTo===q.id?(
                      <div className="mt-3 space-y-2">
                        <textarea value={replyTxt} onChange={e=>setReplyTxt(e.target.value)} placeholder="Write your reply..." rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none bg-gray-50"/>
                        <div className="flex gap-2">
                          <button onClick={()=>reply(q.id,q.uid)} disabled={replying||!replyTxt.trim()} className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition disabled:opacity-40">{replying?"Sending...":"Send Reply"}</button>
                          <button onClick={()=>{setReplyTo(null);setReplyTxt("");}} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition">Cancel</button>
                        </div>
                      </div>
                    ):(
                      <button onClick={()=>{setReplyTo(q.id);setReplyTxt("");}} className="mt-3 px-5 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition">💬 Reply</button>
                    ))}
                  </div>
                ))
              }
            </div>
          )}
        </main>

        {/* ── FOOTER ── */}
        <footer className="border-t border-gray-100 bg-white px-6 py-3 flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 Office Tracker · HR Portal</span>
          <span className="font-medium text-gray-500">{userName}</span>
        </footer>
      </div>

      {todayPanel&&<EmployeeTodayPanel employee={todayPanel} adminUid="admin" onClose={()=>setTodayPanel(null)}/>}
      <IncomingCallListener/>

      <style jsx>{`
        @media print {
          body > * { display: none !important; }
          #payslip-print { display: block !important; position: fixed; inset: 0; background: white; }
        }
      `}</style>
    </div>
  );
}

export default function HRPage() {
  return (
    <ProtectedRoute allowedRoles={["hr","admin","superadmin"]}>
      <HRDashboard/>
    </ProtectedRoute>
  );
}