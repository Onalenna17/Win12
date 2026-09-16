import { useState } from 'react';
import { Bell, Check, Info, Monitor, Play, Volume2, VolumeX } from 'lucide-react';
import { desktopAudio, useDesktopAudioStatus, type DesktopSound } from '../lib/audio';
import { nativeAvailable } from '../lib/desktop';
import type { Preferences } from '../lib/preferences';
import { Toggle } from './Shared';

export function SoundSettings({ preferences, onPreferences }: { preferences: Preferences; onPreferences: (partial: Partial<Preferences>) => void }) {
  const status = useDesktopAudioStatus();
  const [selected, setSelected] = useState<DesktopSound>('startup');
  const [testing, setTesting] = useState(false);
  const samples: { id: DesktopSound; label: string }[] = [
    { id: 'startup', label: 'Startup / welcome' }, { id: 'launch', label: 'Open application' },
    { id: 'close', label: 'Close window' }, { id: 'minimize', label: 'Minimize window' },
    { id: 'restore', label: 'Restore or snap window' }, { id: 'notification', label: 'Notification' },
    { id: 'error', label: 'Error or unavailable action' }, { id: 'success', label: 'Saved or completed' },
    { id: 'recycle', label: 'Recycle Bin' }, { id: 'dialog', label: 'Confirmation dialog' },
  ];
  return <div className="pc-sound-settings"><div className="sound-scheme-heading"><span className="sound-scheme-icon"><Volume2 size={27} /></span><div><h2>WIN12 PC</h2><p>Original desktop sound scheme</p></div></div>
    <div className="setting-list"><div className="setting-row"><Monitor size={20} /><div><strong>Play the startup sound</strong><small>Welcome chime when the splash opens your PC desktop</small></div><Toggle label="Play startup sound" enabled={preferences.startupSound} onChange={() => onPreferences({ startupSound: !preferences.startupSound })} /></div><div className="setting-row"><Bell size={20} /><div><strong>Play PC system sounds</strong><small>Windows, notifications, confirmations, and file-operation results</small></div><Toggle label="Play PC system sounds" enabled={preferences.systemSounds} onChange={() => onPreferences({ systemSounds: !preferences.systemSounds })} /></div><div className="setting-row sound-volume-row">{preferences.volume ? <Volume2 size={20} /> : <VolumeX size={20} />}<div><strong>WIN12 sound volume</strong><small>Application sound level, separate from device media volume</small></div><input type="range" min="0" max="100" value={preferences.volume} aria-label="WIN12 sound scheme volume" onChange={event => onPreferences({ volume: Number(event.target.value) })} /><span>{preferences.volume}%</span></div></div>
    <h3 className="settings-section-title">Listen to a sound</h3><div className="sound-preview-controls"><label className="sr-only" htmlFor="pc-sound-preview">Sound to preview</label><select id="pc-sound-preview" value={selected} onChange={event => setSelected(event.target.value as DesktopSound)}>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select><button className="primary-button" disabled={testing || preferences.volume === 0} onClick={async () => { setTesting(true); try { await desktopAudio.preview(selected); } finally { setTesting(false); } }}><Play size={14} />{testing ? 'Starting...' : 'Play sound'}</button></div>
    <div className={`sound-output-status ${status.state}`} role="status">{status.state === 'ready' || status.state === 'playing' ? <Check size={15} /> : <Info size={15} />}<p>{status.message}</p></div>
    <p className="sound-settings-note">{nativeAvailable() ? 'Android playback respects silent mode, Do Not Disturb, media volume, and foreground audio focus.' : 'Browsers may require one click or key press before playing the startup chime. Your desktop opens immediately; the sound waits for that interaction.'} WIN12 Focus silences notification sounds.</p>
    <p className="sound-settings-note">These are original WIN12 sounds. No licensed Microsoft Windows sound files were supplied or bundled.</p>
  </div>;
}

export function DesktopSoundHint() {
  const status = useDesktopAudioStatus();
  if (status.output !== 'browser' || status.state !== 'waiting') return null;
  return <button className="desktop-sound-hint" aria-label="Enable PC startup and system sounds" title="Browsers require an interaction before sound can play" onClick={() => desktopAudio.unlock()}><Volume2 size={15} /><span>Enable PC sounds</span></button>;
}