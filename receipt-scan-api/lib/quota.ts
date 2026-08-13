import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebaseAdmin';

/**
 * Enforces the itemized-scan quota server-side (see TICKETS.md MYS-10).
 * Unchanged in substance from the original Firebase Cloud Function version
 * — this MUST live server-side regardless of which server it's running on,
 * since a local flag on the client is trivially resettable by clearing app
 * data. Reads/writes the same `users/{uid}` Firestore document the client
 * reads via src/lib/firestore-sync.ts's getUserProfile() — moving the
 * backend off Firebase Cloud Functions changes nothing about where this
 * data lives, only what compute is running the check.
 *
 * free tier:       exactly 1 itemized scan, lifetime, ever.
 * pro tier:        up to PRO_MONTHLY_SCAN_CAP scans, resetting each calendar
 *                  month.
 * executive tier:  unlimited, never blocked. For the project owner and any
 *                  internal/test accounts that need to exercise the paid
 *                  path without paying. Deliberately NOT reachable from the
 *                  app — there is no UI, no purchase flow, and no client
 *                  write that can produce it; the only way in is an
 *                  operator running scripts/grant-tier.js with the Firebase
 *                  admin credentials. Usage is still counted so an
 *                  executive account's real cost stays visible.
 */

const PRO_MONTHLY_SCAN_CAP = 50;

export type UserTier = 'free' | 'pro' | 'executive';

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; reason: 'free-scan-already-used' | 'monthly-cap-reached' };

function readTier(data: FirebaseFirestore.DocumentData): UserTier {
  if (data.tier === 'executive') return 'executive';
  if (data.tier === 'pro') return 'pro';
  return 'free';
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Atomically checks quota AND consumes it in one Firestore transaction, so
 * two concurrent requests from the same user can't both slip through
 * before either write lands (double-spending the one free scan).
 */
export async function checkAndConsumeItemizedScanQuota(uid: string): Promise<QuotaResult> {
  getFirebaseAdminApp();
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction<QuotaResult>(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() ?? {};
    const tier = readTier(data);

    if (tier === 'executive') {
      // Never blocked, but still counted — an unlimited account that
      // reported no usage would hide real API spend from the one person
      // most likely to be watching it.
      const monthKey = currentMonthKey();
      const stored = data.itemizedScansMonthKey as string | undefined;
      const used = stored === monthKey ? Number(data.itemizedScansUsedThisMonth) || 0 : 0;
      tx.set(
        userRef,
        { itemizedScansMonthKey: monthKey, itemizedScansUsedThisMonth: used + 1 },
        { merge: true }
      );
      return { allowed: true };
    }

    if (tier === 'free') {
      if (data.hasUsedFreeItemizedScan === true) {
        return { allowed: false, reason: 'free-scan-already-used' };
      }
      tx.set(
        userRef,
        { hasUsedFreeItemizedScan: true, freeItemizedScanUsedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return { allowed: true };
    }

    const monthKey = currentMonthKey();
    const storedMonthKey = data.itemizedScansMonthKey as string | undefined;
    const usedThisMonth = storedMonthKey === monthKey ? Number(data.itemizedScansUsedThisMonth) || 0 : 0;

    if (usedThisMonth >= PRO_MONTHLY_SCAN_CAP) {
      return { allowed: false, reason: 'monthly-cap-reached' };
    }

    tx.set(
      userRef,
      { itemizedScansMonthKey: monthKey, itemizedScansUsedThisMonth: usedThisMonth + 1 },
      { merge: true }
    );
    return { allowed: true };
  });
}
