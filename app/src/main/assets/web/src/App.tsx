import { MotionConfig } from 'framer-motion';
import { DesktopProvider } from './context/DesktopContext';
import { DesktopShell } from './components/DesktopShell';

export default function App() {
  return <MotionConfig reducedMotion="user"><DesktopProvider><DesktopShell /></DesktopProvider></MotionConfig>;
}