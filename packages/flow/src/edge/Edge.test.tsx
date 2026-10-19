import { captureArtifact } from '@solidjs/diagnostics';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { render } from '../../test/render';
import { applyChanges } from '../changes/apply';
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
