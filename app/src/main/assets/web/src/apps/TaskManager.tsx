import { useEffect, useState } from "react";
import { Native } from "../native";
import { useDesktop } from "../context/DesktopContext";

export function TaskManagerApp() {
  const { windows, closeWindow, refreshHost, showToast, tick } = useDesktop();
  const processes = Native.getRunningProcesses();
  const [cpu, setCpu] = useState(12);
  const [mem, setMem] = useState(38);
  void tick;

  useEffect(() => {
    const id = setInterval(() => {
      setCpu((c) => Math.max(4, Math.min(92, c + (Math.random() - 0.45) * 8)));
      setMem((m) => Math.max(22, Math.min(80, m + (Math.random() - 0.5) * 3)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Meter label="CPU" value={cpu} />
        <Meter label="Memory" value={mem} />
      </div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Processes ({processes.length + windows.filter((w) => !w.isMinimized).length})
        </h3>
        <button className="btn-secondary" onClick={refreshHost}>
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-auto win-scroll space-y-2">
        {windows.map((w) => (
          <div key={w.id} className="settings-card">
            <div>
              <div className="text-sm font-medium">
                {w.title} {w.isMinimized ? "(minimized)" : ""}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">Window · z={w.zIndex}</div>
            </div>
            <button className="btn-secondary !text-[var(--danger)]" onClick={() => closeWindow(w.id)}>
              End Task
            </button>
          </div>
        ))}
        {processes.map((p) => (
          <div key={p.pid} className="settings-card">
            <div>
              <div className="text-sm font-medium">
                {p.title || p.applicationId} (PID {p.pid})
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {p.status} · {Math.round((Date.now() - p.startTime) / 1000)}s
              </div>
            </div>
            <button
              className="btn-secondary !text-[var(--danger)]"
              onClick={() => {
                Native.stopApp(p.applicationId);
                refreshHost();
                showToast("Task Manager", "Process terminated");
              }}
            >
              End Task
            </button>
          </div>
        ))}
        {windows.length === 0 && processes.length === 0 && (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">No processes currently executing</div>
        )}
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface-hover)] p-3">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: value + "%" }} />
      </div>
    </div>
  );
}
