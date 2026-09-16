import { useState, type ReactNode } from "react";
import { Native } from "../native";
import { WALLPAPERS } from "../wallpaper";
import { useDesktop } from "../context/DesktopContext";
import type { WindowRecord } from "../types";
import { cn } from "../utils/cn";

const NAV = [
  { id: "general", label: "System & Specs" },
  { id: "runtime", label: "Compatibility Runtime" },
  { id: "storage", label: "Storage Allocation" },
  { id: "appearance", label: "Personalization" },
  { id: "network", label: "Network & internet" },
  { id: "update", label: "Windows Update" },
];

export function SettingsApp({ win }: { win: WindowRecord }) {
  const {
    systemInfo,
    runtime,
    wallpaperId,
    setWallpaper,
    toggleTheme,
    theme,
    openSystem,
    startRuntimeInstall,
    cancelRuntimeInstall,
    uninstallRuntime,
    runtimeInstall,
    showToast,
    updateWindow,
    refreshHost,
  } = useDesktop();
  const [tab, setTab] = useState((win.appProps?.tab as string) || "general");
  const [url, setUrl] = useState("https://example.com/win12-runtime-arm64.zip");
  const [sha, setSha] = useState("");

  const switchTab = (id: string) => {
    setTab(id);
    updateWindow(win.id, { appProps: { ...win.appProps, tab: id } });
  };

  const b = systemInfo.storageBreakdown || { applications: 0, prefixes: 0, logs: 0, runtime: 0, totalTracked: 0 };
  const cats = [...new Set(WALLPAPERS.map((w) => w.category))];
  const health = (runtime.health || "Unavailable").toLowerCase();

  return (
    <div className="settings-layout">
      <div className="settings-nav win-scroll">
        <div className="mb-3 px-3 pt-2 text-lg font-semibold">Settings</div>
        {NAV.map((n) => (
          <div
            key={n.id}
            className={cn("settings-nav-item", tab === n.id && "active")}
            onClick={() => switchTab(n.id)}
          >
            {n.label}
          </div>
        ))}
      </div>
      <div className="settings-content win-scroll">
        {tab === "general" && (
          <div>
            <h3 className="mb-3 text-base font-semibold">Device & Host Specifications</h3>
            <Card title="Android System" desc={`${systemInfo.os} (API Level ${systemInfo.apiLevel})`} />
            <Card title="Device Model" desc={systemInfo.device} />
            <Card title="Primary ABI Architecture" desc={systemInfo.primaryAbi} />
            <Card
              title="Available App Memory"
              desc={`${Math.round((systemInfo.maxMemory || 0) / (1024 * 1024))} MB heap · ${Math.round(systemInfo.freeMemory / (1024 * 1024))} MB free of ${Math.round(systemInfo.totalMemory / (1024 * 1024))} MB`}
            />
            <Card title="Supported ABIs" desc={systemInfo.supportedAbis.join(", ")} />
          </div>
        )}

        {tab === "runtime" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Windows Compatibility Runtime</h3>
              <span className={cn("badge-dot", health === "healthy" ? "healthy" : health === "warning" ? "warning" : "unavailable")} />
            </div>
            <Card
              title="Runtime Health State"
              desc={`Status: ${runtime.health} (${runtime.state}) · ${runtime.runtimeVersion}`}
              action={
                <button className="btn-secondary" onClick={() => openSystem("logviewer", { appProps: { appId: "system" } })}>
                  View System Log
                </button>
              }
            />
            <Card
              title="Wine Core Binary"
              desc={runtime.winePath || "Missing in /runtime/wine"}
              action={
                <span style={{ color: runtime.wineInstalled ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  {runtime.wineInstalled ? "Installed" : "Missing"}
                </span>
              }
            />
            <Card
              title="Box64 (x86_64 → ARM64)"
              desc={runtime.box64Path || "Missing in /runtime/box64"}
              action={
                <span style={{ color: runtime.box64Installed ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  {runtime.box64Installed ? "Installed" : "Missing"}
                </span>
              }
            />
            <Card
              title="Box86 (32-bit x86)"
              desc={runtime.box86Path || "Missing in /runtime/box86"}
              action={
                <span className="text-[var(--text-muted)] font-medium">
                  {runtime.box86Installed ? "Installed" : "Optional"}
                </span>
              }
            />
            <div className="mt-4 rounded-lg border border-[var(--panel-border)] bg-black/25 p-3 text-xs leading-relaxed">
              <strong>Diagnostics & Architecture Guidance</strong>
              <ul className="mt-2 ml-4 list-disc text-[var(--text-secondary)]">
                {runtime.diagnostics.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="settings-card mt-4 !flex-col !items-stretch gap-2">
              <div>
                <div className="text-sm font-medium">Install / Reinstall Runtime</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  WIN12 does not bundle Wine or Box64. Provide an HTTPS URL of a runtime bundle (.zip containing wine/,
                  box64/, optionally box86/), or install the demo runtime for preview.
                </div>
              </div>
              <input className="win-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Bundle URL" />
              <input className="win-input" value={sha} onChange={(e) => setSha(e.target.value)} placeholder="Expected SHA-256 (optional)" />
              {runtimeInstall && (
                <div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: runtimeInstall.percent + "%" }} />
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {runtimeInstall.step}: {runtimeInstall.message}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {runtimeInstall && runtimeInstall.percent < 100 && (
                  <button className="btn-secondary" onClick={cancelRuntimeInstall}>
                    Cancel
                  </button>
                )}
                <button className="btn-secondary" onClick={uninstallRuntime}>
                  Remove Installed Runtime
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (Native.isAvailable()) Native.installRuntime(url, sha);
                    else startRuntimeInstall(url);
                  }}
                >
                  Install Demo Runtime
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "storage" && (
          <div>
            <h3 className="mb-3 text-base font-semibold">Win12 Sandboxed Storage Usage</h3>
            <Card title="Installed Windows Applications" desc="EXE and MSI packages" action={<strong>{Math.round((b.applications || 0) / 1024)} KB</strong>} />
            <Card title="Wine Prefixes (Drive C:)" desc="Isolated application environments" action={<strong>{Math.round((b.prefixes || 0) / 1024)} KB</strong>} />
            <Card title="Compatibility Runtime" desc="Wine / Box64 / Box86 binaries" action={<strong>{Math.round((b.runtime || 0) / 1024)} KB</strong>} />
            <Card title="Execution & Diagnostics Logs" desc="Per-application stdout/stderr traces" action={<strong>{Math.round((b.logs || 0) / 1024)} KB</strong>} />
            <button
              className="btn-secondary mt-3"
              onClick={() => {
                Native.clearLogs("system");
                refreshHost();
                showToast("Win12", "All diagnostic logs cleared");
              }}
            >
              Clear All Diagnostic Logs
            </button>
          </div>
        )}

        {tab === "appearance" && (
          <div>
            <h3 className="mb-3 text-base font-semibold">Desktop Personalization</h3>
            <Card
              title="Color Scheme"
              desc={`Currently ${theme === "dark" ? "Dark acrylic" : "Light acrylic"}`}
              action={
                <button className="btn-secondary" onClick={toggleTheme}>
                  Toggle Theme
                </button>
              }
            />
            <h3 className="mt-6 mb-2 text-base font-semibold">Desktop Wallpaper</h3>
            {cats.map((cat) => (
              <div key={cat}>
                <div className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{cat}</div>
                <div className="wallpaper-grid">
                  {WALLPAPERS.filter((w) => w.category === cat).map((w) => (
                    <div
                      key={w.id}
                      className={cn("wallpaper-thumb", w.id === wallpaperId && "active")}
                      style={{ backgroundImage: w.css, backgroundColor: "#111" }}
                      title={w.name}
                      onClick={() => setWallpaper(w.id)}
                    >
                      <span className="wallpaper-thumb-label">{w.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "network" && (
          <div>
            <h3 className="mb-3 text-base font-semibold">Network & internet</h3>
            <Card title="Wi-Fi" desc="Connected · Win12-Net" action={<span className="text-[var(--success)] text-xs font-medium">On</span>} />
            <Card title="VPN" desc="Not connected" action={<button className="btn-secondary">Connect</button>} />
            <Card title="Proxy" desc="Use system proxy (off)" />
          </div>
        )}

        {tab === "update" && (
          <div>
            <h3 className="mb-3 text-base font-semibold">Windows Update</h3>
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface-hover)] p-5">
              <div className="text-lg font-semibold">You're up to date</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                Last checked today · Win12 12.0.26000.1 (preview)
              </div>
              <button
                className="btn-primary mt-4"
                onClick={() => showToast("Windows Update", "No new updates are available.")}
              >
                Check for updates
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="settings-card">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[var(--text-secondary)]">{desc}</div>
      </div>
      {action}
    </div>
  );
}
