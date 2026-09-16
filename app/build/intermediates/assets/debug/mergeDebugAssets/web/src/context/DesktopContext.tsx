import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { basename, capabilities, folderPath, FS, getState, logEvent, Native, nativeAvailable, nativeCall, normalizePath, operation, saveState, SYSTEM_APPS, wallpaperCatalog, type AppKind, type DesktopActions, type DesktopApp, type DesktopWindow, type FileItem, type NativeProgress } from '../lib/desktop';
import { DEFAULT_PREFERENCES, DESKTOP_PROFILE, loadPreferences, type Preferences } from '../lib/preferences';
import { defaultBounds, fitBounds, initialWindows, snapBounds, stringHash, WINDOW_IDS, type SnapZone } from '../lib/shell';
import { refreshRegistry, registryApp, syncRegistry, useRegistry, useSystemState } from '../lib/registry';
import { desktopAudio, soundForNotice } from '../lib/audio';
import { useOrientation } from '../lib/orientation';
import type { OrientationPreference } from '../lib/preferences';
import { matchesProduct, OFFICIAL_SOFTWARE } from '../lib/software';
import { hasAccount, hasSession, getAccount, clearSession } from '../lib/auth';

export type ShellPanel = 'start' | 'actions' | 'calendar' | 'tasks' | 'widgets' | 'copilot' | 'tray' | 'switcher' | null;
export type DesktopPhase = 'setup' | 'auth' | 'boot' | 'desktop';
export interface Notification { id: string; title: string; message: string; time: number; native?: boolean; dismissible?: boolean; packageName?: string }
export interface ContextTarget { x: number; y: number; kind: 'desktop' | 'app' | 'file' | 'pc'; app?: DesktopApp; file?: FileItem }
export type DesktopDialog =
  | { kind: 'new-folder'; path: string }
  | { kind: 'app-properties'; app: DesktopApp }
  | { kind: 'uninstall'; app: DesktopApp }
  | { kind: 'file-properties'; file: FileItem }
  | { kind: 'rename-file'; file: FileItem }
  | { kind: 'delete-file'; file: FileItem }
  | { kind: 'lock' }
  | { kind: 'restart' }
  | { kind: 'runtime'; title: string; message: string; app?: DesktopApp }
  | null;
interface SwitcherState { ids: string[]; selected: string; releaseToCommit: boolean }
const DEFAULT_PINS = ['explorer', 'apps', 'installer', 'settings', 'notepad', 'logs'];
function savedIds(key: string, fallback: string[]) { const value = getState<unknown>(key, fallback); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : fallback; }

