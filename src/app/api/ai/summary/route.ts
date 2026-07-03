import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const { reportData } = await req.json();
    if (!reportData) {
      return NextResponse.json({ error: "No report data provided" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Stringify the data to provide as context.
    const dataContext = JSON.stringify(reportData, null, 2);

    const prompt = `
You are an HR daily reporting assistant. Analyze the provided Office Tracker daily report data and generate one concise, professional management summary. Highlight attendance, workforce availability, work progress, completed work, blocked or overdue tasks, missing updates, and issues requiring attention. Use only the supplied data. Do not invent employee activity, task status, numbers, or project risks. Keep the summary between 100 and 180 words.

Data Context:
${dataContext}
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Error generating AI summary:", error);
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
  }
}
