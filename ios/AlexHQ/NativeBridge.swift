import UIKit
import WebKit

enum BridgeError: LocalizedError {
    case unknown(String)
    case unavailable(String)
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .unknown(let command): return "Unknown command: \(command)"
        case .unavailable(let message), .failed(let message): return message
        }
    }
}

/* The doorway between the page and the phone.

   The page calls  window.webkit.messageHandlers.native.postMessage({ cmd, ... })
   and gets a promise back with whatever is returned here (see core/native.js,
   which is the only file on the web side that talks to this). To add a native
   feature: add a case below, then a wrapper in core/native.js. */
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let command = body["cmd"] as? String else {
            replyHandler(nil, "Bad message")
            return
        }
        Task { @MainActor in
            do {
                let result = try await self.handle(command, body)
                replyHandler(result, nil)
            } catch {
                replyHandler(nil, error.localizedDescription)
            }
        }
    }

    /* ---------- helpers for reading what the page sent ---------- */

    private func text(_ a: [String: Any], _ key: String) -> String? { a[key] as? String }
    private func number(_ a: [String: Any], _ key: String) -> Double? { (a[key] as? NSNumber)?.doubleValue }
    private func date(_ a: [String: Any], _ key: String) -> Date? {
        number(a, key).map { Date(timeIntervalSince1970: $0 / 1000) }   // the page sends milliseconds
    }

    /* ---------- the commands ---------- */

    @MainActor
    private func handle(_ command: String, _ a: [String: Any]) async throws -> Any? {
        switch command {

        // What this phone and this app can do, so the page only offers real options.
        case "info":
            return [
                "platform": "ios",
                "health": HealthBridge.shared.isAvailable,
                "liveActivities": RestActivity.isEnabled,
                "lock": BiometricLock.shared.enabled,
                "biometry": BiometricLock.shared.biometryName,
                "notifications": await Reminders.isAuthorized(),
            ] as [String: Any]

        case "haptic":
            Haptics.play(text(a, "style") ?? "light")
            return nil

        // The page's background colour and whether it is dark.
        case "theme":
            ThemeStore.shared.apply(hex: text(a, "bg") ?? "#F4EFE7", dark: (a["dark"] as? Bool) ?? false)
            return nil

        case "copy":
            UIPasteboard.general.string = text(a, "text") ?? ""
            return true

        case "open":
            if let string = text(a, "url"), let url = URL(string: string) { UIApplication.shared.open(url) }
            return nil

        // ---- files ----
        case "share":
            try Files.share(name: text(a, "name") ?? "alex-hq-backup.json", text: text(a, "text") ?? "")
            return true

        case "backup":
            try Files.writeBackup(name: text(a, "name") ?? "alex-hq-backup-latest.json", text: text(a, "text") ?? "")
            return true

        // ---- reminders ----
        case "notify.permission":
            return await Reminders.requestAuth()

        case "notify.daily":
            guard let id = text(a, "id"), let hour = number(a, "hour"), let minute = number(a, "minute") else {
                throw BridgeError.failed("A reminder needs an id and a time")
            }
            try await Reminders.scheduleDaily(
                id: id, title: text(a, "title") ?? "Alex HQ", body: text(a, "body") ?? "",
                hour: Int(hour), minute: Int(minute), route: text(a, "route"))
            return true

        case "notify.cancel":
            Reminders.cancel(ids: (a["ids"] as? [String]) ?? [])
            return true

        // ---- rest timer: a notification for when it ends, plus the lock-screen countdown ----
        case "rest.start":
            let seconds = number(a, "seconds") ?? 0
            guard seconds > 0 else { return nil }
            if await Reminders.isAuthorized() {
                _ = try? await Reminders.scheduleRestEnd(
                    seconds: seconds, title: "Rest is over",
                    body: text(a, "label") ?? "Next set")
            }
            await RestActivity.start(seconds: seconds, label: text(a, "label") ?? "Next set")
            return true

        case "rest.stop":
            Reminders.cancel(ids: [Reminders.restID])
            await RestActivity.stop()
            return true

        // ---- Apple Health ----
        case "health.connect":
            try await HealthBridge.shared.requestAccess()
            return true

        case "health.sleep":
            return try await HealthBridge.shared.lastNight()

        case "health.weight":
            return try await HealthBridge.shared.latestWeight()

        case "health.workout":
            guard let start = date(a, "start"), let end = date(a, "end"), end > start else {
                throw BridgeError.failed("A workout needs a start and an end")
            }
            try await HealthBridge.shared.saveWorkout(start: start, end: end)
            return true

        // ---- Face ID lock ----
        case "lock.set":
            let wanted = (a["enabled"] as? Bool) ?? false
            if !wanted {
                BiometricLock.shared.enabled = false
                return true
            }
            // Prove it works before turning it on, so nobody gets locked out of their own logs.
            let ok = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
                BiometricLock.shared.authenticate { continuation.resume(returning: $0) }
            }
            if ok { BiometricLock.shared.enabled = true }
            return ok

        // ---- widget ----
        case "snapshot":
            let tiles = (a["tiles"] as? [[String: Any]] ?? []).map {
                GlanceSnapshot.Tile(label: $0["label"] as? String ?? "",
                                    value: $0["value"] as? String ?? "-",
                                    sub: $0["sub"] as? String ?? "")
            }
            WidgetSync.save(GlanceSnapshot(tiles: tiles, headline: text(a, "headline") ?? "Alex HQ", updated: Date()))
            return nil

        default:
            throw BridgeError.unknown(command)
        }
    }
}
