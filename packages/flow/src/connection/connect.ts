// Connections, on Pointer Events with pointer capture (ADR 0022): dragging from a Port to make an Edge, or dragging an
// Edge's end to move it. The Connection is library state while it lasts; dropping it sends one Batch (ADR 0014).
import { removal } from '../changes/apply';
import type { Change } from '../changes/changes';
import type { FlowApi } from '../flow/Flow';
import type { FlowInternals } from '../flow/internals';
import { floatingPoint, nodeBounds, portPoint, type EndPoint } from '../geometry/geometry';
import type { End, Point, Side } from '../model/model';
import { DRAG_THRESHOLD } from '../node/drag';
import { contains } from '../node/drag-geometry';
import { canStartFrom, connectionEnds, startRole } from './rules';

/** A Connection in progress, as `useFlow().connection()` reports it. */
export interface Connection {
  /** Where it is dragged from: the Port pressed, or when reconnecting, the end of the Edge that stays. */
  from: End;
  /** When reconnecting: the Edge, and which of its ends is being moved. */
  reconnecting?: { edge: string; end: 'source' | 'target' };
  /** The point it is drawn from, in Flow coordinates, with the side it leaves. */
  fromPoint: EndPoint;
  /** The point it is drawn to: the Port it snaps to, else the pointer. */
  toPoint: EndPoint;
  /** The Port it would end on: the nearest valid one within `connectionRadius`. */
  to?: End;
}

/** A new Connection dropped on empty space: where, and the Port it started from as the end it would be. */
export type ConnectEnd = {
  /** The drop point in Flow coordinates. */
  position: Point;
  /** The starting Port, when it would be the Source: a `source` or `both` Port. */
  source?: End;
  /** The starting Port, when it would be the Target: a `target` Port. */
  target?: End;
};

export const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};
const sameEnd = (a: End, b: End) => a.node === b.node && a.port === b.port;

/** A Port a Connection may end on, and the Source and Target of the Edge it would make there. */
export type Candidate = { end: End; ends: { source: End; target: End } };
type Reconnecting = { edge: string; end: 'source' | 'target' };

/** Every Port known to the Flow, measured or declared, that a Connection from `from` may end on. */
export function connectionCandidates(
  flow: FlowApi,
  internals: FlowInternals,
  from: End,
  reconnecting?: Reconnecting,
): Candidate[] {
  const index = flow.index();
  const fromRole = reconnecting && (reconnecting.end === 'source' ? ('target' as const) : ('source' as const));
  const options = {
    fromRole,
    edge: reconnecting?.edge,
    canConnect: internals.canConnect(),
  };
  const found: Candidate[] = [];
  for (const node of flow.state().nodes) {
    const ids = new Set([...Object.keys(internals.measuredPorts(node.id) ?? {}), ...(node.ports ?? []).map((spec) => spec.id)]);
    for (const port of ids) {
      const end = { node: node.id, port };
      const ends = connectionEnds(index, flow.port, from, end, options);
      if (ends) found.push({ end, ends });
    }
  }
  return found;
}

