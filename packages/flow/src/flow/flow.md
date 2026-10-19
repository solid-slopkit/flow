# Flow and Viewport

`<Flow>` is the editor surface: one Viewport with the app's Nodes and Edges drawn in it. It reads the app's `FlowState` (see [model](../model/model.md)) and never writes it; every edit goes out as a Batch through `onChange` (see [changes](../changes/changes.md)). Panning and zooming are the Flow's own state, the Viewport, and need no Batches.

```tsx
import { applyChanges, Flow, type FlowState } from '@solid-slopkit/flow';

const [flow, setFlow] = createStore<FlowState<Task, null>>({ nodes: [], edges: [] });

<Flow state={flow} onChange={(batch) => applyChanges(setFlow, batch)} fitView style={{ height: '600px' }}>
  {/* the app's Nodes and Edges */}
</Flow>;
```

The Flow has no size of its own: give it one with CSS, or with `width` and `height`.

## Props

| Prop               | Type                                    | Default                   | Description                                                                                                      |
| ------------------ | --------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `state`            | `FlowState<N, E>`                       | required                  | The app's data, usually a store.                                                                                 |
| `onChange`         | `(batch: Batch<N, E>) => void`          |                           | Every edit, as a Batch. The app applies what it accepts.                                                         |
| `createId`         | `() => string`                          | `crypto.randomUUID()`     | Ids for records the Flow creates.                                                                                |
| `interactive`      | `boolean`                               | `true`                    | `false` is read-only: no Batches are sent. Panning and zooming still work.                                       |
| `viewport`         | `Viewport`                              |                           | Controlled: the Flow shows this and reports changes through `onViewportChange`.                                  |
| `defaultViewport`  | `Viewport`                              | `{ x: 0, y: 0, zoom: 1 }` | Uncontrolled starting Viewport.                                                                                  |
| `onViewportChange` | `(viewport: Viewport) => void`          |                           | Every Viewport change, controlled or not.                                                                        |
| `minZoom`          | `number`                                | `0.5`                     |                                                                                                                  |
| `maxZoom`          | `number`                                | `2`                       |                                                                                                                  |
| `scrollPans`       | `boolean`                               | `false`                   | The wheel pans instead of zooming; Ctrl + wheel and trackpad pinch still zoom.                                   |
| `fitView`          | `boolean \| FitViewOptions`             | `false`                   | Start fitted to the Nodes with a size.                                                                           |
| `snapToGrid`       | `number \| [number, number]`            |                           | Dragged Nodes snap to a grid (see [nodes](../node/node.md)).                                                     |
| `alignmentGuides`  | `boolean \| { threshold? }`             | `false`                   | Guides and snapping to other Nodes while dragging.                                                               |
| `reparentOnDrop`   | `boolean \| (node, parent) => boolean`  | `false`                   | Dropping dragged Nodes onto a Node nests them in it.                                                             |
| `canConnect`       | `(source: End, target: End) => boolean` |                           | Whether a Connection may end there, after Port kinds and `max` (see [connections](../connection/connection.md)). |
| `connectionRadius` | `number`                                | `20`                      | How close, in screen pixels, a Connection snaps to a Port it may end on.                                         |
| `onConnectEnd`     | `(end: ConnectEnd) => void`             |                           | A new Connection dropped on empty space: its position in Flow coordinates and its starting Port.                 |
| `width`, `height`  | `number`                                |                           | The Flow's declared size in pixels: set on the element, used until it is measured, and on the server.            |
| `class`, `style`   |                                         |                           | On the Flow's root element (`.slp-flow`).                                                                        |
| `children`         | `JSX.Element`                           |                           | Rendered in the Node layer; `<Edge>`s draw into the Edge and label layers (see [edges](../edge/edge.md)).        |

## Viewport

```ts
type Viewport = { x: number; y: number; zoom: number };
```

A point `p` in Flow coordinates is drawn at `p * zoom + (x, y)` from the Flow's top-left corner. The zoom always stays within `minZoom` and `maxZoom`.

