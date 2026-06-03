// src/app/api/cron/notifications/route.ts

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    // 1. Optional auth: Verify CRON_SECRET if present in env
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In development or when header is missing, we can bypass or log
      console.warn("[Cron] Unauthorized cron invocation attempt.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    console.log(`[Cron] Executing scheduled notifications worker at: ${now.toISOString()}`);

    // 2. Query pending notifications scheduled for <= now
    const querySnapshot = await adminDb
      .collection("scheduledNotifications")
      .where("status", "==", "pending")
      .where("scheduledFor", "<=", now)
      .limit(100) // Batch of 100 at a time
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No pending scheduled notifications to send.",
        processedCount: 0,
      });
    }

    console.log(`[Cron] Found ${querySnapshot.size} pending notifications to process.`);

    const processingPromises = querySnapshot.docs.map(async (scheduledDoc) => {
      const data = scheduledDoc.data();
      const notifId = scheduledDoc.id;

      try {
        // A. Insert into users' active notifications collection
        const notifRef = adminDb.collection("notifications").doc();
        await notifRef.set({
          userId: data.userId,
          type: data.type || "info",
          title: data.title,
          message: data.message,
          isRead: false,
          category: data.category || "system",
          event: data.event || "SYSTEM_GENERAL",
          priority: data.priority || "medium",
          clickAction: data.clickAction || "",
          actionButtons: data.actionButtons || [],
          imageUrl: data.imageUrl || "",
          createdAt: new Date(),
        });

        // B. Fetch user FCM tokens
        const tokensSnap = await adminDb
          .collection("users")
          .doc(data.userId)
          .collection("fcmTokens")
          .get();

        let pushSuccess = false;
        if (!tokensSnap.empty) {
          const tokens = tokensSnap.docs.map((d) => d.id);
          const payload = {
            tokens,
            notification: {
              title: data.title,
              body: data.message,
              imageUrl: data.imageUrl || undefined,
            },
            data: {
              category: data.category || "system",
              priority: data.priority || "medium",
              clickAction: data.clickAction || "",
              notifId: notifRef.id,
              actionButtons: data.actionButtons ? JSON.stringify(data.actionButtons) : "",
            },
            webpush: {
              notification: {
                icon: data.imageUrl || "/logo.svg",
                badge: "/logo.svg",
              },
            },
          };

          const response = await adminMessaging.sendEachForMulticast(payload);
          pushSuccess = response.successCount > 0;
          console.log(`[Cron] FCM dispatched to ${response.successCount} devices for notification ${notifId}`);
        } else {
          console.log(`[Cron] User ${data.userId} has no registered device tokens. In-app notice created only.`);
        }

        // C. Update status to sent
        await scheduledDoc.ref.update({
          status: "sent",
          sentAt: new Date(),
          activeNotificationId: notifRef.id,
          pushDispatched: pushSuccess,
        });

      } catch (e: any) {
        console.error(`[Cron] Error processing scheduled notification ${notifId}:`, e);
        await scheduledDoc.ref.update({
          status: "failed",
          error: e.message || "Unknown processing error",
          failedAt: new Date(),
        });
      }
    });

    await Promise.all(processingPromises);

    return NextResponse.json({
      success: true,
      processedCount: querySnapshot.size,
    });
  } catch (error: any) {
    console.error("[Cron API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
