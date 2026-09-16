# WIN12 Acceptance Record

## Verification Status

> **Important:** Microsoft has not officially released Windows 12 as of September 2026. WIN12 therefore uses original Windows-inspired wallpapers/assets and does not claim to ship Microsoft Windows 12 or Microsoft-distributed wallpaper files.

This is a test procedure and an honest implementation record, not a claim that device QA passed.

| Area | Current evidence |
| --- | --- |
| React production bundle | Source updated; production build must be run in AndroidIDE/CI where npm dependencies are available |
| Bundled original raster/vector assets | Included in the project; not Microsoft-distributed wallpapers |
| Android module | Source updated; APK compilation could not run here because the Gradle distribution/dependencies require network access |
| JVM/instrumentation tests | Test sources supplied; not executed here |
| External app launch | Not tested: no Android test device available |
| Screen lock / notification / SAF permission | Not tested: requires real Android consent screens |
| Portrait/landscape and mouse/touch visual QA | Responsive implementation supplied; device visual inspection pending |
| Windows executables | Unsupported: no Wine/Box engine or Windows display server supplied |
| CI workflow | Configured, not run as part of this implementation session |

The complete master specification's device acceptance criteria remain **unverified**. A successful web build does not satisfy those criteria by itself.

## Fresh Installation

1. Build the web project, then compile the Android project using the requirements in `android/README.md`.
2. Install the generated debug APK on the actual test device. Record device model, Android API, WebView version, APK version, profile, and test date.
3. Launch WIN12. Verify the native splash appears and the original startup chime follows only when sound is enabled and Android is not silent/muted.
4. Verify the desktop uses original WIN12 wallpaper, vector built-in icons, a floating acrylic taskbar, and PC window controls. No fake external app shortcuts should be present.
5. Verify This PC, File Explorer, and Settings work. A native fresh session opens at the desktop, not inside a fake application window.
6. Verify the default Light theme, Daylight Glass wallpaper, Administrator PC identity, real PC icons, and no automatically opened Widgets. Remembered windows are minimized by default.
7. Follow `PC-STARTUP.md` for the startup and ten-event audio scheme, browser-autoplay fallback, explicit sound previews, and eight-way resizing checks. The new audio unit tests are supplied but have not been executed in this environment.

## Real Application Discovery

1. Open Applications and choose Refresh applications.
2. Wait for a successful native scan. Record its time and scope.
3. Compare discovered labels, package names, versions, activity components, and icons against Android's installed application metadata for that same profile.
4. Open the Integration checks tab. Google Chrome, Deriv MT5 / MetaTrader 5, and MetaEditor are checks, not fabricated records. Labels are candidate matches, not verified publisher identities.
5. If a matching app exists, confirm its real package/activity metadata and that it is launchable. Do not rename a different app to make a test pass.
6. If a package was not discovered, investigate Android package visibility/profile restrictions before claiming it is absent. Report `Not discovered in current-profile launcher scan` when absence is not conclusive.
7. If independently confirmed absent, report `Application not installed - launch test not applicable`.
8. In browser mode, report `Android discovery unavailable - installation state not checked`, not `Not installed`.

## Chrome / MT5 / MetaEditor Launch

Perform this separately for every genuinely installed and supported target:

1. Create a desktop shortcut from that actual registry record.
2. Double-click its icon with a mouse, or double-tap it on touch.
3. Verify that the native request uses the discovered explicit launcher activity.
4. Independently verify the actual Android target package reaches the foreground. An accepted intent or WIN12 toast alone is not sufficient evidence.
5. Verify no fake Chrome, trading terminal, or MetaEditor desktop window was created.
6. Return to WIN12. Check application refresh and the preserved window/session state.
7. Run the same app from Start, All Apps, Search, and its taskbar pin.
8. For a real Windows MetaEditor installation, first supply a functioning runtime adapter. Verify the actual executable exists in its sandbox, passes PE validation, has a healthy runtime, and produces a real process/window. Without that engine, report `Windows runtime unavailable - launch test not applicable`.

`NativeApplicationLaunchTest` is an optional, opt-in UIAutomator test that verifies foreground package visibility for discovered Android candidates. It is not automatically enabled in CI because external apps and user data are device-specific.

## Running State

1. Confirm no running indicator appears merely because an icon was clicked.
2. Compare `RUNNING` against actual native process evidence and observation time.
3. If Android hides another app's process state, verify WIN12 displays `Unknown`; it must not infer `Stopped` from a paused activity or from an absent process-list entry.
4. Verify Android accepted-launch events are described as requests, not proof of execution.
5. Stop a genuine runtime-owned process only when its record declares stop support. Never expose privileged force-stop for arbitrary Android apps.

## Package Lifecycle and Persistence

1. Pin a real app to Start and separately to the taskbar. Create a shortcut, drag it to a new grid cell, and change its shortcut label.
2. Restart WIN12 and verify those preferences survive without marking the app running.
3. Install or remove an actual app using Android's own interfaces. Return to WIN12 and verify no restart is necessary to update discovery.
4. On removal, verify stale Start pins, taskbar pins, and shortcut targets disappear after a successful scan.
5. Cancel Android's uninstall dialog and verify the application is still registered as installed.
6. Test an app being disabled, suspended, or removed between discovery and launch. WIN12 must revalidate and report failure rather than create a fake window.

## Storage

