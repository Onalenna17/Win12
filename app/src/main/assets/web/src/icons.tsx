import {
  Activity,
  Calculator,
  FileText,
  Folder,
  Globe,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Package,
  Palette,
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Terminal,
  Trash2,
  AppWindow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils/cn";

export function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 5.15 11.15 4v7.35H3V5.15Zm8.85-.28L21 3v8.35h-9.15V4.87ZM3 12.5h8.15V20L3 18.85V12.5Zm8.85 0H21V21l-9.15-1.28V12.5Z" />
    </svg>
  );
}

const TILE: Record<string, { bg: string; Icon: LucideIcon; fg?: string }> = {
  explorer: { bg: "linear-gradient(180deg,#ffd45c,#e8a317)", Icon: Folder, fg: "#3b2a00" },
  settings: { bg: "linear-gradient(180deg,#7ec8ff,#0078d4)", Icon: Settings, fg: "#fff" },
  installer: { bg: "linear-gradient(180deg,#a5b4fc,#4f46e5)", Icon: Package, fg: "#fff" },
  apps: { bg: "linear-gradient(180deg,#5eead4,#0f766e)", Icon: LayoutGrid, fg: "#fff" },
  recycle: { bg: "linear-gradient(180deg,#cbd5e1,#475569)", Icon: Trash2, fg: "#fff" },
  logviewer: { bg: "linear-gradient(180deg,#d8b4fe,#7c3aed)", Icon: ScrollText, fg: "#fff" },
  taskmgr: { bg: "linear-gradient(180deg,#fda4af,#e11d48)", Icon: Activity, fg: "#fff" },
  notepad: { bg: "linear-gradient(180deg,#fde68a,#f59e0b)", Icon: FileText, fg: "#3b2a00" },
  calculator: { bg: "linear-gradient(180deg,#e4e4e7,#71717a)", Icon: Calculator, fg: "#111" },
  paint: { bg: "linear-gradient(180deg,#f9a8d4,#db2777)", Icon: Palette, fg: "#fff" },
  terminal: { bg: "linear-gradient(180deg,#27272a,#09090b)", Icon: Terminal, fg: "#4ade80" },
  browser: { bg: "linear-gradient(180deg,#7dd3fc,#0284c7)", Icon: Globe, fg: "#fff" },
  store: { bg: "linear-gradient(180deg,#93c5fd,#2563eb)", Icon: ShoppingBag, fg: "#fff" },
  photos: { bg: "linear-gradient(180deg,#86efac,#16a34a)", Icon: ImageIcon, fg: "#fff" },
  copilot: { bg: "linear-gradient(135deg,#60a5fa,#a78bfa,#f472b6)", Icon: Sparkles, fg: "#fff" },
  about: { bg: "linear-gradient(180deg,#7dd3fc,#0369a1)", Icon: Info, fg: "#fff" },
};

export function AppTile({
  type,
  size = 40,
  className,
  rounded = 10,
}: {
  type?: string;
  size?: number;
  className?: string;
  rounded?: number;
}) {
  const spec = (type && TILE[type]) || {
    bg: "linear-gradient(180deg,#60a5fa,#1d4ed8)",
    Icon: AppWindow,
    fg: "#fff",
  };
  const Icon = spec.Icon;
  const iconSize = Math.round(size * 0.52);
  return (
    <div
      className={cn("grid place-items-center shadow-sm", className)}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: spec.bg,
        color: spec.fg,
      }}
    >
      <Icon size={iconSize} strokeWidth={1.8} />
    </div>
  );
}

export function glyphForApp(app: { isSystemApp?: boolean; systemAppType?: string; iconPath?: string }) {
  if (app.isSystemApp && app.systemAppType) return app.systemAppType;
  if (app.iconPath === "msi") return "installer";
  return "apps";
}
