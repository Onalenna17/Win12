import { useSyncExternalStore } from 'react';
import { getState, normalizePath, type AppKind, type Bounds, type DesktopWindow } from './desktop';
import { loadPreferences } from './preferences';

export const WINDOW_IDS: Record<AppKind, string> = {
  explorer: 'win-explorer', installer: 'win-installer-wizard', apps: 'win-app-manager', settings: 'win-settings',
  recycle: 'win-recycle', logs: 'win-log-viewer', taskmgr: 'win-task-manager', notepad: 'win-notepad', image: 'win-image',
  paint: 'win-paint', photos: 'win-photos', store: 'win-software-center',
  terminal: 'win-terminal',
};
export const SNAP_TYPES = ['FULL', 'LEFT', 'RIGHT', 'TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT'];
export interface SnapZone extends Bounds { type: string }
export function snapBounds(type: string): SnapZone {
  const width = window.innerWidth, height = Math.max(100, window.innerHeight - 84);
  const left = type.includes('LEFT'), top = type.includes('TOP'), quarter = type.includes('_');
  return { type, x: type === 'FULL' || left ? 0 : width / 2, y: quarter && !top ? height / 2 : 0, width: type === 'FULL' ? width : width / 2, height: quarter ? height / 2 : height };
}
export function detectSnap(x: number, y: number): SnapZone | null {
  const width = window.innerWidth, height = window.innerHeight - 84;
  if (x < 70 && y < 70) return snapBounds('TOP_LEFT');
  if (x > width - 70 && y < 70) return snapBounds('TOP_RIGHT');
  if (x < 70 && y > height - 70 && y < height + 20) return snapBounds('BOTTOM_LEFT');
  if (x > width - 70 && y > height - 70 && y < height + 20) return snapBounds('BOTTOM_RIGHT');
  if (x < 24) return snapBounds('LEFT');
  if (x > width - 24) return snapBounds('RIGHT');
  if (y < 24) return snapBounds('FULL');
  return null;
}
export function fitBounds(bounds: Bounds): Bounds {
  const width = Math.max(160, Math.min(bounds.width, window.innerWidth - 16));
  const height = Math.max(120, Math.min(bounds.height, window.innerHeight - 96));
  return { width, height, x: Math.max(0, Math.min(bounds.x, window.innerWidth - width)), y: Math.max(0, Math.min(bounds.y, window.innerHeight - height - 84)) };
}
export function defaultBounds(kind: AppKind, count = 0): Bounds {
  const explorer = kind === 'explorer' || kind === 'recycle';
  const width = Math.min(explorer ? 1020 : kind === 'settings' ? 880 : kind === 'installer' ? 650 : 780, window.innerWidth - (window.innerWidth > 900 ? 190 : 24));
  const height = Math.min(explorer ? 680 : kind === 'settings' ? 642 : kind === 'installer' ? 580 : 550, window.innerHeight - 164);
  return fitBounds({ width, height, x: (window.innerWidth - width) / 2 + (window.innerWidth > 900 ? 34 : 0) + count % 4 * 18, y: Math.max(20, (window.innerHeight - height - 84) / 2 + 26 + count % 4 * 18) });
}
export function initialWindows(): DesktopWindow[] {
  const saved = getState<DesktopWindow[] | null>('windows', null);
  const preferences = loadPreferences();
  if (preferences.restoreSession && Array.isArray(saved)) {
    const seen = new Set<string>();
    return saved.filter(win => {
      if (!win || !(win.kind in WINDOW_IDS) || typeof win.id !== 'string' || seen.has(win.id) || !Number.isFinite(win.width) || !Number.isFinite(win.height)) return false;
      seen.add(win.id); return true;
    }).map(win => ({
      ...win,
      ...(SNAP_TYPES.includes(win.snap) ? snapBounds(win.snap) : fitBounds({ ...win, x: Number.isFinite(win.x) ? win.x : 16, y: Number.isFinite(win.y) ? win.y : 24 })),
      z: Number.isFinite(win.z) ? win.z : 12,
      snap: SNAP_TYPES.includes(win.snap) ? win.snap : 'NONE',
      minimized: preferences.startOnDesktop ? true : Boolean(win.minimized),
      args: win.args?.path ? { ...win.args, path: normalizePath(win.args.path) } : win.args,
    }));
  }
  return [];
}
export function stringHash(value: string) { let hash = 0; for (let i = 0; i < value.length; i++) hash = (hash << 5) - hash + value.charCodeAt(i) | 0; return Math.abs(hash).toString(36); }

let clock = Date.now();
let clockInterval: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    clock = Date.now();
    clockInterval = setInterval(() => { clock = Date.now(); clockListeners.forEach(update => update()); }, 1000);
  }
  return () => { clockListeners.delete(listener); if (!clockListeners.size) clearInterval(clockInterval); };
}
export function useClock() { return new Date(useSyncExternalStore(subscribeClock, () => clock)); }