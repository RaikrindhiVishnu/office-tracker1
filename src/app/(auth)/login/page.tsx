"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
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

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      /* 1️⃣ GET USER LOCATION */
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true }
          );
        }
      );

      const { latitude, longitude } = position.coords;

      /* 2️⃣ CHECK OFFICE RADIUS */
      const allowed = isInsideOffice(latitude, longitude);

      if (!allowed) {
        setError(
          "❌ Login blocked. You must be inside office premises."
        );
        setLoading(false);
        return;
      }

      /* 3️⃣ FIREBASE LOGIN */
      const cred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      /* 4️⃣ FETCH ROLE */
      const snap = await getDoc(
        doc(db, "users", cred.user.uid)
      );

      if (!snap.exists()) {
        setError("User profile not found");
        setLoading(false);
        return;
      }

      const role = snap.data().role;

      /* 5️⃣ REDIRECT */
      router.push(role === "ADMIN" ? "/admin" : "/employee");

    } catch (err: any) {
      if (err.code === 1) {
        setError("❌ Location permission denied");
      } else {
        setError("Invalid credentials or location error");
      }
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="min-h-screen flex items-center justify-center bg-[#143d3d]">

    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

      {/* TITLE */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-1">
        Login
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Please enter your credentials
      </p>

      {/* ERROR */}
      {error && (
        <p className="text-red-500 text-sm mb-4">
          {error}
        </p>
      )}

      {/* FORM */}
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="
            w-full px-4 py-3 rounded-md
            border border-gray-300
            text-gray-800
            outline-none
            focus:ring-2 focus:ring-orange-400
          "
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="
            w-full px-4 py-3 rounded-md
            border border-gray-300
            text-gray-800
            outline-none
            focus:ring-2 focus:ring-orange-400
          "
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="
            w-full bg-orange-500 hover:bg-orange-600
            text-white py-3 rounded-md font-medium
            transition disabled:opacity-60
          "
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      {/* FOOTER */}
      <div className="mt-6 flex justify-between text-sm">
        <span className="text-gray-500">
          Admin & Employee access
        </span>

        <button
          onClick={() => router.push("/admin/add-user")}
          className="text-orange-500 hover:underline font-medium"
        >
          Add User
        </button>
      </div>
    </div>
  </div>
);

}
