import { useState } from 'react';
import { ArrowUpRight, Check, Copy, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { capabilities, getState, nativeAvailable, operation, saveState } from '../lib/desktop';
import { ApplicationIcon } from '../components/Icons';

export function CopilotBody() {
  const { apps, launchApp, showToast } = useDesktop();
  const [draft, setDraft] = useState(() => { const value = getState<unknown>('copilot.promptDraft', ''); return typeof value === 'string' ? value : ''; });
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const native = nativeAvailable();
  const candidates = apps.filter(app => !app.isSystemApp && app.verified && app.isLaunchable && /\bcopilot\b/i.test(app.displayName));
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); }
    catch { showToast('Clipboard unavailable', 'Select the draft and copy it using your device controls.'); }
  };
  const openWebsite = () => {
    const response = operation('openCopilot');
    if (!response.success) showToast('Could not open Copilot', response.message || 'This Android host does not expose an external browser handoff.');
  };
  return <div className="copilot-body"><span className="copilot-visual" aria-hidden="true"><Sparkles size={36} strokeWidth={1.3} /></span><p className="copilot-eyebrow">CONTINUE IN YOUR BROWSER</p><h2>Microsoft Copilot</h2><p className="copilot-intro">A place to ask, explore, and find a fresh perspective.</p>
    <div className="copilot-service-note"><ShieldCheck size={17} /><p>This is a shortcut to the real external service, not an embedded AI session. WIN12 does not generate answers or send your files and prompts.</p></div>
    {native ? <button className="primary-button copilot-open-button" disabled={!capabilities().externalWeb} onClick={openWebsite}><ExternalLink size={15} />Open Copilot website<ArrowUpRight size={14} /></button> : <a className="primary-button copilot-open-button" href="https://copilot.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Open Copilot website<ArrowUpRight size={14} /></a>}
    {native && !capabilities().externalWeb && <p className="field-hint">The native external-link handler is unavailable. Open copilot.com in your device browser.</p>}
    {candidates.length > 0 && <section className="copilot-installed"><h3>Discovered applications</h3><p>Actual installed targets with a matching label.</p>{candidates.map(app => <button key={app.id} onClick={() => launchApp(app)}><ApplicationIcon app={app} size={27} /><span>{app.displayName}<small>{app.packageName || app.executablePath}</small></span><ArrowUpRight size={14} /></button>)}</section>}
    <section className="copilot-draft"><div className="widget-section-heading"><h3>Prepare a prompt</h3><span>LOCAL DRAFT</span></div><label className="sr-only" htmlFor="copilot-prompt">Prompt draft, stored locally and not sent</label><textarea id="copilot-prompt" value={draft} maxLength={6000} placeholder="What would you like to explore?" onChange={event => { setDraft(event.target.value); setCopied(false); setSaveError(!saveState({ 'copilot.promptDraft': event.target.value })); }} /><div><small>{saveError ? 'Draft could not be saved.' : 'Copy, then paste into Copilot when you are ready.'}</small><button className="secondary-button" disabled={!draft.trim()} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy prompt'}</button></div></section>
    <p className="copilot-disclaimer">Microsoft operates Copilot. Sign-in, availability, and its privacy terms apply on that service. WIN12 is independent and is not endorsed by Microsoft.</p>
  </div>;
}