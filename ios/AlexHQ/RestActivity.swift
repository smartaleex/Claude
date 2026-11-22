import ActivityKit
import WidgetKit

/* Starts and stops the rest timer's Live Activity, and refreshes the
   home-screen widget. The countdown itself is drawn by the system from the end
   time, so it keeps running with the phone locked and the app closed. */
@MainActor
enum RestActivity {
    static var isEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    static func start(seconds: Double, label: String) async {
        await stop()
        guard isEnabled else { return }
        let endsAt = Date().addingTimeInterval(max(1, seconds))
        let content = ActivityContent(
            state: RestTimerAttributes.ContentState(endsAt: endsAt, label: label),
            staleDate: endsAt)
        _ = try? Activity.request(
            attributes: RestTimerAttributes(title: "Rest"),
            content: content,
            pushType: nil)
    }

    /* Ends every rest timer, not just one this launch started, in case the app
       was reopened part-way through a rest. */
    static func stop() async {
        for activity in Activity<RestTimerAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}

enum WidgetSync {
    static func save(_ snapshot: GlanceSnapshot) {
        SharedStore.write(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
