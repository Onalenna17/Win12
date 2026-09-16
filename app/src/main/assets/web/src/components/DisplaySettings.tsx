import { Expand, Info, Monitor, RotateCw, Smartphone } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { nativeAvailable } from '../lib/desktop';
import type { OrientationPreference } from '../lib/preferences';

export function DisplaySettings() {
  const { orientation, preferences } = useDesktop();
  const modes: { id: OrientationPreference; name: string; description: string; icon: typeof Smartphone }[] = [
    { id: 'portrait', name: 'Portrait', description: 'Default for your Android desktop', icon: Smartphone },
    { id: 'landscape', name: 'Landscape', description: 'A wider PC workspace', icon: Monitor },
    { id: 'auto', name: 'Auto rotate', description: 'Follow the device sensor', icon: RotateCw },
  ];
  return <div className="display-settings"><div className="display-orientation-preview"><div className={`mini-display ${orientation.status.actual}`}><div /><span /><i /></div><div><h2>{orientation.status.actual === 'portrait' ? 'Portrait workspace' : orientation.status.actual === 'landscape' ? 'Landscape workspace' : 'Display orientation'}</h2><p>Current viewport / {innerWidth} x {innerHeight}</p></div></div><h3 className="settings-section-title">Screen orientation</h3><div className="orientation-options">{modes.map(({ id, name, description, icon: Icon }) => <button key={id} className={preferences.orientation === id ? 'chosen' : ''} disabled={orientation.busy} aria-pressed={preferences.orientation === id} onClick={() => void orientation.apply(id)}><Icon size={22} /><span><strong>{name}</strong><small>{description}</small></span><i /></button>)}</div><p className="orientation-status" role="status">{orientation.busy ? 'Applying orientation preference...' : orientation.status.message}</p>{!nativeAvailable() && <button className="secondary-button" disabled={!orientation.status.canRequest || orientation.busy} onClick={() => void orientation.apply(preferences.orientation, true)}><Expand size={15} />Fullscreen & apply</button>}<div className="information-note"><Info size={17} /><p>Portrait is the default on Android. The desktop remains responsive when the device rotates. Some large screens, multi-window modes, or browser policies override app orientation requests; WIN12 reports the actual layout rather than rotating the page artificially.</p></div></div>;
}