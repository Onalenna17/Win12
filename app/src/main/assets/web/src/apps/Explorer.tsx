import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  FolderPlus,
  Grid2x2,
  HardDrive,
  List,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { Native } from "../native";
import { useDesktop } from "../context/DesktopContext";
import type { FSEntry, WindowRecord } from "../types";
import { cn } from "../utils/cn";

function iconFor(item: FSEntry) {
  if (item.type === "drive") return "💾";
  if (item.type === "drive-locked") return "🔒";
  if (item.type === "directory") return "📁";
  const n = item.name.toLowerCase();
  if (n.endsWith(".exe") || n.endsWith(".msi")) return "🪟";
  if (n.endsWith(".jpg") || n.endsWith(".png") || n.endsWith(".jpeg")) return "🖼️";
  if (n.endsWith(".txt") || n.endsWith(".log") || n.endsWith(".ini")) return "📄";
  if (n.endsWith(".zip")) return "📦";
  return "📄";
}

const SIDE = [
  { label: "This PC", path: "", icon: Monitor },
  { label: "Local Disk (C:)", path: "C:\\", icon: HardDrive },
  { label: "Windows", path: "C:\\Windows", icon: HardDrive },
  { label: "Program Files", path: "C:\\Program Files", icon: HardDrive },
  { label: "Desktop", path: "C:\\Users\\win12user\\Desktop", icon: Monitor },
  { label: "Downloads", path: "C:\\Users\\win12user\\Downloads", icon: HardDrive },
  { label: "Documents", path: "C:\\Users\\win12user\\Documents", icon: HardDrive },
  { label: "Device Storage (E:)", path: "E:\\", icon: Smartphone },
];

export function ExplorerApp({ win }: { win: WindowRecord }) {
  const { refreshHost, showToast, openSystem, setContextMenu } = useDesktop();
  const initial = (win.appProps?.path as string) || "C:\\";
  const [path, setPath] = useState(initial);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const last = useRef(0);
  const [rev, setRev] = useState(0);

  const listing = useMemo(() => Native.getVirtualDriveContents(path), [path, rev]);

  const go = (p: string) => {
    setPath(p);
    setSelected(null);
  };

  const up = () => {
    if (path === "") return;
    if (path === "C:\\" || path === "E:\\") return go("");
    const parts = path.split("\\").filter(Boolean);
    parts.pop();
    go(parts.length === 1 ? parts[0] + "\\" : parts.join("\\"));
  };

  const openItem = (item: FSEntry) => {
    if (item.type === "drive-locked") {
      Native.requestAllFilesAccess();
      showToast("Storage Access", "Requesting device storage…");
      return;
    }
    if (item.type === "directory" || item.type === "drive") go(item.path);
    else if (item.name.toLowerCase().endsWith(".txt") || item.name.toLowerCase().endsWith(".log")) {
      openSystem("notepad", { id: "win-notepad-" + item.name, title: item.name + " - Notepad", appProps: { filePath: item.path, fileName: item.name } });
    } else if (item.name.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
      openSystem("photos", { appProps: { focus: item.name } });
    } else if (item.name.toLowerCase().match(/\.(exe|msi)$/)) {
      showToast("Installer", `Selected ${item.name}`);
      openSystem("installer", { appProps: { fileName: item.name } });
    }
  };

  const crumbs = path === "" ? ["This PC"] : path.split("\\").filter(Boolean);

  return (
    <div className="explorer-layout">
      <div className="explorer-toolbar">
        <button className="btn-secondary px-2" title="Up" onClick={up}>
          <ArrowUp size={14} />
        </button>
        <button
          className="btn-secondary px-2"
          title="Refresh"
          onClick={() => {
            setRev((n) => n + 1);
            refreshHost();
          }}
        >
          <RefreshCw size={14} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-md border border-[var(--panel-border)] bg-black/20 px-2 py-1 text-xs">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={12} className="text-[var(--text-muted)]" />}
              <button
                className="hover:underline"
                onClick={() => {
                  if (path === "") return go("");
                  if (i === 0) go(c + "\\");
                  else {
                    const parts = path.split("\\").filter(Boolean).slice(0, i + 1);
                    go(parts.length === 1 ? parts[0] + "\\" : parts.join("\\"));
                  }
                }}
              >
                {c}
              </button>
            </span>
          ))}
        </div>
        <button
          className="btn-primary flex items-center gap-1"
          onClick={() => {
            const name = prompt("Enter new folder name:", "New Folder");
            if (name) {
              Native.createVirtualFolder(path || "C:\\", name);
              setRev((n) => n + 1);
              refreshHost();
            }
          }}
        >
          <FolderPlus size={14} /> New
        </button>
        <button className="btn-secondary px-2" onClick={() => setView(view === "grid" ? "list" : "grid")}>
          {view === "grid" ? <List size={14} /> : <Grid2x2 size={14} />}
        </button>
      </div>
      <div className="explorer-body">
        <div className="explorer-sidebar win-scroll">
          {SIDE.map((s) => (
            <div
              key={s.path}
              className={cn("sidebar-item", path === s.path && "active")}
              onClick={() => go(s.path)}
            >
              <s.icon size={14} /> {s.label}
            </div>
          ))}
        </div>
        <div
          className={cn("explorer-main win-scroll", view === "list" && "!grid-cols-1 !gap-0")}
          onClick={() => setSelected(null)}
        >
          {listing.permissionRequired ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-16 text-sm text-[var(--text-muted)]">
              <div className="text-3xl">🔒</div>
              Win12 needs permission to access device storage.
              <button className="btn-primary" onClick={() => Native.requestAllFilesAccess()}>
                Grant Access
              </button>
            </div>
          ) : listing.items.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-[var(--text-muted)]">This folder is empty</div>
          ) : view === "grid" ? (
            listing.items.map((item) => (
              <div
                key={item.path}
                className={cn("explorer-item", selected === item.path && "selected")}
                onClick={(e) => {
                  e.stopPropagation();
                  const now = Date.now();
                  if (now - last.current < 350 && selected === item.path) openItem(item);
                  else setSelected(item.path);
                  last.current = now;
                }}
                onDoubleClick={() => openItem(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, kind: "file", file: item });
                }}
              >
                <div className="text-3xl">{iconFor(item)}</div>
                <div className="item-name line-clamp-2 text-center text-[11px]">{item.name}</div>
              </div>
            ))
          ) : (
            listing.items.map((item) => (
              <div
                key={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-xs hover:bg-[var(--surface-hover)]",
                  selected === item.path && "bg-[var(--accent-soft)]",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  const now = Date.now();
                  if (now - last.current < 350) openItem(item);
                  else setSelected(item.path);
                  last.current = now;
                }}
                onDoubleClick={() => openItem(item)}
              >
                <span className="text-lg">{iconFor(item)}</span>
                <span className="flex-1 truncate">{item.name}</span>
                <span className="w-24 text-[var(--text-muted)]">{item.type}</span>
                <span className="w-20 text-right text-[var(--text-muted)]">
                  {item.size ? Math.round(item.size / 1024) + " KB" : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
