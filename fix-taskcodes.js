const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  })
});

const db = admin.firestore();

const TYPE_PREFIX = { story: "STR", task: "TSK", bug: "BUG", defect: "DEF" };

async function run() {
  const snapshot = await db.collection('projectTasks').get();
  console.log("Total tasks:", snapshot.size);
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const type = (data.ticketType || "task").toLowerCase();
    const expectedPrefix = TYPE_PREFIX[type] || "TSK";
    if (data.taskCode && !data.taskCode.startsWith(expectedPrefix)) {
        const numPart = data.taskCode.split("-")[1] || "001";
        const newCode = `${expectedPrefix}-${numPart}`;
        console.log(`Updating ${doc.id} (Type: ${type}): ${data.taskCode} -> ${newCode}`);
        await doc.ref.update({ taskCode: newCode });
        updated++;
    }
  }
  console.log(`Updated ${updated} tasks.`);
}

run().catch(console.error);
