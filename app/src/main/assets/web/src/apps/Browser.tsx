import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home, Search } from "lucide-react";
import { useDesktop } from "../context/DesktopContext";
import { AppTile } from "../icons";

type Tab = { url: string; loaded: string | null };

export function BrowserApp() {
  const { launchApp, apps, openSystem } = useDesktop();
  const [tab, setTab] = useState<Tab>({ url: "", loaded: null });
  const [hist, setHist] = useState<string[]>([]);
  const [idx, setIdx] = useState(-1);

  const go = (u: string) => {
    let next = u.trim();
    if (!next) {
      setTab({ url: "", loaded: null });
      return;
    }
    if (!/^https?:\/\//i.test(next)) {
      if (next.includes(" ") || !next.includes(".")) {
        next = "https://duckduckgo.com/?q=" + encodeURIComponent(next);
      } else next = "https://" + next;
    }
    const h = hist.slice(0, idx + 1).concat(next);
    setHist(h);
    setIdx(h.length - 1);
    setTab({ url: next, loaded: next });
  };

  const home = () => {
    setTab({ url: "", loaded: null });
  };

  const pins = [
    { name: "File Explorer", type: "explorer" },
    { name: "Settings", type: "settings" },
    { name: "Store", type: "store" },
    { name: "Photos", type: "photos" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--panel-border)] px-3 py-2">
        <button
          className="btn-secondary px-2"
          disabled={idx <= 0}
          onClick={() => {
            const u = hist[idx - 1];
            setIdx(idx - 1);
            setTab({ url: u, loaded: u });
          }}
        >
          <ArrowLeft size={14} />
        </button>
        <button
          className="btn-secondary px-2"
          disabled={idx >= hist.length - 1}
          onClick={() => {
            const u = hist[idx + 1];
            setIdx(idx + 1);
            setTab({ url: u, loaded: u });
          }}
        >
          <ArrowRight size={14} />
        </button>
        <button
          className="btn-secondary px-2"
          onClick={() => tab.loaded && setTab({ ...tab, loaded: tab.loaded + (tab.loaded.includes("?") ? "&" : "?") + "_=" + Date.now() })}
        >
          <RotateCw size={14} />
        </button>
        <button className="btn-secondary px-2" onClick={home}>
          <Home size={14} />
        </button>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            go(tab.url);
          }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="win-input pl-8"
            value={tab.url}
            placeholder="Search or enter web address"
            onChange={(e) => setTab({ ...tab, url: e.target.value })}
          />
        </form>
      </div>
      {tab.loaded ? (
        <iframe title="edge" src={tab.loaded} className="h-full w-full border-0 bg-white" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-gradient-to-b from-sky-950/40 to-transparent p-8">
          <div className="text-2xl font-semibold">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}</div>
          <form
            className="w-full max-w-lg"
            onSubmit={(e) => {
              e.preventDefault();
              go(tab.url);
            }}
          >
            <input
              className="win-input py-3 text-center text-base"
              placeholder="Search the web"
              value={tab.url}
              onChange={(e) => setTab({ ...tab, url: e.target.value })}
            />
          </form>
          <div className="flex gap-4">
            {pins.map((p) => (
              <button
                key={p.type}
                className="flex w-20 flex-col items-center gap-2 rounded-xl p-2 hover:bg-[var(--surface-hover)]"
                onClick={() => {
                  const app = apps.find((a) => a.systemAppType === p.type);
                  if (app) launchApp(app);
                  else openSystem(p.type as "explorer");
                }}
              >
                <AppTile type={p.type} size={40} />
                <span className="text-[11px]">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--text-muted)]">Some sites block embedding — try duckduckgo.com or example.com</div>
        </div>
      )}
    </div>
  );
}
