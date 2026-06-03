// src/app/api/notifications/analytics/route.ts

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Authorization header" },
        { status: 401 }
      );
    }
    const idToken = authHeader.split(" ")[1];
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // 2. Fetch Active Devices count
    const tokensGroupSnap = await adminDb.collectionGroup("fcmTokens").get();
    const activeDevicesCount = tokensGroupSnap.size;

    // 3. Fetch Notifications count & stats
    const notificationsSnap = await adminDb.collection("notifications").get();
    const totalNotifications = notificationsSnap.size;

    let readCount = 0;
    const categoryStats: Record<string, number> = {};
    const priorityStats: Record<string, number> = {};

    notificationsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.isRead) readCount++;
      
      const cat = data.category || "system";
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;

      const pri = data.priority || "medium";
      priorityStats[pri] = (priorityStats[pri] || 0) + 1;
    });

    const openRate = totalNotifications > 0 ? (readCount / totalNotifications) * 100 : 0;

    // 4. Fetch Delivery logs stats
    const logsSnap = await adminDb.collection("notificationLogs").limit(1000).get();
    let successCount = 0;
    let failureCount = 0;

    logsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.success) successCount++;
      else failureCount++;
    });

    const totalLogs = successCount + failureCount;
    const deliveryRate = totalLogs > 0 ? (successCount / totalLogs) * 100 : 100;

    // 5. Build dynamic charts format
    const categoryData = Object.entries(categoryStats).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    const priorityData = Object.entries(priorityStats).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));

    return NextResponse.json({
      success: true,
      stats: {
        activeDevicesCount,
        totalNotifications,
        openRate: Math.round(openRate * 10) / 10,
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        successCount,
        failureCount,
      },
      charts: {
        categoryData,
        priorityData,
      },
    });
  } catch (error: any) {
    console.error("[FCM API Analytics] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
