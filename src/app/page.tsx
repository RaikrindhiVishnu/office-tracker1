"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRoleRedirect } from "@/lib/roleRouting";

export default function HomePage() {
  const { userData, userRole, isSuperAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!userData) {
      router.replace("/login");
      return;
    }

    // Mobile users always go to the mobile companion
    const isMobile =
      window.innerWidth < 768 ||
      /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      router.replace("/mobile");
      return;
    }

    // Superadmin goes directly to superadmin panel
    if (isSuperAdmin) {
      router.replace("/admin");
      return;
    }

    // Use getRoleRedirect which handles department-based analytics routing
    // e.g. employee with department "sales" → /analytics/sales
    const accountType = (userData.accountType as string) || "";
    const department = (userData.department as string) || "";
    const destination = getRoleRedirect(
      userRole || accountType.toLowerCase(),
      department
    );

    router.replace(destination);
  }, [userData, userRole, isSuperAdmin, loading, router]);

  return null;
}
