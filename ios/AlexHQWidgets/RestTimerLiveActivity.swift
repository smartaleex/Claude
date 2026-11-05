import ActivityKit
import SwiftUI
import WidgetKit

/* The rest timer on the lock screen and in the Dynamic Island. The countdown is
   drawn by the system from the end time, so it keeps ticking with the phone
   locked. When the end time passes the activity is "stale" and shows "Go". */
struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            LockScreenRest(context: context)
                .activityBackgroundTint(Color(red: 0.957, green: 0.937, blue: 0.906))
                .activitySystemActionForegroundColor(Color(red: 0.10, green: 0.10, blue: 0.11))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Rest", systemImage: "timer").font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestClock(context: context).font(.title2.monospacedDigit().weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.label).font(.subheadline)
                }
            } compactLeading: {
                Image(systemName: "timer")
            } compactTrailing: {
                RestClock(context: context)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .frame(width: 46)
            } minimal: {
                Image(systemName: "timer")
            }
        }
    }
}

/* "1:23" counting down, or "Go" once it is over. */
private struct RestClock: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        // One reading of the clock, so the range below can never run backwards.
        let now = Date()
        if context.isStale || context.state.endsAt <= now {
            Text("Go")
        } else {
            Text(timerInterval: now...context.state.endsAt, countsDown: true, showsHours: false)
        }
    }
}

private struct LockScreenRest: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Rest").font(.caption).foregroundStyle(.secondary)
                Text(context.state.label).font(.headline)
            }
            Spacer()
            RestClock(context: context)
                .font(.system(size: 38, weight: .semibold, design: .serif).monospacedDigit())
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}
