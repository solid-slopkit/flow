// Nodes with real layout and real input: measuring, dragging, nesting, snapping, resizing and alignment guides.
import { captureArtifact } from '@solidjs/diagnostics';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { drag, mouse, pointOf, settle } from '../../test/input';
import { createHistory } from '../history/history';
import type { FlowNode, FlowState } from '../model/model';
import { NodeResizer } from './NodeResizer';

const box = (width = 100, height = 50) => <div style={{ width: `${width}px`, height: `${height}px` }} />;
const node = (id: string, x: number, y: number, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  data: null,
  ...fields,
});

async function editor(state: FlowState, options: EditorOptions = {}) {
  const result = renderEditor(state, { content: () => box(), ...options });
  await settle();
  return result;
}

describe('measuring', () => {
  test('a Node is measured from its content, and follows it', async () => {
    const { api, nodeElement } = await editor({ nodes: [node('a', 0, 0)], edges: [] });
    expect(api().measuredSize('a')).toEqual({ width: 100, height: 50 });
    (nodeElement('a').firstElementChild as HTMLElement).style.width = '140px';
    await settle();
    expect(api().measuredSize('a')).toEqual({ width: 140, height: 50 });
  });

  test('a content-sized Node takes its content’s natural width, without wrapping text', async () => {
    const { nodeElement } = await editor(
      { nodes: [node('a', 0, 0), node('b', 300, 0, { size: { width: 60, height: 40 } })], edges: [] },
      { content: () => <span>A label several words long</span> },
    );
    const text = nodeElement('a').querySelector('span')!;
    expect(text.getClientRects()).toHaveLength(1);
    expect(nodeElement('a').offsetWidth).toBe(Math.ceil(text.getBoundingClientRect().width));
    // A Declared size still wins.
    expect(nodeElement('b').offsetWidth).toBe(60);
  });

  test('measures layout size, not the zoomed size', async () => {
    const { api } = await editor({ nodes: [node('a', 0, 0)], edges: [] }, { flow: { defaultViewport: { x: 0, y: 0, zoom: 2 } } });
    expect(api().measuredSize('a')).toEqual({ width: 100, height: 50 });
  });

  test('Ports are measured relative to their Node, with their side', async () => {
    const { api } = await editor(
      { nodes: [node('a', 50, 50)], edges: [] },
      {
        flow: { defaultViewport: { x: 10, y: 10, zoom: 1.5 } },
        content: () => (
          <div style={{ position: 'relative', width: '100px', height: '50px' }}>
            <span
              data-flow-port="in"
              style={{ position: 'absolute', left: '-5px', top: '20px', width: '10px', height: '10px' }}
            />
            <span
              data-flow-port="out"
              data-flow-port-side="bottom"
              style={{ position: 'absolute', left: '95px', top: '20px', width: '10px', height: '10px' }}
            />
          </div>
        ),
      },
    );
    expect(api().measuredPort('a', 'in')).toEqual({ x: 0, y: 25, side: 'left' });
    expect(api().measuredPort('a', 'out')).toEqual({ x: 100, y: 25, side: 'bottom' });
    expect(api().measuredPort('a', 'nope')).toBeUndefined();
  });

  test('fitView uses Measured sizes', async () => {
    const { api } = await editor(
      { nodes: [node('a', 0, 0), node('b', 500, 300)], edges: [] },
      { flow: { fitView: { padding: 0 } } },
    );
    // Bounds 600 × 350 in a 600 × 400 Flow.
    expect(api().viewport()).toEqual({ x: 0, y: 25, zoom: 1 });
  });
});

describe('dragging', () => {
  test('moves the Node, sending move Batches in phases after a threshold', async () => {
    const { nodeElement, batches, state } = await editor({ nodes: [node('a', 0, 0), node('b', 300, 0)], edges: [] });
    const from = pointOf(nodeElement('a'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 2, y: from.y });
    expect(batches).toEqual([]);
    await mouse('mouseMoved', { x: from.x + 10, y: from.y + 5 });
    await mouse('mouseMoved', { x: from.x + 30, y: from.y + 20 });
    await mouse('mouseReleased', { x: from.x + 30, y: from.y + 20 });
    await settle();
    expect(batches).toEqual([
      { phase: 'start', changes: [{ type: 'move', node: 'a', from: { x: 0, y: 0 }, to: { x: 10, y: 5 } }] },
      { phase: 'update', changes: [{ type: 'move', node: 'a', from: { x: 10, y: 5 }, to: { x: 30, y: 20 } }] },
      { phase: 'end', changes: [] },
    ]);
    expect(state.nodes[0]!.position).toEqual({ x: 30, y: 20 });
    expect(state.nodes[1]!.position).toEqual({ x: 300, y: 0 });
  });

  test('a click is not a drag: it only selects', async () => {
    const { nodeElement, batches } = await editor({ nodes: [node('a', 0, 0)], edges: [] });
    await drag(pointOf(nodeElement('a')));
    expect(batches).toEqual([{ changes: [{ type: 'select', item: 'node', id: 'a', from: false, to: true }] }]);
  });

  test('moves in Flow coordinates at any zoom', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 0, 0)], edges: [] },
      { flow: { defaultViewport: { x: 0, y: 0, zoom: 2 } } },
    );
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 40, y: from.y + 20 });
    expect(state.nodes[0]!.position).toEqual({ x: 20, y: 10 });
  });

  test('dragging a selected Node moves every selected Node', async () => {
    const { nodeElement, state } = await editor({
      nodes: [node('a', 0, 0, { selected: true }), node('b', 200, 0, { selected: true }), node('c', 400, 0)],
      edges: [],
    });
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 10, y: from.y + 10 });
    expect(state.nodes.map((n) => n.position)).toEqual([
      { x: 10, y: 10 },
      { x: 210, y: 10 },
      { x: 400, y: 0 },
    ]);
  });

  test('an unselected Node moves alone; a selected Node that is not draggable stays', async () => {
    const { nodeElement, state } = await editor({
      nodes: [node('a', 0, 0), node('b', 200, 0, { selected: true }), node('c', 400, 0, { selected: true, draggable: false })],
      edges: [],
    });
    let from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 10, y: from.y });
    from = pointOf(nodeElement('b'));
    await drag(from, { x: from.x + 10, y: from.y });
    expect(state.nodes.map((n) => n.position.x)).toEqual([10, 210, 400]);
  });

  test('draggable: false, a read-only Flow, form controls and data-flow-nodrag never drag', async () => {
    const content = (n: FlowNode) => (
      <div style={{ width: '100px', height: '50px' }}>
        {n.id === 'b' && <input data-testid="input" />}
        {n.id === 'c' && <span data-flow-nodrag data-testid="nodrag" style={{ display: 'block', height: '20px' }} />}
      </div>
    );
    const { nodeElement, getByTestId, batches } = await editor(
      { nodes: [node('a', 0, 0, { draggable: false }), node('b', 200, 0), node('c', 400, 0)], edges: [] },
      { content },
    );
    for (const from of [pointOf(nodeElement('a')), pointOf(getByTestId('input')), pointOf(getByTestId('nodrag'))])
      await drag(from, { x: from.x + 30, y: from.y });
    expect(batches).toEqual([]);

    const readOnly = await editor({ nodes: [node('a', 0, 0)], edges: [] }, { flow: { interactive: false } });
    const from = pointOf(readOnly.nodeElement('a'));
    await drag(from, { x: from.x + 30, y: from.y });
    expect(readOnly.state.nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  test('with a drag handle, only the handle starts a drag', async () => {
    const content = () => (
      <div style={{ width: '100px', height: '50px' }}>
        <div class="handle" style={{ height: '10px' }} />
      </div>
    );
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 0, 0)], edges: [] },
      { content, node: () => ({ dragHandle: '.handle' }) },
    );
    let from = pointOf(nodeElement('a'), { x: 50, y: 40 });
    await drag(from, { x: from.x + 30, y: from.y });
    expect(state.nodes[0]!.position.x).toBe(0);
    from = pointOf(nodeElement('a'), { x: 50, y: 5 });
    await drag(from, { x: from.x + 30, y: from.y });
    expect(state.nodes[0]!.position.x).toBe(30);
  });

  test('marks the dragged Nodes while dragging', async () => {
    const { nodeElement } = await editor({ nodes: [node('a', 0, 0)], edges: [] });
    const from = pointOf(nodeElement('a'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 20, y: from.y });
    await settle();
    expect(nodeElement('a')).toHaveAttribute('data-dragging');
    await mouse('mouseReleased', { x: from.x + 20, y: from.y });
    await settle();
    expect(nodeElement('a')).not.toHaveAttribute('data-dragging');
  });

  test('does not pan the Flow', async () => {
    const { nodeElement, api } = await editor({ nodes: [node('a', 0, 0)], edges: [] });
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 30, y: from.y });
    expect(api().viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test('a whole drag is one History entry', async () => {
    const history = createHistory();
    const { nodeElement, batches } = await editor({ nodes: [node('a', 0, 0)], edges: [] });
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 10, y: from.y }, { x: from.x + 20, y: from.y }, { x: from.x + 30, y: from.y });
    batches.forEach(history.record);
    expect(history.undo()).toEqual({ changes: [{ type: 'move', node: 'a', from: { x: 30, y: 0 }, to: { x: 0, y: 0 } }] });
  });

  test('each step re-draws only the dragged Node', async () => {
    const { nodeElement } = await editor({ nodes: [node('a', 0, 0), node('b', 300, 0), node('c', 300, 200)], edges: [] });
    const from = pointOf(nodeElement('a'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 10, y: from.y });
    await settle();
    const { artifact } = await captureArtifact(async () => {
      await mouse('mouseMoved', { x: from.x + 20, y: from.y });
      await settle();
    });
    await mouse('mouseReleased', { x: from.x + 20, y: from.y });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'node:a:position' });
    expect(artifact).toStayWithinRerunBudget(0, { scope: /node:[bc]/ });
    expect(artifact).toStayWithinRerunBudget(2);
  });
});

describe('nested Nodes', () => {
  const group = (fields: Partial<FlowNode> = {}) => node('group', 0, 0, { size: { width: 300, height: 200 }, ...fields });
  const content = (n: FlowNode) => (n.id === 'group' ? <div /> : box());

  test('move with their Parent', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [group(), node('child', 20, 20, { parent: 'group' })], edges: [] },
      { content },
    );
    const from = pointOf(nodeElement('group'), { x: 250, y: 150 });
    await drag(from, { x: from.x + 40, y: from.y + 10 });
    expect(state.nodes[0]!.position).toEqual({ x: 40, y: 10 });
    expect(state.nodes[1]!.position).toEqual({ x: 20, y: 20 });
    expect(nodeElement('child').style.transform).toBe('translate(60px, 30px)');
  });

  test('dragging a selected child with its selected Parent moves the Parent only', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [group({ selected: true }), node('child', 20, 20, { parent: 'group', selected: true })], edges: [] },
      { content },
    );
    const from = pointOf(nodeElement('child'));
    await drag(from, { x: from.x + 10, y: from.y });
    expect(state.nodes.map((n) => n.position)).toEqual([
      { x: 10, y: 0 },
      { x: 20, y: 20 },
    ]);
  });

  test('keepInParent keeps a child inside', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [group(), node('child', 20, 20, { parent: 'group' })], edges: [] },
      { content, node: (n) => ({ keepInParent: n.id === 'child' }) },
    );
    const from = pointOf(nodeElement('child'));
    await drag(from, { x: from.x + 500, y: from.y - 100 });
    expect(state.nodes[1]!.position).toEqual({ x: 200, y: 0 });
  });

  test('reparentOnDrop: dropping onto a Node nests the dragged Node in it, keeping it in place', async () => {
    const { nodeElement, state, batches } = await editor(
      { nodes: [group({ position: { x: 100, y: 100 } }), node('free', 450, 100)], edges: [] },
      { content, flow: { reparentOnDrop: true } },
    );
    const from = pointOf(nodeElement('free'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x - 200, y: from.y + 50 });
    await settle();
    expect(nodeElement('group')).toHaveAttribute('data-drop-target');
    await mouse('mouseReleased', { x: from.x - 200, y: from.y + 50 });
    await settle();
    expect(nodeElement('group')).not.toHaveAttribute('data-drop-target');
    expect(state.nodes[1]).toMatchObject({ parent: 'group', position: { x: 150, y: 50 } });
    expect(batches.at(-1)).toEqual({
      phase: 'end',
      changes: [
        {
          type: 'reparent',
          node: 'free',
          from: { position: { x: 250, y: 150 } },
          to: { parent: 'group', position: { x: 150, y: 50 } },
        },
      ],
    });
    expect(nodeElement('free').style.transform).toBe('translate(250px, 150px)');
  });

  test('reparentOnDrop: dropping on empty space makes the Node top-level', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [group(), node('child', 20, 20, { parent: 'group' })], edges: [] },
      { content, flow: { reparentOnDrop: true } },
    );
    const from = pointOf(nodeElement('child'));
    await drag(from, { x: from.x + 380, y: from.y });
    expect(state.nodes[1]!.parent).toBeUndefined();
    expect(state.nodes[1]!.position).toEqual({ x: 400, y: 20 });
  });

  test('reparentOnDrop can refuse a Parent', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [group({ position: { x: 100, y: 100 } }), node('free', 450, 100)], edges: [] },
      { content, flow: { reparentOnDrop: (_, parent) => parent?.id !== 'group' } },
    );
    const from = pointOf(nodeElement('free'));
    await drag(from, { x: from.x - 200, y: from.y + 50 });
    expect(state.nodes[1]!.parent).toBeUndefined();
  });

  test('without reparentOnDrop, dropping changes no Parent', async () => {
    const { nodeElement, state } = await editor({ nodes: [group(), node('free', 450, 100)], edges: [] }, { content });
    const from = pointOf(nodeElement('free'));
    await drag(from, { x: from.x - 300, y: from.y });
    expect(state.nodes[1]!.parent).toBeUndefined();
  });
});

describe('snapping to a grid', () => {
  test('the dragged Node lands on the grid; others keep their offset', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 0, 0, { selected: true }), node('b', 203, 7, { selected: true })], edges: [] },
      { flow: { snapToGrid: 20 } },
    );
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 27, y: from.y + 12 });
    expect(state.nodes.map((n) => n.position)).toEqual([
      { x: 20, y: 20 },
      { x: 223, y: 27 },
    ]);
  });

  test('takes a different spacing per axis', async () => {
    const { nodeElement, state } = await editor({ nodes: [node('a', 0, 0)], edges: [] }, { flow: { snapToGrid: [50, 10] } });
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 30, y: from.y + 14 });
    expect(state.nodes[0]!.position).toEqual({ x: 50, y: 10 });
  });
});

describe('alignment guides', () => {
  test('snap to another Node’s edges and show a guide while dragging', async () => {
    const { nodeElement, state, root } = await editor(
      { nodes: [node('a', 0, 200), node('b', 300, 0)], edges: [] },
      { flow: { alignmentGuides: true } },
    );
    const from = pointOf(nodeElement('a'));
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 296, y: from.y + 30 });
    await settle();
    const lines = [...root().querySelectorAll('.slp-flow-guides line')].map((line) => line.getAttribute('x1'));
    expect(lines).toContain('300');
    await mouse('mouseReleased', { x: from.x + 296, y: from.y + 30 });
    await settle();
    expect(state.nodes[0]!.position).toEqual({ x: 300, y: 230 });
    expect(root().querySelectorAll('.slp-flow-guides line')).toHaveLength(0);
  });

  test('the threshold is in screen pixels', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 0, 200), node('b', 300, 0)], edges: [] },
      { flow: { alignmentGuides: { threshold: 2 } } },
    );
    const from = pointOf(nodeElement('a'));
    await drag(from, { x: from.x + 296, y: from.y + 30 });
    expect(state.nodes[0]!.position.x).toBe(296);
  });
});

describe('<NodeResizer>', () => {
  const resizable =
    (props = {}) =>
    () => (
      <div style={{ width: '100%', height: '100%', 'min-width': '20px', 'min-height': '20px' }}>
        <NodeResizer {...props} />
      </div>
    );
  const handle = (element: HTMLElement, name: string) => element.querySelector<HTMLElement>(`[data-handle="${name}"]`)!;

  test('shows handles on a selected Node only', async () => {
    const { nodeElement } = await editor(
      {
        nodes: [
          node('a', 0, 0, { size: { width: 100, height: 50 }, selected: true }),
          node('b', 300, 0, { size: { width: 100, height: 50 } }),
        ],
        edges: [],
      },
      { content: resizable() },
    );
    expect(nodeElement('a').querySelectorAll('.slp-flow-resizer-handle')).toHaveLength(8);
    expect(nodeElement('b').querySelector('.slp-flow-resizer')).toBeNull();
  });

  test('resizes from a corner, sending resize Batches in phases', async () => {
    const { nodeElement, state, batches } = await editor(
      { nodes: [node('a', 100, 100, { size: { width: 100, height: 50 }, selected: true })], edges: [] },
      { content: resizable() },
    );
    const from = pointOf(handle(nodeElement('a'), 'top-left'));
    await drag(from, { x: from.x - 10, y: from.y - 10 }, { x: from.x - 20, y: from.y - 30 });
    expect(state.nodes[0]).toMatchObject({ position: { x: 80, y: 70 }, size: { width: 120, height: 80 } });
    expect(batches.map((batch) => batch.phase)).toEqual(['start', 'update', 'end']);
    expect(batches[0]!.changes).toEqual([
      {
        type: 'resize',
        node: 'a',
        from: { position: { x: 100, y: 100 }, size: { width: 100, height: 50 } },
        to: { position: { x: 90, y: 90 }, size: { width: 110, height: 60 } },
      },
    ]);
    expect(state.nodes[0]!.position).toEqual({ x: 80, y: 70 });
  });

  test('a content-sized Node gets a Declared size from its Measured one', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 0, 0, { selected: true })], edges: [] },
      {
        content: () => (
          <div style={{ width: '100px', height: '50px' }}>
            <NodeResizer />
          </div>
        ),
      },
    );
    const from = pointOf(handle(nodeElement('a'), 'right'));
    await drag(from, { x: from.x + 25, y: from.y + 40 });
    expect(state.nodes[0]!.size).toEqual({ width: 125, height: 50 });
  });

  test('min and max size, and keeping the aspect ratio', async () => {
    const { nodeElement, state } = await editor(
      {
        nodes: [
          node('a', 0, 0, { size: { width: 100, height: 50 }, selected: true }),
          node('b', 300, 0, { size: { width: 100, height: 50 }, selected: true }),
        ],
        edges: [],
      },
      { content: (n) => resizable(n.id === 'a' ? { minWidth: 60, maxHeight: 70 } : { keepAspectRatio: true })() },
    );
    let from = pointOf(handle(nodeElement('a'), 'bottom-right'));
    await drag(from, { x: from.x - 80, y: from.y + 80 });
    expect(state.nodes[0]!.size).toEqual({ width: 60, height: 70 });
    from = pointOf(handle(nodeElement('b'), 'right'));
    await drag(from, { x: from.x + 50, y: from.y });
    expect(state.nodes[1]!.size).toEqual({ width: 150, height: 75 });
  });

  test('pressing a handle does not drag the Node', async () => {
    const { nodeElement, state } = await editor(
      { nodes: [node('a', 100, 100, { size: { width: 100, height: 50 }, selected: true })], edges: [] },
      { content: resizable() },
    );
    const from = pointOf(handle(nodeElement('a'), 'right'));
    await drag(from, { x: from.x + 20, y: from.y });
    expect(state.nodes[0]!.position).toEqual({ x: 100, y: 100 });
  });
});
