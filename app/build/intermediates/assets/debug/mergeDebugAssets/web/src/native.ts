import type {
  DriveListing,
  FSEntry,
  InstallerPackage,
  LaunchResult,
  ProcessInfo,
  RuntimeStatus,
  SystemInfo,
  WinApp,
} from "./types";

const HOST_KEY = "win12.mockHost.v1";

export const SAMPLE_PACKAGES: InstallerPackage[] = [
  {
    id: "pkg-7zip",
    displayName: "7-Zip",
    fileName: "7z2408-x64.exe",
    architecture: "x86_64",
    sizeLabel: "1.5 MB",
    publisher: "Igor Pavlov",
    version: "24.08",
    description: "Open-source file archiver with a high compression ratio.",
    icon: "📦",
  },
  {
    id: "pkg-vlc",
    displayName: "VLC media player",
    fileName: "vlc-3.0.21-win64.exe",
    architecture: "x86_64",
    sizeLabel: "42.8 MB",
    publisher: "VideoLAN",
    version: "3.0.21",
    description: "Free and open source cross-platform multimedia player.",
    icon: "🎬",
  },
  {
    id: "pkg-npp",
    displayName: "Notepad++",
    fileName: "npp.8.7.1.Installer.x64.exe",
    architecture: "x86_64",
    sizeLabel: "5.4 MB",
    publisher: "Don Ho",
    version: "8.7.1",
    description: "Free source code editor and Notepad replacement.",
    icon: "📝",
  },
  {
    id: "pkg-winrar",
    displayName: "WinRAR",
    fileName: "winrar-x64-701.exe",
    architecture: "x86_64",
    sizeLabel: "3.5 MB",
    publisher: "win.rar GmbH",
    version: "7.01",
    description: "Powerful archive manager for RAR and ZIP files.",
    icon: "📚",
  },
  {
    id: "pkg-mspaint",
    displayName: "Paint.NET",
    fileName: "paint.net.5.1.install.x64.exe",
    architecture: "x86_64",
    sizeLabel: "18.2 MB",
    publisher: "dotPDN LLC",
    version: "5.1",
    description: "Image and photo editing for Windows.",
    icon: "🎨",
  },
];

export function createSystemApps(): WinApp[] {
  const defs: Array<Partial<WinApp> & { id: string; displayName: string; systemAppType: string }> = [
    { id: "sys-explorer", displayName: "File Explorer", systemAppType: "explorer", name: "explorer" },
    { id: "sys-settings", displayName: "Settings", systemAppType: "settings", name: "SystemSettings" },
    { id: "sys-installer", displayName: "App Installer", systemAppType: "installer", name: "Win12Installer" },
    { id: "sys-apps", displayName: "Installed Apps", systemAppType: "apps", name: "AppManager" },
    { id: "sys-recycle", displayName: "Recycle Bin", systemAppType: "recycle", name: "RecycleBin" },
    { id: "sys-logviewer", displayName: "Log Viewer", systemAppType: "logviewer", name: "LogViewer" },
    { id: "sys-taskmgr", displayName: "Task Manager", systemAppType: "taskmgr", name: "Taskmgr" },
    { id: "sys-notepad", displayName: "Notepad", systemAppType: "notepad", name: "notepad" },
    { id: "sys-calculator", displayName: "Calculator", systemAppType: "calculator", name: "calc" },
    { id: "sys-paint", displayName: "Paint", systemAppType: "paint", name: "mspaint" },
    { id: "sys-terminal", displayName: "Terminal", systemAppType: "terminal", name: "WindowsTerminal" },
    { id: "sys-browser", displayName: "Edge", systemAppType: "browser", name: "msedge" },
    { id: "sys-store", displayName: "Microsoft Store", systemAppType: "store", name: "MSStore" },
    { id: "sys-photos", displayName: "Photos", systemAppType: "photos", name: "Photos" },
    { id: "sys-copilot", displayName: "Copilot", systemAppType: "copilot", name: "Win12Copilot" },
  ];

  const desktop = new Set([
    "sys-explorer",
    "sys-recycle",
    "sys-settings",
    "sys-apps",
    "sys-installer",
    "sys-notepad",
    "sys-browser",
  ]);

  return defs.map((d) => ({
    id: d.id,
    name: d.name || d.id,
    displayName: d.displayName,
    architecture: "arm64-v8a",
    runtime: "native",
    status: "Ready",
    isSystemApp: true,
    systemAppType: d.systemAppType,
    desktopShortcut: desktop.has(d.id),
    lastRun: 0,
    version: "12.0",
    publisher: "Win12",
    executablePath: `C:\\Windows\\System32\\${d.name}.exe`,
  }));
}

function nowStamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function seedLogs(): Record<string, Record<string, string>> {
  return {
    system: {
      "system.log": `[${nowStamp()}] Win12 desktop host starting\n[${nowStamp()}] Compatibility runtime: NOT_INSTALLED\n[${nowStamp()}] Virtual drive C:\\ mounted\n[${nowStamp()}] Desktop compositor ready\n[${nowStamp()}] Operating in standalone preview mode.`,
      "bridge.log": `[${nowStamp()}] Native bridge unavailable — using MockHost\n[${nowStamp()}] StateStore attached to localStorage`,
    },
  };
}

function seedFS(): Record<string, FSEntry[]> {
  const t = Date.now();
  const file = (name: string, path: string, size: number): FSEntry => ({
    name,
    path,
    type: "file",
    size,
    modified: t - Math.floor(Math.random() * 86400000 * 20),
    ext: name.split(".").pop(),
  });
  const dir = (name: string, path: string): FSEntry => ({
    name,
    path,
    type: "directory",
    modified: t,
  });

  return {
    "": [
      { name: "Local Disk (C:)", path: "C:\\", type: "drive", modified: t },
      { name: "Device Storage (E:)", path: "E:\\", type: "drive", modified: t },
    ],
    "C:\\": [
      dir("Windows", "C:\\Windows"),
      dir("Program Files", "C:\\Program Files"),
      dir("Program Files (x86)", "C:\\Program Files (x86)"),
      dir("Users", "C:\\Users"),
      dir("PerfLogs", "C:\\PerfLogs"),
      file("pagefile.sys", "C:\\pagefile.sys", 2147483648),
    ],
    "C:\\Windows": [
      dir("System32", "C:\\Windows\\System32"),
      dir("SysWOW64", "C:\\Windows\\SysWOW64"),
      dir("Fonts", "C:\\Windows\\Fonts"),
      dir("Logs", "C:\\Windows\\Logs"),
      file("explorer.exe", "C:\\Windows\\explorer.exe", 4608000),
      file("notepad.exe", "C:\\Windows\\notepad.exe", 201728),
      file("regedit.exe", "C:\\Windows\\regedit.exe", 390000),
      file("win.ini", "C:\\Windows\\win.ini", 92),
    ],
    "C:\\Windows\\System32": [
      file("cmd.exe", "C:\\Windows\\System32\\cmd.exe", 278528),
      file("conhost.exe", "C:\\Windows\\System32\\conhost.exe", 860160),
      file("taskmgr.exe", "C:\\Windows\\System32\\taskmgr.exe", 420000),
      file("calc.exe", "C:\\Windows\\System32\\calc.exe", 36000),
      dir("drivers", "C:\\Windows\\System32\\drivers"),
    ],
    "C:\\Program Files": [
      dir("Win12", "C:\\Program Files\\Win12"),
      dir("WindowsApps", "C:\\Program Files\\WindowsApps"),
      dir("Common Files", "C:\\Program Files\\Common Files"),
    ],
    "C:\\Program Files\\Win12": [
      file("Win12Desktop.exe", "C:\\Program Files\\Win12\\Win12Desktop.exe", 12582912),
      file("README.txt", "C:\\Program Files\\Win12\\README.txt", 2048),
    ],
    "C:\\Users": [dir("win12user", "C:\\Users\\win12user")],
    "C:\\Users\\win12user": [
      dir("Desktop", "C:\\Users\\win12user\\Desktop"),
      dir("Documents", "C:\\Users\\win12user\\Documents"),
      dir("Downloads", "C:\\Users\\win12user\\Downloads"),
      dir("Pictures", "C:\\Users\\win12user\\Pictures"),
      dir("Music", "C:\\Users\\win12user\\Music"),
      dir("Videos", "C:\\Users\\win12user\\Videos"),
      dir("Recycle", "C:\\Users\\win12user\\Recycle"),
    ],
    "C:\\Users\\win12user\\Desktop": [
      file("Welcome to Win12.txt", "C:\\Users\\win12user\\Desktop\\Welcome to Win12.txt", 640),
      file("Compatibility Notes.rtf", "C:\\Users\\win12user\\Desktop\\Compatibility Notes.rtf", 1280),
    ],
    "C:\\Users\\win12user\\Documents": [
      file("Project Roadmap.docx", "C:\\Users\\win12user\\Documents\\Project Roadmap.docx", 24576),
      file("budget-2026.xlsx", "C:\\Users\\win12user\\Documents\\budget-2026.xlsx", 18944),
      file("notes.txt", "C:\\Users\\win12user\\Documents\\notes.txt", 812),
    ],
    "C:\\Users\\win12user\\Downloads": [
      file("runtime-bundle.url", "C:\\Users\\win12user\\Downloads\\runtime-bundle.url", 120),
      file("sample.msi", "C:\\Users\\win12user\\Downloads\\sample.msi", 4096000),
    ],
    "C:\\Users\\win12user\\Pictures": [
      file("bloom.jpg", "C:\\Users\\win12user\\Pictures\\bloom.jpg", 156000),
      file("lake.jpg", "C:\\Users\\win12user\\Pictures\\lake.jpg", 313000),
    ],
    "C:\\Users\\win12user\\Recycle": [],
    "C:\\Users\\win12user\\Music": [],
    "C:\\Users\\win12user\\Videos": [],
    "C:\\PerfLogs": [],
    "C:\\Program Files (x86)": [],
    "C:\\Windows\\Fonts": [file("segoeui.ttf", "C:\\Windows\\Fonts\\segoeui.ttf", 900000)],
    "C:\\Windows\\Logs": [file("CBS.log", "C:\\Windows\\Logs\\CBS.log", 12000)],
    "C:\\Windows\\SysWOW64": [],
    "C:\\Windows\\System32\\drivers": [],
    "C:\\Program Files\\WindowsApps": [],
    "C:\\Program Files\\Common Files": [],
    "E:\\": [
      dir("Download", "E:\\Download"),
      dir("DCIM", "E:\\DCIM"),
      dir("Documents", "E:\\Documents"),
      file("win12-runtime-arm64.zip", "E:\\win12-runtime-arm64.zip", 186000000),
    ],
    "E:\\Download": [file("setup.exe", "E:\\Download\\setup.exe", 8500000)],
    "E:\\DCIM": [],
    "E:\\Documents": [],
  };
}

