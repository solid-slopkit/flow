// Ports and Edges with real layout and real input: measured Ports, Edges following them and dragged Nodes, labels and
// markers as drawn.
import { captureArtifact } from '@solidjs/diagnostics';
import { createSignal, Show } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { drag, pointOf, settle } from '../../test/input';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';

const node = (id: string, x: number, y = 0, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  data: null,
  ...fields,
});

/** A content-sized 100 × 50 Node with an input Port on the left and an output on the right. */
const content = () => (
  <div style={{ width: '100px', height: '50px' }}>
    <Port id="in" side="left" />
    <Port id="out" side="right" />
  </div>
);

const twoNodes: FlowState = {
  nodes: [node('a', 0), node('b', 300, 100)],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'straight', data: null }],
};

async function editor(state: FlowState, options: EditorOptions = {}) {
  const result = renderEditor(state, { content, ...options });
  await settle();
  const path = (id: string) => result.edgeElement(id)?.querySelector('.slp-flow-edge-path')?.getAttribute('d');
  return { ...result, path };
}

describe('<Port>', () => {
  test('sits on its side at its offset, and is measured there', async () => {
    const { api, nodeElement } = await editor(
      { nodes: [node('a', 50, 50)], edges: [] },
      {
        flow: { defaultViewport: { x: 10, y: 10, zoom: 1.5 } },
        content: () => (
          <div style={{ width: '100px', height: '50px' }}>
            <Port id="top" side="top" offset={0.25} />
            <Port id="right" side="right" />
            <Port id="bottom" side="bottom" offset={1} />
            <Port id="left" side="left" offset={0} />
          </div>
        ),
      },
    );
    expect(api().measuredPort('a', 'top')).toEqual({ x: 25, y: 0, side: 'top' });
    expect(api().measuredPort('a', 'right')).toEqual({ x: 100, y: 25, side: 'right' });
    expect(api().measuredPort('a', 'bottom')).toEqual({ x: 100, y: 50, side: 'bottom' });
    expect(api().measuredPort('a', 'left')).toEqual({ x: 0, y: 0, side: 'left' });
    const port = nodeElement('a').querySelector('[data-flow-port="right"]')!;
    expect(getComputedStyle(port).width).toBe('8px');
    expect(getComputedStyle(port).borderRadius).toBe('50%');
  });

  test('without a side, the app places it and it takes the nearest side', async () => {
    const { api } = await editor(
      { nodes: [node('a', 0)], edges: [] },
      {
        content: () => (
          <div style={{ width: '100px', height: '50px' }}>
            <Port id="p" style={{ left: '50px', top: '45px' }} />
          </div>
        ),
      },
    );
    expect(api().measuredPort('a', 'p')).toEqual({ x: 50, y: 45, side: 'bottom' });
    expect(api().port('a', 'p')?.side).toBe('bottom');
  });

  test('a Port added later, or moved along its side, is measured again', async () => {
    const [shown, setShown] = createSignal(false);
    const [offset, setOffset] = createSignal(0.5);
    const { api } = await editor(
      { nodes: [node('a', 0)], edges: [] },
      {
        content: () => (
          <div style={{ width: '100px', height: '50px' }}>
            <Show when={shown()}>
              <Port id="late" side="right" offset={offset()} />
            </Show>
          </div>
        ),
      },
    );
    expect(api().measuredPort('a', 'late')).toBeUndefined();
    setShown(true);
    await settle();
    expect(api().measuredPort('a', 'late')).toEqual({ x: 100, y: 25, side: 'right' });
    setOffset(0.2);
    await settle();
    expect(api().measuredPort('a', 'late')).toEqual({ x: 100, y: 10, side: 'right' });
    setShown(false);
    await settle();
    expect(api().measuredPort('a', 'late')).toBeUndefined();
  });
});

