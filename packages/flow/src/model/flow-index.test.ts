import { captureArtifact } from '../../test/capture';
import { createMemo, createRoot, createStore, flush } from 'solid-js';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { indexFlow } from './flow-index';
import type { FlowEdge, FlowNode, FlowState } from './model';

const node = (id: string, parent?: string): FlowNode<null> => ({ id, position: { x: 0, y: 0 }, parent, data: null });
const edge = (id: string, source: string, target: string): FlowEdge<null> => ({
  id,
  source: { node: source, port: 'out' },
  target: { node: target },
  data: null,
});

const state: FlowState<null, null> = {
  nodes: [node('group'), node('a', 'group'), node('b', 'group'), node('c')],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('loop', 'c', 'c')],
};

describe('records', () => {
  test('carry the app payload in data', () => {
    type Task = { title: string };
    const flow: FlowState<Task, { weight: number }> = {
      nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: { title: 'Write' } }],
      edges: [{ id: 'e', source: { node: 'n' }, target: { node: 'n' }, data: { weight: 1 } }],
    };
    expectTypeOf(flow.nodes[0]!.data).toEqualTypeOf<Task>();
    expectTypeOf(flow.edges[0]!.data).toEqualTypeOf<{ weight: number }>();
  });
});

describe('indexFlow', () => {
  const index = indexFlow(state);

  test('finds Nodes and Edges by id', () => {
    expect(index.node('a')).toBe(state.nodes[1]);
    expect(index.edge('bc')).toBe(state.edges[1]);
    expect(index.node('missing')).toBeUndefined();
    expect(index.edge('missing')).toBeUndefined();
  });

  test('lists the Edges at either end of a Node, a loop once', () => {
    expect(index.edgesOf('b').map((e) => e.id)).toEqual(['ab', 'bc']);
    expect(index.edgesOf('c').map((e) => e.id)).toEqual(['bc', 'loop']);
    expect(index.edgesOf('group')).toEqual([]);
  });

  test('lists the children of a Parent', () => {
    expect(index.childrenOf('group').map((n) => n.id)).toEqual(['a', 'b']);
    expect(index.childrenOf('a')).toEqual([]);
  });

  test('over a store, rebuilds when ids change but not when a Node moves', async () => {
    const { artifact } = await captureArtifact(
      () => {
        const [flow, setFlow] = createStore(structuredClone(state));
        createRoot(() => {
          const index = createMemo(() => indexFlow(flow), { name: 'index' });
          return createMemo(() => index().edgesOf('c').length, { name: 'edgesOfC' });
        });
        flush();
        setFlow((draft) => {
          draft.nodes[3]!.position.x = 10;
        });
        flush();
        setFlow((draft) => {
          draft.edges.push(edge('ca', 'c', 'a'));
        });
        flush();
      },
      { scenario: 'index' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'index' });
  });
});
