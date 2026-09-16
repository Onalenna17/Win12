import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Download, FileText, FolderOpen, Info, LoaderCircle, Monitor, Save, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ApplicationIcon, ColorIcon } from './Icons';
import { EmptyState, IconButton, Modal } from './Shared';
import { basename, capabilities, folderPath, formatBytes, FS, getState, logEvent, Native, nativeAvailable, operation, parentPath, saveState, type DesktopActions, type DesktopWindow, type NativeProcess } from '../lib/desktop';
import { useRegistry } from '../lib/registry';

interface UtilityProps { win: DesktopWindow; actions: DesktopActions }
interface Inspection { name: string; size: number; architecture: string; format: string; recognized: boolean; message: string }
export async function inspectInstaller(file: File): Promise<Inspection> {
  const base: Inspection = { name: file.name, size: file.size, architecture: 'Not determined', format: 'Unknown', recognized: false, message: 'No supported executable header was found.' };
  const buffer = await file.slice(0, 64).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (/\.msi$/i.test(file.name)) {
    const recognized = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);
    return { ...base, recognized, format: recognized ? 'OLE compound document' : 'Unrecognized', message: recognized ? 'Compound-file signature recognized. This alone does not validate an MSI database or prove this is a safe installer.' : 'The file does not contain a supported compound-file header.' };
  }
  if (!/\.exe$/i.test(file.name) || bytes.length < 64 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return base;
  const offset = new DataView(buffer).getUint32(0x3c, true);
  if (offset < 64 || offset + 24 > file.size) return { ...base, message: 'The PE header points outside the file.' };
  const pe = new DataView(await file.slice(offset, offset + 24).arrayBuffer());
  if (pe.getUint32(0, true) !== 0x00004550) return base;
  const architecture = ({ 0x8664: 'x86-64', 0x014c: 'x86 (32-bit)', 0xaa64: 'ARM64' } as Record<number, string>)[pe.getUint16(4, true)] || `Machine 0x${pe.getUint16(4, true).toString(16)}`;
  return { ...base, recognized: true, architecture, format: 'Windows Portable Executable', message: 'PE header recognized. This is a format inspection, not signature verification, a malware scan, or evidence that this application can run.' };
}
export function Installer({ win: _win, actions }: UtilityProps) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inspect = async (file: File) => {
    setInspecting(true); setError('');
    try { setInspection(await inspectInstaller(file)); } catch { setError('Unable to read the selected file.'); }
    setInspecting(false);
  };
  return <div className="installer-page"><div className="installer-stepper">{['Select file', 'Inspect header', 'Check support'].map((label, index) => <div key={label} className={`installer-step ${inspection ? index === 0 ? 'complete' : 'current' : index === 0 ? 'current' : ''}`}><span>{inspection && index === 0 ? <Check size={15} /> : index + 1}</span><small>{label}</small></div>)}</div>
    <input ref={input} type="file" className="hidden-input" accept=".exe,.msi" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void inspect(file); }} />
    <div className="installer-body">{!inspection ? <><ColorIcon kind="installer" size={66} /><h1>Know what you're opening.</h1><p>Inspect a Windows executable or installer without running it.</p><button className={`installer-dropzone ${dragOver ? 'drag-over' : ''}`} disabled={inspecting} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={event => { event.preventDefault(); setDragOver(false); const file = event.dataTransfer.files[0]; if (file) void inspect(file); }}>{inspecting ? <LoaderCircle size={29} className="spin" /> : <Upload size={29} strokeWidth={1.5} />}<strong>{inspecting ? 'Reading file header...' : 'Choose an .exe or .msi file'}</strong><span>or drop a file here</span></button><div className="installer-security"><ShieldCheck size={19} /><p>Only inspect files from sources you trust. No software is installed, executed, or added to your application registry.</p></div></> : <><ColorIcon kind="installer" size={47} /><h1>{inspection.recognized ? 'Header inspected.' : 'Unsupported file format.'}</h1><div className="installer-file-details"><div><span>File name</span><strong>{inspection.name}</strong></div><div><span>Format</span><strong>{inspection.format}</strong></div><div><span>Architecture</span><strong>{inspection.architecture}</strong></div><div><span>Size</span><strong>{formatBytes(inspection.size)}</strong></div><div><span>Execution support</span><strong>{capabilities().windowsExecution ? 'Wine 9.0 prefix active' : 'Runtime setup required'}</strong></div></div><div className="information-note"><Info size={17} /><p>{inspection.message} {capabilities().windowsExecution ? 'Windows Compatibility Runtime is active. Isolated prefixes are ready for execution.' : 'No functioning Windows runtime is currently configured. Click below to provision Wine 9.0 and Box64.'}</p></div></>}{error && <p className="form-error">{error}</p>}</div>
    <footer className="installer-footer"><span><ShieldCheck size={13} />{capabilities().windowsExecution ? 'Wine 9.0 Runtime Active' : 'Inspection mode'}</span><div className="flex items-center gap-2">{inspection && <button className="secondary-button" onClick={() => setInspection(null)}><ArrowLeft size={14} />Choose another</button>}<button className="primary-button" onClick={() => actions.open('settings', { tab: 'runtime' })}>{capabilities().windowsExecution ? 'Runtime Settings' : 'Configure Runtime'}{inspection && <ArrowRight size={13} />}</button></div></footer>
  </div>;
}

