// Pan and zoom gestures on the Flow's empty space, on Pointer Events with pointer capture (ADR 0022): one path for
// mouse, pen and touch. Client-only: attached once the Flow is in the page.
import type { Point } from '../model/model';
import { zoomAround, type Viewport, type ZoomLimits } from '../viewport/viewport';

export interface GestureTarget {
  /** The Viewport as last set, current between flushes. */
  viewport(): Viewport;
  setViewport(viewport: Viewport): void;
  limits(): ZoomLimits;
  scrollPans(): boolean;
}

/** Elements of the Flow itself, not content in it: a gesture starting on one of these pans. */
export const PANE = 'data-flow-pane';

/** Built-in UI over the Flow (Controls, a MiniMap): its pointer, keys and clipboard events are its own. */
export const PANEL = '[data-flow-panel]';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** How much one wheel notch (or trackpad pixel) zooms; a pinch on a trackpad arrives as a wheel with Ctrl held. */
const WHEEL_ZOOM = 0.002;
const PINCH_WHEEL_ZOOM = 0.01;

export function attachGestures(root: HTMLElement, flow: GestureTarget): () => void {
  const pointers = new Map<number, Point>();
  let start: { viewport: Viewport; pointers: Point[] } | undefined;

  const local = (event: { clientX: number; clientY: number }): Point => {
    const rect = root.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  // Every change in the number of pointers starts the gesture afresh from the current Viewport, so lifting one finger
  // of a pinch carries on as a pan without a jump.
  const restart = () => {
    start = pointers.size === 0 ? undefined : { viewport: flow.viewport(), pointers: [...pointers.values()].slice(0, 2) };
    root.toggleAttribute('data-panning', pointers.size > 0);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!(event.target instanceof Element) || !event.target.hasAttribute(PANE)) return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
    // Shift-dragging empty space draws the selection box instead.
    if (event.shiftKey && event.button === 0) return;
    if (pointers.size >= 2) return;
    pointers.set(event.pointerId, local(event));
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (a synthetic event): the gesture still works while the pointer stays over the Flow.
    }
    restart();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!start || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, local(event));
    const [first, second] = [...pointers.values()];
    const [startFirst, startSecond] = start.pointers;
    if (!first || !startFirst) return;
    if (!second || !startSecond) {
      flow.setViewport({
        x: start.viewport.x + first.x - startFirst.x,
        y: start.viewport.y + first.y - startFirst.y,
        zoom: start.viewport.zoom,
      });
      return;
    }
    // Pinch: the Flow point under the fingers' starting midpoint follows the midpoint, scaled by their spread.
    const from = midpoint(startFirst, startSecond);
    const to = midpoint(first, second);
    const zoom = (start.viewport.zoom * distance(first, second)) / Math.max(distance(startFirst, startSecond), 1);
    const zoomed = zoomAround(start.viewport, zoom, from, flow.limits());
    flow.setViewport({ x: zoomed.x + to.x - from.x, y: zoomed.y + to.y - from.y, zoom: zoomed.zoom });
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    restart();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const scale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? root.clientHeight : 1;
    const viewport = flow.viewport();
    if (flow.scrollPans() && !event.ctrlKey) {
      flow.setViewport({ x: viewport.x - event.deltaX * scale, y: viewport.y - event.deltaY * scale, zoom: viewport.zoom });
      return;
    }
    const zoom = viewport.zoom * 2 ** (-event.deltaY * scale * (event.ctrlKey ? PINCH_WHEEL_ZOOM : WHEEL_ZOOM));
    flow.setViewport(zoomAround(viewport, zoom, local(event), flow.limits()));
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerEnd);
  root.addEventListener('pointercancel', onPointerEnd);
  root.addEventListener('lostpointercapture', onPointerEnd);
  root.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    root.removeAttribute('data-panning');
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerEnd);
    root.removeEventListener('pointercancel', onPointerEnd);
    root.removeEventListener('lostpointercapture', onPointerEnd);
    root.removeEventListener('wheel', onWheel);
  };
}
