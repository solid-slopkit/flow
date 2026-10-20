import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { applyChanges } from '../changes/apply';
import type { FlowNode, FlowState } from '../model/model';
import { MiniMap, type MiniMapProps } from './MiniMap';

const node = (id: string, x: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y: 0 },
  size: { width: 100, height: 100 },
  data: null,
  ...fields,
});
const state: FlowState = {
  nodes: [node('a', 0, { selected: true }), node('b', 300), node('unsized', 600, { size: undefined })],
  edges: [],
};

function editor(props: MiniMapProps = {}, options: EditorOptions = {}) {
  const result = renderEditor(state, {
    ...options,
    flow: { width: 600, height: 400, ...options.flow },
    children: () => <MiniMap {...props} />,
  });
  flush();
  const panel = () => result.root().querySelector<HTMLElement>('.slp-flow-minimap')!;
  const svg = () => panel().querySelector('svg')!;
  const rects = () => [...svg().querySelectorAll<SVGRectElement>('.slp-flow-minimap-node')];
  const view = () => svg().querySelector('.slp-flow-minimap-view')!;
  const numbers = (element: Element, ...names: string[]) => names.map((name) => Number(element.getAttribute(name)));
  const viewBox = () => svg().getAttribute('viewBox')!.split(' ').map(Number);
  return { ...result, panel, svg, rects, view, numbers, viewBox };
}

describe('<MiniMap>', () => {
  test('a named, focusable picture in a corner over the Viewport', () => {
    const { root, panel, svg } = editor();
    expect(panel().parentElement).toBe(root());
    expect(panel().hasAttribute('data-flow-panel')).toBe(true);
    expect(panel().dataset.position).toBe('bottom-right');
    expect([svg().getAttribute('width'), svg().getAttribute('height')]).toEqual(['200', '150']);
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Mini map');
    expect(svg().getAttribute('tabindex')).toBe('0');
    expect(document.getElementById(svg().getAttribute('aria-describedby')!)!.textContent).toBe(
      'Arrow keys pan the view. Plus and minus zoom in and out.',
    );
  });

  test('draws every Node with a size at its bounds, flagging the Selection', () => {
    const { rects, numbers } = editor();
    expect(rects().map((rect) => rect.dataset.flowMinimapNode)).toEqual(['a', 'b']);
    expect(numbers(rects()[1]!, 'x', 'y', 'width', 'height')).toEqual([300, 0, 100, 100]);
    expect(rects().map((rect) => rect.hasAttribute('data-selected'))).toEqual([true, false]);
  });

  test('shows the Nodes and the visible area, centred at its own aspect ratio, and shades the rest', () => {
    const { view, numbers, viewBox, svg } = editor();
    // The visible area, 600 x 400 at zoom 1, holds every Node, so it decides the scale; 8px stay free around it.
    expect(numbers(view(), 'x', 'y', 'width', 'height')).toEqual([0, 0, 600, 400]);
    const [x, y, width, height] = viewBox();
    expect(width! / height!).toBeCloseTo(200 / 150);
    expect(width).toBeCloseTo((600 / 184) * 200);
    expect(x! + width! / 2).toBeCloseTo(300);
    expect(y! + height! / 2).toBeCloseTo(200);
    const mask = svg().querySelector('.slp-flow-minimap-mask')!;
    expect(mask.getAttribute('fill-rule')).toBe('evenodd');
    expect(mask.getAttribute('d')).toContain('M 0 0 h 600 v 400 h -600 Z');
  });

  test('the visible area follows the Viewport', () => {
    const { api, view, numbers } = editor();
    api().setViewport({ x: -100, y: 50, zoom: 2 });
    flush();
    expect(numbers(view(), 'x', 'y', 'width', 'height')).toEqual([50, -25, 300, 200]);
  });

  test('takes a color and a class per Node', () => {
    const { rects } = editor({
      nodeColor: (record) => (record.id === 'a' ? 'red' : undefined),
      nodeClass: 'mine',
    });
    expect(rects().map((rect) => rect.style.fill)).toEqual(['red', '']);
    expect(rects()[1]!.classList.contains('mine')).toBe(true);
  });

  test('arrow keys pan by a tenth of the view, plus and minus zoom; the Selection stays put', () => {
    const { svg, api, batches } = editor();
    fireEvent.keyDown(svg(), { key: 'ArrowRight' });
    fireEvent.keyDown(svg(), { key: 'ArrowDown' });
    expect(api().viewport()).toEqual({ x: -60, y: -40, zoom: 1 });
    fireEvent.keyDown(svg(), { key: '+' });
    expect(api().viewport().zoom).toBe(1.2);
    fireEvent.keyDown(svg(), { key: '-' });
    expect(api().viewport().zoom).toBeCloseTo(1);
    expect(batches).toEqual([]);
  });

  test('the wheel over it zooms around the Flow’s centre, and not again around the pointer', () => {
    const { svg, api } = editor();
    fireEvent.wheel(svg(), { deltaY: -500, clientX: 590, clientY: 390 });
    flush();
    const { x, y, zoom } = api().viewport();
    expect(zoom).toBe(2);
    expect({ x, y }).toEqual({ x: -300, y: -200 });
  });

  test('neither pannable nor zoomable: a picture only', () => {
    const { svg, api } = editor({ pannable: false, zoomable: false });
    expect(svg().hasAttribute('tabindex')).toBe(false);
    expect(svg().hasAttribute('aria-describedby')).toBe(false);
    fireEvent.keyDown(svg(), { key: 'ArrowRight' });
    fireEvent.keyDown(svg(), { key: '+' });
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test('moving a Node redraws only its rectangle', async () => {
    const { setState, rects, numbers } = editor();
    const { artifact } = await captureArtifact(
      () => applyChanges(setState, { changes: [{ type: 'move', node: 'b', from: { x: 300, y: 0 }, to: { x: 300, y: 50 } }] }),
      { scenario: 'move-node' },
    );
    expect(numbers(rects()[1]!, 'y')).toEqual([50]);
    expect(artifact).toHaveNoDiagnostics();
    // The content box grows, so the view box is checked once; the visible area doesn't depend on the Nodes.
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'minimap:content' });
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'minimap:viewBox' });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'minimap:visible' });
  });

  test('without a size, the Flow has no visible area to show', () => {
    const { svg } = editor({}, { flow: { width: undefined, height: undefined } });
    expect(svg().querySelector('.slp-flow-minimap-view')).toBeNull();
    expect(svg().querySelector('.slp-flow-minimap-mask')).toBeNull();
  });
});
