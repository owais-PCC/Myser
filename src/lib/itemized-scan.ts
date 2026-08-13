// Itemized receipt splitting (MYS-9/MYS-10). Calls the standalone backend
// in the sibling receipt-scan-api/ project (a plain Vercel serverless
// function, NOT part of this app's own build/deploy — this static export
// has no server of its own) — never talks to an LLM provider directly from
// the client, since that would mean shipping an API key in the app bundle
// and trusting the client to self-report its own quota, neither of which
// is safe (see receipt-scan-api/lib/quota.ts's header comment for the full
// reasoning). Originally built as a Firebase Cloud Function; moved to
// Vercel because Firebase's Blaze plan (required for Cloud Functions at
// all) wouldn't accept the project owner's payment methods — see
// receipt-scan-api/README.md.
//
// This file owns the one piece of the pipeline that IS client-side logic:
// grouping the flat itemized array the LLM returns into N category-grouped
// transaction proposals. That's deliberately NOT the LLM's job (see
// TICKETS.md MYS-9 "Grouping is app logic, not the LLM's job") — it's
// trivial deterministic code and keeping it here means the model only ever
// has to get one thing right (per-item categorization), not two.

import { auth } from './firebase';
import { getCategories } from './db';

export interface ReceiptLineItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  /**
   * Category name. Usually one of the user's existing categories, but the
   * model may propose a new one when nothing fits (see prompt.ts) — in
   * which case this name doesn't exist in the database yet and gets
   * created on save.
   */
  category: string;
  /** Model's claim that `category` is a new suggestion. Advisory only — we
   *  verify against the real category list rather than trusting it. */
  is_new?: boolean;
}

export interface ItemizedScanResult {
  merchant: string | null;
  items: ReceiptLineItem[];
  tax_amount: number | null;
  currency: string | null;
}

/** One proposed transaction — all items sharing a category, summed. */
export interface ProposedTransactionGroup {
  /** null when this category doesn't exist yet and will be created on save. */
  category_id: number | null;
  category_name: string;
  amount: number;
  items: ReceiptLineItem[];
}

export type LlmProvider = 'gemini' | 'claude' | 'openai';

export interface ProviderOption {
  id: LlmProvider;
  label: string;
}

/**
 * Asks the backend which providers it can actually serve — i.e. which ones
 * have an API key configured. This used to be a hardcoded array here that
 * had to be edited by hand whenever a key was added or removed on the
 * server, which meant the two lists silently drifted apart and the user
 * could pick a model that was guaranteed to fail. The backend is the only
 * side that knows, so it answers.
 *
 * Returns [] rather than throwing when the backend is unreachable or
 * unconfigured: the model picker then simply doesn't offer AI splitting,
 * which is the correct degraded state, not an error worth interrupting a
 * receipt scan for.
 */
export async function fetchAvailableProviders(): Promise<ProviderOption[]> {
  if (!RECEIPT_SCAN_API_URL) return [];
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(PROVIDERS_API_URL, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.providers) ? body.providers : [];
  } catch {
    return [];
  }
}

export interface ProviderUsageSnapshot {
  today: number;
  thisMonth: number;
  lifetime: number;
}

/**
 * Our own call-count tracker for the active AI provider — see
 * receipt-scan-api/lib/geminiUsage.ts for exactly what this does and
 * doesn't tell you (it's not the provider's real quota; there is no API
 * for that). Backend enforces executive-tier-only; returns null for
 * anyone else so the UI can just not render the section rather than
 * showing a permission error.
 */
export async function fetchProviderUsage(): Promise<ProviderUsageSnapshot | null> {
  if (!RECEIPT_SCAN_API_URL) return null;
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const idToken = await user.getIdToken();
    const res = await fetch(USAGE_API_URL, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.usage ?? null;
  } catch {
    return null;
  }
}

export type ItemizedScanFailureReason =
  | 'not-signed-in'
  | 'free-scan-already-used'
  | 'monthly-cap-reached'
  | 'other';

export class ItemizedScanQuotaError extends Error {
  constructor(public reason: ItemizedScanFailureReason) {
    super(`Itemized scan not available: ${reason}`);
    this.name = 'ItemizedScanQuotaError';
  }
}

const QUOTA_REASONS = new Set<ItemizedScanFailureReason>([
  'not-signed-in',
  'free-scan-already-used',
  'monthly-cap-reached',
]);

// Set via NEXT_PUBLIC_RECEIPT_SCAN_API_URL in .env.local — the deployed
// (or `vercel dev` local) URL of receipt-scan-api's endpoint. Not
// hardcoded so local testing can point at localhost without a code change.
const RECEIPT_SCAN_API_URL = process.env.NEXT_PUBLIC_RECEIPT_SCAN_API_URL;

