import { NextResponse } from "next/server";
import { collection, getDocs, doc, writeBatch, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET(req: Request) {
  try {
    // Find the user "raikrindhi vishnu"
    const usersSnap = await getDocs(collection(db, "users"));
    let targetUid: string | null = null;
    let targetName = "";
    
    usersSnap.forEach(d => {
      const u = d.data();
      const name = (u.displayName || u.name || "").toLowerCase();
      if (name.includes("raikrindhi") || name.includes("vishnu")) {
        targetUid = u.uid;
        targetName = name;
      }
    });

    if (!targetUid) {
      return NextResponse.json({ error: "Could not find raikrindhi vishnu" });
    }

    // Find the project "office tracker"
    const projectsSnap = await getDocs(collection(db, "projects"));
    let targetProjectId = null;
    projectsSnap.forEach(d => {
      const p = d.data();
      if ((p.name || "").toLowerCase().includes("office tracker")) {
        targetProjectId = d.id;
      }
    });

    if (!targetProjectId) {
      return NextResponse.json({ error: "Could not find office tracker project" });
    }

    // Find all tasks for this project & user
    const tasksSnap = await getDocs(query(
      collection(db, "projectTasks"),
      where("projectId", "==", targetProjectId)
    ));
    
    let count = 0;
    const batch = writeBatch(db);
    
    tasksSnap.forEach((document) => {
      const data = document.data();
      if (
        data.assignedTo === targetUid && 
        data.status !== "done" && 
        data.status !== "Completed"
      ) {
        batch.update(doc(db, "projectTasks", document.id), { status: "done" });
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated ${count} tasks to done for user ${targetName} in Office Tracker.` 
    });
  } catch (error: any) {
    console.error("mark-done error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
