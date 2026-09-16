import { Native } from "../native";
import { useDesktop } from "../context/DesktopContext";
import { AppTile, glyphForApp } from "../icons";

export function AppManagerApp() {
  const { apps, launchApp, openSystem, refreshHost, showToast } = useDesktop();

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Configured Applications ({apps.length})</h3>
        <button className="btn-primary" onClick={() => openSystem("installer")}>
          + Install Application
        </button>
      </div>
      <div className="flex-1 overflow-auto win-scroll space-y-2">
        {apps.map((app) => (
          <div key={app.id} className="settings-card">
            <div className="flex min-w-0 items-center gap-3">
              <AppTile type={glyphForApp(app)} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{app.displayName}</div>
                <div className="truncate text-[11px] text-[var(--text-secondary)]">
                  {app.architecture} · {app.status} · {app.runtime}
                  {app.version ? ` · v${app.version}` : ""}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="btn-secondary" onClick={() => openSystem("logviewer", { appProps: { appId: app.id } })}>
                Logs
              </button>
              {!app.isSystemApp && (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      Native.repairApp(app.id);
                      showToast("Win12", "Repaired prefix for " + app.displayName);
                    }}
                  >
                    Repair
                  </button>
                  <button
                    className="btn-secondary !text-[var(--danger)]"
                    onClick={() => {
                      if (confirm(`Uninstall ${app.displayName}?`)) {
                        Native.uninstallApp(app.id);
                        refreshHost();
                      }
                    }}
                  >
                    Uninstall
                  </button>
                </>
              )}
              <button className="btn-primary" onClick={() => launchApp(app)}>
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
