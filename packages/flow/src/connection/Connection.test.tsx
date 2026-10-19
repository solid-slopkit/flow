import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';
import type { ConnectEnd } from './connect';

// jsdom has no layout: the Flow sits at the screen's origin, and Nodes and Ports are placed from their declarations.
const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  size: { width: 100, height: 50 },
  ports: [
    { id: 'in', side: 'left', kind: 'target' },
    { id: 'out', side: 'right', kind: 'source' },
  ],
  data: null,
  ...fields,
});

const state: FlowState = {
  nodes: [node('a', 0, 0), node('b', 300, 0), node('c', 300, 200)],
  edges: [],
};

const content = () => (
  <>
    <Port id="in" />
    <Port id="out" />
  </>
);

function editor(initial: FlowState = state, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(initial, {
    content,
    ...options,
    flow: { createId: () => `e${++ids}`, ...options.flow },
  });
  flush();
  const port = (node: string, id: string) => result.nodeElement(node).querySelector<HTMLElement>(`[data-flow-port="${id}"]`)!;
  const line = () => result.root().querySelector('.slp-flow-connection-path');
  const pointer = (type: string, target: Element, x: number, y: number) => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
    flush();
  };
  /** Presses on `target`, moves through each point and releases at the last (or cancels). */
  const drag = (target: Element, from: [number, number], through: [number, number][], end = 'pointerup') => {
    pointer('pointerdown', target, ...from);
    for (const point of through) pointer('pointermove', result.root(), ...point);
    pointer(end, result.root(), ...(through.at(-1) ?? from));
  };
  return { ...result, port, line, pointer, drag };
}

