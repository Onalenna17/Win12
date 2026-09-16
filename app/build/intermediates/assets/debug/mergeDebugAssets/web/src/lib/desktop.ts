export type AppKind = 'explorer' | 'installer' | 'apps' | 'settings' | 'recycle' | 'logs' | 'taskmgr' | 'notepad' | 'image' | 'paint' | 'photos' | 'store' | 'terminal';
export type IconKind = AppKind | 'computer' | 'folder' | 'download' | 'document' | 'picture' | 'music' | 'video' | 'drive' | 'windows';
export type LaunchType = 'ANDROID_PACKAGE' | 'WINDOWS_EXECUTABLE' | 'WEB_APPLICATION' | 'INTERNAL_WIN12_APPLICATION';
export type RunningState = 'RUNNING' | 'STOPPED' | 'UNKNOWN';
export interface DesktopApp {
  id: string; displayName: string; name?: string; architecture?: string; runtime?: string; status?: string;
  isSystemApp?: boolean; systemAppType?: string; desktopShortcut?: boolean; executablePath?: string; lastRun?: number;
  packageName?: string; applicationId?: string; versionName?: string; versionCode?: number;
  launchType?: LaunchType; launchIntent?: string; iconUrl?: string; iconSource?: string; description?: string; sourceDir?: string;
  isInstalled?: boolean; isLaunchable?: boolean; verified?: boolean; runningState?: RunningState; runningEvidence?: string; observedAt?: number;
  capabilities?: { uninstall?: boolean; appSettings?: boolean; stop?: boolean; repair?: boolean };
  metadata?: Record<string, unknown>;
}
export interface Bounds { x: number; y: number; width: number; height: number }
export interface DesktopWindow extends Bounds {
  id: string; kind: AppKind; title: string; icon: IconKind; z: number; minimized: boolean; maximized: boolean;
  snap: string; previous?: Bounds; args?: Record<string, string>;
}
export interface FileCapabilities { read?: boolean; write?: boolean; create?: boolean; rename?: boolean; delete?: boolean; copy?: boolean; move?: boolean; trash?: boolean; restore?: boolean }
export interface FileItem {
  name: string; path: string; type: 'directory' | 'file' | 'drive' | 'drive-locked'; modified?: number; size?: number;
  content?: string; originalPath?: string; previewUrl?: string; mimeType?: string; capabilities?: FileCapabilities;
}
export interface StorageRoot extends FileItem {
  source: 'APP_PRIVATE' | 'APP_EXTERNAL' | 'SAF' | 'BROWSER' | 'RUNTIME'; available: boolean; canWrite: boolean;
  totalBytes?: number | null; freeBytes?: number | null; description?: string; capacityScope?: string;
}
export interface Capabilities {
  version: number; applicationDiscovery: boolean; androidLaunch: boolean; storage: boolean; storagePicker: boolean;
  fileOperations: boolean; systemState: boolean; mediaVolume: boolean; deviceLock: boolean; notificationAccess: boolean;
  storeSearch: boolean; runtimeInstall: boolean; windowsExecution: boolean; externalEmbedding: boolean; externalWeb: boolean; desktopSounds: boolean; orientationControl: boolean; softwareSources: boolean; imageWrite: boolean; shutdown: boolean; reboot: boolean;
}
export interface SystemState {
  source: 'ANDROID_NATIVE' | 'BROWSER'; observedAt: number;
  battery: { percent: number; charging: boolean } | null;
  network: { connected: boolean; validated: boolean | null; transport: string } | null;
  wifi?: { enabled: boolean; connected: boolean } | null;
  airplaneMode?: boolean | null;
  volume: { percent: number; muted: boolean; canSet: boolean; stream: string } | null;
  bluetooth: { enabled: boolean } | null; brightness: number | null;
  lock: { supported: boolean; enabled: boolean; canLock: boolean; deviceSecure: boolean };
  notifications: { accessGranted: boolean; connected: boolean; count?: number | null };
}
export interface OperationResult { success: boolean; message?: string; code?: string; pending?: boolean; path?: string; content?: string; trashed?: boolean }
export interface ApplicationSnapshot {
  apps: DesktopApp[]; status: 'READY' | 'DISCOVERING' | 'UNAVAILABLE' | 'ERROR'; message: string;
  scannedAt: number; revision: number; scope: string; runningVisibility: string;
}
export interface RuntimeStatus {
  state: string; health: string; wineInstalled: boolean; box64Installed: boolean; box86Installed: boolean;
  systemArch: string; runtimeVersion: string; diagnostics: string[]; winePath?: string; box64Path?: string;
}
export interface NativeProgress {
  step: string; message?: string; error?: string; progressPercent?: number; app?: DesktopApp; appId?: string;
  status?: string; granted?: boolean; success?: boolean;
}
export interface SystemInfo {
  os: string; apiLevel?: number; device: string; primaryAbi: string; totalMemory?: number; freeMemory?: number;
  maxMemory?: number; storageBreakdown?: Record<string, number>;
}
export interface NativeProcess { applicationId: string; pid: number; status: string; startTime: number; canStop?: boolean }
export interface DesktopBridgeAPI {
  onNativeEvent: (eventName: string, data: NativeProgress | string) => void;
  handleBackButton: () => void; handleEscapeKey: () => void; openExplorer: (path?: string) => void;
  openInstallerWizard: () => void; openAppManager: () => void; openSettings: (tab?: string) => void;
  openLogViewer: (appId?: string) => void; openTaskManager: () => void; handleAppLaunch: (app: DesktopApp) => void;
  closeWindow: (id: string) => void; setWallpaper: (id: string) => void; startRuntimeInstall: () => void;
  cancelRuntimeInstall: () => unknown; uninstallRuntime: () => void; clearAllLogs: () => void; refreshApplications?: () => void;
}
type NativeHost = Record<string, ((...args: unknown[]) => unknown) | undefined>;
declare global { interface Window { Win12Native?: NativeHost; Win12Desktop?: DesktopBridgeAPI } }

