// Ports and Edges on the server (ADR 0019): Nodes always render, and an Edge is drawn when both its ends can be placed
// from the data alone: Declared sizes, and the Ports declared in the Nodes' `ports`.
import { For } from 'solid-js';
import { renderToString } from '@solidjs/web';
import { expect, test } from 'vitest';

import { Flow } from '../flow/Flow';
import type { FlowState } from '../model/model';
import { Node } from '../node/Node';
import { Port } from '../port/Port';
import { Edge } from './Edge';

const state: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, ports: [{ id: 'out', side: 'right' }], data: null },
    { id: 'b', position: { x: 300, y: 0 }, size: { width: 100, height: 50 }, data: null },
    { id: 'c', position: { x: 300, y: 200 }, data: null },
  ],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b' }, shape: 'straight', data: null },
    { id: 'ac', source: { node: 'a', port: 'out' }, target: { node: 'c' }, data: null },
    { id: 'ba', source: { node: 'b', port: 'missing' }, target: { node: 'a' }, data: null },
  ],
};

const render = () =>
  renderToString(() => (
    <Flow state={state}>
      <For each={state.nodes}>
        {(node) => (
          <Node id={node.id}>
            <Port id="out" />
          </Node>
        )}
      </For>
      <For each={state.edges}>{(edge) => <Edge id={edge.id} label={`label ${edge.id}`} markerEnd="arrow" />}</For>
    </Flow>
  ));

/** The markup of one Edge's group, or of its label. */
const edgeGroup = (html: string, id: string) => html.match(new RegExp(`<g[^>]*data-flow-edge="${id}".*?</g>`))?.[0];
const label = (html: string, id: string) => html.match(new RegExp(`<div[^>]*data-flow-edge-label="${id}"[^>]*>.*?</div>`))?.[0];

test('a Port sits on its declared side', () => {
  expect(render()).toMatch(/data-flow-port="out"[^>]*data-flow-port-side="right"/);
});

test('every Node renders, with or without a Declared size', () => {
  const html = render();
  for (const id of ['a', 'b', 'c']) expect(html).toContain(`data-flow-node="${id}"`);
});

test('an Edge between declared Ports and sized Nodes is drawn, with its label', () => {
  const html = render();
  // From the right side of `a` (100, 25) to the outline of `b` (300, 25).
  expect(edgeGroup(html, 'ab')).toMatch(/<path class="slp-flow-edge-path" d="M 100 25 L 300 25" marker-end="url\(#[^"]+-end\)"/);
  expect(label(html, 'ab')).toContain('translate(200px, 25px)');
  expect(label(html, 'ab')).toContain('label ab');
});

test('the Edge layer comes before the Nodes, and the label layer after them', () => {
  const html = render();
  const edge = html.indexOf('data-flow-edge="ab"');
  const node = html.indexOf('data-flow-node="a"');
  const labelAt = html.indexOf('data-flow-edge-label="ab"');
  expect(edge).toBeGreaterThan(html.indexOf('slp-flow-edges'));
  expect(edge).toBeLessThan(node);
  expect(labelAt).toBeGreaterThan(html.indexOf('slp-flow-labels'));
});

test('an Edge whose geometry is not in the data is left for the client', () => {
  const html = render();
  // `c` has no Declared size; `b` declares no Port `missing`.
  for (const id of ['ac', 'ba']) {
    expect(edgeGroup(html, id)).toBeDefined();
    expect(edgeGroup(html, id)).not.toContain('slp-flow-edge-path');
    expect(label(html, id)).toBeUndefined();
  }
});
