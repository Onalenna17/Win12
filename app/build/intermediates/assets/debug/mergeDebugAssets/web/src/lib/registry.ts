import { useEffect, useState, useSyncExternalStore } from 'react';
import { appSearch, capabilities, nativeAvailable, nativeCall, operation, SYSTEM_APPS, type ApplicationSnapshot, type DesktopApp, type SystemState } from './desktop';

export function validateRegistryApps(value: unknown): DesktopApp[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter((app): app is DesktopApp => {
    if (!app || typeof app.id !== 'string' || typeof app.displayName !== 'string' || ids.has(app.id) || SYSTEM_APPS.some(builtin => builtin.id === app.id)) return false;
    if (app.isInstalled !== true || app.verified !== true || app.status === 'REMOVED') return false;
    if (app.launchType === 'ANDROID_PACKAGE' && (typeof app.packageName !== 'string' || typeof app.launchIntent !== 'string')) return false;
    if (app.launchType === 'WINDOWS_EXECUTABLE' && typeof app.executablePath !== 'string') return false;
    if (!['ANDROID_PACKAGE', 'WINDOWS_EXECUTABLE', 'WEB_APPLICATION'].includes(app.launchType)) return false;
    if (app.launchType === 'WEB_APPLICATION' && (!app.metadata?.verifiedUrl || !/^https:\/\//.test(String(app.metadata.verifiedUrl)))) return false;
    ids.add(app.id); return true;
  }).map(app => ({ ...app, isSystemApp: false, runningState: app.runningState === 'RUNNING' && app.runningEvidence && typeof app.observedAt === 'number' && Number.isFinite(app.observedAt) && Date.now() - app.observedAt >= 0 && Date.now() - app.observedAt < 10000 ? 'RUNNING' : app.runningState === 'STOPPED' ? 'STOPPED' : 'UNKNOWN' }));
}

function readSnapshot(): ApplicationSnapshot {
  const unavailable: ApplicationSnapshot = {
    apps: SYSTEM_APPS, status: 'UNAVAILABLE', scannedAt: 0, revision: 0,
    message: nativeAvailable() ? 'This host does not expose verified application discovery.' : 'Android discovery is unavailable in a web browser. Built-in WIN12 apps are available.',
    scope: 'WIN12 built-in applications only', runningVisibility: 'UNAVAILABLE',
  };
  if (!capabilities().applicationDiscovery) return unavailable;
  const value = nativeCall<ApplicationSnapshot | null>('getApplicationSnapshot', [], null);
  if (!value || !Array.isArray(value.apps) || !['READY', 'DISCOVERING', 'ERROR'].includes(value.status)) return { ...unavailable, status: 'ERROR', message: 'The native application registry returned an invalid snapshot.' };
  return { ...value, apps: [...SYSTEM_APPS, ...validateRegistryApps(value.apps)] };
}
let snapshot = readSnapshot();
const listeners = new Set<() => void>();
export function syncRegistry() { snapshot = readSnapshot(); listeners.forEach(listener => listener()); }
export function refreshRegistry() {
  if (!capabilities().applicationDiscovery) { syncRegistry(); return { success: false, message: snapshot.message }; }
  const result = operation('refreshApplications');
  if (result.success) { snapshot = { ...snapshot, status: 'DISCOVERING', message: 'Refreshing installed application metadata...' }; listeners.forEach(listener => listener()); }
  else syncRegistry();
  return result;
}
let interval: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('win12-native-event', syncRegistry);
    window.addEventListener('focus', syncRegistry);
    interval = setInterval(() => { if (document.visibilityState === 'visible' && nativeAvailable()) syncRegistry(); }, 4000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { window.removeEventListener('win12-native-event', syncRegistry); window.removeEventListener('focus', syncRegistry); clearInterval(interval); }
  };
}
export function useRegistry() { return useSyncExternalStore(subscribe, () => snapshot); }
export function registryApp(id: string) { return snapshot.apps.find(app => app.id === id); }
export function registrySearch(query: string) { return snapshot.apps.filter(app => appSearch(app, query)); }
export function integrationChecks(registry: ApplicationSnapshot) {
  return [
    { name: 'Google Chrome', matches: (app: DesktopApp) => /\bchrome\b/i.test(app.displayName) },
    { name: 'Deriv MT5 / MetaTrader 5', matches: (app: DesktopApp) => /\bmt5\b|metatrader\s*5/i.test(`${app.displayName} ${app.packageName || ''}`) },
    { name: 'MetaEditor', matches: (app: DesktopApp) => /metaeditor/i.test(`${app.displayName} ${app.executablePath || ''}`) },
  ].map(target => {
    const matches = registry.apps.filter(app => !app.isSystemApp && target.matches(app));
    return { name: target.name, matches, status: matches.some(app => app.isLaunchable) ? 'Available' : matches.length ? 'Unavailable' : registry.status === 'READY' ? 'Not discovered' : 'Not checked' };
  });
}

export const EMPTY_SYSTEM: SystemState = { source: 'BROWSER', observedAt: 0, battery: null, network: null, wifi: null, airplaneMode: null, volume: null, brightness: null, bluetooth: null, lock: { supported: false, enabled: false, canLock: false, deviceSecure: false }, notifications: { accessGranted: false, connected: false } };
function readSystem(): SystemState {
  if (!capabilities().systemState) return { ...EMPTY_SYSTEM, observedAt: Date.now(), network: { connected: navigator.onLine, validated: null, transport: 'Browser network signal' } };
  const result = nativeCall<Partial<SystemState> | null>('getSystemState', [], null);
  if (!result || result.source !== 'ANDROID_NATIVE') return { ...EMPTY_SYSTEM, source: 'ANDROID_NATIVE' };
  const percent = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  return {
    ...EMPTY_SYSTEM, source: 'ANDROID_NATIVE', observedAt: typeof result.observedAt === 'number' ? result.observedAt : 0,
    battery: result.battery && percent(result.battery.percent) && typeof result.battery.charging === 'boolean' ? result.battery : null,
    network: result.network && typeof result.network.connected === 'boolean' && typeof result.network.transport === 'string' ? { ...result.network, validated: typeof result.network.validated === 'boolean' ? result.network.validated : null } : null,
    wifi: result.wifi && typeof result.wifi.enabled === 'boolean' && typeof result.wifi.connected === 'boolean' ? result.wifi : null,
    airplaneMode: typeof result.airplaneMode === 'boolean' ? result.airplaneMode : null,
    bluetooth: result.bluetooth && typeof result.bluetooth.enabled === 'boolean' ? result.bluetooth : null,
    brightness: percent(result.brightness) ? result.brightness : null,
    volume: result.volume && percent(result.volume.percent) && typeof result.volume.muted === 'boolean' ? { ...result.volume, canSet: result.volume.canSet === true } : null,
    lock: { supported: result.lock?.supported === true, enabled: result.lock?.enabled === true, canLock: result.lock?.canLock === true && result.lock.enabled === true && result.lock.deviceSecure === true, deviceSecure: result.lock?.deviceSecure === true },
    notifications: { accessGranted: result.notifications?.accessGranted === true, connected: result.notifications?.connected === true && result.notifications.accessGranted === true, count: typeof result.notifications?.count === 'number' && result.notifications.count >= 0 ? result.notifications.count : null },
  };
}
export function useSystemState() {
  const [state, setState] = useState<SystemState>(readSystem);
  useEffect(() => {
    let battery: (EventTarget & { level: number; charging: boolean }) | undefined;
    let disposed = false;
    const update = () => { const next = readSystem(); if (!nativeAvailable() && battery && Number.isFinite(battery.level)) next.battery = { percent: Math.round(battery.level * 100), charging: battery.charging }; if (!disposed) setState(next); };
    const browser = navigator as Navigator & { getBattery?: () => Promise<EventTarget & { level: number; charging: boolean }> };
    if (!nativeAvailable()) browser.getBattery?.().then(manager => { if (disposed) return; battery = manager; battery.addEventListener('levelchange', update); battery.addEventListener('chargingchange', update); update(); }).catch(() => {});
    const timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 2500);
    window.addEventListener('win12-native-event', update); window.addEventListener('online', update); window.addEventListener('offline', update); window.addEventListener('focus', update);
    return () => { disposed = true; clearInterval(timer); battery?.removeEventListener('levelchange', update); battery?.removeEventListener('chargingchange', update); window.removeEventListener('win12-native-event', update); window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('focus', update); };
  }, []);
  return state;
}