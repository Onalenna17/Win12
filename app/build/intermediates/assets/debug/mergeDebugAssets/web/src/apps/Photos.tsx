import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, FolderOpen, Image as ImageIcon, Info, Palette, RotateCw, Upload, Wallpaper, ZoomIn, ZoomOut } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { capabilities, folderPath, FS, nativeAvailable, operation, wallpaperCatalog, wallpaperImage, type DesktopWindow, type FileItem, type WallpaperItem } from '../lib/desktop';
import { EmptyState, IconButton } from '../components/Shared';

interface Photo { id: string; name: string; src: string; subtitle: string; wallpaper?: WallpaperItem; file?: FileItem }
export function PhotosApp({ win }: { win: DesktopWindow }) {
  const { portrait, preferences, updatePreferences, showToast, openSystem, revision } = useDesktop();
  const [tab, setTab] = useState<'pictures' | 'wallpapers'>(win.args?.path ? 'pictures' : 'wallpapers');
  const [selectedId, setSelectedId] = useState(win.args?.path || preferences.wallpaper);
  const [localRevision, setLocalRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fit, setFit] = useState(true);
  const [error, setError] = useState(false);
  const [details, setDetails] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (win.args?.path) { setTab('pictures'); setSelectedId(win.args.path); } }, [win.args?.path]);
  useEffect(() => { const refresh = () => setLocalRevision(value => value + 1); window.addEventListener('win12-wallpapers-changed', refresh); return () => window.removeEventListener('win12-wallpapers-changed', refresh); }, []);
  const wallpapers = useMemo(() => wallpaperCatalog(), [localRevision]);
  const pictures = useMemo(() => {
    const list = folderPath('Pictures') ? [...FS.list(folderPath('Pictures')).items] : [];
    if (win.args?.path && !list.some(file => file.path === win.args?.path)) { const extra = FS.find(win.args.path); if (extra) list.unshift(extra); }
    return list.filter(file => file.type === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(file.name) && !file.originalPath);
  }, [revision, localRevision, win.args?.path]);
  const photos: Photo[] = tab === 'wallpapers' ? wallpapers.map(item => ({ id: item.id, name: item.name, src: wallpaperImage(item, portrait), subtitle: item.quality || 'User image', wallpaper: item })) : pictures.map(file => ({ id: file.path, name: file.name, src: file.previewUrl || file.content || '', subtitle: 'Your Pictures folder', file }));
  const current = photos.find(photo => photo.id === selectedId) || photos[0];
  const currentIndex = photos.findIndex(photo => photo.id === current?.id);
  useEffect(() => { setError(false); setZoom(1); setRotation(0); setFit(true); setDimensions({ width: 0, height: 0 }); }, [current?.id, current?.src]);
  const next = (offset: number) => { if (photos.length) setSelectedId(photos[(currentIndex + offset + photos.length) % photos.length].id); };
  const importImage = async (file: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 15 * 1024 * 1024) { showToast('Unsupported image', 'Choose a PNG, JPEG, WebP, or GIF image smaller than 15 MB.'); return; }
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 32_000_000) { bitmap.close(); throw new Error('This image is too large to import safely.'); }
      const scale = Math.min(1, 3840 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const filename = `${file.name.replace(/\.[^.]+$/, '')}.png`;
      const response = FS.savePng(filename, canvas.toDataURL('image/png'));
      if (!response.success) throw new Error(response.message || 'Image could not be saved.');
      setTab('pictures'); setSelectedId(response.path || ''); setLocalRevision(value => value + 1); showToast('Image imported', `${filename} is saved in Pictures.`);
    } catch (error) { showToast('Import failed', error instanceof Error ? error.message : 'The image could not be read.'); }
  };
  const download = () => {
    if (!current?.file) return;
    if (nativeAvailable()) { const response = FS.export(current.file.path); if (!response.success) showToast('Export failed', response.message || 'Android could not export the image.'); }
    else if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(current.src)) { const link = document.createElement('a'); link.href = current.src; link.download = current.name; link.click(); }
    else showToast('Download unavailable', 'No browser-readable image data is available.');
  };
  return <div className="photos-app" onKeyDown={event => {
    if ((event.target as HTMLElement).matches('input, textarea, select')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); next(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); next(1); }
  }}>
    <aside className="photos-sidebar"><div className="photos-nav"><button className={tab === 'wallpapers' ? 'active' : ''} onClick={() => setTab('wallpapers')}><Wallpaper size={16} /><span>HD backgrounds</span></button><button className={tab === 'pictures' ? 'active' : ''} onClick={() => setTab('pictures')}><ImageIcon size={16} /><span>Your pictures</span></button></div><div className="photos-thumbnails">{photos.map(photo => <button className={current?.id === photo.id ? 'active' : ''} key={photo.id} title={photo.name} onClick={() => setSelectedId(photo.id)}><div>{photo.src ? <img src={photo.src} alt="" loading="lazy" /> : <ImageIcon size={28} />}</div><span>{photo.name}</span></button>)}</div><button className="photos-import" onClick={() => importRef.current?.click()}><Upload size={15} /><span>Import image</span></button></aside>
    <main className="photos-view"><header className="photos-toolbar"><div><h2>{current?.name || 'Your pictures'}</h2><small>{current?.subtitle || 'Real images from your accessible storage'}</small></div><div><IconButton title="Previous image" disabled={photos.length < 2} onClick={() => next(-1)}><ChevronLeft size={17} /></IconButton><IconButton title="Next image" disabled={photos.length < 2} onClick={() => next(1)}><ChevronRight size={17} /></IconButton><IconButton title="Image information" disabled={!current} onClick={() => setDetails(value => !value)}><Info size={17} /></IconButton></div></header>
      {current ? <div className={`photos-image-stage ${fit ? 'fit' : 'zoomed'}`} tabIndex={0}>{!error ? <img key={current.src} src={current.src} alt={current.name} style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, objectFit: 'contain' }} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError(true)} /> : <EmptyState icon={<ImageIcon size={42} />} title="Image unavailable" description="The image is missing or its storage permission has changed." />}</div> : <EmptyState icon={<ImageIcon size={43} />} title="Your moments belong here" description="Import an image or save a drawing from Paint. Your personal photo library is never fabricated."><button className="primary-button" onClick={() => importRef.current?.click()}><Upload size={15} />Import image</button>{nativeAvailable() && capabilities().storagePicker && <button className="text-button" onClick={() => { const response = operation('requestStorageLocation'); if (!response.success) showToast('Storage unavailable', response.message || 'Android storage picker is not available.'); }}>Connect an Android folder<ArrowRightIcon /></button>}</EmptyState>}
      {details && current && <section className="photos-info"><strong>{dimensions.width && dimensions.height ? `${dimensions.width} x ${dimensions.height}` : 'Dimensions unavailable'}</strong><p>{current.wallpaper?.source || current.file?.path}</p>{current.wallpaper && <small>Original or user-supplied imagery, not official Microsoft wallpaper.</small>}</section>}
      <footer className="photos-bottom"><div className="photos-zoom"><IconButton title="Zoom out" disabled={!current || zoom <= .5} onClick={() => { setZoom(value => Math.max(.5, value - .25)); setFit(false); }}><ZoomOut size={16} /></IconButton><span>{Math.round(zoom * 100)}%</span><IconButton title="Zoom in" disabled={!current || zoom >= 3} onClick={() => { setZoom(value => Math.min(3, value + .25)); setFit(false); }}><ZoomIn size={16} /></IconButton><IconButton title="Fit image" disabled={!current} onClick={() => { setFit(true); setZoom(1); setRotation(0); }}><Expand size={16} /></IconButton><IconButton title="Rotate preview" disabled={!current} onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw size={16} /></IconButton></div><div>{current?.wallpaper ? <button className="primary-button" onClick={() => updatePreferences({ wallpaper: current.wallpaper!.id })}><Palette size={14} />{preferences.wallpaper === current.wallpaper.id ? 'Current wallpaper' : 'Set as wallpaper'}</button> : <IconButton title={nativeAvailable() ? 'Export image' : 'Download image'} disabled={!current?.file || error} onClick={download}><Download size={16} /></IconButton>}<IconButton title="Open Pictures folder" onClick={() => openSystem('explorer', { path: folderPath('Pictures') })}><FolderOpen size={16} /></IconButton></div></footer>
    </main><input ref={importRef} className="hidden-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importImage(file); }} />
  </div>;
}
function ArrowRightIcon() { return <ChevronRight size={13} />; }