/**
 * Operator tool — sets a user's billing tier by email address.
 *
 * This is the ONLY way to create an executive (unlimited) account. There is
 * deliberately no in-app path: no UI, no purchase flow, and Firestore rules
 * must never let a client write its own `tier`, or "unlimited AI" would be
 * one devtools edit away for anybody.
 *
 * Usage (from receipt-scan-api/):
 *   node scripts/grant-tier.js <email> <free|pro|executive>
 *
 * Examples:
 *   node scripts/grant-tier.js businessmail820@gmail.com executive
 *   node scripts/grant-tier.js someone@example.com pro
 *   node scripts/grant-tier.js someone@example.com free      # revoke
 *
 * Requires FIREBASE_SERVICE_ACCOUNT in .env.local (the admin credential —
 * see README). Run it from a machine you control, never from the app.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

const VALID_TIERS = ['free', 'pro', 'executive'];

const [email, tier] = process.argv.slice(2);

if (!email || !tier) {
  console.error('Usage: node scripts/grant-tier.js <email> <free|pro|executive>');
  process.exit(1);
}
if (!VALID_TIERS.includes(tier)) {
  console.error(`Invalid tier "${tier}". Must be one of: ${VALID_TIERS.join(', ')}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  const ref = admin.firestore().doc(`users/${user.uid}`);
  const before = (await ref.get()).data() || {};

  await ref.set(
    {
      tier,
      tierGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Clearing the lifetime free-scan flag matters when moving someone
      // *down* to free: without it they'd land on the free tier with their
      // one free scan already spent.
      ...(tier === 'free' ? { hasUsedFreeItemizedScan: false } : {}),
    },
    { merge: true }
  );

  console.log(`${email} (${user.uid})`);
  console.log(`  tier: ${before.tier || 'free (unset)'} -> ${tier}`);
  if (tier === 'executive') {
    console.log('  unlimited itemized scans; usage still counted for cost visibility');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
