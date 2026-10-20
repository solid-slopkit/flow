import { VisuallyHidden } from '@solid-slopkit/components';
import { createMemo, createUniqueId, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { useFlow } from '../flow/Flow';
import { useFlowInternals } from '../flow/internals';
import { nodeBounds } from '../geometry/geometry';
import type { FlowNode, Point, Rect } from '../model/model';
import { unionBounds } from '../viewport/viewport';
import { drawInLayer, panelClass, type PanelPosition } from './panel';

export interface MiniMapProps<N = unknown> {
  /** Defaults to `bottom-right`. */
  position?: PanelPosition;
  /** In pixels. Defaults to 200. */
  width?: number;
  /** In pixels. Defaults to 150. */
  height?: number;
  /** Each Node's fill: one color, or one per Node. Defaults to `--slp-flow-minimap-node-color`. */
  nodeColor?: string | ((node: FlowNode<N>) => string | undefined);
  /** A class for each Node's rectangle: one, or one per Node. */
  nodeClass?: string | ((node: FlowNode<N>) => string | undefined);
  /** Dragging and clicking in it pan the Flow. Defaults to `true`. */
  pannable?: boolean;
  /** The wheel over it zooms the Flow. Defaults to `true`. */
  zoomable?: boolean;
  /** Its name for assistive technology. Defaults to `messages.miniMap`. */
  'aria-label'?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

/** Space kept around the Nodes and the visible area, in the MiniMap's own pixels. */
const MARGIN = 8;
/** How far an arrow key pans, as a fraction of the visible area. */
const KEY_PAN = 0.1;
const sameRect = (a: Rect | undefined, b: Rect | undefined) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

/**
 * A small overview of the whole Flow in a corner: every Node with a size, and the visible area. Dragging in it pans
 * the Flow, a click centres the view there, and the wheel zooms. Render it inside a `<Flow>`.
 */
export function MiniMap<N = unknown>(props: MiniMapProps<N>): JSX.Element {
  const flow = useFlow<N>();
  const internals = useFlowInternals();
  const instructions = createUniqueId();
  const width = () => props.width ?? 200;
  const height = () => props.height ?? 150;
  const pannable = () => props.pannable ?? true;
  const zoomable = () => props.zoomable ?? true;

  /** The visible area in Flow coordinates; `undefined` while the Flow has no size. */
  const visible = createMemo(
    (): Rect | undefined => {
      const { x, y, zoom } = flow.viewport();
      const size = flow.size();
      if (!size.width || !size.height) return undefined;
      return { x: -x / zoom, y: -y / zoom, width: size.width / zoom, height: size.height / zoom };
    },
    { name: 'minimap:visible', equals: sameRect },
  );
  const content = createMemo(
    () =>
      unionBounds(
        flow
          .state()
          .nodes.map((node) => nodeBounds(flow.index(), node.id, flow.measuredSize))
          .filter((bounds): bounds is Rect => bounds !== undefined),
      ),
    { name: 'minimap:content', equals: sameRect },
  );
  /** What the MiniMap shows, in Flow coordinates: the Nodes and the visible area, centred, at its aspect ratio. */
  const viewBox = createMemo(
    (): Rect | undefined => {
      const shown = unionBounds([content(), visible()].filter((rect): rect is Rect => rect !== undefined));
      if (!shown) return undefined;
      const scale = Math.max(shown.width / (width() - MARGIN * 2), shown.height / (height() - MARGIN * 2), 1e-9);
      const boxWidth = width() * scale;
      const boxHeight = height() * scale;
      return {
        x: shown.x + shown.width / 2 - boxWidth / 2,
        y: shown.y + shown.height / 2 - boxHeight / 2,
        width: boxWidth,
        height: boxHeight,
      };
    },
    { name: 'minimap:viewBox', equals: sameRect },
  );
  /** Everything outside the visible area is shaded: the whole box with the visible area cut out. */
  const mask = () => {
    const box = viewBox();
    const area = visible();
    if (!box || !area) return undefined;
    const rect = ({ x, y, width, height }: Rect) => `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    return `${rect(box)} ${rect(area)}`;
  };

  /** A pointer position to Flow coordinates, through a view box. */
  const toFlow = (svg: SVGSVGElement, box: Rect, event: { clientX: number; clientY: number }): Point => {
    const rect = svg.getBoundingClientRect();
    return {
      x: box.x + ((event.clientX - rect.left) / Math.max(rect.width, 1)) * box.width,
      y: box.y + ((event.clientY - rect.top) / Math.max(rect.height, 1)) * box.height,
    };
  };
  /** Pans the Flow so this point, in Flow coordinates, is at its centre. */
  const centreOn = (point: Point) => {
    const { zoom } = flow.viewport();
    const size = flow.size();
    flow.setViewport({ x: size.width / 2 - point.x * zoom, y: size.height / 2 - point.y * zoom, zoom });
  };

  // While dragging, the view box is the one the drag started with: it changes as the Flow pans, and the point under
  // the pointer must not move with it.
  let drag: { pointer: number; box: Rect; from: Point; viewport: { x: number; y: number; zoom: number } } | undefined;
  const onPointerDown = (event: PointerEvent) => {
    const svg = event.currentTarget as SVGSVGElement;
    const box = viewBox();
    if (!pannable() || drag || !box || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    svg.focus({ preventScroll: true });
    const from = toFlow(svg, box, event);
    const area = visible();
    const inside =
      area && from.x >= area.x && from.x <= area.x + area.width && from.y >= area.y && from.y <= area.y + area.height;
    if (!inside) centreOn(from);
    drag = { pointer: event.pointerId, box, from, viewport: flow.viewport() };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer (a synthetic event).
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const to = toFlow(event.currentTarget as SVGSVGElement, drag.box, event);
    const { x, y, zoom } = drag.viewport;
    flow.setViewport({ x: x - (to.x - drag.from.x) * zoom, y: y - (to.y - drag.from.y) * zoom, zoom });
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (drag?.pointer === event.pointerId) drag = undefined;
  };
  const onWheel = (event: WheelEvent) => {
    // The Flow's own wheel zoom would follow the pointer, which isn't over the Flow's content here.
    event.stopPropagation();
    if (!zoomable()) return;
    event.preventDefault();
    flow.zoomTo(flow.viewport().zoom * 2 ** (-event.deltaY * 0.002));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const area = visible();
    const { x, y, zoom } = flow.viewport();
    if (zoomable() && (event.key === '+' || event.key === '=')) flow.zoomIn();
    else if (zoomable() && event.key === '-') flow.zoomOut();
    else if (pannable() && area && event.key.startsWith('Arrow')) {
      const step = { x: area.width * KEY_PAN * zoom, y: area.height * KEY_PAN * zoom };
      const by: Record<string, Point> = {
        ArrowLeft: { x: step.x, y: 0 },
        ArrowRight: { x: -step.x, y: 0 },
        ArrowUp: { x: 0, y: step.y },
        ArrowDown: { x: 0, y: -step.y },
      };
      const move = by[event.key];
      if (!move) return;
      flow.setViewport({ x: x + move.x, y: y + move.y, zoom });
    } else return;
    event.preventDefault();
  };

  const nodeFill = (node: FlowNode<N>) => (typeof props.nodeColor === 'function' ? props.nodeColor(node) : props.nodeColor);
  const nodeClass = (node: FlowNode<N>) => {
    const extra = typeof props.nodeClass === 'function' ? props.nodeClass(node) : props.nodeClass;
    return extra ? `slp-flow-minimap-node ${extra}` : 'slp-flow-minimap-node';
  };
  const interactive = () => pannable() || zoomable();

  drawInLayer(
    'panel',
    <div
      class={panelClass('slp-flow-minimap', props.class)}
      data-flow-panel
      data-position={props.position ?? 'bottom-right'}
      style={props.style}
    >
      <svg
        width={width()}
        height={height()}
        viewBox={viewBox() && `${viewBox()!.x} ${viewBox()!.y} ${viewBox()!.width} ${viewBox()!.height}`}
        role="img"
        aria-label={props['aria-label'] ?? internals.messages().miniMap}
        aria-describedby={interactive() ? instructions : undefined}
        tabindex={interactive() ? '0' : undefined}
        data-pannable={pannable() ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <For each={flow.state().nodes}>
          {(node) => {
            const bounds = createMemo(() => nodeBounds(flow.index(), node.id, flow.measuredSize), {
              name: 'minimap:node',
              equals: sameRect,
            });
            return (
              <Show when={bounds()}>
                {(rect) => (
                  <rect
                    class={nodeClass(node)}
                    data-flow-minimap-node={node.id}
                    data-selected={node.selected ? '' : undefined}
                    x={rect().x}
                    y={rect().y}
                    width={rect().width}
                    height={rect().height}
                    style={{ fill: nodeFill(node) }}
                  />
                )}
              </Show>
            );
          }}
        </For>
        <Show when={mask()}>{(d) => <path class="slp-flow-minimap-mask" d={d()} fill-rule="evenodd" />}</Show>
        <Show when={visible()}>
          {(area) => (
            <rect
              class="slp-flow-minimap-view"
              x={area().x}
              y={area().y}
              width={area().width}
              height={area().height}
              vector-effect="non-scaling-stroke"
            />
          )}
        </Show>
      </svg>
      <Show when={interactive()}>
        <VisuallyHidden id={instructions}>{internals.messages().miniMapInstructions}</VisuallyHidden>
      </Show>
    </div>,
  );
  return undefined;
}
