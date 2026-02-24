import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Script from "next/script";

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

        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}