describe('connecting', () => {
  test('dragging from a Port to another sends a connect Batch', () => {
    const { port, drag, batches, state: flow } = editor();
    drag(
      port('a', 'out'),
      [100, 25],
      [
        [150, 30],
        [298, 27],
      ],
    );
    expect(batches).toEqual([
      {
        changes: [
          {
            type: 'connect',
            edge: {
              id: 'e1',
              source: { node: 'a', port: 'out' },
              target: { node: 'b', port: 'in' },
            },
          },
        ],
      },
    ]);
    expect(flow.edges).toHaveLength(1);
  });

  test('shows a preview line while dragging, solid once it snaps to a Port it may end on', () => {
    const { port, pointer, root, line, api } = editor();
    expect(line()).toBeNull();
    pointer('pointerdown', port('a', 'out'), 100, 25);
    pointer('pointermove', root(), 102, 25);
    // Under the threshold, nothing yet.
    expect(line()).toBeNull();
    pointer('pointermove', root(), 200, 100);
    expect(root()).toHaveAttribute('data-connecting');
    expect(line()).toHaveAttribute('d', 'M 100 25 C 150 25 150 100 200 100');
    expect(line()).not.toHaveAttribute('data-valid');
    expect(port('a', 'out')).toHaveAttribute('data-connecting');
    expect(api().connection()).toMatchObject({
      from: { node: 'a', port: 'out' },
      to: undefined,
    });

    pointer('pointermove', root(), 310, 230);
    expect(line()).toHaveAttribute('data-valid');
    expect(line()).toHaveAttribute('d', 'M 100 25 C 200 25 200 225 300 225');
    expect(port('c', 'in')).toHaveAttribute('data-connection-target');
    expect(port('b', 'in')).not.toHaveAttribute('data-connection-target');
    expect(api().connection()?.to).toEqual({ node: 'c', port: 'in' });

    pointer('pointerup', root(), 310, 230);
    expect(line()).toBeNull();
    expect(root()).not.toHaveAttribute('data-connecting');
    expect(port('a', 'out')).not.toHaveAttribute('data-connecting');
    expect(port('c', 'in')).not.toHaveAttribute('data-connection-target');
    expect(api().connection()).toBeUndefined();
  });

  test('snaps to the nearest valid Port within connectionRadius screen pixels', () => {
    const near = editor();
    near.drag(near.port('a', 'out'), [100, 25], [[325, 25]]);
    expect(near.batches).toEqual([]);

    const wide = editor(state, { flow: { connectionRadius: 30 } });
    wide.drag(wide.port('a', 'out'), [100, 25], [[325, 25]]);
    expect(wide.batches[0]!.changes[0]).toMatchObject({
      edge: { target: { node: 'b', port: 'in' } },
    });

    // The radius is in screen pixels: at zoom 2, 15 Flow units is 30 pixels.
    const zoomed = editor(state, {
      flow: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
    });
    zoomed.drag(zoomed.port('a', 'out'), [200, 50], [[630, 50]]);
    expect(zoomed.batches).toEqual([]);
    zoomed.drag(zoomed.port('a', 'out'), [200, 50], [[615, 50]]);
    expect(zoomed.batches).toHaveLength(1);
  });

  test('starts from a target Port too, making it the Target', () => {
    const { port, drag, batches } = editor();
    drag(port('b', 'in'), [300, 25], [[100, 25]]);
    expect(batches[0]!.changes[0]).toMatchObject({
      edge: {
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
      },
    });
  });

  test('Port kinds, max and canConnect decide where it may end', () => {
    const kinds = editor();
    // A source Port onto another source Port.
    kinds.drag(kinds.port('a', 'out'), [100, 25], [[400, 25]]);
    expect(kinds.batches).toEqual([]);

    const full = editor({
      nodes: [node('a', 0, 0), node('b', 300, 0, { ports: [{ id: 'in', side: 'left', max: 1 }] }), node('c', 300, 200)],
      edges: [
        {
          id: 'cb',
          source: { node: 'c', port: 'out' },
          target: { node: 'b', port: 'in' },
          data: null,
        },
      ],
    });
    full.drag(full.port('a', 'out'), [100, 25], [[300, 25]]);
    expect(full.batches).toEqual([]);
    // A full Port starts nothing either.
    full.drag(full.port('b', 'in'), [300, 25], [[100, 25]]);
    expect(full.batches).toEqual([]);

    const asked: string[] = [];
    const ruled = editor(state, {
      flow: {
        canConnect: (source, target) => {
          asked.push(`${source.node}.${source.port}>${target.node}.${target.port}`);
          return target.node !== 'b';
        },
      },
    });
    ruled.drag(ruled.port('a', 'out'), [100, 25], [[300, 25]]);
    expect(ruled.batches).toEqual([]);
    ruled.drag(ruled.port('a', 'out'), [100, 25], [[300, 225]]);
    expect(ruled.batches).toHaveLength(1);
    // Asked once per Port it might end on, when the Connection starts.
    const once = ['a.out>a.in', 'a.out>b.in', 'a.out>c.in'];
    expect(asked).toEqual([...once, ...once]);
  });

  test('a press on a Port doesn’t drag its Node; a click without moving only selects the Node', () => {
    const { port, drag, batches } = editor();
    drag(port('a', 'out'), [100, 25], [[200, 200]]);
    expect(batches).toEqual([]);
    drag(port('a', 'out'), [100, 25], []);
    expect(batches).toEqual([{ changes: [{ type: 'select', item: 'node', id: 'a', from: false, to: true }] }]);
  });

  test('a cancelled pointer drops the Connection without a Batch', () => {
    const { port, drag, batches, line } = editor();
    drag(port('a', 'out'), [100, 25], [[300, 25]], 'pointercancel');
    expect(batches).toEqual([]);
    expect(line()).toBeNull();
  });

  test('nothing starts in a read-only Flow', () => {
    const { port, drag, line, root, pointer } = editor(state, {
      flow: { interactive: false },
    });
    pointer('pointerdown', port('a', 'out'), 100, 25);
    pointer('pointermove', root(), 300, 25);
    expect(line()).toBeNull();
    pointer('pointerup', root(), 300, 25);
    drag(port('a', 'out'), [100, 25], [[300, 25]]);
    expect(port('a', 'out')).not.toHaveAttribute('data-connectable');
  });

  test('moving the pointer re-runs no Node or Edge, and a Port only when the Connection snaps to it', async () => {
    const { port, pointer, root } = editor({
      ...state,
      edges: [
        {
          id: 'bc',
          source: { node: 'b', port: 'out' },
          target: { node: 'c', port: 'in' },
          data: null,
        },
      ],
    });
    pointer('pointerdown', port('a', 'out'), 100, 25);
    pointer('pointermove', root(), 150, 50);
    const { artifact } = await captureArtifact(
      () => {
        for (let x = 160; x < 260; x += 10) pointer('pointermove', root(), x, 60);
        pointer('pointermove', root(), 300, 25);
      },
      { scenario: 'connection-move' },
    );
    pointer('pointerup', root(), 300, 25);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'flowIndex' });
    // Per move: the preview path alone; plus the one Port it snaps to.
    expect(artifact).toStayWithinRerunBudget(11, { scope: 'path.d, path.data-valid' });
    expect(artifact).toStayWithinRerunBudget(11 + 1);
  });
});

describe('dropping on empty space', () => {
  test('calls onConnectEnd with the position in Flow coordinates and the starting Port', () => {
    const ends: ConnectEnd[] = [];
    const { port, drag, batches } = editor(state, {
      flow: {
        defaultViewport: { x: 50, y: 20, zoom: 2 },
        onConnectEnd: (end) => ends.push(end),
      },
    });
    drag(port('a', 'out'), [250, 70], [[450, 620]]);
    drag(port('b', 'in'), [650, 70], [[450, 620]]);
    expect(ends).toEqual([
      { position: { x: 200, y: 300 }, source: { node: 'a', port: 'out' } },
      { position: { x: 200, y: 300 }, target: { node: 'b', port: 'in' } },
    ]);
    expect(batches).toEqual([]);
  });

  test('not on a Node, nor when it ends on a Port', () => {
    const ends: ConnectEnd[] = [];
    const { port, drag } = editor(state, {
      flow: { onConnectEnd: (end) => ends.push(end) },
    });
    drag(port('a', 'out'), [100, 25], [[350, 30]]);
    drag(port('a', 'out'), [100, 25], [[300, 25]]);
    expect(ends).toEqual([]);
  });

  test('the app can add a Node there and connect it in one Batch', () => {
    const result = editor(state, {
      flow: {
        onConnectEnd: ({ position, source }) =>
          result.api().emit({
            changes: [
              {
                type: 'add',
                nodes: [node('d', position.x, position.y - 25)],
                edges: [],
              },
              {
                type: 'connect',
                edge: {
                  id: 'ad',
                  source: source!,
                  target: { node: 'd', port: 'in' },
                  data: null,
                },
              },
            ],
          }),
      },
    });
    result.drag(result.port('a', 'out'), [100, 25], [[200, 300]]);
    flush();
    expect(result.state.nodes.at(-1)).toMatchObject({
      id: 'd',
      position: { x: 200, y: 275 },
    });
    expect(result.edgeElement('ad')!.querySelector('.slp-flow-edge-path')).toHaveAttribute(
      'd',
      'M 100 25 C 150 25 150 300 200 300',
    );
  });
});

describe('reconnecting', () => {
  const connected: FlowState = {
    ...state,
    edges: [
      {
        id: 'ab',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
        shape: 'straight',
        data: null,
      },
    ],
  };
  const end = (result: ReturnType<typeof editor>, which: 'source' | 'target') =>
    result.edgeElement('ab')!.querySelector(`[data-flow-edge-end="${which}"]`)!;

  test('each end of an Edge has a handle at its point', () => {
    const result = editor(connected);
    expect(end(result, 'source')).toHaveAttribute('cx', '100');
    expect(end(result, 'target')).toHaveAttribute('cx', '300');
    expect(end(result, 'target')).toHaveClass('slp-flow-edge-end');
  });

  test('no handles when not reconnectable or read-only', () => {
    const off = editor(connected, { edge: () => ({ reconnectable: false }) });
    expect(off.edgeElement('ab')!.querySelector('[data-flow-edge-end]')).toBeNull();
    const readOnly = editor(connected, { flow: { interactive: false } });
    expect(readOnly.edgeElement('ab')!.querySelector('[data-flow-edge-end]')).toBeNull();
  });

  test('dragging an end to another Port sends a reconnect Change', () => {
    const result = editor(connected);
    result.pointer('pointerdown', end(result, 'target'), 300, 25);
    result.pointer('pointermove', result.root(), 300, 120);
    expect(result.edgeElement('ab')).toHaveAttribute('data-reconnecting');
    expect(result.line()).toHaveAttribute('d', 'M 100 25 C 200 25 200 120 300 120');
    result.pointer('pointermove', result.root(), 305, 220);
    result.pointer('pointerup', result.root(), 305, 220);
    expect(result.batches).toEqual([
      {
        changes: [
          {
            type: 'reconnect',
            edge: 'ab',
            end: 'target',
            from: { node: 'b', port: 'in' },
            to: { node: 'c', port: 'in' },
          },
        ],
      },
    ]);
    expect(result.edgeElement('ab')).not.toHaveAttribute('data-reconnecting');
    expect(result.edgeElement('ab')!.querySelector('.slp-flow-edge-path')).toHaveAttribute('d', 'M 100 25 L 300 225');
  });

  test('the Source end keeps the Target, and may move to a Port at its max', () => {
    const result = editor({
      nodes: [
        node('a', 0, 0, {
          ports: [{ id: 'out', side: 'right', kind: 'source', max: 1 }],
        }),
        node('b', 300, 0),
        node('c', 0, 200),
      ],
      edges: connected.edges,
    });
    result.drag(end(result, 'source'), [100, 25], [[100, 225]]);
    expect(result.batches[0]!.changes).toEqual([
      {
        type: 'reconnect',
        edge: 'ab',
        end: 'source',
        from: { node: 'a', port: 'out' },
        to: { node: 'c', port: 'out' },
      },
    ]);
  });

  test('back onto its own Port changes nothing; off any Port removes the Edge', () => {
    const result = editor(connected);
    result.drag(
      end(result, 'target'),
      [300, 25],
      [
        [200, 100],
        [300, 25],
      ],
    );
    expect(result.batches).toEqual([]);
    result.drag(end(result, 'target'), [300, 25], [[200, 300]]);
    expect(result.batches).toEqual([
      {
        changes: [
          {
            type: 'remove',
            nodes: [],
            edges: [connected.edges[0]],
            at: { nodes: [], edges: [0] },
          },
        ],
      },
    ]);
    expect(result.state.edges).toEqual([]);
  });

  test('a Floating end can be reconnected to a Port', () => {
    const result = editor({
      ...state,
      edges: [
        {
          id: 'ab',
          source: { node: 'a' },
          target: { node: 'b' },
          shape: 'straight',
          data: null,
        },
      ],
    });
    result.drag(end(result, 'target'), [300, 25], [[300, 225]]);
    expect(result.batches[0]!.changes).toEqual([
      {
        type: 'reconnect',
        edge: 'ab',
        end: 'target',
        from: { node: 'b' },
        to: { node: 'c', port: 'in' },
      },
    ]);
  });
});
