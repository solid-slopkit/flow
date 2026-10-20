// Layout through ELK (ADR 0020): the Flow's Nodes, Ports and Parents into ELK's graph, and a Batch back. Only the
// `@solid-slopkit/flow/layout` subpath imports this file, and only it imports `elkjs`, so the main entry never loads ELK.
import type { ELK, ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api.js';

import type { Batch, Change } from '../changes/changes';
import type { MeasuredPort } from '../flow/internals';
import { indexFlow } from '../model/flow-index';
import type { End, FlowEdge, FlowNode, FlowState, Point, Side, Size } from '../model/model';

/** Where a layout reads Measured sizes and Ports from: the Flow's `useFlow()` fits. */
export interface LayoutMeasurements {
  measuredSize(id: string): Size | undefined;
  measuredPort(node: string, port: string): MeasuredPort | undefined;
}

export interface LayoutOptions<E = unknown> {
  /** ELK's layout options for the whole graph, over the defaults (layered, left to right, orthogonal Edges). */
  options?: Record<string, string>;
  /** Measured sizes and Ports, usually `useFlow()`. Without them, Declared sizes and Ports are used. */
  measured?: LayoutMeasurements;
  /** Which Edges get ELK's route as their `route`. Defaults to those whose record's `shape` is `routed-step`. */
  route?: (edge: FlowEdge<E>) => boolean;
  /** The ELK instance to run, such as one in a Web Worker (`elkInWorker`). Defaults to elkjs's bundled build. */
  elk?: ELK;
}

/** Defaults for the whole graph: layered, left to right, orthogonal Edges, Parents laid out with their children. */
const DEFAULTS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.padding': '[top=0,left=0,bottom=0,right=0]',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
};

const ELK_SIDE: Record<Side, string> = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' };

let bundled: Promise<ELK> | undefined;
/** elkjs's bundled build, loaded on first use. */
function defaultElk(): Promise<ELK> {
  bundled ??= import('elkjs/lib/elk.bundled.js').then((module) => {
    const Elk = module.default as unknown as new () => ELK;
    return new Elk();
  });
  return bundled;
}

