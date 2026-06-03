import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetUserId, title, body: messageBody, category, priority, clickAction, actionButtons } = body;

    if (!targetUserId || !title || !messageBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Save Notification to Firestore
    const notifRef = adminDb.collection("notifications").doc();
    await notifRef.set({
      userId: targetUserId,
      title,
      message: messageBody,
      category: category || "system",
      priority: priority || "low",
      clickAction: clickAction || "/mobile",
      actionButtons: actionButtons || [],
      isRead: false,
      createdAt: new Date(),
    });

    // 2. Fetch User's FCM Tokens
    const tokensSnapshot = await adminDb.collection("users").doc(targetUserId).collection("fcmTokens").get();
    
    if (tokensSnapshot.empty) {
      // User has no registered devices, so we just saved it to Firestore (in-app notification)
      return NextResponse.json({ success: true, pushSent: false, message: "Saved to DB, but no active devices to push to." });
    }

    const tokens: string[] = [];
    tokensSnapshot.forEach((doc) => {
      tokens.push(doc.data().token);
    });

    // 3. Send Push Notification via FCM
    const messagePayload = {
      notification: {
        title,
        body: messageBody,
      },
      data: {
        category: category || "system",
        priority: priority || "low",
        clickAction: clickAction || "/mobile",
        actionButtons: actionButtons ? JSON.stringify(actionButtons) : "",
      },
      tokens: tokens,
    };

    const response = await adminMessaging.sendEachForMulticast(messagePayload);
    
    // 4. Cleanup stale tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // Delete failed tokens from Firestore
      if (failedTokens.length > 0) {
        const batch = adminDb.batch();
        failedTokens.forEach((token) => {
          const ref = adminDb.collection("users").doc(targetUserId).collection("fcmTokens").doc(token);
          batch.delete(ref);
        });
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      pushSent: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
