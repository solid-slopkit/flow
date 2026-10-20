// The orthogonal router behind routed step Edges (ADR 0021): an A* search with a penalty per bend over a sparse grid
// whose lines run along the Nodes' boxes plus a margin. Pure, synchronous, no DOM.
import type { EndPoint } from '../geometry/geometry';
import type { Point, Rect, Side } from '../model/model';

export interface RouteOptions {
  /** How far a route keeps from the boxes it goes round, in Flow units. Default 20. */
  margin?: number;
  /** What one bend costs, in Flow units of length. Default 40. */
  bendPenalty?: number;
  /** A route to keep as it is when it crosses no box, such as the plain step line between the ends. */
  prefer?: readonly Point[];
}

const MARGIN = 20;
const BEND_PENALTY = 40;

// Directions by index: right, down, left, up. Turning back is never allowed.
const DX = [1, 0, -1, 0] as const;
const DY = [0, 1, 0, -1] as const;
const OUT: Record<Side, number> = { right: 0, bottom: 1, left: 2, top: 3 };

/** A box as its open interior: a route may run along its outline, never inside. */
type Box = { left: number; top: number; right: number; bottom: number };

const inflate = (rect: Rect, by: number): Box => ({
  left: rect.x - by,
  top: rect.y - by,
  right: rect.x + rect.width + by,
  bottom: rect.y + rect.height + by,
});
const inside = (box: Box, point: Point) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom;

/** Whether the run from `a` to `b`, horizontal or vertical, passes through the box's interior. */
function crosses(box: Box, a: Point, b: Point): boolean {
  if (a.y === b.y) return a.y > box.top && a.y < box.bottom && Math.min(a.x, b.x) < box.right && Math.max(a.x, b.x) > box.left;
  return a.x > box.left && a.x < box.right && Math.min(a.y, b.y) < box.bottom && Math.max(a.y, b.y) > box.top;
}

/** The first index whose value is at least `value`. */
function lowerBound(values: readonly number[], value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid]! < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

/** Drops repeated points and points in the middle of a straight run, so every remaining corner turns. */
function corners(points: readonly Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of points) {
    const last = kept.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
    const before = kept.at(-2);
    if (before && last && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y)))
      kept.pop();
    kept.push(point);
  }
  return kept;
}

/**
 * The boxes near the ends, and those near them in turn, until none is left that touches the area they span. A route
 * stays inside that area, so the boxes left out can't be in its way.
 */
function nearby(source: Point, target: Point, boxes: readonly Box[]): number[] {
  const area: Box = {
    left: Math.min(source.x, target.x),
    top: Math.min(source.y, target.y),
    right: Math.max(source.x, target.x),
    bottom: Math.max(source.y, target.y),
  };
  const taken = boxes.map(() => false);
  const near: number[] = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const [i, box] of boxes.entries()) {
      // Touching counts: a route along the area's edge would run along the box's outline.
      if (taken[i] || box.left > area.right || box.right < area.left || box.top > area.bottom || box.bottom < area.top) continue;
      taken[i] = true;
      near.push(i);
      area.left = Math.min(area.left, box.left);
      area.top = Math.min(area.top, box.top);
      area.right = Math.max(area.right, box.right);
      area.bottom = Math.max(area.bottom, box.bottom);
      grew = true;
    }
  }
  return near;
}

/** A binary min-heap of search states by estimated cost; ties go to the state pushed first. */
class Queue {
  private states: number[] = [];
  private costs: number[] = [];
  private orders: number[] = [];
  private pushed = 0;
  get size() {
    return this.states.length;
  }
  private before(a: number, b: number) {
    return this.costs[a]! < this.costs[b]! || (this.costs[a] === this.costs[b] && this.orders[a]! < this.orders[b]!);
  }
  private swap(a: number, b: number) {
    for (const list of [this.states, this.costs, this.orders]) [list[a], list[b]] = [list[b]!, list[a]!];
  }
  push(state: number, cost: number) {
    this.states.push(state);
    this.costs.push(cost);
    this.orders.push(this.pushed++);
    let i = this.states.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.states[0]!;
    const last = this.states.length - 1;
    this.swap(0, last);
    this.states.pop();
    this.costs.pop();
    this.orders.pop();
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let first = i;
      if (left < last && this.before(left, first)) first = left;
      if (right < last && this.before(right, first)) first = right;
      if (first === i) break;
      this.swap(i, first);
      i = first;
    }
    return top;
  }
}

