"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!userData) {
        router.replace("/login");
        return;
      }

      const role = userData.accountType?.toUpperCase().trim();

      if (role !== "EMPLOYEE") {
        router.replace("/login");
      }
    }
  }, [userData, loading, router]);

  if (loading || !userData) return null;

  return <>{children}</>;
}
