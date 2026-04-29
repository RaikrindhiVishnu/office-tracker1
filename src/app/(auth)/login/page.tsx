"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { isInsideOffice } from "@/lib/location";
// ← reuse the same mapping
import { getRoleRedirect } from "@/lib/roleRouting";
   import { Eye, EyeOff } from "lucide-react";

// ── Extract Firestore index URL from error message ────────────────────────
function extractIndexUrl(msg = ""): string | null {
  const m = msg.match(/(https:\/\/console\.firebase\.google\.com\/[^\s"'\n]+)/);
  return m ? m[1].trim() : null;
}

function isIndexError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === "failed-precondition" ||
    err?.code === "9" ||
    (err?.message?.includes("index") ?? false) ||
    (err?.message?.includes("FAILED_PRECONDITION") ?? false) ||
    (err?.message?.includes("console.firebase.google.com") ?? false)
  );
}

// ── Today's date string YYYY-MM-DD (local time) ───────────────────────────
function getTodayString(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Check approved WFH leave for today ───────────────────────────────────
async function checkWFHApproved(uid: string): Promise<{ allowed: boolean; indexUrl?: string }> {
  const today = getTodayString();
  try {
    const q = query(
      collection(db, "leaveRequests"),
      where("uid",       "==", uid),
      where("leaveType", "==", "Work From Home"),
      where("status",    "==", "Approved")
    );
    const snap = await getDocs(q);
    let wfhAllowed = false;
    snap.forEach((docSnap) => {
      const data      = docSnap.data();
      const fromDate  = (data.fromDate ?? "") as string;
      const toDate    = (data.toDate   ?? "") as string;
      if (fromDate && toDate && today >= fromDate && today <= toDate) {
        wfhAllowed = true;
      }
    });
    return { allowed: wfhAllowed };
  } catch (e: unknown) {
    if (isIndexError(e)) {
      const err = e as { message?: string };
      return { allowed: false, indexUrl: extractIndexUrl(err.message ?? "") ?? undefined };
    }
    console.error("WFH check error:", e);
    return { allowed: false };
  }
}

// ── Get GPS position ──────────────────────────────────────────────────────
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEO_NOT_SUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy : true,
      timeout            : 15000,
      maximumAge         : 0,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [email,      setEmail]      = useState<string>("");
  const [password,   setPassword]   = useState<string>("");
  const [loading,    setLoading]    = useState<boolean>(false);
  const [error,      setError]      = useState<string>("");
  const [success,    setSuccess]    = useState<string>("");
  const [indexUrl,   setIndexUrl]   = useState<string | null>(null);
  const [step,       setStep]       = useState<string>("");
  // Add this state near the other useState declarations
const [showPassword, setShowPassword] = useState<boolean>(false);
  // ── Sign In ─────────────────────────────────────────────────────────────
  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setIndexUrl(null);
      setStep("");

      // STEP 1: Firebase Auth
      setStep("Verifying credentials...");
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password.trim()
      );

      // STEP 2: Fetch user profile
      setStep("Loading your profile...");
      const userRef  = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) throw new Error("PROFILE_NOT_FOUND");

      const userData    = userSnap.data();
      const role = (userData?.role ?? userData?.accountType ?? "").toString().trim().toUpperCase();
