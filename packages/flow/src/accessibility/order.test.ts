import { describe, expect, test } from 'vitest';

import { indexFlow } from '../model/flow-index';
import type { FlowNode, FlowState } from '../model/model';
import { edgeOrder, spatialOrder } from './order';

const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  data: null,
  ...fields,
});
const order = (state: FlowState) => spatialOrder(state, indexFlow(state));

describe('spatialOrder', () => {
  test('reads top to bottom, then left to right; ties keep state order', () => {
    const state: FlowState = {
      nodes: [node('c', 0, 200), node('b', 300, 0), node('a', 0, 0), node('d', 300, 200), node('e', 300, 200)],
      edges: [],
    };
    expect(order(state)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('a Parent is followed by the Nodes nested in it, ordered by their absolute positions', () => {
    const state: FlowState = {
      nodes: [
        node('child-2', 10, 10, { parent: 'group' }),
        node('group', 0, 100),
        node('right', 500, 0),
        node('child-1', 10, 10, { parent: 'inner' }),
        node('inner', 0, 0, { parent: 'group' }),
        node('below', 0, 300),
      ],
      edges: [],
    };
    // child-2 sits at (10, 110), past inner at (0, 100); child-1 at (10, 110) inside inner.
    expect(order(state)).toEqual(['right', 'group', 'inner', 'child-1', 'child-2', 'below']);
  });

  test('a missing Parent reads as top level, and a cycle of Parents comes last', () => {
    const state: FlowState = {
      nodes: [node('x', 0, 0, { parent: 'y' }), node('y', 0, 0, { parent: 'x' }), node('orphan', 0, 50, { parent: 'gone' })],
      edges: [],
    };
    expect(order(state)).toEqual(['orphan', 'x', 'y']);
  });
});

describe('edgeOrder', () => {
  test('orders Edges by their Source, then their Target, as the Nodes are ordered', () => {
    const end = (id: string) => ({ node: id });
    const state: FlowState = {
      nodes: [],
      edges: [
        { id: 'ca', source: end('c'), target: end('a'), data: null },
        { id: 'ac', source: end('a'), target: end('c'), data: null },
        { id: 'ab', source: end('a'), target: end('b'), data: null },
        { id: 'xa', source: end('x'), target: end('a'), data: null },
      ],
    };
    expect(edgeOrder(state, ['a', 'b', 'c'])).toEqual(['ab', 'ac', 'ca', 'xa']);
  });
});
