import { createContext, createMemo, createSignal, createStore, For, onSettled, Show, untrack, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';

import type { Batch } from '../changes/changes';
import { attachConnections, type Connection, type ConnectEnd } from '../connection/connect';
import { ConnectionLine } from '../connection/ConnectionLine';
import type { ConnectionRule } from '../connection/rules';
import { attachClipboard } from '../clipboard/clipboard';
import type { ClipboardPayload } from '../clipboard/payload';
import { registerDropTarget } from '../palette/FlowDraggable';
import { attachKeyboard } from '../selection/keyboard';
import { attachSelection, type SelectionMode } from '../selection/pointer';
import { nodeBounds } from '../geometry/geometry';
import { indexFlow, type FlowIndex } from '../model/flow-index';
import type { End, FlowNode, FlowState, Point, Rect, Size } from '../model/model';
import {
  clampZoom,
  toFlow,
  toScreen,
  unionBounds,
  viewportForBounds,
  zoomAround,
  type FitOptions,
  type Viewport,
  type ZoomLimits,
} from '../viewport/viewport';
import { attachGestures } from './gestures';
import {
  FlowInternalsContext,
  type EdgeLayers,
  type FlowInternals,
  type Guide,
  type MeasuredPort,
  type NodeOptions,
  type PortInfo,
} from './internals';

export type FitViewOptions = FitOptions & {
  /** Fit these Nodes only. Defaults to every Node with a size. */
  nodes?: string[];
};

export interface FlowProps<N = unknown, E = unknown> {
  /** The app's data, usually a store. The Flow reads it and never writes it (ADR 0014). */
  state: FlowState<N, E>;
  /** Receives every edit as a Batch. The app applies what it accepts. */
  onChange?: (batch: Batch<N, E>) => void;
  /** Ids for records the Flow creates (pasted Nodes, new Edges). Defaults to `crypto.randomUUID()`. */
  createId?: () => string;
  /** `false` makes the Flow read-only: it sends no Batches. Panning and zooming still work. Defaults to `true`. */
  interactive?: boolean;
  /** A controlled Viewport: the Flow shows this one and reports changes through `onViewportChange`. */
  viewport?: Viewport;
  /** The starting Viewport when uncontrolled. Defaults to `{ x: 0, y: 0, zoom: 1 }`. */
  defaultViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  /** Defaults to 0.5. */
  minZoom?: number;
  /** Defaults to 2. */
  maxZoom?: number;
  /** The wheel pans instead of zooming; Ctrl + wheel (and a trackpad pinch) still zooms. Defaults to `false`. */
  scrollPans?: boolean;
  /** Start fitted to the Nodes. With `width` and `height` this is computed while rendering, so on the server too. */
  fitView?: boolean | FitViewOptions;
  /** Dragged Nodes snap to a grid with this spacing in Flow coordinates: one number, or `[x, y]`. */
  snapToGrid?: number | readonly [number, number];
  /**
   * While dragging, show lines where a Node's edges or centre line up with another Node's, and snap to them.
   * `threshold` is how close, in screen pixels, snaps (default 6).
   */
  alignmentGuides?: boolean | { threshold?: number };
  /**
   * Dropping dragged Nodes onto another Node nests them in it, and dropping them on empty space makes them top-level.
   * A function decides per Node and Parent (`undefined` for top level). Off by default.
   */
  reparentOnDrop?: boolean | ((node: FlowNode<N>, parent: FlowNode<N> | undefined) => boolean);
  /**
   * Whether a Connection, or a reconnected Edge, may run from `source` to `target`. Asked after Port kinds and `max`
   * allow it (ADR 0018). Every Port is allowed by default.
   */
  canConnect?: ConnectionRule;
  /** How close, in screen pixels, a dragged Connection snaps to a Port it may end on. Defaults to 20. */
  connectionRadius?: number;
  /** A new Connection was dropped on empty space, away from any Node: where, in Flow coordinates, and from which Port. */
  onConnectEnd?: (end: ConnectEnd) => void;
  /** Which Nodes the selection box (Shift-drag on empty space) selects: any it overlaps, or only those wholly inside. Defaults to `partial`. */
  selectionMode?: SelectionMode;
  /** Changes what copy and cut write: the selected Nodes, those nested in them and the Edges among them. `undefined` writes nothing. */
  transformCopy?: (payload: ClipboardPayload<N, E>) => ClipboardPayload<N, E> | undefined;
  /** Changes what a paste adds, after it has new ids and is placed. `undefined` adds nothing. */
  transformPaste?: (payload: ClipboardPayload<N, E>) => ClipboardPayload<N, E> | undefined;
  /** A `<FlowDraggable>` was dropped on the Flow: its `data`, and the drop point in Flow coordinates. */
  onDrop?: (drop: { data: unknown; position: Point }) => void;
  /** The Flow's declared width in pixels, used until it is measured, and on the server. */
  width?: number;
  /** The Flow's declared height in pixels. */
  height?: number;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

/** What `useFlow()` returns inside a Flow: its data, its Viewport and the ways to change it. */
export interface FlowApi<N = unknown, E = unknown> {
  state(): FlowState<N, E>;
  /** Lookups by id over the current state. */
  index(): FlowIndex<N, E>;
  /** Sends a Batch to the app's `onChange`; dropped when the Flow isn't interactive. */
  emit(batch: Batch<N, E>): void;
  createId(): string;
  interactive(): boolean;
  viewport(): Viewport;
  setViewport(viewport: Viewport): void;
  /** Zooms (within the limits) around a screen point, by default the Flow's centre. */
  zoomTo(zoom: number, around?: Point): void;
  zoomIn(): void;
  zoomOut(): void;
  /** A screen point (as the pointer reports it) to Flow coordinates. */
  screenToFlow(point: Point): Point;
  /** A point in Flow coordinates to a screen point. */
  flowToScreen(point: Point): Point;
  /** Shows these bounds, in Flow coordinates, whole and centred. */
  fitBounds(bounds: Rect, options?: FitOptions): void;
  /** Shows every Node with a size (or the given ones) whole and centred. Does nothing when none has a size. */
  fitView(options?: FitViewOptions): void;
  /** The Flow's size: measured in the page, else declared. */
  size(): Size;
  zoomLimits(): ZoomLimits;
  /** A Node's Measured size, while it is rendered and measured (ADR 0015). Reactive. */
  measuredSize(id: string): Size | undefined;
  /** A Port's measured centre, relative to its Node's top-left corner, and its side. Reactive. */
  measuredPort(node: string, port: string): MeasuredPort | undefined;
  /** A Port's side, kind and `max`: from its rendered `<Port>`, else from its Node's declared `ports`. */
  port(node: string, port: string): PortInfo | undefined;
  /** The Connection being dragged, if any. Reactive. */
  connection(): Connection | undefined;
}

const FlowContext = createContext<FlowApi<any, any>>(undefined, { name: 'Flow' });

/** The API of the Flow this is rendered in. Each Flow has its own, so several Flows can share a page. */
export function useFlow<N = unknown, E = unknown>(): FlowApi<N, E> {
  return useContext(FlowContext);
}

const ZOOM_STEP = 1.2;
const sameViewport = (a: Viewport, b: Viewport) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;
const sameSize = (a: Size | undefined, b: Size | undefined) => a?.width === b?.width && a?.height === b?.height;
const samePorts = (a: Record<string, MeasuredPort> | undefined, b: Record<string, MeasuredPort> | undefined) => {
  if (!a || !b) return a === b;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => b[key] && a[key]!.x === b[key].x && a[key]!.y === b[key].y && a[key]!.side === b[key].side)
  );
};
const GUIDE_THRESHOLD = 6;
const CONNECTION_RADIUS = 20;
const endKey = (end: End | undefined) => end && `${end.node}\u0000${end.port ?? ''}`;
type ConnectionMarks = { from: string | undefined; target: string | undefined; edge: string | undefined };

