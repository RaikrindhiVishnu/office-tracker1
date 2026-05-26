require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
  storageBucket
});

async function run() {
  try {
    const bucket = admin.storage().bucket();
    const corsConfig = [
      {
        origin: ["*"],
        method: ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
        responseHeader: ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
        maxAgeSeconds: 3600
      }
    ];
    await bucket.setCorsConfiguration(corsConfig);
    console.log("Successfully set CORS for bucket: " + bucket.name);
  } catch (error) {
    console.error("Error setting CORS:", error);
  }
}

run();
