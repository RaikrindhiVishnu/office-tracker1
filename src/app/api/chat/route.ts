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
  description: "Save a daily work update or task progress for the employee.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      task: { type: SchemaType.STRING, description: "The title of the task worked on" },
      notes: { type: SchemaType.STRING, description: "Additional details about progress or blockers" },
      status: { type: SchemaType.STRING, description: "Status: In Progress, Completed, In Review" },
      priority: { type: SchemaType.STRING, description: "Priority: Low, Medium, High" },
    },
    required: ["task", "notes", "status"]
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

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function POST(request: Request) {
  try {
    const { message, context, history = [] } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      tools: [{
        functionDeclarations: [checkInDeclaration, applyLeaveDeclaration, logWorkUpdateDeclaration, createProjectTaskDeclaration]
      }]
    });

    const systemInstruction = `
      You are an AI HR Assistant and Office Manager named "Tracker Bot" built directly into the Office Tracker application.
      You are speaking with an employee named ${context?.userName || "there"}.
      
      Here is their current status for today:
      - Have they checked in for attendance today? ${context?.hasCheckedIn ? "Yes" : "No"}
      - Have they submitted their daily work update yet? ${context?.hasWorkUpdate ? "Yes" : "No"}
      
      Your goal is to be helpful, professional, and friendly. 
      You have tools available to check them in, apply for leave, log their work updates, and create project tasks.
      If they ask you to perform one of these actions, use the tool.
      If they ask about their projects, they are assigned to these projects (in JSON format): ${JSON.stringify(context?.assignedProjects || [])}. Use the 'id' field from this array when calling createProjectTask.
      Keep your responses concise and formatted nicely using markdown if needed.
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

    const result = await chat.sendMessage(message);
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
            task: args.task,
            notes: args.notes,
            status: args.status,
            priority: args.priority || "Medium",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
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

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "Failed to process chat request", details: error.message },
      { status: 500 }
    );
  }
}
