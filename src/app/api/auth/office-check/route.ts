import { NextResponse } from "next/server";

// ✅ Office Wi-Fi IP prefix (Airtel Hyderabad)
const OFFICE_IP_PREFIX = "106.222.233.";

export async function POST(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  const ip =
    (forwarded && forwarded.split(",")[0]) ||
    realIp ||
    "";

  // 🔒 Block if not office Wi-Fi
  if (!ip.startsWith(OFFICE_IP_PREFIX)) {
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
