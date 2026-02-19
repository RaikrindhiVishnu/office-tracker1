import { Timestamp } from "firebase/firestore";

export interface EmployeeNotification {
  id: string;
  type: string;
  recipientId: string;
  employeeId: string;
  employeeName: string;
  message: string;
  changes?: string[]; // ✅ FIX (array, not object)
  changedFields?: string[];
  read: boolean;
  createdAt?: Timestamp;
  readAt?: Timestamp;
  profilePhoto?: string;
}
