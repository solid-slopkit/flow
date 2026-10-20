import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import type { FlowState } from '../model/model';
import { Background, type BackgroundProps } from './Background';

const state: FlowState = {
  nodes: [{ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, data: null }],
  edges: [],
};

function editor(...backgrounds: BackgroundProps[]) {
  const result = renderEditor(state, {
    flow: { defaultViewport: { x: 10, y: 20, zoom: 2 } },
    children: () => backgrounds.map((props) => <Background {...props} />),
  });
  flush();
  const svgs = () => [...result.root().querySelectorAll<SVGSVGElement>('svg.slp-flow-background')];
  const pattern = (i = 0) => svgs()[i]!.querySelector('pattern')!;
  const attrs = (element: Element, ...names: string[]) => names.map((name) => element.getAttribute(name));
  return { ...result, svgs, pattern, attrs };
}

describe('<Background>', () => {
  test('is drawn under the Viewport, hidden from assistive technology, and filled with its pattern', () => {
    const { root, svgs, pattern } = editor({});
    expect(svgs()).toHaveLength(1);
    expect(svgs()[0]!.parentElement).toBe(root());
    expect(svgs()[0]!.nextElementSibling).toBe(root().querySelector('.slp-flow-viewport'));
    expect(svgs()[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(svgs()[0]!.querySelector('rect')!.getAttribute('fill')).toBe(`url(#${pattern().id})`);
  });

  test('dots by default: one tile per gap, scaled by the zoom and centred on the grid points', () => {
    const { pattern, attrs } = editor({});
    // gap 20 at zoom 2 is a 40px tile; a grid point at Flow (0, 0) is at screen (10, 20), the tile's centre.
    expect(attrs(pattern(), 'x', 'y', 'width', 'height')).toEqual(['-10', '0', '40', '40']);
    expect(attrs(pattern().querySelector('circle')!, 'cx', 'cy', 'r')).toEqual(['20', '20', '2']);
  });

  test('lines and crosses, with their own gap, size, offset, line width and color', () => {
    const { svgs, pattern, attrs } = editor(
      { variant: 'lines', gap: [10, 30], offset: 5, lineWidth: 2, color: 'red' },
      { variant: 'cross', size: 4 },
    );
    expect(svgs().map((svg) => svg.getAttribute('data-variant'))).toEqual(['lines', 'cross']);
    expect(attrs(pattern(0), 'x', 'y', 'width', 'height', 'stroke-width')).toEqual(['10', '0', '20', '60', '2']);
    expect(pattern(0).querySelector('path')!.getAttribute('d')).toBe('M 10 0 V 60 M 0 30 H 20');
    expect(svgs()[0]!.style.color).toBe('red');
    expect(pattern(1).querySelector('path')!.getAttribute('d')).toBe('M 16 20 H 24 M 20 16 V 24');
  });

  test('follows the Viewport, re-running only its tile', async () => {
    const { pattern, attrs, api } = editor({});
    const { artifact } = await captureArtifact(() => api().setViewport({ x: 0, y: 0, zoom: 1 }), { scenario: 'pan' });
    expect(attrs(pattern(), 'x', 'y', 'width', 'height')).toEqual(['-10', '-10', '20', '20']);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'background:tile' });
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^edge:|flowIndex/ });
  });
});
