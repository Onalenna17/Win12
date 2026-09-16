import { useMemo, useState } from "react";
import { Native } from "../native";
import { useDesktop } from "../context/DesktopContext";
import type { WindowRecord } from "../types";
import { cn } from "../utils/cn";

export function LogViewerApp({ win }: { win: WindowRecord }) {
  const { showToast, refreshHost } = useDesktop();
  const appId = (win.appProps?.appId as string) || "system";
  const logs = useMemo(() => Native.getLogs(appId), [appId]);
  const keys = Object.keys(logs);
  const [tab, setTab] = useState(keys[0] || "system.log");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--panel-border)] px-3 py-2">
        <div className="flex flex-1 gap-1 overflow-auto">
          {keys.map((k) => (
            <button
              key={k}
              className={cn("rounded-md px-2 py-1 text-xs", tab === k ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]")}
              onClick={() => setTab(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            navigator.clipboard?.writeText(logs[tab] || "");
            showToast("Win12", "Logs copied to clipboard");
          }}
        >
          Copy
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            Native.clearLogs(appId);
            refreshHost();
            showToast("Win12", "Logs cleared");
          }}
        >
          Clear
        </button>
      </div>
      <div className="log-console win-scroll selectable">{logs[tab] || "(No log entries found for this stream)"}</div>
    </div>
  );
}
