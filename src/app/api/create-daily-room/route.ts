import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { roomName } = await req.json();

  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        max_participants: 10,
        enable_chat: true,
      },
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}