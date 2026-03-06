"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // ✅ Wait until loading is fully done AND userData has been attempted
    if (loading) return;

    if (!userData) {
      router.replace("/login");
      return;
    }

    const role = userData.accountType?.toString().trim().toUpperCase();

    // ✅ Also allow SUPERADMIN to access admin panel if needed
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      router.replace("/login");
    }
  }, [userData, loading, router]);

  // ✅ Show loading spinner while auth is resolving
  //    This prevents the flash-redirect during the Firestore fetch window
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ✅ Don't render children at all if role is wrong
  const role = userData?.accountType?.toString().trim().toUpperCase();
  if (!userData || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    return null;
  }

  return <>{children}</>;
}