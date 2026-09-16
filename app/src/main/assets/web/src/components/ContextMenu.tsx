import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FileText, Folder, FolderPlus, Info, Monitor, Package, Palette, Pin, Play, RefreshCw, Settings2, Trash2, Type, Wine } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { folderPath, FS, operation, parentPath } from '../lib/desktop';

function MenuItem({ icon, children, action, danger = false, disabled = false }: { icon: ReactNode; children: ReactNode; action: () => void; danger?: boolean; disabled?: boolean }) {
  const { setContextMenu } = useDesktop();
  return <button role="menuitem" className={danger ? 'danger-text' : ''} disabled={disabled} onClick={() => { action(); setContextMenu(null); }}>{icon}<span>{children}</span></button>;
}
export function ContextMenu() {
  const { contextMenu, setContextMenu, openSystem, openFile, launchApp, refreshHost, showToast, pinnedIds, taskbarPinIds, shortcutIds, togglePin, toggleTaskbarPin, toggleShortcut, requestDialog } = useDesktop();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!contextMenu || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: Math.max(8, Math.min(contextMenu.x, innerWidth - rect.width - 8)), y: Math.max(8, Math.min(contextMenu.y, innerHeight - rect.height - 8)) });
  }, [contextMenu]);
  useEffect(() => {
    if (!contextMenu) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setContextMenu(null); };
    const resize = () => setContextMenu(null);
    window.addEventListener('pointerdown', dismiss); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', resize); if (document.activeElement === document.body) previous?.focus(); };
  }, [contextMenu, setContextMenu]);
  if (!contextMenu) return null;
  const app = contextMenu.app;
  const file = contextMenu.file;
  return <motion.div ref={ref} className="context-menu acrylic" role="menu" aria-label={app ? `${app.displayName} menu` : file ? `${file.name} menu` : 'Desktop menu'} style={{ left: position.x, top: position.y, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto' }} initial={{ opacity: 0, scale: .97, y: -3 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .13 }} onPointerDown={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    const nodes = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); setContextMenu(null); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); nodes[(index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus(); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); nodes[event.key === 'Home' ? 0 : nodes.length - 1]?.focus(); }
    if (event.key === 'Tab') setContextMenu(null);
  }}>
    {contextMenu.kind === 'app' && app ? <>
      <MenuItem icon={<Play size={15} />} disabled={!app.isLaunchable} action={() => launchApp(app)}>Open</MenuItem><div className="menu-divider" />
      <MenuItem icon={<Pin size={15} />} action={() => togglePin(app)}>{pinnedIds.includes(app.id) ? 'Unpin from Start' : 'Pin to Start'}</MenuItem>
      <MenuItem icon={<Pin size={15} />} action={() => toggleTaskbarPin(app)}>{taskbarPinIds.includes(app.id) ? 'Unpin from taskbar' : 'Pin to taskbar'}</MenuItem>
      <MenuItem icon={<Monitor size={15} />} action={() => toggleShortcut(app)}>{shortcutIds.includes(app.id) ? 'Remove desktop shortcut' : 'Create desktop shortcut'}</MenuItem>
      {app.capabilities?.appSettings && <MenuItem icon={<Settings2 size={15} />} action={() => { const response = operation('openApplicationSettings', app.id); if (!response.success) showToast('Android settings unavailable', response.message || 'The native operation failed.'); }}>Android app settings</MenuItem>}
      <div className="menu-divider" /><MenuItem icon={<Info size={15} />} action={() => requestDialog({ kind: 'app-properties', app })}>Properties & shortcut name</MenuItem>
      {app.capabilities?.uninstall && <MenuItem icon={<Trash2 size={15} />} danger action={() => requestDialog({ kind: 'uninstall', app })}>Uninstall through Android</MenuItem>}
    </> : contextMenu.kind === 'file' && file ? <>
      <MenuItem icon={<Folder size={15} />} action={() => openFile(file)}>Open</MenuItem>
      <MenuItem icon={<Monitor size={15} />} action={() => openSystem('explorer', { path: parentPath(file.path) })}>Open location</MenuItem>
      {file.capabilities?.rename && <MenuItem icon={<Type size={15} />} action={() => requestDialog({ kind: 'rename-file', file })}>Rename</MenuItem>}
      {file.capabilities?.delete && <MenuItem icon={<Trash2 size={15} />} danger action={() => requestDialog({ kind: 'delete-file', file })}>{file.capabilities.trash ? 'Move to Recycle Bin' : 'Delete permanently'}</MenuItem>}
      <div className="menu-divider" /><MenuItem icon={<Info size={15} />} action={() => requestDialog({ kind: 'file-properties', file })}>Properties</MenuItem>
    </> : contextMenu.kind === 'pc' ? <>
      <MenuItem icon={<Monitor size={15} />} action={() => openSystem('explorer', { path: '' })}>Open This PC</MenuItem>
      <MenuItem icon={<Info size={15} />} action={() => openSystem('settings', { tab: 'general' })}>System properties</MenuItem>
    </> : <>
      {folderPath('Desktop') && FS.find(folderPath('Desktop'))?.capabilities?.create && <MenuItem icon={<FolderPlus size={15} />} action={() => requestDialog({ kind: 'new-folder', path: folderPath('Desktop') })}>New folder</MenuItem>}
      <MenuItem icon={<RefreshCw size={15} />} action={refreshHost}>Refresh desktop & applications</MenuItem><div className="menu-divider" />
      <MenuItem icon={<Package size={15} />} action={() => openSystem('apps')}>Applications</MenuItem>
      <MenuItem icon={<Package size={15} />} action={() => openSystem('store')}>Install / repair real software</MenuItem>
      <MenuItem icon={<Folder size={15} />} action={() => openSystem('explorer', { path: 'Home' })}>Open File Explorer</MenuItem>
      <MenuItem icon={<FileText size={15} />} action={() => openSystem('notepad')}>Open Notepad</MenuItem><div className="menu-divider" />
      <MenuItem icon={<Palette size={15} />} action={() => openSystem('settings', { tab: 'appearance' })}>Personalization</MenuItem>
      <MenuItem icon={<Wine size={15} />} action={() => openSystem('settings', { tab: 'runtime' })}>Compatibility runtime</MenuItem>
    </>}
  </motion.div>;
}