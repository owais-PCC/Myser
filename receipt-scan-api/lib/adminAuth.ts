import type { VercelRequest } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebaseAdmin';

/**
 * Shared gate for the admin endpoints (list users, change tier) — verifies
 * the caller's Firebase ID token AND that their own account is already on
 * the executive tier. This is the same trust boundary as
 * receipt-scan-api/scripts/grant-tier.js, just reachable from a browser
 * instead of a terminal: whoever can already grant themselves/others
 * unlimited access via that script can now do it from a web page too, and
 * nobody else can, because there's no other way to become executive in
 * the first place (see quota.ts's header comment).
 */
export type AdminAuthResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireExecutive(req: VercelRequest): Promise<AdminAuthResult> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }

  getFirebaseAdminApp();
  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid;
  } catch {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }

  const snap = await getFirestore().doc(`users/${uid}`).get();
  if (snap.data()?.tier !== 'executive') {
    return { ok: false, status: 403, error: 'permission-denied' };
  }

  return { ok: true, uid };
}
