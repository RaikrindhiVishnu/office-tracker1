"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateEmployeeData } from "@/lib/employeeSync";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMPTY = {
  name:"", email:"", phone:"", dateOfBirth:"", gender:"", bloodGroup:"",
  maritalStatus:"", nationality:"", address:"", city:"", postalCode:"",
  employeeId:"", designation:"", department:"", dateOfJoining:"",
  employmentType:"", workLocation:"", reportingTo:"", workExperience:"",
  salary:"", bankName:"", accountNumber:"", ifscCode:"", panNumber:"", aadharNumber:"",
  emergencyContactName:"", emergencyContactRelation:"", emergencyContactPhone:"",
  assetSource: "Own",
  assetName: "",
  assetType: "laptop",
  assetSerial: "",
  assetStatus: "active",
  assetCost: 0,
  assetExpiry: "",
};
type FK = keyof typeof EMPTY;

export default function ProfileView() {
  const { user, userData } = useAuth();
  const [localData, setLocalData] = useState<any>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File|null>(null);
  
  const [form, setForm] = useState<any>(EMPTY);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [snapshot, setSnapshot] = useState<any>(EMPTY);
  const [leadsList, setLeadsList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "lead"));
        const snap = await getDocs(q);
        setLeadsList(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email })));
      } catch (err) {
        console.error("Failed to fetch leads", err);
      }
    };
    fetchLeads();
  }, []);

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

  const setF = (k:FK)=>(v:any)=>setForm((f: any)=>({...f,[k]:v}));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    
    setProfilePhoto(file);
    const r = new FileReader();
    r.onloadend = () => setPhotoPreview(r.result as string);
    r.readAsDataURL(file);
  };

  const startEdit = () => {
    setSnapshot({...form});
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setForm({...snapshot});
    setIsEditing(false);
    setProfilePhoto(null);
    setPhotoPreview(localData?.profilePhoto || "");
  };

  const handleSave = async () => {
    if(!user?.uid) return;
    setSaving(true);
    try{
      let photoURL = localData?.profilePhoto || "";
      if(profilePhoto) {
        photoURL = await uploadToCloudinary(profilePhoto);
      }
      
      const updated = {...form, salary: form.salary ? Number(form.salary) : 0, profilePhoto: photoURL};
      await updateEmployeeData({ userId: user.uid, updates: updated, updatedBy: user.uid, role: userData?.role||"employee" });
      
      // Handle IT Assets sync
      const assetsRef = collection(db, "it_assets");
      const q = query(assetsRef, where("assignedTo", "==", user.email));
      const snap = await getDocs(q);
      
      const assetData: any = {
        name: form.assetName,
        assignedTo: user.email,
        ownership: form.assetSource,
        updatedAt: serverTimestamp(),
      };

      if (form.assetSource === "Company") {
        assetData.type = form.assetType;
        assetData.serialNumber = form.assetSerial;
        assetData.status = form.assetStatus;
        assetData.purchaseCost = Number(form.assetCost) || 0;
        assetData.warrantyExpiry = form.assetExpiry;
        assetData.department = form.department || "IT";
      } else {
        assetData.type = "laptop";
        assetData.status = "active";
      }

      if (!snap.empty) {
        await updateDoc(doc(db, "it_assets", snap.docs[0].id), assetData);
      } else {
        await addDoc(assetsRef, {
          ...assetData,
          createdAt: serverTimestamp(),
        });
      }

      setLocalData(updated); 
      setPhotoPreview(photoURL); 
      setProfilePhoto(null); 
      setIsEditing(false);
      alert("✅ Profile updated successfully!");
    } catch(e) { 
      console.error(e); 
      alert("Failed. Try again."); 
    } finally { 
      setSaving(false); 
    }
  };

  if(!localData){
    return(
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-2 sm:p-4 pt-1">
      <div className="max-w-7xl mx-auto space-y-3">

        {/* 🎴 BIG MAIN PROFILE BANNER */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden mb-4 hover:shadow-xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 px-8 py-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6 relative">

            <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto text-center sm:text-left">
              {/* BIGGER AVATAR with Hover Effect */}
              <div className="relative flex-shrink-0 group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-800 border-4 border-white/10 shadow-xl group-hover:scale-105 group-hover:border-blue-500 transition-all duration-300">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <img
                      src="https://img.icons8.com/bubbles/200/user-male.png"
                      alt="Profile Placeholder"
                      className="w-full h-full object-cover p-2 bg-gradient-to-br from-slate-700 to-slate-900 transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  {isEditing && (
                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs uppercase font-bold opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm z-10">
                      <span>📸 Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* ALL DETAILS AT THE TOP */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight truncate mb-3">
                  {form.name || "Unnamed Employee"}
                </h1>

                {/* Badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                  <span className="text-sm font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    {form.designation || "No Designation"}
                  </span>
                  <span className="text-sm font-medium text-slate-200 bg-white/10 px-3 py-1 rounded-full border border-white/5">
                    {form.department || "No Department"}
                  </span>
                  <span className="text-sm font-medium text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 shadow-inner">
                    ID: {form.employeeId || "EMP-XXX"}
                  </span>
                </div>

                {/* Contact Details (Email & Phone) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm font-medium text-slate-300">
                  <span className="flex items-center gap-2 bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.27 7.27c.883.883 2.317.883 3.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {form.email || "No Email"}
                  </span>
                  <span className="flex items-center gap-2 bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {form.phone || "No Phone"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full sm:w-auto gap-3 mt-2 sm:mt-0 z-10 relative flex-wrap justify-end">
              {isEditing ? (
                <>
                  <button onClick={cancelEdit} disabled={saving} className="flex-1 sm:flex-none px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow-lg transition-colors flex items-center justify-center gap-2">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <button onClick={startEdit} className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 📋 COMPACT DATA GRIDS (4 Cards with Hover Effects) */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* 👤 Personal Information */}
          <InfoSection title="Personal Info" icon="👤" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1"><Field label="Full Name" value={form.name} editing={isEditing} onChange={setF("name")} /></div>
              <div className="col-span-2 sm:col-span-1"><Field label="Email Address" value={form.email} editing={isEditing} onChange={setF("email")} /></div>
              <Field label="Phone" value={form.phone} editing={isEditing} onChange={setF("phone")} />
              <Field label="Date of Birth" value={form.dateOfBirth} editing={isEditing} onChange={setF("dateOfBirth")} type="date" />
              <SelectField label="Gender" value={form.gender} editing={isEditing} onChange={setF("gender")} options={["Male", "Female", "Other"]} />
              <SelectField label="Blood Group" value={form.bloodGroup} editing={isEditing} onChange={setF("bloodGroup")} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
              <SelectField label="Marital Status" value={form.maritalStatus} editing={isEditing} onChange={setF("maritalStatus")} options={["Single", "Married", "Divorced", "Widowed"]} />
              <Field label="Nationality" value={form.nationality} editing={isEditing} onChange={setF("nationality")} />
              <div className="col-span-2">
                <TextAreaField label="Address" value={form.address} editing={isEditing} onChange={setF("address")} />
              </div>
            </div>
          </InfoSection>

          {/* 💼 Employment Details */}
          <InfoSection title="Employment" icon="💼" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employee ID" value={form.employeeId} editing={false} onChange={setF("employeeId")} />
              <Field label="Designation" value={form.designation} editing={false} onChange={setF("designation")} />
              <SelectField label="Department" value={form.department} editing={isEditing} onChange={setF("department")} options={["Frontend Team", "Backend Team", "UI/UX Team", "Testing Team", "DevOps Team", "AI Team", "Mobile Team", "3D Max Team", "QA Team", "Sales", "Operations", "HR"]} />
              <Field label="Date of Joining" value={form.dateOfJoining} editing={false} onChange={setF("dateOfJoining")} type="date" />
              <SelectField label="Employment Type" value={form.employmentType} editing={false} onChange={setF("employmentType")} options={["Full-time", "Part-time", "Contract", "Intern"]} />
              <Field label="Location" value={form.workLocation} editing={isEditing} onChange={setF("workLocation")} />
              
              {/* Dynamic Reporting To Dropdown */}
              <div className="flex flex-col gap-1 group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">Reporting To (Lead)</label>
                {isEditing ? (
                  <select
                    value={form.reportingTo || ""}
                    onChange={(e) => setF("reportingTo")(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-blue-100 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-900 appearance-none bg-no-repeat bg-[right_12px_top_50%]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")` }}
                  >
                    <option value="">No Reporting Lead</option>
                    {leadsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : (
                  <div className="px-3 py-1.5 bg-slate-50/80 rounded-lg border border-slate-100 min-h-[34px] flex items-center group-hover:bg-slate-50 group-hover:border-slate-300 transition-all duration-200">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {leadsList.find(l => l.id === form.reportingTo)?.name || form.reportingTo || <span className="text-slate-400 font-normal">—</span>}
                    </p>
                  </div>
                )}
              </div>

              <SelectField label="Account Level" value={localData.accountType} editing={false} onChange={() => {}} options={["EMPLOYEE", "ADMIN", "HR", "BUSINESSOWNER"]} />
              <SelectField label="Role" value={localData.role || "employee"} editing={false} onChange={() => {}} options={["employee", "lead"]} />
              <div className="col-span-2"><Field label="Work Experience" value={form.workExperience} editing={isEditing} onChange={setF("workExperience")} /></div>
            </div>
          </InfoSection>

          {/* 💰 Compensation */}
          <InfoSection title="Financial & Bank" icon="💰" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Field label="Monthly Salary" value={form.salary} editing={false} onChange={setF("salary")} type="number" prefix="₹" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Field label="Bank Name" value={form.bankName} editing={isEditing} onChange={setF("bankName")} /></div>
              <Field label="Account No." value={form.accountNumber} editing={isEditing} onChange={setF("accountNumber")} />
              <Field label="IFSC Code" value={form.ifscCode} editing={isEditing} onChange={setF("ifscCode")} />
              <Field label="PAN Number" value={form.panNumber} editing={isEditing} onChange={setF("panNumber")} />
              <Field label="Aadhar No." value={form.aadharNumber} editing={isEditing} onChange={setF("aadharNumber")} />
            </div>
          </InfoSection>

          {/* 🚨 Emergency Contact */}
          <InfoSection title="Emergency Contact" icon="🚨" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Contact Name" value={form.emergencyContactName} editing={isEditing} onChange={setF("emergencyContactName")} /></div>
              <Field label="Relationship" value={form.emergencyContactRelation} editing={isEditing} onChange={setF("emergencyContactRelation")} />
              <Field label="Phone No." value={form.emergencyContactPhone} editing={isEditing} onChange={setF("emergencyContactPhone")} />
            </div>
          </InfoSection>
          
          {/* 💻 Assets Information */}
          <InfoSection title="Asset Details" icon="💻" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Asset Source" value={form.assetSource} editing={isEditing} onChange={setF("assetSource")} options={["Own", "Company"]} />
              <Field label="Asset Name" value={form.assetName} editing={isEditing} onChange={setF("assetName")} />
              
              {form.assetSource === "Company" && (
                <>
                  <SelectField label="Asset Type" value={form.assetType} editing={isEditing} onChange={setF("assetType")} options={["laptop", "server", "license", "software"]} />
                  <Field label="Serial Number" value={form.assetSerial} editing={isEditing} onChange={setF("assetSerial")} />
                  <SelectField label="Status" value={form.assetStatus} editing={isEditing} onChange={setF("assetStatus")} options={["active", "under_repair", "retired"]} />
                  <Field label="Purchase Cost (₹)" value={form.assetCost} editing={isEditing} onChange={setF("assetCost")} type="number" />
                  <Field label="Warranty/Expiry" value={form.assetExpiry} editing={isEditing} onChange={setF("assetExpiry")} type="date" />
                </>
              )}
            </div>
          </InfoSection>
        </div>
      </div>
    </div>
  );
}

/* =======================================================
   🔥 Compact UI Components (Updated with Hover Animations)
======================================================= */

interface InfoSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  isEditing: boolean;
}

function InfoSection({ title, icon, children, isEditing }: InfoSectionProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${isEditing ? 'border-blue-200 ring-1 ring-blue-50' : 'border-slate-200'} overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-1.5 hover:shadow-xl`}>
      <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | number | undefined;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
  prefix?: string;
}

function Field({ label, value, editing, onChange, type = "text", prefix }: FieldProps) {
  return (
    <div className="flex flex-col gap-1 group h-full">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{label}</label>
      {editing ? (
        <div className="relative">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium z-10">{prefix}</span>}
          <input
            type={type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full ${prefix ? 'pl-7' : 'px-3'} py-1.5 bg-white border border-slate-300 rounded-lg focus:border-blue-100 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-900`}
          />
        </div>
      ) : (
        <div className="px-3 py-1.5 bg-slate-50/80 rounded-lg border border-slate-100 min-h-[34px] flex items-center group-hover:bg-slate-50 group-hover:border-slate-300 transition-all duration-200">
          <p className="text-sm font-medium text-slate-800 truncate">
            {type === "date" && value
              ? new Date(value as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : value || <span className="text-slate-400 font-normal">—</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }: { label: string; value: any; editing: boolean; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col gap-1 group h-full">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{label}</label>
      {editing ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-blue-100 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-900 appearance-none bg-no-repeat bg-[right_12px_top_50%]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")` }}
        >
          <option value="">Select...</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <div className="px-3 py-1.5 bg-slate-50/80 rounded-lg border border-slate-100 min-h-[34px] flex items-center group-hover:bg-slate-50 group-hover:border-slate-300 transition-all duration-200">
          <p className="text-sm font-medium text-slate-800 truncate">{value || <span className="text-slate-400 font-normal">—</span>}</p>
        </div>
      )}
    </div>
  );
}

function TextAreaField({ label, value, editing, onChange }: { label: string; value: any; editing: boolean; onChange: (v: string) => void; }) {
  return (
    <div className="flex flex-col gap-1 h-full group">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{label}</label>
      {editing ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-blue-100 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-900 resize-none h-full min-h-[60px]"
        />
      ) : (
        <div className="px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-100 min-h-[60px] flex items-start h-full group-hover:bg-slate-50 group-hover:border-slate-300 transition-all duration-200">
          <p className="text-sm font-medium text-slate-800 leading-relaxed">{value || <span className="text-slate-400 font-normal">—</span>}</p>
        </div>
      )}
    </div>
  );
}
