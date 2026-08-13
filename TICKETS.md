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

**Status:** done

Full line-by-line audit of the auth path (`firebase.ts`, `AuthContext.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `AuthGate.tsx`, `SyncContext.tsx`, `firestore-sync.ts`, `clear-user-data.ts`, `AppDrawer.tsx`, `PageHeader.tsx`, `OnboardingFlow.tsx`, plus the native `@capacitor-firebase/authentication` Android source) surfaced 5 concrete gaps, all verified against actual code/plugin source rather than assumed from filenames:

1. **`signOut()` wiped local data before confirming remote sign-out** (`AuthContext.tsx`) — `clearAllUserData()` ran unconditionally before an un-caught `await firebaseSignOut(auth)`; a rejected remote call left local data gone but `user` state stale. **Fixed:** remote sign-out now attempted first (try/catch), local wipe + state reset moved into `finally`.
2. **Native Google sign-in cancellation misdetected as a real error** (`LoginPage.tsx`) — cancel check only matched British `'cancelled'`; Android's native plugin throws `"Authorization canceled."` (American spelling), confirmed in `node_modules/@capacitor-firebase/authentication/android/.../GoogleAuthProviderHandler.java:84`. **Fixed:** `isUserCancelledSignIn()` matches both spellings.
3. **Registered display name never appeared until re-login** (`RegisterPage.tsx`) — `updateProfile()` doesn't re-fire `onAuthStateChanged`, so `AuthContext` kept the stale pre-update user. **Fixed:** added `AuthContext.refreshUser()`, called right after `updateProfile`.
4. **`SyncContext` could get permanently stuck in `'error'`** — the per-uid dedupe ref was set before the cloud check succeeded/failed, so a single transient failure locked that uid out of ever retrying without a full reload. **Fixed:** ref resets on failure; added an `online` event listener to retry automatically.
5. **Cold-start trusts a cached localStorage user before Firebase confirms the session** — left as intentional offline-first behavior per product decision; documented with a code comment rather than changed (local SQLite isn't gated by Firebase anyway; Firestore rules still block real cloud access without a live token).

Also added the roadmap's "Forgot password?" link (`sendPasswordResetEmail`) to `LoginPage.tsx`.

`tsc --noEmit` clean after all changes.

**Depends on:** none. **Blocks:** MYS-2 (Apple Sign-In slots into the same LoginPage error handling).

---

## MYS-2 — Sign in with Apple (App Store Guideline 4.8)

**Status:** code-complete, verification blocked (see below)

Audited before writing anything: `@capacitor-firebase/authentication` (already installed for Google) has built-in native `signInWithApple()` support across iOS/Android/Web (confirmed in its type defs + README) — so the porting guide's suggestion to install `@capacitor-community/apple-sign-in` was unnecessary and would've added a redundant second native auth plugin. Reused the existing one instead, mirroring the exact bridging pattern already used for Google.

**Changes made:**
- `capacitor.config.ts`: added `'apple.com'` to `FirebaseAuthentication.providers`.
- `LoginPage.tsx`: `nativeAppleSignIn()` (native plugin → `OAuthProvider('apple.com').credential({idToken, rawNonce})` → `signInWithCredential`) + web fallback via `signInWithPopup(auth, new OAuthProvider('apple.com'))`; reuses the MYS-1 `isUserCancelledSignIn()` helper so Apple cancellation is handled the same way as Google. Button gated to iOS only (`Capacitor.getPlatform() === 'ios'`, resolved post-mount to avoid SSR mismatch) per the roadmap's scope and Apple's actual review requirement.
- `tsc --noEmit` clean.

**Cannot be verified from this environment — explicitly blocked on:**
1. **No `ios/` platform exists** in this repo (only `android/`) — no `@capacitor/ios`, no Xcode project. Nothing here can be compiled/run for iOS yet.
2. **Apple provider not enabled in Firebase Console** (`masyr-9dbb9`) — manual console step, not code.
3. **Apple Developer Program enrollment + "Sign In with Apple" capability/entitlement** on the App ID — manual step in the Apple Developer portal, requires a paid membership.
4. **No device/simulator test has been run.** See the new MYS-2a ticket below for the concrete path to close this gap using Appetize.io (no Mac required).

**Depends on:** MYS-1 (done). **Blocked on:** MYS-2a for verification.

---

## MYS-2a — iOS platform scaffolding + Appetize.io simulator testing pipeline

**Status:** scaffolding done, first CI run pending

**Why this exists:** MYS-2 (and every subsequent iOS-facing ticket) can't be verified from this Windows/no-Mac environment without some way to actually run the app on iOS. `IOS_PORTING_GUIDE.md` names the tool for this — Appetize.io, an iOS Simulator that runs inside a browser tab, fed by a `.app` build. The guide's original GitHub Actions example builds a **device** archive (`-sdk iphoneos`, needs code-signing certs) for TestFlight; Appetize instead wants a **simulator** build (`-sdk iphonesimulator`), which needs no Apple certificates at all.

**Correction to the original plan:** assumed `npx cap add ios` needed macOS/Xcode and would have to run inside CI each time. Tested it directly — it actually runs fine on Windows (it only *skips* `pod install` and the `xcodebuild` clean step, both of which gracefully no-op without their tools present). So `ios/` has been generated and **committed** to the repo now, following Capacitor's own convention (native platform folders are checked in, not regenerated per build) — this means Info.plist / entitlements / other native config can be hand-edited directly from this Windows machine going forward, no CI round-trip needed for that. Capacitor ships `ios/.gitignore` which already correctly excludes `Pods/`, `App/App/public` (synced web build output), `DerivedData`, and `xcuserdata`.

**Done:**
1. Added `@capacitor/ios` to `package.json`, ran `npx cap add ios`, committed the resulting `ios/` folder.
2. Added `.github/workflows/ios-simulator-build.yml` — manual-trigger-only (`workflow_dispatch`; macOS runners bill at a 10x minute multiplier, so this shouldn't run on every push). Steps: `npm ci` → `npm run build` → `pod install` (in `ios/App`) → `npx cap sync ios` → `xcodebuild -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO` → zip the `.app` → upload as a workflow artifact.

**CI debugging — 4 real failures found and fixed in sequence, each verified by re-running before moving to the next (not guessed/batched):**
1. `npm run build` broke during static-export prerendering with `Firebase: Error (auth/invalid-api-key)`. Root cause: `firebase.ts` reads 6 `NEXT_PUBLIC_FIREBASE_*` env vars at module-init time (runs during prerendering), and those only existed in the local, gitignored `.env.local` — nothing supplied them to the CI runner. Fixed: set the 6 values as GitHub Actions repo secrets (`gh secret set`), added as `env:` on the build step. Not a confidentiality concern — `NEXT_PUBLIC_*` values get inlined into the client bundle regardless.
2. `pod install` failed: "could not find compatible versions for pod Capacitor". Root cause: `@capacitor/cli` was pinned at `^7.6.7` while every other Capacitor package (`core`, `android`, `ios`) was already on `8.x` — pre-existing drift, not something introduced this session. The v7 CLI's iOS template generator writes `platform :ios, '14.0'`, but `@capacitor/ios` 8.5.0's actual podspec requires iOS 15.0 minimum. Fixed: bumped `@capacitor/cli` to `^8.5.0`, bumped `ios/App/Podfile`'s `platform :ios` to `15.0`, and bumped `IPHONEOS_DEPLOYMENT_TARGET` in all 4 build configs in `project.pbxproj` (a separate source of truth Xcode also reads).
3. `cap sync` failed: "The Capacitor CLI requires NodeJS >=22.0.0" — the workflow specified Node 20. Fixed: bumped to Node 22.
4. The zip step failed with "Nothing to do!" — my own `find build/Build/Products -maxdepth 1 -name "*.app"` was one directory too shallow (the `.app` sits under `Products/Debug-iphonesimulator/`, not directly under `Products/`). Fixed: dropped the depth limit and added an explicit failure message if no `.app` is found, instead of silently feeding an empty path to `zip`.

5. First Appetize upload of that artifact reported "uploaded successfully but we were unable to process the file for additional details" with a placeholder icon/name. Traced via the build log: with no `-destination` passed, `ONLY_ACTIVE_ARCH=YES` had resolved to an `x86_64`-only build on the `arm64` `macos-latest` runner — confirmed by grepping `Objects-normal/x86_64/` for the `App` target with no matching `arm64` directory. Fixed by adding `-destination 'generic/platform=iOS Simulator'` and `ONLY_ACTIVE_ARCH=NO`, forcing a universal `arm64`+`x86_64` build — re-verified in the next run's log: `CreateUniversalBinary ... normal arm64 x86_64` and `lipo -create` now appear for every framework.

6. Real Appetize test: app installed and launched (universal-arch fix worked), but crashed immediately — `FirebaseApp.configure() could not find a valid GoogleService-Info.plist`. Root cause: no iOS app had ever been registered in the `masyr-9dbb9` Firebase Console project (Android's equivalent, `android/app/google-services.json`, already existed and was committed; iOS never got one). Fixed: registered an iOS app with bundle ID `com.owais.myser`, downloaded `GoogleService-Info.plist`, placed it and hand-wired it into `project.pbxproj`'s Copy Bundle Resources build phase (mirroring the existing `capacitor.config.json` entry's 4-location pattern exactly: `PBXBuildFile`, `PBXFileReference`, `App` group children, `PBXResourcesBuildPhase`). Verified brace/paren balance before/after the edit, then let CI be the real validator — build succeeded and the log confirms `CopyPlistFile ... App.app/GoogleService-Info.plist` ran.
7. Also discovered the artifact upload itself was double-zipped (`actions/upload-artifact` wrapping an already-zipped file), causing Appetize's "No .app folder found" on the first real upload attempt. Fixed by pointing `upload-artifact` at the raw `.app` folder directly instead of a pre-zipped copy — the downloaded artifact is now single-level.

8. Real Appetize test on iOS 16.2: past the crash, but stuck forever on the loading screen with `SyntaxError: Unexpected token '{'` in a specific chunk. Root cause, confirmed by inspecting the actual failing chunk (not guessed): Next.js 16.2.9's own internal `AppRouterContext` runtime code uses an ES2022 `class { static { ... } }` block — a syntax feature unsupported before Safari/WebKit 16.4 (confirmed against `node_modules/next/dist/docs/03-architecture/supported-browsers.md`, which documents Next's zero-config default floor as exactly Safari 16.4+). Any real device on iOS 15.0–16.3 — which our own `IPHONEOS_DEPLOYMENT_TARGET = 15.0` claims to support — would hit this identical blank-screen crash. Fixed by adding a `browserslist` entry to `package.json` targeting `safari >= 15` / `ios_saf >= 15` (plus Chrome/Firefox/Edge so those weren't silently narrowed) — verified experimentally (not just trusting the docs) that this makes Next.js down-compile its own internal chunks, not just project source: rebuilt locally and confirmed the `static{}` block disappeared from the previously-affected file. Swept the rest of the build output for other ES2022+ patterns (private fields, more static blocks) — none found; the only other modern syntax present (`&&=`/`||=`/`??=`) is ES2021, supported since Safari 14.
9. Same test also logged a `FirebaseAuth` keychain error (`SecItemCopyMatching -34018: A required entitlement isn't present`) — caused by `CODE_SIGNING_ALLOWED=NO` producing a fully unsigned `.app` with no entitlements blob at all. Fixed by switching to ad-hoc signing (`CODE_SIGN_IDENTITY="-"`), which needs no Apple Developer account/certificates but still produces a valid entitlements blob.

Build is green (`build-ios-simulator` run [31255651041](https://github.com/owais-PCC/Myser/actions/runs/31255651041), ~4 minutes) with both fixes confirmed in the log (ad-hoc `CodeSign` ran on `App.app`).

10. Real test: app booted cleanly (no crash, no blank screen, keychain error gone). But tapping **Continue with Google** hung forever — debug log showed `To Native -> FirebaseAuthentication signInWithGoogle` fire, then nothing. Traced to `GoogleAuthProviderHandler.swift` in the plugin's iOS source: it calls `GIDSignIn.sharedInstance.signIn(withPresenting:...)`, whose completion handler only fires once the OAuth redirect makes it back into the app. `AppDelegate.swift` already correctly forwards `open url` to Capacitor's plugin proxy (untouched default boilerplate) — but `Info.plist` had no `CFBundleURLTypes` entry at all, so iOS had no URL scheme to route Google's redirect to in the first place. Fixed by registering the `REVERSED_CLIENT_ID` (from `GoogleService-Info.plist`) as a URL scheme.
11. Separately, **email/password registration** also hung forever after tapping Create Account. A real Network Logs capture showed Firebase Auth's SDK loading Google's `gapi`/iframe helper library (used for its cross-origin auth-domain handshake against `<project>.firebaseapp.com/__/auth/iframe`) but never completing. Root cause: `capacitor.config.ts` already explicitly overrides `androidScheme` to `https`, but never set an iOS equivalent — `@capacitor/cli`'s own type defs confirm `iosScheme` defaults to the non-standard `capacitor` custom scheme. Firebase Auth's SDK depends on a standard http(s) origin for that handshake; Android already worked because it was already on `https`, iOS silently ran under `capacitor://localhost`. Fixed by setting `iosScheme: 'https'` to match Android — picked up automatically by the existing `npx cap sync ios` CI step, confirmed via log (`capacitor.config.json` regenerated fresh each build).

Build green (`build-ios-simulator` run [31257973365](https://github.com/owais-PCC/Myser/actions/runs/31257973365), ~3 minutes).

12. **Correction (per direct user feedback, overriding this line's earlier claim):** only email/password registration was actually re-confirmed working after the fixes above — Google Sign-In was **not** re-tested on the builds that followed (several more fixes landed after the last confirmed Google Sign-In test, including the `iosScheme` change and the cold-launch layout fixes below). Google Sign-In on iOS should be treated as **unverified** until specifically retested. See `IOS_SPECS_HANDOVER.md` Part 1 §3. Follow-up device test then surfaced a **separate, unrelated bug**: on cold launch, the layout is visibly wrong — header clipped under the status bar/Dynamic Island, bottom nav showing a rendering artifact — until any tap/double-tap "snaps" it to the correct layout. Deep-dived this for several rounds (native safe-area confirmed correct via `MainViewController.swift` diagnostics, `env(safe-area-inset-*)` confirmed persistently unreliable in this WKWebView context via direct artifact inspection, native `window.innerHeight` confirmed to self-correct within ~3s with zero interaction while the *visual* layout does not) — full write-up in **[IOS_VIEWPORT_LAYOUT_BUG.md](./IOS_VIEWPORT_LAYOUT_BUG.md)**, including two candidate implementation plans from Antigravity (one partially useful — `100dvh`, forced-reflow-via-DOM-mutation are worth trying; one weaker — contradicted by our own diagnostic data, reverts an intentional native-single-source-of-truth decision).

**Status: parked, not resolved.** Decided to stop iterating blind via CI+Appetize round-trips and hand this off to a developer with a real Mac + physical iOS device once one is available, per product decision — not worth further remote-debugging time right now. `MainViewController.swift`'s diagnostic logging is still in place (harmless — NSLog calls only) for whoever picks this up next.

**Depends on:** none. **Unblocks:** MYS-2 verification (blocked until this is picked back up), and all future iOS-facing tickets in `IOS_PORTING_GUIDE.md`.

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

**Status:** removed — feature deleted, not fixed

Product decision: the Google Drive backup/restore and ZIP export/import feature was removed entirely rather than hardened (`src/lib/drive-backup.ts`, `src/lib/receipt-export.ts` deleted, along with their only dependents `jszip`/`file-saver`). No longer applicable.

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

**Status:** done

**Built as scoped:**
1. Migration: `type TEXT NOT NULL DEFAULT 'expense'` added to both `categories` and `transactions` (`src/lib/db.ts`), same try/catch `ALTER TABLE` pattern as the existing `document_id`/`comment` migrations. `getCategories`/`getSpendingByCategory`/`getTransactions`/`getTransactionsByMonth`/`getMonthlyTotals`/`getDailySpending` all updated to explicitly filter `type = 'expense'` (defaulted, so all existing call sites are unaffected) — this was the critical correctness step, otherwise income would have silently inflated every existing spending total.
2. Starter income categories seeded (Salary, Business, Freelance, Investments, Gifts & Refunds, Other Income), ids 101-106 to stay clear of expense category ids and future user-created ones.
3. `Expense | Income` segmented toggle added to `AddExpenseModal.tsx` (the actual live add-entry surface — the old `/add` page route is no longer linked anywhere in the app, confirmed via grep before choosing where to build this). Switching swaps the category list and toggles title/save-button/toast text; budget-reallocation flow correctly skipped for income (income doesn't draw against a category budget).
4. New `src/app/income/page.tsx`: month picker, total-income hero card, income-by-source breakdown (new `getIncomeByCategory` query), recent-entries list with delete, and a simple "Add Source" flow for custom income categories. Linked from `BottomNav.tsx` in **both** budget and tracker mode.
5. Dashboard integration still deferred, as agreed.

New Firestore fields (`type`, `is_recurring`, etc.) are synced for cross-device parity (`firestore-sync.ts` signatures extended) — not skipped.

`tsc --noEmit` and `npm run build` both clean; `/income` confirmed as a built static route.

---

## MYS-9 — Itemized supermarket OCR & multi-category split (+ tax/GST capture)

**Status:** todo — largest/riskiest ticket, scoped for building by us directly (not iOS-only —
this is a **cross-platform feature**: web, Android, and iOS all get it, same as every other
feature in this app). Paid/premium feature — see MYS-10.

**Current state:** OCR pipeline assigns a receipt's full total to one category. No line-item
parsing exists yet. Tax/GST lines are actively discarded: `isSkipLine()` in `ocr-pipeline.ts`
explicitly skips lines containing `tax`/`gst`/`vat` while hunting for the total.

**The problem, concretely:** if someone shops at a cash-and-carry and buys items spanning
several categories in one trip, today it all gets logged as one lump-sum transaction in one
best-guessed category. Worked example (real numbers from scoping discussion) — a Walmart receipt
with:

```
Cheetos             3 x 200   =  600
Dish washing soap   1 x 230   =  230
Raw chicken         1 x ???   =  ???
Roasted wings       6 x 500   = 3000
Dove shampoo 500ml  1 x 1000  = 1000
```

should become **N separate transactions, one per category**, not one lump sum:
- Snacks — 600 (Cheetos, + any other snack items on the same receipt e.g. Lays/Diet Coke)
- Groceries — raw chicken + dish soap (category boundary judgment call, see open question below)
- Eating Out/Food — 3000 (roasted wings, if judged prepared food rather than groceries)
- Self Care — 1000 (Dove shampoo)

Each transaction carries its own item list so tapping it later shows what made it up (e.g.
"Cheetos x3, Lays, Diet Coke"), not just a total.

**Implementation shape:**
1. **Structured line-item extraction**: a vision-capable LLM call (see architecture below)
   returns structured JSON per item — `{ item_name, quantity, unit_price, line_total, category }[]`
   — with `category` constrained to the user's actual existing category list (from
   `getCategories()`, passed into the prompt) so results always map onto real app categories, not
   free-text guesses.
2. **Grouping is app logic, not the LLM's job**: once the LLM returns the flat itemized array,
   the app groups items by `category`, sums each group's `line_total` into a transaction amount,
   keeps the item list as an attached breakdown. Don't ask the model to also decide "how many
   transactions" — grouping-by-key is trivial deterministic code and shouldn't depend on the
   model getting a second meta-step right.
3. **Review UI before committing**: show each proposed category group as a card (merchant,
   category, total, item list); let the user re-assign an item to a different group (recomputing
   both groups' totals live), merge groups, or drop an item; then confirm, and the app creates N
   separate transactions (one per surviving group). Extend the existing `NotificationsPanel`/
   pending-log review flow (`pending_logs` table, `addPendingLog`) to handle N pending groups from
   one receipt instead of one — don't invent a parallel review mechanism.
4. **Schema**: `line_items` TEXT column on `transactions` (JSON array), nullable/empty for
   ordinary non-itemized transactions — same `ALTER TABLE ... ADD COLUMN` migration pattern
   already used throughout `db.ts`.
5. **Tax/GST capture**: a new `extractTax(text)` (or an additional field the same LLM call
   returns) to capture tax amount per receipt. New `tax_amount` column on `transactions`, same
   migration pattern.
6. **Tax analytics**: once captured, add a "Total GST/Tax Paid" summary to `/analytics` — same
   pattern as MYS-11's "Exclude recurring" toggle for threading a new aggregate through
   `getMonthlyTotals`/`getSpendingByCategory`-style queries.

**Open question the worked example surfaces directly**: category boundaries for judgment-call
items (dish soap → Groceries or a separate Household category? roasted wings → Eating Out or
Groceries if raw/frozen vs. hot/prepared?) need either (a) a firm category list + prompt
instructions precise enough for the LLM to apply consistently, or (b) accepting some items will
be borderline and leaning on the review UI (step 3) as the cheap correction mechanism.
**Recommendation: (b)** — don't over-invest in prompt engineering for cases the review UI already
handles cheaply.

**Recommended architecture — hybrid online/offline:**

Reliable itemized extraction is a structured-understanding task existing regex/keyword logic
can't do well; it's exactly what vision-capable LLMs (Claude, GPT-4V, Gemini) are good at and
small on-device models aren't. But the app must keep working with no internet connection, which
rules out an online-only approach.

- **Online path (primary, when connected)**: send the receipt image to a vision-capable LLM API
  with a prompt requesting structured JSON (items, prices, per-item category, tax lines) —
  dramatically more reliable than rule-based parsing for messy/handwritten/multi-language
  receipts.
- **Offline path (fallback, no connection)**: the existing on-device OCR (Vision framework on
  iOS, ML Kit on Android) + the existing regex/keyword pipeline, degrading gracefully to today's
  behavior — one transaction, best-guess category, not itemized — rather than failing outright.
- Detect connectivity, pick a path, and be transparent to the user about which one ran (e.g.
  "Split into 4 items" vs. "Logged as one expense — reconnect for itemized splitting").

**Status update — backend built:** the server-side proxy is live as a standalone Vercel
serverless function in the sibling `receipt-scan-api/` project (own `package.json`, own deploy,
not part of this app's build) — see its `README.md`. Originally built as a Firebase Cloud
Function; moved to Vercel because Firebase's Blaze plan (required for Cloud Functions at all,
even free-tier usage) wouldn't accept the project owner's payment methods. Vercel's Hobby tier
needs no card. `ACTIVE_PROVIDER` in `receipt-scan-api/api/scan-receipt-itemized.ts` defaults to
Gemini 2.5 Flash pending a real comparison run via `npm run compare-models` in that project.

**Open questions needing explicit decisions before building:**
- Which LLM provider, and who bears the per-scan API cost — likely sits behind the paid tier
  (MYS-10), not free/unlimited.
- Sending a receipt photo to a third-party API is new data leaving the device — needs explicit
  user consent/opt-in (not just a privacy-policy mention) and accurate App Privacy disclosure,
  distinct from the existing on-device-only OCR.
- Whether the existing crowd-sourced merchant dictionary (`global_merchant_data` in Firestore,
  `contributeToGlobalPool`/`pullGlobalDictionary`) stays as the offline fallback's
  category-guessing aid, or becomes redundant once the online path exists.
  **Recommendation: keep it** — free, already-built, offline-capable signal; don't invest further
  in it as a "real trained model," an LLM will out-perform any small custom classifier we'd build
  for the online path anyway.

**Depends on:** MYS-8 if split items can be income-side (returns/refunds) — otherwise
independent. Recommend doing last; highest complexity, most likely to need its own sub-tickets
once scoping/prompt work starts.

---

## MYS-11 — Recurring expenses (tag + optional auto-repeat)

**Status:** done

**Built as scoped:**
1. `is_recurring INTEGER NOT NULL DEFAULT 0` column added to `transactions`. Checkbox in `AddExpenseModal.tsx`, shown only for expense entries (per literal scope). `updateTransaction` treats `is_recurring` as optional and preserves the existing stored value when a caller doesn't pass it — avoids a real data-loss bug where editing a transaction through a form that doesn't know about the field would have silently cleared it.
2. Optional auto-repeat sub-checkbox (only shown once Recurring is checked): `auto_repeat`, `recurrence_interval` ('monthly' only, stored as text so weekly/yearly can be added later without a migration), `next_occurrence_date` columns. `addMonths()` helper computes the next date.
3. **Catch-up engine**: `runRecurringCatchUp()` in `db.ts` — only the "anchor" transaction of a series (`auto_repeat = 1`) carries `next_occurrence_date`; spawned occurrences are inserted with `auto_repeat = 0` so they don't themselves keep spawning (would otherwise multiply every run). Capped at 24 catch-up occurrences per series as a runaway guard. Wired into `AuthGate.tsx` via a `useRef`-guarded effect that runs once per session right as real app content becomes reachable.
4. **Analytics**: "Exclude recurring" toggle added above the charts in `/analytics`; `getSpendingByCategory`/`getDailySpending`/`getMonthlyTotals` all accept an `excludeRecurring` option now. Dashboard/Budget untouched, as agreed.
5. Edit/delete: kept to v1 scope (single-instance only, no series-wide edit UI).
6. Small extra: added a recurring indicator (repeat icon) next to the category name in `TransactionList.tsx` (used by History) so recurring transactions are visually distinguishable there too.

`tsc --noEmit` and `npm run build` both clean.

---

## MYS-10 — Monetization tiering (Free / Myser Pro)

**Status:** in progress — decided, now building

**Decided plan (single plan for now, more tiers later once tax tooling exists):**
- **Myser Pro: $5/month, one plan only.** No free-trial nagging, no upsell banners pushing
  users toward it — the app stays fully usable for free indefinitely.
- **Free tier**: unlimited use of the *standard* OCR flow (single transaction, best-guess
  category) — this never gets gated or limited. Every user gets **exactly 1 free itemized scan,
  lifetime**, and it only ever triggers on a receipt the app's own heuristic judges genuinely
  multi-category/complex (see MYS-9's "skip the LLM call on simple receipts" heuristic — same
  check decides both "is it worth an LLM call" and "should the one-time free trial fire here").
  A simple one-item receipt never touches the free scan even if the user is on the free tier.
- **Pro tier**: itemized scans up to the monthly cap (see MYS-9), everything else previously
  scoped (cloud receipt sync MYS-6, automated backups MYS-5, CSV/Excel export) once those exist.
- **Payments are NOT built by us.** We build the plan/tier data model and the UI (pricing
  screen, "Upgrade to Pro" entry points, usage display) — actual payment processing (App Store
  In-App Purchase / StoreKit on iOS, Play Billing on Android) is the Mac-based iOS engineer's
  responsibility per `IOS_SPECS_HANDOVER.md`. Our job is to leave clean integration points (a
  `tier` field to flip, a place for them to hook purchase-restore/receipt-validation logic in),
  not to guess at StoreKit ourselves from this environment.

**Fix:** add `tier: 'free' | 'pro'` + `itemizedScansUsedThisMonth` + `hasUsedFreeItemizedScan`
to user profile (Firestore, synced same pattern as other user-profile fields); gate itemized OCR
(MYS-9) on it; gate cloud receipt sync (MYS-6), automated Drive backups (MYS-5), and CSV/Excel
export behind it once those exist.

**Depends on:** MYS-9 (the feature being gated). Building alongside MYS-9 now, not after.

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
