// Built-in UI on the server (ADR 0019): a Background, Controls and a MiniMap render without a DOM, from the declared
// sizes of the Flow and its Nodes.
import { SlopkitUi } from '@solid-slopkit/components';
import { renderToString } from '@solidjs/web';
import { expect, test } from 'vitest';

import { Flow } from '../flow/Flow';
import type { FlowState } from '../model/model';
import { Node } from '../node/Node';
import { Background } from './Background';
import { Controls } from './Controls';
import { MiniMap } from './MiniMap';

const state: FlowState = {
  nodes: [{ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, data: null }],
  edges: [],
};

test('a Background, Controls and a MiniMap render on the server, in their layers', () => {
  const html = renderToString(() => (
    <SlopkitUi>
      <Flow state={state} width={400} height={300} defaultViewport={{ x: 10, y: 20, zoom: 1 }}>
        <Node id="a" />
        <Background />
        <Controls />
        <MiniMap />
      </Flow>
    </SlopkitUi>
  ));
  const background = html.indexOf('slp-flow-background');
  const viewport = html.indexOf('slp-flow-viewport');
  expect(background).toBeGreaterThan(-1);
  expect(background).toBeLessThan(viewport);
  expect(html).toMatch(/<pattern[^>]*x="0"[^>]*y="10"[^>]*width="20"[^>]*height="20"/);
  expect(html.indexOf('slp-flow-controls')).toBeGreaterThan(viewport);
  expect(html).toContain('aria-label="Zoom in"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toMatch(/<rect[^>]*data-flow-minimap-node="a"[^>]*x="0"[^>]*y="0"[^>]*width="100"[^>]*height="50"/);
  // The visible area, from the declared size: 400 x 300 at (-10, -20).
  expect(html).toMatch(/class="slp-flow-minimap-view"[^>]*x="-10"[^>]*y="-20"[^>]*width="400"[^>]*height="300"/);
});
