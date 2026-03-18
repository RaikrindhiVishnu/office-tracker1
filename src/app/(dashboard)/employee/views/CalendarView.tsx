"use client";

import { useState, useEffect } from "react";
import {
  collection, onSnapshot,
  addDoc, deleteDoc, updateDoc, doc,
  serverTimestamp, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BirthdayRecord {
  id: string; name: string; email: string;
  birthDate: string; birthMonthDay: string;
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
}) => {
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

      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-5xl max-h-[95vh] flex flex-col" onClick={e=>e.stopPropagation()}>

          {/* Tab bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2 flex-wrap">
              {([
                {key:"calendar",  label:"📅 Calendar",  badge:0},
                {key:"birthdays", label:"🎂 Birthdays",  badge:todayBdayCount},
                {key:"festivals", label:"🪔 Festivals",  badge:upcomingFestCount},
                {key:"events",    label:"📌 Events",     badge:0},
                {key:"history",   label:"📋 History",    badge:0},
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
            <div className="flex gap-3 flex-1 min-h-0">
              <div className="flex-1 bg-white rounded-xl shadow-xl border border-slate-200 p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Holiday Calendar</h2>
                    <p className="text-xs text-slate-500">Holidays · Birthdays · Festivals · Events</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="cm-add-btn pink" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>🎂 Add Birthday</button>
                    <button className="cm-add-btn amber" onClick={()=>{setShowFestForm(true);setFestErr({});setEditFest(null);setFestForm(emptyFest);}}>🪔 Add Festival</button>
                    <button className="cm-add-btn" onClick={()=>{setShowEventForm(true);setEventErr({});setEditEvent(null);setEventForm(emptyEvent);}}>📌 Add Event</button>
                    <button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1))} className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">← Prev</button>
                    <div className="px-4 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm">{calendarDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</div>
                    <button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1))} className="px-3 py-1.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">Next →</button>
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
                      <div key={day} className={"h-24 border-2 rounded-lg p-1 text-xs overflow-hidden hover:shadow-md transition-shadow "+bg}>
                        <div className={"font-bold text-sm leading-none mb-0.5 "+(isToday?"text-green-700":dayBdays.length?"text-purple-700":"")}>{day}</div>
                        {holiday&&<div className="text-[9px] text-rose-600 truncate">{holiday.title}</div>}
                        {dayBdays.map(b=>(
                          <div key={b.id}>
                            <span className="cm-bday-pill" title={b.name}>🎂 {b.name.split(" ")[0]}</span>
                            {b.birthMonthDay===todayMD&&(
                              <button
                                className={"cm-wish-btn"+(b.lastWishSentOn===todayISO?" sent":"")}
                                disabled={sending===b.id}
                                onClick={e=>sendWish(e,b)}
                              >
                                {sending===b.id?"…":b.lastWishSentOn===todayISO?"✓ Sent":"Send Wish"}
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
              <div className="w-52 flex flex-col gap-3 overflow-y-auto">
                {nextBday&&(
                  <div className="cm-next-card" style={{background:"linear-gradient(135deg,#7c3aed,#ec4899)"}}>
                    <div style={{position:"absolute",top:7,right:8,fontSize:10,fontWeight:900,color:"rgba(255,255,255,.9)",background:"rgba(255,255,255,.2)",padding:"1px 7px",borderRadius:8}}>{nextBday.days}d</div>
                    <div style={{fontSize:18,marginBottom:2}}>🎂</div>
                    <div style={{fontSize:12,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nextBday.emp.name}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.75)"}}>Next Birthday</div>
                  </div>
                )}
                {nextFest&&(
                  <div className="cm-next-card" style={{background:"linear-gradient(135deg,#f59e0b,#f97316)"}}>
                    <div style={{position:"absolute",top:7,right:8,fontSize:10,fontWeight:900,color:"rgba(255,255,255,.9)",background:"rgba(255,255,255,.2)",padding:"1px 7px",borderRadius:8}}>{nextFest.days}d</div>
                    <div style={{fontSize:18,marginBottom:2}}>{nextFest.fest.bannerEmoji}</div>
                    <div style={{fontSize:12,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nextFest.fest.title}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.75)"}}>{fmtDate(nextFest.fest.festivalDate)}</div>
                  </div>
                )}

                {/* Birthdays sidebar */}
                <div className="bg-white rounded-xl border border-slate-200 shadow p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">🎂 Birthdays</span>
                    <button className="cm-add-btn pink sm" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>+ Add</button>
                  </div>
                  {monthBirthdays.length===0
                    ?<div className="text-xs text-slate-400">None this month</div>
                    :monthBirthdays.map(b=>{
                      const isToday=b.birthMonthDay===todayMD;
                      return (
                        <div key={b.id} className={"rounded-lg px-2 py-1.5 mb-1 border text-xs "+(isToday?"bg-purple-50 border-purple-200":"bg-slate-50 border-slate-100")}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-800 truncate flex-1">{b.name}</span>
                            <button className="text-rose-400 hover:text-rose-600 font-bold text-[11px] px-1 border-none bg-transparent cursor-pointer" disabled={deleting===b.id} onClick={()=>handleDeleteBday(b.id,b.name)}>{deleting===b.id?"…":"✕"}</button>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className={"text-[10px] font-bold px-1.5 rounded "+(isToday?"bg-purple-200 text-purple-800":"bg-slate-200 text-slate-600")}>{isToday?"🎉 Today":b.birthMonthDay.slice(3)}</span>
                            {isToday&&(
                              <button
                                className={"cm-wish-btn"+(b.lastWishSentOn===todayISO?" sent":"")}
                                disabled={sending===b.id}
                                onClick={e=>sendWish(e,b)}
                                style={{fontSize:10,padding:"2px 7px"}}
                              >
                                {sending===b.id?"…":b.lastWishSentOn===todayISO?"✓":"🎉 Wish"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>

                {/* Festivals sidebar — shows ALL festivals, not just this month */}
                <div className="bg-white rounded-xl border border-slate-200 shadow p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">🪔 Festivals</span>
                    <button className="cm-add-btn amber sm" onClick={()=>{setShowFestForm(true);setFestErr({});setEditFest(null);setFestForm(emptyFest);}}>+ Add</button>
                  </div>
                  {/* ✅ Show ALL festivals sorted: upcoming first, then past */}
                  {festivals.length===0
                    ?<div className="text-xs text-slate-400">No festivals added</div>
                    :[
                        ...festivals.filter(f=>daysUntil(f.festivalDate)>=0).sort((a,b)=>a.festivalDate.localeCompare(b.festivalDate)),
                        ...festivals.filter(f=>daysUntil(f.festivalDate)<0).sort((a,b)=>b.festivalDate.localeCompare(a.festivalDate)),
                      ].map(f=>{
                        const days=daysUntil(f.festivalDate);
                        const isPast=days<0;
                        return (
                          <div key={f.id} className={"rounded-lg px-2 py-1.5 mb-1 text-xs border "+(days===0?"bg-amber-100 border-amber-300":isPast?"bg-slate-50 border-slate-100":"bg-amber-50 border-amber-100")}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 truncate flex-1">{f.bannerEmoji} {f.title}</span>
                              <button className="text-rose-400 hover:text-rose-600 font-bold text-[11px] px-1 border-none bg-transparent cursor-pointer" disabled={deleting===f.id} onClick={()=>handleDeleteFest(f.id,f.title)}>{deleting===f.id?"…":"✕"}</button>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-amber-600">{fmtDate(f.festivalDate)}</span>
                              {days===0&&<span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1 rounded">Today!</span>}
                              {days>0&&days<=7&&<span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1 rounded">{days}d</span>}
                              {isPast&&<span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1 rounded">⚠️ Past</span>}
                            </div>
                          </div>
                        );
                      })
                  }
                </div>

                {/* Events sidebar */}
                <div className="bg-white rounded-xl border border-slate-200 shadow p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">📌 Events</span>
                    <button className="cm-add-btn sm" onClick={()=>{setShowEventForm(true);setEventErr({});setEditEvent(null);setEventForm(emptyEvent);}}>+ Add</button>
                  </div>
                  {monthEvents.length===0
                    ?<div className="text-xs text-slate-400">None this month</div>
                    :monthEvents.map(ev=>(
                      <div key={ev.id} className="rounded-lg px-2 py-1.5 mb-1 bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5 justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{background:ev.color||"#6366f1"}}/>
                            <span className="font-bold text-slate-800 truncate">{ev.title}</span>
                          </div>
                          <button className="text-rose-400 hover:text-rose-600 font-bold text-[11px] px-1 border-none bg-transparent cursor-pointer" disabled={deleting===ev.id} onClick={()=>handleDeleteEvent(ev.id,ev.title)}>{deleting===ev.id?"…":"✕"}</button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(ev.date)}</div>
                      </div>
                    ))
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
                <button className="cm-add-btn pink" onClick={()=>{setShowBdayForm(true);setBdayErr({});setEditBday(null);setBdayForm(emptyBday);}}>+ Add Birthday</button>
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
                        {isToday&&(
                          <button
                            className={"cm-wish-btn"+(alreadySent?" sent":"")}
                            style={{fontSize:11,padding:"5px 10px"}}
                            disabled={sending===r.id||alreadySent}
                            onClick={e=>sendWish(e,r)}
                          >
                            {sending===r.id?"…":alreadySent?"✓ Sent":"🎉 Wish"}
                          </button>
                        )}
                        <button className="cm-ghost-btn" onClick={()=>{setEditBday(r);setBdayForm({name:r.name,email:r.email,birthDate:r.birthDate,department:r.department||""});setBdayErr({});setShowBdayForm(true);}}>✏️</button>
                        <button className="cm-del-btn" disabled={deleting===r.id} onClick={()=>handleDeleteBday(r.id,r.name)}>{deleting===r.id?"…":"✕ Remove"}</button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* FESTIVALS TAB */}
          {tab==="festivals" && (
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 overflow-y-auto flex-1">
              <div className="cm-sec-head">
                <div><div className="cm-sec-title">🪔 Festival Greetings</div><div className="text-xs text-slate-400 mt-0.5">{festivals.length} festivals · {festivals.filter(f=>daysUntil(f.festivalDate)>=0).length} upcoming</div></div>
                <button className="cm-add-btn amber" onClick={()=>{setShowFestForm(true);setFestErr({});setEditFest(null);setFestForm(emptyFest);}}>+ Add Festival</button>
              </div>
              {festivals.length===0
                ?<div className="cm-empty"><div style={{fontSize:36,marginBottom:8}}>🪔</div>No festivals yet.</div>
                :<table className="cm-table">
                  <thead><tr><th>Festival</th><th>Date</th><th>Status</th><th>Advance</th><th>Email</th><th>Last Sent</th><th>Actions</th></tr></thead>
                  <tbody>
                    {/* ✅ Show ALL festivals: upcoming first then past */}
                    {[
                      ...festivals.filter(f=>daysUntil(f.festivalDate)>=0).sort((a,b)=>a.festivalDate.localeCompare(b.festivalDate)),
                      ...festivals.filter(f=>daysUntil(f.festivalDate)<0).sort((a,b)=>b.festivalDate.localeCompare(a.festivalDate)),
                    ].map(f=>{
                      const days=daysUntil(f.festivalDate);
                      const isPast=days<0;
                      return (
                        <tr key={f.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span style={{fontSize:20}}>{f.bannerEmoji||"🎉"}</span>
                              <div>
                                <div className="font-bold text-slate-800 text-xs">{f.title}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-30">{f.emailSubject}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="font-semibold text-slate-700 text-xs">{fmtDate(f.festivalDate)}</div>
                            {!isPast&&days<=7&&<span className="cm-badge cm-badge-warn" style={{marginTop:2,display:"inline-flex"}}>{days===0?"🎊 Today!":days+"d away"}</span>}
                          </td>
                          <td>
                            {isPast
                              ?<span className="cm-badge cm-badge-danger">⚠️ Past — update year</span>
                              :days===0?<span className="cm-badge cm-badge-warn">🎊 Today!</span>
                              :<span className="cm-badge cm-badge-info">{days}d away</span>
                            }
                          </td>
                          <td className="text-slate-400 text-xs">{f.sendInAdvanceDays>0?f.sendInAdvanceDays+"d before":"On day"}</td>
                          <td>{f.sendEmail?<span className="cm-badge cm-badge-success">✅ On</span>:<span className="cm-badge cm-badge-danger">Off</span>}</td>
                          <td>{f.lastSentOn?<span className="cm-badge cm-badge-teal">💌 {f.lastSentOn}</span>:<span className="text-slate-300 text-xs">Never</span>}</td>
                          <td>
                            <div className="flex gap-1.5">
                              <button className="cm-send-btn" disabled={sending===f.id} onClick={()=>sendFestival(f)}>{sending===f.id?"…":"📨 Send"}</button>
                              <button className="cm-ghost-btn" onClick={()=>{setEditFest(f);setFestForm({title:f.title,festivalDate:f.festivalDate,sendEmail:f.sendEmail,sendInAdvanceDays:f.sendInAdvanceDays,emailSubject:f.emailSubject,emailMessage:f.emailMessage,bannerEmoji:f.bannerEmoji||"🎉",bannerColor:f.bannerColor||"#f59e0b"});setFestErr({});setShowFestForm(true);}}>✏️</button>
                              <button className="cm-del-btn" disabled={deleting===f.id} onClick={()=>handleDeleteFest(f.id,f.title)}>{deleting===f.id?"…":"✕"}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              }
            </div>
          )}

          {/* EVENTS TAB */}
          {tab==="events" && (
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 overflow-y-auto flex-1">
              <div className="cm-sec-head">
                <div><div className="cm-sec-title">📌 Company Events</div><div className="text-xs text-slate-400 mt-0.5">{events.length} events configured</div></div>
                <button className="cm-add-btn" onClick={()=>{setShowEventForm(true);setEventErr({});setEditEvent(null);setEventForm(emptyEvent);}}>+ Add Event</button>
              </div>
              {events.length===0
                ?<div className="cm-empty"><div style={{fontSize:36,marginBottom:8}}>📅</div>No events yet.</div>
                :events.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(ev=>{
                  const days=daysUntil(ev.date);
                  return (
                    <div key={ev.id} className="cm-list-item">
                      <div className="w-1 h-10 rounded shrink-0" style={{background:ev.color||"#6366f1"}}/>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{background:(ev.color||"#6366f1")+"22"}}>📌</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{ev.title}</span>
                          {ev.announcementSentOn?<span className="cm-badge cm-badge-success">✅ Announced</span>:<span className="cm-badge cm-badge-warn">⏳ Pending</span>}
                          {days>=0&&days<=7&&<span className="cm-badge cm-badge-info">{days===0?"Today!":days+"d"}</span>}
                        </div>
                        {ev.description&&<div className="text-xs text-slate-500 truncate">{ev.description}</div>}
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">📅 {fmtDate(ev.date)}</span>
                          {ev.location&&<span className="text-[10px] text-slate-400">📍 {ev.location}</span>}
                          {ev.reminderDaysBefore&&ev.reminderDaysBefore>0&&<span className="text-[10px] text-slate-400">⏰ {ev.reminderDaysBefore}d reminder</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button className="cm-add-btn sm" disabled={!!sending} onClick={()=>sendEvent(ev,"announcement")}>{sending===ev.id+"announcement"?"…":"📨 Announce"}</button>
                        {ev.reminderDaysBefore&&ev.reminderDaysBefore>0&&<button className="cm-send-btn" disabled={!!sending} onClick={()=>sendEvent(ev,"reminder")}>{sending===ev.id+"reminder"?"…":"⏰"}</button>}
                        <button className="cm-ghost-btn" onClick={()=>{setEditEvent(ev);setEventForm({title:ev.title,date:ev.date,description:ev.description||"",color:ev.color||"#6366f1",location:ev.location||"",rsvpLink:ev.rsvpLink||"",sendAnnouncementEmail:ev.sendAnnouncementEmail??true,reminderDaysBefore:ev.reminderDaysBefore??1});setEventErr({});setShowEventForm(true);}}>✏️</button>
                        <button className="cm-del-btn" disabled={deleting===ev.id} onClick={()=>handleDeleteEvent(ev.id,ev.title)}>{deleting===ev.id?"…":"✕ Delete"}</button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* HISTORY TAB */}
          {tab==="history" && (
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 overflow-y-auto flex-1">
              <div className="cm-sec-head">
                <div><div className="cm-sec-title">📋 Greeting History</div><div className="text-xs text-slate-400 mt-0.5">{logs.length} total · {logs.filter(l=>l.status==="success").length} successful</div></div>
                <div className="flex gap-1.5">
                  {["all","birthday","festival","event"].map(f=>(
                    <button key={f} className={"cm-tab "+(histFilter===f?"on":"off")} style={{padding:"5px 10px",fontSize:11}} onClick={()=>setHistFilter(f)}>
                      {f==="all"?"All":f==="birthday"?"🎂 Birthday":f==="festival"?"🪔 Festival":"📅 Event"}
                    </button>
                  ))}
                </div>
              </div>
              <table className="cm-table">
                <thead><tr><th>Type</th><th>Recipient</th><th>Subject</th><th>Sent By</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredLogs.map(l=>(
                    <tr key={l.id}>
                      <td><span className={"cm-badge "+(l.type==="birthday"?"cm-badge-purple":l.type==="festival"?"cm-badge-warn":"cm-badge-info")}>{l.type==="birthday"?"🎂":l.type==="festival"?"🪔":"📅"} {l.type}</span></td>
                      <td className="font-semibold text-slate-800">{l.recipientName||l.recipientEmail}</td>
                      <td className="text-slate-500 max-w-37.5 truncate">{l.subject}</td>
                      <td><span className={"cm-badge "+(l.sentBy==="admin"?"cm-badge-info":"cm-badge-teal")}>{l.sentBy==="admin"?"👤":"🤖"} {l.sentBy}</span></td>
                      <td className="text-slate-400 whitespace-nowrap">{l.sentAt?.slice(0,16).replace("T"," ")||"—"}</td>
                      <td><span className={"cm-badge "+(l.status==="success"?"cm-badge-success":"cm-badge-danger")}>{l.status==="success"?"✅":"❌"} {l.status}</span>{l.error&&<div className="text-[10px] text-rose-500 mt-0.5">{l.error}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLogs.length===0&&<p className="cm-empty">No history found</p>}
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

      {/* FESTIVAL MODAL */}
      {showFestForm&&(
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&setShowFestForm(false)}>
          <div className="cm-modal-inner">
            <div className="cm-modal-title">{festForm.bannerEmoji} {editFest?"Edit":"Add"} Festival</div>
            <div className="cm-field"><label className="cm-label">Festival Name *</label><input className={"cm-input"+(festErr.title?" err":"")} placeholder="e.g. Diwali, Holi, Christmas" value={festForm.title} onChange={e=>setFestForm({...festForm,title:e.target.value})}/>{festErr.title&&<div className="cm-err-txt">{festErr.title}</div>}</div>
            <div className="cm-field"><label className="cm-label">Festival Date *</label><input className={"cm-input"+(festErr.festivalDate?" err":"")} type="date" value={festForm.festivalDate} onChange={e=>setFestForm({...festForm,festivalDate:e.target.value})}/>{festErr.festivalDate&&<div className="cm-err-txt">{festErr.festivalDate}</div>}</div>
            <div className="cm-field"><label className="cm-label">Email Subject *</label><input className={"cm-input"+(festErr.emailSubject?" err":"")} placeholder="e.g. 🪔 Happy Diwali from Techgy!" value={festForm.emailSubject} onChange={e=>setFestForm({...festForm,emailSubject:e.target.value})}/>{festErr.emailSubject&&<div className="cm-err-txt">{festErr.emailSubject}</div>}</div>
            <div className="cm-field"><label className="cm-label">Email Message</label><textarea className="cm-textarea" placeholder="Custom greeting for this festival..." value={festForm.emailMessage} onChange={e=>setFestForm({...festForm,emailMessage:e.target.value})}/></div>
            <div className="cm-field"><label className="cm-label">Send In Advance (days)</label><input className="cm-input" type="number" min="0" max="30" value={festForm.sendInAdvanceDays} onChange={e=>setFestForm({...festForm,sendInAdvanceDays:parseInt(e.target.value)||0})}/></div>
            <div className="cm-field"><label className="cm-label">Festival Emoji</label><div className="cm-emoji-grid">{FESTIVAL_EMOJIS.map(em=><div key={em} className={"cm-emoji-opt"+(festForm.bannerEmoji===em?" sel":"")} onClick={()=>setFestForm({...festForm,bannerEmoji:em})}>{em}</div>)}</div></div>
            <div className="cm-field"><label className="cm-label">Banner Colour</label><div className="cm-color-grid">{FESTIVAL_COLORS.map(c=><div key={c} className={"cm-color-dot"+(festForm.bannerColor===c?" sel":"")} style={{background:c}} onClick={()=>setFestForm({...festForm,bannerColor:c})}/>)}</div></div>
            <div className="cm-field"><div className="flex items-center gap-2 cursor-pointer" onClick={()=>setFestForm({...festForm,sendEmail:!festForm.sendEmail})}><div className={"cm-toggle-track"+(festForm.sendEmail?" on":"")}><div className="cm-toggle-thumb"/></div><span className="text-sm text-slate-600 font-medium">Send automated email greetings</span></div></div>
            <div className="cm-modal-btns"><button className="cm-cancel-btn" onClick={()=>{setShowFestForm(false);setEditFest(null);}}>Cancel</button><button className="cm-save-btn" disabled={savingFest} onClick={handleSaveFest}>{savingFest?"Saving…":editFest?"Save Changes":"Add Festival"}</button></div>
          </div>
        </div>
      )}

      {/* EVENT MODAL */}
      {showEventForm&&(
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&setShowEventForm(false)}>
          <div className="cm-modal-inner">
            <div className="cm-modal-title">📌 {editEvent?"Edit":"Add"} Company Event</div>
            <div className="cm-field"><label className="cm-label">Event Title *</label><input className={"cm-input"+(eventErr.title?" err":"")} placeholder="e.g. Annual Day, Team Outing" value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/>{eventErr.title&&<div className="cm-err-txt">{eventErr.title}</div>}</div>
            <div className="cm-field"><label className="cm-label">Date *</label><input className={"cm-input"+(eventErr.date?" err":"")} type="date" value={eventForm.date} onChange={e=>setEventForm({...eventForm,date:e.target.value})}/>{eventErr.date&&<div className="cm-err-txt">{eventErr.date}</div>}</div>
            <div className="cm-field"><label className="cm-label">Description</label><textarea className="cm-textarea" placeholder="Short description…" value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></div>
            <div className="cm-field"><label className="cm-label">Location (optional)</label><input className="cm-input" placeholder="e.g. Bangalore HQ / Online" value={eventForm.location} onChange={e=>setEventForm({...eventForm,location:e.target.value})}/></div>
            <div className="cm-field"><label className="cm-label">RSVP Link (optional)</label><input className="cm-input" type="url" placeholder="https://…" value={eventForm.rsvpLink} onChange={e=>setEventForm({...eventForm,rsvpLink:e.target.value})}/></div>
            <div className="cm-field"><label className="cm-label">Reminder (days before)</label><input className="cm-input" type="number" min="0" max="30" value={eventForm.reminderDaysBefore} onChange={e=>setEventForm({...eventForm,reminderDaysBefore:parseInt(e.target.value)||0})}/></div>
            <div className="cm-field"><label className="cm-label">Colour</label><div className="cm-color-grid">{EVENT_COLORS.map(c=><div key={c.hex} className={"cm-color-dot"+(eventForm.color===c.hex?" sel":"")} style={{background:c.hex}} title={c.label} onClick={()=>setEventForm({...eventForm,color:c.hex})}/>)}</div></div>
            <div className="cm-field"><div className="flex items-center gap-2 cursor-pointer" onClick={()=>setEventForm({...eventForm,sendAnnouncementEmail:!eventForm.sendAnnouncementEmail})}><div className={"cm-toggle-track"+(eventForm.sendAnnouncementEmail?" on":"")}><div className="cm-toggle-thumb"/></div><span className="text-sm text-slate-600 font-medium">Send automated announcement emails</span></div></div>
            <div className="cm-modal-btns"><button className="cm-cancel-btn" onClick={()=>{setShowEventForm(false);setEditEvent(null);}}>Cancel</button><button className="cm-save-btn" disabled={savingEvent} onClick={handleSaveEvent}>{savingEvent?"Saving…":editEvent?"Save Changes":"Add Event"}</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarView;