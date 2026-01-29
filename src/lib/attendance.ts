import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Get today's attendance */
export async function getTodayAttendance(userId: string) {
  const id = `${userId}_${today()}`;
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Check In */
export async function checkIn(userId: string) {
  const id = `${userId}_${today()}`;
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);

  const now = Timestamp.now();

  // First check-in today
  if (!snap.exists()) {
    await setDoc(ref, {
      userId,
      date: today(),
      sessions: [
        {
          checkIn: now,
          checkOut: null,
          durationMinutes: 0,
        },
      ],
      totalMinutes: 0,
    });
    return;
  }

  const data: any = snap.data();
  const sessions = data.sessions || [];
  const last = sessions[sessions.length - 1];

  if (last && last.checkOut === null) {
    throw new Error("Already checked in");
  }

  await updateDoc(ref, {
    sessions: [
      ...sessions,
      {
        checkIn: now,
        checkOut: null,
        durationMinutes: 0,
      },
    ],
  });
}

/** Check Out */
export async function checkOut(userId: string) {
  const id = `${userId}_${today()}`;
  const ref = doc(db, "attendance", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("No check-in found for today");
  }

  const data: any = snap.data();
  const sessions = [...(data.sessions || [])];
  const last = sessions[sessions.length - 1];

  if (!last || last.checkOut !== null) {
    throw new Error("Already checked out");
  }

  const now = Timestamp.now();
  const durationMinutes = Math.floor(
    (now.toMillis() - last.checkIn.toMillis()) / 60000
  );

  last.checkOut = now;
  last.durationMinutes = durationMinutes;

  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0
  );

  await updateDoc(ref, {
    sessions,
    totalMinutes,
  });
}
