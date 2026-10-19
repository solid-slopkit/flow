import { captureArtifact } from '../../test/capture';
import { createMemo, createRoot, createStore, flush, snapshot } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';

import type { FlowEdge, FlowNode, FlowState } from '../model/model';
import { applyChanges, removal } from './apply';
import { invert, type Batch } from './changes';

type Flow = FlowState<{ label: string }, null>;

const node = (id: string, fields: Partial<FlowNode<{ label: string }>> = {}): FlowNode<{ label: string }> => ({
  id,
  position: { x: 0, y: 0 },
  data: { label: id },
  ...fields,
});
const edge = (id: string, source: string, target: string): FlowEdge<null> => ({
  id,
  source: { node: source },
  target: { node: target },
  data: null,
});

const initial = (): Flow => ({
  nodes: [
    node('group', { size: { width: 300, height: 300 } }),
    node('a', { parent: 'group' }),
    node('b', { parent: 'a' }),
    node('c'),
  ],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cc', 'c', 'c')],
});

function setup() {
  const [flow, setFlow] = createStore(initial());
  const apply = (batch: Batch<{ label: string }, null>) => {
    applyChanges(setFlow, batch);
    flush();
  };
  const plain = () => snapshot(flow) as Flow;
  return { flow, setFlow, apply, plain };
}

