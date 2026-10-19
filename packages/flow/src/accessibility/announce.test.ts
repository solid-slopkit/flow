import { describe, expect, test } from 'vitest';

import type { Change } from '../changes/changes';
import { indexFlow } from '../model/flow-index';
import type { FlowNode, FlowState } from '../model/model';
import { announcement } from './announce';
import { defaultMessages, listNames } from './messages';

const node = (id: string): FlowNode => ({ id, position: { x: 0, y: 0 }, data: null });
const state: FlowState = {
  nodes: [node('a'), node('b'), node('c')],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null }],
};
const say = (changes: Change[], selected = { nodes: new Set<string>(), edges: new Set<string>() }) =>
  announcement(changes, {
    index: indexFlow(state),
    selected,
    nodeName: (id) => id.toUpperCase(),
    messages: defaultMessages,
  });

const move = (node: string, x: number, y: number): Change => ({ type: 'move', node, from: { x: 0, y: 0 }, to: { x, y } });
const select = (id: string, to: boolean, item: 'node' | 'edge' = 'node'): Change => ({ type: 'select', item, id, from: !to, to });

describe('announcement', () => {
  test('a move names the Node and where it went; several are listed', () => {
    expect(say([move('a', 10.4, -3)])).toBe('Moved A to 10, -3');
    expect(say([move('a', 1, 0), move('b', 1, 0), move('a', 2, 0)])).toBe('Moved A and B');
    expect(say(['a', 'b', 'c', 'd'].map((id) => move(id, 0, 0)))).toBe('Moved 4 nodes');
  });

  test('a Connection and a reconnected Edge name their Nodes', () => {
    const edge = { id: 'new', source: { node: 'b' }, target: { node: 'c' }, data: null };
    expect(say([{ type: 'connect', edge }])).toBe('Connected B to C');
    expect(say([{ type: 'reconnect', edge: 'ab', end: 'target', from: { node: 'b' }, to: { node: 'c', port: 'in' } }])).toBe(
      'Edge now runs from A to C',
    );
  });

  test('a removal names its Nodes and counts its Edges; an addition counts both', () => {
    expect(say([{ type: 'remove', nodes: [node('a')], edges: [state.edges[0]!] }])).toBe('Removed A and 1 edge');
    expect(say([{ type: 'remove', nodes: [], edges: [state.edges[0]!, state.edges[0]!] }])).toBe('Removed 2 edges');
    expect(say([select('a', false), { type: 'add', nodes: [node('x'), node('y')], edges: [] }])).toBe('Added 2 nodes');
  });

  test('a Selection says what is selected after it, from the Selection before', () => {
    expect(say([select('b', true)], { nodes: new Set(['a']), edges: new Set() })).toBe('Selected A and B');
    expect(say([select('a', false), select('ab', true, 'edge')], { nodes: new Set(['a']), edges: new Set() })).toBe(
      'Selected 1 edge',
    );
    expect(say([select('a', false)], { nodes: new Set(['a']), edges: new Set() })).toBe('Selection cleared');
  });

  test('a removal outranks the rest, and a move outranks the Selection it comes with', () => {
    expect(say([select('a', true), move('a', 5, 5)])).toBe('Moved A to 5, 5');
    expect(say([move('a', 5, 5), { type: 'remove', nodes: [node('b')], edges: [] }])).toBe('Removed B');
  });

  test('Changes with nothing to say say nothing', () => {
    expect(say([])).toBeUndefined();
    expect(
      say([
        {
          type: 'resize',
          node: 'a',
          from: { position: { x: 0, y: 0 } },
          to: { position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
        },
      ]),
    ).toBeUndefined();
  });
});

describe('listNames', () => {
  test('joins up to three names, and counts more', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['a'])).toBe('a');
    expect(listNames(['a', 'b', 'c'])).toBe('a, b and c');
    expect(listNames(['a', 'b', 'c', 'd'])).toBe('4 nodes');
  });
});
