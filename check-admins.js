const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
  const snapshot = await db.collection('users').where('accountType', '==', 'ADMIN').get();
  const admins = snapshot.docs.map(d => d.data());
  console.log('Admins found:', admins.length);
  admins.forEach(a => console.log(a.email));
}
run();
