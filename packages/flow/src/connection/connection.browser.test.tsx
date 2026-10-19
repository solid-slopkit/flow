// Connections with real layout and real input: measured Ports, the Edge end handles under the Nodes, the preview line.
import { captureArtifact } from '@solidjs/diagnostics';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { drag, mouse, pointOf, settle } from '../../test/input';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';
import type { ConnectEnd } from './connect';

const node = (id: string, x: number, y = 0): FlowNode => ({
  id,
  position: { x, y },
  data: null,
});

/** A content-sized 100 × 50 Node with a target Port on the left and a source Port on the right. */
const content = () => (
  <div style={{ width: '100px', height: '50px' }}>
    <Port id="in" side="left" kind="target" />
    <Port id="out" side="right" kind="source" />
  </div>
);

const nodes = [node('a', 0), node('b', 300), node('c', 300, 200)];

async function editor(state: FlowState, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(state, {
    content,
    ...options,
    flow: {
      createId: () => `e${++ids}`,
      defaultViewport: { x: 40, y: 40, zoom: 1 },
      ...options.flow,
    },
  });
  await settle();
  const port = (id: string, portId: string) => result.nodeElement(id).querySelector(`[data-flow-port="${portId}"]`)!;
  const line = () => result.root().querySelector('.slp-flow-connection-path');
  return { ...result, port, line };
}

describe('connecting', () => {
  test('dragging from a measured Port onto another sends a connect Batch and draws the Edge', async () => {
    const { port, batches, edgeElement } = await editor({ nodes, edges: [] });
    const from = pointOf(port('a', 'out'));
    const to = pointOf(port('c', 'in'));
    await drag(from, { x: from.x + 40, y: from.y + 40 }, { x: to.x + 6, y: to.y - 4 });
    expect(batches).toEqual([
      {
        changes: [
          {
            type: 'connect',
            edge: {
              id: 'e1',
              source: { node: 'a', port: 'out' },
              target: { node: 'c', port: 'in' },
            },
          },
        ],
      },
    ]);
    expect(edgeElement('e1')!.querySelector('.slp-flow-edge-path')).toHaveAttribute('d', 'M 100 25 C 200 25 200 225 300 225');
  });

  test('the preview line snaps to a valid Port and is styled for it; the Node doesn’t move', async () => {
    const { port, line, root, batches } = await editor({ nodes, edges: [] });
    const from = pointOf(port('a', 'out'));
    const to = pointOf(port('b', 'in'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 50, y: from.y + 60 });
    await settle();
    expect(getComputedStyle(root()).cursor).toBe('crosshair');
    expect(getComputedStyle(line()!).strokeDasharray).toBe('5px, 4px');
    await mouse('mouseMoved', { x: to.x - 15, y: to.y + 10 });
    await settle();
    expect(line()).toHaveAttribute('data-valid');
    expect(line()).toHaveAttribute('d', 'M 100 25 C 200 25 200 25 300 25');
    expect(getComputedStyle(line()!).strokeDasharray).toBe('none');
    expect(port('b', 'in')).toHaveAttribute('data-connection-target');
    expect(getComputedStyle(port('b', 'in')).scale).toBe('1.5');
    await mouse('mouseReleased', { x: to.x - 15, y: to.y + 10 });
    await settle();
    expect(batches.map((batch) => batch.changes[0]!.type)).toEqual(['connect']);
  });

  test('a drop on empty space reports the Flow position', async () => {
    const ends: ConnectEnd[] = [];
    const { port, api, batches } = await editor({ nodes, edges: [] }, { flow: { onConnectEnd: (end) => ends.push(end) } });
    const from = pointOf(port('a', 'out'));
    const drop = api().flowToScreen({ x: 150, y: 300 });
    await drag(from, { x: from.x + 30, y: from.y + 30 }, drop);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.source).toEqual({ node: 'a', port: 'out' });
    expect(ends[0]!.position.x).toBeCloseTo(150, 0);
    expect(ends[0]!.position.y).toBeCloseTo(300, 0);
    expect(batches).toEqual([]);
  });

  test('moving the pointer re-runs no Node or Edge', async () => {
    const { port } = await editor({
      nodes,
      edges: [
        {
          id: 'bc',
          source: { node: 'b', port: 'out' },
          target: { node: 'c', port: 'in' },
          data: null,
        },
      ],
    });
    const from = pointOf(port('a', 'out'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 20, y: from.y + 20 });
    const { artifact } = await captureArtifact(async () => {
      await mouse('mouseMoved', { x: from.x + 60, y: from.y + 80 });
      await settle();
    });
    await mouse('mouseReleased', { x: from.x + 60, y: from.y + 80 });
    await settle();
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    expect(artifact).toStayWithinRerunBudget(1, {
      scope: 'path.d, path.data-valid',
    });
  });
});

describe('reconnecting', () => {
  const edges = [
    {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      data: null,
    },
  ];

  test('grabbing an Edge just outside its Port moves that end to another Port', async () => {
    const { port, batches, edgeElement, state } = await editor({
      nodes,
      edges,
    });
    // The handle is under the Node: pressing just left of the Port, outside the Node, grabs the Edge.
    const at = pointOf(port('b', 'in'));
    const grab = { x: at.x - 7, y: at.y };
    expect(document.elementFromPoint(grab.x, grab.y)).toHaveAttribute('data-flow-edge-end', 'target');
    const to = pointOf(port('c', 'in'));
    await drag(grab, { x: grab.x - 20, y: grab.y + 50 }, to);
    expect(batches).toEqual([
      {
        changes: [
          {
            type: 'reconnect',
            edge: 'ab',
            end: 'target',
            from: { node: 'b', port: 'in' },
            to: { node: 'c', port: 'in' },
          },
        ],
      },
    ]);
    expect(state.edges[0]!.target).toEqual({ node: 'c', port: 'in' });
    expect(edgeElement('ab')!.querySelector('.slp-flow-edge-path')).toHaveAttribute('d', 'M 100 25 C 200 25 200 225 300 225');
  });

  test('the Edge is hidden while its end is dragged; off any Port it is removed', async () => {
    const { port, edgeElement, state } = await editor({ nodes, edges });
    const at = pointOf(port('b', 'in'));
    const grab = { x: at.x - 7, y: at.y };
    await mouse('mousePressed', grab);
    await mouse('mouseMoved', { x: grab.x - 60, y: grab.y + 200 });
    await settle();
    expect(getComputedStyle(edgeElement('ab')!).visibility).toBe('hidden');
    await mouse('mouseReleased', { x: grab.x - 60, y: grab.y + 200 });
    await settle();
    expect(state.edges).toEqual([]);
  });

  test('a press on the Port itself starts a new Connection instead', async () => {
    const { port, batches } = await editor({ nodes, edges });
    const from = pointOf(port('a', 'out'));
    const to = pointOf(port('c', 'in'));
    await drag(from, { x: from.x + 30, y: from.y + 30 }, to);
    expect(batches[0]!.changes[0]).toMatchObject({
      type: 'connect',
      edge: { target: { node: 'c', port: 'in' } },
    });
  });
});
