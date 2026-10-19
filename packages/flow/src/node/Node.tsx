import { createContext, createMemo, onCleanup, onSettled, untrack, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow } from '../flow/Flow';
import { useFlowInternals, type MeasuredPort } from '../flow/internals';
import { absolutePosition } from '../geometry/geometry';
import type { Point, Side } from '../model/model';
import { attachNodeDrag } from './drag';

export interface NodeProps {
  /** The id of the record in the Flow's state this Node draws. */
  id: string;
  /** Dragging starts only on elements inside the Node matching this selector. */
  dragHandle?: string;
  /** Keep the Node inside its Parent while dragging. */
  keepInParent?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

export interface NodeApi {
  /** The id of the Node this is rendered in. */
  id(): string;
}

const NodeContext = createContext<NodeApi>(undefined, { name: 'Node' });

/** Inside a `<Node>`'s content: which Node it is. Throws outside a Node. */
export const useNode = (): NodeApi => useContext(NodeContext);

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** The side of a box a point inside it is closest to. */
function nearestSide(point: Point, width: number, height: number): Side {
  const distances: [Side, number][] = [
    ['top', point.y],
    ['right', width - point.x],
    ['bottom', height - point.y],
    ['left', point.x],
  ];
  return distances.reduce((nearest, next) => (next[1] < nearest[1] ? next : nearest))[0];
}

/**
 * One Node of the Flow, drawn at its record's position (absolute through its Parents), with the app's JSX as content.
 * Render it inside a `<Flow>`, usually with `<For each={state.nodes}>`.
 */
export function Node(props: NodeProps): JSX.Element {
  const flow = useFlow();
  const internals = useFlowInternals();
  const id = () => props.id;
  const record = () => flow.index().node(props.id);
  const name = untrack(() => props.id, false);
  const position = createMemo(() => absolutePosition(flow.index(), props.id) ?? { x: 0, y: 0 }, {
    name: `node:${name}:position`,
    equals: samePoint,
  });
  let element: HTMLDivElement | undefined;

  internals.nodeOptions.set(name, {
    get keepInParent() {
      return props.keepInParent ?? false;
    },
  });
  onCleanup(() => internals.nodeOptions.delete(name));

  onSettled(() => {
    const node = element!;
    // Measured in layout pixels, which the Viewport's transform doesn't change (ADR 0015).
    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      internals.setMeasuredSize(name, width || height ? { width, height } : undefined);
      const box = node.getBoundingClientRect();
      const zoom = box.width && width ? box.width / width : 1;
      const ports: Record<string, MeasuredPort> = {};
      for (const port of node.querySelectorAll<HTMLElement>('[data-flow-port]')) {
        // Ports of this Node only: a Port's own Node is the closest one around it.
        if (port.closest('[data-flow-node]') !== node) continue;
        const rect = port.getBoundingClientRect();
        const centre = {
          x: (rect.left + rect.width / 2 - box.left) / zoom,
          y: (rect.top + rect.height / 2 - box.top) / zoom,
        };
        const side = port.getAttribute('data-flow-port-side') as Side | null;
        ports[port.getAttribute('data-flow-port')!] = { ...centre, side: side ?? nearestSide(centre, width, height) };
      }
      internals.setMeasuredPorts(name, Object.keys(ports).length ? ports : undefined);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(node);
    for (const port of node.querySelectorAll('[data-flow-port]')) observer?.observe(port);
    const detach = attachNodeDrag(node, id, flow, internals, () => props.dragHandle);
    return () => {
      observer?.disconnect();
      detach();
      internals.setMeasuredSize(name, undefined);
      internals.setMeasuredPorts(name, undefined);
    };
  });

  const style = (): JSX.CSSProperties => {
    const { x, y } = position();
    const size = record()?.size;
    return {
      transform: `translate(${x}px, ${y}px)`,
      'z-index': internals.zOrder(props.id),
      width: size ? `${size.width}px` : undefined,
      height: size ? `${size.height}px` : undefined,
      ...props.style,
    };
  };

  return (
    <div
      ref={(node) => (element = node)}
      class={props.class ? `slp-flow-node ${props.class}` : 'slp-flow-node'}
      data-flow-node={props.id}
      data-selected={record()?.selected ? '' : undefined}
      data-draggable={flow.interactive() && record()?.draggable !== false ? '' : undefined}
      data-dragging={internals.dragging(props.id) ? '' : undefined}
      data-drop-target={internals.dropTarget() === props.id ? '' : undefined}
      style={style()}
    >
      <NodeContext value={{ id }}>{props.children}</NodeContext>
    </div>
  );
}
