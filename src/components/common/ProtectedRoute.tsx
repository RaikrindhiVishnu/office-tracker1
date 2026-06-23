"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FullPageLoader from "./FullPageLoader";

type Props = {
  children: React.ReactNode;
  allowedRoles?: string[]; // ✅ NEW
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: Props) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // ❌ Not logged in
      if (!user) {
        router.push("/login");
        return;
      }

      // ❌ Role not allowed
      if (allowedRoles && userData?.role) {
        if (!allowedRoles.includes(userData.role)) {
          router.push("/unauthorized"); // or dashboard
        }
      }
    }
  }, [user, userData, loading, allowedRoles, router]);

  if (loading) return <FullPageLoader />;
  if (!user) return null;

  return <>{children}</>;
}