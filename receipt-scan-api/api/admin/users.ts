import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../../lib/firebaseAdmin';
import { requireExecutive } from '../../lib/adminAuth';

/**
 * GET /api/admin/users — every Firebase Auth user on this project, merged
 * with their tier/quota profile from Firestore. Executive-tier-only (see
 * lib/adminAuth.ts). This is what previously required running
 * scripts/investigate.js by hand.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  getFirebaseAdminApp();
  const auth = await requireExecutive(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  // listUsers paginates at 1000/page — this project has a handful of
  // users, but loop properly rather than assuming it always will.
  const authUsers: { uid: string; email: string | null; createdAt: string }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const u of page.users) {
      authUsers.push({ uid: u.uid, email: u.email ?? null, createdAt: u.metadata.creationTime });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  const db = getFirestore();
  const profiles = await Promise.all(
    authUsers.map(async (u) => {
      const snap = await db.doc(`users/${u.uid}`).get();
      const data = snap.data() ?? {};
      return {
        uid: u.uid,
        email: u.email,
        createdAt: u.createdAt,
        tier: data.tier === 'executive' || data.tier === 'pro' ? data.tier : 'free',
        hasUsedFreeItemizedScan: data.hasUsedFreeItemizedScan === true,
        itemizedScansUsedThisMonth: Number(data.itemizedScansUsedThisMonth) || 0,
        itemizedScansMonthKey: data.itemizedScansMonthKey ?? null,
      };
    })
  );

  res.status(200).json({ users: profiles });
}
