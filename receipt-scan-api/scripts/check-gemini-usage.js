// One-off diagnostic: reads the geminiUsage.ts counters directly from
// Firestore to see actual call volume, and makes one real test call to
// Gemini's API with the live key to see the exact error (if any) coming
// back right now — rather than guessing whether "the free API is mostly
// not available" is a real quota exhaustion or something else entirely.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const db = admin.firestore();
  const snap = await db.doc('system/llmUsage_gemini').get();
  console.log('--- Our own call counter (system/llmUsage_gemini) ---');
  console.log(snap.exists ? JSON.stringify(snap.data(), null, 2) : '(no document — never called successfully)');

  console.log('\n--- Live test call to Gemini API with the real key ---');
  const apiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
    }),
  });
  console.log('HTTP status:', res.status);
  const text = await res.text();
  console.log('Body:', text.slice(0, 2000));
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
