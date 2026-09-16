import { BootScreen } from "./BootScreen";
import { LockScreen } from "./LockScreen";
import { Taskbar } from "./Taskbar";
import { StartMenu } from "./StartMenu";
import { WindowFrame } from "./WindowFrame";
import { ContextMenu } from "./ContextMenu";
import { ActionCenter } from "./ActionCenter";
import { CalendarFlyout } from "./CalendarFlyout";
import { Widgets } from "./Widgets";
import { CopilotPanel } from "./CopilotPanel";
import { DesktopIcons } from "./DesktopIcons";
import { SnapPreview } from "./SnapPreview";
import { ToastContainer } from "./ToastContainer";
import { useDesktop } from "../context/DesktopContext";
import { wallpaperById } from "../wallpaper";
import { AppTile } from "../icons";

export function DesktopShell() {
  const { phase, setPhase, wallpaperId, windows, closeFlyouts, setContextMenu, nightLight, brightness, altTabOpen, setAltTabOpen, focusWindow } =
    useDesktop();
  const wp = wallpaperById(wallpaperId);

  return (
    <>
      {phase === "boot" && <BootScreen />}
      {phase === "lock" && <LockScreen />}
      {phase === "sleep" && (
        <div className="fixed inset-0 z-[9980] bg-black" onClick={() => setPhase("desktop")} onKeyDown={() => setPhase("desktop")} />
      )}

      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          backgroundImage: wp.css,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#0b1220",
          filter: `brightness(${Math.max(0.4, brightness / 100)})`,
        }}
        onMouseDown={() => closeFlyouts()}
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest(".window") || (e.target as HTMLElement).closest(".taskbar")) return;
          e.preventDefault();
          closeFlyouts();
          setContextMenu({ x: e.clientX, y: e.clientY, kind: "desktop" });
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/10" />
        <DesktopIcons />
        <SnapPreview />
        {windows.map((w) => (
          <WindowFrame key={w.id} win={w} />
        ))}
        <Widgets />
        <CopilotPanel />
        <StartMenu />
        <ActionCenter />
        <CalendarFlyout />
        <Taskbar />
        <ContextMenu />
        <ToastContainer />
        {nightLight && <div className="night-light" />}
        {altTabOpen && (
          <div
            className="absolute inset-0 z-[9500] grid place-items-center bg-black/30"
            onClick={() => setAltTabOpen(false)}
          >
            <div className="flex max-w-[80vw] gap-3 overflow-auto rounded-2xl p-4 acrylic-strong">
              {windows.length === 0 && <div className="px-6 py-4 text-sm text-[var(--text-muted)]">No open windows</div>}
              {windows.map((w) => (
                <button
                  key={w.id}
                  className="flex w-36 flex-col items-center gap-2 rounded-xl p-3 hover:bg-[var(--surface-hover)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    focusWindow(w.id);
                    setAltTabOpen(false);
                  }}
                >
                  <AppTile type={w.icon} size={36} />
                  <span className="line-clamp-2 text-center text-xs">{w.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
