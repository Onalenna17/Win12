import { X } from 'lucide-react';
import { IconButton } from './Shared';

export function SnapLayouts({ onPick, onClose }: { onPick: (type: string) => void; onClose: () => void }) {
  return <div className="snap-layout-menu pc-snap-layouts acrylic" role="group" aria-label="Snap layouts" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><span>Snap layouts</span><IconButton title="Close snap layouts" onClick={onClose}><X size={12} /></IconButton></header>
    <div className="snap-layout-choices"><div className="snap-layout-option"><small>Side by side</small><div className="snap-layout-diagram halves"><button aria-label="Snap left half" title="Left half" onClick={() => onPick('LEFT')} /><button aria-label="Snap right half" title="Right half" onClick={() => onPick('RIGHT')} /></div></div>
      <div className="snap-layout-option"><small>Maximize</small><div className="snap-layout-diagram full"><button aria-label="Snap full desktop" title="Full desktop" onClick={() => onPick('FULL')} /></div></div>
      <div className="snap-layout-option"><small>Four corners</small><div className="snap-layout-diagram quarters">{[{ type: 'TOP_LEFT', label: 'Top left' }, { type: 'TOP_RIGHT', label: 'Top right' }, { type: 'BOTTOM_LEFT', label: 'Bottom left' }, { type: 'BOTTOM_RIGHT', label: 'Bottom right' }].map(zone => <button key={zone.type} aria-label={`Snap ${zone.label.toLowerCase()} quarter`} title={`${zone.label} quarter`} onClick={() => onPick(zone.type)} />)}</div></div>
    </div><p>Choose a region, or drag the window to a desktop edge.</p>
  </div>;
}