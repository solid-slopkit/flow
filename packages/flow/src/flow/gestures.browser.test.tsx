// Pan and zoom with real input: CDP sends trusted mouse, wheel and touch events, so pointer capture and touch
// Pointer Events behave as in a page.
import { captureArtifact } from '@solidjs/diagnostics';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { drag, mouse, settle, touches, wheel } from '../../test/input';
import { render } from '../../test/render';
import type { FlowState } from '../model/model';
import type { Viewport } from '../viewport/viewport';
import { Flow, useFlow, type FlowApi, type FlowProps } from './Flow';

const state: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, data: null },
    { id: 'b', position: { x: 300, y: 100 }, size: { width: 100, height: 100 }, data: null },
  ],
  edges: [],
};

async function renderFlow(props: Partial<FlowProps> = {}) {
  let api!: FlowApi;
  const Probe = () => {
    api = useFlow();
    return null;
  };
  const { container } = render(() => (
    <Flow state={state} style={{ width: '400px', height: '300px' }} {...props}>
      <Probe />
      <div data-testid="content" style={{ position: 'absolute', left: '0px', top: '0px', width: '50px', height: '50px' }} />
    </Flow>
  ));
  await settle();
  const root = container.querySelector<HTMLElement>('.slp-flow')!;
  const rect = root.getBoundingClientRect();
  // Screen points relative to the Flow's top-left corner.
  const at = (x: number, y: number) => ({ x: rect.left + x, y: rect.top + y });
  return { api: () => api, root, at };
}

describe('panning', () => {
  test('dragging empty space pans, following the pointer outside the Flow', async () => {
    const { api, at, root } = await renderFlow();
    await drag(at(200, 150), at(220, 160), at(500, 400));
    expect(api().viewport()).toEqual({ x: 300, y: 250, zoom: 1 });
    expect(root).not.toHaveAttribute('data-panning');
  });

  test('marks the Flow while panning', async () => {
    const { at, root } = await renderFlow();
    await mouse('mousePressed', at(200, 150));
    await mouse('mouseMoved', at(210, 150));
    expect(root).toHaveAttribute('data-panning');
    await mouse('mouseReleased', at(210, 150));
    expect(root).not.toHaveAttribute('data-panning');
  });

  test('dragging content in the Flow does not pan', async () => {
    const { api, at } = await renderFlow();
    await drag(at(25, 25), at(100, 100));
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test('the right mouse button does not pan', async () => {
    const { api, at } = await renderFlow();
    await mouse('mousePressed', at(200, 150), { button: 'right', buttons: 2 });
    await mouse('mouseMoved', at(250, 150), { button: 'right', buttons: 2 });
    await mouse('mouseReleased', at(250, 150), { button: 'right', buttons: 0 });
    await settle();
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test('each pointer move re-runs only the transform', async () => {
    const { at } = await renderFlow();
    const { artifact } = await captureArtifact(
      async () => {
        await mouse('mousePressed', at(200, 150));
        for (let i = 1; i <= 3; i++) {
          await mouse('mouseMoved', at(200 + i * 10, 150));
          flush();
        }
        await mouse('mouseReleased', at(230, 150));
      },
      { scenario: 'pan' },
    );
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(3);
    expect(artifact).toStayWithinRerunBudget(3, { scope: /style:transform/ });
  });
});

describe('wheel', () => {
  test('zooms around the pointer', async () => {
    const { api, at } = await renderFlow();
    const pointer = at(100, 80);
    const before = api().screenToFlow(pointer);
    await wheel(pointer, 100);
    expect(api().viewport().zoom).toBeCloseTo(2 ** -0.2);
    expect(api().screenToFlow(pointer).x).toBeCloseTo(before.x);
    expect(api().screenToFlow(pointer).y).toBeCloseTo(before.y);
    await wheel(pointer, -200);
    expect(api().viewport().zoom).toBeCloseTo(2 ** 0.2);
  });

  test('with scrollPans, scrolls the Viewport; Ctrl + wheel still zooms', async () => {
    const { api, at } = await renderFlow({ scrollPans: true });
    await wheel(at(100, 80), 40, 10);
    expect(api().viewport()).toEqual({ x: -10, y: -40, zoom: 1 });
    await wheel(at(100, 80), 10, 0, 2);
    expect(api().viewport().zoom).toBeCloseTo(2 ** -0.1);
  });

  test('stops the page from scrolling', async () => {
    const { at } = await renderFlow();
    let prevented = false;
    document.addEventListener('wheel', (event) => (prevented = event.defaultPrevented), { once: true });
    await wheel(at(100, 80), 100);
    expect(prevented).toBe(true);
  });
});

describe('pinch', () => {
  test('zooms by the fingers’ spread around their midpoint, and pans with it', async () => {
    const { api, at } = await renderFlow({ defaultViewport: { x: 0, y: 0, zoom: 0.5 } });
    const before = api().screenToFlow(at(200, 150));
    await touches('touchStart', [at(150, 150), at(250, 150)]);
    await touches('touchMove', [at(110, 160), at(310, 160)]);
    await settle();
    const viewport: Viewport = api().viewport();
    expect(viewport.zoom).toBeCloseTo(1);
    // The Flow point that was under the midpoint followed it, 10px down.
    const after = api().screenToFlow(at(210, 160));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    await touches('touchEnd', []);
  });
});

describe('size', () => {
  test('is measured in the page, and fitView without a declared size fits once measured', async () => {
    const { api } = await renderFlow({ fitView: { padding: 0 } });
    expect(api().size()).toEqual({ width: 400, height: 300 });
    // Bounds 400 × 200 fill the width at zoom 1, centred vertically.
    expect(api().viewport()).toEqual({ x: 0, y: 50, zoom: 1 });
  });

  test('follows the Flow being resized', async () => {
    const { api, root } = await renderFlow();
    root.style.width = '200px';
    await settle();
    expect(api().size()).toEqual({ width: 200, height: 300 });
  });
});