1. Open This PC. Only actual app-accessible locations and granted SAF roots should appear.
2. Verify there is no invented C:, E:, Windows, Program Files, or System32 tree.
3. Compare reported physical-volume capacities to StatFs. Verify SAF capacity remains unavailable when unknown.
4. Create, read, edit, rename, copy, and move a real text file. Inspect the bytes through an independent file viewer.
5. Delete a WIN12-private file, inspect its actual trash entry, and restore it. Verify original bytes and metadata paths.
6. Connect an Android SAF folder. Deny consent first, then grant consent. Restart the activity/device and verify persisted access.
7. Repeat for SD/USB/provider locations that the device actually exposes. Do not fabricate a drive if the device has none.
8. Verify read-only providers suppress unsupported commands. Verify permanent deletion warns that the file will not enter WIN12's Recycle Bin.
9. Revoke a grant externally. Confirm a clear unavailable state and no continued unauthorized access.
10. Test collisions, malformed/encoded traversal paths, invalid UTF-8, files larger than limits, disconnected USB, and interrupted moves. Failed operations must not be marked successful.
11. Test Android export and external file opening through real chooser intents. Imported HTML/JS must remain text, never privileged WebView content.

## Lock and Permissions

1. In Settings > Lock & permissions, inspect the native screen-lock availability state.
2. Review the disclosure, choose Enable, and deny Android's device-admin prompt. Lock must remain unavailable.
3. Enable again and approve only `force-lock`. Configure a secure Android PIN, pattern, or password if absent.
4. Invoke Lock from Start's power menu. Verify the display locks through Android, not a drawn web overlay.
5. Unlock Android normally and return to the same desktop session.
6. Disable screen-lock permission from WIN12. Verify native administrator access is removed.
7. Grant and revoke optional notification/Bluetooth permissions. Verify actual signal state, accurate unavailable fallbacks, and no mock notification content.
8. Confirm shutdown, reboot, and privileged arbitrary-app force-stop are not offered as working commands.

## Visual and Input QA

1. Test phone portrait, phone landscape, tablet portrait/landscape, split-screen, and desktop-sized displays with current Android System WebView.
2. Check wallpaper cropping, original portrait artwork, high-density icon sharpness, title-bar controls, taskbar overflow, and readable text.
3. Drag desktop shortcuts with touch and mouse. Check collisions, bounds, order, labels, shortcut arrows, and saved positions after rotation.
4. Verify arrow-key desktop navigation, Enter, context-menu key, Shift+F10, Ctrl+K, Alt+F4, Ctrl+S, Ctrl+Shift+N, F2, and Escape.
5. Move/resize/minimize/maximize/restore/snap WIN12 windows and verify focus/z-order. Check corner snap and taskbar restore.
6. Test dark/light mode, wallpaper import with rights confirmation, user wallpaper removal, and reduced-motion settings.
7. Test native display cutouts and the soft keyboard. Verify no essential PC controls become unreachable.

Record screenshots and logs for each device. Do not label this release complete until native builds and the applicable physical-device flows are actually verified.

## Modular Shell Checks

1. Verify the boot screen completes on actual asset readiness, not after a fixed fake boot delay. Test retry/continue on a blocked wallpaper request.
2. Open each taskbar flyout, then another. Only one primary flyout should remain active. Verify outside click, Escape, and native Back behavior.
3. Check all eight quick-setting tiles. Radio/accessibility/battery actions must open the proper Android settings screen. Airplane state must equal the actual Android setting, not an inferred radio combination.
4. Verify browser volume is labeled WIN12 sound volume and that system-only controls are unavailable. Test local Theme, Night light, Focus, and brightness independently.
5. Save a scratchpad note, reload, and verify the exact content survives. Recent-document widgets must match actual opened documents.
6. Prepare a Copilot prompt locally. Verify it is not automatically transmitted. Copy it explicitly, then open the real service externally; no fake AI response or embedded privileged web page should appear.
7. Open multiple actual WIN12 windows, minimize one, then use Ctrl+Backquote and Task View to select and restore it. Check Alt+Tab only in hosts that forward the key combination.
8. Rename/delete a desktop file and cancel/confirm the dialogs. Uninstall requests must not claim removal before Android confirmation and a successful application refresh.
9. Verify calendar seconds, month navigation, Today, arrow keys, PageUp/PageDown, and Home.
10. Run the read-only `ShellServicesTest` instrumentation checks for airplane mode, Wi-Fi observations, and truthful capability flags.
11. Verify mobile taskbar overflow, dialog/menu positioning, touch icon double-taps, and shell focus. These browser/device interaction checks have not been executed in this tool environment.

## Software, Rotation, and Images

1. Open Software Center. Verify Chrome and MetaTrader 5 installation state against the targeted PackageManager lookups and actual store listings. Missing software must never get a fake desktop app icon.
2. For a user-approved reinstall on a controlled test device, verify the data-loss warning, Android confirmation, cancelled-removal behavior, observed absence, official reinstallation, and new launchable package. Do not treat a store handoff as installation completion.
3. Verify MetaEditor reports the unavailable desktop-runtime requirement rather than opening a mock compiler/editor.
4. Confirm portrait default at a fresh native launch. Test Landscape and Auto rotate, restart persistence, multi-window override messaging, and actual screen dimensions. Test browser fullscreen rejection separately.
5. Test the taskbar at 320, 360, 390, 768, 1024, and 1440 CSS pixels in both Light and Dark. Start/search/tray/clock and overflow must remain reachable without overlap.
6. Draw in Paint at different window scales and in both orientations. Confirm stroke coordinates match the pointer, Undo/Redo works, drafts persist, and the exported image is a genuine PNG with the selected canvas dimensions.
7. Import/view images in Photos, verify dimensions, switch between personal photos and original wallpapers, and export a saved Paint file through Android.
8. Run `OfficialSoftwareCatalogTest` and `OrientationAndPngTest`. Native test execution and actual app functionality remain unverified until performed on a device.