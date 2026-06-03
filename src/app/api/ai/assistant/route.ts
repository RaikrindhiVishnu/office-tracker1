// src/app/api/ai/assistant/route.ts

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminAuth } from "@/lib/firebaseAdmin";

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
    const { command } = body;

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Missing required string field: command" },
        { status: 400 }
      );
    }

    // 3. Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. Build Prompt
    const prompt = `
You are an intelligent office scheduling assistant. Your job is to parse a spoken command or text query from an employee and map it to a structured action.

List of supported actions:
1. "CHECK_IN" (mark attendance, check in)
2. "CHECK_OUT" (check out of work)
3. "APPLY_LEAVE" (submit a leave application)
4. "SHOW_TASKS" (navigating to tasks panel or board)
5. "SCHEDULE_MEETING" (open meeting scheduler)
6. "UNKNOWN" (if intent does not match the above)

Employee command:
"${command}"

Current Year: ${new Date().getFullYear()}

Return STRICTLY a JSON object with two fields:
- "action": One of the action names from the list above.
- "params": A JSON object containing parsed attributes (e.g. "fromDate" in YYYY-MM-DD format, "toDate" in YYYY-MM-DD format, "leaveType" like sick/casual/annual, "meetingWith" as string, "message" as string, or empty if no params).

Return JSON ONLY. No markdown code formatting, no extra sentences. Example:
{
  "action": "APPLY_LEAVE",
  "params": {
    "fromDate": "2026-06-03",
    "toDate": "2026-06-04",
    "leaveType": "casual",
    "reason": "Family function"
  }
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed;
    try {
      const cleanJson = text
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.error("[Gemini assistant error] Response text was:", text, e);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error("[Voice Assistant API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
