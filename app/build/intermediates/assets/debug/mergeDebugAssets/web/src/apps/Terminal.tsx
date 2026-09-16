import { useEffect, useRef, useState } from 'react';
import { Copy, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { basename, folderPath, FS, getState, joinPath, Native, nativeAvailable, parentPath, saveState, USER_ROOT, type DesktopWindow } from '../lib/desktop';

import { IconButton } from '../components/Shared';

const BANNER = 'WIN12 Terminal\nDesktop command interface / not an Android root shell\nType help for supported commands. No system state is simulated.\n';
function tokenize(raw: string) { return (raw.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g) || []).map(part => part.replace(/^(["'])(.*)\1$/, '$2')); }
export function TerminalApp({ win }: { win: DesktopWindow }) {
  const desktop = useDesktop();
  const { profile } = desktop;
  const [cwd, setCwd] = useState(win.args?.path || USER_ROOT);
  const [lines, setLines] = useState<string[]>([BANNER]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => { const stored = getState<unknown>('terminal.history', []); return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(-50) : []; });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [lines]);
  const resolve = (path: string) => {
    if (/^[\w-]+:\//.test(path)) return path;
    let current = path.startsWith('/') ? USER_ROOT : cwd;
    for (const segment of path.split('/').filter(Boolean)) { if (segment === '.') continue; if (segment === '..') current = parentPath(current) || USER_ROOT; else current = joinPath(current, segment); }
    return current;
  };
  const run = async (raw: string) => {
    const [command = '', ...args] = tokenize(raw.trim());
    const argument = args.join(' ');
    const output: string[] = [`${cwd}> ${raw}`];
    if (raw.trim()) { const next = [...history.filter(item => item !== raw), raw].slice(-50); setHistory(next); saveState({ 'terminal.history': next }); }
    setHistoryIndex(-1); setInput('');
    try {
      switch (command.toLowerCase()) {
        case '': break;
        case 'help': output.push('help, dir/ls, cd, pwd, type/cat, mkdir, echo, date, time, ver,', 'hostname, whoami, apps, start/open, explorer, cls/clear', '', 'Paths use app:/ or browser:/ and granted SAF locations.', 'Use quotes for file or application names with spaces.', 'No root shell, arbitrary executables, or simulated Wine processes are provided.'); break;
        case 'clear': case 'cls': setLines([BANNER]); return;
        case 'echo': output.push(argument); break;
        case 'date': case 'time': output.push(new Date().toLocaleString()); break;
        case 'ver': case 'winver': output.push('WIN12 independent desktop shell / Android host or browser workspace.', `Host: ${Native.system().os}`); break;
        case 'hostname': output.push(`${profile.pcName} / native device: ${Native.system().device}`); break;
        case 'whoami': output.push(`${profile.displayName} (WIN12 display profile; no root privileges)`); break;
        case 'pwd': output.push(cwd); break;
        case 'cd': {
          const destination = !argument || argument === '~' ? USER_ROOT : resolve(argument);
          if (FS.find(destination)?.type !== 'directory' && !FS.roots().some(root => root.path === destination && root.available)) throw new Error('Directory unavailable or not granted.');
          setCwd(destination); desktop.actions.updateArgs(win.id, { path: destination }); break;
        }
        case 'ls': case 'dir': {
          const destination = argument ? resolve(argument) : cwd; const listing = FS.list(destination);
          if (listing.error) throw new Error(listing.error);
          output.push(`Directory of ${destination}`, ...listing.items.map(file => `${file.type === 'directory' || file.type === 'drive' ? '<DIR>' : '     '}  ${file.name}`), `${listing.items.length} items`); break;
        }
        case 'type': case 'cat': { if (!argument) throw new Error('Specify a file path.'); const response = FS.read(resolve(argument)); if (!response.success) throw new Error(response.message || 'Cannot read this file.'); if ((response.content || '').startsWith('data:image/')) throw new Error('This is an image. Open it in Photos.'); output.push((response.content || '').slice(0, 100_000)); break; }
        case 'mkdir': { if (!argument) throw new Error('Specify a folder name.'); const response = FS.create(cwd, argument, 'directory'); if (!response.success) throw new Error(response.message); output.push(`Created ${response.path}`); break; }
        case 'apps': output.push(...desktop.apps.filter(app => !argument || `${app.displayName} ${app.packageName || ''}`.toLowerCase().includes(argument.toLowerCase())).map(app => `${app.displayName} / ${app.launchType} / ${app.isLaunchable ? 'launchable' : 'unavailable'}`)); break;
        case 'start': case 'open': {
          if (!argument) throw new Error('Specify an application name, ID, or file path.');
          const app = desktop.apps.find(item => item.id === argument || item.displayName.toLowerCase() === argument.toLowerCase());
          if (app) { desktop.launchApp(app); output.push(app.isSystemApp ? `WIN12 window requested: ${app.displayName}` : 'Launch delegated to Android. Native feedback and process observation determine the result.'); }
          else { const file = FS.find(resolve(argument)); if (!file) throw new Error('No verified application or accessible file matches.'); desktop.openFile(file); output.push(`Open requested: ${file.name}`); }
          break;
        }
        case 'explorer': desktop.openSystem('explorer', { path: argument ? resolve(argument) : cwd }); break;
        case 'runtime': { const runtime = Native.runtime(); output.push(`Runtime: ${runtime.health}`, ...runtime.diagnostics); break; }
        default: output.push(`Unsupported command: ${command}`, 'Use help. Arbitrary OS commands are not executed by this interface.');
      }
    } catch (error) { output.push(`Error: ${error instanceof Error ? error.message : 'The operation failed.'}`); }
    setLines(previous => [...previous, ...output, ''].slice(-1500));
  };
  return <div className="terminal-app"><div className="terminal-toolbar"><span><TerminalIcon size={15} />WIN12 commands</span><small>{nativeAvailable() ? 'Permission-scoped Android access' : 'Browser documents only'}</small><IconButton title="Copy terminal output" onClick={async () => { try { await navigator.clipboard.writeText(lines.join('\n')); desktop.showToast('Output copied', 'Terminal text is on your clipboard.'); } catch { desktop.showToast('Clipboard unavailable', 'Select and copy the output manually.'); } }}><Copy size={15} /></IconButton><IconButton title="Clear terminal" onClick={() => setLines([BANNER])}><Trash2 size={15} /></IconButton></div><div className="terminal-output" tabIndex={0} onClick={event => { if (!(window.getSelection()?.toString()) && event.target === event.currentTarget) inputRef.current?.focus(); }}><pre>{lines.join('\n')}</pre><form onSubmit={event => { event.preventDefault(); void run(input); }}><span>{cwd}&gt;</span><input ref={inputRef} aria-label="WIN12 terminal command" autoComplete="off" spellCheck={false} autoCapitalize="off" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => {
    if (event.key === 'ArrowUp') { event.preventDefault(); const index = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1); setHistoryIndex(index); setInput(history[index] || ''); }
    if (event.key === 'ArrowDown') { event.preventDefault(); const index = historyIndex + 1; setHistoryIndex(index >= history.length ? -1 : index); setInput(history[index] || ''); }
    if (event.key === 'Tab') { event.preventDefault(); if (input.startsWith('cd ')) { const prefix = input.slice(3).toLowerCase(); const folders = FS.list(cwd).items.filter(item => item.type === 'directory' && item.name.toLowerCase().startsWith(prefix)); if (folders.length === 1) setInput(`cd "${basename(folders[0].path)}"`); } }
  }} /><button className="sr-only" type="submit">Run command</button></form><div ref={endRef} /></div><footer><span>UTF-8 / no shell emulation</span><button onClick={() => desktop.openSystem('explorer', { path: folderPath('Documents') })}>Open Documents</button></footer></div>;
}