import UIKit

/* Saving things out of the page. A web view can't do <a download>, so a backup
   goes through the iOS share sheet instead (Save to Files, AirDrop, Mail). */
enum Files {
    /* Opens the share sheet with a small text file. */
    static func share(name: String, text: String) throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe(name))
        try text.write(to: url, atomically: true, encoding: .utf8)
        guard let top = UIApplication.topViewController() else {
            throw BridgeError.failed("Nothing on screen to show the share sheet from")
        }
        top.present(UIActivityViewController(activityItems: [url], applicationActivities: nil), animated: true)
    }

    /* Quietly overwrites a backup in the app's Documents folder. That folder
       shows up in the Files app under On My iPhone > Alex HQ, and is included
       in an iPhone backup, so a copy of the data survives losing the app. */
    static func writeBackup(name: String, text: String) throws {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try text.write(to: docs.appendingPathComponent(safe(name)), atomically: true, encoding: .utf8)
    }

    private static func safe(_ name: String) -> String {
        let cleaned = name.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == "." ? $0 : "-" }
        let result = String(cleaned)
        return result.isEmpty ? "alex-hq-backup.json" : result
    }
}
