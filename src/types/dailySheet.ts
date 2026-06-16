export interface DailySheetTask {
  id: string; // Unique ID for the task
  project: string;
  taskTitle: string;
  description: string;
  category: string;
  status: string;
  hours: number;
}

export interface DailySheetEntry {
  id?: string;
  uid: string;
  userName: string;
  dateStr: string; // YYYY-MM-DD
  monthStr: string; // YYYY-MM
  
  // Legacy fields (kept for backward compatibility with old records)
  project?: string;
  taskTitle?: string;
  description?: string;
  category?: string;
  status?: string;
  hours?: number;

  tasks?: DailySheetTask[]; // New array for tasks

  isDraft: boolean;
  isHoliday?: boolean;
  holidayReason?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}
