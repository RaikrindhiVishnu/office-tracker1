// types/task.ts
export interface Task {
  id: string;
  title: string;

  projectId: string;
  createdBy: string;
  createdAt: any;

  status?: string;
  priority?: string;
  assignedTo?: string;

  ticketType?: string;
  tags?: string[];
}