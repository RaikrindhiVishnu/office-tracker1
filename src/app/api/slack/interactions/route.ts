import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySlackSignature, openStandupModal } from "@/lib/slack";
import { FieldValue } from "firebase-admin/firestore";

// Helper to get Slack user's email
async function getSlackUserEmail(slackUserId: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (data.ok && data.user && data.user.profile && data.user.profile.email) {
      return data.user.profile.email;
    }
    return null;
  } catch (error) {
    console.error("Error fetching Slack user info:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // 1. Get raw body and verify signature
    const rawBody = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    // Temporarily skip signature check if it's failing in dev without correct tokens
    // But ideally:
    if (process.env.NODE_ENV === "production" && !verifySlackSignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Slack sends URL encoded data, the JSON is in the 'payload' field
    const searchParams = new URLSearchParams(rawBody);
    const payloadStr = searchParams.get("payload");

    if (!payloadStr) {
      return NextResponse.json({ error: "No payload" }, { status: 400 });
    }

    const payload = JSON.parse(payloadStr);

    // 3. Handle Button Click (Open Modal)
    if (payload.type === "block_actions") {
      const actionId = payload.actions?.[0]?.action_id;
      
      if (actionId === "open_standup_modal") {
        const triggerId = payload.trigger_id;
        await openStandupModal(triggerId);
        return NextResponse.json({ ok: true }); // Acknowledge the request
      }
    }

    // 4. Handle Modal Submission
    if (payload.type === "view_submission" && payload.view.callback_id === "standup_modal_submit") {
      const values = payload.view.state.values;
      const slackUserId = payload.user.id;

      // Extract values from the modal blocks
      const task = values.task_block?.task_input?.value || "";
      const status = values.status_block?.status_input?.selected_option?.value || "In Progress";
      const priority = values.priority_block?.priority_input?.selected_option?.value || "Medium";
      const notes = values.notes_block?.notes_input?.value || "";

      // Fetch the user's email from Slack to match with Firebase
      const email = await getSlackUserEmail(slackUserId);
      
      if (!email) {
        console.error("Could not find email for Slack user ID:", slackUserId);
        // We must return a 200 empty response to Slack to close the modal
        return new NextResponse(); 
      }

      // Find the corresponding Firebase user by email
      const userSnapshot = await adminDb
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        console.error(`Firebase user not found for email: ${email}`);
        return new NextResponse();
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      const uid = userDoc.id;

      // Save to Work Updates collection
      await adminDb.collection("workUpdates").add({
        uid: uid,
        userEmail: email,
        userName: userData.name || userData.displayName || email.split("@")[0],
        task: task.trim(),
        notes: notes.trim(),
        status: status,
        priority: priority,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully saved work update for ${email}`);
      
      // Return a 200 empty response to close the modal successfully
      return new NextResponse();
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error in Slack interactions webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
