import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ApplicationIcon, ColorIcon } from './Icons';
import { fileIcon, getState, saveState, type DesktopApp, type FileItem, type IconKind } from '../lib/desktop';

interface DesktopTarget { id: string; label: string; app?: DesktopApp; file?: FileItem; icon?: IconKind; open: () => void }
interface Position { column: number; row: number }
interface Props {
  apps: DesktopApp[]; files: FileItem[]; running: Set<string>;
  openPC: () => void; launch: (app: DesktopApp) => void; openFile: (file: FileItem) => void;
  onContext: (x: number, y: number, app?: DesktopApp, file?: FileItem) => void;
}
export function DesktopIcons({ apps, files, running, openPC, launch, openFile, onContext }: Props) {
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
  const [positions, setPositions] = useState<Record<string, Position>>(() => getState('iconPositions.v2', {}));
  const [labels, setLabels] = useState<Record<string, string>>(() => getState('shortcutLabels', {}));
  const [selected, setSelected] = useState('this-pc');
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const gesture = useRef<{ id: string; x: number; y: number; start: Position; moved: boolean; longPress: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressed = useRef(false);
  const lastTap = useRef<{ id: string; time: number } | null>(null);
  useEffect(() => { const resize = () => setViewport({ width: innerWidth, height: innerHeight }); window.addEventListener('resize', resize); return () => { window.removeEventListener('resize', resize); if (gesture.current) clearTimeout(gesture.current.timer); }; }, []);
  useEffect(() => { const update = () => setLabels(getState('shortcutLabels', {})); window.addEventListener('win12-shortcuts-changed', update); return () => window.removeEventListener('win12-shortcuts-changed', update); }, []);
  useEffect(() => { if (selected !== 'this-pc' && !apps.some(app => app.id === selected) && !files.some(file => file.path === selected)) setSelected('this-pc'); }, [selected, apps, files]);
  const cellWidth = viewport.width <= 620 ? 82 : 94, cellHeight = viewport.height <= 690 ? 78 : 94;
  const rows = Math.max(1, Math.floor((viewport.height - 130) / cellHeight));
  const columns = Math.max(1, Math.floor((viewport.width - 36) / cellWidth));
  const targets: DesktopTarget[] = [
    { id: 'this-pc', label: 'This PC', icon: 'computer', open: openPC },
    ...apps.map(app => ({ id: app.id, label: labels[app.id] || app.displayName, app, open: () => launch(app) })),
    ...files.map(file => ({ id: file.path, label: file.name, file, icon: fileIcon(file), open: () => openFile(file) })),
  ];
  const slots = useMemo(() => {
    const used = new Set<string>(); const result: Record<string, Position> = {};
    for (const target of targets) {
      const value = positions[target.id];
      const saved = value && Number.isFinite(value.column) && Number.isFinite(value.row) ? value : undefined;
      let slot = saved ? { column: Math.min(columns - 1, Math.max(0, saved.column)), row: Math.min(rows - 1, Math.max(0, saved.row)) } : { column: 0, row: 0 };
      if (!saved || used.has(`${slot.column}:${slot.row}`)) {
        let index = 0;
        while (used.has(`${Math.floor(index / rows)}:${index % rows}`)) index++;
        slot = { column: Math.floor(index / rows), row: index % rows };
      }
      used.add(`${slot.column}:${slot.row}`); result[target.id] = slot;
    }
    return result;
  }, [positions, rows, columns, apps, files]);
  const choose = (id: string) => { setSelected(id); buttons.current.get(id)?.focus(); };
  const begin = (event: ReactPointerEvent<HTMLButtonElement>, target: DesktopTarget) => {
    if (event.button !== 0) return;
    const slot = slots[target.id];
    suppressed.current = false;
    const timer = setTimeout(() => {
      if (gesture.current && !gesture.current.moved && event.pointerType === 'touch') {
        gesture.current.longPress = true; suppressed.current = true;
        onContext(event.clientX, event.clientY, target.app, target.file);
      }
    }, 600);
    gesture.current = { id: target.id, x: event.clientX, y: event.clientY, start: slot, moved: false, longPress: false, timer };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current; if (!current || current.longPress) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) < 8 && !current.moved) return;
    current.moved = true; clearTimeout(current.timer); suppressed.current = true;
    setDrag({ id: current.id, x: current.start.column * cellWidth + dx, y: current.start.row * cellHeight + dy });
  };
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current; if (!current) return;
    clearTimeout(current.timer);
    if (current.moved && drag) {
      const nextSlot = { column: Math.max(0, Math.min(columns - 1, Math.round(drag.x / cellWidth))), row: Math.max(0, Math.min(rows - 1, Math.round(drag.y / cellHeight))) };
      const occupied = Object.keys(slots).find(id => id !== current.id && slots[id].column === nextSlot.column && slots[id].row === nextSlot.row);
      const next = { ...positions, [current.id]: nextSlot, ...(occupied ? { [occupied]: current.start } : {}) };
      setPositions(next); saveState({ 'iconPositions.v2': next });
    } else if (!current.longPress && event.pointerType === 'touch') {
      choose(current.id);
      const now = Date.now();
      if (lastTap.current?.id === current.id && now - lastTap.current.time < 360) {
        const target = targets.find(item => item.id === current.id);
        if (target && target.app?.isLaunchable !== false) target.open();
        lastTap.current = null;
        suppressed.current = true;
      } else lastTap.current = { id: current.id, time: now };
    }
    setDrag(null); gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <nav className="desktop-icons desktop-icon-grid" aria-label="Desktop shortcuts" style={{ '--cell-width': `${cellWidth}px`, '--cell-height': `${cellHeight}px` } as React.CSSProperties}>
    {targets.map(target => {
      const slot = slots[target.id]; const isDragging = drag?.id === target.id;
      const disabled = target.app?.isLaunchable === false;
      return <button key={target.id} ref={node => { if (node) buttons.current.set(target.id, node); else buttons.current.delete(target.id); }}
        className={`desktop-icon ${selected === target.id ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${disabled ? 'unavailable' : ''} ${running.has(target.id) ? 'is-running' : ''}`}
        style={{ left: isDragging ? drag.x : slot.column * cellWidth, top: isDragging ? drag.y : slot.row * cellHeight }}
        aria-label={target.label} aria-disabled={disabled} tabIndex={selected === target.id ? 0 : -1} title={`${target.label}${disabled ? ' - unavailable' : ''}${target.app?.packageName ? `\n${target.app.packageName}` : ''}`}
        onClick={() => { if (!suppressed.current) choose(target.id); }} onDoubleClick={() => { if (!suppressed.current && !disabled) target.open(); }}
        onPointerDown={event => begin(event, target)} onPointerMove={move} onPointerUp={end} onPointerCancel={event => { if (gesture.current) clearTimeout(gesture.current.timer); gesture.current = null; setDrag(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onContextMenu={event => { event.preventDefault(); event.stopPropagation(); choose(target.id); onContext(event.clientX, event.clientY, target.app, target.file); }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); if (!disabled) target.open(); }
          if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); onContext(rect.left + 40, rect.top + 40, target.app, target.file); }
          const directions: Record<string, [number, number]> = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
          const delta = directions[event.key];
          if (delta) { event.preventDefault(); const candidates = targets.filter(candidate => { const other = slots[candidate.id]; return delta[0] ? (other.column - slot.column) * delta[0] > 0 : (other.row - slot.row) * delta[1] > 0; }).sort((a, b) => Math.hypot(slots[a.id].column - slot.column, slots[a.id].row - slot.row) - Math.hypot(slots[b.id].column - slot.column, slots[b.id].row - slot.row)); if (candidates[0]) choose(candidates[0].id); }
        }}>
        <span className="desktop-icon-image">{target.app ? <ApplicationIcon app={target.app} size={44} /> : <ColorIcon kind={target.icon || 'folder'} size={44} />}{target.app && !target.app.isSystemApp && <i className="shortcut-arrow"><ArrowUpRight size={10} /></i>}</span><span className="desktop-icon-label">{target.label}</span>
      </button>;
    })}
  </nav>;
}