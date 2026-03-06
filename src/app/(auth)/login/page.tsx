"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
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

// ── Extract Firestore index URL from error message ────────
function extractIndexUrl(msg = "") {
  const m = msg.match(/(https:\/\/console\.firebase\.google\.com\/[^\s"'\n]+)/);
  return m ? m[1].trim() : null;
}

function isIndexError(e: any) {
  return (
    e?.code === "failed-precondition" ||
    e?.code === "9" ||
    e?.message?.includes("index") ||
    e?.message?.includes("FAILED_PRECONDITION") ||
    e?.message?.includes("console.firebase.google.com")
  );
}

// ── Today's date string YYYY-MM-DD (local time, midnight) ─
function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Check if employee has an approved WFH leave for today ─
// Returns: { allowed: boolean, indexUrl?: string }
async function checkWFHApproved(uid: string): Promise<{ allowed: boolean; indexUrl?: string }> {
  const today = getTodayString();

  try {
    // This composite query REQUIRES a Firestore index:
    //   Collection: leaveRequests
    //   Fields: uid (ASC), leaveType (ASC), status (ASC)
    // If the index doesn't exist, Firebase throws an error
    // containing the URL to create it.
    const q = query(
      collection(db, "leaveRequests"),
      where("uid",       "==", uid),
      where("leaveType", "==", "Work From Home"),
      where("status",    "==", "Approved")
    );

    const snap = await getDocs(q);

    let wfhAllowed = false;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const fromDate: string = data.fromDate ?? "";
      const toDate:   string = data.toDate   ?? "";

      // fromDate and toDate are stored as "YYYY-MM-DD" strings
      if (fromDate && toDate && today >= fromDate && today <= toDate) {
        wfhAllowed = true;
      }
    });

    return { allowed: wfhAllowed };
  } catch (e: any) {
    if (isIndexError(e)) {
      // Return the Firebase Console URL so login page can show it
      return {
        allowed: false,
        indexUrl: extractIndexUrl(e.message) ?? undefined,
      };
    }
    // Any other Firestore error → treat as WFH not approved (safe default)
    console.error("WFH check error:", e);
    return { allowed: false };
  }
}

// ── Get user's current GPS location ──────────────────────
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEO_NOT_SUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,   // always fresh — no cached position
    });
  });
}

