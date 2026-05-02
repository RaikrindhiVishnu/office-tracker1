"use client";
// GreetingsAdmin.tsx – Auto-synced from users collection (no manual birthdays collection)
// ✅ NEW: "Send Mail" tab added for composing and sending custom emails to employees

import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc,
  doc, serverTimestamp, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  FaThLarge, FaBirthdayCake, FaTrophy, FaHandWave, FaCalendarAlt, 
  FaHistory, FaInbox, FaBell, FaSearch, FaPaperPlane, FaPaperclip, 
  FaTrash, FaEdit, FaChevronRight, FaPlus, FaCheckCircle, FaExclamationTriangle 
} from "react-icons/fa";
import { 
  IoSparkles, IoCloseCircle, IoNotifications, IoGift, IoBalloon, 
  IoMail, IoBusiness, IoPeople, IoPerson, IoMegaphone 
} from "react-icons/io5";
import { MdCelebration, MdOutlineMail } from "react-icons/md";
import { GiDiyaLamp } from "react-icons/gi";
import { GoDotFill } from "react-icons/go";

interface Employee {
  id: string; name: string; email: string;
  birthDate: string; birthMonthDay: string;
  department?: string; joinDate?: string;
  lastWishSentOn?: string; lastAnniversarySentOn?: string;
}
interface Achievement {
  id: string; employeeId: string; employeeName: string; employeeEmail: string;
  title: string; description: string; category: string;
  awardDate: string; sentOn?: string;
}
interface NewJoiner {
  id: string; name: string; email: string; department?: string;
  designation?: string; joinDate: string; sentOn?: string;
}
interface Festival {
  id: string; title: string; festivalDate: string;
  sendEmail: boolean; sendInAdvanceDays: number;
  emailSubject: string; emailMessage: string;
  bannerEmoji: string; bannerColor: string; lastSentOn?: string;
}
interface CompanyEvent {
  id: string; title: string; description: string;
  eventDate: string; location?: string; color: string;
  sendAnnouncementEmail: boolean; reminderDaysBefore: number;
  rsvpLink?: string; announcementSentOn?: string; reminderSentOn?: string;
}
interface GreetingLog {
  id: string; type: string; recipientEmail: string;
  recipientName?: string; subject: string;
  sentAt: string; sentBy: string; status: string; error?: string;
}

// ✅ NEW: Send Mail types
type MailRecipientMode = "all" | "select" | "department" | "single";
interface MailAttachment { name: string; dataUrl: string; type: string; }

type Tab = "dashboard"|"birthdays"|"anniversaries"|"achievements"|"welcome"|"festivals"|"events"|"mail"|"history";
interface StaffRecord { id: string; email: string; name: string; department?: string; }

const FESTIVAL_EMOJIS = ["🪔","🎉","🎄","🌸","🎊","🥳","🎆","🌺","🎋","🎑","✨","🪅","🎭","🎈","🐣","🌙"];
const EVENT_COLORS    = ["#193677","#0891b2","#059669","#d97706","#e11d48","#9333ea","#0284c7","#16a34a","#dc2626","#0f766e"];
const FESTIVAL_COLORS = ["#f59e0b","#ef4444","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316"];
const ACHIEVEMENT_CATEGORIES = ["Employee of the Month","Best Performance","Sales Champion","Team Player","Innovation Award","Leadership Award","Customer Hero","Most Improved","Long Service"];

const todayISO   = new Date().toISOString().slice(0,10);
const todayMMDD  = todayISO.slice(5);
const todayLabel = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

function fmtDate(d: string) {
  if (!d) return "—";
  try { return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); } catch { return d; }
}
function daysUntil(dateStr: string) {
  if (!dateStr) return 9999;
  return Math.ceil((new Date(dateStr+"T00:00:00").getTime()-new Date(todayISO+"T00:00:00").getTime())/86400000);
}
function initials(n: string) { return (n??"").split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()??"").join(""); }
function avatarGrad(name: string) {
  const g=[["#193677","#2563eb"],["#7c3aed","#a78bfa"],["#059669","#34d399"],["#d97706","#fbbf24"],["#e11d48","#fb7185"],["#0891b2","#22d3ee"]];
  return g[(name?.charCodeAt(0)??65)%g.length];
}
function yearsWorked(joinDate: string) {
  if (!joinDate) return 0;
  return new Date().getFullYear() - new Date(joinDate+"T00:00:00").getFullYear();
}
function nextOccurrence(monthDay: string): string {
  const [mm, dd] = monthDay.split("-").map(Number);
  const now = new Date(todayISO + "T00:00:00");
  let year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  if (candidate < now) candidate.setFullYear(year + 1);
  return candidate.toISOString().slice(0, 10);
}
function daysUntilMMDD(monthDay: string): number {
  return daysUntil(nextOccurrence(monthDay));
}
function formatCountdown(days: number): string {
  if (days === 0) return "TODAY!";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  if (days <= 30) return `${days} days away`;
  const weeks = Math.round(days / 7);
  return weeks < 8 ? "~"+weeks+" weeks" : Math.round(days/30)+" months";
}

const NAV_ITEMS:{id:Tab;label:string;icon:React.ReactNode}[] = [
  {id:"dashboard",    label:"Dashboard",       icon:<FaThLarge />},
  {id:"birthdays",    label:"Birthdays",        icon:<FaBirthdayCake />},
  {id:"anniversaries",label:"Work Anniversary", icon:<MdCelebration />},
  {id:"achievements", label:"Achievements",     icon:<FaTrophy />},
  {id:"welcome",      label:"New Joiners",      icon:<FaHandWave />},
  {id:"festivals",    label:"Festivals",        icon:<GiDiyaLamp />},
  {id:"events",       label:"Events",           icon:<FaCalendarAlt />},
  {id:"mail",         label:"Send Mail",        icon:<MdOutlineMail />},  // ✅ NEW
  {id:"history",      label:"History",          icon:<FaHistory />},
];

interface UserData {
  name?: string;
  email?: string;
  profilePhoto?: string;
  role?: string;
}

