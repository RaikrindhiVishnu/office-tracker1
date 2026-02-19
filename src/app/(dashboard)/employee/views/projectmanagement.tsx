"use client";

import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { db, storage } from "@/lib/firebase";

export default function EmployeeProjectManagement({ user, projects, users }: any) {
  /* ================= STATES ================= */
  const [activeProject, setActiveProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "timeline">("kanban");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Only projects where the current employee is a member
  const myProjects = projects?.filter((p: any) =>
    p.members?.includes(user?.uid)
  ) || [];

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    if (!activeProject) return;

    const tasksQuery = activeSprint
      ? query(
          collection(db, "projectTasks"),
          where("projectId", "==", activeProject.id),
          where("sprintId", "==", activeSprint.id)
        )
      : query(
          collection(db, "projectTasks"),
          where("projectId", "==", activeProject.id)
        );

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

  /* ================= HELPERS ================= */
  const isMyTask = (task: any) => task.assignedTo === user?.uid;

  // All project tasks visible; but only mine are draggable / status-changeable
  const filteredTasks = tasks.filter((task) => {
    if (filterPriority !== "all" && task.priority !== filterPriority) return false;
    return true;
  });

  /* ================= HANDLERS ================= */

  // Employee can only move their own tasks
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !isMyTask(task)) return; // guard

    const newStatus = result.destination.droppableId;
    await updateDoc(doc(db, "projectTasks", taskId), { status: newStatus });
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id,
      userId: user.uid,
      userName: user.email?.split("@")[0],
      action: "moved task",
      description: `Moved "${task.title}" to ${newStatus}`,
      taskId,
      createdAt: serverTimestamp(),
    });
  };

  // Employee can change status of their own tasks via dropdown in task modal
  const handleStatusChange = async (newStatus: string) => {
    if (!isMyTask(activeTask)) return;
    await updateDoc(doc(db, "projectTasks", activeTask.id), { status: newStatus });
    await addDoc(collection(db, "projectActivities"), {
      projectId: activeProject.id,
      userId: user.uid,
      userName: user.email?.split("@")[0],
      action: "updated status",
      description: `Changed "${activeTask.title}" to ${newStatus}`,
      taskId: activeTask.id,
      createdAt: serverTimestamp(),
    });
    setActiveTask({ ...activeTask, status: newStatus });
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db, "taskComments"), {
      taskId: activeTask.id,
      projectId: activeProject.id,
      userId: user.uid,
      userName: user.email?.split("@")[0],
      text: commentText,
      createdAt: serverTimestamp(),
    });
    setCommentText("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid || !activeProject?.id || !activeTask?.id) return;

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) { alert("File too large. Max 10MB."); return; }

    try {
      setUploading(true);
      const storagePath = `projectFiles/${activeProject.id}/${activeTask.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "taskFiles"), {
        taskId: activeTask.id,
        projectId: activeProject.id,
        fileName: file.name,
        fileUrl: url,
        uploadedBy: user.uid,
        uploadedByName: user.email?.split("@")[0],
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "projectActivities"), {
        projectId: activeProject.id,
        userId: user.uid,
        userName: user.email?.split("@")[0],
        action: "uploaded file",
        description: `Uploaded "${file.name}" to "${activeTask.title}"`,
        taskId: activeTask.id,
        createdAt: serverTimestamp(),
      });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  /* =====================================================
      TASK MODAL
   ===================================================== */
  if (activeTask) {
    const canEdit = isMyTask(activeTask);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold">{activeTask.title}</h2>
                  {canEdit && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                      ✏️ Your task
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    activeTask.priority === "High" ? "bg-red-500/30"
                    : activeTask.priority === "Medium" ? "bg-yellow-500/30"
                    : "bg-green-500/30"
                  }`}>
                    {activeTask.priority}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm bg-white/20">
                    🎯 {activeTask.storyPoints} pts
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
              >✕</button>
            </div>
          </div>

          <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(95vh-200px)]">
            {/* Description */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-3">📝 Description</h3>
              <p className="text-gray-700 leading-relaxed">
                {activeTask.description || "No description provided"}
              </p>
            </div>

            {/* Task Info + Status Change */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status — editable only for own tasks */}
              <div className={`p-5 rounded-2xl ${canEdit ? "bg-indigo-50" : "bg-slate-50"}`}>
                <h4 className={`font-bold mb-2 ${canEdit ? "text-indigo-800" : "text-slate-600"}`}>
                  🔄 Status
                </h4>
                {canEdit ? (
                  <select
                    value={activeTask.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full bg-white border-2 border-indigo-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 transition"
                  >
                    <option value="todo">📝 To Do</option>
                    <option value="inprogress">⚡ In Progress</option>
                    <option value="done">✅ Done</option>
                  </select>
                ) : (
                  <span className={`inline-block px-3 py-1.5 rounded-xl text-sm font-semibold ${
                    activeTask.status === "done" ? "bg-green-100 text-green-700"
                    : activeTask.status === "inprogress" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
                  }`}>
                    {activeTask.status === "done" ? "✅ Done"
                      : activeTask.status === "inprogress" ? "⚡ In Progress"
                      : "📝 To Do"}
                  </span>
                )}
                {!canEdit && (
                  <p className="text-xs text-slate-400 mt-1">Not assigned to you</p>
                )}
              </div>

              {/* Due Date — read only */}
              <div className="bg-emerald-50 p-5 rounded-2xl">
                <h4 className="font-bold text-emerald-800 mb-2">📅 Due Date</h4>
                <p className="text-emerald-900 font-semibold text-sm">
                  {activeTask.dueDate || "No due date"}
                </p>
              </div>

              {/* Assignee — read only */}
              <div className="bg-orange-50 p-5 rounded-2xl">
                <h4 className="font-bold text-orange-800 mb-2">👤 Assigned To</h4>
                <p className="text-orange-900 font-semibold text-sm">
                  {activeTask.assignedToName || "Unassigned"}
                </p>
              </div>
            </div>

            {/* Files */}
            <div>
              <h3 className="font-bold text-lg mb-4">📎 Attachments ({taskFiles.length})</h3>
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
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-xl text-center text-sm font-medium hover:bg-indigo-700 transition block"
                    >
                      📥 Download
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="font-bold text-lg mb-4">💬 Comments ({comments.length})</h3>
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-4 p-5 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0 ${
                      comment.userId === user?.uid
                        ? "bg-gradient-to-br from-indigo-400 to-purple-500"
                        : "bg-gradient-to-br from-slate-400 to-slate-500"
                    }`}>
                      {comment.userName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-sm">{comment.userName}</p>
                        {comment.userId === user?.uid && (
                          <span className="text-xs text-indigo-500 font-medium">(you)</span>
                        )}
                        <p className="text-xs text-gray-500">
                          {comment.createdAt?.toDate().toLocaleString()}
                        </p>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{comment.text}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-sm text-slate-400 italic py-4">
                    No comments yet. Be the first!
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 border-2 border-gray-200 focus:border-indigo-400 rounded-xl px-4 py-3 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
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

    const myTasks = tasks.filter((t) => isMyTask(t));
    const myDone = myTasks.filter((t) => t.status === "done").length;
    const myTotal = myTasks.length;
    const myProgress = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;

    return (
      <div className="min-h-screen py-2 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="bg-[#234567] text-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => { setActiveProject(null); setActiveSprint(null); }}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition text-sm font-semibold"
              >
                ← Back
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-1">{activeProject.name}</h1>
                {activeProject.description && (
                  <p className="text-sm opacity-90">{activeProject.description}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">{myProgress}%</div>
              <p className="text-xs opacity-90">{myDone}/{myTotal} your tasks</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full shadow-lg transition-all duration-1000"
              style={{ width: `${myProgress}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sprint Selector */}
            <select
              value={activeSprint?.id || ""}
              onChange={(e) => {
                const sprint = sprints.find((s) => s.id === e.target.value);
                setActiveSprint(sprint || null);
              }}
              className="flex-1 min-w-[200px] bg-white border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400"
            >
              <option value="">All Tasks</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>

            {/* Filter Priority */}
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

            {/* My Tasks Quick Filter badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 font-semibold">
              👤 My tasks: {myTotal}
            </div>

            {/* View Mode */}
            <div className="flex gap-2 ml-auto">
              {[
                { mode: "kanban", icon: "📊", label: "Board" },
                { mode: "list", icon: "📋", label: "List" },
                { mode: "timeline", icon: "📅", label: "Activity" },
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

        {/* KANBAN */}
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

                      {(columnTasks as any[]).map((task: any, index: number) => {
                        const mine = isMyTask(task);
                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                            isDragDisabled={!mine}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...(mine ? provided.dragHandleProps : {})}
                                onClick={() => setActiveTask(task)}
                                className={`bg-white p-4 rounded-xl shadow-sm mb-3 transition ${
                                  snapshot.isDragging ? "rotate-2 scale-105 shadow-xl" : ""
                                } ${
                                  mine
                                    ? "cursor-pointer hover:shadow-md border-l-4 border-indigo-400"
                                    : "cursor-pointer hover:shadow-sm opacity-80 border-l-4 border-slate-200"
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
                                    <span className={`px-2 py-1 rounded font-semibold ${
                                      mine
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}>
                                      👤 {task.assignedToName}
                                    </span>
                                  )}
                                </div>

                                {task.dueDate && (
                                  <p className="text-xs text-gray-500 mt-2">📅 {task.dueDate}</p>
                                )}

                                {mine && (
                                  <p className="text-xs text-indigo-400 mt-1.5 font-medium">
                                    ↕ Drag to update status
                                  </p>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
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
                      className={`border-b cursor-pointer transition ${
                        isMyTask(task)
                          ? "hover:bg-indigo-50"
                          : "hover:bg-slate-50 opacity-80"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isMyTask(task) && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          )}
                          <span className="font-semibold text-sm">{task.title}</span>
                        </div>
                      </td>
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
                      <td className="px-6 py-4 text-sm">
                        {task.assignedToName || "—"}
                        {isMyTask(task) && (
                          <span className="ml-1 text-xs text-indigo-500">(you)</span>
                        )}
                      </td>
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
                <div
                  key={activity.id}
                  className={`flex gap-4 items-start p-5 rounded-2xl hover:shadow-md transition ${
                    activity.userId === user?.uid
                      ? "bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100"
                      : "bg-gradient-to-r from-slate-50 to-gray-50"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                    activity.userId === user?.uid
                      ? "bg-gradient-to-br from-indigo-500 to-purple-500"
                      : "bg-gradient-to-br from-slate-400 to-slate-500"
                  }`}>
                    {activity.userName?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {activity.userName}
                      {activity.userId === user?.uid && (
                        <span className="ml-1 text-xs text-indigo-500 font-medium">(you)</span>
                      )}
                      {" "}
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
      PROJECTS GRID (employee view)
   ===================================================== */
  const myCompletedCount = myProjects.filter((p: any) => p.status === "Completed").length;
  const myActiveCount = myProjects.filter((p: any) => p.status === "Active").length;
  const myPlanningCount = myProjects.filter((p: any) => p.status === "Planning").length;

  return (
    <div className="py-2 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header — no "New Project" button */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">📁 My Projects</h2>
          <p className="text-sm text-slate-500 mt-1">Projects you're assigned to</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#234567] text-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium opacity-90">My Projects</p>
              <p className="text-2xl font-bold mt-1">{myProjects.length}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">📊</div>
          </div>
        </div>

        <div className="bg-[#38d991] text-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium opacity-90">Completed</p>
              <p className="text-2xl font-bold mt-1">{myCompletedCount}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">✅</div>
          </div>
        </div>

        <div className="bg-[#e7721e] text-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium opacity-90">In Progress</p>
              <p className="text-2xl font-bold mt-1">{myActiveCount + myPlanningCount}</p>
              <p className="text-[10px] opacity-75 mt-0.5">{myActiveCount} Active • {myPlanningCount} Planning</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">⚡</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {myProjects.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-500">You haven't been added to any projects. Ask your admin to add you.</p>
        </div>
      )}

      {/* Projects Grid — no Edit/Delete buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myProjects.map((project: any) => (
          <div
            key={project.id}
            onClick={() => setActiveProject(project)}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 cursor-pointer group"
          >
            <div className="p-6">
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

              {/* Team members */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-2">
                  {project.members?.slice(0, 3).map((memberId: string, i: number) => {
                    const member = users.find((u: any) => u.uid === memberId);
                    const isMe = memberId === user?.uid;
                    return (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm ${
                          isMe
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-indigo-400 ring-offset-1"
                            : "bg-gradient-to-br from-slate-400 to-slate-500"
                        }`}
                        title={isMe ? "You" : member?.email?.split("@")[0]}
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

              {/* Progress bar */}
              <div className="mb-3">
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

              <div className="flex items-center justify-between">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                  project.status === "Completed" ? "bg-green-100 text-green-700"
                  : project.status === "Active" ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
                }`}>
                  {project.status}
                </span>
                <span className="text-xs text-indigo-600 font-semibold group-hover:underline">
                  View project →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}