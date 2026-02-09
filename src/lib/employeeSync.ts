import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

import { Employee } from "@/types/Employee";
import { EmployeeNotification } from "@/types/EmployeeNotification";

/* =====================================================
   UPDATE EMPLOYEE
===================================================== */

type UpdateEmployeeParams = {
  userId: string;
  updates: Partial<Employee>;
  updatedBy: string;
  role: string;
};

export async function updateEmployeeData({
  userId,
  updates,
  updatedBy,
  role,
}: UpdateEmployeeParams): Promise<void> {
  if (!userId) {
    throw new Error("updateEmployeeData: userId is undefined");
  }

  const userRef = doc(db, "users", userId);

  // 🔥 Get existing data to detect changes
  const existingSnap = await getDoc(userRef);
  const existingData = existingSnap.data() as Employee | undefined;

  const changedFields = Object.keys(updates).filter(
    (key) => existingData?.[key as keyof Employee] !== updates[key as keyof Employee]
  );

  // ✅ Update employee safely
  await updateDoc(userRef, {
    ...updates,
    lastUpdated: serverTimestamp(),
  });

  // 🔥 Notify admins ONLY if something actually changed
  if (changedFields.length > 0 && existingData?.name) {
    await notifyAdminsOfEmployeeUpdate(
      userId,
      existingData.name,
      changedFields
    );
  }
}


/* =====================================================
   REALTIME EMPLOYEE LISTENER
===================================================== */

export function subscribeToEmployeeData(
  userId: string,
  callback: (data: Employee | null) => void
): () => void {
  if (!userId) return () => {};

  return onSnapshot(doc(db, "users", userId), (snapshot) => {
    callback(
      snapshot.exists()
        ? ({
            id: snapshot.id,
            ...(snapshot.data() as Omit<Employee, "id">),
          })
        : null
    );
  });
}

/* =====================================================
   ADMIN NOTIFICATION LISTENER
===================================================== */

export function subscribeToNotifications(
  adminId: string,
  callback: (notifications: EmployeeNotification[]) => void
): () => void {
  if (!adminId) return () => {};

  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", adminId),
    where("read", "==", false)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications: EmployeeNotification[] =
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<EmployeeNotification, "id">),
      }));

    callback(notifications);
  });
}

/* =====================================================
   CREATE ADMIN NOTIFICATIONS
===================================================== */

export async function notifyAdminsOfEmployeeUpdate(
  employeeId: string,
  employeeName: string,
  changedFields: string[]
): Promise<void> {
  const adminQuery = query(
    collection(db, "users"),
    where("role", "==", "admin")
  );

  const adminSnapshot = await getDocs(adminQuery);
  if (adminSnapshot.empty) return;

  const writes = adminSnapshot.docs.map((admin) =>
    addDoc(collection(db, "notifications"), {
      type: "employee_update",
      recipientId: admin.id,
      employeeId,
      employeeName,
      changedFields,
      message: `${employeeName} updated their profile`,
      read: false,
      createdAt: serverTimestamp(),
    })
  );

  await Promise.all(writes);
}

/* =====================================================
   MARK AS READ
===================================================== */

export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  if (!notificationId) return;

  await updateDoc(doc(db, "notifications", notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

/* =====================================================
   DELETE
===================================================== */

export async function deleteNotification(
  notificationId: string
): Promise<void> {
  if (!notificationId) return;

  await deleteDoc(doc(db, "notifications", notificationId));
}

/* =====================================================
   MARK ALL READ
===================================================== */

export async function markAllNotificationsAsRead(
  adminId: string
): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", adminId),
    where("read", "==", false)
  );

  const snapshot = await getDocs(q);

  await Promise.all(
    snapshot.docs.map((docSnap) =>
      updateDoc(doc(db, "notifications", docSnap.id), {
        read: true,
        readAt: serverTimestamp(),
      })
    )
  );
}

/* =====================================================
   FETCH SINGLE EMPLOYEE
===================================================== */

export async function getEmployeeData(
  userId: string
): Promise<Employee | null> {
  if (!userId) throw new Error("userId missing");

  const snap = await getDoc(doc(db, "users", userId));

  return snap.exists()
    ? ({
        id: snap.id,
        ...(snap.data() as Omit<Employee, "id">),
      })
    : null;
}
