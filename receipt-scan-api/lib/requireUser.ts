import type { VercelRequest } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from './firebaseAdmin';

/**
 * Shared "is this a signed-in user" check — the same verifyIdToken logic
 * scan-receipt-itemized.ts has inline, pulled out here since the R2
 * upload/download endpoints need the identical check.
 */
export async function requireUser(req: VercelRequest): Promise<{ uid: string } | { error: string; status: number }> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) return { error: 'unauthenticated', status: 401 };

  getFirebaseAdminApp();
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return { error: 'unauthenticated', status: 401 };
  }
}
