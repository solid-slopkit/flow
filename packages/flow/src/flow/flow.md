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

| Prop                | Type                                    | Default                   | Description                                                                                                                                  |
| ------------------- | --------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`             | `FlowState<N, E>`                       | required                  | The app's data, usually a store.                                                                                                             |
| `onChange`          | `(batch: Batch<N, E>) => void`          |                           | Every edit, as a Batch. The app applies what it accepts.                                                                                     |
| `createId`          | `() => string`                          | `crypto.randomUUID()`     | Ids for records the Flow creates.                                                                                                            |
| `interactive`       | `boolean`                               | `true`                    | `false` is read-only: no Batches are sent. Panning and zooming still work.                                                                   |
| `viewport`          | `Viewport`                              |                           | Controlled: the Flow shows this and reports changes through `onViewportChange`.                                                              |
| `defaultViewport`   | `Viewport`                              | `{ x: 0, y: 0, zoom: 1 }` | Uncontrolled starting Viewport.                                                                                                              |
| `onViewportChange`  | `(viewport: Viewport) => void`          |                           | Every Viewport change, controlled or not.                                                                                                    |
| `minZoom`           | `number`                                | `0.5`                     |                                                                                                                                              |
| `maxZoom`           | `number`                                | `2`                       |                                                                                                                                              |
| `scrollPans`        | `boolean`                               | `false`                   | The wheel pans instead of zooming; Ctrl + wheel and trackpad pinch still zoom.                                                               |
| `fitView`           | `boolean \| FitViewOptions`             | `false`                   | Start fitted to the Nodes with a size.                                                                                                       |
| `snapToGrid`        | `number \| [number, number]`            |                           | Dragged Nodes snap to a grid (see [nodes](../node/node.md)).                                                                                 |
| `alignmentGuides`   | `boolean \| { threshold? }`             | `false`                   | Guides and snapping to other Nodes while dragging.                                                                                           |
| `reparentOnDrop`    | `boolean \| (node, parent) => boolean`  | `false`                   | Dropping dragged Nodes onto a Node nests them in it.                                                                                         |
| `canConnect`        | `(source: End, target: End) => boolean` |                           | Whether a Connection may end there, after Port kinds and `max` (see [connections](../connection/connection.md)).                             |
| `connectionRadius`  | `number`                                | `20`                      | How close, in screen pixels, a Connection snaps to a Port it may end on.                                                                     |
| `onConnectEnd`      | `(end: ConnectEnd) => void`             |                           | A new Connection dropped on empty space: its position in Flow coordinates and its starting Port.                                             |
| `selectionMode`     | `'partial' \| 'full'`                   | `'partial'`               | Which Nodes the selection box takes (see [selection](../selection/selection.md)).                                                            |
| `transformCopy`     | `(payload) => payload \| undefined`     |                           | Changes what copy and cut write (see [clipboard](../clipboard/clipboard.md)).                                                                |
| `transformPaste`    | `(payload) => payload \| undefined`     |                           | Changes what a paste adds.                                                                                                                   |
| `onDrop`            | `(drop: { data, position }) => void`    |                           | A `<FlowDraggable>` dropped on the Flow (see [palette](../palette/palette.md)).                                                              |
| `aria-label`        | `string`                                | `messages.flow`           | The Flow's accessible name (see [accessibility](../accessibility/accessibility.md)).                                                         |
| `messages`          | `Partial<FlowMessages>`                 |                           | Replaces any label or announcement the Flow writes for assistive technology.                                                                 |
| `onlyRenderVisible` | `boolean \| { margin? }`                | `false`                   | Render only the Nodes and Edges in sight, for large Flows (see [below](#rendering-only-visible-nodes)).                                      |
| `width`, `height`   | `number`                                |                           | The Flow's declared size in pixels: set on the element, used until it is measured, and on the server.                                        |
| `class`, `style`    |                                         |                           | On the Flow's root element (`.slp-flow`).                                                                                                    |
| `children`          | `JSX.Element`                           |                           | Rendered in the Node layer; `<Edge>`s and built-in UI draw into their own layers (see [edges](../edge/edge.md), [built-in UI](../ui/ui.md)). |

## Viewport

```ts
type Viewport = { x: number; y: number; zoom: number };
```

A point `p` in Flow coordinates is drawn at `p * zoom + (x, y)` from the Flow's top-left corner. The zoom always stays within `minZoom` and `maxZoom`.

## Gestures

Built on Pointer Events with pointer capture, so mouse, pen and touch share one path.

- Dragging empty space (primary or middle mouse button, one finger) pans; Shift-dragging it draws the selection box instead. A drag that starts on content in the Flow doesn't. While panning, the root has `data-panning`.
- The wheel zooms around the pointer; with `scrollPans` it pans and Ctrl + wheel zooms. A trackpad pinch arrives as Ctrl + wheel. The wheel never scrolls the page while over the Flow.
- Two fingers pinch: zoom by their spread around their midpoint, and pan with the midpoint.
- Clicks select, and a focused Flow takes the keyboard and the clipboard: the root has `tabindex="0"` and `role="application"`, and Tab moves focus over its Nodes, Ports and Edges (see [selection](../selection/selection.md), [accessibility](../accessibility/accessibility.md) and [clipboard](../clipboard/clipboard.md)).
- Dragging from a Port, or from an Edge's end, is a Connection (see [connections](../connection/connection.md)). While it lasts, the root has `data-connecting`.

## `useFlow()`

Inside a Flow's children, returns that Flow's `FlowApi`. Each Flow has its own, so several Flows can share a page. Throws outside a Flow.

| Member                      | Description                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `state()`, `index()`        | The state, and a `FlowIndex` over it.                                                                      |
| `emit(batch)`               | Sends a Batch to `onChange`, and announces it in the live region; dropped when not interactive.            |
| `createId()`                | From the props.                                                                                            |
| `interactive()`             | Whether the Flow sends Batches: the `interactive` prop, and not locked. Reactive.                          |
| `locked()`, `setLocked(on)` | Locks editing, as the lock button of `<Controls>` does; the Flow's own state, starting unlocked. Reactive. |
| `viewport()`                | The current Viewport. Reactive.                                                                            |
| `setViewport(viewport)`     | Clamps the zoom; sets it when uncontrolled, reports it through `onViewportChange` either way.              |
| `zoomTo(zoom, around?)`     | Zooms keeping the Flow point under `around` (a screen point) in place; default the Flow's centre.          |
| `zoomIn()`, `zoomOut()`     | Zoom by a factor of 1.2 around the centre.                                                                 |
| `screenToFlow(point)`       | A screen point, as `clientX` / `clientY` report it, to Flow coordinates.                                   |
| `flowToScreen(point)`       | The other way.                                                                                             |
| `fitView(options?)`         | Shows every Node with a size, or `options.nodes`, whole and centred. Nothing when none has a size.         |
| `fitBounds(rect, options?)` | Shows a box in Flow coordinates whole and centred.                                                         |
| `size()`                    | The Flow's size: measured in the page, else `width` / `height`. Reactive.                                  |
| `zoomLimits()`              | `{ minZoom, maxZoom }`.                                                                                    |
| `measuredSize(id)`          | A Node's Measured size, once it has been rendered and measured. Reactive.                                  |
| `measuredPort(node, port)`  | A Port's measured `{ x, y, side }`, relative to its Node. Reactive.                                        |
| `port(node, port)`          | A Port's `{ side, kind, max }`: its `<Port>`, else its declaration (see [ports](../port/port.md)).         |
| `connection()`              | The Connection being dragged, else `undefined` (see [connections](../connection/connection.md)). Reactive. |

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

## Rendering only visible Nodes

Every Node is the app's own DOM, so a Flow slows down past a few thousand of them. With `onlyRenderVisible`, the Flow renders only the Nodes and Edges in sight, and those within `margin` screen pixels of it (default 200). The rest aren't in the page until the Viewport brings them near (ADR 0015).

```tsx
<Flow state={flow} onChange={apply} onlyRenderVisible={{ margin: 300 }}>
  <For each={flow.nodes}>{(node) => <Node id={node.id}>{node.data.title}</Node>}</For>
  <For each={flow.edges}>{(edge) => <Edge id={edge.id} />}</For>
