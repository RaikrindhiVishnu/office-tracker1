import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 mins

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch all leaveBalances
    const snapshot = await adminDb.collection("leaveBalances").get();
    
    const batch = adminDb.batch();
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const annual = data.annual || { quota: 15, used: 0, carriedForward: 0 };
      const casual = data.casual || { quota: 12, used: 0 };
      const sick = data.sick || { quota: 6, used: 0 };
      
      // Calculate remaining annual leave
      const remainingAnnual = Math.max(0, annual.quota - annual.used);
      
      // Max carry forward allowed (e.g., 5 days)
      const carryForwardAllowed = Math.min(remainingAnnual, 5);

      const newAnnualQuota = 15 + carryForwardAllowed; // 15 new days + carry forward

      batch.update(doc.ref, {
        "annual.quota": newAnnualQuota,
        "annual.used": 0,
        "annual.carriedForward": carryForwardAllowed,
        "casual.used": 0, // reset casual
        "sick.used": 0, // reset sick
      });
      
      // We also update user/employee document leaveBalance if we are keeping them in sync
      const uid = doc.data().uid;
      if (uid) {
        batch.update(adminDb.collection("employees").doc(uid), {
           "leaveBalance.annual": newAnnualQuota,
           "leaveBalance.casual": 12,
           "leaveBalance.sick": 6,
           "leaveBalance.compOff": 0
        }).catch(() => {}); // might not exist
        
        batch.update(adminDb.collection("users").doc(uid), {
           "leaveBalance.annual": newAnnualQuota,
           "leaveBalance.casual": 12,
           "leaveBalance.sick": 6,
           "leaveBalance.compOff": 0
        }).catch(() => {});
      }
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: `Processed carry forward for ${snapshot.size} users.` });

  } catch (error: any) {
    console.error("Leave carry forward error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
