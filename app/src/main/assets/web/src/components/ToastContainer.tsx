import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { WindowsLogo } from './Icons';
import { IconButton } from './Shared';

export function ToastContainer() {
  const { toasts, dismissToast } = useDesktop();
  return <div className="toast-container" aria-live="polite" aria-atomic="false"><AnimatePresence>{toasts.map(toast => <motion.div className="toast acrylic" layout key={toast.id} initial={{ opacity: 0, x: 32, scale: .98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 22, scale: .96 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}><div className="toast-brand"><WindowsLogo size={13} /><span>WIN12</span><IconButton title="Dismiss notification" onClick={() => dismissToast(toast.id)}><X size={13} /></IconButton></div><h3>{toast.title}</h3><p>{toast.message}</p></motion.div>)}</AnimatePresence></div>;
}