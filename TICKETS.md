# Myser — Ticket Backlog

Source: [PRODUCTION_READINESS_ROADMAP.md](./PRODUCTION_READINESS_ROADMAP.md), [IOS_PORTING_GUIDE.md](./IOS_PORTING_GUIDE.md), [DESKTOP_WEB_EXPANSION_PLAN.md](./DESKTOP_WEB_EXPANSION_PLAN.md).

Status legend: `todo` · `in-progress` · `blocked` · `done`

Desktop Web Expansion tickets are tracked separately and executed by Antigravity under our supervision — not listed here.

---

## MYS-0 — Commit in-flight work (housekeeping)

**Status:** todo (ready to commit)

Working tree currently holds finished, coherent changes that should land before new tickets start, so diffs stay reviewable:

- Auth: cache last-known user in `localStorage` (`myser_cached_user`) so UI renders immediately on load instead of flashing while `onAuthStateChanged` resolves. Partial progress on MYS-1.
- New `src/lib/report-generator.ts` — full PDF statement generator (cover page, summary widgets, category table, transaction ledger, Capacitor-aware save) + AI prompt export text. Closes most of MYS-7.
- Settings/History/Analytics: wired report generation in, added in-app PDF preview modal (iframe on web, styled mockup on native) with Share/Save actions, "Copy AI Prompt" button. Closes MYS-7 fully.
- Dashboard: category cards/rows now deep-link to `/history?category={id}` instead of dead `/budget` route.
- CategoryIcon: added 4 custom SVG icons (car, baby, popcorn, motorbike) + strip variation-selector characters (`️`) so emoji-keyed lookups stop silently missing.
- Toast: success toasts now use a full-screen checkmark overlay with optional `detail` line (e.g. amount + category); error toasts repositioned above bottom nav.
- `layout.tsx`: switched Google Fonts from `<link>` tag to `next/font/google` (self-hosted, no runtime request to fonts.googleapis.com) — avoids network dependency and is friendlier to Capacitor/iOS webview + privacy manifest.

**Action:** split into ~4 commits (auth cache / report generator + UI / icon+toast polish / font self-hosting) and commit. `tsc --noEmit` already passes clean.

---

## MYS-1 — Auth state machine & sign-in reliability

**Status:** todo (cache-on-load already landed via MYS-0)

**Current state (`src/context/AuthContext.tsx`):** exposes only `user`, `loading`, `isReturningUser`, `hasCompletedOnboarding`. `loading` is a single boolean set to `false` as soon as either the localStorage cache or the first `onAuthStateChanged` callback resolves — there's no way for the UI to distinguish "not yet checked," "actively signing in," and "sign-in failed." Google sign-in dismissal / popup-closed errors aren't caught anywhere in this file, so a canceled native picker likely bubbles up as an unhandled rejection wherever `signIn()` is called.

**Root cause:** `loading: boolean` collapses 4 real states into 1, and there's no error channel on the context at all.

**Fix:**
1. Replace `loading: boolean` with a `status: 'idle' | 'authenticating' | 'authenticated' | 'error'` enum (keep `loading` as a derived boolean for existing call sites, or grep-replace usages).
2. Add `authError: string | null` to context, cleared on new sign-in attempt.
3. Wrap Google sign-in call in try/catch; specifically swallow `auth/popup-closed-by-user` / `auth/cancelled-popup-request` without setting `authError` (user just changed their mind), surface everything else.
4. Add "Forgot password?" reset link to `LoginPage.tsx` using `sendPasswordResetEmail`.

**Acceptance criteria:** closing the Google account picker doesn't show an error screen; a real auth failure shows inline text near the sign-in button, not a full-screen crash; `tsc --noEmit` clean.

**Depends on:** none. **Blocks:** MYS-2 (Apple Sign-In slots into the same LoginPage error handling).

---

## MYS-2 — Sign in with Apple (App Store Guideline 4.8)

**Status:** todo

**Current state:** only Google + Email/Password providers exist. No Apple provider configured in Firebase Console or in `LoginPage.tsx`.

**Why it's a ticket:** Apple will reject the app at review if a 3rd-party social login (Google) is present without Sign in with Apple alongside it — this blocks iOS submission entirely, not just a nice-to-have.

**Fix:** `npm install @capacitor-community/apple-sign-in`; enable Apple provider in Firebase Console (`masyr-9dbb9`); add "Continue with Apple" button in `LoginPage.tsx`, gated to iOS (`Capacitor.getPlatform() === 'ios'`) — plumb through the MYS-1 error/status handling rather than inventing a second error path.

**Depends on:** MYS-1.

---

## MYS-3 — Account deletion (App Store Guideline 5.1.1(ix))

**Status:** todo — needs a code check to confirm nothing exists yet

**Current state:** `clearUserData()` exists in `src/lib/clear-user-data.ts` (used on sign-out already), but no UI entry point to delete the account itself. Apple rejects any app allowing account creation without in-app account deletion.

