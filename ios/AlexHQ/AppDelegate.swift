import UIKit
import UserNotifications

/* App entry point. The whole app is one full-screen web view (see WebHost);
   everything native hangs off it through NativeBridge. */
@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    /* Notifications that arrive while the app is open. The page already
       shows its own "rest is over" alert, so the rest-timer one stays quiet. */
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        if notification.request.identifier == Reminders.restID { return [] }
        return [.banner, .sound]
    }

    /* Tapping a reminder opens the part of the app it is about. */
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        guard let route = response.notification.request.content.userInfo["route"] as? String else { return }
        await MainActor.run { WebHost.shared.open(route: route) }
    }
}
