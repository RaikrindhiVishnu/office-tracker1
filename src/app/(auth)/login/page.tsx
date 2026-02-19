"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { isInsideOffice } from "@/lib/location";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      /* ===============================
         1️⃣ GET LOCATION
      =============================== */
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      /* ===============================
         2️⃣ OFFICE CHECK
      =============================== */
      const allowed = isInsideOffice(latitude, longitude);
      if (!allowed) {
        throw new Error("OUTSIDE_OFFICE");
      }

      /* ===============================
         3️⃣ FIREBASE LOGIN
      =============================== */
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password.trim()
      );

      /* ===============================
         4️⃣ FETCH USER PROFILE
      =============================== */
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const userData = snap.data();

      /* ===============================
         5️⃣ MUST CHANGE PASSWORD CHECK  ← NEW
      =============================== */
      if (userData?.mustChangePassword === true) {
        router.replace("/change-password");
        return;
      }

      /* ===============================
         6️⃣ ROLE ROUTING
      =============================== */
      const role =
        userData?.accountType?.toString().trim().toUpperCase() ?? "";

      switch (role) {
        case "ADMIN":
          router.replace("/admin");
          break;
        case "EMPLOYEE":
          router.replace("/employee");
          break;
        default:
          throw new Error("INVALID_ROLE");
      }
    } catch (err: any) {
      console.error("Login error:", err);

      if (err.code === 1) {
        setError("Location permission denied. Please allow location.");
      } else if (err.message === "OUTSIDE_OFFICE") {
        setError("Login blocked. You must be inside office premises.");
      } else if (err.message === "PROFILE_NOT_FOUND") {
        setError("User profile not found. Contact administrator.");
      } else if (err.message === "INVALID_ROLE") {
        setError("Your account has no valid role. Contact admin.");
      } else if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/user-not-found") {
        setError("User not found.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else if (err.message === "Geolocation not supported") {
        setError("Geolocation is not supported on this device.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email to reset password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await sendPasswordResetEmail(auth, email.trim().toLowerCase());

      setSuccess("Password reset email sent. Please check your inbox.");
    } catch (err: any) {
      console.error("Reset error:", err);

      if (err.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Failed to send reset email. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#143d3d]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">Login</h2>
        <br />

        {success && (
          <p className="text-green-600 text-sm mb-4">{success}</p>
        )}
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-md font-medium transition disabled:opacity-60"
          >
            {loading ? "Processing..." : "Login"}
          </button>
        </div>
        <br />

        <div className="text-right">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={loading}
            className="text-sm text-orange-500 hover:underline disabled:opacity-60"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}