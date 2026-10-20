import { children, createContext, createMemo, createUniqueId, onCleanup, Show, untrack, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow } from '../flow/Flow';
import { useFlowInternals, type EdgeLayers } from '../flow/internals';
import { edgeEnds, nodeBounds, type EndPoint } from '../geometry/geometry';
import type { FlowIndex } from '../model/flow-index';
import type { EdgeShapeName, FlowEdge } from '../model/model';
import { pathPoints, pointsBounds } from '../viewport/visible';
import { edgeShapes, type EdgeGeometry, type EdgeShape, type EdgeShapeContext } from './shapes';

export type EdgeMarkerType = 'arrow' | 'arrow-closed';

/** A marker at an Edge's end: its type, and its size in stroke widths (default 8). */
export type EdgeMarker = EdgeMarkerType | { type: EdgeMarkerType; size?: number };

export interface EdgeProps {
  /** The id of the record in the Flow's state this Edge draws. It doesn't change for the life of the Edge. */
  id: string;
  /** Overrides the record's `shape`: a built-in shape by name, or the app's own shape function. */
  shape?: EdgeShapeName | EdgeShape;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  /** Dragging either end moves it to another Port, or off any Port to remove the Edge. Defaults to `true`. */
  reconnectable?: boolean;
  /** HTML drawn at the Edge's label point, in the label layer above the Nodes. */
  label?: JSX.Element;
  /** The Edge's name for assistive technology. Defaults to `messages.edgeLabel`, from its Nodes' names. */
  'aria-label'?: string;
  class?: string;
  style?: JSX.CSSProperties;
  /** SVG drawn instead of the default `<EdgePath />`, for a custom Edge. Read the Edge through `useEdge()`. */
  children?: JSX.Element;
}

/** Inside an `<Edge>`'s content and label: the Edge, where it runs and how it is drawn. Every member is reactive. */
export interface EdgeApi<E = unknown> {
  id(): string;
  /** The Edge's record. */
  edge(): FlowEdge<E> | undefined;
  selected(): boolean;
  /** The Source end in Flow coordinates, with the side the Edge leaves from. `undefined` until it can be placed. */
  source(): EndPoint | undefined;
  target(): EndPoint | undefined;
  /** The shape's output: the SVG path data `d`, and the `label` point. `undefined` until both ends can be placed. */
  geometry(): EdgeGeometry | undefined;
  /** `url(#…)` of the start marker, for a custom path's `marker-start`; `undefined` without one. */
  markerStart(): string | undefined;
  markerEnd(): string | undefined;
}

const EdgeContext = createContext<EdgeApi<any>>(undefined, { name: 'Edge' });

/** Inside an `<Edge>`'s content or label: the Edge it draws. Throws outside an Edge. */
export function useEdge<E = unknown>(): EdgeApi<E> {
  return useContext(EdgeContext);
}

/** The Nodes a Node is nested in, innermost first, stopping at a cycle. */
function parentsOf(index: FlowIndex, id: string): string[] {
  const parents: string[] = [];
  for (let parent = index.node(id)?.parent; parent !== undefined && parent !== id && !parents.includes(parent);) {
    parents.push(parent);
    parent = index.node(parent)?.parent;
  }
  return parents;
}

const sameEnd = (a: EndPoint, b: EndPoint) => a.x === b.x && a.y === b.y && a.side === b.side;
const sameEnds = (a: { source: EndPoint; target: EndPoint } | undefined, b: typeof a) =>
  a === b || (!!a && !!b && sameEnd(a.source, b.source) && sameEnd(a.target, b.target));

const MARKER_PATHS: Record<EdgeMarkerType, string> = {
  arrow: 'M 1 1 L 9 5 L 1 9',
  'arrow-closed': 'M 1 1 L 9 5 L 1 9 Z',
};

