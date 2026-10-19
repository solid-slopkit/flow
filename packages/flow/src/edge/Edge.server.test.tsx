// Ports and Edges on the server (ADR 0019): they render without a DOM, and a Port sits on its side.
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
  ],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b' }, data: null }],
};

test('Ports and Edges render on the server', () => {
  const html = renderToString(() => (
    <Flow state={state}>
      <Node id="a">
        <Port id="out" />
      </Node>
      <Node id="b" />
      <Edge id="ab" label="label" markerEnd="arrow" />
    </Flow>
  ));
  expect(html).toMatch(/data-flow-port="out"[^>]*data-flow-port-side="right"/);
});
