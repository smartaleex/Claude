import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = RootViewController()
        window.makeKeyAndVisible()
        self.window = window
    }

    /* Resigning active also happens for the app switcher and for system
       sheets, so it only hides the screen; backgrounding is what locks. */
    func sceneWillResignActive(_ scene: UIScene) {
        RootViewController.current?.sceneWillResignActive()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        RootViewController.current?.sceneDidBecomeActive()
        WebHost.shared.tellPage("native-active")
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        RootViewController.current?.sceneDidEnterBackground()
    }
}
