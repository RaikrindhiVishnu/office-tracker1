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
  const isAdmin = user.accountType === "ADMIN";
  const isPM = project?.projectManager === user.uid || 
               (Array.isArray(project?.projectManagers) && project.projectManagers.includes(user.uid)) ||
               project?.createdBy === user.uid;
  return isAdmin || isPM || task.assignedTo === user.uid;
}

export const statusColors: Record<string, string> = {
  todo: "#64748b",
  inprogress: "#2563eb",
  review: "#7c3aed",
  done: "#16a34a",
  blocked: "#dc2626",
};
