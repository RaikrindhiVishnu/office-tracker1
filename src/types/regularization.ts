export type RegularizationRequestType = 
  | "Missing Check-In" 
  | "Missing Check-Out" 
  | "Both Missing" 
  | "Wrong Timing"
  | "Late Arrival"
  | "Early Exit";

export type RegularizationStatus = "Pending" | "Approved" | "Rejected";

export interface AttendanceRegularization {
  id?: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  attendanceDate: string; // YYYY-MM-DD
  requestType: RegularizationRequestType;
  requestedCheckIn: string; // HH:mm AM/PM format
  requestedCheckOut: string; // HH:mm AM/PM format
  reason: string;
  attachment?: string; // URL to uploaded file
  status: RegularizationStatus;
  adminRemarks?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string; // ISO string
}
