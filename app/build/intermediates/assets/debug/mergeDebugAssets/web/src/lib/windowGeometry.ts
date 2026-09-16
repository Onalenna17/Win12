import type { Bounds } from './desktop';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
export function resizedBounds(bounds: Bounds, direction: ResizeDirection, dx: number, dy: number, screenWidth: number, usableHeight: number): Bounds {
  const minWidth = Math.min(340, Math.max(160, screenWidth / 2), screenWidth);
  const minHeight = Math.min(240, Math.max(100, usableHeight / 2), usableHeight);
  let left = clamp(bounds.x, 0, screenWidth - minWidth), top = clamp(bounds.y, 0, usableHeight - minHeight);
  let right = clamp(bounds.x + bounds.width, left + minWidth, screenWidth), bottom = clamp(bounds.y + bounds.height, top + minHeight, usableHeight);
  if (direction.includes('e')) right = clamp(bounds.x + bounds.width + dx, left + minWidth, screenWidth);
  if (direction.includes('s')) bottom = clamp(bounds.y + bounds.height + dy, top + minHeight, usableHeight);
  if (direction.includes('w')) left = clamp(bounds.x + dx, 0, right - minWidth);
  if (direction.includes('n')) top = clamp(bounds.y + dy, 0, bottom - minHeight);
  return { x: left, y: top, width: right - left, height: bottom - top };
}