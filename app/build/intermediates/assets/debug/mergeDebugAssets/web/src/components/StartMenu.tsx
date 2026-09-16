import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Folder, LockKeyhole, Monitor, Power, RefreshCw, Search, Settings2, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { ApplicationIcon, ColorIcon, WindowsLogo } from './Icons';
import { IconButton } from './Shared';
import { appSearch, appTypeLabel, fileIcon, FS, getState, type DesktopApp } from '../lib/desktop';


export function StartMenu() {
  const { profile, signOut, apps, pinned, registry, revision, launchApp, openSystem, openFile, openContextMenu, requestDialog, showDesktop, closeFlyouts } = useDesktop();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [power, setPower] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setTimeout(() => input.current?.focus(), 80); return () => clearTimeout(timer); }, []);
  const recent = getState<{ id: string; time: number }[]>('recentApps', []).map(item => apps.find(app => app.id === item.id)).filter((app): app is DesktopApp => Boolean(app)).slice(0, 4);
  const results = query.trim() ? apps.filter(app => appSearch(app, query)) : all ? [...apps].sort((a, b) => a.displayName.localeCompare(b.displayName)) : pinned;
  const files = useMemo(() => query.trim().length > 1 ? FS.search(query).slice(0, 4) : [], [query, revision]);
  const settings = [
    { label: 'Personalization', tab: 'appearance', terms: 'personalization wallpaper background appearance theme dark light colors' },
    { label: 'Compatibility runtime', tab: 'runtime', terms: 'runtime wine box64 compatibility windows' },
    { label: 'Storage', tab: 'storage', terms: 'storage disk space files permission folders' },
    { label: 'Lock & permissions', tab: 'security', terms: 'lock security screen android permissions bluetooth notifications' },
    { label: 'System settings', tab: 'general', terms: 'system specs sound device account startup about' },
    { label: 'PC sounds', tab: 'sounds', terms: 'sound sounds audio startup chime volume notifications' },
    { label: 'Display & rotation', tab: 'display', terms: 'orientation rotation rotate display portrait landscape screen' },
  ].filter(setting => query.trim() && setting.terms.includes(query.trim().toLowerCase()));
  const firstResult = () => { if (results[0]?.isLaunchable) launchApp(results[0]); else if (settings[0]) openSystem('settings', { tab: settings[0].tab }); else if (files[0]) openFile(files[0]); };
  return <motion.div ref={ref} className="start-menu start-menu-v2 acrylic shell-panel" role="dialog" aria-label="Start menu" initial={{ opacity: 0, y: 22, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .97 }} transition={{ type: 'spring', stiffness: 440, damping: 34 }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
    if (event.target === input.current) return;
    if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.start-app:not(:disabled), .start-search-result, .recommended-item') || [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
      if (index >= 0) { event.preventDefault(); buttons[(index + (backward ? -1 : 1) + buttons.length) % buttons.length]?.focus(); }
    }
  }}>
    <div className="start-menu-inner" onPointerDown={() => setPower(false)}>
      <div className="start-search"><Search size={17} /><input ref={input} id="start-search-input" aria-label="Search apps, settings, and documents" placeholder="Search apps, settings, and documents" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') firstResult(); if (event.key === 'ArrowDown') { event.preventDefault(); ref.current?.querySelector<HTMLButtonElement>('.start-app:not(:disabled), .start-search-result')?.focus(); } }} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</div>
      <div className="start-section-heading"><h2>{query ? 'Search results' : all ? 'All apps' : 'Pinned'}</h2>{!query && <button className="small-button" onClick={() => setAll(value => !value)}>{all && <ChevronLeft size={12} />}{all ? 'Back' : 'All apps'}{!all && <ChevronRight size={12} />}</button>}</div>
      <div className={`start-apps ${all || query ? 'list-mode' : 'grid-mode'}`}>{results.map(app => <button className="start-app" key={app.id} disabled={!app.isLaunchable} onClick={() => launchApp(app)} onContextMenu={event => { event.preventDefault(); openContextMenu(event.clientX, event.clientY, app); }} title={`${app.displayName} / ${appTypeLabel(app)}`}><ApplicationIcon app={app} size={all || query ? 30 : 36} /><span>{app.displayName}</span>{(all || query) && <><small>{appTypeLabel(app)}</small><ChevronRight size={12} /></>}</button>)}
        {!results.length && !files.length && !settings.length && <div className="start-empty"><Search size={28} /><strong>{query ? 'No registered app found' : 'A place for your favorites'}</strong><p>{query ? registry.status === 'READY' ? `No verified app matches "${query}".` : 'Android discovery is unavailable. Only real WIN12 apps and browser documents can be searched here.' : 'Right-click a real application and choose Pin to Start.'}</p><button className="text-button" onClick={() => openSystem('apps', { tab: query ? 'checks' : 'apps' })}>Open applications<ArrowRight size={12} /></button></div>}
        {query && settings.length > 0 && <><div className="search-group-label">Settings</div>{settings.map(setting => <button className="start-search-result" key={setting.tab} onClick={() => openSystem('settings', { tab: setting.tab })}><Settings2 size={17} /><span>{setting.label}</span><ChevronRight size={12} /></button>)}</>}
        {query && files.length > 0 && <><div className="search-group-label">Accessible documents</div>{files.map(file => <button className="start-search-result" key={file.path} onClick={() => openFile(file)}><ColorIcon kind={fileIcon(file)} size={28} /><span>{file.name}</span><ChevronRight size={12} /></button>)}</>}
      </div>
      {!query && !all && <section className="start-recommended"><div className="start-section-heading"><h2>Recommended</h2><span>{recent.length ? 'Pick up where you left off' : 'Make yourself at home'}</span></div><div className="recommended-grid">{recent.length ? recent.map(app => <button className="recommended-item" key={app.id} onClick={() => launchApp(app)} disabled={!app.isLaunchable}><ApplicationIcon app={app} size={29} /><span><strong>{app.displayName}</strong><small>{app.isSystemApp ? 'Recently opened' : 'Recent launch request'}</small></span></button>) : <><button className="recommended-item" onClick={() => openSystem('explorer', { path: 'Home' })}><ColorIcon kind="folder" size={32} /><span><strong>Your files, together</strong><small>Explore accessible documents</small></span></button><button className="recommended-item" onClick={() => openSystem('settings', { tab: 'appearance' })}><ColorIcon kind="settings" size={32} /><span><strong>Make it yours</strong><small>Choose your desktop background</small></span></button></>}</div></section>}
    </div>
    <footer className="start-footer"><button className="start-user" title={profile.description} onClick={() => openSystem('settings', { tab: 'general' })}><span className="small-profile"><WindowsLogo size={16} /></span><span>{profile.displayName}<small>{profile.pcName}</small></span></button><div className="start-footer-actions"><IconButton title="File Explorer" onClick={() => openSystem('explorer', { path: 'Home' })}><Folder size={17} /></IconButton><IconButton title="Settings" onClick={() => openSystem('settings')}><Settings2 size={17} /></IconButton><IconButton title="Sign out" onClick={() => signOut()}><LockKeyhole size={17} /></IconButton><div className="power-anchor"><IconButton title="Power options" onClick={() => setPower(value => !value)}><Power size={18} /></IconButton>{power && <div className="power-menu acrylic" role="menu" aria-label="Power options"><button role="menuitem" onClick={() => { closeFlyouts(); showDesktop(); }}><Monitor size={15} />Show desktop</button><button role="menuitem" onClick={() => requestDialog({ kind: 'lock' })}><LockKeyhole size={15} />Lock Android device</button><button role="menuitem" onClick={() => requestDialog({ kind: 'restart' })}><RefreshCw size={15} />Restart WIN12 desktop</button><div className="menu-divider" /><p className="power-menu-note">Sleep, shutdown, and Android reboot are not available. Restart reloads this desktop only.</p></div>}</div></div></footer>
  </motion.div>;
}