**Fix:** add "Delete Account" section to `src/app/settings/page.tsx` with a destructive confirm step; on confirm: `deleteUser(auth.currentUser)`, delete `users/{uid}` in Firestore, call `clearUserData()`.

**Depends on:** none.

---

## MYS-4 — Firebase offline queue & sync hardening

**Status:** todo — needs `firestore-sync.ts` read before scoping precisely

**Current state (per roadmap doc, unverified against code yet):** raw Firestore writes with no network-state listener; no offline write queue; no retry/backoff. Concurrent edits from two devices can overwrite each other.

**Fix (pending code read):** queue writes in SQLite when offline, flush on reconnect; add exponential backoff (≤5 retries) for failed syncs; confirm/tighten Firestore security rules (`request.auth.uid == userId`).

**Depends on:** none. **Next step before estimating:** read `src/lib/firestore-sync.ts` to confirm current behavior matches the roadmap's claim.

---

## MYS-5 — Google Drive backup token refresh & restore validation

**Status:** todo — needs `drive-backup.ts` read

**Current state (per roadmap doc):** cached OAuth access token isn't refreshed, so backups fail silently once it expires; restore unzips directly over `financeapp_db` without checking manifest/table structure first.

**Fix (pending code read):** Google Identity Services OAuth2 PKCE refresh flow; validate `manifest.json` + expected table headers (`categories`, `transactions`, `budgets`, `documents`) before restoring; snapshot a local rollback backup before applying a restore; progress toasts during zip/upload.

**Depends on:** none.

---

## MYS-6 — Cloud receipt storage (Firebase Storage)

**Status:** todo — needs `doc-store.ts` read

**Current state (per roadmap doc):** receipt images (`data_base64`) live only in local IndexedDB via `doc-store.ts`. Confirmed real gap: switching devices or opening the (future) desktop web app loses all receipt images.

**Fix:** on scan/upload, write to IndexedDB (fast path) **and** async-upload to `users/{uid}/receipts/{docId}.jpg` in Firebase Storage; on viewing a doc where the local cache misses, lazily pull from Storage and re-cache locally.

**Depends on:** MYS-4 (shares the offline-queue/retry plumbing).

---

## MYS-7 — In-app PDF report viewer

**Status:** done (landed in MYS-0)

Full in-app preview modal (iframe on web, styled mockup on native), Share/Save actions, AI prompt export — implemented across `report-generator.ts`, `settings/page.tsx`, `history/page.tsx`, `analytics/page.tsx`. No further work unless we want polish (e.g. real PDF renderer instead of the native-mockup fallback).

---

## MYS-8 — Income tracking

**Status:** todo

**Current state:** `transactions` table has no `type` column — the schema and every query (`getSpendingByCategory`, dashboard totals, etc.) assume expense-only.

**Fix:**
1. Migration: `ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'`.
2. Seed income categories (Salary, Freelance, Investments, Gifts & Refunds, Other Income).
3. `/add`: segmented `Expense | Income` control at top.
4. `/dashboard`: Net Cash Flow card (`Income − Expenses`), income-vs-expense bar chart.

**Depends on:** none, but touches the same `db.ts` surface as MYS-9 — sequence them, don't run in parallel.

---

## MYS-9 — Itemized supermarket OCR & multi-category split

**Status:** todo — largest/riskiest ticket, needs `ocr-pipeline.ts` read first

**Current state:** OCR pipeline assigns a receipt's full total to one category. No line-item parsing exists yet.

**Fix:** line-by-line `[Item Name] ... [Price]` extraction in `ocr-pipeline.ts`; per-line keyword categorization against existing category dictionaries; present as a split-review group in `NotificationsPanel.tsx` letting the user tweak categories before confirming N separate transactions.

**Depends on:** MYS-8 if split items can be income-side (returns/refunds) — otherwise independent. Recommend doing last; highest complexity, most likely to need its own sub-tickets once `ocr-pipeline.ts` is read.

---

## MYS-10 — Monetization tiering (Free / Myser Pro)

**Status:** todo — blocked until feature set stabilizes

**Fix:** add `tier: 'free' | 'pro'` to user profile; gate itemized OCR (MYS-9), cloud receipt sync (MYS-6), automated Drive backups (MYS-5), and CSV/Excel export behind it.

**Depends on:** MYS-6, MYS-9 (gates features that must exist first). Do last.

---

## Suggested order

1. **MYS-0** — commit in-flight work (today)
2. **MYS-1** → **MYS-2** → **MYS-3** (auth/App-Store-blocking trio; also unblocks iOS submission track)
3. **MYS-4** → **MYS-6** (sync hardening, then cloud receipt storage that depends on it)
4. **MYS-5** (Drive backup — independent, can slot in anytime after MYS-0)
5. **MYS-8** (income tracking — schema change, do before OCR splitting touches the same tables)
6. **MYS-9** (itemized OCR — largest, do once schema is stable)
7. **MYS-10** (monetization — last, gates features built above)

Desktop Web Expansion (Antigravity-led) can run in parallel with any of the above since it's UI-shell-only and shares no backend surface.
