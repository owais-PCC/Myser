import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '../lib/firebaseAdmin';
import { LlmProvider } from '../lib/llmProviders';

/**
 * GET /api/providers — which AI providers this deployment can actually use.
 *
 * Exists so the app's model picker reflects reality instead of a second
 * hardcoded list. Previously the client shipped its own AVAILABLE_PROVIDERS
 * array that had to be kept in sync by hand with the backend's configured
 * keys — the two drift the moment a key is added or removed, and the
 * failure mode is a provider the user can select that always errors.
 * Now the backend, which is the only thing that knows which keys exist,
 * reports it.
 */

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'ChatGPT',
};

const PROVIDER_ENV_VARS: Record<LlmProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  claude: 'CLAUDE_API_KEY',
  openai: 'OPENAI_API_KEY',
};

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
  try {
    await getAuth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const providers = (Object.keys(PROVIDER_ENV_VARS) as LlmProvider[])
    .filter((p) => !!process.env[PROVIDER_ENV_VARS[p]])
    .map((p) => ({ id: p, label: PROVIDER_LABELS[p] }));

  res.status(200).json({ providers });
}
