import UserNotifications

/* Local notifications: they are scheduled on the phone, so they fire at the
   right time even when the app is closed and with no signal or server.

   Two kinds:
   - daily reminders (meds, food, check-in) that repeat at a set time;
   - the rest timer, one notification set for when the rest ends, because iOS
     freezes a web page the moment the phone locks. */
enum Reminders {
    static let restID = "rest-timer"

    private static var center: UNUserNotificationCenter { UNUserNotificationCenter.current() }

    static func requestAuth() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
    }

    static func isAuthorized() async -> Bool {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return true
        default: return false
        }
    }

    static func scheduleDaily(id: String, title: String, body: String,
                              hour: Int, minute: Int, route: String?) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if let route = route { content.userInfo = ["route": route] }

        var when = DateComponents()
        when.hour = hour
        when.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
        center.removePendingNotificationRequests(withIdentifiers: [id])
        try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    static func scheduleRestEnd(seconds: Double, title: String, body: String) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["route": "forge"]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
        center.removePendingNotificationRequests(withIdentifiers: [restID])
        try await center.add(UNNotificationRequest(identifier: restID, content: content, trigger: trigger))
    }

    static func cancel(ids: [String]) {
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
    }
}