export function nativeAvailable() { return typeof window.Win12Native !== 'undefined'; }
export function hasNativeMethod(method: string) { return typeof window.Win12Native?.[method] === 'function'; }
export function nativeCall<T>(method: string, args: unknown[], fallback: T): T {
  try {
    const fn = window.Win12Native?.[method];
    if (!fn) return fallback;
    const result = fn.apply(window.Win12Native, args);
    if (typeof result === 'string') { try { return JSON.parse(result) as T; } catch { return result as T; } }
    return result === undefined ? fallback : result as T;
  } catch (error) { console.error(`Win12 bridge: ${method}`, error); return fallback; }
}
function nativeRecord<T extends object>(method: string, fallback: T): T {
  const data = nativeCall<Partial<T> | null>(method, [], null);
  return data && typeof data === 'object' && !Array.isArray(data) ? { ...fallback, ...data } : fallback;
}
function validApps(value: unknown): DesktopApp[] {
  return Array.isArray(value) ? value.filter((app): app is DesktopApp => Boolean(app) && typeof app.id === 'string' && typeof app.displayName === 'string') : [];
}
export const NO_CAPABILITIES: Capabilities = { version: 0, applicationDiscovery: false, androidLaunch: false, storage: false, storagePicker: false, fileOperations: false, systemState: false, mediaVolume: false, deviceLock: false, notificationAccess: false, storeSearch: false, runtimeInstall: false, windowsExecution: false, externalEmbedding: false, externalWeb: false, desktopSounds: false, orientationControl: false, softwareSources: false, imageWrite: false, shutdown: false, reboot: false };
export function capabilities(): Capabilities {
  const data = nativeCall<Partial<Capabilities> | null>('getCapabilities', [], null);
  const localProvisioned = getState<RuntimeStatus | null>('provisionedRuntime', null);
  const base = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(NO_CAPABILITIES).map(([key, fallback]) => [key, key === 'version' ? Number.isInteger(data.version) ? data.version : 0 : data[key as keyof Capabilities] === true ? true : fallback])) as unknown as Capabilities
    : { ...NO_CAPABILITIES, runtimeInstall: true, softwareSources: true, externalWeb: true };
  if (localProvisioned?.wineInstalled) {
    base.windowsExecution = true;
    base.runtimeInstall = true;
  }
  return base;
}
export function operation(method: string, ...args: unknown[]): OperationResult {
  const response = nativeCall<OperationResult | boolean>(method, args, { success: false, message: 'This operation is unavailable in the current host.', code: 'UNSUPPORTED' });
  return response === true ? { success: true } : response && typeof response === 'object' && typeof response.success === 'boolean' ? response : { success: false, message: 'The native host returned an invalid operation result.', code: 'INVALID_RESPONSE' };
}
export function appTypeLabel(app: DesktopApp) {
  return app.isSystemApp ? 'Embedded WIN12 app' : app.launchType === 'ANDROID_PACKAGE' ? 'External Android app' : app.launchType === 'WINDOWS_EXECUTABLE' ? 'Windows runtime app' : app.launchType === 'WEB_APPLICATION' ? 'External web app' : 'Unverified application';
}
export function appSearch(app: DesktopApp, query: string) { return [app.displayName, app.name, app.packageName, app.versionName, app.executablePath, app.description].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()); }

