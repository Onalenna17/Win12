import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, CircleHelp, Download, ExternalLink, Info, LoaderCircle, Monitor, Package, RefreshCw, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useDesktop } from '../context/DesktopContext';
import { ApplicationIcon } from '../components/Icons';
import { Modal } from '../components/Shared';
import { capabilities, getState, nativeAvailable, operation, saveState, type DesktopWindow, type DesktopApp } from '../lib/desktop';
import { refreshRegistry, useRegistry } from '../lib/registry';
import { OFFICIAL_SOFTWARE, useSoftwareAvailability, type SoftwareProduct } from '../lib/software';

interface Maintenance {
  productId: string; appId: string; firstInstallTime: number; requestedAt: number;
  removalRequested: boolean; removalObserved: boolean; installPageOpened: boolean;
}
export function SoftwareSourceLink({ product, destination = 'install', children, className = 'secondary-button', onOpened }: { product: SoftwareProduct; destination?: 'install' | 'publisher' | 'guide'; children: ReactNode; className?: string; onOpened?: () => void }) {
  const { showToast } = useDesktop();
  const href = destination === 'install' ? product.installUrl : destination === 'publisher' ? product.publisherUrl : product.guideUrl;
  const accepted = () => {
    if (destination === 'install' && product.androidPackage) saveState({ softwareShortcutRequests: [...new Set([...getState<string[]>('softwareShortcutRequests', []), product.id])] });
    onOpened?.();
  };
  if (!nativeAvailable()) return <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={accepted}>{children}</a>;
  return <button className={className} disabled={!capabilities().softwareSources} onClick={() => {
    const response = operation('openSoftwareSource', product.id, destination);
    if (!response.success) showToast('Official page unavailable', response.message || 'Update the Android host to use official installation handoffs.');
    else accepted();
  }}>{children}</button>;
}

