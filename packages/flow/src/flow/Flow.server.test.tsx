// The Flow on the server (ADR 0019): no DOM, no measuring. With a declared size, fitView is computed while rendering.
import { renderToString } from '@solidjs/web';
import { expect, test } from 'vitest';

import type { FlowState } from '../model/model';
import { Node } from '../node/Node';
import { Flow } from './Flow';

const state: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, data: null },
    { id: 'b', position: { x: 300, y: 100 }, size: { width: 100, height: 100 }, data: null },
  ],
  edges: [],
};

test('renders its layers on the server', () => {
  const html = renderToString(() => (
    <Flow state={state}>
      <p>content</p>
    </Flow>
  ));
  expect(html).toContain('class="slp-flow"');
  expect(html).toContain('slp-flow-edges');
  expect(html).toMatch(/slp-flow-nodes[^>]*>.*content/);
  expect(html).toContain('translate(0px, 0px) scale(1)');
});

test('fits the view from the declared size', () => {
  const html = renderToString(() => <Flow state={state} width={448} height={248} fitView />);
  expect(html).toContain('width:448px');
  expect(html).toContain('translate(24px, 24px) scale(1)');
});

const far: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, data: null },
    { id: 'b', position: { x: 1000, y: 0 }, size: { width: 100, height: 100 }, data: null },
  ],
  edges: [],
};

test('on the server, only the Nodes in sight of the declared size are rendered', () => {
  const html = renderToString(() => (
    <Flow state={far} width={600} height={400} onlyRenderVisible>
      <Node id="a">A</Node>
      <Node id="b">B</Node>
    </Flow>
  ));
  expect(html).toContain('data-flow-node="a"');
  expect(html).not.toContain('data-flow-node="b"');
});
