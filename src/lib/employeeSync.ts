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
  DocumentData,
} from "firebase/firestore";

/* =====================================================
   FIELD DISPLAY MAP
===================================================== */

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  name: "Full Name",
  email: "Email Address",
  phoneNumber: "Phone Number",
  dateOfBirth: "Date of Birth",
  gender: "Gender",
  bloodGroup: "Blood Group",
  maritalStatus: "Marital Status",
  nationality: "Nationality",
  permanentAddress: "Permanent Address",
  employeeId: "Employee ID",
  designation: "Designation",
  department: "Department",
  dateOfJoining: "Date of Joining",
  employmentType: "Employment Type",
  workLocation: "Work Location",
  reportingManager: "Reporting Manager",
  workExperience: "Work Experience",
  monthlySalary: "Monthly Salary",
  bankName: "Bank Name",
  accountNumber: "Account Number",
  ifscCode: "IFSC Code",
  panNumber: "PAN Number",
  aadharNumber: "Aadhar Number",
  emergencyContactName: "Emergency Contact Name",
  emergencyContactRelationship: "Emergency Contact Relationship",
  emergencyContactNumber: "Emergency Contact Number",
  role: "Account Type",
};

/* =====================================================
   UPDATE EMPLOYEE
===================================================== */

export async function updateEmployeeData(
  userId: string,
  updates: Record<string, any>
): Promise<void> {
  if (!userId) {
    throw new Error("updateEmployeeData: userId is undefined");
  }

  const userRef = doc(db, "users", userId);

  await updateDoc(userRef, {
    ...updates,
    lastUpdated: serverTimestamp(), // ✅ better than ISO string
  });
}

/* =====================================================
   REALTIME EMPLOYEE LISTENER
===================================================== */

export function subscribeToEmployeeData(
  userId: string,
  callback: (data: DocumentData | null) => void
): () => void {
  if (!userId) {
    console.error("subscribeToEmployeeData: Missing userId");
    return () => {};
  }

  const userRef = doc(db, "users", userId);

  return onSnapshot(
    userRef,
    (snapshot) => {
      callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    (error) => {
      console.error("Employee listener error:", error);
    }
  );
}

/* =====================================================
   ADMIN NOTIFICATION LISTENER
===================================================== */

export function subscribeToNotifications(
  adminId: string,
  callback: (notifications: DocumentData[]) => void
): () => void {
  if (!adminId) {
    console.error("subscribeToNotifications: Missing adminId");
    return () => {};
  }

  const notificationsRef = collection(db, "notifications");

  const q = query(
    notificationsRef,
    where("recipientId", "==", adminId),
    where("read", "==", false)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    },
    (error) => {
      console.error("Notification listener error:", error);
    }
  );
}

/* =====================================================
   CREATE ADMIN NOTIFICATIONS
===================================================== */

export async function notifyAdminsOfEmployeeUpdate(
  employeeId: string,
  employeeName: string,
  changedFields: string[]
): Promise<void> {
  if (!employeeId) {
    throw new Error("notifyAdminsOfEmployeeUpdate: employeeId missing");
  }

  const usersRef = collection(db, "users");

  // ✅ ROLE SHOULD MATCH YOUR DB EXACTLY
  const adminQuery = query(usersRef, where("role", "==", "admin"));
  const adminSnapshot = await getDocs(adminQuery);

  if (adminSnapshot.empty) return;

  const formattedFields = changedFields
    .map((field) => FIELD_DISPLAY_NAMES[field] || field)
    .filter((field) => !["lastUpdated", "profilePhoto"].includes(field));

  const notificationsRef = collection(db, "notifications");

  const batchWrites = adminSnapshot.docs.map((adminDoc) =>
    addDoc(notificationsRef, {
      type: "employee_update",
      recipientId: adminDoc.id, // ✅ best practice (UID targeting)
      employeeId,
      employeeName,
      changedFields: formattedFields,
      message: `${employeeName} updated their profile`,
      read: false,
      createdAt: serverTimestamp(),
    })
  );

  await Promise.all(batchWrites);
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
  if (!adminId) return;

  const notificationsRef = collection(db, "notifications");

  const q = query(
    notificationsRef,
    where("recipientId", "==", adminId),
    where("read", "==", false)
  );

  const snapshot = await getDocs(q);

  await Promise.all(
    snapshot.docs.map((document) =>
      updateDoc(doc(db, "notifications", document.id), {
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
): Promise<DocumentData | null> {
  if (!userId) {
    throw new Error("getEmployeeData: userId missing");
  }

  const snapshot = await getDoc(doc(db, "users", userId));

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}
