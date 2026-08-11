# Myser — iOS Launch-Readiness Handover

For the engineer picking this up with a MacBook + physical iOS device, working with Claude
Code from here. This doc is the single source of truth for what's done, what's broken, what's
unverified, and what's next. Read `IOS_VIEWPORT_LAYOUT_BUG.md` and `TICKETS.md` alongside this
— they have deeper technical logs for specific issues this doc summarizes.

## ⚠️ Ground rule: don't change the core

Everything below should be built **within the existing architecture**, not by replacing it:

- **Local-first SQLite** (`sql.js`, `src/lib/db.ts`) is the source of truth on-device. Firebase
  (Auth + Firestore) is a sync/backup layer on top, not a replacement.
- **Capacitor** wraps the same Next.js static-export web app for both Android and iOS — one
  codebase, native plugins bridge platform-specific capabilities (see `TextRecognizerPlugin`
  pattern below). Don't fork the UI into separate native screens.
- **Next.js App Router + `output: 'export'`** — the whole app is a static export served through
  Capacitor's local webview. Don't introduce SSR/API routes; they won't work in this deployment
  model.
- New native code should mirror the **existing plugin-registration pattern** (see
  `android/app/src/main/java/com/owais/myser/TextRecognizerPlugin.java` and
  `ios/App/App/MainViewController.swift`), not introduce a different native-bridging approach.
- If a fix requires touching shared UI/CSS, keep Android's current (working) behavior
  unchanged — several past iOS-specific bugs turned out to need iOS-only code paths precisely
  *because* Android already worked correctly (see `iosScheme` fix in `TICKETS.md` MYS-2a #11 as
  the template for "how to fix iOS without touching Android").

If something here seems to require a genuine architecture change, stop and flag it back to us
rather than proceeding — that's a conversation to have first, not a unilateral call.

---

## Part 1 — Confirmed broken / needs real-device work

Everything below was found through actual CI-built-simulator testing via Appetize.io (a
Windows/no-Mac environment) — see `IOS_VIEWPORT_LAYOUT_BUG.md` for the full diagnostic trail on
issue #1. None of this has been tested on a real physical device or through TestFlight yet.

### 1. Cold-launch layout bug (blocks App Review — this would be the first thing a reviewer sees)

On every cold launch, the header is clipped under the status bar/Dynamic Island and the bottom
nav shows a rendering artifact, until the user taps the screen once, which "snaps" it correct.
Full diagnostic history, every fix attempted (and why each failed), and two untested candidate
approaches (`100dvh` + forced-reflow-via-DOM-mutation from a partially-useful AI-generated plan)
are in **`IOS_VIEWPORT_LAYOUT_BUG.md`**. This needs Safari Web Inspector (real remote debugging
of the live WKWebView, which we never had access to) to actually see what's happening at the
moment of the bug — that alone should unblock diagnosis fast on a real Mac.

### 2. Sign in with Apple — code exists, entitlement doesn't

`LoginPage.tsx` and `capacitor.config.ts` already have the Apple provider wired
(`REVERSED_CLIENT_ID` URL scheme, `signInWithApple` bridging code, `@capacitor-firebase/authentication`'s built-in Apple support — reused rather than adding a redundant plugin, see
`TICKETS.md` MYS-2). What's missing: the actual **Sign In with Apple entitlement**
(`.entitlements` file + `CODE_SIGN_ENTITLEMENTS` build setting). This needs Xcode's
Signing & Capabilities UI (one checkbox) — we deliberately did not hand-edit this blind since a
malformed `.pbxproj`/entitlements setup is easy to break and impossible for us to validate
without Xcode. **This is a hard App Store blocker**: the app already offers Google Sign-In, so
Guideline 4.8 requires Apple Sign-In too, and it will not function without this entitlement.

Also needs: Apple provider enabled in Firebase Console (project `masyr-9dbb9`).

### 3. Google Sign-In on iOS — status unclear, retest first

Earlier testing (documented in `TICKETS.md` MYS-2a) showed Google Sign-In completing
successfully after fixing a missing `CFBundleURLTypes` entry in `Info.plist`. However, several
more fixes landed *after* that test (the `iosScheme` fix, the cold-launch layout fixes), and
**we have not since re-confirmed Google Sign-In specifically works** — only email/password has
been re-verified on the most recent builds. **First thing to do: retest Google Sign-In on a
real device before assuming it works.** If it's still broken, `GoogleAuthProviderHandler.swift`
(inside `@capacitor-firebase/authentication`) and the `CFBundleURLTypes` entry in
`ios/App/App/Info.plist` are the places to start.

### 4. Account deletion — not built (App Store blocker)

Guideline 5.1.1(ix) requires in-app account deletion wherever account creation exists. Not
implemented anywhere yet (`TICKETS.md` MYS-3). `src/lib/clear-user-data.ts` already handles
wiping local data on sign-out — deletion needs to additionally call Firebase Auth's
`deleteUser()` and clean up the user's Firestore documents.

