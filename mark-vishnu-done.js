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

const vishnuId = "mbfGvKJ5YUUHyyD8x39HPFwq5wB3";
const targetProjectId = "NC5bawFtdDoaqiMQxpCK"; // office tracker

async function run() {
  console.log("Fetching tasks for Office Tracker & Vishnu...");
  const snap = await db.collection('projectTasks')
    .where("projectId", "==", targetProjectId)
    .get();

  let count = 0;
  const batch = db.batch();

  snap.forEach(doc => {
      const data = doc.data();
      if (data.assignedTo === vishnuId && data.status !== "done" && data.status !== "Completed") {
          batch.update(doc.ref, { status: "done", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          count++;
      }
  });

  if (count > 0) {
      await batch.commit();
      console.log(`Successfully moved ${count} tasks to Done!`);
  } else {
      console.log("No tasks found that needed updating. They might already be done.");
  }
}

run().catch(console.error);
