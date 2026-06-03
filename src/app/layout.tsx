import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import FcmInitializer from "@/components/FcmInitializer";
import { PWAInstallPrompt } from "@/components/notifications/PWAInstallPrompt";
import { NotificationPermissionRequest } from "@/components/notifications/NotificationPermissionRequest";
import { NotificationToastContainer } from "@/components/notifications/NotificationToast";
import Script from "next/script";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Office Tracker — Enterprise HR Platform",
  description: "Enterprise attendance, tasks, leaves, meetings & HR management platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Office Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        {/* Load Jitsi Script Globally */}
        <Script
          src="https://meet.jit.si/external_api.js"
          strategy="afterInteractive"
        />

        <AuthProvider>
          <NotificationProvider>
            <FcmInitializer />
            <NotificationToastContainer />
            <PWAInstallPrompt />
            <NotificationPermissionRequest />
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}