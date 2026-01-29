import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function ensureUserProfile(
  uid: string,
  email: string
) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email,
      role: "EMPLOYEE", // default role
      createdAt: serverTimestamp(),
    });
  }

  return snap.exists() ? snap.data() : { role: "EMPLOYEE" };
}
