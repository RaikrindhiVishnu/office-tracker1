import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccountPath = path.join(
  process.cwd(),
  "secrets",
  "firebase-admin.json"
);

console.log("Loading service account from:", serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf8")
      )
    ),
  });
}

export default admin;
