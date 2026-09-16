import { SAMPLE_PACKAGES } from "../native";
import { useDesktop } from "../context/DesktopContext";
import { cn } from "../utils/cn";

export function InstallerApp() {
  const { installing, startInstall, closeWindow, launchApp, openSystem, apps } = useDesktop();
  const steps = ["Select", "Inspect", "Isolate", "Ready"];
  const pct = installing?.percent || 0;
  const idx = pct >= 100 ? 3 : pct >= 60 ? 2 : pct >= 25 ? 1 : 0;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-5">
        <div className="progress-track mb-3">
          <div className="progress-fill" style={{ width: (installing ? pct : 5) + "%" }} />
        </div>
        <div className="flex justify-between px-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                  i <= idx && installing ? "bg-[var(--accent)] text-[#041018]" : "bg-white/10",
                )}
              >
                {i + 1}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-auto win-scroll">
        {!installing && (
          <>
            <div className="mb-2 text-4xl">📦</div>
            <h3 className="text-lg font-semibold">Install Windows Application</h3>
            <p className="mb-4 max-w-md text-center text-xs leading-relaxed text-[var(--text-secondary)]">
              Select a Windows <strong>.exe</strong> or <strong>.msi</strong> package. Win12 will inspect its architecture,
              create an isolated prefix sandbox, and register it.
            </p>
            <div className="mb-4 flex w-full max-w-lg items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <span>🛡️</span>
              <div>
                <strong>Security Advisory</strong>
                <div className="text-[var(--text-secondary)]">
                  Windows applications can contain unsafe code. Install only software from sources you trust.
                </div>
              </div>
            </div>
            <div className="grid w-full max-w-lg gap-2">
              {SAMPLE_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--panel-border)] bg-[var(--surface-hover)] p-3 text-left hover:bg-[var(--surface-active)]"
                  onClick={() => startInstall(pkg)}
                >
                  <span className="text-2xl">{pkg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{pkg.displayName}</div>
                    <div className="truncate text-[11px] text-[var(--text-muted)]">
                      {pkg.fileName} · {pkg.architecture} · {pkg.sizeLabel}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--accent)]">Install</span>
                </button>
              ))}
            </div>
          </>
        )}

        {installing && installing.step !== "Installed" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="text-4xl spin">⚙️</div>
            <h3 className="text-base font-semibold">{installing.step}…</h3>
            <p className="text-xs text-[var(--text-secondary)]">{installing.message}</p>
          </div>
        )}

        {installing?.step === "Installed" && installing.pkg && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="text-5xl">✅</div>
            <h3 className="text-lg font-semibold">Installation Succeeded</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              <strong>{installing.pkg.displayName}</strong> has been registered in the persistent application registry.
            </p>
            <div className="w-full max-w-md rounded-lg border border-[var(--panel-border)] bg-black/25 p-3 text-left text-xs">
              <div>• Target Architecture: <strong>{installing.pkg.architecture}</strong></div>
              <div>
                • Isolated Prefix: <code>/data/win12/prefixes/{installing.pkg.id}</code>
              </div>
              <div>• Desktop Shortcut: <strong>Created</strong></div>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn-secondary" onClick={() => openSystem("apps")}>
                View Installed Apps
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const app = apps.find((a) => a.id === "winapp-" + installing.pkg!.id);
                  closeWindow("win-installer");
                  if (app) launchApp(app);
                }}
              >
                Launch App
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
