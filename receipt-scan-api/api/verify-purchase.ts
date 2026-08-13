import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
// getFirestore from 'firebase-admin/firestore' — import it when implementing
// the tier-grant write below (see the TODOs); left out for now so an
// unused import doesn't sit in a file that intentionally does nothing yet.
import { getFirebaseAdminApp } from '../lib/firebaseAdmin';

/**
 * POST /api/verify-purchase — the ONLY place `tier: 'pro'` may legally get
 * set from a purchase. NOT implemented yet — this is the scaffold the iOS
 * engineer completes; see IOS_SPECS_HANDOVER.md for the full spec.
 *
 * Why this has to be server-side at all: a client-side "purchase succeeded,
 * set tier=pro" write is trivially forgeable (anyone can call
 * setDoc(doc('users/x'), {tier:'pro'}) from a modified client or devtools).
 * The only trustworthy signal is a receipt/token the OS itself signed,
 * verified against Apple's or Google's own servers — which can only
 * reasonably happen here, not in the app.
 *
 * Request body (client sends after StoreKit/Play Billing reports success):
 *   { platform: 'ios' | 'android', receiptData: string }
 *   - iOS: the base64 App Store receipt (or, for StoreKit 2, a signed
 *     transaction JWS) from the completed purchase.
 *   - Android: the purchase token from Play Billing's Purchase object.
 *
 * TODO(iOS engineer) — iOS verification:
 *   1. POST receiptData to Apple's verifyReceipt endpoint:
 *      https://buy.itunes.apple.com/verifyReceipt (production)
 *      https://sandbox.itunes.apple.com/verifyReceipt (sandbox — Apple
 *      recommends always trying production first, retrying against
 *      sandbox on status 21007)
 *      Body: { "receipt-data": receiptData, "password": <App-Specific
 *      Shared Secret from App Store Connect > Users and Access > Keys >
 *      In-App Purchase, or per-app in Subscriptions settings> }
 *   2. Confirm response.status === 0 and the receipt's product_id matches
 *      the real Pro subscription product ID (set up in App Store Connect
 *      first — doesn't exist yet).
 *   3. (StoreKit 2 alternative, generally preferred over the legacy
 *      receipt API above): verify the signed transaction JWS using
 *      Apple's public keys — see Apple's AppTransaction/Transaction
 *      verification docs.
 *
 * TODO(iOS engineer) — Android verification:
 *   1. Use the Google Play Developer API
 *      (androidpublisher.purchases.subscriptions.get or
 *      .products.get for one-time products) with a Google Cloud service
 *      account that has been granted access in Play Console > Setup >
 *      API access. Needs a new service account + JSON key — separate
 *      from the Firebase one already in use, different Google Cloud
 *      product.
 *   2. Confirm purchaseState === 0 (purchased) and the product ID matches
 *      the real Pro product (doesn't exist in Play Console yet either).
 *
 * Once verification succeeds on either platform: set `tier: 'pro'` on
 * `users/{uid}` the same way scripts/grant-tier.js does, plus whatever
 * subscription-period bookkeeping is needed to know when to check renewal
 * (App Store Server Notifications / Real-time Developer Notifications on
 * Android are the push-based alternative to polling — recommended once
 * this is live, not required for a first working version).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  getFirebaseAdminApp();
  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid;
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const { platform, receiptData } = (req.body ?? {}) as { platform?: string; receiptData?: string };
  if (platform !== 'ios' && platform !== 'android') {
    res.status(400).json({ error: 'invalid-argument', message: 'platform must be "ios" or "android".' });
    return;
  }
  if (!receiptData) {
    res.status(400).json({ error: 'invalid-argument', message: 'receiptData is required.' });
    return;
  }

  // Intentionally not implemented — see the TODOs above. Returning 501
  // rather than silently granting tier so this fails loudly if wired up
  // to the client before the real verification is written, instead of
  // handing out free Pro access to anyone who calls this endpoint.
  res.status(501).json({
    error: 'not-implemented',
    uid,
    platform,
    message:
      'Receipt verification is not implemented yet — this is a scaffold. See the TODO comments in this file and IOS_SPECS_HANDOVER.md.',
  });
}
