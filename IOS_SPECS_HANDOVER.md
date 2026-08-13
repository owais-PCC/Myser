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

### ⚠️ Work in a separate branch — do not commit directly to main

**All of this work must happen on a dedicated branch, not `main`/the production branch.** This
is real production code (Android is already in active use), and a real device + Xcode gives you
much more room to break things while diagnosing (entitlements, signing, pbxproj edits, native
plugin changes) than the CI-simulator-only process this was built under so far. Branch off,
commit there, open a PR back to us when a given item is verified working — don't merge directly.
If a fix genuinely needs testing across several throwaway attempts, that's exactly what the
branch is for; keep `main` always in the last known-good state.

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

### 3. Google Sign-In on iOS — reproduced hang, root cause narrowed but not confirmed (App Store blocker)

Earlier testing (documented in `TICKETS.md` MYS-2a) showed Google Sign-In completing
successfully after fixing a missing `CFBundleURLTypes` entry in `Info.plist`. Since then it
regressed (or was never actually solid) — **retested via Appetize and reproduced a real hang**:
tapping "Sign in with Google" leaves the button stuck on "Signing in..." forever. **No account
picker sheet ever appears.**

What the logs show precisely (see `TICKETS.md` for the full log dump):
- `⚡️ To Native -> FirebaseAuthentication signInWithGoogle` fires — the JS→native bridge call
  reaches the plugin successfully.
- After that: total silence. No native-side log line, no error, no crash.
- The accompanying network capture shows **zero** Google/OAuth-related requests — only unrelated
  iOS system traffic (safebrowsing checks, an Apple asset fetch). This means the native call
  never even got as far as attempting the sign-in network flow.

**Leading hypothesis** — re-read `GoogleAuthProviderHandler.swift` (inside
`@capacitor-firebase/authentication`, `startSignInWithGoogleFlow`):

```swift
guard let clientId = FirebaseApp.app()?.options.clientID else { return }
...
guard let controller = self.pluginImplementation.getPlugin().bridge?.viewController else { return }
```

Neither guard calls `call.reject(...)` on failure — if either `clientId` or `controller`
resolves to `nil` at call time, the function just returns silently. The JS Promise never
resolves or rejects, which matches the observed symptom exactly (indefinite hang, zero error,
zero log, zero network activity). This is third-party code (`node_modules`), so we can't patch
it directly/durably — **this is diagnosis, not yet a confirmed fix.**

**Second, equally live possibility**: all testing to date has been on **Appetize's cloud
simulator**, not a real device or a real Mac-hosted Xcode Simulator. Modern `GIDSignIn` presents
its OAuth UI via `ASWebAuthenticationSession` (a system-level sheet), and cloud-hosted simulator
infrastructure is known to sometimes be unable to present that UI correctly — this would produce
the *exact same symptom* (native call made, no sheet, no error, no network activity) with zero
code being at fault. **We cannot currently tell these two explanations apart from this
environment** — that's the actual reason this is being handed off rather than chased further
here.

**What to do first, in order:**
1. Retest on a real device or genuine Mac-hosted Xcode Simulator. If the sheet appears there,
   the bug was environmental (Appetize-only) and nothing further needs fixing — the mitigation
   in step 2 stays as a safety net but Google Sign-In itself is fine.
2. Already landed as a stopgap regardless of root cause: `LoginPage.tsx`'s `nativeGoogleSignIn()`
   now races the native call against a 15s timeout (`NATIVE_GOOGLE_SIGN_IN_TIMEOUT_MS`) and
   surfaces a real, retryable error instead of hanging the UI forever. This doesn't fix the
   underlying cause — it just stops the app from lying to the user about what's happening. Keep
   this regardless of what step 1 finds.
