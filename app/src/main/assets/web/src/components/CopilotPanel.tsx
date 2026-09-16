import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { CopilotBody } from '../apps/Copilot';
import { IconButton } from './Shared';

export function CopilotPanel() {
  const { closeFlyouts } = useDesktop();
  return <motion.aside className="copilot-panel acrylic shell-panel" role="dialog" aria-label="Copilot external service panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 22 }} transition={{ type: 'spring', stiffness: 410, damping: 34 }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}><header className="utility-panel-header"><span><Sparkles size={16} />Copilot<span className="external-service-label">External service</span></span><IconButton title="Close Copilot panel" onClick={closeFlyouts}><X size={16} /></IconButton></header><CopilotBody /></motion.aside>;
}