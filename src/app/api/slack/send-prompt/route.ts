import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getSlackUserByEmail, sendStandupPrompt } from "@/lib/slack";

// You can set this up as a Vercel cron job to run every weekday morning.
export async function GET(request: Request) {
  try {
    // 1. Authenticate the request (same logic as other scheduler routes)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const secret = process.env.SCHEDULER_SECRET;

    if (secret && token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all employees from Firestore
    const usersSnapshot = await adminDb
      .collection("users")
      .where("role", "==", "EMPLOYEE")
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ message: "No employees found." });
    }

    const results = {
      total: usersSnapshot.size,
      successCount: 0,
      failures: [] as string[],
    };

    // 3. Loop through employees and send Slack DMs
    // Process them sequentially or in batches to respect Slack API rate limits
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const email = userData.email;

      if (!email) continue;

      // Find the Slack user ID by their email
      const slackUserId = await getSlackUserByEmail(email);

      if (slackUserId) {
        // Send the interactive message via Block Kit
        const sent = await sendStandupPrompt(slackUserId);
        if (sent) {
          results.successCount++;
        } else {
          results.failures.push(`${email}: Failed to send message`);
        }
      } else {
        results.failures.push(`${email}: Not found in Slack`);
      }
    }

    return NextResponse.json({
      message: "Slack daily prompts completed",
      results,
    });

  } catch (error: any) {
    console.error("Error in Slack send-prompt:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
