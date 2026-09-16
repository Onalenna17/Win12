import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, UserRound, ShieldCheck, ArrowRight } from 'lucide-react';
import { WindowsLogo } from './Icons';
import { createAccount, signIn } from '../lib/auth';
import { desktopAudio } from '../lib/audio';

interface Props { mode: 'setup' | 'login'; onComplete: () => void }

export function AuthScreen({ mode, onComplete }: Props) {
  const [username, setUsername] = useState('Administrator');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setup = mode === 'setup';

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (setup && password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      if (setup) await createAccount(username, password); else await signIn(password, remember);
      desktopAudio.unlock();
      onComplete();
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-screen">
    <div className="auth-wallpaper" />
    <motion.div className="auth-card acrylic" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .45 }}>
      <div className="auth-brand"><WindowsLogo size={58} /><div><strong>WIN12</strong><span>PC desktop for Android</span></div></div>
      <div className="auth-avatar"><UserRound size={42} /></div>
      <h1>{setup ? 'Set up your PC' : 'Welcome back'}</h1>
      <p className="auth-subtitle">{setup ? 'Create the first local WIN12 administrator account.' : 'Sign in to your WIN12 desktop.'}</p>
      <form onSubmit={submit}>
        {setup && <label><span>Account name</span><div className="auth-input"><UserRound size={16} /><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus /></div></label>}
        <label><span>Password</span><div className="auth-input"><KeyRound size={16} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} autoFocus={!setup} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
        {setup && <label><span>Confirm password</span><div className="auth-input"><ShieldCheck size={16} /><input type={showPassword ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></div></label>}
        {!setup && <label className="auth-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Keep me signed in on this device</label>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={busy || !password || (setup && !username.trim())}>{busy ? 'Preparing PC…' : setup ? <>Create account <ArrowRight size={16}/></> : <>Sign in <ArrowRight size={16}/></>}</button>
      </form>
      {setup && <small className="auth-note">Your password is stored locally as a salted PBKDF2 hash. WIN12 does not send it to a server.</small>}
    </motion.div>
    <div className="auth-footer">WIN12 • Local Android desktop • {new Date().getFullYear()}</div>
  </div>;
}
