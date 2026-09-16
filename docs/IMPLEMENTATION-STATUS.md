# WIN12 implementation status — September 2026

Implemented in this revision:
- First-run local Administrator/user setup with password creation.
- Password sign-in with salted PBKDF2-SHA-256 verification and optional remembered session.
- Sign-out from Start.
- Animated startup splash after authentication.
- Runtime profile name flows through desktop branding, Start, taskbar and Settings.
- Native Android launcher discovery using PackageManager, including package/activity/version metadata.
- Explicit launch of discovered Android applications instead of fake WIN12 windows.
- Official-source handoff for Google Chrome, Deriv MetaTrader 5 and MetaEditor.
- Exact PackageManager checks for Chrome and MetaTrader 5.
- Android package-visibility declarations for Chrome, MetaTrader 5 and launcher applications.

## Deliberate platform constraints

- Microsoft has not officially released Windows 12 as of September 2026. The included wallpapers are original WIN12/Windows-inspired assets, not claimed Microsoft Windows 12 wallpapers.
- Chrome and Deriv MetaTrader 5 are proprietary Android applications. WIN12 does not silently bundle or sideload third-party APKs; it discovers genuine installed packages and opens official installation pages when absent.
- MetaEditor is part of the supported desktop MetaTrader development environment; there is no official standalone Android MetaEditor package in this project. WIN12 therefore only launches a verified Windows MetaEditor executable when a functioning Wine/Box compatibility runtime is actually installed.
- A Gradle/npm production build and physical Android QA still need to be run in an environment with the required dependency downloads and a real Android device.
