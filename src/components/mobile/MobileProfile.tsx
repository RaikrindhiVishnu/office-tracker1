"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateEmployeeData } from "@/lib/employeeSync";
import { 
  User, Mail, Phone, Briefcase, MapPin, Edit3, X, Check, Loader2, Camera, 
  ChevronDown, HeartPulse, CreditCard, AlertCircle, Laptop 
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMPTY_FORM = {
  name:"", email:"", phone:"", dateOfBirth:"", gender:"", bloodGroup:"",
  maritalStatus:"", nationality:"", address:"", city:"", postalCode:"",
  employeeId:"", designation:"", department:"", dateOfJoining:"",
  employmentType:"", workLocation:"", reportingTo:"", workExperience:"",
  salary:"", bankName:"", accountNumber:"", ifscCode:"", panNumber:"", aadharNumber:"",
  emergencyContactName:"", emergencyContactRelation:"", emergencyContactPhone:"",
  assetSource: "Own", assetName: "", assetType: "laptop", assetSerial: "", 
  assetStatus: "active", assetCost: "", assetExpiry: "",
};

export const MobileProfile = () => {
  const { user, userData, refreshUserData } = useAuth() as any;
  
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>("personal");

  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [leadsList, setLeadsList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "lead")))
      .then(snap => {
        setLeadsList(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email })));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (userData) {
      const f: any = { ...EMPTY_FORM };
      Object.keys(EMPTY_FORM).forEach(k => {
        f[k] = userData[k] ?? EMPTY_FORM[k as keyof typeof EMPTY_FORM];
      });
      setForm(f);
      if (userData.profilePhoto && typeof userData.profilePhoto === "string") setPhotoPreview(userData.profilePhoto);
    }
  }, [userData]);

  const setF = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async (sectionId: string) => {
    if (!user?.uid) return;
    setSavingSection(sectionId);
    try {
      const updatesObj: any = {
        ...form,
        salary: form.salary ? Number(form.salary) : 0,
        assetCost: form.assetCost ? Number(form.assetCost) : 0
      };
      await updateEmployeeData({ userId: user.uid, updates: updatesObj, updatedBy: user.uid, role: userData?.role || "employee" });
      if (refreshUserData) await refreshUserData();
      setEditingSection(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setSavingSection(null);
    }
  };

  const handleCancel = (sectionId: string) => {
    // Revert form data for this section (for simplicity, we just revert the whole form)
    if (userData) {
      const f: any = { ...EMPTY_FORM };
      Object.keys(EMPTY_FORM).forEach(k => {
        f[k] = userData[k] ?? EMPTY_FORM[k as keyof typeof EMPTY_FORM];
      });
      setForm(f);
    }
    setEditingSection(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    
    setUploadingPhoto(true);
    try {
      const url = await uploadToCloudinary(file);
      if (url) {
        await updateEmployeeData({ userId: user.uid, updates: { profilePhoto: url }, updatedBy: user.uid, role: userData?.role || "employee" });
        setPhotoPreview(url);
        if (refreshUserData) await refreshUserData();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!userData) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Helper for rendering form fields
  const renderField = (label: string, field: keyof typeof EMPTY_FORM, type = "text", options?: any[]) => {
    const isEditing = editingSection !== null;
    return (
      <div className="flex flex-col gap-1.5 py-2 border-b border-gray-50 last:border-0">
        <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pl-1">{label}</label>
        {isEditing ? (() => {
          let allOptions = options;
          if (options && form[field]) {
            const hasVal = options.some(o => (typeof o === 'string' ? o : o.value) === form[field]);
            if (!hasVal) {
              allOptions = [...options, typeof options[0] === 'string' ? form[field] : { value: form[field], label: form[field] }];
            }
          }
          return allOptions ? (
            <select value={form[field]} onChange={setF(field)} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">Select...</option>
              {allOptions.map(o => (
                <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
                  {typeof o === 'string' ? o : o.label}
                </option>
              ))}
            </select>
          ) : (
            <input type={type} value={form[field]} onChange={setF(field)} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          );
        })() : (
          <p className="text-sm font-bold text-gray-900 px-1">
            {options ? (
               typeof options[0] === 'string' ? form[field] : (options.find(o => o.value === form[field])?.label || form[field])
            ) : form[field] || "—"}
          </p>
        )}
      </div>
    );
  };

  const renderSection = (id: string, title: string, icon: React.ReactNode, content: React.ReactNode) => {
    const isOpen = openSection === id;
    const isEditing = editingSection === id;
    const isSaving = savingSection === id;

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-4 transition-all duration-300">
        <button 
          onClick={() => {
            if (isEditing) return; // Prevent closing while editing
            setOpenSection(isOpen ? "" : id);
          }}
          className="w-full px-5 py-4 flex items-center justify-between bg-white focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
              {icon}
            </div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">{title}</h3>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
            {/* Edit / Save Controls */}
            <div className="flex justify-end mb-4 pt-2 border-t border-gray-50">
              {!isEditing ? (
                <button onClick={() => setEditingSection(id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-indigo-600 rounded-lg text-xs font-bold active:scale-95 transition-transform">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Details
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => handleCancel(id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold active:scale-95 transition-transform">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={() => handleSave(id)} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-transform disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                  </button>
                </div>
              )}
            </div>

            {/* Section Fields */}
            <div className="flex flex-col gap-1">
              {content}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-2 pb-20">
      
      {/* Header Profile Card */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 relative overflow-hidden mb-4">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-indigo-500 to-violet-600" />
        
        <div className="relative pt-6 flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-md">
              <div className="w-full h-full rounded-full bg-indigo-50 overflow-hidden flex items-center justify-center relative">
                {uploadingPhoto ? (
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                ) : photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-indigo-300">
                    {form.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-indigo-600 cursor-pointer active:scale-95 transition-transform">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>

          <h2 className="text-xl font-black text-gray-900 mt-4">{form.name || "Employee"}</h2>
          <p className="text-xs font-bold text-indigo-600 mt-0.5 uppercase tracking-wider">
            {form.designation || userData.role || "Team Member"}
          </p>
          <div className="mt-3 flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-500">
            <Briefcase className="w-3.5 h-3.5" />
            {form.department || "General"} Dept
          </div>
        </div>
      </div>

      {/* Accordion Sections */}

      {renderSection("personal", "Personal Info", <User className="w-4 h-4" />, (
        <>
          {renderField("Full Name", "name")}
          {renderField("Email Address", "email", "email")}
          {renderField("Phone Number", "phone", "tel")}
          {renderField("Date of Birth", "dateOfBirth", "date")}
          {renderField("Gender", "gender", "text", ["Male", "Female", "Other"])}
          {renderField("Blood Group", "bloodGroup", "text", ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])}
          {renderField("Marital Status", "maritalStatus", "text", ["Single", "Married", "Divorced", "Widowed"])}
          {renderField("Nationality", "nationality")}
        </>
      ))}

      {renderSection("address", "Home Address", <MapPin className="w-4 h-4" />, (
        <>
          {renderField("Address", "address")}
          {renderField("City", "city")}
          {renderField("Postal Code", "postalCode")}
        </>
      ))}

      {renderSection("job", "Job Information", <Briefcase className="w-4 h-4" />, (
        <>
          {renderField("Employee ID", "employeeId")}
          {renderField("Designation", "designation")}
          {renderField("Department", "department", "text", ["Frontend Team", "Backend Team", "UI/UX Team", "Testing Team", "DevOps Team", "AI Team", "Mobile Team", "3D Max Team", "QA Team", "Sales", "Operations", "Business Operations", "HR"])}
          {renderField("Date of Joining", "dateOfJoining", "date")}
          {renderField("Employment Type", "employmentType", "text", ["Full Time", "Part Time", "Contract", "Internship"])}
          {renderField("Work Location", "workLocation", "text", ["On-site", "Remote", "Hybrid"])}
          {renderField("Reporting Lead", "reportingTo", "text", leadsList.map((l: any) => ({ value: l.id, label: l.name })))}
          {renderField("Work Experience", "workExperience")}
        </>
      ))}

      {renderSection("salary", "Salary & Bank Info", <CreditCard className="w-4 h-4" />, (
        <>
          {renderField("Salary", "salary")}
          {renderField("Bank Name", "bankName")}
          {renderField("Account Number", "accountNumber")}
          {renderField("IFSC Code", "ifscCode")}
          {renderField("PAN Number", "panNumber")}
          {renderField("Aadhar Number", "aadharNumber")}
        </>
      ))}

      {renderSection("emergency", "Emergency Contact", <HeartPulse className="w-4 h-4" />, (
        <>
          {renderField("Contact Name", "emergencyContactName")}
          {renderField("Relation", "emergencyContactRelation")}
          {renderField("Contact Phone", "emergencyContactPhone", "tel")}
        </>
      ))}

      {renderSection("assets", "Assigned Assets", <Laptop className="w-4 h-4" />, (
        <>
          {renderField("Asset Source", "assetSource", "text", ["Own", "Company"])}
          {renderField("Asset Name", "assetName")}
          {renderField("Asset Type", "assetType", "text", ["laptop", "monitor", "mouse", "keyboard", "other"])}
          {renderField("Serial Number", "assetSerial")}
        </>
      ))}

    </div>
  );
};
