# iOS cold-launch layout bug — context for a fresh set of eyes

## The app

Myser is a Next.js 16.2.9 (Turbopack) app, statically exported (`output: 'export'` in
`next.config.ts`), wrapped by Capacitor 8.x to ship as native Android and iOS apps.
CSS uses `min-height: 100vh` on full-page containers (`.app-container`, `.page-content`)
and `position: fixed; bottom: 0` for the bottom tab bar (`.bottom-nav`), styled in
`src/app/globals.css`. The bottom nav and page header are ordinary React components
(`src/components/BottomNav.tsx`, `src/components/PageHeader.tsx`).

## How we're testing (this matters — read before assuming anything)

- Development machine is **Windows, no Mac, no Xcode, no physical iOS device.**
- iOS builds happen entirely in **GitHub Actions** (`.github/workflows/ios-simulator-build.yml`),
  on a `macos-latest` runner, producing an **iOS Simulator** `.app` bundle (not a
  device build — no code signing beyond ad-hoc, `CODE_SIGN_IDENTITY="-"`).
- That `.app` bundle is downloaded and uploaded to **Appetize.io**, a browser-based
  iOS Simulator, since that's the only way to interactively run/tap the app without
  a Mac.
- We tried using Chrome's local `next dev` server + Chrome DevTools' device toolbar
  as a faster iteration loop. **This does not work for this bug**: Chrome's device
  emulation does not simulate `env(safe-area-inset-*)` (confirmed it returns `0px`
  always) and has no real home-indicator/Dynamic-Island chrome to clip anything
  against. Any fix needs a real CI round-trip (~4–5 minutes) through Appetize to
  verify.
- Appetize's own "Chrome DevTools" live-inspector link has come up empty/unusable
  for us so far, so we can't directly inspect live computed styles or set
  breakpoints in the running WKWebView. Our only diagnostic channel has been
  `NSLog` statements in native Swift code, which surface in Appetize's **Debug
  Logs** panel — these are reliable; JS-side `console.log` calls from very early in
  the page lifecycle have **not** reliably appeared there (Capacitor's
  console-forwarding bridge may not be attached yet at that point), which cost us
  a round of wasted diagnosis (see attempt list below).

## The actual bug

**On cold launch (first paint after the app process starts), the page layout is
visibly wrong: the top header text is clipped under the status bar / Dynamic
Island, and the bottom nav bar area shows a rendering artifact (a black bar
cutting across the nav labels).** Tapping/double-tapping anywhere on the screen
makes the layout "snap" instantly to the correct, fully-visible state — no reload,
no visible flash, just a corrected layout.

This has been consistent across multiple separate test sessions/builds.

## What we know for certain (from real device — well, real Simulator — testing, not
assumptions)

1. **It is not a code-signing/entitlement/crash issue.** The app boots fine, no
   crash, no error dialog. This was ruled out early (a real keychain error existed
   in an earlier build for an unrelated reason — ad-hoc signing fixed it — but the
   visual glitch is independent of that).
2. **`viewport-fit=cover` is present** in the `<meta name="viewport">` tag, verified
   byte-for-byte in the actual built `index.html` inside the tested `.app` bundle
   (we downloaded the CI artifact directly and grepped it, not just our local build).
3. **The native safe-area value is correct and available immediately.** We added a
   custom `CAPBridgeViewController` subclass
   (`ios/App/App/MainViewController.swift`) that reads `view.safeAreaInsets.bottom`
   directly via UIKit (bypassing the browser entirely) and logs it via `NSLog`.
   Confirmed: `bottom=34.0` (the standard Face-ID-iPhone home-indicator inset) from
   the very first lifecycle callback, ~166ms after view controller creation.
4. **`env(safe-area-inset-bottom)` in CSS resolves to `0` inside this WKWebView
   regardless of the above.** We verified the compiled CSS (`calc(76px +
   env(safe-area-inset-bottom, 0px))`) was present verbatim in the tested build,
   yet the visual clipping persisted — meaning the browser-reported safe-area value
   and the true native value disagree in this specific context (content is served
   through a custom `WKURLSchemeHandler` under `https://localhost` via
   `capacitor.config.ts`'s `iosScheme: 'https'`, not a normal network navigation —
   WebKit is known to sometimes fail to propagate `safeAreaInsets` to CSS `env()`
   for content loaded this way, though we have not found an authoritative citation,
   only the behavioral evidence above).
5. **We worked around #4** by having the native Swift code push the real inset value
   into a CSS custom property (`--ios-safe-area-bottom-fallback`) via
   `webView.evaluateJavaScript(...)`, combined with `max()` against the (unreliable)
   `env()` value in `globals.css`, so whichever is larger wins. We confirmed via
   `evaluateJavaScript`'s **return value** (read back via `NSLog`, not
   `console.log` — see the diagnostic-channel note above) that `--nav-height`
   correctly computes to `calc(76px + max(0px, 34px))` shortly after launch.
6. **Despite #5 being confirmably correct, the visual bug still occurred.** This
   is the crux of the mystery.
7. **A real screenshot of the broken "before tap" state shows BOTH edges wrong at
   once** — top header clipped under the status bar, bottom nav showing an
   artifact — which rules out "we just haven't padded the bottom enough" as a
   complete explanation. Something about the *whole page's* layout/rendering is
   off on cold launch, not just the bottom safe area.
