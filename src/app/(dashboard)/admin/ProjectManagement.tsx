"use client";

import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { db, storage } from "@/lib/firebase";

export default function ProjectManagement({ user, projects, users }: any) {
  /* ================= STATES ================= */
  const [showForm, setShowForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // Forms
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Planning");
  const [dueDate, setDueDate] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStoryPoints, setTaskStoryPoints] = useState(3);

  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");

  const [viewMode, setViewMode] = useState<"kanban" | "list" | "timeline">("kanban");
  const [editingProject, setEditingProject] = useState<any>(null);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    if (!activeProject) return;

    const tasksQuery = activeSprint
      ? query(
          collection(db, "projectTasks"),
          where("projectId", "==", activeProject.id),
          where("sprintId", "==", activeSprint.id)
        )
      : query(collection(db, "projectTasks"), where("projectId", "==", activeProject.id));

    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const sprintsQuery = query(
      collection(db, "sprints"),
      where("projectId", "==", activeProject.id),
      orderBy("createdAt", "desc")
    );
    const unsubSprints = onSnapshot(sprintsQuery, (snap) => {
      setSprints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const activitiesQuery = query(
      collection(db, "projectActivities"),
      where("projectId", "==", activeProject.id),
      orderBy("createdAt", "desc")
    );
    const unsubActivities = onSnapshot(activitiesQuery, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubTasks();
      unsubSprints();
      unsubActivities();
    };
  }, [activeProject, activeSprint]);

  useEffect(() => {
    if (!activeTask) return;

    const commentsQuery = query(
      collection(db, "taskComments"),
      where("taskId", "==", activeTask.id),
      orderBy("createdAt", "asc")
    );
    const unsubComments = onSnapshot(commentsQuery, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const filesQuery = query(
      collection(db, "taskFiles"),
      where("taskId", "==", activeTask.id),
      orderBy("createdAt", "desc")
    );
    const unsubFiles = onSnapshot(filesQuery, (snap) => {
      setTaskFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubComments();
      unsubFiles();
    };
  }, [activeTask]);

  /* ================= HANDLERS ================= */
  const handleCreateProject = async () => {
    if (!name.trim()) return;
    const projectRef = await addDoc(collection(db, "projects"), {
      name, description, priority, status, dueDate, progress: 0,
      createdBy: user.uid, members: [user.uid, ...selectedMembers],
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "projectActivities"), {
      projectId: projectRef.id, userId: user.uid, userName: user.email?.split("@")[0],
      action: "created project", description: `Created "${name}"`, createdAt: serverTimestamp(),
    });
    setShowForm(false); setName(""); setDescription(""); setSelectedMembers([]);
  };

  const handleCreateSprint = async () => {
    if (!sprintName.trim()) return;
    await addDoc(collection(db, "sprints"), {
      name: sprintName, projectId: activeProject.id, startDate: sprintStartDate,
      endDate: sprintEndDate, status: "active", createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id, userId: user.uid, userName: user.email?.split("@")[0],
      action: "created sprint", description: `Created "${sprintName}"`, createdAt: serverTimestamp(),
    });
    setShowSprintForm(false); setSprintName(""); setSprintStartDate(""); setSprintEndDate("");
  };

  const createTask = async () => {
    if (!taskTitle.trim()) return;
    const taskRef = await addDoc(collection(db, "projectTasks"), {
      title: taskTitle, description: taskDescription, projectId: activeProject.id,
      sprintId: activeSprint?.id || null, status: "todo", priority: taskPriority,
      assignedTo: taskAssignee || null, assignedToName: taskAssignee 
        ? users.find((u: any) => u.uid === taskAssignee)?.email?.split("@")[0] : null,
      dueDate: taskDueDate, storyPoints: taskStoryPoints, createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id, userId: user.uid, userName: user.email?.split("@")[0],
      action: "created task", description: `Created "${taskTitle}"`, taskId: taskRef.id,
      createdAt: serverTimestamp(),
    });
    setTaskTitle(""); setTaskDescription(""); setTaskAssignee(""); setTaskDueDate("");
    setTaskStoryPoints(3); setShowTaskForm(false);
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    await updateDoc(doc(db, "projectTasks", taskId), { status: newStatus });
    const task = tasks.find((t) => t.id === taskId);
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id, userId: user.uid, userName: user.email?.split("@")[0],
      action: "moved task", description: `Moved "${task?.title}" to ${newStatus}`,
      taskId, createdAt: serverTimestamp(),
    });
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db, "taskComments"), {
      taskId: activeTask.id, projectId: activeProject.id, userId: user.uid,
      userName: user.email?.split("@")[0], text: commentText, createdAt: serverTimestamp(),
    });
    setCommentText("");
  };

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  console.log("📤 Upload started:", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    userUid: user?.uid,
    activeProjectId: activeProject?.id,
    activeTaskId: activeTask?.id,
  });

  // 🔐 CRITICAL CHECKS
  if (!user?.uid) {
    console.error("❌ User not authenticated");
    alert("You must be logged in to upload files.");
    return;
  }

  if (!activeProject?.id) {
    console.error("❌ No active project");
    alert("No active project selected.");
    return;
  }

  if (!activeTask?.id) {
    console.error("❌ No active task");
    alert("No active task selected.");
    return;
  }

  // File size limit (10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    console.error("❌ File too large:", file.size);
    alert(`File too large. Max size: ${MAX_SIZE / 1024 / 1024}MB`);
    return;
  }

  try {
    setUploading(true);
    console.log("⏳ Creating storage reference...");

    const storagePath = `projectFiles/${activeProject.id}/${activeTask.id}/${Date.now()}_${file.name}`;
    console.log("📁 Storage path:", storagePath);

    const storageRef = ref(storage, storagePath);
    console.log("✅ Storage ref created");

    console.log("⏳ Uploading bytes...");
    const snapshot = await uploadBytes(storageRef, file);
    console.log("✅ Upload complete:", snapshot);

    console.log("⏳ Getting download URL...");
    const url = await getDownloadURL(snapshot.ref);
    console.log("✅ Download URL:", url);

    console.log("⏳ Saving to Firestore...");
    await addDoc(collection(db, "taskFiles"), {
      taskId: activeTask.id,
      projectId: activeProject.id,
      fileName: file.name,
      fileUrl: url,
      uploadedBy: user.uid,
      uploadedByName: user.email?.split("@")[0],
      createdAt: serverTimestamp(),
    });
    console.log("✅ Firestore save complete");

    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id,
      userId: user.uid,
      userName: user.email?.split("@")[0],
      action: "uploaded file",
      description: `Uploaded "${file.name}" to "${activeTask.title}"`,
      taskId: activeTask.id,
      createdAt: serverTimestamp(),
    });
    console.log("✅ Activity logged");

    alert("✅ File uploaded successfully!");
  } catch (error: any) {
    console.error("❌ Upload failed:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Full error:", JSON.stringify(error, null, 2));
    alert(`Upload failed: ${error.message || error.code || "Unknown error"}`);
  } finally {
    setUploading(false);
    console.log("🏁 Upload process complete");
  }
};

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await deleteDoc(doc(db, "projects", id));
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !name.trim()) return;
    await updateDoc(doc(db, "projects", editingProject.id), {
      name,
      description,
      priority,
      status,
      dueDate,
      members: [user.uid, ...selectedMembers],
    });
    await addDoc(collection(db, "projectActivities"), {
      projectId: editingProject.id,
      userId: user.uid,
      userName: user.email?.split("@")[0],
      action: "updated project",
      description: `Updated project "${name}"`,
      createdAt: serverTimestamp(),
    });
    setEditingProject(null);
    setShowForm(false);
    setName("");
    setDescription("");
    setSelectedMembers([]);
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setPriority(project.priority);
    setStatus(project.status);
    setDueDate(project.dueDate || "");
    setSelectedMembers(project.members?.filter((m: string) => m !== user.uid) || []);
    setShowForm(true);
  };

  const handleAssignTask = async (taskId: string, userId: string) => {
    const assignedUser = users.find((u: any) => u.uid === userId);
    await updateDoc(doc(db, "projectTasks", taskId), {
      assignedTo: userId, assignedToName: assignedUser?.email?.split("@")[0],
    });
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id, userId: user.uid, userName: user.email?.split("@")[0],
      action: "assigned task", description: `Assigned to ${assignedUser?.email?.split("@")[0]}`,
      taskId, createdAt: serverTimestamp(),
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await deleteDoc(doc(db, "projectTasks", taskId));
    setActiveTask(null);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    if (filterAssignee !== "all" && task.assignedTo !== filterAssignee) return false;
    return true;
  });

  /* =====================================================
      TASK MODAL
   ===================================================== */
  if (activeTask) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
          <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{activeTask.title}</h2>
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    activeTask.priority === "High" ? "bg-red-500/30" 
                    : activeTask.priority === "Medium" ? "bg-yellow-500/30" 
                    : "bg-green-500/30"
                  }`}>
                    {activeTask.priority}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm bg-white/20">
                    {activeTask.storyPoints} pts
                  </span>
                  {activeTask.assignedToName && (
                    <span className="px-3 py-1 rounded-full text-sm bg-white/20">
                      👤 {activeTask.assignedToName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveTask(null)}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(95vh-200px)]">
            {/* Description */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">📝 Description</h3>
              <p className="text-gray-700 leading-relaxed">
                {activeTask.description || "No description provided"}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-5 rounded-2xl">
                <h4 className="font-bold text-blue-800 mb-2">👤 Assignee</h4>
                <select
                  value={activeTask.assignedTo || ""}
                  onChange={(e) => handleAssignTask(activeTask.id, e.target.value)}
                  className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-2 text-sm focus:border-blue-400 transition"
                >
                  <option value="">Unassigned</option>
                  {users.map((u: any) => (
                    <option key={u.uid} value={u.uid}>{u.email?.split("@")[0]}</option>
                  ))}
                </select>
              </div>
              <div className="bg-emerald-50 p-5 rounded-2xl">
                <h4 className="font-bold text-emerald-800 mb-2">📅 Due Date</h4>
                <input
                  type="date"
                  value={activeTask.dueDate?.split('T')[0] || ''}
                  onChange={async (e) => {
                    await updateDoc(doc(db, "projectTasks", activeTask.id), { dueDate: e.target.value });
                  }}
                  className="w-full bg-white border-2 border-emerald-200 rounded-xl px-3 py-2 text-sm focus:border-emerald-400"
                />
              </div>
              <div className="bg-orange-50 p-5 rounded-2xl">
                <h4 className="font-bold text-orange-800 mb-2">⚡ Priority</h4>
                <select
                  value={activeTask.priority}
                  onChange={async (e) => {
                    await updateDoc(doc(db, "projectTasks", activeTask.id), { priority: e.target.value });
                  }}
                  className="w-full bg-white border-2 border-orange-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400"
                >
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
            </div>

            {/* Files */}
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">📎 Attachments ({taskFiles.length})</h3>
              <label className="inline-block px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition cursor-pointer text-sm">
                {uploading ? "⏳ Uploading..." : "📤 Upload File"}
                <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {taskFiles.map((file: any) => (
                  <div key={file.id} className="bg-white border-2 border-gray-100 rounded-2xl p-4 hover:shadow-lg transition">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center text-xl">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.fileName}</p>
                        <p className="text-xs text-gray-500">{file.uploadedByName}</p>
                      </div>
                    </div>
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" 
                       className="w-full bg-indigo-600 text-white py-2 px-4 rounded-xl text-center text-sm font-medium hover:bg-indigo-700 transition block">
                      📥 Download
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">💬 Comments ({comments.length})</h3>
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-4 p-5 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0">
                      {comment.userName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-sm">{comment.userName}</p>
                        <p className="text-xs text-gray-500">
                          {comment.createdAt?.toDate().toLocaleString()}
                        </p>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 border-2 border-gray-200 focus:border-indigo-400 rounded-xl px-4 py-3 text-sm"
                  onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition text-sm"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Delete Task Button */}
            <button
              onClick={() => handleDeleteTask(activeTask.id)}
              className="w-full px-5 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition text-sm"
            >
              🗑️ Delete Task
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
      PROJECT VIEW
   ===================================================== */
  if (activeProject) {
    const columns = {
      todo: filteredTasks.filter((t) => t.status === "todo"),
      inprogress: filteredTasks.filter((t) => t.status === "inprogress"),
      done: filteredTasks.filter((t) => t.status === "done"),
    };
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = columns.done.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const progress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return (
      <div className="min-h-screen py-2 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Compact Header Card */}
        <div className="bg-[#234567] text-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setActiveProject(null)}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition text-sm font-semibold"
              >
                ← Back
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                   {activeProject.name}
                </h1>
                {activeProject.description && (
                  <p className="text-sm opacity-90">{activeProject.description}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">{progress}%</div>
              <p className="text-xs opacity-90">{completedPoints}/{totalPoints} points</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-white/20 backdrop-blur-sm rounded-full h-1.5">
            <div 
              className="bg-white h-1.5 rounded-full shadow-lg transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controls - Compact */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sprint Selector */}
            <select
              value={activeSprint?.id || ""}
              onChange={(e) => {
                const sprint = sprints.find((s) => s.id === e.target.value);
                setActiveSprint(sprint || null);
              }}
              className="flex-1 min-w-[200px] bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option>All Tasks</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>

            {/* Filter by Priority */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400"
            >
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Filter by Assignee */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400"
            >
              <option value="all">All Assignees</option>
              {users.map((u: any) => (
                <option key={u.uid} value={u.uid}>{u.email?.split("@")[0]}</option>
              ))}
            </select>

            {/* Action Buttons - SMALL WIDTH */}
            <button
              onClick={() => setShowSprintForm(!showSprintForm)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm whitespace-nowrap"
            >
              ➕ Sprint
            </button>

            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm whitespace-nowrap"
            >
              ➕ Task
            </button>

            {/* View Mode - Smaller buttons */}
            <div className="flex gap-2 ml-auto">
              {[
                { mode: "kanban", icon: "📊", label: "Board" },
                { mode: "list", icon: "📋", label: "List" },
                { mode: "timeline", icon: "📅", label: "Activity" }
              ].map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1 ${
                    viewMode === mode
                      ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg scale-105"
                      : "bg-white hover:bg-gray-50 shadow-sm border border-gray-200"
                  }`}
                  title={label}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sprint Form */}
        {showSprintForm && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">➕ New Sprint</h3>
              <button onClick={() => setShowSprintForm(false)} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <input
                value={sprintName} onChange={(e) => setSprintName(e.target.value)}
                placeholder="Sprint name" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:border-indigo-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={sprintStartDate} onChange={(e) => setSprintStartDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:border-indigo-400" placeholder="Start date" />
                <input type="date" value={sprintEndDate} onChange={(e) => setSprintEndDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:border-indigo-400" placeholder="End date" />
              </div>
              <button
                onClick={handleCreateSprint}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition text-sm"
              >
                Create Sprint
              </button>
            </div>
          </div>
        )}

        {/* Task Form */}
        {showTaskForm && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">➕ New Task</h3>
              <button onClick={() => setShowTaskForm(false)} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <input
                value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:border-indigo-400"
              />
              <textarea
                value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Description" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm h-20 shadow-sm focus:border-indigo-400"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400">
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400">
                  <option value="">Assign to...</option>
                  {users.map((u: any) => (
                    <option key={u.uid} value={u.uid}>{u.email?.split("@")[0]}</option>
                  ))}
                </select>
                <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400" />
                <input type="number" value={taskStoryPoints} onChange={(e) => setTaskStoryPoints(parseInt(e.target.value) || 0)}
                  placeholder="Points" min="1" max="13"
                  className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400" />
              </div>
              <button
                onClick={createTask}
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-blue-600 transition text-sm"
              >
                Create Task
              </button>
            </div>
          </div>
        )}

        {/* KANBAN BOARD */}
        {viewMode === "kanban" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(columns).map(([columnId, columnTasks]) => (
                <Droppable droppableId={columnId} key={columnId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-2xl p-4 min-h-[500px] transition ${
                        snapshot.isDraggingOver
                          ? "bg-indigo-50 border-2 border-indigo-300"
                          : "bg-gray-50 border-2 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg capitalize">
                          {columnId === "todo" ? "📝 To Do" 
                            : columnId === "inprogress" ? "⚡ In Progress" 
                            : "✅ Done"}
                        </h3>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded-full font-semibold">
                          {columnTasks.length}
                        </span>
                      </div>

                      {columnTasks.map((task: any, index: number) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setActiveTask(task)}
                              className={`bg-white p-4 rounded-xl shadow-sm mb-3 cursor-pointer hover:shadow-md transition ${
                                snapshot.isDragging ? "rotate-2 scale-105 shadow-xl" : ""
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-sm flex-1">{task.title}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ml-2 ${
                                    task.priority === "High" ? "bg-red-100 text-red-700"
                                    : task.priority === "Medium" ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                  }`}>
                                  {task.priority}
                                </span>
                              </div>

                              {task.description && (
                                <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">🎯 {task.storyPoints} pts</span>
                                {task.assignedToName && (
                                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">
                                    👤 {task.assignedToName}
                                  </span>
                                )}
                              </div>

                              {task.dueDate && (
                                <p className="text-xs text-gray-500 mt-2">
                                  📅 {task.dueDate}
                                </p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Task</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Priority</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Assignee</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Points</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => setActiveTask(task)}
                      className="border-b hover:bg-indigo-50 cursor-pointer transition"
                    >
                      <td className="px-6 py-4 font-semibold text-sm">{task.title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            task.status === "done" ? "bg-green-100 text-green-700"
                            : task.status === "inprogress" ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                          }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            task.priority === "High" ? "bg-red-100 text-red-700"
                            : task.priority === "Medium" ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                          }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{task.assignedToName || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold">{task.storyPoints}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{task.dueDate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {viewMode === "timeline" && (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h3 className="font-bold text-2xl mb-6 flex items-center gap-2">📅 Activity Timeline</h3>
            <div className="space-y-4">
              {activities.slice(0, 50).map((activity) => (
                <div key={activity.id} className="flex gap-4 items-start p-5 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl hover:shadow-md transition">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {activity.userName?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {activity.userName}{" "}
                      <span className="text-gray-600 font-normal">{activity.action}</span>
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {activity.createdAt?.toDate().toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =====================================================
      PROJECTS GRID
   ===================================================== */
  // Calculate project statistics
  const totalProjects = projects?.length || 0;
  const completedProjects = projects?.filter((p: any) => p.status === "Completed").length || 0;
  const activeProjects = projects?.filter((p: any) => p.status === "Active").length || 0;
  const planningProjects = projects?.filter((p: any) => p.status === "Planning").length || 0;

  return (
    <div className="py-2 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-gray-900">📁 Projects</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm"
        >
          ➕ New Project
        </button>
      </div>

      {/* Statistics Boxes */}
     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="bg-[#234567] text-white rounded-xl shadow-md p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium opacity-90">Total Projects</p>
        <p className="text-2xl font-bold mt-1">{totalProjects}</p>
      </div>
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
        📊
      </div>
    </div>
  </div>

  <div className="bg-[#38d991] text-white rounded-xl shadow-md p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium opacity-90">Completed</p>
        <p className="text-2xl font-bold mt-1">{completedProjects}</p>
      </div>
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
        ✅
      </div>
    </div>
  </div>

  <div className="bg-[#e7721e] text-white rounded-xl shadow-md p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium opacity-90">In Progress</p>
        <p className="text-2xl font-bold mt-1">
          {activeProjects + planningProjects}
        </p>
        <p className="text-[10px] opacity-75 mt-0.5">
          {activeProjects} Active • {planningProjects} Planning
        </p>
      </div>
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
        ⚡
      </div>
    </div>
  </div>
</div>


      {/* Project Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xl">
              {editingProject ? "✏️ Edit Project" : "➕ Create New Project"}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingProject(null);
                setName("");
                setDescription("");
                setSelectedMembers([]);
              }}
              className="text-2xl text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Project Name"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:border-indigo-400"
            />
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm h-20 shadow-sm focus:border-indigo-400"
            />

            <div className="grid grid-cols-3 gap-3">
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400">
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400">
                <option>Planning</option><option>Active</option><option>Completed</option>
              </select>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400" />
            </div>

            <div>
              <label className="block font-semibold mb-2 text-sm">Team Members</label>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-xl">
                {users.slice(0, 10).map((u: any) => (
                  <label key={u.uid} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(u.uid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers([...selectedMembers, u.uid]);
                        } else {
                          setSelectedMembers(selectedMembers.filter((id) => id !== u.uid));
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{u.email?.split("@")[0]}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={editingProject ? handleUpdateProject : handleCreateProject}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition text-sm"
            >
              {editingProject ? "💾 Update Project" : "✨ Create Project"}
            </button>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.map((project: any) => (
          <div
            key={project.id}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100"
          >
            <div onClick={() => setActiveProject(project)} className="p-6 cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg group-hover:text-indigo-600 transition flex-1">
                  {project.name}
                </h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ml-2 ${
                    project.priority === "High" ? "bg-red-100 text-red-700"
                    : project.priority === "Medium" ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                  }`}>
                  {project.priority}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {project.description || "No description"}
              </p>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-2">
                  {project.members?.slice(0, 3).map((memberId: string, i: number) => {
                    const member = users.find((u: any) => u.uid === memberId);
                    return (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm"
                      >
                        {member?.email?.[0]?.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                {project.members?.length > 3 && (
                  <span className="text-xs text-gray-500 font-semibold">
                    +{project.members.length - 3}
                  </span>
                )}
              </div>

              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">Progress</span>
                  <span className="text-xs font-bold text-indigo-600">{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
              </div>

              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                project.status === "Completed" ? "bg-green-100 text-green-700"
                : project.status === "Active" ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
              }`}>
                {project.status}
              </span>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditProject(project);
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 text-sm font-semibold transition"
              >
                ✏️ Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id);
                }}
                className="flex-1 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 text-sm font-semibold transition"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}