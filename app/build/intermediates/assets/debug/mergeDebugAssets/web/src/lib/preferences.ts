import { getState } from './desktop';
export type OrientationPreference = 'portrait' | 'landscape' | 'auto';

export interface Preferences {
  defaultsVersion: number;
  theme: 'dark' | 'light';
  wallpaper: string;
  restoreSession: boolean;
  startOnDesktop: boolean;
  volume: number;
  brightness: number;
  nightLight: boolean;
  doNotDisturb: boolean;
  startupSound: boolean;
  systemSounds: boolean;
  orientation: OrientationPreference;
}
export const PC_DEFAULTS_VERSION = 3;
import { getUserProfile } from './auth';
export const DESKTOP_PROFILE = { get displayName() { return getUserProfile().displayName; }, get pcName() { return getUserProfile().pcName; }, get description() { return getUserProfile().description; } };
export const DEFAULT_PREFERENCES: Preferences = {
  defaultsVersion: PC_DEFAULTS_VERSION, theme: 'light', wallpaper: 'daylight', restoreSession: true,
  startOnDesktop: true, volume: 70, brightness: 100, nightLight: false,
  doNotDisturb: false, startupSound: true, systemSounds: true,
  orientation: 'portrait',
};
export function normalizePreferences(input: unknown): Preferences {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input as Partial<Preferences> : {};
  // Apply the requested PC defaults once. Later, explicit user choices stay persistent.
  const migrate = value.defaultsVersion !== PC_DEFAULTS_VERSION;
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    defaultsVersion: PC_DEFAULTS_VERSION,
    theme: !migrate && value.theme === 'dark' ? 'dark' : 'light',
    wallpaper: typeof value.wallpaper === 'string' && !(migrate && value.wallpaper === 'bloom') ? value.wallpaper : 'daylight',
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(100, value.volume)) : 70,
    brightness: typeof value.brightness === 'number' && Number.isFinite(value.brightness) ? Math.max(25, Math.min(100, value.brightness)) : 100,
    restoreSession: typeof value.restoreSession === 'boolean' ? value.restoreSession : true,
    startOnDesktop: migrate || value.startOnDesktop !== false,
    nightLight: value.nightLight === true,
    doNotDisturb: value.doNotDisturb === true,
    startupSound: typeof value.startupSound === 'boolean' ? value.startupSound : true,
    systemSounds: typeof value.systemSounds === 'boolean' ? value.systemSounds : true,
    orientation: value.orientation === 'landscape' || value.orientation === 'auto' ? value.orientation : 'portrait',
  };
}
export function loadPreferences(): Preferences { return normalizePreferences(getState<unknown>('preferences', {})); }