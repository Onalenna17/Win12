import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, FileText, LayoutGrid, Moon, Save, Settings2, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { useClock } from '../lib/shell';
import { FS, getState, saveState, type FileItem } from '../lib/desktop';
import { IconButton, Toggle } from './Shared';

export function Widgets() {
  const { closeFlyouts, openSystem, openFile, setPanel, preferences, updatePreferences, revision } = useDesktop();
  const now = useClock();
  const [note, setNote] = useState(() => { const value = getState<unknown>('widgets.scratchpad', ''); return typeof value === 'string' ? value : ''; });
  const [saved, setSaved] = useState(true);
  const recent = useMemo(() => getState<string[]>('recentFiles', []).map(path => FS.find(path)).filter((file): file is FileItem => Boolean(file && !file.originalPath)).slice(0, 3), [revision]);
  return <motion.aside className="widgets-panel acrylic shell-panel" role="dialog" aria-label="Desktop widgets" initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ type: 'spring', stiffness: 410, damping: 34 }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <header className="utility-panel-header"><span><LayoutGrid size={17} />Widgets</span><IconButton title="Close widgets" onClick={closeFlyouts}><X size={16} /></IconButton></header>
    <div className="widgets-content"><div className="widget-today"><p>{now.toLocaleDateString(undefined, { weekday: 'long' })}</p><h2>{now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</h2><button className="text-button" onClick={() => setPanel('calendar')}><CalendarDays size={14} />Open calendar<ArrowRight size={12} /></button></div>
      <section className="scratchpad-widget"><div className="widget-section-heading"><h3>Something to remember</h3><FileText size={15} /></div><label className="sr-only" htmlFor="widget-scratchpad">Personal scratchpad</label><textarea id="widget-scratchpad" value={note} maxLength={6000} onChange={event => { setNote(event.target.value); setSaved(saveState({ 'widgets.scratchpad': event.target.value })); }} placeholder="An idea, a thought, a little reminder..." /><div className="scratchpad-status" role="status"><Save size={11} />{saved ? 'Saved on this device' : 'Not saved. Storage may be full.'}<span>{note.length}/6000</span></div></section>
      <section className="widget-focus"><Moon size={18} /><div><h3>A little room to focus</h3><p>Pause WIN12 toast notifications.</p></div><Toggle label="Pause WIN12 notifications" enabled={preferences.doNotDisturb} onChange={() => updatePreferences({ doNotDisturb: !preferences.doNotDisturb })} /></section>
      <section className="widget-recent"><div className="widget-section-heading"><h3>Recently opened</h3><button className="text-button" onClick={() => openSystem('explorer', { path: 'Home' })}>See files<ArrowRight size={12} /></button></div>{recent.length ? recent.map(file => <button className="widget-file" key={file.path} onClick={() => openFile(file)}><FileText size={18} /><span>{file.name}<small>{file.path}</small></span><ArrowRight size={13} /></button>) : <p className="widget-empty">Documents you open will appear here. No example files or activity are invented.</p>}</section>
    </div><footer className="action-center-footer"><span>Personal widgets / stored locally</span><IconButton title="Personalization settings" onClick={() => openSystem('settings', { tab: 'appearance' })}><Settings2 size={17} /></IconButton></footer>
  </motion.aside>;
}