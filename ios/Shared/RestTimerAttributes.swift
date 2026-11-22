import ActivityKit
import Foundation

/* The rest timer on the lock screen and in the Dynamic Island. This file is
   compiled into both the app (which starts and stops it) and the widget
   extension (which draws it), so the two always agree on the shape. */
struct RestTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endsAt: Date
        var label: String
    }

    var title: String
}
