// src/app/api/notifications/schedule/route.ts

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

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
    const { userId, type, title, message, category, event, priority, clickAction, actionButtons, imageUrl, scheduledFor } = body;

    if (!userId || !title || !message || !scheduledFor) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, message, scheduledFor" },
        { status: 400 }
      );
    }

    // 3. Write to scheduledNotifications collection
    const parsedDate = new Date(scheduledFor);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledFor date format" },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection("scheduledNotifications").add({
      userId,
      type: type || "info",
      title,
      message,
      category: category || "system",
      event: event || "SYSTEM_GENERAL",
      priority: priority || "medium",
      clickAction: clickAction || "",
      actionButtons: actionButtons || [],
      imageUrl: imageUrl || "",
      scheduledFor: parsedDate,
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "Notification scheduled successfully",
    });
  } catch (error: any) {
    console.error("[FCM API Schedule] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
