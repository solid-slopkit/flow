import { describe, expect, test } from 'vitest';

import { align, contains, keepInside, snapToGrid } from './drag-geometry';
import { resizeBox } from './NodeResizer';

describe('snapToGrid', () => {
  test('rounds to the nearest grid line', () => {
    expect(snapToGrid(14, 10)).toBe(10);
    expect(snapToGrid(15, 10)).toBe(20);
    expect(snapToGrid(-6, 10)).toBe(-10);
  });
});

describe('keepInside', () => {
  test('keeps a box inside its Parent', () => {
    const parent = { width: 100, height: 100 };
    expect(keepInside({ x: -5, y: 90 }, { width: 20, height: 20 }, parent)).toEqual({ x: 0, y: 80 });
    expect(keepInside({ x: 30, y: 40 }, { width: 20, height: 20 }, parent)).toEqual({ x: 30, y: 40 });
    expect(keepInside({ x: 30, y: 40 }, { width: 200, height: 20 }, parent)).toEqual({ x: 0, y: 40 });
  });
});

describe('align', () => {
  const other = { x: 100, y: 100, width: 100, height: 50 };

  test('snaps the nearest edge or centre within the threshold, with a guide spanning both boxes', () => {
    const { dx, dy, guides } = align({ x: 103, y: 300, width: 40, height: 40 }, [other], 5);
    expect(dx).toBe(-3);
    expect(dy).toBeUndefined();
    expect(guides).toEqual([{ x1: 100, y1: 100, x2: 100, y2: 340 }]);
  });

  test('lines up centres', () => {
    const { dx, dy } = align({ x: 300, y: 104, width: 40, height: 40 }, [other], 5);
    // Middle 124 to the other's middle 125.
    expect(dy).toBe(1);
    expect(dx).toBeUndefined();
  });

  test('takes the closest of several matches, and merges guides on the same line', () => {
    const below = { x: 100, y: 400, width: 10, height: 10 };
    const { dx, guides } = align({ x: 102, y: 200, width: 50, height: 50 }, [other, below], 5);
    expect(dx).toBe(-2);
    // The left edge on both boxes' left edges, and the right edge on the first box's centre.
    expect(guides).toEqual([
      { x1: 100, y1: 100, x2: 100, y2: 410 },
      { x1: 150, y1: 100, x2: 150, y2: 250 },
    ]);
  });

  test('nothing within the threshold', () => {
    expect(align({ x: 500, y: 500, width: 10, height: 10 }, [other], 5)).toEqual({ dx: undefined, dy: undefined, guides: [] });
  });
});

test('contains', () => {
  expect(contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 5 })).toBe(true);
  expect(contains({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 5 })).toBe(false);
});

describe('resizeBox', () => {
  const start = { position: { x: 100, y: 100 }, size: { width: 100, height: 50 } };
  const limits = { minWidth: 10, minHeight: 10, maxWidth: 300, maxHeight: 300, keepAspectRatio: false };

  test('the right and bottom edges grow the size', () => {
    expect(resizeBox(start, { x: 1, y: 1 }, { x: 20, y: 10 }, limits)).toEqual({
      position: { x: 100, y: 100 },
      size: { width: 120, height: 60 },
    });
  });

  test('the left and top edges move the position, keeping the opposite edges', () => {
    expect(resizeBox(start, { x: -1, y: -1 }, { x: 20, y: 10 }, limits)).toEqual({
      position: { x: 120, y: 110 },
      size: { width: 80, height: 40 },
    });
  });

  test('a side handle changes one dimension', () => {
    expect(resizeBox(start, { x: 0, y: 1 }, { x: 50, y: 10 }, limits).size).toEqual({ width: 100, height: 60 });
  });

  test('stays within min and max, without moving the fixed edge', () => {
    expect(resizeBox(start, { x: -1, y: 0 }, { x: 200, y: 0 }, limits)).toEqual({
      position: { x: 190, y: 100 },
      size: { width: 10, height: 50 },
    });
    expect(resizeBox(start, { x: 1, y: 0 }, { x: 500, y: 0 }, limits).size.width).toBe(300);
  });

  test('keeps the aspect ratio: a corner follows the larger change, a side drives the other dimension', () => {
    const keep = { ...limits, keepAspectRatio: true };
    expect(resizeBox(start, { x: 1, y: 1 }, { x: 100, y: 10 }, keep).size).toEqual({ width: 200, height: 100 });
    expect(resizeBox(start, { x: 1, y: 1 }, { x: 0, y: 50 }, keep).size).toEqual({ width: 200, height: 100 });
    expect(resizeBox(start, { x: 0, y: 1 }, { x: 0, y: 25 }, keep).size).toEqual({ width: 150, height: 75 });
    expect(resizeBox(start, { x: -1, y: -1 }, { x: -100, y: 0 }, keep)).toEqual({
      position: { x: 0, y: 50 },
      size: { width: 200, height: 100 },
    });
  });

  test('keeps the ratio at the limits', () => {
    const keep = { ...limits, keepAspectRatio: true, maxWidth: 150 };
    expect(resizeBox(start, { x: 1, y: 1 }, { x: 400, y: 0 }, keep).size).toEqual({ width: 150, height: 75 });
    expect(resizeBox(start, { x: 1, y: 1 }, { x: -95, y: 0 }, keep).size).toEqual({ width: 20, height: 10 });
  });
});
