"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Skeleton from "react-loading-skeleton";
// import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "@/context/AuthContext";
import { updateEmployeeData } from "@/lib/employeeSync";
import { uploadToCloudinary } from "@/lib/cloudinary";

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Mail:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>,
  Phone:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6.63-6.63A19.79 19.79 0 0 1 2.06 3.79 2 2 0 0 1 4 1.84h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Globe:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  User:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  Calendar: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Star:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Clock:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Brief:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="8" width="20" height="13" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  Home:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Bank:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Alert:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Edit:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Check:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  X:        ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Camera:   ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Copy:     ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Location: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const EMPTY = {
  name:"", email:"", phone:"", dateOfBirth:"", gender:"", bloodGroup:"",
  maritalStatus:"", nationality:"", address:"", city:"", postalCode:"",
  employeeId:"", designation:"", department:"", dateOfJoining:"",
  employmentType:"", workLocation:"", reportingManager:"", workExperience:"",
  salary:"", bankName:"", accountNumber:"", ifscCode:"", panNumber:"", aadharNumber:"",
  emergencyContactName:"", emergencyContactRelation:"", emergencyContactPhone:"",
};
type FK = keyof typeof EMPTY;
const TABS = ["Personal Information","Job Information","Salary Information","Emergency Contact"] as const;
type Tab = typeof TABS[number];

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

