"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc,
  serverTimestamp, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BirthdayRecord {
  id: string; name: string; email: string;
  birthDate: string; birthMonthDay: string;
  uid?: string;
  department?: string; lastWishSentOn?: string;
}
interface Festival {
  id: string; title: string; festivalDate: string;
  sendEmail: boolean; sendInAdvanceDays: number;
  emailSubject: string; emailMessage: string;
  bannerEmoji: string; bannerColor: string; lastSentOn?: string;
}
interface CompanyEvent {
  id: string; title: string; date: string;
  description?: string; color?: string; location?: string;
  rsvpLink?: string; sendAnnouncementEmail?: boolean;
  reminderDaysBefore?: number; announcementSentOn?: string; reminderSentOn?: string;
}
interface GreetingLog {
  id: string; type: string; recipientEmail: string;
  recipientName?: string; subject: string;
  sentAt: string; sentBy: string; status: string; error?: string;
}
type Tab = "calendar" | "birthdays" | "festivals" | "events" | "history";
interface CalendarViewProps {
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;

  calendarDate: Date;
  setCalendarDate: (date: Date) => void;

  holidays: { date: string; title: string }[]; // ✅ ADD THIS

  isSunday: (y: number, m: number, d: number) => boolean;
  isSecondSaturday: (y: number, m: number, d: number) => boolean;
  isFourthSaturday: (y: number, m: number, d: number) => boolean;
  isFifthSaturday: (y: number, m: number, d: number) => boolean;

  isHoliday: (dateStr: string) => { title: string } | null;
  onWishEmployee?: (uid: string) => void;
}

const EVENT_COLORS = [
  {hex:"#6366f1",label:"Indigo"},{hex:"#0284c7",label:"Blue"},{hex:"#059669",label:"Green"},
  {hex:"#d97706",label:"Amber"},{hex:"#e11d48",label:"Rose"},{hex:"#9333ea",label:"Purple"},
  {hex:"#0891b2",label:"Cyan"},{hex:"#16a34a",label:"Emerald"},{hex:"#ec4899",label:"Pink"},{hex:"#14b8a6",label:"Teal"},
];
const FESTIVAL_EMOJIS = ["🪔","🎉","🎄","🌸","🎊","🥳","🎆","🌺","🎋","🎑","✨","🪅","🎭","🎈","🐣","🌙"];
const FESTIVAL_COLORS = ["#f59e0b","#ef4444","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#0891b2"];

