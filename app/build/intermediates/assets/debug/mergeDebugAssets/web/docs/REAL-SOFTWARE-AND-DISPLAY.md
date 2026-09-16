# Real Software, Portrait Display, and Creative Apps

## What Is Implemented

WIN12 now includes a real Software Center, portrait-default Android orientation controls, a balanced responsive PC taskbar, original high-density wallpapers, Paint, Photos, and a restricted Terminal command interface.

The React build is verified separately from native execution. No device was connected during implementation. No Chrome, Deriv MT5, or MetaEditor reinstall has been performed or verified in this environment. Android compilation, physical-device rotation, actual external application functionality, and native PNG export still require device testing.

## Chrome and Deriv MT5

Software Center contains official installation references, not fake installed-app entries:

| Product | Official source | Android package reference |
| --- | --- | --- |
| Google Chrome | Google Play and Google Chrome support | `com.android.chrome` |
| Deriv MetaTrader 5 | Deriv's official platform/download pages and MetaQuotes' Google Play listing | `net.metaquotes.metatrader5` |
| MetaEditor | MetaQuotes' official MetaEditor product/help pages | No standalone Android package supplied |

The package IDs were checked against the actual public Google Play listings. They are used for narrow package visibility, installation-status checks, and official store handoff. Discovered launcher components, labels, versions, and icons still come from the actual Android PackageManager; no launchable record is manufactured from these reference IDs.

Deriv mobile trading uses the MetaQuotes MetaTrader 5 application with a Deriv account and server. WIN12 does not ask for broker credentials, impersonate a trading terminal, or submit orders. Android MT5 provides the mobile features supported by that actual version. Desktop Expert Advisors, MetaEditor, and strategy testing are not magically enabled in the Android app by this launcher.

When a requested product is positively discovered and launchable, a shortcut points to that real target and uses its actual icon. Icons are rendered from PackageManager at 256 x 256 and scaled down for high-density desktop display. Missing software has a neutral reference symbol in Software Center, not a fake official desktop app icon.

## How to Add Desktop Runtime

To add and configure the Windows Compatibility Runtime (Wine & Box64) to execute Windows `.exe` and `.msi` software:

1. **One-Click Quick Provision in Settings**:
   - Open **Settings** (or click the runtime icon in the taskbar tray / Installer).
   - Go to the **Compatibility Runtime** tab.
   - Under **How to Add Desktop Runtime**, click **Provision Wine 9.0 & Box64 Runtime**.
   - This initializes the Wine 9.0 (Staging) prefix sandbox and Box64 ARM64 translator, creating isolated prefixes in `C:\users\win12user` and `C:\Program Files`.
2. **Custom HTTPS Bundle**:
   - Provide an HTTPS link to any standard Wine / Box64 archive bundle (.zip) with optional SHA-256 checksum verification.
3. **Native Android Rootless (Termux / Proot / Box64)**:
   - For physical Android devices, Box64 + Wine 9.0 can be installed rootlessly via Termux:
     ```bash
     pkg install x11-repo && pkg install proot-distro termux-x11-nightly
     proot-distro install debian && proot-distro login debian
     apt update && apt install wine64 box64
     ```

## Reinstall Workflow

1. Open Software Center and refresh the device scan.
2. Use the official update/store page first. Preinstalled Chrome may support updating or disabling rather than full removal.
3. For an installed application that Android permits uninstalling, choose Repair / reinstall.
4. Read and acknowledge the local-data-loss warning. Back up important data and confirm that you can sign in again.
5. Ask Android to uninstall. Android presents its own confirmation; cancellation leaves the existing app installed.
6. WIN12 waits for PackageManager to report removal. It does not infer success from a button click or accepted intent.
7. Open the official Google Play listing and install manually through Android.
8. Return to WIN12. A new installation is recognized only after package state, install metadata, and a launchable activity are observed. Test the actual application's functionality on the device.

Tracking can be dismissed without any destructive action. Store availability, account eligibility, OS support, and regional restrictions remain controlled by the actual provider. App-private data is never copied or manipulated by WIN12 to attempt a repair.

## MetaEditor Boundary

