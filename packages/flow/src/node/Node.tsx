import { createContext, createMemo, onCleanup, onSettled, Show, untrack, useContext } from 'solid-js';
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
  /** The Node's name for assistive technology and announcements. Defaults to its text content. */
  'aria-label'?: string;
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

/** How a `<Port>` gets its Node to measure it: once it is in the page, and again whenever it moves. */
export interface NodeMeasuring {
  /** Measures the Port element now and whenever it resizes; the returned function stops that. */
  observePort(element: HTMLElement): () => void;
  /** Measures the Node and its Ports again. */
  measure(): void;
}

export const NodeMeasuringContext = createContext<NodeMeasuring>(undefined, { name: 'NodeMeasuring' });

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
 * Render it inside a `<Flow>`, usually with `<For each={state.nodes}>`. While the Flow renders only what is in sight,
 * its element and content are rendered only then, and its Measured size is kept in between (ADR 0015).
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

  // Whether its element is rendered (ADR 0015): while it is in sight, selected, dragged, focused or part of a Connection.
  const shown = createMemo(
    () => {
      if (!internals.culling() || record()?.selected || internals.dragging(name) || internals.nodeHeld(name)) return true;
      const size = internals.measuredSize(name) ?? record()?.size;
      // Without a size yet it is placed by its position, so it renders, and is measured, once it is near.
      return internals.inSight({ ...position(), width: size?.width ?? 0, height: size?.height ?? 0 });
    },
    { name: `node:${name}:shown` },
  );

  internals.nodeOptions.set(name, {
    get keepInParent() {
      return props.keepInParent ?? false;
    },
    get label() {
      return props['aria-label'];
    },
    get shown() {
      return shown();
    },
  });
  onCleanup(() => {
    internals.nodeOptions.delete(name);
    // Disposal is an owned scope, where state may not be written: forget what was measured just after, unless a Node
    // with the same id has been rendered since.
    queueMicrotask(() => {
      if (internals.nodeOptions.has(name)) return;
      internals.setMeasuredSize(name, undefined);
      internals.setMeasuredPorts(name, undefined);
      internals.setNodeText(name, undefined);
      internals.portInfo.delete(name);
    });
  });

  // Ports rendered with <Port> register here, so one added after the Node is in the page is observed too.
  const portElements = new Set<HTMLElement>();
  // A Port being removed is still in the page while it cleans up: it must not be measured again.
  const removedPorts = new WeakSet<Element>();
  let observer: ResizeObserver | undefined;
  let measure: (() => void) | undefined;
  const measuring: NodeMeasuring = {
    observePort: (port) => {
      portElements.add(port);
      observer?.observe(port);
      measure?.();
      return () => {
        portElements.delete(port);
        removedPorts.add(port);
        observer?.unobserve(port);
        // Called while the Port is disposed, where state may not be written: measure just after.
        queueMicrotask(() => measure?.());
      };
    },
    measure: () => measure?.(),
  };

  // The element, rendered while the Node is shown. Measuring starts when it is in the page and stops when it leaves; what
  // was measured stays until the Node itself is gone.
  const Element = (): JSX.Element => {
    let element: HTMLDivElement | undefined;
    onSettled(() => {
      const node = element!;
      const readText = () => internals.setNodeText(name, node.textContent?.replace(/\s+/g, ' ').trim() || undefined);
      readText();
      // Its text can change without changing its size.
      const texts = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(readText);
      texts?.observe(node, { characterData: true, childList: true, subtree: true });
      // Measured in layout pixels, which the Viewport's transform doesn't change (ADR 0015).
      measure = () => {
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        // A Node with no area isn't laid out (hidden, or no layout at all): nothing in it can be measured.
        if (!width && !height) {
          internals.setMeasuredSize(name, undefined);
          internals.setMeasuredPorts(name, undefined);
          return;
        }
        internals.setMeasuredSize(name, { width, height });
        const box = node.getBoundingClientRect();
        const zoom = box.width && width ? box.width / width : 1;
        const ports: Record<string, MeasuredPort> = {};
        for (const port of node.querySelectorAll<HTMLElement>('[data-flow-port]')) {
          // Ports of this Node only: a Port's own Node is the closest one around it.
          if (port.closest('[data-flow-node]') !== node || removedPorts.has(port)) continue;
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
      observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
      observer?.observe(node);
      for (const port of node.querySelectorAll('[data-flow-port]')) observer?.observe(port);
      for (const port of portElements) observer?.observe(port);
      const detach = attachNodeDrag(node, id, flow, internals, () => props.dragHandle);
      return () => {
        observer?.disconnect();
        observer = undefined;
        texts?.disconnect();
        measure = undefined;
        detach();
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
        tabindex="-1"
        role="group"
        aria-roledescription={internals.messages().node}
        aria-label={internals.nodeName(props.id)}
        data-selected={record()?.selected ? '' : undefined}
        data-draggable={flow.interactive() && record()?.draggable !== false ? '' : undefined}
        data-dragging={internals.dragging(props.id) ? '' : undefined}
        data-drop-target={internals.dropTarget() === props.id ? '' : undefined}
        style={style()}
      >
        <NodeContext value={{ id }}>
          <NodeMeasuringContext value={measuring}>{props.children}</NodeMeasuringContext>
        </NodeContext>
      </div>
    );
  };

  // The slot is always in the page, so a Node coming into sight or leaving it changes only what is inside it.
  return (
    <div class="slp-flow-node-slot" style={{ display: 'contents' }}>
      <Show when={shown()}>
        <Element />
      </Show>
    </div>
  );
}
