import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, getR2BucketName } from '../lib/r2';
import { requireUser } from '../lib/requireUser';

/**
 * GET /api/receipt-download-url?key=... -> { downloadUrl }
 *
 * The uid check below (key must start with `users/{uid}/`) is the real
 * access control, not the object key's obscurity — receiptObjectKey()
 * scopes every key under its owner's uid specifically so this check is
 * possible and meaningful, not just a convention.
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

  const auth = await requireUser(req);
  if ('error' in auth) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const key = req.query.key;
  if (typeof key !== 'string' || !key.startsWith(`users/${auth.uid}/`)) {
    res.status(403).json({ error: 'permission-denied' });
    return;
  }

  try {
    const command = new GetObjectCommand({ Bucket: getR2BucketName(), Key: key });
    const downloadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });
    res.status(200).json({ downloadUrl });
  } catch (err) {
    res.status(500).json({ error: 'internal', message: (err as Error).message });
  }
}
