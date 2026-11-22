import LocalAuthentication

/* Optional Face ID (or passcode) lock. Off by default; the page's Settings
   turns it on. The app locks when it goes to the background and starts locked
   when it is opened cold, so a stranger holding the phone never sees the logs. */
final class BiometricLock {
    static let shared = BiometricLock()

    private let key = "faceIDLock"
    private var authenticating = false

    var onChange: (() -> Void)?
    private(set) var isLocked: Bool

    var enabled: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set {
            UserDefaults.standard.set(newValue, forKey: key)
            if !newValue { isLocked = false }
            onChange?()
        }
    }

    private init() {
        isLocked = UserDefaults.standard.bool(forKey: "faceIDLock")
    }

    func appDidBackground() {
        guard enabled else { return }
        isLocked = true
        onChange?()
    }

    /* "Face ID", "Touch ID" or "none", for the Settings label. */
    var biometryName: String {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else { return "none" }
        switch context.biometryType {
        case .faceID:  return "Face ID"
        case .touchID: return "Touch ID"
        default:       return "none"
        }
    }

    func authenticate(completion: @escaping (Bool) -> Void) {
        guard !authenticating else { completion(false); return }
        let context = LAContext()
        var error: NSError?
        // With no passcode set there is nothing to protect the lock with, so do not trap the user.
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            isLocked = false
            onChange?()
            completion(true)
            return
        }
        authenticating = true
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock Alex HQ") { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.authenticating = false
                if success { self.isLocked = false }
                self.onChange?()
                completion(success)
            }
        }
    }
}
