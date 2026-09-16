import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { WindowsLogo } from './Icons';
import { useDesktop } from '../context/DesktopContext';

import { desktopAudio } from '../lib/audio';

export function BootScreen() {
  const { finishBoot, profile } = useDesktop();
  const finishRef = useRef(finishBoot);
  finishRef.current = finishBoot;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Quick, clean splash that immediately transitions into the Administrator PC desktop
    const timer = setTimeout(() => {
      finishRef.current();
    }, reducedMotion ? 200 : 900);

    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <motion.div
      className="boot-screen pc-boot-screen"
      role="status"
      aria-live="polite"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      onPointerUp={() => {
        desktopAudio.unlock();
        finishRef.current();
      }}
      onClick={() => finishRef.current()}
    >
      <WindowsLogo size={68} className="boot-logo" />
      <div className="boot-brand">WIN12</div>
      <div className="boot-profile-name">{profile.pcName}</div>
      <div className="boot-dots" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${index * 0.14}s` }} />
        ))}
      </div>
      <p>Starting Windows 12...</p>
      <small>PERSONAL PC DESKTOP</small>
    </motion.div>
  );
}