import { adminDb } from "@/lib/firebaseAdmin";
import Image from "next/image";
import Link from "next/link";

const PRIORITY_COLORS: Record<string, { bg: string, text: string }> = {
  Critical: { bg: "#fef2f2", text: "#dc2626" },
  High: { bg: "#fff7ed", text: "#ea580c" },
  Medium: { bg: "#fefce8", text: "#ca8a04" },
  Low: { bg: "#f0fdf4", text: "#16a34a" },
};

const TYPE_ICONS: Record<string, string> = {
  story: "📘",
  task: "🧩",
  bug: "🐞",
  defect: "🎯"
};

// Use a Server Component to fetch the task directly using Firebase Admin.
// This bypasses the client-side Firebase Security Rules which deny read access to unauthenticated users.
export default async function PublicTaskView({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // 1. Fetch Task using Admin SDK
  const taskSnap = await adminDb.collection("projectTasks").doc(id).get();
  
  if (!taskSnap.exists) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
          🤷‍♂️
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Task Not Found</h1>
        <p className="text-gray-500 mb-8 max-w-md">
          We couldn't find the task you're looking for. The link might be invalid or the task may have been deleted.
        </p>
      </div>
    );
  }

  const taskData = taskSnap.data() as any;
  const task = { id: taskSnap.id, ...taskData };

  // 2. Fetch Project for styling (optional)
  let project: any = null;
  if (task.projectId) {
    const projSnap = await adminDb.collection("projects").doc(task.projectId).get();
    if (projSnap.exists) {
      project = { id: projSnap.id, ...projSnap.data() };
    }
  }

  const projectColor = project?.color || "#4f46e5";
  const priorityStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
  const ticketIcon = TYPE_ICONS[task.ticketType] || TYPE_ICONS.task;

  // Format Date safely
  let formattedDate = "Unknown date";
  if (task.createdAt && task.createdAt.toDate) {
    formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(task.createdAt.toDate());
  } else if (task.createdAt && task.createdAt._seconds) {
    formattedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(task.createdAt._seconds * 1000));
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center py-10 px-4 sm:px-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* Simple Image-Like Card */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden" style={{ borderTop: `6px solid ${projectColor}` }}>
        
        <div className="p-8 sm:p-10">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                {ticketIcon} <span className="uppercase tracking-wider">{task.ticketType || "Task"}</span>
              </span>
              {task.taskCode && (
                <span className="px-3 py-1 border border-gray-200 text-gray-500 text-xs font-bold rounded-full tracking-widest bg-gray-50">
                  {task.taskCode}
                </span>
              )}
            </div>
            <span 
              className="px-3 py-1 text-xs font-bold rounded-full"
              style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.text }}
            >
              {task.priority || "Medium"} Priority
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-4">
            {task.title}
          </h1>

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</h3>
            {task.description ? (
              <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-xl p-5 border border-gray-100 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </div>
            ) : (
              <p className="text-gray-400 italic">No description provided.</p>
            )}
          </div>

          {/* Footer Info Row */}
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-6 mt-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned To</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{task.assignedToName || "Unassigned"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
              <p className="text-sm font-bold text-gray-900 mt-1 capitalize">{task.status || "Unknown"}</p>
            </div>
          </div>
          
        </div>
      </div>

      <div className="mt-8 text-center">
        <Image src="/logo-black.svg" alt="Logo" width={80} height={30} className="object-contain opacity-50 mx-auto" />
        <p className="text-xs font-medium text-gray-400 mt-2">
          Read-only snapshot view
        </p>
      </div>

    </div>
  );
}
