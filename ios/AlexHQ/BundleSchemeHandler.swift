import WebKit

/* Serves the web app out of the app bundle at alexhq://app/...

   Why not just open index.html as a file? Browsers refuse to load ES modules
   from file:// (the app is built from modules), and a file origin keeps no
   stable storage. A custom scheme behaves like a normal website address:
   modules load, and localStorage / IndexedDB persist under alexhq://app.

   Everything in the bundle is read-only and shipped with the app, so there is
   no cache to go stale. The service worker is not needed (and is skipped by the
   page, which only registers it on https). */
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "alexhq"
    static let startURL = URL(string: "alexhq://app/index.html")!

    private let root: URL = (Bundle.main.resourceURL ?? Bundle.main.bundleURL).standardizedFileURL

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        // Never serve anything from outside the bundle folder.
        guard file.path.hasPrefix(root.path) else {
            respond(urlSchemeTask, url: url, status: 403, type: "text/plain", body: Data("Forbidden".utf8))
            return
        }
        guard let data = try? Data(contentsOf: file) else {
            respond(urlSchemeTask, url: url, status: 404, type: "text/plain", body: Data("Not found".utf8))
            return
        }
        respond(urlSchemeTask, url: url, status: 200, type: mimeType(for: file), body: data)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, body: Data) {
        let headers = [
            "Content-Type": type,
            "Content-Length": String(body.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    /* Module scripts are only run if they are served as JavaScript, so this
       list matters. Anything unknown is sent as plain bytes. */
    private func mimeType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html", "htm":     return "text/html; charset=utf-8"
        case "js", "mjs":       return "text/javascript; charset=utf-8"
        case "css":             return "text/css; charset=utf-8"
        case "json":            return "application/json; charset=utf-8"
        case "webmanifest":     return "application/manifest+json; charset=utf-8"
        case "png":             return "image/png"
        case "jpg", "jpeg":     return "image/jpeg"
        case "svg":             return "image/svg+xml"
        case "ico":             return "image/x-icon"
        case "woff2":           return "font/woff2"
        case "woff":            return "font/woff"
        case "ttf":             return "font/ttf"
        default:                return "application/octet-stream"
        }
    }
}
