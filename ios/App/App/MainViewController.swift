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
/// resolving to 0 inside this WKWebView context (content loads through a
/// custom WKURLSchemeHandler, a context WebKit is known to sometimes fail
/// to propagate safeAreaInsets to CSS for). Rather than keep guessing at
/// the web layer, this reads the safe area directly from UIKit — an
/// unambiguous, always-correct native API with no browser-engine
/// dependency — and hands it to the same CSS variable
/// (--ios-safe-area-bottom-fallback) the shared globals.css formula
/// already expects, so the rest of the UI code (--nav-height, .bottom-nav)
/// doesn't need to know or care where the value came from.
///
/// Android is untouched: MainActivity.java doesn't use this class at all,
/// and --ios-safe-area-bottom-fallback simply stays at its 0px :root
/// default there.
class MainViewController: CAPBridgeViewController {
    private var lastAppliedInset: CGFloat = -1

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applySafeAreaInsetToWebView()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applySafeAreaInsetToWebView()
    }

    private func applySafeAreaInsetToWebView() {
        let bottomInset = view.safeAreaInsets.bottom
        // Skip redundant calls (viewDidLayoutSubviews can fire often) —
        // only push to the webview when the value actually changes (e.g.
        // once on initial layout, again on rotation).
        guard bottomInset != lastAppliedInset else { return }
        lastAppliedInset = bottomInset

        let js = "document.documentElement.style.setProperty('--ios-safe-area-bottom-fallback', '\(bottomInset)px')"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
