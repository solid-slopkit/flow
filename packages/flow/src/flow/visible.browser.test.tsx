// Rendering only the Nodes and Edges in sight (ADR 0015), with real layout and real input.
import { captureArtifact } from '@solidjs/diagnostics';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { mouse, pointOf, settle, wheel } from '../../test/input';
import type { FlowNode, FlowState } from '../model/model';

const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  data: null,
  ...fields,
});

async function editor(state: FlowState, options: EditorOptions = {}) {
  const result = renderEditor(state, {
    content: () => <div style={{ width: '120px', height: '60px' }} />,
    ...options,
    flow: { onlyRenderVisible: { margin: 0 }, ...options.flow },
  });
  await settle();
  const rendered = () =>
    [...result.container.querySelectorAll('[data-flow-node]')].map((element) => element.getAttribute('data-flow-node'));
  return { ...result, rendered };
}

describe('only visible Nodes', () => {
  test('a Node out of sight keeps its Measured size, and comes back at it', async () => {
    const { api, rendered, nodeElement } = await editor({ nodes: [node('a', 0, 0), node('b', 300, 0)], edges: [] });
    expect(api().measuredSize('a')).toEqual({ width: 120, height: 60 });
    api().setViewport({ x: -1000, y: 0, zoom: 1 });
    await settle();
    expect(rendered()).toEqual([]);
    expect(api().measuredSize('a')).toEqual({ width: 120, height: 60 });
    api().setViewport({ x: 0, y: 0, zoom: 1 });
    await settle();
    expect(rendered()).toEqual(['a', 'b']);
    expect(nodeElement('a').offsetWidth).toBe(120);
  });

  test('a Node dragged out of sight stays rendered', async () => {
    const { rendered, nodeElement, root, api } = await editor({ nodes: [node('a', 20, 20)], edges: [] });
    const from = pointOf(nodeElement('a'));
    const below = root().getBoundingClientRect().bottom + 300;
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x, y: from.y + 10 });
    await mouse('mouseMoved', { x: from.x, y: below });
    await settle();
    expect(api().state().nodes[0]!.position.y).toBeGreaterThan(root().clientHeight);
    expect(rendered()).toEqual(['a']);
    await mouse('mouseReleased', { x: from.x, y: below });
    await settle();
  });

  test('wheel zooming out renders the Nodes coming into sight', async () => {
    const nodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`, (i % 8) * 400, Math.floor(i / 8) * 400));
    const { rendered, root } = await editor({ nodes, edges: [] }, { flow: { minZoom: 0.1 } });
    const before = rendered().length;
    await wheel(pointOf(root(), { x: 0, y: 0 }), 600);
    expect(rendered().length).toBeGreaterThan(before);
  });

  test('panning a Flow of thousands of Nodes renders only the few in sight, within budget', async () => {
    const nodes = Array.from({ length: 5000 }, (_, i) =>
      node(`n${i}`, (i % 100) * 200, Math.floor(i / 100) * 120, { size: { width: 150, height: 80 } }),
    );
    const edges = nodes.slice(1).map((target, i) => ({
      id: `e${i}`,
      source: { node: nodes[i]!.id },
      target: { node: target.id },
      data: null,
    }));
    const { rendered, api, container } = await editor({ nodes, edges }, { content: () => <span>Node</span> });
    // 600 × 400 shows 3 columns and 4 rows.
    expect(rendered().length).toBeLessThan(30);
    expect(container.querySelectorAll('.slp-flow-edge-path').length).toBeLessThan(60);
    const { artifact } = await captureArtifact(
      async () => {
        for (let step = 1; step <= 10; step++) {
          api().setViewport({ x: -step * 150, y: -step * 60, zoom: 1 });
          await settle();
        }
      },
      { scenario: 'pan-thousands' },
    );
    expect(rendered().length).toBeLessThan(30);
    expect(artifact).toHaveNoDiagnostics();
  });
});
