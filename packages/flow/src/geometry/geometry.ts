// Geometry from data alone: no DOM, no measuring (ADR 0019). Everything is in absolute Flow coordinates (ADR 0017).
import type { FlowIndex } from '../model/flow-index';
import type { End, FlowEdge, Point, Rect, Side, Size } from '../model/model';

/** The Measured size of a Node by id, or `undefined` while it isn't measured (ADR 0015). */
export type MeasuredSizes = (node: string) => Size | undefined;

/** Where an Edge end sits, and which way the Edge leaves it. */
export type EndPoint = Point & { side: Side };

/**
 * A Port's measured point, relative to its Node's top-left corner, or `undefined` while it isn't rendered and measured
 * (ADR 0015).
 */
export type MeasuredPorts = (node: string, port: string) => EndPoint | undefined;

/**
 * A Node's position in Flow coordinates: its own position plus its Parents'. A `parent` naming a missing Node, or one
 * that would close a cycle, ends the walk there.
 */
export function absolutePosition(index: FlowIndex, id: string): Point | undefined {
  let node = index.node(id);
  if (!node) return undefined;
  let x = 0;
  let y = 0;
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    x += node.position.x;
    y += node.position.y;
    node = node.parent === undefined ? undefined : index.node(node.parent);
  }
  return { x, y };
}

/** A Node's box in Flow coordinates, from its Measured size, else its Declared size; `undefined` without either. */
export function nodeBounds(index: FlowIndex, id: string, measured?: MeasuredSizes): Rect | undefined {
  const size = measured?.(id) ?? index.node(id)?.size;
  const position = size && absolutePosition(index, id);
  return position && { ...position, width: size.width, height: size.height };
}

/**
 * The point of a Port: where it was measured, else where its Node's `ports` declare it (ADR 0019). `undefined` for a
 * Floating end, or a Port neither measured nor declared.
 */
export function portPoint(index: FlowIndex, end: End, measured?: MeasuredSizes, ports?: MeasuredPorts): EndPoint | undefined {
  if (end.port === undefined) return undefined;
  const found = ports?.(end.node, end.port);
  if (found) {
    const position = absolutePosition(index, end.node);
    return position && { x: position.x + found.x, y: position.y + found.y, side: found.side };
  }
  const port = index.node(end.node)?.ports?.find((spec) => spec.id === end.port);
  const bounds = port && nodeBounds(index, end.node, measured);
  if (!port || !bounds) return undefined;
  const offset = port.offset ?? 0.5;
  const { x, y, width, height } = bounds;
  switch (port.side) {
    case 'top':
      return { x: x + width * offset, y, side: 'top' };
    case 'right':
      return { x: x + width, y: y + height * offset, side: 'right' };
    case 'bottom':
      return { x: x + width * offset, y: y + height, side: 'bottom' };
    case 'left':
      return { x, y: y + height * offset, side: 'left' };
  }
}

/** Where the line from the box's centre toward a point crosses its outline: a Floating end (ADR 0018). */
export function floatingPoint(bounds: Rect, toward: Point): EndPoint {
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const cx = bounds.x + halfWidth;
  const cy = bounds.y + halfHeight;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy, side: 'right' };
  const toSide = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const toTopOrBottom = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(toSide, toTopOrBottom);
  const side: Side = toSide <= toTopOrBottom ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
  return { x: cx + dx * scale, y: cy + dy * scale, side };
}

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

/**
 * Both ends of an Edge in Flow coordinates. A Floating end is clipped toward the other end: its Port point, or the
 * centre of its Node. `undefined` while either Node has no size, or a named Port is neither measured nor declared.
 */
export function edgeEnds(
  index: FlowIndex,
  edge: FlowEdge,
  measured?: MeasuredSizes,
  ports?: MeasuredPorts,
): { source: EndPoint; target: EndPoint } | undefined {
  const sourceBounds = nodeBounds(index, edge.source.node, measured);
  const targetBounds = nodeBounds(index, edge.target.node, measured);
  if (!sourceBounds || !targetBounds) return undefined;
  const sourcePort = portPoint(index, edge.source, measured, ports);
  const targetPort = portPoint(index, edge.target, measured, ports);
  if ((edge.source.port !== undefined && !sourcePort) || (edge.target.port !== undefined && !targetPort)) return undefined;
  return {
    source: sourcePort ?? floatingPoint(sourceBounds, targetPort ?? centre(targetBounds)),
    target: targetPort ?? floatingPoint(targetBounds, sourcePort ?? centre(sourceBounds)),
  };
}
