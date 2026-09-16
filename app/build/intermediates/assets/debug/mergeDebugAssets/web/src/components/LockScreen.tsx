import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { Modal } from './Shared';

// Android owns the lock screen. This component only confirms a native lock request.
export function LockScreen() {
  const { system, dialog, setDialog, lockDevice, openSystem } = useDesktop();
  if (dialog?.kind !== 'lock') return null;
  const available = system.lock.canLock;
  return <Modal title={available ? 'Lock your Android device?' : 'Android screen lock'} onClose={() => setDialog(null)} actions={<>
    <button className="secondary-button" onClick={() => setDialog(null)}>Cancel</button>
    {available ? <button className="primary-button" onClick={() => { const response = lockDevice(); if (response.success) setDialog(null); }}><LockKeyhole size={14} />Lock device</button> : <button className="primary-button" onClick={() => { setDialog(null); openSystem('settings', { tab: 'security' }); }}><ShieldCheck size={14} />Lock & permissions</button>}
  </>}><div className="native-lock-intro"><span className="runtime-required-icon"><LockKeyhole size={32} /></span><h2>{available ? 'Your desktop will be here.' : 'Device security stays with Android.'}</h2><p>{available ? 'WIN12 will ask Android to lock the device. Unlock with your real Android PIN, pattern, or password to return. No web lock screen is used.' : system.lock.supported ? 'Enable App Screen Lock and configure a secure Android credential before using this action.' : 'This environment cannot lock Android. The browser will not show a pretend lock screen.'}</p></div></Modal>;
}