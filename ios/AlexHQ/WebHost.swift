import UIKit
import WebKit

/* The one web view the whole app lives in. It is created once and kept for the
   life of the process, so switching apps and coming back never reloads it. */
final class WebHost: NSObject, WKNavigationDelegate, WKUIDelegate {
    static let shared = WebHost()

    let webView: WKWebView
    private let bridge: NativeBridge

    private override init() {
        let handler = NativeBridge()
        bridge = handler
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        let controller = WKUserContentController()
        // The page checks this to know it is inside the app (core/native.js).
        controller.addUserScript(WKUserScript(
            source: "window.__NATIVE__ = { platform: 'ios', version: '\(version)' };",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.addScriptMessageHandler(handler, contentWorld: .page, name: "native")
        config.userContentController = controller

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self

        // The page draws its own safe areas (viewport-fit=cover), so UIKit must not inset it.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = ThemeStore.shared.background
        webView.scrollView.backgroundColor = .clear
        #if DEBUG
        // Lets you inspect the page from Safari on the Mac: Develop > your iPhone.
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif

        webView.load(URLRequest(url: BundleSchemeHandler.startURL))
    }

    /* ---------- talking to the page ---------- */

    /* Jump to a route such as "day" or "forge" (a tapped reminder). The route
       is reduced to safe characters before it goes into script. */
    func open(route: String) {
        let safe = route.filter { $0.isLetter || $0.isNumber || $0 == "/" || $0 == "-" || $0 == "_" }
        guard !safe.isEmpty else { return }
        webView.evaluateJavaScript("window.navigate ? window.navigate('\(safe)') : (location.hash = '#\(safe)')")
    }

    /* Fires a plain DOM event on the page, e.g. "native-active" when the app
       comes back to the front. */
    func tellPage(_ eventName: String) {
        let safe = eventName.filter { $0.isLetter || $0 == "-" }
        webView.evaluateJavaScript("window.dispatchEvent(new Event('\(safe)'))")
    }

    /* ---------- navigation ---------- */

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        switch url.scheme?.lowercased() {
        case BundleSchemeHandler.scheme, "about", "blob", "data":
            decisionHandler(.allow)
        default:
            // Web links, phone numbers, messages and mail all open in their own apps.
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    /* If iOS reclaims the web view's process to free memory, bring it back. */
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    /* target="_blank" links, e.g. the Google AI Studio button. */
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    /* ---------- alert / confirm / prompt ----------
       A web view silently ignores these unless the app draws them. */

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard let top = UIApplication.topViewController() else { completionHandler(); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        top.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard let top = UIApplication.topViewController() else { completionHandler(false); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        top.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        guard let top = UIApplication.topViewController() else { completionHandler(nil); return }
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        top.present(alert, animated: true)
    }
}

extension UIApplication {
    /* The view controller currently on top, for presenting sheets and alerts. */
    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}
