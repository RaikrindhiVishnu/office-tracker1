// types.ts — shared types for the PM system

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  goal?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sprintType?: "Normal" | "Release" | "Hotfix";
  capacity?: number;
  velocity?: number;
  tags?: string[];
  status: "planned" | "active" | "on_hold" | "overdue" | "completed" | "archived";
  createdAt: any;
}

export interface ActivityLog {  
  id: string;
  taskId?: string;
  projectId: string;
  action: "created" | "moved" | "updated" | "assigned" | "status_changed" | "sprint_changed" | "priority_changed" | "commented" | "deleted";
  from?: Record<string, any>;
  to?: Record<string, any>;
  userId: string;
  userName: string;
  description: string;
  createdAt: any;
}

export interface TaskLink {
  title: string;
  url: string;
}

export interface TaskImage {
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: any;
}

// Extended Task — extends the base Task from KanbanBoard
export interface ExtendedTask {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  sprintId?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedDate?: string;
  dueDate?: string;
  priority: string;
  status: string;
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  tags?: string[];
  ticketType?: "epic" | "story" | "task" | "bug" | "defect" | "subtask" | "spike" | "improvement";
  parentStoryId?: string | null;
  taskCode?: string;
  createdBy: string;
  createdAt: any;
  // NEW
  images?: TaskImage[];
  links?: TaskLink[];
  blockedBy?: string[];
  blocks?: string[];
  relatedTasks?: string[];
}

export type SprintStatus = Sprint["status"];