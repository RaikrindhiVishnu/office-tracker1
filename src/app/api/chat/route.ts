import { NextResponse } from "next/server";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

const checkInDeclaration: FunctionDeclaration = {
  name: "checkInEmployee",
  description: "Check the employee in for attendance today.",
  parameters: { type: SchemaType.OBJECT, properties: {} }
};

const applyLeaveDeclaration: FunctionDeclaration = {
  name: "applyForLeave",
  description: "Apply for leave (sick, casual, wfh, lop) for the employee.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      leaveType: { type: SchemaType.STRING, description: "Type of leave: casual, sick, wfh, lop" },
      fromDate: { type: SchemaType.STRING, description: "Start date in YYYY-MM-DD format" },
      toDate: { type: SchemaType.STRING, description: "End date in YYYY-MM-DD format" },
      reason: { type: SchemaType.STRING, description: "Brief reason for the leave" },
    },
    required: ["leaveType", "fromDate", "toDate", "reason"]
  }
};

const logWorkUpdateDeclaration: FunctionDeclaration = {
  name: "logWorkUpdate",
  description: "Save a structured daily work update for the employee.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      projectName: { type: SchemaType.STRING, description: "Name of the project they are working on (e.g., Office Tracker CRM, GLC)" },
      module: { type: SchemaType.STRING, description: "Specific module or feature area (e.g., AI Chatbot, Region Validation)" },
      todayTask: { type: SchemaType.STRING, description: "What the employee worked on today (professionally rewritten)" },
      ticketType: { type: SchemaType.STRING, description: "Type of task: Task, Bug, Story, or Feature" },
      status: { type: SchemaType.STRING, description: "Overall status (e.g., In Progress, Completed, Blocked, Delayed)" },
      priority: { type: SchemaType.STRING, description: "Priority: Low, Medium, High, Critical" },
      eta: { type: SchemaType.STRING, description: "Estimated time of arrival/completion (e.g., 2 Days, EOD, Tomorrow)" },
      blockers: { type: SchemaType.STRING, description: "Categorized blockers (e.g., API Issues, Firebase Errors, Design Clarifications, or 'None')" },
      completionPercent: { type: SchemaType.NUMBER, description: "Estimated completion percentage of current task (0-100)" },
      productivity: { type: SchemaType.STRING, description: "Estimated productivity/mood based on tone (e.g., Good, Stressed, Normal, Burnout)" },
      nextTask: { type: SchemaType.STRING, description: "What the employee plans to work on next" },
      taskId: { type: SchemaType.STRING, description: "The ID of the project task they are updating, if any" },
      hoursWorked: { type: SchemaType.NUMBER, description: "Number of hours they worked on this task today (default 8)" }
    },
    required: ["projectName", "module", "todayTask", "ticketType", "status", "priority", "eta", "blockers", "completionPercent", "productivity", "nextTask"]
  }
};

const createProjectTaskDeclaration: FunctionDeclaration = {
  name: "createProjectTask",
  description: "Create a new story or task in a project for the employee.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      projectId: { type: SchemaType.STRING, description: "The ID of the project to create the task in" },
      ticketType: { type: SchemaType.STRING, description: "Type of ticket: story, task, bug, defect" },
      title: { type: SchemaType.STRING, description: "The title of the task or story" },
      description: { type: SchemaType.STRING, description: "Detailed description of the task" },
      priority: { type: SchemaType.STRING, description: "Priority: Low, Medium, High, Critical" },
      assigneeName: { type: SchemaType.STRING, description: "The full name of the employee to assign this task to, if requested" },
    },
    required: ["projectId", "ticketType", "title"]
  }
};

const updateProjectTaskDeclaration: FunctionDeclaration = {
  name: "updateProjectTask",
  description: "Update the status, priority, or assignee of an existing project task.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      taskId: { type: SchemaType.STRING, description: "The ID of the task to update" },
      status: { type: SchemaType.STRING, description: "New status: open, in-progress, in-review" },
      priority: { type: SchemaType.STRING, description: "New priority: Low, Medium, High, Critical" },
    },
    required: ["taskId"]
  }
};

