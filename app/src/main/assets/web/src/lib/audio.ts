import { useSyncExternalStore } from 'react';
import { hasNativeMethod, nativeAvailable, operation } from './desktop';
import type { Preferences } from './preferences';

export const SOUND_EVENTS = ['startup', 'launch', 'close', 'minimize', 'restore', 'notification', 'error', 'success', 'recycle', 'dialog'] as const;
export type DesktopSound = typeof SOUND_EVENTS[number];
type Note = { frequency: number; start: number; duration: number; gain: number };
const note = (frequency: number, start: number, duration: number, gain: number): Note => ({ frequency, start, duration, gain });
// Original WIN12 compositions, not recordings or reproductions of Microsoft audio.
export const PC_SOUND_SCHEME: Record<DesktopSound, Note[]> = {
  startup: [note(392, 0, 1.1, .28), note(587.33, .12, 1.15, .32), note(739.99, .27, 1.05, .27), note(987.77, .44, 1.08, .22), note(1174.66, .7, .7, .1)],
  launch: [note(523.25, 0, .16, .24), note(783.99, .055, .2, .19)],
  close: [note(659.25, 0, .13, .18), note(440, .045, .17, .16)],
  minimize: [note(659.25, 0, .12, .15), note(493.88, .045, .14, .13)],
  restore: [note(493.88, 0, .12, .15), note(659.25, .04, .17, .16)],
  notification: [note(739.99, 0, .34, .28), note(987.77, .095, .45, .22)],
  error: [note(329.63, 0, .22, .24), note(392, 0, .22, .12), note(293.66, .16, .28, .22)],
  success: [note(587.33, 0, .25, .2), note(739.99, .07, .3, .22), note(987.77, .15, .36, .16)],
  recycle: [note(493.88, 0, .09, .15), note(392, .06, .11, .15), note(293.66, .12, .18, .13)],
  dialog: [note(659.25, 0, .18, .16), note(783.99, .025, .2, .1)],
};
export function synthesizeSound(event: DesktopSound, sampleRate: number): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !PC_SOUND_SCHEME[event]) throw new Error('Unsupported sound event or sample rate.');
  const notes = PC_SOUND_SCHEME[event];
  const duration = Math.max(...notes.map(tone => tone.start + tone.duration)) + .04;
  const data = new Float32Array(Math.ceil(duration * sampleRate));
  for (const tone of notes) {
    const begin = Math.floor(tone.start * sampleRate), length = Math.floor(tone.duration * sampleRate);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate, phase = 2 * Math.PI * tone.frequency * t;
      const attack = Math.min(1, t / .014), release = Math.pow(Math.max(0, 1 - t / tone.duration), 2);
      const wave = Math.sin(phase) * .86 + Math.sin(phase * 2) * .1 + Math.sin(phase * 3) * .04;
      data[begin + i] += wave * attack * release * tone.gain * .42;
    }
  }
  return data;
}