MetaQuotes documents MetaEditor as an integrated desktop MetaTrader development environment. This project has no working Windows compatibility engine or Windows display server, so the official full MetaEditor compiler/debugger cannot be installed or run here as an embedded Android substitute.

A future real runtime adapter may register an existing `metaeditor.exe` or `metaeditor64.exe` only after the runtime and file checks already enforced by WIN12 pass. Until then, the Software Center shows **Desktop runtime required** and opens genuine MetaQuotes product/help pages. It does not replace MetaEditor with Notepad or show fabricated compiler output.

## Orientation

The Android manifest defaults to portrait. `OrientationService.kt` restores and persists `portrait`, `landscape`, or `auto` through Android's actual requested-orientation API. Settings > Display & rotation and the quick-setting Rotation tile expose this control. The UI also displays the actual viewport orientation.

Android can override orientation requests for large-screen/multi-window/device-policy reasons. An accepted request is not mislabeled as proof the screen rotated. The responsive taskbar and desktop remain usable at the actual supplied dimensions.

The web manifest requests portrait for compatible installed web experiences. Regular browser tabs cannot universally force physical orientation. A supported mobile browser can use the explicit Fullscreen & apply action; rejection is displayed honestly. WIN12 never rotates the entire page with CSS to fake device rotation.

## Taskbar and Wallpapers

The floating acrylic taskbar uses separate layout space for desktop identity, centered controls/app icons, and the system tray. Its application rail scrolls without covering the clock or native controls. A real overflow menu exposes hidden pinned and running windows. On narrow phones, optional Copilot and desktop functions remain accessible from the system-tray menu. Search, Start, quick settings, clock, and overflow remain reachable.

Light and Dark each have explicit readable taskbar colors, borders, shadows, icon contrast, and running indicators. Real native Wi-Fi, volume, battery, notifications, and portrait/rotation settings remain distinct from unavailable values.

The Daylight Glass and Blue Arc backgrounds have separate 3840 x 2160 landscape and 2160 x 3840 portrait vector compositions. These are original WIN12 assets, not official Microsoft Windows 12 wallpapers. Vector imagery is resolution independent. Existing original raster options are labeled HD artwork, not falsely advertised as 4K. Photos displays actual image dimensions after load. Users may supply licensed imagery through the wallpaper importer with rights confirmation.

## Creative Apps

- Paint uses an actual high-resolution canvas with correct CSS-to-canvas coordinate conversion, brush/eraser tools, custom colors, brush size, undo/redo, clear/new confirmation, persistent vector drafts, and real PNG save/download/export. Canvas sizes include 1920 x 1080, 1080 x 1920, and 1600 x 1600.
- Native PNG writing validates file names, base64 size, PNG signature, decoded image bounds, and pixel limits. It creates an actual PNG in app-private Pictures and refuses to overwrite an existing file. Native image saves are limited to roughly 3 MB.
- Photos distinguishes personal images from bundled wallpapers, provides fit/zoom/preview rotation, previous/next navigation, actual dimensions, wallpaper selection, image import, and PNG export. No personal photo history is fabricated. Preview rotation does not alter the source image.
- Terminal offers real WIN12 operations such as listing permitted files, changing accessible directories, reading UTF-8 text, creating folders, opening actual apps/files, and reporting actual host metadata. It is not an Android root shell or a simulated Windows command processor.

CPU meters, fictitious network names, fake update success messages, sample Windows packages, and demo runtime installation from the pasted examples were not introduced.

## Official References

- https://play.google.com/store/apps/details?id=com.android.chrome
- https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en
- https://play.google.com/store/apps/details?id=net.metaquotes.metatrader5
- https://deriv.com/trading-platforms/mt5/download
- https://deriv.com/trading-platforms/deriv-mt5
- https://www.metatrader5.com/en/automated-trading/metaeditor
- https://www.metatrader5.com/en/metaeditor/help
- https://developer.android.com/about/versions/16/behavior-changes-16
- https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock

Read-only catalogue tests and orientation/PNG instrumentation test sources were added. They have not been executed here; follow `ACCEPTANCE.md` on the target Android device.