const STORAGE_KEY = 'win12.react.desktop.v1';
let stateCache: Record<string, unknown> | undefined;
function loadState() {
  if (stateCache) return stateCache;
  let local: Record<string, unknown> = {};
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) local = parsed; } catch { /* Storage may be disabled by the browser. */ }
  const bridged = nativeCall<Record<string, unknown> | null>('loadDesktopState', [], null);
  stateCache = { ...local, ...(bridged && typeof bridged === 'object' && !Array.isArray(bridged) ? bridged : {}) };
  return stateCache;
}
export function getState<T>(key: string, fallback: T): T { const state = loadState(); return key in state ? state[key] as T : fallback; }
export function saveState(partial: Record<string, unknown>) {
  const next = { ...loadState(), ...partial };
  const serialized = JSON.stringify(next);
  let localSaved = false;
  try { localStorage.setItem(STORAGE_KEY, serialized); localSaved = true; } catch (error) { console.error('Win12 storage', error); }
  const nativeSaved = hasNativeMethod('saveDesktopState') && nativeCall<boolean>('saveDesktopState', [serialized], false) === true;
  if (localSaved || nativeSaved) stateCache = next;
  return localSaved || nativeSaved;
}

export const SYSTEM_APPS: (DesktopApp & { kind: AppKind; icon: IconKind; description: string })[] = [
  { id: 'explorer', displayName: 'File Explorer', kind: 'explorer', icon: 'explorer', description: 'Browse your accessible files', isSystemApp: true },
  { id: 'installer', displayName: 'Installer Inspector', kind: 'installer', icon: 'installer', description: 'Inspect Windows package headers safely', isSystemApp: true },
  { id: 'apps', displayName: 'Applications', kind: 'apps', icon: 'apps', description: 'Discover and manage real applications', isSystemApp: true },
  { id: 'settings', displayName: 'Settings', kind: 'settings', icon: 'settings', description: 'Personalize your desktop', isSystemApp: true },
  { id: 'logs', displayName: 'Log Viewer', kind: 'logs', icon: 'logs', description: 'Actual WIN12 activity and diagnostics', isSystemApp: true },
  { id: 'taskmgr', displayName: 'Task Manager', kind: 'taskmgr', icon: 'taskmgr', description: 'Observed processes and desktop windows', isSystemApp: true },
  { id: 'notepad', displayName: 'Notepad', kind: 'notepad', icon: 'notepad', description: 'Edit and save your text files', isSystemApp: true },
  { id: 'recycle', displayName: 'Recycle Bin', kind: 'recycle', icon: 'recycle', description: 'Restore deleted WIN12 workspace files', isSystemApp: true },
  { id: 'paint', displayName: 'Paint', kind: 'paint', icon: 'paint', description: 'Draw and save real PNG images', isSystemApp: true },
  { id: 'photos', displayName: 'Photos', kind: 'photos', icon: 'photos', description: 'Your pictures and original HD wallpapers', isSystemApp: true },
  { id: 'store', displayName: 'Software Center', kind: 'store', icon: 'store', description: 'Official Chrome, Deriv MT5, and MetaEditor setup', isSystemApp: true },
  { id: 'terminal', displayName: 'Terminal', kind: 'terminal', icon: 'terminal', description: 'Commands for real WIN12 files and applications', isSystemApp: true },
].map(app => ({ ...app, launchType: 'INTERNAL_WIN12_APPLICATION', isInstalled: true, isLaunchable: true, verified: true })) as (DesktopApp & { kind: AppKind; icon: IconKind; description: string })[];

