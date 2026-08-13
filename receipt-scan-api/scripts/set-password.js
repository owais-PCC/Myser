// One-off: set/update a Firebase Auth user's password directly via the
// admin SDK. Works even if the account was originally created via
// Google Sign-In only (no password set) — the admin SDK can add
// email/password as an additional sign-in method for any existing user.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/set-password.js <email> <password>');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password });
  console.log(`Password set for ${email} (${user.uid}).`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message || err); process.exit(1); });
