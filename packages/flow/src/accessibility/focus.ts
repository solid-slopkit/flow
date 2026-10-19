// Keyboard focus inside a Flow. The Flow's root is its one stop in the page's Tab order; inside it, Tab and Shift+Tab
// rove over the Nodes (each followed by what can take focus inside it: its Ports and the app's own controls, in page
// order) and then the Edges, in spatial order. Space or Enter selects the focused Node or Edge.
import type { RemoveChange } from '../changes/changes';
import type { FlowApi } from '../flow/Flow';
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

/** The elements Tab moves through inside the Flow, in order. */
export function focusOrder(root: HTMLElement, flow: FlowApi): (HTMLElement | SVGElement)[] {
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

  const order: (HTMLElement | SVGElement)[] = [];
  for (const id of nodes) {
    const element = nodeElements.get(id);
    if (!element) continue;
    order.push(element);
    for (const inner of element.querySelectorAll(FOCUSABLE)) {
      if (inner.closest('[data-flow-node]') !== element) continue;
      if (inner.hasAttribute('data-flow-port') || tabbable(inner)) order.push(inner as HTMLElement);
    }
  }
  for (const id of edgeOrder(state, nodes)) {
    const element = edgeElements.get(id);
    if (element) order.push(element);
  }
  return order;
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

export function attachFocus(root: HTMLElement, flow: FlowApi): () => void {
  /** The last element focused inside the Flow, where Tab from the root resumes. */
  let last: Element | undefined;
  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target !== root) last = event.target;
  };

  const onTab = (event: KeyboardEvent, target: Element) => {
    const order = focusOrder(root, flow);
    let next: HTMLElement | SVGElement | undefined;
    if (target === root) {
      if (event.shiftKey) return;
      next = order.find((element) => element === last) ?? order[0];
    } else {
      const at = order.findLastIndex((element) => element === target || element.contains(target));
      if (event.shiftKey) {
        if (at <= 0) {
          event.preventDefault();
          root.focus({ preventScroll: true });
          return;
        }
        next = order[at - 1];
      } else if (at + 1 < order.length) next = order[at + 1];
      else {
        // Past the last item: on to the page after the Flow, not to whatever the Flow holds later in the page.
        const after = nextAfter(root);
        if (after) {
          event.preventDefault();
          after.focus();
        }
        return;
      }
    }
    if (!next) return;
    event.preventDefault();
    focusInFlow(root, flow, next);
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
  root.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('keydown', onKeyDown);
  };
}
