// Keyboard focus and connecting with real layout and real key presses: the focus ring, panning a Node into view, and
// a whole Connection made from the keyboard.
import { captureArtifact } from '@solidjs/diagnostics';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import { drag, key, pointOf, settle, SHIFT } from '../../test/input';
import type { FlowNode, FlowState } from '../model/model';
import { Port } from '../port/Port';

const node = (id: string, x: number, y = 0): FlowNode => ({ id, position: { x, y }, data: null });

const content = (record: FlowNode) => (
  <div style={{ width: '100px', height: '50px' }}>
    {record.id}
    <Port id="in" side="left" />
    <Port id="out" side="right" />
  </div>
);

const state: FlowState = { nodes: [node('a', 0), node('b', 300), node('far', 3000, 2000)], edges: [] };

async function editor(initial: FlowState = state, options: EditorOptions = {}) {
  let ids = 0;
  const result = renderEditor(initial, {
    content,
    ...options,
    flow: { createId: () => `e${++ids}`, defaultViewport: { x: 40, y: 40, zoom: 1 }, ...options.flow },
  });
  await settle();
  const port = (node: string, id: string) => result.nodeElement(node).querySelector<HTMLElement>(`[data-flow-port="${id}"]`)!;
  return { ...result, port };
}

describe('roving focus', () => {
  test('Tab from the Flow focuses the first Node with a visible ring; a click focuses without one', async () => {
    const { root, nodeElement } = await editor();
    root().focus();
    await key('Tab');
    expect(document.activeElement).toBe(nodeElement('a'));
    expect(nodeElement('a').matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(nodeElement('a')).outlineStyle).toBe('solid');
    await drag(pointOf(nodeElement('b')));
    expect(document.activeElement).toBe(nodeElement('b'));
    expect(nodeElement('b').matches(':focus-visible')).toBe(false);
  });

  test('focusing a Node out of sight pans the Viewport to it, and the Flow never scrolls', async () => {
    const { root, nodeElement, api } = await editor();
    nodeElement('b').querySelector<HTMLElement>('[data-flow-port="out"]')!.focus();
    await key('Tab');
    await settle();
    expect(document.activeElement).toBe(nodeElement('far'));
    const rect = nodeElement('far').getBoundingClientRect();
    const box = root().getBoundingClientRect();
    expect(rect.left + rect.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
    expect(rect.top + rect.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
    expect(api().viewport().x).toBeLessThan(-2000);
    expect([root().scrollLeft, root().scrollTop]).toEqual([0, 0]);
  });

  test('Space selects the focused Node', async () => {
    const { root, nodeElement, state: flow } = await editor();
    root().focus();
    await key('Tab');
    await key(' ');
    expect(flow.nodes[0]!.selected).toBe(true);
    expect(document.activeElement).toBe(nodeElement('a'));
  });
});

describe('connecting from the keyboard', () => {
  test('Enter on a Port, Tab to another, Enter connects; the preview line follows focus', async () => {
    const { root, port, state: flow } = await editor();
    port('a', 'out').focus();
    await key('Enter');
    const line = () => root().querySelector('.slp-flow-connection-path');
    expect(line()).not.toBeNull();
    expect(line()).not.toHaveAttribute('data-valid');
    await key('Tab');
    expect(document.activeElement).toBe(port('b', 'in'));
    expect(line()).toHaveAttribute('data-valid');
    // The line ends on the focused Port.
    const end = line()!.getAttribute('d')!.split(/[ ,]+/).slice(-2).map(Number);
    const target = pointOf(port('b', 'in'));
    const box = root().getBoundingClientRect();
    expect(end[0]! + 40 + box.left).toBeCloseTo(target.x, 0);
    expect(end[1]! + 40 + box.top).toBeCloseTo(target.y, 0);
    await key('Enter');
    expect(line()).toBeNull();
    expect(flow.edges).toEqual([
      { id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: undefined },
    ]);
    expect(root().querySelector('.slp-flow-live')!.textContent).toMatch(/^Connected a to b/);
  });

  test('Shift+Tab goes back round the targets; Escape cancels and returns focus', async () => {
    const { root, port, batches } = await editor();
    port('a', 'out').focus();
    await key('Enter');
    await key('Tab', SHIFT);
    expect(document.activeElement).toBe(port('a', 'in'));
    await key('Escape');
    expect(root().querySelector('.slp-flow-connection-path')).toBeNull();
    expect(document.activeElement).toBe(port('a', 'out'));
    expect(batches).toEqual([]);
  });

  test('moving between targets stays within its re-run budget', async () => {
    const { port } = await editor();
    port('a', 'out').focus();
    await key('Enter');
    await key('Tab');
    const { artifact } = await captureArtifact(() => key('Tab'), { scenario: 'keyboard-connection-target' });
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^(node|edge):/ });
    expect(artifact).toStayWithinRerunBudget(3);
  });
});