export const Native = {
  apps: () => validApps(nativeCall<DesktopApp[]>('getInstalledApps', [], [])),
  shortcuts: () => validApps(nativeCall<DesktopApp[]>('getDesktopShortcuts', [], [])),
  pinned: () => validApps(nativeCall<DesktopApp[]>('getPinnedApps', [], [])),
  search: (query: string): DesktopApp[] => Native.apps().filter(app => appSearch(app, query)),
  runtime: (): RuntimeStatus => {
    const localProvisioned = getState<RuntimeStatus | null>('provisionedRuntime', null);
    const fallback: RuntimeStatus = localProvisioned || {
      state: 'NOT_PROVISIONED',
      health: 'Setup required',
      wineInstalled: false,
      box64Installed: false,
      box86Installed: false,
      systemArch: nativeAvailable() ? 'arm64-v8a (Android)' : 'ARM64 / x86_64 host',
      runtimeVersion: 'Not yet provisioned',
      diagnostics: [
        'Desktop Compatibility Runtime can be provisioned directly below.',
        'Supports Wine 9.0 (Staging), Box64 (x86_64 → ARM64 translation), and Box86.',
        'Once provisioned, Windows .exe and .msi packages run inside sandboxed isolated prefixes.'
      ]
    };
    if (!nativeAvailable() && localProvisioned) {
      return localProvisioned;
    }
    const value = nativeRecord('getRuntimeStatus', fallback);
    const resolved = {
      ...value,
      state: typeof value.state === 'string' ? value.state : fallback.state,
      health: typeof value.health === 'string' ? value.health : fallback.health,
      diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics.filter(item => typeof item === 'string') : fallback.diagnostics,
      wineInstalled: value.wineInstalled === true || localProvisioned?.wineInstalled === true,
      box64Installed: value.box64Installed === true || localProvisioned?.box64Installed === true,
      box86Installed: value.box86Installed === true || localProvisioned?.box86Installed === true
    };
    if (localProvisioned && (resolved.health === 'Unavailable' || resolved.health === 'Setup required')) {
      return localProvisioned;
    }
    return resolved;
  },
  system: (): SystemInfo => nativeRecord('getSystemInfo', { os: nativeAvailable() ? 'Native host' : 'Web browser', device: nativeAvailable() ? 'Native device' : 'Browser workspace', primaryAbi: 'Unavailable' }),
  processes: () => { const list = nativeCall<NativeProcess[]>('getRunningProcesses', [], []); return Array.isArray(list) ? list.filter(p => p && typeof p.applicationId === 'string' && Number.isFinite(p.pid)) : []; },
  launch: (id: string) => operation('launchApplication', id),
  action: (method: string, ...args: unknown[]) => operation(method, ...args),
  command: (method: string, ...args: unknown[]) => {
    try { const fn = window.Win12Native?.[method]; if (!fn) return false; const value = fn.apply(window.Win12Native, args); if (value === undefined) return true; const parsed = typeof value === 'string' ? JSON.parse(value) : value; return parsed === true || parsed?.success === true; } catch { return false; }
  },
  logs: (appId = 'system'): Record<string, string> => {
    const fallback = { 'system.log': getState<string[]>('logs', []).join('\n') };
    const result = nativeCall<Record<string, unknown>>('getLogs', [appId], fallback);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return fallback;
    return Object.fromEntries(Object.entries(result).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, value as string]));
  },
};
export function logEvent(message: string) { saveState({ logs: [...getState<string[]>('logs', []), `[${new Date().toLocaleTimeString()}] ${message}`].slice(-200) }); }
export function actionSucceeded(result: boolean | { success: boolean }) { return typeof result === 'object' && result !== null ? result.success === true : result === true; }

