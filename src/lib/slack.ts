import crypto from "crypto";

const SLACK_API_URL = "https://slack.com/api";

/**
 * Verifies that the incoming request actually came from Slack.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  reqBody: string,
  slackSignature: string | null,
  slackTimestamp: string | null
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !slackSignature || !slackTimestamp) {
    console.error("Slack signature verification missing secret or headers.");
    return false;
  }

  // Prevent replay attacks by checking if the request is older than 5 minutes
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(slackTimestamp, 10)) > 300) {
    console.error("Slack signature verification failed: Timestamp too old.");
    return false;
  }

  const sigBasestring = `v0:${slackTimestamp}:${reqBody}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", secret)
      .update(sigBasestring, "utf8")
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(slackSignature, "utf8")
  );
}

/**
 * Looks up a Slack user by their email address.
 */
export async function getSlackUserByEmail(email: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const url = new URL(`${SLACK_API_URL}/users.lookupByEmail`);
    url.searchParams.append("email", email);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await res.json();
    if (data.ok && data.user) {
      return data.user.id;
    } else {
      console.error(`Slack lookup failed for ${email}:`, data.error);
      return null;
    }
  } catch (err) {
    console.error("Error looking up Slack user:", err);
    return null;
  }
}

/**
 * Sends a direct message to a Slack user with the Stand-up Prompt blocks.
 */
export async function sendStandupPrompt(slackUserId: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return false;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Daily Stand-up ⏰",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Good morning! It's time for your daily work update. Please click the button below to log what you're working on today.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📝 Submit Daily Update",
            emoji: true,
          },
          style: "primary",
          action_id: "open_standup_modal",
        },
      ],
    },
  ];

  try {
    const res = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: slackUserId,
        blocks: blocks,
        text: "It's time for your daily work update!", // Fallback text
      }),
    });

    const data = await res.json();
    return data.ok;
  } catch (err) {
    console.error("Error sending Slack prompt:", err);
    return false;
  }
}

/**
 * Opens a Slack Modal for the user to submit their work update.
 */
export async function openStandupModal(triggerId: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return false;

  const view = {
    type: "modal",
    callback_id: "standup_modal_submit",
    title: {
      type: "plain_text",
      text: "Daily Work Update",
    },
    submit: {
      type: "plain_text",
      text: "Save Update",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "input",
        block_id: "task_block",
        element: {
          type: "plain_text_input",
          action_id: "task_input",
          placeholder: {
            type: "plain_text",
            text: "What are you working on?",
          },
        },
        label: {
          type: "plain_text",
          text: "Task",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "status_block",
        element: {
          type: "static_select",
          action_id: "status_input",
          placeholder: {
            type: "plain_text",
            text: "Select a status",
          },
          options: [
            { text: { type: "plain_text", text: "In Progress" }, value: "In Progress" },
            { text: { type: "plain_text", text: "Completed" }, value: "Completed" },
            { text: { type: "plain_text", text: "Blocked" }, value: "Blocked" },
            { text: { type: "plain_text", text: "Review" }, value: "Review" },
          ],
          initial_option: { text: { type: "plain_text", text: "In Progress" }, value: "In Progress" }
        },
        label: {
          type: "plain_text",
          text: "Status",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "priority_block",
        element: {
          type: "static_select",
          action_id: "priority_input",
          placeholder: {
            type: "plain_text",
            text: "Select priority",
          },
          options: [
            { text: { type: "plain_text", text: "Low" }, value: "Low" },
            { text: { type: "plain_text", text: "Medium" }, value: "Medium" },
            { text: { type: "plain_text", text: "High" }, value: "High" },
            { text: { type: "plain_text", text: "Urgent" }, value: "Urgent" },
          ],
          initial_option: { text: { type: "plain_text", text: "Medium" }, value: "Medium" }
        },
        label: {
          type: "plain_text",
          text: "Priority",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "notes_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Any notes, blockers, or next steps...",
          },
        },
        label: {
          type: "plain_text",
          text: "Notes / Progress",
          emoji: true,
        },
      },
    ],
  };

  try {
    const res = await fetch(`${SLACK_API_URL}/views.open`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: view,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("Error opening Slack modal:", data);
    }
    return data.ok;
  } catch (err) {
    console.error("Fetch error opening Slack modal:", err);
    return false;
  }
}