/** A marker defined inside its Edge, so it inherits the Edge's `color` and follows its stroke. */
function Marker(props: { id: string; marker: EdgeMarker }) {
  const type = () => (typeof props.marker === 'string' ? props.marker : props.marker.type);
  const size = () => (typeof props.marker === 'string' ? undefined : props.marker.size) ?? 8;
  return (
    <marker
      id={props.id}
      class="slp-flow-marker"
      data-marker={type()}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth={size()}
      markerHeight={size()}
      orient="auto-start-reverse"
    >
      <path d={MARKER_PATHS[type()]} />
    </marker>
  );
}

/** The Edge's line along its shape, with its markers: what an `<Edge>` draws by default. Use it in a custom Edge. */
export function EdgePath(props: { class?: string; style?: JSX.CSSProperties }): JSX.Element {
  const edge = useEdge();
  return (
    <path
      class={props.class ? `slp-flow-edge-path ${props.class}` : 'slp-flow-edge-path'}
      d={edge.geometry()?.d}
      marker-start={edge.markerStart()}
      marker-end={edge.markerEnd()}
      style={props.style}
    />
  );
}

/**
 * One Edge of the Flow, drawn in the SVG Edge layer between its two ends, with its label in the label layer. Render it
 * inside a `<Flow>`, usually with `<For each={state.edges}>`. Nothing is drawn until both ends can be placed, nor, while
 * the Flow renders only what is in sight, while its line is out of sight.
 */
export function Edge(props: EdgeProps): JSX.Element {
  const flow = useFlow();
  const internals = useFlowInternals();
  const name = untrack(() => props.id, false);
  const record = () => flow.index().edge(props.id);
  const markerId = createUniqueId();

  const ends = createMemo(
    () => {
      const edge = record();
      return edge && edgeEnds(flow.index(), edge, internals.measuredSize, (node, port) => internals.measuredPorts(node)?.[port]);
    },
    { name: `edge:${name}:ends`, equals: sameEnds },
  );
  const shape = (): EdgeShape =>
    typeof props.shape === 'function'
      ? props.shape
      : (edgeShapes[props.shape ?? record()?.shape ?? 'bezier'] ?? edgeShapes.bezier);
  const context: EdgeShapeContext = {
    get edge() {
      return record()!;
    },
    nodeBounds: (id) => nodeBounds(flow.index(), id, internals.measuredSize),
    obstacles: () => {
      const edge = record();
      if (!edge) return [];
      // Redrawn when Nodes move, except during a drag: then only when its ends move, and once the drag ends (ADR 0021).
      internals.settledNodeBoxes();
      const boxes = untrack(internals.nodeBoxes);
      const parents = new Set([...parentsOf(flow.index(), edge.source.node), ...parentsOf(flow.index(), edge.target.node)]);
      return boxes.filter((box) => !parents.has(box.id)).map((box) => box.bounds);
    },
  };
  const geometry = createMemo(
    () => {
      const current = ends();
      return current && shape()(current.source, current.target, context);
    },
    { name: `edge:${name}:geometry` },
  );

  // The box its line lies in: its ends and label point, with the control points of a built-in shape's path.
  const bounds = createMemo(
    () => {
      const current = ends();
      const drawn = geometry();
      if (!current || !drawn) return undefined;
      return pointsBounds([current.source, current.target, drawn.label, ...(pathPoints(drawn.d) ?? [])]);
    },
    { name: `edge:${name}:bounds`, lazy: true },
  );
  // Whether it is drawn while only what is in sight is (ADR 0015). Selected, focused and reconnected Edges always are.
  const shown = createMemo(
    () => {
      if (!internals.culling() || record()?.selected || internals.edgeFocused(name) || internals.reconnecting(name)) return true;
      const box = bounds();
      return !box || internals.inSight(box);
    },
    { name: `edge:${name}:shown` },
  );

  const api: EdgeApi = {
    id: () => props.id,
    edge: record,
    selected: () => record()?.selected ?? false,
    source: () => ends()?.source,
    target: () => ends()?.target,
    geometry,
    markerStart: () => (props.markerStart ? `url(#${markerId}-start)` : undefined),
    markerEnd: () => (props.markerEnd ? `url(#${markerId}-end)` : undefined),
  };

  return (
    <EdgeContext value={api}>
      <EdgeDrawing edge={props} markerId={markerId} shown={shown} />
    </EdgeContext>
  );
}

