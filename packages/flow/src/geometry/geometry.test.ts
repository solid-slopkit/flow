import { captureArtifact } from '../../test/capture';
import { createMemo, createRoot, createStore, flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { indexFlow } from '../model/flow-index';
import type { FlowEdge, FlowNode, FlowState } from '../model/model';
import { absolutePosition, edgeEnds, floatingPoint, nodeBounds, portPoint } from './geometry';

const node = (id: string, fields: Partial<FlowNode<null>> = {}): FlowNode<null> => ({
  id,
  position: { x: 0, y: 0 },
  data: null,
  ...fields,
});

const state: FlowState<null, null> = {
  nodes: [
    node('outer', { position: { x: 100, y: 100 }, size: { width: 400, height: 400 } }),
    node('inner', { parent: 'outer', position: { x: 10, y: 20 }, size: { width: 200, height: 200 } }),
    node('leaf', {
      parent: 'inner',
      position: { x: 5, y: 5 },
      size: { width: 100, height: 50 },
      ports: [
        { id: 'out', side: 'right' },
        { id: 'top', side: 'top', offset: 0.25 },
      ],
    }),
    node('free', { position: { x: 1000, y: 100 }, size: { width: 100, height: 100 } }),
    node('unsized', { position: { x: 0, y: 0 } }),
    node('orphan', { parent: 'missing', position: { x: 7, y: 8 } }),
    node('loopA', { parent: 'loopB', position: { x: 1, y: 1 } }),
    node('loopB', { parent: 'loopA', position: { x: 2, y: 2 } }),
  ],
  edges: [],
};
const index = indexFlow(state);

describe('absolutePosition', () => {
  test('adds up the positions of every Parent', () => {
    expect(absolutePosition(index, 'outer')).toEqual({ x: 100, y: 100 });
    expect(absolutePosition(index, 'leaf')).toEqual({ x: 115, y: 125 });
  });

  test('stops at a missing Parent or a cycle', () => {
    expect(absolutePosition(index, 'orphan')).toEqual({ x: 7, y: 8 });
    expect(absolutePosition(index, 'loopA')).toEqual({ x: 3, y: 3 });
    expect(absolutePosition(index, 'missing')).toBeUndefined();
  });
});

describe('nodeBounds', () => {
  test('uses the Measured size, else the Declared size', () => {
    expect(nodeBounds(index, 'leaf')).toEqual({ x: 115, y: 125, width: 100, height: 50 });
    const measured = (id: string) => (id === 'leaf' ? { width: 120, height: 60 } : undefined);
    expect(nodeBounds(index, 'leaf', measured)).toEqual({ x: 115, y: 125, width: 120, height: 60 });
    expect(nodeBounds(index, 'unsized', measured)).toBeUndefined();
    expect(nodeBounds(index, 'unsized', () => ({ width: 10, height: 10 }))).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe('portPoint', () => {
  test('places a declared Port on its side at its offset', () => {
    expect(portPoint(index, { node: 'leaf', port: 'out' })).toEqual({ x: 215, y: 150, side: 'right' });
    expect(portPoint(index, { node: 'leaf', port: 'top' })).toEqual({ x: 140, y: 125, side: 'top' });
  });

  test('has no point for a Floating end, an undeclared Port or an unsized Node', () => {
    expect(portPoint(index, { node: 'leaf' })).toBeUndefined();
    expect(portPoint(index, { node: 'leaf', port: 'nope' })).toBeUndefined();
    expect(portPoint(index, { node: 'unsized', port: 'out' })).toBeUndefined();
  });

  test('a measured Port wins over its declaration, and needs no declaration', () => {
    const ports = (node: string, port: string) =>
      node === 'leaf' && (port === 'out' || port === 'extra') ? { x: 90, y: 10, side: 'bottom' as const } : undefined;
    expect(portPoint(index, { node: 'leaf', port: 'out' }, undefined, ports)).toEqual({ x: 205, y: 135, side: 'bottom' });
    expect(portPoint(index, { node: 'leaf', port: 'extra' }, undefined, ports)).toEqual({ x: 205, y: 135, side: 'bottom' });
    expect(portPoint(index, { node: 'leaf', port: 'top' }, undefined, ports)).toEqual({ x: 140, y: 125, side: 'top' });
  });

  test.each([
    ['top', { x: 25, y: 0 }],
    ['right', { x: 100, y: 25 }],
    ['bottom', { x: 25, y: 100 }],
    ['left', { x: 0, y: 25 }],
  ] as const)('%s side', (side, point) => {
    const flow = indexFlow({
      nodes: [node('n', { size: { width: 100, height: 100 }, ports: [{ id: 'p', side, offset: 0.25 }] })],
      edges: [],
    });
    expect(portPoint(flow, { node: 'n', port: 'p' })).toEqual({ ...point, side });
  });
});

describe('floatingPoint', () => {
  const box = { x: 0, y: 0, width: 200, height: 100 };

  test('clips the line from the centre to the outline', () => {
    expect(floatingPoint(box, { x: 500, y: 50 })).toEqual({ x: 200, y: 50, side: 'right' });
    expect(floatingPoint(box, { x: 100, y: -300 })).toEqual({ x: 100, y: 0, side: 'top' });
    expect(floatingPoint(box, { x: 0, y: 75 })).toEqual({ x: 0, y: 75, side: 'left' });
    expect(floatingPoint(box, { x: 150, y: 150 })).toEqual({ x: 125, y: 100, side: 'bottom' });
  });

  test('a point at the centre stays there', () => {
    expect(floatingPoint(box, { x: 100, y: 50 })).toEqual({ x: 100, y: 50, side: 'right' });
  });
});

describe('edgeEnds', () => {
  const edge = (source: FlowEdge['source'], target: FlowEdge['target']): FlowEdge => ({ id: 'e', source, target, data: null });

  test('a Port end and a Floating end clipped toward it', () => {
    expect(edgeEnds(index, edge({ node: 'leaf', port: 'out' }, { node: 'free' }))).toEqual({
      source: { x: 215, y: 150, side: 'right' },
      target: { x: 1000, y: 150, side: 'left' },
    });
  });

  test('two Floating ends clip toward each other’s centres', () => {
    expect(edgeEnds(index, edge({ node: 'free' }, { node: 'outer' }))).toEqual({
      source: { x: 1000, y: 160, side: 'left' },
      target: { x: 500, y: 260, side: 'right' },
    });
  });

  test('uses measured Ports', () => {
    const ports = () => ({ x: 0, y: 200, side: 'left' as const });
    expect(edgeEnds(index, edge({ node: 'free', port: 'in' }, { node: 'outer' }), undefined, ports)).toEqual({
      source: { x: 1000, y: 300, side: 'left' },
      target: { x: 500, y: 300, side: 'right' },
    });
  });

  test('nothing to draw without sizes or with an undeclared Port', () => {
    expect(edgeEnds(index, edge({ node: 'unsized' }, { node: 'free' }))).toBeUndefined();
    expect(edgeEnds(index, edge({ node: 'leaf', port: 'nope' }, { node: 'free' }))).toBeUndefined();
  });

  test('over a store, follows only the Nodes at its ends', async () => {
    const { artifact } = await captureArtifact(
      () => {
        const [flow, setFlow] = createStore<FlowState<null, null>>({
          nodes: [
            node('a', { size: { width: 10, height: 10 } }),
            node('b', { position: { x: 100, y: 0 }, size: { width: 10, height: 10 } }),
            node('c', { size: { width: 10, height: 10 } }),
          ],
          edges: [{ id: 'ab', source: { node: 'a' }, target: { node: 'b' }, data: null }],
        });
        createRoot(() => {
          const index = createMemo(() => indexFlow(flow), { name: 'index' });
          return createMemo(() => edgeEnds(index(), flow.edges[0]!), { name: 'ends' });
        });
        flush();
        setFlow((draft) => {
          draft.nodes[2]!.position.x = 50;
        });
        flush();
        setFlow((draft) => {
          draft.nodes[0]!.position.y = 50;
        });
        flush();
      },
      { scenario: 'edge-ends' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'ends' });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'index' });
  });
});
