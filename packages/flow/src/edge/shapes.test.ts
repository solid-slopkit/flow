import { describe, expect, test } from 'vitest';

import type { EndPoint } from '../geometry/geometry';
import type { Point, Rect } from '../model/model';
import {
  bezierShape,
  edgeShapes,
  routedStepShape,
  smoothStepShape,
  stepShape,
  straightShape,
  type EdgeShapeContext,
} from './shapes';

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
    'routed-step': routedStepShape,
  });
});

describe('routedStepShape', () => {
  const context = (obstacles: Rect[], route?: Point[]): EdgeShapeContext => ({
    edge: { id: 'e', source: { node: 'a' }, target: { node: 'b' }, route, data: null },
    nodeBounds: () => undefined,
    obstacles: () => obstacles,
  });
  const a = { x: -100, y: -25, width: 100, height: 50 };
  const b = { x: 200, y: 75, width: 100, height: 50 };

  test('is the step line while it crosses no Node', () => {
    const source = end(0, 0, 'right');
    const target = end(200, 100, 'left');
    expect(routedStepShape(source, target, context([a, b]))).toEqual(stepShape(source, target));
  });

  test('without a context, is the step line', () => {
    expect(routedStepShape(end(0, 0, 'right'), end(200, 100, 'left'))).toEqual(
      stepShape(end(0, 0, 'right'), end(200, 100, 'left')),
    );
  });

  test('goes round a Node across the step line, labelled halfway along', () => {
    const wall = { x: 60, y: -100, width: 80, height: 300 };
    const { d, label } = routedStepShape(end(0, 0, 'right'), end(200, 100, 'left'), context([a, b, wall]));
    const points = corners(d);
    expect(orthogonal(points)).toBe(true);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 200, y: 100 });
    // Over or under the wall, keeping 20 from it.
    expect(points.some((point) => point.y === -120 || point.y === 220)).toBe(true);
    expect(points.every((point) => point.x <= 40 || point.x >= 160 || point.y <= -120 || point.y >= 220)).toBe(true);
    expect(label).toBeDefined();
  });

  test('is the step line when no route exists', () => {
    const walls = [{ x: 100, y: -1000, width: 10, height: 2000 }];
    const boxed = context([
      a,
      b,
      ...walls,
      { x: 110, y: -1000, width: 1000, height: 10 },
      { x: 110, y: 990, width: 1000, height: 10 },
      { x: 1100, y: -1000, width: 10, height: 2000 },
    ]);
    expect(routedStepShape(end(0, 0, 'right'), end(200, 100, 'left'), boxed)).toEqual(
      stepShape(end(0, 0, 'right'), end(200, 100, 'left')),
    );
  });

  describe('with a route, such as a Layout’s', () => {
    const source = end(0, 0, 'right');
    const target = end(200, 100, 'left');
    const route = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 100 },
      { x: 200, y: 100 },
    ];

    test('draws the route while it joins the ends and crosses no Node', () => {
      expect(corners(routedStepShape(source, target, context([a, b], route)).d)).toEqual(route);
    });

    test('takes the ends as they are when the route is within half a unit of them', () => {
      const off = [{ x: 0.4, y: 0 }, ...route.slice(1, -1), { x: 200, y: 100.3 }];
      expect(corners(routedStepShape(source, target, context([a, b], off)).d)).toEqual(route);
    });

    test('routes afresh once an end has moved', () => {
      const moved = end(200, 140, 'left');
      expect(routedStepShape(source, moved, context([a, b], route))).toEqual(stepShape(source, moved));
    });

    test('routes afresh once a Node crosses it', () => {
      const across = { x: 10, y: 40, width: 40, height: 20 };
      const points = corners(routedStepShape(source, target, context([a, b, across], route)).d);
      expect(points).not.toEqual(route);
      expect(points.every((point) => point.x !== 30)).toBe(true);
    });
  });
});
