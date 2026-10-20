// Edge shapes: pure functions from an Edge's two ends to its SVG path and label point (ADR 0021). No DOM, so they run
// on the server.
import type { EndPoint } from '../geometry/geometry';
import type { EdgeShapeName, FlowEdge, Point, Rect, Side } from '../model/model';
import { fitRoute, routeOrthogonal } from '../routing/route';

/** What an Edge shape returns: the SVG path data, and the point its label sits on, in Flow coordinates. */
export type EdgeGeometry = { d: string; label: Point };

/** What an Edge shape may know about the Flow besides its two ends. Of the built-in shapes, only routed step reads it. */
export interface EdgeShapeContext {
  /** The Edge being drawn. */
  edge: FlowEdge<any>;
  /** A Node's box in Flow coordinates, from its Measured size, else its Declared size. */
  nodeBounds(id: string): Rect | undefined;
  /**
   * The boxes of the Nodes the Edge should go round: every Node with a size except the Parents of its ends. While Nodes
   * are dragged, reading them doesn't redraw the Edge; it is redrawn when its ends move, and once the drag ends.
   */
  obstacles(): Rect[];
}

/** How an Edge's line runs between its ends. `context` is reserved so a shape can route around Nodes (ADR 0021). */
export type EdgeShape = (source: EndPoint, target: EndPoint, context?: EdgeShapeContext) => EdgeGeometry;

/** How far a step Edge leaves a Port, and a bezier's shortest control arm. */
const OFFSET = 20;
const RADIUS = 8;

const DIRECTION: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const round = (value: number) => Math.round(value * 100) / 100;
const pair = (point: Point) => `${round(point.x)} ${round(point.y)}`;

/** A straight line between the ends; the label at its middle. */
export const straightShape: EdgeShape = (source, target) => ({
  d: `M ${pair(source)} L ${pair(target)}`,
  label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
});

/** A cubic curve leaving each end toward its side; the label at the curve's middle. */
export const bezierShape: EdgeShape = (source, target) => {
  const control = (from: EndPoint, to: Point): Point => {
    const direction = DIRECTION[from.side];
    const ahead = direction.x * (to.x - from.x) + direction.y * (to.y - from.y);
    // Half the distance toward the other end along the side's axis; a fixed arm when the other end is behind.
    const arm = Math.max(Math.abs(ahead) / 2, OFFSET * 2);
    return { x: from.x + direction.x * arm, y: from.y + direction.y * arm };
  };
  const c1 = control(source, target);
  const c2 = control(target, source);
  return {
    d: `M ${pair(source)} C ${pair(c1)} ${pair(c2)} ${pair(target)}`,
    label: { x: (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8, y: (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8 },
  };
};

const horizontal = (side: Side) => side === 'left' || side === 'right';
const TRANSPOSED: Record<Side, Side> = { top: 'left', left: 'top', right: 'bottom', bottom: 'right' };
const transpose = <T extends Point>(point: T): T => ({ ...point, x: point.y, y: point.x });
const transposeEnd = (end: EndPoint): EndPoint => ({ x: end.y, y: end.x, side: TRANSPOSED[end.side] });

/** The corners of an orthogonal line from a source leaving left or right, to a target on any side. */
function horizontalStep(source: EndPoint, target: EndPoint): Point[] {
  const out = DIRECTION[source.side];
  const into = DIRECTION[target.side];
  const a = { x: source.x + out.x * OFFSET, y: source.y };
  const b = { x: target.x + into.x * OFFSET, y: target.y + into.y * OFFSET };
  if (horizontal(target.side)) {
    if (out.x === into.x) {
      // Both ends face the same way: go round the one further out.
      const x = out.x > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x);
      return [source, { x, y: source.y }, { x, y: target.y }, target];
    }
    // Facing each other with room between: turn halfway.
    if ((b.x - a.x) * out.x >= 0) {
      const x = (source.x + target.x) / 2;
      return [source, { x, y: source.y }, { x, y: target.y }, target];
    }
    // Facing away: leave both ends and cross halfway between them.
    const y = (source.y + target.y) / 2;
    return [source, a, { x: a.x, y }, { x: b.x, y }, b, target];
  }
  // The target is on a top or bottom side: one corner when it lies ahead of the source and the line can enter it from
  // its side.
  const corner = { x: target.x, y: source.y };
  if ((corner.x - source.x) * out.x > 0 && (corner.y - target.y) * into.y > 0) return [source, corner, target];
  return [source, a, { x: a.x, y: b.y }, b, target];
}

/** The corners of an orthogonal line between the ends, each end leaving toward its side. */
function stepPoints(source: EndPoint, target: EndPoint): Point[] {
  const points = horizontal(source.side)
    ? horizontalStep(source, target)
    : horizontalStep(transposeEnd(source), transposeEnd(target)).map(transpose);
  // Drop repeated points and corners on a straight run, so every remaining corner turns.
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

/** The point halfway along a polyline. */
function midway(points: Point[]): Point {
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y));
  let left = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (const [i, length] of lengths.entries()) {
    if (left <= length && length > 0) {
      const from = points[i]!;
      const to = points[i + 1]!;
      return { x: from.x + ((to.x - from.x) * left) / length, y: from.y + ((to.y - from.y) * left) / length };
    }
    left -= length;
  }
  return points[0]!;
}

