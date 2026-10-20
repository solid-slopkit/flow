import { captureArtifact } from '../../test/capture';
import { flush, snapshot } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { render } from '../../test/render';
import { applyChanges } from '../changes/apply';
import { layout } from '../layout/layout';
import type { FlowNode, FlowState } from '../model/model';
import { Edge, EdgePath, useEdge } from './Edge';
import { straightShape } from './shapes';

const node = (id: string, x: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y: 0 },
  size: { width: 100, height: 50 },
  ports: [
    { id: 'in', side: 'left' },
    { id: 'out', side: 'right' },
  ],
  data: null,
  ...fields,
});

const state: FlowState = {
  nodes: [node('a', 0), node('b', 300), node('c', 600)],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'straight', data: null },
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' }, shape: 'straight', data: null },
  ],
};

function editor(initial: FlowState = state, options: Parameters<typeof renderEditor>[1] = {}) {
  const result = renderEditor(initial, options);
  flush();
  const path = (id: string) => result.edgeElement(id)?.querySelector('.slp-flow-edge-path')?.getAttribute('d');
  const label = (id: string) => result.container.querySelector<HTMLElement>(`[data-flow-edge-label="${id}"]`);
  return { ...result, path, label };
}

describe('<Edge>', () => {
  test('draws an SVG path in the Edge layer, between its Ports', () => {
    const { edgeElement, root, path } = editor();
    expect(edgeElement('ab')).toBeInstanceOf(SVGGElement);
    expect(edgeElement('ab')!.parentElement).toBe(root().querySelector('svg.slp-flow-edges'));
    expect(path('ab')).toBe('M 100 25 L 300 25');
    expect(path('bc')).toBe('M 400 25 L 600 25');
  });

  test('takes its shape from the record, else bezier; a prop overrides it with a name or a function', () => {
    const edges = [
      { ...state.edges[0]!, shape: undefined },
      { ...state.edges[1]!, shape: 'step' as const },
    ];
    const { path } = editor(
      { ...state, edges },
      { edge: (edge) => (edge.id === 'bc' ? { shape: (s, t) => ({ d: `custom ${s.x} ${t.x}`, label: s }) } : {}) },
    );
    expect(path('ab')).toBe('M 100 25 C 200 25 200 25 300 25');
    expect(path('bc')).toBe('custom 400 600');

    const named = editor({ ...state, edges }, { edge: () => ({ shape: 'straight' }) });
    expect(named.path('bc')).toBe('M 400 25 L 600 25');
  });

  test('passes the shape a context with the Edge and Node geometry', () => {
    let seen: unknown;
    editor(state, {
      edge: () => ({
        shape: (source, target, context) => {
          seen = { edge: context?.edge.id, bounds: context?.nodeBounds('c') };
          return straightShape(source, target);
        },
      }),
    });
    expect(seen).toEqual({ edge: 'bc', bounds: { x: 600, y: 0, width: 100, height: 50 } });
  });

  test('Floating ends attach to the Node outlines', () => {
    const { path } = editor({
      ...state,
      edges: [{ id: 'ab', source: { node: 'a' }, target: { node: 'b' }, shape: 'straight', data: null }],
    });
    expect(path('ab')).toBe('M 100 25 L 300 25');
  });

  test('draws nothing until both ends can be placed', () => {
    const { edgeElement, path } = editor({
      nodes: [node('a', 0), node('b', 300, { size: undefined })],
      edges: [state.edges[0]!],
    });
    expect(edgeElement('ab')).not.toBeNull();
    expect(path('ab')).toBeUndefined();
  });

  test('flags Selection, takes its class and style', () => {
    const { edgeElement } = editor(
      { ...state, edges: [{ ...state.edges[0]!, selected: true }, state.edges[1]!] },
      { edge: () => ({ class: 'flow', style: { color: 'red' } }) },
    );
    expect(edgeElement('ab')).toHaveAttribute('data-selected');
    expect(edgeElement('bc')).not.toHaveAttribute('data-selected');
    expect(edgeElement('ab')).toHaveClass('slp-flow-edge', 'flow');
    expect(edgeElement('ab')!.style.color).toBe('red');
  });

  test('leaves the layer when its record is removed', () => {
    const { edgeElement, setState } = editor();
    applyChanges(setState, { changes: [{ type: 'remove', nodes: [], edges: [state.edges[0]!] }] });
    flush();
    expect(edgeElement('ab')).toBeNull();
    expect(edgeElement('bc')).not.toBeNull();
  });

  test('outside a Flow throws', () => {
    expect(() => render(() => <Edge id="ab" />)).toThrow();
  });

  test('mounting draws each Edge once, from the declared geometry', async () => {
    const { result, artifact } = await captureArtifact(() => editor(), { scenario: 'mount' });
    expect(result.path('ab')).toBe('M 100 25 L 300 25');
    expect(result.root().querySelectorAll('svg.slp-flow-edges > g')).toHaveLength(2);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^edge:/ });
  });

  test('moving a Node redraws only its Edges', async () => {
    const { setState, path } = editor();
    const { artifact } = await captureArtifact(
      () => applyChanges(setState, { changes: [{ type: 'move', node: 'c', from: { x: 600, y: 0 }, to: { x: 600, y: 100 } }] }),
      { scenario: 'move-node' },
    );
    expect(path('bc')).toBe('M 400 25 L 600 125');
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /edge:ab/ });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'flowIndex' });
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'edge:bc:ends' });
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'edge:bc:geometry' });
  });
});

