// One-off investigation script — NOT part of the app. Checks Firestore
// directly using the admin service account to answer two questions
// concretely instead of guessing:
//   1. Was the free itemized scan already consumed, and when?
//   2. Is the user's transaction/category history still present in
//      Firestore (cloud backup), even if local app storage looks empty?
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const auth = admin.auth();
  const db = admin.firestore();

  const userList = await auth.listUsers(50);
  console.log(`Found ${userList.users.length} Firebase Auth user(s):\n`);

  for (const u of userList.users) {
    console.log(`- ${u.email || '(no email)'} | uid: ${u.uid} | created: ${u.metadata.creationTime}`);
  }

  console.log('\n--- Per-user Firestore inspection ---\n');

  for (const u of userList.users) {
    console.log(`\n=== ${u.email || u.uid} ===`);

    // 1. Tier/quota profile doc
    const profileSnap = await db.doc(`users/${u.uid}`).get();
    if (profileSnap.exists) {
      console.log('  users/{uid} doc:', JSON.stringify(profileSnap.data(), (k, v) =>
        v && v._seconds !== undefined ? new Date(v._seconds * 1000).toISOString() : v
      ));
    } else {
      console.log('  users/{uid} doc: does not exist');
    }

    // 2. Transaction/category counts (the actual "historical data")
    const txSnap = await db.collection(`users/${u.uid}/transactions`).get();
    const catSnap = await db.collection(`users/${u.uid}/categories`).get();
    const budgetSnap = await db.collection(`users/${u.uid}/budgets`).get();
    console.log(`  transactions: ${txSnap.size} | categories: ${catSnap.size} | budgets: ${budgetSnap.size}`);

    if (txSnap.size > 0) {
      const sample = txSnap.docs.slice(0, 3).map((d) => d.data());
      console.log('  sample transactions:', JSON.stringify(sample));
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
