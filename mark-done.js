const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

async function markAllDone() {
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Using default application credentials.");
      initializeApp();
    }

    const db = getFirestore();
    const tasksSnapshot = await db.collection("projectTasks").get();
    
    let count = 0;
    const batch = db.batch();
    
    tasksSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.status !== "done" && data.status !== "Completed") {
        batch.update(doc.ref, { 
          status: "done",
          updatedAt: new Date()
        });
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
    }
    
    console.log(`Success: Updated ${count} tasks to done.`);
  } catch (error) {
    console.error("Error updating tasks:", error);
  }
}

markAllDone();