export function SoftwareCatalog({ compact = false }: { compact?: boolean }) {
  const { launchApp, openSystem, shortcutIds, toggleShortcut, taskbarPinIds, toggleTaskbarPin } = useDesktop();
  const registry = useRegistry();
  const products = useSoftwareAvailability(registry);
  const [maintenance, setMaintenance] = useState<Maintenance | null>(() => {
    const value = getState<Maintenance | null>('softwareMaintenance.v1', null);
    return value && OFFICIAL_SOFTWARE.some(product => product.id === value.productId) && typeof value.appId === 'string' ? value : null;
  });
  const [manage, setManage] = useState<{ product: SoftwareProduct; app: DesktopApp } | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { saveState({ 'softwareMaintenance.v1': maintenance }); }, [maintenance]);
  useEffect(() => {
    if (!maintenance || !maintenance.removalRequested || maintenance.removalObserved) return;
    const target = products.find(item => item.product.id === maintenance.productId);
    if (target?.check?.state === 'NOT_INSTALLED') setMaintenance(value => value ? { ...value, removalObserved: true } : null);
  }, [products, maintenance]);
  const active = products.find(item => item.product.id === maintenance?.productId);
  const reinstalled = Boolean(maintenance && active?.check?.state === 'INSTALLED' && (maintenance.removalObserved || maintenance.firstInstallTime > 0 && (active.check.firstInstallTime || 0) > maintenance.firstInstallTime) && active.apps.some(app => app.isLaunchable));
  const askRemoval = () => {
    if (!manage || !understood) return;
    setError('');
    const baseline = products.find(item => item.product.id === manage.product.id)?.check;
    const pending: Maintenance = { productId: manage.product.id, appId: manage.app.id, firstInstallTime: baseline?.firstInstallTime || Number(manage.app.metadata?.firstInstallTime) || 0, requestedAt: Date.now(), removalRequested: true, removalObserved: false, installPageOpened: false };
    if (!saveState({ 'softwareMaintenance.v1': pending })) { setError('Save your desktop state before starting a reinstall.'); return; }
    const response = operation('uninstallApplication', manage.app.id);
    if (!response.success) { setError(response.message || 'Android did not accept the removal request.'); saveState({ 'softwareMaintenance.v1': maintenance }); return; }
    setMaintenance(pending); setManage(null); setUnderstood(false);
  };
  return <div className={`software-catalog ${compact ? 'compact' : ''}`}>
    <div className="software-trust-note"><ShieldCheck size={17} /><p>Official software, not packaged imitations. Installation happens in Android or on a supported desktop. Icons come from the actual installed package.</p></div>
    {maintenance && active && <div className="maintenance-progress" role="status"><div><RefreshCw size={18} /><h3>{reinstalled ? `${active.product.name} is installed and launchable` : `Reinstall ${active.product.name}`}</h3></div><p>{reinstalled ? 'A new installation was observed by PackageManager and a launch target is available. Application functionality still needs testing on your device.' : active.check?.state === 'NOT_INSTALLED' ? 'Android confirms the package is removed. You can now install it again from the official listing.' : 'Waiting for native confirmation. If you cancelled removal, the existing application remains installed.'}</p><div className="maintenance-actions">{reinstalled ? <button className="primary-button" onClick={() => launchApp(active.apps.find(app => app.isLaunchable)!)}>Open actual application<ArrowUpRight size={13} /></button> : maintenance.removalObserved || active.check?.state === 'NOT_INSTALLED' ? <SoftwareSourceLink product={active.product} onOpened={() => setMaintenance(value => value ? { ...value, installPageOpened: true } : null)}>Open official installer<Download size={14} /></SoftwareSourceLink> : <button className="secondary-button" onClick={() => refreshRegistry()}>Refresh status<RefreshCw size={14} /></button>}<button className="text-button" onClick={() => setMaintenance(null)}>{reinstalled ? 'Finish' : 'Dismiss tracking'}</button></div>{!reinstalled && maintenance.installPageOpened && <small>Store opened. Installation is not marked complete until Android confirms the new package.</small>}</div>}
    <div className="official-software-list">{products.map(({ product, apps, check, status }) => {
      const app = apps.find(item => item.isLaunchable) || apps[0];
      return <section className="official-software" key={product.id}>
        <div className="official-software-heading">{app ? <ApplicationIcon app={app} size={47} /> : <span className="uninstalled-software-icon" title="Generic software reference, not an installed application icon"><Package size={29} strokeWidth={1.4} /></span>}<div><h2>{product.name}</h2><p>{product.publisher}</p></div><span className={`software-install-state ${app?.isLaunchable ? 'ready' : ''}`}>{app?.isLaunchable && <Check size={12} />}{status}</span></div>
        <p className="official-software-description">{product.details}</p>
        {app && <div className="verified-package"><Monitor size={13} /><span>{app.displayName}<code>{app.packageName || app.executablePath}</code></span><small>{app.versionName || check?.versionName || 'Version unavailable'}</small></div>}
        <div className="software-actions">{app?.isLaunchable && <button className="primary-button" onClick={() => launchApp(app)}>Open real application<ArrowUpRight size={14} /></button>}
          <SoftwareSourceLink product={product} destination={product.id === 'metaeditor' ? 'publisher' : 'install'} className={app?.isLaunchable ? 'secondary-button' : 'primary-button'}>{product.id === 'metaeditor' ? 'Official MetaEditor information' : check?.state === 'INSTALLED' ? 'Update / open Play Store' : 'Install from Google Play'}<ExternalLink size={13} /></SoftwareSourceLink>
          {app && product.androidPackage && <button className="secondary-button" onClick={() => { setManage({ product, app }); setUnderstood(false); setError(''); }}><Wrench size={14} />Repair / reinstall</button>}
          {app && <button className="secondary-button" onClick={() => toggleShortcut(app)}><Monitor size={14} />{shortcutIds.includes(app.id) ? 'Remove shortcut' : 'Add desktop shortcut'}</button>}
          {app && <button className="text-button" onClick={() => toggleTaskbarPin(app)}>{taskbarPinIds.includes(app.id) ? 'Unpin from taskbar' : 'Pin to taskbar'}</button>}
        </div>
        <div className="official-software-support"><Info size={14} /><p>{product.support}</p></div>
        <SoftwareSourceLink product={product} destination="guide" className="text-button">{product.id === 'deriv-mt5' ? 'Deriv account & platform setup' : 'Official installation help'}<ArrowRight size={12} /></SoftwareSourceLink>
        {product.id === 'metaeditor' && !app && <button className="text-button software-runtime-link" onClick={() => openSystem('settings', { tab: 'runtime' })}>Check actual runtime capability<ArrowRight size={12} /></button>}
      </section>;
    })}</div>
    <p className="software-catalog-disclaimer">WIN12 does not collect broker credentials, execute trades, or provide a substitute for these products. Full functionality is provided only by the actual supported installation. Store availability and device requirements apply.</p>
    <AnimatePresence>{manage && <Modal title={`Repair or reinstall ${manage.product.name}`} onClose={() => setManage(null)} wide actions={<><button className="secondary-button" onClick={() => setManage(null)}>Close</button>{manage.app.capabilities?.uninstall && <button className="danger-button" disabled={!understood} onClick={askRemoval}><Trash2 size={14} />Ask Android to uninstall</button>}</>}><p>Try updating the app or reviewing its Android settings first. Reinstalling can remove local data, saved sessions, charts, or settings. Save anything important and ensure you can sign in again.</p><div className="maintenance-actions"><SoftwareSourceLink product={manage.product}>Open official update page<ExternalLink size={13} /></SoftwareSourceLink>{manage.app.capabilities?.appSettings && <button className="secondary-button" onClick={() => { const response = operation('openApplicationSettings', manage.app.id); if (!response.success) setError(response.message || 'Android app settings could not be opened.'); }}>Android app settings<ArrowUpRight size={13} /></button>}</div>{manage.app.capabilities?.uninstall ? <label className="maintenance-consent"><input type="checkbox" checked={understood} onChange={event => setUnderstood(event.target.checked)} />I understand that uninstalling can delete this application's local data. Android will ask for confirmation.</label> : <div className="information-note"><CircleHelp size={17} /><p>This app cannot be removed through the available mechanism. For preinstalled Chrome, Android may offer uninstall updates or enable/disable in system settings. WIN12 does not bypass those restrictions.</p></div>}{error && <p className="form-error">{error}</p>}</Modal>}</AnimatePresence>
  </div>;
}

export function SoftwareCenterApp({ win: _win }: { win: DesktopWindow }) {
  const registry = useRegistry();
  const { showToast } = useDesktop();
  return <div className="software-center-page"><header className="software-center-header"><div><p className="software-eyebrow">WIN12 SOFTWARE CENTER</p><h1>The real tools you rely on.</h1><p>Chrome, Deriv MT5, and MetaEditor. Verified availability and official setup.</p></div><button className="secondary-button" disabled={registry.status === 'DISCOVERING'} onClick={() => { const result = refreshRegistry(); if (!result.success) showToast('Native discovery unavailable', result.message || 'Use WIN12 on Android to check installed software.'); }}>{registry.status === 'DISCOVERING' ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}Check device</button></header><SoftwareCatalog /></div>;
}