// Rendering only the Nodes and Edges in sight (ADR 0015). jsdom has no layout: Nodes are placed from their Declared
// sizes, and the Flow from its declared size, 600 × 400 with no margin, so what is in sight is exactly x 0–600, y 0–400.
import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { afterEach, describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';

const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  size: { width: 100, height: 50 },
  ports: [
    { id: 'in', side: 'left' },
    { id: 'out', side: 'right' },
  ],
  data: null,
  ...fields,
});

// a is in sight; b and c are out of it, beside and below; d is far off.
const state: FlowState = {
  nodes: [node('a', 0, 0), node('b', 1000, 0), node('c', 0, 1000), node('d', 2000, 2000)],
  edges: [
    // From a, in sight, to b, out of it.
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null },
    // Between two Nodes out of sight, its line crossing the Flow.
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' }, data: null },
    // Wholly out of sight.
    { id: 'bd', source: { node: 'b', port: 'out' }, target: { node: 'd', port: 'in' }, data: null },
  ],
};

function editor(initial: FlowState = state, options: EditorOptions = {}) {
  const result = renderEditor(initial, {
    ...options,
    flow: { width: 600, height: 400, onlyRenderVisible: { margin: 0 }, ...options.flow },
  });
  flush();
  const rendered = () =>
    [...result.container.querySelectorAll('[data-flow-node]')].map((element) => element.getAttribute('data-flow-node'));
  const drawn = () =>
    [...result.container.querySelectorAll('[data-flow-edge]:has(.slp-flow-edge-path)')].map((element) =>
      element.getAttribute('data-flow-edge'),
    );
  const pan = (x: number, y: number) => {
    result.api().setViewport({ x, y, zoom: 1 });
    flush();
  };
  const key = (key: string, modifiers: { shiftKey?: boolean } = {}) => {
    const target = document.activeElement ?? result.root();
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));
    flush();
  };
  return { ...result, rendered, drawn, pan, key };
}

afterEach(() => {
  for (const element of document.querySelectorAll('[data-test-outside]')) element.remove();
});

describe('Nodes', () => {
  test('off by default: every Node is rendered', () => {
    const { rendered } = editor(state, { flow: { onlyRenderVisible: undefined } });
    expect(rendered()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('only the Nodes in sight are rendered, and panning renders those coming into it', () => {
    const { rendered, pan } = editor();
    expect(rendered()).toEqual(['a']);
    pan(-950, 0);
    expect(rendered()).toEqual(['b']);
    pan(0, -950);
    expect(rendered()).toEqual(['c']);
    pan(-1500, -1900);
    expect(rendered()).toEqual(['d']);
  });

  test('the margin renders Nodes that close to the Flow too', () => {
    const { rendered } = editor(state, { flow: { onlyRenderVisible: { margin: 400 } } });
    expect(rendered()).toEqual(['a', 'b']);
  });

  test('zooming out renders more', () => {
    const { rendered, api } = editor(state, { flow: { minZoom: 0.1 } });
    api().setViewport({ x: 0, y: 0, zoom: 0.15 });
    flush();
    expect(rendered()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a Node with no size yet is placed by its position', () => {
    const { rendered } = editor({
      nodes: [node('near', 590, 390, { size: undefined }), node('far', 601, 0, { size: undefined })],
      edges: [],
    });
    expect(rendered()).toEqual(['near']);
  });

  test('a nested Node is placed through its Parent', () => {
    const { rendered } = editor({
      nodes: [node('group', 550, 0, { size: { width: 300, height: 300 } }), node('child', 100, 100, { parent: 'group' })],
      edges: [],
    });
    expect(rendered()).toEqual(['group']);
  });

  test('selected Nodes stay rendered out of sight', () => {
    const { rendered, setState } = editor();
    setState((draft) => {
      draft.nodes[2]!.selected = true;
    });
    flush();
    expect(rendered()).toEqual(['a', 'c']);
  });

  test('the focused Node stays rendered until focus leaves it', () => {
    const { rendered, pan, nodeElement, root } = editor();
    nodeElement('a').focus();
    pan(-950, 0);
    expect(rendered()).toEqual(['a', 'b']);
    expect(document.activeElement).toBe(nodeElement('a'));
    root().focus();
    flush();
    expect(rendered()).toEqual(['b']);
  });

  test('the Node a Connection starts from stays rendered', () => {
    const { rendered, pan, container, key } = editor(state, {
      content: () => (
        <div>
          <Port id="in" side="left" />
          <Port id="out" side="right" />
        </div>
      ),
    });
    container.querySelector<HTMLElement>('[data-flow-node="a"] [data-flow-port="out"]')!.focus();
    key('Enter');
    pan(-950, 0);
    expect(rendered()).toEqual(['a', 'b']);
  });

  test('a Node out of sight keeps what its rendered Ports said', () => {
    const { pan, api } = editor(
      { nodes: [node('a', 0, 0, { ports: undefined })], edges: [] },
      {
        content: () => <Port id="sink" side="top" kind="target" max={2} />,
      },
    );
    expect(api().port('a', 'sink')).toMatchObject({ side: 'top', kind: 'target', max: 2 });
    pan(-2000, 0);
    expect(api().port('a', 'sink')).toEqual({ side: 'top', kind: 'target', max: 2 });
  });

  test('a Node removed out of sight forgets its Ports', async () => {
    const { pan, api, setState } = editor(
      { nodes: [node('a', 0, 0, { ports: undefined })], edges: [] },
      {
        content: () => <Port id="sink" kind="target" />,
      },
    );
    pan(-2000, 0);
    setState((draft) => {
      draft.nodes.pop();
    });
    flush();
    await Promise.resolve();
    expect(api().port('a', 'sink')).toBeUndefined();
  });

  test('panning re-runs only the Nodes coming into sight and leaving it', async () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`n${i}`, (i % 10) * 250, Math.floor(i / 10) * 250));
    const { pan, rendered } = editor({ nodes, edges: [] });
    expect(rendered()).toHaveLength(3 * 2);
    const { artifact } = await captureArtifact(() => pan(-250, 0), { scenario: 'pan-only-visible' });
    expect(rendered()).toHaveLength(3 * 2);
    expect(artifact).toHaveNoDiagnostics();
    // Nodes near it only check whether they are in sight; Nodes far from it don't even do that.
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^node:n(1|2|11|12):(?!shown)/ });
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^node:n4\d:/ });
  });
});

