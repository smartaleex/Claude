import UIKit

/* The page's own colour, remembered between launches so the native frame
   already matches before the web page has drawn (no white flash), and so the
   status bar text can be light on a dark skin and dark on a light one. The
   page tells us whenever its look changes (see core/native.js). */
final class ThemeStore {
    static let shared = ThemeStore()

    private let hexKey = "themeBackgroundHex"
    private let darkKey = "themeIsDark"

    private(set) var background: UIColor
    private(set) var isDark: Bool

    private init() {
        let hex = UserDefaults.standard.string(forKey: hexKey) ?? "#F4EFE7"
        background = UIColor(hex: hex)
        isDark = UserDefaults.standard.bool(forKey: darkKey)
    }

    func apply(hex: String, dark: Bool) {
        UserDefaults.standard.set(hex, forKey: hexKey)
        UserDefaults.standard.set(dark, forKey: darkKey)
        background = UIColor(hex: hex)
        isDark = dark
        WebHost.shared.webView.backgroundColor = background
        RootViewController.current?.themeChanged()
    }
}

extension UIColor {
    /* "#RRGGBB" or "#RGB". Anything else falls back to the Paper cream. */
    convenience init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        var value: UInt64 = 0
        if s.count == 6, Scanner(string: s).scanHexInt64(&value) {
            self.init(red: CGFloat((value >> 16) & 0xFF) / 255,
                      green: CGFloat((value >> 8) & 0xFF) / 255,
                      blue: CGFloat(value & 0xFF) / 255,
                      alpha: 1)
        } else {
            self.init(red: 0.957, green: 0.937, blue: 0.906, alpha: 1)
        }
    }
}
