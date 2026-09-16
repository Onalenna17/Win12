# WIN12 Desktop

A PC-style React desktop with a new Kotlin Android host. The native path uses real Android package discovery, launch intents, app icons, permission-scoped storage, system observations, optional notifications, and consent-based device locking. The browser remains a clearly labeled limited environment, not a simulated Android or Windows installation.

The default experience is now **Light mode > WIN12 splash > Administrator PC desktop**. Daylight Glass and real built-in PC shortcuts appear immediately after the splash; remembered windows stay minimized and Widgets never auto-opens. Startup and system audio use an original WIN12 sound scheme, with native Android playback and browser-autoplay-aware playback. See `docs/PC-STARTUP.md`.

Android now defaults to **portrait**, with Landscape and Auto rotate options in Settings > Display & rotation. Software Center provides real Chrome/Deriv MT5 installation and consent-based reinstall handoffs; MetaEditor remains explicitly dependent on an unavailable desktop runtime. Paint, Photos, and a permission-scoped Terminal are actual built-in apps. The taskbar has responsive overflow and readable Light/Dark variants. Details and remaining verification: `docs/REAL-SOFTWARE-AND-DISPLAY.md`.

**Status:** the web production build has been verified. Android source and tests are implemented but have not been compiled or run on a device here. No uploaded project ZIP or original Android module was available. No Wine/Box engine or Windows display server was supplied, so Windows execution is explicitly unavailable. The full master specification is not yet device-verified or release-ready.

## Desktop Features

- Original WIN12 wallpaper artwork, portrait/landscape selection, light/dark themes, and user wallpaper import with rights confirmation.
- Vector built-in app icons and actual PackageManager icons for discovered Android applications.
- Mouse/touch icon dragging, position persistence, keyboard navigation, editable shortcut labels, and genuine registry targets.
- Move, resize, minimize, maximize, restore, close, snap, focus, and z-order for actual embedded WIN12 apps.
- Eight-direction window resizing, all seven snap regions, and working startup/window/notification/error sound effects with previews in Settings > PC sounds.
- Searchable Start and All Apps, independent Start/taskbar pins, recent accepted-launch activity, context menus, calendar, and task view.
- Real file operations in Explorer, text editing in Notepad, image preview, actual logs, and observed-process diagnostics.
- No fabricated Chrome, MT5, MetaEditor, executable records, disk capacities, running states, lock screen, shutdown, or reboot.

## Real Android Integration

The Android project is in `android/`. Its secure WebView loads the built React app through HTTPS `WebViewAssetLoader`. PackageManager discovers current-profile launcher activities, retrieves real labels/versions/icons, and revalidates every launch. External Android apps open through Android rather than fake embedded windows.

An accepted launch intent is not converted into running state. Unknown process state stays `UNKNOWN`; running indicators require native observation. Removed packages disappear after a successful scan. Application discovery refreshes on package broadcasts, foreground return, and explicit user request.

Explorer uses actual WIN12-private files, app-accessible external directories, and user-selected SAF trees. It does not invent drive letters or Windows system folders. Private workspace deletion supports recycling; external-provider deletion is explicitly permanent. Unsupported capabilities are omitted or disabled.

Battery/network/media-volume signals come from Android. Screen lock requires an explicit force-lock device-admin grant and a secure Android credential. Notification access and Bluetooth status access are optional, user-granted features. Shutdown, reboot, arbitrary Android app force-stop, and external app embedding are not claimed.

See `android/README.md` for build prerequisites and important limitations. A CI workflow in `.github/workflows/android.yml` is configured to typecheck/build the web app, compile debug APKs and instrumentation, run JVM tests, and lint Android. The workflow has not been executed during this implementation session.

## Browser Mode

Built-in WIN12 apps work without a native host. Documents are real persisted browser application data under the explicit `browser:/` namespace; they are not physical disks or Android files. Browser imports, text editing, image viewing, rename/copy/move, recycle/restore, and downloads work within that workspace.

Browser mode cannot discover Android packages, read Android system volume, access device-admin locking, or execute Windows code. Installation state for named external apps is shown as not checked, not falsely absent or installed. Clearing site data deletes browser documents; download important files first.

## Build and Verification

The web project uses React, TypeScript, Vite, Tailwind CSS v4, Framer Motion, and Lucide. Its production output is `dist/`. The Android Gradle asset-sync task consumes that output, including bundled images.

For native builds, use Android Studio or Gradle 8.11.1 with JDK 17 and Android SDK 35. No APK, signing identity, SDK, Gradle wrapper binary, emulator, or physical-device result is fabricated in this repository.

Device acceptance steps and the current evidence matrix are in `docs/ACCEPTANCE.md`. App launch tests must verify the real foreground package, not a toast or mock window. Where a real app is independently confirmed absent, report `Application not installed - launch test not applicable`.

## Key Files

- `src/App.tsx`: mounts the shared desktop provider and composed shell.
- `src/context/DesktopContext.tsx`: desktop/window state, native dispatch, flyouts, dialogs, shared registry integration, and persistence.
- `src/components/DesktopShell.tsx`: composes the modular desktop surfaces. See `docs/SHELL.md` for component and control semantics.
- `src/lib/preferences.ts`: Light/desktop-first defaults, one-time migration, and Administrator PC display identity.
- `src/lib/audio.ts` and `android/.../DesktopSoundService.kt`: actual browser/native sound playback; original note sequences, no Microsoft recordings.
- `src/apps/AppHost.tsx`: dispatches only real embedded WIN12 implementations.
- `src/apps/SoftwareCenter.tsx` and `src/lib/software.ts`: official software references and observed installation/reinstall state.
- `src/apps/Paint.tsx`, `Photos.tsx`, and `Terminal.tsx`: high-resolution painting, image viewing, and actual workspace commands.
- `src/lib/orientation.ts` and `android/.../OrientationService.kt`: portrait-default native orientation and browser-aware fullscreen controls.
- `src/lib/desktop.ts`: typed bridge, capability checks, filesystem providers, document migration, and wallpaper catalog.
- `src/lib/registry.ts`: verified application registry, deduplication, candidate checks, and native/browser system observation.
- `src/components/DesktopIcons.tsx`: draggable, keyboard-accessible, persistent desktop shortcuts.
- `src/components/Applications.tsx`: real application manager, properties, source distinctions, refresh, and integration checks.
- `src/components/Explorer.tsx`: actual accessible storage and capability-aware file operations.
- `src/components/Settings.tsx`: personalization, native capabilities, lock consent, storage, and permission disclosure.
- `android/app/src/main/java/dev/win12/desktop/`: Kotlin host, registry, storage, system services, notification listener, and runtime extension boundary.
- `android/app/src/test/` and `android/app/src/androidTest/`: native verification test sources, not executed here.
- `docs/BRIDGE.md`: native contract and official Android API references.
- `docs/ASSETS.md`: artwork/icon provenance and resolution limitations.

## Keyboard Controls

- Arrow keys and Enter navigate/open desktop icons.
- Context-menu key or Shift+F10 opens the selected icon's menu.
- Ctrl+K opens Start search.
- Alt+F4 closes the active WIN12 window.
- Ctrl+Backquote opens the WIN12 window switcher. Alt+Tab also works when the host forwards it instead of handling it at OS level.
- Ctrl+S saves in Notepad.
- Ctrl+Shift+N creates a folder in the focused writable Explorer location or on the desktop.
- F2 renames a selected supported Explorer item.
- Delete opens the appropriate recycle/permanent-delete confirmation.
- Escape dismisses menus and focused dialogs.