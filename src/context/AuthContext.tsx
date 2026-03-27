"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { getRoleRedirect, UserRole } from "@/lib/roleRouting";

// ── Types ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid?               : string;
  email?             : string;
  name?              : string;
  accountType?       : string; // "EMPLOYEE" | "ADMIN" | "SUPERADMIN" | "BUSINESSOWNER" | "HR" | ...
  role?              : UserRole;
  companyId?         : string;
  mustChangePassword?: boolean;
  [key: string]      : unknown;
}

type AuthContextType = {
  user         : User | null;
  userData     : UserProfile | null;
  userRole     : UserRole | null;   // ← NEW: normalized role for ProtectedRoute & routing
  loading      : boolean;
  isSuperAdmin : boolean;
  companyId    : string | null;
  logout       : () => Promise<void>; // ← NEW: centralized logout
};

// ── Normalize accountType → UserRole ─────────────────────────────────────
// Maps your existing accountType strings to the UserRole union.
export function normalizeRole(accountType?: string): UserRole | null {
  switch ((accountType ?? "").toUpperCase()) {
    case "SUPERADMIN":     return "superadmin";
    case "ADMIN":          return "admin";
    case "BUSINESSOWNER":
    case "BUSINESS_OWNER": return "admin"; // routes to /admin — add "businessowner" to UserRole if you need a separate dashboard
    case "HR":             return "hr";
    case "FINANCE":        return "finance";
    case "SALES":          return "sales";
    case "IT":             return "it";
    case "OPERATIONS":     return "operations";
    case "MARKETING":      return "marketing";
    case "EXECUTIVE":      return "executive";
    case "EMPLOYEE":       return "employee";
    default:               return null;
  }
}

// ── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user         : null,
  userData     : null,
  userRole     : null,
  loading      : true,
  isSuperAdmin : false,
  companyId    : null,
  logout       : async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user,         setUser]         = useState<User | null>(null);
  const [userData,     setUserData]     = useState<UserProfile | null>(null);
  const [userRole,     setUserRole]     = useState<UserRole | null>(null);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [companyId,    setCompanyId]    = useState<string | null>(null);

  // ── Apply userData and derive role in one call ─────────────────────────
  function applyUserData(data: UserProfile | null): void {
    setUserData(data);
    setUserRole(normalizeRole(data?.accountType));
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    await signOut(auth);
    // State is cleared automatically by the onAuthStateChanged listener below
  }

  // ── Auth state listener ─────────────────────────────────────────────────
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous Firestore listener whenever auth state changes
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        // Logged out — clear everything
        applyUserData(null);
        setIsSuperAdmin(false);
        setCompanyId(null);
        setLoading(false);
        return;
      }

      // Stay in loading=true until Firestore data arrives
      try {
        const tokenResult  = await firebaseUser.getIdTokenResult(true);
        const claims       = tokenResult.claims;
        const superAdmin   = claims.superAdmin === true;
        const claimCompany = (claims.companyId as string) || null;

        setIsSuperAdmin(superAdmin);
        setCompanyId(claimCompany);

        // ── SUPERADMIN ───────────────────────────────────────────────────
        if (superAdmin) {
          const ref = doc(db, "superAdmin", firebaseUser.uid);
          unsubFirestore = onSnapshot(
            ref,
            (snap) => {
              const data: UserProfile = snap.exists()
                ? { ...snap.data(), accountType: "SUPERADMIN" }
                : { accountType: "SUPERADMIN", email: firebaseUser.email ?? undefined };
              applyUserData(data);
              setLoading(false);
            },
            (err) => {
              console.warn("SuperAdmin listener error:", err.message);
              applyUserData({ accountType: "SUPERADMIN", email: firebaseUser.email ?? undefined });
              setLoading(false);
            }
          );

        // ── Company user (new path) ──────────────────────────────────────
        } else if (claimCompany) {
          const newRef = doc(db, "companies", claimCompany, "users", firebaseUser.uid);

          unsubFirestore = onSnapshot(
            newRef,
            (snap) => {
              if (snap.exists()) {
                applyUserData(snap.data() as UserProfile);
                setLoading(false);
              } else {
                // Fallback → legacy users/{uid} path
                const oldRef = doc(db, "users", firebaseUser.uid);
                if (unsubFirestore) unsubFirestore();
                unsubFirestore = onSnapshot(
                  oldRef,
                  (oldSnap) => {
                    applyUserData(oldSnap.exists() ? (oldSnap.data() as UserProfile) : null);
                    setLoading(false);
                  },
                  (err) => {
                    console.warn("Legacy path listener error:", err.message);
                    setLoading(false);
                  }
                );
              }
            },
            (err) => {
              console.warn("Company path listener error:", err.message);
              const oldRef = doc(db, "users", firebaseUser.uid);
              if (unsubFirestore) unsubFirestore();
              unsubFirestore = onSnapshot(
                oldRef,
                (oldSnap) => {
                  applyUserData(oldSnap.exists() ? (oldSnap.data() as UserProfile) : null);
                  setLoading(false);
                },
                () => setLoading(false)
              );
            }
          );

        // ── Legacy users/{uid} path ──────────────────────────────────────
        } else {
          const ref = doc(db, "users", firebaseUser.uid);
          unsubFirestore = onSnapshot(
            ref,
            (snap) => {
              if (snap.exists()) {
                applyUserData(snap.data() as UserProfile);
              } else {
                console.warn("User doc missing in Firestore!");
                applyUserData(null);
              }
              setLoading(false);
            },
            (err) => {
              console.warn("Auth listener error:", err.message);
              setLoading(false);
            }
          );
        }

      } catch (err) {
        console.warn("Token fetch error:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      userRole,
      loading,
      isSuperAdmin,
      companyId,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}