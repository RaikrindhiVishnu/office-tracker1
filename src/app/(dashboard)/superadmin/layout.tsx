"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperAdmin, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/superadmin/login";

  useEffect(() => {
    if (loading) return;
    if (isLoginPage) return;
    if (!user || !isSuperAdmin) {
      router.replace("/superadmin/login");
    }
  }, [isSuperAdmin, loading, user, isLoginPage, router]);

  // Always render login page without any guard
  if (isLoginPage) return <>{children}</>;

  // For dashboard pages — wait for auth
  if (loading || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 text-xl">👑</span>
          <span className="font-bold text-lg tracking-wide">
            Super Admin — Platform Control
          </span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
          TechGy SaaS Platform
        </span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}