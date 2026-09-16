# WIN12 PC startup and account flow

WIN12 now has a real first-run local account flow:

1. First launch shows **Set up your PC**. Create the local administrator/display profile and password.
2. Later launches show **Welcome back** unless the user selected **Keep me signed in on this device**.
3. Password verification uses a salted PBKDF2-SHA-256 hash stored locally in the WebView profile; the plaintext password is not persisted or sent to a server.
4. Successful sign-in enters the animated WIN12 startup splash and then the desktop.
5. Start > account footer includes **Sign out**.

The Android device's own lock/PIN remains separate from the WIN12 local account.

# Administrator PC Startup

## Defaults

WIN12 now starts with the Light acrylic theme, the original Daylight Glass wallpaper, and the display profile **Administrator PC**. A one-time preferences migration applies the requested Light/desktop-first defaults to the old configuration. Later explicit theme, wallpaper, and startup choices remain saved.

The default flow is:

1. Native splash / light WIN12 splash.
2. Prepare the actual wallpaper and desktop assets.
3. Open the Administrator PC desktop directly.
4. Play the original startup chime through the available audio engine.

There is no automatic widget board, fake login screen, fabricated weather, or demo runtime step. Widgets remain optional behind the system-tray menu and never open automatically. The taskbar's left entry now represents the PC desktop, not a widgets launcher.

Default desktop shortcuts point to actual implementations: This PC, File Explorer, Applications, Notepad, Settings, and Recycle Bin. Native application icons still come from PackageManager when those apps are genuinely discovered. No Chrome, MT5, or MetaEditor icon is added as a placeholder.

Saved windows are retained in the taskbar, minimized on startup by default. Their previous positions and sizes remain available when restored. In Settings > System, users can disable **Start directly on the PC desktop** to restore saved visibility instead. This never causes shell flyouts or Widgets to auto-open.

Administrator is a WIN12 display-profile name. It does not grant Android root privileges or bypass native permissions.

## Real Audio Playback

`src/lib/audio.ts` synthesizes and plays an original ten-event PCM sound scheme: startup, application launch, close, minimize, restore/snap, notification, error, successful file operations, recycle, and confirmation dialogs. It uses actual Web Audio buffers, not a placeholder sound animation.

On Android, `DesktopSoundService.kt` plays the corresponding original PCM samples from `PcSoundScheme.kt` through `AudioTrack`. It requests foreground transient audio focus, respects Android silent/vibrate mode, Do Not Disturb and media volume, rate-limits overlapping effects, and releases audio when the activity pauses or is destroyed.

The React desktop calls `playDesktopSound("startup", volume, false)` once at the splash-to-desktop handoff. `desktopReady()` no longer independently plays another chime, preventing duplicate native startup sounds. There is no OS shutdown/reboot sound because those operations are not implemented.

### Browser Autoplay

A browser may refuse sound before a user gesture. WIN12 attempts normal audio startup; if blocked, it opens the PC desktop immediately and waits for the first click/key press to play the welcome sound. A small **Enable PC sounds** affordance is available while waiting. It is not a login or widget screen. Autoplay restrictions are not bypassed or falsely reported as successful playback.

### Controls

Settings > PC sounds offers startup and system-sound toggles, a shared WIN12 gain control, all ten sound previews, and truthful output/blocked/muted status. The desktop sound gain is separate from Android's actual media volume. Focus silences WIN12 notification-type sounds. New devices with media volume zero or silent mode enabled will remain silent until the user changes those device settings.

## Provenance

No licensed Microsoft Windows sound files were supplied. These are original WIN12 PC-style note sequences, not official Windows 12 recordings. They are never labeled as authentic Microsoft assets. No Microsoft audio is downloaded or redistributed.

## PC Window Controls

`AppHost.tsx` renders only implemented embedded apps. External applications continue to use real native launch mechanisms. `WindowFrame.tsx` supports all eight resize directions, drag/restore, keyboard-accessible snap controls, and all seven real snap destinations: left, right, full, and four corners. Closing or minimizing a window produces an enabled PC sound; moving/resizing does not generate a stream of click noise.

## Verification Boundaries

The React production build is verified using the supplied build tool. Native audio unit-test sources verify event coverage, non-silent bounded PCM output, deterministic synthesis, release envelopes, and invalid-input rejection. Native compilation, speaker audibility, OEM audio-focus behavior, and browser interaction QA still require execution in their respective environments and are not claimed as passed here.

Manual acceptance:

1. Clear site/app data or launch an old defaults configuration; verify Light, Daylight Glass, and Administrator PC.
2. Verify the splash transitions directly to the PC icon desktop with no widgets or default Explorer window covering it.
3. In browser mode, allow sound and verify startup plays once after the first interaction when autoplay is blocked.
4. On Android, verify startup audio with normal ringer/media output, then repeat under mute, vibrate, DND, backgrounding, and denied audio focus. Suppressed sound must not fall back to Web Audio to evade Android settings.
5. Open, minimize, restore, snap, and close actual WIN12 windows. Trigger save, recycle, and error events and check enabled effects.
6. Preview every sound; test volume zero and both sound toggles across restart.
7. Confirm eight-way resizing and each snap region, including restored windows after rotation.