const department = (userData?.department ?? "").toString().trim().toUpperCase();

      // STEP 3: Force password change if flagged
      if (userData?.mustChangePassword === true) {
        router.replace("/change-password");
        return;
      }

      // STEP 4: Location check (employees only, no WFH approval)
      if (role === "EMPLOYEE") {
        setStep("Checking work-from-home status...");
        const wfhResult = await checkWFHApproved(cred.user.uid);

        if (wfhResult.indexUrl) {
          setIndexUrl(wfhResult.indexUrl);
          throw new Error("INDEX_MISSING");
        }

        if (wfhResult.allowed) {
          setStep("WFH approved — bypassing location check...");
        } else {
          setStep("Checking your location...");
          let position: GeolocationPosition;
          try {
            position = await getCurrentPosition();
          } catch (geoErr: unknown) {
            const err = geoErr as { code?: number; message?: string };
            if (err.code === 1 || err.message === "User denied Geolocation") {
              throw new Error("GEO_DENIED");
            } else if (err.message === "GEO_NOT_SUPPORTED") {
              throw new Error("GEO_NOT_SUPPORTED");
            } else {
              throw new Error("GEO_TIMEOUT");
            }
          }

          const { latitude, longitude } = position.coords;
          if (!isInsideOffice(latitude, longitude)) {
            console.warn(
              `[LOGIN BLOCKED] uid=${cred.user.uid} ` +
              `lat=${latitude.toFixed(6)} lng=${longitude.toFixed(6)} ` +
              `— outside office on ${getTodayString()}`
            );
            throw new Error("OUTSIDE_OFFICE");
          }

          setStep("Location verified ✓");
        }
      }

      // STEP 5: Route by role using the same normalizeRole mapping as AuthContext
      setStep("Redirecting...");
      const destination = getRoleRedirect(role, department);

      if (!role) throw new Error("INVALID_ROLE");

      router.replace(destination);

    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error("Login error:", e?.code, e?.message);
      setStep("");

      if      (e.message === "INDEX_MISSING")     setError("A Firestore index is required. Click the button below to create it, then try logging in again.");
      else if (e.message === "GEO_DENIED")        setError("📍 Location permission denied.\nPlease allow location access in your browser and try again.\nYou must be inside the office to log in.");
      else if (e.message === "GEO_NOT_SUPPORTED") setError("📍 Geolocation is not supported on this device or browser.");
      else if (e.message === "GEO_TIMEOUT")       setError("📍 Could not get your location (timeout). Please check your GPS signal and try again.");
      else if (e.message === "OUTSIDE_OFFICE")    setError("🚫 Login blocked.\nYou are outside office premises.\nYou must be within 100 meters of the office to log in.\nIf you're working from home, your WFH request must be approved first.");
      else if (e.message === "PROFILE_NOT_FOUND") setError("User profile not found. Please contact your administrator.");
      else if (e.message === "INVALID_ROLE")      setError("Your account has no valid role assigned. Contact admin.");
      else if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") setError("Invalid email or password. Please try again.");
      else if (e.code === "auth/user-not-found")         setError("No account found with this email address.");
      else if (e.code === "auth/too-many-requests")      setError("Too many failed attempts. Account temporarily locked. Try again later.");
      else if (e.code === "auth/network-request-failed") setError("Network error. Please check your internet connection.");
      else                                               setError("Login failed. Please try again.");

    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────
  const handlePasswordReset = async (): Promise<void> => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setStep("Sending reset email...");

      const res  = await fetch("/api/send-password-reset", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset email.");

      setSuccess("✅ Password reset email sent! Please check your inbox.");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  // ── Enter key support ────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  // ─────────────────────────────────────────────────────────────────────
  //  RENDER  (UI unchanged from your original)
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight      : "100vh",
      display        : "flex",
      alignItems     : "center",
      justifyContent : "center",
      background     : "linear-gradient(135deg, #143d3d 0%, #0f2d2d 100%)",
      fontFamily     : "'Inter', 'Segoe UI', sans-serif",
      padding        : "20px",
    }}>
      <div style={{
        width        : "100%",
        maxWidth     : 420,
        background   : "#fff",
        borderRadius : 24,
        boxShadow    : "0 24px 64px rgba(0,0,0,0.25)",
        padding      : "40px 36px",
        boxSizing    : "border-box",
      }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background     : "linear-gradient(135deg, #143d3d, #1a5c5c)",
            borderRadius   : 16, display: "flex", alignItems: "center",
            justifyContent : "center", margin: "0 auto 14px", fontSize: 26,
            boxShadow      : "0 4px 16px rgba(20,61,61,0.35)",
          }}>🏢</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Office Tracker
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Sign in to your account
          </p>
        </div>

        {/* Location policy notice */}
        <div style={{
          background   : "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius : 12, padding: "10px 14px", marginBottom: 20,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
          <p style={{ margin: 0, fontSize: 12, color: "#15803d", lineHeight: 1.5 }}>
            <strong>Employees:</strong> You must be inside the office (within 100m) to log in.
            Approved WFH requests allow login from anywhere.
          </p>
        </div>

        {/* Step indicator */}
        {loading && step && (
          <div style={{
            background   : "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius : 10, padding: "8px 14px", marginBottom: 16,
            fontSize: 13, color: "#1d4ed8", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            {step}
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            background   : "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius : 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#15803d", fontWeight: 500,
          }}>{success}</div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background   : "#fff1f2", border: "1px solid #fecdd3",
            borderRadius : 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#be123c", fontWeight: 500,
            whiteSpace   : "pre-line", lineHeight: 1.6,
          }}>{error}</div>
        )}

        {/* Firestore Index Error Banner */}
        {indexUrl && (
          <div style={{
            background   : "#fffbeb", border: "1px solid #fbbf24",
            borderRadius : 12, padding: "14px 16px", marginBottom: 16,
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#78350f" }}>
              ⚠️ Missing Firestore Index — leaveRequests
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              The WFH check query needs a composite index on{" "}
              <code style={{ background: "#fef3c7", padding: "1px 5px", borderRadius: 4 }}>
                uid + leaveType + status
              </code>.
              Click below to create it instantly, then log in again.
            </p>
            <a
              href={indexUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display        : "inline-flex", alignItems: "center", gap: 7,
                padding        : "9px 18px", background: "#f59e0b", color: "#fff",
                borderRadius   : 10, fontSize: 13, fontWeight: 800,
                textDecoration : "none",
                boxShadow      : "0 3px 12px rgba(245,158,11,0.45)",
              }}
            >
              🔗 Create Index in Firebase →
            </a>
          </div>
        )}

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }} onKeyDown={handleKeyDown}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
             autoComplete="email" 
            style={{
              padding      : "12px 16px", border: "1.5px solid #e2e8f0",
              borderRadius : 12, fontSize: 14, outline: "none",
              color        : "#0f172a", background: loading ? "#f8fafc" : "#fff",
              boxSizing    : "border-box", width: "100%",
            }}
          />

         <div style={{ position: "relative" }}>
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    disabled={loading}
    autoComplete="current-password" 
    style={{
      padding      : "12px 44px 12px 16px",
      border       : "1.5px solid #e2e8f0",
      borderRadius : 12, fontSize: 14, outline: "none",
      color        : "#0f172a", background: loading ? "#f8fafc" : "#fff",
      boxSizing    : "border-box", width: "100%",
    }}
  />
  {password && (
  <button
    type="button"
    onClick={() => setShowPassword(p => !p)}
    style={{
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#94a3b8",
    }}
    tabIndex={-1}
  >
    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
)}
</div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding      : "13px",
              background   : loading ? "#94a3b8" : "#143d3d",
              color        : "#fff", border: "none", borderRadius: 12,
              fontSize     : 15, fontWeight: 700,
              cursor       : loading ? "not-allowed" : "pointer",
              transition   : "background 0.2s",
              boxShadow    : loading ? "none" : "0 4px 16px rgba(20,61,61,0.35)",
            }}
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </div>

        {/* Forgot Password */}
        <div style={{ textAlign: "right", marginTop: 14 }}>
          <button
            onClick={handlePasswordReset}
            disabled={loading}
            style={{
              background     : "none", border: "none", cursor: "pointer",
              color          : "#ea580c", fontSize: 13, fontWeight: 600,
              textDecoration : "underline", opacity: loading ? 0.5 : 1,
            }}
          >
            Forgot Password?
          </button>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}