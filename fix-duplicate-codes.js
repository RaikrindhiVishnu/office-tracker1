const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });
}

const db = admin.firestore();

const TYPE_PREFIX = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };

async function run() {
  const snapshot = await db.collection('projectTasks').get();
  
  // Group by project ID
  const tasksByProject = {};
  snapshot.docs.forEach(doc => {
      const data = doc.data();
      const pid = data.projectId;
      if (!pid) return;
      if (!tasksByProject[pid]) tasksByProject[pid] = [];
      tasksByProject[pid].push({ id: doc.id, data, ref: doc.ref });
  });

  let updated = 0;

  for (const pid in tasksByProject) {
      const projectTasks = tasksByProject[pid];
      
      // Sort tasks by createdAt so older tasks get smaller numbers
      projectTasks.sort((a, b) => {
          const timeA = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
          const timeB = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
          return timeA - timeB;
      });

      const counters = { STR: 1, TSK: 1, BUG: 1, DEF: 1 };

      for (const task of projectTasks) {
          const type = (task.data.ticketType || "task").toLowerCase();
          const prefix = TYPE_PREFIX[type] || "TSK";
          
          const newCode = `${prefix}-${counters[prefix].toString().padStart(3, "0")}`;
          counters[prefix]++;

          if (task.data.taskCode !== newCode) {
              console.log(`Updating [Project ${pid}] ${task.id}: ${task.data.taskCode} -> ${newCode}`);
              await task.ref.update({ taskCode: newCode });
              updated++;
          }
      }
  }

  console.log(`Updated ${updated} tasks to fix duplicate codes.`);
}

run().catch(console.error);
