// Built-in UI with real layout and real input: panning by dragging and clicking in the MiniMap, presses on the panels
// that leave the Flow alone, the panels in the Flow's Tab order, and their corners.
import { captureArtifact } from '@solidjs/diagnostics';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { drag, key, mouse, pointOf, settle } from '../../test/input';
import type { FlowNode, FlowState } from '../model/model';
import { Background } from './Background';
import { Controls } from './Controls';
import { MiniMap } from './MiniMap';

const node = (id: string, x: number, y = 0, selected = false): FlowNode => ({
  id,
  position: { x, y },
  size: { width: 100, height: 50 },
  selected,
  data: null,
});
const state: FlowState = {
  nodes: [node('a', 0, 0, true), node('b', 300, 200)],
  edges: [{ id: 'ab', source: { node: 'a' }, target: { node: 'b' }, data: null }],
};

async function editor() {
  const result = renderEditor(state, {
    children: () => (
      <>
        <Background />
        <Controls />
        <MiniMap />
      </>
    ),
  });
  await settle();
  const minimap = () => result.root().querySelector<SVGSVGElement>('.slp-flow-minimap svg')!;
  const button = (name: string) => result.root().querySelector<HTMLButtonElement>(`.slp-flow-controls [aria-label="${name}"]`)!;
  /** The screen point of a point in Flow coordinates, as the MiniMap draws it. */
  const inMiniMap = (point: { x: number; y: number }) => {
    const [x, y, width, height] = minimap().getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
    const rect = minimap().getBoundingClientRect();
    return {
      x: rect.left + ((point.x - x) / width) * rect.width,
      y: rect.top + ((point.y - y) / height) * rect.height,
      scale: width / rect.width,
    };
  };
  return { ...result, minimap, button, inMiniMap };
}

describe('<MiniMap>', () => {
  test('dragging the visible area pans the Flow by as much, in Flow coordinates', async () => {
    const { api, inMiniMap } = await editor();
    // The middle of the visible area (600 x 400 at the origin).
    const from = inMiniMap({ x: 300, y: 200 });
    const { artifact } = await captureArtifact(
      () => drag(from, { x: from.x + 10, y: from.y }, { x: from.x + 20, y: from.y + 10 }),
      { scenario: 'minimap-drag' },
    );
    const { x, y, zoom } = api().viewport();
    expect(zoom).toBe(1);
    expect(x).toBeCloseTo(-20 * from.scale, 0);
    expect(y).toBeCloseTo(-10 * from.scale, 0);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):|flowIndex|minimap:node/ });
  });

  test('a press outside the visible area centres the view there', async () => {
    const { api, inMiniMap } = await editor();
    api().setViewport({ x: 500, y: 300, zoom: 1 });
    await settle();
    await drag(inMiniMap({ x: 350, y: 225 }));
    const { x, y } = api().viewport();
    expect(x).toBeCloseTo(300 - 350, 0);
    expect(y).toBeCloseTo(200 - 225, 0);
  });
});

describe('panels', () => {
  test('presses on them neither pan the Flow nor change the Selection', async () => {
    const { api, button, minimap, batches } = await editor();
    const before = api().viewport();
    await drag(pointOf(button('Fit view')), { x: pointOf(button('Fit view')).x + 40, y: pointOf(button('Fit view')).y });
    await mouse('mousePressed', pointOf(minimap()));
    await mouse('mouseReleased', pointOf(minimap()));
    await settle();
    expect(batches).toEqual([]);
    // Fit view was not clicked (the press moved off it); the MiniMap press was inside the visible area.
    expect(api().viewport()).toEqual(before);
  });

  test('come after the Edges in the Flow’s Tab order, then Tab leaves the Flow', async () => {
    const { root, nodeElement, edgeElement, button, minimap } = await editor();
    const after = document.createElement('button');
    document.body.append(after);
    root().focus();
    const visited: Element[] = [];
    for (let i = 0; i < 8; i++) {
      await key('Tab');
      visited.push(document.activeElement!);
    }
    expect(visited).toEqual([
      nodeElement('a'),
      nodeElement('b'),
      edgeElement('ab'),
      button('Zoom in'),
      button('Zoom out'),
      button('Fit view'),
      button('Lock editing'),
      minimap(),
    ]);
    await key('Tab');
    expect(document.activeElement).toBe(after);
    after.remove();
  });

  test('sit in their corners, above the Nodes, and the Background fills the Flow under them', async () => {
    const { root } = await editor();
    const box = root().getBoundingClientRect();
    const controls = root().querySelector('.slp-flow-controls')!.getBoundingClientRect();
    const minimap = root().querySelector('.slp-flow-minimap')!.getBoundingClientRect();
    const background = root().querySelector('.slp-flow-background')!.getBoundingClientRect();
    expect(controls.left - box.left).toBeCloseTo(box.bottom - controls.bottom, 0);
    expect(controls.left - box.left).toBeGreaterThan(0);
    expect(box.right - minimap.right).toBeCloseTo(box.bottom - minimap.bottom, 0);
    expect([background.width, background.height]).toEqual([box.width, box.height]);
    const atControls = document.elementFromPoint(controls.left + controls.width / 2, controls.top + 4);
    expect(atControls?.closest('.slp-flow-controls')).not.toBeNull();
  });
});
