import { describe, expect, test } from 'vitest';

import { bezierShape, smoothStepShape, stepShape } from '../edge/shapes';
import { pathPoints, pointsBounds, touches, visibleArea } from './visible';

describe('visibleArea', () => {
  test('is the Flow in sight, in Flow coordinates, grown by the margin in screen pixels', () => {
    expect(visibleArea({ x: 0, y: 0, zoom: 1 }, { width: 600, height: 400 }, 0)).toEqual({ x: 0, y: 0, width: 600, height: 400 });
    expect(visibleArea({ x: -100, y: 50, zoom: 2 }, { width: 600, height: 400 }, 20)).toEqual({
      x: 40,
      y: -35,
      width: 320,
      height: 220,
    });
  });
});

describe('touches', () => {
  test('counts shared edges, and a box with no area', () => {
    const area = { x: 0, y: 0, width: 100, height: 100 };
    expect(touches({ x: 100, y: 50, width: 10, height: 10 }, area)).toBe(true);
    expect(touches({ x: 50, y: 50, width: 0, height: 0 }, area)).toBe(true);
    expect(touches({ x: 101, y: 50, width: 10, height: 10 }, area)).toBe(false);
    expect(touches({ x: 50, y: -20, width: 10, height: 10 }, area)).toBe(false);
  });
});

describe('pathPoints', () => {
  const source = { x: 0, y: 0, side: 'right' as const };
  const target = { x: -200, y: 100, side: 'left' as const };

  test("holds a built-in shape's control points, so its box holds the whole line", () => {
    const bezier = pointsBounds(pathPoints(bezierShape(source, target).d)!)!;
    // The curve leaves to the right and comes in from the left, beyond both ends.
    expect(bezier.x).toBeLessThan(-200);
    expect(bezier.x + bezier.width).toBeGreaterThan(0);
    expect(pathPoints(stepShape(source, target).d)!.length).toBeGreaterThan(2);
    expect(pathPoints(smoothStepShape(source, target).d)!.length).toBeGreaterThan(2);
  });

  test('is undefined for relative commands and arcs', () => {
    expect(pathPoints('M 0 0 l 10 10')).toBeUndefined();
    expect(pathPoints('M 0 0 A 5 5 0 0 1 10 10')).toBeUndefined();
    expect(pointsBounds([])).toBeUndefined();
  });
});
