import { NextResponse } from "next/server";

// ✅ Enable restriction ONLY in production
const IS_PROD = process.env.NODE_ENV === "production";

// Office public IP prefixes
const ALLOWED_IP_PREFIXES = [
  "106.222.233.", // Office Wi-Fi
];

export async function POST(req: Request) {
  // 🚧 LOCAL DEV: always allow
  if (!IS_PROD) {
    return NextResponse.json({ ok: true });
  }

  // 🌍 PROD: real IP check
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  const ip =
    (forwarded && forwarded.split(",")[0].trim()) ||
    realIp ||
    "";

  const allowed = ALLOWED_IP_PREFIXES.some((prefix) =>
    ip.startsWith(prefix)
  );

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "❌ Login blocked. You must be connected to Office Wi-Fi to log in.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
