// Dragging from a palette onto a Flow, on Pointer Events with pointer capture rather than native drag and drop
// (ADR 0022): the dragged element itself follows the pointer, and the Flow under it on release gets `onDrop`.
import { createSignal, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';

import type { Point } from '../model/model';
import { DRAG_THRESHOLD } from '../node/drag';

/** What a Flow does with a drop: `point` is the screen point of the release. */
type DropTarget = (data: unknown, point: Point) => void;

/** The Flows in the page that take drops, by root element. */
const dropTargets = new Map<Element, DropTarget>();

/** Makes a Flow's root take drops from `<FlowDraggable>`s; the returned function stops it. */
export function registerDropTarget(root: Element, drop: DropTarget): () => void {
  dropTargets.set(root, drop);
  return () => {
    if (dropTargets.get(root) === drop) dropTargets.delete(root);
  };
}

/** The topmost Flow under a screen point, looking through `dragged`. */
function flowAt(point: Point, dragged: Element): DropTarget | undefined {
  for (const element of document.elementsFromPoint(point.x, point.y)) {
    if (dragged.contains(element)) continue;
    const root = element.closest('.slp-flow');
    // The first element that isn't the dragged one decides: a Flow covered by something else takes no drop.
    return root ? dropTargets.get(root) : undefined;
  }
  return undefined;
}

export interface FlowDraggableProps<T = unknown> {
  /** Handed to the Flow's `onDrop` when this is dropped on it. */
  data: T;
  /** Nothing drags while `true`. */
  disabled?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

/**
 * An element outside the Flow, such as a palette entry, that can be dragged onto any Flow in the page. While dragged it
 * follows the pointer; released over a Flow, that Flow calls `onDrop({ data, position })`. It snaps back either way.
 */
export function FlowDraggable<T = unknown>(props: FlowDraggableProps<T>): JSX.Element {
  let element: HTMLDivElement | undefined;
  const [offset, setOffset] = createSignal<Point | undefined>(undefined, { name: 'flowDraggable' });

  onSettled(() => {
    const target = element!;
    let drag: { pointer: number; from: Point; started: boolean } | undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (drag || props.disabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      drag = { pointer: event.pointerId, from: { x: event.clientX, y: event.clientY }, started: false };
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Not an active pointer (a synthetic event).
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const delta = { x: event.clientX - drag.from.x, y: event.clientY - drag.from.y };
      if (!drag.started && Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) return;
      drag.started = true;
      setOffset(delta);
    };
    const finish = (event: PointerEvent, cancelled: boolean) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { started } = drag;
      drag = undefined;
      if (!started) return;
      setOffset(undefined);
      if (cancelled) return;
      const point = { x: event.clientX, y: event.clientY };
      flowAt(point, target)?.(props.data, point);
    };
    const onPointerUp = (event: PointerEvent) => finish(event, false);
    const onPointerCancel = (event: PointerEvent) => finish(event, true);

    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerCancel);
    return () => {
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerCancel);
    };
  });

  const style = (): JSX.CSSProperties => {
    const moved = offset();
    return { transform: moved && `translate(${moved.x}px, ${moved.y}px)`, ...props.style };
  };

  return (
    <div
      ref={(div) => (element = div)}
      class={props.class ? `slp-flow-draggable ${props.class}` : 'slp-flow-draggable'}
      data-flow-draggable
      data-dragging={offset() ? '' : undefined}
      data-disabled={props.disabled ? '' : undefined}
      style={style()}
    >
      {props.children}
    </div>
  );
}
