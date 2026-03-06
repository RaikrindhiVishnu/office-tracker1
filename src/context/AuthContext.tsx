"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  userData: any;
  loading: boolean;
  isSuperAdmin: boolean;
  companyId: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isSuperAdmin: false,
  companyId: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  // ✅ Start as true — don't assume anything until Firebase responds
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous Firestore listener
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        // ✅ Logged out — clear everything and stop loading
        setUserData(null);
        setIsSuperAdmin(false);
        setCompanyId(null);
        setLoading(false);
        return;
      }

      // ✅ User is logged in — keep loading=true until Firestore data arrives
      try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const claims = tokenResult.claims;

        const superAdmin = claims.superAdmin === true;
        const claimCompanyId = (claims.companyId as string) || null;

        setIsSuperAdmin(superAdmin);
        setCompanyId(claimCompanyId);

        if (superAdmin) {
          const ref = doc(db, "superAdmin", firebaseUser.uid);
          unsubFirestore = onSnapshot(
            ref,
            (snap) => {
              if (snap.exists()) {
                setUserData({ ...snap.data(), accountType: "SUPERADMIN" });
              } else {
                setUserData({ accountType: "SUPERADMIN", email: firebaseUser.email });
              }
              // ✅ Only set loading=false AFTER userData is set
              setLoading(false);
            },
            (err) => {
              console.warn("SuperAdmin listener error:", err.message);
              setUserData({ accountType: "SUPERADMIN", email: firebaseUser.email });
              setLoading(false);
            }
          );

        } else if (claimCompanyId) {
          const ref = doc(db, "companies", claimCompanyId, "users", firebaseUser.uid);
          unsubFirestore = onSnapshot(
            ref,
            (snap) => {
              if (snap.exists()) {
                setUserData(snap.data());
                setLoading(false);
              } else {
                // Fallback to old users/ path
                const oldRef = doc(db, "users", firebaseUser.uid);
                if (unsubFirestore) unsubFirestore();
                unsubFirestore = onSnapshot(
                  oldRef,
                  (oldSnap) => {
                    setUserData(oldSnap.exists() ? oldSnap.data() : null);
                    setLoading(false);
                  },
                  (err) => {
                    console.warn("Old path listener error:", err.message);
                    setLoading(false);
                  }
                );
              }
            },
            (err) => {
              console.warn("New path listener error:", err.message);
              const oldRef = doc(db, "users", firebaseUser.uid);
              if (unsubFirestore) unsubFirestore();
              unsubFirestore = onSnapshot(
                oldRef,
                (oldSnap) => {
                  setUserData(oldSnap.exists() ? oldSnap.data() : null);
                  setLoading(false);
                },
                () => setLoading(false)
              );
            }
          );

        } else {
          // No companyId claim — use old users/ path
          const ref = doc(db, "users", firebaseUser.uid);
          unsubFirestore = onSnapshot(
            ref,
            (snap) => {
              if (snap.exists()) {
                setUserData(snap.data());
              } else {
                console.warn("User doc missing in Firestore!");
                setUserData(null);
              }
              // ✅ Always set loading=false after Firestore responds
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
        // ✅ Even on error, stop loading so UI doesn't hang
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, isSuperAdmin, companyId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}