import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDownAZ, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronRight, Clipboard, Copy, Download, FilePlus2, FileText, FolderPlus, Grid2X2, HardDrive, Home, Image, LayoutGrid, List, LockKeyhole, MoreHorizontal, PanelLeft, Pin, Plus, RefreshCw, Scissors, Search, ShieldCheck, Trash2, Type, Undo2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ColorIcon } from './Icons';
import { EmptyState, IconButton, Modal } from './Shared';
import { basename, capabilities, fileIcon, FOLDERS, folderPath, formatBytes, FS, getState, joinPath, nativeAvailable, normalizePath, operation, parentPath, RECYCLE_PATH, saveState, type DesktopActions, type DesktopWindow, type DirectoryResult, type FileItem } from '../lib/desktop';

interface Props { win: DesktopWindow; actions: DesktopActions }
type DialogType = 'folder' | 'file' | 'rename' | 'delete' | 'properties' | null;
export function Explorer({ win, actions }: Props) {
  const [history, setHistory] = useState<string[]>([win.kind === 'recycle' ? RECYCLE_PATH : normalizePath(win.args?.path ?? 'Home')]);
  const [index, setIndex] = useState(0);
  const path = history[index];
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<'new' | 'sort' | 'view' | 'more' | null>(null);
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<'list' | 'grid'>(getState('explorerView', 'list'));
  const [sort, setSort] = useState<'name' | 'modified' | 'type'>('name');
  const [dialog, setDialog] = useState<DialogType>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [clipboard, setClipboard] = useState<{ path: string; cut: boolean } | null>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [quickOpen, setQuickOpen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [recentOnly, setRecentOnly] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const native = nativeAvailable();
  const roots = useMemo(() => FS.roots(), [revision]);
  const isHome = path === 'Home', isPC = path === '', isGallery = path === 'Gallery', isRecycle = path === RECYCLE_PATH;
  const root = roots.find(r => r.path === path);
  const title = isHome ? 'Home' : isPC ? 'This PC' : isGallery ? 'Gallery' : isRecycle ? 'Recycle Bin' : root?.name || basename(path);
  const targetPath = isGallery ? folderPath('Pictures') : isHome ? folderPath('Documents') : path;
  const canCreate = !isPC && !isRecycle && Boolean(targetPath && FS.find(targetPath)?.capabilities?.create);
  const refresh = () => setRevision(v => v + 1);
  const navigate = (next: string, external = false) => {
    if (next === path) return;
    setHistory(previous => [...previous.slice(0, index + 1), next]); setIndex(index + 1);
    setSelected(null); setQuery(''); setMenu(null); setFileMenu(null); setRecentOnly(false);
    if (!external) actions.updateArgs(win.id, { path: next });
  };
  useEffect(() => { if (win.args?.path !== undefined) navigate(normalizePath(win.args.path), true); }, [win.args?.path]);
  useEffect(() => {
    window.addEventListener('win12-files-changed', refresh); window.addEventListener('win12-native-event', refresh);
    return () => { window.removeEventListener('win12-files-changed', refresh); window.removeEventListener('win12-native-event', refresh); };
  }, []);
  useEffect(() => {
    if (!menu && !fileMenu) return;
    const close = (e: PointerEvent) => { if (!commandRef.current?.contains(e.target as Node)) setMenu(null); if (!(e.target as HTMLElement).closest('.file-context-menu')) setFileMenu(null); };
    window.addEventListener('pointerdown', close); return () => window.removeEventListener('pointerdown', close);
  }, [menu, fileMenu]);
  const result: DirectoryResult = useMemo(() => {
    if (isHome) {
      const recent = getState<string[]>('recentFiles', []).map(p => FS.find(normalizePath(p))).filter((f): f is FileItem => Boolean(f && !f.originalPath));
      const documents = folderPath('Documents') ? FS.list(folderPath('Documents')).items.filter(f => f.type === 'file') : [];
      return { items: recentOnly ? recent : [...recent, ...documents.filter(f => !recent.some(r => r.path === f.path))].slice(0, 8) };
    }
    if (isGallery) return folderPath('Pictures') ? { items: FS.list(folderPath('Pictures')).items.filter(f => fileIcon(f) === 'picture') } : { items: [], error: 'No Pictures directory is exposed by this host.' };
    return FS.list(path);
  }, [path, revision, recentOnly]);
  const items = useMemo(() => result.items.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (b.type === 'directory' && a.type !== 'directory') return 1;
    return sort === 'modified' ? (b.modified || 0) - (a.modified || 0) : sort === 'type' ? a.type.localeCompare(b.type) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name);
  }), [result, query, sort]);
  const selectedItem = result.items.find(f => f.path === selected);
  const fileCaps = selectedItem?.capabilities || {};
  const permanentlyDeleting = isRecycle || !fileCaps.trash;
  const breadcrumbs = useMemo(() => {
    if (isHome || isPC || isGallery || isRecycle) return [{ name: title, path }];
    const parts = path.split('/').filter(Boolean);
    const rootPath = `${parts[0]}/`;
    return [{ name: roots.find(r => r.path === rootPath)?.name || parts[0], path: rootPath }, ...parts.slice(1).map((part, i) => ({ name: basename(part), path: parts.slice(0, i + 2).join('/') }))];
  }, [path, roots, title]);
  const requestStorage = () => { const response = operation('requestStorageLocation'); actions.notify(response.success ? 'Connect storage' : 'Storage unavailable', response.message || 'Choose a folder in Android.'); };
  const openItem = (file: FileItem) => {
    if (file.type !== 'file') navigate(file.path);
    else if (file.originalPath) actions.notify('Restore this file first', 'Files in the Recycle Bin must be restored before opening.');
    else { actions.openFile(file); refresh(); }
  };
  const openDialog = (type: DialogType) => { setDialog(type); setMenu(null); setFileMenu(null); setError(''); setName(type === 'rename' ? selectedItem?.name || '' : type === 'folder' ? 'New Folder' : 'Untitled.txt'); };
  const submitDialog = (event?: FormEvent) => {
    event?.preventDefault();
    if (dialog === 'folder' || dialog === 'file') {
      const response = FS.create(targetPath, name, dialog === 'folder' ? 'directory' : 'file');
      if (!response.success) { setError(response.message); return; }
      const created = response.path || joinPath(targetPath, name.trim()); setSelected(created);
      actions.notify(dialog === 'folder' ? 'Folder created' : 'Document created', name.trim());
      if (dialog === 'file') { const file = FS.find(created); if (file) actions.openFile(file); }
    } else if (dialog === 'rename' && selected) {
      if (!FS.rename(selected, name)) { setError('The provider could not rename this item. Check its name and permissions.'); return; }
      setSelected(null);
    } else if (dialog === 'delete' && selected) {
      if (!FS.remove(selected)) { setError('The storage provider did not delete this item.'); return; }
      actions.notify(permanentlyDeleting ? 'Item deleted' : 'Moved to Recycle Bin', selectedItem?.name || 'Selected item'); setSelected(null);
    }
    refresh(); setDialog(null);
  };
  const restore = () => {
    if (selected && FS.restore(selected)) { actions.notify('Item restored', selectedItem?.name || 'File'); setSelected(null); refresh(); }
    else actions.notify('Could not restore', 'The original folder may be missing or may already contain an item with this name.');
    setFileMenu(null); setMenu(null);
  };
  const paste = () => {
    if (!clipboard) return;
    if (FS.copy(clipboard.path, targetPath, clipboard.cut)) { refresh(); actions.notify('File Explorer', clipboard.cut ? 'Item moved.' : 'Item copied.'); if (clipboard.cut) setClipboard(null); }
    else actions.notify('Transfer not completed', 'Check storage permissions and file names. Native file transfers are limited to 128 MB. A failed move can leave a completed copy; inspect both locations.');
  };
  const download = () => {
    if (!selectedItem || selectedItem.type !== 'file') return;
    if (native) { const response = FS.export(selectedItem.path); actions.notify(response.success ? 'Export file' : 'Export unavailable', response.message || 'Choose a destination in Android.'); }
    else {
      const content = selectedItem.content || '';
      const image = /^data:image\/(png|jpe?g|webp|gif);base64,/.test(content);
      const url = image ? content : URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = selectedItem.name; a.click();
      if (!image) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setMenu(null); setFileMenu(null);
  };
  const importFile = async (file: File) => {
    if (file.size > 1024 * 1024) { actions.notify('File too large', 'Browser imports are limited to 1 MB. On Android, connect the source folder instead.'); return; }
    const image = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (native && image) { actions.notify('Connect the image folder', 'Use Add storage location to access native image files without converting them to text.'); return; }
    if (!image && !/\.(txt|md|csv|json|log|xml|css|js|html)$/i.test(file.name)) { actions.notify('Unsupported import', 'Select a UTF-8 text document or an image.'); return; }
    try {
      const content = image ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }) : await file.text();
      const response = FS.create(targetPath, file.name, 'file', content, file.size);
      actions.notify(response.success ? 'File imported' : 'Import failed', response.success ? file.name : response.message); refresh();
    } catch { actions.notify('Import failed', 'The selected file could not be read.'); }
  };
  const goHistory = (offset: number) => { const next = index + offset; if (next < 0 || next >= history.length) return; setIndex(next); setSelected(null); setQuery(''); actions.updateArgs(win.id, { path: history[next] }); };
  const chooseView = (next: 'grid' | 'list') => { setView(next); saveState({ explorerView: next }); setMenu(null); };
  const itemActions = <>
    {selectedItem && !isRecycle && <button onClick={() => { openItem(selectedItem); setFileMenu(null); }}><ArrowRight size={15} />Open</button>}
    {fileCaps.copy && !isRecycle && <button onClick={() => { setClipboard({ path: selected!, cut: false }); setFileMenu(null); setMenu(null); }}><Copy size={15} />Copy</button>}
    {fileCaps.move && !isRecycle && <button onClick={() => { setClipboard({ path: selected!, cut: true }); setFileMenu(null); setMenu(null); }}><Scissors size={15} />Cut</button>}
    {fileCaps.rename && !isRecycle && <button onClick={() => openDialog('rename')}><Type size={15} />Rename</button>}
    {fileCaps.restore && <button onClick={restore}><Undo2 size={15} />Restore</button>}
    {selectedItem?.type === 'file' && fileCaps.read && !isRecycle && <button onClick={download}><Download size={15} />{native ? 'Export to Android' : 'Download'}</button>}
    {fileCaps.delete && <button onClick={() => openDialog('delete')}><Trash2 size={15} />{permanentlyDeleting ? 'Delete permanently' : 'Move to Recycle Bin'}</button>}
    <div className="menu-divider" /><button onClick={() => openDialog('properties')}><FileText size={15} />Properties</button>
  </>;

  return <div className="explorer-layout" ref={layoutRef} onKeyDown={e => {
    if ((e.target as HTMLElement).matches('input, textarea') || dialog) return;
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); if (canCreate) openDialog('folder'); }
    if (e.key === 'Delete' && fileCaps.delete) openDialog('delete');
    if (e.key === 'Enter' && selectedItem) openItem(selectedItem);
    if (e.key === 'F2' && fileCaps.rename) { e.preventDefault(); openDialog('rename'); }
    if (e.key === 'Escape') { setMenu(null); setFileMenu(null); }
  }}>
    <div className="explorer-navigation"><div className="navigation-arrows">
      <IconButton title="Back" disabled={index === 0} onClick={() => goHistory(-1)}><ArrowLeft size={16} /></IconButton><IconButton title="Forward" disabled={index === history.length - 1} onClick={() => goHistory(1)}><ArrowRight size={16} /></IconButton>
      <IconButton title="Up one level" disabled={isHome || isPC} onClick={() => navigate(isGallery || isRecycle ? 'Home' : parentPath(path))}><ArrowUp size={16} /></IconButton><IconButton title="Refresh" onClick={refresh}><RefreshCw size={14} /></IconButton>
    </div><div className="address-bar" onDoubleClick={() => { setAddress(path); setAddressEditing(true); }}>{isHome ? <Home size={15} className="blue-text" /> : <HardDrive size={15} className="muted" />}
      {addressEditing ? <form onSubmit={e => { e.preventDefault(); const next = normalizePath(address.trim()); if (['Home', 'Gallery', '', RECYCLE_PATH].includes(next) || FS.find(next)?.type === 'directory') { navigate(next); setAddressEditing(false); } else actions.notify('Location unavailable', 'Choose an accessible location or grant access through Android.'); }}><input autoFocus value={address} onChange={e => setAddress(e.target.value)} onBlur={() => setAddressEditing(false)} aria-label="Folder path" /></form> : <div className="breadcrumbs">{breadcrumbs.map(crumb => <span key={crumb.path}><ChevronRight size={12} /><button onClick={() => navigate(crumb.path)}>{crumb.name}</button></span>)}</div>}
      <button className="address-dropdown" aria-label="Edit folder path" onClick={() => { setAddress(path); setAddressEditing(v => !v); }}><ChevronDown size={13} /></button>
    </div><div className="explorer-search"><Search size={15} /><input aria-label={`Search ${title}`} placeholder={`Search ${title}`} value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}</div></div>
    <div className="explorer-commandbar" ref={commandRef}>
      <div className="command-anchor"><button className="command-button new-button" disabled={!canCreate} onClick={() => setMenu(menu === 'new' ? null : 'new')}><Plus size={18} /><span>New</span><ChevronDown size={11} /></button>{menu === 'new' && <div className="command-menu acrylic"><button onClick={() => openDialog('folder')}><FolderPlus size={16} />Folder</button><button onClick={() => openDialog('file')}><FilePlus2 size={16} />Text document</button><div className="menu-divider" /><button onClick={() => { setMenu(null); uploadRef.current?.click(); }}><Upload size={16} />Import file</button></div>}</div>
      <span className="toolbar-divider" /><IconButton title="Cut" disabled={!fileCaps.move || isRecycle} onClick={() => setClipboard({ path: selected!, cut: true })}><Scissors size={17} /></IconButton><IconButton title="Copy" disabled={!fileCaps.copy || isRecycle} onClick={() => setClipboard({ path: selected!, cut: false })}><Copy size={16} /></IconButton><IconButton title="Paste" disabled={!clipboard || !canCreate} onClick={paste}><Clipboard size={17} /></IconButton><IconButton title="Rename" disabled={!fileCaps.rename || isRecycle} onClick={() => openDialog('rename')}><Type size={18} /></IconButton><IconButton title={permanentlyDeleting ? 'Delete permanently' : 'Move to Recycle Bin'} disabled={!fileCaps.delete} onClick={() => openDialog('delete')}><Trash2 size={16} /></IconButton><span className="toolbar-divider" />
      <div className="command-anchor"><button className="command-button" onClick={() => setMenu(menu === 'sort' ? null : 'sort')}><ArrowDownAZ size={17} /><span>Sort</span><ChevronDown size={11} /></button>{menu === 'sort' && <div className="command-menu acrylic">{(['name', 'modified', 'type'] as const).map(value => <button key={value} onClick={() => { setSort(value); setMenu(null); }}>{sort === value ? <Check size={15} /> : <span className="menu-icon-space" />}{value === 'name' ? 'Name' : value === 'modified' ? 'Date modified' : 'Type'}</button>)}</div>}</div>
      <div className="command-anchor"><button className="command-button" onClick={() => setMenu(menu === 'view' ? null : 'view')}><Grid2X2 size={16} /><span>View</span><ChevronDown size={11} /></button>{menu === 'view' && <div className="command-menu acrylic"><button onClick={() => chooseView('list')}><List size={16} />Details</button><button onClick={() => chooseView('grid')}><LayoutGrid size={16} />Large icons</button><div className="menu-divider" /><button onClick={() => { setShowSidebar(v => !v); setMenu(null); }}><PanelLeft size={16} />Navigation pane</button></div>}</div>
      <span className="toolbar-divider last-divider" /><div className="command-anchor"><IconButton title="More options" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={21} /></IconButton>{menu === 'more' && <div className="command-menu acrylic">{selectedItem ? itemActions : <><button onClick={() => { refresh(); setMenu(null); }}><RefreshCw size={15} />Refresh folder</button>{capabilities().storagePicker && <button onClick={() => { requestStorage(); setMenu(null); }}><Plus size={15} />Add storage location</button>}</>}</div>}</div>
    </div>
    <input ref={uploadRef} className="hidden-input" type="file" accept={native ? '.txt,.md,.csv,.json,.log,.xml,.css,.js,.html' : '.txt,.md,.csv,.json,.log,.xml,.css,.js,.html,.png,.jpg,.jpeg,.gif,.webp'} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importFile(file); }} />
    <div className="explorer-body">{showSidebar && <aside className="explorer-sidebar"><nav>
      <button className={`explorer-nav-item ${isHome ? 'selected' : ''}`} onClick={() => navigate('Home')}><Home size={17} className="blue-text" /><span>Home</span></button><button className={`explorer-nav-item ${isGallery ? 'selected' : ''}`} onClick={() => navigate('Gallery')}><Image size={17} className="purple-text" /><span>Gallery</span></button><div className="sidebar-separator" />
      {FOLDERS.map(folder => <button key={folder.path} className={`explorer-nav-item folder-nav ${path === folder.path ? 'selected' : ''}`} onClick={() => navigate(folder.path)}><ColorIcon kind={folder.icon} color={folder.color} size={21} /><span>{folder.name}</span><Pin size={10} className="nav-pin" /></button>)}<div className="sidebar-separator" />
      <button className={`explorer-nav-item pc-nav ${isPC ? 'selected' : ''}`} onClick={() => navigate('')}><ChevronDown size={11} /><ColorIcon kind="computer" size={20} /><span>This PC</span></button>{roots.map(location => <button key={location.path} title={location.description} className={`explorer-nav-item nested ${path === location.path ? 'selected' : ''}`} onClick={() => navigate(location.path)}><HardDrive size={15} /><span>{location.name}</span></button>)}
      {isRecycle && <button className="explorer-nav-item selected" onClick={() => navigate(RECYCLE_PATH)}><Trash2 size={16} /><span>Recycle Bin</span></button>}
    </nav><div className="sidebar-workspace"><span className="workspace-device"><ShieldCheck size={17} /></span><div><span>{native ? 'Permission-scoped storage' : 'Browser documents'}</span><small>{native ? 'Only accessible locations' : 'Saved in this browser'}</small></div></div></aside>}
    <main className="explorer-main" ref={mainRef} tabIndex={0} onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div className="explorer-page-heading"><div><h1>{title}</h1><p>{isHome ? 'Your files, right where you need them.' : isPC ? 'Real locations available to WIN12.' : isRecycle ? 'Deleted WIN12 workspace files. Other providers may delete permanently.' : isGallery ? 'Images in your accessible Pictures folder.' : root?.description}</p></div>{isHome && <span className="home-decoration"><Home size={28} strokeWidth={1.25} /></span>}{isPC && capabilities().storagePicker && <button className="secondary-button" onClick={requestStorage}><Plus size={14} />Add location</button>}</div>
      {isHome && !query && FOLDERS.length > 0 && <section className="quick-access-section"><button className="section-heading" onClick={() => setQuickOpen(v => !v)}>{quickOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<h2>Quick access</h2></button><AnimatePresence initial={false}>{quickOpen && <motion.div className="quick-access-grid" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }}>{FOLDERS.map(folder => <button className="quick-folder" key={folder.path} onClick={() => navigate(folder.path)}><ColorIcon kind={folder.icon} color={folder.color} size={43} /><span className="quick-folder-info"><strong>{folder.name}</strong><small>{native ? 'WIN12 app storage' : 'Browser documents'}</small></span><Pin size={11} className="folder-pin" /></button>)}</motion.div>}</AnimatePresence></section>}
      {isHome && <div className="files-section-heading"><div className="section-heading"><ChevronDown size={14} /><h2>{query ? 'Search results' : recentOnly ? 'Recently opened' : 'Your documents'}</h2></div><button className="subtle-text-button" onClick={() => { setRecentOnly(v => !v); refresh(); }}>{recentOnly ? 'All documents' : 'Recent files'}<ChevronRight size={12} /></button></div>}
      {result.error ? <EmptyState icon={<LockKeyhole size={35} />} title="This location is unavailable" description={result.error}>{capabilities().storagePicker && <button className="primary-button" onClick={requestStorage}>Connect storage</button>}</EmptyState> : isPC ? <div className="storage-roots-list">{roots.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).map(location => <button key={location.path} className="storage-root" onDoubleClick={() => navigate(location.path)} onClick={() => setSelected(location.path)} onKeyDown={e => { if (e.key === 'Enter') navigate(location.path); }}><ColorIcon kind="drive" size={48} /><div><h3>{location.name}</h3><p>{location.description}</p>{typeof location.totalBytes === 'number' && typeof location.freeBytes === 'number' && location.totalBytes > 0 ? <><div className="storage-usage-bar"><span style={{ width: `${Math.min(100, Math.max(0, (location.totalBytes - location.freeBytes) / location.totalBytes * 100))}%` }} /></div><small>{formatBytes(location.freeBytes)} free of {formatBytes(location.totalBytes)}<span>{location.capacityScope}</span></small></> : <small>Capacity: unavailable{location.source === 'BROWSER' ? ' / browser-managed data, not a disk' : ' / provider does not report volume capacity'}</small>}</div><ChevronRight size={16} /></button>)}{!roots.length && <EmptyState icon={<HardDrive size={37} />} title="No storage locations exposed" description="Connect a folder through Android's system picker. No disk or directory is simulated." />}</div> : items.length === 0 ? <EmptyState icon={isRecycle ? <Trash2 size={36} /> : query ? <Search size={35} /> : <ColorIcon kind="folder" size={48} />} title={query ? 'No matching files' : isRecycle ? 'Nothing in the Recycle Bin' : recentOnly ? 'No recently opened documents' : 'Ready for your files'} description={query ? 'Try a different file name.' : isHome ? 'Create a document or import one. No example files are added to your workspace.' : 'This location does not contain any matching files.'}>{canCreate && !query && <button className="secondary-button" onClick={() => isGallery ? uploadRef.current?.click() : openDialog(isHome ? 'file' : 'folder')}><Plus size={15} />{isGallery ? 'Import image' : isHome ? 'New document' : 'New folder'}</button>}</EmptyState> : view === 'list' && !isGallery ? <div className="file-table" role="table" aria-label="Files"><div className="file-table-header" role="row"><button onClick={() => setSort('name')}>Name{sort === 'name' && <ArrowUp size={10} />}</button><button onClick={() => setSort('modified')}>Date modified</button><span>{isHome ? 'Location' : 'Type'}</span><span>Size</span></div>
        {items.map(file => <button className={`file-row ${selected === file.path ? 'selected' : ''}`} role="row" key={file.path} onClick={() => setSelected(file.path)} onDoubleClick={() => openItem(file)} onContextMenu={e => { e.preventDefault(); setSelected(file.path); const rect = layoutRef.current!.getBoundingClientRect(); setFileMenu({ x: Math.max(5, Math.min(e.clientX - rect.left, rect.width - 218)), y: Math.max(8, Math.min(e.clientY - rect.top, rect.height - 285)) }); }}><span className="file-name" role="cell"><ColorIcon kind={fileIcon(file)} size={29} /><span>{file.name}</span></span><span className="file-date" role="cell">{file.modified ? new Date(file.modified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unavailable'}</span><span className="file-type" role="cell">{isHome ? basename(parentPath(file.path)) : file.type === 'directory' ? 'File folder' : file.mimeType || (/\.txt$/i.test(file.name) ? 'Text document' : 'File')}</span><span className="file-size" role="cell">{file.type === 'file' ? formatBytes(file.size) : ''}</span></button>)}
      </div> : <div className="files-grid">{items.map(file => <button key={file.path} className={`file-tile ${selected === file.path ? 'selected' : ''}`} onClick={() => setSelected(file.path)} onDoubleClick={() => openItem(file)}>{file.previewUrl || file.content && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(file.content) ? <img className="file-thumbnail" src={file.previewUrl || file.content} alt="" /> : <ColorIcon kind={fileIcon(file)} size={57} />}<span>{file.name}</span>{file.type === 'file' && <small>{formatBytes(file.size)}</small>}</button>)}</div>}
    </main></div>
    <footer className="explorer-statusbar"><div><span>{items.length + (isHome && quickOpen && !query ? FOLDERS.length : 0)} items</span>{selectedItem && <><i /><span>1 selected</span></>}</div><span className="workspace-status"><ShieldCheck size={12} />{native ? 'Native storage' : 'Browser-managed documents'}</span><div className="status-view-buttons"><button title="Details view" className={view === 'list' ? 'active' : ''} onClick={() => chooseView('list')}><List size={14} /></button><button title="Large icons" className={view === 'grid' ? 'active' : ''} onClick={() => chooseView('grid')}><LayoutGrid size={13} /></button></div></footer>
    {fileMenu && selectedItem && <div className="command-menu acrylic file-context-menu" style={{ left: fileMenu.x, top: fileMenu.y, width: 210 }}>{itemActions}</div>}
    <AnimatePresence>{dialog && <Modal title={dialog === 'folder' ? 'Create a folder' : dialog === 'file' ? 'Create a document' : dialog === 'rename' ? 'Rename item' : dialog === 'properties' ? 'Properties' : permanentlyDeleting ? 'Delete permanently?' : 'Move to Recycle Bin?'} onClose={() => setDialog(null)} actions={dialog === 'properties' ? <button className="primary-button" onClick={() => setDialog(null)}>Close</button> : <><button className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className={dialog === 'delete' ? 'danger-button' : 'primary-button'} onClick={() => submitDialog()}>{dialog === 'delete' ? permanentlyDeleting ? 'Delete permanently' : 'Move to Recycle Bin' : dialog === 'rename' ? 'Rename' : 'Create'}</button></>}>
      {dialog === 'properties' && selectedItem ? <div className="file-properties"><ColorIcon kind={fileIcon(selectedItem)} size={45} /><h4>{selectedItem.name}</h4><dl><dt>Location</dt><dd>{selectedItem.path}</dd><dt>Type</dt><dd>{selectedItem.mimeType || selectedItem.type}</dd><dt>Size</dt><dd>{formatBytes(selectedItem.size)}</dd><dt>Modified</dt><dd>{selectedItem.modified ? new Date(selectedItem.modified).toLocaleString() : 'Unavailable'}</dd><dt>Access</dt><dd>{Object.entries(fileCaps).filter(([, allowed]) => allowed).map(([key]) => key).join(', ') || 'Read-only or unavailable'}</dd></dl></div> : dialog === 'delete' ? <p>{permanentlyDeleting ? 'This provider will permanently delete this item. It cannot be restored from WIN12.' : 'This item can be restored later from the WIN12 Recycle Bin.'}<br /><strong>{selectedItem?.name}</strong></p> : <form onSubmit={submitDialog}><label className="field-label" htmlFor={`file-name-${win.id}`}>Name</label><input id={`file-name-${win.id}`} className="text-input" value={name} onChange={e => setName(e.target.value)} onFocus={e => e.target.select()} autoComplete="off" /><p className="field-hint">In {targetPath}</p></form>}{error && <p className="form-error">{error}</p>}
    </Modal>}</AnimatePresence>
  </div>;
}