# Native Contract v2

`window.Win12Native` is injected only into the trusted bundled desktop. Calls return JSON values or, for desktop-state storage, a Boolean acknowledgment. React renders returned strings as text, never injected HTML.

## Registry

- `getCapabilities()`: explicit supported features. Missing or non-Boolean flags are false.
- `getApplicationSnapshot()`: `apps`, `status`, `scannedAt`, `revision`, `scope`, `runningVisibility`, `message`.
- `refreshApplications()`: request a scan; completion produces `applicationsChanged`.
- `getSoftwareAvailability()`: narrow PackageManager installation checks for official software references, separate from launchable registry records.
- `openSoftwareSource(productId, destination)`: fixed official store/publisher/help handoffs. No installation is inferred from this request.
- `launchApplication(id)`: revalidate the discovered launch target and delegate to Android or a real runtime adapter.
- `openApplicationSettings(id)`: Android details for a discovered package.
- `uninstallApplication(id)`: opens Android confirmation only when supported; removal is confirmed by subsequent discovery.

App records include IDs, actual display names, package/activity metadata, versions, icon source, launch type, verification/installation/launchability flags, capability flags, and independently observed running state. React rejects unverified external records and never converts a click into `RUNNING`.

`ANDROID_PACKAGE`, `WINDOWS_EXECUTABLE`, `WEB_APPLICATION`, and `INTERNAL_WIN12_APPLICATION` are modeled. This host discovers Android packages and ships actual internal apps. Windows support requires a concrete runtime adapter. No external web apps are pre-registered; the default host does not supply a web-app registration or launch provider.

## Files

- `getStorageRoots()` and `getKnownFolders()` return actual locations.
- `getDirectoryContents(path)` returns `items` or an explicit error.
- `getFileMetadata(path)` returns real metadata and per-item capabilities.
- `readTextFile(path)` returns `{ success, content, message }`.
- `savePngImage(name, dataUrl)` validates PNG format and dimensions, then saves actual bytes to private Pictures without overwriting.
- `requestStorageLocation()` opens Android SAF consent.
- `fileOperation(action, jsonArgs)` supports `create`, `write`, `rename`, `copy`, `move`, `delete`, `restore`, `open`, and `export` within the documented permissions and size limits.

Names and aliases are validated natively. Browser-mode aliases use `browser:/` and represent actual browser-managed document data, not a Windows or Android disk. Legacy browser documents are migrated away from fabricated drive-letter paths without silently deleting saved content.

## Native Services

- `getSystemInfo()` and `getSystemState()` report actual Android observations, or unavailable values.
- `getOrientationStatus()` and `setOrientation(mode)` expose portrait-default, landscape, and auto-rotate preferences and observed layout. Large-screen Android overrides remain possible.
- `setSystemVolume(percent)` changes Android's media stream and returns the observed value.
- `openSystemSettings(section)` opens a limited known Android settings destination.
- Sections include `network`, `bluetooth`, `airplane`, `accessibility`, `battery`, `volume`, `notifications`, `security`, and `home`. These are native settings handoffs, not simulated radio toggles.
- `openCopilot()` opens the fixed external `https://copilot.com/` destination. It transmits no prompt or file data. The capability flag is `externalWeb`.
- `enableScreenLock()`, `disableScreenLock()`, and `lockDevice()` operate through Android administrator consent and DevicePolicyManager.
- `requestBluetoothAccess()` requests runtime permission on supported Android versions.
- `getNativeNotifications()` and `dismissNativeNotification(id)` work only with user-granted notification-listener access.
- `openStoreSearch(query)` opens a store or external HTTPS store search; it never claims installation.
- `getRuntimeStatus()` reports the actual adapter status; default is `UNSUPPORTED`.
- `getRunningProcesses()` and `stopApplication(id)` are limited to runtime-owned processes. Ordinary Android packages are not force-stopped.
- `getLogs(appId)` exposes WIN12 logs, not private logs from other apps.
- `loadDesktopState()` / `saveDesktopState(json)` persist the window session, wallpaper, preferences, pins, and real shortcut targets.
- `desktopReady()` completes native startup once React is ready; it does not independently play a duplicate startup chime.
- `playDesktopSound(event, volume, preview)` uses Android AudioTrack to play a whitelisted original PC sound. The capability is `desktopSounds`.
- `stopDesktopSounds()` stops and releases the current native sound. `getDesktopAudioStatus()` reports the service result.

PC sounds respect real native silent/vibrate mode, media mute, DND, activity foreground state, and audio-focus permission. They return unavailable/suppressed results rather than bypassing Android controls with Web Audio. Browser-only sound playback requires the normal site audio permission and may wait for a user gesture.

System snapshots include actual `wifi` and `airplaneMode` observations when readable. Missing values remain unavailable. Airplane mode is never derived from Wi-Fi/Bluetooth values. The WIN12-local dimming and notification preferences remain separate from Android's system state.

## Events and Results

Native code calls `window.Win12Desktop.onNativeEvent(eventName, data)`. Event names include `applicationsChanged`, `storageChanged`, `systemStateChanged`, `notificationsChanged`, and `operationResult`. Existing installer/runtime progress and process-state event hooks are preserved for real integrations.

Operation results use `{ success, message, code, pending }`. `pending: true` means a request was accepted or Android confirmation is required, not that execution, permission, installation, uninstallation, export, or lock state has been independently verified.

## References

- [Android package visibility](https://developer.android.com/training/package-visibility/declaring?hl=en)
- [WebViewAssetLoader and bundled content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content?hl=en)
- [Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files?hl=en)
- [Native bridge security](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges?hl=en)
- [DevicePolicyManager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager)