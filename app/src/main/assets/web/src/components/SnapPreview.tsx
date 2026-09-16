import { motion } from 'framer-motion';
import { useDesktop } from '../context/DesktopContext';
export { detectSnap } from '../lib/shell';

export function SnapPreview() {
  const { snapZone } = useDesktop();
  if (!snapZone) return null;
  return <motion.div className="snap-preview" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ left: snapZone.x + 6, top: snapZone.y + 6, width: snapZone.width - 12, height: snapZone.height - 12 }} aria-hidden="true" />;
}