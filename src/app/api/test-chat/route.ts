import { NextResponse } from "next/server";
import { POST as chatPOST } from "../chat/route";

export async function GET() {
  try {
    const mockRequest = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "hello",
        history: [],
        context: {
          userName: "testUser",
          uid: "testUid"
        }
      })
    });
    const res = await chatPOST(mockRequest);
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
