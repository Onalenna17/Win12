import { useDesktop } from "../context/DesktopContext";
import type { LaunchResult, WinApp, WindowRecord } from "../types";

export function RuntimeErrorApp({ win }: { win: WindowRecord }) {
  const { runtime, openSystem, closeWindow } = useDesktop();
  const app = win.appProps?.app as WinApp;
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">⚠️</span>
        <div>
          <h3 className="text-base font-semibold">Cannot Launch {app?.displayName}</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Architecture: {app?.architecture} · Runtime: {app?.runtime}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
        <span>🚨</span>
        <div>
          <strong>Runtime Unavailable.</strong> Windows applications cannot execute natively on Android without an
          emulation and compatibility layer.
        </div>
      </div>
      <div className="rounded-lg border border-[var(--panel-border)] bg-black/25 p-3 text-xs leading-6">
        <div>
          • Host Architecture: <strong>{runtime.systemArch}</strong>
        </div>
        <div>
          • Wine Binary:{" "}
          <span style={{ color: runtime.wineInstalled ? "var(--success)" : "var(--danger)" }}>
            {runtime.wineInstalled ? "Present" : "Not Installed"}
          </span>
        </div>
        <div>
          • Box64 Translation:{" "}
          <span style={{ color: runtime.box64Installed ? "var(--success)" : "var(--danger)" }}>
            {runtime.box64Installed ? "Present" : "Not Installed"}
          </span>
        </div>
        <div className="mt-1 text-[var(--text-secondary)]">
          Install the Wine compatibility package in Settings to run Windows software.
        </div>
      </div>
      <div className="mt-auto flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => openSystem("logviewer", { appProps: { appId: app?.id } })}>
          View App Logs
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            closeWindow(win.id);
            openSystem("settings", { appProps: { tab: "runtime" } });
          }}
        >
          Open Runtime Setup
        </button>
      </div>
    </div>
  );
}

export function LaunchErrorApp({ win }: { win: WindowRecord }) {
  const { openSystem, closeWindow } = useDesktop();
  const app = win.appProps?.app as WinApp;
  const result = win.appProps?.result as LaunchResult;
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">❌</span>
        <div>
          <h4 className="font-semibold">Application Execution Failed</h4>
          <div className="text-xs text-[var(--text-secondary)]">Error Code: {result?.errorCode || "UNKNOWN"}</div>
        </div>
      </div>
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{result?.message}</div>
      <div className="mt-auto flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => openSystem("logviewer", { appProps: { appId: app?.id } })}>
          Open Log Viewer
        </button>
        <button className="btn-primary" onClick={() => closeWindow(win.id)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function WineApp({ win }: { win: WindowRecord }) {
  const app = win.appProps?.app as WinApp;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#1e1e1e] p-8 text-center">
      <div className="text-5xl">{app?.iconPath === "msi" ? "📦" : "🪟"}</div>
      <h3 className="text-lg font-semibold">{app?.displayName}</h3>
      <p className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
        Running via Wine {app?.architecture} compatibility layer inside prefix
        <br />
        <code className="text-[11px] text-[var(--accent)]">{app?.prefixPath}</code>
      </p>
      <div className="mt-2 w-full max-w-sm rounded-lg border border-[var(--panel-border)] bg-black/30 p-3 text-left font-mono text-[11px] text-green-400">
        box64 wine {app?.executablePath}
        <br />
        0024:fixme:ntdll:NtQuerySystemInformation info_class 11
        <br />
        0024:err:winediag:nodrv_CreateWindow Wine cannot find a graphics driver in this preview surface.
        <br />
        Application UI would attach to a native activity here.
      </div>
    </div>
  );
}
