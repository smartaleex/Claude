import Foundation

/* What the home-screen widget shows, handed from the app to the widget through
   an App Group (a small storage area both can read). The page sends the same
   four numbers it shows in its "at a glance" row; the widget just draws them. */
struct GlanceSnapshot: Codable {
    struct Tile: Codable, Hashable {
        var label: String
        var value: String
        var sub: String
    }

    var tiles: [Tile]
    var headline: String
    var updated: Date

    static let sample = GlanceSnapshot(
        tiles: [
            Tile(label: "Eaten", value: "1,840", sub: "kcal"),
            Tile(label: "Gym", value: "2/3", sub: "wk"),
            Tile(label: "Done", value: "4/7", sub: "anchors"),
            Tile(label: "Zyn", value: "3", sub: "today"),
        ],
        headline: "Alex HQ",
        updated: Date())
}

enum SharedStore {
    /* Must match the group in both .entitlements files. */
    static let group = "group.com.alexkonnaris.hq"
    private static let key = "glanceSnapshot"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: group) }

    static func write(_ snapshot: GlanceSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults?.set(data, forKey: key)
    }

    static func read() -> GlanceSnapshot? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(GlanceSnapshot.self, from: data)
    }
}
