import { Employee } from "./Employee";

type Session = {
  checkIn: any;
  checkOut: any;
};

export type EmployeeRow = Employee & {
  sessions: Session[];
  morningCheckIn: any | null;
  status: "ONLINE" | "OFFLINE";
  totalMinutes: number;
  task: string;
};
