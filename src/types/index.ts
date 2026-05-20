export interface EmailRecipient {
  id?: string;
  name: string;
  email: string;
}

export interface EmailBatch {
  type: "birthday" | "festival" | "event" | "admin_attendance_summary" | "admin_birthday_alert";
  subject: string;
  recipients: EmailRecipient[];
  sentBy: "admin" | "system";
  refId?: string;
  html: (name: string) => string;
}