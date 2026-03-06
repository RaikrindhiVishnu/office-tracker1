import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// POST /api/admin/set-claims
// Body: { uid, companyId, role, superAdmin? }
// This endpoint is called by:
//   - Migration script (bulk set claims for existing users)
//   - Phase 2: When adding a new employee (auto-called after creating account)

export async function POST(req: NextRequest) {
  try {
    // 🔒 Verify the request is from a Super Admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerToken = authHeader.replace("Bearer ", "");
    const callerClaims = await adminAuth.verifyIdToken(callerToken);

    if (!callerClaims.superAdmin) {
      return NextResponse.json(
        { error: "Only Super Admin can set claims" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { uid, companyId, role, superAdmin } = body;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    // Build claims object
    const claims: Record<string, any> = {};

    if (superAdmin === true) {
      // Setting a super admin — only sets superAdmin flag
      claims.superAdmin = true;
    } else {
      if (!companyId || !role) {
        return NextResponse.json(
          { error: "companyId and role are required for company users" },
          { status: 400 }
        );
      }
      claims.companyId = companyId;
      claims.role = role.toLowerCase();
      claims.superAdmin = false;
    }

    // Set claims on the Firebase Auth user
    await adminAuth.setCustomUserClaims(uid, claims);

    // Also update the user document to reflect the companyId
    if (!superAdmin && companyId) {
      // Update in new path
      const newPath = adminDb
        .collection("companies")
        .doc(companyId)
        .collection("users")
        .doc(uid);

      const snap = await newPath.get();
      if (snap.exists) {
        await newPath.update({ companyId, role: role.toLowerCase() });
      }

      // Also update old users/ path if it exists (migration window)
      const oldPath = adminDb.collection("users").doc(uid);
      const oldSnap = await oldPath.get();
      if (oldSnap.exists) {
        await oldPath.update({ companyId });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Claims set for user ${uid}`,
      claims,
    });
  } catch (err: any) {
    console.error("Error setting claims:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}