/** Attaches the Connection gesture: `cancel` drops a Connection in progress, `true` when there was one. */
export function attachConnections(
  root: HTMLElement,
  flow: FlowApi,
  internals: FlowInternals,
): { detach: () => void; cancel: () => boolean } {
  let gesture:
    | {
        pointer: number;
        from: End;
        reconnecting?: Reconnecting;
        screen: Point;
        started: boolean;
        /** Every Port it may end on, decided once when it starts. */
        candidates: Candidate[];
        to?: Candidate;
        position: Point;
      }
    | undefined;

  const measured = (node: string) => internals.measuredSize(node);
  const ports = (node: string, port: string) => internals.measuredPorts(node)?.[port];
  const pointOf = (end: End) => portPoint(flow.index(), end, measured, ports);

  /** The valid Port the pointer is over, else the nearest one within the radius. */
  const snap = (event: PointerEvent, position: Point): Candidate | undefined => {
    const list = gesture!.candidates;
    const under = document.elementFromPoint?.(event.clientX, event.clientY)?.closest('[data-flow-port]');
    const node = under?.closest('[data-flow-node]');
    if (under && node && root.contains(node)) {
      const end = {
        node: node.getAttribute('data-flow-node')!,
        port: under.getAttribute('data-flow-port')!,
      };
      const hit = list.find((candidate) => sameEnd(candidate.end, end));
      if (hit) return hit;
    }
    const radius = internals.connectionRadius() / flow.viewport().zoom;
    let best: Candidate | undefined;
    let bestDistance = radius;
    for (const candidate of list) {
      const point = pointOf(candidate.end);
      const distance = point && Math.hypot(point.x - position.x, point.y - position.y);
      if (distance !== undefined && distance <= bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  };

  /** Where the Connection is drawn from: the starting Port, or a Floating end clipped toward the other point. */
  const fromPoint = (from: End, toward: Point): EndPoint | undefined => {
    if (from.port !== undefined) return pointOf(from);
    const bounds = nodeBounds(flow.index(), from.node, measured);
    return bounds && floatingPoint(bounds, toward);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (gesture || !flow.interactive()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : undefined;
    const handle = target?.closest('[data-flow-edge-end]');
    const index = flow.index();
    let from: End | undefined;
    let reconnecting: Reconnecting | undefined;
    if (handle && root.contains(handle)) {
      const id = handle.closest('[data-flow-edge]')?.getAttribute('data-flow-edge');
      const edge = id == null ? undefined : index.edge(id);
      if (!edge) return;
      const end = handle.getAttribute('data-flow-edge-end') === 'source' ? 'source' : 'target';
      reconnecting = { edge: edge.id, end };
      from = end === 'source' ? edge.target : edge.source;
    } else {
      const port = target?.closest('[data-flow-port]');
      const node = port?.closest('[data-flow-node]');
      if (!port || !node || !root.contains(node) || node.closest('.slp-flow') !== root) return;
      from = {
        node: node.getAttribute('data-flow-node')!,
        port: port.getAttribute('data-flow-port')!,
      };
      if (!canStartFrom(index, flow.port, from)) return;
    }
    gesture = {
      pointer: event.pointerId,
      from: { ...from },
      reconnecting,
      screen: { x: event.clientX, y: event.clientY },
      started: false,
      candidates: [],
      position: flow.screenToFlow({ x: event.clientX, y: event.clientY }),
    };
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (a synthetic event).
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    if (!gesture.started) {
      if (Math.hypot(event.clientX - gesture.screen.x, event.clientY - gesture.screen.y) < DRAG_THRESHOLD) return;
      gesture.started = true;
      gesture.candidates = connectionCandidates(flow, internals, gesture.from, gesture.reconnecting);
    }
    const position = flow.screenToFlow({ x: event.clientX, y: event.clientY });
    gesture.position = position;
    gesture.to = snap(event, position);
    const snapped = gesture.to && pointOf(gesture.to.end);
    const start = fromPoint(gesture.from, snapped ?? position);
    if (!start) return;
    internals.setConnection({
      from: gesture.from,
      reconnecting: gesture.reconnecting,
      fromPoint: start,
      toPoint: snapped ?? { ...position, side: OPPOSITE[start.side] },
      to: gesture.to?.end,
    });
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const { started, from, reconnecting, to, position } = gesture;
    gesture = undefined;
    if (!started) return;
    internals.setConnection(undefined);
    if (cancelled) return;
    const index = flow.index();
    if (reconnecting) {
      const edge = index.edge(reconnecting.edge);
      if (!edge) return;
      const current = edge[reconnecting.end];
      if (!to) flow.emit({ changes: [removal(flow.state(), { edges: [edge.id] })] });
      else if (!sameEnd(to.end, current)) {
        const change: Change = {
          type: 'reconnect',
          edge: edge.id,
          end: reconnecting.end,
          from: { ...current },
          to: to.end,
        };
        flow.emit({ changes: [change] });
      }
      return;
    }
    if (to) {
      flow.emit({
        changes: [
          {
            type: 'connect',
            edge: { id: flow.createId(), ...to.ends, data: undefined },
          },
        ],
      });
      return;
    }
    const overNode = flow.state().nodes.some((node) => {
      const bounds = nodeBounds(index, node.id, measured);
      return bounds !== undefined && contains(bounds, position);
    });
    if (overNode) return;
    const kind = flow.port(from.node, from.port!)?.kind ?? 'both';
    internals.connectEnd({ position, [startRole(kind)]: from });
  };
  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('lostpointercapture', onPointerCancel);
  const cancel = () => {
    const started = gesture?.started ?? false;
    gesture = undefined;
    if (started) internals.setConnection(undefined);
    return started;
  };
  return {
    detach: () => {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
      root.removeEventListener('lostpointercapture', onPointerCancel);
      cancel();
    },
    cancel,
  };
}