export function LogViewer({ win, actions }: UtilityProps) {
  const [logs, setLogs] = useState(() => Native.logs(win.args?.appId || 'system'));
  const [active, setActive] = useState(Object.keys(logs)[0] || 'system.log');
  const [search, setSearch] = useState('');
  const [automatic, setAutomatic] = useState(true);
  const [confirmation, setConfirmation] = useState(false);
  const refresh = () => { const next = Native.logs(win.args?.appId || 'system'); setLogs(next); if (!(active in next)) setActive(Object.keys(next)[0] || 'system.log'); };
  useEffect(() => { const next = Native.logs(win.args?.appId || 'system'); setLogs(next); setActive(Object.keys(next)[0] || 'system.log'); }, [win.args?.appId]);
  useEffect(() => { if (!automatic) return; const timer = setInterval(() => setLogs(Native.logs(win.args?.appId || 'system')), 2500); return () => clearInterval(timer); }, [automatic, win.args?.appId]);
  const content = logs[active] || '';
  const lines = content.split('\n').filter(line => !search || line.toLowerCase().includes(search.toLowerCase()));
  return <div className="log-viewer"><div className="log-topbar"><div className="log-file-tabs">{(Object.keys(logs).length ? Object.keys(logs) : ['system.log']).map(key => <button className={key === active ? 'selected' : ''} key={key} onClick={() => setActive(key)}><FileText size={13} />{key}</button>)}</div><div className="log-actions"><IconButton title="Refresh logs" onClick={refresh}><RefreshCwIcon /></IconButton><IconButton title="Copy logs" onClick={async () => { try { await navigator.clipboard.writeText(content); actions.notify('Logs copied', 'Copied the selected log stream.'); } catch { actions.notify('Clipboard unavailable', 'Select and copy the log text manually.'); } }}><Copy size={15} /></IconButton>{(!win.args?.appId || win.args.appId === 'system') && <IconButton title="Clear WIN12 logs" onClick={() => setConfirmation(true)}><Trash2 size={15} /></IconButton>}</div></div><div className="log-filter"><Search size={14} /><input aria-label="Filter log entries" placeholder="Filter log entries..." value={search} onChange={event => setSearch(event.target.value)} /><span className="log-source">{win.args?.appId || 'system'}</span></div><div className="log-console" tabIndex={0}>{!content ? <p className="log-empty">No WIN12 log entries.</p> : lines.length === 0 ? <p className="log-empty">No entries match this filter.</p> : lines.map((line, index) => <div className="log-line" key={index}><span>{index + 1}</span><code>{line}</code></div>)}</div><div className="log-statusbar"><span>{lines.filter(Boolean).length} lines</span><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Auto-refresh</label><span>UTF-8</span></div><AnimatePresence>{confirmation && <Modal title="Clear WIN12 diagnostic logs?" onClose={() => setConfirmation(false)} actions={<><button className="secondary-button" onClick={() => setConfirmation(false)}>Cancel</button><button className="danger-button" onClick={() => { const success = nativeAvailable() ? operation('clearLogs', 'system').success : saveState({ logs: [] }); if (!success) actions.notify('Could not clear logs', 'The native host or browser storage did not complete the request.'); refresh(); setConfirmation(false); }}>Clear logs</button></>}><p>This removes only WIN12's diagnostic history, not other applications' private logs.</p></Modal>}</AnimatePresence></div>;
}
function RefreshCwIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 7v5h-5M4 17v-5h5M19 11a7 7 0 0 0-12-5L4 9m1 4a7 7 0 0 0 12 5l3-3" /></svg>; }

export function TaskManager({ windows, actions, activeId }: { windows: DesktopWindow[]; actions: DesktopActions; activeId: string | null }) {
  const registry = useRegistry();
  const [tab, setTab] = useState('desktop');
  const [processes, setProcesses] = useState<NativeProcess[]>(() => Native.processes());
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setProcesses(Native.processes()), 3000); return () => clearInterval(timer); }, []);
  const external = registry.apps.filter(app => !app.isSystemApp);
  const selectedProcess = processes.find(process => process.applicationId === selected);
  const canEnd = tab === 'desktop' ? Boolean(selected) : tab === 'windows' && selectedProcess?.canStop === true;
  return <div className="utility-page task-manager-page"><header className="utility-heading"><div><h1>Task Manager</h1><p>Actual windows and independently observed process state.</p></div><IconButton title="Refresh processes" onClick={() => setProcesses(Native.processes())}><RefreshCwIcon /></IconButton></header><div className="utility-tabs">{[{ id: 'desktop', title: 'WIN12 windows', count: windows.length }, { id: 'android', title: 'External apps', count: external.length }, { id: 'windows', title: 'Runtime processes', count: processes.length }].map(item => <button className={tab === item.id ? 'selected' : ''} key={item.id} onClick={() => { setTab(item.id); setSelected(null); }}>{item.title}<span>{item.count}</span></button>)}</div>
    {tab === 'android' && <p className="settings-description">Android restricts visibility into other processes. Unknown does not mean stopped. WIN12 cannot force-stop another Android app.</p>}
    <div className="process-table"><div className="process-header"><span>Name</span><span>{tab === 'desktop' ? 'Window state' : tab === 'android' ? 'Source' : 'PID'}</span><span>Status</span></div>{tab === 'desktop' ? windows.map(win => <button className={`process-row ${selected === win.id ? 'selected' : ''}`} key={win.id} onClick={() => setSelected(win.id)}><span><ColorIcon kind={win.icon} size={26} />{win.title}</span><span>{win.minimized ? 'Minimized' : win.maximized ? 'Maximized' : 'Windowed'}</span><span><i className={`status-dot ${win.id === activeId ? 'green' : 'blue'}`} />{win.id === activeId ? 'Active' : 'Open'}</span></button>) : tab === 'android' ? external.length ? external.map(app => <button className={`process-row ${selected === app.id ? 'selected' : ''}`} key={app.id} onClick={() => setSelected(app.id)} title={app.runningEvidence || 'No process evidence available'}><span><ApplicationIcon app={app} size={26} />{app.displayName}</span><span>{app.launchType === 'ANDROID_PACKAGE' ? 'Android package' : 'Runtime'}</span><span>{app.runningState === 'RUNNING' ? 'Running (observed)' : app.runningState === 'STOPPED' ? 'Stopped (reported)' : 'Unknown'}</span></button>) : <EmptyState icon={<Monitor size={36} />} title="No external apps discovered" description={registry.message} /> : processes.length ? processes.map(process => <button className={`process-row ${selected === process.applicationId ? 'selected' : ''}`} key={process.pid} onClick={() => setSelected(process.applicationId)}><span><Activity size={20} />{process.applicationId}</span><span>{process.pid}</span><span>{process.status}</span></button>) : <EmptyState icon={<Activity size={37} />} title={capabilities().windowsExecution ? 'No observed runtime processes' : 'Runtime processes unavailable'} description="No process or execution state is simulated." />}</div>
    <footer className="task-manager-footer"><span>{tab === 'desktop' ? 'Live WIN12 window state' : tab === 'android' ? 'External process visibility: restricted' : 'Actual runtime process records only'}</span><button className="secondary-button" disabled={!canEnd} onClick={() => { if (!selected) return; if (tab === 'desktop') actions.close(selected); else { const response = operation('stopApplication', selected); actions.notify(response.success ? 'Stop request accepted' : 'Unable to stop process', response.message || 'Process state will be refreshed from the host.'); setProcesses(Native.processes()); } setSelected(null); }}><X size={14} />End task</button></footer>
  </div>;
}

export function Notepad({ win, actions }: UtilityProps) {
  const initialPath = win.args?.path;
  const read = useMemo(() => initialPath ? FS.read(initialPath) : { success: true, content: '' }, [initialPath]);
  const draftKey = `draft:${initialPath || win.id}`;
  const [text, setText] = useState(() => getState<string>(draftKey, read.content || ''));
  const [savedText, setSavedText] = useState(read.content || '');
  const [path, setPath] = useState(initialPath);
  const [saveDialog, setSaveDialog] = useState(false);
  const [name, setName] = useState(initialPath ? basename(initialPath) : 'Untitled.txt');
  const [error, setError] = useState(read.success ? '' : read.message || 'Unable to read this file.');
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [line, setLine] = useState({ line: 1, column: 1 });
  const editor = useRef<HTMLTextAreaElement>(null);
  const dirty = text !== savedText;
  const save = () => {
    if (!path) { setError(''); setSaveDialog(true); return; }
    if (FS.write(path, text)) { setSavedText(text); saveState({ [draftKey]: text }); logEvent(`Saved ${path}`); actions.notify('Document saved', basename(path)); }
    else actions.notify('Unable to save', 'The file is read-only, no longer available, or storage is full. Your draft has not been written to the original file.');
  };
  const saveAs = () => {
    const finalName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.txt`;
    const result = FS.create(folderPath('Documents'), finalName, 'file', text);
    if (!result.success || !result.path) { setError(result.message); return; }
    setPath(result.path); setSavedText(text); setSaveDialog(false); setName(finalName); actions.updateArgs(win.id, { path: result.path });
    saveState({ [`draft:${result.path}`]: text }); actions.notify('Document saved', result.path);
  };
  const download = () => {
    if (nativeAvailable()) { if (!path || dirty) { actions.notify('Save the document first', 'Save your changes before exporting through Android.'); return; } const result = FS.export(path); actions.notify(result.success ? 'Export document' : 'Export unavailable', result.message || 'Choose an Android destination.'); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="notepad-layout" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } }}><div className="notepad-toolbar"><span className="notepad-name"><FileText size={15} />{name}{dirty && <i title="Unsaved changes" />}</span><div><IconButton title="Save document (Ctrl+S)" onClick={save}><Save size={16} /></IconButton><IconButton title="Save a copy" onClick={() => { setError(''); setSaveDialog(true); }}><Copy size={16} /></IconButton><IconButton title={nativeAvailable() ? 'Export through Android' : 'Download document'} onClick={download}><Download size={16} /></IconButton><span className="toolbar-divider" /><select aria-label="Editor font size" value={fontSize} onChange={event => setFontSize(Number(event.target.value))}>{[12, 14, 16, 18, 20].map(size => <option key={size} value={size}>{size}px</option>)}</select></div></div>{!read.success && <p className="editor-error">{read.message} The original content was not loaded.</p>}<textarea ref={editor} className={`notepad-editor ${wordWrap ? '' : 'no-wrap'}`} aria-label="Document content" spellCheck={false} style={{ fontSize }} value={text} onChange={event => { setText(event.target.value); if (!saveState({ [draftKey]: event.target.value })) setError('Local draft storage is unavailable. Save or download your document.'); }} onSelect={() => { const el = editor.current; if (!el) return; const lines = text.slice(0, el.selectionStart).split('\n'); setLine({ line: lines.length, column: lines[lines.length - 1].length + 1 }); }} placeholder="A little space for your next idea..." /><div className="notepad-statusbar"><span>Ln {line.line}, Col {line.column}</span><span>{text.length} characters</span><button onClick={() => setWordWrap(value => !value)}>Word wrap: {wordWrap ? 'On' : 'Off'}<ChevronDown size={10} /></button><span>{error ? 'Storage warning' : dirty ? 'Draft saved locally' : 'Saved'}</span><span>UTF-8</span></div><AnimatePresence>{saveDialog && <Modal title="Save your document" onClose={() => setSaveDialog(false)} actions={<><button className="secondary-button" onClick={() => setSaveDialog(false)}>Cancel</button><button className="primary-button" onClick={saveAs}><Save size={14} />Save</button></>}><form onSubmit={event => { event.preventDefault(); saveAs(); }}><label className="field-label" htmlFor={`save-name-${win.id}`}>File name</label><input className="text-input" id={`save-name-${win.id}`} value={name} onChange={event => setName(event.target.value)} onFocus={event => event.target.select()} /><p className="field-hint"><FolderOpen size={13} />{folderPath('Documents') || 'No writable Documents folder is exposed'}</p>{error && <p className="form-error">{error}</p>}</form></Modal>}</AnimatePresence></div>;
}

export function ImageViewer({ win, actions }: UtilityProps) {
  const file = FS.find(win.args?.path || '');
  const [failed, setFailed] = useState(false);
  const source = file?.previewUrl || (file?.content && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(file.content) ? file.content : null);
  return <div className="image-viewer">{source && !failed ? <img src={source} alt={file?.name || 'Image'} onError={() => setFailed(true)} /> : <EmptyState icon={<ColorIcon kind="picture" size={60} />} title="Image preview unavailable" description="The image is missing, permission was revoked, or the provider cannot serve this image."><button className="secondary-button" onClick={() => actions.open('explorer', { path: file ? parentPath(file.path) : '' })}>Open location<ArrowRight size={14} /></button></EmptyState>}</div>;
}