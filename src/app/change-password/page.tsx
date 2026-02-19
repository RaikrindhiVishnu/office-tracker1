"use client";

import { useState } from "react";
import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const auth = getAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async () => {
    setError("");

    if (!currentPassword || !newPassword || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from temporary password.");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser!;

      // Re-authenticate with temp password first
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Set new password
      await updatePassword(user, newPassword);

      // Clear the mustChangePassword flag in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        mustChangePassword: false,
      });

      alert("✅ Password changed successfully! Please login again.");
      router.replace("/login");
    } catch (err: any) {
      console.error("Change password error:", err);

      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setError("New password is too weak. Use at least 8 characters.");
      } else {
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#143d3d]">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          Set New Password
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          You must change your temporary password before continuing.
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Current (temporary) password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleChange}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-md font-medium transition disabled:opacity-60"
          >
            {loading ? "Updating..." : "Set New Password"}
          </button>
        </div>
      </div>
    </div>
  );
}