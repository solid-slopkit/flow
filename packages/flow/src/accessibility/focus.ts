// Keyboard focus inside a Flow. The Flow's root is its one stop in the page's Tab order; inside it, Tab and Shift+Tab
// rove over the Nodes (each followed by what can take focus inside it: its Ports and the app's own controls, in page
// order), then the Edges, in spatial order, then the built-in UI over the Flow (Controls, a MiniMap). Space or Enter
// selects the focused Node or Edge. While the Flow renders only what is in sight, the order still comes from the data:
// focus moving to a Node, Port or Edge that isn't rendered pans to it and renders it first.
import { flush } from 'solid-js';

import type { RemoveChange } from '../changes/changes';
import type { FlowApi } from '../flow/Flow';
import { PANEL } from '../flow/gestures';
import type { FlowInternals, FocusTarget } from '../flow/internals';
import { absolutePosition, edgeEnds, nodeBounds } from '../geometry/geometry';
import type { Point } from '../model/model';
import { additive } from '../selection/pointer';
import { selectedIds, selectionChanges } from '../selection/select';
import { edgeOrder, spatialOrder } from './order';

/** Elements that can take focus by themselves, before checking `tabIndex`. */
const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

const tabbable = (element: Element): element is HTMLElement | SVGElement =>
  (element instanceof HTMLElement || element instanceof SVGElement) &&
  element.tabIndex >= 0 &&
  !(element as HTMLInputElement).disabled &&
  element.closest('[inert], [aria-hidden="true"]') === null;

/** This Flow's own element for a selector, not one of a Flow nested in a Node. */
const ownedBy = (root: HTMLElement, element: Element) => element.closest('.slp-flow') === root;

/** A Node, one of its Ports, or an Edge that isn't rendered because it is out of sight. */
export type Unrendered = { node: string; port?: string } | { edge: string };

/** What Tab moves through: an element, or something to render before it can take focus. */
export type FocusItem = HTMLElement | SVGElement | Unrendered;

export const isRendered = (item: FocusItem): item is HTMLElement | SVGElement => item instanceof Element;

/** Whether an item is, or holds, this element. */
export const holds = (item: FocusItem, element: Element): boolean =>
  isRendered(item) && (item === element || item.contains(element));

/** The Node or Edge of this Flow an element is, or is inside. */
function targetOf(root: HTMLElement, element: Element): FocusTarget | undefined {
  for (let node = element.closest('[data-flow-node]'); node; node = node.parentElement?.closest('[data-flow-node]') ?? null) {
    if (ownedBy(root, node)) return { node: node.getAttribute('data-flow-node')! };
  }
  const edge = element.closest('[data-flow-edge], [data-flow-edge-label]');
  if (!edge || !ownedBy(root, edge)) return undefined;
  return { edge: (edge.getAttribute('data-flow-edge') ?? edge.getAttribute('data-flow-edge-label'))! };
}

/** The ids of a Node's Ports: those last measured, in page order, then those only declared. */
function portIds(flow: FlowApi, internals: FlowInternals, id: string): string[] {
  const ids = new Set(Object.keys(internals.measuredPorts(id) ?? {}));
  for (const spec of flow.index().node(id)?.ports ?? []) ids.add(spec.id);
  return [...ids];
}

