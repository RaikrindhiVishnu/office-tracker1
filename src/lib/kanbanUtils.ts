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
  dueDate?: string;
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
  story: { label: "Story", icon: "📘", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", description: "A user story" },
  task: { label: "Task", icon: "✅", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", description: "A unit of work" },
  bug: { label: "Bug", icon: "🐞", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", description: "Something broken" },
  defect: { label: "Defect", icon: "⚠️", color: "#d97706", bg: "#fffbeb", border: "#fde68a", description: "A quality issue" },
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
  new: { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#94a3b8" },
  dev_in_progress: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  unit_testing: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  ready_for_qa: { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", headerBg: "#cffafe", dot: "#06b6d4" },
  testing_in_progress: { color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4", headerBg: "#ccfbf1", dot: "#14b8a6" },
  reopened: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
  done: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
};

export const DYNAMIC_PALETTE = [
  { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", headerBg: "#f1f5f9", dot: "#94a3b8" },
  { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", headerBg: "#dbeafe", dot: "#3b82f6" },
  { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", headerBg: "#ede9fe", dot: "#8b5cf6" },
  { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", headerBg: "#dcfce7", dot: "#22c55e" },
  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", headerBg: "#fee2e2", dot: "#ef4444" },
  { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", headerBg: "#cffafe", dot: "#06b6d4" },
  { color: "#d97706", bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7", dot: "#f59e0b" },
  { color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", headerBg: "#fce7f3", dot: "#ec4899" },
];

export function getColStyle(colId: string, index: number) {
  return STATIC_COL_CONFIG[colId] ?? DYNAMIC_PALETTE[index % DYNAMIC_PALETTE.length];
}
