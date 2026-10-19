import { For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';

import type { ResizeChange } from '../changes/changes';
import { useFlow } from '../flow/Flow';
import { useFlowInternals } from '../flow/internals';
import type { Point, Size } from '../model/model';
import { useNode } from './Node';

export interface NodeResizerProps {
  /** Defaults to 10. */
  minWidth?: number;
  /** Defaults to 10. */
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Keep the width-to-height ratio the Node had when the resize started. */
  keepAspectRatio?: boolean;
  /** Show the handles. Defaults to whether the Node is selected. */
  visible?: boolean;
}

/** Which edges a handle moves: -1 the left or top edge, 1 the right or bottom one, 0 neither. */
const HANDLES: { name: string; x: -1 | 0 | 1; y: -1 | 0 | 1 }[] = [
  { name: 'top-left', x: -1, y: -1 },
  { name: 'top', x: 0, y: -1 },
  { name: 'top-right', x: 1, y: -1 },
  { name: 'right', x: 1, y: 0 },
  { name: 'bottom-right', x: 1, y: 1 },
  { name: 'bottom', x: 0, y: 1 },
  { name: 'bottom-left', x: -1, y: 1 },
  { name: 'left', x: -1, y: 0 },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * The new position and size for a handle moved by `delta` (Flow coordinates) from where the resize started. The edges
 * the handle doesn't move stay where they were.
 */
export function resizeBox(
  start: { position: Point; size: Size },
  handle: { x: -1 | 0 | 1; y: -1 | 0 | 1 },
  delta: Point,
  limits: { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number; keepAspectRatio: boolean },
): { position: Point; size: Size } {
  let width = start.size.width + handle.x * delta.x;
  let height = start.size.height + handle.y * delta.y;
  if (limits.keepAspectRatio && start.size.height > 0) {
    const ratio = start.size.width / start.size.height;
    // A side handle drives its own dimension; a corner follows the one that changed more, growing or shrinking.
    const widthChange = Math.abs(width / start.size.width - 1);
    const heightChange = Math.abs(height / start.size.height - 1);
    if (handle.y === 0 || (handle.x !== 0 && widthChange >= heightChange)) height = width / ratio;
    else width = height * ratio;
    // Keep the ratio inside the limits too: the tighter of the two dimensions wins.
    const minScale = Math.max(limits.minWidth / start.size.width, limits.minHeight / start.size.height);
    const maxScale = Math.min(limits.maxWidth / start.size.width, limits.maxHeight / start.size.height);
    const scale = clamp(width / start.size.width, minScale, Math.max(minScale, maxScale));
    width = start.size.width * scale;
    height = start.size.height * scale;
  } else {
    width = clamp(width, limits.minWidth, limits.maxWidth);
    height = clamp(height, limits.minHeight, limits.maxHeight);
  }
  return {
    position: {
      x: handle.x === -1 ? start.position.x + start.size.width - width : start.position.x,
      y: handle.y === -1 ? start.position.y + start.size.height - height : start.position.y,
    },
    size: { width, height },
  };
}

/**
 * Handles on a Node's edges and corners that resize it. Place it inside the Node's content. Resizing sends `resize`
 * Batches in phases, setting the Node's Declared size.
 */
export function NodeResizer(props: NodeResizerProps): JSX.Element {
  const flow = useFlow();
  const internals = useFlowInternals();
  const node = useNode();
  const record = () => flow.index().node(node.id());
  const visible = () => flow.interactive() && (props.visible ?? record()?.selected ?? false);

  const onPointerDown = (handle: (typeof HANDLES)[number], event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const current = record();
    const size = internals.measuredSize(node.id()) ?? current?.size;
    if (!current || !size) return;
    event.stopPropagation();
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (a synthetic event).
    }
    const start = { position: { ...current.position }, size: { ...size } };
    const from = { x: event.clientX, y: event.clientY };
    let started = false;
    let last = start;

    const change = (to: { position: Point; size: Size }): ResizeChange => {
      const now = record()!;
      return {
        type: 'resize',
        node: node.id(),
        from: { position: { ...now.position }, size: now.size && { ...now.size } },
        to,
      };
    };
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      const zoom = flow.viewport().zoom;
      last = resizeBox(
        start,
        handle,
        { x: (move.clientX - from.x) / zoom, y: (move.clientY - from.y) / zoom },
        {
          minWidth: props.minWidth ?? 10,
          minHeight: props.minHeight ?? 10,
          maxWidth: props.maxWidth ?? Infinity,
          maxHeight: props.maxHeight ?? Infinity,
          keepAspectRatio: props.keepAspectRatio ?? false,
        },
      );
      flow.emit({ phase: started ? 'update' : 'start', changes: [change(last)] });
      started = true;
    };
    const onEnd = (end: PointerEvent) => {
      if (end.pointerId !== event.pointerId) return;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onEnd);
      target.removeEventListener('pointercancel', onEnd);
      if (!started) return;
      const to = end.type === 'pointercancel' ? { position: start.position, size: current.size } : last;
      flow.emit({ phase: 'end', changes: [change(to as { position: Point; size: Size })] });
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onEnd);
    target.addEventListener('pointercancel', onEnd);
  };

  return (
    <Show when={visible()}>
      <div class="slp-flow-resizer" data-flow-nodrag aria-hidden="true">
        <For each={HANDLES}>
          {(handle) => (
            <div
              class="slp-flow-resizer-handle"
              data-handle={handle.name}
              onPointerDown={(event) => onPointerDown(handle, event)}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
