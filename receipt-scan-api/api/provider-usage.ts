import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../lib/firebaseAdmin';
import { getProviderUsage } from '../lib/geminiUsage';
import { LlmProvider } from '../lib/llmProviders';

const VALID_PROVIDERS: LlmProvider[] = ['gemini', 'claude', 'openai'];

/**
 * GET /api/provider-usage?provider=gemini — our own call-count tracker
 * (see lib/geminiUsage.ts header comment for what this is and isn't).
 *
 * Gated to the executive tier deliberately: this is an operator diagnostic
 * ("how close am I to the free tier ceiling"), not something a regular
 * user needs — a Pro subscriber doesn't care how many raw API calls we've
 * made today, and exposing it to everyone would be one more thing to keep
 * straight-faced about "we don't show you which model we use."
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

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  getFirebaseAdminApp();
  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid;
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const profileSnap = await getFirestore().doc(`users/${uid}`).get();
  const tier = profileSnap.data()?.tier;
  if (tier !== 'executive') {
    res.status(403).json({ error: 'permission-denied' });
    return;
  }

  const providerParam = req.query.provider;
  const provider: LlmProvider =
    typeof providerParam === 'string' && VALID_PROVIDERS.includes(providerParam as LlmProvider)
      ? (providerParam as LlmProvider)
      : 'gemini';

  const usage = await getProviderUsage(provider);
  res.status(200).json({ provider, usage });
}
