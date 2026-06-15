import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Auto-checkout for anyone who hasn't checked out today
    const attendanceRef = adminDb.collection("attendance");
    const q = attendanceRef.where("date", "==", todayStr);
    const snap = await q.get();

    let checkedOutCount = 0;

    const batch = adminDb.batch();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const sessions = data.sessions || [];
      if (sessions.length === 0) return;

      const last = sessions[sessions.length - 1];
      if (!last.checkOut) {
        // Bounding logic for 10 AM to 7 PM
        const checkInDate = last.checkIn.toDate();
        const endOfShift = new Date(checkInDate);
        endOfShift.setHours(19, 0, 0, 0);

        const startOfShift = new Date(checkInDate);
        startOfShift.setHours(10, 0, 0, 0);

        const effectiveStart = new Date(Math.max(checkInDate.getTime(), startOfShift.getTime()));
        const effectiveEnd = endOfShift; 
        
        let durationMinutes = 0;
        if (effectiveEnd > effectiveStart) {
          durationMinutes = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 60000);
        }

        last.checkOut = endOfShift;
        last.durationMinutes = durationMinutes;

        const totalMinutes = sessions.reduce((sum: number, s: any) => sum + (s.durationMinutes || 0), 0);

        batch.update(docSnap.ref, {
          sessions,
          totalMinutes
        });
        
        // Update user status
        batch.update(adminDb.collection("users").doc(data.userId), { status: "OFFLINE" });
        
        checkedOutCount++;
      }
    });

    if (checkedOutCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, message: `Auto-checked out ${checkedOutCount} users.` });
  } catch (error: any) {
    console.error("Auto-checkout cron failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
