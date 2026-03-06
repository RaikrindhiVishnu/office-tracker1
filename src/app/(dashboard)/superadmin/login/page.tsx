"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function SuperAdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // 1️⃣ Firebase Auth
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password.trim()
      );

      // 2️⃣ Check custom claim (not Firestore role)
      const tokenResult = await cred.user.getIdTokenResult(true);

      if (tokenResult.claims.superAdmin !== true) {
        await signOut(auth);
        throw new Error("NOT_SUPER_ADMIN");
      }

      // 3️⃣ Route to Super Admin dashboard
      router.replace("/superadmin");

    } catch (err: any) {
      console.error("Super Admin login error:", err);

      if (err.message === "NOT_SUPER_ADMIN") {
        setError("Access denied. This portal is for Super Admins only.");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f2027]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        {/* Header */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-3">
            <span className="text-2xl">👑</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">
            Super Admin Portal
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Platform-level access only. Not for regular employees.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Super Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-purple-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 rounded-md border border-gray-300 text-gray-800 outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-md font-medium transition disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Sign In as Super Admin"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Regular employees →{" "}
          <a href="/login" className="text-purple-500 hover:underline">
            Go to company login
          </a>
        </p>
      </div>
    </div>
  );
}