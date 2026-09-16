import { SAMPLE_PACKAGES } from "../native";
import { useDesktop } from "../context/DesktopContext";

export function StoreApp() {
  const { startInstall, openSystem } = useDesktop();
  return (
    <div className="h-full overflow-auto win-scroll p-6">
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-fuchsia-600 p-8 text-white">
        <div className="text-sm uppercase tracking-widest text-white/70">Microsoft Store</div>
        <div className="mt-1 text-3xl font-semibold">Discover Windows apps for Win12</div>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Packages install into isolated Wine prefixes. A compatibility runtime is required to launch x86 software.
        </p>
      </div>
      <h3 className="mb-3 text-base font-semibold">Featured</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {SAMPLE_PACKAGES.map((pkg) => (
          <div key={pkg.id} className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface-hover)] p-4">
            <div className="text-3xl">{pkg.icon}</div>
            <div className="mt-2 font-medium">{pkg.displayName}</div>
            <div className="text-xs text-[var(--text-muted)]">{pkg.publisher}</div>
            <p className="mt-2 line-clamp-3 text-xs text-[var(--text-secondary)]">{pkg.description}</p>
            <button
              className="btn-primary mt-3 w-full"
              onClick={() => {
                openSystem("installer");
                setTimeout(() => startInstall(pkg), 200);
              }}
            >
              Get
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