</Flow>
```

- It is off by default because a Node that isn't rendered is hidden from screen readers too. Keyboard focus still reaches every Node (below).
- A Node is in sight when its box touches the visible area: from its Measured size, else its Declared size, else its position alone. Give Nodes a Declared `size` so they are placed exactly before they are ever rendered.
- A Node that leaves sight keeps its last Measured size, its measured Ports, its name and what its `<Port>`s said (side, kind, `max`), so Edges, Connections, `fitView` and the MiniMap still place it. They are forgotten only when the Node itself is no longer rendered by the app.
- Nodes that are selected, dragged, focused (or hold focus) or part of a Connection (where it starts and the Port it snaps to) stay rendered out of sight.
- An Edge is drawn when its line is in sight: the box of its ends, its label point and, for a built-in shape, its path's control points. A selected, focused or reconnected Edge is always drawn. An Edge out of sight keeps its empty `g.slp-flow-edge` (with `aria-hidden`, no `tabindex`) and a hidden, empty label box.
- Each `<Node>` sits in an empty `div.slp-flow-node-slot` (`display: contents`) that stays in the page, and its element and content render inside it while it is shown. The app's content is created afresh each time a Node comes back into sight, so keep state that must survive in the app's data.
- Tab and Shift+Tab still follow spatial order over every Node, Port and Edge, from the data: moving focus to one that isn't rendered centres the Viewport on it, renders it, then focuses it (see [accessibility](../accessibility/accessibility.md#focus)). A keyboard Connection reaches Ports on Nodes out of sight the same way.
- Panning and zooming re-run only the Nodes and Edges near the visible area, in 400 × 400 cells of Flow coordinates; the rest don't run at all.
- On the server the visible area comes from `width`, `height` and the starting Viewport, so the server and the browser render the same Nodes. Without a declared size every Node renders until the Flow is measured.

## Server rendering

The Flow renders on the server and hydrates in the browser (ADR 0019). Nothing reads `window` or measures while rendering: geometry uses the Measured size where there is one, else the Declared one.

- Every Node renders at its position, sized by its Declared `size` if it has one.
- An Edge is drawn on the server when both its ends can be placed from the data: the Nodes at both ends have a Declared `size`, and every Port it names is declared in its Node's `ports` (`side`, optional `offset`). A Floating end needs no Port. Its label is drawn with it.
- Any other Edge renders as an empty `g.slp-flow-edge` and is drawn in the browser once its Nodes and Ports are measured.
- With `fitView` plus `width` and `height`, the fitted Viewport is computed while rendering, from the Nodes' Declared sizes, so the server sends it and the browser starts from the same one. Otherwise `fitView` runs in the browser as the Flow and its Nodes are measured, until every Node has a size, unless the Viewport is moved first.

In the browser the Flow measures its Nodes and Ports as usual, and the measurements replace the declared values. A diagram that declares everything renders in full without a browser:

```tsx
const size = { width: 120, height: 40 };
const ports: PortSpec[] = [
  { id: 'in', side: 'left' },
  { id: 'out', side: 'right' },
];
const state: FlowState = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size, ports, data: null },
    { id: 'b', position: { x: 200, y: 0 }, size, ports, data: null },
  ],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' }, data: null }],
};

<Flow state={state} width={640} height={320} fitView>
  <For each={state.nodes}>
    {(node) => (
      <Node id={node.id}>
        <Port id="in" />
        {node.id}
        <Port id="out" />
      </Node>
    )}
  </For>
  <For each={state.edges}>{(edge) => <Edge id={edge.id} />}</For>
</Flow>;
```

## Structure and styling

```
.slp-flow                  root: overflow hidden, touch-action none, data-panning / data-connecting
  svg.slp-flow-background  each <Background>, under the Viewport
  .slp-flow-viewport       transform: translate(x, y) scale(zoom), origin top-left
    svg.slp-flow-edges     the Edge layer: each <Edge>'s g.slp-flow-edge
    .slp-flow-nodes        the Node layer: the Flow's children, each <Node> in its div.slp-flow-node-slot
    .slp-flow-labels       the Edge label layer, above the Nodes: each .slp-flow-edge-label
    svg.slp-flow-connection  the preview line of a Connection being dragged
    svg.slp-flow-guides    alignment guides while dragging
  .slp-flow-selection-box  the selection box, in pixels over the Flow
  .slp-flow-panel          each <Controls> and <MiniMap>, in a corner over the Viewport
```
