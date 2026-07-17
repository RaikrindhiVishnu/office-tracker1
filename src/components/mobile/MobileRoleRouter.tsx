"use client";

import React, { Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { MobileDashboard } from "./MobileDashboard";
import { MobileAdminDashboard } from "./MobileAdminDashboard";
import { MobileHRDashboard } from "./MobileHRDashboard";

export function MobileRoleRouter() {
  const { userRole, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center font-bold text-gray-500 animate-pulse">Loading Dashboard...</div>
      </div>
    );
  }

  const isAdminView = isSuperAdmin || userRole === "admin" || userRole === "superadmin";

  if (userRole === "hr") {
    return <MobileHRDashboard />;
  }

  if (isAdminView) {
    return <MobileAdminDashboard />;
  }

  return <MobileDashboard />;
}
