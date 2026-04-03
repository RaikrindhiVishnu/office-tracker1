"use client";

import { useState, useEffect } from "react";
import {
  updateEmployeeData,
  subscribeToEmployeeData,
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/employeeSync";
import { useAuth } from "@/context/AuthContext";
import type { View } from "@/types/View";

interface EmployeeDetailsProps {
  selectedUser: any;
  setView: React.Dispatch<React.SetStateAction<View>>;
  setSelectedUser: (user: any) => void;
  onSave?: (updatedUser: any) => void;
}

export default function EmployeeDetails({
  selectedUser,
  setView,
  setSelectedUser,
  onSave,
}: EmployeeDetailsProps) {
  const { user, userData } = useAuth();

  const [editedUser, setEditedUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = userData?.accountType === "ADMIN";

  /* -------------------------------------------------- */
  /* ✅ Admin Photo Upload */
  /* -------------------------------------------------- */
  const handleAdminPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editedUser?.uid) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "office_tracker_unsigned");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dfz0lpxsh/image/upload",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (!data.secure_url) {
        throw new Error(data.error?.message || "Upload failed");
      }

      const photoURL = data.secure_url;

      await updateEmployeeData({
        userId: editedUser.uid,
        updates: { profilePhoto: photoURL },
        updatedBy: user!.uid,
        role: "admin",
      });

      setEditedUser((prev: any) => ({ ...prev, profilePhoto: photoURL }));
      alert("✅ Photo updated successfully");
    } catch (error) {
      console.error(error);
      alert("❌ Failed to upload photo");
    }
  };

  /* -------------------------------------------------- */
  /* ✅ Sync selected user safely */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (selectedUser?.uid) {
      setEditedUser(selectedUser);
    }
  }, [selectedUser]);

  /* -------------------------------------------------- */
  /* ✅ REALTIME Employee Listener */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!selectedUser?.uid) return;

    const unsubscribe = subscribeToEmployeeData(
      selectedUser.uid,
      (updatedData) => {
        if (!updatedData?.uid) return;
        setEditedUser(updatedData);
        setSelectedUser(updatedData);
      }
    );

    return unsubscribe;
  }, [selectedUser?.uid, setSelectedUser]);

  /* -------------------------------------------------- */
  /* ✅ ADMIN Notifications */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!user?.uid || !isAdmin) return;

    const unsubscribe = subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
    });

    return unsubscribe;
  }, [user?.uid, isAdmin]);

  /* -------------------------------------------------- */
  /* ✅ SAVE EMPLOYEE — with Auth email sync  */
  /* -------------------------------------------------- */
  const handleSaveEmployee = async () => {
    if (!editedUser?.uid) {
      alert("Employee not loaded correctly. Please reopen.");
      return;
    }

    try {
      setSaving(true);

      const { uid, id, ...updates } = editedUser;

      if (editedUser.email !== selectedUser.email) {
        const res = await fetch("/api/update-auth-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, newEmail: editedUser.email }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update auth email");
        }
      }

      await updateEmployeeData({
        userId: uid,
        updates,
        updatedBy: user?.uid ?? uid,
        role: "admin",
      });

      setSelectedUser(editedUser);
      setIsEditing(false);
      onSave?.(editedUser);

      alert("✅ Employee updated successfully!");
    } catch (error: any) {
      console.error("SAVE ERROR:", error);
      alert(`Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    await markAllNotificationsAsRead(user.uid);
    setNotifications([]);
  };

  if (!editedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    // Reduced padding at the top completely (pt-1) to ensure flush layout
    <div className="min-h-screen bg-slate-50/50 p-2 sm:p-4 pt-1">
      <div className="max-w-7xl mx-auto space-y-3">
        
        {/* TOP BAR: Flush Back Button & Notifications */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => setView("employees")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm transition-all text-sm font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Employees
          </button>

          {isAdmin && notifications.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-100">
                {notifications.length} Updates
              </span>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-xs font-semibold px-3 py-1.5 bg-blue-100 text-white rounded-md hover:bg-blue-100 shadow-sm"
              >
                {showNotifications ? "Hide" : "View"}
              </button>
            </div>
          )}
        </div>

        {/* COMPACT NOTIFICATIONS DROPDOWN */}
        {showNotifications && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 max-h-60 overflow-y-auto mb-2">
             <div className="flex justify-between items-center mb-3">
               <h4 className="text-sm font-bold text-slate-800">Recent Updates</h4>
               <button onClick={handleMarkAllRead} className="text-xs text-blue-100 hover:underline">Mark all read</button>
             </div>
             <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex justify-between items-start p-2 hover:bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-sm text-slate-800">{n.message}</p>
                    <p className="text-[10px] text-slate-500">{n.timestamp?.toDate?.()?.toLocaleString('en-IN') || "Just now"}</p>
                  </div>
                  <button onClick={() => handleMarkNotificationRead(n.id)} className="text-slate-400 hover:text-red-500">
                    ✕
                  </button>
                </div>
              ))}
             </div>
          </div>
        )}

        {/* 🎴 BIG MAIN PROFILE BANNER */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden mb-4 hover:shadow-xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 px-8 py-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6 relative">
            
            <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto text-center sm:text-left">
              {/* BIGGER AVATAR with Hover Effect */}
              <div className="relative flex-shrink-0 group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-800 border-4 border-white/10 shadow-xl group-hover:scale-105 group-hover:border-blue-500 transition-all duration-300">
                  {editedUser.profilePhoto ? (
                    <img src={editedUser.profilePhoto} alt="Profile" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    // Replaced placeholder text with a dedicated user avatar image
                    <img 
                        src="https://img.icons8.com/bubbles/200/user-male.png" 
                        alt="Profile Placeholder" 
                        className="w-full h-full object-cover p-2 bg-gradient-to-br from-slate-700 to-slate-900 transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  {isEditing && isAdmin && (
                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs uppercase font-bold opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm z-10">
                      <span>📸 Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleAdminPhotoUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* ALL DETAILS AT THE TOP */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight truncate mb-3">
                  {editedUser.name || "Unnamed Employee"}
                </h1>
                
                {/* Badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                  <span className="text-sm font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    {editedUser.designation || "No Designation"}
                  </span>
                  <span className="text-sm font-medium text-slate-200 bg-white/10 px-3 py-1 rounded-full border border-white/5">
                    {editedUser.department || "No Department"}
                  </span>
                  <span className="text-sm font-medium text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 shadow-inner">
                    ID: {editedUser.employeeId || "EMP-XXX"}
                  </span>
                </div>

                {/* Contact Details (Email & Phone) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm font-medium text-slate-300">
                  <span className="flex items-center gap-2 bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.27 7.27c.883.883 2.317.883 3.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {editedUser.email || "No Email"}
                  </span>
                  <span className="flex items-center gap-2 bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {editedUser.phone || "No Phone"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full sm:w-auto gap-3 mt-2 sm:mt-0 z-10 relative">
              {isEditing ? (
                <>
                  <button onClick={() => { setIsEditing(false); setEditedUser(selectedUser); }} disabled={saving} className="flex-1 sm:flex-none px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveEmployee} disabled={saving} className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow-lg transition-colors flex items-center justify-center gap-2">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2">
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
              <div className="col-span-2 sm:col-span-1"><Field label="Full Name" value={editedUser.name} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, name: v })} /></div>
              <div className="col-span-2 sm:col-span-1"><Field label="Email Address" value={editedUser.email} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, email: v })} /></div>
              <Field label="Phone" value={editedUser.phone} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, phone: v })} />
              <Field label="Date of Birth" value={editedUser.dateOfBirth} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, dateOfBirth: v })} type="date" />
              <SelectField label="Gender" value={editedUser.gender} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, gender: v })} options={["Male", "Female", "Other"]} />
              <SelectField label="Blood Group" value={editedUser.bloodGroup} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, bloodGroup: v })} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
              <SelectField label="Marital Status" value={editedUser.maritalStatus} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, maritalStatus: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
              <Field label="Nationality" value={editedUser.nationality} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, nationality: v })} />
              <div className="col-span-2">
                <TextAreaField label="Address" value={editedUser.address} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, address: v })} />
              </div>
            </div>
          </InfoSection>

          {/* 💼 Employment Details */}
          <InfoSection title="Employment" icon="💼" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employee ID" value={editedUser.employeeId} editing={isEditing && isAdmin} onChange={(v) => setEditedUser({ ...editedUser, employeeId: v })} />
              <Field label="Designation" value={editedUser.designation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, designation: v })} />
              <Field label="Department" value={editedUser.department} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, department: v })} />
              <Field label="Date of Joining" value={editedUser.dateOfJoining} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, dateOfJoining: v })} type="date" />
              <SelectField label="Employment Type" value={editedUser.employmentType} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, employmentType: v })} options={["Full-time", "Part-time", "Contract", "Intern"]} />
              <Field label="Location" value={editedUser.workLocation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, workLocation: v })} />
              <Field label="Manager" value={editedUser.reportingManager} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, reportingManager: v })} />
              <SelectField label="Account Level" value={editedUser.accountType} editing={isEditing && isAdmin} onChange={(v) => setEditedUser({ ...editedUser, accountType: v })} options={["EMPLOYEE", "ADMIN"]} />
              <div className="col-span-2"><Field label="Work Experience" value={editedUser.workExperience} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, workExperience: v })} /></div>
            </div>
          </InfoSection>

          {/* 💰 Compensation */}
          <InfoSection title="Financial & Bank" icon="💰" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Field label="Monthly Salary" value={editedUser.salary} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, salary: v ? Number(v) : undefined })} type="number" prefix="₹" />
              </div>
              <div className="col-span-2 sm:col-span-1">
<Field label="Bank Name" value={editedUser.bankName} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, bankName: v })} /></div>

<Field label="Account No." value={editedUser.accountNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, accountNumber: v })} />

<Field label="IFSC Code" value={editedUser.ifscCode} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, ifscCode: v })} />

<Field label="PAN Number" value={editedUser.panNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, panNumber: v })} />

<Field label="Aadhar No." value={editedUser.aadharNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, aadharNumber: v })} />
            </div>
          </InfoSection>

          {/* 🚨 Emergency Contact */}
          <InfoSection title="Emergency Contact" icon="🚨" isEditing={isEditing}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Contact Name" value={editedUser.emergencyContactName} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactName: v })} /></div>
              <Field label="Relationship" value={editedUser.emergencyContactRelation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactRelation: v })} />
              <Field label="Phone No." value={editedUser.emergencyContactPhone} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactPhone: v })} />
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
    // Added hover animations: smooth lift and deeper shadow
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
    <div className="flex flex-col gap-1 group">
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
        // Added smooth transition on border/background highlight
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
    <div className="flex flex-col gap-1 group">
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
        // Added transition and subtle highlight on group hover
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
        // Added smooth transition and subtle highlight on group hover
        <div className="px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-100 min-h-[60px] flex items-start h-full group-hover:bg-slate-50 group-hover:border-slate-300 transition-all duration-200">
          <p className="text-sm font-medium text-slate-800 leading-relaxed">{value || <span className="text-slate-400 font-normal">—</span>}</p>
        </div>
      )}
    </div>
  );
}