// One-off: reset the itemized-scan quota flags for a specific test
// account so it can be reused for repeated manual testing. NOT part of
// the app; never touches real user accounts unless explicitly targeted.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const TARGET_EMAIL = 'test2@test.com';

async function main() {
  const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
  const ref = admin.firestore().doc(`users/${user.uid}`);
  await ref.set({
    hasUsedFreeItemizedScan: false,
    itemizedScansUsedThisMonth: 0,
  }, { merge: true });
  const snap = await ref.get();
  console.log(`Reset quota for ${TARGET_EMAIL} (${user.uid}). New state:`, snap.data());
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