8. **The native view's own geometry (`window.innerHeight`, measured from JS) DOES
   correctly settle to its final value on its own, within about 3 seconds, with
   zero user interaction** (observed sequence in one test: `2125` → `852` → `615`,
   stabilizing at `615` by the 5th of 10 half-second polls we ran automatically
   after `viewDidAppear`).
9. **But the user has confirmed the *visual* bug does NOT self-correct by simply
   waiting** — it stays broken indefinitely until an actual tap/double-tap occurs.
   This is the key contradiction: native geometry is right within a few seconds on
   its own; the rendered page layout is not, and only a user gesture fixes it.

## Current working theory (unconfirmed)

Point 8 vs. point 9 together suggest the page's own CSS layout (which leans on
`100vh`-based sizing and `position: fixed`) is not reactively recomputing to match
the native view's corrected dimensions — i.e. WebKit's layout is "stuck" on a stale
viewport snapshot from very early in the load sequence, and only an explicit
reflow-triggering event (which a double-tap causes as a side effect of WebKit's
native zoom-reset gesture) forces recomputation. This is a known *category* of iOS
WebKit bug (stale viewport-unit / fixed-position geometry until forced reflow), but
we have not yet found the specific trigger or fix.

**Latest untested attempt** (build pushed, not yet verified by the user): the same
native Swift polling loop now also calls `window.dispatchEvent(new Event('resize'))`
on every poll, to test whether programmatically forcing a reflow reproduces what
the manual double-tap does. Result not yet known as of this writing.

## Everything we've tried, in order (so the same dead ends aren't repeated)

1. `viewport-fit=cover` + `calc(76px + env(safe-area-inset-bottom, 0px))` in CSS —
   verified correct in build, did not fix the visible symptom.
2. A JS-side `Capacitor.getPlatform() === 'ios'` check setting a hardcoded 34px CSS
   variable fallback — verified correct in build, did not fix it either.
3. Tried switching to local `next dev` + Chrome DevTools device emulation for
   faster iteration — proven unable to reproduce or diagnose this bug at all (see
   testing-environment notes above).
4. Replaced the JS heuristic with a native Swift source of truth
   (`MainViewController.swift` subclassing `CAPBridgeViewController`, reading
   `view.safeAreaInsets.bottom`, pushing it in via `evaluateJavaScript`) — confirmed
   correct via diagnostics, but the visual bug persisted.
5. Added diagnostic `NSLog`-based instrumentation (not `console.log`, which wasn't
   reliably surfacing) to trace exact timing and read back actual computed
   `getBoundingClientRect()`/computed-style values for `.bottom-nav`,
   `.app-container`, and `.page-title` at multiple points in the view lifecycle and
   on a half-second poll for 5 seconds after `viewDidAppear`.
6. Currently testing: forcing a synthetic `resize` event dispatch on each poll to
   see if that alone triggers the correction without a real tap.

## Relevant files

- `src/app/globals.css` — `.bottom-nav`, `.app-container`, `.page-content`,
  `--nav-height` variable definition.
- `src/app/layout.tsx` — viewport meta tag, root layout structure
  (`AuthProvider` → ... → `AuthGate` → `.app-container` div wrapping `{children}` +
  `<BottomNav />`).
- `src/components/BottomNav.tsx`, `src/components/PageHeader.tsx`.
- `ios/App/App/MainViewController.swift` — the native diagnostic/fix code.
- `ios/App/App/Base.lproj/Main.storyboard` — wires `MainViewController` in as the
  app's root view controller (subclass of Capacitor's `CAPBridgeViewController`).
- `capacitor.config.ts` — `iosScheme: 'https'`, `androidScheme: 'https'`.
- `.github/workflows/ios-simulator-build.yml` — the CI build/test pipeline.
- `TICKETS.md` — ticket **MYS-2a**, which has a fuller blow-by-blow log of every iOS
  CI/build issue hit along the way (double-zip artifacts, wrong-architecture
  builds, missing `GoogleService-Info.plist`, Firebase Auth iframe hangs, etc. —
  mostly resolved, unrelated to this specific bug, but useful background on the
  same testing pipeline).

## What we'd like fresh eyes on

Is there a known, more direct fix for "iOS WKWebView renders a `100vh`/fixed-position
layout using a stale/incorrect viewport size on cold launch, and only an explicit
user gesture (or a specific programmatic trigger we haven't found yet) causes it to
recompute correctly"? Candidate ideas we have *not* yet tried:

- Using `100dvh`/`100svh` instead of `100vh` (dynamic/small viewport units) —
  purpose-built for exactly this class of mobile-viewport instability, though
  browser/WebKit-version support inside a WKWebView (vs. real Safari) is unclear to
  us.
- Setting a `--vh` custom property from JS (`window.innerHeight * 0.01`) kept in
  sync via a `resize`/`visualViewport.onresize` listener, and using
  `calc(var(--vh) * 100)` instead of `100vh` anywhere it's used — a very common
  historical workaround for iOS Safari's `100vh` bugs, not yet tried here.
- Adjusting `contentInsetAdjustmentBehavior` on the native `WKWebView` (currently
  left at Capacitor's default) or other native `WKWebView`/`UIScrollView`
  configuration that affects how/when the webview recomputes layout on size
  changes.
- Whether Next.js static export + Capacitor's custom `WKURLSchemeHandler` loading
  path interacts with WebKit's layout/paint scheduling differently than a normal
  `https://` page load in a way that's specifically responsible for this.