interface HostState {
  apps: WinApp[];
  pinned: string[];
  runtime: RuntimeStatus;
  logs: Record<string, Record<string, string>>;
  fs: Record<string, FSEntry[]>;
  processes: ProcessInfo[];
  storage: { applications: number; prefixes: number; runtime: number; logs: number };
  allFilesAccess: boolean;
}

function defaultRuntime(): RuntimeStatus {
  return {
    state: "NOT_INSTALLED",
    wineInstalled: false,
    box64Installed: false,
    box86Installed: false,
    systemArch: "arm64-v8a",
    supportedArchitectures: [],
    runtimeVersion: "Not Provisioned",
    health: "Unavailable",
    diagnostics: [
      "Compatibility runtime package is not yet installed.",
      "Windows PE binaries cannot execute on ARM64 without Wine + Box64.",
      "Provide a runtime bundle URL in Settings → Compatibility Runtime, or install the demo runtime.",
    ],
    winePath: undefined,
    box64Path: undefined,
    box86Path: undefined,
  };
}

function defaultState(): HostState {
  return {
    apps: createSystemApps(),
    pinned: ["sys-explorer", "sys-browser", "sys-store", "sys-settings", "sys-calculator"],
    runtime: defaultRuntime(),
    logs: seedLogs(),
    fs: seedFS(),
    processes: [],
    storage: { applications: 12582912, prefixes: 4096, runtime: 0, logs: 8192 },
    allFilesAccess: true,
  };
}

