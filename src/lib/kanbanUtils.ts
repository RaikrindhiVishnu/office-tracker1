export type TicketType = "story" | "task" | "bug" | "defect";

export interface KanbanColumn {
  id: string;
  label: string;
  wipLimit?: number;
  color?: string;
  bg?: string;
  border?: string;
}

export interface TaskLabel {
  id: string;
  projectId: string;
  title: string;
  color: string;
  createdAt?: any;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  sprintId?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedDate?: string;
  startDate?: string;
  dueDate?: string;
  blockedBy?: string[];
  priority: string;
  status: string;
  estimatedHours?: number;
  actualHours?: number;
  storyPoints?: number;
  tags?: string[];
  labels?: TaskLabel[];
  ticketType?: TicketType;
  parentStoryId?: string | null;
  parentStoryTitle?: string;
  taskCode?: string;
  createdBy: string;
  createdByName?: string | null;
  createdAt: any;
  done?: boolean; // for subtasks mostly
  imageUrl?: string;
  images?: any[];
}

export const LABEL_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  green: { bg: "#4bce97", text: "#ffffff" },
  yellow: { bg: "#f5cd47", text: "#ffffff" },
  orange: { bg: "#fea362", text: "#ffffff" },
  red: { bg: "#f87168", text: "#ffffff" },
  purple: { bg: "#9f8fef", text: "#ffffff" },
  blue: { bg: "#579dff", text: "#ffffff" },
  cyan: { bg: "#60c6d2", text: "#ffffff" },
  lime: { bg: "#94c748", text: "#ffffff" },
  pink: { bg: "#e774bb", text: "#ffffff" },
  black: { bg: "#44546f", text: "#ffffff" },
};

export function getLabelStyle(colorValue: string) {
  if (LABEL_COLORS[colorValue]) return LABEL_COLORS[colorValue];
  // If it's a custom hex color
  if (colorValue?.startsWith("#")) {
    return {
      bg: colorValue,
      text: "#ffffff", // Default to white text for custom colors, or could add contrast check
      border: "rgba(0,0,0,0.1)"
    };
  }
  return LABEL_COLORS.green;
}

export const TICKET_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; border: string; description: string }> = {
  story: { label: "Story", icon: "📘", color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", description: "A user story" },
  task: { label: "Task", icon: "✅", color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", description: "A unit of work" },
  bug: { label: "Bug", icon: "🐞", color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", description: "Something broken" },
  defect: { label: "Defect", icon: "⚠️", color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", description: "A quality issue" },
};

export const PRI_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Low: { dot: "#22c55e", bg: "#f0fdf4", text: "#16a34a", label: "Low" },
  Medium: { dot: "#f59e0b", bg: "#fffbeb", text: "#d97706", label: "Medium" },
  High: { dot: "#f97316", bg: "#fff7ed", text: "#ea580c", label: "High" },
  Critical: { dot: "#ef4444", bg: "#fef2f2", text: "#dc2626", label: "Critical" },
};

const AVATAR_COLORS = ["#6366f1", "#7c3aed", "#db2777", "#d97706", "#059669", "#0891b2", "#e11d48", "#0284c7", "#16a34a", "#854d0e"];

export const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

export const avatarInitial = (name: string): string => {
  if (!name || name.includes("@")) return "U";
  return name.trim()[0].toUpperCase();
};

export const cleanDisplayName = (name: string | null | undefined): string => {
  if (!name || name.includes("@")) return "User";
  return name;
};

export function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function isOverdue(dueDate?: string, status?: string) {
  if (!dueDate || status === "done") return false;
  return new Date(dueDate) < new Date();
}

export function canDragTask(user: any, task: any, project: any) {
  if (!user) return false;
  const isAdmin = user?.accountType === "ADMIN" || user?.accountType === "SUPERADMIN" || user?.accountType === "BUSINESSOWNER" || user?.accountType === "BUSINESS_OWNER";
  const isPM = project?.projectManager === user.uid ||
    (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user.uid)) ||
    project?.createdBy === user.uid;
  return isAdmin || isPM || task.assignedTo === user.uid;
}

export function getPermissions(user: any, project: any) {
  const isAdmin = user?.accountType === "ADMIN" || user?.accountType === "SUPERADMIN" || user?.accountType === "BUSINESSOWNER" || user?.accountType === "BUSINESS_OWNER";
  const isPM = !!(
    project?.projectManager === user?.uid ||
    (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user?.uid))
  );
  const fullControl = isAdmin || isPM;
  const designation: string = user?.designation || "";
  const isDevEngineer = ["Software Engineer", "Senior Software Engineer", "Frontend Engineer", "Backend Engineer", "Full Stack Engineer", "Android Developer", "Mobile App Developer", "DevOps Engineer"].some(d => designation.toLowerCase().includes(d.toLowerCase()));
  const isFrontendEngineer = designation.toLowerCase().includes("frontend engineer");
  const isQA = designation.toLowerCase().includes("qa");
  let canCreateTypes: TicketType[] = ["task"];
  if (fullControl) canCreateTypes = ["story", "task", "bug", "defect"];
  else if (isFrontendEngineer) canCreateTypes = ["story", "task"];
  else if (isDevEngineer) canCreateTypes = ["task"];
  else if (isQA) canCreateTypes = ["task", "bug", "defect"];
  return { isPM, isAdmin, fullControl, canCreateTypes, canEdit: fullControl, canDelete: fullControl, canAssign: fullControl };
}

export const statusColors: Record<string, string> = {
  todo: "#64748b",
  inprogress: "#2563eb",
  review: "#7c3aed",
  done: "#16a34a",
  blocked: "#dc2626",
};

export const STATIC_COL_CONFIG: Record<string, { color: string; bg: string; border: string; headerBg: string; dot: string }> = {
  new: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#9CA3AF" },
  dev_in_progress: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#3B82F6" },
  unit_testing: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#8B5CF6" },
  ready_for_qa: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#06B6D4" },
  testing_in_progress: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#10B981" },
  reopened: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#EF4444" },
  done: { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#10B981" },
};

export const DYNAMIC_PALETTE = [
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#9CA3AF" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#3B82F6" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#8B5CF6" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#10B981" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#EF4444" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#06B6D4" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#F59E0B" },
  { color: "#4B5563", bg: "#FAFAFA", border: "#E5E7EB", headerBg: "#FFFFFF", dot: "#EC4899" },
];

export function getColStyle(colId: string, index: number) {
  return STATIC_COL_CONFIG[colId] ?? DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length];
}
