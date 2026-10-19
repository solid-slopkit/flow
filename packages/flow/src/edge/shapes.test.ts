import { describe, expect, test } from 'vitest';

import type { EndPoint } from '../geometry/geometry';
import type { Point } from '../model/model';
import { bezierShape, edgeShapes, smoothStepShape, stepShape, straightShape } from './shapes';

const end = (x: number, y: number, side: EndPoint['side']): EndPoint => ({ x, y, side });

/** The points of an `M … L …` path. */
const corners = (d: string): Point[] =>
  d
    .slice(2)
    .split(' L ')
    .map((pair) => {
      const [x, y] = pair.split(' ').map(Number);
      return { x: x!, y: y! };
    });

/** Every run between two corners is horizontal or vertical. */
const orthogonal = (points: Point[]) => points.slice(1).every((point, i) => point.x === points[i]!.x || point.y === points[i]!.y);

describe('straightShape', () => {
  test('a line between the ends, labelled at its middle', () => {
    expect(straightShape(end(0, 0, 'right'), end(100, 50, 'left'))).toEqual({ d: 'M 0 0 L 100 50', label: { x: 50, y: 25 } });
  });
});

describe('bezierShape', () => {
  test('leaves each end toward its side, labelled at the curve’s middle', () => {
    const { d, label } = bezierShape(end(0, 0, 'right'), end(200, 100, 'left'));
    expect(d).toBe('M 0 0 C 100 0 100 100 200 100');
    expect(label).toEqual({ x: 100, y: 50 });
  });

  test('keeps a fixed arm when the other end is behind', () => {
    expect(bezierShape(end(100, 0, 'right'), end(0, 0, 'left')).d).toBe('M 100 0 C 150 0 -50 0 0 0');
  });

  test('vertical sides bend vertically', () => {
    expect(bezierShape(end(0, 0, 'bottom'), end(0, 200, 'top')).d).toBe('M 0 0 C 0 100 0 100 0 200');
  });
});

describe('stepShape', () => {
  test('ends facing each other turn halfway between them', () => {
    const { d, label } = stepShape(end(0, 0, 'right'), end(200, 100, 'left'));
    expect(corners(d)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(label).toEqual({ x: 100, y: 50 });
  });

  test('ends in line are one straight run', () => {
    expect(stepShape(end(0, 0, 'right'), end(200, 0, 'left')).d).toBe('M 0 0 L 200 0');
  });

  test('ends facing away leave each end before crossing between them', () => {
    const points = corners(stepShape(end(100, 0, 'right'), end(0, 100, 'left')).d);
    expect(points).toEqual([
      { x: 100, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 50 },
      { x: -20, y: 50 },
      { x: -20, y: 100 },
      { x: 0, y: 100 },
    ]);
  });

  test('ends facing the same way go round the one further out', () => {
    expect(corners(stepShape(end(0, 0, 'right'), end(100, 100, 'right')).d)).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 100 },
      { x: 100, y: 100 },
    ]);
  });

  test('a side to a top end ahead turns once', () => {
    expect(corners(stepShape(end(0, 0, 'right'), end(100, 100, 'top')).d)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  test('a bottom end turns once into a side end', () => {
    expect(corners(stepShape(end(0, 0, 'bottom'), end(100, 100, 'left')).d)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);
  });

  test('stays orthogonal and leaves toward each side for every pair of sides', () => {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    for (const from of sides)
      for (const to of sides)
        for (const [x, y] of [
          [200, 120],
          [-150, 40],
          [30, -200],
        ] as const) {
          const points = corners(stepShape(end(0, 0, from), end(x, y, to)).d);
          expect(orthogonal(points), `${from} → ${to} at ${x}, ${y}`).toBe(true);
          expect(points[0]).toEqual({ x: 0, y: 0 });
          expect(points.at(-1)).toEqual({ x, y });
          // The first run goes the way the source's side faces.
          const first = points[1]!;
          const out = { top: first.y < 0, right: first.x > 0, bottom: first.y > 0, left: first.x < 0 }[from];
          expect(out, `${from} → ${to} at ${x}, ${y}`).toBe(true);
        }
  });
});

describe('smoothStepShape', () => {
  test('rounds the step’s corners', () => {
    const { d, label } = smoothStepShape(end(0, 0, 'right'), end(200, 100, 'left'));
    expect(d).toBe('M 0 0 L 92 0 Q 100 0 100 8 L 100 92 Q 100 100 108 100 L 200 100');
    expect(label).toEqual({ x: 100, y: 50 });
  });

  test('a corner’s radius is at most half of either run', () => {
    expect(smoothStepShape(end(0, 0, 'right'), end(200, 6, 'left')).d).toBe(
      'M 0 0 L 97 0 Q 100 0 100 3 L 100 3 Q 100 6 103 6 L 200 6',
    );
  });
});

test('edgeShapes names every shape', () => {
  expect(edgeShapes).toEqual({
    bezier: bezierShape,
    straight: straightShape,
    step: stepShape,
    'smooth-step': smoothStepShape,
    'routed-step': stepShape,
  });
});