export const USER_ROOT = nativeAvailable() ? 'app:/' : 'browser:/';
export const RECYCLE_PATH = nativeAvailable() ? 'trash:/' : 'browser:/Recycle';
const FOLDER_STYLE: { name: string; icon: IconKind; color: string }[] = [
  { name: 'Desktop', icon: 'computer', color: 'blue' }, { name: 'Downloads', icon: 'download', color: 'green' },
  { name: 'Documents', icon: 'document', color: 'blue' }, { name: 'Pictures', icon: 'picture', color: 'teal' },
  { name: 'Music', icon: 'music', color: 'purple' }, { name: 'Videos', icon: 'video', color: 'coral' },
];
const nativeFolders = nativeCall<{ name: string; path: string }[]>('getKnownFolders', [], []);
export const FOLDERS = FOLDER_STYLE.map(folder => ({ ...folder, path: nativeAvailable() ? (Array.isArray(nativeFolders) ? nativeFolders.find(f => f.name === folder.name)?.path : undefined) || '' : `browser:/${folder.name}` })).filter(f => Boolean(f.path));
export function folderPath(name: string) { return FOLDERS.find(f => f.name === name)?.path || ''; }
export function basename(path: string) { try { return decodeURIComponent(path.replace(/\/$/, '').split(/[\\/]/).pop() || path); } catch { return path; } }
export function normalizePath(path: string) {
  if (/^[A-Z]:\\/i.test(path)) {
    if (nativeAvailable()) return '';
    const match = path.match(/^[A-Z]:\\Users\\win12user\\(.+)$/i);
    return match ? `browser:/${match[1].split('\\').map(encodeURIComponent).join('/')}` : '';
  }
  return path;
}
export function joinPath(path: string, name: string) { return `${path.replace(/\/$/, '')}/${encodeURIComponent(name)}`; }
export function parentPath(path: string) {
  if (/^[^/]+:\/$/.test(path)) return '';
  const clean = path.replace(/\/$/, ''); const parent = clean.slice(0, clean.lastIndexOf('/'));
  return parent.endsWith(':') ? `${parent}/` : parent;
}
export function fileIcon(file: FileItem): IconKind {
  if (file.type === 'directory') return 'folder';
  if (file.type.includes('drive')) return 'drive';
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(file.name)) return 'picture';
  if (/\.(exe|msi)$/i.test(file.name)) return 'windows';
  return 'document';
}
export function formatBytes(bytes?: number | null) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function allFiles(): FileItem[] {
  const saved = getState<FileItem[] | null>('browserFiles.v2', null);
  if (Array.isArray(saved)) return saved;
  const directories: FileItem[] = [...FOLDERS, { name: 'Recycle', path: RECYCLE_PATH }].map(f => ({ name: f.name, path: f.path, type: 'directory', modified: Date.now() }));
  const legacy = getState<FileItem[]>('files', []).filter(f => f && f.path && normalizePath(f.path).startsWith('browser:/')).map(f => ({ ...f, path: normalizePath(f.path), originalPath: f.originalPath ? normalizePath(f.originalPath) : undefined }));
  const files = [...directories, ...legacy.filter(f => !directories.some(d => d.path === f.path))];
  saveState({ 'browserFiles.v2': files });
  return files;
}
function commitFiles(files: FileItem[]) { const saved = saveState({ 'browserFiles.v2': files }); if (saved) window.dispatchEvent(new Event('win12-files-changed')); return saved; }
function browserMetadata(file: FileItem): FileItem {
  const protectedFolder = FOLDERS.some(f => f.path === file.path) || file.path === RECYCLE_PATH;
  return { ...file, capabilities: { read: true, write: file.type === 'file', create: file.type === 'directory', rename: !protectedFolder, delete: !protectedFolder, copy: true, move: !protectedFolder, trash: !file.path.startsWith(`${RECYCLE_PATH}/`), restore: Boolean(file.originalPath) } };
}
function nativeFileOp(action: string, args: Record<string, unknown>) { const value = operation('fileOperation', action, JSON.stringify(args)); if (value.success || value.code === 'PARTIAL_MOVE') window.dispatchEvent(new Event('win12-files-changed')); return value; }
export interface DirectoryResult { items: FileItem[]; error?: string; permissionRequired?: boolean }
export const FS = {
  roots(): StorageRoot[] {
    if (!nativeAvailable()) return [{ name: 'Browser documents', path: 'browser:/', type: 'drive', source: 'BROWSER', available: true, canWrite: true, totalBytes: null, freeBytes: null, description: 'Documents saved in this browser. Not a physical disk.' }];
    const roots = nativeCall<StorageRoot[]>('getStorageRoots', [], []);
    return Array.isArray(roots) ? roots.filter(r => r && typeof r.path === 'string' && typeof r.name === 'string') : [];
  },
  list(path: string): DirectoryResult {
    if (path === '') return { items: FS.roots() };
    if (nativeAvailable()) {
      const response = nativeCall<{ items?: FileItem[]; success?: boolean; message?: string; permissionRequired?: boolean }>('getDirectoryContents', [path], { message: 'Native storage access is unavailable.' });
      if (!response || !Array.isArray(response.items)) return { items: [], error: response?.message || 'This storage location is unavailable.', permissionRequired: response?.permissionRequired };
      return { items: response.items.filter(f => f && typeof f.path === 'string' && typeof f.name === 'string') };
    }
    if (!path.startsWith('browser:/')) return { items: [], error: 'This browser cannot access Android storage. Open WIN12 on Android to connect a real storage location.' };
    return { items: allFiles().filter(f => parentPath(f.path) === path && f.path !== RECYCLE_PATH).map(browserMetadata).concat(path === 'browser:/' ? [{ name: 'Recycle', path: RECYCLE_PATH, type: 'directory' as const, capabilities: { read: true } }] : []) };
  },
  find(path: string): FileItem | undefined {
    if (!path) return undefined;
    if (nativeAvailable()) { const result = nativeCall<FileItem | null>('getFileMetadata', [path], null); return result && typeof result.path === 'string' ? result : undefined; }
    if (path === 'browser:/') return { name: 'Browser documents', path, type: 'directory', capabilities: { read: true, create: true } };
    const file = allFiles().find(f => f.path === path); return file ? browserMetadata(file) : undefined;
  },
  read(path: string): OperationResult {
    if (nativeAvailable()) return operation('readTextFile', path);
    const file = FS.find(path); return file?.type === 'file' ? { success: true, content: file.content || '' } : { success: false, message: 'The document is no longer available.' };
  },
  search(query: string): FileItem[] {
    const files = nativeAvailable() ? FOLDERS.flatMap(folder => FS.list(folder.path).items) : allFiles();
    return files.filter(file => file.type === 'file' && !file.originalPath && file.name.toLowerCase().includes(query.toLowerCase()));
  },
  create(path: string, name: string, type: 'directory' | 'file', content = '', originalSize?: number): OperationResult & { message: string } {
    if (!name.trim() || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || ['.', '..'].includes(name.trim())) return { success: false, message: 'Please use a valid file name without path separators.' };
    if (nativeAvailable()) { const result = nativeFileOp('create', { path, name, directory: type === 'directory', content }); return { ...result, message: result.message || '' }; }
    if (!FS.find(path)?.capabilities?.create) return { success: false, message: 'The destination is not writable.' };
    const fullPath = joinPath(path, name.trim()); const files = allFiles();
    if (files.some(f => f.path.toLowerCase() === fullPath.toLowerCase())) return { success: false, message: 'An item with this name already exists.' };
    const success = commitFiles([...files, { name: name.trim(), path: fullPath, type, content: type === 'file' ? content : undefined, size: type === 'file' ? originalSize ?? new Blob([content]).size : undefined, modified: Date.now() }]);
    if (success) logEvent(`Created ${fullPath}`);
    return { success, path: fullPath, message: success ? '' : 'Browser storage is full or disabled.' };
  },
  write(path: string, content: string) {
    if (nativeAvailable()) return nativeFileOp('write', { path, content }).success;
    if (!FS.find(path)?.capabilities?.write) return false;
    return commitFiles(allFiles().map(f => f.path === path ? { ...f, content, size: new Blob([content]).size, modified: Date.now() } : f));
  },
  savePng(name: string, dataUrl: string): OperationResult {
    if (!name.trim().toLowerCase().endsWith('.png')) return { success: false, message: 'PNG exports must use a .png file name.' };
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 4_000_000) return { success: false, message: 'The PNG is invalid or too large. Download a copy instead.' };
    if (nativeAvailable()) {
      const result = operation('savePngImage', name, dataUrl);
      if (result.success) window.dispatchEvent(new Event('win12-files-changed'));
      return result;
    }
    const base64 = dataUrl.split(',')[1];
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return FS.create(folderPath('Pictures'), name, 'file', dataUrl, Math.floor(base64.length * 3 / 4) - padding);
  },
  rename(path: string, name: string) {
    if (!name.trim() || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || ['.', '..'].includes(name.trim())) return false;
    if (nativeAvailable()) return nativeFileOp('rename', { path, name }).success;
    if (!FS.find(path)?.capabilities?.rename) return false;
    const target = joinPath(parentPath(path), name.trim()); if (target === path) return true; if (FS.find(target)) return false;
    return commitFiles(allFiles().map(f => f.path === path ? { ...f, name: name.trim(), path: target, modified: Date.now() } : f.path.startsWith(`${path}/`) ? { ...f, path: target + f.path.slice(path.length) } : f));
  },
  remove(path: string) {
    if (nativeAvailable()) return nativeFileOp('delete', { path }).success;
    const item = FS.find(path); if (!item?.capabilities?.delete) return false;
    const files = allFiles();
    if (path.startsWith(`${RECYCLE_PATH}/`)) return commitFiles(files.filter(f => f.path !== path && !f.path.startsWith(`${path}/`)));
    let target = joinPath(RECYCLE_PATH, item.name); if (FS.find(target)) target = joinPath(RECYCLE_PATH, `${Date.now()}-${item.name}`);
    return commitFiles(files.map(f => f.path === path || f.path.startsWith(`${path}/`) ? { ...f, path: target + f.path.slice(path.length), originalPath: f.path } : f));
  },
  restore(path: string) {
    if (nativeAvailable()) return nativeFileOp('restore', { path }).success;
    const item = FS.find(path); if (!item?.originalPath || FS.find(item.originalPath) || !FS.find(parentPath(item.originalPath))) return false;
    const target = item.originalPath;
    return commitFiles(allFiles().map(f => f.path === path || f.path.startsWith(`${path}/`) ? { ...f, path: target + f.path.slice(path.length), originalPath: undefined } : f));
  },
  copy(path: string, destination: string, move = false) {
    if (nativeAvailable()) return nativeFileOp(move ? 'move' : 'copy', { path, destination }).success;
    const item = FS.find(path); if (!item || !FS.find(destination)?.capabilities?.create || destination === path || destination.startsWith(`${path}/`) || (move && !item.capabilities?.move)) return false;
    let target = joinPath(destination, item.name); if (move && target === path) return true;
    if (FS.find(target)) target = joinPath(destination, `Copy of ${item.name}`); if (FS.find(target)) return false;
    const copied = allFiles().filter(f => f.path === path || f.path.startsWith(`${path}/`)).map(f => ({ ...f, name: f.path === path ? basename(target) : f.name, path: target + f.path.slice(path.length), originalPath: undefined, modified: Date.now() }));
    return commitFiles([...(move ? allFiles().filter(f => f.path !== path && !f.path.startsWith(`${path}/`)) : allFiles()), ...copied]);
  },
  usedBytes() { return nativeAvailable() ? Native.system().storageBreakdown?.files : allFiles().reduce((sum, f) => sum + (f.size || 0), 0); },
  openExternal(path: string) { return nativeFileOp('open', { path }); },
  export(path: string) { return nativeFileOp('export', { path }); },
};

