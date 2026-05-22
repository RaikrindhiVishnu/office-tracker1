const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkTasks() {
  const projectsSnap = await db.collection('projects').where('title', '==', 'GLC - Role Manager').get();
  if (projectsSnap.empty) {
    console.log("Project 'GLC - Role Manager' not found.");
    
    // search for partial match
    const allProj = await db.collection('projects').get();
    let found = false;
    allProj.forEach(p => {
      if (p.data().title.includes("Role")) {
        console.log("Found project:", p.data().title, p.id);
        found = true;
      }
    });
    if (!found) return;
  }
  
  let projectId;
  projectsSnap.forEach(p => { projectId = p.id; });
  console.log("Project ID:", projectId);
  
  const tasksSnap = await db.collection('tasks').where('projectId', '==', projectId).get();
  console.log("Total tasks found:", tasksSnap.size);
  
  let bugsCount = 0;
  let doneCount = 0;
  
  tasksSnap.forEach(doc => {
    const task = doc.data();
    if (task.ticketType === 'bug') bugsCount++;
    if (task.status === 'done' || task.status === 'completed') doneCount++;
    
    if (task.ticketType === 'bug') {
        console.log("BUG Task:", task.id, "Title:", task.title, "Status:", task.status);
    }
  });
  
  console.log("Bugs count:", bugsCount);
  console.log("Done count:", doneCount);
  
  // also group by status
  let statusCounts = {};
  tasksSnap.forEach(doc => {
      const task = doc.data();
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });
  console.log("Status distribution:", statusCounts);
}

checkTasks().catch(console.error);
