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

async function run() {
  const usersSnap = await db.collection('users').get();
  console.log("Users:");
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.name?.toLowerCase().includes('vishnu') || data.email?.toLowerCase().includes('vishnu')) {
        console.log(`- ${doc.id}: ${data.name} (${data.email})`);
    }
  });

  const projSnap = await db.collection('projects').get();
  console.log("\nProjects:");
  projSnap.forEach(doc => {
    console.log(`- ${doc.id}: ${doc.data().name}`);
  });
}

run().catch(console.error);
