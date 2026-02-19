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

  const isAdmin =
    userData?.role === "admin" || userData?.accountType === "ADMIN";

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
  /* ✅ SAVE EMPLOYEE — with Auth email sync  ← UPDATED */
  /* -------------------------------------------------- */
  const handleSaveEmployee = async () => {
    if (!editedUser?.uid) {
      alert("Employee not loaded correctly. Please reopen.");
      return;
    }

    try {
      setSaving(true);

      const { uid, id, ...updates } = editedUser;

      // ✅ If admin changed the email, update Firebase Auth email too
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

      // ✅ Update Firestore profile
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

  /* -------------------------------------------------- */
  /* ✅ Notifications */
  /* -------------------------------------------------- */
  const handleMarkNotificationRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    await markAllNotificationsAsRead(user.uid);
    setNotifications([]);
  };

  /* -------------------------------------------------- */
  /* ✅ Loading Guard */
  /* -------------------------------------------------- */
  if (!editedUser) {
    return (
      <div className="flex justify-center py-20 text-gray-500">
        Loading employee...
      </div>
    );
  }

  /* -------------------------------------------------- */
  /* ✅ UI */
  /* -------------------------------------------------- */
  return (
    <div className="max-w-5xl mx-auto">
      {/* 🔔 ADMIN NOTIFICATIONS */}
      {isAdmin && notifications.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">
                {notifications.length} new employee update
                {notifications.length > 1 && "s"}
              </p>
              <p className="text-sm text-gray-600">
                Employees changed profile data
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showNotifications ? "Hide" : "View"}
              </button>
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Mark All
              </button>
            </div>
          </div>

          {showNotifications && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="bg-white border rounded-lg p-3 flex justify-between"
                >
                  <div>
                    <p className="font-medium">{n.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {n.timestamp?.toDate?.()?.toLocaleString() || "Just now"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkNotificationRead(n.id)}
                    className="text-blue-600 text-sm hover:text-blue-700"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔙 BACK */}
      <button
        onClick={() => setView("employees")}
        className="mb-6 font-semibold hover:opacity-70 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Employees
      </button>

      {/* CARD */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        {/* HEADER */}
        <div className="bg-gray-900 text-white px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Employee Profile</h2>
            <p className="text-gray-400 text-sm">Complete employee information</p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
              isEditing
                ? "bg-white text-gray-900 hover:bg-gray-100"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {/* BODY */}
        <div className="p-8">
          {/* Profile Section */}
          <div className="flex items-start gap-8 mb-10 pb-10 border-b">
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-xl group">
              {editedUser.profilePhoto ? (
                <img
                  src={editedUser.profilePhoto}
                  alt="Employee"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white text-5xl font-bold">
                  {editedUser.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {isEditing && isAdmin && (
                <label className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold opacity-0 group-hover:opacity-100 cursor-pointer transition">
                  Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAdminPhotoUpload}
                  />
                </label>
              )}
            </div>

            <div className="flex-1 grid md:grid-cols-2 gap-6">
              <Field
                label="Full Name"
                value={editedUser.name}
                editing={isEditing}
                onChange={(v) => setEditedUser({ ...editedUser, name: v })}
              />
              <Field
                label="Email Address"
                value={editedUser.email}
                editing={isEditing}
                onChange={(v) => setEditedUser({ ...editedUser, email: v })}
              />
            </div>
          </div>

          {/* Personal Information */}
          <Section title="Personal Information">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Field label="Phone Number" value={editedUser.phone} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, phone: v })} placeholder="+91 XXXXX XXXXX" />
              <Field label="Date of Birth" value={editedUser.dateOfBirth} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, dateOfBirth: v })} type="date" />
              <SelectField label="Gender" value={editedUser.gender} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, gender: v })} options={["Male", "Female", "Other"]} />
              <Field label="Blood Group" value={editedUser.bloodGroup} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, bloodGroup: v })} placeholder="A+, B+, O+, etc." />
              <SelectField label="Marital Status" value={editedUser.maritalStatus} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, maritalStatus: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
              <Field label="Nationality" value={editedUser.nationality} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, nationality: v })} placeholder="Indian" />
              <div className="md:col-span-2 lg:col-span-3">
                <TextAreaField label="Permanent Address" value={editedUser.address} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, address: v })} placeholder="Enter full address" />
              </div>
            </div>
          </Section>

          {/* Employment Details */}
          <Section title="Employment Details">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Field label="Employee ID" value={editedUser.employeeId} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, employeeId: v })} placeholder="EMP001" />
              <Field label="Designation" value={editedUser.designation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, designation: v })} />
              <Field label="Department" value={editedUser.department} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, department: v })} placeholder="Engineering, HR, etc." />
              <Field label="Date of Joining" value={editedUser.dateOfJoining} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, dateOfJoining: v })} type="date" />
              <SelectField label="Employment Type" value={editedUser.employmentType} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, employmentType: v })} options={["Full-time", "Part-time", "Contract", "Intern"]} />
              <Field label="Work Location" value={editedUser.workLocation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, workLocation: v })} placeholder="Office/Remote/Hybrid" />
              <Field label="Reporting Manager" value={editedUser.reportingManager} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, reportingManager: v })} placeholder="Manager name" />
              <SelectField label="Account Type" value={editedUser.role || editedUser.accountType} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, role: v, accountType: v })} options={["admin", "employee", "manager"]} />
              <Field label="Work Experience" value={editedUser.workExperience} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, workExperience: v })} placeholder="5 years" />
            </div>
          </Section>

          {/* Compensation & Benefits */}
          <Section title="Compensation & Benefits">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Field label="Monthly Salary" value={editedUser.salary} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, salary: v })} type="number" placeholder="50000" />
              <Field label="Bank Name" value={editedUser.bankName} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, bankName: v })} placeholder="SBI, HDFC, etc." />
              <Field label="Account Number" value={editedUser.accountNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, accountNumber: v })} placeholder="XXXXXXXXXXXX" />
              <Field label="IFSC Code" value={editedUser.ifscCode} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, ifscCode: v })} placeholder="SBIN0001234" />
              <Field label="PAN Number" value={editedUser.panNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, panNumber: v })} placeholder="ABCDE1234F" />
              <Field label="Aadhar Number" value={editedUser.aadharNumber} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, aadharNumber: v })} placeholder="XXXX XXXX XXXX" />
            </div>
          </Section>

          {/* Emergency Contact */}
          <Section title="Emergency Contact">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Field label="Contact Name" value={editedUser.emergencyContactName} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactName: v })} placeholder="Full name" />
              <Field label="Relationship" value={editedUser.emergencyContactRelation} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactRelation: v })} placeholder="Father, Mother, Spouse, etc." />
              <Field label="Contact Number" value={editedUser.emergencyContactPhone} editing={isEditing} onChange={(v) => setEditedUser({ ...editedUser, emergencyContactPhone: v })} placeholder="+91 XXXXX XXXXX" />
            </div>
          </Section>

          {/* SAVE */}
          {isEditing && (
            <div className="flex justify-end gap-4 pt-8 border-t">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedUser(selectedUser);
                }}
                disabled={saving}
                className="px-8 py-3 border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={saving}
                className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 shadow-lg"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =======================================================
   🔥 Reusable Components
======================================================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <span className="w-1.5 h-8 bg-gray-900 rounded-full"></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text", placeholder = "" }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; type?: string; placeholder?: string; }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{label}</label>
      {editing ? (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-colors text-gray-900" />
      ) : (
        <p className="text-lg font-semibold text-gray-900">
          {type === "date" && value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : value || "Not provided"}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; options: string[]; }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{label}</label>
      {editing ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-colors text-gray-900">
          <option value="">Select</option>
          {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
        </select>
      ) : (
        <p className="text-lg font-semibold text-gray-900">{value || "Not provided"}</p>
      )}
    </div>
  );
}

function TextAreaField({ label, value, editing, onChange, placeholder = "" }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{label}</label>
      {editing ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-colors text-gray-900" />
      ) : (
        <p className="text-lg font-semibold text-gray-900">{value || "Not provided"}</p>
      )}
    </div>
  );
}