/** The search over one grid: lines along every box plus the margin, through both ends and halfway between them. */
function search(
  source: EndPoint,
  target: EndPoint,
  lines: readonly Rect[],
  blockers: readonly Box[],
  margin: number,
  bendPenalty: number,
): Point[] | undefined {
  const xs = sorted([
    source.x,
    target.x,
    (source.x + target.x) / 2,
    ...lines.flatMap((rect) => [rect.x - margin, rect.x + rect.width + margin]),
  ]);
  const ys = sorted([
    source.y,
    target.y,
    (source.y + target.y) / 2,
    ...lines.flatMap((rect) => [rect.y - margin, rect.y + rect.height + margin]),
  ]);
  const nx = xs.length;
  const ny = ys.length;

  // blockedRight[j * nx + i]: the run from (i, j) to (i + 1, j) crosses a box; blockedDown: from (i, j) to (i, j + 1).
  const blockedRight = new Uint8Array(nx * ny);
  const blockedDown = new Uint8Array(nx * ny);
  for (const box of blockers) {
    const rowsFrom = lowerBound(ys, box.top);
    const columnsFrom = lowerBound(xs, box.left);
    // Rows strictly inside the box, and the runs between columns that overlap it.
    for (let j = ys[rowsFrom] === box.top ? rowsFrom + 1 : rowsFrom; j < ny && ys[j]! < box.bottom; j++)
      for (let i = Math.max(0, columnsFrom - 1); i < nx - 1 && xs[i]! < box.right; i++)
        if (xs[i + 1]! > box.left) blockedRight[j * nx + i] = 1;
    for (let i = xs[columnsFrom] === box.left ? columnsFrom + 1 : columnsFrom; i < nx && xs[i]! < box.right; i++)
      for (let j = Math.max(0, rowsFrom - 1); j < ny - 1 && ys[j]! < box.bottom; j++)
        if (ys[j + 1]! > box.top) blockedDown[j * nx + i] = 1;
  }

  const start = (lowerBound(ys, source.y) * nx + lowerBound(xs, source.x)) * 4 + OUT[source.side];
  const goal = (lowerBound(ys, target.y) * nx + lowerBound(xs, target.x)) * 4 + ((OUT[target.side] + 2) % 4);
  const tx = target.x;
  const ty = target.y;
  const cost = new Float64Array(nx * ny * 4).fill(Infinity);
  const from = new Int32Array(nx * ny * 4).fill(-1);
  const queue = new Queue();
  cost[start] = 0;
  queue.push(start, Math.abs(source.x - tx) + Math.abs(source.y - ty));

  while (queue.size) {
    const state = queue.pop();
    if (state === goal) break;
    const direction = state & 3;
    const cell = state >> 2;
    const i = cell % nx;
    const j = (cell - i) / nx;
    const at = cost[state]!;
    // The first run leaves the Source toward its side.
    for (let next = 0; next < 4; next++) {
      if (next === (direction + 2) % 4 || (state === start && next !== direction)) continue;
      const ni = i + DX[next]!;
      const nj = j + DY[next]!;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      if (
        next === 0
          ? blockedRight[cell]
          : next === 2
            ? blockedRight[cell - 1]
            : next === 1
              ? blockedDown[cell]
              : blockedDown[cell - nx]
      )
        continue;
      const x = xs[ni]!;
      const y = ys[nj]!;
      const reached = (nj * nx + ni) * 4 + next;
      const total = at + Math.abs(x - xs[i]!) + Math.abs(y - ys[j]!) + (next === direction ? 0 : bendPenalty);
      if (total >= cost[reached]!) continue;
      cost[reached] = total;
      from[reached] = state;
      queue.push(reached, total + Math.abs(x - tx) + Math.abs(y - ty));
    }
  }
  if (cost[goal] === Infinity) return undefined;

  const points: Point[] = [];
  for (let state = goal; state !== -1; state = from[state]!) {
    const cell = state >> 2;
    points.push({ x: xs[cell % nx]!, y: ys[Math.floor(cell / nx)]! });
  }
  return corners(points.reverse());
}

/**
 * An orthogonal route from `source` to `target` around the `obstacles`, as its corners from end to end; `undefined`
 * when there is none. It leaves the Source toward its side, enters the Target from its side, keeps `margin` away from
 * every obstacle where it can, and is the shortest with bends counted as `bendPenalty` of extra length.
 *
 * An obstacle with an end inside it is ignored, and one with an end within `margin` (the end's own Node) is kept at
 * no distance. When no route keeps the margin, the route may pass closer.
 */
export function routeOrthogonal(
  source: EndPoint,
  target: EndPoint,
  obstacles: readonly Rect[],
  options: RouteOptions = {},
): Point[] | undefined {
  const margin = options.margin ?? MARGIN;
  const bendPenalty = options.bendPenalty ?? BEND_PENALTY;
  const kept = obstacles.filter((rect) => {
    const box = inflate(rect, 0);
    return !inside(box, source) && !inside(box, target);
  });
  const blockers = kept.map((rect) => {
    const outer = inflate(rect, margin);
    return inside(outer, source) || inside(outer, target) ? inflate(rect, 0) : outer;
  });
  const prefer = options.prefer;
  if (prefer?.length && prefer.slice(1).every((point, i) => !blockers.some((box) => crosses(box, prefer[i]!, point))))
    return corners(prefer);

  // Only the boxes the route could meet: those around the ends, and the ones around those.
  const near = nearby(source, target, blockers);
  const lines = near.map((i) => kept[i]!);
  return (
    search(
      source,
      target,
      lines,
      near.map((i) => blockers[i]!),
      margin,
      bendPenalty,
    ) ??
    search(
      source,
      target,
      lines,
      lines.map((rect) => inflate(rect, 0)),
      margin,
      bendPenalty,
    )
  );
}

/**
 * A route kept from elsewhere, such as a Layout's, with its ends moved onto `source` and `target`, when it still fits:
 * its ends are within half a unit of them, every run is horizontal or vertical, and it crosses none of the obstacles
 * (one with an end inside it doesn't count). `undefined` when it doesn't.
 */
export function fitRoute(route: readonly Point[], source: Point, target: Point, obstacles: readonly Rect[]): Point[] | undefined {
  const near = (a: Point, b: Point) => Math.abs(a.x - b.x) <= 0.5 && Math.abs(a.y - b.y) <= 0.5;
  if (route.length < 2 || !near(route[0]!, source) || !near(route.at(-1)!, target)) return undefined;
  const points = [
    { x: source.x, y: source.y },
    ...route.slice(1, -1).map((point) => ({ x: point.x, y: point.y })),
    { x: target.x, y: target.y },
  ];
  const boxes = obstacles.map((rect) => inflate(rect, 0)).filter((box) => !inside(box, source) && !inside(box, target));
  const fits = points.slice(1).every((point, i) => {
    const from = points[i]!;
    return (point.x === from.x || point.y === from.y) && !boxes.some((box) => crosses(box, from, point));
  });
  return fits ? corners(points) : undefined;
}
