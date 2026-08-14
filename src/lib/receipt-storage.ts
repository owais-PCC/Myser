// Cross-device receipt-image backup (Cloudflare R2). This replaces the
// syncDocumentUpload() Firebase-Storage path in firestore-sync.ts, which
// was built but never wired up — Firebase Storage needs the Blaze plan,
// same paywall that blocked Cloud Functions. R2 has a real free tier
// (10GB, zero egress) with no card required.
//
// Local-first is unchanged: the receipt image is already saved to
// IndexedDB the moment it's captured (see db.ts's saveDocumentData) and
// that stays the source of truth on-device. This module is purely an
// additive background backup — its failure must never block or roll back
// anything the user is doing.
//
// The backend never sees the image bytes: it hands back a short-lived
// presigned R2 URL and the client PUTs/GETs directly against R2.

import { auth } from './firebase';

// Sibling endpoints of the scan URL, derived the same way itemized-scan.ts
// derives PROVIDERS_API_URL/USAGE_API_URL — one URL to configure, no way
// for these to point at a different deployment by mistake.
const RECEIPT_SCAN_API_URL = process.env.NEXT_PUBLIC_RECEIPT_SCAN_API_URL;
const UPLOAD_URL_ENDPOINT = RECEIPT_SCAN_API_URL ? RECEIPT_SCAN_API_URL.replace(/\/[^/]*$/, '/receipt-upload-url') : '';
const DOWNLOAD_URL_ENDPOINT = RECEIPT_SCAN_API_URL ? RECEIPT_SCAN_API_URL.replace(/\/[^/]*$/, '/receipt-download-url') : '';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Fire-and-forget from the caller's point of view — logs and swallows any
 * failure rather than throwing, since a failed backup upload must never
 * surface as an error to the user or block the (already-complete) local
 * save. Returns the R2 object key on success so it can be stored on the
 * local document row (`storage_path`), or null if the upload didn't
 * happen (not signed in, R2 not configured, or the request failed).
 */
export async function backupReceiptToR2(docId: number, base64: string, mimeType: string): Promise<string | null> {
  if (!UPLOAD_URL_ENDPOINT) return null;
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(UPLOAD_URL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ docId, mimeType }),
    });
    if (!res.ok) return null;
    const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: base64ToBlob(base64, mimeType),
    });
    if (!putRes.ok) return null;
    return key;
  } catch {
    return null;
  }
}

/** Resolves a stored R2 key to a short-lived, directly-fetchable URL. */
export async function getReceiptDownloadUrl(key: string): Promise<string | null> {
  if (!DOWNLOAD_URL_ENDPOINT) return null;
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`${DOWNLOAD_URL_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const { downloadUrl } = (await res.json()) as { downloadUrl: string };
    return downloadUrl;
  } catch {
    return null;
  }
}
