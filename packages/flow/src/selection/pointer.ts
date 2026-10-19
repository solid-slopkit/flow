// Selecting with the pointer, on Pointer Events (ADR 0022): a click selects a Node or an Edge, a click on empty space
// clears the Selection, and Shift-dragging empty space draws the selection box. Every Selection goes out as `select`
// Changes (ADR 0014).
import type { FlowApi } from '../flow/Flow';
import { PANE } from '../flow/gestures';
import type { FlowInternals } from '../flow/internals';
import { nodeBounds } from '../geometry/geometry';
import type { Point, Rect } from '../model/model';
import { DRAG_THRESHOLD } from '../node/drag';
import { selectedIds, selectionChanges } from './select';

/** How the selection box picks Nodes: any overlap, or only Nodes wholly inside it. */
export type SelectionMode = 'partial' | 'full';

type Item = { item: 'node' | 'edge'; id: string } | { item: 'pane' };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const rectOf = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Whether the event asks to add to the Selection (or toggle) rather than replace it. */
export const additive = (event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) =>
  event.shiftKey || event.metaKey || event.ctrlKey;

export function attachSelection(root: HTMLElement, flow: FlowApi, internals: FlowInternals): () => void {
  /** A press that is a click until the pointer moves past the threshold. */
  let press: { pointer: number; screen: Point; item: Item | undefined; moved: boolean } | undefined;
  let box:
    | {
        pointer: number;
        /** Where it started, relative to the Flow's top-left corner. */
        from: Point;
        started: boolean;
        base: { nodes: Set<string>; edges: Set<string> };
      }
    | undefined;

  const local = (event: PointerEvent): Point => {
    const rect = root.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** What a press landed on: a Node of this Flow, an Edge (its line, an end or its label), or empty space. */
  const itemAt = (target: Element): Item | undefined => {
    const node = target.closest('[data-flow-node]');
    if (node && root.contains(node) && node.closest('.slp-flow') === root) {
      return { item: 'node', id: node.getAttribute('data-flow-node')! };
    }
    const edge = target.closest('[data-flow-edge], [data-flow-edge-label]');
    if (edge && root.contains(edge)) {
      return { item: 'edge', id: edge.getAttribute('data-flow-edge') ?? edge.getAttribute('data-flow-edge-label')! };
    }
    return target.hasAttribute(PANE) ? { item: 'pane' } : undefined;
  };

  const click = (item: Item, toggle: boolean) => {
    const state = flow.state();
    const wanted = toggle ? selectedIds(state) : { nodes: new Set<string>(), edges: new Set<string>() };
    if (item.item === 'pane') {
      if (toggle) return;
    } else {
      const set = item.item === 'node' ? wanted.nodes : wanted.edges;
      if (toggle && set.has(item.id)) set.delete(item.id);
      else set.add(item.id);
    }
    const changes = selectionChanges(state, wanted);
    if (changes.length) flow.emit({ changes });
  };

  /** The Selection the box makes: its Nodes, the Edges between two of them, and the base it adds to. */
  const boxSelection = (screen: Rect) => {
    const { zoom, x, y } = flow.viewport();
    const area = { x: (screen.x - x) / zoom, y: (screen.y - y) / zoom, width: screen.width / zoom, height: screen.height / zoom };
    const index = flow.index();
    const full = internals.selectionMode() === 'full';
    const nodes = new Set(box!.base.nodes);
    for (const node of flow.state().nodes) {
      const bounds = nodeBounds(index, node.id, (id) => internals.measuredSize(id));
      if (bounds && (full ? inside(bounds, area) : overlaps(bounds, area))) nodes.add(node.id);
    }
    const edges = new Set(box!.base.edges);
    for (const edge of flow.state().edges) if (nodes.has(edge.source.node) && nodes.has(edge.target.node)) edges.add(edge.id);
    return { nodes, edges };
  };

  const onPointerDown = (event: PointerEvent) => {
    if (press || box || !flow.interactive()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : undefined;
    const item = target && itemAt(target);
    if (item?.item === 'pane' && event.shiftKey) {
      const base =
        event.metaKey || event.ctrlKey ? selectedIds(flow.state()) : { nodes: new Set<string>(), edges: new Set<string>() };
      box = { pointer: event.pointerId, from: local(event), started: false, base };
      try {
        root.setPointerCapture(event.pointerId);
      } catch {
        // Not an active pointer (a synthetic event).
      }
      return;
    }
    press = { pointer: event.pointerId, screen: { x: event.clientX, y: event.clientY }, item, moved: false };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (press?.pointer === event.pointerId && !press.moved) {
      press.moved = Math.hypot(event.clientX - press.screen.x, event.clientY - press.screen.y) >= DRAG_THRESHOLD;
    }
    if (!box || event.pointerId !== box.pointer) return;
    const to = local(event);
    if (!box.started && Math.hypot(to.x - box.from.x, to.y - box.from.y) < DRAG_THRESHOLD) return;
    const screen = rectOf(box.from, to);
    internals.setSelectionBox(screen);
    const changes = selectionChanges(flow.state(), boxSelection(screen));
    if (!box.started) {
      box.started = true;
      flow.emit({ phase: 'start', changes });
    } else if (changes.length) flow.emit({ phase: 'update', changes });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (box && event.pointerId === box.pointer) {
      const { started } = box;
      box = undefined;
      if (started) {
        internals.setSelectionBox(undefined);
        flow.emit({ phase: 'end', changes: [] });
      }
      return;
    }
    if (!press || event.pointerId !== press.pointer) return;
    const { screen, item, moved } = press;
    press = undefined;
    if (!item || moved || Math.hypot(event.clientX - screen.x, event.clientY - screen.y) >= DRAG_THRESHOLD) return;
    click(item, additive(event));
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (press?.pointer === event.pointerId) press = undefined;
    if (box?.pointer !== event.pointerId) return;
    const { started } = box;
    box = undefined;
    if (started) {
      internals.setSelectionBox(undefined);
      flow.emit({ phase: 'end', changes: [] });
    }
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  return () => {
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', onPointerCancel);
    if (box?.started) internals.setSelectionBox(undefined);
  };
}
