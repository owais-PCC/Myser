import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../../lib/firebaseAdmin';
import { requireExecutive } from '../../lib/adminAuth';

const VALID_TIERS = ['free', 'pro', 'executive'];

/**
 * POST /api/admin/set-tier — { uid, tier } — the web equivalent of
 * scripts/grant-tier.js. Executive-tier-only (see lib/adminAuth.ts).
 *
 * Same behavior as the script: moving someone to 'free' also clears
 * hasUsedFreeItemizedScan, so downgrading doesn't leave them stuck with
 * their one-time free scan already marked spent from whatever tier they
 * were on before.
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

  getFirebaseAdminApp();
  const auth = await requireExecutive(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { uid, tier } = (req.body ?? {}) as { uid?: string; tier?: string };
  if (!uid || !tier || !VALID_TIERS.includes(tier)) {
    res.status(400).json({ error: 'invalid-argument', message: 'uid and a valid tier are required.' });
    return;
  }

  const ref = getFirestore().doc(`users/${uid}`);
  await ref.set(
    {
      tier,
      tierGrantedAt: FieldValue.serverTimestamp(),
      tierGrantedBy: auth.uid,
      ...(tier === 'free' ? { hasUsedFreeItemizedScan: false } : {}),
    },
    { merge: true }
  );

  res.status(200).json({ ok: true, uid, tier });
}
