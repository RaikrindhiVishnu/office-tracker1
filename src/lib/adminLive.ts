import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

/* ---------- Helpers ---------- */
function today() {
  return new Date().toISOString().split("T")[0];
}

/* ---------- Live Online Employees ---------- */
export async function getLiveOnlineEmployees() {
  // 🔒 HARD SAFETY CHECK
  if (!auth.currentUser) {
    return [];
  }

  try {
    const attendanceQ = query(
      collection(db, "attendance"),
      where("date", "==", today())
    );

    const attendanceSnap = await getDocs(attendanceQ);

    const onlineUsers: {
      userId: string;
      checkIn: any;
    }[] = [];

    attendanceSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const sessions = data.sessions || [];
      const last = sessions[sessions.length - 1];

      // 🟢 Online = checked in but not checked out
      if (last && last.checkOut === null) {
        onlineUsers.push({
          userId: data.userId,
          checkIn: last.checkIn,
        });
      }
    });

    return onlineUsers;
  } catch (error) {
    console.error(
      "Failed to load live online employees:",
      error
    );
    return [];
  }
}
