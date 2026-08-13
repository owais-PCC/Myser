// Purchase flow scaffold (MYS-10). NOT functional yet — see
// IOS_SPECS_HANDOVER.md for the full spec. This file exists so the
// integration points are obvious and in one place: a native plugin the iOS
// engineer registers (mirroring the TextRecognizerPlugin pattern already
// used for OCR — see ios/App/App/TextRecognizerPlugin.swift and
// android/.../TextRecognizerPlugin.java), and a server call that verifies
// the resulting receipt/token before ever touching `tier` in Firestore.
//
// What's real: the tier data model (free/pro/executive, already enforced
// server-side in receipt-scan-api/lib/quota.ts) and the verify-purchase
// endpoint's shape (receipt-scan-api/api/verify-purchase.ts, currently
// returns 501). What's not: the native purchase UI itself — that needs
// Capacitor plugins wired to StoreKit (iOS) and Play Billing (Android),
// which needs Xcode/Android Studio and real product IDs configured in App
// Store Connect / Play Console first.

import { auth } from './firebase';

export type PurchasePlatform = 'ios' | 'android';

export interface PurchaseResult {
  receiptData: string;
  platform: PurchasePlatform;
}

/**
 * Detects which native purchase flow to use. Returns null on web/dev,
 * where there's no App Store or Play Store to purchase through.
 */
export function getPurchasePlatform(): PurchasePlatform | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capacitor } = require('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android' ? platform : null;
  } catch {
    return null;
  }
}

/**
 * Launches the native purchase sheet (StoreKit on iOS, Play Billing on
 * Android) and returns the resulting receipt/token on success.
 *
 * NOT IMPLEMENTED. This is where the iOS engineer wires a Capacitor
 * plugin call — e.g. `registerPlugin('Purchases').purchasePro()` — once:
 *   1. The Pro subscription product exists in App Store Connect (iOS)
 *      and Play Console (Android) with matching product IDs.
 *   2. A native plugin exists on each platform wrapping StoreKit's
 *      Product.purchase() / Play Billing's launchBillingFlow(), following
 *      the same explicit-registration pattern as TextRecognizerPlugin.
 * Throws until then — callers must not assume this resolves.
 */
export async function purchasePro(): Promise<PurchaseResult> {
  const platform = getPurchasePlatform();
  if (!platform) {
    throw new Error('In-app purchase is only available in the installed app, not the browser.');
  }
  throw new Error(
    'Purchases are not wired up yet — the native StoreKit/Play Billing integration is pending (see src/lib/purchases.ts and IOS_SPECS_HANDOVER.md).'
  );
}

/**
 * Sends a completed purchase's receipt to the backend for verification.
 * The backend is the only thing that may ever set `tier: 'pro'` — see
 * receipt-scan-api/api/verify-purchase.ts. Currently always fails with a
 * 501 from that endpoint since verification isn't implemented server-side
 * yet either; this function's shape is otherwise final.
 */
export async function verifyPurchaseWithServer(result: PurchaseResult): Promise<void> {
  const url = process.env.NEXT_PUBLIC_RECEIPT_SCAN_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_RECEIPT_SCAN_API_URL is not configured.');

  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  const idToken = await user.getIdToken();

  const verifyUrl = url.replace(/\/[^/]*$/, '/verify-purchase');
  const res = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ platform: result.platform, receiptData: result.receiptData }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Purchase verification failed (${res.status})`);
  }
}