/** Horizontal label → value row inside section cards */
function InfoRow({ label, value, editing, onChange, type="text", options, last=false }:{
  label:string; value:string; editing:boolean; onChange:(v:string)=>void;
  type?:string; options?:string[]; last?:boolean;
}) {
  return (
    <div className={`flex items-center gap-6 py-3.5 ${!last ? "border-b border-gray-100" : ""}`}>
      <span className="w-44 shrink-0 text-sm text-gray-500">{label}</span>
      {!editing ? (
        <span className="text-sm font-semibold text-gray-800">{value || "—"}</span>
      ) : options ? (
        <select value={value} onChange={e=>onChange(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition">
          <option value="">Select…</option>
          {options.map(o=><option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e=>onChange(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"/>
      )}
    </div>
  );
}

/** Card wrapper with colored icon + edit button */
function SectionCard({ title, iconBg, icon, children, onEdit, editing, onSave, onCancel, saving }:{
  title:string; iconBg:string; icon:React.ReactNode; children:React.ReactNode;
  onEdit:()=>void; editing:boolean; onSave:()=>void; onCancel:()=>void; saving?:boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
          <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
        </div>
        {!editing ? (
          <button onClick={onEdit} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-violet-600 hover:border-violet-300 transition">
            <Ic.Edit/>
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              <Ic.X/> Cancel
            </button>
            <button onClick={onSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition disabled:bg-gray-300">
              {saving
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                : <Ic.Check/>} Save
            </button>
          </div>
        )}
      </div>
      <div className="px-6 pb-2 pt-1">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProfileView() {
  const { user, userData } = useAuth();
  const [localData, setLocalData] = useState<any>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File|null>(null);
  const [form, setForm] = useState(EMPTY);
  const [activeTab, setActiveTab] = useState<Tab>("Personal Information");
  const [editingSection, setEditingSection] = useState<string|null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [savingSection, setSavingSection] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);

  const setF = (k:FK)=>(v:string)=>setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(userData){
      setLocalData(userData);
      if(typeof userData.profilePhoto==="string") setPhotoPreview(userData.profilePhoto);
    }
  },[userData]);

  useEffect(()=>{
    if(localData){
      const f:any={};
      Object.keys(EMPTY).forEach(k=>{f[k]=localData[k]??"";});
      setForm(f);
    }
  },[localData]);

  const onDrop=(files:File[])=>{
    const file=files[0]; if(!file) return;
    setProfilePhoto(file);
    const r=new FileReader();
    r.onloadend=()=>setPhotoPreview(r.result as string);
    r.readAsDataURL(file);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept:{"image/*":[]}, multiple:false });

  const startEdit=(s:string)=>{ setSnapshot({...form}); setEditingSection(s); };
  const cancelEdit=()=>{ setForm({...snapshot}); setEditingSection(null); };

  const saveSection=async(section:string)=>{
    if(!user?.uid) return;
    setSavingSection(section);
    try{
      let photoURL=localData?.profilePhoto||"";
      if(profilePhoto) photoURL=await uploadToCloudinary(profilePhoto);
      const updated={...form, salary:form.salary?Number(form.salary):0, profilePhoto:photoURL};
      await updateEmployeeData({ userId:user.uid, updates:updated, updatedBy:user.uid, role:userData?.role||"employee" });
      setLocalData(updated); setPhotoPreview(photoURL); setProfilePhoto(null); setEditingSection(null);
    }catch(e){ console.error(e); alert("Failed. Try again."); }
    finally{ setSavingSection(null); }
  };

  const savePhoto=async()=>{
    if(!profilePhoto||!user?.uid) return;
    setSavingSection("photo");
    try{
      const photoURL=await uploadToCloudinary(profilePhoto);
      const updated={...localData, profilePhoto:photoURL};
      await updateEmployeeData({ userId:user.uid, updates:updated, updatedBy:user.uid, role:userData?.role||"employee" });
      setLocalData(updated); setPhotoPreview(photoURL); setProfilePhoto(null);
    }catch(e){ console.error(e); }
    finally{ setSavingSection(null); }
  };

  const copyId=()=>{
    if(localData?.employeeId){ navigator.clipboard.writeText(localData.employeeId); setCopied(true); setTimeout(()=>setCopied(false),1500); }
  };

  const initials=(localData?.name||"?").split(" ").slice(0,2).map((w:string)=>w[0]?.toUpperCase()).join("");
  const isEditing=(s:string)=>editingSection===s;
  const isSaving=(s:string)=>savingSection===s;

  if(!localData){
    return(
      <div className="flex gap-5 p-6 max-w-6xl mx-auto">
        <div className="w-64 shrink-0"><Skeleton height={520} borderRadius={20}/></div>
        <div className="flex-1 space-y-4"><Skeleton height={52} borderRadius={12}/><Skeleton height={240} borderRadius={16}/><Skeleton height={200} borderRadius={16}/></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF0F5]" style={{fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif"}}>
      <div className="max-w-6xl mx-auto px-5 py-7 flex gap-5 items-start">

        {/* ══════════════════════════════════════════════════════
            LEFT SIDEBAR — styled to complement the dark app nav
        ══════════════════════════════════════════════════════ */}
        <div className="w-64 shrink-0 flex flex-col gap-4">

          {/* Profile Card */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">

            {/* Dark gradient cover — matches the app's navy header */}
            <div className="relative h-24" style={{background:"linear-gradient(135deg,#1a2340 0%,#2d3a5e 60%,#3d4f7c 100%)"}}>
              {/* subtle pattern */}
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:"radial-gradient(circle at 20% 80%,rgba(255,255,255,0.3) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(139,92,246,0.4) 0%,transparent 50%)"}}/>

              {/* Avatar — centred on cover */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-10">
                <div
                  {...getRootProps()}
                  className="relative w-18 h-18 rounded-2xl border-[3px] border-white shadow-lg overflow-hidden cursor-pointer group"
                >
                  <input {...getInputProps()}/>
                  {photoPreview
                    ? <img src={photoPreview} alt="avatar" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold" style={{background:"linear-gradient(135deg,#7C3AED,#4F46E5)"}}>{initials}</div>
                  }
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white"><Ic.Camera/></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Name + designation */}
            <div className="pt-12 pb-4 px-5 text-center border-b border-gray-100">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className="text-[15px] font-bold text-gray-900">{localData.name||"Employee"}</h2>
                {localData.employeeId && (
                  <button onClick={copyId} title="Copy ID"
                    className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-violet-500 transition px-1.5 py-0.5 rounded-md hover:bg-violet-50">
                    {localData.employeeId} {copied ? "✓" : <Ic.Copy/>}
                  </button>
                )}
              </div>
              {localData.designation && (
                <span className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-600 tracking-wide">
                  {localData.designation}
                </span>
              )}
              {/* Status dot */}
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-200"/>
                <span className="text-[11px] font-semibold text-emerald-600">Active</span>
              </div>

              {/* Save photo button if there's a pending photo */}
              {profilePhoto && (
                <button onClick={savePhoto} disabled={isSaving("photo")}
                  className="mt-3 w-full text-xs font-semibold py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition disabled:bg-gray-300">
                  {isSaving("photo") ? "Saving…" : "Save New Photo"}
                </button>
              )}
            </div>

            {/* Basic info list */}
            <div className="px-5 py-4 space-y-3.5">
              <p className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-gray-400 mb-1">Basic Information</p>

              {[
                { icon:<Ic.Mail/>,     label:"Email",           value:localData.email },
                { icon:<Ic.Phone/>,    label:"Mobile Phone",    value:localData.phone },
                { icon:<Ic.Globe/>,    label:"Nationality",     value:localData.nationality },
                { icon:<Ic.User/>,     label:"Gender",          value:localData.gender },
                { icon:<Ic.Calendar/>, label:"Date of Birth",   value:localData.dateOfBirth },
                { icon:<Ic.Star/>,     label:"Blood Group",     value:localData.bloodGroup },
                { icon:<Ic.Clock/>,    label:"Employment Type", value:localData.employmentType },
                { icon:<Ic.Brief/>,    label:"Department",      value:localData.department },
                { icon:<Ic.Location/>, label:"Work Location",   value:localData.workLocation },
              ].map(({ icon, label, value })=>(
                <div key={label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wide text-gray-400 uppercase">{label}</p>
                    <p className="text-[13px] font-semibold text-gray-700 truncate mt-0.5">{value||"—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-2 gap-3">
            {[
              { label:"Joined",  value: localData.dateOfJoining || "—", color:"bg-indigo-50 text-indigo-700" },
              { label:"Manager", value: localData.reportingManager||"—", color:"bg-violet-50 text-violet-700" },
              { label:"Exp",     value: localData.workExperience||"—",   color:"bg-emerald-50 text-emerald-700" },
              { label:"Salary",  value: localData.salary ? `₹${Number(localData.salary).toLocaleString("en-IN")}` : "—", color:"bg-amber-50 text-amber-700" },
            ].map(s=>(
              <div key={s.label} className={`rounded-xl px-3 py-2.5 ${s.color}`}>
                <p className="text-[9px] font-extrabold tracking-[0.12em] uppercase opacity-50 mb-0.5">{s.label}</p>
                <p className="text-[12px] font-bold truncate">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            RIGHT CONTENT PANEL
        ══════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0">

          {/* Tab bar — pill style matching the app */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 px-3 py-2 flex items-center gap-1 overflow-x-auto">
            {TABS.map(tab=>(
              <button
                key={tab}
                onClick={()=>setActiveTab(tab)}
                className={[
                  "shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                  activeTab===tab
                    ? "text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50",
                ].join(" ")}
                style={activeTab===tab ? {background:"linear-gradient(135deg,#1a2340,#2d3a5e)"} : {}}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Personal Information ── */}
          {activeTab==="Personal Information" && (
            <>
              <SectionCard title="Personal Details" iconBg="bg-violet-100" icon={<span className="text-violet-600"><Ic.User/></span>}
                onEdit={()=>startEdit("personal")} editing={isEditing("personal")}
                onSave={()=>saveSection("personal")} onCancel={cancelEdit} saving={isSaving("personal")}>
                <InfoRow label="Full Name"      value={form.name}          editing={isEditing("personal")} onChange={setF("name")}/>
                <InfoRow label="Email Address"  value={form.email}         editing={isEditing("personal")} onChange={setF("email")}         type="email"/>
                <InfoRow label="Phone Number"   value={form.phone}         editing={isEditing("personal")} onChange={setF("phone")}         type="tel"/>
                <InfoRow label="Date of Birth"  value={form.dateOfBirth}   editing={isEditing("personal")} onChange={setF("dateOfBirth")}   type="date"/>
                <InfoRow label="Gender"         value={form.gender}        editing={isEditing("personal")} onChange={setF("gender")}        options={["Male","Female","Other"]}/>
                <InfoRow label="Blood Group"    value={form.bloodGroup}    editing={isEditing("personal")} onChange={setF("bloodGroup")}/>
                <InfoRow label="Marital Status" value={form.maritalStatus} editing={isEditing("personal")} onChange={setF("maritalStatus")} options={["Single","Married","Divorced","Widowed"]}/>
                <InfoRow label="Nationality"    value={form.nationality}   editing={isEditing("personal")} onChange={setF("nationality")}   last/>
              </SectionCard>

              <SectionCard title="Home Address" iconBg="bg-orange-100" icon={<span className="text-orange-500"><Ic.Home/></span>}
                onEdit={()=>startEdit("address")} editing={isEditing("address")}
                onSave={()=>saveSection("address")} onCancel={cancelEdit} saving={isSaving("address")}>
                <InfoRow label="Address"     value={form.address}    editing={isEditing("address")} onChange={setF("address")}/>
                <InfoRow label="City"        value={form.city}       editing={isEditing("address")} onChange={setF("city")}/>
                <InfoRow label="Postal Code" value={form.postalCode} editing={isEditing("address")} onChange={setF("postalCode")} last/>
              </SectionCard>
            </>
          )}

          {/* ── Job Information ── */}
          {activeTab==="Job Information" && (
            <SectionCard title="Job Information" iconBg="bg-indigo-100" icon={<span className="text-indigo-600"><Ic.Brief/></span>}
              onEdit={()=>startEdit("job")} editing={isEditing("job")}
              onSave={()=>saveSection("job")} onCancel={cancelEdit} saving={isSaving("job")}>
              <InfoRow label="Employee ID"       value={form.employeeId}       editing={isEditing("job")} onChange={setF("employeeId")}/>
              <InfoRow label="Designation"       value={form.designation}      editing={isEditing("job")} onChange={setF("designation")}/>
              <InfoRow label="Department"        value={form.department}       editing={isEditing("job")} onChange={setF("department")}/>
              <InfoRow label="Date of Joining"   value={form.dateOfJoining}    editing={isEditing("job")} onChange={setF("dateOfJoining")}   type="date"/>
              <InfoRow label="Employment Type"   value={form.employmentType}   editing={isEditing("job")} onChange={setF("employmentType")}  options={["Full-time","Part-time","Contract","Intern"]}/>
              <InfoRow label="Work Location"     value={form.workLocation}     editing={isEditing("job")} onChange={setF("workLocation")}    options={["Office","Remote","Hybrid"]}/>
              <InfoRow label="Reporting Manager" value={form.reportingManager} editing={isEditing("job")} onChange={setF("reportingManager")}/>
              <InfoRow label="Work Experience"   value={form.workExperience}   editing={isEditing("job")} onChange={setF("workExperience")}  last/>
            </SectionCard>
          )}

          {/* ── Salary Information ── */}
          {activeTab==="Salary Information" && (
            <SectionCard title="Salary & Bank Details" iconBg="bg-emerald-100" icon={<span className="text-emerald-600"><Ic.Bank/></span>}
              onEdit={()=>startEdit("salary")} editing={isEditing("salary")}
              onSave={()=>saveSection("salary")} onCancel={cancelEdit} saving={isSaving("salary")}>
              <InfoRow label="Monthly Salary (₹)" value={form.salary}        editing={isEditing("salary")} onChange={setF("salary")}        type="number"/>
              <InfoRow label="Bank Name"           value={form.bankName}      editing={isEditing("salary")} onChange={setF("bankName")}/>
              <InfoRow label="Account Number"      value={form.accountNumber} editing={isEditing("salary")} onChange={setF("accountNumber")}/>
              <InfoRow label="IFSC Code"           value={form.ifscCode}      editing={isEditing("salary")} onChange={setF("ifscCode")}/>
              <InfoRow label="PAN Number"          value={form.panNumber}     editing={isEditing("salary")} onChange={setF("panNumber")}/>
              <InfoRow label="Aadhar Number"       value={form.aadharNumber}  editing={isEditing("salary")} onChange={setF("aadharNumber")} last/>
            </SectionCard>
          )}

          {/* ── Emergency Contact ── */}
          {activeTab==="Emergency Contact" && (
            <SectionCard title="Emergency Contact" iconBg="bg-rose-100" icon={<span className="text-rose-500"><Ic.Alert/></span>}
              onEdit={()=>startEdit("emergency")} editing={isEditing("emergency")}
              onSave={()=>saveSection("emergency")} onCancel={cancelEdit} saving={isSaving("emergency")}>
              <div className="flex items-start gap-2.5 py-3 mb-1 border-b border-gray-100">
                <span className="text-rose-400 mt-0.5"><Ic.Alert/></span>
                <p className="text-xs text-rose-600">Strictly confidential — only accessed in emergencies. Please keep this up to date.</p>
              </div>
              <InfoRow label="Contact Name"   value={form.emergencyContactName}     editing={isEditing("emergency")} onChange={setF("emergencyContactName")}/>
              <InfoRow label="Relationship"   value={form.emergencyContactRelation} editing={isEditing("emergency")} onChange={setF("emergencyContactRelation")}/>
              <InfoRow label="Contact Number" value={form.emergencyContactPhone}    editing={isEditing("emergency")} onChange={setF("emergencyContactPhone")} type="tel" last/>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
}