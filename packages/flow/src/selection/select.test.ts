import { describe, expect, test } from 'vitest';

import { indexFlow } from '../model/flow-index';
import type { FlowState } from '../model/model';
import { isAncestor, selectedIds, selectionChanges, topmost } from './select';

const state: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, selected: true, data: null },
    { id: 'b', position: { x: 0, y: 0 }, parent: 'a', data: null },
    { id: 'c', position: { x: 0, y: 0 }, parent: 'b', selected: false, data: null },
    { id: 'd', position: { x: 0, y: 0 }, data: null },
  ],
  edges: [
    { id: 'ad', source: { node: 'a' }, target: { node: 'd' }, selected: true, data: null },
    { id: 'cd', source: { node: 'c' }, target: { node: 'd' }, data: null },
  ],
};

describe('selection', () => {
  test('selectedIds lists the flagged records', () => {
    expect(selectedIds(state)).toEqual({ nodes: new Set(['a']), edges: new Set(['ad']) });
  });

  test('selectionChanges flips only the flags that differ, Nodes then Edges', () => {
    expect(selectionChanges(state, { nodes: new Set(['a', 'c']), edges: new Set(['cd']) })).toEqual([
      { type: 'select', item: 'node', id: 'c', from: false, to: true },
      { type: 'select', item: 'edge', id: 'ad', from: true, to: false },
      { type: 'select', item: 'edge', id: 'cd', from: false, to: true },
    ]);
    expect(selectionChanges(state, selectedIds(state))).toEqual([]);
  });

  test('isAncestor walks the Parents, and topmost drops Nodes whose Parent is listed', () => {
    const index = indexFlow(state);
    expect(isAncestor(index, 'a', 'c')).toBe(true);
    expect(isAncestor(index, 'c', 'a')).toBe(false);
    expect(isAncestor(index, 'd', 'c')).toBe(false);
    expect(topmost(index, ['c', 'a', 'd'])).toEqual(['a', 'd']);
    expect(topmost(index, ['c', 'b'])).toEqual(['b']);
  });

  test('a cycle of Parents ends the walk', () => {
    const index = indexFlow({
      nodes: [
        { id: 'x', position: { x: 0, y: 0 }, parent: 'y', data: null },
        { id: 'y', position: { x: 0, y: 0 }, parent: 'x', data: null },
      ],
      edges: [],
    });
    expect(isAncestor(index, 'z', 'x')).toBe(false);
  });
});
