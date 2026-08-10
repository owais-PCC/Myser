import UIKit
import Capacitor

/// Subclasses CAPBridgeViewController solely to push the real, native
/// bottom safe-area inset (the iOS home-indicator gesture bar height) into
/// the web content as a CSS variable.
///
/// Why this exists: the web-side fix (viewport-fit=cover + CSS env())
/// looked structurally correct and was verified byte-for-byte in built
/// artifacts, but real device tests kept showing the bottom nav clipped by
/// the home indicator regardless — env(safe-area-inset-bottom) was
/// resolving to 0 inside this WKWebView context. Rather than keep
/// guessing, this reads the safe area directly from UIKit and hands it to
/// --ios-safe-area-bottom-fallback, the CSS variable globals.css's max()
/// formula already expects.
///
/// DIAGNOSTIC BUILD: a real device test showed the fix only taking effect
/// after a tap triggered a second layout pass — suggesting the first
/// application landed before the real app page finished loading. Rather
/// than guess at a fix (retries, hooking navigation delegates, etc.)
/// without knowing the actual sequence, this build logs the timing and
/// context of every attempt on both sides so the next test tells us
/// exactly what's happening instead of us speculating further:
///   - NSLog on the Swift side: which lifecycle method fired, when
///     (elapsed ms since view controller creation), and what
///     safeAreaInsets.bottom actually was at that moment.
///   - console.log from the injected JS itself: confirms whether the
///     evaluateJavaScript call actually reached a *document* at all
///     (vs. silently failing), and critically, what document.readyState
///     and window.location.href were at that moment — this tells us
///     directly whether early calls are landing on a blank/about:blank
///     document (confirming the race theory) or the real app page.
/// These logs show up in Appetize's Debug Logs panel same as our other
/// device tests.
///
/// Android is untouched: MainActivity.java doesn't use this class at all,
/// and --ios-safe-area-bottom-fallback simply stays at its 0px :root
/// default there.
class MainViewController: CAPBridgeViewController {
    private let startTime = Date()

    private func elapsedMs() -> Int {
        return Int(Date().timeIntervalSince(startTime) * 1000)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        NSLog("[SafeAreaDebug] viewSafeAreaInsetsDidChange at +\(elapsedMs())ms, bottom=\(view.safeAreaInsets.bottom), webView=\(webView == nil ? "nil" : "present")")
        applySafeAreaInsetToWebView(source: "viewSafeAreaInsetsDidChange")
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        NSLog("[SafeAreaDebug] viewDidLayoutSubviews at +\(elapsedMs())ms, bottom=\(view.safeAreaInsets.bottom), webView=\(webView == nil ? "nil" : "present")")
        applySafeAreaInsetToWebView(source: "viewDidLayoutSubviews")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        NSLog("[SafeAreaDebug] viewDidAppear at +\(elapsedMs())ms, bottom=\(view.safeAreaInsets.bottom), webView=\(webView == nil ? "nil" : "present")")
        applySafeAreaInsetToWebView(source: "viewDidAppear")
    }

    private func applySafeAreaInsetToWebView(source: String) {
        let bottomInset = view.safeAreaInsets.bottom
        let elapsed = elapsedMs()
        let js = """
        (function() {
          document.documentElement.style.setProperty('--ios-safe-area-bottom-fallback', '\(bottomInset)px');
          console.log('[SafeAreaDebug] applied from \(source) at +\(elapsed)ms, bottom=\(bottomInset), readyState=' + document.readyState + ', href=' + window.location.href);
        })();
        """
        webView?.evaluateJavaScript(js) { _, error in
            if let error = error {
                NSLog("[SafeAreaDebug] evaluateJavaScript from \(source) FAILED: \(error)")
            }
        }
    }
}
