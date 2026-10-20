import { describe, expect, test } from 'vitest';

import type { EndPoint } from '../geometry/geometry';
import type { Point, Rect } from '../model/model';
import { routeOrthogonal } from './route';

const end = (x: number, y: number, side: EndPoint['side']): EndPoint => ({ x, y, side });
const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Every run is horizontal or vertical. */
const orthogonal = (points: Point[]) => points.slice(1).every((point, i) => point.x === points[i]!.x || point.y === points[i]!.y);

/** Whether any run passes through the box's interior, grown by `by`. */
const crosses = (points: Point[], box: Rect, by = 0) =>
  points.slice(1).some((b, i) => {
    const a = points[i]!;
    const [left, top, right, bottom] = [box.x - by, box.y - by, box.x + box.width + by, box.y + box.height + by];
    return a.y === b.y
      ? a.y > top && a.y < bottom && Math.min(a.x, b.x) < right && Math.max(a.x, b.x) > left
      : a.x > left && a.x < right && Math.min(a.y, b.y) < bottom && Math.max(a.y, b.y) > top;
  });

const bends = (points: Point[]) => points.length - 2;

// Two Nodes side by side: a Source on the left one's right side, a Target on the right one's left side.
const a = rect(0, 0, 100, 50);
const b = rect(400, 0, 100, 50);
const source = end(100, 25, 'right');
const target = end(400, 25, 'left');

describe('routeOrthogonal', () => {
  test('a straight run when nothing is in the way', () => {
    expect(routeOrthogonal(source, target, [a, b])).toEqual([
      { x: 100, y: 25 },
      { x: 400, y: 25 },
    ]);
  });

  test('goes round a Node in the way, keeping the margin', () => {
    const between = rect(200, -50, 100, 150);
    const route = routeOrthogonal(source, target, [a, b, between])!;
    expect(orthogonal(route)).toBe(true);
    expect(route[0]).toEqual({ x: 100, y: 25 });
    expect(route.at(-1)).toEqual({ x: 400, y: 25 });
    expect(crosses(route, between, 20)).toBe(false);
    expect(crosses(route, a)).toBe(false);
    expect(crosses(route, b)).toBe(false);
    // Over or under it: two turns out, two turns back.
    expect(bends(route)).toBe(4);
    expect(route.some((point) => point.y === -70 || point.y === 120)).toBe(true);
  });

  test('the margin is an option', () => {
    const between = rect(200, -50, 100, 150);
    const route = routeOrthogonal(source, target, [a, b, between], { margin: 5 })!;
    expect(route.some((point) => point.y === -55 || point.y === 105)).toBe(true);
  });

  test('leaves the Source toward its side and enters the Target from its side', () => {
    // The Target is behind the Source: the route goes round both Nodes.
    const left = rect(-400, 0, 100, 50);
    const route = routeOrthogonal(source, end(-400, 25, 'left'), [a, left])!;
    expect(orthogonal(route)).toBe(true);
    expect(route[1]!.x).toBeGreaterThan(100);
    expect(route[1]!.y).toBe(25);
    expect(route.at(-2)!.x).toBeLessThan(-400);
    expect(route.at(-2)!.y).toBe(25);
    expect(crosses(route, a)).toBe(false);
    expect(crosses(route, left)).toBe(false);
  });

  test('ends on top and bottom sides', () => {
    const top = rect(0, 0, 100, 50);
    const bottom = rect(0, 300, 100, 50);
    const between = rect(-50, 150, 200, 50);
    const route = routeOrthogonal(end(50, 50, 'bottom'), end(50, 300, 'top'), [top, bottom, between])!;
    expect(orthogonal(route)).toBe(true);
    expect(route[1]).toMatchObject({ x: 50 });
    expect(route[1]!.y).toBeGreaterThan(50);
    expect(route.at(-2)).toMatchObject({ x: 50 });
    expect(route.at(-2)!.y).toBeLessThan(300);
    expect(crosses(route, between, 20)).toBe(false);
  });

  test('turns as few times as it can', () => {
    // Any route between these ends has the same length; the one with two bends wins over a staircase.
    const low = rect(400, 200, 100, 50);
    const route = routeOrthogonal(source, end(400, 225, 'left'), [a, low], { bendPenalty: 1 })!;
    expect(orthogonal(route)).toBe(true);
    expect(bends(route)).toBe(2);
  });

  test('passes closer than the margin when it must', () => {
    // The Target is fenced in, and the one way in is a gap of 30, narrower than twice the margin.
    const fence = [
      rect(300, -200, 10, 210),
      rect(300, 40, 10, 160),
      rect(300, -200, 400, 10),
      rect(300, 190, 400, 10),
      rect(690, -200, 10, 400),
    ];
    const route = routeOrthogonal(source, target, [a, b, ...fence])!;
    expect(route).toEqual([
      { x: 100, y: 25 },
      { x: 400, y: 25 },
    ]);
  });

  test('no route when the Target is walled in', () => {
    const walls = [rect(300, -200, 10, 400), rect(300, -200, 400, 10), rect(300, 190, 400, 10), rect(600, -200, 10, 400)];
    expect(routeOrthogonal(source, target, [a, b, ...walls])).toBeUndefined();
  });

  test('ignores an obstacle with an end inside it', () => {
    const over = rect(50, 0, 100, 50);
    expect(routeOrthogonal(source, target, [a, b, over])).toEqual([
      { x: 100, y: 25 },
      { x: 400, y: 25 },
    ]);
  });

  test('keeps a preferred route that crosses nothing', () => {
    const prefer = [
      { x: 100, y: 25 },
      { x: 250, y: 25 },
      { x: 250, y: 25 },
      { x: 400, y: 25 },
    ];
    expect(routeOrthogonal(source, target, [a, b], { prefer })).toEqual([
      { x: 100, y: 25 },
      { x: 400, y: 25 },
    ]);
  });

  test('routes round a preferred route that crosses a Node', () => {
    const between = rect(200, -50, 100, 150);
    const prefer = [
      { x: 100, y: 25 },
      { x: 400, y: 25 },
    ];
    expect(crosses(routeOrthogonal(source, target, [a, b, between], { prefer })!, between, 20)).toBe(false);
  });

  test('far away Nodes don’t change the route', () => {
    const between = rect(200, -50, 100, 150);
    const far = Array.from({ length: 50 }, (_, i) => rect(5000 + i * 200, 5000, 100, 50));
    expect(routeOrthogonal(source, target, [a, b, between, ...far])).toEqual(routeOrthogonal(source, target, [a, b, between]));
  });

  test('is the same every time', () => {
    const between = rect(200, -50, 100, 100);
    const route = routeOrthogonal(source, target, [a, b, between]);
    expect(routeOrthogonal(source, target, [a, b, between])).toEqual(route);
  });
});
