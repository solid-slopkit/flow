import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { CLIPBOARD_TYPE, type ClipboardPayload } from '../clipboard/payload';
import type { FlowNode, FlowState } from '../model/model';

// jsdom has no layout: the Flow sits at the screen's origin, and Nodes are placed from their Declared sizes.
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

const state: FlowState = {
  nodes: [node('a', 0, 0), node('b', 300, 0), node('c', 300, 200)],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'straight', data: null },
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' }, shape: 'straight', data: null },
  ],
};

type Modifiers = { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean };

function editor(initial: FlowState = state, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(initial, { ...options, flow: { createId: () => `n${++ids}`, ...options.flow } });
  flush();
  const pointer = (type: string, target: Element, x: number, y: number, modifiers: Modifiers = {}) => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: x,
        clientY: y,
        ...modifiers,
      }),
    );
    flush();
  };
  const click = (target: Element, x: number, y: number, modifiers: Modifiers = {}) => {
    pointer('pointerdown', target, x, y, modifiers);
    pointer('pointerup', result.root(), x, y, modifiers);
  };
  const key = (key: string, modifiers: Modifiers = {}, target: Element = result.root()) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    flush();
    return event;
  };
  const clipboard = (type: 'copy' | 'cut' | 'paste', data: Record<string, string> = {}, target: Element = result.root()) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        setData: (format: string, value: string) => (data[format] = value),
        getData: (format: string) => data[format] ?? '',
      },
    });
    target.dispatchEvent(event);
    flush();
    return { event, data };
  };
  const hit = (id: string) => result.edgeElement(id)!.querySelector('.slp-flow-edge-hit')!;
  const selected = () => ({
    nodes: result.state.nodes.filter((record) => record.selected).map((record) => record.id),
    edges: result.state.edges.filter((record) => record.selected).map((record) => record.id),
  });
  return { ...result, pointer, click, key, clipboard, hit, selected };
}

describe('clicking', () => {
  test('a Node selects it alone; an Edge selects it alone', () => {
    const { click, nodeElement, hit, batches, selected } = editor();
    click(nodeElement('a').firstElementChild!, 50, 25);
    expect(batches).toEqual([{ changes: [{ type: 'select', item: 'node', id: 'a', from: false, to: true }] }]);
    click(hit('bc'), 300, 100);
    expect(batches[1]).toEqual({
      changes: [
        { type: 'select', item: 'node', id: 'a', from: true, to: false },
        { type: 'select', item: 'edge', id: 'bc', from: false, to: true },
      ],
    });
    expect(selected()).toEqual({ nodes: [], edges: ['bc'] });
  });

  test('Shift, Ctrl or Meta click adds to the Selection or takes an item out', () => {
    const { click, nodeElement, hit, selected } = editor();
    click(nodeElement('a'), 50, 25);
    click(nodeElement('b'), 350, 25, { shiftKey: true });
    click(hit('ab'), 200, 25, { metaKey: true });
    expect(selected()).toEqual({ nodes: ['a', 'b'], edges: ['ab'] });
    click(nodeElement('a'), 50, 25, { ctrlKey: true });
    expect(selected()).toEqual({ nodes: ['b'], edges: ['ab'] });
  });

  test('empty space clears the Selection; with a modifier it keeps it', () => {
    const { click, nodeElement, root, batches, selected } = editor();
    click(nodeElement('a'), 50, 25);
    click(nodeElement('b'), 350, 25, { shiftKey: true });
    click(root(), 500, 380, { metaKey: true });
    expect(selected().nodes).toEqual(['a', 'b']);
    click(root(), 500, 380);
    expect(selected().nodes).toEqual([]);
    // Nothing to clear: no Batch.
    const count = batches.length;
    click(root(), 500, 380);
    expect(batches).toHaveLength(count);
  });

  test('a drag is not a click, even back to where it started', () => {
    const { pointer, nodeElement, root, batches } = editor();
    pointer('pointerdown', nodeElement('a'), 50, 25);
    pointer('pointermove', nodeElement('a'), 90, 25);
    pointer('pointermove', nodeElement('a'), 50, 25);
    pointer('pointerup', root(), 50, 25);
    expect(batches.flatMap((batch) => batch.changes).some((change) => change.type === 'select')).toBe(false);
  });

  test('a click on an Edge label selects the Edge', () => {
    const { click, container, selected } = editor(state, { edge: (edge) => (edge.id === 'ab' ? { label: 'go' } : {}) });
    click(container.querySelector('[data-flow-edge-label="ab"]')!, 200, 25);
    expect(selected().edges).toEqual(['ab']);
  });

  test('Edges have a hit line only in an interactive Flow', () => {
    const readOnly = editor(state, { flow: { interactive: false } });
    expect(readOnly.edgeElement('ab')!.querySelector('.slp-flow-edge-hit')).toBeNull();
    const { hit } = editor();
    expect(hit('ab')).toHaveAttribute('d', 'M 100 25 L 300 25');
  });

  test('selecting a Node re-runs only that Node and no Edge', async () => {
    const { click, nodeElement } = editor();
    const { artifact } = await captureArtifact(() => click(nodeElement('b'), 350, 25), { scenario: 'select-node' });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'flowIndex' });
    // The one Node's attributes, and the live region's text.
    expect(artifact).toStayWithinRerunBudget(2);
  });
});

describe('the selection box', () => {
  test('Shift-dragging empty space selects the Nodes it overlaps and the Edges between them, in phases', () => {
    const { pointer, root, batches, selected, container } = editor();
    pointer('pointerdown', root(), 50, 300, { shiftKey: true });
    pointer('pointermove', root(), 60, 280, { shiftKey: true });
    const box = container.querySelector<HTMLElement>('.slp-flow-selection-box')!;
    expect(box.style.transform).toBe('translate(50px, 280px)');
    expect(box.style.width).toBe('10px');
    pointer('pointermove', root(), 320, 40, { shiftKey: true });
    expect(selected()).toEqual({ nodes: ['a', 'b', 'c'], edges: ['ab', 'bc'] });
    pointer('pointermove', root(), 320, 240, { shiftKey: true });
    pointer('pointerup', root(), 320, 240, { shiftKey: true });
    expect(selected()).toEqual({ nodes: ['c'], edges: [] });
    expect(batches.map((batch) => batch.phase)).toEqual(['start', 'update', 'update', 'end']);
    expect(container.querySelector('.slp-flow-selection-box')).toBeNull();
  });

  test('doesn’t pan; selectionMode full takes only Nodes wholly inside', () => {
    const { pointer, root, api, selected } = editor(state, { flow: { selectionMode: 'full' } });
    pointer('pointerdown', root(), 50, 300, { shiftKey: true });
    pointer('pointermove', root(), 350, 10, { shiftKey: true });
    expect(selected().nodes).toEqual([]);
    pointer('pointermove', root(), 410, 10, { shiftKey: true });
    pointer('pointerup', root(), 410, 10, { shiftKey: true });
    expect(selected().nodes).toEqual(['c']);
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test('replaces the Selection; with Ctrl or Meta too, adds to it', () => {
    const start: FlowState = { ...state, nodes: [node('a', 0, 0, { selected: true }), node('b', 300, 0), node('c', 300, 200)] };
    const replace = editor(start);
    replace.pointer('pointerdown', replace.root(), 290, 190, { shiftKey: true });
    replace.pointer('pointerup', replace.root(), 290, 190, { shiftKey: true });
    replace.pointer('pointerdown', replace.root(), 290, 190, { shiftKey: true });
    replace.pointer('pointermove', replace.root(), 310, 210, { shiftKey: true });
    replace.pointer('pointerup', replace.root(), 310, 210, { shiftKey: true });
    expect(replace.selected().nodes).toEqual(['c']);

    const add = editor(start);
    add.pointer('pointerdown', add.root(), 290, 190, { shiftKey: true, metaKey: true });
    add.pointer('pointermove', add.root(), 310, 210, { shiftKey: true, metaKey: true });
    add.pointer('pointerup', add.root(), 310, 210, { shiftKey: true, metaKey: true });
    expect(add.selected().nodes).toEqual(['a', 'c']);
  });

  test('works in Flow coordinates under the Viewport', () => {
    const { pointer, root, selected } = editor(state, { flow: { defaultViewport: { x: 100, y: 50, zoom: 2 } } });
    // Flow (290, 190) to (310, 210) is screen (680, 430) to (720, 470).
    pointer('pointerdown', root(), 680, 430, { shiftKey: true });
    pointer('pointermove', root(), 720, 470, { shiftKey: true });
    pointer('pointerup', root(), 720, 470, { shiftKey: true });
    expect(selected().nodes).toEqual(['c']);
  });

  test('moving the box re-runs only the box, and the Nodes whose Selection changes', async () => {
    const { pointer, root } = editor();
    pointer('pointerdown', root(), 50, 300, { shiftKey: true });
    pointer('pointermove', root(), 60, 290, { shiftKey: true });
    const { artifact } = await captureArtifact(
      () => {
        for (let y = 280; y > 220; y -= 10) pointer('pointermove', root(), 60, y, { shiftKey: true });
        pointer('pointermove', root(), 320, 210, { shiftKey: true });
      },
      { scenario: 'selection-box' },
    );
    pointer('pointerup', root(), 320, 210, { shiftKey: true });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    // Per move: the box's style alone; plus the three Nodes it takes on the last move.
    expect(artifact).toStayWithinRerunBudget(7 + 3);
  });
});

describe('the keyboard', () => {
  const selectedState: FlowState = {
    nodes: [
      node('a', 0, 0, { selected: true }),
      node('b', 300, 0),
      node('inner', 10, 10, { parent: 'a', selected: true }),
      node('pinned', 300, 200, { selected: true, draggable: false }),
    ],
    edges: [{ ...state.edges[0]!, selected: true }],
  };

  test('the Flow is focusable', () => {
    const { root } = editor();
    expect(root()).toHaveAttribute('tabindex', '0');
  });

  test('arrow keys move the selected Nodes, Shift by 10; nested and pinned Nodes stay put', () => {
    const { key, batches } = editor(selectedState);
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    key('ArrowUp', { shiftKey: true });
    expect(batches).toEqual([
      { changes: [{ type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }] },
      { changes: [{ type: 'move', node: 'a', from: { x: 1, y: 0 }, to: { x: 1, y: -10 } }] },
    ]);
  });

  test('Delete and Backspace remove the Selection with everything attached', () => {
    const { key, batches, state: flow } = editor(selectedState);
    key('Delete');
    expect(batches[0]!.changes[0]).toMatchObject({ type: 'remove' });
    expect(flow.nodes.map((record) => record.id)).toEqual(['b']);
    expect(flow.edges).toEqual([]);
    expect(key('Backspace').defaultPrevented).toBe(false);
  });

  test('Escape clears the Selection', () => {
    const { key, selected } = editor(selectedState);
    key('Escape');
    expect(selected()).toEqual({ nodes: [], edges: [] });
    expect(key('Escape').defaultPrevented).toBe(false);
  });

  test('Escape cancels a Connection first, without a Batch', () => {
    const { key, pointer, root, nodeElement, batches, selected, api } = editor(selectedState, {
      content: () => <span data-flow-port="out" />,
    });
    pointer('pointerdown', nodeElement('b').querySelector('[data-flow-port]')!, 400, 25);
    pointer('pointermove', root(), 450, 100);
    expect(api().connection()).toBeDefined();
    key('Escape');
    expect(api().connection()).toBeUndefined();
    expect(root().querySelector('.slp-flow-connection-path')).toBeNull();
    pointer('pointermove', root(), 300, 225);
    pointer('pointerup', root(), 300, 225);
    expect(batches).toEqual([]);
    expect(selected().nodes).toEqual(['a', 'inner', 'pinned']);
  });

  test('keys typed in a field, or with Ctrl, Meta or Alt, are not the Flow’s', () => {
    const { key, nodeElement, batches } = editor(selectedState, { content: () => <input /> });
    key('Delete', {}, nodeElement('a').querySelector('input')!);
    key('ArrowLeft', { metaKey: true });
    expect(batches).toEqual([]);
  });

  test('a read-only Flow moves and removes nothing', () => {
    const { key, state: flow } = editor(selectedState, { flow: { interactive: false } });
    key('Delete');
    key('ArrowLeft');
    expect(flow.nodes).toHaveLength(4);
  });
});

describe('the clipboard', () => {
  const selectedState: FlowState = {
    nodes: [node('a', 0, 0, { selected: true }), node('b', 300, 0, { selected: true }), node('c', 300, 200)],
    edges: state.edges,
  };

  test('copy writes the selected Nodes and the Edges among them, as the custom type and plain text', () => {
    const { clipboard } = editor(selectedState);
    const { event, data } = clipboard('copy');
    expect(event.defaultPrevented).toBe(true);
    const payload = JSON.parse(data[CLIPBOARD_TYPE]!) as ClipboardPayload;
    expect(data['text/plain']).toBe(data[CLIPBOARD_TYPE]);
    expect(payload.nodes.map((record) => record.id)).toEqual(['a', 'b']);
    expect(payload.edges.map((record) => record.id)).toEqual(['ab']);
  });

  test('nothing selected, or copying in a field, leaves the event alone', () => {
    const none = editor();
    expect(none.clipboard('copy').event.defaultPrevented).toBe(false);
    const field = editor(selectedState, { content: () => <input /> });
    expect(field.clipboard('copy', {}, field.nodeElement('a').querySelector('input')!).event.defaultPrevented).toBe(false);
  });

  test('cut copies, then removes the Selection', () => {
    const { clipboard, state: flow } = editor(selectedState);
    const { data } = clipboard('cut');
    expect(JSON.parse(data[CLIPBOARD_TYPE]!).nodes).toHaveLength(2);
    expect(flow.nodes.map((record) => record.id)).toEqual(['c']);
    expect(flow.edges).toEqual([]);
  });

  test('paste adds the copy with new ids, selected in place of the Selection, offset without a pointer', () => {
    const { clipboard, batches, state: flow, selected } = editor(selectedState);
    const { data } = clipboard('copy');
    clipboard('paste', { 'text/plain': data['text/plain']! });
    expect(batches[0]!.changes.slice(0, 2)).toEqual([
      { type: 'select', item: 'node', id: 'a', from: true, to: false },
      { type: 'select', item: 'node', id: 'b', from: true, to: false },
    ]);
    expect(flow.nodes.slice(3).map((record) => [record.id, record.position])).toEqual([
      ['n1', { x: 20, y: 20 }],
      ['n2', { x: 320, y: 20 }],
    ]);
    expect(flow.edges.at(-1)).toMatchObject({ id: 'n3', source: { node: 'n1' }, target: { node: 'n2' } });
    expect(selected()).toEqual({ nodes: ['n1', 'n2'], edges: ['n3'] });
  });

  test('paste lands at the pointer, in Flow coordinates', () => {
    const {
      clipboard,
      pointer,
      root,
      state: flow,
    } = editor(selectedState, {
      flow: { defaultViewport: { x: 100, y: 0, zoom: 2 } },
    });
    const { data } = clipboard('copy');
    pointer('pointermove', root(), 300, 400);
    clipboard('paste', data);
    expect(flow.nodes.slice(3).map((record) => record.position)).toEqual([
      { x: 100, y: 200 },
      { x: 400, y: 200 },
    ]);
  });

  test('ignores anything that isn’t a payload', () => {
    const { clipboard, batches } = editor(selectedState);
    expect(clipboard('paste', { 'text/plain': 'hello' }).event.defaultPrevented).toBe(false);
    expect(batches).toEqual([]);
  });

  test('the app transforms the payload both ways', () => {
    const { clipboard, state: flow } = editor(selectedState, {
      flow: {
        transformCopy: (payload) => ({ ...payload, nodes: payload.nodes.map((record) => ({ ...record, data: 'copied' })) }),
        transformPaste: (payload) =>
          payload.nodes.length > 1 ? { ...payload, nodes: payload.nodes.slice(0, 1), edges: [] } : undefined,
      },
    });
    const { data } = clipboard('copy');
    expect(JSON.parse(data[CLIPBOARD_TYPE]!).nodes[0].data).toBe('copied');
    clipboard('paste', data);
    expect(flow.nodes.slice(3)).toEqual([expect.objectContaining({ id: 'n1', data: 'copied', selected: true })]);
  });
});