// Sibling endpoint of the scan URL, derived rather than configured
// separately so there's only one URL to set (and no way to point the two
// at different deployments by mistake).
const PROVIDERS_API_URL = RECEIPT_SCAN_API_URL
  ? RECEIPT_SCAN_API_URL.replace(/\/[^/]*$/, '/providers')
  : '';
const USAGE_API_URL = RECEIPT_SCAN_API_URL
  ? RECEIPT_SCAN_API_URL.replace(/\/[^/]*$/, '/provider-usage')
  : '';

/**
 * Calls the backend with the receipt image + the user's real category
 * names (so the model's output always maps onto categories that actually
 * exist in this user's app — see receipt-scan-api/lib/prompt.ts). Throws
 * ItemizedScanQuotaError (not a generic error) when the user is out of
 * scans, so callers can fall back to the standard single-transaction OCR
 * flow silently instead of surfacing a scary error (per MYS-10's
 * no-upsell-nagging rule — running out of free/Pro scans is not a failure,
 * it's an expected, quiet fallback).
 *
 * `provider` is explicit and user-chosen (see AVAILABLE_PROVIDERS) rather
 * than always using the backend's default — this used to be an automatic,
 * silent background attempt with every failure swallowed, which made it
 * impossible to tell whether a receipt just didn't qualify, the network
 * failed, or the backend itself was misconfigured. Now the user triggers
 * it explicitly and any failure here is a real, visible error to them.
 */
export async function scanReceiptItemized(
  base64Image: string,
  mimeType: string,
  provider: LlmProvider = 'gemini'
): Promise<ItemizedScanResult> {
  if (!RECEIPT_SCAN_API_URL) {
    throw new Error('NEXT_PUBLIC_RECEIPT_SCAN_API_URL is not configured.');
  }

  const user = auth.currentUser;
  if (!user) {
    throw new ItemizedScanQuotaError('not-signed-in');
  }
  const idToken = await user.getIdToken();

  const categories = await getCategories('expense');
  const categoryNames = categories.map((c) => c.name);

  const res = await fetch(RECEIPT_SCAN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ base64Image, mimeType, categoryNames, provider }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const reason = (body?.reason as ItemizedScanFailureReason) || 'other';
    throw new ItemizedScanQuotaError(QUOTA_REASONS.has(reason) ? reason : 'other');
  }
  if (res.status === 401) {
    throw new ItemizedScanQuotaError('not-signed-in');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Itemized scan failed (${res.status})`);
  }

  return res.json();
}

type MinimalCategory = { id: number; name: string };

/**
 * Pure, synchronous core of the grouping step — takes items + an
 * already-loaded category list and returns proposed groups. Split out from
 * groupItemsByCategory() so the review UI can recompute groups instantly
 * on every user edit (reassign an item, drop an item) without an async DB
 * round-trip each time; it loads categories once and calls this directly.
 *
 * Matches each item's `category` against the user's real categories
 * case-insensitively (the model won't always match casing exactly even
 * when given the name verbatim). Anything that doesn't match is treated as
 * a NEW category the model proposed — grouped under its suggested name
 * with a null id, to be created when the user saves. It deliberately does
 * not trust the model's own `is_new` flag for this: whether a category
 * exists is a fact we can check locally, and checking beats trusting.
 *
 * Note this means unmatched names are no longer swept into "Other". That
 * was the old behaviour back when the model was constrained to a fixed
 * list, where a non-matching name could only be a mistake; now it's a
 * deliberate suggestion and collapsing it into "Other" would throw away
 * the useful part.
 */
export function groupItems(
  items: ReceiptLineItem[],
  categories: MinimalCategory[]
): ProposedTransactionGroup[] {
  const byNameLower = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

  // Keyed by existing category id, or by `new:<lowercased name>` for
  // proposed ones so several items sharing a suggestion group together.
  const groups = new Map<string, ProposedTransactionGroup>();

  for (const item of items) {
    const rawName = (item.category || '').trim();
    if (!rawName) continue;

    const match = byNameLower.get(rawName.toLowerCase());
    const key = match ? `id:${match.id}` : `new:${rawName.toLowerCase()}`;

    const existing = groups.get(key);
    if (existing) {
      existing.amount += item.line_total;
      existing.items.push(item);
    } else {
      groups.set(key, {
        category_id: match ? match.id : null,
        category_name: match ? match.name : rawName,
        amount: item.line_total,
        items: [item],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount);
}

/** Convenience async wrapper for one-off calls that don't already have the category list loaded. */
export async function groupItemsByCategory(items: ReceiptLineItem[]): Promise<ProposedTransactionGroup[]> {
  const categories = await getCategories('expense');
  return groupItems(items, categories);
}
