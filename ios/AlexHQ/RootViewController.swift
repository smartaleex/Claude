import UIKit

/* A full-screen web view, plus a cover that hides it in the app switcher and
   while the Face ID lock is up. */
final class RootViewController: UIViewController {
    static weak var current: RootViewController?

    private let cover = CoverView()
    private let lock = BiometricLock.shared
    private var hiddenBySystem = false

    override var preferredStatusBarStyle: UIStatusBarStyle {
        ThemeStore.shared.isDark ? .lightContent : .darkContent
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()
        RootViewController.current = self
        view.backgroundColor = ThemeStore.shared.background

        let web = WebHost.shared.webView
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)

        cover.translatesAutoresizingMaskIntoConstraints = false
        cover.isHidden = true
        cover.onUnlock = { [weak self] in self?.unlock() }
        view.addSubview(cover)

        // Pinned to the screen edges, not the safe area: the page handles its own insets.
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cover.topAnchor.constraint(equalTo: view.topAnchor),
            cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        lock.onChange = { [weak self] in self?.refreshCover() }
        refreshCover()
    }

    func themeChanged() {
        view.backgroundColor = ThemeStore.shared.background
        setNeedsStatusBarAppearanceUpdate()
    }

    /* ---------- privacy cover and lock ---------- */

    func sceneWillResignActive() { hiddenBySystem = true; refreshCover() }

    func sceneDidBecomeActive() {
        hiddenBySystem = false
        refreshCover()
        if lock.isLocked { unlock() }
    }

    func sceneDidEnterBackground() { lock.appDidBackground() }

    private func refreshCover() {
        let show = lock.enabled && (lock.isLocked || hiddenBySystem)
        cover.isHidden = !show
        cover.showUnlock(lock.isLocked)
    }

    private func unlock() {
        lock.authenticate { [weak self] _ in self?.refreshCover() }
    }
}

/* A blurred sheet over the page. When locked it also offers an Unlock button. */
final class CoverView: UIView {
    var onUnlock: (() -> Void)?

    private let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterial))
    private let button = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        blur.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blur)

        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Unlock Alex HQ", for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.addAction(UIAction { [weak self] _ in self?.onUnlock?() }, for: .touchUpInside)
        button.isHidden = true
        addSubview(button)

        NSLayoutConstraint.activate([
            blur.topAnchor.constraint(equalTo: topAnchor),
            blur.bottomAnchor.constraint(equalTo: bottomAnchor),
            blur.leadingAnchor.constraint(equalTo: leadingAnchor),
            blur.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.centerXAnchor.constraint(equalTo: centerXAnchor),
            button.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    func showUnlock(_ visible: Bool) { button.isHidden = !visible }
}