### 5. Apple Developer Program + real signing

Nothing built so far has used a real Distribution certificate — everything is either ad-hoc
signed (`CODE_SIGN_IDENTITY="-"`, see `.github/workflows/ios-simulator-build.yml`) for CI
simulator testing, or unsigned. Confirm Apple Developer Program enrollment exists, register the
`com.owais.myser` bundle ID as a real App ID, and set up a real provisioning profile before
attempting a device build or TestFlight upload.

### 6. Missing `PrivacyInfo.xcprivacy`

Apple has required a Privacy Manifest since spring 2024 for apps using certain "required reason"
APIs — Firebase Auth/Firestore trigger these rules. Confirmed this file doesn't exist anywhere
in `ios/`. Missing it can get a build rejected at upload, before it even reaches human review.

### 7. Never tested on a real device or TestFlight

Every test so far has been a CI-built **iOS Simulator** app viewed through Appetize.io (a
browser-based simulator), since this environment has no Mac. Real-device behavior (camera OCR
capture, real keyboard, real Face ID/Touch ID interactions if ever used, real background/
foreground transitions) is completely unverified. Do this before submitting.

### 8. Verify branding assets are real, not placeholders

`ios/App/App/Assets.xcassets/AppIcon.appiconset` is wired correctly (modern single 1024×1024
universal icon, Xcode auto-generates the rest) — but we could not visually confirm the actual
image content from this environment. Confirm it's real Myser branding, and same for the splash
screen (`Assets.xcassets/Splash.imageset`), before submitting.

---

## Part 2 — OCR: how it actually works, iOS status, and the "training" question

We read the actual OCR code (`src/lib/ocr-pipeline.ts`) before writing this — here's what's
really happening, not a guess.

### What's a trained model, and what isn't

**Nothing in this app is custom-trained by us.** To be precise about what "AI" is actually
involved:

- **Text recognition** (turning a photo into raw text) uses pre-trained third-party OCR:
  - **Android**: Google ML Kit's on-device Text Recognition
    (`android/app/src/main/java/com/owais/myser/TextRecognizerPlugin.java`, wraps
    `com.google.mlkit.vision.text`) — fast, on-device, no cloud calls, no data leaves the
    device.
  - **iOS**: **there is no native OCR plugin at all.** We checked — no Swift equivalent of
    `TextRecognizerPlugin` exists in `ios/App/App/`. The code in `ocr-pipeline.ts`
    (`recognizeText()`) tries to call a native `TextRecognizer` plugin, silently fails on iOS
    since nothing registers it, and falls back to **Tesseract.js running in the WKWebView's JS
    engine** — the same slower, less-accurate path used for browser/dev testing. **This is
    very likely the single biggest reason OCR quality is worse than expected on iOS
    specifically** — it's not using a comparable engine to Android at all right now.
  - **Fix**: implement an iOS Capacitor plugin using **Apple's own Vision framework**
    (`VNRecognizeTextRequest`, available iOS 13+) — Apple's first-party on-device OCR, roughly
    comparable in speed/accuracy to ML Kit for Latin-script receipts, fully on-device (no
    network calls). Mirror the existing plugin-registration pattern (`registerPlugin`,
    `CAPPlugin`/`@objc` conventions) rather than introducing a different native-bridging
    approach. This is a clean, self-contained addition — it doesn't touch the Android path or
    any shared logic below.

- **Amount, date extraction**: 100% regex/heuristic parsing of the raw OCR text
  (`extractAmount`, `extractDate` in `ocr-pipeline.ts`) — no ML involved at all.
- **Category guessing**: a hardcoded keyword dictionary (`CATEGORY_KEYWORDS`), heavily biased
  toward South Asian/Pakistani brands and terms (`biryani`, `karahi`, `WAPDA`, `K-Electric`,
  `Rs`/`PKR`, etc.) — plain string matching against OCR text, no ML.
- **"Learning" that does happen** — and this is the one piece worth being precise about for
  Apple's App Privacy disclosures:
  - `merchant_memory` (local SQLite table): remembers which category *this specific user*
    previously chose for a merchant name, reused next time. Fully local, per-device, no privacy
    concern.
  - **Global crowd-sourced merchant dictionary** (`contributeToGlobalPool`/
    `pullGlobalDictionary` in `firestore-sync.ts`, writes to a shared `global_merchant_data`
    Firestore collection): when a user confirms a category for a merchant, the merchant name +
    chosen category gets contributed to a collection **shared across all users** as a
    crowd-sourced dictionary, read back to help categorize receipts from merchants other users
    have already seen. This is real, ongoing data collection from users, shared beyond their own
    device — it needs to be **accurately disclosed** in the App Store Connect "App Privacy"
    questionnaire (likely "Other User Content" or "Usage Data," collected, not linked to
    identity, used for app functionality) and mentioned in the privacy policy.

