// What is in sight when the Flow renders only visible Nodes and Edges (ADR 0015). Pure: no DOM.
import type { Point, Rect, Size } from '../model/model';
import { toFlow, type Viewport } from './viewport';

/** The part of the Flow in sight, in Flow coordinates, grown by `margin` screen pixels on every side. */
export function visibleArea(viewport: Viewport, size: Size, margin: number): Rect {
  const from = toFlow(viewport, { x: -margin, y: -margin });
  const to = toFlow(viewport, { x: size.width + margin, y: size.height + margin });
  // `+ 0` makes a -0 plain 0.
  return { x: from.x + 0, y: from.y + 0, width: to.x - from.x, height: to.y - from.y };
}

/** Whether two boxes share any point, edges included, so a box with no area still counts. */
export const touches = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** The smallest box holding every point. */
export function pointsBounds(points: readonly Point[]): Rect | undefined {
  if (!points.length) return undefined;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * The points of SVG path data made only of absolute `M`, `L`, `C`, `Q` and `Z` commands, as the built-in Edge shapes
 * write it. A curve lies inside its control points, so their box holds the whole line. `undefined` for any other path.
 */
export function pathPoints(d: string): Point[] | undefined {
  if (!/^[MLCQZ\d\s.,eE+-]*$/.test(d)) return undefined;
  const numbers = d.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  if (numbers.length % 2) return undefined;
  const points: Point[] = [];
  for (let i = 0; i < numbers.length; i += 2) points.push({ x: Number(numbers[i]), y: Number(numbers[i + 1]) });
  return points;
}

/** The side of the square cells, in Flow coordinates, that tell what is near the visible area before checking exactly. */
export const CELL = 400;
/** A box spanning more cells than this is checked against the visible area directly. */
const MAX_CELLS = 64;

const cellRange = (from: number, size: number) => [Math.floor(from / CELL), Math.floor((from + size) / CELL)] as const;

/** The keys of the cells a box touches; `undefined` when it spans too many to list. */
export function cellsOf(box: Rect, max = MAX_CELLS): string[] | undefined {
  const [left, right] = cellRange(box.x, box.width);
  const [top, bottom] = cellRange(box.y, box.height);
  if ((right - left + 1) * (bottom - top + 1) > max) return undefined;
  const keys: string[] = [];
  for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) keys.push(`${x},${y}`);
  return keys;
}
