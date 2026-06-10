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
  const snap = await db.collection('projectTasks').where("projectId", "==", targetProjectId).where("ticketType", "==", "story").get();
  
  let stories = [];
  snap.forEach(doc => {
      const data = doc.data();
      stories.push({id: doc.id, code: data.taskCode, title: data.title});
  });

  stories.sort((a,b) => (a.code || "").localeCompare(b.code || ""));
  stories.forEach(s => {
      console.log(`${s.code} | ${s.id} | ${s.title}`);
  });
}

run().catch(console.error);