**Bottom line on the "does this align with Apple's policies" question**: there's no user-data
model training happening (so no ML-training-consent concern), and the OCR engines themselves
(ML Kit, Vision framework once added) are standard, privacy-respecting, fully on-device
first-party/major-vendor APIs Apple has no issue with — Vision framework is literally Apple's
own recommended tool for this. The one thing that needs correct handling is disclosing the
global merchant dictionary contribution accurately, and ideally giving users a way to opt out of
contributing to it (worth considering, not currently present).

### Making OCR meaningfully better — beyond just adding iOS's native engine

Once iOS has real native OCR (Vision framework), both platforms should see a real quality jump.
Beyond that, worth considering as ongoing improvement (not blocking, but the user has flagged
current reliability as genuinely insufficient):

- The regex-based amount/date/merchant extraction is fragile against receipt layout variety
  (multi-column prices, discounts, non-Latin scripts, poor print quality). Consider whether a
  lightweight on-device layout-aware model (Apple's Vision framework also supports
  `VNRecognizeTextRequest` with bounding-box/region data — currently unused; only raw
  concatenated text is extracted) could improve line-item association versus pure regex on flat
  text.
- Add graceful low-confidence handling: today the pipeline always produces *some* answer
  (falling through priority tiers down to "any number in the text"), even when confidence is
  effectively zero. Consider surfacing OCR confidence to the user and prompting for correction
  rather than silently guessing on the last-resort tier.

---

## Part 3 — Next milestone: itemized receipts + tax/GST tracking

This is a real expansion of what OCR does today, described here as a **spec for scoping**, not
something to build blind — discuss the detailed plan back with us before implementing, since it
touches the schema and several screens.

### The problem

Today, a receipt is always logged as **one transaction in one category** — the full total,
assigned to whichever category the merchant/keyword matching guessed. If someone shops at a
cash-and-carry and buys groceries, cleaning supplies, and a few clothing items in one trip, it
all gets logged as a single lump sum in one category. There's also no capture of tax (GST/VAT/
sales tax) paid — `isSkipLine()` in `ocr-pipeline.ts` explicitly **skips** lines containing
`tax`/`gst`/`vat` when hunting for the total, meaning that data is currently thrown away, not
just unused.

### What's wanted

1. **Itemized line-item extraction**: parse individual `[item name] ... [price]` pairs from the
   receipt body (not just the total), each with its own guessed category (reusing/extending the
   existing `matchCategory` keyword approach, applied per-item rather than to the whole receipt).
2. **A review UI** before committing: let the user see the parsed items grouped by guessed
   category, correct any miscategorized items, merge/split as needed, and confirm — then the app
   creates **N separate transactions** (one per category group) instead of one lump sum. This
   naturally extends the existing `NotificationsPanel`/pending-log review flow
   (`pending_logs` table, `addPendingLog`) already used for single-item OCR review — don't
   invent a parallel review mechanism.
3. **Tax/GST capture**: a new `extractTax(text)` function (mirroring `extractAmount`'s
   keyword-line-detection pattern, but *targeting* the tax-related keywords `isSkipLine()`
   currently discards) to capture the tax amount per receipt. Needs a schema addition — a
   `tax_amount` column on `transactions` (same `ALTER TABLE ... ADD COLUMN` migration pattern
   already used throughout `db.ts` for `document_id`, `comment`, `type`, `is_recurring`, etc.).
4. **Tax analytics**: once captured, add a "Total GST/Tax Paid" summary to `/analytics` — same
   pattern as the recently-added "Exclude recurring" work (`MYS-11` in `TICKETS.md`) for how to
   thread a new aggregate through `getMonthlyTotals`/`getSpendingByCategory`-style queries.

This is a substantial feature — likely its own multi-ticket effort. `TICKETS.md`'s `MYS-9`
("Itemized supermarket OCR & multi-category split") is the existing anchor ticket for the
line-item-splitting half; the tax/GST piece should probably be scoped as an explicit addition to
it rather than a separate ticket, since both changes touch the same OCR extraction pass.

---

## Quick-reference: what's already solid, don't re-litigate

- Auth architecture (Firebase Auth + local SQLite + Firestore sync layer), income tracking,
  recurring expenses, receipts/OCR pending-log review flow, PDF report generation — all
  functional and tested (Android confirmed in production use; iOS confirmed for email/password
  auth and general app navigation via CI-built simulator testing).
- `iosScheme: 'https'` in `capacitor.config.ts` is required for Firebase Auth to work on iOS —
  don't remove it (see `TICKETS.md` MYS-2a #11 for why).
- `MainViewController.swift` (custom `CAPBridgeViewController` subclass) exists specifically to
  bridge native safe-area values into CSS — has diagnostic `NSLog` calls still in place from the
  layout-bug investigation, safe to leave or clean up once that bug is actually fixed.
