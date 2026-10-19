import { describe, expect, test } from 'vitest';

import { indexFlow } from '../model/flow-index';
import type { FlowState } from '../model/model';
import { copyPayload, parsePayload, pastePayload, PASTE_OFFSET } from './payload';

const state: FlowState<{ title: string }, { label: string }> = {
  nodes: [
    { id: 'group', position: { x: 100, y: 100 }, size: { width: 300, height: 200 }, data: { title: 'group' } },
    { id: 'a', position: { x: 10, y: 20 }, parent: 'group', selected: true, data: { title: 'a' } },
    { id: 'b', position: { x: 400, y: 0 }, selected: true, data: { title: 'b' } },
    { id: 'child', position: { x: 5, y: 5 }, parent: 'b', data: { title: 'child' } },
    { id: 'c', position: { x: 800, y: 0 }, data: { title: 'c' } },
  ],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b' }, selected: true, data: { label: 'ab' } },
    { id: 'bchild', source: { node: 'b' }, target: { node: 'child' }, data: { label: 'inner' } },
    { id: 'bc', source: { node: 'b' }, target: { node: 'c' }, selected: true, data: { label: 'out' } },
  ],
};

describe('copyPayload', () => {
  test('the selected Nodes and those nested in them, and the Edges among them, without Selection', () => {
    const payload = copyPayload(state, indexFlow(state))!;
    expect(payload.nodes.map((node) => node.id)).toEqual(['a', 'b', 'child']);
    expect(payload.edges.map((edge) => edge.id)).toEqual(['ab', 'bchild']);
    expect(payload.nodes.every((node) => !('selected' in node))).toBe(true);
    expect(payload.edges.every((edge) => !('selected' in edge))).toBe(true);
  });

  test('a Node whose Parent isn’t copied becomes top-level at its absolute position', () => {
    const payload = copyPayload(state, indexFlow(state))!;
    expect(payload.nodes[0]).toEqual({ id: 'a', position: { x: 110, y: 120 }, data: { title: 'a' } });
    expect(payload.nodes[2]).toMatchObject({ parent: 'b', position: { x: 5, y: 5 } });
  });

  test('copies, sharing nothing with the state', () => {
    const payload = copyPayload(state, indexFlow(state))!;
    payload.nodes[1]!.data.title = 'changed';
    expect(state.nodes[2]!.data.title).toBe('b');
  });

  test('nothing without a selected Node', () => {
    const none = { ...state, nodes: state.nodes.map((node) => ({ ...node, selected: false })) };
    expect(copyPayload(none, indexFlow(none))).toBeUndefined();
  });
});

describe('parsePayload', () => {
  test('reads a payload from JSON, and rejects anything else', () => {
    const payload = copyPayload(state, indexFlow(state))!;
    expect(parsePayload(JSON.stringify(payload))).toEqual(payload);
    expect(parsePayload('not json')).toBeUndefined();
    expect(parsePayload('"text"')).toBeUndefined();
    expect(parsePayload('{"nodes":[]}')).toBeUndefined();
    expect(parsePayload('{"nodes":[{"id":"a"}],"edges":[]}')).toBeUndefined();
    expect(parsePayload('{"nodes":[],"edges":[{"id":"e","source":{},"target":{"node":"a"}}]}')).toBeUndefined();
    expect(parsePayload('{"nodes":[],"edges":[]}')).toEqual({ nodes: [], edges: [] });
  });
});

describe('pastePayload', () => {
  const payload = copyPayload(state, indexFlow(state))!;
  const ids = () => {
    let next = 0;
    return () => `n${++next}`;
  };

  test('gives everything new ids, rewrites Parents and Edges, and selects it all', () => {
    const pasted = pastePayload(payload, ids());
    expect(pasted.nodes.map((node) => [node.id, node.parent, node.selected])).toEqual([
      ['n1', undefined, true],
      ['n2', undefined, true],
      ['n3', 'n2', true],
    ]);
    expect(pasted.edges).toEqual([
      { id: 'n4', source: { node: 'n1', port: 'out' }, target: { node: 'n2' }, selected: true, data: { label: 'ab' } },
      { id: 'n5', source: { node: 'n2' }, target: { node: 'n3' }, selected: true, data: { label: 'inner' } },
    ]);
  });

  test('drops Edges to Nodes outside the payload, and Parents outside it', () => {
    const pasted = pastePayload(
      {
        nodes: [{ id: 'x', position: { x: 0, y: 0 }, parent: 'gone', data: null }],
        edges: [{ id: 'e', source: { node: 'x' }, target: { node: 'gone' }, data: null }],
      },
      ids(),
    );
    expect(pasted.nodes[0]).not.toHaveProperty('parent');
    expect(pasted.edges).toEqual([]);
  });

  test('places the top-level Nodes’ top-left at the point, else offsets them', () => {
    const at = pastePayload(payload, ids(), { x: 0, y: 500 });
    expect(at.nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 620 },
      { x: 290, y: 500 },
      { x: 5, y: 5 },
    ]);
    const offset = pastePayload(payload, ids());
    expect(offset.nodes[0]!.position).toEqual({ x: 110 + PASTE_OFFSET, y: 120 + PASTE_OFFSET });
  });
});
