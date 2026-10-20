// Connecting from the keyboard: Enter on a focused Port starts a Connection, Tab, Shift+Tab or the arrow keys move
// focus through the Ports it may end on, and Enter on one sends the same `connect` Batch a drop would. Escape cancels.
import { focusItem, focusOrder, holds, isRendered, type FocusItem } from '../accessibility/focus';
import type { FlowApi } from '../flow/Flow';
import type { FlowInternals } from '../flow/internals';
import { portPoint, type EndPoint } from '../geometry/geometry';
import type { End, Side } from '../model/model';
import { connectionCandidates, OPPOSITE, type Candidate } from './connect';
import { canStartFrom } from './rules';

/** How far, in Flow coordinates, the preview line reaches out of its Port before a target is focused. */
const STUB = 40;
const OUTWARD: Record<Side, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp']);

const sameEnd = (a: End, b: End) => a.node === b.node && a.port === b.port;

/** The Port an item of the focus order is, as an End of this Flow. */
function portOfItem(root: HTMLElement, item: FocusItem): End | undefined {
  if (isRendered(item)) return portOf(root, item);
  return 'node' in item && item.port !== undefined ? { node: item.node, port: item.port } : undefined;
}

/** The Port an element is, as an End of this Flow. */
function portOf(root: HTMLElement, element: Element): End | undefined {
  if (!element.matches('[data-flow-port]')) return undefined;
  const node = element.closest('[data-flow-node]');
  if (!node || node.closest('.slp-flow') !== root) return undefined;
  return { node: node.getAttribute('data-flow-node')!, port: element.getAttribute('data-flow-port')! };
}

/** Attaches keyboard Connections: `cancel` drops one in progress, `true` when there was one. */
export function attachKeyboardConnections(
  root: HTMLElement,
  flow: FlowApi,
  internals: FlowInternals,
): { detach: () => void; cancel: () => boolean } {
  let active: { from: End; element: HTMLElement; candidates: Candidate[]; to?: Candidate } | undefined;

  const pointOf = (end: End) =>
    portPoint(flow.index(), end, internals.measuredSize, (node, port) => internals.measuredPorts(node)?.[port]);

  const draw = () => {
    if (!active) return;
    const start = pointOf(active.from);
    if (!start) return;
    const [dx, dy] = OUTWARD[start.side];
    const end: EndPoint = (active.to && pointOf(active.to.end)) ?? {
      x: start.x + dx * STUB,
      y: start.y + dy * STUB,
      side: OPPOSITE[start.side],
    };
    internals.setConnection({ from: active.from, fromPoint: start, toPoint: end, to: active.to?.end });
  };

  const end = () => {
    active = undefined;
    internals.setConnection(undefined);
  };

  const cancel = () => {
    if (!active) return false;
    end();
    internals.announce(internals.messages().connectionCancelled);
    return true;
  };

  /** The Ports the Connection may end on that can take focus, in the Flow's Tab order (`order`). */
  const targets = (order = focusOrder(root, flow, internals)) => {
    const candidates = active!.candidates;
    return order.filter((item) => {
      const end = portOfItem(root, item);
      return end !== undefined && candidates.some((candidate) => sameEnd(candidate.end, end));
    });
  };

  const start = (event: KeyboardEvent, element: HTMLElement, from: End) => {
    if (!flow.interactive() || internals.connecting() || !canStartFrom(flow.index(), flow.port, from)) return;
    event.preventDefault();
    active = { from, element, candidates: connectionCandidates(flow, internals, from) };
    draw();
    const messages = internals.messages();
    internals.announce(messages.connecting({ port: from.port!, node: internals.nodeName(from.node), targets: targets().length }));
  };

  const finish = () => {
    const to = active!.to;
    if (!to) return;
    end();
    flow.emit({ changes: [{ type: 'connect', edge: { id: flow.createId(), ...to.ends, data: undefined } }] });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;
    if (!active) {
      const from = event.key === 'Enter' ? portOf(root, target) : undefined;
      if (from) start(event, target as HTMLElement, from);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      const element = active.element;
      cancel();
      if (element.isConnected) element.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      finish();
      return;
    }
    const forward =
      event.key === 'Tab' ? !event.shiftKey : NEXT.has(event.key) ? true : PREVIOUS.has(event.key) ? false : undefined;
    if (forward === undefined) return;
    event.preventDefault();
    const order = focusOrder(root, flow, internals);
    const list = targets(order);
    if (!list.length) return;
    // From the focused target to the next one, round the ends; from anywhere else to the first after it in the Tab order.
    const at = list.indexOf(target as HTMLElement);
    let next: number;
    if (at >= 0) next = (at + (forward ? 1 : -1) + list.length) % list.length;
    else {
      const here = order.findLastIndex((item) => holds(item, target));
      const after = list.findIndex((item) => order.indexOf(item) > here);
      next = forward ? (after < 0 ? 0 : after) : (after < 0 ? list.length : after) - 1;
      if (next < 0) next = list.length - 1;
    }
    focusItem(root, flow, internals, list[next]!);
  };

  /** Focus on a Port the Connection may end on makes it the target; focus anywhere else in the Flow clears it. */
  const onFocusIn = (event: FocusEvent) => {
    if (!active || !(event.target instanceof Element)) return;
    const end = portOf(root, event.target);
    active.to = end && active.candidates.find((candidate) => sameEnd(candidate.end, end));
    draw();
  };

  /** Focus leaving the Flow, or a press in it, ends the Connection. */
  const onFocusOut = (event: FocusEvent) => {
    if (active && !(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) cancel();
  };
  const onPointerDown = () => {
    if (active) cancel();
  };

  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('pointerdown', onPointerDown, true);
  return {
    detach: () => {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('pointerdown', onPointerDown, true);
      if (active) end();
    },
    cancel,
  };
}