class MockHost {
  state: HostState;
  pidSeq = 2000;
  listeners = new Set<() => void>();

  constructor() {
    this.state = this.load();
  }

  load(): HostState {
    try {
      const raw = localStorage.getItem(HOST_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw) as HostState;
      if (!parsed.apps || !Array.isArray(parsed.apps)) return defaultState();
      const sys = createSystemApps();
      const sysIds = new Set(sys.map((a) => a.id));
      const extras = parsed.apps.filter((a) => !sysIds.has(a.id));
      const mergedSys = sys.map((s) => {
        const prev = parsed.apps.find((a) => a.id === s.id);
        return prev
          ? { ...s, desktopShortcut: prev.desktopShortcut, lastRun: prev.lastRun }
          : s;
      });
      parsed.apps = [...mergedSys, ...extras];
      if (!parsed.fs || !parsed.fs["C:\\"]) parsed.fs = seedFS();
      if (!parsed.logs) parsed.logs = seedLogs();
      if (!parsed.runtime) parsed.runtime = defaultRuntime();
      if (!parsed.pinned) parsed.pinned = defaultState().pinned;
      if (!parsed.processes) parsed.processes = [];
      if (!parsed.storage) parsed.storage = defaultState().storage;
      return parsed;
    } catch {
      return defaultState();
    }
  }