/** A Port's point relative to its Node, from its measurement, else its declaration. */
function portPlacement(node: FlowNode<any>, port: string, size: Size, measured?: LayoutMeasurements) {
  const found = measured?.measuredPort(node.id, port);
  if (found) return { x: found.x, y: found.y, side: found.side };
  const spec = node.ports?.find((candidate) => candidate.id === port);
  if (!spec) return undefined;
  const offset = spec.offset ?? 0.5;
  switch (spec.side) {
    case 'top':
      return { x: size.width * offset, y: 0, side: spec.side };
    case 'right':
      return { x: size.width, y: size.height * offset, side: spec.side };
    case 'bottom':
      return { x: size.width * offset, y: size.height, side: spec.side };
    case 'left':
      return { x: 0, y: size.height * offset, side: spec.side };
  }
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const sameSize = (a: Size | undefined, b: Size) => !!a && a.width === b.width && a.height === b.height;
const sameRoute = (a: readonly Point[] | undefined, b: readonly Point[]) =>
  !!a && a.length === b.length && a.every((point, i) => samePoint(point, b[i]!));

/**
 * Lays out the Flow with ELK. Resolves to a one-shot Batch the app applies like any other edit, so it can be undone:
 * a `move` for each Node ELK placed elsewhere (relative to its Parent, ADR 0017), a `resize` for each Parent with a
 * Declared size that no longer fits its children, and an `update` of `route` for each routed Edge, in Flow
 * coordinates. Changes that would change nothing are left out.
 */
export async function layout<N = unknown, E = unknown>(
  state: FlowState<N, E>,
  options: LayoutOptions<E> = {},
): Promise<Batch<N, E>> {
  const { measured } = options;
  const index = indexFlow(state);
  const routed = options.route ?? ((edge: FlowEdge<E>) => edge.shape === 'routed-step');

  // A Node whose Parents run into a missing Node or a cycle is laid out at the top level.
  const topLevel = (node: FlowNode<N>) => {
    const seen = new Set<string>();
    for (let at = node; at.parent !== undefined;) {
      seen.add(at.id);
      const parent = index.node(at.parent);
      if (!parent) return at === node;
      if (seen.has(parent.id)) return true;
      at = parent;
    }
    return node.parent === undefined;
  };

  const elkIds = new Map<string, string>();
  const portId = (node: string, port: string) => elkIds.get(`${node}\u0000${port}`);
  const sizeOf = (node: FlowNode<N>): Size => measured?.measuredSize(node.id) ?? node.size ?? { width: 0, height: 0 };

  const toElk = (node: FlowNode<N>): ElkNode => {
    const size = sizeOf(node);
    // The Ports it declares, and any its Edges name.
    const names = new Set(node.ports?.map((port) => port.id));
    for (const edge of index.edgesOf(node.id))
      for (const end of [edge.source, edge.target]) if (end.node === node.id && end.port !== undefined) names.add(end.port);
    const ports: ElkPort[] = [];
    for (const name of names) {
      const placed = portPlacement(node, name, size, measured);
      if (!placed) continue;
      const id = `p${elkIds.size}`;
      elkIds.set(`${node.id}\u0000${name}`, id);
      ports.push({
        id,
        x: placed.x,
        y: placed.y,
        width: 0,
        height: 0,
        layoutOptions: { 'elk.port.side': ELK_SIDE[placed.side] },
      });
    }
    const children = index.childrenOf(node.id).filter((child) => !topLevel(child));
    return {
      id: `n:${node.id}`,
      width: size.width,
      height: size.height,
      ...(ports.length && { ports, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } }),
      ...(children.length && { children: children.map(toElk) }),
    };
  };

  // Ports are numbered while the Nodes are converted, so the Edges come after them.
  const children = state.nodes.filter(topLevel).map(toElk);
  const elkEnd = (end: End) => (end.port !== undefined && portId(end.node, end.port)) || `n:${end.node}`;
  const edges: ElkExtendedEdge[] = state.edges
    .filter((edge) => index.node(edge.source.node) && index.node(edge.target.node))
    .map((edge) => ({ id: `e:${edge.id}`, sources: [elkEnd(edge.source)], targets: [elkEnd(edge.target)] }));

  const elk = options.elk ?? (await defaultElk());
  const result = await elk.layout({ id: 'root', layoutOptions: { ...DEFAULTS, ...options.options }, children, edges });

  const changes: Change<N, E>[] = [];
  // Each ELK node's top-left corner in Flow coordinates, for the Edges' containers.
  const origins = new Map<string, Point>([['root', { x: 0, y: 0 }]]);
  const visit = (elkNode: ElkNode, parent: Point) => {
    const id = elkNode.id.slice(2);
    const node = index.node(id)!;
    const position = { x: elkNode.x ?? 0, y: elkNode.y ?? 0 };
    const size = { width: elkNode.width ?? 0, height: elkNode.height ?? 0 };
    const origin = { x: parent.x + position.x, y: parent.y + position.y };
    origins.set(elkNode.id, origin);
    if (elkNode.children?.length && node.size && !sameSize(node.size, size))
      changes.push({
        type: 'resize',
        node: id,
        from: { position: { ...node.position }, size: { ...node.size } },
        to: { position, size },
      });
    else if (!samePoint(node.position, position))
      changes.push({ type: 'move', node: id, from: { ...node.position }, to: position });
    for (const child of elkNode.children ?? []) visit(child, origin);
  };
  for (const child of result.children ?? []) visit(child, { x: 0, y: 0 });

  const collect = (elkNode: ElkNode) => {
    for (const edge of elkNode.edges ?? []) {
      const record = index.edge(edge.id.slice(2));
      if (!record || !routed(record) || !edge.sections?.length) continue;
      // Section points are relative to the Edge's container (ELK's JSON format).
      const origin = origins.get(edge.container ?? elkNode.id) ?? { x: 0, y: 0 };
      const route = edge.sections
        .flatMap((section) => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
        .map((point) => ({ x: origin.x + point.x, y: origin.y + point.y }))
        .filter((point, i, points) => i === 0 || !samePoint(point, points[i - 1]!));
      if (sameRoute(record.route, route)) continue;
      changes.push({ type: 'update', item: 'edge', id: record.id, from: { route: record.route }, to: { route } });
    }
    for (const child of elkNode.children ?? []) collect(child);
  };
  collect(result);

  return { changes };
}
