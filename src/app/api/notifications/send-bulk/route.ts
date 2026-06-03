// src/app/api/notifications/send-bulk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
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

    // 2. Parse request body
    const body = await req.json();
    const { userIds, role, title, body: messageText, icon, data } = body;

    if (!title || !messageText) {
      return NextResponse.json(
        { error: "Missing required fields: title, body" },
        { status: 400 }
      );
    }

    // 3. Resolve target user UIDs
    let targetUids: string[] = [];

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      targetUids = userIds;
    } else if (role) {
      // Query users collection for this role
      const usersSnap = await adminDb
        .collection("users")
        .where("role", "==", role)
        .get();
      targetUids = usersSnap.docs.map((doc) => doc.id);
    } else {
      // Send to all users (warning: might be slow, chunk it or limit to active users)
      const usersSnap = await adminDb.collection("users").limit(100).get();
      targetUids = usersSnap.docs.map((doc) => doc.id);
    }

    if (targetUids.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users targeted.",
        successCount: 0,
      });
    }

    // 4. Collect all FCM tokens for targeted users
    const allTokens: string[] = [];
    const userTokensMap: Record<string, string[]> = {};

    const tokenPromises = targetUids.map(async (uid) => {
      const snap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("fcmTokens")
        .get();
      const tokens = snap.docs.map((d) => d.id);
      if (tokens.length > 0) {
        userTokensMap[uid] = tokens;
        allTokens.push(...tokens);
      }
    });

    await Promise.all(tokenPromises);

    if (allTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active device tokens found for targeted users.",
        successCount: 0,
      });
    }

    // 5. Send multicast in chunks of 500 (FCM multicast size limit)
    const chunkSize = 500;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (let i = 0; i < allTokens.length; i += chunkSize) {
      const chunk = allTokens.slice(i, i + chunkSize);
      const payload = {
        tokens: chunk,
        notification: {
          title,
          body: messageText,
          imageUrl: icon || undefined,
        },
        data: data || {},
        webpush: {
          notification: {
            icon: icon || "/logo.svg",
            badge: "/logo.svg",
          },
        },
      };

      const response = await adminMessaging.sendEachForMulticast(payload);
      totalSuccessCount += response.successCount;
      totalFailureCount += response.failureCount;
      
      // Dynamic log
      const logsBatch = adminDb.batch();
      chunk.forEach((tok, index) => {
        const result = response.responses[index];
        const logRef = adminDb.collection("notificationLogs").doc();
        logsBatch.set(logRef, {
          token: tok,
          title,
          success: result.success,
          error: result.success ? null : result.error?.message || "Unknown error",
          timestamp: new Date(),
        });
      });
      await logsBatch.commit();
    }

    return NextResponse.json({
      success: true,
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
    });
  } catch (error: any) {
    console.error("[FCM API Bulk] Send error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
