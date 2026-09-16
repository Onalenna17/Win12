import { useCallback, useEffect, useRef, useState } from 'react';
import { capabilities, nativeAvailable, nativeCall, operation } from './desktop';
import type { OrientationPreference } from './preferences';

type BrowserOrientation = ScreenOrientation & { lock?: (mode: 'portrait' | 'landscape') => Promise<void>; unlock?: () => void };
export interface OrientationStatus {
  source: 'ANDROID_NATIVE' | 'BROWSER'; preferred: OrientationPreference;
  actual: 'portrait' | 'landscape' | 'unknown'; canRequest: boolean; multiWindow?: boolean; message: string;
}
function readOrientation(preferred: OrientationPreference): OrientationStatus {
  const fallback: OrientationStatus = { source: nativeAvailable() ? 'ANDROID_NATIVE' : 'BROWSER', preferred,
    actual: innerHeight >= innerWidth ? 'portrait' : 'landscape', canRequest: false,
    message: nativeAvailable() ? 'This host does not expose orientation control.' : `${preferred === 'auto' ? 'Auto rotate' : preferred === 'landscape' ? 'Landscape' : 'Portrait'} is the saved preference. The browser controls the actual viewport; mobile fullscreen may allow rotation lock.` };
  if (capabilities().orientationControl) {
    const value = nativeCall<OrientationStatus | null>('getOrientationStatus', [], null);
    return value?.source === 'ANDROID_NATIVE' ? { ...fallback, ...value } : fallback;
  }
  return { ...fallback, canRequest: typeof (screen.orientation as BrowserOrientation | undefined)?.lock === 'function' };
}
export function useOrientation(preferred: OrientationPreference, savePreference: (mode: OrientationPreference) => void) {
  const [status, setStatus] = useState(() => readOrientation(preferred));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const refresh = () => setStatus(readOrientation(preferred));
    refresh();
    window.addEventListener('resize', refresh); window.addEventListener('win12-native-event', refresh);
    document.addEventListener('fullscreenchange', refresh);
    return () => { window.removeEventListener('resize', refresh); window.removeEventListener('win12-native-event', refresh); document.removeEventListener('fullscreenchange', refresh); };
  }, [preferred]);
  const apply = useCallback(async (mode: OrientationPreference, fullscreen = false) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      if (nativeAvailable()) {
        const response = operation('setOrientation', mode);
        if (!response.success) { setStatus(value => ({ ...value, message: response.message || 'Android could not apply this orientation.' })); return false; }
        savePreference(mode); setStatus(readOrientation(mode)); return true;
      }
      savePreference(mode);
      const orientation = screen.orientation as BrowserOrientation | undefined;
      if (mode === 'auto') { orientation?.unlock?.(); setStatus({ ...readOrientation(mode), message: 'Rotation lock released where supported. The browser follows your device orientation.' }); return true; }
      if (!orientation?.lock) { setStatus({ ...readOrientation(mode), message: `${mode === 'portrait' ? 'Portrait' : 'Landscape'} preference saved. This browser cannot lock the physical screen orientation.` }); return false; }
      if (fullscreen && !document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen is unavailable in this browser.');
        await document.documentElement.requestFullscreen();
      }
      if (!document.fullscreenElement && !matchMedia('(display-mode: standalone)').matches) { setStatus({ ...readOrientation(mode), message: 'Preference saved. Use Fullscreen & apply on a supported mobile browser, or use the native Android app.' }); return false; }
      await orientation.lock(mode);
      setStatus({ ...readOrientation(mode), message: 'The browser accepted the screen orientation lock.' }); return true;
    } catch (error) {
      setStatus(value => ({ ...value, message: `Orientation was not locked: ${error instanceof Error ? error.message : 'restricted by your browser or device'}` })); return false;
    } finally { inFlight.current = false; setBusy(false); }
  }, [savePreference]);
  return { status, busy, apply };
}