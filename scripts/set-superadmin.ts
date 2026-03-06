// scripts/set-superadmin.ts
// Run: npx tsx scripts/set-superadmin.ts

import * as admin from "firebase-admin";

// ✅ Put your service account JSON file in the scripts/ folder
// and rename it to serviceAccount.json
import serviceAccount from "./serviceAccount.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAIL = "madhurikatnam@techgyinnovations.com";

async function setSuperAdmin() {
  console.log(`\n🔍 Looking up user: ${SUPER_ADMIN_EMAIL}`);

  const userRecord = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
  const uid = userRecord.uid;
  console.log(`✅ Found user: ${uid}`);

  await auth.setCustomUserClaims(uid, {
    superAdmin: true,
    companyId: null,
    role: "superadmin",
  });
  console.log(`✅ Custom claim set: superAdmin = true`);

  await db.doc(`superAdmin/${uid}`).set(
    {
      email: SUPER_ADMIN_EMAIL,
      uid,
      platformName: "TechGy SaaS Platform",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✅ superAdmin/${uid} document created`);
  console.log(`\n🎉 Done! Run next: npx tsx scripts/migrate-phase1.ts`);
  process.exit(0);
}

setSuperAdmin().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});