import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function getTodayTeamAttendance() {
  const q = query(
    collection(db, "attendance"),
    where("date", "==", today())
  );

  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
