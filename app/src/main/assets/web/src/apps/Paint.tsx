import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Brush, Check, Download, Eraser, FilePlus2, Palette, Redo2, Save, Trash2, Undo2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useDesktop } from '../context/DesktopContext';
import { FS, getState, nativeAvailable, saveState, type DesktopWindow } from '../lib/desktop';
import { IconButton, Modal } from '../components/Shared';

const COLORS = ['#192536', '#ffffff', '#dc454d', '#ed9c2c', '#f2ce48', '#45a36b', '#3783d8', '#8e64ca', '#d666a4', '#827365'];
interface Point { x: number; y: number }
interface Stroke { color: string; size: number; points: Point[] }
interface Drawing { width: number; height: number; strokes: Stroke[] }
const emptyDrawing = (width = 1920, height = 1080): Drawing => ({ width, height, strokes: [] });
function loadDrawing(): Drawing {
  const value = getState<Drawing | null>('paint.document.v1', null);
  if (!value || ![1920, 1080, 1600].includes(value.width) || ![1920, 1080, 1600].includes(value.height) || !Array.isArray(value.strokes) || value.strokes.length > 2000) return emptyDrawing();
  const strokes = value.strokes.filter(stroke => stroke && /^#[a-f0-9]{6}$/i.test(stroke.color) && stroke.size >= 1 && stroke.size <= 80 && Array.isArray(stroke.points) && stroke.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  return { width: value.width, height: value.height, strokes };
}
function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.size;
  context.lineCap = 'round'; context.lineJoin = 'round';
  const first = stroke.points[0];
  if (stroke.points.length === 1) { context.beginPath(); context.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2); context.fill(); return; }
  context.beginPath(); context.moveTo(first.x, first.y);
  stroke.points.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.stroke();
}
export function PaintApp({ win: _win }: { win: DesktopWindow }) {
  const { showToast, openSystem } = useDesktop();
  const [drawing, setDrawing] = useState<Drawing>(loadDrawing);
  const drawingRef = useRef(drawing); drawingRef.current = drawing;
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ pointer: number; stroke: Stroke } | null>(null);
  const undo = useRef<Drawing[]>([]), redo = useRef<Drawing[]>([]);
  const [color, setColor] = useState('#192536');
  const [size, setSize] = useState(8);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [draftSaved, setDraftSaved] = useState(true);
  const [dialog, setDialog] = useState<'save' | 'clear' | 'new' | null>(null);
  const [name, setName] = useState('Untitled.png');
  const [format, setFormat] = useState('1920x1080');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d'); if (!context) return;
    context.fillStyle = '#fff'; context.fillRect(0, 0, drawing.width, drawing.height);
    drawing.strokes.forEach(stroke => drawStroke(context, stroke));
  }, [drawing]);
  const persist = (next: Drawing) => { drawingRef.current = next; setDrawing(next); setDraftSaved(saveState({ 'paint.document.v1': next })); setLastPath(null); };
  const commit = (next: Drawing) => { undo.current = [...undo.current.slice(-19), drawingRef.current]; redo.current = []; persist(next); setHistoryRevision(value => value + 1); };
  const point = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(drawingRef.current.width, (event.clientX - rect.left) * drawingRef.current.width / rect.width)), y: Math.max(0, Math.min(drawingRef.current.height, (event.clientY - rect.top) * drawingRef.current.height / rect.height)) };
  };
  const begin = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || active.current || dialog) return;
    event.preventDefault();
    const stroke: Stroke = { color: tool === 'eraser' ? '#ffffff' : color, size: tool === 'eraser' ? size * 2 : size, points: [point(event)] };
    active.current = { pointer: event.pointerId, stroke }; event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext('2d'); if (context) drawStroke(context, stroke);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = active.current; if (!current || current.pointer !== event.pointerId) return;
    const next = point(event), previous = current.stroke.points[current.stroke.points.length - 1];
    if (Math.hypot(next.x - previous.x, next.y - previous.y) < .7 || current.stroke.points.length >= 15000) return;
    current.stroke.points.push(next);
    const context = event.currentTarget.getContext('2d'); if (context) drawStroke(context, { ...current.stroke, points: [previous, next] });
  };
  const end = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = active.current; if (!current || current.pointer !== event.pointerId) return;
    active.current = null;
    commit({ ...drawingRef.current, strokes: [...drawingRef.current.strokes, current.stroke] });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const undoStroke = () => { if (active.current) return; const previous = undo.current.pop(); if (!previous) return; redo.current.push(drawingRef.current); persist(previous); setHistoryRevision(value => value + 1); };
  const redoStroke = () => { if (active.current) return; const next = redo.current.pop(); if (!next) return; undo.current.push(drawingRef.current); persist(next); setHistoryRevision(value => value + 1); };
  const savePng = async () => {
    if (!canvas.current || saving) return; setSaving(true); setError('');
    try {
      const filename = name.trim().toLowerCase().endsWith('.png') ? name.trim() : `${name.trim()}.png`;
      const result = FS.savePng(filename, canvas.current.toDataURL('image/png'));
      if (!result.success) { setError(result.message || 'The image could not be saved.'); return; }
      setLastPath(result.path || null); setName(filename); setDialog(null); showToast('PNG saved', result.path || filename);
    } catch { setError('This image could not be exported.'); } finally { setSaving(false); }
  };
  const download = () => {
    if (nativeAvailable()) { if (lastPath) { const response = FS.export(lastPath); if (!response.success) showToast('Export failed', response.message || 'Android export unavailable.'); } else { setDialog('save'); setError('Save a PNG to Pictures before exporting through Android.'); } return; }
    canvas.current?.toBlob(blob => { if (!blob) { showToast('Export failed', 'No PNG data was produced.'); return; } const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name.toLowerCase().endsWith('.png') ? name : `${name}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }, 'image/png');
  };
  void historyRevision;
  return <div className="paint-app" onKeyDown={event => {
    if ((event.target as HTMLElement).matches('input, textarea, select') || dialog) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoStroke() : undoStroke(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redoStroke(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); setError(''); setDialog('save'); }
  }}>
    <div className="paint-toolbar"><div className="paint-file-tools"><IconButton title="New canvas" onClick={() => setDialog('new')}><FilePlus2 size={17} /></IconButton><IconButton title="Save PNG to Pictures" onClick={() => { setError(''); setDialog('save'); }}><Save size={17} /></IconButton><IconButton title={nativeAvailable() ? 'Export through Android' : 'Download PNG'} onClick={download}><Download size={17} /></IconButton><span className="toolbar-divider" /><IconButton title="Undo (Ctrl+Z)" disabled={!undo.current.length} onClick={undoStroke}><Undo2 size={17} /></IconButton><IconButton title="Redo (Ctrl+Y)" disabled={!redo.current.length} onClick={redoStroke}><Redo2 size={17} /></IconButton></div><div className="paint-brush-tools"><button className={tool === 'brush' ? 'active' : ''} onClick={() => setTool('brush')} title="Brush" aria-label="Brush" aria-pressed={tool === 'brush'}><Brush size={18} /></button><button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')} title="Eraser" aria-label="Eraser" aria-pressed={tool === 'eraser'}><Eraser size={18} /></button><label><span>Size</span><input type="range" min="1" max="40" value={size} onChange={event => setSize(Number(event.target.value))} aria-label="Brush size in canvas pixels" /><small>{size}px</small></label><IconButton title="Clear canvas" disabled={!drawing.strokes.length} onClick={() => setDialog('clear')}><Trash2 size={17} /></IconButton></div></div>
    <div className="paint-colors"><Palette size={16} /><div>{COLORS.map(value => <button key={value} className={color === value && tool === 'brush' ? 'chosen' : ''} style={{ backgroundColor: value }} title={`Color ${value}`} aria-label={`Choose ${value}`} aria-pressed={color === value} onClick={() => { setColor(value); setTool('brush'); }}>{color === value && <Check size={13} color={value === '#ffffff' ? '#17283d' : '#fff'} />}</button>)}</div><label className="custom-color"><input type="color" value={color} onChange={event => { setColor(event.target.value); setTool('brush'); }} aria-label="Custom brush color" /><span>Custom</span></label></div>
    <div className="paint-stage"><canvas ref={canvas} width={drawing.width} height={drawing.height} style={{ aspectRatio: `${drawing.width} / ${drawing.height}` }} aria-label="Paint canvas; draw using mouse, touch, or stylus" tabIndex={0} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} /></div>
    <footer className="paint-status"><span>{drawing.width} x {drawing.height} / PNG</span><span>{tool === 'brush' ? 'Brush' : 'Eraser'}</span><span className={!draftSaved ? 'danger-text' : ''}>{draftSaved ? lastPath ? 'PNG saved to Pictures' : 'Draft saved locally' : 'Draft not saved: storage full'}</span><button onClick={() => openSystem('photos')}>Open Photos</button></footer>
    <AnimatePresence>{dialog && <Modal title={dialog === 'save' ? 'Save your painting' : dialog === 'new' ? 'New canvas' : 'Clear the canvas?'} onClose={() => setDialog(null)} actions={<><button className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className={dialog === 'clear' ? 'danger-button' : 'primary-button'} disabled={saving} onClick={() => { if (dialog === 'save') void savePng(); else if (dialog === 'clear') { commit({ ...drawingRef.current, strokes: [] }); setDialog(null); } else { const [width, height] = format.split('x').map(Number); commit(emptyDrawing(width, height)); setDialog(null); } }}>{dialog === 'save' ? saving ? 'Saving...' : 'Save PNG' : dialog === 'clear' ? 'Clear' : 'Create canvas'}</button></>}>
      {dialog === 'save' ? <form onSubmit={event => { event.preventDefault(); void savePng(); }}><label className="field-label" htmlFor="paint-filename">File name</label><input id="paint-filename" className="text-input" value={name} onChange={event => setName(event.target.value)} /><p className="field-hint">Saved as a real PNG in your accessible WIN12 Pictures folder. Existing files are never overwritten.</p>{error && <p className="form-error">{error}</p>}</form> : dialog === 'new' ? <><p>The current canvas stays in Undo until this window is closed.</p><label className="field-label paint-format-label" htmlFor="paint-format">Canvas size</label><select id="paint-format" value={format} onChange={event => setFormat(event.target.value)}><option value="1920x1080">Full HD landscape / 1920 x 1080</option><option value="1080x1920">Full HD portrait / 1080 x 1920</option><option value="1600x1600">Square / 1600 x 1600</option></select></> : <p>This removes all strokes from the visible canvas. You can Undo this action while Paint remains open.</p>}
    </Modal>}</AnimatePresence>
  </div>;
}