import SwiftUI
import WidgetKit

/* Everything this extension offers: a "today at a glance" widget and the
   rest-timer Live Activity. */
@main
struct AlexHQWidgets: WidgetBundle {
    var body: some Widget {
        GlanceWidget()
        RestTimerLiveActivity()
    }
}

/* Colours that echo the app's Paper look: warm paper by day, near-black by night. */
enum Palette {
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.11, green: 0.11, blue: 0.12) : Color(red: 0.957, green: 0.937, blue: 0.906)
    }
    static func ink(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.95, green: 0.93, blue: 0.90) : Color(red: 0.10, green: 0.10, blue: 0.11)
    }
    static let accent = Color(red: 0.78, green: 0.20, blue: 0.16)
}