/** A line through the points with sharp corners, labelled halfway along. */
const polyline = (points: Point[]): EdgeGeometry => ({ d: `M ${points.map(pair).join(' L ')}`, label: midway(points) });

/** Horizontal and vertical lines with sharp corners, leaving each end toward its side; the label halfway along. */
export const stepShape: EdgeShape = (source, target) => polyline(stepPoints(source, target));

/**
 * A step line that goes round the context's obstacles, routed with `routeOrthogonal` (ADR 0021). It is the plain step
 * line while that crosses no Node, and falls back to it without a context or a route. An Edge's `route` (a Layout's,
 * ADR 0020) is drawn instead while it still joins the ends and crosses no Node.
 */
export const routedStepShape: EdgeShape = (source, target, context) => {
  const step = stepPoints(source, target);
  if (!context) return polyline(step);
  const obstacles = context.obstacles();
  const kept = context.edge.route && fitRoute(context.edge.route, source, target, obstacles);
  if (kept) return polyline(kept);
  return polyline(routeOrthogonal(source, target, obstacles, { margin: OFFSET, prefer: step }) ?? step);
};

/** A step line with rounded corners. */
export const smoothStepShape: EdgeShape = (source, target) => {
  const points = stepPoints(source, target);
  let d = `M ${pair(points[0]!)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [before, corner, after] = [points[i - 1]!, points[i]!, points[i + 1]!];
    // Never more than half of either run, so neighbouring corners don't overlap.
    const radius = Math.min(
      RADIUS,
      Math.hypot(corner.x - before.x, corner.y - before.y) / 2,
      Math.hypot(after.x - corner.x, after.y - corner.y) / 2,
    );
    const toward = (point: Point): Point => {
      const length = Math.hypot(point.x - corner.x, point.y - corner.y);
      return { x: corner.x + ((point.x - corner.x) * radius) / length, y: corner.y + ((point.y - corner.y) * radius) / length };
    };
    d += ` L ${pair(toward(before))} Q ${pair(corner)} ${pair(toward(after))}`;
  }
  return { d: `${d} L ${pair(points.at(-1)!)}`, label: midway(points) };
};

/** The built-in shapes by name. */
export const edgeShapes: Record<EdgeShapeName, EdgeShape> = {
  bezier: bezierShape,
  straight: straightShape,
  step: stepShape,
  'smooth-step': smoothStepShape,
  'routed-step': routedStepShape,
};
