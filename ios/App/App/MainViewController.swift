import UIKit
import Capacitor

/// DIAGNOSTIC BUILD (round 2). Round 1 confirmed view.safeAreaInsets.bottom
/// is correctly 34.0 from the very first call (+166ms) — so the native
/// side isn't the problem. Critically, when a tap "fixed" the display on
/// a real device test, NONE of viewSafeAreaInsetsDidChange/
/// viewDidLayoutSubviews/viewDidAppear fired again — meaning whatever the
/// tap fixed happened entirely in the web layer, without any of our
/// native code re-running. That points away from "the CSS variable never
/// got set in time" and toward "this might be a viewport/layout rendering
/// glitch on cold launch, unrelated to our fix" — but that's still a
/// hypothesis, not confirmed.
///
/// This build tests it directly: instead of only logging whether our code
/// ran, it logs what the *actual rendered layout* is over time — reading
/// back --ios-safe-area-bottom-fallback, --nav-height, and .bottom-nav's
/// real getBoundingClientRect() height, both immediately and on a timer
/// for several seconds after launch, all via NSLog (not console.log,
/// since we don't know if Capacitor's console-forwarding bridge is even
/// attached yet at these early timestamps — evaluateJavaScript's own
/// completion handler return value is used instead, which doesn't depend
/// on that bridge at all).
///
/// If the numbers are already correct at +166ms and stay correct: the fix
/// works, and the visible "half cut" bug at launch is a separate,
/// unrelated rendering glitch. If the numbers are wrong at launch and
/// only become correct later without any native re-trigger: something in
/// the web layer (React hydration timing, a later style recalculation)
/// is the actual cause, not the safe-area value itself.
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
          var nav = document.querySelector('.bottom-nav');
          var rect = nav ? nav.getBoundingClientRect() : null;
          var cs = nav ? getComputedStyle(nav) : null;
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
            windowInnerHeight: window.innerHeight,
            visualViewportHeight: window.visualViewport ? window.visualViewport.height : null
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
