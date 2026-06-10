require("dotenv").config({ path: ".env.local" }); // try .env.local first
require("dotenv").config(); // fallback to .env
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase credentials in .env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    })
  });
}

const db = getFirestore();

async function fix() {
  const uid = "Lswc7OV9oaf45xVxkDGvZn08l4k1";
  const email = "bhanujabodapati@gmail.com";
  
  await db.collection("users").doc(uid).set({
    uid,
    email,
    name: "Bhanuja Bodapati",
    accountType: "EMPLOYEE",
    role: "EMPLOYEE",
    department: "SALES",
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    status: "ONLINE"
  }, { merge: true });
  
  console.log("Fixed user profile successfully!");
}

fix().then(() => process.exit(0)).catch(console.error);
