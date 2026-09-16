export interface StorageBreakdown {
  applications: number;
  prefixes: number;
  runtime: number;
  logs: number;
  totalTracked: number;
}

export interface SystemInfo {
  os: string;
  apiLevel: number;
  device: string;
  primaryAbi: string;
  supportedAbis: string[];
  totalMemory: number;
  freeMemory: number;
  maxMemory?: number;
  storageBreakdown: StorageBreakdown;
}

export interface RuntimeStatus {
  state: string;
  wineInstalled: boolean;
  box64Installed: boolean;
  box86Installed: boolean;
  systemArch: string;
  supportedArchitectures: string[];
  runtimeVersion: string;
  health: "Healthy" | "Warning" | "Unavailable" | string;
  diagnostics: string[];
  winePath?: string;
  box64Path?: string;
  box86Path?: string;
}

export interface WinApp {
  id: string;
  name: string;
  displayName: string;
  architecture: string;
  runtime: string;
  status: string;
  executablePath?: string;
  prefixPath?: string;
  iconPath?: string;
  isSystemApp: boolean;
  systemAppType?: string;
  desktopShortcut: boolean;
  lastRun: number;
  version?: string;
  publisher?: string;
  description?: string;
}

export interface ProcessInfo {
  applicationId: string;
  pid: number;
  status: string;
  startTime: number;
  title?: string;
}

export interface FSEntry {
  name: string;
  path: string;
  type: "directory" | "drive" | "drive-locked" | "file";
  size?: number;
  modified?: number;
  ext?: string;
}

export interface DriveListing {
  currentPath: string;
  items: FSEntry[];
  permissionRequired?: boolean;
}

export interface LaunchResult {
  success: boolean;
  message?: string;
  errorCode?: string;
}

export interface SnapZone {
  type: "LEFT" | "RIGHT" | "FULL" | "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT";
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AppType =
  | "explorer"
  | "settings"
  | "installer"
  | "apps"
  | "recycle"
  | "logviewer"
  | "taskmgr"
  | "notepad"
  | "calculator"
  | "paint"
  | "terminal"
  | "browser"
  | "store"
  | "photos"
  | "copilot"
  | "runtime-error"
  | "launch-error"
  | "wine-app"
  | "about";

export interface WindowRecord {
  id: string;
  title: string;
  icon: string;
  appId: string | null;
  appType: AppType;
  appProps?: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  snapState: string;
  prevBounds: WindowBounds;
}

export interface WallpaperItem {
  id: string;
  name: string;
  category: string;
  css: string;
}

export interface ToastItem {
  id: string;
  title: string;
  body: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  kind: "desktop" | "app" | "file";
  app?: WinApp;
  file?: FSEntry;
}

export interface OpenWindowConfig {
  id?: string;
  title: string;
  icon: string;
  appType: AppType;
  appId?: string | null;
  appProps?: Record<string, unknown>;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface Win12NativeBridge {
  getSystemInfo: () => string;
  getRuntimeStatus: () => string;
  getInstalledApps: () => string;
  getDesktopShortcuts: () => string;
  selectInstaller: () => void;
  launchApplication: (id: string) => string;
  stopApplication: (id: string) => boolean;
  uninstallApplication: (id: string) => boolean;
  repairApplication: (id: string) => boolean;
  toggleDesktopShortcut: (id: string, val: boolean) => boolean;
  getPinnedApps?: () => string;
  setPinned?: (id: string, pinned: boolean) => boolean;
  searchApps?: (query: string) => string;
  installRuntime?: (bundleUrl: string, expectedSha256: string) => void;
  cancelRuntimeInstall?: () => void;
  uninstallRuntime?: () => boolean;
  getVirtualDriveContents: (path: string) => string;
  createVirtualFolder: (path: string, name: string) => boolean;
  deleteVirtualFile: (path: string) => boolean;
  hasAllFilesAccess: () => boolean;
  requestAllFilesAccess: () => void;
  getLogs: (appId: string) => string;
  clearLogs: (appId: string) => boolean;
  getRunningProcesses: () => string;
  showToast: (msg: string) => void;
  loadDesktopState?: () => string;
  saveDesktopState?: (raw: string) => void;
  forceStopApplication?: (id: string) => boolean;
}

export interface InstallerPackage {
  id: string;
  displayName: string;
  fileName: string;
  architecture: string;
  sizeLabel: string;
  publisher: string;
  version: string;
  description: string;
  icon: string;
}

declare global {
  interface Window {
    Win12Native?: Win12NativeBridge;
    Win12Desktop?: {
      onNativeEvent: (eventName: string, data: unknown) => void;
      handleBackButton: () => void;
      handleEscapeKey: () => void;
      openExplorer: (path?: string) => void;
      openInstallerWizard: () => void;
      openAppManager: () => void;
      openSettings: (tab?: string) => void;
      openLogViewer: (id?: string) => void;
      openTaskManager: () => void;
      startRuntimeInstall: () => void;
      cancelRuntimeInstall: () => void;
      uninstallRuntime: () => void;
      handleAppLaunch: (app: WinApp) => void;
      closeWindow: (id: string) => void;
      clearAllLogs: () => void;
      setWallpaper: (id: string) => void;
    };
  }
}

export {};
