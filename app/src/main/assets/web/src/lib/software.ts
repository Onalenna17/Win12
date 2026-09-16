import { useMemo } from 'react';
import { capabilities, nativeCall, type ApplicationSnapshot, type DesktopApp } from './desktop';

export interface SoftwareProduct {
  id: 'chrome' | 'deriv-mt5' | 'metaeditor'; name: string; publisher: string; subtitle: string;
  androidPackage?: string; publisherUrl: string; guideUrl: string; installUrl: string;
  details: string; support: string;
}
export const OFFICIAL_SOFTWARE: SoftwareProduct[] = [
  { id: 'chrome', name: 'Google Chrome', publisher: 'Google LLC', subtitle: 'The real Google browser', androidPackage: 'com.android.chrome',
    installUrl: 'https://play.google.com/store/apps/details?id=com.android.chrome', publisherUrl: 'https://www.google.com/chrome/', guideUrl: 'https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en',
    details: 'Launch the actual installed Android browser with its own tabs, bookmarks, sync, and security features. Nothing is imitated in a WIN12 window.',
    support: 'Install or update through Google Play. Preinstalled Chrome may only allow removing updates or disabling the app. Android and Chrome requirements apply.' },
  { id: 'deriv-mt5', name: 'Deriv MetaTrader 5', publisher: 'MetaQuotes / Deriv account integration', subtitle: 'Real MetaTrader 5, your Deriv account', androidPackage: 'net.metaquotes.metatrader5',
    installUrl: 'https://play.google.com/store/apps/details?id=net.metaquotes.metatrader5', publisherUrl: 'https://deriv.com/trading-platforms/deriv-mt5', guideUrl: 'https://deriv.com/trading-platforms/mt5/download',
    details: 'Deriv mobile trading uses the real MetaTrader 5 Android application. Sign in with your Deriv MT5 account and server inside that application, never in WIN12.',
    support: 'Android MT5 provides its supported mobile trading features. Desktop Expert Advisors, MetaEditor, and strategy testing are not supplied by this shell. Account, broker, and regional restrictions apply.' },
  { id: 'metaeditor', name: 'MetaEditor', publisher: 'MetaQuotes', subtitle: 'The genuine MQL development environment',
    installUrl: 'https://www.metatrader5.com/en/automated-trading/metaeditor', publisherUrl: 'https://www.metatrader5.com/en/automated-trading/metaeditor', guideUrl: 'https://www.metatrader5.com/en/metaeditor/help',
    details: 'MetaEditor is integrated with the desktop MetaTrader platform. Its real compiler, debugger, and MQL tools require a supported desktop installation.',
    support: 'No official standalone Android MetaEditor installation is supplied. WIN12 can launch a verified MetaEditor executable only when a functioning native compatibility engine is attached. That engine is unavailable in this project.' },
];
export interface SoftwareAvailability { productId: string; state: 'INSTALLED' | 'NOT_INSTALLED' | 'UNSUPPORTED' | 'UNKNOWN'; message: string; packageName?: string; versionName?: string; firstInstallTime?: number; lastUpdateTime?: number; observedAt: number }
export function matchesProduct(product: SoftwareProduct, app: DesktopApp) {
  if (app.isSystemApp || !app.isInstalled || !app.verified) return false;
  if (product.androidPackage && app.launchType === 'ANDROID_PACKAGE') return app.packageName === product.androidPackage;
  if (product.id === 'metaeditor' && app.launchType === 'WINDOWS_EXECUTABLE') return /(^|[\\/])metaeditor(?:64)?\.exe$/i.test(app.executablePath || '');
  return false;
}
export function useSoftwareAvailability(registry: ApplicationSnapshot) {
  return useMemo(() => {
    const values = capabilities().softwareSources ? nativeCall<SoftwareAvailability[]>('getSoftwareAvailability', [], []) : [];
    const valid = Array.isArray(values) ? values.filter(item => item && typeof item.productId === 'string' && ['INSTALLED', 'NOT_INSTALLED', 'UNSUPPORTED', 'UNKNOWN'].includes(item.state) && Number.isFinite(item.observedAt) && Math.abs(Date.now() - item.observedAt) < 15000) : [];
    return OFFICIAL_SOFTWARE.map(product => {
      const apps = registry.apps.filter(app => matchesProduct(product, app));
      const check = valid.find(item => item.productId === product.id);
      const status = apps.some(app => app.isLaunchable) ? 'Ready to open' : check?.state === 'INSTALLED' ? 'Installed / no launch target' : check?.state === 'NOT_INSTALLED' ? 'Not installed' : product.id === 'metaeditor' ? 'Desktop runtime required' : 'Installation not checked';
      return { product, apps, check, status };
    });
  }, [registry]);
}