// ─────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  // If Firestore index is missing, we show a clickable link
  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  // Step-by-step status shown while logging in
  const [step, setStep] = useState("");

  const handleLogin = async () => {
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

      // ── STEP 1: Firebase Auth ──────────────────────────
      setStep("Verifying credentials...");
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password.trim()
      );

      // ── STEP 2: Fetch user profile from Firestore ──────
      setStep("Loading your profile...");
      const userRef  = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const userData = userSnap.data();
      const role = (userData?.accountType ?? "").toString().trim().toUpperCase();

      // ── STEP 3: Force password change if flagged ───────
      if (userData?.mustChangePassword === true) {
        router.replace("/change-password");
        return;
      }

      // ── STEP 4: Location check (EMPLOYEES ONLY) ────────
      // Admin, SuperAdmin, BusinessOwner skip location entirely.
      // Only EMPLOYEE role is subject to office location enforcement.
      if (role === "EMPLOYEE") {
        setStep("Checking work-from-home status...");

        // Check if employee has an approved WFH leave for today
        const wfhResult = await checkWFHApproved(cred.user.uid);

        if (wfhResult.indexUrl) {
          // Firestore index missing — show the fix link
          setIndexUrl(wfhResult.indexUrl);
          throw new Error("INDEX_MISSING");
        }

        if (wfhResult.allowed) {
          // ✅ WFH approved for today → skip location check
          // Employee can log in from anywhere
          setStep("WFH approved — bypassing location check...");
        } else {
          // ❌ No approved WFH → MUST be physically inside office
          setStep("Checking your location...");

          let position: GeolocationPosition;
          try {
            position = await getCurrentPosition();
          } catch (geoErr: any) {
            if (geoErr.code === 1 || geoErr.message === "User denied Geolocation") {
              throw new Error("GEO_DENIED");
            } else if (geoErr.message === "GEO_NOT_SUPPORTED") {
              throw new Error("GEO_NOT_SUPPORTED");
            } else {
              throw new Error("GEO_TIMEOUT");
            }
          }

          const { latitude, longitude } = position.coords;
          const insideOffice = isInsideOffice(latitude, longitude);

          if (!insideOffice) {
            // Log the attempt for audit purposes (optional)
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

      // ── STEP 5: Route by role ──────────────────────────
      setStep("Redirecting...");

      switch (role) {
        case "SUPERADMIN":
          router.replace("/superadmin");
          break;
        case "ADMIN":
          router.replace("/admin");
          break;
        case "BUSINESSOWNER":
        case "BUSINESS_OWNER":
          router.replace("/business-owner");
          break;
        case "EMPLOYEE":
          router.replace("/employee");
          break;
        default:
          throw new Error("INVALID_ROLE");
      }

    } catch (err: any) {
      console.error("Login error:", err?.code, err?.message);
      setStep("");

      // ── Map every possible error to a user-friendly message ──
      switch (true) {
        case err.message === "INDEX_MISSING":
          setError(
            "A Firestore index is required. Click the button below to create it, " +
            "then try logging in again."
          );
          break;

        case err.message === "GEO_DENIED":
          setError(
            "📍 Location permission denied.\n" +
            "Please allow location access in your browser and try again.\n" +
            "You must be inside the office to log in."
          );
          break;

        case err.message === "GEO_NOT_SUPPORTED":
          setError(
            "📍 Geolocation is not supported on this device or browser."
          );
          break;

        case err.message === "GEO_TIMEOUT":
          setError(
            "📍 Could not get your location (timeout). " +
            "Please check your GPS signal and try again."
          );
          break;

        case err.message === "OUTSIDE_OFFICE":
          setError(
            "🚫 Login blocked.\n" +
            "You are outside office premises.\n" +
            "You must be within 100 meters of the office to log in.\n" +
            "If you're working from home, your WFH request must be approved first."
          );
          break;

        case err.message === "PROFILE_NOT_FOUND":
          setError("User profile not found. Please contact your administrator.");
          break;

        case err.message === "INVALID_ROLE":
          setError("Your account has no valid role assigned. Contact admin.");
          break;

        case err.code === "auth/invalid-credential":
        case err.code === "auth/wrong-password":
          setError("Invalid email or password. Please try again.");
          break;

        case err.code === "auth/user-not-found":
          setError("No account found with this email address.");
          break;

        case err.code === "auth/too-many-requests":
          setError("Too many failed attempts. Account temporarily locked. Try again later.");
          break;

        case err.code === "auth/network-request-failed":
          setError("Network error. Please check your internet connection.");
          break;

        default:
          setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSuccess("✅ Password reset email sent. Please check your inbox.");
    } catch (err: any) {
      if      (err.code === "auth/user-not-found")  setError("No account found with this email.");
      else if (err.code === "auth/invalid-email")   setError("Invalid email address.");
      else                                           setError("Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Enter key ──────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #143d3d 0%, #0f2d2d 100%)",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#fff",
        borderRadius: 24,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        padding: "40px 36px",
        boxSizing: "border-box",
      }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, background: "linear-gradient(135deg, #143d3d, #1a5c5c)",
            borderRadius: 16, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 14px", fontSize: 26,
            boxShadow: "0 4px 16px rgba(20,61,61,0.35)",
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
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 12, padding: "10px 14px", marginBottom: 20,
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
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: 10, padding: "8px 14px", marginBottom: 16,
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
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#15803d", fontWeight: 500,
          }}>{success}</div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#fff1f2", border: "1px solid #fecdd3",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#be123c", fontWeight: 500,
            whiteSpace: "pre-line", lineHeight: 1.6,
          }}>{error}</div>
        )}

        {/* Firestore Index Error Banner */}
        {indexUrl && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fbbf24",
            borderRadius: 12, padding: "14px 16px", marginBottom: 16,
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
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 18px", background: "#f59e0b", color: "#fff",
                borderRadius: 10, fontSize: 13, fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 3px 12px rgba(245,158,11,0.45)",
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
            style={{
              padding: "12px 16px", border: "1.5px solid #e2e8f0",
              borderRadius: 12, fontSize: 14, outline: "none",
              color: "#0f172a", background: loading ? "#f8fafc" : "#fff",
              boxSizing: "border-box", width: "100%",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 16px", border: "1.5px solid #e2e8f0",
              borderRadius: 12, fontSize: 14, outline: "none",
              color: "#0f172a", background: loading ? "#f8fafc" : "#fff",
              boxSizing: "border-box", width: "100%",
            }}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding: "13px", background: loading ? "#94a3b8" : "#143d3d",
              color: "#fff", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              boxShadow: loading ? "none" : "0 4px 16px rgba(20,61,61,0.35)",
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
              background: "none", border: "none", cursor: "pointer",
              color: "#ea580c", fontSize: 13, fontWeight: 600,
              textDecoration: "underline", opacity: loading ? 0.5 : 1,
            }}
          >
            Forgot Password?
          </button>
        </div>

        {/* Role legend */}
        {/* <div style={{
          marginTop: 24, padding: "14px 16px",
          background: "#f8fafc", borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Login Rules
          </p>
          {[
            { role: "Employee",      rule: "Must be in office OR have approved WFH", icon: "👤" },
            { role: "Admin",         rule: "No location restriction",                icon: "🛡️" },
            { role: "SuperAdmin",    rule: "No location restriction",                icon: "⚡" },
            { role: "BusinessOwner", rule: "No location restriction",                icon: "💼" },
          ].map(({ role, rule, icon }) => (
            <div key={role} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12 }}>
              <span>{icon}</span>
              <strong style={{ color: "#334155", minWidth: 110 }}>{role}:</strong>
              <span style={{ color: "#64748b" }}>{rule}</span>
            </div>
          ))}
        </div> */}

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