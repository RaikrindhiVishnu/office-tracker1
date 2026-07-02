"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import ChatBot from "@/components/ChatBot";

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

      const role = (userData.accountType || userData.role || "").toString().trim().toUpperCase();

      // Allow EMPLOYEE, LEAD, and department-based roles that use the employee dashboard
      const allowedEmployeeRoles = ["EMPLOYEE", "LEAD", "FINANCE", "SALES", "IT", "OPERATIONS", "MARKETING", "EXECUTIVE", "CUSTOMERSUPPORT", "CUSTOMER_SUPPORT"];
      
      if (!allowedEmployeeRoles.includes(role)) {
        router.replace("/login");
      }
    }
  }, [userData, loading, router]);

  if (loading || !userData) return null;

  return (
    <>
      {children}
      <ChatBot />
    </>
  );
}
