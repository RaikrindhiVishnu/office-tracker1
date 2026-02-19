"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!userData) {
      router.replace("/login");
      return;
    }

    if (userData.role === "ADMIN") {
      router.replace("/admin");
    } else if (userData.role === "EMPLOYEE") {
      router.replace("/employee");
    } else {
      router.replace("/login");
    }
  }, [userData, loading, router]);

  return null;
}
