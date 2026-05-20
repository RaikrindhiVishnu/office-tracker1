import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller
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
    } catch (authError) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    const body = await req.json();
    const { userId, title, body: messageText, icon, data } = body;

    if (!userId || !title || !messageText) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 }
      );
    }

    // 3. Fetch FCM tokens for the targeted user
    const tokensSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("fcmTokens")
      .get();

    if (tokensSnapshot.empty) {
      console.warn(`[FCM API] No registered tokens for user ${userId}. Employee must log in and grant notification permission first.`);
      return NextResponse.json({
        success: true,
        successCount: 0,
        failureCount: 0,
        message: "No registered tokens found for this user",
      });
    }

    const tokens = tokensSnapshot.docs.map((doc) => doc.id);
    console.log(`[FCM API] Sending to ${tokens.length} token(s) for user ${userId}`);

    // 4. Send multicast message
    const payload = {
      tokens,
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

    // 5. Clean up invalid/expired registration tokens
    const tokensToRemove: Promise<any>[] = [];
    response.responses.forEach((res, index) => {
      if (!res.success) {
        const errorCode = res.error?.code;
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          const badToken = tokens[index];
          const badTokenDoc = adminDb
            .collection("users")
            .doc(userId)
            .collection("fcmTokens")
            .doc(badToken);
          tokensToRemove.push(badTokenDoc.delete());
        }
      }
    });

    if (tokensToRemove.length > 0) {
      await Promise.all(tokensToRemove);
      console.log(`[FCM API] Cleaned up ${tokensToRemove.length} expired/invalid registration tokens.`);
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("[FCM API] Send push error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
