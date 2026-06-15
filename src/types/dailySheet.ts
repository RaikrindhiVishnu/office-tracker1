export interface DailySheetEntry {
  id?: string;
  uid: string;
  userName: string;
  dateStr: string; // YYYY-MM-DD
  monthStr: string; // YYYY-MM
  project: string;
  taskTitle: string;
  description: string;
  category: string;
  status: string;
  hours: number;
  isDraft: boolean;
  isHoliday?: boolean;
  holidayReason?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}
