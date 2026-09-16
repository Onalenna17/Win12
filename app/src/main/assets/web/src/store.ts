const STORAGE_KEY = "win12.desktopState.v1";

type Dict = Record<string, unknown>;

function readNative(): Dict | null {
  if (typeof window === "undefined") return null;
  const native = window.Win12Native;
  if (native && typeof native.loadDesktopState === "function") {
    try {
      const raw = native.loadDesktopState();
      if (raw) return JSON.parse(raw) as Dict;
    } catch (e) {
      console.error("Win12 StateStore: native read failed", e);
    }
  }
  return null;
}

function writeNative(obj: Dict) {
  if (typeof window === "undefined") return;
  const native = window.Win12Native;
  if (native && typeof native.saveDesktopState === "function") {
    try {
      native.saveDesktopState(JSON.stringify(obj));
    } catch (e) {
      console.error("Win12 StateStore: native write failed", e);
    }
  }
}

let cache: Dict | null = null;

export const StateStore = {
  load(): Dict {
    if (cache) return cache;
    let data = readNative();
    if (!data) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        data = raw ? (JSON.parse(raw) as Dict) : null;
      } catch {
        data = null;
      }
    }
    cache = data && typeof data === "object" ? data : {};
    return cache;
  },

  save(partial: Dict) {
    const current = this.load();
    Object.assign(current, partial);
    cache = current;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error("Win12 StateStore: localStorage write failed", e);
    }
    writeNative(current);
  },

  get<T>(key: string, fallback: T): T {
    const data = this.load();
    return key in data ? (data[key] as T) : fallback;
  },

  set(key: string, value: unknown) {
    this.save({ [key]: value });
  },

  clearCache() {
    cache = null;
  },
};
