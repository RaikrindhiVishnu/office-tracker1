import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)
    ),
  });
}

if (req.method === "GET") {
  return res.status(200).send("OK");
}

const db = admin.firestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const empCode = req.body.empCode || req.body.empcode || req.body.userid;
    const time = req.body.time || req.body.timestamp;

    if (!empCode || !time) {
      return res.status(400).send("Invalid Data");
    }

    const punchTime = new Date(time);
    const date = punchTime.toISOString().split("T")[0];

    // Save raw log
    await db.collection("biometricLogs").add({
      empCode,
      punchTime,
      createdAt: new Date(),
    });

    // Check attendance
    const snapshot = await db
      .collection("attendance")
      .where("empCode", "==", empCode)
      .where("date", "==", date)
      .get();

    if (snapshot.empty) {
      await db.collection("attendance").add({
        empCode,
        date,
        checkIn: punchTime,
        checkOut: null,
      });
    } else {
      const doc = snapshot.docs[0];
      if (!doc.data().checkOut) {
        await doc.ref.update({
          checkOut: punchTime,
        });
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
}