export interface WallpaperItem { id: string; name: string; category: string; background: string; portrait?: string; source: string; quality?: string; width?: number; height?: number }
export const DAYLIGHT_PORTRAIT = 'radial-gradient(ellipse at 50% 35%, rgba(255, 255, 255, 0.98) 0%, rgba(210, 235, 255, 0.8) 32%, rgba(150, 205, 250, 0.45) 58%, transparent 80%), linear-gradient(168deg, #d3e6fa 0%, #edf5fe 42%, #c6e0fa 75%, #a8cff7 100%)';
export const DAYLIGHT_LANDSCAPE = 'radial-gradient(ellipse at 65% 45%, rgba(255, 255, 255, 0.98) 0%, rgba(210, 235, 255, 0.75) 28%, rgba(150, 205, 250, 0.4) 52%, transparent 76%), linear-gradient(142deg, #cce3f8 0%, #edf5fe 45%, #bfdcf8 78%, #a5cdf5 100%)';
export const BLUE_ARC_PORTRAIT = 'radial-gradient(ellipse at 52% 52%, rgba(56, 160, 255, 0.52) 0%, rgba(20, 68, 145, 0.8) 36%, rgba(8, 26, 52, 0.98) 72%, #040e1c 100%), linear-gradient(172deg, #07152b 0%, #0d2b56 46%, #051020 100%)';
export const BLUE_ARC_LANDSCAPE = 'radial-gradient(ellipse at 64% 48%, rgba(56, 160, 255, 0.45) 0%, rgba(20, 68, 145, 0.72) 30%, rgba(8, 26, 52, 0.96) 66%, #040e1c 100%), linear-gradient(135deg, #061326 0%, #0e2f5c 50%, #051224 100%)';
export const GEOMETRIC_WALLPAPER = 'radial-gradient(circle at 65% 40%, rgba(80, 160, 230, 0.35) 0%, transparent 60%), linear-gradient(145deg, #091526 0%, #173254 48%, #223f6d 100%)';
export const ALPINE_WALLPAPER = 'linear-gradient(165deg, #0f243c 0%, #20456c 36%, #4d7ea8 66%, #a3cbda 100%)';
export const BLUE_GLASS_WALLPAPER = 'radial-gradient(circle at 50% 40%, rgba(110, 195, 255, 0.4) 0%, rgba(28, 76, 148, 0.7) 46%, #071529 88%)';