describe('<Edge>', () => {
  test('is drawn between measured Ports of content-sized Nodes', async () => {
    const { path } = await editor(twoNodes);
    expect(path('ab')).toBe('M 100 25 L 300 125');
  });

  test('uses a declared Port until it is measured, then the measured one', async () => {
    const [shown, setShown] = createSignal(false);
    const { path } = await editor(
      {
        nodes: [
          node('a', 0, 0, { size: { width: 100, height: 50 }, ports: [{ id: 'out', side: 'right' }] }),
          node('b', 300, 0, { size: { width: 100, height: 50 }, ports: [{ id: 'in', side: 'left' }] }),
        ],
        edges: twoNodes.edges,
      },
      {
        content: () => (
          <Show when={shown()}>
            <Port id="out" side="bottom" />
          </Show>
        ),
      },
    );
    expect(path('ab')).toBe('M 100 25 L 300 25');
    setShown(true);
    await settle();
    expect(path('ab')).toBe('M 50 50 L 300 25');
  });

  test('follows a dragged Node, re-running only its own Edge', async () => {
    const { path, nodeElement } = await editor({
      nodes: [node('a', 0), node('b', 200), node('c', 400)],
      edges: [
        twoNodes.edges[0]!,
        { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' }, shape: 'straight', data: null },
      ],
    });
    const from = pointOf(nodeElement('c'));
    const { artifact } = await captureArtifact(
      () => drag(from, { x: from.x + 20, y: from.y + 10 }, { x: from.x + 40, y: from.y + 60 }),
      {
        scenario: 'drag-node',
      },
    );
    expect(path('bc')).toBe('M 300 25 L 440 85');
    expect(path('ab')).toBe('M 100 25 L 200 25');
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /edge:ab/ });
    // Once per drag step.
    expect(artifact).toStayWithinRerunBudget(2, { scope: 'edge:bc:geometry' });
  });

  test('its label is centred on the label point and takes pointer input', async () => {
    let clicks = 0;
    const { api, container } = await editor(twoNodes, {
      flow: { defaultViewport: { x: 20, y: 30, zoom: 1.5 } },
      edge: () => ({
        get label() {
          return (
            <button style={{ width: '40px', height: '20px' }} onClick={() => clicks++}>
              go
            </button>
          );
        },
      }),
    });
    const label = container.querySelector('[data-flow-edge-label="ab"]')!;
    const centre = pointOf(label);
    const expected = api().flowToScreen({ x: 200, y: 75 });
    expect(centre.x).toBeCloseTo(expected.x, 0);
    expect(centre.y).toBeCloseTo(expected.y, 0);
    await drag(centre);
    expect(clicks).toBe(1);
  });

  test('markers take the Edge’s color, selected or not', async () => {
    const { edgeElement } = await editor(
      { ...twoNodes, edges: [{ ...twoNodes.edges[0]!, selected: true }] },
      { edge: () => ({ markerEnd: 'arrow-closed', markerStart: 'arrow', style: { color: 'rgb(255, 0, 0)' } }) },
    );
    const g = edgeElement('ab')!;
    const line = g.querySelector('.slp-flow-edge-path')!;
    const closed = g.querySelector('marker[data-marker="arrow-closed"] path')!;
    const open = g.querySelector('marker[data-marker="arrow"] path')!;
    expect(getComputedStyle(line).stroke).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(closed).fill).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(open).stroke).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(open).fill).toBe('none');

    const plain = await editor(twoNodes, { edge: () => ({ markerEnd: 'arrow-closed' }) });
    const plainLine = plain.edgeElement('ab')!.querySelector('.slp-flow-edge-path')!;
    const plainMarker = plain.edgeElement('ab')!.querySelector('marker path')!;
    expect(getComputedStyle(plainMarker).fill).toBe(getComputedStyle(plainLine).stroke);
    expect(getComputedStyle(plainLine).stroke).not.toBe(getComputedStyle(line).stroke);
  });
});
