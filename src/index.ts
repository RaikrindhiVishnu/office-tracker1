import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const biometricWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log("Device Data:", req.body);

    const empCode = req.body.empCode || req.body.userid;
    const time = req.body.time || req.body.timestamp;

    if (!empCode || !time) {
      return res.status(400).send("Invalid Data");
    }

    const punchTime = new Date(time);
    const date = punchTime.toISOString().split("T")[0];

    // Store raw log
    await db.collection("biometricLogs").add({
      empCode,
      punchTime,
      createdAt: new Date()
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
        checkOut: null
      });
    } else {
      const doc = snapshot.docs[0];

      if (!doc.data().checkOut) {
        await doc.ref.update({
          checkOut: punchTime
        });
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error");
  }
});