# Alex HQ for iPhone

The same app, as a real iPhone app, with the things only a real app can do.

It is not a copy. The iPhone app contains the web app from this repo as it is
(`index.html` and `assets/`), so a fix made to the web app shows up in the
iPhone app the next time it is built. Nothing is written twice.

## What the iPhone app adds

| | |
|---|---|
| **Real haptics** | Taps you can feel. iPhone Safari has no vibration, so the web version is silent. |
| **Rest timer on the lock screen** | A countdown on the lock screen and in the Dynamic Island, and a notification when the rest ends, even with the phone locked. Web pages freeze the moment iOS locks. |
| **Reminders** | Food and an evening check-in, and a full **medication schedule** (Day, then Medication schedule): several medications, several times a day, weekday-only ones, with-food notes. Off until you turn them on, the lock screen says "Time for your meds." rather than a name unless you choose otherwise, and they arrive with the app closed and no signal. |
| **Apple Health** | Last night's sleep and your bodyweight offered with one tap (never filled in for you), and finished gym sessions saved to Health. |
| **Face ID lock** | Optional. Asks each time the app opens and hides it in the app switcher. |
| **Home-screen widget** | Eaten, gym this week, anchors done and pouches. Small, medium and lock-screen sizes. |
| **Daily backup** | A copy of everything is saved once a day to Files > On My iPhone > Alex HQ, and goes into iPhone backups. |
| **Share sheet for backups** | "Download a backup" opens the iOS share sheet (Save to Files, AirDrop, Mail). |

## Put it on your phone

You need: a Mac with Xcode, your iPhone and its cable, and your Apple Developer account.

**1. Get the files** (Terminal on the Mac)

```
git clone -b claude/alex-hq-web-app-ndzk1l https://github.com/smartaleex/Claude ~/alex-hq
open ~/alex-hq/ios/AlexHQ.xcodeproj
```

If `~/alex-hq` already exists, run `cd ~/alex-hq && git pull` instead of the clone.

**2. Choose your team** (once)

In Xcode, click **AlexHQ** at the top of the left sidebar (the blue icon). In the middle
panel you will see two targets: **AlexHQ** and **AlexHQWidgets**. For each one:

1. Open the **Signing & Capabilities** tab.
2. Next to **Team**, choose your paid developer team.

Xcode will register the app and set up Health and the shared storage by itself.

If Xcode says the **bundle identifier is not available**, someone already uses that
name. Close Xcode, run this in Terminal with a name of your own, and reopen it:

```
~/alex-hq/ios/tools/set_bundle_id.sh com.yourname.alexhq
open ~/alex-hq/ios/AlexHQ.xcodeproj
```

**3. Run it on your iPhone**

1. Plug the iPhone in and unlock it. Tap **Trust** if it asks.
2. At the top of Xcode, next to the play button, choose your iPhone.
3. Press the **play button**.
4. First time only, on the iPhone: **Settings > Privacy & Security > Developer Mode** on
   (it restarts the phone), and **Settings > General > VPN & Device Management**, tap your
   name, **Trust**.

**4. Bring your data across**

The iPhone app keeps its own storage, separate from Safari. In the old app (Safari or
home-screen icon): **Settings > Download a backup**, save it to Files. In the new app:
**Settings > Restore from backup**, pick that file.

## First-run check (two minutes)

1. Log something, then swipe the app away and open it again. It should still be there.
   If it is not, tell me before you trust it with real data.
2. Settings > **On this iPhone** is there. Turn on a reminder and allow notifications.
3. Start a gym session, log a set, lock the phone. The rest countdown should appear on the
   lock screen.
4. Settings > Connect Apple Health, then open Day > sleep. It offers last night's hours.

## If the build fails

Xcode shows red errors on the left. Copy the first one (the text, or a screenshot) and send
it to me. I cannot build on my side, so the first build on a real Xcode is the real test,
and a quick fix from the error message is normal.

## What is where

```
ios/
  AlexHQ.xcodeproj    open this one
  AlexHQ/             the app: a full-screen web view plus the native features
    WebHost.swift       the web view; opens links and alerts the right way
    BundleSchemeHandler.swift   serves the web app out of the app (alexhq://app/)
    NativeBridge.swift  every message the page can send the phone
    Haptics / Reminders / HealthBridge / BiometricLock / Files / RestActivity .swift
  AlexHQWidgets/      home-screen widget and the rest-timer Live Activity
  Shared/             the few files the app and widget both use
  tools/              make_project.rb (rebuilds the .xcodeproj), set_bundle_id.sh
```

The page talks to the phone through one file, `assets/js/core/native.js`. In a normal
browser every call in it does nothing, so the website keeps working untouched. To add a
native feature: add a `case` in `NativeBridge.swift`, a wrapper in `native.js`, and use it.

If you add or rename a Swift file, regenerate the project: `gem install --user-install
xcodeproj` then `ruby ios/tools/make_project.rb`. `npm test` checks that the project, the
Swift files and the bridge agree, because there is no Xcode on the machines that run the tests.

## Putting it on the App Store or TestFlight

Not needed to use the app yourself. When you want it: in Xcode choose **Product > Archive**,
then **Distribute App**. The app icon and permission texts are already in place.