/** The elements Tab moves through inside the Flow, in order, with what isn't rendered where it would come. */
export function focusOrder(root: HTMLElement, flow: FlowApi, internals: FlowInternals): FocusItem[] {
  const state = flow.state();
  const nodes = spatialOrder(state, flow.index());
  const nodeElements = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-flow-node]')) {
    if (ownedBy(root, element)) nodeElements.set(element.getAttribute('data-flow-node')!, element);
  }
  const edgeElements = new Map<string, SVGElement>();
  // Only placed Edges take focus: an Edge that isn't drawn has no tabindex.
  for (const element of root.querySelectorAll<SVGElement>('[data-flow-edge][tabindex]')) {
    if (ownedBy(root, element)) edgeElements.set(element.getAttribute('data-flow-edge')!, element);
  }

  const culling = internals.culling();
  const order: FocusItem[] = [];
  for (const id of nodes) {
    const element = nodeElements.get(id);
    if (!element) {
      if (culling && !internals.nodeShown(id)) {
        order.push({ node: id });
        for (const port of portIds(flow, internals, id)) order.push({ node: id, port });
      }
      continue;
    }
    order.push(element);
    for (const inner of element.querySelectorAll(FOCUSABLE)) {
      if (inner.closest('[data-flow-node]') !== element) continue;
      if (inner.hasAttribute('data-flow-port') || tabbable(inner)) order.push(inner as HTMLElement);
    }
  }
  for (const id of edgeOrder(state, nodes)) {
    const element = edgeElements.get(id);
    if (element) order.push(element);
    else if (culling && edgeCentre(flow, internals, id)) order.push({ edge: id });
  }
  for (const panel of root.querySelectorAll(PANEL)) {
    if (!ownedBy(root, panel)) continue;
    for (const inner of panel.querySelectorAll(FOCUSABLE)) if (tabbable(inner)) order.push(inner);
  }
  return order;
}

/** The midpoint between an Edge's ends, in Flow coordinates, when both can be placed. */
function edgeCentre(flow: FlowApi, internals: FlowInternals, id: string): Point | undefined {
  const edge = flow.index().edge(id);
  const ends =
    edge && edgeEnds(flow.index(), edge, internals.measuredSize, (node, port) => internals.measuredPorts(node)?.[port]);
  return ends && { x: (ends.source.x + ends.target.x) / 2, y: (ends.source.y + ends.target.y) / 2 };
}

/** A Node's centre in Flow coordinates, else its position while it has no size. */
function nodeCentre(flow: FlowApi, internals: FlowInternals, id: string): Point | undefined {
  const bounds = nodeBounds(flow.index(), id, internals.measuredSize);
  return bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : absolutePosition(flow.index(), id);
}

/** Centres the Viewport on what isn't rendered, renders it (it counts as focused from now), and finds its element. */
function reveal(root: HTMLElement, flow: FlowApi, internals: FlowInternals, item: Unrendered) {
  const centre = 'edge' in item ? edgeCentre(flow, internals, item.edge) : nodeCentre(flow, internals, item.node);
  if (centre) {
    const viewport = flow.viewport();
    const { width, height } = flow.size();
    flow.setViewport({ ...viewport, x: width / 2 - centre.x * viewport.zoom, y: height / 2 - centre.y * viewport.zoom });
  }
  internals.setFocused('edge' in item ? { edge: item.edge } : { node: item.node });
  flush();
  const owned = <T extends Element>(selector: string) =>
    [...root.querySelectorAll<T>(selector)].find((element) => ownedBy(root, element));
  if ('edge' in item) return owned<SVGElement>(`[data-flow-edge="${CSS.escape(item.edge)}"][tabindex]`);
  const node = owned<HTMLElement>(`[data-flow-node="${CSS.escape(item.node)}"]`);
  if (!node || item.port === undefined) return node;
  return [...node.querySelectorAll<HTMLElement>(`[data-flow-port="${CSS.escape(item.port)}"]`)].find(
    (port) => port.closest('[data-flow-node]') === node,
  );
}

/**
 * Focuses an item of the Flow's focus order: an element as `focusInFlow` does, and what isn't rendered after panning
 * to it and rendering it. `false` when it can't take focus after all (the app renders nothing for it).
 */
export function focusItem(root: HTMLElement, flow: FlowApi, internals: FlowInternals, item: FocusItem): boolean {
  const element = isRendered(item) ? item : reveal(root, flow, internals, item);
  if (element) {
    focusInFlow(root, flow, element);
    return true;
  }
  const active = root.ownerDocument.activeElement;
  internals.setFocused(active && root.contains(active) ? targetOf(root, active) : undefined);
  return false;
}

