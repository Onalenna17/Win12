import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Maximize2, Monitor, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { ColorIcon } from './Icons';
import { IconButton } from './Shared';

export function AltTabSwitcher() {
  const { windows, switcher, closeFlyouts, restoreWindow, selectSwitcherWindow } = useDesktop();
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); }, [switcher?.selected]);
  if (!switcher) return null;
  const ordered = switcher.ids.map(id => windows.find(win => win.id === id)).filter(win => win !== undefined);
  return <motion.div className="window-switcher-backdrop" role="dialog" aria-label="Switch WIN12 windows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={event => { if (event.target === event.currentTarget) closeFlyouts(); }}><motion.div className="window-switcher acrylic" initial={{ y: 10, scale: .98 }} animate={{ y: 0, scale: 1 }}><header><span>Switch windows</span><small>{switcher.releaseToCommit ? 'Release Alt to switch' : 'Arrow keys to choose / Enter to open'}</small><IconButton title="Close window switcher" onClick={closeFlyouts}><X size={15} /></IconButton></header><div className="window-switcher-list">{ordered.map(win => <button key={win.id} ref={win.id === switcher.selected ? selectedRef : undefined} className={win.id === switcher.selected ? 'selected' : ''} aria-pressed={win.id === switcher.selected} onFocus={() => selectSwitcherWindow(win.id)} onClick={() => restoreWindow(win.id)}><ColorIcon kind={win.icon} size={42} /><strong>{win.title}</strong><small>{win.minimized ? 'Minimized' : 'WIN12 window'}</small></button>)}</div><footer>External Android applications use Android's task switcher.</footer></motion.div></motion.div>;
}
export function TaskView() {
  const { windows, restoreWindow, closeWindow, minimizeAllWindows, closeFlyouts } = useDesktop();
  return <motion.div className="task-view-overlay" role="dialog" aria-label="Task view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><IconButton title="Close task view" className="task-view-close" onClick={closeFlyouts}><X size={20} /></IconButton><div className="task-view-heading"><h1>A little room to focus.</h1><p>Your real WIN12 windows, together in one view.</p></div><div className="task-view-windows">{windows.length ? windows.map(win => <div className="task-view-window acrylic" key={win.id}><header><ColorIcon kind={win.icon} size={20} /><span>{win.title}</span><IconButton title={`Close ${win.title}`} onClick={() => closeWindow(win.id)}><X size={14} /></IconButton></header><button onClick={() => restoreWindow(win.id)}><ColorIcon kind={win.icon} size={62} /><span>{win.minimized ? 'Minimized' : 'Embedded WIN12 application'}</span><Maximize2 size={16} /></button></div>) : <div className="task-view-empty"><Monitor size={45} /><p>No open WIN12 windows.</p></div>}</div><button className="task-view-desktop" onClick={minimizeAllWindows}><Monitor size={18} />Desktop 1<Check size={15} /></button></motion.div>;
}