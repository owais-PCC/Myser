import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, getR2BucketName, receiptObjectKey } from '../lib/r2';
import { requireUser } from '../lib/requireUser';

/**
 * POST /api/receipt-upload-url — { docId, mimeType } -> { uploadUrl, key }
 *
 * Returns a short-lived presigned R2 PUT URL. The client uploads the image
 * bytes directly to R2 with that URL — the image never passes through this
 * function's body, same reasoning as why the LLM scan endpoint takes
 * base64 in the body but this one deliberately doesn't (receipt photos are
 * much larger and this is a background backup write, not blocking on a
 * model response).
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

  const auth = await requireUser(req);
  if ('error' in auth) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { docId, mimeType } = (req.body ?? {}) as { docId?: number; mimeType?: string };
  if (!docId || !mimeType) {
    res.status(400).json({ error: 'invalid-argument', message: 'docId and mimeType are required.' });
    return;
  }

  try {
    const key = receiptObjectKey(auth.uid, docId, mimeType);
    const command = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });
    res.status(200).json({ uploadUrl, key });
  } catch (err) {
    res.status(500).json({ error: 'internal', message: (err as Error).message });
  }
}
