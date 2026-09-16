import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Battery, BatteryCharging, Bell, BellOff, Bluetooth, Box, ChevronUp, LayoutGrid, LockKeyhole, Monitor, MoreHorizontal, RotateCw, Search, Settings2, ShoppingBag, Sparkles, Volume2, VolumeX, Wifi, WifiOff, X, type LucideIcon } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { ApplicationIcon, ColorIcon, WindowsLogo } from './Icons';
import { IconButton } from './Shared';
import { useClock } from '../lib/shell';

import { capabilities, nativeAvailable, SYSTEM_APPS, type DesktopApp } from '../lib/desktop';
import { cn } from '../utils/cn';
import type { MouseEvent } from 'react';

function handleReveal(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--rx', `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty('--ry', `${event.clientY - rect.top}px`);
}
export function Taskbar() {
  const { profile, panel, setPanel, togglePanel, windows, activeWindowId, apps, taskbarPinIds, launchApp, taskbarWindowClick, openContextMenu, openSystem, showDesktop, system, runtime, preferences, notifications, nativeNotifications } = useDesktop();
  const now = useClock();
  const pins = taskbarPinIds.map(id => apps.find(app => app.id === id)).filter((app): app is DesktopApp => Boolean(app));
  const pinKinds = new Set(pins.map(app => SYSTEM_APPS.find(candidate => candidate.id === app.id)?.kind || app.id));
  const extraWindows = windows.filter(win => !pinKinds.has(win.kind));
  const external = apps.filter(app => !app.isSystemApp && app.runningState === 'RUNNING' && !taskbarPinIds.includes(app.id));
  const networkText = system.network ? system.source === 'BROWSER' ? `Browser reports ${system.network.connected ? 'online' : 'offline'}; not a Wi-Fi state` : `${system.network.transport}: ${system.network.validated ? 'internet validated' : system.network.connected ? 'internet not validated' : 'offline'}` : 'Network unavailable';
  const volumeText = nativeAvailable() ? system.volume ? `Android media volume ${system.volume.percent}%` : 'Android volume unavailable' : `WIN12 sound volume ${preferences.volume}% / system volume unavailable`;
  const batteryText = system.battery ? `Battery ${system.battery.percent}%${system.battery.charging ? ', charging' : ''}` : 'Battery unavailable';
  const volumeMuted = nativeAvailable() ? system.volume?.muted : preferences.volume === 0;
  const rail = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const count = pins.length + extraWindows.length + external.length;
  useEffect(() => {
    const element = rail.current; if (!element) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 2);
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, [count]);
  return <footer className="taskbar taskbar-v2 taskbar-v3 acrylic" aria-label="Desktop taskbar" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <div className="taskbar-left"><button className="desktop-switcher pc-taskbar-identity reveal" title="Show Administrator PC desktop" aria-label="Show Administrator PC desktop" onMouseMove={handleReveal} onClick={showDesktop}><ColorIcon kind="computer" size={28} /><span>{profile.pcName}</span></button></div>
    <div className="taskbar-center"><button className={cn('taskbar-start taskbar-button reveal', panel === 'start' && 'selected')} title="Start" aria-label="Start" aria-expanded={panel === 'start'} onMouseMove={handleReveal} onClick={() => togglePanel('start')}><WindowsLogo size={25} /></button><button className="taskbar-search reveal" title="Search (Ctrl+K)" aria-label="Search apps, settings, and documents" onMouseMove={handleReveal} onClick={() => setPanel('start')}><Search size={17} /><span>Search</span></button><button className={cn('taskbar-button copilot-taskbar-button reveal', panel === 'copilot' && 'selected')} title="Copilot / external service" aria-label="Open Copilot panel" aria-expanded={panel === 'copilot'} onMouseMove={handleReveal} onClick={() => togglePanel('copilot')}><Sparkles size={21} /></button><span className="taskbar-separator" />
      <div className="taskbar-app-strip" style={{ '--app-count': count } as CSSProperties}><div ref={rail} className="taskbar-apps" aria-label="Pinned and running applications" onWheel={event => { if (rail.current && overflow && Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.current.scrollLeft += event.deltaY; }}>{pins.map(app => {
        const kind = SYSTEM_APPS.find(candidate => candidate.id === app.id)?.kind;
        const openWindows = windows.filter(win => win.kind === kind).sort((a, b) => b.z - a.z);
        const win = openWindows[0], active = openWindows.some(item => item.id === activeWindowId && !item.minimized);
        const running = Boolean(win) || app.runningState === 'RUNNING';
        return <button className={cn('taskbar-button taskbar-app reveal', running && 'running', active && 'active')} key={app.id} title={`${app.displayName}${app.isSystemApp ? '' : ` / process ${app.runningState || 'UNKNOWN'}`}`} aria-label={app.displayName} disabled={!app.isLaunchable && !win} onMouseMove={handleReveal} onClick={() => win ? taskbarWindowClick(win) : launchApp(app)} onContextMenu={event => { event.preventDefault(); setPanel(null); openContextMenu(event.clientX, event.clientY, app); }}><ApplicationIcon app={app} size={27} /></button>;
      })}{extraWindows.map(win => <button className={cn('taskbar-button taskbar-app running reveal', win.id === activeWindowId && !win.minimized && 'active')} key={win.id} title={win.title} aria-label={win.title} onMouseMove={handleReveal} onClick={() => taskbarWindowClick(win)}><ColorIcon kind={win.icon} size={27} /></button>)}{external.map(app => <button className="taskbar-button taskbar-app running reveal" key={app.id} title={`${app.displayName} / Running (observed)`} aria-label={app.displayName} onMouseMove={handleReveal} onClick={() => launchApp(app)}><ApplicationIcon app={app} size={27} /></button>)}</div>{overflow && <button className="taskbar-app-overflow" title="All pinned and running apps" aria-label="Show all pinned and running applications" onClick={() => togglePanel('tray')}><MoreHorizontal size={16} /></button>}</div>
    </div>
    <div className="taskbar-tray"><button className={cn('tray-hidden reveal', panel === 'tray' && 'selected')} title="Show hidden icons" aria-label="Show hidden system icons" aria-expanded={panel === 'tray'} onMouseMove={handleReveal} onClick={() => togglePanel('tray')}><ChevronUp size={15} /></button><button className="tray-rotation reveal" title={`Screen orientation: ${preferences.orientation}`} aria-label="Display and screen rotation settings" onMouseMove={handleReveal} onClick={() => openSystem('settings', { tab: 'display' })}><RotateCw size={16} /></button><button className="tray-runtime reveal" title={`Windows runtime: ${runtime.health}`} aria-label="Compatibility runtime settings" onMouseMove={handleReveal} onClick={() => openSystem('settings', { tab: 'runtime' })}><Box size={16} /><i className={cn('status-dot', capabilities().windowsExecution ? 'green' : 'amber')} /></button><button className={cn('tray-connectivity reveal', panel === 'actions' && 'selected')} title={`${networkText}\n${volumeText}\n${batteryText}`} aria-label="Open quick settings" aria-expanded={panel === 'actions'} onMouseMove={handleReveal} onClick={() => togglePanel('actions')}>{system.network?.connected ? <Wifi size={16} /> : <WifiOff size={16} />}{volumeMuted ? <VolumeX size={16} /> : <Volume2 size={16} className={nativeAvailable() && !system.volume ? 'unavailable-signal' : ''} />}{system.battery?.charging ? <BatteryCharging size={19} /> : <Battery size={19} className={!system.battery ? 'unavailable-signal' : ''} />}{notifications.length + nativeNotifications.length > 0 && <i className="quick-settings-notification-dot" />}</button>
      <button className={cn('tray-clock reveal', panel === 'calendar' && 'selected')} title={now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} aria-label="Open clock and calendar" aria-expanded={panel === 'calendar'} onMouseMove={handleReveal} onClick={() => togglePanel('calendar')}><span>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><small>{now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></button>
      <button className={cn('tray-notifications reveal', panel === 'actions' && 'selected')} title="Notifications and quick settings" aria-label="Notifications and quick settings" onMouseMove={handleReveal} onClick={() => togglePanel('actions')}>{preferences.doNotDisturb ? <BellOff size={17} /> : <Bell size={17} />}{notifications.length + nativeNotifications.length > 0 && <i />}</button><button className="show-desktop-edge" title="Show desktop" aria-label="Show desktop" onClick={showDesktop} /></div>
  </footer>;
}

export function SystemTray() {
  const { system, runtime, openSystem, openNativeSettings, requestDialog, closeFlyouts, setPanel, preferences, taskbarPinIds, apps, windows, launchApp, restoreWindow } = useDesktop();
  const items: { title: string; detail: string; icon: LucideIcon; action: () => void }[] = [
    { title: 'Task view', detail: 'Open WIN12 windows', icon: Monitor, action: () => setPanel('tasks') },
    { title: 'Software Center', detail: 'Chrome / Deriv MT5 / MetaEditor', icon: ShoppingBag, action: () => openSystem('store') },
    { title: 'Screen rotation', detail: preferences.orientation === 'auto' ? 'Auto rotate' : preferences.orientation === 'portrait' ? 'Portrait default' : 'Landscape', icon: RotateCw, action: () => openSystem('settings', { tab: 'display' }) },
    { title: 'Copilot', detail: 'External service', icon: Sparkles, action: () => setPanel('copilot') },
    { title: 'Widgets', detail: 'Optional local tools', icon: LayoutGrid, action: () => setPanel('widgets') },
    { title: 'Windows runtime', detail: runtime.health, icon: Box, action: () => openSystem('settings', { tab: 'runtime' }) },
    { title: 'Bluetooth', detail: system.bluetooth ? system.bluetooth.enabled ? 'On' : 'Off' : 'Unavailable', icon: Bluetooth, action: () => nativeAvailable() ? openNativeSettings('bluetooth') : openSystem('settings', { tab: 'security' }) },
    { title: 'Device lock', detail: system.lock.canLock ? 'Available' : 'Permission required or unavailable', icon: LockKeyhole, action: () => requestDialog({ kind: 'lock' }) },
    { title: 'WIN12 settings', detail: 'Desktop preferences', icon: Settings2, action: () => openSystem('settings') },
  ];
  const pinned = taskbarPinIds.map(id => apps.find(app => app.id === id)).filter((app): app is DesktopApp => Boolean(app));
  return <motion.aside className="system-tray-flyout acrylic shell-panel" role="dialog" aria-label="Hidden system icons" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><header><span>System tray</span><IconButton title="Close system tray" onClick={closeFlyouts}><X size={14} /></IconButton></header><div className="tray-app-grid">{pinned.map(app => <button key={app.id} title={app.displayName} aria-label={`Open ${app.displayName}`} onClick={() => { const win = windows.find(item => item.kind === SYSTEM_APPS.find(candidate => candidate.id === app.id)?.kind); if (win) restoreWindow(win.id); else launchApp(app); }}><ApplicationIcon app={app} size={26} /></button>)}{windows.filter(win => !taskbarPinIds.includes(win.kind)).map(win => <button key={win.id} title={win.title} onClick={() => restoreWindow(win.id)}><ColorIcon kind={win.icon} size={26} /></button>)}</div>{items.map(({ title, detail, icon: Icon, action }) => <button key={title} title={`${title}: ${detail}`} onClick={action}><Icon size={18} /><span>{title}<small>{detail}</small></span></button>)}<footer><Monitor size={12} />{nativeAvailable() ? 'Android native host' : 'Browser desktop'}</footer></motion.aside>;
}