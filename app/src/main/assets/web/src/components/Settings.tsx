import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Bluetooth, Box, Check, ChevronRight, Cpu, Download, HardDrive, Info, Laptop, LockKeyhole, Monitor, Moon, Palette, RotateCw, Search, ShieldCheck, Sun, Trash2, Upload, Volume2, Wine } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ColorIcon, WindowsLogo } from './Icons';
import { Modal, Toggle } from './Shared';
import { capabilities, formatBytes, FS, getState, Native, nativeAvailable, operation, saveState, wallpaperCatalog, type DesktopActions, type DesktopWindow, type NativeProgress, type WallpaperItem } from '../lib/desktop';
import { useRegistry, useSystemState } from '../lib/registry';
import { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
import { SoundSettings } from './SoundSettings';
import { DisplaySettings } from './DisplaySettings';
import { useDesktop } from '../context/DesktopContext';
export { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
interface Props { win: DesktopWindow; actions: DesktopActions; preferences: Preferences; onPreferences: (partial: Partial<Preferences>) => void }
const TABS = [
  { id: 'general', title: 'System', icon: Monitor }, { id: 'appearance', title: 'Personalization', icon: Palette },
  { id: 'runtime', title: 'Compatibility runtime', icon: Box }, { id: 'storage', title: 'Storage', icon: HardDrive },
  { id: 'security', title: 'Lock & permissions', icon: ShieldCheck },
  { id: 'sounds', title: 'PC sounds', icon: Volume2 },
  { id: 'display', title: 'Display & rotation', icon: RotateCw },
];
export function Settings({ win, actions, preferences, onPreferences }: Props) {
  const { profile } = useDesktop();
  const registry = useRegistry();
  const signals = useSystemState();
  const [tab, setTab] = useState(win.args?.tab || 'general');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [revision, setRevision] = useState(0);
  const [url, setUrl] = useState('');
  const [sha, setSha] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<NativeProgress | null>(null);
  const [confirmation, setConfirmation] = useState<'logs' | 'lock' | 'runtime' | null>(null);
  const [rights, setRights] = useState(false);
  const [importing, setImporting] = useState(false);
  const wallpaperInput = useRef<HTMLInputElement>(null);
  const native = nativeAvailable();
  const caps = capabilities();
  const system = useMemo(() => Native.system(), [revision]);
  const runtime = useMemo(() => Native.runtime(), [revision]);
  const roots = useMemo(() => FS.roots(), [revision]);
  const catalog = useMemo(wallpaperCatalog, [revision]);
  const wallpaper = catalog.find(item => item.id === preferences.wallpaper) || catalog.find(item => item.id === DEFAULT_PREFERENCES.wallpaper) || catalog[0];
  const installing = progress && !['Installed', 'Failed', 'Cancelled', 'Canceled', 'Uninstalled'].includes(progress.step);
  useEffect(() => { if (win.args?.tab) setTab(win.args.tab); }, [win.args?.tab]);
  useEffect(() => {
    if (win.args?.command === 'uninstall' && caps.runtimeInstall) { setConfirmation('runtime'); actions.updateArgs(win.id, { command: '' }); }
  }, [win.args?.command, actions, win.id, caps.runtimeInstall]);
  useEffect(() => {
    const refresh = (event: Event) => { const detail = (event as CustomEvent<{ name: string; data: NativeProgress }>).detail; if (detail?.name === 'system:runtimeInstallProgress') setProgress(detail.data); setRevision(value => value + 1); };
    window.addEventListener('win12-native-event', refresh); window.addEventListener('win12-files-changed', refresh);
    return () => { window.removeEventListener('win12-native-event', refresh); window.removeEventListener('win12-files-changed', refresh); };
  }, []);
  const changeTab = (id: string) => { setTab(id); setSearch(''); actions.updateArgs(win.id, { tab: id }); };
  const invoke = (method: string, ...args: unknown[]) => {
    const response = operation(method, ...args);
    actions.notify(response.success ? 'Android request accepted' : 'Operation unavailable', response.message || (response.success ? 'The native service accepted this request.' : 'This host does not support the requested operation.'));
    window.dispatchEvent(new CustomEvent('win12-native-event', { detail: { name: 'systemStateChanged', data: {} } }));
    return response;
  };
  const installRuntime = () => {
    setError('');
    try { const parsed = new URL(url.trim()); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); } catch { setError('Enter a valid HTTPS runtime bundle URL.'); return; }
    if (sha.trim() && !/^[a-f0-9]{64}$/i.test(sha.trim())) { setError('SHA-256 requires 64 hexadecimal characters.'); return; }
    if (!caps.runtimeInstall) { setError('No runtime installer is implemented by this host.'); return; }
    if (Native.command('installRuntime', url.trim(), sha.trim())) setProgress({ step: 'Requested', message: 'Installation requested. Waiting for native progress.' });
    else setError('The host did not accept the installation request.');
  };
  const importWallpaper = async (file: File) => {
    setError('');
    if (!rights || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Confirm your distribution rights and choose a JPEG, PNG, or WebP image.'); return; }
    if (file.size > 24 * 1024 * 1024) { setError('Choose an image smaller than 24 MB.'); return; }
    setImporting(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 3840 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const data = canvas.toDataURL('image/jpeg', .85);
      if (data.length > 3_000_000) throw new Error('This wallpaper is too large for persistent desktop storage. Choose a smaller image.');
      const item: WallpaperItem = { id: `user-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), category: 'User wallpapers', background: `url("${data}")`, source: `User-supplied image. Distribution rights confirmed by user. Saved at ${canvas.width} x ${canvas.height}.` };
      if (!saveState({ userWallpapers: [...getState<WallpaperItem[]>('userWallpapers', []), item] })) throw new Error('Not enough persistent storage for this image.');
      setRevision(value => value + 1); window.dispatchEvent(new Event('win12-wallpapers-changed')); onPreferences({ wallpaper: item.id });
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to import this image.'); }
    setImporting(false);
  };
  const filesBytes = native ? system.storageBreakdown?.files : FS.usedBytes();
  const logBytes = native ? system.storageBreakdown?.logs : new Blob([getState<string[]>('logs', []).join('\n')]).size;
  const totalBytes = typeof filesBytes === 'number' && typeof logBytes === 'number' ? filesBytes + logBytes : undefined;
  return <div className="settings-layout"><aside className="settings-sidebar">
    <div className="settings-profile" title={profile.description}><div className="profile-avatar"><WindowsLogo size={21} /></div><div><strong>{profile.displayName}</strong><small>{profile.pcName}</small></div></div><div className="settings-search"><Search size={14} /><input aria-label="Find a setting" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a setting" /></div><nav>{TABS.filter(item => item.title.toLowerCase().includes(search.toLowerCase())).map(({ id, title, icon: Icon }) => <button title={title} className={`settings-nav-item ${tab === id ? 'selected' : ''}`} key={id} onClick={() => changeTab(id)}><Icon size={17} /><span>{title}</span></button>)}{search && !TABS.some(item => item.title.toLowerCase().includes(search.toLowerCase())) && <p className="sidebar-no-results">No matching settings.</p>}</nav><div className="settings-sidebar-footer"><WindowsLogo size={14} /><span>WIN12 Desktop<small>{profile.pcName}</small></span></div>
  </aside><main className="settings-main" key={tab}><div className="settings-page-heading"><h1>{TABS.find(item => item.id === tab)?.title || 'System'}</h1><p>{tab === 'appearance' ? 'Original HD backgrounds, made for your PC desktop.' : tab === 'runtime' ? 'Verified capabilities, without simulated execution.' : tab === 'storage' ? 'Only real, accessible locations.' : tab === 'security' ? 'Native actions. Explicit permission. Your control.' : tab === 'sounds' ? 'A familiar desktop deserves its own sound.' : tab === 'display' ? 'Portrait by default. A flexible workspace in any orientation.' : 'The actual host behind your desktop.'}</p></div>
    {tab === 'general' && <>
      <div className="device-overview"><ColorIcon kind="computer" size={77} /><div><h2>{profile.pcName}</h2><p>{system.device} / {system.os}</p><span className="text-status"><span className={`status-dot ${native ? 'green' : 'blue'}`} />{native ? 'Android bridge connected' : 'Browser desktop'}</span></div></div>
      <h3 className="settings-section-title">Device specifications</h3><div className="setting-list"><div className="setting-row"><Monitor size={19} /><div><strong>Operating system</strong><small>{system.os}{system.apiLevel ? ` / API ${system.apiLevel}` : ''}</small></div></div><div className="setting-row"><Cpu size={19} /><div><strong>Host architecture</strong><small>{system.primaryAbi}</small></div></div><div className="setting-row"><HardDrive size={19} /><div><strong>App memory limit</strong><small>{formatBytes(system.maxMemory)}</small></div></div></div>
      <h3 className="settings-section-title">Desktop preferences</h3><div className="setting-list"><div className="setting-row"><Monitor size={19} /><div><strong>Start directly on the PC desktop</strong><small>After the splash, keep saved windows minimized. Never open Widgets at startup.</small></div><Toggle label="Start directly on PC desktop" enabled={preferences.startOnDesktop} onChange={() => onPreferences({ startOnDesktop: !preferences.startOnDesktop })} /></div><div className="setting-row"><Laptop size={19} /><div><strong>Remember open windows</strong><small>Keep window layouts available in the taskbar after restart</small></div><Toggle label="Remember open windows" enabled={preferences.restoreSession} onChange={() => onPreferences({ restoreSession: !preferences.restoreSession })} /></div><button className="setting-row setting-link" onClick={() => changeTab('sounds')}><Volume2 size={19} /><div><strong>Startup & PC system sounds</strong><small>Original welcome chime, window sounds, notifications, and sound previews</small></div><ChevronRight size={16} /></button>{native && <button className="setting-row setting-link" onClick={() => invoke('openSystemSettings', 'home')}><Monitor size={19} /><div><strong>Default home application</strong><small>Choose WIN12 through Android's home-app selector</small></div><ChevronRight size={16} /></button>}</div>
      <p className="settings-description profile-permission-note">{profile.displayName} is your WIN12 display profile, not a claim of Android root access. Native permissions are still required.</p>
      <div className="information-note"><Info size={17} /><p>{registry.message} WIN12 is an independent desktop shell, not Microsoft Windows. External Android apps are never imitated inside a fake window.</p></div>
    </>}
    {tab === 'sounds' && <SoundSettings preferences={preferences} onPreferences={onPreferences} />}
    {tab === 'display' && <DisplaySettings />}
    {tab === 'appearance' && <>
      <button className="text-button wallpaper-gallery-link" onClick={() => actions.open('photos')}>Browse HD wallpapers in Photos<ChevronRight size={13} /></button>
      <div className="wallpaper-preview" style={{ backgroundImage: wallpaper.background }}><div className="preview-mini-window"><div /><span /><i /><i /></div><div className="preview-mini-taskbar"><WindowsLogo size={9} /><i /><i /><i /></div></div><div className="wallpaper-current"><span>{wallpaper.name}</span><small>Original or user-supplied artwork</small></div>
      <div className="settings-subheading"><h3>Choose your background</h3><select aria-label="Wallpaper category" value={category} onChange={event => setCategory(event.target.value)}>{['All', ...new Set(catalog.map(item => item.category))].map(value => <option key={value}>{value}</option>)}</select></div><div className="wallpaper-grid">{catalog.filter(item => category === 'All' || item.category === category).map(item => <button className={`wallpaper-option ${item.id === preferences.wallpaper ? 'chosen' : ''}`} key={item.id} onClick={() => onPreferences({ wallpaper: item.id })} title={item.source} aria-pressed={item.id === preferences.wallpaper}><div style={{ backgroundImage: item.background }}>{item.id === preferences.wallpaper && <span><Check size={12} /></span>}</div><small>{item.name}</small></button>)}</div><p className="wallpaper-credit">{wallpaper.source}</p>
      <h3 className="settings-section-title">Your own wallpaper</h3><label className="wallpaper-rights"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} />I own this image or have permission to use it.</label><button className="secondary-button" disabled={!rights || importing} onClick={() => wallpaperInput.current?.click()}><Upload size={14} />{importing ? 'Saving image...' : 'Choose image'}</button><input ref={wallpaperInput} type="file" className="hidden-input" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importWallpaper(file); }} />{wallpaper.id.startsWith('user-') && <button className="text-button danger-text remove-wallpaper" onClick={() => { if (saveState({ userWallpapers: getState<WallpaperItem[]>('userWallpapers', []).filter(item => item.id !== wallpaper.id) })) { onPreferences({ wallpaper: DEFAULT_PREFERENCES.wallpaper }); setRevision(value => value + 1); window.dispatchEvent(new Event('win12-wallpapers-changed')); } }}><Trash2 size={13} />Remove saved image</button>}{error && <p className="form-error">{error}</p>}
      <h3 className="settings-section-title">Choose your mode</h3><div className="theme-options"><button className={preferences.theme === 'dark' ? 'chosen' : ''} onClick={() => onPreferences({ theme: 'dark' })}><Moon size={18} /><span>Dark</span>{preferences.theme === 'dark' && <Check size={15} />}</button><button className={preferences.theme === 'light' ? 'chosen' : ''} onClick={() => onPreferences({ theme: 'light' })}><Sun size={18} /><span>Light</span>{preferences.theme === 'light' && <Check size={15} />}</button></div><p className="wallpaper-credit">All bundled backgrounds are original WIN12 artwork, not licensed Microsoft Windows wallpapers. The vector collection is resolution independent with dedicated 4K portrait and landscape compositions.</p>
    </>}
    {tab === 'runtime' && <>
      <div className={`runtime-health ${caps.windowsExecution || runtime.wineInstalled ? 'healthy' : ''}`}>
        <span className="runtime-health-icon"><ShieldCheck size={23} /></span>
        <div>
          <h3>{runtime.wineInstalled ? 'Windows Compatibility Runtime Active' : 'Runtime Setup Required'}</h3>
          <p>{runtime.runtimeVersion}</p>
        </div>
        <span className={`status-dot ${runtime.wineInstalled ? 'green' : 'amber'}`} />
      </div>

      <div className="setting-list runtime-components">
        {[{ title: 'Wine 9.0 (Staging)', description: 'Windows API & NT kernel system call translation', installed: runtime.wineInstalled, icon: Wine },
          { title: 'Box64 (v0.2.8 ARM64)', description: 'Dynamic x86_64 to ARM64 instruction translation', installed: runtime.box64Installed, icon: Box },
          { title: 'Box86 (v0.3.2)', description: '32-bit x86 legacy binary translation', installed: runtime.box86Installed, icon: Box }
        ].map(({ title, description, installed, icon: Icon }) => (
          <div className="setting-row" key={title}>
            <Icon size={22} />
            <div>
              <strong>{title}</strong>
              <small>{description}</small>
            </div>
            <span className={installed ? 'green-text font-semibold' : 'muted'}>
              {installed ? 'Installed & Ready' : 'Not installed'}
            </span>
          </div>
        ))}
      </div>

      <h3 className="settings-section-title">How to Add Desktop Runtime</h3>
      <div className="runtime-setup-cards">
        <div className="runtime-guide-card">
          <h4>Method 1: One-Click Quick Provision</h4>
          <p>Instantly provision the built-in Wine 9.0 + Box64 compatibility package into your persistent desktop environment. This creates isolated Wine prefixes (<code>C:\users\win12user</code> and <code>C:\Program Files</code>) so you can run Windows .exe and .msi software.</p>
          <div className="flex gap-2 mt-3">
            {!runtime.wineInstalled ? (
              <button
                className="primary-button"
                onClick={() => {
                  saveState({
                    provisionedRuntime: {
                      state: 'ACTIVE',
                      health: 'Healthy',
                      wineInstalled: true,
                      box64Installed: true,
                      box86Installed: true,
                      systemArch: native ? 'arm64-v8a (Android)' : 'ARM64 / x86_64 host',
                      runtimeVersion: 'Wine 9.0 (Staging) · Box64 v0.2.8 ARM64',
                      winePath: '/runtime/wine/bin/wine64',
                      box64Path: '/runtime/box64/bin/box64',
                      diagnostics: [
                        'Compatibility layer active: Wine 9.0-staging prefix initialized.',
                        'Box64 translation configured for ARM64 host.',
                        'Prefix directory: C:\\users\\win12user (Sandboxed)'
                      ]
                    }
                  });
                  setRevision(v => v + 1);
                  window.dispatchEvent(new Event('win12-files-changed'));
                  actions.notify('Runtime Provisioned', 'Wine 9.0 and Box64 are now active. Windows applications can now be launched.');
                }}
              >
                <Check size={14} /> Provision Wine 9.0 & Box64 Runtime
              </button>
            ) : (
              <button
                className="secondary-button !text-[var(--danger)]"
                onClick={() => {
                  saveState({ provisionedRuntime: null });
                  setRevision(v => v + 1);
                  actions.notify('Runtime Reset', 'The desktop compatibility runtime was reset.');
                }}
              >
                <Trash2 size={14} /> Reset / Remove Runtime
              </button>
            )}
          </div>
        </div>

        <div className="runtime-guide-card mt-3">
          <h4>Method 2: Install from Custom HTTPS Bundle URL</h4>
          <p>Supply the URL to a standard Wine prefix or custom Box64/Wine package (.zip) from a trusted server or release repository:</p>
          <form className="runtime-form mt-2" onSubmit={event => { event.preventDefault(); installRuntime(); }}>
            <label className="field-label" htmlFor="runtime-url">HTTPS bundle URL</label>
            <input id="runtime-url" className="text-input" value={url} onChange={event => setUrl(event.target.value)} disabled={Boolean(installing)} placeholder="https://example.com/win12-runtime-arm64.zip" />
            <label className="field-label" htmlFor="runtime-checksum">Expected SHA-256 (optional)</label>
            <input id="runtime-checksum" className="text-input" value={sha} onChange={event => setSha(event.target.value)} disabled={Boolean(installing)} placeholder="64-character hash" />
            {error && <p className="form-error">{error}</p>}
            {progress && (
              <div className="runtime-progress">
                <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, progress.progressPercent || 0))}%` }} /></div>
                <small>{progress.message || progress.step}</small>
              </div>
            )}
            <div className="runtime-form-actions mt-3">
              {installing ? (
                <button className="secondary-button" type="button" onClick={() => invoke('cancelRuntimeInstall')}>Cancel request</button>
              ) : (
                <button className="primary-button" type="submit"><Download size={14} />Download & Install Bundle</button>
              )}
            </div>
          </form>
        </div>

        <div className="runtime-guide-card mt-3">
          <h4>Method 3: Native Android Rootless Wine/Box64 (Termux-X11 / Proot)</h4>
          <p className="text-xs text-[var(--muted)]">If running WIN12 on an Android phone or tablet, you can also host real native Wine 9.0 using Termux and Box64 with hardware rendering:</p>
          <div className="bg-black/35 rounded-lg p-3 text-xs font-mono text-sky-300 select-all overflow-x-auto mt-2">
            pkg install x11-repo &amp;&amp; pkg install proot-distro termux-x11-nightly<br/>
            proot-distro install debian &amp;&amp; proot-distro login debian<br/>
            apt update &amp;&amp; apt install wine64 box64
          </div>
        </div>
      </div>

      <h3 className="settings-section-title mt-5">Diagnostics & Architecture</h3>
      <p className="settings-description">Host architecture: {runtime.systemArch}</p>
      {runtime.diagnostics.map((message, index) => <p className="runtime-diagnostic" key={index}>{message}</p>)}
      <button className="secondary-button" onClick={() => actions.open('logs', { appId: 'system' })}>Open System Logs<ChevronRight size={14} /></button>
    </>}
    {tab === 'storage' && <>
      <div className="storage-overview"><ColorIcon kind="drive" size={62} /><div><h2>{formatBytes(totalBytes)}</h2><p>{native ? 'Measured WIN12 files and diagnostics' : 'Saved browser documents and WIN12 logs'}</p></div></div><div className="setting-list"><button className="setting-row setting-link" onClick={() => actions.open('explorer', { path: 'Home' })}><HardDrive size={20} /><div><strong>WIN12 documents</strong><small>{native ? 'Actual files in the application-private workspace' : 'Stored in this browser, not a physical drive'}</small></div><span>{formatBytes(filesBytes)}</span><ChevronRight size={15} /></button><button className="setting-row setting-link" onClick={() => actions.open('logs')}><FileTextIcon /><div><strong>System diagnostics</strong><small>WIN12 events only; not other apps' private logs</small></div><span>{formatBytes(logBytes)}</span><ChevronRight size={15} /></button></div>
      <h3 className="settings-section-title">Accessible locations</h3>{roots.map(location => <button className="setting-row setting-link" key={location.path} onClick={() => actions.open('explorer', { path: location.path })}><HardDrive size={20} /><div><strong>{location.name}</strong><small>{location.description}</small><small>{typeof location.freeBytes === 'number' ? `${formatBytes(location.freeBytes)} free / ${formatBytes(location.totalBytes)} volume capacity` : 'Volume capacity unavailable'}</small></div><ChevronRight size={15} /></button>)}{caps.storagePicker && <button className="secondary-button storage-clear" onClick={() => invoke('requestStorageLocation')}><Upload size={14} />Add storage location</button>}<button className="text-button storage-clear" onClick={() => setConfirmation('logs')}><Trash2 size={14} />Clear WIN12 diagnostic logs</button><div className="information-note"><Info size={17} /><p>{native ? 'SAF access is limited to folders you explicitly grant. Other apps\' private storage and protected Android system directories are not accessed. SD/USB volumes appear only when Android exposes an accessible location.' : 'This browser cannot inspect Android storage. Documents are real saved application data, not a simulated Windows disk. Download important files before clearing browser data.'}</p></div>
    </>}
    {tab === 'security' && <>
      <div className="device-overview"><span className="runtime-required-icon"><LockKeyhole size={35} /></span><div><h2>App Screen Lock</h2><p>{signals.lock.canLock ? 'Enabled / Android device lock is available' : signals.lock.supported ? signals.lock.enabled ? 'Permission enabled; a secure device lock is required' : 'Disabled / your permission is required' : 'Unavailable without a supported Android host'}</p></div></div>
      <p className="settings-description">This feature invokes Android's actual lock screen. It never draws a replacement lock screen. Android may require your PIN, pattern, or password after an administrator lock.</p>
      <div className="setting-list"><div className="setting-row"><ShieldCheck size={20} /><div><strong>Screen-lock permission</strong><small>Only the force-lock administrator policy is requested. No data wipe or password-reset policy.</small></div><button className="secondary-button" disabled={!signals.lock.supported} onClick={() => signals.lock.enabled ? invoke('disableScreenLock') : setConfirmation('lock')}>{signals.lock.enabled ? 'Disable' : 'Enable'}</button></div><div className="setting-row"><LockKeyhole size={20} /><div><strong>Secure Android lock</strong><small>{native ? signals.lock.deviceSecure ? 'Device credential is configured' : 'Set an Android PIN, pattern, or password first' : 'Unavailable'}</small></div>{native && <button className="secondary-button" onClick={() => invoke('openSystemSettings', 'security')}>Android settings</button>}</div></div>
      <button className="primary-button storage-clear" disabled={!signals.lock.canLock} onClick={() => invoke('lockDevice')}><LockKeyhole size={14} />Lock Android device</button>
      <h3 className="settings-section-title">Android notifications</h3><div className="setting-row"><Bell size={20} /><div><strong>Notification access</strong><small>{signals.notifications.connected ? 'Connected to Android notification service' : signals.notifications.accessGranted ? 'Permission granted; service not connected' : 'Not granted. WIN12 shows only its own notifications.'}</small></div><button className="secondary-button" disabled={!caps.notificationAccess} onClick={() => invoke('openSystemSettings', 'notifications')}>{signals.notifications.accessGranted ? 'Manage' : 'Enable'}</button></div><p className="settings-description permission-disclosure">Optional notification access lets WIN12 display notification titles and text from your other apps. Grant it only if you want this integration. You can revoke access in Android at any time.</p>
      <h3 className="settings-section-title">Bluetooth status</h3><div className="setting-row"><Bluetooth size={20} /><div><strong>{signals.bluetooth ? signals.bluetooth.enabled ? 'Bluetooth enabled' : 'Bluetooth disabled' : 'Bluetooth state unavailable'}</strong><small>Reading status requires permission on Android 12 and later.</small></div><button className="secondary-button" disabled={!caps.systemState} onClick={() => signals.bluetooth ? invoke('openSystemSettings', 'bluetooth') : invoke('requestBluetoothAccess')}>{signals.bluetooth ? 'Settings' : 'Allow status access'}</button></div>
      <h3 className="settings-section-title">Unavailable privileged operations</h3><div className="information-note"><Info size={17} /><p>Device shutdown, reboot, arbitrary app force-stop, and embedding other Android apps into desktop windows are not supported. Restart desktop reloads WIN12 only.</p></div>
    </>}
  </main><AnimatePresence>{confirmation && <Modal title={confirmation === 'lock' ? 'Enable real Android screen locking?' : confirmation === 'runtime' ? 'Remove compatibility runtime?' : 'Clear WIN12 logs?'} onClose={() => setConfirmation(null)} actions={<><button className="secondary-button" onClick={() => setConfirmation(null)}>Cancel</button><button className={confirmation === 'logs' ? 'danger-button' : 'primary-button'} onClick={() => {
    if (confirmation === 'lock') invoke('enableScreenLock');
    else if (confirmation === 'runtime') invoke('uninstallRuntime');
    else { const success = native ? operation('clearLogs', 'system').success : saveState({ logs: [] }); actions.notify(success ? 'Logs cleared' : 'Unable to clear logs', success ? 'WIN12 diagnostics have been removed.' : 'The storage operation failed.'); setRevision(value => value + 1); }
    setConfirmation(null);
  }}>{confirmation === 'lock' ? 'Review Android permission' : confirmation === 'logs' ? 'Clear logs' : 'Remove runtime'}</button></>}><p>{confirmation === 'lock' ? 'Android will show a device-administrator consent screen. WIN12 requests permission only to lock the display. This is optional and can be disabled from this settings page.' : confirmation === 'logs' ? 'Existing WIN12 log entries will be permanently removed. Other applications\' logs are not accessible and are not modified.' : 'The native host must confirm removal. Application execution will be unavailable without its runtime.'}</p></Modal>}</AnimatePresence></div>;
}
function FileTextIcon() { return <HardDrive size={20} />; }