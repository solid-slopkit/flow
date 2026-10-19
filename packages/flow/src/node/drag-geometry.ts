// The geometry of dragging Nodes, without a DOM: grid snapping, keeping a Node in its Parent, alignment with other
// Nodes and finding the Node a drag is dropped onto. Everything is in Flow coordinates.
import type { Guide } from '../flow/internals';
import type { Point, Rect, Size } from '../model/model';

export const snapToGrid = (value: number, spacing: number) => Math.round(value / spacing) * spacing;

/** A position relative to the Parent, kept so the Node stays inside a Parent of `parent` size. */
export function keepInside(position: Point, size: Size, parent: Size): Point {
  return {
    x: Math.min(Math.max(position.x, 0), Math.max(parent.width - size.width, 0)),
    y: Math.min(Math.max(position.y, 0), Math.max(parent.height - size.height, 0)),
  };
}

const xLines = (box: Rect) => [box.x, box.x + box.width / 2, box.x + box.width];
const yLines = (box: Rect) => [box.y, box.y + box.height / 2, box.y + box.height];

/** The smallest shift (within `threshold`) that lines one of `lines` up with one of the other boxes' lines. */
function nearest(lines: number[], others: number[][], threshold: number): number | undefined {
  let best: number | undefined;
  for (const other of others)
    for (const line of other)
      for (const own of lines) {
        const shift = line - own;
        if (Math.abs(shift) <= threshold && (best === undefined || Math.abs(shift) < Math.abs(best))) best = shift;
      }
  return best;
}

const EPSILON = 0.5;

/**
 * Lines up a moving box with other boxes: its left, centre and right with theirs, and its top, middle and bottom.
 * Returns the shift on each axis (`undefined` when nothing is within `threshold`) and a guide for every line that
 * matches after shifting, spanning both boxes.
 */
export function align(moving: Rect, others: readonly Rect[], threshold: number) {
  const dx = nearest(xLines(moving), others.map(xLines), threshold);
  const dy = nearest(yLines(moving), others.map(yLines), threshold);
  const moved = { ...moving, x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0) };
  const guides: Guide[] = [];
  const seen = new Set<string>();
  for (const other of others) {
    if (dx !== undefined)
      for (const line of xLines(moved))
        if (xLines(other).some((otherLine) => Math.abs(otherLine - line) < EPSILON)) {
          const y1 = Math.min(moved.y, other.y);
          const y2 = Math.max(moved.y + moved.height, other.y + other.height);
          const key = `x${line}`;
          if (!seen.has(key)) guides.push({ x1: line, y1, x2: line, y2 });
          else {
            const guide = guides.find((existing) => existing.x1 === line && existing.x2 === line)!;
            guide.y1 = Math.min(guide.y1, y1);
            guide.y2 = Math.max(guide.y2, y2);
          }
          seen.add(key);
        }
    if (dy !== undefined)
      for (const line of yLines(moved))
        if (yLines(other).some((otherLine) => Math.abs(otherLine - line) < EPSILON)) {
          const x1 = Math.min(moved.x, other.x);
          const x2 = Math.max(moved.x + moved.width, other.x + other.width);
          const key = `y${line}`;
          if (!seen.has(key)) guides.push({ x1, y1: line, x2, y2: line });
          else {
            const guide = guides.find((existing) => existing.y1 === line && existing.y2 === line)!;
            guide.x1 = Math.min(guide.x1, x1);
            guide.x2 = Math.max(guide.x2, x2);
          }
          seen.add(key);
        }
  }
  return { dx, dy, guides };
}

export const contains = (box: Rect, point: Point) =>
  point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
