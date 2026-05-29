const admin = require("firebase-admin");
require("dotenv").config({ path: ".env.local" });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

async function fixTasks() {
  const snap = await db.collection("projectTasks").where("status", "==", "todo").get();
  let count = 0;
  for (const doc of snap.docs) {
    await doc.ref.update({ status: "new" });
    count++;
  }
  console.log(`Fixed ${count} tasks.`);
  process.exit(0);
}

fixTasks().catch(console.error);
