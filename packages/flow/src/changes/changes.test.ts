import { describe, expect, test } from 'vitest';

import type { FlowEdge, FlowNode } from '../model/model';
import { invert, type Batch, type Change } from './changes';

const node: FlowNode<null> = { id: 'a', position: { x: 0, y: 0 }, data: null };
const edge: FlowEdge<null> = { id: 'ab', source: { node: 'a' }, target: { node: 'b' }, data: null };

describe('invert', () => {
  test.each<[string, Change<null, null>, Change<null, null>]>([
    ['add', { type: 'add', nodes: [node], edges: [edge] }, { type: 'remove', nodes: [node], edges: [edge] }],
    ['remove', { type: 'remove', nodes: [node], edges: [] }, { type: 'add', nodes: [node], edges: [] }],
    ['connect', { type: 'connect', edge }, { type: 'remove', nodes: [], edges: [edge] }],
    [
      'move',
      { type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
      { type: 'move', node: 'a', from: { x: 5, y: 5 }, to: { x: 0, y: 0 } },
    ],
    [
      'select',
      { type: 'select', item: 'edge', id: 'ab', from: false, to: true },
      { type: 'select', item: 'edge', id: 'ab', from: true, to: false },
    ],
    [
      'resize',
      {
        type: 'resize',
        node: 'a',
        from: { position: { x: 0, y: 0 } },
        to: { position: { x: -5, y: 0 }, size: { width: 9, height: 9 } },
      },
      {
        type: 'resize',
        node: 'a',
        from: { position: { x: -5, y: 0 }, size: { width: 9, height: 9 } },
        to: { position: { x: 0, y: 0 } },
      },
    ],
    [
      'reconnect',
      { type: 'reconnect', edge: 'ab', end: 'target', from: { node: 'b' }, to: { node: 'c', port: 'in' } },
      { type: 'reconnect', edge: 'ab', end: 'target', from: { node: 'c', port: 'in' }, to: { node: 'b' } },
    ],
    [
      'reparent',
      { type: 'reparent', node: 'a', from: { position: { x: 50, y: 50 } }, to: { parent: 'g', position: { x: 10, y: 10 } } },
      { type: 'reparent', node: 'a', from: { parent: 'g', position: { x: 10, y: 10 } }, to: { position: { x: 50, y: 50 } } },
    ],
    [
      'update',
      { type: 'update', item: 'node', id: 'a', from: { data: null, draggable: undefined }, to: { data: null, draggable: false } },
      { type: 'update', item: 'node', id: 'a', from: { data: null, draggable: false }, to: { data: null, draggable: undefined } },
    ],
  ])('%s', (_, change, inverse) => {
    expect(invert({ changes: [change] })).toEqual({ changes: [inverse] });
  });

  test('reverses the order and drops the phase', () => {
    const batch: Batch<null, null> = {
      phase: 'end',
      changes: [
        { type: 'add', nodes: [node], edges: [] },
        { type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      ],
    };
    expect(invert(batch)).toEqual({
      changes: [
        { type: 'move', node: 'a', from: { x: 1, y: 1 }, to: { x: 0, y: 0 } },
        { type: 'remove', nodes: [node], edges: [] },
      ],
    });
  });

  test('leaves the Batch as it was', () => {
    const batch: Batch = { changes: [{ type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] };
    const copy = structuredClone(batch);
    invert(batch);
    expect(batch).toEqual(copy);
  });
});
