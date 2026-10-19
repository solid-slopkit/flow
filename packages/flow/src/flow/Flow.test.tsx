import { captureArtifact } from '../../test/capture';
import { createSignal, flush } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';

import { render } from '../../test/render';
import type { Batch } from '../changes/changes';
import type { FlowState } from '../model/model';
import type { Viewport } from '../viewport/viewport';
import { Flow, useFlow, type FlowApi } from './Flow';

const empty: FlowState = { nodes: [], edges: [] };
const sized: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, data: null },
    { id: 'b', position: { x: 300, y: 100 }, size: { width: 100, height: 100 }, data: null },
    { id: 'unsized', position: { x: 5000, y: 5000 }, data: null },
  ],
  edges: [],
};

/** Renders a Flow and hands back its API, read by a child. */
function renderFlow(props: Partial<Parameters<typeof Flow>[0]> = {}) {
  let api!: FlowApi;
  const Probe = () => {
    api = useFlow();
    return null;
  };
  const result = render(() => (
    <Flow state={empty} {...props}>
      <Probe />
      {props.children}
    </Flow>
  ));
  flush();
  const root = result.container.querySelector<HTMLElement>('.slp-flow')!;
  const layer = (name: string) => root.querySelector<HTMLElement>(`.slp-flow-${name}`)!;
  return { ...result, api: () => api, root, layer };
}

describe('<Flow>', () => {
  test('renders the Node layer between the SVG Edge layer and the label layer, then the Connection and the guides, under one transform', () => {
    const { root, layer } = renderFlow({ children: <p>content</p> });
    const viewport = layer('viewport');
    expect([...viewport.children].map((child) => child.getAttribute('class'))).toEqual([
      'slp-flow-edges',
      'slp-flow-nodes',
      'slp-flow-labels',
      'slp-flow-connection',
      'slp-flow-guides',
    ]);
    expect(layer('edges').tagName).toBe('svg');
    expect(layer('nodes')).toHaveTextContent('content');
    expect(viewport.style.transform).toBe('translate(0px, 0px) scale(1)');
    expect(root.parentElement).toBeTruthy();
  });

  test('takes a class, a style and a declared size', () => {
    const { root } = renderFlow({ class: 'editor', style: { 'border-width': '1px' }, width: 300, height: 200 });
    expect(root).toHaveClass('slp-flow', 'editor');
    expect(root.style.width).toBe('300px');
    expect(root.style.height).toBe('200px');
    expect(root.style.borderWidth).toBe('1px');
  });

  test('each Flow has its own context', () => {
    const seen: FlowApi[] = [];
    const Probe = () => {
      seen.push(useFlow());
      return null;
    };
    render(() => (
      <>
        <Flow state={empty} defaultViewport={{ x: 1, y: 0, zoom: 1 }}>
          <Probe />
        </Flow>
        <Flow state={sized} defaultViewport={{ x: 2, y: 0, zoom: 1 }}>
          <Probe />
        </Flow>
      </>
    ));
    expect(seen.map((api) => [api.viewport().x, api.state().nodes.length])).toEqual([
      [1, 0],
      [2, 3],
    ]);
  });

  test('useFlow outside a Flow throws', () => {
    const Probe = () => {
      useFlow();
      return null;
    };
    expect(() => render(() => <Probe />)).toThrow();
  });

  test('indexes the state', () => {
    const { api } = renderFlow({ state: sized });
    expect(api().index().node('b')?.position).toEqual({ x: 300, y: 100 });
  });

  test('emit sends Batches to onChange, unless read-only', () => {
    const onChange = vi.fn();
    const batch: Batch = { changes: [{ type: 'select', item: 'node', id: 'a', from: false, to: true }] };
    renderFlow({ onChange }).api().emit(batch);
    expect(onChange).toHaveBeenCalledWith(batch);

    const readOnly = vi.fn();
    const { api } = renderFlow({ onChange: readOnly, interactive: false });
    api().emit(batch);
    expect(api().interactive()).toBe(false);
    expect(readOnly).not.toHaveBeenCalled();
  });

  test('createId defaults to random UUIDs and can be replaced', () => {
    expect(renderFlow().api().createId()).toMatch(/^[0-9a-f-]{36}$/);
    let next = 0;
    expect(
      renderFlow({ createId: () => `n${++next}` })
        .api()
        .createId(),
    ).toBe('n1');
  });
});

