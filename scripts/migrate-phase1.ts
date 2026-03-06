// scripts/migrate-phase1.ts
// Run: npx tsx scripts/migrate-phase1.ts

import * as admin from "firebase-admin";
import serviceAccount from "./serviceAccount.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

const COMPANY_ID = "company_techgy";
const COMPANY_NAME = "TechGy Innovations";
const OWNER_EMAIL = "madhurikatnam@techgyinnovations.com";

async function migrate() {
  console.log("\n🚀 Phase 1 Migration Starting...\n");

  // Step 1: Create company document
  console.log(`📁 Creating companies/${COMPANY_ID}...`);
  await db.doc(`companies/${COMPANY_ID}`).set(
    {
      name: COMPANY_NAME,
      status: "active",
      plan: "enterprise",
      ownerEmail: OWNER_EMAIL,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✅ Company document created\n`);

  // Step 2: Read all users from old path
  console.log(`👥 Reading users from users/ collection...`);
  const usersSnap = await db.collection("users").get();
  console.log(`   Found ${usersSnap.size} users\n`);

  let migrated = 0;
  let skipped = 0;
  let claimsSet = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    if (data.email === OWNER_EMAIL) {
      console.log(`⏭️  Skipping Super Admin: ${data.email}`);
      skipped++;
      continue;
    }

    console.log(`   Migrating: ${data.name || "Unknown"} (${data.email})`);

    await db.doc(`companies/${COMPANY_ID}/users/${uid}`).set(
      {
        ...data,
        companyId: COMPANY_ID,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    try {
      const role = (data.accountType || "EMPLOYEE").toLowerCase();
      await auth.setCustomUserClaims(uid, {
        superAdmin: false,
        companyId: COMPANY_ID,
        role,
      });
      claimsSet++;
    } catch (err: any) {
      console.warn(`   ⚠️  Claims failed for ${uid}: ${err.message}`);
    }

    migrated++;
  }

  await db.doc(`companies/${COMPANY_ID}`).update({ employeeCount: migrated });

  console.log(`\n✅ Migration complete!`);
  console.log(`   Migrated: ${migrated} users`);
  console.log(`   Claims set: ${claimsSet}`);
  console.log(`   Skipped: ${skipped} (Super Admin)`);
  console.log(`\n🎉 Now restart dev server and test!`);

  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});