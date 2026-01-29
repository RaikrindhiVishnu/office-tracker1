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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[#062f33]">
      
      {/* LEFT SECTION */}
      <div className="hidden md:flex flex-col justify-center items-center text-white px-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-500 rounded-md" />
          <h1 className="text-3xl font-semibold">
            Office Tracker
          </h1>
        </div>

        <p className="text-gray-300 text-center max-w-md text-lg">
          Attendance, work updates and real-time
          monitoring — all in one place.
        </p>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center justify-center px-10">
        <div className="w-full max-w-lg text-white">

          <h2 className="text-3xl font-semibold mb-2">
            Welcome
          </h2>
          <p className="text-gray-300 mb-10">
            Please login to your dashboard
          </p>

          {error && (
            <p className="text-red-400 mb-4">
              {error}
            </p>
          )}

          {/* INPUTS */}
          <div className="space-y-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white text-gray-800 px-4 py-3 text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white text-gray-800 px-4 py-3 text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="mt-8 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 text-lg font-medium transition disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>

          {/* BOTTOM ROW */}
          <div className="mt-10 flex items-center justify-between text-sm">
            <span className="text-gray-400">
              Admin & Employee access
            </span>

            <button
              onClick={() => router.push("/admin/add-user")}
              className="text-orange-400 hover:text-orange-300 font-medium transition"
            >
              Add User
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
