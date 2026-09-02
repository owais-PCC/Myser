// Real end-to-end test against the LIVE deployed backend, exactly the way
// the app itself calls it (sign in -> get ID token -> POST the itemized
// scan endpoint) -- to see the actual response the app is getting, rather
// than guessing from a local network test.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs = require('fs');
const path = require('path');

const WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBVljDVeo09whJmPAed_FuLUQEzTDZL7z8';
const EMAIL = 'businessmail820@gmail.com';
const PASSWORD = '33774436';
const BACKEND_URL = 'https://receipt-scan-api.vercel.app/api/scan-receipt-itemized';

async function main() {
  console.log('--- Signing in ---');
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const signInJson = await signInRes.json();
  if (!signInRes.ok) {
    console.error('Sign-in failed:', JSON.stringify(signInJson, null, 2));
    process.exit(1);
  }
  const idToken = signInJson.idToken;
  console.log('Signed in OK.');

  const imgPath = path.join(__dirname, 'samples', 'testbill.png');
  const base64Image = fs.readFileSync(imgPath).toString('base64');

  console.log('\n--- Calling live scan-receipt-itemized endpoint ---');
  const start = Date.now();
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      base64Image,
      mimeType: 'image/png',
      categoryNames: ['Groceries', 'Snacks', 'Eating Out', 'Self Care', 'Household'],
      provider: 'gemini',
    }),
  });
  const elapsed = Date.now() - start;
  console.log(`HTTP status: ${res.status} (${elapsed}ms)`);
  const text = await res.text();
  console.log('Body:', text.slice(0, 3000));
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
