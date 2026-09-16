import { useId, useState } from 'react';
import { ArrowDown, FileText, Image, Monitor, Music2, Video, Settings2 } from 'lucide-react';
import { SYSTEM_APPS, type DesktopApp, type IconKind } from '../lib/desktop';

export function WindowsLogo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <span className={`windows-logo ${className}`} style={{ width: size, height: size }} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function ColorIcon({ kind, size = 40, color, className = '' }: { kind: IconKind; size?: number; color?: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gradient = `${uid}-gradient`;
  const highlight = `${uid}-highlight`;
  const isFolder = ['explorer', 'folder', 'download', 'music', 'video'].includes(kind) || Boolean(color);
  const folderColor = color === 'teal' ? ['#9ce2ce', '#46b7a8', '#247f80'] : color === 'purple' ? ['#d8b9ff', '#a281e2', '#7554b3'] : color === 'coral' ? ['#ffc6ab', '#f69b77', '#ca6c50'] : ['#ffe29a', '#f3bf54', '#cf8a2e'];
  const FolderDetail = kind === 'computer' ? Monitor : kind === 'download' ? ArrowDown : kind === 'document' ? FileText : kind === 'picture' ? Image : kind === 'music' ? Music2 : kind === 'video' ? Video : null;
  if (kind === 'windows') return <WindowsLogo size={size * 0.76} className={className} />;
  return <span className={`color-icon icon-${kind} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id={gradient} x1="9" y1="6" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={isFolder ? folderColor[0] : kind === 'installer' ? '#c9a8ff' : kind === 'settings' || kind === 'recycle' ? '#e4effb' : '#80d5ff'} />
          <stop offset="1" stopColor={isFolder ? folderColor[1] : kind === 'installer' ? '#7f57da' : kind === 'settings' || kind === 'recycle' ? '#829cb8' : '#3387df'} />
        </linearGradient>
        <linearGradient id={highlight} x1="24" y1="10" x2="24" y2="41" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity=".7" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
      </defs>
      {isFolder ? <>
        <path d="M4 12a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12Z" fill={folderColor[2]} />
        <path d="M7 16h32v19H7z" fill="#fff5d5" />
        <path d="M4 20a4 4 0 0 1 4-4h11l4 3h17a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V20Z" fill={`url(#${gradient})`} />
        <path d="M8 17h11l4 3h17" stroke="#fff4cf" strokeOpacity=".6" />
      </> : kind === 'computer' ? <>
        <path d="M20 35h8l1 6h5v3H14v-3h5l1-6Z" fill="#a8b8cd" />
        <rect x="3" y="6" width="42" height="30" rx="3" fill="#c2d4e9" />
        <rect x="5" y="8" width="38" height="25" rx="1.5" fill="#214875" />
        <path d="M5 32 24 9h19v24H5Z" fill={`url(#${gradient})`} />
        <path d="m12 32 15-21 11 21" fill="#4b9be7" />
      </> : kind === 'installer' ? <>
        <path d="m24 3 20 11v23L24 47 4 36V14L24 3Z" fill={`url(#${gradient})`} />
        <path d="m4 14 20 11 20-11M24 25v22" stroke="#e1d0ff" strokeWidth="1.5" strokeOpacity=".6" />
        <path d="m15 8 20 11v9l-7 4v-9L9 12" fill="#eadbff" fillOpacity=".68" />
        <path d="m9 32 9 5" stroke="#64429a" strokeWidth="2" strokeLinecap="round" />
      </> : kind === 'apps' ? <>
        <rect x="4" y="4" width="17" height="17" rx="4" fill="#6bbcff" />
        <rect x="26" y="4" width="17" height="17" rx="4" fill="#a99aef" />
        <rect x="4" y="26" width="17" height="17" rx="4" fill="#57c7c5" />
        <rect x="26" y="26" width="17" height="17" rx="4" fill="#4c8bdd" />
        <path d="M8 5h9M30 5h9M8 27h9M30 27h9" stroke="white" strokeOpacity=".4" strokeLinecap="round" />
      </> : kind === 'settings' ? <>
        <path d="m20 3 8 .1 1.3 5.5 4 2.3 5.6-1.5 4.1 7-4.2 4v4.9l4.1 4-4 7-5.6-1.6-4.2 2.4-1.2 5.7h-8l-1.4-5.7-4-2.4-5.6 1.6-4-7 4.2-4v-4.9l-4.2-4 4-7 5.6 1.5 4-2.3L20 3Z" fill={`url(#${gradient})`} />
        <circle cx="24" cy="23.5" r="10" fill="#586d88" /><circle cx="24" cy="23.5" r="6.7" fill="#a9dcff" /><circle cx="24" cy="23.5" r="4.2" fill="#559de1" />
      </> : kind === 'recycle' ? <>
        <path d="m9 12 3 30a3 3 0 0 0 3 3h19a3 3 0 0 0 3-3l3-30H9Z" fill={`url(#${gradient})`} fillOpacity=".75" />
        <path d="M8 9h33v5H8zM19 4h11v5H19z" fill="#d6e6f3" />
        <path d="m19 25 4-6 4 6m-4-6v10m8-1 3 6h-8m8 0-8-4m-7 5-7-1 4-6m-4 6 8-4" stroke="#eef7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </> : kind === 'logs' || kind === 'terminal' ? <>
        <rect x="3" y="7" width="42" height="35" rx="5" fill="#102338" stroke="#7c91aa" />
        <path d="M4 15h40" stroke="#566e88" /><circle cx="8" cy="11" r="1" fill="#91b4d9" /><circle cx="12" cy="11" r="1" fill="#91b4d9" />
        <path d="m11 23 6 5-6 5m12 0h10" stroke="#80c7ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </> : kind === 'taskmgr' ? <>
        <rect x="4" y="5" width="40" height="38" rx="5" fill="#c8deef" />
        <rect x="8" y="9" width="32" height="27" rx="2" fill="#2b6597" />
        <path d="m9 29 6-6 5 3 5-12 5 9 4-4 5 4" stroke="#97e9ee" strokeWidth="2" strokeLinejoin="round" />
        <path d="M19 39h10" stroke="#7b9bb4" strokeWidth="2" strokeLinecap="round" />
      </> : kind === 'drive' ? <>
        <path d="m9 9-6 22v10h42V31L39 9H9Z" fill="#bdd1e3" /><path d="M3 31h42v10H3z" fill="#839db8" /><circle cx="37" cy="36" r="2" fill="#8df2dd" /><path d="M9 36h17" stroke="#47627d" strokeWidth="2" />
      </> : kind === 'paint' ? <>
        <path d="M24 4C12 4 3 12 3 24s10 20 20 20c6 0 7-5 3-9-3-3 0-6 5-5 8 2 14-2 14-10C45 10 34 4 24 4Z" fill="#f0d2a6" stroke="#ba996f" strokeWidth="1" />
        <circle cx="12" cy="20" r="3.5" fill="#4fa3e7" /><circle cx="19" cy="12" r="3.5" fill="#e88376" /><circle cx="30" cy="12" r="3.5" fill="#79b482" /><circle cx="37" cy="20" r="3.5" fill="#a083cb" />
        <path d="m23 30 14-18 4 3-14 18-4-3Z" fill="#4f75a0" /><path d="M23 30c-6 1-3 6-8 8 7 3 13-2 12-5l-4-3Z" fill="#577fa9" />
      </> : kind === 'store' ? <>
        <path d="M9 14h31l3 28H6l3-28Z" fill="#80bce9" /><path d="M16 15v-4a8 8 0 0 1 16 0v4" stroke="#c8e8ff" strokeWidth="4" /><rect x="15" y="22" width="9" height="8" rx="1" fill="#e7f4ff" /><rect x="26" y="22" width="8" height="8" rx="1" fill="#b0a0e6" /><rect x="15" y="32" width="9" height="7" rx="1" fill="#d5b77b" /><rect x="26" y="32" width="8" height="7" rx="1" fill="#a0d9c8" />
      </> : kind === 'picture' || kind === 'image' || kind === 'photos' ? <>
        <rect x="5" y="5" width="38" height="38" rx="5" fill="#98d8e9" /><rect x="8" y="8" width="32" height="32" rx="2" fill="#367e9c" /><circle cx="30" cy="17" r="5" fill="#fceba0" /><path d="m8 37 11-15 9 11 6-7 6 11H8Z" fill="#a8decb" />
      </> : <>
        <path d="M11 3h19l9 9v30a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" fill={kind === 'notepad' ? '#bddff6' : '#dbe8f6'} />
        <path d="M30 3v9h9" fill="#85b8dc" /><path d="M15 20h16M15 26h16M15 32h12" stroke={kind === 'notepad' ? '#699dc6' : '#8ba9c8'} strokeWidth="2" strokeLinecap="round" />
        {kind === 'notepad' && <path d="M9 4v40" stroke="#6898be" strokeWidth="3" />}
      </>}
    </svg>
    {isFolder && FolderDetail && <FolderDetail className="folder-detail" size={size * .34} strokeWidth={2} />}
  </span>;
}

export function AppMark() { return <span className="app-mark"><Settings2 size={14} /> Win12</span>; }

export function ApplicationIcon({ app, size = 36 }: { app: DesktopApp; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const builtin = SYSTEM_APPS.find(candidate => candidate.id === app.id);
  if (builtin) return <ColorIcon kind={builtin.icon} size={size} />;
  const url = app.iconUrl;
  const safe = url && (/^https:\/\/appassets\.androidplatform\.net\/(icons|assets)\//.test(url) || /^data:image\/(png|jpeg|webp);base64,/.test(url));
  if (safe && url !== failedUrl) return <span className="application-icon" style={{ width: size, height: size }}><img src={url} width={size} height={size} alt="" draggable={false} onError={() => setFailedUrl(url)} /></span>;
  return <span title="Generic application icon"><ColorIcon kind={app.launchType === 'WINDOWS_EXECUTABLE' ? 'windows' : 'apps'} size={size} /></span>;
}