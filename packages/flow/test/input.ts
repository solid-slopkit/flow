// Real input for browser tests: CDP sends trusted mouse, wheel and touch events, so pointer capture and touch Pointer
// Events behave as in a page. Points are viewport coordinates (the test page fills the viewport).
import { cdp } from 'vitest/browser';

export type ScreenPoint = { x: number; y: number };

/** Waits for a frame and the tasks after it: long enough for queued input, ResizeObserver and a flush. */
export const settle = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

export const mouse = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', point: ScreenPoint, extra: object = {}) =>
  cdp().send('Input.dispatchMouseEvent', {
    type,
    ...point,
    button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: 1,
    ...extra,
  });

/** Presses at `from`, moves through each point and releases at the last. */
export async function drag(from: ScreenPoint, ...through: ScreenPoint[]) {
  await mouse('mousePressed', from);
  for (const point of through) await mouse('mouseMoved', point);
  await mouse('mouseReleased', through.at(-1) ?? from);
  await settle();
}

export async function wheel(point: ScreenPoint, deltaY: number, deltaX = 0, modifiers = 0) {
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX, deltaY, modifiers });
  await settle();
}

export const touches = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: ScreenPoint[]) =>
  cdp().send('Input.dispatchTouchEvent', { type, touchPoints: points.map((point, i) => ({ ...point, id: i + 1 })) });

/** The screen point at an element's centre, or at an offset from its top-left corner. */
export function pointOf(element: Element, offset?: ScreenPoint): ScreenPoint {
  const rect = element.getBoundingClientRect();
  return offset
    ? { x: rect.left + offset.x, y: rect.top + offset.y }
    : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const KEY_CODES: Record<string, number> = {
  Tab: 9,
  Enter: 13,
  Escape: 27,
  ' ': 32,
  Delete: 46,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
};

/** Presses and releases a key on whatever has focus; `modifiers` as CDP counts them (8 is Shift). */
export async function key(name: string, modifiers = 0) {
  const event = { key: name, code: name === ' ' ? 'Space' : name, windowsVirtualKeyCode: KEY_CODES[name], modifiers };
  await cdp().send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...event });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
  await settle();
}

/** CDP's modifier bits for mouse and key events. */
export const SHIFT = 8;
