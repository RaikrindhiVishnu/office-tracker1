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
const targetProjectId = "NC5bawFtdDoaqiMQxpCK";

async function run() {
  const snap = await db.collection('projectTasks').where("projectId", "==", targetProjectId).get();
  
  let stories = [];
  let tasks = [];
  snap.forEach(doc => {
      const data = doc.data();
      if (data.ticketType === 'story') {
          stories.push({id: doc.id, code: data.taskCode, title: data.title});
      } else {
          tasks.push({id: doc.id, code: data.taskCode, parentStoryId: data.parentStoryId});
      }
  });

  console.log("Existing Stories (First 10):");
  stories.sort((a,b) => a.code.localeCompare(b.code)).slice(0, 10).forEach(s => {
      const taskCount = tasks.filter(t => t.parentStoryId === s.id).length;
      console.log(`- ${s.code}: ${s.title} (Tasks: ${taskCount})`);
  });
}

run().catch(console.error);
