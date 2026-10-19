// The Viewport's math, without a DOM: a Flow-coordinates point p is drawn at `p * zoom + (x, y)` inside the Flow.
import type { Point, Rect, Size } from '../model/model';

/** The pan and zoom that map Flow coordinates to the screen. */
export type Viewport = { x: number; y: number; zoom: number };

export type ZoomLimits = { minZoom: number; maxZoom: number };

export type FitOptions = {
  /** Space kept free around the bounds, in screen pixels. Defaults to 24. */
  padding?: number;
};

export const DEFAULT_PADDING = 24;

export const clampZoom = (zoom: number, limits: ZoomLimits) => Math.min(limits.maxZoom, Math.max(limits.minZoom, zoom));

/** A point inside the Flow element, in screen pixels from its top-left corner, to Flow coordinates. */
export const toFlow = (viewport: Viewport, point: Point): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom,
});

/** A point in Flow coordinates to screen pixels from the Flow element's top-left corner. */
export const toScreen = (viewport: Viewport, point: Point): Point => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y,
});

/** The Viewport at a new zoom (clamped) that keeps the Flow point under `around` (inside the Flow element) in place. */
export function zoomAround(viewport: Viewport, zoom: number, around: Point, limits: ZoomLimits): Viewport {
  const next = clampZoom(zoom, limits);
  const anchor = toFlow(viewport, around);
  return { x: around.x - anchor.x * next, y: around.y - anchor.y * next, zoom: next };
}

/** The smallest box around every given box, or `undefined` for none. */
export function unionBounds(boxes: Iterable<Rect>): Rect | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  return left === Infinity ? undefined : { x: left, y: top, width: right - left, height: bottom - top };
}

/** The Viewport that shows `bounds` whole and centred in a Flow of `size`, as close as the zoom limits allow. */
export function viewportForBounds(bounds: Rect, size: Size, limits: ZoomLimits, options: FitOptions = {}): Viewport {
  const padding = options.padding ?? DEFAULT_PADDING;
  const width = Math.max(size.width - padding * 2, 1);
  const height = Math.max(size.height - padding * 2, 1);
  const fit = Math.min(width / Math.max(bounds.width, 1e-9), height / Math.max(bounds.height, 1e-9));
  const zoom = clampZoom(fit, limits);
  return {
    x: size.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: size.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}