export default function GreetingsAdmin() {
  const [user,         setUser]         = useState<User|null>(null);
  const [userData,     setUserData]     = useState<UserData|null>(null);
  const [tab,          setTab]          = useState<Tab>("dashboard");
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newJoiners,   setNewJoiners]   = useState<NewJoiner[]>([]);
  const [allStaff,     setAllStaff]     = useState<StaffRecord[]>([]);
  const [festivals,    setFestivals]    = useState<Festival[]>([]);
  const [events,       setEvents]       = useState<CompanyEvent[]>([]);
  const [logs,         setLogs]         = useState<GreetingLog[]>([]);
  const [toast,        setToast]        = useState<{msg:string;ok?:boolean}|null>(null);
  const [sending,      setSending]      = useState<string|null>(null);
  const [deleting,     setDeleting]     = useState<string|null>(null);
  const [histFilter,   setHistFilter]   = useState("all");

  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showEmails,   setShowEmails]   = useState(false);

  // ── REMOVED: bdayModal (no manual employee entry — data comes from users) ──
  const [achModal,   setAchModal]   = useState<Achievement|null|"new">(null);
  const [joinModal,  setJoinModal]  = useState<NewJoiner|null|"new">(null);
  const [festModal,  setFestModal]  = useState<Festival|null|"new">(null);
  const [eventModal, setEventModal] = useState<CompanyEvent|null|"new">(null);

  // ✅ NEW: Send Mail state
  const [mailSubject,        setMailSubject]        = useState("");
  const [mailBody,           setMailBody]           = useState("");
  const [mailRecipientMode,  setMailRecipientMode]  = useState<MailRecipientMode>("all");
  const [mailSelectedEmps,   setMailSelectedEmps]   = useState<string[]>([]);   // ids
  const [mailDept,           setMailDept]           = useState("");
  const [mailSingleEmail,    setMailSingleEmail]    = useState("");
  const [mailSingleName,     setMailSingleName]     = useState("");
  const [mailPriority,       setMailPriority]       = useState<"normal"|"high">("normal");
  const [mailSending,        setMailSending]        = useState(false);
  const [mailErrors,         setMailErrors]         = useState<Record<string,string>>({});
  const [mailSearch,         setMailSearch]         = useState("");
  const [mailSentCount,      setMailSentCount]      = useState<number|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mailAttachments,    setMailAttachments]    = useState<MailAttachment[]>([]);

  const emptyAch   = {employeeId:"",employeeName:"",employeeEmail:"",title:"",description:"",category:"Employee of the Month",awardDate:todayISO};
  const emptyJoin  = {name:"",email:"",department:"",designation:"",joinDate:todayISO};
  const emptyFest  = {title:"",festivalDate:"",sendEmail:true,sendInAdvanceDays:0,emailSubject:"",emailMessage:"",bannerEmoji:"🎉",bannerColor:"#f59e0b"};
  const emptyEvent = {title:"",description:"",eventDate:"",location:"",color:"#193677",sendAnnouncementEmail:true,reminderDaysBefore:1,rsvpLink:""};

  const [achForm,   setAchForm]   = useState(emptyAch);
  const [joinForm,  setJoinForm]  = useState(emptyJoin);
  const [festForm,  setFestForm]  = useState(emptyFest);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [formErr,   setFormErr]   = useState<Record<string,string>>({});
  const [saving,    setSaving]    = useState(false);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return ()=> unsub();
  }, []);

  useEffect(()=>{
    const u1 = onSnapshot(collection(db, "users"), snap => {
      const employeeList: Employee[] = snap.docs
        .map(d => {
          const data = d.data();
          const birthDate: string = data.dateOfBirth || data.birthDate || "";
          const joinDate: string  = data.dateOfJoining || data.joinDate || "";
          const mm = birthDate?.slice(5, 7);
          const dd = birthDate?.slice(8, 10);
          const birthMonthDay = birthDate ? `${mm}-${dd}` : "";
          return {
            id: d.id,
            name: data.name || "",
            email: data.email || "",
            birthDate,
            birthMonthDay,
            department: data.department || "",
            joinDate,
            lastWishSentOn: data.lastWishSentOn || "",
            lastAnniversarySentOn: data.lastAnniversarySentOn || "",
          } as Employee;
        })
        .filter(e => e.email);

      setEmployees(employeeList);

      const staffList: StaffRecord[] = employeeList.map(e => ({
        id: e.id,
        email: e.email,
        name: e.name,
        department: e.department,
      }));
      setAllStaff(staffList);

      if (user?.email) {
        const myDoc = snap.docs.find(d => d.data().email === user.email);
        if (myDoc) setUserData({ ...myDoc.data() } as UserData);
      }
    });

    const u2=onSnapshot(collection(db,"festivals"),s=>setFestivals(s.docs.map(d=>({id:d.id,...d.data()} as Festival))));
    const u3=onSnapshot(collection(db,"companyEvents"),s=>setEvents(s.docs.map(d=>({id:d.id,...d.data()} as CompanyEvent))));
    const u4=onSnapshot(query(collection(db,"greetingLogs"),orderBy("sentAt","desc"),limit(200)),s=>setLogs(s.docs.map(d=>({id:d.id,...d.data()} as GreetingLog))));
    const u5=onSnapshot(collection(db,"achievements"),s=>setAchievements(s.docs.map(d=>({id:d.id,...d.data()} as Achievement))));
    const u6=onSnapshot(collection(db,"newJoiners"),s=>setNewJoiners(s.docs.map(d=>({id:d.id,...d.data()} as NewJoiner))));

    return ()=>{u1();u2();u3();u4();u5();u6();};
  },[user]);

  const recipientList   = allStaff.length>0 ? allStaff : employees.map(e=>({id:e.id,email:e.email,name:e.name,department:e.department}));
  const recipientCount  = recipientList.length;
  const recipientEmails = recipientList.map(r=>({email:r.email,name:r.name}));
  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3500);};

  // ── All unique departments ────────────────────────────────────────────────
  const allDepartments = Array.from(new Set(recipientList.map(r=>r.department).filter(Boolean))) as string[];

  // ── Computed mail recipients ──────────────────────────────────────────────
  const computedMailRecipients = (() => {
    if (mailRecipientMode === "all") return recipientList.map(r=>({email:r.email,name:r.name}));
    if (mailRecipientMode === "department") return recipientList.filter(r=>r.department===mailDept).map(r=>({email:r.email,name:r.name}));
    if (mailRecipientMode === "select") return recipientList.filter(r=>mailSelectedEmps.includes(r.id)).map(r=>({email:r.email,name:r.name}));
    if (mailRecipientMode === "single") return mailSingleEmail.trim() ? [{email:mailSingleEmail.trim(),name:mailSingleName.trim()||mailSingleEmail.trim()}] : [];
    return [];
  })();

  // ── Send functions ───────────────────────────────────────────────────────
  const sendWish=async(emp:Employee)=>{
    setSending(emp.id);
    try{
      const res=await fetch("/api/send-birthday-wish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:emp.id,email:emp.email,name:emp.name,sentBy:"admin"})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error);
      await updateDoc(doc(db,"users",emp.id),{lastWishSentOn:todayISO});
      showToast(`Birthday wish sent to ${emp.name}!`);
    }
    catch(e:any){showToast(e.message||"Failed",false);}
    finally{setSending(null);}
  };

  const sendAnniversary=async(emp:Employee)=>{
    setSending("ann_"+emp.id);
    const years=yearsWorked(emp.joinDate||"");
    try{
      const res=await fetch("/api/send-anniversary-wish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:emp.id,email:emp.email,name:emp.name,years,sentBy:"admin"})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error);
      await updateDoc(doc(db,"users",emp.id),{lastAnniversarySentOn:todayISO});
      showToast(`Anniversary wish sent to ${emp.name}! (${years} years)`);
    }
    catch(e:any){showToast(e.message||"Failed",false);}
    finally{setSending(null);}
  };

  const sendAchievement=async(ach:Achievement)=>{
    setSending("ach_"+ach.id);
    try{const res=await fetch("/api/send-achievement-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({achievementId:ach.id,email:ach.employeeEmail,name:ach.employeeName,title:ach.title,category:ach.category,description:ach.description,sentBy:"admin"})});const data=await res.json();if(!res.ok)throw new Error(data.error);showToast(`Achievement email sent to ${ach.employeeName}!`);}
    catch(e:any){showToast(e.message||"Failed",false);}finally{setSending(null);}
  };
  const sendWelcome=async(joiner:NewJoiner)=>{
    setSending("wel_"+joiner.id);
    try{const res=await fetch("/api/send-welcome-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({joinerId:joiner.id,email:joiner.email,name:joiner.name,department:joiner.department,designation:joiner.designation,joinDate:joiner.joinDate,sentBy:"admin"})});const data=await res.json();if(!res.ok)throw new Error(data.error);showToast(`Welcome email sent to ${joiner.name}!`);}
    catch(e:any){showToast(e.message||"Failed",false);}finally{setSending(null);}
  };
  const sendFestival=async(fest:Festival)=>{
    setSending(fest.id);
    try{const res=await fetch("/api/send-festival-greeting",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({festivalId:fest.id,sentBy:"admin",recipients:recipientEmails})});const data=await res.json();if(!res.ok)throw new Error(data.error);showToast(`Festival sent! (${data.sent??recipientCount} emails)`);}
    catch(e:any){showToast(e.message||"Failed",false);}finally{setSending(null);}
  };
  const sendEvent=async(ev:CompanyEvent,type:"announcement"|"reminder"="announcement")=>{
    setSending(ev.id+type);
    try{const res=await fetch("/api/send-event-announcement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId:ev.id,type,sentBy:"admin",recipients:recipientEmails})});const data=await res.json();if(!res.ok)throw new Error(data.error);showToast(`Event ${type} sent! (${data.sent??recipientCount} emails)`);}
    catch(e:any){showToast(e.message||"Failed",false);}finally{setSending(null);}
  };

  // ✅ NEW: Send Custom Mail
  const sendCustomMail = async () => {
    const err: Record<string,string> = {};
    if (!mailSubject.trim()) err.subject = "Subject is required";
    if (!mailBody.trim()) err.body = "Message body is required";
    if (mailRecipientMode === "single" && !mailSingleEmail.trim()) err.singleEmail = "Recipient email is required";
    if (mailRecipientMode === "single" && mailSingleEmail.trim() && !/\S+@\S+\.\S+/.test(mailSingleEmail)) err.singleEmail = "Invalid email address";
    if (mailRecipientMode === "department" && !mailDept) err.dept = "Select a department";
    if (mailRecipientMode === "select" && mailSelectedEmps.length === 0) err.select = "Select at least one employee";
    if (computedMailRecipients.length === 0) err.recipients = "No recipients found";
    if (Object.keys(err).length) { setMailErrors(err); return; }
    setMailErrors({});
    setMailSending(true);
    setMailSentCount(null);
    try {
      const res = await fetch("/api/send-custom-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: mailSubject.trim(),
          body: mailBody.trim(),
          recipients: computedMailRecipients,
          priority: mailPriority,
          sentBy: "admin",
          attachments: mailAttachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      const count = data.sent ?? computedMailRecipients.length;
      setMailSentCount(count);
      showToast(`Mail sent to ${count} recipient${count!==1?"s":""}!`);
      // Reset form
      setMailSubject("");
      setMailBody("");
      setMailRecipientMode("all");
      setMailSelectedEmps([]);
      setMailDept("");
      setMailSingleEmail("");
      setMailSingleName("");
      setMailPriority("normal");
      setMailAttachments([]);
      setMailSearch("");
    } catch(e:any) {
      showToast(e.message || "Failed to send mail", false);
    } finally {
      setMailSending(false);
    }
  };

  // ── File attachment handler ──────────────────────────────────────────────
  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} is too large (max 5MB)`, false); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setMailAttachments(prev => [...prev, { name: file.name, dataUrl: ev.target?.result as string, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const saveAch=async()=>{
    const err:Record<string,string>={};
    if(!achForm.employeeName.trim())err.employeeName="Required";
    if(!achForm.employeeEmail.trim())err.employeeEmail="Required";
    if(!achForm.title.trim())err.title="Required";
    if(!achForm.awardDate)err.awardDate="Required";
    if(Object.keys(err).length){setFormErr(err);return;}
    setSaving(true);
    try{const payload={...achForm,employeeName:achForm.employeeName.trim(),employeeEmail:achForm.employeeEmail.trim().toLowerCase(),title:achForm.title.trim(),description:achForm.description.trim(),updatedAt:serverTimestamp()};
      if(achModal==="new")await addDoc(collection(db,"achievements"),{...payload,createdAt:serverTimestamp()});else if(achModal)await updateDoc(doc(db,"achievements",achModal.id),payload);
      setAchModal(null);setAchForm(emptyAch);setFormErr({});showToast(achModal==="new"?"Achievement added!":"Updated!");}
    catch{showToast("Save failed",false);}finally{setSaving(false);}
  };
  const deleteAch=async(id:string,name:string)=>{if(!confirm(`Delete achievement for ${name}?`))return;setDeleting("ach_"+id);await deleteDoc(doc(db,"achievements",id)).catch(()=>showToast("Delete failed",false));setDeleting(null);showToast("Deleted.");};

  const saveJoin=async()=>{
    const err:Record<string,string>={};
    if(!joinForm.name.trim())err.name="Required";
    if(!joinForm.email.trim())err.email="Required"; else if(!/\S+@\S+\.\S+/.test(joinForm.email))err.email="Invalid email";
    if(!joinForm.joinDate)err.joinDate="Required";
    if(Object.keys(err).length){setFormErr(err);return;}
    setSaving(true);
    try{const payload={...joinForm,name:joinForm.name.trim(),email:joinForm.email.trim().toLowerCase(),department:joinForm.department.trim()||null,designation:joinForm.designation.trim()||null,updatedAt:serverTimestamp()};
      if(joinModal==="new")await addDoc(collection(db,"newJoiners"),{...payload,createdAt:serverTimestamp()});else if(joinModal)await updateDoc(doc(db,"newJoiners",joinModal.id),payload);
      setJoinModal(null);setJoinForm(emptyJoin);setFormErr({});showToast(joinModal==="new"?"New joiner added!":"Updated!");}
    catch{showToast("Save failed",false);}finally{setSaving(false);}
  };
  const deleteJoin=async(id:string,name:string)=>{if(!confirm(`Remove ${name}?`))return;setDeleting("wel_"+id);await deleteDoc(doc(db,"newJoiners",id)).catch(()=>showToast("Delete failed",false));setDeleting(null);showToast(`${name} removed.`);};

  const saveFest=async()=>{
    const err:Record<string,string>={};
    if(!festForm.title.trim())err.title="Required";if(!festForm.festivalDate)err.festivalDate="Required";if(!festForm.emailSubject.trim())err.emailSubject="Required";
    if(Object.keys(err).length){setFormErr(err);return;}
    setSaving(true);
    try{const payload={...festForm,title:festForm.title.trim(),emailSubject:festForm.emailSubject.trim(),emailMessage:festForm.emailMessage.trim(),updatedAt:serverTimestamp()};
      if(festModal==="new")await addDoc(collection(db,"festivals"),{...payload,createdAt:serverTimestamp()});else if(festModal)await updateDoc(doc(db,"festivals",festModal.id),payload);
      setFestModal(null);setFestForm(emptyFest);setFormErr({});showToast(festModal==="new"?"Festival added!":"Updated!");}
    catch{showToast("Save failed",false);}finally{setSaving(false);}
  };
  const deleteFest=async(id:string,title:string)=>{if(!confirm(`Delete "${title}"?`))return;setDeleting(id);await deleteDoc(doc(db,"festivals",id)).catch(()=>showToast("Delete failed",false));setDeleting(null);showToast(`${title} deleted.`);};

  const saveEvent=async()=>{
    const err:Record<string,string>={};
    if(!eventForm.title.trim())err.title="Required";if(!eventForm.eventDate)err.eventDate="Required";if(!eventForm.description.trim())err.description="Required";
    if(Object.keys(err).length){setFormErr(err);return;}
    setSaving(true);
    try{const payload={...eventForm,title:eventForm.title.trim(),description:eventForm.description.trim(),location:eventForm.location?.trim()||null,rsvpLink:eventForm.rsvpLink?.trim()||null,updatedAt:serverTimestamp()};
      if(eventModal==="new")await addDoc(collection(db,"companyEvents"),{...payload,createdAt:serverTimestamp()});else if(eventModal)await updateDoc(doc(db,"companyEvents",eventModal.id),payload);
      setEventModal(null);setEventForm(emptyEvent);setFormErr({});showToast(eventModal==="new"?"Event added!":"Updated!");}
    catch{showToast("Save failed",false);}finally{setSaving(false);}
  };
  const deleteEvent=async(id:string,title:string)=>{if(!confirm(`Delete "${title}"?`))return;setDeleting(id);await deleteDoc(doc(db,"companyEvents",id)).catch(()=>showToast("Delete failed",false));setDeleting(null);showToast(`${title} deleted.`);};

  // ── Derived ─────────────────────────────────────────────────────────────────
  const todayBdays    = employees.filter(e=>e.birthMonthDay===todayMMDD);
  const todayAnnivsrs = employees.filter(e=>{
    if(!e.joinDate)return false;
    const mm=e.joinDate.slice(5,7),dd=e.joinDate.slice(8,10);
    return `${mm}-${dd}`===todayMMDD&&yearsWorked(e.joinDate)>0;
  });
  const successCount  = logs.filter(l=>l.status==="success").length;
  const failCount     = logs.filter(l=>l.status==="failed").length;
  const filteredLogs  = histFilter==="all"?logs:logs.filter(l=>l.type===histFilter);
  const upcomingFests = festivals
    .filter(f => daysUntil(f.festivalDate) >= 0)
    .sort((a, b) => a.festivalDate.localeCompare(b.festivalDate));

  const nextBdayList = employees
    .filter(e => e.birthMonthDay && e.birthMonthDay.length === 5)
    .map(e => ({ ...e, daysLeft: daysUntilMMDD(e.birthMonthDay) }))
    .filter(e => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const nextBday = nextBdayList[0] ?? null;
  const sameDayBdays = nextBday ? nextBdayList.filter(e => e.daysLeft === nextBday.daysLeft) : [];

  // ✅ FIXED: Only show upcoming/today festivals — past ones are excluded from the dashboard card.
  // Past festivals still appear in the Festivals management tab where admin can update the year.
  const _festsWithDays = festivals.map(f => ({ ...f, daysLeft: daysUntil(f.festivalDate) }));
  const nextFestList = _festsWithDays
    .filter(f => f.daysLeft >= 0)           // ← ONLY future + today; drop negatives
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const nextFest = nextFestList[0] ?? null;

  const notifications = [
    ...todayBdays.map(e=>({icon:<FaBirthdayCake />,msg:`${e.name}'s Birthday today!`,color:"#7c3aed",action:()=>{setTab("birthdays");setShowNotifs(false);}})),
    ...todayAnnivsrs.map(e=>({icon:<MdCelebration />,msg:`${e.name} — ${yearsWorked(e.joinDate||"")}yr Anniversary!`,color:"#d97706",action:()=>{setTab("anniversaries");setShowNotifs(false);}})),
    ...upcomingFests.filter(f=>daysUntil(f.festivalDate)<=3).map(f=>({icon:<GiDiyaLamp />,msg:`${f.title} in ${daysUntil(f.festivalDate)}d`,color:"#b45309",action:()=>{setTab("festivals");setShowNotifs(false);}})),
  ];

  const recentEmails = logs.slice(0,8);

  // ✅ NEW: Filtered employee list for "select" mode
  const filteredStaffForSelect = recipientList.filter(r =>
    r.name.toLowerCase().includes(mailSearch.toLowerCase()) ||
    r.email.toLowerCase().includes(mailSearch.toLowerCase()) ||
    (r.department||"").toLowerCase().includes(mailSearch.toLowerCase())
  );

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --navy:#0f1f3d;--white:#fff;--bg:#f1f4f9;--border:#e4e9f2;--border2:#d1d9e8;
      --text:#0f172a;--text2:#475569;--text3:#94a3b8;
      --blue:#193677;--blue2:#2563eb;--teal:#0891b2;
      --green:#059669;--amber:#d97706;--pink:#db2777;--red:#e11d48;--purple:#7c3aed;
      --radius:12px;--radius-sm:8px;--radius-lg:16px;
      --shadow:0 1px 4px rgba(0,0,0,.07);--shadow-md:0 4px 16px rgba(0,0,0,.1);
      --font:'Manrope',sans-serif;
    }
    .gr{font-family:var(--font);min-height:100vh;background:var(--bg);color:var(--text);display:flex;font-size:14px;}

    /* sidebar */
    .gr-sb{width:230px;background:var(--navy);display:flex;flex-direction:column;flex-shrink:0;}
    .gr-logo{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:10px;}
    .gr-logo-ic{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
    .gr-logo-name{font-size:14.5px;font-weight:800;color:#fff;line-height:1.2;}
    .gr-logo-sub{font-size:9px;color:rgba(255,255,255,.35);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:1px;}
    .gr-nav{padding:12px 8px;flex:1;overflow-y:auto;}
    .gr-nav-sec{font-size:9px;font-weight:800;color:rgba(255,255,255,.22);text-transform:uppercase;letter-spacing:1.2px;padding:8px 10px 4px;}
    .gr-ni{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.45);margin-bottom:1px;transition:all .14s;position:relative;}
    .gr-ni:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);}
    .gr-ni.on{background:rgba(37,99,235,.22);color:#fff;}
    .gr-ni.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:55%;border-radius:0 2px 2px 0;background:#2563eb;}
    .gr-ni-ico{width:18px;text-align:center;font-size:14px;flex-shrink:0;}
    .gr-sb-foot{padding:12px 14px;border-top:1px solid rgba(255,255,255,.06);}
    .gr-sb-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:10px 13px;}
    .gr-sb-num{font-size:20px;font-weight:900;color:#fff;line-height:1;}
    .gr-sb-lbl{font-size:9.5px;color:rgba(255,255,255,.4);font-weight:600;margin-top:2px;}

    /* main */
    .gr-main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}

    /* topbar */
    .gr-topbar{background:var(--white);border-bottom:1px solid var(--border);padding:0 26px;height:58px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:relative;z-index:20;}
    .gr-tb-title{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.2px;}
    .gr-tb-date{font-size:11px;color:var(--text3);font-weight:500;margin-top:1px;}
    .gr-tb-right{display:flex;align-items:center;gap:8px;position:relative;}
    .gr-tb-btn{width:34px;height:34px;border-radius:9px;background:#f1f5f9;border:1.5px solid var(--border);color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s;position:relative;user-select:none;}
    .gr-tb-btn:hover{background:#e2e8f0;border-color:var(--border2);color:var(--text);}
    .gr-tb-btn.active{background:#193677;border-color:#193677;color:#fff;}
    .gr-notif-dot{position:absolute;top:-3px;right:-3px;min-width:14px;height:14px;border-radius:7px;background:#e11d48;border:2px solid var(--white);font-size:7px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;padding:0 2px;}
    .gr-av-btn{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#193677,#2563eb);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;box-shadow:0 2px 8px rgba(25,54,119,.3);}

    /* dropdown panels */
    .gr-panel{position:absolute;top:calc(100% + 8px);right:0;width:320px;background:var(--white);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.12);z-index:100;animation:panelIn .18s cubic-bezier(.34,1.2,.64,1);overflow:hidden;}
    @keyframes panelIn{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}
    .gr-panel-hd{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
    .gr-panel-title{font-size:12.5px;font-weight:800;color:var(--text);}
    .gr-panel-close{font-size:16px;cursor:pointer;color:var(--text3);line-height:1;border:none;background:none;padding:0 2px;}
    .gr-panel-close:hover{color:var(--text);}
    .gr-panel-body{max-height:320px;overflow-y:auto;}
    .gr-panel-body::-webkit-scrollbar{width:3px;}
    .gr-panel-body::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
    .gr-panel-item{display:flex;align-items:flex-start;gap:10px;padding:11px 16px;border-bottom:1px solid #f8fafc;cursor:pointer;transition:background .13s;}
    .gr-panel-item:last-child{border-bottom:none;}
    .gr-panel-item:hover{background:#f8f9ff;}
    .gr-panel-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
    .gr-panel-msg{font-size:12.5px;font-weight:600;color:var(--text);line-height:1.4;}
    .gr-panel-time{font-size:10.5px;color:var(--text3);margin-top:2px;}
    .gr-panel-empty{text-align:center;padding:28px 16px;color:var(--text3);font-size:12.5px;font-weight:600;}

    /* scroll */
    .gr-scroll{flex:1;overflow-y:auto;padding:22px 26px 40px;}
    .gr-scroll::-webkit-scrollbar{width:4px;}
    .gr-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}

    /* page header */
    .gr-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap;}
    .gr-hd-title{font-size:15.5px;font-weight:800;color:var(--text);letter-spacing:-.2px;}
    .gr-hd-sub{font-size:11.5px;color:var(--text3);font-weight:500;margin-top:2px;}

    /* info banner */
    .gr-info-banner{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;margin-bottom:16px;font-size:12.5px;font-weight:700;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;}
    .gr-type-banner{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;margin-bottom:16px;font-size:12.5px;font-weight:700;}
    .gr-type-banner.individual{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;}
    .gr-type-banner.broadcast{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;}

    /* stat cards */
    .gr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
    .gr-stat{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:20px 20px 16px;box-shadow:var(--shadow);transition:all .2s;position:relative;overflow:hidden;cursor:default;}
    .gr-stat:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);}
    .gr-stat::after{content:'';position:absolute;bottom:-18px;right:-18px;width:72px;height:72px;border-radius:50%;background:var(--stat-clr,#193677);opacity:.06;}
    .gr-stat-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;}
    .gr-stat-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
    .gr-stat-badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;}
    .gr-stat-num{font-size:32px;font-weight:900;color:var(--text);line-height:1;margin-bottom:3px;}
    .gr-stat-lbl{font-size:11.5px;color:var(--text2);font-weight:600;}
    .gr-stat-bar{height:3px;border-radius:3px;margin-top:12px;background:#f1f5f9;overflow:hidden;}
    .gr-stat-bar-fill{height:100%;border-radius:3px;transition:width .6s ease;}

    /* quick tiles */
    .gr-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
    .gr-tile{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow);}
    .gr-tile:hover{border-color:var(--blue2);box-shadow:0 4px 16px rgba(37,99,235,.12);transform:translateY(-2px);}
    .gr-tile-ico{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
    .gr-tile-label{font-size:12.5px;font-weight:700;color:var(--text);}
    .gr-tile-sub{font-size:10.5px;color:var(--text3);font-weight:500;margin-top:1px;}

    /* card */
    .gr-card{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;}
    .gr-card-hd{padding:14px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;}
    .gr-card-title{font-size:12.5px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:7px;}
    .gr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
    .gr-grid-full{grid-column:1/-1;}

    /* table */
    .gr-tw{overflow-x:auto;}
    .gr-table{width:100%;border-collapse:collapse;}
    .gr-table th{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;padding:9px 15px;text-align:left;border-bottom:1px solid #f1f5f9;background:#fafbfc;white-space:nowrap;}
    .gr-table td{padding:11px 15px;border-bottom:1px solid #f8fafc;font-size:12.5px;vertical-align:middle;color:var(--text2);}
    .gr-table tr:last-child td{border-bottom:none;}
    .gr-table tbody tr:hover td{background:#f8f9ff;}

    /* buttons */
    .gr-btn{font-family:var(--font);font-size:11.5px;font-weight:700;padding:6px 14px;border-radius:7px;border:none;cursor:pointer;transition:all .14s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;}
    .gr-btn:disabled{opacity:.4;cursor:not-allowed;}
    .gr-btn-navy{background:var(--blue);color:#fff;box-shadow:0 2px 7px rgba(25,54,119,.25);}
    .gr-btn-navy:hover:not(:disabled){background:#142a5e;transform:translateY(-1px);}
    .gr-btn-blue{background:var(--blue2);color:#fff;}
    .gr-btn-blue:hover:not(:disabled){background:#1d4ed8;transform:translateY(-1px);}
    .gr-btn-pink{background:var(--pink);color:#fff;}
    .gr-btn-pink:hover:not(:disabled){background:#be185d;transform:translateY(-1px);}
    .gr-btn-amber{background:var(--amber);color:#fff;}
    .gr-btn-amber:hover:not(:disabled){background:#b45309;transform:translateY(-1px);}
    .gr-btn-purple{background:var(--purple);color:#fff;}
    .gr-btn-purple:hover:not(:disabled){background:#6d28d9;transform:translateY(-1px);}
    .gr-btn-teal{background:var(--teal);color:#fff;}
    .gr-btn-teal:hover:not(:disabled){background:#0e7490;transform:translateY(-1px);}
    .gr-btn-ghost{background:#f8fafc;color:var(--text2);border:1.5px solid var(--border);}
    .gr-btn-ghost:hover:not(:disabled){background:#f1f5f9;border-color:var(--border2);}
    .gr-btn-danger{background:#fff1f2;color:var(--red);border:1.5px solid #fecdd3;}
    .gr-btn-danger:hover:not(:disabled){background:#ffe4e6;}
    .gr-btn-success{background:#f0fdf4;color:var(--green);border:1.5px solid #bbf7d0;}
    .gr-btn-warn{background:#fffbeb;color:var(--amber);border:1.5px solid #fde68a;}
    .gr-btn-warn:hover:not(:disabled){background:#fef3c7;}
    .gr-btn-sm{padding:4px 10px;font-size:11px;border-radius:6px;}
    .gr-btn-lg{padding:8px 20px;font-size:12.5px;}

    /* avatar */
    .gr-av{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:#fff;flex-shrink:0;}

    /* badges */
    .gr-b{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
    .gr-b-blue  {background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;}
    .gr-b-purple{background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;}
    .gr-b-amber {background:#fffbeb;color:#b45309;border:1px solid #fde68a;}
    .gr-b-green {background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;}
    .gr-b-red   {background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;}
    .gr-b-teal  {background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;}
    .gr-b-pink  {background:#fdf2f8;color:#be185d;border:1px solid #fbcfe8;}
    .gr-b-orange{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;}

    /* list */
    .gr-li{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
    .gr-li:last-child{border-bottom:none;}

    /* upcoming */
    .gr-up{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:8px;background:#f8fafc;border:1px solid #f1f5f9;margin-bottom:5px;transition:all .14s;}
    .gr-up:hover{border-color:#bfdbfe;background:#eff6ff;}
    .gr-dpill{font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:20px;white-space:nowrap;flex-shrink:0;}

    /* form */
    .gr-frow{margin-bottom:13px;}
    .gr-lbl{display:block;font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;}
    .gr-inp{width:100%;padding:8px 11px;background:#f8fafc;border:1.5px solid var(--border);border-radius:7px;font-size:13px;color:var(--text);font-family:var(--font);outline:none;transition:all .14s;}
    .gr-inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(25,54,119,.08);background:#fff;}
    .gr-inp.err{border-color:#ef4444;}
    .gr-inp::placeholder{color:var(--text3);}
    .gr-inp-err{font-size:10.5px;color:#ef4444;margin-top:3px;font-weight:600;}
    .gr-ta{width:100%;padding:8px 11px;background:#f8fafc;border:1.5px solid var(--border);border-radius:7px;font-size:13px;color:var(--text);font-family:var(--font);outline:none;resize:vertical;min-height:72px;transition:border-color .14s;}
    .gr-ta:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(25,54,119,.08);background:#fff;}
    .gr-ta::placeholder{color:var(--text3);}
    .gr-sel{width:100%;padding:8px 11px;background:#f8fafc;border:1.5px solid var(--border);border-radius:7px;font-size:13px;color:var(--text);font-family:var(--font);outline:none;transition:all .14s;}
    .gr-sel:focus{border-color:var(--blue);}
    .gr-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .gr-tog-wrap{display:flex;align-items:center;gap:9px;cursor:pointer;}
    .gr-tog{width:36px;height:20px;border-radius:10px;background:#e2e8f0;position:relative;transition:background .2s;flex-shrink:0;border:none;cursor:pointer;}
    .gr-tog.on{background:var(--blue);}
    .gr-tog-th{width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:left .2s cubic-bezier(.34,1.4,.64,1);box-shadow:0 1px 3px rgba(0,0,0,.2);}
    .gr-tog.on .gr-tog-th{left:19px;}
    .gr-tog-lbl{font-size:12.5px;color:var(--text2);font-weight:600;}
    .gr-cgrid{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;}
    .gr-cdot{width:22px;height:22px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .13s;}
    .gr-cdot:hover{transform:scale(1.15);}
    .gr-cdot.sel{border-color:#0f172a;transform:scale(1.1);}
    .gr-egrid{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}
    .gr-eopt{width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border);background:#f8fafc;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:all .13s;}
    .gr-eopt:hover{border-color:var(--blue);background:#eff6ff;transform:scale(1.08);}
    .gr-eopt.sel{border-color:var(--blue);background:#eff6ff;}

    /* modal */
    .gr-mbk{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px);animation:grFade .16s ease;}
    @keyframes grFade{from{opacity:0}to{opacity:1}}
    .gr-modal{background:var(--white);border:1px solid var(--border);border-radius:var(--radius-lg);width:490px;max-width:94vw;max-height:90vh;overflow-y:auto;padding:24px 26px;box-shadow:0 20px 60px rgba(0,0,0,.16);animation:grSlide .2s cubic-bezier(.34,1.2,.64,1);}
    @keyframes grSlide{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
    .gr-modal::-webkit-scrollbar{width:3px;}
    .gr-modal::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    .gr-mtitle{font-size:15px;font-weight:800;color:var(--text);margin-bottom:18px;display:flex;align-items:center;gap:8px;}
    .gr-mbtns{display:flex;gap:7px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid #f1f5f9;}

    /* toast */
    .gr-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:10px;font-size:12.5px;font-weight:700;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.2);animation:grToast .2s cubic-bezier(.34,1.2,.64,1);white-space:nowrap;font-family:var(--font);}
    @keyframes grToast{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

    /* filter tabs */
    .gr-ftabs{display:flex;gap:5px;flex-wrap:wrap;}
    .gr-ftab{font-family:var(--font);font-size:11px;font-weight:700;padding:5px 11px;border-radius:6px;border:1.5px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;transition:all .13s;}
    .gr-ftab:hover{background:#f8fafc;}
    .gr-ftab.on{background:var(--blue);color:#fff;border-color:var(--blue);}

    /* recipient chips */
    .gr-rchip{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;}
    .gr-ichip{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;}

    /* empty */
    .gr-empty{text-align:center;padding:40px 20px;color:var(--text3);font-size:12.5px;font-weight:600;}
    .gr-empty-ico{font-size:32px;margin-bottom:8px;}

    /* anniversary badge */
    .gr-ann-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:linear-gradient(135deg,#fef3c7,#fed7aa);color:#b45309;border:1px solid #fde68a;}

    /* countdown ring pulse animation */
    @keyframes pulse-ring{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}
    .gr-ring-today{animation:pulse-ring 1.6s ease-in-out infinite;}

    /* ✅ NEW: Mail Composer Styles */
    .gr-mail-layout{display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start;}
    .gr-mail-panel{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;}
    .gr-mail-panel-hd{padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:11.5px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px;}
    .gr-mail-panel-body{padding:16px;}
    .gr-mail-compose{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;}
    .gr-mail-compose-hd{padding:16px 20px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;}

    /* Recipient mode tabs */
    .gr-rmode-tabs{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:14px;}
    .gr-rmode-tab{font-family:var(--font);font-size:11px;font-weight:700;padding:7px 6px;border-radius:7px;border:1.5px solid var(--border);background:#f8fafc;color:var(--text2);cursor:pointer;transition:all .13s;text-align:center;line-height:1.3;}
    .gr-rmode-tab:hover{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}
    .gr-rmode-tab.on{background:var(--blue);color:#fff;border-color:var(--blue);box-shadow:0 2px 8px rgba(25,54,119,.2);}

    /* Employee multi-select list */
    .gr-emp-list{max-height:240px;overflow-y:auto;border:1.5px solid var(--border);border-radius:8px;background:#f8fafc;}
    .gr-emp-list::-webkit-scrollbar{width:3px;}
    .gr-emp-list::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
    .gr-emp-item{display:flex;align-items:center;gap:9px;padding:8px 11px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .12s;}
    .gr-emp-item:last-child{border-bottom:none;}
    .gr-emp-item:hover{background:#eff6ff;}
    .gr-emp-item.sel{background:#eff6ff;}
    .gr-emp-cb{width:15px;height:15px;border-radius:4px;border:1.5px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;transition:all .12s;}
    .gr-emp-item.sel .gr-emp-cb{background:var(--blue);border-color:var(--blue);color:#fff;}

    /* Priority selector */
    .gr-priority-row{display:flex;gap:7px;}
    .gr-priority-opt{flex:1;padding:7px 10px;border-radius:7px;border:1.5px solid var(--border);background:#f8fafc;font-size:11.5px;font-weight:700;color:var(--text2);cursor:pointer;transition:all .13s;text-align:center;}
    .gr-priority-opt:hover{border-color:var(--border2);}
    .gr-priority-opt.sel-normal{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}
    .gr-priority-opt.sel-high{background:#fff1f2;border-color:#fecdd3;color:#e11d48;}

    /* Mail body textarea */
    .gr-mail-body{width:100%;padding:12px 14px;background:#f8fafc;border:1.5px solid var(--border);border-radius:7px;font-size:13px;color:var(--text);font-family:var(--font);outline:none;resize:vertical;min-height:180px;line-height:1.7;transition:border-color .14s;}
    .gr-mail-body:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(25,54,119,.08);background:#fff;}
    .gr-mail-body::placeholder{color:var(--text3);}

    /* Recipient preview pill */
    .gr-recip-preview{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;margin-bottom:14px;}

    /* Attachment chip */
    .gr-attach-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;border-radius:20px;background:#f1f5f9;border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--text2);}
    .gr-attach-rm{background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);line-height:1;padding:0;margin-left:2px;}
    .gr-attach-rm:hover{color:var(--red);}

    /* Send success banner */
    .gr-mail-success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 20px;text-align:center;}
  `;

  const StatCard = ({val,lbl,icon,bg,color,badge,badgeBg,barPct}:{val:number;lbl:string;icon:React.ReactNode;bg:string;color:string;badge?:string;badgeBg?:string;barPct?:number}) => (
    <div className="gr-stat" style={{"--stat-clr":color} as any}>
      <div className="gr-stat-top">
        <div className="gr-stat-ico" style={{background:bg}}>{icon}</div>
        {badge&&<span className="gr-stat-badge" style={{background:badgeBg||bg,color}}>{badge}</span>}
      </div>
      <div className="gr-stat-num" style={{color}}>{val}</div>
      <div className="gr-stat-lbl">{lbl}</div>
      {barPct!==undefined&&(
        <div className="gr-stat-bar">
          <div className="gr-stat-bar-fill" style={{width:Math.min(barPct,100)+"%",background:color}}/>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      {toast&&<div className="gr-toast" style={{background:toast.ok!==false?"#193677":"#dc2626"}}>{toast.msg}</div>}

      {(showNotifs||showEmails)&&<div style={{position:"fixed",inset:0,zIndex:19}} onClick={()=>{setShowNotifs(false);setShowEmails(false);}}/>}

      <div className="gr">
        {/* Sidebar */}
        <aside className="gr-sb">
          <div className="gr-logo">
            <div className="gr-logo-ic"><IoSparkles className="text-white" /></div>
            <div><div className="gr-logo-name">Greetings Hub</div><div className="gr-logo-sub">Techgy Innovations</div></div>
          </div>
          <nav className="gr-nav">
            <div className="gr-nav-sec">Menu</div>
            {NAV_ITEMS.map(n=>(
              <div key={n.id} className={"gr-ni"+(tab===n.id?" on":"")} onClick={()=>setTab(n.id)}>
                <span className="gr-ni-ico">{n.icon}</span>{n.label}
              </div>
            ))}
          </nav>
          <div className="gr-sb-foot">
            <div className="gr-sb-stat">
              <div className="gr-sb-num">{successCount}</div>
              <div className="gr-sb-lbl">Emails delivered total</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="gr-main">
          {/* Topbar */}
          <div className="gr-topbar">
            <div>
              <div className="gr-tb-title">
                {tab==="dashboard"?"Dashboard":tab==="birthdays"?"Birthdays":tab==="anniversaries"?"Work Anniversaries":tab==="achievements"?"Achievements":tab==="welcome"?"New Joiners":tab==="festivals"?"Festival Greetings":tab==="events"?"Company Events":tab==="mail"?"Send Mail":"Email History"}
              </div>
              <div className="gr-tb-date">{todayLabel}</div>
            </div>
            <div className="gr-tb-right">
              <button className={"gr-tb-btn"+(showNotifs?" active":"")} title="Notifications" onClick={()=>{setShowNotifs(p=>!p);setShowEmails(false);}}>
                <FaBell />
                {notifications.length>0&&<span className="gr-notif-dot">{notifications.length}</span>}
              </button>
              {showNotifs&&(
                <div className="gr-panel" style={{right:80}}>
                  <div className="gr-panel-hd">
                    <div className="gr-panel-title"><FaBell className="inline-block mr-1.5 mb-0.5" /> Notifications <span style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginLeft:4}}>{notifications.length} new</span></div>
                    <button className="gr-panel-close" onClick={()=>setShowNotifs(false)}>×</button>
                  </div>
                  <div className="gr-panel-body">
                    {notifications.length===0
                      ?<div className="gr-panel-empty"><IoSparkles className="inline-block mr-2 text-amber-500" /> All caught up! No new notifications.</div>
                      :notifications.map((n,i)=>(
                        <div key={i} className="gr-panel-item" onClick={n.action}>
                          <div className="gr-panel-ico" style={{background:n.color+"18"}}>{n.icon}</div>
                          <div>
                            <div className="gr-panel-msg">{n.msg}</div>
                            <div className="gr-panel-time">Today · Click to manage</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              <button className={"gr-tb-btn"+(showEmails?" active":"")} title="Recent Emails" onClick={()=>{setShowEmails(p=>!p);setShowNotifs(false);}}>
                <IoMail />
                {failCount>0&&<span className="gr-notif-dot" style={{background:"#f59e0b"}}>{failCount}</span>}
              </button>
              {showEmails&&(
                <div className="gr-panel" style={{right:40}}>
                  <div className="gr-panel-hd">
                    <div className="gr-panel-title"><IoMail className="inline-block mr-1.5 mb-0.5" /> Recent Emails <span style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginLeft:4}}>{successCount} sent · {failCount} failed</span></div>
                    <button className="gr-panel-close" onClick={()=>setShowEmails(false)}>×</button>
                  </div>
                  <div className="gr-panel-body">
                    {recentEmails.length===0
                      ?<div className="gr-panel-empty"><FaInbox className="inline-block mr-2 text-slate-400" /> No emails sent yet.</div>
                      :recentEmails.map(l=>(
                        <div key={l.id} className="gr-panel-item">
                          <div className="gr-panel-ico" style={{background:l.status==="success"?"#f0fdf4":"#fff1f2"}}>
                            {l.type==="birthday" ? <FaBirthdayCake /> : l.type==="festival" ? <GiDiyaLamp /> : l.type==="anniversary" ? <MdCelebration /> : l.type==="achievement" ? <FaTrophy /> : l.type==="welcome" ? <FaHandWave /> : l.type==="mail" ? <IoMail /> : <FaCalendarAlt />}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="gr-panel-msg" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.recipientName||l.recipientEmail}</div>
                            <div className="gr-panel-time" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.subject}</div>
                          </div>
                          <span className={"gr-b "+(l.status==="success"?"gr-b-green":"gr-b-red")} style={{flexShrink:0}}>{l.status==="success"?"✓":"✗"}</span>
                        </div>
                      ))
                    }
                    <div style={{padding:"10px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button className="gr-btn gr-btn-ghost" style={{width:"100%",justifyContent:"center",fontSize:11.5}} onClick={()=>{setTab("history");setShowEmails(false);}}>View Full History →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic user profile */}
              <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:4}}>
                <div style={{width:34,height:34,borderRadius:9,overflow:"hidden",flexShrink:0,boxShadow:"0 2px 8px rgba(25,54,119,.25)",border:"2px solid #e4e9f2"}}>
                  {userData?.profilePhoto
                    ? <img src={userData.profilePhoto} alt="Admin" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#193677,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12}}>
                        {(userData?.name||user?.email||"A")[0].toUpperCase()}
                      </div>
                  }
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:1,lineHeight:1}}>
                  <span style={{fontSize:12.5,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>
                    {userData?.name || user?.email?.split("@")[0] || "Admin"}
                  </span>
                  <span style={{fontSize:10,color:"var(--text3)",fontWeight:600}}>Administrator</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="gr-scroll">

            {/* ══ DASHBOARD ══ */}
            {tab==="dashboard"&&(
              <>
                <div className="gr-stats">
                  <StatCard val={recipientCount} lbl="Total Employees" icon={<IoPeople />} bg="#eff6ff" color="#1d4ed8" badge="Active" badgeBg="#dbeafe" barPct={100}/>
                  <StatCard val={nextBdayList.filter(e=>e.daysLeft===0).length||0} lbl="Birthdays Today" icon={<FaBirthdayCake />} bg="#fdf4ff" color="#7c3aed" badge={nextBdayList.filter(e=>e.daysLeft===0).length>0?"Today!":nextBday?"Next: "+nextBday.daysLeft+"d":undefined} badgeBg="#f3e8ff" barPct={nextBdayList.filter(e=>e.daysLeft===0).length>0?100:0}/>
                  <StatCard val={todayAnnivsrs.length} lbl="Anniversaries Today" icon={<MdCelebration />} bg="#fffbeb" color="#d97706" badge={todayAnnivsrs.length>0?"Today!":undefined} badgeBg="#fef3c7" barPct={todayAnnivsrs.length>0?100:0}/>
                  <StatCard val={successCount} lbl="Emails Sent" icon={<IoMail />} bg="#f0fdf4" color="#059669" badge={failCount+" failed"} badgeBg={failCount>0?"#fff1f2":"#f0fdf4"} barPct={logs.length>0?Math.round((successCount/logs.length)*100):0}/>
                </div>

                <div style={{marginBottom:8,fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".6px"}}>Quick Actions</div>
                <div className="gr-tiles">
                  {[
                    {icon:<FaBirthdayCake />,label:"Birthday Wish",    sub:"Individual",bg:"#fdf4ff",action:()=>setTab("birthdays")},
                    {icon:<MdCelebration />,label:"Work Anniversary", sub:"Individual",bg:"#fffbeb",action:()=>setTab("anniversaries")},
                    {icon:<FaTrophy />,label:"Achievement Award",sub:"Individual",bg:"#f5f3ff",action:()=>setTab("achievements")},
                    {icon:<FaHandWave />,label:"Welcome Joiner",   sub:"Individual",bg:"#eff6ff",action:()=>setTab("welcome")},
                    {icon:<GiDiyaLamp />,label:"Festival Greeting",sub:"Broadcast",bg:"#fef3c7",action:()=>setTab("festivals")},
                    {icon:<FaCalendarAlt />,label:"Event Invitation", sub:"Broadcast",bg:"#f0fdf4",action:()=>setTab("events")},
                    {icon:<IoMail />,label:"Send Mail",        sub:"Any recipients",bg:"#f0f9ff",action:()=>setTab("mail")},
                    {icon:<FaHistory />,label:"View History",     sub:"All emails",bg:"#f8fafc",action:()=>setTab("history")},
                  ].map(t=>(
                    <div key={t.label} className="gr-tile" onClick={t.action}>
                      <div className="gr-tile-ico" style={{background:t.bg, color: "#193677"}}>{t.icon}</div>
                      <div><div className="gr-tile-label">{t.label}</div><div className="gr-tile-sub">{t.sub}</div></div>
                    </div>
                  ))}
                </div>

                <div className="gr-grid2">
                  {/* Next Birthday Card */}
                  <div className="gr-card">
                    <div className="gr-card-hd">
                      <div className="gr-card-title"><FaBirthdayCake className="text-purple-500" /> Next Upcoming Birthday</div>
                      {sameDayBdays.length>1&&<span className="gr-b gr-b-purple">+{sameDayBdays.length} same day</span>}
                    </div>
                    {!nextBday ? (
                      <div className="gr-empty"><div className="gr-empty-ico"><IoBalloon className="text-pink-400" /></div>No employees with birthdays yet</div>
                    ) : (
                      <div style={{padding:"20px 20px 18px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:16}}>
                          <div style={{position:"relative",flexShrink:0}}>
                            <svg width="84" height="84" viewBox="0 0 84 84" className={nextBday.daysLeft===0?"gr-ring-today":""}>
                              <circle cx="42" cy="42" r="36" fill="none" stroke="#f3e8ff" strokeWidth="7"/>
                              <circle cx="42" cy="42" r="36" fill="none" stroke={nextBday.daysLeft===0?"#7c3aed":nextBday.daysLeft<=7?"#db2777":"#2563eb"} strokeWidth="7" strokeLinecap="round" strokeDasharray={""+2*Math.PI*36} strokeDashoffset={""+2*Math.PI*36*(nextBday.daysLeft/365)} transform="rotate(-90 42 42)" style={{transition:"stroke-dashoffset 1.2s ease"}}/>
                            </svg>
                            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                              {nextBday.daysLeft===0
                                ?<div style={{fontSize:26,lineHeight:1}}><IoSparkles className="text-amber-500" /></div>
                                :<><div style={{fontSize:22,fontWeight:900,color:"#0f172a",lineHeight:1}}>{nextBday.daysLeft}</div><div style={{fontSize:8.5,color:"#94a3b8",fontWeight:700,marginTop:1}}>DAYS</div></>
                              }
                            </div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            {sameDayBdays.slice(0,2).map((e,i)=>{
                              const[g1,g2]=avatarGrad(e.name);
                              return(
                                <div key={e.id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:i<sameDayBdays.slice(0,2).length-1?10:0}}>
                                  <div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")",width:40,height:40,borderRadius:12,fontSize:14}}>{initials(e.name)}</div>
                                  <div style={{minWidth:0}}>
                                    <div style={{fontWeight:800,color:"#0f172a",fontSize:14.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                                    <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{e.department||e.email}</div>
                                    <div style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:800,marginTop:4,padding:"2px 8px",borderRadius:20,background:e.daysLeft===0?"#f3e8ff":e.daysLeft<=3?"#fff1f2":e.daysLeft<=7?"#fef3c7":"#eff6ff",color:e.daysLeft===0?"#7c3aed":e.daysLeft<=3?"#e11d48":e.daysLeft<=7?"#b45309":"#1d4ed8"}}>
                                      <FaBirthdayCake className="text-[10px]" /> {formatCountdown(e.daysLeft)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {sameDayBdays.length>2&&<div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>+{sameDayBdays.length-2} more on the same day</div>}
                          </div>
                        </div>
                        {nextBday.daysLeft===0&&(
                          <button className="gr-btn gr-btn-pink" style={{width:"100%",justifyContent:"center",fontSize:13,padding:"9px 14px"}} disabled={sending===nextBday.id||nextBday.lastWishSentOn===todayISO} onClick={()=>sendWish(nextBday)}>
                            {sending===nextBday.id?"⏳ Sending…":nextBday.lastWishSentOn===todayISO?"✅ Wish Already Sent!":"Send Birthday Wish Now"}
                          </button>
                        )}
                        {nextBdayList.length>1&&(
                          <div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:12}}>
                            <div style={{fontSize:10,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>Also Coming Up</div>
                            {nextBdayList.filter(e=>e.daysLeft>nextBday.daysLeft).slice(0,3).map(e=>{
                              const[g1,g2]=avatarGrad(e.name);
                              return(
                                <div key={e.id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
                                  <div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")",width:26,height:26,borderRadius:7,fontSize:10}}>{initials(e.name)}</div>
                                  <div style={{flex:1,fontSize:12,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                                  <span style={{fontSize:10.5,fontWeight:800,color:"#94a3b8",flexShrink:0}}>{e.daysLeft}d</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Festivals Card */}
                  <div className="gr-card">
                    <div className="gr-card-hd">
                      <div className="gr-card-title"><GiDiyaLamp className="text-amber-500" /> Upcoming Festivals
                        {nextFestList.length>0&&<span className="gr-b gr-b-amber" style={{marginLeft:6}}>{nextFestList.length} total</span>}
                      </div>
                      <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>setTab("festivals")}>Manage →</button>
                    </div>
                    {nextFestList.length===0 ? (
                      <div className="gr-empty">
                        <div className="gr-empty-ico"><GiDiyaLamp className="text-amber-400" /></div>
                        <div>No upcoming festivals scheduled.</div>
                        <div style={{fontSize:11,marginTop:6,color:"#94a3b8"}}>If festivals show as "Date passed", update their year in the <span style={{color:"#2563eb",cursor:"pointer",fontWeight:700}} onClick={()=>setTab("festivals")}>Festivals tab →</span></div>
                      </div>
                    ) : (
                      <div style={{padding:"16px 18px 18px"}}>
                        <div style={{borderRadius:14,padding:"16px 16px 14px",background:"linear-gradient(135deg,"+nextFest!.bannerColor+"18,"+nextFest!.bannerColor+"06)",border:"1.5px solid "+nextFest!.bannerColor+"33",marginBottom:14,position:"relative",overflow:"hidden"}}>
                          <div style={{position:"absolute",right:-10,top:-10,fontSize:72,opacity:.07,transform:"rotate(15deg)",lineHeight:1,userSelect:"none",pointerEvents:"none"}}>{nextFest!.bannerEmoji||"🎊"}</div>
                          <div style={{display:"flex",alignItems:"center",gap:14,position:"relative"}}>
                            <div style={{position:"relative",flexShrink:0}}>
                              <svg width="72" height="72" viewBox="0 0 72 72" className={nextFest!.daysLeft===0?"gr-ring-today":""}>
                                <circle cx="36" cy="36" r="30" fill="none" stroke={nextFest!.bannerColor+"33"} strokeWidth="6"/>
                                <circle cx="36" cy="36" r="30" fill="none" stroke={nextFest!.bannerColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={""+2*Math.PI*30} strokeDashoffset={""+2*Math.PI*30*Math.min(Math.max(nextFest!.daysLeft,0)/365,1)} transform="rotate(-90 36 36)" style={{transition:"stroke-dashoffset 1.2s ease"}}/>
                              </svg>
                              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                                {nextFest!.daysLeft===0?<span style={{fontSize:22,lineHeight:1}}>🎊</span>:<><span style={{fontSize:18,fontWeight:900,color:"#0f172a",lineHeight:1}}>{nextFest!.daysLeft}</span><span style={{fontSize:8,color:"#94a3b8",fontWeight:700,marginTop:1}}>DAYS</span></>}
                              </div>
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:16,fontWeight:900,color:"#0f172a",letterSpacing:"-.3px",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nextFest!.title}</div>
                              <div style={{fontSize:11,color:"#64748b",marginTop:3}}><FaCalendarAlt className="inline-block mr-1 text-[10px]" /> {fmtDate(nextFest!.festivalDate)}</div>
                              <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:8,padding:"3px 10px",borderRadius:20,background:nextFest!.daysLeft===0?nextFest!.bannerColor:nextFest!.bannerColor+"22",color:nextFest!.daysLeft===0?"#fff":nextFest!.bannerColor,fontSize:11,fontWeight:900,border:"1.5px solid "+nextFest!.bannerColor+"55"}}>
                                {nextFest!.daysLeft===0?"TODAY!":nextFest!.daysLeft===1?"Tomorrow!":nextFest!.daysLeft>0&&nextFest!.daysLeft<=7?nextFest!.daysLeft+" days":nextFest!.daysLeft>0?nextFest!.daysLeft+" days":"⚠️ Date passed"}
                              </div>
                            </div>
                          </div>
                          {nextFest!.daysLeft<=3&&<button className="gr-btn gr-btn-warn" style={{width:"100%",justifyContent:"center",fontSize:12.5,padding:"8px 14px",marginTop:12}} disabled={sending===nextFest!.id} onClick={()=>sendFestival(nextFest!)}>{sending===nextFest!.id?"⏳ Sending…":"Send "+nextFest!.title+" Greetings to All"}</button>}
                          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,flexWrap:"wrap"}}>
                            <span className="gr-rchip"><IoPeople className="mr-1" /> All {recipientCount} employees</span>
                            {nextFest!.lastSentOn&&<span className="gr-b gr-b-teal"><IoMail className="mr-1" /> {nextFest!.lastSentOn}</span>}
                          </div>
                        </div>
                        {nextFestList.length>1&&(
                          <div>
                            <div style={{fontSize:10,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>All Upcoming ({nextFestList.length})</div>
                            <div style={{maxHeight:220,overflowY:"auto",paddingRight:2}}>
                              {nextFestList.map((f,idx)=>{
                                const isFirst=idx===0;
                                const pillBg=f.daysLeft<0?"#94a3b8":f.daysLeft===0?f.bannerColor:f.daysLeft<=3?"#e11d48":f.daysLeft<=7?"#d97706":"#64748b";
                                return(
                                  <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,background:isFirst?f.bannerColor+"10":"#f8fafc",border:(isFirst?"1.5px solid "+f.bannerColor+"33":"1px solid #f1f5f9"),marginBottom:5}}>
                                    <div style={{width:36,height:36,borderRadius:9,flexShrink:0,background:f.bannerColor+"22",border:"1.5px solid "+f.bannerColor+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{f.bannerEmoji||"🎊"}</div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12.5,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.title}{isFirst&&<span style={{fontSize:9,fontWeight:800,background:f.bannerColor,color:"#fff",padding:"1px 5px",borderRadius:4,marginLeft:6}}>NEXT</span>}</div>
                                      <div style={{fontSize:10.5,color:"#94a3b8",marginTop:1}}>{fmtDate(f.festivalDate)}{f.daysLeft<0&&<span style={{marginLeft:5,fontSize:9,fontWeight:800,color:"#e11d48",background:"#fff1f2",padding:"1px 5px",borderRadius:4}}>⚠️ Update year</span>}</div>
                                    </div>
                                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                                      <span style={{fontSize:10,fontWeight:900,padding:"2px 8px",borderRadius:20,background:pillBg,color:"#fff",whiteSpace:"nowrap"}}>{f.daysLeft===0?"Today":f.daysLeft===1?"Tomorrow":f.daysLeft>0?f.daysLeft+"d":"⚠️ Past"}</span>
                                      <button className="gr-btn gr-btn-warn gr-btn-sm" style={{fontSize:9.5,padding:"2px 8px"}} disabled={sending===f.id} onClick={()=>sendFestival(f)}>{sending===f.id?"…":<FaPaperPlane />}</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="gr-card gr-grid-full">
                    <div className="gr-card-hd">
                      <div className="gr-card-title"><FaHistory className="text-slate-500" /> Recent Activity</div>
                      <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>setTab("history")}>View All →</button>
                    </div>
                    <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
                      {logs.slice(0,6).map(l=>(
                        <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:9,background:l.status==="success"?"#f8f9ff":"#fff5f5",border:(l.status==="success"?"1px solid #e0e7ff":"1px solid #fecdd3")}}>
                          <span style={{fontSize:16,flexShrink:0}}>{l.type==="birthday" ? <FaBirthdayCake className="text-purple-500" /> : l.type==="festival" ? <GiDiyaLamp className="text-amber-500" /> : l.type==="anniversary" ? <MdCelebration className="text-orange-500" /> : l.type==="achievement" ? <FaTrophy className="text-amber-500" /> : l.type==="welcome" ? <FaHandWave className="text-blue-500" /> : l.type==="mail" ? <IoMail className="text-indigo-500" /> : <FaCalendarAlt className="text-slate-500" />}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.recipientName||l.recipientEmail}</div>
                            <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.subject}</div>
                          </div>
                          <span className={"gr-b "+(l.status==="success"?"gr-b-green":"gr-b-red")} style={{flexShrink:0}}>{l.status==="success"?"✓":"✗"}</span>
                        </div>
                      ))}
                      {logs.length===0&&<div className="gr-empty" style={{gridColumn:"1/-1"}}><div className="gr-empty-ico"><FaInbox className="text-slate-300" /></div>No emails sent yet</div>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══ BIRTHDAYS ══ */}
            {tab==="birthdays"&&(
              <>
                <div className="gr-hd">
                  <div>
                    <div className="gr-hd-title">Birthday Management</div>
                    <div className="gr-hd-sub">{employees.filter(e=>e.birthDate).length} employees with DOB · {todayBdays.length} birthday(s) today</div>
                  </div>
                </div>
                <div className="gr-info-banner">
                  <span>ℹ️</span>
                  <span>Employee data is automatically synced from <strong>Employee Details</strong>. To add or edit employees, go to the Employee Management section.</span>
                </div>
                <div className="gr-type-banner individual"><FaBirthdayCake className="mr-2" /><span><strong>Individual Email</strong> — Birthday wishes sent to one employee at a time on their birthday.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Employee</th><th>Email</th><th>Department</th><th>Birthday</th><th>Next Birthday</th><th>Join Date</th><th>Last Wished</th><th>Actions</th></tr></thead>
                      <tbody>
                        {employees.filter(e=>e.birthDate).slice().sort((a,b)=>daysUntilMMDD(a.birthMonthDay)-daysUntilMMDD(b.birthMonthDay)).map(e=>{
                          const[g1,g2]=avatarGrad(e.name);const dLeft=daysUntilMMDD(e.birthMonthDay);const isToday=dLeft===0;const sent=e.lastWishSentOn===todayISO;
                          return(
                            <tr key={e.id}>
                              <td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")"}}>{initials(e.name)}</div><div><div style={{fontWeight:700,color:"var(--text)"}}>{e.name}</div>{isToday&&<span className="gr-b gr-b-purple" style={{marginTop:2}}><FaBirthdayCake className="mr-1" /> Today!</span>}</div></div></td>
                              <td style={{color:"var(--text2)"}}>{e.email}</td>
                              <td style={{color:"var(--text3)"}}>{e.department||"—"}</td>
                              <td style={{fontWeight:600,color:"var(--text)"}}>{fmtDate(e.birthDate)}</td>
                              <td><span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:800,padding:"2px 8px",borderRadius:20,background:dLeft===0?"#f3e8ff":dLeft<=7?"#fff1f2":"#eff6ff",color:dLeft===0?"#7c3aed":dLeft<=7?"#e11d48":"#1d4ed8"}}>{dLeft===0?<><IoSparkles /> Today</>:dLeft===1?"Tomorrow":dLeft+"d"}</span></td>
                              <td style={{color:"var(--text3)"}}>{e.joinDate?fmtDate(e.joinDate):"—"}</td>
                              <td>{e.lastWishSentOn?<span className="gr-b gr-b-teal">✓ {e.lastWishSentOn}</span>:<span style={{color:"#cbd5e1",fontSize:11}}>Never</span>}</td>
                              <td>{isToday&&<button className={"gr-btn gr-btn-sm "+(sent?"gr-btn-success":"gr-btn-pink")} disabled={sending===e.id||sent} onClick={()=>sendWish(e)}>{sending===e.id?"…":sent?"✓":"Wish"}</button>}{!isToday&&<span style={{color:"var(--text3)",fontSize:11}}>—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {employees.filter(e=>e.birthDate).length===0&&<div className="gr-empty"><div className="gr-empty-ico"><IoPeople className="text-slate-300" /></div>No employees have Date of Birth set yet.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ ANNIVERSARIES ══ */}
            {tab==="anniversaries"&&(
              <>
                <div className="gr-hd">
                  <div>
                    <div className="gr-hd-title">Work Anniversary Wishes</div>
                    <div className="gr-hd-sub">{employees.filter(e=>e.joinDate).length} employees with join date · {todayAnnivsrs.length} anniversary(s) today</div>
                  </div>
                </div>
                <div className="gr-info-banner">
                  <span>ℹ️</span>
                  <span>Work anniversary data is auto-synced from <strong>Employee Details → Date of Joining</strong>. To update join dates, edit the employee profile.</span>
                </div>
                <div className="gr-type-banner individual"><MdCelebration className="mr-2" /><span><strong>Individual Email</strong> — Anniversary wishes sent to one employee on their work anniversary.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Employee</th><th>Email</th><th>Department</th><th>Join Date</th><th>Years</th><th>Anniversary MM-DD</th><th>Last Sent</th><th>Actions</th></tr></thead>
                      <tbody>
                        {employees.filter(e=>e.joinDate).slice().sort((a,b)=>(a.joinDate||"").slice(5).localeCompare((b.joinDate||"").slice(5))).map(e=>{
                          const[g1,g2]=avatarGrad(e.name);const yrs=yearsWorked(e.joinDate||"");const joinMD=(e.joinDate||"").slice(5);const isToday=joinMD===todayMMDD&&yrs>0;const sent=e.lastAnniversarySentOn===todayISO;
                          return(
                            <tr key={e.id}>
                              <td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")"}}>{initials(e.name)}</div><div><div style={{fontWeight:700,color:"var(--text)"}}>{e.name}</div>{isToday&&<span className="gr-b gr-b-amber" style={{marginTop:2}}>🎉 Today!</span>}</div></div></td>
                              <td style={{color:"var(--text2)"}}>{e.email}</td>
                              <td style={{color:"var(--text3)"}}>{e.department||"—"}</td>
                              <td>{fmtDate(e.joinDate||"")}</td>
                              <td><span className="gr-ann-badge">{yrs}yr</span></td>
                              <td style={{color:"var(--text3)"}}>{joinMD}</td>
                              <td>{e.lastAnniversarySentOn?<span className="gr-b gr-b-teal">✓ {e.lastAnniversarySentOn}</span>:<span style={{color:"#cbd5e1",fontSize:11}}>Never</span>}</td>
                              <td>{isToday?<button className={"gr-btn gr-btn-sm "+(sent?"gr-btn-success":"gr-btn-amber")} disabled={sending==="ann_"+e.id||sent} onClick={()=>sendAnniversary(e)}>{sending==="ann_"+e.id?"…":sent?"✓ Sent":"🎉 Wish"}</button>:<span style={{color:"var(--text3)",fontSize:11}}>—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {employees.filter(e=>e.joinDate).length===0&&<div className="gr-empty"><div className="gr-empty-ico"><MdCelebration className="text-slate-300" /></div>No join dates set.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ ACHIEVEMENTS ══ */}
            {tab==="achievements"&&(
              <>
                <div className="gr-hd">
                  <div><div className="gr-hd-title">🏆 Employee Achievements</div><div className="gr-hd-sub">{achievements.length} achievements logged</div></div>
                  <button className="gr-btn gr-btn-purple gr-btn-lg" onClick={()=>{setAchModal("new");setAchForm(emptyAch);setFormErr({});}}>+ Add Achievement</button>
                </div>
                <div className="gr-type-banner individual"><FaTrophy className="mr-2" /><span><strong>Individual Email</strong> — Achievement recognition sent to the awarded employee only.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Employee</th><th>Award Title</th><th>Category</th><th>Date</th><th>Description</th><th>Sent</th><th>Actions</th></tr></thead>
                      <tbody>
                        {achievements.slice().sort((a,b)=>b.awardDate.localeCompare(a.awardDate)).map(a=>{
                          const[g1,g2]=avatarGrad(a.employeeName);
                          return(
                            <tr key={a.id}>
                              <td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")"}}>{initials(a.employeeName)}</div><div><div style={{fontWeight:700,color:"var(--text)"}}>{a.employeeName}</div><div style={{fontSize:11,color:"var(--text3)"}}>{a.employeeEmail}</div></div></div></td>
                              <td style={{fontWeight:600,color:"var(--text)"}}>{a.title}</td>
                              <td><span className="gr-b gr-b-purple">{a.category}</span></td>
                              <td style={{color:"var(--text2)"}}>{fmtDate(a.awardDate)}</td>
                              <td style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text3)"}}>{a.description||"—"}</td>
                              <td>{a.sentOn?<span className="gr-b gr-b-teal">✓ {a.sentOn}</span>:<span style={{color:"#cbd5e1",fontSize:11}}>Not sent</span>}</td>
                              <td><div style={{display:"flex",gap:4}}>
                                <button className="gr-btn gr-btn-purple gr-btn-sm" disabled={sending==="ach_"+a.id} onClick={()=>sendAchievement(a)}>{sending==="ach_"+a.id?"…":"🏆 Send"}</button>
                                <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>{setAchModal(a);setAchForm({employeeId:a.employeeId,employeeName:a.employeeName,employeeEmail:a.employeeEmail,title:a.title,description:a.description,category:a.category,awardDate:a.awardDate});setFormErr({});}}>✏️</button>
                                <button className="gr-btn gr-btn-danger gr-btn-sm" disabled={deleting==="ach_"+a.id} onClick={()=>deleteAch(a.id,a.employeeName)}>{deleting==="ach_"+a.id?"…":"🗑️"}</button>
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {achievements.length===0&&<div className="gr-empty"><div className="gr-empty-ico"><FaTrophy className="text-slate-300" /></div>No achievements logged yet.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ WELCOME ══ */}
            {tab==="welcome"&&(
              <>
                <div className="gr-hd">
                  <div><div className="gr-hd-title">👋 New Joiner Welcome Emails</div><div className="gr-hd-sub">{newJoiners.length} new joiners logged</div></div>
                  <button className="gr-btn gr-btn-teal gr-btn-lg" onClick={()=>{setJoinModal("new");setJoinForm(emptyJoin);setFormErr({});}}>+ Add New Joiner</button>
                </div>
                <div className="gr-type-banner individual"><FaHandWave className="mr-2" /><span><strong>Individual Email</strong> — Welcome emails sent to the new employee only.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Employee</th><th>Email</th><th>Department</th><th>Designation</th><th>Join Date</th><th>Welcome Sent</th><th>Actions</th></tr></thead>
                      <tbody>
                        {newJoiners.slice().sort((a,b)=>b.joinDate.localeCompare(a.joinDate)).map(j=>{
                          const[g1,g2]=avatarGrad(j.name);
                          return(
                            <tr key={j.id}>
                              <td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")"}}>{initials(j.name)}</div><div style={{fontWeight:700,color:"var(--text)"}}>{j.name}</div></div></td>
                              <td style={{color:"var(--text2)"}}>{j.email}</td>
                              <td style={{color:"var(--text3)"}}>{j.department||"—"}</td>
                              <td style={{color:"var(--text3)"}}>{j.designation||"—"}</td>
                              <td style={{fontWeight:600,color:"var(--text)"}}>{fmtDate(j.joinDate)}</td>
                              <td>{j.sentOn?<span className="gr-b gr-b-teal">✓ {j.sentOn}</span>:<span style={{color:"#cbd5e1",fontSize:11}}>Not sent</span>}</td>
                              <td><div style={{display:"flex",gap:4}}>
                                <button className="gr-btn gr-btn-teal gr-btn-sm" disabled={sending==="wel_"+j.id} onClick={()=>sendWelcome(j)}>{sending==="wel_"+j.id?"…":"👋 Send"}</button>
                                <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>{setJoinModal(j);setJoinForm({name:j.name,email:j.email,department:j.department||"",designation:j.designation||"",joinDate:j.joinDate});setFormErr({});}}>✏️</button>
                                <button className="gr-btn gr-btn-danger gr-btn-sm" disabled={deleting==="wel_"+j.id} onClick={()=>deleteJoin(j.id,j.name)}>{deleting==="wel_"+j.id?"…":"🗑️"}</button>
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {newJoiners.length===0&&<div className="gr-empty"><div className="gr-empty-ico"><FaHandWave className="text-slate-300" /></div>No new joiners added yet.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ FESTIVALS ══ */}
            {tab==="festivals"&&(
              <>
                <div className="gr-hd">
                  <div><div className="gr-hd-title">Festival Greetings</div><div className="gr-hd-sub">{festivals.length} festivals configured</div></div>
                  <button className="gr-btn gr-btn-amber gr-btn-lg" onClick={()=>{setFestModal("new");setFestForm(emptyFest);setFormErr({});}}>+ Add Festival</button>
                </div>
                <div className="gr-type-banner broadcast"><IoMegaphone className="mr-2" /><span><strong>Broadcast</strong> — Festival greetings sent to <strong>all {recipientCount} employees</strong> at once.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Festival</th><th>Date</th><th>Countdown</th><th>Recipients</th><th>Advance</th><th>Auto-send</th><th>Last Sent</th><th>Actions</th></tr></thead>
                      <tbody>
                        {festivals.slice().sort((a,b)=>a.festivalDate.localeCompare(b.festivalDate)).map(f=>{
                          const days=daysUntil(f.festivalDate);
                          return(
                            <tr key={f.id}>
                              <td><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:34,height:34,borderRadius:9,background:f.bannerColor+"22",border:"1.5px solid "+f.bannerColor+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{f.bannerEmoji||"🎉"}</div><div><div style={{fontWeight:700,color:"var(--text)"}}>{f.title}</div><div style={{fontSize:10.5,color:"var(--text3)",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.emailSubject}</div></div></div></td>
                              <td style={{fontWeight:600,color:"var(--text)"}}>{fmtDate(f.festivalDate)}</td>
                              <td>{days>=0&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:800,padding:"2px 8px",borderRadius:20,background:days===0?f.bannerColor:days<=3?"#fff1f2":days<=7?"#fffbeb":"#f1f5f9",color:days===0?"#fff":days<=3?"#e11d48":days<=7?"#b45309":"#64748b"}}>{days===0?"🎊 Today!":days===1?"Tomorrow":days+"d"}</span>}</td>
                              <td><span className="gr-rchip"><IoPeople className="mr-1" /> All {recipientCount}</span></td>
                              <td style={{color:"var(--text3)"}}>{f.sendInAdvanceDays>0?f.sendInAdvanceDays+"d before":"On the day"}</td>
                              <td>{f.sendEmail?<span className="gr-b gr-b-green">✓ On</span>:<span className="gr-b gr-b-red">Off</span>}</td>
                              <td>{f.lastSentOn?<span className="gr-b gr-b-teal">💌 {f.lastSentOn}</span>:<span style={{color:"#cbd5e1",fontSize:11}}>Never</span>}</td>
                              <td><div style={{display:"flex",gap:4}}>
                                <button className="gr-btn gr-btn-warn gr-btn-sm" disabled={sending===f.id} onClick={()=>sendFestival(f)}>{sending===f.id?"…":"📨 Send"}</button>
                                <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>{setFestModal(f);setFestForm({title:f.title,festivalDate:f.festivalDate,sendEmail:f.sendEmail,sendInAdvanceDays:f.sendInAdvanceDays,emailSubject:f.emailSubject,emailMessage:f.emailMessage,bannerEmoji:f.bannerEmoji||"🎉",bannerColor:f.bannerColor||"#f59e0b"});setFormErr({});}}>✏️</button>
                                <button className="gr-btn gr-btn-danger gr-btn-sm" disabled={deleting===f.id} onClick={()=>deleteFest(f.id,f.title)}>{deleting===f.id?"…":"🗑️"}</button>
                              </div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {festivals.length===0&&<div className="gr-empty"><div className="gr-empty-ico"><GiDiyaLamp className="text-slate-300" /></div>No festivals added yet.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ EVENTS ══ */}
            {tab==="events"&&(
              <>
                <div className="gr-hd">
                  <div><div className="gr-hd-title">Company Events</div><div className="gr-hd-sub">{events.length} events configured</div></div>
                  <button className="gr-btn gr-btn-navy gr-btn-lg" onClick={()=>{setEventModal("new");setEventForm(emptyEvent);setFormErr({});}}>+ Add Event</button>
                </div>
                <div className="gr-type-banner broadcast"><IoMegaphone className="mr-2" /><span><strong>Broadcast</strong> — Announcements & reminders sent to <strong>all {recipientCount} employees</strong>.</span></div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Event</th><th>Date</th><th>Recipients</th><th>Location</th><th>Reminder</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {events.slice().sort((a,b)=>a.eventDate.localeCompare(b.eventDate)).map(ev=>(
                          <tr key={ev.id}>
                            <td><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:3,height:34,borderRadius:3,background:ev.color||"#193677",flexShrink:0}}/><div><div style={{fontWeight:700,color:"var(--text)"}}>{ev.title}</div><div style={{fontSize:10.5,color:"var(--text3)",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.description}</div></div></div></td>
                            <td style={{fontWeight:600,color:"var(--text)"}}>{fmtDate(ev.eventDate)}</td>
                            <td><span className="gr-rchip">👥 All {recipientCount}</span></td>
                            <td style={{color:"var(--text3)"}}>{ev.location?"📍 "+ev.location:"—"}</td>
                            <td style={{color:"var(--text3)"}}>{ev.reminderDaysBefore>0?"⏰ "+ev.reminderDaysBefore+"d":"None"}</td>
                            <td>{ev.announcementSentOn?<span className="gr-b gr-b-green">✓ Announced</span>:<span className="gr-b gr-b-amber">⏳ Pending</span>}</td>
                            <td><div style={{display:"flex",gap:4}}>
                              <button className="gr-btn gr-btn-navy gr-btn-sm" disabled={!!sending} onClick={()=>sendEvent(ev,"announcement")}>{sending===ev.id+"announcement"?"…":"Announce"}</button>
                              {ev.reminderDaysBefore>0&&<button className="gr-btn gr-btn-warn gr-btn-sm" disabled={!!sending} onClick={()=>sendEvent(ev,"reminder")}>{sending===ev.id+"reminder"?"…":"Remind"}</button>}
                              <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>{setEventModal(ev);setEventForm({title:ev.title,description:ev.description,eventDate:ev.eventDate,location:ev.location||"",color:ev.color||"#193677",sendAnnouncementEmail:ev.sendAnnouncementEmail,reminderDaysBefore:ev.reminderDaysBefore,rsvpLink:ev.rsvpLink||""});setFormErr({});}}><FaEdit /></button>
                              <button className="gr-btn gr-btn-danger gr-btn-sm" disabled={deleting===ev.id} onClick={()=>deleteEvent(ev.id,ev.title)}>{deleting===ev.id?"…":<FaTrash />}</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {events.length===0&&<div className="gr-empty"><div className="gr-empty-ico"><FaCalendarAlt className="text-slate-300" /></div>No events added yet.</div>}
                  </div>
                </div>
              </>
            )}

            {/* ══ SEND MAIL ══ ✅ NEW TAB */}
            {tab==="mail"&&(
              <>
                <div className="gr-hd">
                  <div>
                    <div className="gr-hd-title">Send Mail</div>
                    <div className="gr-hd-sub">Compose and send a custom email to any employee or group</div>
                  </div>
                  {mailSentCount!==null&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:9,background:"#f0fdf4",border:"1px solid #bbf7d0"}}>
                      <span style={{fontSize:15}}><IoCheckmarkCircle className="text-green-500" /></span>
                      <span style={{fontSize:12.5,fontWeight:700,color:"#15803d"}}>Last sent to {mailSentCount} recipient{mailSentCount!==1?"s":""}</span>
                    </div>
                  )}
                </div>

                {/* Hidden file input */}
                <input ref={fileInputRef} type="file" multiple accept="*/*" style={{display:"none"}} onChange={handleAttachFiles}/>

                <div className="gr-mail-layout">
                  {/* LEFT: Recipients panel */}
                  <div className="gr-mail-panel">
                    <div className="gr-mail-panel-hd">
                      <IoPeople className="inline-block mr-1.5" /> Recipients
                      <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:"var(--text3)"}}>
                        {computedMailRecipients.length} selected
                      </span>
                    </div>
                    <div className="gr-mail-panel-body">

                      {/* Mode selector */}
                      <div className="gr-rmode-tabs">
                        {([
                          {key:"all",   label:"All",       sub:recipientCount+" emp"},
                          {key:"dept",  label:"Dept",      sub:"By team"},
                          {key:"select",label:"Pick",      sub:"Choose"},
                          {key:"single",label:"One",       sub:"Custom"},
                        ] as const).map(m=>(
                          <button
                            key={m.key}
                            className={"gr-rmode-tab"+(mailRecipientMode===(m.key==="dept"?"department":m.key==="single"?"single":m.key as MailRecipientMode)?" on":"")}
                            onClick={()=>setMailRecipientMode(m.key==="dept"?"department":m.key==="single"?"single":m.key as MailRecipientMode)}
                          >
                            {m.label}<br/><span style={{fontSize:9,fontWeight:600,opacity:.7}}>{m.sub}</span>
                          </button>
                        ))}
                      </div>

                      {/* Mode: All */}
                      {mailRecipientMode==="all"&&(
                        <div style={{padding:"10px 12px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,fontSize:12.5,fontWeight:700,color:"#15803d"}}>
                          <IoMegaphone className="inline-block mr-2" /> Will send to all <strong>{recipientCount}</strong> employees
                        </div>
                      )}

                      {/* Mode: Department */}
                      {mailRecipientMode==="department"&&(
                        <>
                          <div className="gr-frow">
                            <label className="gr-lbl">Select Department</label>
                            <select className={"gr-sel"+(mailErrors.dept?" err":"")} value={mailDept} onChange={e=>setMailDept(e.target.value)}>
                              <option value="">— Choose department —</option>
                              {allDepartments.map(d=>(
                                <option key={d} value={d}>{d} ({recipientList.filter(r=>r.department===d).length})</option>
                              ))}
                            </select>
                            {mailErrors.dept&&<div className="gr-inp-err">⚠️ {mailErrors.dept}</div>}
                          </div>
                          {mailDept&&(
                            <div style={{padding:"9px 12px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:9,fontSize:12,fontWeight:700,color:"#1d4ed8"}}>
                              📧 {recipientList.filter(r=>r.department===mailDept).length} employees in {mailDept}
                            </div>
                          )}
                        </>
                      )}

                      {/* Mode: Select */}
                      {mailRecipientMode==="select"&&(
                        <>
                          <div className="gr-frow" style={{marginBottom:8}}>
                            <input
                              type="text"
                              placeholder="🔍 Search employees..."
                              className="gr-inp"
                              style={{fontSize:12}}
                              value={mailSearch}
                              onChange={e=>setMailSearch(e.target.value)}
                            />
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:10.5,fontWeight:700,color:"var(--text3)"}}>{mailSelectedEmps.length} selected</span>
                            <div style={{display:"flex",gap:5}}>
                              <button className="gr-btn gr-btn-ghost gr-btn-sm" style={{fontSize:10}} onClick={()=>setMailSelectedEmps(filteredStaffForSelect.map(r=>r.id))}>All</button>
                              <button className="gr-btn gr-btn-ghost gr-btn-sm" style={{fontSize:10}} onClick={()=>setMailSelectedEmps([])}>None</button>
                            </div>
                          </div>
                          <div className="gr-emp-list">
                            {filteredStaffForSelect.length===0&&<div style={{padding:"16px",textAlign:"center",fontSize:12,color:"var(--text3)"}}>No employees found</div>}
                            {filteredStaffForSelect.map(r=>{
                              const sel=mailSelectedEmps.includes(r.id);
                              const[g1,g2]=avatarGrad(r.name);
                              return(
                                <div key={r.id} className={"gr-emp-item"+(sel?" sel":"")} onClick={()=>setMailSelectedEmps(prev=>sel?prev.filter(x=>x!==r.id):[...prev,r.id])}>
                                  <div className={"gr-emp-cb"}>{sel?"✓":""}</div>
                                  <div className="gr-av" style={{background:"linear-gradient(135deg,"+g1+","+g2+")",width:24,height:24,borderRadius:6,fontSize:9}}>{initials(r.name)}</div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:12,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                                    <div style={{fontSize:10,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.department||r.email}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {mailErrors.select&&<div className="gr-inp-err" style={{marginTop:6}}>⚠️ {mailErrors.select}</div>}
                        </>
                      )}

                      {/* Mode: Single */}
                      {mailRecipientMode==="single"&&(
                        <>
                          <div className="gr-frow">
                            <label className="gr-lbl">Recipient Name</label>
                            <input type="text" placeholder="e.g. Priya Sharma" className="gr-inp" value={mailSingleName} onChange={e=>setMailSingleName(e.target.value)}/>
                          </div>
                          <div className="gr-frow">
                            <label className="gr-lbl">Recipient Email *</label>
                            <input type="email" placeholder="priya@techgyinnovations.com" className={"gr-inp"+(mailErrors.singleEmail?" err":"")} value={mailSingleEmail} onChange={e=>setMailSingleEmail(e.target.value)}/>
                            {mailErrors.singleEmail&&<div className="gr-inp-err">⚠️ {mailErrors.singleEmail}</div>}
                          </div>
                          {/* Quick fill from employee list */}
                          {recipientList.length>0&&(
                            <div>
                              <div className="gr-lbl" style={{marginBottom:6}}>Or pick from employees</div>
                              <div style={{maxHeight:160,overflowY:"auto",border:"1.5px solid var(--border)",borderRadius:8,background:"#f8fafc"}}>
                                {recipientList.filter(r=>r.name.toLowerCase().includes(mailSearch.toLowerCase())||r.email.toLowerCase().includes(mailSearch.toLowerCase())).slice(0,20).map(r=>(
                                  <div key={r.id} className="gr-emp-item" onClick={()=>{setMailSingleEmail(r.email);setMailSingleName(r.name);}}>
                                    <div className="gr-av" style={{background:"linear-gradient(135deg,"+avatarGrad(r.name)[0]+","+avatarGrad(r.name)[1]+")",width:22,height:22,borderRadius:6,fontSize:9}}>{initials(r.name)}</div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:12,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                                      <div style={{fontSize:10,color:"var(--text3)"}}>{r.email}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <input type="text" placeholder="🔍 Search..." className="gr-inp" style={{marginTop:6,fontSize:11}} value={mailSearch} onChange={e=>setMailSearch(e.target.value)}/>
                            </div>
                          )}
                        </>
                      )}

                      {/* Recipient preview summary */}
                      {computedMailRecipients.length>0&&(
                        <div style={{marginTop:12,padding:"9px 12px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,fontSize:12,fontWeight:700,color:"#15803d",display:"flex",alignItems:"center",gap:6}}>
                          <span>✅</span>
                          <span>{computedMailRecipients.length} recipient{computedMailRecipients.length!==1?"s":""} ready</span>
                        </div>
                      )}
                      {mailErrors.recipients&&<div className="gr-inp-err" style={{marginTop:6}}>⚠️ {mailErrors.recipients}</div>}

                      {/* Priority */}
                      <div style={{marginTop:14}}>
                        <div className="gr-lbl" style={{marginBottom:6}}>Priority</div>
                        <div className="gr-priority-row">
                          <div className={"gr-priority-opt"+(mailPriority==="normal"?" sel-normal":"")} onClick={()=>setMailPriority("normal")}>
                            📧 Normal
                          </div>
                          <div className={"gr-priority-opt"+(mailPriority==="high"?" sel-high":"")} onClick={()=>setMailPriority("high")}>
                            🔴 High
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Compose area */}
                  <div className="gr-mail-compose">
                    <div className="gr-mail-compose-hd">
                      <div>
                        <div style={{fontSize:13.5,fontWeight:800,color:"var(--text)"}}><IoMail className="inline-block mr-1.5 mb-0.5" /> Compose Email</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Compose and send to any recipients</div>
                      </div>
                      {mailPriority==="high"&&(
                        <span className="gr-b gr-b-red">🔴 High Priority</span>
                      )}
                    </div>

                    <div style={{padding:"18px 20px"}}>
                      {/* Subject */}
                      <div className="gr-frow">
                        <label className="gr-lbl">Subject *</label>
                        <input
                          type="text"
                          placeholder="e.g. Team Meeting Rescheduled — Please Read"
                          className={"gr-inp"+(mailErrors.subject?" err":"")}
                          value={mailSubject}
                          onChange={e=>setMailSubject(e.target.value)}
                        />
                        {mailErrors.subject&&<div className="gr-inp-err">⚠️ {mailErrors.subject}</div>}
                      </div>

                      {/* Body */}
                      <div className="gr-frow">
                        <label className="gr-lbl">Message *</label>
                        <textarea
                          className={"gr-mail-body"+(mailErrors.body?" err":"")}
                          placeholder={"Dear {name},\n\nWrite your message here...\n\nRegards,\nHR Team"}
                          value={mailBody}
                          onChange={e=>setMailBody(e.target.value)}
                          style={{minHeight:220}}
                        />
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                          {mailErrors.body&&<div className="gr-inp-err">⚠️ {mailErrors.body}</div>}
                          <div style={{fontSize:10,color:"var(--text3)",marginLeft:"auto"}}>
                            Tip: Use <code style={{background:"#f1f5f9",padding:"1px 4px",borderRadius:3}}>{"{name}"}</code> to personalize per recipient
                          </div>
                        </div>
                      </div>

                      {/* Attachments */}
                      <div className="gr-frow">
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <label className="gr-lbl" style={{margin:0}}>Attachments</label>
                          <button className="gr-btn gr-btn-ghost gr-btn-sm" onClick={()=>fileInputRef.current?.click()}>📎 Attach File</button>
                        </div>
                        {mailAttachments.length>0?(
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {mailAttachments.map((a,i)=>(
                              <span key={i} className="gr-attach-chip">
                                📎 {a.name}
                                <button className="gr-attach-rm" onClick={()=>setMailAttachments(prev=>prev.filter((_,j)=>j!==i))}>×</button>
                              </span>
                            ))}
                          </div>
                        ):(
                          <div style={{padding:"10px 14px",background:"#f8fafc",border:"1.5px dashed var(--border)",borderRadius:8,fontSize:12,color:"var(--text3)",textAlign:"center",cursor:"pointer"}} onClick={()=>fileInputRef.current?.click()}>
                            📎 Click to attach files (max 5MB each)
                          </div>
                        )}
                      </div>

                      {/* Preview summary before send */}
                      <div style={{padding:"12px 14px",background:"#f8fafc",border:"1px solid var(--border)",borderRadius:10,marginBottom:16}}>
                        <div style={{fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>Send Summary</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                          <span className="gr-b gr-b-blue">
                            {mailRecipientMode==="all" ? <><IoMegaphone className="mr-1.5" /> All employees</> :
                             mailRecipientMode==="department" ? (mailDept ? <><FaBuilding className="mr-1.5" /> {mailDept}</> : <><FaBuilding className="mr-1.5" /> No dept</>) :
                             mailRecipientMode==="select" ? <><IoPeople className="mr-1.5" /> {mailSelectedEmps.length} selected</> :
                             <><FaUser className="mr-1.5" /> {(mailSingleName || mailSingleEmail || "No recipient")}</>}
                          </span>
                          <span className="gr-b gr-b-green">📧 {computedMailRecipients.length} recipient{computedMailRecipients.length!==1?"s":""}</span>
                          {mailPriority==="high"&&<span className="gr-b gr-b-red">🔴 High Priority</span>}
                          {mailAttachments.length>0&&<span className="gr-b gr-b-teal">📎 {mailAttachments.length} file{mailAttachments.length!==1?"s":""}</span>}
                        </div>
                      </div>

                      {/* Send button */}
                      <button
                        className="gr-btn gr-btn-navy gr-btn-lg"
                        style={{width:"100%",justifyContent:"center",padding:"11px 20px",fontSize:13.5}}
                        disabled={mailSending||computedMailRecipients.length===0}
                        onClick={sendCustomMail}
                      >
                        {mailSending
                          ?"⏳ Sending…"
                          :computedMailRecipients.length===0
                            ?"⚠️ Select Recipients First"
                            :`✉️ Send to ${computedMailRecipients.length} Recipient${computedMailRecipients.length!==1?"s":""}`
                        }
                      </button>

                      {/* Clear form */}
                      <div style={{textAlign:"center",marginTop:10}}>
                        <button className="gr-btn gr-btn-ghost gr-btn-sm" style={{fontSize:11}} onClick={()=>{setMailSubject("");setMailBody("");setMailSelectedEmps([]);setMailSingleEmail("");setMailSingleName("");setMailAttachments([]);setMailErrors({});setMailSentCount(null);}}>
                          🗑️ Clear Form
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══ HISTORY ══ */}
            {tab==="history"&&(
              <>
                <div className="gr-hd">
                  <div><div className="gr-hd-title">📋 Email History</div><div className="gr-hd-sub">{logs.length} emails · {successCount} successful · {failCount} failed</div></div>
                  <div className="gr-ftabs">
                    {[{k:"all",l:"All"},{k:"birthday",l:<><FaBirthdayCake className="mr-1.5" /> Birthday</>},{k:"anniversary",l:<><MdCelebration className="mr-1.5" /> Anniversary</>},{k:"achievement",l:<><FaTrophy className="mr-1.5" /> Achievement</>},{k:"welcome",l:<><FaHandWave className="mr-1.5" /> Welcome</>},{k:"festival",l:<><GiDiyaLamp className="mr-1.5" /> Festival</>},{k:"event",l:<><FaCalendarAlt className="mr-1.5" /> Event</>},{k:"mail",l:<><IoMail className="mr-1.5" /> Mail</>}].map(f=>(
                      <button key={f.k} className={"gr-ftab"+(histFilter===f.k?" on":"")} onClick={()=>setHistFilter(f.k)}>{f.l}</button>
                    ))}
                  </div>
                </div>
                <div className="gr-card">
                  <div className="gr-tw">
                    <table className="gr-table">
                      <thead><tr><th>Type</th><th>Recipient</th><th>Email</th><th>Subject</th><th>Sent By</th><th>Time</th><th>Status</th></tr></thead>
                      <tbody>
                        {filteredLogs.map(l=>(
                          <tr key={l.id}>
                            <td><span className={"gr-b "+(l.type==="birthday"?"gr-b-purple":l.type==="festival"?"gr-b-amber":l.type==="anniversary"?"gr-b-orange":l.type==="achievement"?"gr-b-purple":l.type==="welcome"?"gr-b-teal":l.type==="mail"?"gr-b-blue":"gr-b-blue")}>{l.type==="birthday"?<FaBirthdayCake className="mr-1.5" />:l.type==="festival"?<GiDiyaLamp className="mr-1.5" />:l.type==="anniversary"?<MdCelebration className="mr-1.5" />:l.type==="achievement"?<FaTrophy className="mr-1.5" />:l.type==="welcome"?<FaHandWave className="mr-1.5" />:l.type==="mail"?<IoMail className="mr-1.5" />:<FaCalendarAlt className="mr-1.5" />} {l.type}</span></td>
                            <td style={{fontWeight:700,color:"var(--text)"}}>{l.recipientName||"—"}</td>
                            <td style={{color:"var(--text2)"}}>{l.recipientEmail}</td>
                            <td style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text3)"}}>{l.subject}</td>
                            <td><span className={"gr-b "+(l.sentBy==="admin"?"gr-b-blue":"gr-b-teal")}>{l.sentBy==="admin"?<FaUser className="mr-1.5" />:<FaRobot className="mr-1.5" />} {l.sentBy}</span></td>
                            <td style={{fontSize:11,whiteSpace:"nowrap",color:"var(--text3)"}}>{l.sentAt?.slice?.(0,16).replace("T"," ")||"—"}</td>
                            <td><span className={"gr-b "+(l.status==="success"?"gr-b-green":"gr-b-red")}>{l.status==="success"?"✓":"✗"} {l.status}</span>{l.error&&<div style={{fontSize:9.5,color:"#ef4444",marginTop:2,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}}>{l.error}</div>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredLogs.length===0&&<div className="gr-empty"><div className="gr-empty-ico"><FaInbox className="text-slate-300" /></div>No history found</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ACHIEVEMENT MODAL */}
      {achModal&&(
        <div className="gr-mbk" onClick={e=>e.target===e.currentTarget&&setAchModal(null)}>
          <div className="gr-modal">
            <div className="gr-mtitle"><FaTrophy className="inline-block mr-2 mb-1" /> {achModal==="new"?"Add Achievement":"Edit Achievement"}</div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Employee Name *</label><input type="text" placeholder="e.g. Arjun Sharma" className={"gr-inp"+(formErr.employeeName?" err":"")} value={achForm.employeeName} onChange={e=>setAchForm({...achForm,employeeName:e.target.value})}/>{formErr.employeeName&&<div className="gr-inp-err">⚠️ {formErr.employeeName}</div>}</div>
              <div className="gr-frow"><label className="gr-lbl">Employee Email *</label><input type="email" placeholder="arjun@company.com" className={"gr-inp"+(formErr.employeeEmail?" err":"")} value={achForm.employeeEmail} onChange={e=>setAchForm({...achForm,employeeEmail:e.target.value})}/>{formErr.employeeEmail&&<div className="gr-inp-err">⚠️ {formErr.employeeEmail}</div>}</div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Award Title *</label><input type="text" placeholder="e.g. Employee of the Month — March 2026" className={"gr-inp"+(formErr.title?" err":"")} value={achForm.title} onChange={e=>setAchForm({...achForm,title:e.target.value})}/>{formErr.title&&<div className="gr-inp-err">⚠️ {formErr.title}</div>}</div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Category</label><select className="gr-sel" value={achForm.category} onChange={e=>setAchForm({...achForm,category:e.target.value})}>{ACHIEVEMENT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div className="gr-frow"><label className="gr-lbl">Award Date *</label><input type="date" className={"gr-inp"+(formErr.awardDate?" err":"")} value={achForm.awardDate} onChange={e=>setAchForm({...achForm,awardDate:e.target.value})}/>{formErr.awardDate&&<div className="gr-inp-err">⚠️ {formErr.awardDate}</div>}</div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Description (optional)</label><textarea className="gr-ta" placeholder="Brief description of the achievement..." value={achForm.description} onChange={e=>setAchForm({...achForm,description:e.target.value})}/></div>
            <div className="gr-mbtns"><button className="gr-btn gr-btn-ghost" onClick={()=>setAchModal(null)}>Cancel</button><button className="gr-btn gr-btn-purple gr-btn-lg" disabled={saving} onClick={saveAch}>{saving?"⏳ Saving…":achModal==="new"?"Add Achievement":"Save Changes"}</button></div>
          </div>
        </div>
      )}

      {/* NEW JOINER MODAL */}
      {joinModal&&(
        <div className="gr-mbk" onClick={e=>e.target===e.currentTarget&&setJoinModal(null)}>
          <div className="gr-modal">
            <div className="gr-mtitle"><FaHandWave className="inline-block mr-2 mb-1" /> {joinModal==="new"?"Add New Joiner":"Edit New Joiner"}</div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Full Name *</label><input type="text" placeholder="e.g. Priya Sharma" className={"gr-inp"+(formErr.name?" err":"")} value={joinForm.name} onChange={e=>setJoinForm({...joinForm,name:e.target.value})}/>{formErr.name&&<div className="gr-inp-err">⚠️ {formErr.name}</div>}</div>
              <div className="gr-frow"><label className="gr-lbl">Work Email *</label><input type="email" placeholder="priya@techgyinnovations.com" className={"gr-inp"+(formErr.email?" err":"")} value={joinForm.email} onChange={e=>setJoinForm({...joinForm,email:e.target.value})}/>{formErr.email&&<div className="gr-inp-err">⚠️ {formErr.email}</div>}</div>
            </div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Department</label><input type="text" placeholder="e.g. Engineering" className="gr-inp" value={joinForm.department} onChange={e=>setJoinForm({...joinForm,department:e.target.value})}/></div>
              <div className="gr-frow"><label className="gr-lbl">Designation</label><input type="text" placeholder="e.g. Software Developer" className="gr-inp" value={joinForm.designation} onChange={e=>setJoinForm({...joinForm,designation:e.target.value})}/></div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Join Date *</label><input type="date" className={"gr-inp"+(formErr.joinDate?" err":"")} value={joinForm.joinDate} onChange={e=>setJoinForm({...joinForm,joinDate:e.target.value})}/>{formErr.joinDate&&<div className="gr-inp-err">⚠️ {formErr.joinDate}</div>}</div>
            <div className="gr-mbtns"><button className="gr-btn gr-btn-ghost" onClick={()=>setJoinModal(null)}>Cancel</button><button className="gr-btn gr-btn-teal gr-btn-lg" disabled={saving} onClick={saveJoin}>{saving?"⏳ Saving…":joinModal==="new"?"Add New Joiner":"Save Changes"}</button></div>
          </div>
        </div>
      )}

      {/* FESTIVAL MODAL */}
      {festModal&&(
        <div className="gr-mbk" onClick={e=>e.target===e.currentTarget&&setFestModal(null)}>
          <div className="gr-modal">
            <div className="gr-mtitle">{festForm.bannerEmoji} {festModal==="new"?"Add Festival":"Edit Festival"}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 13px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,marginBottom:14,fontSize:12,fontWeight:700,color:"#15803d"}}><span>📢</span> Broadcast — sends to <strong>all {recipientCount} employees</strong></div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Festival Name *</label><input type="text" placeholder="e.g. Diwali, Holi, Christmas" className={"gr-inp"+(formErr.title?" err":"")} value={festForm.title} onChange={e=>setFestForm({...festForm,title:e.target.value})}/>{formErr.title&&<div className="gr-inp-err">⚠️ {formErr.title}</div>}</div>
              <div className="gr-frow"><label className="gr-lbl">Festival Date *</label><input type="date" className={"gr-inp"+(formErr.festivalDate?" err":"")} value={festForm.festivalDate} onChange={e=>setFestForm({...festForm,festivalDate:e.target.value})}/>{formErr.festivalDate&&<div className="gr-inp-err">⚠️ {formErr.festivalDate}</div>}</div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Email Subject *</label><input type="text" placeholder="e.g. 🪔 Happy Diwali from Techgy Innovations!" className={"gr-inp"+(formErr.emailSubject?" err":"")} value={festForm.emailSubject} onChange={e=>setFestForm({...festForm,emailSubject:e.target.value})}/>{formErr.emailSubject&&<div className="gr-inp-err">⚠️ {formErr.emailSubject}</div>}</div>
            <div className="gr-frow"><label className="gr-lbl">Email Message</label><textarea className="gr-ta" placeholder="Custom greeting message..." value={festForm.emailMessage} onChange={e=>setFestForm({...festForm,emailMessage:e.target.value})}/></div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Send In Advance (days)</label><input type="number" min="0" max="30" className="gr-inp" value={festForm.sendInAdvanceDays} onChange={e=>setFestForm({...festForm,sendInAdvanceDays:parseInt(e.target.value)||0})}/></div>
              <div className="gr-frow"><label className="gr-lbl">Festival Emoji</label><div className="gr-egrid">{FESTIVAL_EMOJIS.slice(0,8).map(em=><div key={em} className={"gr-eopt"+(festForm.bannerEmoji===em?" sel":"")} onClick={()=>setFestForm({...festForm,bannerEmoji:em})}>{em}</div>)}</div></div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Banner Colour</label><div className="gr-cgrid">{FESTIVAL_COLORS.map(c=><div key={c} className={"gr-cdot"+(festForm.bannerColor===c?" sel":"")} style={{background:c}} onClick={()=>setFestForm({...festForm,bannerColor:c})}/>)}</div></div>
            <div className="gr-frow"><label className="gr-tog-wrap" onClick={()=>setFestForm({...festForm,sendEmail:!festForm.sendEmail})}><button className={"gr-tog"+(festForm.sendEmail?" on":"")}><div className="gr-tog-th"/></button><span className="gr-tog-lbl">Send automated email greetings</span></label></div>
            <div className="gr-mbtns"><button className="gr-btn gr-btn-ghost" onClick={()=>setFestModal(null)}>Cancel</button><button className="gr-btn gr-btn-amber gr-btn-lg" disabled={saving} onClick={saveFest}>{saving?"⏳ Saving…":festModal==="new"?"Add Festival":"Save Changes"}</button></div>
          </div>
        </div>
      )}

      {/* EVENT MODAL */}
      {eventModal&&(
        <div className="gr-mbk" onClick={e=>e.target===e.currentTarget&&setEventModal(null)}>
          <div className="gr-modal">
            <div className="gr-mtitle"><FaCalendarAlt className="inline-block mr-2 mb-1" /> {eventModal==="new"?"Add Event":"Edit Event"}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 13px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,marginBottom:14,fontSize:12,fontWeight:700,color:"#15803d"}}><span>📢</span> Broadcast — announcements & reminders sent to <strong>all {recipientCount} employees</strong></div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Event Title *</label><input type="text" placeholder="e.g. Annual Day" className={"gr-inp"+(formErr.title?" err":"")} value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/>{formErr.title&&<div className="gr-inp-err">⚠️ {formErr.title}</div>}</div>
              <div className="gr-frow"><label className="gr-lbl">Event Date *</label><input type="date" className={"gr-inp"+(formErr.eventDate?" err":"")} value={eventForm.eventDate} onChange={e=>setEventForm({...eventForm,eventDate:e.target.value})}/>{formErr.eventDate&&<div className="gr-inp-err">⚠️ {formErr.eventDate}</div>}</div>
            </div>
            <div className="gr-frow"><label className="gr-lbl">Description *</label><textarea className={"gr-ta"+(formErr.description?" err":"")} placeholder="Brief description..." value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/>{formErr.description&&<div className="gr-inp-err">⚠️ {formErr.description}</div>}</div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Location (optional)</label><input type="text" placeholder="e.g. Bangalore HQ" className="gr-inp" value={eventForm.location} onChange={e=>setEventForm({...eventForm,location:e.target.value})}/></div>
              <div className="gr-frow"><label className="gr-lbl">RSVP Link (optional)</label><input type="url" placeholder="https://..." className="gr-inp" value={eventForm.rsvpLink} onChange={e=>setEventForm({...eventForm,rsvpLink:e.target.value})}/></div>
            </div>
            <div className="gr-2col">
              <div className="gr-frow"><label className="gr-lbl">Reminder (days before)</label><input type="number" min="0" max="30" className="gr-inp" value={eventForm.reminderDaysBefore} onChange={e=>setEventForm({...eventForm,reminderDaysBefore:parseInt(e.target.value)||0})}/></div>
              <div className="gr-frow"><label className="gr-lbl">Accent Colour</label><div className="gr-cgrid" style={{marginTop:8}}>{EVENT_COLORS.map(c=><div key={c} className={"gr-cdot"+(eventForm.color===c?" sel":"")} style={{background:c}} onClick={()=>setEventForm({...eventForm,color:c})}/>)}</div></div>
            </div>
            <div className="gr-frow"><label className="gr-tog-wrap" onClick={()=>setEventForm({...eventForm,sendAnnouncementEmail:!eventForm.sendAnnouncementEmail})}><button className={"gr-tog"+(eventForm.sendAnnouncementEmail?" on":"")}><div className="gr-tog-th"/></button><span className="gr-tog-lbl">Send automated announcement emails</span></label></div>
            <div className="gr-mbtns"><button className="gr-btn gr-btn-ghost" onClick={()=>setEventModal(null)}>Cancel</button><button className="gr-btn gr-btn-navy gr-btn-lg" disabled={saving} onClick={saveEvent}>{saving?"⏳ Saving…":eventModal==="new"?"Add Event":"Save Changes"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}