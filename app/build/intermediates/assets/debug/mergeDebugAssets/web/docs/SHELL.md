# Modular Desktop Shell

The supplied shell components have been integrated into the existing native-aware desktop. They are functional React components, not disconnected examples. `src/App.tsx` now mounts `DesktopProvider` and `DesktopShell`.

## Shared State

`src/context/DesktopContext.tsx` owns windows, focus, z-order, Start/taskbar pins, real shortcut targets, wallpaper preferences, notifications, dialogs, shell flyouts, and native event dispatch. All shell components consume `useDesktop()`.

One primary shell flyout is active at a time. Clicking outside or pressing Escape dismisses it. Native back handling dismisses a dialog, context menu, or flyout before minimizing the active WIN12 window. Window layout, pins, shortcut targets, and preferences retain the existing native/local persistence contract.

## Components

- `BootScreen.tsx`: light Administrator PC splash; starts the desktop after wallpaper/font readiness and a short entrance transition. It has retry/continue handling for failed assets, not simulated boot progress. It does not transition to a pretend Android lock screen or Widgets.
- `DesktopShell.tsx`: composes wallpaper, icons, windows, snap preview, taskbar, flyouts, dialogs, widgets, and notifications.
- `ActionCenter.tsx`: three-column Wi-Fi, Bluetooth, Airplane, Theme, Night light, Focus, Accessibility, and Battery tiles; volume and brightness sliders; expandable real notifications.
- `CalendarFlyout.tsx`: actual local time including seconds, previous/next month, Today, date selection, and arrow/PageUp/PageDown/Home keyboard navigation.
- `ContextMenu.tsx`: keyboard-operable, viewport-constrained application/file/desktop menus. Native uninstall requests wait for Android confirmation and registry refresh. File deletion uses the correct permanent/recycle confirmation.
- `StartMenu.tsx`: verified application search, pinned/all apps, real accessible documents, recent accepted launches, user/settings shortcuts, and native-safe power actions.
- `Taskbar.tsx`: Administrator PC entry, Start, Search, Copilot, pinned/observed-running apps, functional hidden-system-icons flyout, real tray signals, clock, notifications, and show desktop. Widgets and Task View remain optional in the system-tray flyout.
- `WindowSwitcher.tsx`: actual embedded-window switching, including minimized-window restoration. Alt+Tab is handled only when the host forwards it. Ctrl+Backquote is the browser-friendly shortcut; Task View remains available by pointer/touch.
- `Widgets.tsx`: real local scratchpad, WIN12 Focus toggle, live calendar entry point, and actual recent documents. No weather, news, or history is fabricated.
- `CopilotPanel.tsx` and `src/apps/Copilot.tsx`: an explicitly external-service handoff to Microsoft Copilot, with a local prompt draft and clipboard copy. No simulated AI response is produced. Nothing is automatically sent from WIN12.
- `SnapPreview.tsx`: uses the same snap-zone geometry as `WindowFrame`.
- `ToastContainer.tsx`: actual WIN12 operation notifications with manual dismissal and bounded lifetime.
- `LockScreen.tsx`: a native-lock confirmation dialog only. Android owns authentication and unlocking; there is no click-to-unlock web substitute.

`ShellPanels.tsx` remains a re-export module, not a second competing implementation.

`AppHost.tsx` now owns embedded application dispatch. `SoundSettings.tsx` controls the original ten-event PC audio scheme. Light theme and desktop-first launch defaults are migrated once and then remain user-configurable. See `PC-STARTUP.md` for startup, sound permission, and window-resizing behavior.

## Native Versus Local Controls

Wi-Fi and Bluetooth states come from Android observations, where available. Airplane mode is read from `Settings.Global.AIRPLANE_MODE_ON`; it is never inferred from two radios being off. These tiles open their Android settings panels instead of pretending an ordinary WebView can toggle privileged settings.

Accessibility opens Android's accessibility settings. Battery displays the observed percentage and charging state, or unavailable. Its native action opens battery-saver settings. Browser battery information is used only when the browser actually exposes it.

On Android, the volume slider calls `AudioManager` through the bridge. In browser mode it is explicitly labeled WIN12 sound volume and changes only the app's notification-sound preference. Android system volume is not invented.

Brightness, Night light, Theme, and Focus are WIN12-local controls. Brightness applies a desktop dimming filter; Night light applies a warm filter; Focus pauses WIN12 toast/sound notifications. None is advertised as changing Android's system-wide brightness, night mode, or Do Not Disturb.

Power offers native device-lock confirmation and Restart WIN12 desktop. Restart persists the desktop and reloads the shell; it is not Android reboot. Sleep, shutdown, and system reboot are not implemented as black overlays or lock-screen substitutions.

## External Copilot Handoff

The Microsoft support documentation identifies [copilot.com](https://support.microsoft.com/en-us/microsoft-copilot/getting-started-with-microsoft-copilot) as the browser entry point. Browser mode uses a normal external HTTPS link with `noopener noreferrer`. Android uses the narrowly scoped native `openCopilot()` method and an external `ACTION_VIEW` intent. It does not embed third-party content into the privileged desktop WebView.

If an actual installed application has a Copilot label, it appears separately as a discovered launch candidate, with its actual package metadata. This does not establish publisher identity or create a fake installed-app record. The feature itself is an external service shortcut, not a claim that a Copilot app is installed.

## Verification

The React production build must pass after integration. Android compilation, radio-setting intents, external browser handoff, device-lock behavior, and physical-device mouse/touch/keyboard QA remain unverified in this environment. See `ACCEPTANCE.md` for native testing requirements. The UI deliberately distinguishes confirmed results, accepted requests, and unavailable features.