const closeProjectTaskDeclaration: FunctionDeclaration = {
  name: "closeProjectTask",
  description: "Mark a project task as closed/completed.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      taskId: { type: SchemaType.STRING, description: "The ID of the task to close" },
    },
    required: ["taskId"]
  }
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function POST(request: Request) {
  try {
    const { message, context, history = [], base64Image } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      tools: [{
        functionDeclarations: [checkInDeclaration, applyLeaveDeclaration, logWorkUpdateDeclaration, createProjectTaskDeclaration, updateProjectTaskDeclaration, closeProjectTaskDeclaration]
      }]
    });

    const systemInstruction = `
      You are "Tracker Bot", a friendly AI assistant inside Office Tracker.
      You are talking to ${context?.userName || "an employee"}.

      ### CONTEXT
      - Time: ${new Date().toLocaleString()}
      - Checked In Today: ${context?.hasCheckedIn ? "Yes" : "No"}
      - Work Update Submitted Today: ${context?.hasWorkUpdate ? "Yes" : "No"}
      - Yesterday's Update: ${context?.yesterdaysUpdate ? JSON.stringify(context.yesterdaysUpdate) : "None"}
      - Assigned Projects: ${JSON.stringify(context?.assignedProjects || [])}
      - Assigned Tasks/Bugs: ${JSON.stringify(context?.assignedTasks || [])}

      ### HOW TO BEHAVE
      - Be SHORT, SIMPLE, and FRIENDLY. No long paragraphs. No heavy explanations.
      - Ask ONLY 1 question at a time. Never ask multiple questions together.
      - When listing tasks or info, use clean short bullet points. No IDs.
      - Correct poor grammar silently when saving to database.
      - Give a warm 1-line response before asking the next question.
      - NEVER say "Got it." alone. Always add a small encouraging note.

      ### WORK UPDATE (Human-Like Conversation Flow)
      When the user submits a work update, have a warm, natural, interactive conversation. Collect details to log their update, asking questions conversationally ONE BY ONE:
      1. Project & Task: Check their Assigned Projects and Assigned Tasks/Bugs. Ask them which project/task they worked on today (referring to their actual assigned items from context if any, otherwise listing the projects list names).
      2. Progress & ETA Check: Ask how it's going and if they'll finish it within their original estimated time. Ask: "Is it completed, or still in progress? Do you think you'll hit your ETA, or do you need extra time/support?"
      3. Dynamic Extension Check: If they say they need extra time, ask them how much extra time they need (revised ETA) and if they have any other work they are handling. Acknowledge it supportively.
      4. Blockers: Ask if they have any blockers or tech issues holding them back.
      5. Mood check: Warmly ask how they feel about their pace overall (e.g. "Good", "Normal", or "Stressed").
      Once you have the details, execute the logWorkUpdate function immediately. Keep it conversational throughout.

      ### TASK MANAGEMENT
      - Create task → call createProjectTask
      - Update task → call updateProjectTask  
      - Mark done → call closeProjectTask

      ### RULE
      Keep every response under 3 lines unless listing tasks. Use markdown lightly.
    `;

    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === "bot" ? "model" : "user",
      parts: [{ text: msg.text || "" }]
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Understood. I am ready to help." }] },
        ...formattedHistory
      ],
    });

    const msgParts: any[] = [{ text: message }];
    if (base64Image) {
      // base64Image format: data:image/png;base64,iVBORw0K...
      const mimeType = base64Image.split(";")[0].split(":")[1];
      const base64Data = base64Image.split(",")[1];
      msgParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const result = await chat.sendMessage(msgParts);
    let text = result.response.text();

    const call = result.response.functionCalls()?.[0];
    if (call && context.uid) {
      let funcResultData = { status: "success", message: "Action completed successfully." };
      
      try {
        if (call.name === "checkInEmployee") {
          const id = `${context.uid}_${today()}`;
          const ref = adminDb.collection("attendance").doc(id);
          const snap = await ref.get();
          const now = admin.firestore.Timestamp.now();
          if (!snap.exists) {
            await ref.set({
              userId: context.uid,
              date: today(),
              sessions: [{ checkIn: now, checkOut: null, durationMinutes: 0 }],
              totalMinutes: 0,
            });
            await adminDb.collection("users").doc(context.uid).update({ status: "ONLINE" });
          } else {
            const data = snap.data();
            const sessions = data?.sessions || [];
            const last = sessions[sessions.length - 1];
            if (!last || last.checkOut !== null) {
              await ref.update({
                sessions: [...sessions, { checkIn: now, checkOut: null, durationMinutes: 0 }]
              });
              await adminDb.collection("users").doc(context.uid).update({ status: "ONLINE" });
            }
          }
          funcResultData.message = "Successfully checked in the employee.";
        } 
        else if (call.name === "applyForLeave") {
          const args = call.args as any;
          await adminDb.collection("leaveRequests").add({
            uid: context.uid,
            userName: context.userName || "Unknown",
            userEmail: context.userEmail || "",
            leaveType: args.leaveType,
            fromDate: args.fromDate,
            toDate: args.toDate,
            reason: args.reason,
            status: "Pending",
            notificationRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          funcResultData.message = `Successfully submitted ${args.leaveType} leave request from ${args.fromDate} to ${args.toDate}.`;
        }
        else if (call.name === "logWorkUpdate") {
          const args = call.args as any;
          await adminDb.collection("workUpdates").add({
            uid: context.uid,
            userEmail: context.userEmail || "",
            userName: context.userName || "Unknown",
            todayTask: args.todayTask || "",
            nextTask: args.nextTask || "",
            blockers: args.blockers || "None",
            status: args.status || "Working Smoothly",
            productivity: args.productivity || "Normal",
            completionPercent: args.completionPercent || 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          if (args.taskId) {
            // 1. Log to the project management kanban (workLogs)
            await adminDb.collection("workLogs").add({
              userId: context.uid,
              userName: context.userName || context.userEmail || "Unknown",
              taskId: args.taskId,
              description: args.todayTask,
              hoursWorked: args.hoursWorked || 8,
              date: new Date().toISOString()
            });

            // 2. Update completion percent in the actual task
            if (args.completionPercent) {
              await adminDb.collection("projectTasks").doc(args.taskId).update({
                progress: args.completionPercent
              });
            }

            // 3. Log to the Employee Daily Sheets (dailyEntries)
            try {
              const pTaskSnap = await adminDb.collection("projectTasks").doc(args.taskId).get();
              if (pTaskSnap.exists) {
                const pTask = pTaskSnap.data() as any;
                const proj = context.assignedProjects?.find((p: any) => p.id === pTask.projectId);
                const projectName = proj ? proj.name : "Unknown Project";
                
                const newTaskEntry = {
                  id: "auto-" + Date.now(),
                  projectId: pTask.projectId || "",
                  projectName: projectName,
                  taskTitle: pTask.title || "",
                  description: args.todayTask,
                  hoursWorked: args.hoursWorked || 8,
                  workStatus: args.status === "Completed" ? "Completed" : "In Progress",
                  category: pTask.ticketType === "bug" ? "Bug Fixing" : "Development"
                };

                const todayStr = new Date().toISOString().split("T")[0];
                const viewMonth = todayStr.substring(0, 7);
                const qSnap = await adminDb.collection("dailyEntries")
                  .where("userId", "==", context.uid)
                  .where("date", "==", todayStr)
                  .get();

                if (qSnap.empty) {
                  await adminDb.collection("dailyEntries").add({
                    userId: context.uid,
                    userName: context.userName || context.userEmail || "Unknown",
                    userEmail: context.userEmail || "",
                    date: todayStr,
                    month: viewMonth,
                    tasks: [newTaskEntry],
                    totalHours: args.hoursWorked || 8,
                    status: "draft",
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                } else {
                  const docId = qSnap.docs[0].id;
                  const existingData = qSnap.docs[0].data();
                  await adminDb.collection("dailyEntries").doc(docId).update({
                    tasks: admin.firestore.FieldValue.arrayUnion(newTaskEntry),
                    totalHours: (existingData.totalHours || 0) + (args.hoursWorked || 8),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                }
              }
            } catch (err) {
              console.error("Failed to sync to Daily Sheets:", err);
            }
          }
          
          funcResultData.message = "Successfully saved the work update.";
        }
        else if (call.name === "createProjectTask") {
          const args = call.args as any;
          
          let assignedTo = null;
          let assignedToName = null;
          
          if (args.assigneeName) {
            const usersSnap = await adminDb.collection("users").get();
            const searchParts = args.assigneeName.toLowerCase().split(/\s+/);
            for (const doc of usersSnap.docs) {
              const u = doc.data();
              if (u.name) {
                const userNameLower = u.name.toLowerCase();
                // Check if all parts of the search name are present in the user's name
                const matches = searchParts.every((part: string) => userNameLower.includes(part));
                if (matches) {
                  assignedTo = doc.id;
                  assignedToName = u.name;
                  break;
                }
              }
            }
          }

          await adminDb.collection("projectTasks").add({
            projectId: args.projectId,
            ticketType: (args.ticketType || "task").toLowerCase(),
            title: args.title,
            description: args.description || "",
            priority: args.priority || "Medium",
            status: "new",
            createdBy: context.uid,
            createdByName: context.userName || "Unknown",
            assignedTo: assignedTo,
            assignedToName: assignedToName,
            assignedDate: assignedTo ? today() : null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          if (assignedToName) {
             funcResultData.message = `Successfully created the ${args.ticketType} '${args.title}' and assigned it to ${assignedToName}.`;
          } else {
             funcResultData.message = `Successfully created the ${args.ticketType} '${args.title}' in the project.`;
          }
        }
      } catch (err: any) {
        funcResultData = { status: "error", message: err.message };
      }

      // Send the function result back to the model
      const funcResult = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: funcResultData
        }
      }]);
      text = funcResult.response.text();
    }

    return NextResponse.json({ 
      text,
      workUpdateLogged: !!(call && call.name === "logWorkUpdate")
    });
  } catch (error: any) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "Failed to process chat request", details: error.message },
      { status: 500 }
    );
  }
}
