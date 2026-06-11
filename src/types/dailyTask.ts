export interface DailyTask {
  id: string;
  taskName: string;
  description: string;

  assignedBy: string; // Lead ID
  assignedByName: string; // Lead Name

  assignedTo: string; // Employee ID
  assignedToName: string; // Employee Name

  department: string;

  priority?: "High" | "Medium" | "Low";
  estimatedHours?: number;

  assignedDate: string; // ISO string
  expectedCompletionDate: string; // ISO string
  actualCompletionDate?: string | null; // ISO string or null

  status: "Assigned" | "In Progress" | "Completed";
  
  completionStatus?: "Completed On Time" | "Late Completion" | "Not Completed" | null;
  qualityReview?: "Totally Correct" | "Partially Correct" | "Totally Wrong" | null;
  remarks?: string | null;

  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}
