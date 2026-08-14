import { S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 client (S3-compatible API). This replaces the
 * Firebase-Storage-based syncDocumentUpload() that was built earlier but
 * never wired up — Firebase Storage requires the Blaze plan (same paywall
 * that blocked Cloud Functions and drove the Vercel pivot for the LLM
 * backend), while R2 has a real free tier (10GB storage, zero egress fees)
 * with no card required.
 *
 * Env vars (Vercel project settings, not committed):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */
let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 is not configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).');
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME is not set.');
  return bucket;
}

/**
 * Every object key is scoped under the owning user's uid so a leaked key
 * for one user's receipt can't be walked/guessed into another's — enforced
 * again server-side in receipt-download-url.ts, not just by convention.
 */
export function receiptObjectKey(uid: string, docId: number, mimeType: string): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return `users/${uid}/receipts/${docId}.${ext}`;
}
