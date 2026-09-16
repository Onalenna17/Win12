import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { nativeAvailable } from '../lib/desktop';
import { BootScreen } from './BootScreen';
import { AuthScreen } from './AuthScreen';
import { DesktopIcons } from './DesktopIcons';
import { WindowsLogo } from './Icons';
import { WindowFrame } from './WindowFrame';
import { AppHost } from '../apps/AppHost';
import { Taskbar, SystemTray } from './Taskbar';
import { StartMenu } from './StartMenu';
import { ActionCenter } from './ActionCenter';
import { CalendarFlyout } from './CalendarFlyout';
import { ContextMenu } from './ContextMenu';
import { Widgets } from './Widgets';
import { CopilotPanel } from './CopilotPanel';
import { TaskView, AltTabSwitcher } from './WindowSwitcher';
import { SnapPreview } from './SnapPreview';
import { ToastContainer } from './ToastContainer';
import { DesktopDialogs } from './DesktopDialogs';

import { DesktopSoundHint } from './SoundSettings';

export function DesktopShell() {
  const { phase, finishAuth, profile, preferences, wallpaper, wallpaperCss, portrait, apps, shortcuts, desktopFiles, windows, activeWindowId, panel, contextMenu, dialog, snapZone, openSystem, openFile, launchApp, openContextMenu, closeFlyouts, cycleWindows, focusWindow, changeWindow, closeWindow, setSnapZone, helpVisible, dismissHelp } = useDesktop();
  const running = new Set([...apps.filter(app => app.runningState === 'RUNNING').map(app => app.id), ...windows.map(win => win.kind)]);
  if (phase === 'setup' || phase === 'auth') return <AuthScreen mode={phase} onComplete={finishAuth} />;
  return <div id="desktop" className={`desktop theme-${preferences.theme} ${wallpaper.category === 'Light' ? 'light-wallpaper' : ''}`}>
    <div className="desktop-surface" inert={phase === 'boot'} onContextMenu={event => {
      if ((event.target as HTMLElement).closest('.desktop-window, .shell-panel, .taskbar, .context-menu, .desktop-icon, .modal, .window-switcher')) return;
      event.preventDefault(); closeFlyouts(); openContextMenu(event.clientX, event.clientY);
    }}>
      <motion.div
        className="desktop-wallpaper"
        key={`${wallpaper.id}-${portrait ? 'portrait' : 'landscape'}`}
        style={{
          background: wallpaperCss,
          backgroundImage: wallpaperCss,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />
      <div className="desktop-shade" onPointerDown={closeFlyouts} />
      <div className="desktop-brand" aria-label="WIN12 Administrator PC"><div><WindowsLogo size={26} /><span>win<span>12</span></span></div><p>{profile.pcName}</p></div>
      <DesktopIcons apps={shortcuts} files={desktopFiles} running={running} openPC={() => openSystem('explorer', { path: '' })} launch={launchApp} openFile={openFile} onContext={(x, y, app, file) => openContextMenu(x, y, app, file, !app && !file)} />
      {helpVisible && <div className="desktop-help"><CircleHelp size={13} /><span>Double-click to open. Ctrl+` to switch windows.</span><button aria-label="Dismiss desktop hint" onClick={dismissHelp}><X size={12} /></button></div>}
      <div className="desktop-watermark"><strong>{profile.pcName}</strong><span><i className={`status-dot ${nativeAvailable() ? 'green' : 'blue'}`} />{nativeAvailable() ? 'Android native host' : 'Browser desktop'}<i className="watermark-divider" />WIN12</span></div>
      <AnimatePresence>{snapZone && <SnapPreview />}</AnimatePresence>
      <div className="window-container"><AnimatePresence>{windows.map(win => <WindowFrame key={win.id} win={win} active={activeWindowId === win.id} onFocus={() => focusWindow(win.id)} onChange={patch => changeWindow(win.id, patch)} onClose={() => closeWindow(win.id)} onPreview={setSnapZone}><AppHost win={win} /></WindowFrame>)}</AnimatePresence></div>
      <AnimatePresence>{panel && <motion.div className="shell-dismiss-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={closeFlyouts} />}</AnimatePresence>
      <AnimatePresence>{panel === 'widgets' && <Widgets key="widgets" />}{panel === 'copilot' && <CopilotPanel key="copilot" />}{panel === 'start' && <StartMenu key="start" />}{panel === 'actions' && <ActionCenter key="actions" />}{panel === 'calendar' && <CalendarFlyout key="calendar" />}{panel === 'tray' && <SystemTray key="tray" />}{panel === 'tasks' && <TaskView key="tasks" />}{panel === 'switcher' && <AltTabSwitcher key="switcher" />}</AnimatePresence>
      <Taskbar />
      <DesktopSoundHint />
      <AnimatePresence>{contextMenu && <ContextMenu key={`${contextMenu.kind}:${contextMenu.app?.id || contextMenu.file?.path || ''}`} />}</AnimatePresence>
      <ToastContainer />
      <AnimatePresence>{dialog && <DesktopDialogs key={`${dialog.kind}:${'app' in dialog ? dialog.app?.id : 'file' in dialog ? dialog.file.path : ''}`} />}</AnimatePresence>
      {(preferences.brightness < 100 || preferences.nightLight) && <div className="display-filter" style={{ background: preferences.nightLight ? '#edb963' : '#000', opacity: preferences.nightLight ? .09 + (100 - preferences.brightness) / 140 : (100 - preferences.brightness) / 120, mixBlendMode: preferences.nightLight ? 'multiply' : 'normal' }} aria-hidden="true" />}
      <button className="sr-only" onClick={() => cycleWindows()}>Switch windows</button>
    </div>
    <AnimatePresence>{phase === 'boot' && <BootScreen />}</AnimatePresence>
  </div>;
}