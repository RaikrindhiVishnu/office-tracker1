import type { Employee, Session } from "./Employee";

export type EmployeeRow = Employee & {
  sessions: Session[];   // ✅ use imported Session
  morningCheckIn: any | null;
  status: "ONLINE" | "OFFLINE";
  totalMinutes: number;
  task: string;
  profilePhoto?: string;
};
