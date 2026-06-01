import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminDb } from "@/lib/firebaseAdmin";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    // Fetch today's work updates
    const updatesRef = adminDb.collection("workUpdates");
    // To make it simple, we'll fetch recent updates (e.g., last 24-48 hours) 
    // since some folks might have posted late yesterday.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snap = await updatesRef.where("createdAt", ">=", oneDayAgo).get();

    if (snap.empty) {
      return NextResponse.json({ summary: "No work updates have been submitted by the team today." });
    }

    const updates = snap.docs.map(doc => doc.data());
    const updatesJson = JSON.stringify(updates, null, 2);

    const prompt = `
      You are an elite AI Manager for a software development team.
      Review the following structured work updates submitted by employees over the last 24 hours.

      Provide a concise, professional "Daily Manager Summary" that covers:
      1. What the team mainly focused on today (key projects/modules).
      2. Any major blockers or delays across the team.
      3. Any employees showing signs of stress, overload, or inactivity.
      4. A brief, high-level conclusion on team health.

      Format it cleanly using Markdown (bolding, bullet points). Keep it under 250 words. Do NOT include raw data or database IDs.
      
      Raw Updates Data:
      ${updatesJson}
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error("Error generating AI summary:", error);
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
  }
}