describe('custom Edges', () => {
  test('children replace the default path and read the path, label point and state through useEdge', () => {
    const Custom = () => {
      const edge = useEdge();
      return (
        <>
          <path class="mine" d={edge.geometry()?.d} data-selected={edge.selected() ? '' : undefined} />
          <circle cx={edge.geometry()?.label.x} cy={edge.geometry()?.label.y} r="3" />
          <text>{`${edge.id()} ${edge.edge()?.source.node} ${edge.source()?.side} ${edge.target()?.side}`}</text>
        </>
      );
    };
    const { edgeElement } = editor(
      { ...state, edges: [{ ...state.edges[0]!, selected: true }] },
      {
        edge: () => ({
          get children() {
            return <Custom />;
          },
        }),
      },
    );
    const g = edgeElement('ab')!;
    expect(g.querySelector('.slp-flow-edge-path')).toBeNull();
    expect(g.querySelector('path.mine')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(g.querySelector('path.mine')).toHaveAttribute('d', 'M 100 25 L 300 25');
    expect(g.querySelector('path.mine')).toHaveAttribute('data-selected');
    expect(g.querySelector('circle')).toHaveAttribute('cx', '200');
    expect(g.querySelector('text')).toHaveTextContent('ab a right left');
  });

  test('EdgePath draws the default line inside a custom Edge', () => {
    const { path, edgeElement } = editor(state, {
      edge: () => ({
        markerEnd: 'arrow',
        get children() {
          return (
            <>
              <EdgePath class="thick" />
              <circle r="2" />
            </>
          );
        },
      }),
    });
    expect(path('ab')).toBe('M 100 25 L 300 25');
    expect(edgeElement('ab')!.querySelector('.slp-flow-edge-path')).toHaveClass('thick');
    expect(edgeElement('ab')!.querySelector('.slp-flow-edge-path')!.getAttribute('marker-end')).toMatch(/^url\(#.+-end\)$/);
  });

  test('useEdge outside an Edge throws', () => {
    const Label = () => <span>{useEdge().id()}</span>;
    expect(() => render(() => <Label />)).toThrow();
  });
});

describe('markers', () => {
  test('are defined inside the Edge and referenced by its path', () => {
    const { edgeElement } = editor(state, {
      edge: () => ({ markerStart: 'arrow', markerEnd: { type: 'arrow-closed', size: 12 } }),
    });
    const g = edgeElement('ab')!;
    const line = g.querySelector('.slp-flow-edge-path')!;
    const start = g.querySelector<SVGMarkerElement>('marker[data-marker="arrow"]')!;
    const end = g.querySelector<SVGMarkerElement>('marker[data-marker="arrow-closed"]')!;
    expect(line.getAttribute('marker-start')).toBe(`url(#${start.id})`);
    expect(line.getAttribute('marker-end')).toBe(`url(#${end.id})`);
    expect(start).toHaveAttribute('markerWidth', '8');
    expect(end).toHaveAttribute('markerWidth', '12');
    expect(start).toHaveAttribute('orient', 'auto-start-reverse');
    // Unique per Edge, so several Edges and Flows share a page.
    const other = edgeElement('bc')!.querySelector('marker')!;
    expect(other.id).not.toBe(start.id);
  });

  test('none by default', () => {
    const { edgeElement } = editor();
    expect(edgeElement('ab')!.querySelector('marker')).toBeNull();
    expect(edgeElement('ab')!.querySelector('.slp-flow-edge-path')).not.toHaveAttribute('marker-end');
  });
});

describe('labels', () => {
  test('are HTML in the label layer, centred on the label point, with the Edge’s context', () => {
    const Text = () => <button>{useEdge().id()}</button>;
    const { label, root } = editor(state, {
      edge: (edge) =>
        edge.id === 'ab'
          ? {
              get label() {
                return <Text />;
              },
            }
          : {},
    });
    expect(label('ab')!.parentElement).toBe(root().querySelector('.slp-flow-labels'));
    expect(label('ab')!.style.transform).toBe('translate(200px, 25px) translate(-50%, -50%)');
    expect(label('ab')!.querySelector('button')).toHaveTextContent('ab');
    expect(label('bc')).toBeNull();
  });

  test('none for an empty label', () => {
    const { label } = editor(state, { edge: (edge) => ({ label: edge.id === 'ab' ? undefined : false }) });
    expect(label('ab')).toBeNull();
    expect(label('bc')).toBeNull();
  });

  test('follow the Edge', async () => {
    const { artifact } = await captureArtifact(
      () => {
        const { label, setState } = editor(state, { edge: () => ({ label: 'x' }) });
        applyChanges(setState, { changes: [{ type: 'move', node: 'b', from: { x: 300, y: 0 }, to: { x: 300, y: 100 } }] });
        flush();
        expect(label('ab')!.style.transform).toBe('translate(200px, 75px) translate(-50%, -50%)');
      },
      { scenario: 'label' },
    );
    expect(artifact).toHaveNoDiagnostics();
  });
});

describe('routed step Edges', () => {
  // A Node in the line between a and b, and an Edge from it to d.
  const routed: FlowState = {
    nodes: [node('a', 0), node('b', 400), node('c', 200), node('d', 600, { position: { x: 600, y: 300 } })],
    edges: [
      { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'routed-step', data: null },
      { id: 'cd', source: { node: 'c', port: 'out' }, target: { node: 'd', port: 'in' }, shape: 'routed-step', data: null },
    ],
  };
  const corners = (d: string | null | undefined) =>
    d!
      .slice(2)
      .split(' L ')
      .map((pair) => pair.split(' ').map(Number) as [number, number]);
  /** Whether a path runs through a Node's box. */
  const crosses = (d: string | null | undefined, box: { x: number; y: number; width: number; height: number }) =>
    corners(d)
      .slice(1)
      .some(([x2, y2], i) => {
        const [x1, y1] = corners(d)[i]!;
        return y1 === y2
          ? y1 > box.y && y1 < box.y + box.height && Math.min(x1, x2) < box.x + box.width && Math.max(x1, x2) > box.x
          : x1 > box.x && x1 < box.x + box.width && Math.min(y1, y2) < box.y + box.height && Math.max(y1, y2) > box.y;
      });
  const c = { x: 200, y: 0, width: 100, height: 50 };

  test('go round the Nodes in their way', () => {
    const { path } = editor(routed);
    expect(path('ab')).not.toBe('M 100 25 L 400 25');
    expect(crosses(path('ab'), c)).toBe(false);
    expect(corners(path('ab'))[0]).toEqual([100, 25]);
    expect(corners(path('ab')).at(-1)).toEqual([400, 25]);
  });

  test('are the step line when nothing is in the way', () => {
    const { path } = editor({ ...routed, nodes: routed.nodes.filter((n) => n.id !== 'c'), edges: [routed.edges[0]!] });
    expect(path('ab')).toBe('M 100 25 L 400 25');
  });

  test('don’t go round the Parents of their ends', () => {
    const group = node('g', 0, { position: { x: -50, y: -100 }, size: { width: 600, height: 300 }, ports: [] });
    const nested = (n: FlowNode) => ({ ...n, parent: 'g', position: { x: n.position.x + 50, y: n.position.y + 100 } });
    const { path } = editor({ nodes: [group, nested(node('a', 0)), nested(node('b', 400))], edges: [routed.edges[0]!] });
    expect(path('ab')).toBe('M 100 25 L 400 25');
  });

  test('reroute when a Node moves out of the way, and leave other Edges alone', async () => {
    const { path, setState } = editor({
      ...routed,
      edges: [...routed.edges, { ...state.edges[0]!, id: 'ad', target: { node: 'd', port: 'in' } }],
    });
    const { artifact } = await captureArtifact(
      () => applyChanges(setState, { changes: [{ type: 'move', node: 'c', from: { x: 200, y: 0 }, to: { x: 200, y: -300 } }] }),
      { scenario: 'move-out-of-the-way' },
    );
    expect(path('ab')).toBe('M 100 25 L 400 25');
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'edge:ab:geometry' });
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'nodeBoxes' });
    // Not routed: it doesn't read the other Nodes.
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'edge:ad:geometry' });
  });

  test('while a Node is dragged, only its own Edges reroute; the others once the drag ends', async () => {
    const { path, nodeElement } = editor({
      ...routed,
      nodes: routed.nodes.map((n) => (n.id === 'c' ? { ...n, position: { x: 200, y: 200 } } : n)),
    });
    expect(path('ab')).toBe('M 100 25 L 400 25');
    const pointer = (type: string, target: Element, x: number, y: number) => {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y }),
      );
      flush();
    };
    const cd = path('cd');
    const { artifact } = await captureArtifact(
      () => {
        pointer('pointerdown', nodeElement('c'), 250, 225);
        for (let y = 125; y > 0; y -= 10) pointer('pointermove', nodeElement('c'), 250, y);
      },
      { scenario: 'drag-frames' },
    );
    // c now sits across the line from a to b, which stays as it was until the drag ends.
    expect(path('ab')).toBe('M 100 25 L 400 25');
    expect(path('cd')).not.toBe(cd);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'edge:ab:geometry' });
    expect(artifact).toStayWithinRerunBudget(13, { scope: 'edge:cd:geometry' });

    const { artifact: drop } = await captureArtifact(() => pointer('pointerup', nodeElement('c'), 250, 5), { scenario: 'drop' });
    expect(drop).toHaveNoDiagnostics();
    expect(drop).toStayWithinRerunBudget(1, { scope: 'edge:ab:geometry' });
    expect(crosses(path('ab'), { x: 200, y: -20, width: 100, height: 50 })).toBe(false);
    expect(path('ab')).not.toBe('M 100 25 L 400 25');
  });

  test('start from a Layout’s routes, until an end moves', async () => {
    const chain: FlowState = {
      nodes: [node('a', 0), node('b', 300), node('c', 600)],
      edges: [
        routed.edges[0]!,
        { ...routed.edges[0]!, id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
      ],
    };
    const { path, setState, state: live } = editor(chain);
    const batch = await layout(snapshot(live) as FlowState);
    applyChanges(setState, batch);
    flush();
    const route = (id: string) => live.edges.find((e) => e.id === id)!.route!;
    const drawn = (points: { x: number; y: number }[]) => `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
    expect(path('ab')).toBe(drawn(route('ab')));
    expect(path('bc')).toBe(drawn(route('bc')));

    const c = live.nodes.find((n) => n.id === 'c')!.position;
    applyChanges(setState, { changes: [{ type: 'move', node: 'c', from: { ...c }, to: { x: c.x, y: c.y + 100 } }] });
    flush();
    // bc's end moved: routed afresh; ab is untouched and keeps its route.
    expect(path('bc')).not.toBe(drawn(route('bc')));
    expect(path('ab')).toBe(drawn(route('ab')));
  });
});
