import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function IconButton({ title, children, onClick, disabled, className = '' }: { title: string; children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button className={`icon-button ${className}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Modal({ title, children, onClose, actions, wide = false }: { title: string; children: ReactNode; onClose: () => void; actions?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => (ref.current?.querySelector<HTMLElement>('input, textarea') || ref.current?.querySelector<HTMLElement>('button'))?.focus(), 50);
    const handleKey = (e: KeyboardEvent) => {
      if (!ref.current?.contains(document.activeElement)) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); closeRef.current(); }
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', handleKey, true); previous?.focus(); };
  }, []);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.div ref={ref} className={`modal acrylic ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} initial={{ scale: .96, y: 10 }} animate={{ scale: 1, y: 0 }}>
      <header><h3>{title}</h3><IconButton title="Close dialog" onClick={onClose}><X size={17} /></IconButton></header>
      <div className="modal-body">{children}</div>
      {actions && <footer>{actions}</footer>}
    </motion.div>
  </motion.div>;
}

export function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return <button className={`toggle-switch ${enabled ? 'on' : ''}`} role="switch" aria-checked={enabled} aria-label={label} onClick={onChange}><span /></button>;
}

export function EmptyState({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3>{description && <p>{description}</p>}{children}</div>;
}

export { AnimatePresence };