/**
 * The editor surface: the app's Nodes and Edges drawn in one Viewport. Its children are the app's own JSX, rendered in
 * the transformed Node layer.
 */
export function Flow<N = unknown, E = unknown>(props: FlowProps<N, E>): JSX.Element {
  let root: HTMLDivElement | undefined;
  const zoomLimits = (): ZoomLimits => ({ minZoom: props.minZoom ?? 0.5, maxZoom: props.maxZoom ?? 2 });
  const index = createMemo(() => indexFlow(props.state), { name: 'flowIndex' });
  const [measured, setMeasured] = createSignal<Size | undefined>(undefined, { name: 'flowSize', equals: sameSize });
  let latestSize: Size | undefined;
  const size = (): Size => (measured(), latestSize ?? { width: props.width ?? 0, height: props.height ?? 0 });
  const fitOptions = (): FitViewOptions | undefined => (props.fitView === true ? {} : props.fitView || undefined);

  // Measured sizes and Ports are library state keyed by Node id (ADR 0015): one key per Node, so measuring one Node
  // re-runs only what reads that Node.
  const [sizes, setSizes] = createStore<Record<string, Size>>({});
  const [ports, setPorts] = createStore<Record<string, Record<string, MeasuredPort>>>({});
  // Read through the store for tracking, answered from here so a size is current right after it is measured.
  const latestSizes = new Map<string, Size>();
  const measuredSize = (id: string) => (sizes[id], latestSizes.get(id));

  const boundsOf = (ids?: string[]) =>
    unionBounds(
      (ids ?? props.state.nodes.map((node) => node.id))
        .map((id) => nodeBounds(index(), id, measuredSize))
        .filter((bounds): bounds is Rect => bounds !== undefined),
    );

  const zOrder = createMemo(
    () => {
      const order = new Map<string, number>();
      const visit = (node: FlowNode<N>) => {
        if (order.has(node.id)) return;
        order.set(node.id, order.size);
        for (const child of index().childrenOf(node.id)) visit(child);
      };
      for (const node of props.state.nodes) if (node.parent === undefined || !index().node(node.parent)) visit(node);
      // Nodes on a cycle of Parents have no top: draw them after the rest.
      for (const node of props.state.nodes) visit(node);
      return order;
    },
    { name: 'zOrder' },
  );
  const [dragging, setDragging] = createSignal<ReadonlySet<string>>(new Set(), { name: 'dragging' });
  const [dropTarget, setDropTarget] = createSignal<string | undefined>(undefined, { name: 'dropTarget' });
  const [guides, setGuides] = createSignal<readonly Guide[]>([], {
    name: 'guides',
    equals: (a, b) =>
      a.length === b.length &&
      a.every((guide, i) => (Object.keys(guide) as (keyof Guide)[]).every((key) => guide[key] === b[i]![key])),
  });
  const [connection, setConnectionSignal] = createSignal<Connection | undefined>(undefined, { name: 'connection' });
  // The Ports and Edge a Connection marks, keyed, so only those re-run when it starts, snaps or ends, not on every move.
  const [marks, setMarks] = createStore<Record<keyof ConnectionMarks, Record<string, true>>>({ from: {}, target: {}, edge: {} });
  let marked: ConnectionMarks = { from: undefined, target: undefined, edge: undefined };
  // Whether there is a Connection, written only when it starts or ends, so a move doesn't reach what reads it.
  const [connecting, setConnecting] = createSignal(false, { name: 'connecting' });
  const setConnection = (next: Connection | undefined) => {
    setConnectionSignal(next);
    setConnecting(next !== undefined);
    const keys: ConnectionMarks = { from: endKey(next?.from), target: endKey(next?.to), edge: next?.reconnecting?.edge };
    const kinds = (Object.keys(keys) as (keyof ConnectionMarks)[]).filter((kind) => keys[kind] !== marked[kind]);
    if (!kinds.length) return;
    const previous = marked;
    marked = keys;
    setMarks((draft) => {
      for (const kind of kinds) {
        if (previous[kind] !== undefined) delete draft[kind][previous[kind]];
        if (keys[kind] !== undefined) draft[kind][keys[kind]] = true;
      }
    });
  };
  const [selectionBox, setSelectionBoxSignal] = createSignal<Rect | undefined>(undefined, { name: 'selectionBox' });
  // Written only when the box starts or ends, so its moves restyle it alone.
  const [boxShown, setBoxShown] = createSignal(false, { name: 'selectionBoxShown' });
  const setSelectionBox = (box: Rect | undefined) => {
    setSelectionBoxSignal(box);
    setBoxShown(box !== undefined);
  };
  // Each <Edge> adds its layers while it renders, so this is written from a component body by design.
  const [edgeLayers, setEdgeLayers] = createSignal<readonly EdgeLayers[]>([], { name: 'edgeLayers', ownedWrite: true });
  const internals: FlowInternals = {
    measuredSize,
    setMeasuredSize: (id, size) => {
      if (sameSize(latestSizes.get(id), size)) return;
      if (size) latestSizes.set(id, { ...size });
      else latestSizes.delete(id);
      setSizes((draft) => {
        if (!size) delete draft[id];
        else if (draft[id]) Object.assign(draft[id], size);
        else draft[id] = { ...size };
      });
      tryPendingFit();
    },
    measuredPorts: (id) => ports[id],
    setMeasuredPorts: (id, measured) => {
      if (
        samePorts(
          untrack(() => ports[id], false),
          measured,
        )
      )
        return;
      setPorts((draft) => {
        if (!measured) delete draft[id];
        else draft[id] = measured;
      });
    },
    zOrder: (id) => zOrder().get(id) ?? 0,
    nodeOptions: new Map<string, NodeOptions>(),
    portInfo: new Map<string, Map<string, PortInfo>>(),
    edgeLayers,
    addEdgeLayers: (layers) => setEdgeLayers((list) => [...list, layers]),
    removeEdgeLayers: (layers) => setEdgeLayers((list) => list.filter((entry) => entry !== layers)),
    dragging: (id) => dragging().has(id),
    setDragging,
    dropTarget,
    setDropTarget,
    guides,
    setGuides,
    snapToGrid: () => {
      const grid = props.snapToGrid;
      return grid === undefined ? undefined : typeof grid === 'number' ? [grid, grid] : grid;
    },
    guideThreshold: () =>
      props.alignmentGuides
        ? ((props.alignmentGuides === true ? undefined : props.alignmentGuides.threshold) ?? GUIDE_THRESHOLD)
        : undefined,
    reparentRule: () => {
      const rule = props.reparentOnDrop;
      return rule === true ? () => true : rule || undefined;
    },
    connection,
    connecting,
    setConnection,
    connectingFrom: (node, port) => marks.from[endKey({ node, port })!] === true,
    connectionTarget: (node, port) => marks.target[endKey({ node, port })!] === true,
    reconnecting: (edge) => marks.edge[edge] === true,
    canConnect: () => props.canConnect,
    connectionRadius: () => props.connectionRadius ?? CONNECTION_RADIUS,
    connectEnd: (end) => props.onConnectEnd?.(end),
    selectionBox,
    setSelectionBox,
    selectionMode: () => props.selectionMode ?? 'partial',
    transformCopy: (payload) => (props.transformCopy ? props.transformCopy(payload as ClipboardPayload<N, E>) : payload),
    transformPaste: (payload) => (props.transformPaste ? props.transformPaste(payload as ClipboardPayload<N, E>) : payload),
  };

  // Fitting from the declared size happens here, while rendering, so the server sends the fitted Viewport.
  let fittedWhileRendering = false;
  const initial = untrack((): Viewport => {
    const fit = fitOptions();
    const bounds = fit && props.width && props.height ? boundsOf(fit.nodes) : undefined;
    fittedWhileRendering = bounds !== undefined;
    if (fit && bounds) return viewportForBounds(bounds, { width: props.width!, height: props.height! }, zoomLimits(), fit);
    const start = props.defaultViewport ?? { x: 0, y: 0, zoom: 1 };
    return { ...start, zoom: clampZoom(start.zoom, zoomLimits()) };
  }, false);
  const [own, setOwn] = createSignal(initial, { name: 'viewport', equals: sameViewport });
  // Signal writes land at the next flush; gestures and repeated calls in one task read the latest value from here.
  let latest = initial;
  const viewport = () => props.viewport ?? (own(), latest);
  const current = () => props.viewport ?? latest;

  // Otherwise the first fit waits for sizes: it is redone as the Flow and its Nodes are measured, until every Node has a
  // size, unless the Viewport is moved first.
  let pendingFit = fittedWhileRendering ? undefined : untrack(fitOptions, false);
  let fitting = false;
  const tryPendingFit = () => {
    if (!pendingFit || !latestSize) return;
    const fit = pendingFit;
    const bounds = boundsOf(fit.nodes);
    fitting = true;
    if (bounds) fitBounds(bounds, fit);
    fitting = false;
    if (untrack(() => props.state.nodes.every((node) => measuredSize(node.id) ?? node.size), false)) pendingFit = undefined;
  };

  const setViewport = (next: Viewport) => {
    if (!fitting) pendingFit = undefined;
    const clamped = { ...next, zoom: clampZoom(next.zoom, zoomLimits()) };
    if (sameViewport(clamped, current())) return;
    latest = clamped;
    if (props.viewport === undefined) setOwn(clamped);
    props.onViewportChange?.(clamped);
  };
  const origin = (): Point => {
    const rect = root?.getBoundingClientRect();
    return { x: rect?.left ?? 0, y: rect?.top ?? 0 };
  };
  const zoomTo = (zoom: number, around?: Point) => {
    const { x, y } = origin();
    const at = around ? { x: around.x - x, y: around.y - y } : { x: size().width / 2, y: size().height / 2 };
    setViewport(zoomAround(current(), zoom, at, zoomLimits()));
  };
  const fitBounds = (bounds: Rect, options?: FitOptions) => setViewport(viewportForBounds(bounds, size(), zoomLimits(), options));

  const api: FlowApi<N, E> = {
    state: () => props.state,
    index,
    emit: (batch) => {
      if (props.interactive ?? true) props.onChange?.(batch);
    },
    createId: () => (props.createId ?? (() => crypto.randomUUID()))(),
    interactive: () => props.interactive ?? true,
    viewport,
    setViewport,
    zoomTo,
    zoomIn: () => zoomTo(current().zoom * ZOOM_STEP),
    zoomOut: () => zoomTo(current().zoom / ZOOM_STEP),
    screenToFlow: (point) => {
      const { x, y } = origin();
      return toFlow(current(), { x: point.x - x, y: point.y - y });
    },
    flowToScreen: (point) => {
      const { x, y } = origin();
      const local = toScreen(current(), point);
      return { x: local.x + x, y: local.y + y };
    },
    fitBounds,
    fitView: (options = {}) => {
      const bounds = boundsOf(options.nodes);
      if (bounds) fitBounds(bounds, options);
    },
    size,
    zoomLimits,
    measuredSize,
    measuredPort: (node, port) => ports[node]?.[port],
    port: (node, port) => {
      const rendered = internals.portInfo.get(node)?.get(port);
      if (rendered) return rendered;
      const spec = index()
        .node(node)
        ?.ports?.find((declared) => declared.id === port);
      return spec && { side: spec.side, kind: spec.kind ?? 'both', max: spec.max };
    },
    connection,
  };

  onSettled(() => {
    const element = root!;
    // A Flow with no area (not laid out yet, or hidden) keeps its declared size.
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      latestSize = width || height ? { width, height } : undefined;
      setMeasured(latestSize);
      tryPendingFit();
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    const detach = attachGestures(element, {
      viewport: current,
      setViewport,
      limits: zoomLimits,
      scrollPans: () => props.scrollPans ?? false,
    });
    const connections = attachConnections(element, api as FlowApi, internals);
    const detachSelection = attachSelection(element, api as FlowApi, internals);
    const detachKeyboard = attachKeyboard(element, api as FlowApi, connections.cancel);
    const detachClipboard = attachClipboard(element, api as FlowApi, internals);
    const unregister = registerDropTarget(element, (data, point) => {
      if (api.interactive()) props.onDrop?.({ data, position: api.screenToFlow(point) });
    });
    return () => {
      observer?.disconnect();
      detach();
      connections.detach();
      detachSelection();
      detachKeyboard();
      detachClipboard();
      unregister();
    };
  });

  const boxStyle = (): JSX.CSSProperties => {
    const box = selectionBox();
    return box ? { transform: `translate(${box.x}px, ${box.y}px)`, width: `${box.width}px`, height: `${box.height}px` } : {};
  };
  const transform = () => {
    const { x, y, zoom } = viewport();
    return `translate(${x}px, ${y}px) scale(${zoom})`;
  };

  return (
    <FlowContext value={api}>
      <FlowInternalsContext value={internals}>
        <div
          ref={(element) => (root = element)}
          class={props.class ? `slp-flow ${props.class}` : 'slp-flow'}
          style={{
            width: props.width === undefined ? undefined : `${props.width}px`,
            height: props.height === undefined ? undefined : `${props.height}px`,
            ...props.style,
          }}
          tabindex="0"
          data-flow-pane
          data-connecting={connecting() ? '' : undefined}
        >
          <div class="slp-flow-viewport" style={{ transform: transform() }} data-flow-pane>
            <svg class="slp-flow-edges" data-flow-pane>
              <For each={edgeLayers()}>{(layers) => layers.path}</For>
            </svg>
            <div class="slp-flow-nodes" data-flow-pane>
              {props.children}
            </div>
            <div class="slp-flow-labels" data-flow-pane>
              <For each={edgeLayers()}>{(layers) => layers.label}</For>
            </div>
            <ConnectionLine />
            <svg class="slp-flow-guides" data-flow-pane>
              <For each={guides()}>{(guide) => <line x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />}</For>
            </svg>
          </div>
          <Show when={boxShown()}>
            <div class="slp-flow-selection-box" style={boxStyle()} />
          </Show>
        </div>
      </FlowInternalsContext>
    </FlowContext>
  );
}
