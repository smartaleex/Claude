import UIKit

/* Real taps. The web version can't do this: iPhone Safari has no vibration API,
   so the page's haptic() was silent. In the app it goes through here. */
enum Haptics {
    private static let selection = UISelectionFeedbackGenerator()
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private static let notify = UINotificationFeedbackGenerator()

    static func play(_ style: String) {
        switch style {
        case "selection": selection.selectionChanged()
        case "medium":    medium.impactOccurred()
        case "heavy":     heavy.impactOccurred()
        case "success":   notify.notificationOccurred(.success)
        case "warning":   notify.notificationOccurred(.warning)
        case "error":     notify.notificationOccurred(.error)
        default:          light.impactOccurred()
        }
    }
}