describe('applyChanges', () => {
  test('add and connect copy the records into the store', () => {
    const { flow, apply } = setup();
    const added = node('d');
    const connected = edge('cd', 'c', 'd');
    apply({
      changes: [
        { type: 'add', nodes: [added], edges: [] },
        { type: 'connect', edge: connected },
      ],
    });
    expect(flow.nodes.map((n) => n.id)).toEqual(['group', 'a', 'b', 'c', 'd']);
    expect(flow.edges.at(-1)).toEqual(connected);

    apply({ changes: [{ type: 'move', node: 'd', from: { x: 0, y: 0 }, to: { x: 9, y: 9 } }] });
    expect(added.position).toEqual({ x: 0, y: 0 });
  });

  test('removing a Node removes its children and the Edges at any of them', () => {
    const { flow, apply } = setup();
    apply({ changes: [{ type: 'remove', nodes: [node('a')], edges: [] }] });
    expect(flow.nodes.map((n) => n.id)).toEqual(['group', 'c']);
    expect(flow.edges.map((e) => e.id)).toEqual(['cc']);
  });

  test('removing an Edge keeps its Nodes', () => {
    const { flow, apply } = setup();
    apply({ changes: [{ type: 'remove', nodes: [], edges: [edge('bc', 'b', 'c')] }] });
    expect(flow.nodes).toHaveLength(4);
    expect(flow.edges.map((e) => e.id)).toEqual(['ab', 'cc']);
  });

  test('move, select, resize, reconnect, reparent and update', () => {
    const { flow, apply } = setup();
    apply({
      changes: [
        { type: 'move', node: 'c', from: { x: 0, y: 0 }, to: { x: 10, y: 20 } },
        { type: 'select', item: 'node', id: 'c', from: false, to: true },
        { type: 'select', item: 'edge', id: 'bc', from: false, to: true },
        {
          type: 'resize',
          node: 'group',
          from: { position: { x: 0, y: 0 } },
          to: { position: { x: -10, y: 0 }, size: { width: 310, height: 300 } },
        },
        {
          type: 'resize',
          node: 'a',
          from: { position: { x: 0, y: 0 } },
          to: { position: { x: 1, y: 1 }, size: { width: 50, height: 50 } },
        },
        { type: 'reconnect', edge: 'bc', end: 'target', from: { node: 'c' }, to: { node: 'a', port: 'in' } },
        { type: 'reparent', node: 'b', from: { parent: 'a', position: { x: 0, y: 0 } }, to: { position: { x: 30, y: 30 } } },
        { type: 'reparent', node: 'c', from: { position: { x: 10, y: 20 } }, to: { parent: 'group', position: { x: 5, y: 5 } } },
        {
          type: 'update',
          item: 'node',
          id: 'a',
          from: { data: { label: 'a' }, draggable: undefined },
          to: { data: { label: 'A' }, draggable: false },
        },
        { type: 'update', item: 'edge', id: 'ab', from: { shape: undefined }, to: { shape: 'step' } },
      ],
    });
    const [group, a, b, c] = flow.nodes;
    expect(group).toMatchObject({ position: { x: -10, y: 0 }, size: { width: 310, height: 300 } });
    expect(a).toMatchObject({
      position: { x: 1, y: 1 },
      size: { width: 50, height: 50 },
      draggable: false,
      data: { label: 'A' },
    });
    expect(b).toMatchObject({ position: { x: 30, y: 30 } });
    expect(b).not.toHaveProperty('parent');
    expect(c).toMatchObject({ parent: 'group', position: { x: 5, y: 5 }, selected: true });
    expect(flow.edges[0]).toMatchObject({ shape: 'step' });
    expect(flow.edges[1]).toMatchObject({ selected: true, target: { node: 'a', port: 'in' } });
  });

  test('an update removes fields set to undefined, and a resize without a size removes it', () => {
    const { flow, apply } = setup();
    apply({
      changes: [
        { type: 'update', item: 'node', id: 'a', from: { parent: 'group' }, to: { parent: undefined } },
        {
          type: 'resize',
          node: 'group',
          from: { position: { x: 0, y: 0 }, size: { width: 300, height: 300 } },
          to: { position: { x: 0, y: 0 } },
        },
      ],
    });
    expect(flow.nodes[1]).not.toHaveProperty('parent');
    expect(flow.nodes[0]).not.toHaveProperty('size');
  });

  test('skips Changes naming records that are not there', () => {
    const { apply, plain } = setup();
    const before = structuredClone(plain());
    apply({
      changes: [
        { type: 'move', node: 'nope', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
        { type: 'select', item: 'edge', id: 'nope', from: false, to: true },
        { type: 'reconnect', edge: 'nope', end: 'source', from: { node: 'a' }, to: { node: 'b' } },
        { type: 'remove', nodes: [node('nope')], edges: [] },
      ],
    });
    expect(plain()).toEqual(before);
  });

  test('applies a Batch in one store write', () => {
    const { setFlow } = setup();
    const write = vi.fn(setFlow);
    applyChanges(write, {
      changes: [
        { type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
        { type: 'move', node: 'c', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
        { type: 'remove', nodes: [], edges: [edge('cc', 'c', 'c')] },
      ],
    });
    applyChanges(write, { changes: [] });
    expect(write).toHaveBeenCalledTimes(1);
  });

  test('a Batch and its Inverse leave the state as it was', () => {
    const { flow, apply, plain } = setup();
    const before = structuredClone(plain());
    const batch: Batch<{ label: string }, null> = {
      changes: [
        { type: 'add', nodes: [node('d')], edges: [edge('cd', 'c', 'd')] },
        { type: 'move', node: 'd', from: { x: 0, y: 0 }, to: { x: 40, y: 40 } },
        { type: 'reparent', node: 'd', from: { position: { x: 40, y: 40 } }, to: { parent: 'group', position: { x: 4, y: 4 } } },
        { type: 'select', item: 'node', id: 'a', from: false, to: true },
        removal(flow, { nodes: ['a'] }),
      ],
    };
    apply(batch);
    expect(flow.nodes.map((n) => n.id)).toEqual(['group', 'c', 'd']);
    apply(invert(batch));
    expect(plain()).toEqual(before);
  });

  test('re-runs only what a Batch touches', async () => {
    const { artifact } = await captureArtifact(
      () => {
        const { flow, apply } = setup();
        createRoot(() => {
          const count = createMemo(() => flow.nodes.length, { name: 'count' });
          const positions = flow.nodes.map((n) => createMemo(() => n.position.x + n.position.y, { name: `position:${n.id}` }));
          return [count, ...positions];
        });
        flush();
        apply({ changes: [{ type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }] });
      },
      { scenario: 'apply-move' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1);
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'position:a' });
  });
});

describe('removal', () => {
  test('carries the nested Nodes and every Edge at them, as copies', () => {
    const { flow } = setup();
    const change = removal(flow, { nodes: ['a'], edges: ['cc'] });
    expect(change.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(change.edges.map((e) => e.id)).toEqual(['ab', 'bc', 'cc']);
    expect(change.nodes[0]).toEqual(initial().nodes[1]);
    expect(change.nodes[0]).not.toBe(flow.nodes[1]);
  });
});
