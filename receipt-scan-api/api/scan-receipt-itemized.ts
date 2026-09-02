import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '../lib/firebaseAdmin';
import { buildItemizationPrompt } from '../lib/prompt';
import { callLlmProvider, LlmProvider } from '../lib/llmProviders';
import { checkAndConsumeItemizedScanQuota } from '../lib/quota';
import { recordProviderCall } from '../lib/geminiUsage';

// Which provider serves real (client-facing) requests. Flip after the
// comparison in scripts/compare-models.ts picks a winner — see
// TICKETS.md MYS-9 for the reasoning (Gemini 2.5 Flash is the current
// default recommendation on cost, re-confirm on quality before shipping).
const ACTIVE_PROVIDER: LlmProvider = 'gemini';

function apiKeyFor(provider: LlmProvider): string {
  const key =
    provider === 'gemini'
      ? process.env.GEMINI_API_KEY
      : provider === 'claude'
      ? process.env.CLAUDE_API_KEY
      : process.env.OPENAI_API_KEY;
  if (!key) throw new Error(`Missing API key env var for provider: ${provider}`);
  return key;
}

/** Strips ```json fences some models add despite being told not to. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

const VALID_PROVIDERS: LlmProvider[] = ['gemini', 'claude', 'openai'];

interface ItemizedScanRequestBody {
  base64Image: string;
  mimeType: string;
  categoryNames: string[];
  provider?: LlmProvider;
}

/**
 * POST /api/scan-receipt-itemized — the paid itemized-receipt extraction
 * call (MYS-9/MYS-10). Standalone Vercel function, not a Firebase Cloud
 * Function — see package.json's description for why. Client contract
 * matches the original Cloud Function version exactly (same request/
 * response shape), so src/lib/itemized-scan.ts only needed its transport
 * swapped (httpsCallable -> fetch with a bearer token), not its logic.
 *
 * Auth: the client sends its Firebase ID token as `Authorization: Bearer
 * <token>` (Cloud Functions' onCall verified this automatically; here we
 * do it explicitly via firebase-admin's verifyIdToken).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permissive CORS: this endpoint is called from a Capacitor WKWebView/
  // Android WebView (origin varies: capacitor://localhost, https://localhost,
  // or a plain web dev server) and is safe to leave open since every real
  // request still requires a valid Firebase ID token — CORS only gates
  // browser-originated requests, not the auth check itself.
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

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) {
    res.status(401).json({ error: 'unauthenticated', reason: 'not-signed-in' });
    return;
  }

  getFirebaseAdminApp();
  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'unauthenticated', reason: 'not-signed-in' });
    return;
  }

  const body = req.body as ItemizedScanRequestBody;
  if (!body?.base64Image || !body?.mimeType || !Array.isArray(body.categoryNames)) {
    res.status(400).json({ error: 'invalid-argument', message: 'base64Image, mimeType, and categoryNames are required.' });
    return;
  }

  // Explicit, user-chosen provider (see src/lib/itemized-scan.ts's
  // AVAILABLE_PROVIDERS) — falls back to ACTIVE_PROVIDER if omitted.
  // Validated and its key checked BEFORE quota is consumed, so a request
  // for a provider that isn't configured here fails fast with a clear
  // 400 instead of silently burning the user's scan on a request that was
  // never going to succeed.
  const provider = body.provider && VALID_PROVIDERS.includes(body.provider) ? body.provider : ACTIVE_PROVIDER;
  let apiKey: string;
  try {
    apiKey = apiKeyFor(provider);
  } catch (err) {
    res.status(400).json({ error: 'invalid-argument', message: (err as Error).message });
    return;
  }

  const t0 = Date.now();
  const quota = await checkAndConsumeItemizedScanQuota(uid);
  console.log(`[timing] quota check: ${Date.now() - t0}ms`);
  if (!quota.allowed) {
    // Distinct status/shape so the client can distinguish "you're out of
    // scans" (fall back to standard OCR silently, per MYS-10's
    // no-upsell-nagging rule) from a genuine failure.
    res.status(429).json({ error: 'resource-exhausted', reason: quota.reason });
    return;
  }

  const prompt = buildItemizationPrompt(body.categoryNames);

  let rawText: string;
  try {
    const t1 = Date.now();
    rawText = await callLlmProvider(provider, {
      base64Image: body.base64Image,
      mimeType: body.mimeType,
      prompt,
      apiKey,
    });
    console.log(`[timing] LLM call (${provider}): ${Date.now() - t1}ms`);
    // Recorded on success only right now — a failed call still spends a
    // slot of the provider's rate limit, but the common failure here is a
    // malformed image, not the provider actually running, so success-only
    // keeps the counter closer to "calls that really hit the provider."
    await recordProviderCall(provider);
  } catch (err) {
    // Note: quota was already consumed above — a model-call failure still
    // costs the user their free scan / a slot of their monthly cap.
    // Acceptable for now (failures should be rare with a valid image), but
    // worth revisiting if this turns out to happen often in practice.
    res.status(500).json({ error: 'internal', message: `LLM call failed: ${(err as Error).message}` });
    return;
  }

  try {
    const parsed = JSON.parse(stripCodeFence(rawText));
    if (!Array.isArray(parsed.items)) {
      res.status(500).json({ error: 'internal', message: 'Model response missing items[] array.' });
      return;
    }
    res.status(200).json(parsed);
  } catch {
    res.status(500).json({ error: 'internal', message: `Model returned non-JSON response: ${rawText.slice(0, 500)}` });
  }
}