/** The first element after the Flow in the page's Tab order, where Tab goes from the Flow's last item. */
function nextAfter(root: HTMLElement): HTMLElement | undefined {
  for (const element of root.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (root.contains(element) || !(root.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (tabbable(element)) return element;
  }
  return undefined;
}

/** Focuses an element of the Flow without scrolling, and pans the Viewport to centre it when it is out of sight. */
export function focusInFlow(root: HTMLElement, flow: FlowApi, element: HTMLElement | SVGElement): void {
  element.focus({ preventScroll: true });
  const rect = element.getBoundingClientRect();
  const box = root.getBoundingClientRect();
  // No layout (or no size): nothing to show.
  if (!rect.width && !rect.height) return;
  const visible = rect.left >= box.left && rect.top >= box.top && rect.right <= box.right && rect.bottom <= box.bottom;
  if (visible) return;
  const viewport = flow.viewport();
  flow.setViewport({
    ...viewport,
    x: viewport.x + box.left + box.width / 2 - (rect.left + rect.width / 2),
    y: viewport.y + box.top + box.height / 2 - (rect.top + rect.height / 2),
  });
}

/**
 * Before records are removed: when focus is on one of them (or inside one), it moves to the Flow's root, so it isn't
 * lost with the element and the keyboard keeps working.
 */
export function keepFocus(root: HTMLElement, removal: RemoveChange): void {
  const active = root.ownerDocument.activeElement;
  if (!active || active === root || !root.contains(active)) return;
  const node = active.closest('[data-flow-node]')?.getAttribute('data-flow-node');
  const edge = active.closest('[data-flow-edge]')?.getAttribute('data-flow-edge');
  const gone =
    (node != null && removal.nodes.some((record) => record.id === node)) ||
    (edge != null && removal.edges.some((record) => record.id === edge));
  if (gone) root.focus({ preventScroll: true });
}

export function attachFocus(root: HTMLElement, flow: FlowApi, internals: FlowInternals): () => void {
  /** The last element focused inside the Flow, where Tab from the root resumes. */
  let last: Element | undefined;
  const onFocusIn = (event: FocusEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target !== root) last = event.target;
    internals.setFocused(targetOf(root, event.target));
  };
  const onFocusOut = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) internals.setFocused(undefined);
  };

  /** Focuses the first item from `from` on that takes focus, stepping by `step`; `false` when none does. */
  const focusFrom = (order: FocusItem[], from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < order.length; i += step) if (focusItem(root, flow, internals, order[i]!)) return true;
    return false;
  };

  const onTab = (event: KeyboardEvent, target: Element) => {
    const order = focusOrder(root, flow, internals);
    if (target === root) {
      if (event.shiftKey || !order.length) return;
      event.preventDefault();
      focusFrom(
        order,
        Math.max(
          order.findIndex((item) => item === last),
          0,
        ),
        1,
      );
      return;
    }
    const at = order.findLastIndex((item) => holds(item, target));
    if (event.shiftKey) {
      event.preventDefault();
      if (at <= 0 || !focusFrom(order, at - 1, -1)) root.focus({ preventScroll: true });
      return;
    }
    if (focusFrom(order, at + 1, 1)) {
      event.preventDefault();
      return;
    }
    // Past the last item: on to the page after the Flow, not to whatever the Flow holds later in the page.
    const after = nextAfter(root);
    if (after) {
      event.preventDefault();
      after.focus();
    }
  };

  /** Space or Enter on a Node or an Edge selects it alone; with Shift, Ctrl or Meta it toggles it. */
  const onSelect = (event: KeyboardEvent, target: Element) => {
    const node = target.matches('[data-flow-node]') ? target.getAttribute('data-flow-node') : null;
    const edge = target.matches('[data-flow-edge]') ? target.getAttribute('data-flow-edge') : null;
    if (node === null && edge === null) return;
    event.preventDefault();
    const state = flow.state();
    const toggle = additive(event);
    const wanted = toggle ? selectedIds(state) : { nodes: new Set<string>(), edges: new Set<string>() };
    const set = node !== null ? wanted.nodes : wanted.edges;
    const id = (node ?? edge)!;
    if (toggle && set.has(id)) set.delete(id);
    else set.add(id);
    const changes = selectionChanges(state, wanted);
    if (changes.length) flow.emit({ changes });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey) return;
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target || !ownedBy(root, target)) return;
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) onTab(event, target);
    else if (event.key === ' ' || event.key === 'Enter') onSelect(event, target);
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('keydown', onKeyDown);
  };
}
