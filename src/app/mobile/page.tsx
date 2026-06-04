import { MobileRoleRouter } from "@/components/mobile/MobileRoleRouter";
import { Suspense } from "react";

export default function MobilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center font-bold text-gray-500 animate-pulse">Loading Mobile Dashboard...</div>
      </div>
    }>
      <MobileRoleRouter />
    </Suspense>
  );
}