describe('Viewport', () => {
  test('uncontrolled: starts at defaultViewport, moves with setViewport and reports changes', () => {
    const onViewportChange = vi.fn();
    const { api, layer } = renderFlow({ defaultViewport: { x: 10, y: 20, zoom: 1.5 }, onViewportChange });
    expect(layer('viewport').style.transform).toBe('translate(10px, 20px) scale(1.5)');
    api().setViewport({ x: -5, y: 0, zoom: 1 });
    flush();
    expect(layer('viewport').style.transform).toBe('translate(-5px, 0px) scale(1)');
    expect(onViewportChange).toHaveBeenCalledWith({ x: -5, y: 0, zoom: 1 });
    api().setViewport({ x: -5, y: 0, zoom: 1 });
    expect(onViewportChange).toHaveBeenCalledTimes(1);
  });

  test('controlled: shows the viewport prop and only reports changes', () => {
    const [viewport, setViewport] = createSignal<Viewport>({ x: 0, y: 0, zoom: 1 });
    const onViewportChange = vi.fn();
    const { api, layer } = renderFlow({
      get viewport() {
        return viewport();
      },
      onViewportChange,
    });
    api().setViewport({ x: 50, y: 0, zoom: 1 });
    flush();
    expect(onViewportChange).toHaveBeenCalledWith({ x: 50, y: 0, zoom: 1 });
    expect(layer('viewport').style.transform).toBe('translate(0px, 0px) scale(1)');
    setViewport({ x: 7, y: 8, zoom: 2 });
    flush();
    expect(layer('viewport').style.transform).toBe('translate(7px, 8px) scale(2)');
    expect(api().viewport()).toEqual({ x: 7, y: 8, zoom: 2 });
  });

  test('clamps the zoom to minZoom and maxZoom', () => {
    const { api } = renderFlow({ minZoom: 0.25, maxZoom: 4, defaultViewport: { x: 0, y: 0, zoom: 10 } });
    expect(api().viewport().zoom).toBe(4);
    api().setViewport({ x: 0, y: 0, zoom: 0.01 });
    flush();
    expect(api().viewport().zoom).toBe(0.25);
    expect(api().zoomLimits()).toEqual({ minZoom: 0.25, maxZoom: 4 });
  });

  test('zoomTo keeps the point under the given screen point in place, by default the centre', () => {
    const { api, root } = renderFlow({ width: 400, height: 200 });
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 400, 200));
    api().zoomTo(2);
    flush();
    expect(api().viewport()).toEqual({ x: -200, y: -100, zoom: 2 });
    const before = api().screenToFlow({ x: 150, y: 70 });
    api().zoomTo(1.5, { x: 150, y: 70 });
    flush();
    expect(api().screenToFlow({ x: 150, y: 70 })).toEqual(before);
  });

  test('zoomIn and zoomOut step by 1.2, within the limits', () => {
    const { api } = renderFlow({ width: 100, height: 100 });
    api().zoomIn();
    api().zoomIn();
    expect(api().viewport().zoom).toBeCloseTo(1.44);
    api().zoomOut();
    expect(api().viewport().zoom).toBeCloseTo(1.2);
    for (let i = 0; i < 20; i++) api().zoomIn();
    expect(api().viewport().zoom).toBe(2);
  });

  test('converts between screen and Flow coordinates', () => {
    const { api, root } = renderFlow({ defaultViewport: { x: 20, y: 10, zoom: 2 } });
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 400, 200));
    expect(api().screenToFlow({ x: 140, y: 80 })).toEqual({ x: 10, y: 10 });
    expect(api().flowToScreen({ x: 10, y: 10 })).toEqual({ x: 140, y: 80 });
  });

  test('a Viewport change re-runs only the transform', async () => {
    const { api } = renderFlow({ state: sized });
    const { artifact } = await captureArtifact(() => api().setViewport({ x: 30, y: 0, zoom: 1 }), {
      scenario: 'viewport-change',
    });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1);
    expect(artifact).toStayWithinRerunBudget(1, { scope: /style:transform/ });
    expect(artifact.attribution!.reruns.map((rerun) => rerun.nodeName)).toEqual([expect.stringMatching(/style:transform/)]);
  });
});

describe('fitView', () => {
  test('with a declared size, fits while rendering', () => {
    const { api } = renderFlow({ state: sized, width: 448, height: 248, fitView: true });
    // Bounds 400 × 200 at (0, 0); 24px padding leaves exactly 400 × 200.
    expect(api().viewport()).toEqual({ x: 24, y: 24, zoom: 1 });
  });

  test('takes padding and a subset of Nodes, and stays within the zoom limits', () => {
    const { api } = renderFlow({ state: sized, width: 200, height: 200, fitView: { padding: 0, nodes: ['a'] } });
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 2 });
    api().fitView({ padding: 0 });
    flush();
    expect(api().viewport()).toEqual({ x: 0, y: 50, zoom: 0.5 });
  });

  test('fitBounds shows a box whole and centred', () => {
    const { api } = renderFlow({ width: 200, height: 100 });
    api().fitBounds({ x: 100, y: 100, width: 100, height: 100 }, { padding: 0 });
    flush();
    expect(api().viewport()).toEqual({ x: -50, y: -100, zoom: 1 });
  });

  test('does nothing without sized Nodes', () => {
    const { api } = renderFlow({ width: 200, height: 100, fitView: true, defaultViewport: { x: 3, y: 4, zoom: 1 } });
    expect(api().viewport()).toEqual({ x: 3, y: 4, zoom: 1 });
    api().fitView();
    expect(api().viewport()).toEqual({ x: 3, y: 4, zoom: 1 });
  });
});