function useDesktopController() {
  const registry = useRegistry();
  const system = useSystemState();
  const [windows, setWindows] = useState<DesktopWindow[]>(initialWindows);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(() => [...windows].filter(win => !win.minimized).sort((a, b) => b.z - a.z)[0]?.id || null);
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [pinnedIds, setPinnedIds] = useState(() => savedIds('pinned', DEFAULT_PINS));
  const [taskbarPinIds, setTaskbarPinIds] = useState(() => savedIds('taskbarPins', DEFAULT_PINS));
  const [shortcutIds, setShortcutIds] = useState(() => {
    const defaults = ['explorer', 'store', 'apps', 'photos', 'paint', 'notepad', 'settings', 'recycle'];
    const saved = savedIds('shortcuts', defaults);
    return getState('pcDesktopLayoutVersion', 0) < 2 ? [...new Set([...defaults, ...saved])] : saved;
  });
  const [panel, setPanelState] = useState<ShellPanel>(null);
  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [dialog, setDialog] = useState<DesktopDialog>(null);
  const [snapZone, setSnapZone] = useState<SnapZone | null>(null);
  const [switcher, setSwitcher] = useState<SwitcherState | null>(null);
  const [phase, setPhase] = useState<DesktopPhase>(() => hasAccount() ? (hasSession() ? 'boot' : 'auth') : 'setup');
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = getState<Notification[]>('notifications', []);
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.message === 'string' && !item.native).slice(-30) : [];
  });
  const [revision, setRevision] = useState(0);
  const [wallpaperRevision, setWallpaperRevision] = useState(0);
  const [portrait, setPortrait] = useState(() => innerHeight > innerWidth);
  const [helpVisible, setHelpVisible] = useState(() => getState('showDesktopHint', true));
  const windowsRef = useRef(windows); windowsRef.current = windows;
  const activeRef = useRef(activeWindowId); activeRef.current = activeWindowId;
  const prefsRef = useRef(preferences); prefsRef.current = preferences;
  const panelRef = useRef(panel); panelRef.current = panel;
  const dialogRef = useRef(dialog); dialogRef.current = dialog;
  const contextRef = useRef(contextMenu); contextRef.current = contextMenu;
  const switcherRef = useRef(switcher); switcherRef.current = switcher;
  const zIndex = useRef(Math.max(12, ...windows.map(win => win.z)));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const hiddenWindows = useRef<string[]>([]);
  const loggedStartup = useRef(false);
  const persistRef = useRef<() => boolean>(() => false);
  useEffect(() => { desktopAudio.configure(preferences); }, [preferences]);
  useEffect(() => desktopAudio.attach(), []);

  const activate = useCallback((id: string | null) => { activeRef.current = id; setActiveWindowId(id); }, []);
  const closeFlyouts = useCallback(() => {
    panelRef.current = null; contextRef.current = null; switcherRef.current = null;
    setPanelState(null); setContextMenu(null); setSwitcher(null);
  }, []);
  const setPanel = useCallback((next: ShellPanel) => {
    panelRef.current = next; contextRef.current = null;
    setPanelState(next); setContextMenu(null);
    if (next !== 'switcher') { switcherRef.current = null; setSwitcher(null); }
  }, []);
  const togglePanel = useCallback((next: Exclude<ShellPanel, null>) => setPanel(panelRef.current === next ? null : next), [setPanel]);
  const requestDialog = useCallback((next: DesktopDialog) => { closeFlyouts(); dialogRef.current = next; setDialog(next); if (next) desktopAudio.play('dialog'); }, [closeFlyouts]);
  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id); if (timer) clearTimeout(timer);
    timers.current.delete(id); setToasts(previous => previous.filter(item => item.id !== id));
  }, []);
  const showToast = useCallback((title: string, message: string) => {
    const item: Notification = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, message, time: Date.now() };
    setNotifications(previous => [...previous, item].slice(-30));
    if (prefsRef.current.doNotDisturb || panelRef.current === 'actions') return;
    setToasts(previous => [...previous, item].slice(-3));
    timers.current.set(item.id, setTimeout(() => dismissToast(item.id), 5000));
    desktopAudio.play(soundForNotice(title, message));
  }, [dismissToast]);
  const updatePreferences = useCallback((partial: Partial<Preferences>) => {
    const previous = prefsRef.current;
    const next = { ...previous, ...partial,
      volume: partial.volume === undefined ? previous.volume : Math.max(0, Math.min(100, Number.isFinite(partial.volume) ? partial.volume : previous.volume)),
      brightness: partial.brightness === undefined ? previous.brightness : Math.max(25, Math.min(100, Number.isFinite(partial.brightness) ? partial.brightness : previous.brightness)),
    };
    prefsRef.current = next; desktopAudio.configure(next); setPreferences(next); saveState({ preferences: next });
  }, []);
  const saveOrientation = useCallback((mode: OrientationPreference) => updatePreferences({ orientation: mode }), [updatePreferences]);
  const orientation = useOrientation(preferences.orientation, saveOrientation);
  const focusWindow = useCallback((id: string) => {
    if (activeRef.current === id || !windowsRef.current.some(win => win.id === id)) return;
    const z = ++zIndex.current; activate(id);
    setWindows(previous => previous.map(win => win.id === id ? { ...win, z } : win));
  }, [activate]);
  const changeWindow = useCallback((id: string, patch: Partial<DesktopWindow>) => {
    const existing = windowsRef.current.find(win => win.id === id);
    if (existing) {
      if (patch.minimized === true && !existing.minimized) desktopAudio.play('minimize');
      else if (patch.minimized === false && existing.minimized) desktopAudio.play('restore');
      else if ((patch.maximized !== undefined && patch.maximized !== existing.maximized) || (patch.snap !== undefined && patch.snap !== existing.snap)) desktopAudio.play('restore');
    }
    setWindows(previous => previous.map(win => win.id === id ? { ...win, ...patch } : win));
    if (patch.minimized && activeRef.current === id) activate([...windowsRef.current].filter(win => win.id !== id && !win.minimized).sort((a, b) => b.z - a.z)[0]?.id || null);
  }, [activate]);
  const restoreWindow = useCallback((id: string) => {
    if (!windowsRef.current.some(win => win.id === id)) return;
    const z = ++zIndex.current; changeWindow(id, { minimized: false, z }); activate(id); closeFlyouts();
  }, [activate, changeWindow, closeFlyouts]);
  const closeWindow = useCallback((id: string) => {
    const win = windowsRef.current.find(item => item.id === id); if (!win) return;
    setWindows(previous => previous.filter(item => item.id !== id));
    if (activeRef.current === id) activate([...windowsRef.current].filter(item => item.id !== id && !item.minimized).sort((a, b) => b.z - a.z)[0]?.id || null);
    logEvent(`Closed ${win.title}`);
    desktopAudio.play('close');
  }, [activate]);
  const openSystem = useCallback((kind: AppKind, args?: Record<string, string>) => {
    closeFlyouts();
    const matching = windowsRef.current.find(win => (kind === 'notepad' || kind === 'image') && args?.path && win.kind === kind && win.args?.path === args.path);
    const id = matching?.id || WINDOW_IDS[kind] + ((kind === 'notepad' || kind === 'image') && args?.path ? `-${stringHash(args.path)}` : '');
    const systemApp = SYSTEM_APPS.find(app => app.kind === kind);
    const title = kind === 'notepad' ? `${args?.path ? basename(args.path) : 'Untitled'} - Notepad` : kind === 'image' ? args?.path ? basename(args.path) : 'Photos' : systemApp?.displayName || 'Application';
    const z = ++zIndex.current;
    const previousWindow = windowsRef.current.find(win => win.id === id);
    if (!previousWindow) desktopAudio.play('launch');
    else if (previousWindow.minimized) desktopAudio.play('restore');
    setWindows(previous => previous.some(win => win.id === id)
      ? previous.map(win => win.id === id ? { ...win, minimized: false, z, args: args ? { ...win.args, ...args } : win.args } : win)
      : [...previous, { id, kind, title, icon: systemApp?.icon || 'picture', ...defaultBounds(kind, previous.filter(win => !win.minimized).length), z, minimized: false, maximized: false, snap: 'NONE', args }]);
    activate(id); logEvent(`Opened ${title}`);
    if (systemApp) saveState({ recentApps: [{ id: systemApp.id, time: Date.now() }, ...getState<{ id: string; time: number }[]>('recentApps', []).filter(app => app.id !== systemApp.id)].slice(0, 20) });
  }, [activate, closeFlyouts]);
  const updateArgs = useCallback((id: string, args: Record<string, string>) => {
    setWindows(previous => previous.map(win => win.id === id ? { ...win, args: { ...win.args, ...args }, title: win.kind === 'notepad' && args.path ? `${basename(args.path)} - Notepad` : win.title } : win));
  }, []);
  const openFile = useCallback((file: FileItem) => {
    if (file.type !== 'file') { openSystem('explorer', { path: file.path }); return; }
    if (file.originalPath) { showToast('Restore this file first', 'Files in the Recycle Bin must be restored before opening.'); return; }
    if (/\.(exe|msi)$/i.test(file.name)) { openSystem('installer'); showToast('Inspect a Windows file', 'Select the file in Installer Inspector. Nothing is automatically installed or executed.'); return; }
    const image = /\.(png|jpe?g|webp|gif)$/i.test(file.name), text = /\.(txt|md|csv|json|log|xml|css|js|ts|html|ini|cfg)$/i.test(file.name);
    if (nativeAvailable() && !image && !text) { const response = FS.openExternal(file.path); showToast(response.success ? 'Open with Android' : 'File unavailable', response.message || 'Choose an installed application.'); return; }
    if (!image && nativeAvailable()) { const response = FS.read(file.path); if (!response.success) { showToast('Cannot read this document', response.message || 'The native file operation failed.'); return; } }
    saveState({ recentFiles: [file.path, ...getState<string[]>('recentFiles', []).filter(path => path !== file.path)].slice(0, 20) });
    openSystem(image ? 'image' : 'notepad', { path: file.path });
  }, [openSystem, showToast]);
  const launchApp = useCallback((app: DesktopApp) => {
    closeFlyouts();
    const current = registryApp(app.id);
    if (!current?.isInstalled || !current.isLaunchable || !current.verified) { showToast('Application unavailable', 'Refresh Applications to check whether this target is still installed and launchable.'); return; }
    const builtin = SYSTEM_APPS.find(item => item.id === current.id);
    if (builtin) { openSystem(builtin.kind, builtin.kind === 'explorer' ? { path: 'Home' } : undefined); return; }
    if (current.launchType === 'WINDOWS_EXECUTABLE' && !capabilities().windowsExecution) {
      requestDialog({ kind: 'runtime', title: 'Windows execution is unavailable.', message: 'No functioning compatibility engine is attached. Nothing has been executed.', app: current }); return;
    }
    const response = Native.launch(current.id);
    if (!response.success) showToast(`Unable to launch ${current.displayName}`, response.message || 'The native host rejected this launch request.');
    else {
      showToast('Launch request accepted', response.message || 'Android accepted the request. Process state is checked separately.');
      saveState({ recentApps: [{ id: current.id, time: Date.now() }, ...getState<{ id: string; time: number }[]>('recentApps', []).filter(item => item.id !== current.id)].slice(0, 20) });
    }
    syncRegistry();
  }, [closeFlyouts, openSystem, requestDialog, showToast]);
  const actions = useMemo<DesktopActions>(() => ({ open: openSystem, close: closeWindow, notify: showToast, openFile, launchApp, updateArgs }), [openSystem, closeWindow, showToast, openFile, launchApp, updateArgs]);
  const togglePin = useCallback((app: DesktopApp) => { if (registryApp(app.id)) setPinnedIds(previous => previous.includes(app.id) ? previous.filter(id => id !== app.id) : [...previous, app.id]); }, []);
  const toggleTaskbarPin = useCallback((app: DesktopApp) => { if (registryApp(app.id)) setTaskbarPinIds(previous => previous.includes(app.id) ? previous.filter(id => id !== app.id) : [...previous, app.id]); }, []);
  const toggleShortcut = useCallback((app: DesktopApp) => { if (registryApp(app.id)) setShortcutIds(previous => previous.includes(app.id) ? previous.filter(id => id !== app.id) : [...previous, app.id]); }, []);
  const showDesktop = useCallback(() => {
    closeFlyouts();
    const visible = windowsRef.current.filter(win => !win.minimized);
    if (visible.length) { hiddenWindows.current = visible.map(win => win.id); setWindows(previous => previous.map(win => ({ ...win, minimized: true }))); activate(null); }
    else { const ids = hiddenWindows.current.length ? hiddenWindows.current : windowsRef.current.map(win => win.id); setWindows(previous => previous.map(win => ids.includes(win.id) ? { ...win, minimized: false } : win)); activate([...windowsRef.current].filter(win => ids.includes(win.id)).sort((a, b) => b.z - a.z)[0]?.id || null); }
  }, [activate, closeFlyouts]);
  const minimizeAllWindows = useCallback(() => {
    hiddenWindows.current = windowsRef.current.filter(win => !win.minimized).map(win => win.id);
    setWindows(previous => previous.map(win => ({ ...win, minimized: true }))); activate(null); closeFlyouts();
  }, [activate, closeFlyouts]);
  const taskbarWindowClick = useCallback((win: DesktopWindow) => {
    if (win.id === activeRef.current && !win.minimized) { closeFlyouts(); changeWindow(win.id, { minimized: true }); }
    else restoreWindow(win.id);
  }, [changeWindow, closeFlyouts, restoreWindow]);
  const openContextMenu = useCallback((x: number, y: number, app?: DesktopApp, file?: FileItem, pc = false) => {
    setContextMenu({ x, y, kind: app ? 'app' : file ? 'file' : pc ? 'pc' : 'desktop', app, file });
  }, []);
  const refreshHost = useCallback(() => {
    window.dispatchEvent(new Event('win12-files-changed'));
    const response = refreshRegistry();
    if (!response.success) showToast('Desktop refreshed', response.message || 'Native discovery is unavailable. Browser documents were refreshed.');
  }, [showToast]);
  const openNativeSettings = useCallback((section: string) => {
    const response = operation('openSystemSettings', section);
    if (!response.success) showToast('Android settings unavailable', response.message || 'This setting requires the Android host.');
    else closeFlyouts();
    return response;
  }, [closeFlyouts, showToast]);
  const setSystemVolume = useCallback((value: number) => {
    const response = operation('setSystemVolume', Math.round(Math.max(0, Math.min(100, value))));
    if (!response.success) showToast('Volume not changed', response.message || 'The native audio service is unavailable.');
    window.dispatchEvent(new CustomEvent('win12-native-event', { detail: { name: 'systemStateChanged', data: {} } }));
    return response;
  }, [showToast]);
  const restartDesktop = useCallback(() => {
    if (!persistRef.current()) { showToast('Could not save your desktop', 'Restart cancelled. Free some browser storage before trying again.'); return; }
    window.location.reload();
  }, [showToast]);
  const lockDevice = useCallback(() => {
    persistRef.current();
    const response = operation('lockDevice');
    if (!response.success) showToast('Unable to lock Android', response.message || 'Native screen locking is unavailable.');
    return response;
  }, [showToast]);
  const cycleWindows = useCallback((backwards = false, releaseToCommit = false) => {
    const prior = switcherRef.current;
    const ids = prior?.ids.filter(id => windowsRef.current.some(win => win.id === id)) || [...windowsRef.current].sort((a, b) => b.z - a.z).map(win => win.id);
    if (!ids.length) { setPanel('tasks'); return; }
    const index = Math.max(0, ids.indexOf(prior?.selected || activeRef.current || ids[0]));
    const next = { ids, selected: ids[(index + (backwards ? -1 : 1) + ids.length) % ids.length], releaseToCommit: prior?.releaseToCommit || releaseToCommit };
    switcherRef.current = next; panelRef.current = 'switcher'; setSwitcher(next); setPanelState('switcher'); setContextMenu(null);
  }, [setPanel]);
  const selectSwitcherWindow = useCallback((id: string) => {
    setSwitcher(previous => { if (!previous) return null; const next = { ...previous, selected: id }; switcherRef.current = next; return next; });
  }, []);
  const commitSwitcher = useCallback(() => {
    const id = switcherRef.current?.selected; if (id && windowsRef.current.some(win => win.id === id)) restoreWindow(id); else closeFlyouts();
  }, [restoreWindow, closeFlyouts]);

  const wallpaper = useMemo(() => { const catalog = wallpaperCatalog(); return catalog.find(item => item.id === preferences.wallpaper) || catalog.find(item => item.id === DEFAULT_PREFERENCES.wallpaper) || catalog[0]; }, [preferences.wallpaper, wallpaperRevision]);
  const wallpaperCss = portrait && wallpaper.portrait ? wallpaper.portrait : wallpaper.background;
  const apps = registry.apps;
  const pinned = useMemo(() => pinnedIds.map(id => apps.find(app => app.id === id)).filter((app): app is DesktopApp => Boolean(app)), [pinnedIds, apps]);
  const shortcuts = useMemo(() => shortcutIds.map(id => apps.find(app => app.id === id)).filter((app): app is DesktopApp => Boolean(app)), [shortcutIds, apps]);
  const desktopFiles = useMemo(() => folderPath('Desktop') ? FS.list(folderPath('Desktop')).items : [], [revision]);
  const runtime = useMemo(() => Native.runtime(), [registry.revision, revision]);
  const nativeNotifications = useMemo(() => {
    if (!system.notifications.connected) return [];
    const list = nativeCall<Notification[]>('getNativeNotifications', [], []);
    return Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.message === 'string').map(item => ({ ...item, native: true })) : [];
  }, [system]);
  const dismissNotification = useCallback((id: string, isNative = false) => {
    if (!isNative) { setNotifications(previous => previous.filter(item => item.id !== id)); dismissToast(id); return; }
    const response = operation('dismissNativeNotification', id);
    if (!response.success) showToast('Notification not dismissed', response.message || 'Android rejected this request.');
  }, [dismissToast, showToast]);
  const clearNotifications = useCallback(() => { setNotifications([]); setToasts([]); timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const persisted = useMemo(() => ({ windows, preferences, pinned: pinnedIds, taskbarPins: taskbarPinIds, shortcuts: shortcutIds, notifications, pcDesktopLayoutVersion: 2,
    desktopShortcuts: shortcuts.map((app, order) => ({ id: `shortcut:${app.id}`, targetId: app.id, launchType: app.launchType, packageName: app.packageName, launchIntent: app.launchIntent, executablePath: app.executablePath, visible: true, order })),
  }), [windows, preferences, pinnedIds, taskbarPinIds, shortcutIds, notifications, shortcuts]);
  persistRef.current = () => saveState(persisted);
  useEffect(() => { const timer = setTimeout(() => persistRef.current(), 180); return () => clearTimeout(timer); }, [persisted]);
  useEffect(() => {
    if (registry.status !== 'READY') return;
    const ids = new Set(registry.apps.map(app => app.id));
    const prune = (previous: string[]) => previous.some(id => !ids.has(id)) ? previous.filter(id => ids.has(id)) : previous;
    setPinnedIds(prune); setTaskbarPinIds(prune); setShortcutIds(prune);
  }, [registry]);
  useEffect(() => {
    if (registry.status !== 'READY') return;
    const done = getState<string[]>('requestedSoftwareShortcuts.v1', []);
    const requested = getState<string[]>('softwareShortcutRequests', []);
    const additions = OFFICIAL_SOFTWARE.filter(product => !done.includes(product.id) || requested.includes(product.id)).map(product => ({ product, app: registry.apps.find(app => app.isLaunchable && matchesProduct(product, app)) })).filter(item => item.app !== undefined);
    if (!additions.length) return;
    const ids = additions.map(item => item.app!.id);
    setShortcutIds(previous => [...new Set([...previous, ...ids])]);
    saveState({ 'requestedSoftwareShortcuts.v1': [...new Set([...done, ...additions.map(item => item.product.id)])], softwareShortcutRequests: requested.filter(id => !additions.some(item => item.product.id === id)) });
  }, [registry]);
  useEffect(() => {
    const persist = () => { persistRef.current(); };
    const hidden = () => { if (document.visibilityState === 'hidden') { persist(); closeFlyouts(); } };
    window.addEventListener('beforeunload', persist); window.addEventListener('win12-persist', persist); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('beforeunload', persist); window.removeEventListener('win12-persist', persist); document.removeEventListener('visibilitychange', hidden); };
  }, [closeFlyouts]);
  useEffect(() => {
    const files = () => setRevision(value => value + 1), images = () => setWallpaperRevision(value => value + 1);
    const resize = () => { setPortrait(innerHeight > innerWidth); setWindows(previous => previous.map(win => ({ ...win, ...(win.snap !== 'NONE' ? snapBounds(win.snap) : fitBounds(win)) }))); };
    window.addEventListener('win12-files-changed', files); window.addEventListener('win12-wallpapers-changed', images); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('win12-files-changed', files); window.removeEventListener('win12-wallpapers-changed', images); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    if (phase !== 'desktop') return;
    const keydown = (event: KeyboardEvent) => {
      if (dialogRef.current) return;
      if (event.key === 'Escape') { closeFlyouts(); return; }
      if (event.altKey && event.key === 'F4' && activeRef.current) { event.preventDefault(); closeWindow(activeRef.current); return; }
      if (event.altKey && event.key === 'Tab') { event.preventDefault(); cycleWindows(event.shiftKey, true); return; }
      if (event.ctrlKey && event.code === 'Backquote') { event.preventDefault(); cycleWindows(event.shiftKey); return; }
      if (panelRef.current === 'switcher') {
        if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Tab'].includes(event.key)) { event.preventDefault(); cycleWindows(event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Tab' && event.shiftKey); }
        if (event.key === 'Enter') { event.preventDefault(); commitSwitcher(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPanel('start'); }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n' && folderPath('Desktop')) { event.preventDefault(); requestDialog({ kind: 'new-folder', path: folderPath('Desktop') }); }
    };
    const keyup = (event: KeyboardEvent) => { if (event.key === 'Alt' && switcherRef.current?.releaseToCommit && panelRef.current === 'switcher') commitSwitcher(); };
    const blur = () => { if (panelRef.current === 'switcher') closeFlyouts(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [phase, closeFlyouts, closeWindow, cycleWindows, commitSwitcher, setPanel, requestDialog]);
  useEffect(() => {
    const handleBack = () => {
      if (dialogRef.current) { setDialog(null); return; }
      if (contextRef.current || panelRef.current) { closeFlyouts(); return; }
      if (activeRef.current) changeWindow(activeRef.current, { minimized: true });
    };
    window.Win12Desktop = {
      onNativeEvent: (name, raw) => {
        let data: NativeProgress;
        try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { logEvent('Ignored an invalid native event.'); return; }
        if (!data || typeof data !== 'object') return;
        if (name === 'system:runtimeInstallProgress') saveState({ runtimeProgress: data });
        if (name === 'operationResult') showToast(data.success ? 'Native operation result' : 'Operation failed', data.message || 'The native host returned a result.');
        else if ((name === 'installerProgress' || name === 'system:runtimeInstallProgress') && ['Installed', 'Failed'].includes(data.step)) showToast(`Native ${data.step.toLowerCase()} event`, data.message || data.error || 'Check the refreshed registry and diagnostics.');
        window.dispatchEvent(new CustomEvent('win12-native-event', { detail: { name, data } })); setRevision(value => value + 1);
      },
      handleBackButton: handleBack, handleEscapeKey: closeFlyouts,
      openExplorer: path => openSystem('explorer', { path: path ? normalizePath(path) : '' }),
      openInstallerWizard: () => openSystem('installer'), openAppManager: () => openSystem('apps'),
      openSettings: tab => openSystem('settings', { tab: tab || 'general' }), openLogViewer: appId => openSystem('logs', { appId: appId || 'system' }),
      openTaskManager: () => openSystem('taskmgr'), handleAppLaunch: launchApp, closeWindow,
      setWallpaper: id => updatePreferences({ wallpaper: wallpaperCatalog().some(item => item.id === id) ? id : DEFAULT_PREFERENCES.wallpaper }),
      refreshApplications: refreshHost,
      startRuntimeInstall: () => { const form = document.querySelector<HTMLFormElement>('.runtime-form'); if (form) form.requestSubmit(); else openSystem('settings', { tab: 'runtime' }); },
      cancelRuntimeInstall: () => operation('cancelRuntimeInstall'), uninstallRuntime: () => openSystem('settings', { tab: 'runtime', command: 'uninstall' }),
      clearAllLogs: () => { const success = nativeAvailable() ? operation('clearLogs', 'system').success : saveState({ logs: [] }); showToast(success ? 'Logs cleared' : 'Could not clear logs', success ? 'WIN12 logs were removed.' : 'The storage operation failed.'); },
    };
    return () => { delete window.Win12Desktop; };
  }, [changeWindow, closeFlyouts, closeWindow, launchApp, openSystem, refreshHost, showToast, updatePreferences]);
  useEffect(() => {
    if (phase !== 'desktop') return;
    persistRef.current();
    Native.command('desktopReady');
    desktopAudio.startSession();
    if (!loggedStartup.current) { loggedStartup.current = true; logEvent(nativeAvailable() ? 'WIN12 native desktop ready.' : 'WIN12 browser desktop ready. Android services unavailable.'); }
  }, [phase]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const finishAuth = useCallback(() => { closeFlyouts(); setDialog(null); setPhase('boot'); }, [closeFlyouts]);
  const signOut = useCallback(() => { clearSession(); closeFlyouts(); setDialog(null); setPhase('auth'); }, [closeFlyouts]);
  const finishBoot = useCallback(() => { closeFlyouts(); setDialog(null); setPhase('desktop'); }, [closeFlyouts]);
  const account = getAccount();
  const profile = { ...DESKTOP_PROFILE, ...(account ? { displayName: account.displayName, pcName: `${account.displayName} PC`, description: `Local WIN12 profile for ${account.displayName}; Android permissions are unchanged.` } : {}) };
  return {
    phase, finishBoot, finishAuth, signOut, profile, registry, apps, system, runtime, actions, windows, activeWindowId,
    preferences, updatePreferences, orientation, theme: preferences.theme, toggleTheme: () => updatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' }),
    nightLight: preferences.nightLight, setNightLight: (enabled: boolean) => updatePreferences({ nightLight: enabled }),
    brightness: preferences.brightness, setBrightness: (value: number) => updatePreferences({ brightness: value }),
    volume: preferences.volume, setVolume: (value: number) => updatePreferences({ volume: value }), setSystemVolume,
    panel, setPanel, togglePanel, closeFlyouts, startOpen: panel === 'start', actionCenterOpen: panel === 'actions', calendarOpen: panel === 'calendar', widgetsOpen: panel === 'widgets', copilotOpen: panel === 'copilot', altTabOpen: panel === 'switcher',
    pinnedIds, pinned, taskbarPinIds, shortcutIds, shortcuts, togglePin, toggleTaskbarPin, toggleShortcut,
    contextMenu, setContextMenu, openContextMenu, dialog, requestDialog, setDialog,
    snapZone, setSnapZone, focusWindow, changeWindow, closeWindow, restoreWindow, minimizeWindow: (id: string) => changeWindow(id, { minimized: true }),
    showDesktop, minimizeAllWindows, taskbarWindowClick, switcher, cycleWindows, selectSwitcherWindow, commitSwitcher,
    wallpaper, wallpaperCss, desktopFiles, portrait, revision,
    toasts, notifications, nativeNotifications, showToast, dismissToast, dismissNotification, clearNotifications,
    openSystem, openFile, launchApp, refreshHost, openNativeSettings, lockDevice, restartDesktop,
    helpVisible, dismissHelp: () => { setHelpVisible(false); saveState({ showDesktopHint: false }); },
  };
}

type DesktopContextValue = ReturnType<typeof useDesktopController>;
const DesktopContext = createContext<DesktopContextValue | null>(null);
export function DesktopProvider({ children }: { children: ReactNode }) {
  const value = useDesktopController();
  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}
export function useDesktop() {
  const value = useContext(DesktopContext);
  if (!value) throw new Error('useDesktop must be used within DesktopProvider.');
  return value;
}