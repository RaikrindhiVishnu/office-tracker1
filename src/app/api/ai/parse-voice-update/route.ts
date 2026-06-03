// src/app/api/ai/parse-voice-update/route.ts

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
    const { transcript } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing required string field: transcript" },
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
    // Use the latest gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. Build prompt
    const prompt = `
You are an advanced HR and project management AI. Your task is to analyze a spoken daily work standup update (transcript) and organize it into a structured, clean, professional JSON format.
The user speaks naturally, potentially with repetitions, filler words, or disorganized sentences. Filter out filler words (um, uh, like, etc.) and construct clear bullet points.

Speech Transcript:
"${transcript}"

Format the response strictly as a JSON object with exactly three array fields:
- "completed" (array of strings, tasks finished today)
- "pending" (array of strings, tasks started but blocked or incomplete)
- "plan" (array of strings, tasks planned for tomorrow/next working day)

Response format MUST be a valid JSON object only. Do NOT include markdown code blocks or any extra text. Example:
{
  "completed": ["Completed API integration for notifications", "Fixed navigation bar alignment on mobile"],
  "pending": ["FCM token registration debug (blocked by permission status check)"],
  "plan": ["Write unit tests for send-bulk API endpoint", "Create mobile dashboard view component"]
}
`;

    // 5. Call Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Parse response
    let parsedData;
    try {
      // Clean up markdown code block wrapper if present
      const cleanJson = responseText
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("[Gemini parse error] Response text was:", responseText, parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response into structured JSON", raw: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        completed: parsedData.completed || [],
        pending: parsedData.pending || [],
        plan: parsedData.plan || [],
      },
    });
  } catch (error: any) {
    console.error("[Voice AI API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
