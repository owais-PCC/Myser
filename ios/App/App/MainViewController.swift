import UIKit
import Capacitor

/// DIAGNOSTIC/FIX BUILD (round 3). A real screenshot of the "before
/// double-tap" state showed BOTH edges wrong at once — the top header
/// clipped under the status bar/Dynamic Island AND the bottom nav clipped
/// — ruling out a bottom-safe-area-only explanation. Round 2's diagnostic
/// logs showed native windowInnerHeight correctly settling to its final
/// value within ~3s with zero interaction, while the user confirmed the
/// visual bug never self-corrects without a tap — meaning the page's own
/// CSS layout (100vh-based sizing, fixed positioning) isn't reactively
/// recomputing to match the native view size. That's a known class of iOS
/// WebKit bug: viewport-unit/fixed-position geometry can get stuck on a
/// stale snapshot until something forces an explicit reflow — which a
/// double-tap does as a side effect of its native zoom-reset gesture.
///
/// This build tests the fix directly: dispatches a synthetic `resize`
/// event on every poll (see applyAndInspect) to force that recomputation
/// proactively instead of waiting for a real tap, and logs measurements
/// of both .app-container (top/bottom/height) and .page-title (top) —
/// not just .bottom-nav — so we can see the whole-page picture the
/// screenshot showed, all via NSLog since we don't know if Capacitor's
/// console-forwarding bridge is attached yet at these early timestamps.
///
/// Android is untouched: MainActivity.java doesn't use this class at all.
class MainViewController: CAPBridgeViewController {
    private let startTime = Date()
    private var pollCount = 0

    private func elapsedMs() -> Int {
        return Int(Date().timeIntervalSince(startTime) * 1000)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applyAndInspect(source: "viewSafeAreaInsetsDidChange")
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyAndInspect(source: "viewDidLayoutSubviews")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyAndInspect(source: "viewDidAppear")
        // Poll every 0.5s for 5s after the view appears, entirely without
        // any user interaction, to see whether/when the layout settles on
        // its own.
        for i in 1...10 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.5) { [weak self] in
                self?.applyAndInspect(source: "poll#\(i)")
            }
        }
    }

    private func applyAndInspect(source: String) {
        let bottomInset = view.safeAreaInsets.bottom
        let elapsed = elapsedMs()
        let js = """
        (function() {
          document.documentElement.style.setProperty('--ios-safe-area-bottom-fallback', '\(bottomInset)px');
          // Test theory: native windowInnerHeight settles correctly within
          // ~3s on its own (confirmed in a prior diagnostic run), but the
          // page's own 100vh-based CSS layout doesn't reactively recompute
          // to match without an explicit trigger — a known iOS WebKit
          // quirk (viewport units / fixed-position geometry can get stuck
          // on a stale snapshot until something forces a reflow, which is
          // what a double-tap does as a side effect of its zoom-reset
          // gesture). Dispatching a synthetic resize event here, before
          // reading anything back, tests whether that alone is enough to
          // force the correct recomputation without needing a real tap.
          window.dispatchEvent(new Event('resize'));
          var nav = document.querySelector('.bottom-nav');
          var rect = nav ? nav.getBoundingClientRect() : null;
          var cs = nav ? getComputedStyle(nav) : null;
          var container = document.querySelector('.app-container');
          var containerRect = container ? container.getBoundingClientRect() : null;
          var title = document.querySelector('.page-title');
          var titleRect = title ? title.getBoundingClientRect() : null;
          return JSON.stringify({
            readyState: document.readyState,
            href: window.location.href,
            navFound: !!nav,
            navHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
            fallbackVar: getComputedStyle(document.documentElement).getPropertyValue('--ios-safe-area-bottom-fallback'),
            navRectHeight: rect ? rect.height : null,
            navRectBottom: rect ? rect.bottom : null,
            navComputedHeight: cs ? cs.height : null,
            navComputedPaddingBottom: cs ? cs.paddingBottom : null,
            containerFound: !!container,
            containerRectTop: containerRect ? containerRect.top : null,
            containerRectBottom: containerRect ? containerRect.bottom : null,
            containerRectHeight: containerRect ? containerRect.height : null,
            titleFound: !!title,
            titleRectTop: titleRect ? titleRect.top : null,
            windowInnerHeight: window.innerHeight,
            windowInnerWidth: window.innerWidth,
            visualViewportHeight: window.visualViewport ? window.visualViewport.height : null,
            devicePixelRatio: window.devicePixelRatio
          });
        })();
        """
        webView?.evaluateJavaScript(js) { result, error in
            if let error = error {
                NSLog("[SafeAreaDebug] \(source) at +\(elapsed)ms, nativeBottom=\(bottomInset) — evaluateJavaScript FAILED: \(error)")
            } else {
                NSLog("[SafeAreaDebug] \(source) at +\(elapsed)ms, nativeBottom=\(bottomInset) — result: \(result ?? "nil")")
            }
        }
    }
}
