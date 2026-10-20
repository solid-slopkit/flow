import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { describe, expect, test } from 'vitest';

import { renderEditor } from '../../test/editor';
import { render } from '../../test/render';
import { applyChanges } from '../changes/apply';
import type { FlowState } from '../model/model';
import { Node, useNode } from './Node';

const state: FlowState = {
  nodes: [
    { id: 'group', position: { x: 100, y: 50 }, size: { width: 300, height: 200 }, data: null },
    { id: 'child', parent: 'group', position: { x: 10, y: 20 }, data: null },
    { id: 'grandchild', parent: 'child', position: { x: 1, y: 2 }, selected: true, data: null },
    { id: 'later', position: { x: 0, y: 0 }, draggable: false, data: null },
  ],
  edges: [],
};

describe('<Node>', () => {
  test('is drawn at its absolute position, through its Parents', () => {
    const { nodeElement } = renderEditor(state);
    expect(nodeElement('group').style.transform).toBe('translate(100px, 50px)');
    expect(nodeElement('child').style.transform).toBe('translate(110px, 70px)');
    expect(nodeElement('grandchild').style.transform).toBe('translate(111px, 72px)');
  });

  test('renders the app’s content in the Node layer', () => {
    const { nodeElement, root } = renderEditor(state);
    expect(nodeElement('child')).toHaveTextContent('child');
    expect(nodeElement('child').parentElement!.parentElement).toBe(root().querySelector('.slp-flow-nodes'));
  });

  test('draws children above their Parent, and a later top-level Node above a whole earlier tree', () => {
    const { nodeElement } = renderEditor({
      ...state,
      // The child comes first in the data, but is still drawn above its Parent.
      nodes: [state.nodes[1]!, state.nodes[0]!, state.nodes[2]!, state.nodes[3]!],
    });
    const z = (id: string) => Number(nodeElement(id).style.zIndex);
    expect(z('group')).toBeLessThan(z('child'));
    expect(z('child')).toBeLessThan(z('grandchild'));
    expect(z('grandchild')).toBeLessThan(z('later'));
  });

  test('takes its Declared size, its class and style, and flags Selection and draggability', () => {
    const { nodeElement } = renderEditor(state, { node: () => ({ class: 'card', style: { color: 'red' } }) });
    expect(nodeElement('group').style.width).toBe('300px');
    expect(nodeElement('group').style.height).toBe('200px');
    expect(nodeElement('child').style.width).toBe('');
    expect(nodeElement('child')).toHaveClass('slp-flow-node', 'card');
    expect(nodeElement('child').style.color).toBe('red');
    expect(nodeElement('grandchild')).toHaveAttribute('data-selected');
    expect(nodeElement('child')).not.toHaveAttribute('data-selected');
    expect(nodeElement('child')).toHaveAttribute('data-draggable');
    expect(nodeElement('later')).not.toHaveAttribute('data-draggable');
  });

  test('is not draggable in a read-only Flow', () => {
    const { nodeElement } = renderEditor(state, { flow: { interactive: false } });
    expect(nodeElement('child')).not.toHaveAttribute('data-draggable');
  });

  test('useNode tells content which Node it is in', () => {
    const Label = () => <span>{useNode().id()}</span>;
    const { nodeElement } = renderEditor(state, { content: () => <Label /> });
    expect(nodeElement('child')).toHaveTextContent('child');
  });

  test('useNode outside a Node throws', () => {
    const Label = () => <span>{useNode().id()}</span>;
    expect(() => render(() => <Label />)).toThrow();
  });

  test('a Node outside a Flow throws', () => {
    expect(() => render(() => <Node id="a" />)).toThrow();
  });

  test('moving a Parent re-draws it and its descendants, nothing else', async () => {
    const { setState, nodeElement } = renderEditor(state);
    flush();
    const { artifact } = await captureArtifact(
      () => applyChanges(setState, { changes: [{ type: 'move', node: 'group', from: { x: 100, y: 50 }, to: { x: 0, y: 0 } }] }),
      { scenario: 'move-parent' },
    );
    expect(nodeElement('grandchild').style.transform).toBe('translate(11px, 22px)');
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /node:later/ });
    expect(artifact).toStayWithinRerunBudget(0, { scope: 'flowIndex' });
    expect(artifact).toStayWithinRerunBudget(1, { scope: 'node:grandchild:position' });
    // A position memo and the element's attributes for each of the three Nodes that moved.
    expect(artifact).toStayWithinRerunBudget(6);
  });
});
