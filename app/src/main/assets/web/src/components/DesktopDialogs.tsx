import { useState } from 'react';
import { ArrowRight, Folder, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { useDesktop, type DesktopDialog } from '../context/DesktopContext';
import { ApplicationDetails } from './Applications';
import { LockScreen } from './LockScreen';
import { ColorIcon } from './Icons';
import { Modal } from './Shared';
import { fileIcon, formatBytes, FS, operation } from '../lib/desktop';

export function DesktopDialogs() {
  const { dialog } = useDesktop();
  if (!dialog) return null;
  return <DialogContent key={`${dialog.kind}:${'file' in dialog ? dialog.file.path : 'app' in dialog ? dialog.app?.id : ''}`} dialog={dialog} />;
}
function DialogContent({ dialog }: { dialog: Exclude<DesktopDialog, null> }) {
  const { setDialog, showToast, restartDesktop, openSystem } = useDesktop();
  const [name, setName] = useState(dialog.kind === 'rename-file' ? dialog.file.name : 'New Folder');
  const [error, setError] = useState('');
  const close = () => setDialog(null);
  if (dialog.kind === 'app-properties') return <ApplicationDetails app={dialog.app} onClose={close} />;
  if (dialog.kind === 'lock') return <LockScreen />;
  if (dialog.kind === 'restart') return <Modal title="Restart WIN12 desktop?" onClose={close} actions={<><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={restartDesktop}><RefreshCw size={14} />Restart desktop</button></>}><p>Your windows and preferences will be saved before WIN12 reloads. This does not reboot Android or close external applications.</p></Modal>;
  if (dialog.kind === 'uninstall') return <Modal title={`Remove ${dialog.app.displayName}?`} onClose={close} actions={<><button className="secondary-button" onClick={close}>Cancel</button><button className="danger-button" onClick={() => { const response = operation('uninstallApplication', dialog.app.id); if (!response.success) { setError(response.message || 'Android rejected this request.'); return; } showToast('Confirm removal in Android', response.message || 'The app remains installed until Android confirms removal.'); close(); }}>Continue in Android</button></>}><p>Android will ask you to confirm. WIN12 will refresh discovery when you return; it will not mark the app uninstalled before native confirmation.</p>{error && <p className="form-error">{error}</p>}</Modal>;
  if (dialog.kind === 'runtime') return <Modal title="Compatibility runtime" onClose={close} actions={<><button className="secondary-button" onClick={() => { close(); openSystem('logs', { appId: 'system' }); }}>View logs</button><button className="primary-button" onClick={() => { close(); openSystem('settings', { tab: 'runtime' }); }}>Runtime availability<ArrowRight size={14} /></button></>}><div className="runtime-dialog-content"><span className="runtime-required-icon"><ShieldAlert size={32} /></span><h2>{dialog.title}</h2><p>{dialog.message}</p></div></Modal>;
  if (dialog.kind === 'file-properties') {
    const file = FS.find(dialog.file.path);
    return <Modal title="File properties" onClose={close} actions={<button className="primary-button" onClick={close}>Close</button>}>{file ? <div className="file-properties"><ColorIcon kind={fileIcon(file)} size={48} /><h4>{file.name}</h4><dl><dt>Location</dt><dd>{file.path}</dd><dt>Type</dt><dd>{file.mimeType || file.type}</dd><dt>Size</dt><dd>{formatBytes(file.size)}</dd><dt>Modified</dt><dd>{file.modified ? new Date(file.modified).toLocaleString() : 'Unavailable'}</dd><dt>Permissions</dt><dd>{Object.entries(file.capabilities || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'Unavailable'}</dd></dl></div> : <p>This item is no longer accessible. Refresh the desktop to update its shortcut.</p>}</Modal>;
  }
  const deleting = dialog.kind === 'delete-file';
  const permanent = deleting && !dialog.file.capabilities?.trash;
  const title = dialog.kind === 'new-folder' ? 'Create a desktop folder' : dialog.kind === 'rename-file' ? 'Rename file' : permanent ? 'Delete permanently?' : 'Move to Recycle Bin?';
  const submit = () => {
    setError('');
    if (dialog.kind === 'new-folder') { const response = FS.create(dialog.path, name, 'directory'); if (!response.success) { setError(response.message); return; } showToast('Folder created', name.trim()); }
    else if (dialog.kind === 'rename-file') { if (!FS.rename(dialog.file.path, name)) { setError('Could not rename this item. Check its name, permissions, and availability.'); return; } showToast('Item renamed', name.trim()); }
    else if (dialog.kind === 'delete-file') { if (!FS.remove(dialog.file.path)) { setError('The provider did not delete this item.'); return; } showToast(permanent ? 'Item deleted' : 'Moved to Recycle Bin', dialog.file.name); }
    window.dispatchEvent(new Event('win12-files-changed')); close();
  };
  return <Modal title={title} onClose={close} actions={<><button className="secondary-button" onClick={close}>Cancel</button><button className={deleting ? 'danger-button' : 'primary-button'} onClick={submit}>{deleting ? permanent ? 'Delete permanently' : 'Move to Recycle Bin' : dialog.kind === 'rename-file' ? 'Rename' : 'Create folder'}</button></>}>
    {deleting ? <><p>{permanent ? 'This provider deletes permanently. You will not be able to restore the item from WIN12.' : 'You can restore this item later from the WIN12 Recycle Bin.'}</p><p className="delete-file-name"><Info size={15} />{dialog.file.name}</p></> : <form onSubmit={event => { event.preventDefault(); submit(); }}><label className="field-label" htmlFor="desktop-item-name">Name</label><input id="desktop-item-name" className="text-input" value={name} onChange={event => setName(event.target.value)} onFocus={event => event.target.select()} maxLength={240} autoComplete="off" /><p className="field-hint"><Folder size={13} />{dialog.kind === 'new-folder' ? dialog.path : dialog.file.path}</p></form>}{error && <p className="form-error">{error}</p>}
  </Modal>;
}