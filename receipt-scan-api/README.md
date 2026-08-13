# myser-receipt-scan-api

Standalone backend for Myser's itemized-receipt scan feature (TICKETS.md
MYS-9/MYS-10 in the main repo). Deliberately **not** part of the main
Myser app repo's deployment — the main app is a static Next.js export with
no server of its own (Capacitor-wrapped for Android/iOS), so this one small
piece that genuinely needs a server (holds LLM API keys, enforces scan
quota server-side) lives here instead.

Originally built as a Firebase Cloud Function. Moved to Vercel because
Firebase's Blaze plan — required for Cloud Functions at all, even at
free-tier usage — wouldn't accept the project owner's payment methods.
Vercel's Hobby tier needs no card and covers this comfortably.

## One-time setup

1. **Get a free Firebase service account key** (no billing plan required):
   Firebase Console → Project Settings → Service Accounts → *Generate new
   private key*. Downloads a JSON file.
2. **Get free/trial LLM API keys** — see `.env.example` for where.
3. `npm install`
4. Copy `.env.example` to `.env.local`, fill in the LLM key(s) you have and
   the full service-account JSON as one line in `FIREBASE_SERVICE_ACCOUNT`.

## Testing which model to use, before deploying anything

Drop a few real receipt photos into `scripts/samples/` (gitignored), then:

```
npm run compare-models
```

Prints Gemini/Claude/OpenAI's output side by side on the same receipts —
use this to confirm `ACTIVE_PROVIDER` in `api/scan-receipt-itemized.ts` is
actually the right choice before it's live.

## Deploying

```
npm install -g vercel   # if not already installed
vercel login
vercel link             # creates/links this as its own Vercel project
```

Then in the Vercel dashboard (Project → Settings → Environment Variables),
set for Production:
- `GEMINI_API_KEY` (or whichever provider `ACTIVE_PROVIDER` is set to)
- `FIREBASE_SERVICE_ACCOUNT` (same JSON-as-one-line as above)

```
vercel deploy --prod
```

Note the resulting production URL (e.g. `https://myser-receipt-scan-api.vercel.app`)
— it goes into the main app's `NEXT_PUBLIC_RECEIPT_SCAN_API_URL` env var.

## Local dev against the real app

```
npm run dev   # vercel dev, serves api/ on http://localhost:3000
```

Point the main app's `.env.local` at `NEXT_PUBLIC_RECEIPT_SCAN_API_URL=http://localhost:3000/api/scan-receipt-itemized`
while testing locally.