export interface DesktopAudioStatus {
  state: 'ready' | 'playing' | 'waiting' | 'muted' | 'unavailable';
  output: 'browser' | 'native';
  message: string;
}
type AudioPreferences = Pick<Preferences, 'volume' | 'startupSound' | 'systemSounds' | 'doNotDisturb'>;
class DesktopAudioEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<DesktopSound, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private listeners = new Set<() => void>();
  private preferences: AudioPreferences = { volume: 70, startupSound: true, systemSounds: true, doNotDisturb: false };
  private pendingStartup = false;
  private sessionStarted = false;
  private lastEventAt = 0;
  private startupUntil = 0;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private status: DesktopAudioStatus = { state: 'ready', output: nativeAvailable() ? 'native' : 'browser', message: 'Original WIN12 PC sound scheme.' };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.status;
  private report(state: DesktopAudioStatus['state'], message: string) {
    this.status = { state, message, output: nativeAvailable() ? 'native' : 'browser' };
    this.listeners.forEach(listener => listener());
  }
  configure(preferences: AudioPreferences) {
    const previous = this.preferences;
    this.preferences = { ...preferences };
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(preferences.volume / 100, this.context.currentTime, .025);
    if (!preferences.startupSound || preferences.volume === 0) this.pendingStartup = false;
    if ((previous.startupSound && !preferences.startupSound) || (previous.systemSounds && !preferences.systemSounds)) {
      if (nativeAvailable() && hasNativeMethod('stopDesktopSounds')) operation('stopDesktopSounds');
      this.stop();
    }
    if (preferences.volume === 0 || (!preferences.startupSound && !preferences.systemSounds)) {
      if (nativeAvailable() && hasNativeMethod('stopDesktopSounds')) operation('stopDesktopSounds');
      this.stop(); this.report('muted', 'WIN12 sounds are turned off.');
    } else if (this.status.state === 'muted' || this.status.state === 'waiting' && !this.pendingStartup) this.report('ready', nativeAvailable() ? 'Android playback respects silent mode, audio focus, and device volume.' : 'PC sounds are enabled. Browser playback may require a click or key press.');
  }
  private allowed(event: DesktopSound, preview: boolean) {
    if (this.preferences.volume <= 0) return false;
    if (preview) return true;
    if (event === 'startup') return this.preferences.startupSound;
    return this.preferences.systemSounds && !(this.preferences.doNotDisturb && ['notification', 'error', 'success', 'recycle'].includes(event));
  }
  private ensureContext() {
    if (this.context?.state !== 'closed' && this.context) return this.context;
    try {
      const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) throw new Error('AudioContext unavailable');
      this.context = new Context();
      this.gain = this.context.createGain(); this.gain.gain.value = this.preferences.volume / 100;
      this.gain.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.context?.state !== 'running') return;
        if (this.pendingStartup) this.drainStartup();
        else if (this.status.state === 'waiting') this.report('ready', 'Browser audio permission is active. PC sounds are ready.');
      };
      return this.context;
    } catch { this.report('unavailable', 'This browser cannot play the WIN12 sound scheme.'); return null; }
  }
  private drainStartup() {
    if (!this.pendingStartup || !this.context || this.context.state !== 'running' || document.visibilityState !== 'visible') return;
    this.pendingStartup = false;
    if (this.allowed('startup', false)) this.playBrowser('startup');
  }
  startSession() {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    if (!this.allowed('startup', false)) return;
    if (nativeAvailable()) { this.play('startup'); return; }
    this.pendingStartup = true;
    const context = this.ensureContext();
    if (!context) { this.pendingStartup = false; return; }
    if (context.state === 'running') this.drainStartup();
    else {
      this.report('waiting', 'Your browser requires an interaction before playing startup audio. Click or press a key to hear it.');
      void context.resume().then(() => this.drainStartup()).catch(() => {});
    }
  }
  unlock() {
    if (nativeAvailable() || this.preferences.volume === 0 || !this.preferences.startupSound && !this.preferences.systemSounds) return;
    const context = this.ensureContext(); if (!context) return;
    if (context.state === 'running') this.drainStartup();
    else void context.resume().then(() => this.drainStartup()).catch(() => this.report('unavailable', 'Audio is blocked. Check the browser site-sound permission.'));
  }
  attach() {
    const interaction = (event: Event) => { if (event.isTrusted) this.unlock(); };
    const visibility = () => { if (document.visibilityState === 'hidden') this.stop(); };
    window.addEventListener('pointerup', interaction, true); window.addEventListener('keydown', interaction, true);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pointerup', interaction, true); window.removeEventListener('keydown', interaction, true); document.removeEventListener('visibilitychange', visibility); this.dispose(); };
  }
  play(event: DesktopSound, preview = false): boolean {
    if (!this.allowed(event, preview) || document.visibilityState !== 'visible') return false;
    const now = performance.now();
    if (!preview && event !== 'startup' && (now < this.startupUntil || now - this.lastEventAt < 120)) return false;
    if (nativeAvailable()) {
      if (!hasNativeMethod('playDesktopSound')) { this.report('unavailable', 'Update the Android host to enable the full PC sound scheme.'); return false; }
      const result = operation('playDesktopSound', event, this.preferences.volume, preview);
      if (result.code === 'RATE_LIMITED') return false;
      if (!result.success) { this.report(['SILENT_MODE', 'APP_MUTED', 'DEVICE_MUTED', 'BACKGROUND', 'FOCUS_DENIED', 'DO_NOT_DISTURB'].includes(result.code || '') ? 'muted' : 'unavailable', result.message || 'Android could not play this sound.'); return false; }
      this.lastEventAt = now;
      if (event === 'startup') this.startupUntil = now + 1650;
      this.report('playing', result.message || 'Playing the original WIN12 PC sound through Android.');
      clearTimeout(this.stopTimer); this.stopTimer = setTimeout(() => this.report('ready', 'Original PC sounds / Android native audio.'), event === 'startup' ? 1650 : 650);
      return true;
    }
    const context = this.ensureContext(); if (!context) return false;
    if (context.state !== 'running') { this.unlock(); return false; }
    return this.playBrowser(event);
  }
  async preview(event: DesktopSound): Promise<boolean> {
    if (!this.allowed(event, true)) { this.report('muted', 'Increase the WIN12 sound volume to preview a sound.'); return false; }
    this.pendingStartup = false;
    if (nativeAvailable()) return this.play(event, true);
    const context = this.ensureContext(); if (!context) return false;
    try {
      if (context.state !== 'running') await Promise.race([context.resume(), new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Audio blocked')), 1500))]);
      if (context.state !== 'running') throw new Error('Audio blocked');
      this.stop(); return this.play(event, true);
    } catch { this.report('waiting', 'Playback was blocked by this browser. Allow sound for this site and try again.'); return false; }
  }
  private playBrowser(event: DesktopSound): boolean {
    const context = this.context; if (!context || context.state !== 'running' || !this.gain) return false;
    try {
      let buffer = this.buffers.get(event);
      if (!buffer) {
        const samples = synthesizeSound(event, context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate); buffer.getChannelData(0).set(samples); this.buffers.set(event, buffer);
      }
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(this.gain);
      this.sources.add(source); source.start(); this.lastEventAt = performance.now();
      if (event === 'startup') this.startupUntil = performance.now() + buffer.duration * 1000;
      this.report('playing', `Playing ${event} / original WIN12 PC sound.`);
      source.onended = () => { this.sources.delete(source); source.disconnect(); if (!this.sources.size) this.report('ready', 'PC sound playback is enabled in this browser.'); };
      return true;
    } catch { this.stop(); this.report('unavailable', 'The browser audio output could not play this sound. Your desktop remains available.'); return false; }
  }
  stop() {
    clearTimeout(this.stopTimer);
    this.sources.forEach(source => { source.onended = null; try { source.stop(); source.disconnect(); } catch { /* The source may already have ended. */ } });
    this.sources.clear(); this.startupUntil = 0;
    if (this.status.state === 'playing') this.report('ready', nativeAvailable() ? 'Android PC audio is ready.' : 'PC audio is ready.');
  }
  private dispose() {
    this.stop();
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => {}); }
    this.context = null; this.gain = null; this.buffers.clear(); this.pendingStartup = false; this.sessionStarted = false;
  }
}
export const desktopAudio = new DesktopAudioEngine();
export function useDesktopAudioStatus() { return useSyncExternalStore(desktopAudio.subscribe, desktopAudio.getSnapshot); }
export function soundForNotice(title: string, message: string): DesktopSound {
  const text = `${title} ${message}`.toLowerCase();
  if (/failed|could not|cannot|can't|unavailable|unable|error|not saved|not changed/.test(text)) return 'error';
  if (/recycle bin|deleted/.test(text)) return 'recycle';
  if (/saved|created|copied|restored|renamed|exported|completed/.test(text)) return 'success';
  return 'notification';
}