  persist() {
    try {
      localStorage.setItem(HOST_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error(e);
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  appendLog(appId: string, stream: string, line: string) {
    if (!this.state.logs[appId]) this.state.logs[appId] = {};
    const prev = this.state.logs[appId][stream] || "";
    this.state.logs[appId][stream] = prev + `[${nowStamp()}] ${line}\n`;
  }

  getSystemInfo(): SystemInfo {
    return {
      os: "Android 14 · Win12 Desktop 12.0.26000",
      apiLevel: 34,
      device: "Win12 Preview Host (ARM64)",
      primaryAbi: "arm64-v8a",
      supportedAbis: ["arm64-v8a", "armeabi-v7a"],
      totalMemory: 8589934592,
      freeMemory: 3650722201,
      maxMemory: 536870912,
      storageBreakdown: {
        applications: this.state.storage.applications,
        prefixes: this.state.storage.prefixes,
        runtime: this.state.storage.runtime,
        logs: this.state.storage.logs,
        totalTracked:
          this.state.storage.applications +
          this.state.storage.prefixes +
          this.state.storage.runtime +
          this.state.storage.logs,
      },
    };
  }

  launchApp(id: string): LaunchResult {
    const app = this.state.apps.find((a) => a.id === id);
    if (!app) return { success: false, message: "Application not found", errorCode: "ENOENT" };

    if (!app.isSystemApp) {
      const rt = this.state.runtime;
      const needs64 = (app.architecture || "").toLowerCase().includes("64");
      if (!rt.wineInstalled || (needs64 && !rt.box64Installed)) {
        return {
          success: false,
          message: "Windows compatibility runtime is not installed.",
          errorCode: "RUNTIME_MISSING",
        };
      }
    }

    app.lastRun = Date.now();
    app.status = "Running";
    const proc: ProcessInfo = {
      applicationId: app.id,
      pid: ++this.pidSeq,
      status: "Running",
      startTime: Date.now(),
      title: app.displayName,
    };
    this.state.processes = this.state.processes.filter((p) => p.applicationId !== app.id);
    this.state.processes.push(proc);
    this.appendLog(app.id, "stdout.log", `Launched ${app.displayName} (${app.architecture})`);
    this.appendLog("system", "system.log", `Process start: ${app.displayName} pid=${proc.pid}`);
    this.persist();
    return { success: true, message: "Launched" };
  }

  stopApp(id: string) {
    const app = this.state.apps.find((a) => a.id === id);
    if (app) app.status = "Ready";
    this.state.processes = this.state.processes.filter((p) => p.applicationId !== id);
    this.appendLog("system", "system.log", `Process stop: ${id}`);
    this.persist();
    return true;
  }

  uninstallApp(id: string) {
    const app = this.state.apps.find((a) => a.id === id);
    if (!app || app.isSystemApp) return false;
    this.state.apps = this.state.apps.filter((a) => a.id !== id);
    this.state.pinned = this.state.pinned.filter((p) => p !== id);
    this.state.processes = this.state.processes.filter((p) => p.applicationId !== id);
    this.appendLog("system", "system.log", `Uninstalled ${app.displayName}`);
    this.persist();
    return true;
  }

  installPackage(pkg: InstallerPackage): WinApp {
    const app: WinApp = {
      id: "winapp-" + pkg.id,
      name: pkg.fileName.replace(/\.(exe|msi)$/i, ""),
      displayName: pkg.displayName,
      architecture: pkg.architecture,
      runtime: "wine",
      status: "Ready",
      executablePath: `C:\\Program Files\\${pkg.displayName}\\${pkg.fileName}`,
      prefixPath: `/data/win12/prefixes/${pkg.id}`,
      iconPath: pkg.fileName.endsWith(".msi") ? "msi" : "exe",
      isSystemApp: false,
      desktopShortcut: true,
      lastRun: 0,
      version: pkg.version,
      publisher: pkg.publisher,
      description: pkg.description,
    };
    this.state.apps = this.state.apps.filter((a) => a.id !== app.id);
    this.state.apps.push(app);
    this.state.storage.applications += 4_000_000;
    this.state.storage.prefixes += 1_200_000;
    this.appendLog("system", "system.log", `Registered ${app.displayName} in isolated prefix ${app.prefixPath}`);
    this.persist();
    return app;
  }

  toggleDesktopShortcut(id: string, val: boolean) {
    const app = this.state.apps.find((a) => a.id === id);
    if (!app) return false;
    app.desktopShortcut = val;
    this.persist();
    return true;
  }

  setPinned(id: string, pinned: boolean) {
    if (pinned && !this.state.pinned.includes(id)) this.state.pinned.push(id);
    if (!pinned) this.state.pinned = this.state.pinned.filter((p) => p !== id);
    this.persist();
    return true;
  }

  searchApps(query: string): WinApp[] {
    const q = query.trim().toLowerCase();
    const apps = this.state.apps;
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.executablePath || "").toLowerCase().includes(q) ||
        (a.version || "").toLowerCase().includes(q) ||
        (a.publisher || "").toLowerCase().includes(q),
    );
  }

  getDriveContents(path: string): DriveListing {
    if (path === "E:\\" && !this.state.allFilesAccess) {
      return { currentPath: path, items: [], permissionRequired: true };
    }
    const items = this.state.fs[path] || [];
    return { currentPath: path, items: [...items] };
  }

  createFolder(path: string, name: string) {
    const parent = path;
    const newPath = !parent ? name : parent.endsWith("\\") ? parent + name : parent + "\\" + name;
    if (!this.state.fs[parent]) this.state.fs[parent] = [];
    if (this.state.fs[parent].some((i) => i.name === name)) return false;
    this.state.fs[parent].push({
      name,
      path: newPath,
      type: "directory",
      modified: Date.now(),
    });
    this.state.fs[newPath] = [];
    this.persist();
    return true;
  }

  deleteFile(path: string) {
    const parts = path.split("\\").filter(Boolean);
    const name = parts.pop() || "";
    const parent = parts.length === 1 ? parts[0] + "\\" : parts.join("\\");
    const recycle = "C:\\Users\\win12user\\Recycle";
    const item = (this.state.fs[parent] || []).find((i) => i.name === name);
    if (!item) return false;
    this.state.fs[parent] = this.state.fs[parent].filter((i) => i.name !== name);
    if (parent !== recycle && !path.startsWith(recycle)) {
      if (!this.state.fs[recycle]) this.state.fs[recycle] = [];
      this.state.fs[recycle].push({ ...item, path: recycle + "\\" + item.name });
    }
    if (item.type === "directory") delete this.state.fs[item.path];
    this.persist();
    return true;
  }

  installRuntimeDemo() {
    this.state.runtime = {
      state: "READY",
      wineInstalled: true,
      box64Installed: true,
      box86Installed: true,
      systemArch: "arm64-v8a",
      supportedArchitectures: ["x86_64", "i386"],
      runtimeVersion: "Wine 9.15 · Box64 0.3.2 (demo)",
      health: "Healthy",
      diagnostics: [
        "Demo compatibility runtime is active in preview mode.",
        "Wine prefix template initialized at /runtime/wine.",
        "Box64 user-mode translation enabled for x86_64 binaries.",
        "Box86 available for legacy 32-bit applications.",
      ],
      winePath: "/data/win12/runtime/wine/bin/wine",
      box64Path: "/data/win12/runtime/box64/box64",
      box86Path: "/data/win12/runtime/box86/box86",
    };
    this.state.storage.runtime = 420_000_000;
    this.appendLog("system", "system.log", "Compatibility runtime installed (demo bundle)");
    this.persist();
  }

  uninstallRuntime() {
    this.state.runtime = defaultRuntime();
    this.state.storage.runtime = 0;
    this.appendLog("system", "system.log", "Compatibility runtime removed");
    this.persist();
    return true;
  }

  getLogs(appId: string) {
    return this.state.logs[appId] || { "system.log": "(No log entries found for this stream)" };
  }

  clearLogs(appId: string) {
    if (appId === "system") {
      Object.keys(this.state.logs).forEach((k) => {
        Object.keys(this.state.logs[k]).forEach((s) => {
          this.state.logs[k][s] = "";
        });
      });
    } else if (this.state.logs[appId]) {
      Object.keys(this.state.logs[appId]).forEach((s) => {
        this.state.logs[appId][s] = "";
      });
    }
    this.persist();
    return true;
  }
}

export const mockHost = new MockHost();

function parseJson<T>(fn: () => string, fallback: T): T {
  try {
    return JSON.parse(fn()) as T;
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

export const Native = {
  isAvailable: () => typeof window !== "undefined" && typeof window.Win12Native !== "undefined",

  getSystemInfo(): SystemInfo {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getSystemInfo(), mockHost.getSystemInfo());
    }
    return mockHost.getSystemInfo();
  },

  getRuntimeStatus(): RuntimeStatus {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getRuntimeStatus(), mockHost.state.runtime);
    }
    return { ...mockHost.state.runtime };
  },

  getInstalledApps(): WinApp[] {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getInstalledApps(), mockHost.state.apps);
    }
    return [...mockHost.state.apps];
  },

  getDesktopShortcuts(): WinApp[] {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getDesktopShortcuts(), []);
    }
    return mockHost.state.apps.filter((a) => a.desktopShortcut);
  },

  selectInstaller() {
    if (Native.isAvailable()) window.Win12Native!.selectInstaller();
  },

  launchApp(id: string): LaunchResult {
    if (Native.isAvailable()) {
      try {
        return JSON.parse(window.Win12Native!.launchApplication(id)) as LaunchResult;
      } catch (e) {
        return { success: false, message: (e as Error).message };
      }
    }
    return mockHost.launchApp(id);
  },

  stopApp(id: string) {
    if (Native.isAvailable()) return window.Win12Native!.stopApplication(id);
    return mockHost.stopApp(id);
  },

  uninstallApp(id: string) {
    if (Native.isAvailable()) return window.Win12Native!.uninstallApplication(id);
    return mockHost.uninstallApp(id);
  },

  repairApp(id: string) {
    if (Native.isAvailable()) return window.Win12Native!.repairApplication(id);
    mockHost.appendLog(id, "stdout.log", "Prefix repaired");
    mockHost.persist();
    return true;
  },

  toggleDesktopShortcut(id: string, val: boolean) {
    if (Native.isAvailable()) return window.Win12Native!.toggleDesktopShortcut(id, val);
    return mockHost.toggleDesktopShortcut(id, val);
  },

  getPinnedApps(): WinApp[] {
    if (Native.isAvailable() && typeof window.Win12Native!.getPinnedApps === "function") {
      return parseJson(() => window.Win12Native!.getPinnedApps!(), []);
    }
    const ids = new Set(mockHost.state.pinned);
    return mockHost.state.apps.filter((a) => ids.has(a.id));
  },

  setPinned(id: string, pinned: boolean) {
    if (Native.isAvailable() && typeof window.Win12Native!.setPinned === "function") {
      return window.Win12Native!.setPinned!(id, pinned);
    }
    return mockHost.setPinned(id, pinned);
  },

  searchApps(query: string): WinApp[] {
    if (Native.isAvailable() && typeof window.Win12Native!.searchApps === "function") {
      return parseJson(() => window.Win12Native!.searchApps!(query), []);
    }
    return mockHost.searchApps(query);
  },

  installRuntime(bundleUrl: string, expectedSha256?: string) {
    if (Native.isAvailable() && typeof window.Win12Native!.installRuntime === "function") {
      window.Win12Native!.installRuntime!(bundleUrl, expectedSha256 || "");
    }
  },

  cancelRuntimeInstall() {
    if (Native.isAvailable() && typeof window.Win12Native!.cancelRuntimeInstall === "function") {
      window.Win12Native!.cancelRuntimeInstall!();
    }
  },

  uninstallRuntime() {
    if (Native.isAvailable() && typeof window.Win12Native!.uninstallRuntime === "function") {
      return window.Win12Native!.uninstallRuntime!();
    }
    return mockHost.uninstallRuntime();
  },

  getVirtualDriveContents(path: string): DriveListing {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getVirtualDriveContents(path), {
        currentPath: path,
        items: [],
      });
    }
    return mockHost.getDriveContents(path);
  },

  createVirtualFolder(path: string, name: string) {
    if (Native.isAvailable()) return window.Win12Native!.createVirtualFolder(path, name);
    return mockHost.createFolder(path, name);
  },

  deleteVirtualFile(path: string) {
    if (Native.isAvailable()) return window.Win12Native!.deleteVirtualFile(path);
    return mockHost.deleteFile(path);
  },

  hasAllFilesAccess() {
    if (Native.isAvailable()) return window.Win12Native!.hasAllFilesAccess();
    return mockHost.state.allFilesAccess;
  },

  requestAllFilesAccess() {
    if (Native.isAvailable()) window.Win12Native!.requestAllFilesAccess();
    else {
      mockHost.state.allFilesAccess = true;
      mockHost.persist();
    }
  },

  getLogs(appId: string): Record<string, string> {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getLogs(appId), {
        "system.log": "[System] Operating in standalone preview mode.",
      });
    }
    return mockHost.getLogs(appId);
  },

  clearLogs(appId: string) {
    if (Native.isAvailable()) return window.Win12Native!.clearLogs(appId);
    return mockHost.clearLogs(appId);
  },

  getRunningProcesses(): ProcessInfo[] {
    if (Native.isAvailable()) {
      return parseJson(() => window.Win12Native!.getRunningProcesses(), []);
    }
    return [...mockHost.state.processes];
  },

  showToast(msg: string) {
    if (Native.isAvailable()) window.Win12Native!.showToast(msg);
  },
};
