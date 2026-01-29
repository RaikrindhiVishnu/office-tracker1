import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function today() {
  return new Date().toISOString().split("T")[0];
}

export async function saveDailyUpdate(
  userId: string,
  task: string,
  notes: string
) {
  const id = `${userId}_${today()}`;
  await setDoc(
    doc(db, "dailyUpdates", id),
    {
      userId,
      date: today(),
      currentTask: task,
      notes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getTodayUpdate(userId: string) {
  const id = `${userId}_${today()}`;
  const snap = await getDoc(doc(db, "dailyUpdates", id));
  return snap.exists() ? snap.data() : null;
}
