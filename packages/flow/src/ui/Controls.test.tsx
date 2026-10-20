import { ActionIcon } from '@solid-slopkit/components';
import { captureArtifact } from '../../test/capture';
import { flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';

import { renderEditor, type EditorOptions } from '../../test/editor';
import type { FlowNode, FlowState } from '../model/model';
import { Controls, type ControlsProps } from './Controls';

const node = (id: string, x: number, selected = false): FlowNode => ({
  id,
  position: { x, y: 0 },
  size: { width: 100, height: 100 },
  selected,
  data: null,
});
const state: FlowState = { nodes: [node('a', 0, true), node('b', 300)], edges: [] };

function editor(props: ControlsProps = {}, options: EditorOptions = {}) {
  const result = renderEditor(state, { ...options, children: () => <Controls {...props} /> });
  flush();
  const controls = () => result.root().querySelector<HTMLElement>('.slp-flow-controls')!;
  const button = (name: string) => controls().querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
  const click = (name: string) => {
    fireEvent.click(button(name));
    flush();
  };
  return { ...result, controls, button, click };
}

describe('<Controls>', () => {
  test('a named group of buttons in a corner over the Viewport, after it', () => {
    const { root, controls } = editor();
    expect(controls().parentElement).toBe(root());
    expect(controls().compareDocumentPosition(root().querySelector('.slp-flow-viewport')!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(controls().getAttribute('role')).toBe('group');
    expect(controls().getAttribute('aria-label')).toBe('Flow controls');
    expect(controls().hasAttribute('data-flow-panel')).toBe(true);
    expect(controls().dataset.position).toBe('bottom-left');
    expect(controls().dataset.orientation).toBe('vertical');
    expect([...controls().querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit view',
      'Lock editing',
    ]);
  });

  test('zoom in and out step the zoom around the centre, within the limits', () => {
    const { click, api } = editor({}, { flow: { width: 600, height: 400, maxZoom: 1.5 } });
    click('Zoom in');
    expect(api().viewport()).toEqual({ x: -60, y: -40, zoom: 1.2 });
    click('Zoom in');
    click('Zoom in');
    expect(api().viewport().zoom).toBe(1.5);
    click('Zoom out');
    expect(api().viewport().zoom).toBeCloseTo(1.25);
  });

  test('fit view shows every Node, or what fitViewOptions asks for', () => {
    const { click, api } = editor({ fitViewOptions: { nodes: ['b'], padding: 0 } }, { flow: { width: 600, height: 400 } });
    click('Fit view');
    // Node b (300..400, 0..100) at the zoom limit, 2, centred.
    expect(api().viewport()).toEqual({ x: -400, y: 100, zoom: 2 });
  });

  test('the lock button locks editing: no Batches, no dragging, until it is pressed again', () => {
    const { click, button, api, root, nodeElement, batches } = editor();
    expect(button('Lock editing').getAttribute('aria-pressed')).toBe('false');
    click('Lock editing');
    expect(api().locked()).toBe(true);
    expect(api().interactive()).toBe(false);
    expect(button('Lock editing').getAttribute('aria-pressed')).toBe('true');
    expect(button('Lock editing').hasAttribute('data-pressed')).toBe(true);
    expect(nodeElement('a').hasAttribute('data-draggable')).toBe(false);
    fireEvent.keyDown(root(), { key: 'Delete' });
    expect(batches).toEqual([]);
    click('Lock editing');
    expect(api().interactive()).toBe(true);
    fireEvent.keyDown(root(), { key: 'Delete' });
    expect(batches).toHaveLength(1);
  });

  test('keys pressed on its buttons are theirs, not the Selection’s', () => {
    const { button, batches } = editor();
    fireEvent.keyDown(button('Zoom in'), { key: 'ArrowRight' });
    fireEvent.keyDown(button('Zoom in'), { key: 'Delete' });
    expect(batches).toEqual([]);
  });

  test('shows only the buttons asked for, then the app’s own, horizontally, in another corner', () => {
    const { controls } = editor({
      showZoom: false,
      showLock: false,
      orientation: 'horizontal',
      position: 'top-right',
      class: 'mine',
      children: <ActionIcon label="Undo">U</ActionIcon>,
    });
    expect([...controls().querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual([
      'Fit view',
      'Undo',
    ]);
    expect(controls().dataset.orientation).toBe('horizontal');
    expect(controls().dataset.position).toBe('top-right');
    expect(controls().classList.contains('mine')).toBe(true);
  });

  test('its names come from messages', () => {
    const { controls } = editor({}, { flow: { messages: { controls: 'Steuerung', zoomIn: 'Vergrößern' } } });
    expect(controls().getAttribute('aria-label')).toBe('Steuerung');
    expect(controls().querySelector('button')!.getAttribute('aria-label')).toBe('Vergrößern');
  });

  test('zooming re-runs nothing of the Nodes or Edges', async () => {
    const { button, api } = editor();
    const { artifact } = await captureArtifact(() => fireEvent.click(button('Zoom in')), { scenario: 'zoom-in' });
    expect(api().viewport().zoom).toBe(1.2);
    expect(artifact).toHaveNoDiagnostics();
    expect(artifact).toStayWithinRerunBudget(0, { scope: /^node:|^edge:|flowIndex/ });
  });
});
