import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Copy, Minus, Square, X } from 'lucide-react';
import type { Bounds, DesktopWindow } from '../lib/desktop';
import { ColorIcon } from './Icons';
import { detectSnap, fitBounds, snapBounds, type SnapZone } from '../lib/shell';
import { RESIZE_DIRECTIONS, resizedBounds, type ResizeDirection } from '../lib/windowGeometry';
import { SnapLayouts } from './SnapLayouts';
export { detectSnap, snapBounds, type SnapZone } from '../lib/shell';
function fitRestore(bounds: Bounds): Bounds {
  return fitBounds(bounds);
}

interface Props {
  win: DesktopWindow;
  active: boolean;
  onFocus: () => void;
  onChange: (patch: Partial<DesktopWindow>) => void;
  onClose: () => void;
  onPreview: (zone: SnapZone | null) => void;
  children: ReactNode;
}

export function WindowFrame({ win, active, onFocus, onChange, onClose, onPreview, children }: Props) {
  const interaction = useRef<{ mode: 'drag' | ResizeDirection; pointerId: number; startX: number; startY: number; bounds: Bounds; snap: SnapZone | null } | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [snapMenu, setSnapMenu] = useState(false);
  const maximizeRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewRef = useRef(onPreview); previewRef.current = onPreview;
  useEffect(() => () => { clearTimeout(hoverTimer.current); if (interaction.current) previewRef.current(null); }, []);
  useEffect(() => { if (win.minimized || !active) { clearTimeout(hoverTimer.current); setSnapMenu(false); } }, [win.minimized, active]);
  const bounds: Bounds = { x: win.x, y: win.y, width: win.width, height: win.height };
  const maximize = () => {
    clearTimeout(hoverTimer.current);
    if (win.maximized) onChange({ ...fitRestore(win.previous || { x: 60, y: 60, width: 850, height: 560 }), maximized: false, snap: 'NONE' });
    else onChange({ ...snapBounds('FULL'), previous: win.snap === 'NONE' ? bounds : win.previous || bounds, maximized: true, snap: 'FULL' });
    setSnapMenu(false);
  };
  const snapTo = (type: string) => {
    clearTimeout(hoverTimer.current);
    const zone = snapBounds(type);
    onChange({ ...zone, previous: win.snap === 'NONE' ? bounds : win.previous, snap: zone.type, maximized: zone.type === 'FULL' });
    setSnapMenu(false);
  };
  const begin = (e: PointerEvent<HTMLElement>, mode: 'drag' | ResizeDirection) => {
    if (e.button !== 0 || interaction.current || (mode === 'drag' && (e.target as HTMLElement).closest('button, .pc-snap-layouts'))) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    let startBounds = bounds;
    if (mode === 'drag' && win.snap !== 'NONE') {
      const previous = fitRestore(win.previous || { x: 80, y: 60, width: Math.min(900, window.innerWidth - 40), height: 560 });
      startBounds = { ...previous, x: Math.max(0, e.clientX - previous.width / 2), y: Math.max(0, e.clientY - 22) };
      onChange({ ...startBounds, maximized: false, snap: 'NONE' });
    }
    interaction.current = { mode, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, bounds: startBounds, snap: null };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSnapMenu(false);
    setInteracting(true);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const state = interaction.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX, dy = e.clientY - state.startY;
    if (state.mode === 'drag') {
      onChange({ x: Math.max(-state.bounds.width + 100, Math.min(window.innerWidth - 100, state.bounds.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 125, state.bounds.y + dy)) });
      state.snap = detectSnap(e.clientX, e.clientY);
      onPreview(state.snap);
    } else {
      onChange({
        ...resizedBounds(state.bounds, state.mode, dx, dy, window.innerWidth, window.innerHeight - 84),
        maximized: false, snap: 'NONE',
      });
    }
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    const state = interaction.current;
    if (!state || state.pointerId !== e.pointerId) return;
    if (state.snap && e.type === 'pointerup') onChange({ ...state.snap, previous: state.bounds, snap: state.snap.type, maximized: state.snap.type === 'FULL' });
    interaction.current = null;
    setInteracting(false);
    onPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return <motion.section
    className={`desktop-window ${active ? 'active-window' : ''} ${win.maximized ? 'maximized' : ''} ${win.minimized ? 'minimized' : ''} ${interacting ? 'interacting' : ''} app-${win.kind}`}
    style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z, pointerEvents: win.minimized ? 'none' : 'auto' }}
    initial={{ opacity: 0, scale: .96, y: 16 }}
    animate={{ opacity: win.minimized ? 0 : 1, scale: win.minimized ? .92 : 1, y: win.minimized ? 70 : 0 }}
    exit={{ opacity: 0, scale: .96, y: 8 }}
    transition={{ type: 'spring', stiffness: 440, damping: 36 }}
    onPointerDownCapture={onFocus}
    onFocusCapture={onFocus}
    role="region" aria-label={`${win.title} window`} aria-hidden={win.minimized} inert={win.minimized}
  >
    <header className="window-header" onPointerDown={e => begin(e, 'drag')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onDoubleClick={e => { if (!(e.target as HTMLElement).closest('button, .pc-snap-layouts')) maximize(); }}>
      <div className="window-caption"><ColorIcon kind={win.icon} size={19} /><span>{win.title}</span></div>
      <div className="window-controls">
        <button title="Minimize" aria-label={`Minimize ${win.title}`} onClick={() => onChange({ minimized: true })}><Minus size={15} /></button>
        <div className="maximize-control" onPointerLeave={event => { if (event.pointerType === 'mouse') { clearTimeout(hoverTimer.current); setSnapMenu(false); } }}>
          <button ref={maximizeRef} title={win.maximized ? 'Restore down / right-click for snap layouts' : 'Maximize / right-click for snap layouts'} aria-label={`${win.maximized ? 'Restore' : 'Maximize'} ${win.title}`} aria-expanded={snapMenu} onClick={maximize} onContextMenu={event => { event.preventDefault(); setSnapMenu(value => !value); }} onPointerEnter={event => { if (event.pointerType === 'mouse') { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setSnapMenu(true), 350); } }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSnapMenu(true); requestAnimationFrame(() => maximizeRef.current?.parentElement?.querySelector<HTMLButtonElement>('.snap-layout-diagram button')?.focus()); } }}>{win.maximized ? <Copy size={12} /> : <Square size={12} />}</button>
          {snapMenu && <SnapLayouts onPick={snapTo} onClose={() => { setSnapMenu(false); maximizeRef.current?.focus(); }} />}
        </div>
        <button className="window-close" title="Close" aria-label={`Close ${win.title}`} onClick={onClose}><X size={16} /></button>
      </div>
    </header>
    <div className="window-content">{children}</div>
    {!win.maximized && RESIZE_DIRECTIONS.map(direction => <div key={direction} className={`window-resizer resizer-${direction}`} title={`Resize window (${direction})`} onPointerDown={event => begin(event, direction)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />)}
  </motion.section>;
}