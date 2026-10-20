import { createStore, snapshot } from 'solid-js';
import { describe, expect, test } from 'vitest';
import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js';

import { applyChanges } from '../changes/apply';
import { invert, type Batch } from '../changes/changes';
import { nodeBounds, portPoint } from '../geometry/geometry';
import { indexFlow } from '../model/flow-index';
import type { FlowEdge, FlowNode, FlowState, Point, Rect } from '../model/model';
import { layout } from './layout';

const node = (id: string, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  ports: [
    { id: 'in', side: 'left' },
    { id: 'out', side: 'right' },
  ],
  data: null,
  ...fields,
});
const edge = (id: string, source: string, target: string, fields: Partial<FlowEdge> = {}): FlowEdge => ({
  id,
  source: { node: source, port: 'out' },
  target: { node: target, port: 'in' },
  shape: 'routed-step',
  data: null,
  ...fields,
});

const chain: FlowState = {
  nodes: [node('a'), node('b'), node('c')],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
};

/** The state with a Batch applied. */
function applied(state: FlowState, batch: Batch): FlowState {
  const [store, setStore] = createStore(structuredClone(state));
  applyChanges(setStore, batch);
  return snapshot(store) as FlowState;
}

/** A point without its side. */
const at = (point: Point | undefined) => point && { x: point.x, y: point.y };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('layout', () => {
  test('lays a chain out left to right as a one-shot Batch of moves and routes', async () => {
    const batch = await layout(chain);
    expect(batch.phase).toBeUndefined();
    expect(batch.changes.map((change) => change.type).sort()).toEqual(['move', 'move', 'update', 'update']);
    const after = applied(chain, batch);
    const [a, b, c] = after.nodes.map((n) => n.position);
    expect(a!.x).toBeLessThan(b!.x);
    expect(b!.x).toBeLessThan(c!.x);
    expect(a!.y).toBe(b!.y);
  });

  test('moves carry where the Nodes were, so the Batch inverts', async () => {
    const start: FlowState = {
      ...chain,
      nodes: chain.nodes.map((n, i) => ({ ...n, position: { x: 500 - i * 200, y: i * 30 } })),
    };
    const batch = await layout(start);
    for (const change of batch.changes)
      if (change.type === 'move') expect(change.from).toEqual(start.nodes.find((n) => n.id === change.node)!.position);
    expect(applied(applied(start, batch), invert(batch))).toEqual(start);
  });

  test('routes run from Port to Port in Flow coordinates', async () => {
    const after = applied(chain, await layout(chain));
    const index = indexFlow(after);
    for (const record of after.edges) {
      const route = record.route!;
      expect(route[0]).toEqual(at(portPoint(index, record.source)));
      expect(route.at(-1)).toEqual(at(portPoint(index, record.target)));
      expect(route.slice(1).every((point, i) => point.x === route[i]!.x || point.y === route[i]!.y)).toBe(true);
    }
  });

  test('only routed step Edges get a route, unless `route` says otherwise', async () => {
    const state = { ...chain, edges: [edge('ab', 'a', 'b', { shape: 'bezier' }), edge('bc', 'b', 'c')] };
    const updated = (batch: Batch) => batch.changes.flatMap((change) => (change.type === 'update' ? [change.id] : []));
    expect(updated(await layout(state))).toEqual(['bc']);
    expect(updated(await layout(state, { route: () => true }))).toEqual(['ab', 'bc']);
    expect(updated(await layout(state, { route: () => false }))).toEqual([]);
  });

  test('laying out again changes nothing', async () => {
    const after = applied(chain, await layout(chain));
    expect((await layout(after)).changes).toEqual([]);
  });

  test('Nodes don’t overlap, and use their Measured size over the Declared one', async () => {
    const state: FlowState = {
      nodes: [node('a'), node('b'), node('c'), node('d')],
      edges: [edge('ab', 'a', 'b'), edge('ac', 'a', 'c'), edge('ad', 'a', 'd')],
    };
    const measured = {
      measuredSize: (id: string) => (id === 'b' ? { width: 300, height: 200 } : undefined),
      measuredPort: () => undefined,
    };
    const after = applied(state, await layout(state, { measured }));
    const index = indexFlow(after);
    const boxes = after.nodes.map((n) => nodeBounds(index, n.id, measured.measuredSize)!);
    for (const [i, box] of boxes.entries()) for (const other of boxes.slice(i + 1)) expect(overlap(box, other)).toBe(false);
  });

  test('children are laid out inside their Parent, relative to it; a Parent with a Declared size grows to fit', async () => {
    const state: FlowState = {
      nodes: [
        node('a'),
        node('g', { size: { width: 50, height: 50 }, ports: [] }),
        node('c', { parent: 'g' }),
        node('d', { parent: 'g' }),
      ],
      edges: [edge('ac', 'a', 'c'), edge('cd', 'c', 'd')],
    };
    const batch = await layout(state);
    expect(batch.changes.find((change) => 'node' in change && change.node === 'g')?.type).toBe('resize');
    const after = applied(state, batch);
    const index = indexFlow(after);
    const group = nodeBounds(index, 'g')!;
    for (const child of ['c', 'd']) {
      const box = nodeBounds(index, child)!;
      expect(box.x).toBeGreaterThanOrEqual(group.x);
      expect(box.y).toBeGreaterThanOrEqual(group.y);
      expect(box.x + box.width).toBeLessThanOrEqual(group.x + group.width);
      expect(box.y + box.height).toBeLessThanOrEqual(group.y + group.height);
    }
    // Routes are in Flow coordinates, inside the Parent too.
    const cd = after.edges.find((e) => e.id === 'cd')!;
    expect(cd.route![0]).toEqual(at(portPoint(index, cd.source)));
    expect(cd.route!.at(-1)).toEqual(at(portPoint(index, cd.target)));
  });

  test('ELK’s options go over the defaults', async () => {
    const after = applied(chain, await layout(chain, { options: { 'elk.direction': 'DOWN' } }));
    const [a, b] = after.nodes.map((n) => n.position);
    expect(a!.y).toBeLessThan(b!.y);
  });

  test('hands ELK the Nodes with their sizes, Ports with their sides, Parents and Edges', async () => {
    let graph!: ElkNode;
    const elk = {
      layout: async (input: ElkNode) => {
        graph = structuredClone(input);
        return input;
      },
    } as unknown as ELK;
    const state: FlowState = {
      nodes: [
        node('a', { ports: [{ id: 'out', side: 'bottom', offset: 0.25 }] }),
        node('g', { size: undefined, ports: [] }),
        node('b', { parent: 'g', size: undefined }),
        node('orphan', { parent: 'missing', ports: [] }),
      ],
      edges: [edge('ab', 'a', 'b'), { id: 'floating', source: { node: 'a' }, target: { node: 'orphan' }, data: null }],
    };
    const measured = {
      measuredSize: (id: string) => (id === 'b' ? { width: 80, height: 40 } : undefined),
      measuredPort: (n: string, port: string) =>
        n === 'b' && port === 'in' ? { x: 0, y: 10, side: 'left' as const } : undefined,
    };
    expect((await layout(state, { elk, measured })).changes).toEqual([]);
    expect(graph.layoutOptions).toMatchObject({ 'elk.algorithm': 'layered', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' });
    expect(graph.children!.map((child) => child.id)).toEqual(['n:a', 'n:g', 'n:orphan']);
    const [a, g, orphan] = graph.children!;
    expect(a).toMatchObject({ width: 100, height: 50, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } });
    expect(a!.ports).toEqual([{ id: 'p0', x: 25, y: 50, width: 0, height: 0, layoutOptions: { 'elk.port.side': 'SOUTH' } }]);
    expect(g).toMatchObject({ width: 0, height: 0 });
    expect(g!.children).toEqual([
      expect.objectContaining({
        id: 'n:b',
        width: 80,
        height: 40,
        // Its declared `in` measured where it is, its declared `out` from the declaration.
        ports: [
          { id: 'p1', x: 0, y: 10, width: 0, height: 0, layoutOptions: { 'elk.port.side': 'WEST' } },
          { id: 'p2', x: 80, y: 20, width: 0, height: 0, layoutOptions: { 'elk.port.side': 'EAST' } },
        ],
      }),
    ]);
    expect(orphan!.ports).toBeUndefined();
    expect(graph.edges).toEqual([
      { id: 'e:ab', sources: ['p0'], targets: ['p1'] },
      { id: 'e:floating', sources: ['n:a'], targets: ['n:orphan'] },
    ]);
  });
});
