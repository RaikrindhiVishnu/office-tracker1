"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isRoleAuthorized, getRoleRedirect, UserRole } from "@/lib/roleRouting";

// ── Types ─────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children      : ReactNode;
  /** Optional explicit allow-list. If omitted, path-based lookup is used. */
  allowedRoles ?: UserRole[];
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * ProtectedRoute
 *
 * Uses userRole from AuthContext (derived from accountType via normalizeRole).
 *
 * Usage — explicit roles:
 *   <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
 *     <AdminDashboard />
 *   </ProtectedRoute>
 *
 * Usage — automatic path-based check:
 *   <ProtectedRoute>
 *     <HrDashboard />
 *   </ProtectedRoute>
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps): JSX.Element | null {
  const { user, userRole, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Not authenticated → login
    if (!user) {
      router.replace("/login");
      return;
    }

    // Check authorization
    const authorized: boolean = allowedRoles
      ? allowedRoles.includes(userRole as UserRole)
      : isRoleAuthorized(userRole, pathname);

    if (!authorized) {
      // Redirect to the user's own home instead of a generic 403
      router.replace(getRoleRedirect(userRole));
    }
  }, [loading, user, userRole, pathname, allowedRoles, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

// ── Loading fallback ──────────────────────────────────────────────────────

function LoadingScreen(): JSX.Element {
  return (
    <div style={{
      display        : "flex",
      alignItems     : "center",
      justifyContent : "center",
      height         : "100vh",
      background     : "#0f172a",
      color          : "#94a3b8",
      fontFamily     : "'Inter', 'Segoe UI', sans-serif",
      fontSize       : "14px",
      gap            : "10px",
    }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
      Verifying access…
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}