/** An invisible handle on one end of an Edge: dragging it reconnects that end. */
function EdgeEnd(props: { end: 'source' | 'target' }): JSX.Element {
  const edge = useEdge();
  const point = () => (props.end === 'source' ? edge.source() : edge.target());
  return <circle class="slp-flow-edge-end" data-flow-edge-end={props.end} cx={point()?.x} cy={point()?.y} r="10" />;
}

/** Creates the Edge's SVG and label inside its context, and hands them to the Flow's layers. Renders nothing in place. */
function EdgeDrawing(props: { edge: EdgeProps; markerId: string; shown: () => boolean }): JSX.Element {
  const internals = useFlowInternals();
  const edge = useEdge();
  const flow = useFlow();
  const placed = () => edge.geometry() !== undefined;
  const reconnectable = () => flow.interactive() && (props.edge.reconnectable ?? true);
  const ariaLabel = () => {
    if (props.edge['aria-label'] !== undefined) return props.edge['aria-label'];
    const record = edge.edge();
    return (
      record &&
      internals
        .messages()
        .edgeLabel({ source: internals.nodeName(record.source.node), target: internals.nodeName(record.target.node) })
    );
  };
  // Resolved here, so a label that is `undefined` or `false` (a condition in the app's JSX) draws no label box.
  const content = children(() => props.edge.label);
  const hasLabel = () => {
    const resolved = content();
    return resolved !== undefined && resolved !== null && resolved !== false && resolved !== '';
  };
  const transform = () => {
    const point = edge.geometry()?.label;
    return point && `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
  };

  // Its group and label box stay in the page while it is out of sight, emptied, so an Edge coming into sight or leaving
  // it changes only what is inside them (ADR 0015).
  const drawn = () => placed() && props.shown();
  const layers: EdgeLayers = {
    path: (
      <g
        class={props.edge.class ? `slp-flow-edge ${props.edge.class}` : 'slp-flow-edge'}
        data-flow-edge={props.edge.id}
        tabindex={drawn() ? '-1' : undefined}
        role="group"
        aria-roledescription={internals.messages().edge}
        aria-label={ariaLabel()}
        aria-hidden={props.shown() ? undefined : 'true'}
        data-selected={edge.selected() ? '' : undefined}
        data-reconnecting={internals.reconnecting(props.edge.id) ? '' : undefined}
        style={props.edge.style}
      >
        <Show when={props.shown()}>
          <Show when={props.edge.markerStart}>{(marker) => <Marker id={`${props.markerId}-start`} marker={marker()} />}</Show>
          <Show when={props.edge.markerEnd}>{(marker) => <Marker id={`${props.markerId}-end`} marker={marker()} />}</Show>
          <Show when={placed() && flow.interactive()}>
            <path class="slp-flow-edge-hit" d={edge.geometry()?.d} />
          </Show>
          <Show when={placed()}>{'children' in props.edge ? props.edge.children : <EdgePath />}</Show>
          <Show when={placed() && reconnectable()}>
            <EdgeEnd end="source" />
            <EdgeEnd end="target" />
          </Show>
        </Show>
      </g>
    ),
    label: (
      <Show when={hasLabel() && placed()}>
        <div
          class="slp-flow-edge-label"
          data-flow-edge-label={props.edge.id}
          data-selected={edge.selected() ? '' : undefined}
          hidden={!props.shown()}
          style={{ transform: transform() }}
        >
          <Show when={props.shown()}>{content()}</Show>
        </div>
      </Show>
    ),
  };
  internals.addEdgeLayers(layers);
  onCleanup(() => internals.removeEdgeLayers(layers));
  return undefined;
}
