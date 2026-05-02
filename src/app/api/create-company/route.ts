import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

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
        { error: "Only Super Admin can create companies" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, plan, industry, country } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1️⃣ Create Company Document
    const companyRef = adminDb.collection("companies").doc();
    const companyId = companyRef.id;

    await companyRef.set({
      id: companyId,
      name,
      plan: plan || "free",
      industry: industry || "Other",
      country: country || "India",
      ownerEmail: email,
      status: "active",
      createdAt: new Date().toISOString(),
      employees: 1, // The admin
      mrr: plan === "enterprise" ? 4999 : plan === "pro" ? 999 : 0,
    });

    // 2️⃣ Create Admin User in Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: "Admin",
    });

    // 3️⃣ Set Custom Claims
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      companyId,
      role: "admin",
      superAdmin: false,
    });

    // 4️⃣ Create User Document in Company Subcollection
    await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("users")
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        email,
        name: "Admin",
        role: "admin",
        accountType: "ADMIN",
        companyId,
        createdAt: new Date().toISOString(),
      });

    // Also add to global users collection for legacy/lookup purposes
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name: "Admin",
      role: "admin",
      accountType: "ADMIN",
      companyId,
      createdAt: new Date().toISOString(),
    });

    // 5️⃣ Log Activity
    await adminDb.collection("audit_logs").add({
      action: "Company Created",
      target: name,
      actor: "Super Admin",
      actorUid: callerClaims.uid,
      time: new Date().toISOString(),
      type: "create",
    });

    return NextResponse.json({ success: true, companyId, adminUid: userRecord.uid });
  } catch (error: any) {
    console.error("Create company error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
