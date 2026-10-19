// Dragging Nodes, on Pointer Events with pointer capture (ADR 0022). Every step goes out as a Batch of `move` Changes
// in phases (ADR 0014); dropping may add `reparent` Changes.
import type { Change } from '../changes/changes';
import type { FlowApi } from '../flow/Flow';
import type { FlowInternals } from '../flow/internals';
import { absolutePosition, nodeBounds } from '../geometry/geometry';
import type { FlowIndex } from '../model/flow-index';
import type { Point, Rect } from '../model/model';
import { isAncestor } from '../selection/select';
import { align, contains, keepInside, snapToGrid } from './drag-geometry';

/** How far, in screen pixels, the pointer moves before a press becomes a drag. */
export const DRAG_THRESHOLD = 3;

/**
 * Presses here never drag, so form controls and editable text in a Node work as on any page, and a press on a Port
 * starts a Connection instead.
 */
const NO_DRAG =
  'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), [data-flow-nodrag], [data-flow-port]';

export function attachNodeDrag(
  element: HTMLElement,
  id: () => string,
  flow: FlowApi,
  internals: FlowInternals,
  dragHandle: () => string | undefined,
): () => void {
  let drag:
    | {
        pointer: number;
        from: Point;
        started: boolean;
        /** The Nodes that move, without any whose Parent also moves; the first is the one under the pointer. */
        ids: string[];
        start: Map<string, { position: Point; absolute: Point }>;
        others: Rect[];
        delta: Point;
      }
    | undefined;

  const measured = (node: string) => internals.measuredSize(node);
  const moving = (index: FlowIndex, node: string) => drag!.ids.some((moved) => moved === node || isAncestor(index, moved, node));

  const onPointerDown = (event: PointerEvent) => {
    if (drag || !flow.interactive()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : undefined;
    const blocked = target?.closest(NO_DRAG);
    if (!target || (blocked && element.contains(blocked))) return;
    const handle = dragHandle();
    if (handle) {
      const match = target.closest(handle);
      if (!match || !element.contains(match)) return;
    }
    const index = flow.index();
    const node = index.node(id());
    if (!node || node.draggable === false) return;

    const selected = node.selected
      ? flow
          .state()
          .nodes.filter((other) => other.selected && other.draggable !== false)
          .map((other) => other.id)
      : [];
    const candidates = [node.id, ...selected.filter((other) => other !== node.id)];
    // A Node whose Parent also moves goes with it; the Node under the pointer leads, or its moving ancestor.
    const ids = candidates.filter(
      (candidate) => !candidates.some((other) => other !== candidate && isAncestor(index, other, candidate)),
    );
    const leader = ids.find((candidate) => candidate === node.id || isAncestor(index, candidate, node.id))!;
    ids.splice(ids.indexOf(leader), 1);
    ids.unshift(leader);

    drag = {
      pointer: event.pointerId,
      from: { x: event.clientX, y: event.clientY },
      started: false,
      ids,
      start: new Map(
        ids.map((moved) => [moved, { position: { ...index.node(moved)!.position }, absolute: absolutePosition(index, moved)! }]),
      ),
      others: [],
      delta: { x: 0, y: 0 },
    };
    drag.others = flow
      .state()
      .nodes.filter((other) => !moving(index, other.id))
      .map((other) => nodeBounds(index, other.id, measured))
      .filter((bounds): bounds is Rect => bounds !== undefined);
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (a synthetic event).
    }
  };

  /** The `move` Changes from where the Nodes are now to where the drag puts them. */
  const moves = (positions: Map<string, Point>): Change[] => {
    const index = flow.index();
    const changes: Change[] = [];
    for (const [moved, to] of positions) {
      const from = index.node(moved)?.position;
      if (from && (from.x !== to.x || from.y !== to.y)) changes.push({ type: 'move', node: moved, from: { ...from }, to });
    }
    return changes;
  };

  /** Where each Node goes for a pointer `delta` in Flow coordinates, after snapping and keeping Nodes in their Parents. */
  const place = (delta: Point): Map<string, Point> => {
    const index = flow.index();
    const leader = drag!.start.get(drag!.ids[0]!)!;
    const size = measured(drag!.ids[0]!) ?? index.node(drag!.ids[0]!)?.size;
    let target = { x: leader.absolute.x + delta.x, y: leader.absolute.y + delta.y };
    const threshold = internals.guideThreshold();
    const aligned =
      threshold !== undefined && size
        ? align({ ...target, ...size }, drag!.others, threshold / flow.viewport().zoom)
        : { dx: undefined, dy: undefined, guides: [] };
    const grid = internals.snapToGrid();
    target = {
      x: aligned.dx !== undefined ? target.x + aligned.dx : grid ? snapToGrid(target.x, grid[0]) : target.x,
      y: aligned.dy !== undefined ? target.y + aligned.dy : grid ? snapToGrid(target.y, grid[1]) : target.y,
    };
    internals.setGuides(aligned.guides);
    drag!.delta = { x: target.x - leader.absolute.x, y: target.y - leader.absolute.y };

    const positions = new Map<string, Point>();
    for (const moved of drag!.ids) {
      const start = drag!.start.get(moved)!;
      let to = { x: start.position.x + drag!.delta.x, y: start.position.y + drag!.delta.y };
      const node = index.node(moved);
      const parentSize = node?.parent === undefined ? undefined : (measured(node.parent) ?? index.node(node.parent)?.size);
      const ownSize = measured(moved) ?? node?.size;
      if (internals.nodeOptions.get(moved)?.keepInParent && parentSize && ownSize) to = keepInside(to, ownSize, parentSize);
      positions.set(moved, to);
    }
    return positions;
  };

  /** The Node under the pointer the dragged Nodes may be nested in; `undefined` for empty space or when not allowed. */
  const dropTarget = (point: Point): string | undefined => {
    const rule = internals.reparentRule()!;
    const index = flow.index();
    let best: string | undefined;
    for (const node of flow.state().nodes) {
      if (moving(index, node.id)) continue;
      const bounds = nodeBounds(index, node.id, measured);
      if (!bounds || !contains(bounds, point)) continue;
      if (best !== undefined && internals.zOrder(node.id) < internals.zOrder(best)) continue;
      if (drag!.ids.every((moved) => rule(index.node(moved)!, node))) best = node.id;
    }
    return best;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const screen = { x: event.clientX - drag.from.x, y: event.clientY - drag.from.y };
    if (!drag.started && Math.hypot(screen.x, screen.y) < DRAG_THRESHOLD) return;
    const zoom = flow.viewport().zoom;
    const changes = moves(place({ x: screen.x / zoom, y: screen.y / zoom }));
    if (internals.reparentRule()) internals.setDropTarget(dropTarget(flow.screenToFlow({ x: event.clientX, y: event.clientY })));
    if (!drag.started) {
      drag.started = true;
      internals.setDragging(new Set(drag.ids));
      flow.emit({ phase: 'start', changes });
    } else if (changes.length) flow.emit({ phase: 'update', changes });
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { started, ids, start, delta } = drag;
    if (started) {
      let changes: Change[];
      if (cancelled) changes = moves(new Map(ids.map((moved) => [moved, start.get(moved)!.position])));
      else {
        changes = moves(place(delta));
        const rule = internals.reparentRule();
        if (rule) {
          const index = flow.index();
          const parent = dropTarget(flow.screenToFlow({ x: event.clientX, y: event.clientY }));
          const parentAt = parent === undefined ? { x: 0, y: 0 } : absolutePosition(index, parent)!;
          for (const moved of ids) {
            const node = index.node(moved)!;
            if (node.parent === parent || internals.nodeOptions.get(moved)?.keepInParent) continue;
            if (!rule(node, parent === undefined ? undefined : index.node(parent))) continue;
            const at = start.get(moved)!.absolute;
            const position = { x: at.x + delta.x - parentAt.x, y: at.y + delta.y - parentAt.y };
            const was = changes.find((change) => change.type === 'move' && change.node === moved);
            changes.push({
              type: 'reparent',
              node: moved,
              from: { parent: node.parent, position: was?.type === 'move' ? was.to : { ...node.position } },
              to: { parent, position },
            });
          }
        }
      }
      flow.emit({ phase: 'end', changes });
      internals.setDragging(new Set());
      internals.setDropTarget(undefined);
      internals.setGuides([]);
    }
    drag = undefined;
  };
  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
  };
}
