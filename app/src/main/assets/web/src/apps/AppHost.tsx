import { useDesktop } from '../context/DesktopContext';
import type { DesktopWindow } from '../lib/desktop';
import { Explorer } from '../components/Explorer';
import { Settings } from '../components/Settings';
import { Applications } from '../components/Applications';
import { ImageViewer, Installer, LogViewer, Notepad, TaskManager } from '../components/Utilities';
import { PaintApp } from './Paint';
import { PhotosApp } from './Photos';
import { SoftwareCenterApp } from './SoftwareCenter';
import { TerminalApp } from './Terminal';

/** Only real embedded WIN12 implementations belong here; external Android apps use intents. */
export function AppHost({ win }: { win: DesktopWindow }) {
  const desktop = useDesktop();
  const props = { win, actions: desktop.actions };
  switch (win.kind) {
    case 'explorer': case 'recycle': return <Explorer {...props} />;
    case 'settings': return <Settings {...props} preferences={desktop.preferences} onPreferences={desktop.updatePreferences} />;
    case 'apps': return <Applications {...props} pinned={desktop.pinnedIds} taskbarPins={desktop.taskbarPinIds} shortcuts={desktop.shortcutIds} onPin={desktop.togglePin} onTaskbarPin={desktop.toggleTaskbarPin} onShortcut={desktop.toggleShortcut} />;
    case 'installer': return <Installer {...props} />;
    case 'logs': return <LogViewer {...props} />;
    case 'taskmgr': return <TaskManager windows={desktop.windows} actions={desktop.actions} activeId={desktop.activeWindowId} />;
    case 'notepad': return <Notepad {...props} />;
    case 'image': return <ImageViewer {...props} />;
    case 'paint': return <PaintApp win={win} />;
    case 'photos': return <PhotosApp win={win} />;
    case 'store': return <SoftwareCenterApp win={win} />;
    case 'terminal': return <TerminalApp win={win} />;
  }
}