3. If it still hangs on a real device, add targeted logging around the two guards above to
   determine which one is actually failing (`clientId` vs. `controller`) — since we can't edit
   `node_modules` durably, this likely means either patching the vendored pod locally for one
   debug build (not committed) or reproducing the same logic in a small first-party diagnostic
   call to isolate which value is nil. Once we know which guard fails, the real fix follows
   directly: if `clientId` is nil, something's off with how `GoogleService-Info.plist`'s
   `CLIENT_ID` is being loaded into `FirebaseApp.app()?.options`; if `controller` is nil, it's
   something about how `MainViewController`/the bridge's `viewController` resolves at the moment
   the button is tapped.

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
  - **iOS**: **✅ FIXED as of `TextRecognizerPlugin.swift`** (committed after this doc was
    first written — check `git log -- ios/App/App/TextRecognizerPlugin.swift` for the exact
    commit). Originally there was no native OCR plugin at all — no Swift equivalent of
    `TextRecognizerPlugin.java` existed in `ios/App/App/`, so `ocr-pipeline.ts`'s
    `recognizeText()` silently fell through to Tesseract.js running in the WKWebView's JS
    engine, the same slower/less-accurate path used for browser/dev testing. **This was very
    likely the single biggest reason OCR quality was worse on iOS specifically.**
    Added `ios/App/App/TextRecognizerPlugin.swift` using **Apple's own Vision framework**
    (`VNRecognizeTextRequest`, iOS 13+) — fully on-device, no network calls, registers itself as
    plugin name `"TextRecognizer"` with the same `recognize({base64}) -> {text}` shape Android
    already uses, so **zero changes were needed in `ocr-pipeline.ts`** for iOS to pick it up.
    Registered explicitly via `bridge?.registerPluginType(...)` in `MainViewController.swift`'s
    `capacitorDidLoad()`, mirroring Android's explicit `registerPlugin(...)` call in
    `MainActivity.java`. **Verified compiling correctly for both `arm64`/`x86_64` via CI**
    (`build-ios-simulator` run
    [31492187017](https://github.com/owais-PCC/Myser/actions/runs/31492187017)) — but **not yet
    runtime-tested against a real receipt photo**, since that needs an actual device/camera, not
    a CI-built simulator. **First thing to verify on the real device**: scan a real receipt and
    confirm OCR quality actually improved.

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

## Part 3 — itemized receipts + tax/GST tracking: not part of this handover

This was previously drafted here but doesn't belong in this doc — it's a **cross-platform
feature (web + Android + iOS alike)**, not an iOS-specific gap, so it's being built directly by
us rather than handed off. See `TICKETS.md` (`MYS-9`) for the full spec. Nothing further to do
here.

---

## Part 4 — Payments (App Store + Play Store) — this is your main remaining task

**Plan:** single "Myser Pro" tier, **$5/month**, no free trial nagging (see `TICKETS.md` MYS-10 for
the full monetization decision — free tier stays fully usable forever, one lifetime AI-split scan,
Pro gets 50/month). We've built everything around this that doesn't require Xcode/Android Studio;
what's left needs real accounts and native tooling neither of us has from this environment.

### What already exists (don't rebuild)

- **Tier data model**: `users/{uid}.tier` is `'free' | 'pro' | 'executive'`, enforced **server-side
  only** in `receipt-scan-api/lib/quota.ts` — the client can read it (`src/lib/firestore-sync.ts`'s
  `getUserProfile()`) but never write it. This is deliberate and must stay true: the moment `tier`
  becomes client-writable, "Pro" is one devtools edit away for anyone.
- **UI**: `src/components/ProUpgradeModal.tsx` (Settings → Myser Pro) already shows plan, usage,
  and an "Upgrade to Pro" button. It's real, not a mockup.
- **Purchase call path**: `src/lib/purchases.ts` has `purchasePro()` and
  `verifyPurchaseWithServer()` — both throw clear "not implemented" errors right now, but the
  shape is final. `ProUpgradeModal` already calls them.
- **Server verification endpoint**: `receipt-scan-api/api/verify-purchase.ts` exists, accepts
  `{ platform: 'ios'|'android', receiptData: string }`, currently returns 501. Full TODO comments
  inside it explain exactly what to call (Apple's verifyReceipt / StoreKit 2 transaction
  verification, Google Play Developer API) and what to do on success (set `tier: 'pro'` the same
  way `receipt-scan-api/scripts/grant-tier.js` does).

### What you need to do

1. **Create the products.** In App Store Connect: an auto-renewable subscription for Myser Pro,
   $5/month. In Play Console: an equivalent subscription product. Note the exact product IDs —
   they need to match on the native side.
2. **Build the native purchase plugins.** Follow the exact pattern already used for OCR — explicit
   plugin registration, not auto-discovery:
   - iOS: a Swift plugin wrapping StoreKit 2's `Product.purchase()`, registered in
     `MainViewController.swift`'s `capacitorDidLoad()` the same way `TextRecognizerPlugin.swift` is
     (see that file for the exact pattern to copy).
   - Android: a Java/Kotlin plugin wrapping Play Billing Library's `launchBillingFlow()`,
     registered in `MainActivity.java` the same way `TextRecognizerPlugin.java` is. Add the Play
     Billing Library dependency to `android/app/build.gradle` yourself with Android Studio's
     dependency picker — we didn't add an unverified version number to that file rather than guess
     one that might not resolve.
   - Wire both into `getPurchasePlatform()`/`purchasePro()` in `src/lib/purchases.ts` — no other
     client-side changes should be needed.
3. **Implement `verify-purchase.ts` for real** — follow the TODOs already in that file.
4. **Get a Google Play Developer API service account** (Play Console → Setup → API access) — a
   *different* Google Cloud credential from the Firebase one already in `.env.local`, needed only
   for server-side purchase verification.
5. **Get the Apple shared secret** (App Store Connect → Users and Access → Integrations →
   In-App Purchase) for the legacy receipt-verification API, or use StoreKit 2 transaction
   verification instead (Apple's newer, generally preferred approach — your call).
6. Test the full loop on TestFlight / a Play Console internal test track before going live — this
   genuinely cannot be verified from a Windows/no-Mac environment.

### Signed release builds

Both platforms have GitHub Actions workflows ready:

- **`.github/workflows/android-release.yml`** — fully working, already tested end-to-end (built,
  signed, and produced real AAB/APK artifacts). Run via Actions tab → workflow_dispatch, give it a
  version name/code.
- **`.github/workflows/ios-release.yml`** — a **skeleton only**, explicitly marked as such in its
  own header comment. It could not be tested without a real Apple Developer account/certificates,
  so treat it as a first draft to verify, not a working pipeline. It needs these GitHub repo
  secrets, none of which exist yet: `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID`, `KEYCHAIN_PASSWORD` (see the workflow file's
  header comment for exactly what each one is and where to get it).

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
