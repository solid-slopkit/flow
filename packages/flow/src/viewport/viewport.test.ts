import { describe, expect, test } from 'vitest';

import { clampZoom, toFlow, toScreen, unionBounds, viewportForBounds, zoomAround } from './viewport';

const limits = { minZoom: 0.5, maxZoom: 2 };

describe('viewport math', () => {
  test('toFlow and toScreen are inverses', () => {
    const viewport = { x: 30, y: -10, zoom: 1.5 };
    expect(toScreen(viewport, { x: 10, y: 20 })).toEqual({ x: 45, y: 20 });
    expect(toFlow(viewport, { x: 45, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  test('clampZoom', () => {
    expect(clampZoom(5, limits)).toBe(2);
    expect(clampZoom(0.1, limits)).toBe(0.5);
    expect(clampZoom(1, limits)).toBe(1);
  });

  test('zoomAround keeps the anchor in place, clamping the zoom', () => {
    const viewport = { x: 10, y: 10, zoom: 1 };
    const around = { x: 100, y: 50 };
    const zoomed = zoomAround(viewport, 1.5, around, limits);
    expect(toFlow(zoomed, around)).toEqual(toFlow(viewport, around));
    expect(zoomAround(viewport, 9, around, limits).zoom).toBe(2);
  });

  test('unionBounds', () => {
    expect(unionBounds([])).toBeUndefined();
    expect(
      unionBounds([
        { x: 0, y: 10, width: 10, height: 10 },
        { x: -5, y: 0, width: 5, height: 50 },
      ]),
    ).toEqual({ x: -5, y: 0, width: 15, height: 50 });
  });

  test('viewportForBounds centres the bounds, and a point has the largest zoom', () => {
    expect(viewportForBounds({ x: 0, y: 0, width: 100, height: 50 }, { width: 248, height: 248 }, limits)).toEqual({
      x: 24,
      y: 74,
      zoom: 2,
    });
    expect(viewportForBounds({ x: 10, y: 10, width: 0, height: 0 }, { width: 100, height: 100 }, limits)).toEqual({
      x: 30,
      y: 30,
      zoom: 2,
    });
  });
});
