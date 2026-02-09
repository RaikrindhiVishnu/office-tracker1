"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateEmployeeData } from "@/lib/employeeSync";

export default function ProfileView() {
  const { user, userData, refreshUserData } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localUserData, setLocalUserData] = useState(userData);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  useEffect(() => {
    if (userData) {
      setLocalUserData(userData);
      if (userData.profilePhoto) {
        setPhotoPreview(userData.profilePhoto);
      }
    }
  }, [userData]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    maritalStatus: "",
    nationality: "",
    address: "",
    employeeId: "",
    designation: "",
    department: "",
    dateOfJoining: "",
    employmentType: "",
    workLocation: "",
    reportingManager: "",
    workExperience: "",
    salary: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    panNumber: "",
    aadharNumber: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    if (localUserData) {
      setForm({
        name: localUserData.name || "",
        email: localUserData.email || "",
        phone: localUserData.phone || "",
        dateOfBirth: localUserData.dateOfBirth || "",
        gender: localUserData.gender || "",
        bloodGroup: localUserData.bloodGroup || "",
        maritalStatus: localUserData.maritalStatus || "",
        nationality: localUserData.nationality || "",
        address: localUserData.address || "",
        employeeId: localUserData.employeeId || "",
        designation: localUserData.designation || "",
        department: localUserData.department || "",
        dateOfJoining: localUserData.dateOfJoining || "",
        employmentType: localUserData.employmentType || "",
        workLocation: localUserData.workLocation || "",
        reportingManager: localUserData.reportingManager || "",
        workExperience: localUserData.workExperience || "",
        salary: localUserData.salary || "",
        bankName: localUserData.bankName || "",
        accountNumber: localUserData.accountNumber || "",
        ifscCode: localUserData.ifscCode || "",
        panNumber: localUserData.panNumber || "",
        aadharNumber: localUserData.aadharNumber || "",
        emergencyContactName: localUserData.emergencyContactName || "",
        emergencyContactRelation: localUserData.emergencyContactRelation || "",
        emergencyContactPhone: localUserData.emergencyContactPhone || "",
      });
    }
  }, [localUserData]);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const saveProfile = async () => {
    if (!user?.uid) {
      alert("User not authenticated");
      return;
    }

    setLoading(true);
    console.log("🔄 Starting profile update...");

    try {
      let photoURL = localUserData?.profilePhoto || "";

      // Upload profile photo if changed
      if (profilePhoto) {
        console.log("📸 Uploading profile photo...");
        const storageRef = ref(storage, `profilePhotos/${user.uid}`);
        await uploadBytes(storageRef, profilePhoto);
        photoURL = await getDownloadURL(storageRef);
        console.log("✅ Photo uploaded:", photoURL);
      }

      // Prepare update data
      const updatedData = {
        ...form,
        profilePhoto: photoURL,
      };

      console.log("📝 Updating employee data...");
      
      // Use the employeeSync function to update and notify admins
      await updateEmployeeData(
        user.uid,
        updatedData,
        user.uid,
        userData?.role || "employee"
      );

      console.log("✅ Profile updated successfully");

      // Update local state
      setLocalUserData({ ...localUserData, ...updatedData });
      
      // Refresh user data from Firebase
      if (refreshUserData) {
        await refreshUserData();
      }

      setEditing(false);
      setProfilePhoto(null);
      
      alert("✅ Profile updated successfully! Admins have been notified.");
      
    } catch (error) {
      console.error("❌ Error saving profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    
    // Reset form to original data
    if (localUserData) {
      setForm({
        name: localUserData.name || "",
        email: localUserData.email || "",
        phone: localUserData.phone || "",
        dateOfBirth: localUserData.dateOfBirth || "",
        gender: localUserData.gender || "",
        bloodGroup: localUserData.bloodGroup || "",
        maritalStatus: localUserData.maritalStatus || "",
        nationality: localUserData.nationality || "",
        address: localUserData.address || "",
        employeeId: localUserData.employeeId || "",
        designation: localUserData.designation || "",
        department: localUserData.department || "",
        dateOfJoining: localUserData.dateOfJoining || "",
        employmentType: localUserData.employmentType || "",
        workLocation: localUserData.workLocation || "",
        reportingManager: localUserData.reportingManager || "",
        workExperience: localUserData.workExperience || "",
        salary: localUserData.salary || "",
        bankName: localUserData.bankName || "",
        accountNumber: localUserData.accountNumber || "",
        ifscCode: localUserData.ifscCode || "",
        panNumber: localUserData.panNumber || "",
        aadharNumber: localUserData.aadharNumber || "",
        emergencyContactName: localUserData.emergencyContactName || "",
        emergencyContactRelation: localUserData.emergencyContactRelation || "",
        emergencyContactPhone: localUserData.emergencyContactPhone || "",
      });
      setPhotoPreview(localUserData.profilePhoto || "");
      setProfilePhoto(null);
    }
  };

  if (!localUserData) {
    return (
      <div className="p-6">
        <Skeleton height={200} />
        <Skeleton height={50} count={10} className="mt-4" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Employee Profile</h1>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={cancelEdit}
                disabled={loading}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* Profile Photo */}
        <div className="mb-8">
          <div className="flex items-center gap-6">
            <div
              {...(editing ? getRootProps() : {})}
              className={`relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-300 ${
                editing ? "cursor-pointer hover:border-blue-500 transition" : ""
              }`}
            >
              {editing && <input {...getInputProps()} />}
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-4xl font-bold">
                  {localUserData.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {editing && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white text-sm">
                  {isDragActive ? "Drop here" : "Click or drag"}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Complete employee information</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Basic Info */}
          <div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={!editing}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                <input
                  type="text"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  disabled={!editing}
                  placeholder="A+, B+, O+, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
                <select
                  value={form.maritalStatus}
                  onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  disabled={!editing}
                  placeholder="Indian"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Permanent Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  disabled={!editing}
                  rows={3}
                  placeholder="Enter full address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Employment Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                <input
                  type="text"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  disabled={!editing}
                  placeholder="EMP001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  disabled={!editing}
                  placeholder="Engineering, HR, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
                <input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                <select
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  disabled={!editing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Location</label>
                <input
                  type="text"
                  value={form.workLocation}
                  onChange={(e) => setForm({ ...form, workLocation: e.target.value })}
                  disabled={!editing}
                  placeholder="Office/Remote/Hybrid"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reporting Manager</label>
                <input
                  type="text"
                  value={form.reportingManager}
                  onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}
                  disabled={!editing}
                  placeholder="Manager name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Experience</label>
                <input
                  type="text"
                  value={form.workExperience}
                  onChange={(e) => setForm({ ...form, workExperience: e.target.value })}
                  disabled={!editing}
                  placeholder="e.g., 5 years"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Compensation & Benefits */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Compensation &amp; Benefits</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Salary</label>
                <input
                  type="number"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  disabled={!editing}
                  placeholder="50000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  disabled={!editing}
                  placeholder="SBI, HDFC, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                <input
                  type="text"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  disabled={!editing}
                  placeholder="XXXXXXXXXXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                <input
                  type="text"
                  value={form.ifscCode}
                  onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                  disabled={!editing}
                  placeholder="SBIN0001234"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                <input
                  type="text"
                  value={form.panNumber}
                  onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
                  disabled={!editing}
                  placeholder="ABCDE1234F"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Number</label>
                <input
                  type="text"
                  value={form.aadharNumber}
                  onChange={(e) => setForm({ ...form, aadharNumber: e.target.value })}
                  disabled={!editing}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                <input
                  type="text"
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  disabled={!editing}
                  placeholder="Full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                <input
                  type="text"
                  value={form.emergencyContactRelation}
                  onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                  disabled={!editing}
                  placeholder="Father, Mother, Spouse, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                <input
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                  disabled={!editing}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}