function todayMMDD() {
  const d = new Date();
  return String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
const todayISO = new Date().toISOString().slice(0,10);

function avatarBg(name: string) {
  const p = [{bg:"#ede9fe",c:"#7c3aed"},{bg:"#fce7f3",c:"#db2777"},{bg:"#d1fae5",c:"#059669"},{bg:"#fffbeb",c:"#d97706"},{bg:"#e0f2fe",c:"#0284c7"},{bg:"#fee2e2",c:"#dc2626"}];
  return p[((name??"").charCodeAt(0)||65)%p.length];
}
function initials(name: string) { return (name??"").split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()??"").join(""); }
function fmtDate(d: string) {
  if (!d) return "—";
  try { return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); } catch { return d; }
}
function daysUntil(dateStr: string) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr+"T00:00:00").getTime()-new Date(todayISO+"T00:00:00").getTime())/86400000);
}
function getNextBirthday(birthdays: BirthdayRecord[]) {
  const todayMD = todayMMDD();
  return birthdays.filter(e=>e.birthMonthDay!==todayMD).map(e=>{
    const [mm,dd] = e.birthMonthDay.split("-").map(Number);
    const t = new Date(new Date().getFullYear(),mm-1,dd);
    if (t<=new Date()) t.setFullYear(t.getFullYear()+1);
    return {emp:e,days:Math.ceil((t.getTime()-Date.now())/86400000)};
  }).sort((a,b)=>a.days-b.days)[0]||null;
}
function getNextFestival(festivals: Festival[]) {
  // ✅ Show ALL festivals (upcoming + past) so nothing is hidden
  // Upcoming first (nearest), then past (most recent) — same logic as GreetingsAdmin
  const withDays = festivals.map(f=>({fest:f,days:daysUntil(f.festivalDate)}));
  const upcoming = withDays.filter(x=>x.days>=0).sort((a,b)=>a.days-b.days);
  const past     = withDays.filter(x=>x.days<0).sort((a,b)=>b.days-a.days);
  return [...upcoming,...past][0]||null;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  showCalendar, setShowCalendar, calendarDate, setCalendarDate,
  isSunday, isSecondSaturday, isFourthSaturday, isFifthSaturday, isHoliday,
  onWishEmployee,
}) => {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const [birthdays,  setBirthdays]  = useState<BirthdayRecord[]>([]);
  const [festivals,  setFestivals]  = useState<Festival[]>([]);
  const [events,     setEvents]     = useState<CompanyEvent[]>([]);
  const [logs,       setLogs]       = useState<GreetingLog[]>([]);
  const [tab,        setTab]        = useState<Tab>("calendar");
  const [sending,    setSending]    = useState<string|null>(null);
  const [deleting,   setDeleting]   = useState<string|null>(null);
  const [toast,      setToast]      = useState<{msg:string;ok?:boolean}|null>(null);
  const [histFilter, setHistFilter] = useState("all");

  const emptyBday  = {name:"",email:"",birthDate:"",department:""};
  const emptyFest  = {title:"",festivalDate:"",sendEmail:true,sendInAdvanceDays:0,emailSubject:"",emailMessage:"",bannerEmoji:"🎉",bannerColor:"#f59e0b"};
  const emptyEvent = {title:"",date:"",description:"",color:"#6366f1",location:"",rsvpLink:"",sendAnnouncementEmail:true,reminderDaysBefore:1};

  const [showBdayForm,  setShowBdayForm]  = useState(false);
  const [editBday,      setEditBday]      = useState<BirthdayRecord|null>(null);
  const [savingBday,    setSavingBday]    = useState(false);
  const [bdayForm,      setBdayForm]      = useState(emptyBday);
  const [bdayErr,       setBdayErr]       = useState<Partial<typeof emptyBday>>({});

  const [showFestForm,  setShowFestForm]  = useState(false);
  const [editFest,      setEditFest]      = useState<Festival|null>(null);
  const [savingFest,    setSavingFest]    = useState(false);
  const [festForm,      setFestForm]      = useState(emptyFest);
  const [festErr,       setFestErr]       = useState<Record<string,string>>({});

  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent,     setEditEvent]     = useState<CompanyEvent|null>(null);
  const [savingEvent,   setSavingEvent]   = useState(false);
  const [eventForm,     setEventForm]     = useState(emptyEvent);
  const [eventErr,      setEventErr]      = useState<Record<string,string>>({});

  useEffect(()=>{
    if (!showCalendar) return;
    const u1=onSnapshot(collection(db,"festivals"),s=>setFestivals(s.docs.map(d=>({id:d.id,...d.data()} as Festival))));
    const u2=onSnapshot(collection(db,"companyEvents"),s=>setEvents(s.docs.map(d=>{
      const data = d.data();
      return { id:d.id, ...data, date:data.date||data.eventDate||"" } as CompanyEvent;
    })));
    const u3=onSnapshot(query(collection(db,"greetingLogs"),orderBy("sentAt","desc"),limit(200)),s=>setLogs(s.docs.map(d=>({id:d.id,...d.data()} as GreetingLog))));
    // ✅ Birthdays now come from users collection (single source of truth)
    const u4=onSnapshot(collection(db,"users"),s=>{
      const list:BirthdayRecord[] = s.docs
        .map(d=>{
          const data=d.data();
          const birthDate:string = data.dateOfBirth||data.birthDate||"";
          const mm=birthDate?.slice(5,7);
          const dd=birthDate?.slice(8,10);
          return {
            id:d.id,
            uid:d.id,
            name:data.name||"",
            email:data.email||"",
            birthDate,
            birthMonthDay:birthDate ? mm+"-"+dd : "",
            department:data.department||"",
            lastWishSentOn:data.lastWishSentOn||"",
          } as BirthdayRecord;
        })
        .filter(e=>e.email && e.birthDate);
      setBirthdays(list);
    });
    return ()=>{u1();u2();u3();u4();};
  },[showCalendar]);

  if (!showCalendar) return null;

  const onClose = ()=>setShowCalendar(false);
  const showToast = (msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3200);};
  const todayMD = todayMMDD();
  const nextBday = getNextBirthday(birthdays);
  const nextFest = getNextFestival(festivals);

  const getBdaysForDay = (y:number,m:number,day:number)=>{
    const key=String(m+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    return birthdays.filter(b=>b.birthMonthDay===key);
  };
  const getFestsForDay  = (ds:string)=>festivals.filter(f=>f.festivalDate===ds);
  const getEventsForDay = (ds:string)=>events.filter(e=>e.date===ds);

  const monthKey = calendarDate.getFullYear()+"-"+String(calendarDate.getMonth()+1).padStart(2,"0");
  const monthBirthdays = birthdays
    .filter(b=>b.birthMonthDay?.startsWith(String(calendarDate.getMonth()+1).padStart(2,"0")+"-"))
    .sort((a,b)=>a.birthMonthDay.localeCompare(b.birthMonthDay));
  const monthFestivals = festivals
    .filter(f=>f.festivalDate?.startsWith(monthKey))
    .sort((a,b)=>a.festivalDate.localeCompare(b.festivalDate));
  const monthEvents = events
    .filter(e=>e.date?.startsWith(monthKey))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const filteredLogs = histFilter==="all"?logs:logs.filter(l=>l.type===histFilter);
  const todayBdayCount = birthdays.filter(b=>b.birthMonthDay===todayMD).length;
  // ✅ Count all future festivals (no 30-day cap)
  const upcomingFestCount = festivals.filter(f=>daysUntil(f.festivalDate)>=0).length;

  // API calls
  const sendWish = async (ev:React.MouseEvent,r:BirthdayRecord)=>{
    ev.stopPropagation(); setSending(r.id);
    try {
      const res=await fetch("/api/send-birthday-wish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:r.id,email:r.email,name:r.name,sentBy:"admin"})});
      if(!res.ok) throw new Error();
      showToast("🎉 Wish sent to "+r.name+"!");
    }
    catch { showToast("Failed to send wish.",false); }
    finally { setSending(null); }
  };
  const sendFestival = async (fest:Festival)=>{
    setSending(fest.id);
    try {
      const res=await fetch("/api/send-festival-greeting",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({festivalId:fest.id,sentBy:"admin"})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      showToast(fest.bannerEmoji+" Greetings sent! ("+data.sent+" emails)");
    }
    catch(e:any){showToast(e.message||"Failed",false);}
    finally{setSending(null);}
  };
  const sendEvent = async (ev:CompanyEvent,type:"announcement"|"reminder"="announcement")=>{
    setSending(ev.id+type);
    try {
      const res=await fetch("/api/send-event-announcement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId:ev.id,type,sentBy:"admin"})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      showToast("📅 Event "+type+" sent! ("+data.sent+" emails)");
    }
    catch(e:any){showToast(e.message||"Failed",false);}
    finally{setSending(null);}
  };

  // Birthday CRUD
  const handleSaveBday = async ()=>{
    const e:Partial<typeof emptyBday>={};
    if(!bdayForm.name.trim()) e.name="Required";
    if(!bdayForm.email.trim()) e.email="Required";
    else if(!/\S+@\S+\.\S+/.test(bdayForm.email)) e.email="Invalid email";
    if(!bdayForm.birthDate) e.birthDate="Required";
    if(Object.keys(e).length){setBdayErr(e);return;}
    setSavingBday(true);
    try {
      const mm=bdayForm.birthDate.slice(5,7), dd=bdayForm.birthDate.slice(8,10);
      const payload={name:bdayForm.name.trim(),email:bdayForm.email.trim().toLowerCase(),birthDate:bdayForm.birthDate,birthMonthDay:mm+"-"+dd,department:bdayForm.department.trim()||null,updatedAt:serverTimestamp()};
      if(editBday) await updateDoc(doc(db,"birthdays",editBday.id),payload);
      else await addDoc(collection(db,"birthdays"),{...payload,createdAt:serverTimestamp()});
      setBdayForm(emptyBday);setShowBdayForm(false);setEditBday(null);setBdayErr({});
      showToast(editBday?"✏️ Updated!":"🎂 "+bdayForm.name.trim()+" added!");
    }catch{showToast("Save failed",false);}
    finally{setSavingBday(false);}
  };
  const handleDeleteBday = async (id:string,name:string)=>{
    if(!confirm("Remove "+name+"?")) return;
    setDeleting(id);
    try{await deleteDoc(doc(db,"birthdays",id));showToast(name+" removed.");}
    catch{showToast("Delete failed",false);}
    finally{setDeleting(null);}
  };

  // Festival CRUD
  const handleSaveFest = async ()=>{
    const e:Record<string,string>={};
    if(!festForm.title.trim()) e.title="Required";
    if(!festForm.festivalDate) e.festivalDate="Required";
    if(!festForm.emailSubject.trim()) e.emailSubject="Required";
    if(Object.keys(e).length){setFestErr(e);return;}
    setSavingFest(true);
    try {
      const payload={...festForm,title:festForm.title.trim(),emailSubject:festForm.emailSubject.trim(),emailMessage:festForm.emailMessage.trim(),updatedAt:serverTimestamp()};
      if(editFest) await updateDoc(doc(db,"festivals",editFest.id),payload);
      else await addDoc(collection(db,"festivals"),{...payload,createdAt:serverTimestamp()});
      setFestForm(emptyFest);setShowFestForm(false);setEditFest(null);setFestErr({});
      showToast(editFest?"✏️ Festival updated!":"🎊 Festival added!");
    }catch{showToast("Save failed",false);}
    finally{setSavingFest(false);}
  };
  const handleDeleteFest = async (id:string,title:string)=>{
    if(!confirm('Delete "'+title+'"?')) return;
    setDeleting(id);
    try{await deleteDoc(doc(db,"festivals",id));showToast(title+" deleted.");}
    catch{showToast("Delete failed",false);}
    finally{setDeleting(null);}
  };

  // Event CRUD
  const handleSaveEvent = async ()=>{
    const e:Record<string,string>={};
    if(!eventForm.title.trim()) e.title="Required";
    if(!eventForm.date) e.date="Required";
    if(Object.keys(e).length){setEventErr(e);return;}
    setSavingEvent(true);
    try {
      const payload={
        title:eventForm.title.trim(), date:eventForm.date,
        description:eventForm.description.trim()||null,
        color:eventForm.color, location:eventForm.location.trim()||null,
        rsvpLink:eventForm.rsvpLink.trim()||null,
        sendAnnouncementEmail:eventForm.sendAnnouncementEmail,
        reminderDaysBefore:eventForm.reminderDaysBefore,
        updatedAt:serverTimestamp(),
      };
      if(editEvent) await updateDoc(doc(db,"companyEvents",editEvent.id),payload);
      else await addDoc(collection(db,"companyEvents"),{...payload,createdAt:serverTimestamp()});
      setEventForm(emptyEvent);setShowEventForm(false);setEditEvent(null);setEventErr({});
      showToast(editEvent?"✏️ Event updated!":"📅 Event added!");
    }catch{showToast("Save failed",false);}
    finally{setSavingEvent(false);}
  };
  const handleDeleteEvent = async (id:string,title:string)=>{
    if(!confirm('Delete "'+title+'"?')) return;
    setDeleting(id);
    try{await deleteDoc(doc(db,"companyEvents",id));showToast(title+" deleted.");}
    catch{showToast("Delete failed",false);}
    finally{setDeleting(null);}
  };

  // ── helper: build dateStr without template literals ──
  const makeDateStr = (y:number,m:number,day:number) =>
    y+"-"+String(m+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");

  return (
    <>
      <style>{`
        .cm-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;padding:11px 22px;border-radius:10px;font-size:13px;font-weight:700;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);animation:cmUp .2s ease;white-space:nowrap;}
        @keyframes cmUp{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        .cm-tab{font-size:12px;font-weight:700;padding:7px 14px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:5px;position:relative;white-space:nowrap;}
        .cm-tab.on{background:#193677;color:#fff;border-color:#193677;}
        .cm-tab.off{background:#f1f5f9;color:#64748b;border-color:#e2e8f0;}
        .cm-tab.off:hover{background:#e2e8f0;color:#334155;}
        .cm-tab-badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;background:#e11d48;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 3px;}
        .cm-add-btn{font-size:12px;font-weight:700;padding:6px 14px;background:#193677;color:#fff;border:none;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:background .13s;white-space:nowrap;}
        .cm-add-btn:hover{background:#142a5e;}
        .cm-add-btn.amber{background:#d97706;} .cm-add-btn.amber:hover{background:#b45309;}
        .cm-add-btn.pink{background:#db2777;} .cm-add-btn.pink:hover{background:#be185d;}
        .cm-add-btn.sm{font-size:10px;padding:3px 9px;}
        .cm-wish-btn{font-size:9px;font-weight:700;padding:2px 6px;background:#193677;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;line-height:1.5;}
        .cm-wish-btn:disabled{opacity:.5;cursor:not-allowed;}
        .cm-wish-btn.sent{background:#15803d;}
        .cm-del-btn{font-size:11px;font-weight:600;padding:4px 9px;background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;border-radius:6px;cursor:pointer;}
        .cm-del-btn:hover:not(:disabled){background:#ffe4e6;}
        .cm-del-btn:disabled{opacity:.45;cursor:not-allowed;}
        .cm-send-btn{font-size:11px;font-weight:700;padding:4px 10px;background:#fffbeb;color:#d97706;border:1px solid #fde68a;border-radius:6px;cursor:pointer;}
        .cm-send-btn:hover:not(:disabled){background:#fef3c7;}
        .cm-send-btn:disabled{opacity:.45;cursor:not-allowed;}
        .cm-ghost-btn{font-size:11px;font-weight:600;padding:4px 9px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;}
        .cm-ghost-btn:hover{background:#f1f5f9;}
        .cm-bday-pill{font-size:9px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:3px;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;line-height:1.4;margin-top:1px;}
        .cm-fest-pill{font-size:9px;font-weight:700;color:#fff;border-radius:3px;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;line-height:1.4;margin-top:1px;}
        .cm-event-pill{font-size:9px;font-weight:700;color:#fff;border-radius:3px;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;line-height:1.4;margin-top:1px;}
        .cm-input{width:100%;padding:8px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#1e293b;outline:none;transition:border-color .15s;}
        .cm-input:focus{border-color:#193677;box-shadow:0 0 0 3px rgba(25,54,119,.08);}
        .cm-input.err{border-color:#f43f5e;}
        .cm-textarea{width:100%;padding:8px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#1e293b;outline:none;resize:vertical;min-height:70px;transition:border-color .15s;}
        .cm-textarea:focus{border-color:#193677;}
        .cm-label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
        .cm-err-txt{font-size:11px;color:#f43f5e;margin-top:3px;}
        .cm-field{margin-bottom:12px;}
        .cm-toggle-track{width:38px;height:21px;border-radius:11px;background:#e2e8f0;position:relative;transition:background .2s;flex-shrink:0;cursor:pointer;}
        .cm-toggle-track.on{background:#193677;}
        .cm-toggle-thumb{width:15px;height:15px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .cm-toggle-track.on .cm-toggle-thumb{left:20px;}
        .cm-modal-inner{background:#fff;border-radius:14px;padding:26px 28px;width:420px;max-width:94vw;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);}
        .cm-modal-title{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:18px;}
        .cm-modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid #f1f5f9;}
        .cm-save-btn{font-size:13px;font-weight:700;padding:9px 20px;background:#193677;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;}
        .cm-save-btn:disabled{opacity:.45;cursor:not-allowed;}
        .cm-cancel-btn{font-size:13px;font-weight:600;padding:9px 16px;background:#f8fafc;color:#64748b;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:inherit;}
        .cm-color-grid{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;}
        .cm-color-dot{width:24px;height:24px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:border-color .13s;}
        .cm-color-dot.sel{border-color:#0f172a;}
        .cm-emoji-grid{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}
        .cm-emoji-opt{width:32px;height:32px;border-radius:7px;border:2px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .13s;}
        .cm-emoji-opt:hover{border-color:#c7d2fe;background:#eef2ff;}
        .cm-emoji-opt.sel{border-color:#193677;background:#eef2ff;}
        .cm-list-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:1px solid #f1f5f9;background:#f8fafc;margin-bottom:6px;}
        .cm-list-item:hover{background:#f1f5f9;}
        .cm-table{width:100%;border-collapse:collapse;}
        .cm-table th{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding:9px 12px;text-align:left;border-bottom:2px solid #f1f5f9;background:#fafbfc;}
        .cm-table td{padding:10px 12px;border-bottom:1px solid #f8fafc;font-size:12px;vertical-align:middle;color:#334155;}
        .cm-table tr:last-child td{border-bottom:none;}
        .cm-table tr:hover td{background:#fafbff;}
        .cm-next-card{border-radius:10px;padding:10px 12px;margin-bottom:8px;position:relative;overflow:hidden;}
        .cm-next-card::before{content:'';position:absolute;top:-12px;right:-12px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.15);}
        .cm-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;}
        .cm-badge-success{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}
        .cm-badge-danger{background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;}
        .cm-badge-warn{background:#fffbeb;color:#d97706;border:1px solid #fde68a;}
        .cm-badge-info{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;}
        .cm-badge-purple{background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;}
        .cm-badge-teal{background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;}
        .cm-sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
        .cm-sec-title{font-size:15px;font-weight:800;color:#0f172a;}
        .cm-empty{text-align:center;padding:40px 16px;color:#94a3b8;font-size:13px;}
      `}</style>

      {toast && <div className="cm-toast" style={{background:toast.ok!==false?"#193677":"#dc2626"}}>{toast.msg}</div>}

      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2" onClick={onClose}>
        <div className="w-full max-w-4xl max-h-[98vh] flex flex-col" onClick={e=>e.stopPropagation()}>

          {/* Tab bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2 flex-wrap">
              {([
                {key:"calendar",  label:"📅 Calendar",  badge:0},
                {key:"birthdays", label:"🎂 Birthdays",  badge:todayBdayCount},
              ] as {key:Tab;label:string;badge:number}[]).map(t=>(
                <button key={t.key} className={"cm-tab "+(tab===t.key?"on":"off")} onClick={()=>setTab(t.key)}>
                  {t.label}
                  {t.badge>0&&<span className="cm-tab-badge">{t.badge}</span>}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="bg-white rounded-full w-8 h-8 shadow hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm shrink-0">✕</button>
          </div>

          {/* CALENDAR TAB */}
          {tab==="calendar" && (
            <div className="flex gap-2 flex-1 min-h-0">
              <div className="flex-1 bg-white rounded-xl shadow-xl border border-slate-200 p-3 overflow-hidden">
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                      <>
                        <button className="cm-add-btn pink" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>🎂 Add Birthday</button>
                        <button className="cm-add-btn amber" onClick={()=>{setShowFestForm(true);setFestErr({});setEditFest(null);setFestForm(emptyFest);}}>🪔 Add Festival</button>
                        <button className="cm-add-btn" onClick={()=>{setShowEventForm(true);setEventErr({});setEditEvent(null);setEventForm(emptyEvent);}}>📌 Add Event</button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                    <button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1))} className="px-2 py-1 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-[11px] font-bold">← Prev</button>
                    <div className="px-3 py-1 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-[12px] min-w-[110px] text-center">{calendarDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</div>
                    <button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1))} className="px-2 py-1 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-[11px] font-bold">Next →</button>
                  </div>
                </div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  {[{cls:"bg-rose-100 border-rose-300",label:"Holiday"},{cls:"bg-purple-100 border-purple-300",label:"Birthday"},{cls:"bg-amber-100 border-amber-300",label:"Festival"},{cls:"bg-indigo-100 border-indigo-300",label:"Event"},{cls:"bg-green-100 border-green-400",label:"Today"}].map(l=>(
                    <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className={"w-3 h-3 rounded border-2 "+l.cls}/>
                      {l.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 text-center font-bold text-slate-700 mb-2 text-sm">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({length:new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1).getDay()}).map((_,i)=><div key={i}/>)}
                  {Array.from({length:new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,0).getDate()}).map((_,i)=>{
                    const day=i+1, y=calendarDate.getFullYear(), m=calendarDate.getMonth();
                    const dateStr=makeDateStr(y,m,day);
                    const now=new Date();
                    const isToday=day===now.getDate()&&m===now.getMonth()&&y===now.getFullYear();
                    const holiday=isHoliday(dateStr);
                    const isHolDay=isSunday(y,m,day)||isSecondSaturday(y,m,day)||isFourthSaturday(y,m,day)||isFifthSaturday(y,m,day)||holiday;
                    const dayBdays=getBdaysForDay(y,m,day);
                    const dayFests=getFestsForDay(dateStr);
                    const dayEvts=getEventsForDay(dateStr);
                    const bg=isToday?"bg-green-50 border-green-400":dayBdays.length?"bg-purple-50 border-purple-300":dayFests.length?"bg-amber-50 border-amber-300":dayEvts.length?"bg-indigo-50 border-indigo-300":isHolDay?"bg-rose-50 border-rose-300":"bg-white border-slate-200";
                    return (
                      <div key={day} className={"h-20 border rounded-lg p-1 text-[10px] overflow-hidden hover:shadow transition-shadow "+bg}>
                        <div className={"font-bold text-xs leading-none mb-0.5 "+(isToday?"text-green-700":dayBdays.length?"text-purple-700":"")}>{day}</div>
                        {holiday&&<div className="text-[9px] text-rose-600 truncate">{holiday.title}</div>}
                        {dayBdays.map(b=>(
                          <div key={b.id}>
                            <span className="cm-bday-pill" title={b.name}>🎂 {b.name.split(" ")[0]}</span>
                            {isToday && isAdmin && (
                              <button
                                className={"cm-wish-btn"+(b.lastWishSentOn===todayISO?" sent":"")}
                                disabled={sending===b.id}
                                onClick={e=>sendWish(e,b)}
                              >
                                {sending===b.id?"…":b.lastWishSentOn===todayISO?"✓ Sent":"Send Wish"}
                              </button>
                            )}
                            {isToday && !isAdmin && onWishEmployee && b.uid && (
                              <button
                                className="cm-wish-btn"
                                onClick={(e) => { e.stopPropagation(); onWishEmployee(b.uid!); }}
                                style={{ background: "linear-gradient(135deg, #e8512a, #f5853f)", color: "#fff", borderColor: "transparent" }}
                              >
                                💬 Message
                              </button>
                            )}
                          </div>
                        ))}
                        {dayFests.map(f=><span key={f.id} className="cm-fest-pill" style={{background:f.bannerColor||"#f59e0b"}} title={f.title}>{f.bannerEmoji} {f.title}</span>)}
                        {dayEvts.map(ev=><span key={ev.id} className="cm-event-pill" style={{background:ev.color||"#6366f1"}} title={ev.title}>📌 {ev.title}</span>)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="w-44 flex flex-col gap-2 overflow-y-auto">

                {/* Birthdays sidebar */}
                <div className="bg-white rounded-xl border border-slate-200 shadow p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">🎂 Birthdays</span>
                    {isAdmin && (
                      <button className="cm-add-btn pink sm" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>+ Add</button>
                    )}
                  </div>
                  {monthBirthdays.filter(b => b.birthMonthDay === todayMD).length === 0
                    ? <div className="text-xs text-slate-400">None today</div>
                    : monthBirthdays.filter(b => b.birthMonthDay === todayMD).map(b => {
                        const isToday = true;
                      return (
                        <div key={b.id} className={"rounded-lg px-2 py-1.5 mb-1 border text-xs "+(isToday?"bg-purple-50 border-purple-200":"bg-slate-50 border-slate-100")}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-800 truncate flex-1">{b.name}</span>
                            {isAdmin && (
                              <button className="text-rose-400 hover:text-rose-600 font-bold text-[11px] px-1 border-none bg-transparent cursor-pointer" disabled={deleting===b.id} onClick={()=>handleDeleteBday(b.id,b.name)}>{deleting===b.id?"…":"✕"}</button>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className={"text-[10px] font-bold px-1.5 rounded "+(isToday?"bg-purple-200 text-purple-800":"bg-slate-200 text-slate-600")}>{isToday?"🎉 Today":b.birthMonthDay.slice(3)}</span>
                            {isToday && isAdmin && (
                              <button
                                className={"cm-wish-btn"+(b.lastWishSentOn===todayISO?" sent":"")}
                                disabled={sending===b.id}
                                onClick={e=>sendWish(e,b)}
                                style={{fontSize:10,padding:"2px 7px"}}
                              >
                                {sending===b.id?"…":b.lastWishSentOn===todayISO?"✓":"🎉 Wish"}
                              </button>
                            )}
                            {isToday && !isAdmin && onWishEmployee && b.uid && (
                              <button
                                className="cm-wish-btn"
                                onClick={(e) => { e.stopPropagation(); onWishEmployee(b.uid!); }}
                                style={{ fontSize: 10, padding: "2px 7px", background: "linear-gradient(135deg, #e8512a, #f5853f)", color: "#fff", borderColor: "transparent" }}
                              >
                                💬 Message
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>

              </div>
            </div>
          )}

          {/* BIRTHDAYS TAB */}
          {tab==="birthdays" && (
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 overflow-y-auto flex-1">
              <div className="cm-sec-head">
                <div><div className="cm-sec-title">🎂 Birthday Management</div><div className="text-xs text-slate-400 mt-0.5">{birthdays.length} employees · {birthdays.filter(b=>b.birthMonthDay===todayMD).length} today</div></div>
                {isAdmin && (
                  <button className="cm-add-btn pink" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>+ Add Birthday</button>
                )}
              </div>
              {birthdays.length===0
                ?<div className="cm-empty"><div style={{fontSize:36,marginBottom:8}}>🎈</div>No birthdays yet.</div>
                :birthdays.slice().sort((a,b)=>a.birthMonthDay.localeCompare(b.birthMonthDay)).map(r=>{
                  const av=avatarBg(r.name);
                  const isToday=r.birthMonthDay===todayMD;
                  const alreadySent=r.lastWishSentOn===todayISO;
                  return (
                    <div key={r.id} className="cm-list-item">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{background:av.bg,color:av.c}}>{initials(r.name)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{r.name}</span>
                          {isToday&&<span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🎂 Today!</span>}
                        </div>
                        <div className="text-xs text-slate-500">{r.email}{r.department?" · "+r.department:""}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{fmtDate(r.birthDate)} · {r.birthMonthDay}</div>
                      </div>
                      <div className="text-xs text-slate-400 mr-2">{r.lastWishSentOn?<span className="cm-badge cm-badge-success">✅ {r.lastWishSentOn}</span>:"Never"}</div>
                      <div className="flex gap-1.5 shrink-0">
                        {isToday && isAdmin && (
                          <button
                            className={"cm-wish-btn"+(alreadySent?" sent":"")}
                            style={{fontSize:11,padding:"5px 10px"}}
                            disabled={sending===r.id||alreadySent}
                            onClick={e=>sendWish(e,r)}
                          >
                            {sending===r.id?"…":alreadySent?"✓ Sent":"🎉 Wish"}
                          </button>
                        )}
                        {isToday && !isAdmin && onWishEmployee && r.uid && (
                          <button
                            className="cm-wish-btn"
                            style={{ fontSize: 11, padding: "5px 10px", background: "linear-gradient(135deg, #e8512a, #f5853f)", color: "#fff", borderColor: "transparent" }}
                            onClick={(e) => { e.stopPropagation(); onWishEmployee(r.uid!); }}
                          >
                            💬 Send Message
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button className="cm-ghost-btn" onClick={()=>{setEditBday(r);setBdayForm({name:r.name,email:r.email,birthDate:r.birthDate,department:r.department||""});setBdayErr({});setShowBdayForm(true);}}>✏️</button>
                            <button className="cm-del-btn" disabled={deleting===r.id} onClick={()=>handleDeleteBday(r.id,r.name)}>{deleting===r.id?"…":"✕ Remove"}</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}

        </div>
      </div>

      {/* BIRTHDAY MODAL */}
      {showBdayForm&&(
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&setShowBdayForm(false)}>
          <div className="cm-modal-inner">
            <div className="cm-modal-title">🎂 {editBday?"Edit":"Add"} Birthday</div>
            <div className="cm-field"><label className="cm-label">Full Name *</label><input className={"cm-input"+(bdayErr.name?" err":"")} placeholder="e.g. Arjun Sharma" value={bdayForm.name} onChange={e=>setBdayForm({...bdayForm,name:e.target.value})}/>{bdayErr.name&&<div className="cm-err-txt">{bdayErr.name}</div>}</div>
            <div className="cm-field"><label className="cm-label">Email *</label><input className={"cm-input"+(bdayErr.email?" err":"")} type="email" placeholder="arjun@company.com" value={bdayForm.email} onChange={e=>setBdayForm({...bdayForm,email:e.target.value})}/>{bdayErr.email&&<div className="cm-err-txt">{bdayErr.email}</div>}</div>
            <div className="cm-field"><label className="cm-label">Date of Birth *</label><input className={"cm-input"+(bdayErr.birthDate?" err":"")} type="date" value={bdayForm.birthDate} onChange={e=>setBdayForm({...bdayForm,birthDate:e.target.value})}/>{bdayErr.birthDate&&<div className="cm-err-txt">{bdayErr.birthDate}</div>}</div>
            <div className="cm-field"><label className="cm-label">Department (optional)</label><input className="cm-input" placeholder="e.g. Engineering" value={bdayForm.department} onChange={e=>setBdayForm({...bdayForm,department:e.target.value})}/></div>
            <div className="cm-modal-btns"><button className="cm-cancel-btn" onClick={()=>{setShowBdayForm(false);setEditBday(null);}}>Cancel</button><button className="cm-save-btn" disabled={savingBday} onClick={handleSaveBday}>{savingBday?"Saving…":editBday?"Save Changes":"Add Birthday"}</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarView;