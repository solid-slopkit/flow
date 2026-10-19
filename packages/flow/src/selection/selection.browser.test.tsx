// Selection and editing with real layout and real input: clicks, the selection box, the keyboard on a focused Flow,
// pasting, and dragging from a palette.
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { drag, key, mouse, pointOf, settle, SHIFT } from '../../test/input';
import { render } from '../../test/render';
import { CLIPBOARD_TYPE } from '../clipboard/payload';
import { Flow } from '../flow/Flow';
import type { FlowNode, FlowState, Point } from '../model/model';
import { FlowDraggable } from '../palette/FlowDraggable';
import { Port } from '../port/Port';

const node = (id: string, x: number, y = 0, fields: Partial<FlowNode> = {}): FlowNode => ({
  id,
  position: { x, y },
  data: null,
  ...fields,
});

const content = () => (
  <div style={{ width: '100px', height: '50px' }}>
    <Port id="in" side="left" />
    <Port id="out" side="right" />
  </div>
);

const state: FlowState = {
  nodes: [node('a', 0), node('b', 300), node('c', 300, 200)],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, shape: 'straight', data: null }],
};

async function editor(initial: FlowState = state, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(initial, {
    content,
    ...options,
    flow: { createId: () => `n${++ids}`, defaultViewport: { x: 40, y: 40, zoom: 1 }, ...options.flow },
  });
  await settle();
  const selected = () => result.state.nodes.filter((record) => record.selected).map((record) => record.id);
  const selectedEdges = () => result.state.edges.filter((record) => record.selected).map((record) => record.id);
  const at = (point: Point) => result.api().flowToScreen(point);
  return { ...result, selected, selectedEdges, at };
}

describe('clicking', () => {
  test('selects a Node, an Edge by its line, and clears on empty space', async () => {
    const { nodeElement, at, selected, selectedEdges } = await editor();
    await drag(pointOf(nodeElement('a')));
    expect(selected()).toEqual(['a']);
    // 4 pixels off the line still hits it.
    await drag({ ...at({ x: 200, y: 25 }), y: at({ x: 200, y: 25 }).y + 4 });
    expect(selected()).toEqual([]);
    expect(selectedEdges()).toEqual(['ab']);
    await drag(at({ x: 150, y: 300 }));
    expect(selected()).toEqual([]);
    expect(selectedEdges()).toEqual([]);
  });

  test('Shift-click adds to the Selection; the selected Nodes drag together', async () => {
    const { nodeElement, selected, state: flow } = await editor();
    await drag(pointOf(nodeElement('a')));
    const b = pointOf(nodeElement('b'));
    await mouse('mousePressed', b, { modifiers: SHIFT });
    await mouse('mouseReleased', b, { modifiers: SHIFT });
    await settle();
    expect(selected()).toEqual(['a', 'b']);
    await drag(b, { x: b.x + 20, y: b.y + 10 }, { x: b.x + 40, y: b.y + 30 });
    expect(flow.nodes.map((record) => record.position)).toEqual([
      { x: 40, y: 30 },
      { x: 340, y: 30 },
      { x: 300, y: 200 },
    ]);
  });
});

describe('the selection box', () => {
  test('Shift-drag on empty space draws the box and selects what it overlaps, without panning', async () => {
    const { at, selected, selectedEdges, api, container } = await editor();
    const from = at({ x: 50, y: 150 });
    const to = at({ x: 320, y: 20 });
    await mouse('mousePressed', from, { modifiers: SHIFT });
    await mouse('mouseMoved', { x: from.x + 20, y: from.y - 20 }, { modifiers: SHIFT });
    await mouse('mouseMoved', to, { modifiers: SHIFT });
    await settle();
    const box = container.querySelector('.slp-flow-selection-box')!;
    const rect = box.getBoundingClientRect();
    expect(rect.left).toBeCloseTo(from.x, 0);
    expect(rect.bottom).toBeCloseTo(from.y, 0);
    expect(rect.right).toBeCloseTo(to.x, 0);
    expect(getComputedStyle(box).borderTopStyle).toBe('solid');
    await mouse('mouseReleased', to, { modifiers: SHIFT });
    await settle();
    expect(selected()).toEqual(['a', 'b']);
    expect(selectedEdges()).toEqual(['ab']);
    expect(container.querySelector('.slp-flow-selection-box')).toBeNull();
    expect(api().viewport()).toEqual({ x: 40, y: 40, zoom: 1 });
  });
});

describe('the keyboard', () => {
  test('a click focuses the Node; arrows move, Escape clears and Delete removes the Selection', async () => {
    const { nodeElement, root, state: flow, selected } = await editor();
    await drag(pointOf(nodeElement('a')));
    expect(document.activeElement).toBe(nodeElement('a'));
    await key('ArrowRight');
    await key('ArrowDown', SHIFT);
    expect(flow.nodes[0]!.position).toEqual({ x: 1, y: 10 });
    await key('Escape');
    expect(selected()).toEqual([]);
    await drag(pointOf(nodeElement('a')));
    await key('Delete');
    expect(flow.nodes.map((record) => record.id)).toEqual(['b', 'c']);
    expect(flow.edges).toEqual([]);
    expect(document.activeElement).toBe(root());
  });

  test('Escape cancels a Connection being dragged', async () => {
    const { nodeElement, root, batches } = await editor();
    root().focus();
    const from = pointOf(nodeElement('a').querySelector('[data-flow-port="out"]')!);
    const to = pointOf(nodeElement('c').querySelector('[data-flow-port="in"]')!);
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 40, y: from.y + 40 });
    await key('Escape');
    expect(root().querySelector('.slp-flow-connection-path')).toBeNull();
    await mouse('mouseMoved', to);
    await mouse('mouseReleased', to);
    await settle();
    expect(batches).toEqual([]);
  });

  test('keys typed in a field inside a Node stay the field’s', async () => {
    const { nodeElement, state: flow } = await editor(
      { nodes: [node('a', 0, 0, { selected: true })], edges: [] },
      { content: () => <input style={{ width: '100px' }} value="text" /> },
    );
    const input = nodeElement('a').querySelector('input')!;
    input.focus();
    await key('Delete');
    expect(flow.nodes).toHaveLength(1);
  });
});

describe('the clipboard', () => {
  test('a pasted copy lands at the pointer, through real clipboard events', async () => {
    const {
      nodeElement,
      root,
      at,
      state: flow,
      selected,
    } = await editor({
      ...state,
      nodes: state.nodes.map((record) => ({ ...record, selected: record.id !== 'c' })),
    });
    root().focus();
    const transfer = new DataTransfer();
    root().dispatchEvent(new ClipboardEvent('copy', { clipboardData: transfer, bubbles: true, cancelable: true }));
    expect(JSON.parse(transfer.getData(CLIPBOARD_TYPE)).nodes).toHaveLength(2);
    await mouse('mouseMoved', at({ x: 0, y: 300 }));
    await settle();
    root().dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    await settle();
    expect(flow.nodes.slice(3).map((record) => record.position)).toEqual([
      { x: 0, y: 300 },
      { x: 300, y: 300 },
    ]);
    expect(selected()).toEqual(['n1', 'n2']);
    expect(nodeElement('n1')).toHaveAttribute('data-selected');
    expect(flow.edges.at(-1)).toMatchObject({ source: { node: 'n1' }, target: { node: 'n2' } });
  });
});

describe('dragging from a palette', () => {
  function palette() {
    const drops: { flow: string; data: unknown; position: Point }[] = [];
    const flowState: FlowState = { nodes: [], edges: [] };
    const result = render(() => (
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ width: '120px' }}>
          <FlowDraggable data={{ kind: 'task' }}>
            <div style={{ height: '30px' }}>Task</div>
          </FlowDraggable>
          <FlowDraggable data="off" disabled>
            <div style={{ height: '30px' }}>Off</div>
          </FlowDraggable>
        </div>
        <Flow
          state={flowState}
          defaultViewport={{ x: 10, y: 20, zoom: 2 }}
          onDrop={(drop) => drops.push({ flow: 'one', ...drop })}
          style={{ width: '400px', height: '300px' }}
        />
        <Flow
          state={flowState}
          onDrop={(drop) => drops.push({ flow: 'two', ...drop })}
          style={{ width: '400px', height: '300px' }}
        />
      </div>
    ));
    const items = result.container.querySelectorAll<HTMLElement>('[data-flow-draggable]');
    const flows = result.container.querySelectorAll<HTMLElement>('.slp-flow');
    return { drops, item: items[0]!, disabled: items[1]!, flows };
  }

  test('dropping on a Flow calls its onDrop with the data and the Flow position; the item follows and snaps back', async () => {
    const { drops, item, flows } = palette();
    await settle();
    const from = pointOf(item);
    const box = flows[0]!.getBoundingClientRect();
    const to = { x: box.left + 110, y: box.top + 120 };
    await mouse('mousePressed', from);
    await mouse('mouseMoved', { x: from.x + 30, y: from.y + 5 });
    await settle();
    expect(item).toHaveAttribute('data-dragging');
    expect(item.getBoundingClientRect().left).toBeCloseTo(from.x - item.offsetWidth / 2 + 30, 0);
    await mouse('mouseMoved', to);
    await mouse('mouseReleased', to);
    await settle();
    expect(drops).toEqual([{ flow: 'one', data: { kind: 'task' }, position: { x: 50, y: 50 } }]);
    expect(item).not.toHaveAttribute('data-dragging');
    expect(item.style.transform).toBe('');

    const second = flows[1]!.getBoundingClientRect();
    await drag(pointOf(item), { x: from.x + 20, y: from.y }, { x: second.left + 50, y: second.top + 60 });
    expect(drops[1]).toMatchObject({ flow: 'two', position: { x: 50, y: 60 } });
  });

  test('nothing when dropped off any Flow, or when disabled', async () => {
    const { drops, item, disabled, flows } = palette();
    await settle();
    const from = pointOf(item);
    await drag(from, { x: from.x + 10, y: from.y + 200 }, { x: from.x, y: from.y + 400 });
    const box = flows[0]!.getBoundingClientRect();
    await drag(pointOf(disabled), { x: box.left + 50, y: box.top + 50 });
    expect(disabled).not.toHaveAttribute('data-dragging');
    expect(drops).toEqual([]);
  });
});
