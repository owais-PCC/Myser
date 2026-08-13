import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { LlmProvider } from './llmProviders';

/**
 * Tracks how many times WE have called each LLM provider through this
 * backend — not the same thing as the provider's actual quota, which none
 * of Gemini/Claude/OpenAI expose via a queryable API (the real source of
 * truth for Gemini specifically is https://aistudio.google.com/usage,
 * which needs a Google login and can't be pulled programmatically). This
 * is a supplementary counter for rough visibility, not an authoritative
 * "requests remaining" figure — it won't include calls made outside this
 * backend (manual curl/compare-models.ts testing) and doesn't know the
 * provider's actual cap, which they can change any time.
 *
 * Named for Gemini in the file/doc path since it's the only provider in
 * active use right now (see TICKETS.md MYS-9/MYS-10 — the others have no
 * free tier), but keyed by provider so Claude/OpenAI usage tracks the same
 * way the moment they go live, with zero migration.
 */

function usageDocPath(provider: LlmProvider) {
  return `system/llmUsage_${provider}`;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function monthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Call after every LLM API request completes (success or failure — a
 *  failed call still consumed a slot of the provider's rate limit). */
export async function recordProviderCall(provider: LlmProvider): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(usageDocPath(provider));
  const today = todayKey();
  const month = monthKey();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};

      const dailyCount = data.dailyDateKey === today ? Number(data.dailyCount) || 0 : 0;
      const monthlyCount = data.monthKey === month ? Number(data.monthlyCount) || 0 : 0;
      const lifetimeCount = Number(data.lifetimeCount) || 0;

      tx.set(
        ref,
        {
          dailyDateKey: today,
          dailyCount: dailyCount + 1,
          monthKey: month,
          monthlyCount: monthlyCount + 1,
          lifetimeCount: lifetimeCount + 1,
          lastCallAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch {
    // Never let usage tracking break the actual scan — this is diagnostic,
    // not load-bearing.
  }
}

export interface ProviderUsageSnapshot {
  today: number;
  thisMonth: number;
  lifetime: number;
}

export async function getProviderUsage(provider: LlmProvider): Promise<ProviderUsageSnapshot> {
  const db = getFirestore();
  const snap = await db.doc(usageDocPath(provider)).get();
  const data = snap.data() ?? {};
  const today = todayKey();
  const month = monthKey();
  return {
    today: data.dailyDateKey === today ? Number(data.dailyCount) || 0 : 0,
    thisMonth: data.monthKey === month ? Number(data.monthlyCount) || 0 : 0,
    lifetime: Number(data.lifetimeCount) || 0,
  };
}