describe('Edges', () => {
  test('only Edges whose line is in sight are drawn', () => {
    const { drawn, pan } = editor();
    expect(drawn()).toEqual(['ab', 'bc']);
    pan(-1500, -1900);
    expect(drawn()).toEqual(['bd']);
  });

  test('a selected Edge stays drawn out of sight', () => {
    const { drawn, setState } = editor();
    setState((draft) => {
      draft.edges[2]!.selected = true;
    });
    flush();
    expect(drawn()).toEqual(['ab', 'bc', 'bd']);
  });

  test('the focused Edge stays drawn until focus leaves it', () => {
    const { drawn, pan, edgeElement, root } = editor();
    edgeElement('ab')!.focus();
    flush();
    pan(-3000, -3000);
    expect(drawn()).toEqual(['ab']);
    root().focus();
    flush();
    expect(drawn()).toEqual([]);
  });
});

describe('the keyboard', () => {
  test('Tab to a Node out of sight pans to it, centred, and focuses it', () => {
    const { nodeElement, key, api, rendered } = editor(state, { content: (record) => <div>{record.id}</div> });
    nodeElement('a').focus();
    key('Tab');
    expect(document.activeElement).toBe(nodeElement('b'));
    expect(api().viewport()).toEqual({ x: 300 - 1050, y: 200 - 25, zoom: 1 });
    expect(rendered()).toEqual(['b']);
    key('Tab');
    expect(document.activeElement).toBe(nodeElement('c'));
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(nodeElement('b'));
  });

  test('Tab goes through the Edges out of sight too', () => {
    const { nodeElement, edgeElement, key, pan } = editor(state, { content: (record) => <div>{record.id}</div> });
    pan(-1500, -1900);
    nodeElement('d').focus();
    key('Tab');
    expect(document.activeElement).toBe(edgeElement('ab'));
    key('Tab');
    key('Tab');
    expect(document.activeElement).toBe(edgeElement('bd'));
  });

  test('Tab skips a Node out of sight the app renders nothing for', () => {
    const { nodeElement, key } = editor(state, {
      content: (record) => <div>{record.id}</div>,
      node: (record) => (record.id === 'b' ? { id: 'missing' } : {}),
    });
    nodeElement('a').focus();
    key('Tab');
    expect(document.activeElement).toBe(nodeElement('c'));
  });

  test('a keyboard Connection reaches Ports on Nodes out of sight', () => {
    const { container, key, nodeElement, batches } = editor(state, {
      content: () => (
        <div>
          <Port id="in" side="left" />
          <Port id="out" side="right" />
        </div>
      ),
    });
    container.querySelector<HTMLElement>('[data-flow-node="a"] [data-flow-port="out"]')!.focus();
    key('Enter');
    key('Tab');
    expect(document.activeElement).toBe(nodeElement('b').querySelector('[data-flow-port="in"]'));
    key('Enter');
    expect(batches.at(-1)!.changes[0]).toMatchObject({
      type: 'connect',
      edge: { source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
    });
  });
});