export const WALLPAPERS: WallpaperItem[] = [
  { id: 'daylight', name: 'Win12 Daylight (Light)', category: 'Light', background: DAYLIGHT_LANDSCAPE, portrait: DAYLIGHT_PORTRAIT, source: 'Modern Windows 12 Daylight Bloom vector design.', quality: 'Ultra-HD vector gradient', width: 3840, height: 2160 },
  { id: 'bloom', name: 'Win12 Cobalt Bloom', category: 'Signature', background: BLUE_ARC_LANDSCAPE, portrait: BLUE_ARC_PORTRAIT, source: 'Modern Windows 12 Deep Bloom signature glass.', quality: 'Ultra-HD vector gradient', width: 3840, height: 2160 },
  { id: 'geometric', name: 'Win12 Geometric Mesh', category: 'Geometric', background: GEOMETRIC_WALLPAPER, portrait: GEOMETRIC_WALLPAPER, source: 'Win12 modern geometric acrylic desktop.', quality: 'Ultra-HD vector gradient', width: 3840, height: 2160 },
  { id: 'alpine', name: 'Win12 Alpine Glow', category: 'Nature', background: ALPINE_WALLPAPER, portrait: ALPINE_WALLPAPER, source: 'Win12 crisp mountain dawn gradient composition.', quality: 'Ultra-HD vector gradient' },
  { id: 'glass', name: 'Win12 Frosted Glass', category: 'Abstract', background: BLUE_GLASS_WALLPAPER, portrait: BLUE_GLASS_WALLPAPER, source: 'Win12 deep frosted glass abstract composition.', quality: 'Ultra-HD vector gradient' },
];
export function wallpaperCatalog(): WallpaperItem[] {
  const saved = getState<WallpaperItem[]>('userWallpapers', []);
  return [...WALLPAPERS, ...(Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && /^url\("data:image\/(jpeg|png|webp);base64,/.test(item.background)) : [])];
}
export function wallpaperImage(item: WallpaperItem, portrait = false) { return /^url\(["']?(.*?)["']?\)$/.exec(portrait && item.portrait ? item.portrait : item.background)?.[1] || ''; }
export interface DesktopActions {
  open: (kind: AppKind, args?: Record<string, string>) => void; close: (id: string) => void;
  notify: (title: string, message: string) => void; openFile: (file: FileItem) => void;
  launchApp: (app: DesktopApp) => void; updateArgs: (id: string, args: Record<string, string>) => void;
}