## Gestures

Built on Pointer Events with pointer capture, so mouse, pen and touch share one path.

- Dragging empty space (primary or middle mouse button, one finger) pans. A drag that starts on content in the Flow doesn't. While panning, the root has `data-panning`.
- The wheel zooms around the pointer; with `scrollPans` it pans and Ctrl + wheel zooms. A trackpad pinch arrives as Ctrl + wheel. The wheel never scrolls the page while over the Flow.
- Two fingers pinch: zoom by their spread around their midpoint, and pan with the midpoint.
- Dragging from a Port, or from an Edge's end, is a Connection (see [connections](../connection/connection.md)). While it lasts, the root has `data-connecting`.

## `useFlow()`

Inside a Flow's children, returns that Flow's `FlowApi`. Each Flow has its own, so several Flows can share a page. Throws outside a Flow.

| Member                        | Description                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `state()`, `index()`          | The state, and a `FlowIndex` over it.                                                                      |
| `emit(batch)`                 | Sends a Batch to `onChange`; dropped when not interactive.                                                 |
| `createId()`, `interactive()` | From the props.                                                                                            |
| `viewport()`                  | The current Viewport. Reactive.                                                                            |
| `setViewport(viewport)`       | Clamps the zoom; sets it when uncontrolled, reports it through `onViewportChange` either way.              |
| `zoomTo(zoom, around?)`       | Zooms keeping the Flow point under `around` (a screen point) in place; default the Flow's centre.          |
| `zoomIn()`, `zoomOut()`       | Zoom by a factor of 1.2 around the centre.                                                                 |
| `screenToFlow(point)`         | A screen point, as `clientX` / `clientY` report it, to Flow coordinates.                                   |
| `flowToScreen(point)`         | The other way.                                                                                             |
| `fitView(options?)`           | Shows every Node with a size, or `options.nodes`, whole and centred. Nothing when none has a size.         |
| `fitBounds(rect, options?)`   | Shows a box in Flow coordinates whole and centred.                                                         |
| `size()`                      | The Flow's size: measured in the page, else `width` / `height`. Reactive.                                  |
| `zoomLimits()`                | `{ minZoom, maxZoom }`.                                                                                    |
| `measuredSize(id)`            | A Node's Measured size, while it is rendered. Reactive.                                                    |
| `measuredPort(node, port)`    | A Port's measured `{ x, y, side }`, relative to its Node. Reactive.                                        |
| `port(node, port)`            | A Port's `{ side, kind, max }`: its `<Port>`, else its declaration (see [ports](../port/port.md)).         |
| `connection()`                | The Connection being dragged, else `undefined` (see [connections](../connection/connection.md)). Reactive. |

`FitOptions` is `{ padding?: number }`, space kept free around the bounds in screen pixels (default 24). `FitViewOptions` adds `nodes?: string[]`.

```tsx
function ZoomButtons() {
  const flow = useFlow();
  return (
    <>
      <button onClick={() => flow.zoomIn()}>+</button>
      <button onClick={() => flow.fitView({ padding: 40 })}>Fit</button>
    </>
  );
}
```

## Server rendering

The Flow renders on the server with its layers and the app's children. With `fitView` plus `width` and `height`, the fitted Viewport is computed while rendering, from the Nodes' Declared sizes, so the server sends it. Otherwise `fitView` runs on the client as the Flow and its Nodes are measured, until every Node has a size, unless the Viewport is moved first.

## Structure and styling

```
.slp-flow                  root: overflow hidden, touch-action none, data-panning / data-connecting
  .slp-flow-viewport       transform: translate(x, y) scale(zoom), origin top-left
    svg.slp-flow-edges     the Edge layer: each <Edge>'s g.slp-flow-edge
    .slp-flow-nodes        the Node layer: the Flow's children
    .slp-flow-labels       the Edge label layer, above the Nodes: each .slp-flow-edge-label
    svg.slp-flow-connection  the preview line of a Connection being dragged
    svg.slp-flow-guides    alignment guides while dragging
```
