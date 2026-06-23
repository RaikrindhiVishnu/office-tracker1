"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getRoleRedirect } from "@/lib/roleRouting";
import { Eye, EyeOff } from "lucide-react";

// ── Portal definitions ──────────────────────────────────────────────────────
const PORTALS = [
  { id: "admin", label: "Admin Portal", desc: "System settings, payroll & approvals", icon: "🛡️" },
  { id: "employee", label: "Employee Portal", desc: "Attendance, leaves & updates", icon: "👥" },
  { id: "sales", label: "Sales Analytics", desc: "Lead pipeline & KPIs", icon: "📈" },
  { id: "operations", label: "Operations Analytics", desc: "Workflows, logistics & efficiency", icon: "⚙️" },
  { id: "finance", label: "Financial Suite", desc: "Billing & payroll reports", icon: "💰" },
  { id: "executive", label: "Executive Desk", desc: "Corporate metrics & reports", icon: "👔" },
  { id: "hr", label: "HR Management", desc: "Staff directory & new joiners", icon: "💼" },
  { id: "support", label: "Support Portal", desc: "Tickets & support SLA hub", icon: "🎧" },
];

// ── COMPONENT ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [selectedPortal, setSelectedPortal] = useState<(typeof PORTALS)[0] | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [indexUrl, setIndexUrl] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const selectPortal = (portal: (typeof PORTALS)[0]) => {
    setTransitioning(true);
    setTimeout(() => { setSelectedPortal(portal); setError(""); setSuccess(""); setTransitioning(false); }, 260);
  };

  const goBack = () => {
    setTransitioning(true);
    setTimeout(() => { setSelectedPortal(null); setError(""); setSuccess(""); setStep(""); setTransitioning(false); }, 260);
  };

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    try {
      setLoading(true); setError(""); setSuccess(""); setIndexUrl(null); setStep("");
      setStep("Verifying credentials...");
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password.trim());

      setStep("Loading your profile...");
      const userSnap = await getDocFromServer(doc(db, "users", cred.user.uid));
      if (!userSnap.exists()) throw new Error(`PROFILE_NOT_FOUND_FOR_UID: ${cred.user.uid} (${cred.user.email})`);

      const userData = userSnap.data();
      const role = (userData?.role ?? userData?.accountType ?? "").toString().trim().toUpperCase();
      const department = (userData?.department ?? "").toString().trim().toUpperCase();

      if (userData?.mustChangePassword === true) { router.replace("/change-password"); return; }

      setStep("Redirecting...");
      if (!role) throw new Error("INVALID_ROLE");
      let destination = getRoleRedirect(role, department);
      if (typeof window !== "undefined") {
        const redir = new URLSearchParams(window.location.search).get("redirect");
        if (redir) destination = redir;
      }
      router.replace(destination);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setStep("");
      if (e.message?.startsWith("PROFILE_NOT_FOUND_FOR_UID")) setError(`User profile not found.\n${e.message}\nContact your administrator.`);
      else if (e.message === "INVALID_ROLE") setError("Your account has no valid role. Contact admin.");
      else if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") setError("Invalid email or password.");
      else if (e.code === "auth/user-not-found") setError("No account found with this email.");
      else if (e.code === "auth/too-many-requests") setError("Too many attempts. Account locked temporarily.");
      else if (e.code === "auth/network-request-failed") setError("Network error. Check your connection.");
      else if (e.code === "unavailable") setError("🔌 Cannot reach database. Check your connection.");
      else setError("Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handlePasswordReset = async (): Promise<void> => {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    try {
      setLoading(true); setError(""); setSuccess(""); setStep("Sending reset email...");
      const res = await fetch("/api/send-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset email.");
      setSuccess("✅ Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to send reset email.");
    } finally { setLoading(false); setStep(""); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !loading) handleLogin(); };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.18)} 50%{box-shadow:0 0 0 14px rgba(255,255,255,0)} }
        @keyframes cardIn  { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

        .portal-card {
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.2s ease,
                      background 0.2s ease,
                      border-color 0.2s ease !important;
        }
        .portal-card:hover {
          transform: translateY(-5px) scale(1.02) !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border-color: rgba(255, 255, 255, 1) !important;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.15) !important;
        }
        .portal-card:active { transform: translateY(-1px) scale(0.99) !important; }

        .back-btn:hover { background: rgba(0,0,0,0.06) !important; border-color: rgba(0,0,0,0.12) !important; }

        input:focus { outline: none; border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.2) !important; }

        @media (max-width: 920px)  { .portal-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 480px)  { .portal-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── Page shell ── */}
      <div style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: "32px 20px",
        position: "relative", overflow: "hidden",
      }}>

        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute", width: "100%", height: "100%",
            objectFit: "cover", zIndex: 0, top: 0, left: 0,
          }}
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>

        {/* ── Brand header ── */}
        {!selectedPortal && (
          <div style={{
            textAlign: "center",
            marginBottom: 32,
            position: "relative", zIndex: 2,
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "translateY(-8px)" : "translateY(0)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
            animation: "fadeUp 0.5s ease both",
          }}>
            <div className="logo-pulse" style={{
              width: 66, height: 66, borderRadius: 20, margin: "0 auto 16px",
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, animation: "pulse 3.5s ease-in-out infinite",
            }}>🏢</div>

            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.7px", textShadow: "0 2px 16px rgba(255,255,255,0.6)" }}>
              Office Tracker
            </h1>

            <p style={{ marginTop: 7, fontSize: 14.5, fontWeight: 600, color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              Select Your Portal
            </p>
            <p style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.2px", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              Choose a workspace gateway to sign in
            </p>
          </div>
        )}

        {/* ═══════════════ PORTAL GRID ═══════════════ */}
        {!selectedPortal && (
          <div style={{
            width: "100%", maxWidth: 980,
            position: "relative", zIndex: 2,
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "scale(0.97)" : "scale(1)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
          }}>
            <div className="portal-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
            }}>
              {PORTALS.map((portal, i) => (
                <PortalCard key={portal.id} portal={portal} index={i} onClick={() => selectPortal(portal)} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ LOGIN FORM ═══════════════ */}
        {selectedPortal && (
          <div style={{
            width: "100%", maxWidth: 430,
            position: "relative", zIndex: 2,
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "translateY(18px)" : "translateY(0)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
            animation: "fadeUp 0.4s ease both",
          }}>
            <div style={{
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              borderRadius: 22,
              padding: "32px 28px 26px",
              boxShadow: "0 32px 72px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1)",
            }}>

              {/* Inner Logo and Title like 2nd image */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: 16, margin: "0 auto 16px",
                  background: "#163333",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: "0 8px 16px rgba(22,51,51,0.2)",
                }}>🏢</div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>
                  Office Tracker
                </h1>
                <p style={{ marginTop: 6, fontSize: 13.5, color: "#64748B" }}>
                  Sign in to your <span style={{ fontWeight: 700, color: "#0F172A" }}>{selectedPortal.label}</span> account
                </p>
              </div>

              {/* Step */}
              {loading && step && (
                <div style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "9px 14px", marginBottom: 14, fontSize: 13, color: "#475569", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> {step}
                </div>
              )}

              {/* Success */}
              {success && (
                <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#059669", fontWeight: 500 }}>
                  {success}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#b91c1c", fontWeight: 500, whiteSpace: "pre-line", lineHeight: 1.6 }}>
                  {error}
                </div>
              )}

              {/* Index URL */}
              {indexUrl && (
                <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#b45309" }}>⚠️ Missing Firestore Index</p>
                  <a href={indexUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "#b45309", fontWeight: 600 }}>🔗 Create Index in Firebase →</a>
                </div>
              )}

              {/* Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input
                  type="email" placeholder="Email address" value={email}
                  onChange={e => setEmail(e.target.value)} disabled={loading} autoComplete="email"
                  style={{
                    padding: "14px 16px",
                    background: "#EEF2F6",
                    border: "none",
                    borderRadius: 12, fontSize: 14, color: "#0F172A", width: "100%",
                    transition: "box-shadow 0.15s",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} disabled={loading} autoComplete="current-password"
                    style={{
                      padding: "14px 44px 14px 16px",
                      background: "#EEF2F6",
                      border: "none",
                      borderRadius: 12, fontSize: 14, color: "#0F172A", width: "100%",
                      transition: "box-shadow 0.15s",
                    }}
                  />
                  {password && (
                    <button type="button" tabIndex={-1} onClick={() => setShowPassword(p => !p)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>

                {/* Remember */}
                <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} disabled={loading}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#163333", borderRadius: 4 }} />
                    <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>Remember me</span>
                  </label>
                </div>

                {/* Sign In */}
                <button type="submit" disabled={loading}
                  style={{
                    marginTop: 4, padding: "14px",
                    background: loading ? "#334155" : "#163333",
                    border: "none",
                    borderRadius: 12, fontSize: 15, fontWeight: 700,
                    color: "#ffffff", cursor: loading ? "not-allowed" : "pointer",
                    transition: "background 0.18s ease",
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#0f2323"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = loading ? "#334155" : "#163333"; }}
                >
                  {loading ? "Please wait…" : "Sign In"}
                </button>
                
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={handlePasswordReset} disabled={loading}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#D97706", fontSize: 13, fontWeight: 600, textDecoration: "underline", opacity: loading ? 0.5 : 1, padding: 0 }}>
                    Forgot Password?
                  </button>
                </div>
              </form>

              {/* Back */}
              <button className="back-btn" onClick={goBack} disabled={loading}
                style={{
                  marginTop: 12, width: "100%",
                  background: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 10, padding: "9px",
                  fontSize: 13, fontWeight: 600, color: "#475569",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}>
                ← Back to portals
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Portal Card (plain, clean, professional glassmorphism) ──────────────────
function PortalCard({
  portal, index, onClick,
}: {
  portal: (typeof PORTALS)[0];
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      className="portal-card"
      onClick={onClick}
      style={{
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.8)",
        borderRadius: 18,
        padding: "22px 20px 20px",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
        position: "relative",
        overflow: "hidden",
        animation: `cardIn 0.4s ease ${index * 0.05}s both`,
      }}
    >
      {/* Icon — neutral frosted circle, no color */}
      <div style={{
        width: 44, height: 44, borderRadius: 13,
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {portal.icon}
      </div>

      {/* Text */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.2px", marginBottom: 4 }}>
          {portal.label}
        </div>
        <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.45 }}>
          {portal.desc}
        </div>
      </div>

      {/* Arrow — clean white */}
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        width: 26, height: 26, borderRadius: 8,
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "#94A3B8", fontWeight: 700,
      }}>→</div>
    </button>
  );
}