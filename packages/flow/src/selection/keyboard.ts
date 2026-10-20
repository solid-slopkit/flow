// The keyboard on a focused Flow: arrow keys move the Selection, Delete and Backspace remove it, Escape cancels a
// Connection or clears the Selection. Each key press is one Batch without a phase (ADR 0014).
import { keepFocus } from '../accessibility/focus';
import { removal } from '../changes/apply';
import type { Change } from '../changes/changes';
import type { FlowApi } from '../flow/Flow';
import { PANEL } from '../flow/gestures';
import { selectedIds, selectionChanges, topmost } from './select';

/** Keys typed here belong to the field, not the Flow. */
export const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** How far, in Flow coordinates, an arrow key moves the Selection; with Shift, the bigger step. */
const STEP = 1;
const BIG_STEP = 10;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function attachKeyboard(root: HTMLElement, flow: FlowApi, cancelConnection: () => boolean): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    const target = event.target instanceof Element ? event.target : undefined;
    if (target?.closest(`${EDITABLE}, ${PANEL}`)) return;
    const state = flow.state();

    if (event.key === 'Escape') {
      if (cancelConnection()) {
        event.preventDefault();
        return;
      }
      const changes = selectionChanges(state, { nodes: new Set(), edges: new Set() });
      if (!changes.length) return;
      event.preventDefault();
      flow.emit({ changes });
      return;
    }
    if (!flow.interactive()) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = selectedIds(state);
      if (!selected.nodes.size && !selected.edges.size) return;
      event.preventDefault();
      const change = removal(state, { nodes: [...selected.nodes], edges: [...selected.edges] });
      keepFocus(root, change);
      flow.emit({ changes: [change] });
      return;
    }

    const arrow = ARROWS[event.key];
    if (!arrow) return;
    const index = flow.index();
    const movable = state.nodes.filter((node) => node.selected && node.draggable !== false).map((node) => node.id);
    if (!movable.length) return;
    event.preventDefault();
    const step = event.shiftKey ? BIG_STEP : STEP;
    const changes: Change[] = topmost(index, movable).map((id) => {
      const from = index.node(id)!.position;
      return { type: 'move', node: id, from: { ...from }, to: { x: from.x + arrow[0] * step, y: from.y + arrow[1] * step } };
    });
    flow.emit({ changes });
  };

  root.addEventListener('keydown', onKeyDown);
  return () => root.removeEventListener('keydown', onKeyDown);
}
