import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Accessibility, ArrowUpRight, Battery, BatteryCharging, Bell, BellOff, Bluetooth, ChevronDown, ChevronUp, Moon, Plane, RotateCw, Settings2, ShieldCheck, Sun, Volume2, VolumeX, Wifi, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { nativeAvailable } from '../lib/desktop';
import { IconButton } from './Shared';
import { WindowsLogo } from './Icons';
import { cn } from '../utils/cn';

export function ActionCenter() {
  const { system, preferences, updatePreferences, toggleTheme, openNativeSettings, openSystem, notifications, nativeNotifications, clearNotifications, dismissNotification, setSystemVolume, closeFlyouts } = useDesktop();
  const [showNotifications, setShowNotifications] = useState(false);
  const [batteryDetails, setBatteryDetails] = useState(false);
  const lastVolume = useRef(50);
  const native = nativeAvailable();
  const displayed = [...notifications, ...nativeNotifications].sort((a, b) => b.time - a.time);
  const volume = native ? system.volume?.percent ?? null : preferences.volume;
  const changeVolume = (value: number) => { if (native) setSystemVolume(value); else updatePreferences({ volume: value }); };
  const wifiOn = system.wifi?.enabled ?? null;
  const batteryLabel = system.battery ? `${system.battery.percent}%${system.battery.charging ? ' / charging' : ''}` : 'Unavailable';
  return <motion.aside className="action-center quick-center acrylic shell-panel" role="dialog" aria-label="Quick settings and notifications" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ type: 'spring', stiffness: 440, damping: 36 }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header className="quick-center-header"><div><h2>Quick settings</h2><p>A few things, just how you like them.</p></div><IconButton title="Close quick settings" onClick={closeFlyouts}><X size={16} /></IconButton></header>
    <div className="quick-center-content"><div className="quick-tile-grid">
      <Tile icon={<Wifi size={18} />} label="Wi-Fi" on={wifiOn} detail={!native ? 'Unavailable' : system.wifi ? system.wifi.connected ? 'Connected' : system.wifi.enabled ? 'On' : 'Off' : 'Open settings'} external disabled={!native} onClick={() => openNativeSettings('network')} />
      <Tile icon={<Bluetooth size={18} />} label="Bluetooth" on={system.bluetooth?.enabled ?? null} detail={system.bluetooth ? system.bluetooth.enabled ? 'On' : 'Off' : 'Unavailable'} external disabled={!native} onClick={() => openNativeSettings('bluetooth')} />
      <Tile icon={<Plane size={18} />} label="Airplane" on={system.airplaneMode ?? null} detail={typeof system.airplaneMode === 'boolean' ? system.airplaneMode ? 'On' : 'Off' : 'Unavailable'} external disabled={!native} onClick={() => openNativeSettings('airplane')} />
      <Tile icon={preferences.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} label="Theme" on={preferences.theme === 'light'} detail={preferences.theme === 'light' ? 'Light' : 'Dark'} onClick={toggleTheme} />
      <Tile icon={<Sun size={18} />} label="Night light" on={preferences.nightLight} detail="WIN12 display" onClick={() => updatePreferences({ nightLight: !preferences.nightLight })} />
      <Tile icon={<BellOff size={18} />} label="Focus" on={preferences.doNotDisturb} detail={preferences.doNotDisturb ? 'WIN12 alerts off' : 'WIN12 alerts on'} onClick={() => updatePreferences({ doNotDisturb: !preferences.doNotDisturb })} />
      <Tile icon={<Accessibility size={18} />} label="Accessibility" on={false} detail={native ? 'Android settings' : 'Unavailable'} external disabled={!native} onClick={() => openNativeSettings('accessibility')} />
      <Tile icon={system.battery?.charging ? <BatteryCharging size={19} /> : <Battery size={19} />} label="Battery" on={system.battery ? system.battery.charging : null} detail={batteryLabel} disabled={!system.battery && !native} onClick={() => native ? openNativeSettings('battery') : setBatteryDetails(value => !value)} external={native} />
      <Tile icon={<RotateCw size={18} />} label="Rotation" on={preferences.orientation === 'auto'} detail={preferences.orientation === 'auto' ? 'Auto rotate' : preferences.orientation === 'landscape' ? 'Landscape' : 'Portrait default'} onClick={() => openSystem('settings', { tab: 'display' })} />
    </div>
    {batteryDetails && <p className="quick-setting-note"><Battery size={14} />{system.battery ? `Your browser reports ${system.battery.percent}% battery${system.battery.charging ? ', connected to power' : ''}. Device battery controls are managed by your operating system.` : 'The browser does not expose battery state.'}</p>}
    <div className="quick-center-sliders"><Slider label={native ? 'Android media volume' : 'WIN12 sound volume'} value={volume} disabled={native && !system.volume?.canSet} onChange={changeVolume} icon={<button type="button" className="slider-icon-button" title={volume ? 'Mute' : 'Unmute'} aria-label={volume ? 'Mute sound' : 'Unmute sound'} disabled={native && !system.volume?.canSet} onClick={() => { if (volume && volume > 0) { lastVolume.current = volume; changeVolume(0); } else changeVolume(lastVolume.current); }}>{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>} />
      <Slider label="WIN12 brightness" value={preferences.brightness} min={25} onChange={value => updatePreferences({ brightness: value })} icon={<Sun size={18} />} />
    </div><p className="quick-center-scope">Brightness and Night light affect this desktop only. {native ? 'Radio controls open Android settings.' : 'Device radio controls are unavailable in the browser.'}</p></div>
    <section className="quick-center-notifications"><button className="quick-notifications-toggle" onClick={() => setShowNotifications(value => !value)} aria-expanded={showNotifications}><Bell size={15} /><span>Notifications</span><small>{displayed.length ? `${displayed.length} new` : 'All caught up'}</small>{showNotifications ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      {showNotifications && <div className="quick-notifications-body"><div className="notification-section-label"><span>{system.notifications.connected ? 'WIN12 & Android' : 'WIN12 notifications'}</span><button className="text-button" disabled={!notifications.length} onClick={clearNotifications}>Clear WIN12</button></div>{displayed.length ? <div className="notification-list">{displayed.map(item => <div className="notification-item" key={`${item.native ? 'native' : 'local'}:${item.id}`}><span className="notification-symbol">{item.native ? <Bell size={14} /> : <WindowsLogo size={14} />}</span><div><h3>{item.title}</h3><p>{item.message}</p><small>{item.native ? item.packageName : 'WIN12'} / {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>{(!item.native || item.dismissible) && <IconButton title="Dismiss notification" onClick={() => dismissNotification(item.id, item.native)}><X size={13} /></IconButton>}</div>)}</div> : <div className="notifications-empty"><BellOff size={25} strokeWidth={1.3} /><span>A little peace and quiet.</span><small>{system.notifications.connected ? 'No notifications from Android.' : 'Other apps require Android notification access.'}</small></div>}</div>}
    </section>
    <footer className="action-center-footer"><span><ShieldCheck size={13} />{native ? 'Android native services' : 'Browser desktop'}</span><IconButton title="Open Settings" onClick={() => openSystem('settings')}><Settings2 size={17} /></IconButton></footer>
  </motion.aside>;
}

function Tile({ icon, label, on, detail, onClick, disabled = false, external = false }: { icon: ReactNode; label: string; on: boolean | null; detail: string; onClick: () => void; disabled?: boolean; external?: boolean }) {
  return <button className={cn('quick-tile', on === true && 'on', on === null && 'unknown')} disabled={disabled} onClick={onClick} title={`${label}: ${detail}${external ? '. Opens Android settings.' : ''}`} aria-pressed={!external && on !== null ? on : undefined}>
    <span className="quick-tile-icon">{icon}{external && <ArrowUpRight size={11} />}</span><span className="quick-tile-label">{label}</span><small>{detail}</small>
  </button>;
}
function Slider({ label, icon, value, onChange, min = 0, disabled = false }: { label: string; icon: ReactNode; value: number | null; onChange: (value: number) => void; min?: number; disabled?: boolean }) {
  return <div className="quick-slider-group"><div className="quick-slider-title"><span>{label}</span><span>{value === null ? 'Unavailable' : `${value}%`}</span></div><label className="quick-slider"><span className="quick-slider-icon">{icon}</span><input type="range" min={min} max={100} step={1} value={value ?? min} disabled={disabled || value === null} aria-label={label} aria-valuetext={value === null ? 'Unavailable' : `${value}%`} onChange={event => onChange(Number(event.target.value))} style={{ '--range-value': `${value === null ? 0 : (value - min) / (100 - min) * 100}%` } as CSSProperties} /></label></div>;
}